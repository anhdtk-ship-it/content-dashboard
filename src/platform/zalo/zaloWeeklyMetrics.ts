/* ============================================================
 * zaloWeeklyMetrics — WEEKLY REPORT ZALO (PURE, DÙNG CHUNG web + PDF).
 * ------------------------------------------------------------
 * ĐỘC LẬP với Weekly Report Facebook (src/shared/weeklyMetrics.ts). Business Rule riêng.
 * Dùng chung ZaloStatusRule + kpiOf của zaloMetrics → Dashboard/Weekly/PDF Zalo không lệch số.
 * KHÔNG hardcode Video/Banner: định dạng suy ra từ dữ liệu + cấu hình.
 *
 * Bố cục (spec ZALO-01 §X):
 *   I. Tổng quan (theo định dạng)   II. Tiến độ sử dụng   III. Cần xử lý
 *   IV. So sánh hiệu quả theo định dạng   V. Đề xuất tuần tới
 * ========================================================== */
import { zaloStatusRule } from './ZaloStatusRule';
import { kpiOf, resolveFormats, shiftIso, DEFAULT_WARNING_DAYS, type FormatKpi, type ZaloSettings } from './zaloMetrics';
import { UNSPECIFIED_FORMAT_LABEL } from './contentFormat';
import type { ZaloContent } from './ZaloContent';

export interface ZaloDateRange { from: string; to: string; label: string }

export interface ZaloWeeklyData {
  range: ZaloDateRange;
  formats: string[];
  byFormat: FormatKpi[];   // I + II + IV (kèm tỷ lệ)
  team: FormatKpi;         // tổng toàn bộ định dạng trong tuần
  attention: {             // III (tổng theo định dạng)
    format: string; label: string;
    chuaPhanLoai: number; chuaTest: number; testQuaLau: number; thieuNgayTest: number;
  }[];
  generatedAt: string;
}

export interface ZaloWeeklyNarrative {
  reviews: Record<string, string[]>; // key = định dạng → nhận xét
  plans: string[];                    // V. đề xuất tuần tới (toàn team)
}

const fmtKey = (r: ZaloContent) => (r.content_format ?? '').trim();
const inPeriod = (r: ZaloContent, from: string, to: string) =>
  !!r.upload_date_real && r.upload_date_real >= from && r.upload_date_real <= to;
const labelOf = (f: string) => f || UNSPECIFIED_FORMAT_LABEL;

/** Dựng toàn bộ dữ liệu Weekly Zalo. `all` = toàn bộ content Zalo. */
export function buildZaloWeekly(
  all: ZaloContent[], range: ZaloDateRange, settings: ZaloSettings, generatedAt: string,
): ZaloWeeklyData {
  const cohort = all.filter((r) => inPeriod(r, range.from, range.to));
  const formats = resolveFormats(all, settings);
  const warningDays = settings.warningDays || DEFAULT_WARNING_DAYS;
  const staleBefore = shiftIso(range.to, -warningDays);

  const byFormat = formats.map((f) => kpiOf(f, cohort.filter((r) => fmtKey(r) === f)));
  const team = kpiOf('ALL', cohort);

  const attention = formats.map((f) => {
    const rs = cohort.filter((r) => fmtKey(r) === f);
    return {
      format: f, label: labelOf(f),
      chuaPhanLoai: rs.filter((r) => zaloStatusRule.statusGroup(r.current_status) === 'CHUA_PHAN_LOAI').length,
      chuaTest: rs.filter((r) => zaloStatusRule.statusGroup(r.current_status) === 'TON').length,
      testQuaLau: rs.filter((r) => zaloStatusRule.statusGroup(r.current_status) === 'DANG_TEST' && !!r.test_date_real && r.test_date_real < staleBefore).length,
      thieuNgayTest: rs.filter((r) => zaloStatusRule.isTested(r.current_status) && !r.test_date_real).length,
    };
  });

  return { range, formats, byFormat, team, attention, generatedAt };
}

/* ============================================================
 * ĐÁNH GIÁ + ĐỀ XUẤT — sinh từ KPI thực tế (mỗi ý gắn số cụ thể).
 * ========================================================== */
const LOW_TEST_RATE = 0.7;
const GOOD_DUYTRI_RATE = 0.1;
const HIGH_TON = 3;
const fmtNum = (n: number) => (n ?? 0).toLocaleString('vi-VN');
const fmtPct = (x: number) => `${Math.round((x ?? 0) * 1000) / 10}%`;

export function reviewFormat(k: FormatKpi): string[] {
  const out: string[] = [];
  if (k.capped === 0 && k.duyTri === 0) return ['Không có content trong kỳ.'];
  if (k.capped > 0 && k.rateTest < LOW_TEST_RATE)
    out.push(`⚠ Tăng tốc đưa Content vào test (mới ${fmtNum(k.tested)}/${fmtNum(k.capped)} = ${fmtPct(k.rateTest)}).`);
  if (k.ton >= HIGH_TON)
    out.push(`⚠ Ưu tiên xử lý ${fmtNum(k.ton)} Content tồn (chờ chạy).`);
  if (k.duyTri > 0 && k.rateDuyTri >= GOOD_DUYTRI_RATE)
    out.push(`✓ Chọn Content hiệu quả tốt (${fmtNum(k.duyTri)} Duy trì / ${fmtNum(k.tested)} đã test = ${fmtPct(k.rateDuyTri)}).`);
  else if (k.tested >= 5 && k.duyTri === 0)
    out.push(`⚠ Chưa có Content đạt Duy trì (0/${fmtNum(k.tested)} đã test).`);
  if (out.length === 0)
    out.push(`✓ Tiến độ ổn định (đã cấp ${fmtNum(k.capped)}, test ${fmtPct(k.rateTest)}, Duy trì ${fmtNum(k.duyTri)}).`);
  return out.slice(0, 4);
}

/** Đề xuất tuần tới cho toàn team Zalo (dựa trên tổng + từng định dạng). */
export function planZalo(data: ZaloWeeklyData): string[] {
  const t = data.team;
  const out: string[] = [];
  if (t.ton > 0) out.push(`Xử lý dứt điểm ${fmtNum(t.ton)} Content tồn (chờ chạy).`);
  if (t.capped > 0 && t.rateTest < LOW_TEST_RATE) out.push(`Nâng tỷ lệ test lên trên ${Math.round(LOW_TEST_RATE * 100)}% (hiện ${fmtPct(t.rateTest)}).`);
  if (t.tested > 0 && t.rateDuyTri < GOOD_DUYTRI_RATE) out.push(`Rà soát tiêu chí chọn Content để nâng tỷ lệ Duy trì (hiện ${fmtPct(t.rateDuyTri)}).`);

  // Định dạng đang yếu nhất về tỷ lệ test.
  const weak = [...data.byFormat].filter((k) => k.capped > 0).sort((a, b) => a.rateTest - b.rateTest)[0];
  if (weak && weak.rateTest < LOW_TEST_RATE) out.push(`Tập trung định dạng ${weak.label} (tỷ lệ test thấp nhất ${fmtPct(weak.rateTest)}).`);
  // Định dạng hiệu quả nhất → nhân rộng.
  const best = [...data.byFormat].filter((k) => k.duyTri > 0).sort((a, b) => b.rateDuyTri - a.rateDuyTri)[0];
  if (best) out.push(`Nhân rộng hướng nội dung định dạng ${best.label} (${fmtNum(best.duyTri)} Duy trì).`);

  const fallback = [
    `Duy trì tiến độ cấp Content đều theo cả định dạng.`,
    `Rà soát Content chưa đạt để rút kinh nghiệm chọn đề tài.`,
    `Bổ sung ngày test còn thiếu để theo dõi vòng đời chính xác.`,
  ];
  for (const f of fallback) { if (out.length >= 3) break; if (!out.includes(f)) out.push(f); }
  return out.slice(0, 5);
}

export function buildZaloNarrative(data: ZaloWeeklyData): ZaloWeeklyNarrative {
  const reviews: Record<string, string[]> = {};
  for (const k of data.byFormat) reviews[k.format] = reviewFormat(k);
  return { reviews, plans: planZalo(data) };
}
