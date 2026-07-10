/* Weekly Report — RULE ENGINE (PHASE 12 · làm mới tiêu chí đánh giá).
 * II. ĐÁNH GIÁ: theo TỪNG CÁ NHÂN, dựa trên KPI của CHÍNH họ — tiêu chí THEO TỶ LỆ
 *     (không chỉ số tuyệt đối) nên nhận xét KHÁC NHAU theo thực tế từng người.
 * III. KẾ HOẠCH TUẦN TỚI: của CẢ TEAM (không chia theo nhân viên).
 *
 * Tiêu chí đánh giá cá nhân (ưu tiên nêu vấn đề trước, điểm mạnh sau; lấy tối đa 3 ý):
 *   1. Chưa ra Duy trì   : Đã cấp ≥ 5 & Duy trì = 0                → cần cải thiện chất lượng.
 *   2. Không test cao    : Không test/Đã cấp ≥ 15% (và ≥ 3)        → rà tiêu chí chọn content.
 *   3. Tồn chờ chạy cao  : Chờ chạy ≥ 8                            → đẩy nhanh triển khai.
 *   4. Test nhiều-ít win : Đang test ≥ 12 & tỷ lệ Duy trì < 10%    → theo dõi để sớm chốt.
 *   5. Hiệu quả tốt      : tỷ lệ Duy trì ≥ 12%                     → điểm mạnh, nhân rộng.
 *   6. Có Duy trì (vừa)  : Duy trì > 0 & tỷ lệ < 12%               → tiếp tục nâng tỷ lệ.
 * Ngưỡng CỐ ĐỊNH ở đây (dễ chỉnh 1 chỗ). KHÔNG so sánh/xếp hạng giữa các nhân viên. */
import type { EmployeeReport, ReportMetrics, WeeklyReportData } from '../types/report';
import { fmtPct1, fmtNum } from '../utils/format';

const MAX_ASSESS = 3;
const rate = (a: number, b: number) => (b > 0 ? a / b : 0);

interface Rule { when: (m: ReportMetrics) => boolean; priority: number; text: (m: ReportMetrics) => string; }

const ASSESS_RULES: Rule[] = [
  {
    when: (m) => m.capped >= 5 && m.win === 0,
    priority: 1,
    text: (m) => `Chưa có content đạt Duy trì (0/${fmtNum(m.capped)}) — cần cải thiện chất lượng/nhắm mục tiêu.`,
  },
  {
    when: (m) => m.notTest >= 3 && rate(m.notTest, m.capped) >= 0.15,
    priority: 2,
    text: (m) => `Tỷ lệ content không test cao (${fmtNum(m.notTest)}/${fmtNum(m.capped)} = ${fmtPct1(rate(m.notTest, m.capped))}) — rà lại tiêu chí chọn content.`,
  },
  {
    when: (m) => m.choChay >= 8,
    priority: 2,
    text: (m) => `Tồn content chờ chạy còn nhiều (${fmtNum(m.choChay)}) — ưu tiên đẩy nhanh triển khai.`,
  },
  {
    when: (m) => m.dangTest >= 12 && rate(m.win, m.capped) < 0.1,
    priority: 3,
    text: (m) => `Đang test nhiều (${fmtNum(m.dangTest)}) nhưng tỷ lệ ra Duy trì còn thấp — theo dõi sát để sớm chốt kết quả.`,
  },
  {
    when: (m) => m.capped > 0 && rate(m.win, m.capped) >= 0.12,
    priority: 5,
    text: (m) => `Hiệu quả tốt: ${fmtNum(m.win)}/${fmtNum(m.capped)} content đạt Duy trì (${fmtPct1(rate(m.win, m.capped))}).`,
  },
  {
    when: (m) => m.win > 0 && rate(m.win, m.capped) < 0.12,
    priority: 6,
    text: (m) => `Đạt ${fmtNum(m.win)} content Duy trì (${fmtPct1(rate(m.win, m.capped))}) — tiếp tục nâng tỷ lệ.`,
  },
];

/** II — Đánh giá 1 nhân viên: tối đa 3 ý gắn KPI thật (khác nhau theo tỷ lệ của từng người). */
export function evaluateEmployee(emp: EmployeeReport): string[] {
  const m = emp.metrics;
  const fired = ASSESS_RULES.filter((r) => r.when(m)).sort((a, b) => a.priority - b.priority).slice(0, MAX_ASSESS);
  if (fired.length === 0) {
    return [`Đã cấp ${fmtNum(m.capped)} · đang test ${fmtNum(m.dangTest)} · Duy trì ${fmtNum(m.win)} trong kỳ.`];
  }
  return fired.map((r) => r.text(m));
}

/* ============================================================
 * III — KẾ HOẠCH TUẦN TỚI của CẢ TEAM (không chia nhân viên).
 *   Sinh từ KPI tổng + phát hiện điểm nóng (ai chưa có Duy trì).
 * ========================================================== */
export function generateTeamPlan(data: WeeklyReportData): string[] {
  const t = data.team;
  const plan: string[] = [];

  // (1) Luôn có: duy trì tiến độ test content đang chạy.
  if (t.dangTest > 0) plan.push(`Duy trì tiến độ test ${fmtNum(t.dangTest)} content đang chạy để sớm có kết quả.`);
  else plan.push(`Duy trì tiến độ test content trong tuần.`);

  // (2) Giải phóng tồn chờ chạy nếu còn nhiều.
  if (t.choChay >= 10) plan.push(`Giải phóng tồn chờ chạy (${fmtNum(t.choChay)}) — ưu tiên đẩy các content còn tồn.`);

  // (3) Nâng tỷ lệ ra Duy trì nếu thấp.
  const wr = rate(t.win, t.capped);
  if (t.capped > 0 && wr < 0.1) plan.push(`Nâng tỷ lệ ra Duy trì của team (hiện ${fmtNum(t.win)}/${fmtNum(t.capped)} = ${fmtPct1(wr)}).`);

  // (4) Siết tiêu chí chọn content nếu "không test" đáng kể.
  if (t.notTest >= 8) plan.push(`Siết tiêu chí chọn content để giảm "không test" (${fmtNum(t.notTest)} trong kỳ).`);

  // (5) Hỗ trợ nhân viên chưa có Duy trì (điểm nóng, data-driven).
  const needHelp = data.employees.filter((e) => e.metrics.capped >= 5 && e.metrics.win === 0).map((e) => e.name);
  if (needHelp.length) plan.push(`Hỗ trợ ${needHelp.join(', ')} tối ưu content để sớm có Duy trì đầu tiên.`);

  // (6) Nhân rộng cái đã hiệu quả.
  if (t.win > 0) plan.push(`Nhân rộng hướng nội dung của ${fmtNum(t.win)} content đã đạt Duy trì trong kỳ.`);

  return plan;
}
