/* Weekly Report — service đọc dữ liệu (PHASE 8).
 * Nguồn DUY NHẤT: API /api/v3/summary (đã có — KHÔNG sửa). KHÔNG đọc Google Sheet, KHÔNG tính lại.
 * Map metrics nghiệp vụ của Dashboard → KPI báo cáo tuần.
 *
 * ĐỊNH NGHĨA KPI (chỉnh tại đây nếu nghiệp vụ khác — xem báo cáo Phase 8):
 *   - Đã cấp      = capped (Content được cấp, theo Ngày Up Trello)
 *   - Đã test     = tested (Đang test + Duy trì-* + Đã test-ko chạy + Đã chạy-Tắt)
 *   - Chưa test   = capped − tested
 *   - Đã sử dụng  = tested − fail   (loại "Đã test-ko chạy"; = đã đưa vào chạy: đang test + đã chạy)
 *   - Tỷ lệ sử dụng = used / tested
 *   - Test win    = success (Thành công = Duy trì-* + Đã chạy-Tắt)
 *   - Tỷ lệ test win = win / tested
 */
import type { Geo, ReportMetrics, WeekRange, WeeklyReportData, EmployeeReport } from '../types/report';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dmy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

/** Thứ 2 của tuần chứa `anchor` (00:00). */
function mondayOf(anchor: Date): Date {
  const d = new Date(anchor); d.setHours(0, 0, 0, 0);
  const off = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - off);
  return d;
}

export function weekRange(anchor: Date): WeekRange {
  const mon = mondayOf(anchor);
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { from: ymd(mon), to: ymd(sun), label: `Tuần ${dmy(mon)} – ${pad(sun.getDate())}/${pad(sun.getMonth() + 1)}/${sun.getFullYear()}` };
}

export function currentWeek(): WeekRange {
  return weekRange(new Date());
}

/** Dịch tuần (±n tuần) từ một WeekRange. */
export function shiftWeek(w: WeekRange, deltaWeeks: number): WeekRange {
  const mon = new Date(w.from + 'T00:00:00');
  mon.setDate(mon.getDate() + deltaWeeks * 7);
  return weekRange(mon);
}

/** Map metrics thô từ /api/v3/summary → KPI báo cáo. */
export function toReportMetrics(m: any): ReportMetrics {
  const capped = Number(m?.capped) || 0;
  const tested = Number(m?.tested) || 0;
  const fail = Number(m?.fail) || 0;
  const success = Number(m?.success) || 0;
  const used = Math.max(0, tested - fail);
  const win = success;
  const safe = (num: number) => (tested > 0 ? num / tested : 0);
  return {
    capped, tested,
    notTested: Math.max(0, capped - tested),
    used, usageRate: safe(used),
    win, winRate: safe(win),
  };
}

/**
 * Lấy báo cáo tuần — 1 request tới /api/v3/summary (lọc theo tuần + địa lý).
 * "Đã cấp" theo Ngày Up Trello → dùng dateField mặc định (upload_date_real) của summary.
 */
export async function fetchWeeklyReport(week: WeekRange, geo: Geo): Promise<WeeklyReportData> {
  const p = new URLSearchParams();
  p.set('from', week.from);
  p.set('to', week.to);
  if (geo !== 'ALL') p.set('market', geo);

  const res = await fetch('/api/v3/summary?' + p.toString());
  const d = await res.json();
  if (d.error) throw new Error(d.error);

  const employees: EmployeeReport[] = (d.byAssignee ?? [])
    .map((row: any) => ({ name: row.assignee || '(trống)', metrics: toReportMetrics(row.m) }))
    .filter((e: EmployeeReport) => e.metrics.capped > 0 || e.metrics.tested > 0)
    .sort((a: EmployeeReport, b: EmployeeReport) => b.metrics.capped - a.metrics.capped);

  return {
    week, geo,
    team: toReportMetrics(d.metrics),
    employees,
    generatedAt: d.generatedAt ?? new Date().toISOString(),
  };
}

/* ---------- format helpers ---------- */
export const fmtPct = (x: number) => `${Math.round((x ?? 0) * 100)}%`;
export const fmtNum = (n: number) => (Number(n) || 0).toLocaleString('vi-VN');
