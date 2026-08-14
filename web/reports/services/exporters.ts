/* Weekly Report — tầng XUẤT BÁO CÁO. Copy (text thuần) đã chạy; PDF chuyên nghiệp dùng
 * reportlab (reports/weekly_report_pdf.py) với CÙNG dữ liệu qua src/shared/weeklyMetrics.ts. */
import type { ReportExporter, WeeklyReportData, ReportNarrative } from '../types/report';
import { fmtNum, fmtPct } from '../types/report';

/** Dựng báo cáo dạng văn bản thuần (Copy) — cùng bố cục I/II/III/IV với bản in & PDF. */
export function buildPlainText(data: WeeklyReportData, n: ReportNarrative): string {
  const L: string[] = [];
  L.push(`BÁO CÁO CONTENT TUẦN — ${data.range.label}`);
  L.push('');
  L.push('I. TỔNG QUAN TEAM');
  for (const b of data.markets) {
    const t = b.team;
    L.push(`  ${b.label}: Đã cấp ${fmtNum(t.capped)} · Đã test ${fmtNum(t.tested)} · Tồn ${fmtNum(t.ton)} · Chờ đăng bài ${fmtNum(t.choDangBai)} · Tỷ lệ test ${fmtPct(t.rateTest)} · Content Duy trì ${fmtNum(t.duyTriThang)} · Tỷ lệ Duy trì ${fmtPct(t.rateDuyTri)}`);
  }
  L.push('');
  L.push('II. TIẾN ĐỘ NHÂN VIÊN');
  for (const b of data.markets) {
    L.push(`  ${b.label}:`);
    for (const e of b.employees) {
      const k = e.kpi;
      L.push(`    • ${e.name}: cấp ${fmtNum(k.capped)}, test ${fmtNum(k.tested)}, tồn ${fmtNum(k.ton)}, chờ đăng bài ${fmtNum(k.choDangBai)}, tỷ lệ test ${fmtPct(k.rateTest)}, duy trì tháng ${fmtNum(k.duyTriThang)}, đang duy trì ${fmtNum(k.dangDuyTri)}`);
    }
    const t = b.team;
    L.push(`    • TỔNG: cấp ${fmtNum(t.capped)}, test ${fmtNum(t.tested)}, tồn ${fmtNum(t.ton)}, chờ đăng bài ${fmtNum(t.choDangBai)}, tỷ lệ test ${fmtPct(t.rateTest)}, duy trì tháng ${fmtNum(t.duyTriThang)}, đang duy trì ${fmtNum(t.dangDuyTri)}`);
  }
  L.push('');
  L.push('III. ĐÁNH GIÁ NHÂN VIÊN');
  const names = [...new Set(data.markets.flatMap((b) => b.employees.map((e) => e.name)))];
  for (const name of names) {
    L.push(`  ${name}:`);
    for (const b of data.markets) {
      const items = (n.reviews[`${name}|${b.market}`] ?? []).filter((x) => x.trim());
      if (!items.length) continue;
      L.push(`    ${b.label}:`);
      for (const it of items) L.push(`      - ${it}`);
    }
  }
  L.push('');
  L.push('IV. PHƯƠNG ÁN TUẦN TỚI');
  for (const b of data.markets) {
    L.push(`  ${b.label}:`);
    for (const t of (n.plans[b.market] ?? []).filter((x) => x.trim())) L.push(`    - ${t}`);
  }
  return L.join('\n');
}

const copyExporter: ReportExporter = {
  format: 'copy', label: '📋 Copy', enabled: true,
  async export(data, n) { await navigator.clipboard.writeText(buildPlainText(data, n)); },
};

const pdfExporter: ReportExporter = {
  format: 'pdf', label: '📄 Xuất PDF', enabled: false,
  async export() { throw new Error('Dùng nút In (bản nhanh) hoặc reports/weekly_report_pdf.py cho bản PDF chuyên nghiệp.'); },
};

const docxExporter: ReportExporter = {
  format: 'docx', label: '📝 Xuất DOCX', enabled: false,
  async export() { throw new Error('Xuất DOCX chưa được hỗ trợ.'); },
};

/** Registry — UI render nút theo danh sách này. */
export const EXPORTERS: ReportExporter[] = [copyExporter, pdfExporter, docxExporter];
