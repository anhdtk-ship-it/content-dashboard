/* ============================================================
 * ContentPerformanceService (CP-04)
 * ------------------------------------------------------------
 * Điều phối: Performance Sheet + Quality Sheet + Biên tập (từ bảng `contents` có sẵn,
 * CHỈ ĐỌC — KHÔNG dùng account_name/Ads Employee của Content Analytics).
 * V1: CHỈ kênh Facebook (đã chốt). PR để V2.
 * ========================================================== */
import { createSupa } from '../platform/db';
import { PerformanceSheetProvider } from './PerformanceSheetProvider';
import { QualitySheetProvider } from './QualitySheetProvider';
import {
  TOTAL_FACEBOOK_KEY,
  type ContentPerformanceParams, type ContentPerformanceResult, type ContentPerformanceTableItem,
  type RawPerformanceContentRow, type RawQualityContentRow, type PerformanceMonthMetrics, type PerformanceGeoMetrics,
} from './types';

const UNKNOWN_EDITOR = '(Không xác định)';

function metricsForGeo(row: RawPerformanceContentRow, month: string, geo: 'all' | 'noi_dia' | 'quoc_te'): PerformanceMonthMetrics | null {
  const m = row.months[month];
  if (!m) return null;
  return geo === 'noi_dia' ? m.noiDia : geo === 'quoc_te' ? m.quocTe : m.total;
}
function bucketOfGeo(m: PerformanceGeoMetrics, geo: 'all' | 'noi_dia' | 'quoc_te'): PerformanceMonthMetrics {
  return geo === 'noi_dia' ? m.noiDia : geo === 'quoc_te' ? m.quocTe : m.total;
}

/** Biên tập — MAP TỪ Content Sheet (bảng `contents`, cột editor_name) qua content_code. KHÔNG suy ra từ nguồn khác. */
async function fetchEditorMap(): Promise<Map<string, string>> {
  const db = createSupa();
  const map = new Map<string, string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from('contents').select('content_code, editor_name').range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      const code = (r.content_code ?? '').toString().trim();
      const editor = (r.editor_name ?? '').toString().trim();
      if (code && editor && !map.has(code)) map.set(code, editor);
    }
    if (data.length < pageSize) break;
  }
  return map;
}

export async function buildContentPerformance(
  params: ContentPerformanceParams,
  deps: { perfProvider?: Pick<PerformanceSheetProvider, 'fetchRows'>; qualProvider?: Pick<QualitySheetProvider, 'fetchRows'>; editorMap?: Map<string, string> } = {},
): Promise<ContentPerformanceResult> {
  const warnings: string[] = [];
  const perfProvider = deps.perfProvider ?? new PerformanceSheetProvider();
  const qualProvider = deps.qualProvider ?? new QualitySheetProvider();

  const [perfData, qualRows, editorMap] = await Promise.all([
    perfProvider.fetchRows(),
    qualProvider.fetchRows(),
    deps.editorMap ? Promise.resolve(deps.editorMap) : fetchEditorMap(),
  ]);
  const { contents: perfRows, subtotals } = perfData;

  // Các tháng THẬT SỰ có hoạt động (tổng cost hoặc data > 0 ở ít nhất 1 content) — tránh cho chọn tháng trống.
  const monthActivity = new Map<string, boolean>();
  for (const r of perfRows) {
    for (const [m, geo] of Object.entries(r.months)) {
      if (geo.total.cost > 0 || geo.total.dataCount > 0) monthActivity.set(m, true);
    }
  }
  const monthsAvailable = [...monthActivity.keys()].sort();

  // Index Quality theo `${contentName.trim()}||${month}` để tra nhanh.
  const qualIndex = new Map<string, RawQualityContentRow>();
  for (const q of qualRows) qualIndex.set(`${q.contentName.trim()}||${q.month}`, q);

  const channelsFound = [...new Set(perfRows.map((r) => r.channel))].sort();

  const searchLower = params.search.trim().toLowerCase();
  const table: ContentPerformanceTableItem[] = [];
  for (const r of perfRows) {
    if (params.channel !== 'ALL' && r.channel !== params.channel) continue;
    const metrics = metricsForGeo(r, params.month, params.geography);
    if (!metrics) continue;
    if (metrics.cost <= 0 && metrics.dataCount <= 0) continue; // không hoạt động trong tháng/địa lý đang lọc

    const editor = editorMap.get(r.contentName.trim()) ?? UNKNOWN_EDITOR;
    if (params.editor !== 'ALL' && editor !== params.editor) continue;
    if (searchLower && !r.contentName.toLowerCase().includes(searchLower)) continue;

    const q = qualIndex.get(`${r.contentName.trim()}||${params.month}`);
    table.push({
      content: r.contentName,
      editor,
      channel: r.channel,
      cost: metrics.cost,
      dataCount: metrics.dataCount,
      dataPrice: metrics.dataPrice,
      roasMonth: metrics.roasMonth,
      roas3Month: metrics.roas3Month,
      quality: q ? q.grandTotal : null,
    });
  }
  table.sort((a, b) => b.cost - a.cost);

  // Tổng quan (KPI): ƯU TIÊN đọc TRỰC TIẾP dòng subtotal ĐÃ CÓ SẴN trong Sheet (khớp 100% —
  // đặc biệt bắt buộc cho ROAS tháng/ROAS 3 tháng, vì đây là tỷ lệ rolling riêng của từng
  // content, KHÔNG thể cộng gộp lại đúng từ danh sách content mà không lệch so với Sheet).
  // CHỈ áp dụng được khi bộ lọc khớp đúng 1 dòng subtotal có sẵn — nghĩa là KHÔNG lọc theo
  // Biên tập/Tìm kiếm (Sheet không có subtotal cho tổ hợp lọc tuỳ ý này).
  let overview: ContentPerformanceResult['overview'];
  let overviewFromSheetSubtotal = false;
  const canUseSubtotal = params.editor === 'ALL' && !searchLower;
  const subtotalKey = params.channel === 'ALL' ? TOTAL_FACEBOOK_KEY : params.channel;
  const subtotalForMonth = canUseSubtotal ? subtotals.get(subtotalKey)?.[params.month] : undefined;

  if (subtotalForMonth) {
    const b = bucketOfGeo(subtotalForMonth, params.geography);
    overview = { cost: b.cost, dataCount: b.dataCount, dataPrice: b.dataPrice, roasMonth: b.roasMonth, roas3Month: b.roas3Month };
    overviewFromSheetSubtotal = true;
  } else {
    const totalCost = table.reduce((s, t) => s + t.cost, 0);
    const totalData = table.reduce((s, t) => s + t.dataCount, 0);
    const impliedRevenueMonth = table.reduce((s, t) => s + t.cost * (t.roasMonth / 100), 0);
    const impliedRevenue3Month = table.reduce((s, t) => s + t.cost * (t.roas3Month / 100), 0);
    overview = {
      cost: totalCost,
      dataCount: totalData,
      dataPrice: totalCost > 0 && totalData > 0 ? Math.round(totalCost / totalData) : 0,
      roasMonth: totalCost > 0 ? Math.round((impliedRevenueMonth / totalCost) * 1000) / 10 : 0,
      roas3Month: totalCost > 0 ? Math.round((impliedRevenue3Month / totalCost) * 1000) / 10 : 0,
    };
    if (!canUseSubtotal) {
      warnings.push('Đang lọc theo Biên tập/Tìm kiếm — Sheet không có dòng tổng cho tổ hợp lọc này, ROAS tháng/ROAS 3 tháng ở Tổng quan là ƯỚC LƯỢNG (Chi phí/SL Data vẫn chính xác).');
    }
  }

  const editorsAvailable = [...new Set(table.map((t) => t.editor))].sort((a, b) => a.localeCompare(b, 'vi'));
  const contentsUnmatchedEditor = table.filter((t) => t.editor === UNKNOWN_EDITOR).length;
  if (!monthsAvailable.includes(params.month)) {
    warnings.push(`Tháng ${params.month} chưa có dữ liệu hoạt động thật trong Performance Sheet (kênh Facebook).`);
  }

  return {
    month: params.month,
    overview,
    table,
    meta: {
      channelsAvailable: channelsFound,
      editorsAvailable,
      monthsAvailable,
      contentsUnmatchedEditor,
      overviewFromSheetSubtotal,
      warnings,
    },
  };
}
