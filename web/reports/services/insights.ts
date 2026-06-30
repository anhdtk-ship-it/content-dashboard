/* Weekly Report — tự sinh Vấn đề/Đề xuất (II) + HĐ tuần tới (III) từ KPI Dashboard (PHASE 8).
 * Heuristic đơn giản dựa trên metrics. Thiết kế để sau này thay bằng AI (cùng interface in→out).
 * Nếu không đủ dữ liệu để tự sinh → trả PLACEHOLDER để người dùng bổ sung thủ công. */
import type { EmployeeReport, IssueItem } from '../types/report';
import { fmtPct } from './reportService';

const MAX_ISSUES = 3;
const MAX_TASKS = 3;

/** II — tối đa 3 cặp (Vấn đề, Đề xuất). auto=false nếu phải dùng placeholder. */
export function autoIssues(emp: EmployeeReport): { items: IssueItem[]; auto: boolean } {
  const m = emp.metrics;
  const items: IssueItem[] = [];

  if (m.capped > 0 && m.notTested / m.capped >= 0.3) {
    items.push({
      problem: `Còn ${m.notTested}/${m.capped} content chưa test (${fmtPct(m.notTested / m.capped)}).`,
      proposal: 'Ưu tiên set ads cho content tồn trong tuần tới, tránh để quá hạn.',
    });
  }
  if (m.tested > 0 && m.usageRate < 0.5) {
    items.push({
      problem: `Tỷ lệ sử dụng thấp (${fmtPct(m.usageRate)}): nhiều content đã test nhưng chưa đưa vào chạy.`,
      proposal: 'Rà soát content "đã test - không chạy", chọn lọc đẩy chạy hoặc loại bỏ.',
    });
  }
  if (m.tested >= 5 && m.winRate < 0.2) {
    items.push({
      problem: `Tỷ lệ test win thấp (${fmtPct(m.winRate)}).`,
      proposal: 'Phân tích content win gần đây để nhân bản hướng nội dung hiệu quả.',
    });
  }

  if (items.length === 0) {
    return { items: [{ problem: '(bổ sung thủ công)', proposal: '(bổ sung thủ công)' }], auto: false };
  }
  return { items: items.slice(0, MAX_ISSUES), auto: true };
}

/** III — 2–3 đầu việc tuần tới. auto=false nếu placeholder. */
export function autoPlan(emp: EmployeeReport): { tasks: string[]; auto: boolean } {
  const m = emp.metrics;
  const tasks: string[] = [];

  if (m.notTested > 0) tasks.push(`Test ${m.notTested} content tồn chưa test.`);
  if (m.win > 0) tasks.push(`Duy trì & tối ưu ${m.win} content đang win.`);
  if (m.tested > 0 && m.usageRate < 0.6) tasks.push('Tăng tỷ lệ đưa content đã test vào chạy.');

  if (tasks.length === 0) {
    return { tasks: ['(bổ sung thủ công)', '(bổ sung thủ công)'], auto: false };
  }
  return { tasks: tasks.slice(0, MAX_TASKS), auto: true };
}
