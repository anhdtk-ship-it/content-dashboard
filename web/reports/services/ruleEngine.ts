/* Weekly Report — RULE ENGINE (PHASE 8 · điều chỉnh Section II).
 * Đánh giá ĐỘC LẬP từng nhân viên dựa trên KPI của CHÍNH HỌ:
 *   - KHÔNG xếp hạng, KHÔNG so sánh nhân viên khác, KHÔNG so với trung bình team.
 *   - Chỉ dùng 6 KPI: Đã cấp · Đã test · Tồn · Tỷ lệ test · Content test win · Tỷ lệ win.
 *   - Mỗi rule gắn 1 KPI cụ thể → 1 "Đánh giá" + 1 "Hành động" rõ ràng (không chung chung).
 *   - Mỗi mục tối đa 2 ý (ưu tiên rule mức độ thấp = vấn đề trước). */
import type { EmployeeReport, EmployeeEvaluation } from '../types/report';
import { fmtPct1, fmtNum } from '../utils/format';

interface Rule {
  /** điều kiện dựa trên KPI của chính nhân viên (ngưỡng CỐ ĐỊNH). */
  when: (m: EmployeeReport['metrics']) => boolean;
  priority: number; // nhỏ = ưu tiên hiển thị trước (vấn đề nặng trước, tích cực sau)
  assessment: (m: EmployeeReport['metrics']) => string; // gắn KPI cụ thể
  action: (m: EmployeeReport['metrics']) => string;      // hành động rõ ràng
}

const RULES: Rule[] = [
  // Tỷ lệ test thấp
  {
    when: (m) => m.capped > 0 && m.testRate < 0.6,
    priority: 1,
    assessment: (m) => `Tỷ lệ test thấp ${fmtPct1(m.testRate)} (đã test ${fmtNum(m.tested)}/${fmtNum(m.capped)}).`,
    action: (m) => `Ưu tiên test ${fmtNum(m.ton)} content tồn trong tuần.`,
  },
  // Tồn cao
  {
    when: (m) => m.capped > 0 && m.ton > 0 && m.ton / m.capped >= 0.3,
    priority: 2,
    assessment: (m) => `Tồn cao ${fmtNum(m.ton)}/${fmtNum(m.capped)} content (${fmtPct1(m.ton / m.capped)}).`,
    action: (m) => `Lên lịch giải phóng ${fmtNum(m.ton)} content tồn.`,
  },
  // Chưa có win dù đã test
  {
    when: (m) => m.tested >= 3 && m.win === 0,
    priority: 1,
    assessment: (m) => `Chưa có content win (0/${fmtNum(m.tested)} đã test).`,
    action: () => `Tối ưu nội dung/nhắm mục tiêu để đạt win đầu tiên.`,
  },
  // Tỷ lệ win thấp
  {
    when: (m) => m.tested >= 5 && m.win > 0 && m.winRate < 0.15,
    priority: 2,
    assessment: (m) => `Tỷ lệ win thấp ${fmtPct1(m.winRate)} (${fmtNum(m.win)}/${fmtNum(m.tested)}).`,
    action: () => `Rà soát & nhân bản hướng content đã win gần đây.`,
  },
  // Tỷ lệ win tốt (tích cực)
  {
    when: (m) => m.tested >= 5 && m.winRate >= 0.3,
    priority: 5,
    assessment: (m) => `Tỷ lệ win tốt ${fmtPct1(m.winRate)} (${fmtNum(m.win)}/${fmtNum(m.tested)}).`,
    action: (m) => `Duy trì & nhân bản ${fmtNum(m.win)} content win.`,
  },
  // Tỷ lệ test tốt (tích cực)
  {
    when: (m) => m.capped > 0 && m.testRate >= 0.9,
    priority: 6,
    assessment: (m) => `Tỷ lệ test tốt ${fmtPct1(m.testRate)} (${fmtNum(m.tested)}/${fmtNum(m.capped)}).`,
    action: (m) => (m.ton > 0 ? `Test nốt ${fmtNum(m.ton)} content tồn còn lại.` : `Giữ nhịp độ test hiện tại.`),
  },
];

const MAX = 2;

/** Đánh giá 1 nhân viên — trả ≤2 Đánh giá + ≤2 Hành động (gắn cùng rule/KPI). */
export function evaluateEmployee(emp: EmployeeReport): EmployeeEvaluation {
  const m = emp.metrics;
  const fired = RULES.filter((r) => r.when(m)).sort((a, b) => a.priority - b.priority).slice(0, MAX);
  if (fired.length === 0) {
    return { assessments: ['(bổ sung thủ công)'], actions: ['(bổ sung thủ công)'] };
  }
  return {
    assessments: fired.map((r) => r.assessment(m)),
    actions: fired.map((r) => r.action(m)),
  };
}
