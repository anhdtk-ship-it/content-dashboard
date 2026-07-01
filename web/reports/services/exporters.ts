/* Weekly Report — tầng XUẤT BÁO CÁO (PHASE 8: thiết kế interface; Copy đã chạy, PDF/DOCX để dành).
 * Mọi exporter cùng interface ReportExporter → sau này bổ sung PDF/DOCX không đụng UI. */
import type { ReportExporter, WeeklyReportData, ReportNarrative } from '../types/report';
import { fmtNum } from '../utils/format';

/** Dựng báo cáo dạng văn bản thuần (dùng cho Copy; PDF/DOCX có thể tái dùng). */
export function buildPlainText(data: WeeklyReportData, n: ReportNarrative): string {
  const L: string[] = [];
  const t = data.team;
  L.push(`BÁO CÁO TUẦN — ${data.range.label}`);
  L.push('');
  L.push('I. TIẾN ĐỘ CONTENT');
  L.push(`  Tổng quan team: Đã cấp ${fmtNum(t.capped)} · Không test ${fmtNum(t.notTest)} · Chờ chạy ${fmtNum(t.choChay)} · Đang test ${fmtNum(t.dangTest)} · Content test win ${fmtNum(t.win)}`);
  for (const e of data.employees) {
    const m = e.metrics;
    L.push(`  • ${e.name}: cấp ${fmtNum(m.capped)}, không test ${fmtNum(m.notTest)}, chờ chạy ${fmtNum(m.choChay)}, đang test ${fmtNum(m.dangTest)}, win ${fmtNum(m.win)}`);
  }
  L.push('');
  L.push('II. ĐÁNH GIÁ');
  for (const e of data.employees) {
    L.push(`  ${e.name}:`);
    for (const it of n.assessments[e.name] ?? []) L.push(`    - ${it}`);
  }
  L.push('');
  L.push('III. HÀNH ĐỘNG TUẦN TỚI');
  for (const e of data.employees) {
    L.push(`  ${e.name}:`);
    for (const task of n.actions[e.name] ?? []) L.push(`    - ${task}`);
  }
  return L.join('\n');
}

const copyExporter: ReportExporter = {
  format: 'copy', label: '📋 Copy', enabled: true,
  async export(data, n) {
    const text = buildPlainText(data, n);
    await navigator.clipboard.writeText(text);
  },
};

const pdfExporter: ReportExporter = {
  format: 'pdf', label: '📄 Xuất PDF', enabled: false,
  async export() { throw new Error('Xuất PDF chưa được hỗ trợ (Phase 8 chỉ thiết kế interface).'); },
};

const docxExporter: ReportExporter = {
  format: 'docx', label: '📝 Xuất DOCX', enabled: false,
  async export() { throw new Error('Xuất DOCX chưa được hỗ trợ (Phase 8 chỉ thiết kế interface).'); },
};

/** Registry — UI render nút theo danh sách này. Thêm exporter mới chỉ cần đăng ký ở đây. */
export const EXPORTERS: ReportExporter[] = [copyExporter, pdfExporter, docxExporter];
