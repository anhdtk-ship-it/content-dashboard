/* Weekly Report — tự sinh Vấn đề/Đề xuất (II) + HĐ tuần tới (III) từ KPI riêng (PHASE 8).
 * Heuristic dựa trên ReportMetrics của Weekly (KHÔNG dùng status/lifecycle Dashboard).
 * Thiết kế để sau thay bằng AI (cùng in→out). Thiếu dữ liệu → PLACEHOLDER nhập tay. */
import type { EmployeeReport, IssueItem } from '../types/report';
import { fmtPct1 } from '../utils/format';

const MAX_ISSUES = 3;
const MAX_TASKS = 3;

/** II — tối đa 3 cặp (Vấn đề, Đề xuất). auto=false nếu placeholder. */
export function autoIssues(emp: EmployeeReport): { items: IssueItem[]; auto: boolean } {
  const m = emp.metrics;
  const items: IssueItem[] = [];

  if (m.capped > 0 && m.ton / m.capped >= 0.3) {
    items.push({
      problem: `Tồn ${m.ton}/${m.capped} content chưa test (${fmtPct1(m.ton / m.capped)}).`,
      proposal: 'Ưu tiên set ads cho content tồn trong tuần tới.',
    });
  }
  if (m.capped > 0 && m.testRate < 0.6) {
    items.push({
      problem: `Tỷ lệ test thấp (${fmtPct1(m.testRate)}).`,
      proposal: 'Đẩy nhanh tiến độ test, tránh dồn tồn.',
    });
  }
  if (m.tested >= 5 && m.winRate < 0.2) {
    items.push({
      problem: `Tỷ lệ win thấp (${fmtPct1(m.winRate)}).`,
      proposal: 'Phân tích content win gần đây để nhân bản hướng nội dung hiệu quả.',
    });
  }

  if (items.length === 0) return { items: [{ problem: '(bổ sung thủ công)', proposal: '(bổ sung thủ công)' }], auto: false };
  return { items: items.slice(0, MAX_ISSUES), auto: true };
}

/** III — tối đa 3 đầu việc tuần tới. auto=false nếu placeholder. */
export function autoPlan(emp: EmployeeReport): { tasks: string[]; auto: boolean } {
  const m = emp.metrics;
  const tasks: string[] = [];
  if (m.ton > 0) tasks.push(`Test ${m.ton} content tồn.`);
  if (m.win > 0) tasks.push(`Duy trì & nhân bản ${m.win} content win.`);
  if (m.tested > 0 && m.winRate < 0.3) tasks.push('Cải thiện chất lượng test để tăng tỷ lệ win.');

  if (tasks.length === 0) return { tasks: ['(bổ sung thủ công)', '(bổ sung thủ công)'], auto: false };
  return { tasks: tasks.slice(0, MAX_TASKS), auto: true };
}
