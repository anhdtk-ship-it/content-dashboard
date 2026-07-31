/* ============================================================
 * zaloMetrics — TÍNH KPI DASHBOARD ZALO (PURE, DÙNG CHUNG).
 * ------------------------------------------------------------
 * Không I/O, không DOM, không fetch → chạy được cả Node (API/PDF) lẫn trình duyệt (web).
 * Là NGUỒN DUY NHẤT của mọi con số Dashboard Zalo → API + Web + PDF không thể lệch nhau.
 *
 * Business Rule TRẠNG THÁI lấy từ ZaloStatusRule (độc lập Facebook).
 * KHÔNG hardcode Video/Banner: danh sách định dạng suy ra từ DỮ LIỆU + CẤU HÌNH mục tiêu.
 *
 * Bố cục theo spec ZALO-01:
 *   §V   blocks      — Đã cấp · Không test · Tồn · Đang test · Duy trì (theo từng định dạng)
 *   §VI  progress    — Actual/Target · % · so cùng kỳ tháng trước · so tiến độ lịch · forecast
 *   §VII attention   — chưa phân loại · chưa test · test quá N ngày · thiếu ngày test
 *   §VIII blocks     — (tái dùng blocks: đã kèm tỷ lệ test & tỷ lệ duy trì)
 *   §IX  quality     — thiếu trạng thái · thiếu định dạng · thiếu ngày test · trùng
 * ========================================================== */
import { zaloStatusRule, isDuyTri } from './ZaloStatusRule';
import { UNSPECIFIED_FORMAT_LABEL } from './contentFormat';
import type { ZaloContent } from './ZaloContent';

/* ---------- cấu hình đọc từ bảng platform_settings ---------- */
export interface ZaloSettings {
  targets: Record<string, number>; // mục tiêu THÁNG theo định dạng (key = tên định dạng)
  warningDays: number;             // "test quá N ngày"
  warningThreshold: number;        // ngưỡng số lượng để tô ĐỎ ở "Cần xử lý"
}
export const DEFAULT_WARNING_DAYS = 5;
export const DEFAULT_WARNING_THRESHOLD = 3;

/* ---------- kiểu kết quả ---------- */
export interface FormatKpi {
  format: string;      // '' = chưa có định dạng
  label: string;
  capped: number;      // Đã cấp (upload trong tháng)
  khongTest: number;   // Không chạy
  khongDuyet: number;  // Không được duyệt
  ton: number;         // Chờ chạy
  dangTest: number;    // Đang test (nếu Sheet có)
  duyTri: number;      // Đang chạy
  daDung: number;      // Đã chạy-Tắt + Đã test-Tắt
  tested: number;      // Đã test = Đang chạy + Đã chạy-Tắt + Đã test-Tắt (+ Đang test)
  rateTest: number;    // Đã test / Đã cấp
  rateDuyTri: number;  // Duy trì / Đã test
}
export interface FormatProgress {
  format: string;
  label: string;
  actual: number;
  target: number | null;
  pctComplete: number | null;              // null nếu chưa đặt mục tiêu
  prevSame: number;                        // cùng kỳ tháng trước (đến cùng ngày)
  deltaPrevPct: number | null;             // null nếu kỳ trước = 0
  scheduleStatus: 'ahead' | 'on' | 'behind' | 'na';
  expected: number | null;                 // sản lượng kỳ vọng theo lịch tới hôm nay
  forecast: number | null;                 // dự báo cuối tháng
}
export interface FormatAttention {
  format: string; label: string;
  chuaPhanLoai: number; chuaTest: number; testQuaLau: number; thieuNgayTest: number;
}
export interface FormatQuality {
  format: string; label: string;
  thieuTrangThai: number;  // current_status rỗng
  thieuNgayTest: number;   // đã/đang test nhưng thiếu ngày test
  trung: number;           // content_code trùng
  thieuBatBuoc: number;    // thiếu dữ liệu bắt buộc (Tên Content)
}
export interface ZaloSummary {
  month: string;        // 'YYYY-MM'
  monthLabel: string;   // 'MM/YYYY'
  today: string;        // 'YYYY-MM-DD' mốc tính lịch/cảnh báo
  warningDays: number;
  warningThreshold: number;
  formats: string[];    // danh sách định dạng hiển thị (động)
  blocks: FormatKpi[];      // §V + §VIII
  progress: FormatProgress[]; // §VI
  attention: FormatAttention[]; // §VII
  quality: FormatQuality[];     // §IX
  totals: FormatKpi;    // tổng tất cả định dạng (tiện hiển thị)
  generatedAt: string;
}

/* ---------- helpers ngày (thuần chuỗi/Date tất định) ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
export function monthBounds(month: string): { from: string; to: string; year: number; m: number; days: number } {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate(); // ngày cuối tháng (tất định)
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(days)}`, year: y, m, days };
}
export function addMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
const monthOf = (iso: string) => iso.slice(0, 7);
const dayOf = (iso: string) => Number(iso.slice(8, 10));

/* ---------- helpers dữ liệu ---------- */
const G = (s: string | null | undefined) => zaloStatusRule.statusGroup(s);
const fmtKey = (r: ZaloContent) => (r.content_format ?? '').trim();
const inPeriod = (r: ZaloContent, from: string, to: string) =>
  !!r.upload_date_real && r.upload_date_real >= from && r.upload_date_real <= to;
const rate = (a: number, b: number) => (b > 0 ? a / b : 0);
const labelOf = (format: string) => format || UNSPECIFIED_FORMAT_LABEL;

/** KPI cho 1 tập content (đã lọc theo định dạng + kỳ). Export để Weekly dùng chung → không lệch. */
export function kpiOf(format: string, rows: ZaloContent[]): FormatKpi {
  let khongTest = 0, khongDuyet = 0, ton = 0, dangTest = 0, duyTri = 0, daDung = 0;
  for (const r of rows) {
    switch (G(r.current_status)) {
      case 'KHONG_TEST': khongTest++; break;
      case 'KHONG_DUYET': khongDuyet++; break;
      case 'TON': ton++; break;
      case 'DANG_TEST': dangTest++; break;
      case 'DUY_TRI': duyTri++; break;
      case 'DA_DUNG': daDung++; break;
    }
  }
  const tested = duyTri + daDung + dangTest; // = số bản ghi isTested()
  return {
    format, label: labelOf(format), capped: rows.length,
    khongTest, khongDuyet, ton, dangTest, duyTri, daDung, tested,
    rateTest: rate(tested, rows.length), rateDuyTri: rate(duyTri, tested),
  };
}

/** Danh sách định dạng hiển thị (ĐỘNG): distinct trong toàn bộ dữ liệu ∪ có cấu hình target. */
export function resolveFormats(all: ZaloContent[], settings: ZaloSettings): string[] {
  const set = new Set<string>();
  for (const r of all) { const f = fmtKey(r); if (f) set.add(f); }
  for (const k of Object.keys(settings.targets)) if (k) set.add(k);
  const named = [...set].sort((a, b) => a.localeCompare(b, 'vi'));
  // Bucket "chưa có định dạng" chỉ thêm nếu thực sự có bản ghi thiếu định dạng.
  const hasUnspecified = all.some((r) => !fmtKey(r));
  return hasUnspecified ? [...named, ''] : named;
}

/** Toàn bộ số liệu Dashboard Zalo cho 1 THÁNG. `all` = toàn bộ content Zalo (mọi tháng). */
export function buildZaloSummary(
  all: ZaloContent[], month: string, today: string, settings: ZaloSettings, generatedAt: string,
): ZaloSummary {
  const { from, to, days } = monthBounds(month);
  const cohort = all.filter((r) => inPeriod(r, from, to));
  const formats = resolveFormats(all, settings);
  const warningDays = settings.warningDays || DEFAULT_WARNING_DAYS;

  // Lịch: phần thời gian đã trôi qua của tháng.
  const curMonth = monthOf(today);
  let elapsed: number; // 0..1
  if (month < curMonth) elapsed = 1;
  else if (month > curMonth) elapsed = 0;
  else elapsed = Math.min(1, Math.max(0, dayOf(today) / days));
  const dayCutoff = month < curMonth ? days : (month > curMonth ? 0 : dayOf(today));

  // Ngưỡng "test quá lâu": test_date_real < today - warningDays.
  const staleBefore = shiftIso(today, -warningDays);

  const cohortOf = (f: string) => cohort.filter((r) => fmtKey(r) === f);

  const blocks: FormatKpi[] = formats.map((f) => kpiOf(f, cohortOf(f)));
  const totals = kpiOf('', cohort); totals.format = 'ALL'; (totals as any).label = 'Tất cả định dạng';

  // §VI progress
  const prevMonth = addMonth(month, -1);
  const pb = monthBounds(prevMonth);
  const progress: FormatProgress[] = formats.map((f) => {
    const actual = cohortOf(f).length;
    const target = f in settings.targets ? settings.targets[f] : null;
    const prevSame = all.filter((r) => fmtKey(r) === f && !!r.upload_date_real &&
      monthOf(r.upload_date_real) === prevMonth && dayOf(r.upload_date_real) <= Math.min(dayCutoff || pb.days, pb.days)).length;
    const deltaPrevPct = prevSame > 0 ? (actual - prevSame) / prevSame : null;
    let scheduleStatus: FormatProgress['scheduleStatus'] = 'na';
    let expected: number | null = null;
    if (target != null && elapsed > 0) {
      expected = target * elapsed;
      scheduleStatus = actual >= expected * 1.05 ? 'ahead' : actual >= expected * 0.95 ? 'on' : 'behind';
    }
    const forecast = target != null ? (elapsed > 0 ? Math.round(actual / elapsed) : actual) : null;
    return {
      format: f, label: labelOf(f), actual, target,
      pctComplete: target && target > 0 ? actual / target : null,
      prevSame, deltaPrevPct, scheduleStatus, expected, forecast,
    };
  });

  // §VII attention (trong cohort tháng)
  const attention: FormatAttention[] = formats.map((f) => {
    const rs = cohortOf(f);
    return {
      format: f, label: labelOf(f),
      chuaPhanLoai: rs.filter((r) => G(r.current_status) === 'CHUA_PHAN_LOAI').length,
      chuaTest: rs.filter((r) => G(r.current_status) === 'TON').length, // chờ chạy = chưa đưa vào test
      // Test quá lâu = trạng thái "Đang test" (DANG_TEST) & ngày test quá warningDays (mặc định 5 ngày).
      testQuaLau: rs.filter((r) => G(r.current_status) === 'DANG_TEST' && !!r.test_date_real && r.test_date_real < staleBefore).length,
      thieuNgayTest: rs.filter((r) => zaloStatusRule.isTested(r.current_status) && !r.test_date_real).length,
    };
  });

  // §IX data quality (trong cohort tháng)
  const quality: FormatQuality[] = formats.map((f) => {
    const rs = cohortOf(f);
    // "Trùng" = cùng Tên Content xuất hiện ≥2 lần (khoá định danh vốn đã chống trùng theo mã).
    const titleCount = new Map<string, number>();
    for (const r of rs) { const t = (r.title ?? '').trim().toLowerCase(); if (t) titleCount.set(t, (titleCount.get(t) ?? 0) + 1); }
    const trung = [...titleCount.values()].filter((n) => n > 1).reduce((s, n) => s + n, 0);
    return {
      format: f, label: labelOf(f),
      thieuTrangThai: rs.filter((r) => (r.current_status ?? '').trim() === '').length,
      thieuNgayTest: rs.filter((r) => zaloStatusRule.isTested(r.current_status) && !r.test_date_real).length,
      trung,
      thieuBatBuoc: rs.filter((r) => !(r.title ?? '').trim()).length, // thiếu Tên Content (bắt buộc)
    };
  });

  return {
    month, monthLabel: `${pad(monthBounds(month).m)}/${monthBounds(month).year}`, today, warningDays,
    warningThreshold: settings.warningThreshold || DEFAULT_WARNING_THRESHOLD,
    formats, blocks, progress, attention, quality, totals, generatedAt,
  };
}

/** Dịch 1 ngày ISO (YYYY-MM-DD) đi `delta` ngày (tất định). */
export function shiftIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export { isDuyTri };
