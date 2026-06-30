/* Weekly Report — tầng XUẤT BÁO CÁO (PHASE 8: thiết kế interface; Copy đã chạy, PDF/DOCX để dành).
 * Mọi exporter cùng interface ReportExporter → sau này bổ sung PDF/DOCX không đụng UI. */
import type { ReportExporter, WeeklyReportData, ReportNarrative } from '../types/report';
import { GEO_LABEL } from '../types/report';
import { fmtPct1, fmtNum } from '../utils/format';

/** Dựng báo cáo dạng văn bản thuần (dùng cho Copy; PDF/DOCX có thể tái dùng). */
export function buildPlainText(data: WeeklyReportData, n: ReportNarrative): string {
  const L: string[] = [];
  const t = data.team;
  L.push(`BÁO CÁO TUẦN — ${data.week.label}  ·  Địa lý: ${GEO_LABEL[data.geo]}`);
  L.push('');
  L.push('I. TIẾN ĐỘ CONTENT');
  L.push(`  Tổng quan team: Đã cấp ${fmtNum(t.capped)} · Đã test ${fmtNum(t.tested)} · Tồn ${fmtNum(t.ton)} · Tỷ lệ test ${fmtPct1(t.testRate)} · Test win ${fmtNum(t.win)} · Tỷ lệ win ${fmtPct1(t.winRate)}`);
  for (const e of data.employees) {
    const m = e.metrics;
    L.push(`  • ${e.name}: cấp ${fmtNum(m.capped)}, test ${fmtNum(m.tested)}, tồn ${fmtNum(m.ton)}, tỷ lệ test ${fmtPct1(m.testRate)}, win ${fmtNum(m.win)} (${fmtPct1(m.winRate)})`);
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
