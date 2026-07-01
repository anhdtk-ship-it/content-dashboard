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
  // Chờ chạy (Tồn) cao — backlog nhiều (PHASE 11)
  {
    when: (m) => m.choChay >= 5,
    priority: 1,
    assessment: (m) => `Khối lượng content chờ triển khai còn nhiều (Chờ chạy ${fmtNum(m.choChay)}).`,
    action: () => `Ưu tiên xử lý content chờ chạy trước khi nhận thêm content mới.`,
  },
  // Đang test cao — triển khai đồng thời nhiều
  {
    when: (m) => m.dangTest >= 10,
    priority: 2,
    assessment: (m) => `Đang triển khai nhiều content đồng thời (Đang test ${fmtNum(m.dangTest)}).`,
    action: () => `Theo dõi sát kết quả test để sớm đưa ra quyết định.`,
  },
  // Không test cao — content không phù hợp triển khai
  {
    when: (m) => m.capped > 0 && m.notTest / m.capped >= 0.2,
    priority: 2,
    assessment: (m) => `Khối lượng content không phù hợp để triển khai còn cao (Không test ${fmtNum(m.notTest)}/${fmtNum(m.capped)} = ${fmtPct1(m.notTest / m.capped)}).`,
    action: () => `Rà soát lại tiêu chí lựa chọn content trước khi cấp cho Ads.`,
  },
  // Content cấp trong kỳ chưa có win
  {
    when: (m) => m.capped >= 3 && m.win === 0,
    priority: 3,
    assessment: (m) => `Content cấp trong kỳ chưa có win (0/${fmtNum(m.capped)}).`,
    action: () => `Tối ưu nội dung/nhắm mục tiêu để sớm đạt win.`,
  },
  // Có win (tích cực)
  {
    when: (m) => m.win > 0,
    priority: 5,
    assessment: (m) => `Có ${fmtNum(m.win)} content win trong kỳ.`,
    action: (m) => `Nhân bản hướng nội dung của ${fmtNum(m.win)} content win.`,
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
