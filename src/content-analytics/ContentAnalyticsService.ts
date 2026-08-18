/* ============================================================
 * ContentAnalyticsService (PHASE CONTENT-ANALYTICS-03)
 * ------------------------------------------------------------
 * Pure functions (dễ test độc lập) + 1 hàm điều phối `buildContentAnalytics`.
 * Business rule tóm tắt (đã chốt ở PHASE 02/02.1 — xem CURRENT_STATE.md nếu cần):
 *   - Content = normalized ad_name (trim + gộp khoảng trắng). KHÔNG dùng ad_id làm Content ID.
 *   - Employee = account_name nguyên văn (rỗng → "(Không xác định)").
 *   - Dedup CHỈ khi (date, ad_id, account_id, campaign_id, adset_id) giống hệt nhau —
 *     giữ dòng có purchases LỚN NHẤT (Raw_Data có mẫu export/snapshot nhiều lần/ngày,
 *     bản ghi sau ≥ bản ghi trước — xem PHASE 02.1 audit: 152 nhóm, 100% cùng ngày
 *     2026-06-03, 100% cùng account/campaign/adset). Nếu account_id/campaign_id/adset_id
 *     KHÁC nhau dù cùng (date, ad_id) → giữ TẤT CẢ, không dedup.
 *   - first_seen(content) = MIN(date) trên TOÀN BỘ lịch sử SAU dedup (không giới hạn tháng).
 *   - Content MỚI nếu first_seen thuộc tháng M đang xem; CŨ nếu trước đó.
 *   - Data = SUM(purchases). Một Content có thể có nhiều Employee — KHÔNG ép về 1 người,
 *     giữ đầy đủ employeeBreakdown; "employee" hiển thị là danh sách nối bằng ", ".
 *   - PHASE 04: Employee CHỈ có đúng 4 người thật (KA/Hiếu/Ánh/Liên), suy ra từ account_name
 *     qua resolveEmployee() (không hiển thị account_name nguyên văn nữa). byEmployee (khi
 *     employee='ALL') LUÔN trả đủ 4 tên theo thứ tự cố định (0 nếu không có data), cộng thêm
 *     dòng UNKNOWN_EMPLOYEE nếu có account_name không khớp — để không mất purchases thật.
 * ========================================================== */
import { ContentAnalyticsProvider } from './ContentAnalyticsProvider';
import {
  UNKNOWN_EMPLOYEE, EMPLOYEE_NAMES,
  type RawAdsAnalyticsRow, type ContentAnalyticsParams, type ContentAnalyticsResult,
  type ByContentItem, type ByEmployeeItem, type ContentType,
} from './types';

/** Content = ad_name đã chuẩn hóa: trim đầu/cuối + gộp nhiều khoảng trắng thành 1. */
export function normalizeContent(adName: string): string {
  return (adName ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Employee (PHASE 04) — CHỈ có đúng 4 nhân viên Ads thật: KA, Hiếu, Ánh, Liên.
 * account_name là mã kỹ thuật dạng "Med-Build-KA-1-VCB-6119" (không phải tên nhân viên) —
 * tách theo dấu '-', lấy token khớp (không phân biệt hoa/thường) với 1 trong 4 tên trên.
 * KHÔNG lấy account_id/số thứ tự/mã ngân hàng. KHÔNG tự tạo nhân viên mới ngoài 4 tên này —
 * account_name không khớp (vd "Khiêm") → UNKNOWN_EMPLOYEE, KHÔNG âm thầm gán vào 1 trong 4.
 */
export function resolveEmployee(accountName: string): string {
  const tokens = (accountName ?? '').split('-').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const hit = EMPLOYEE_NAMES.find((name) => tokens.includes(name.toLowerCase()));
  return hit ?? UNKNOWN_EMPLOYEE;
}

export interface DedupOutcome { deduped: RawAdsAnalyticsRow[]; duplicateGroups: number }

/**
 * Dedup CHỈ theo khóa đầy đủ (date, ad_id, account_id, campaign_id, adset_id).
 * Trong 1 nhóm trùng: giữ 1 dòng — purchases LỚN NHẤT (bằng nhau thì giữ dòng đầu tiên gặp).
 * Nhóm chỉ trùng (date, ad_id) nhưng account/campaign/adset khác nhau sẽ tự nhiên rơi vào
 * các key khác nhau ở đây → KHÔNG bị gộp, giữ nguyên toàn bộ (đúng yêu cầu).
 */
export function dedupRows(rows: RawAdsAnalyticsRow[]): DedupOutcome {
  const groups = new Map<string, RawAdsAnalyticsRow[]>();
  for (const r of rows) {
    const key = `${r.date}||${r.adId}||${r.accountId}||${r.campaignId}||${r.adsetId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const deduped: RawAdsAnalyticsRow[] = [];
  let duplicateGroups = 0;
  for (const rs of groups.values()) {
    if (rs.length > 1) duplicateGroups++;
    let best = rs[0];
    for (const r of rs.slice(1)) if (r.purchases > best.purchases) best = r;
    deduped.push(best);
  }
  return { deduped, duplicateGroups };
}

/** first_seen[content] = MIN(date) trên TOÀN BỘ tập truyền vào (phải là dữ liệu ĐÃ dedup, TOÀN lịch sử). */
export function computeFirstSeen(dedupedAllHistory: RawAdsAnalyticsRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of dedupedAllHistory) {
    const content = normalizeContent(r.adName);
    if (!content) continue;
    const cur = map.get(content);
    if (!cur || r.date < cur) map.set(content, r.date);
  }
  return map;
}

/** type = 'new' nếu first_seen thuộc tháng M (so theo prefix YYYY-MM), ngược lại 'old'. */
export function classifyType(firstSeen: string, month: string): ContentType {
  return firstSeen.slice(0, 7) === month ? 'new' : 'old';
}

function safePct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

function historyStartOf(rows: RawAdsAnalyticsRow[]): string | null {
  if (!rows.length) return null;
  return rows.reduce((min, r) => (r.date < min ? r.date : min), rows[0].date);
}

/**
 * Điều phối toàn bộ pipeline (STEP 1-9 theo spec):
 * đọc → dedup toàn lịch sử → first_seen toàn lịch sử → lọc tháng → lọc employee/search (row-level)
 * → group theo Content → xác định new/old → lọc theo type → tính overview/byEmployee trên đúng
 * tập đã lọc (đảm bảo overview/byContent/byEmployee LUÔN nhất quán với nhau).
 */
export async function buildContentAnalytics(
  params: ContentAnalyticsParams,
  provider: Pick<ContentAnalyticsProvider, 'fetchRows'> = new ContentAnalyticsProvider(),
): Promise<ContentAnalyticsResult> {
  const warnings: string[] = [];

  // STEP 1: đọc toàn bộ Raw_Data.
  const rawRows = await provider.fetchRows();
  const rowsRead = rawRows.length;

  // STEP 2+3: chuẩn hóa (ở bước group, content chỉ cần normalize khi dùng) + dedup toàn lịch sử.
  const { deduped, duplicateGroups } = dedupRows(rawRows);
  const rowsAfterDedup = deduped.length;

  // STEP 4: first_seen trên TOÀN BỘ lịch sử sau dedup — KHÔNG được tính lại sau khi lọc tháng.
  const firstSeenMap = computeFirstSeen(deduped);
  const historyStartDate = historyStartOf(deduped);

  if (historyStartDate && historyStartDate.slice(0, 7) >= params.month) {
    warnings.push(
      `Lịch sử Raw_Data bắt đầu từ ${historyStartDate} — có thể CHƯA đủ sâu để phân biệt chính xác Content Mới/Cũ cho tháng ${params.month} (mọi Content có thể bị tính "Mới" vì chưa từng thấy dữ liệu trước đó).`,
    );
  }

  // STEP 5: lọc theo tháng đang phân tích.
  let monthRows = deduped.filter((r) => r.date.slice(0, 7) === params.month);

  // Lọc row-level (employee/search) — áp dụng TRƯỚC khi group, để overview/byContent/byEmployee nhất quán.
  if (params.employee && params.employee !== 'ALL') {
    monthRows = monthRows.filter((r) => resolveEmployee(r.accountName) === params.employee);
  }
  const searchLower = params.search.trim().toLowerCase();
  if (searchLower) {
    monthRows = monthRows.filter((r) => normalizeContent(r.adName).toLowerCase().includes(searchLower));
  }

  // STEP 6+7: group theo Content (normalized ad_name) + SUM purchases + breakdown theo Employee.
  const contentAgg = new Map<string, { data: number; employees: Map<string, number> }>();
  for (const r of monthRows) {
    const content = normalizeContent(r.adName);
    if (!content) continue;
    const employee = resolveEmployee(r.accountName);
    if (!contentAgg.has(content)) contentAgg.set(content, { data: 0, employees: new Map() });
    const agg = contentAgg.get(content)!;
    agg.data += r.purchases;
    agg.employees.set(employee, (agg.employees.get(employee) ?? 0) + r.purchases);
  }

  // STEP 8: new/old dựa trên first_seen (tính trên TOÀN lịch sử, không đổi theo filter).
  let byContentAll: ByContentItem[] = [...contentAgg.entries()].map(([content, agg]) => {
    const firstSeen = firstSeenMap.get(content) ?? '';
    const type = classifyType(firstSeen, params.month);
    const employeeBreakdown = [...agg.employees.entries()]
      .map(([employee, data]) => ({ employee, data }))
      .sort((a, b) => b.data - a.data);
    return {
      content,
      employee: employeeBreakdown.map((e) => e.employee).join(', '),
      firstSeen,
      type,
      data: agg.data,
      pctOfTotal: 0, // tính lại bên dưới sau khi áp filter "type"
      employeeBreakdown,
    };
  });

  // Áp filter "type" — SAU khi đã xác định new/old (không được đoán trước).
  if (params.type !== 'all') {
    byContentAll = byContentAll.filter((c) => c.type === params.type);
  }
  const allowedContents = new Set(byContentAll.map((c) => c.content));

  // dataTotal dùng cho % LUÔN phản ánh đúng tập đang hiển thị (đã áp mọi filter).
  const dataTotalForPct = byContentAll.reduce((s, c) => s + c.data, 0);
  for (const item of byContentAll) item.pctOfTotal = safePct(item.data, dataTotalForPct);
  byContentAll.sort((a, b) => b.data - a.data);

  // STEP 9: overview — tổng theo type, trên ĐÚNG tập byContentAll đã lọc.
  const dataNew = byContentAll.filter((c) => c.type === 'new').reduce((s, c) => s + c.data, 0);
  const dataOld = byContentAll.filter((c) => c.type === 'old').reduce((s, c) => s + c.data, 0);
  const dataTotal = dataNew + dataOld;
  const overview = { dataNew, dataOld, dataTotal, pctNew: safePct(dataNew, dataTotal), pctOld: safePct(dataOld, dataTotal) };

  // byEmployee: group theo account_name trên các dòng thuộc Content đã qua filter "type".
  const empAgg = new Map<string, { dataNew: number; dataOld: number }>();
  for (const r of monthRows) {
    const content = normalizeContent(r.adName);
    if (!content || !allowedContents.has(content)) continue;
    const employee = resolveEmployee(r.accountName);
    const firstSeen = firstSeenMap.get(content) ?? '';
    const type = classifyType(firstSeen, params.month);
    if (!empAgg.has(employee)) empAgg.set(employee, { dataNew: 0, dataOld: 0 });
    const e = empAgg.get(employee)!;
    if (type === 'new') e.dataNew += r.purchases; else e.dataOld += r.purchases;
  }
  const toByEmployeeItem = (employee: string, v: { dataNew: number; dataOld: number } | undefined): ByEmployeeItem => {
    const dataNew = v?.dataNew ?? 0, dataOld = v?.dataOld ?? 0, t = dataNew + dataOld;
    return { employee, dataNew, dataOld, dataTotal: t, pctNew: safePct(dataNew, t), pctOld: safePct(dataOld, t) };
  };
  let byEmployee: ByEmployeeItem[];
  if (params.employee === 'ALL') {
    // Luôn hiển thị đủ 4 nhân viên cố định, đúng thứ tự, kể cả khi = 0 trong tháng/loại đang lọc.
    byEmployee = EMPLOYEE_NAMES.map((emp) => toByEmployeeItem(emp, empAgg.get(emp)));
    // account_name không khớp 4 tên trên — CHỈ hiện khi có data thật, để không mất purchases
    // (vẫn cộng đủ vào overview.dataTotal) mà không tự ý gán vào 1 trong 4 nhân viên.
    const unknown = empAgg.get(UNKNOWN_EMPLOYEE);
    if (unknown && unknown.dataNew + unknown.dataOld > 0) byEmployee.push(toByEmployeeItem(UNKNOWN_EMPLOYEE, unknown));
  } else {
    // Đã lọc theo 1 nhân viên cụ thể ở row-level (STEP 5) — empAgg chỉ còn đúng nhân viên đó.
    byEmployee = [...empAgg.entries()].map(([employee, v]) => toByEmployeeItem(employee, v));
  }

  const contentsUnknownEmployee = byContentAll.filter((c) => c.employeeBreakdown.some((e) => e.employee === UNKNOWN_EMPLOYEE)).length;

  return {
    month: params.month,
    overview,
    byContent: byContentAll,
    byEmployee,
    meta: {
      historyStartDate,
      rowsRead,
      rowsAfterDedup,
      duplicateGroups,
      contentsUnknownEmployee,
      warnings,
    },
  };
}
