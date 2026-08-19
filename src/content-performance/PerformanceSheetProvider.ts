/* ============================================================
 * PerformanceSheetProvider (CP-04)
 * ------------------------------------------------------------
 * Đọc TRỰC TIẾP Google Sheet "Roas content" (Performance/ROAS) — CHỈ ĐỌC, KHÔNG ghi.
 * ĐỘC LẬP HOÀN TOÀN với Content Sync/Ads Monitor/Content Analytics — không import,
 * không tái sử dụng logic transform của các module đó. Chỉ dùng chung `createGoogleAuth()`.
 *
 * Cấu trúc thật (đã audit ở CP-03A, KHÔNG suy đoán):
 *   Dòng 1   : tiêu đề — "... NĂM 2026" (năm lấy từ đây, không hard-code).
 *   Dòng có "TỔNG NĂM ..." : header cấp 1 — mốc THÁNG (13 khối: Tổng năm + 12 tháng).
 *   Dòng kế : header cấp 2 — Địa lý (TỔNG CỘNG / TRONG NƯỚC / NƯỚC NGOÀI), mỗi khối 5 cột.
 *   Dòng kế : header cấp 3 — Chi phí, SL data, Giá data, Roas trong tháng, Roas 3 tháng
 *             (đã TÍNH SẴN trong Sheet — KHÔNG tự suy ra công thức rolling).
 *   Cột 1/2/3 = Kênh / Phân loại / Tên content. Cột cuối = "Tên CGSĐ" (KHÔNG dùng — không
 *   phải Biên tập chính thức).
 *
 * V1 CHỈ lấy kênh "Facebook" (đã chốt với người dùng) — bỏ "PR"/"FB+PR_FB" vì Content của
 * PR là tên chiến dịch chữ tự do, không phải content_code số, không join được với Content
 * Sheet theo cùng cơ chế. Bỏ các dòng rác đã phát hiện thật ở CP-03A (Ko có tên content,
 * #REF!, "Thử nghiệm - ...", URL Facebook, token vô nghĩa).
 * ========================================================== */
import { google } from 'googleapis';
import { createGoogleAuth } from '../google-auth';
import type { RawPerformanceContentRow, PerformanceGeoMetrics, PerformanceMonthMetrics } from './types';

const METRIC_NAMES = ['Chi phí', 'SL data', 'Giá data', 'Roas trong tháng', 'Roas 3 tháng'] as const;
type MetricName = (typeof METRIC_NAMES)[number];

function parseIntVN(v: unknown): number {
  const s = (v ?? '').toString().trim();
  if (!s) return 0;
  const digits = s.replace(/[^\d-]/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}
function parsePercentVN(v: unknown): number {
  const s = (v ?? '').toString().trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(/%/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Loại các "Tên content" đã xác nhận là rác/test qua audit CP-03A trên dữ liệu thật. */
function isJunkContentName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (n === 'Ko có tên content') return true;
  if (n === '#REF!') return true;
  if (/^Th[ửư]\s*nghi[eệ]m\s*-/i.test(n)) return true;
  if (/^https?:\/\//i.test(n)) return true;
  if (n.toLowerCase() === 'test' || n === 'Quảng cáo') return true;
  if (n.length <= 2) return true;
  return false;
}

const emptyMetrics = (): PerformanceMonthMetrics => ({ cost: 0, dataCount: 0, dataPrice: 0, roasMonth: 0, roas3Month: 0 });

export class PerformanceSheetProvider {
  async fetchRows(): Promise<RawPerformanceContentRow[]> {
    const spreadsheetId = process.env.PERFORMANCE_SHEET_ID?.trim();
    const tab = process.env.PERFORMANCE_SHEET_TAB?.trim();
    if (!spreadsheetId) throw new Error('Thiếu PERFORMANCE_SHEET_ID trong env.');
    if (!tab) throw new Error('Thiếu PERFORMANCE_SHEET_TAB trong env.');

    const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '');
    const actual = titles.find((t) => t.trim() === tab.trim()) ?? titles.find((t) => t.trim().toLowerCase() === tab.trim().toLowerCase());
    if (!actual) throw new Error(`Không tìm thấy tab "${tab}" trong Performance Spreadsheet. Có: ${titles.join(', ')}`);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `'${actual.replace(/'/g, "''")}'`, valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = (res.data.values ?? []) as string[][];
    if (!rows.length) return [];

    // Năm lấy từ dòng tiêu đề (vd "... NĂM 2026"), KHÔNG hard-code.
    const titleRow = rows.find((r) => r.some((c) => /NĂM\s+\d{4}/.test(c ?? '')));
    const yearMatch = titleRow?.find((c) => /NĂM\s+\d{4}/.test(c ?? ''))?.match(/NĂM\s+(\d{4})/);
    const year = yearMatch ? yearMatch[1] : String(new Date().getUTCFullYear());

    const monthHeaderIdx = rows.findIndex((r) => r.some((c) => /^TỔNG NĂM/.test((c ?? '').toString().trim())));
    if (monthHeaderIdx === -1) throw new Error('Không tìm thấy dòng header "TỔNG NĂM ..." trong Performance Sheet.');
    const geoHeaderIdx = monthHeaderIdx + 1;
    const metricHeaderIdx = monthHeaderIdx + 2;
    const dataStartIdx = monthHeaderIdx + 3;

    const monthRow = rows[monthHeaderIdx] ?? [];
    const geoRow = rows[geoHeaderIdx] ?? [];
    const metricRow = rows[metricHeaderIdx] ?? [];
    const maxCols = Math.max(monthRow.length, geoRow.length, metricRow.length);

    // Carry-forward: mỗi cột thuộc khối THÁNG nào / Địa lý nào (chỉ set lại khi gặp marker mới).
    const monthByCol: (string | null)[] = new Array(maxCols).fill(null);
    let curMonth: string | null = null;
    for (let c = 0; c < maxCols; c++) {
      const cell = (monthRow[c] ?? '').toString().trim();
      const mm = cell.match(/^THÁNG\s*(\d{1,2})/i);
      if (mm) curMonth = `${year}-${mm[1].padStart(2, '0')}`;
      else if (/^TỔNG NĂM/.test(cell)) curMonth = 'YEAR_TOTAL';
      monthByCol[c] = curMonth;
    }
    const geoByCol: (('total' | 'noi_dia' | 'quoc_te') | null)[] = new Array(maxCols).fill(null);
    let curGeo: 'total' | 'noi_dia' | 'quoc_te' | null = null;
    for (let c = 0; c < maxCols; c++) {
      const cell = (geoRow[c] ?? '').toString().trim();
      if (/^TỔNG CỘNG/.test(cell)) curGeo = 'total';
      else if (/^TRONG NƯỚC/.test(cell)) curGeo = 'noi_dia';
      else if (/^NƯỚC NGOÀI/.test(cell)) curGeo = 'quoc_te';
      geoByCol[c] = curGeo;
    }

    const out: RawPerformanceContentRow[] = [];
    let curKenh = '';
    let curPhanLoai = '';
    for (let r = dataStartIdx; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const kenhCell = (row[1] ?? '').toString().trim();
      const plCell = (row[2] ?? '').toString().trim();
      if (kenhCell) curKenh = kenhCell; // forward-fill (một số section không lặp lại Kênh/Phân loại mỗi dòng)
      if (plCell) curPhanLoai = plCell;
      const contentName = (row[3] ?? '').toString().trim();

      if (!contentName) continue;               // dòng group/subtotal — không phải content thật
      if (isJunkContentName(contentName)) continue;
      if (curKenh !== 'Facebook') continue;      // V1: CHỈ kênh Facebook (đã chốt)

      const months: Record<string, PerformanceGeoMetrics> = {};
      for (let c = 4; c < maxCols; c++) {
        const month = monthByCol[c];
        const geo = geoByCol[c];
        const metricName = (metricRow[c] ?? '').toString().trim() as MetricName;
        if (!month || month === 'YEAR_TOTAL' || !geo || !METRIC_NAMES.includes(metricName)) continue;
        if (!months[month]) months[month] = { total: emptyMetrics(), noiDia: emptyMetrics(), quocTe: emptyMetrics() };
        const bucket = geo === 'total' ? months[month].total : geo === 'noi_dia' ? months[month].noiDia : months[month].quocTe;
        const raw = row[c];
        if (metricName === 'Chi phí') bucket.cost = parseIntVN(raw);
        else if (metricName === 'SL data') bucket.dataCount = parseIntVN(raw);
        else if (metricName === 'Giá data') bucket.dataPrice = parseIntVN(raw);
        else if (metricName === 'Roas trong tháng') bucket.roasMonth = parsePercentVN(raw);
        else if (metricName === 'Roas 3 tháng') bucket.roas3Month = parsePercentVN(raw);
      }

      out.push({ channel: curPhanLoai, contentName, months });
    }
    return out;
  }
}
