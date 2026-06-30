/* Weekly Report — tầng XUẤT BÁO CÁO (PHASE 8: thiết kế interface; Copy đã chạy, PDF/DOCX để dành).
 * Mọi exporter cùng interface ReportExporter → sau này bổ sung PDF/DOCX không đụng UI. */
import type { ReportExporter, WeeklyReportData, ReportNarrative } from '../types/report';
import { fmtPct, fmtNum } from './reportService';

/** Dựng báo cáo dạng văn bản thuần (dùng cho Copy; PDF/DOCX có thể tái dùng). */
export function buildPlainText(data: WeeklyReportData, n: ReportNarrative): string {
  const L: string[] = [];
  const t = data.team;
  L.push(`BÁO CÁO TUẦN — ${data.week.label}  ·  Địa lý: ${data.geo === 'ALL' ? 'Tất cả' : data.geo === 'noi_dia' ? 'Nội Địa' : 'Quốc Tế'}`);
  L.push('');
  L.push('I. TIẾN ĐỘ CONTENT');
  L.push(`  Tổng quan team: Đã cấp ${t.capped} · Đã test ${t.tested} · Đã sử dụng ${t.used} (${fmtPct(t.usageRate)}) · Test win ${t.win} (${fmtPct(t.winRate)})`);
  for (const e of data.employees) {
    const m = e.metrics;
    L.push(`  • ${e.name}: cấp ${m.capped}, test ${m.tested}, chưa test ${m.notTested}, dùng ${m.used} (${fmtPct(m.usageRate)}), win ${m.win} (${fmtPct(m.winRate)})`);
  }
  L.push('');
  L.push('II. VẤN ĐỀ / PHƯƠNG ÁN');
  for (const e of data.employees) {
    L.push(`  ${e.name}:`);
    for (const it of n.issues[e.name] ?? []) L.push(`    - Vấn đề: ${it.problem}\n      Đề xuất: ${it.proposal}`);
  }
  L.push('');
  L.push('III. HĐ TUẦN TỚI + ĐỀ XUẤT');
  for (const e of data.employees) {
    L.push(`  ${e.name}:`);
    for (const task of n.plans[e.name] ?? []) L.push(`    - ${task}`);
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
