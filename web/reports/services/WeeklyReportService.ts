/* Weekly Report — SERVICE RIÊNG (PHASE 8/10 §5+§7).
 * Business Rule ĐỘC LẬP — KHÔNG dùng calculateAdsStatus()/Lifecycle Ads/status-set Dashboard.
 * Tự đọc dữ liệu THÔ qua /api/v3/contents (API có sẵn, KHÔNG sửa) và tự tính KPI.
 *
 * §7 — XUYÊN VÒNG ĐỜI THEO THÁNG (as-of cuối kỳ; content upload tháng trước, test tháng sau vẫn tính đúng):
 *   Đã cấp   = content có upload_date ≤ CUỐI kỳ (cumulative).
 *   Đã test  = content có test_date NẰM TRONG kỳ [from, to].
 *   Không test = content trạng thái "Không test" (cumulative, upload ≤ cuối kỳ) — đọc trực tiếp, không suy luận.
 *   Tồn      = upload ≤ cuối kỳ & CHƯA test tính đến cuối kỳ & ≠ "Không test".
 *   Content test win = content ĐÃ TEST trong kỳ & đạt trạng thái "Duy trì".
 *   Tỷ lệ test = Đã test / Đã cấp ; Tỷ lệ win = win / Đã test.
 */
import type { ReportMetrics, DateRange, WeeklyReportData, EmployeeReport } from '../types/report';

interface RawContent {
  assignee_name: string;
  current_status: string;
  test_date_real: string | null;   // 'YYYY-MM-DD'
  upload_date_real: string | null;
}

/* ---- Business Rule RIÊNG (chỉnh tại đây) ---- */
const st = (r: RawContent) => (r.current_status ?? '').trim();
const isNotTest = (r: RawContent) => st(r) === 'Không test';
const isMaintain = (r: RawContent) => st(r).startsWith('Duy trì');
const testedByEnd = (r: RawContent, end: string) => !!r.test_date_real && r.test_date_real <= end;
const testedInPeriod = (r: RawContent, from: string, to: string) =>
  !!r.test_date_real && r.test_date_real >= from && r.test_date_real <= to;

export class WeeklyReportService {
  /** Đọc TOÀN BỘ content upload ≤ cuối kỳ (cumulative, §7) — phân trang. */
  async fetchContents(range: DateRange): Promise<RawContent[]> {
    const out: RawContent[] = [];
    const pageSize = 100;
    for (let page = 1; ; page++) {
      const p = new URLSearchParams();
      p.set('to', range.to);                 // chỉ chặn trên: upload_date_real ≤ cuối kỳ (dateField mặc định)
      p.set('page', String(page)); p.set('pageSize', String(pageSize));
      const res = await fetch('/api/v3/contents?' + p.toString());
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      const items: RawContent[] = (d.items ?? []).map((x: any) => ({
        assignee_name: x.assignee_name || '(trống)',
        current_status: x.current_status ?? '',
        test_date_real: x.test_date_real ?? null,
        upload_date_real: x.upload_date_real ?? null,
      }));
      out.push(...items);
      if (items.length < pageSize || page >= (d.totalPages ?? 1)) break;
    }
    return out;
  }

  /** KPI cho 1 tập content (team hoặc từng nhân viên), theo §7 as-of cuối kỳ. */
  calculateWeeklyKPIs(rows: RawContent[], range: DateRange): ReportMetrics {
    const { from, to } = range;
    const capped = rows.length; // đã là upload ≤ to (fetch chặn trên)
    const tested = rows.filter((r) => testedInPeriod(r, from, to)).length;
    const notTest = rows.filter(isNotTest).length;
    const ton = rows.filter((r) => !testedByEnd(r, to) && !isNotTest(r)).length;
    const win = rows.filter((r) => testedInPeriod(r, from, to) && isMaintain(r)).length;
    return {
      capped, tested, notTest, ton,
      testRate: capped ? tested / capped : 0,
      win, winRate: tested ? win / tested : 0,
    };
  }

  /** KPI theo từng nhân viên Ads (group theo assignee_name). */
  calculateWeeklyEmployeeReport(rows: RawContent[], range: DateRange): EmployeeReport[] {
    const byName = new Map<string, RawContent[]>();
    for (const r of rows) {
      const k = r.assignee_name || '(trống)';
      (byName.get(k) ?? byName.set(k, []).get(k)!).push(r);
    }
    return [...byName.entries()]
      .map(([name, rs]) => ({ name, metrics: this.calculateWeeklyKPIs(rs, range) }))
      .sort((a, b) => b.metrics.capped - a.metrics.capped);
  }

  async getReport(range: DateRange): Promise<WeeklyReportData> {
    const rows = await this.fetchContents(range);
    return {
      range,
      team: this.calculateWeeklyKPIs(rows, range),
      employees: this.calculateWeeklyEmployeeReport(rows, range),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const weeklyReportService = new WeeklyReportService();
