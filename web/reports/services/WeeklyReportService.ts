/* Weekly Report — SERVICE RIÊNG (PHASE 8 §5).
 * Business Rule ĐỘC LẬP — KHÔNG dùng calculateAdsStatus(), KHÔNG dùng Lifecycle của Ads Monitor,
 * KHÔNG dùng metrics()/status set của Dashboard. Tự đọc dữ liệu THÔ qua /api/v3/contents (API có sẵn,
 * KHÔNG sửa) và tự tính KPI theo công thức riêng (§6). Dashboard là Single Source of Truth (chỉ đọc).
 *
 * CÔNG THỨC (§6):
 *   Đã cấp        = số content giao cho nhân viên (rows)
 *   Đã test       = đã đưa vào chạy test ≥1 lần  → có Ngày Set Ads (test_date_real != null)
 *   Tồn           = Đã cấp − Đã test  (tính động, không lưu DB)
 *   Tỷ lệ test    = Đã test / Đã cấp
 *   Content test win = chuyển test→maintain → content đạt trạng thái "Duy trì" (và đã test)
 *   Tỷ lệ win     = win / Đã test
 */
import type { ReportMetrics, DateRange, WeeklyReportData, EmployeeReport } from '../types/report';

/** Dòng content thô đọc từ /api/v3/contents (chỉ các field Weekly Report cần). */
interface RawContent {
  assignee_name: string;
  current_status: string;
  test_date_real: string | null;
}

/* ---- Business Rule RIÊNG (chỉnh tại đây) ---- */
const isTested = (r: RawContent) => !!r.test_date_real; // đã đưa vào test ≥1 lần = có Ngày Set Ads
const isWin = (r: RawContent) => isTested(r) && (r.current_status ?? '').trim().startsWith('Duy trì'); // test→maintain

export class WeeklyReportService {
  /** Đọc TOÀN BỘ content trong khoảng thời gian (phân trang). "Đã cấp" theo Ngày Up Trello (dateField mặc định). */
  async fetchContents(range: DateRange): Promise<RawContent[]> {
    const out: RawContent[] = [];
    const pageSize = 100;
    for (let page = 1; ; page++) {
      const p = new URLSearchParams();
      p.set('from', range.from); p.set('to', range.to);
      p.set('page', String(page)); p.set('pageSize', String(pageSize));
      const res = await fetch('/api/v3/contents?' + p.toString());
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      const items: RawContent[] = (d.items ?? []).map((x: any) => ({
        assignee_name: x.assignee_name || '(trống)',
        current_status: x.current_status ?? '',
        test_date_real: x.test_date_real ?? null,
      }));
      out.push(...items);
      if (items.length < pageSize || page >= (d.totalPages ?? 1)) break;
    }
    return out;
  }

  /** KPI cho 1 tập content (dùng cho cả team lẫn từng nhân viên). */
  calculateWeeklyKPIs(rows: RawContent[]): ReportMetrics {
    const capped = rows.length;
    const tested = rows.filter(isTested).length;
    const win = rows.filter(isWin).length;
    return {
      capped, tested,
      ton: Math.max(0, capped - tested),
      testRate: capped ? tested / capped : 0,
      win,
      winRate: tested ? win / tested : 0,
    };
  }

  /** KPI theo từng nhân viên (group theo assignee_name). */
  calculateWeeklyEmployeeReport(rows: RawContent[]): EmployeeReport[] {
    const byName = new Map<string, RawContent[]>();
    for (const r of rows) {
      const k = r.assignee_name || '(trống)';
      (byName.get(k) ?? byName.set(k, []).get(k)!).push(r);
    }
    return [...byName.entries()]
      .map(([name, rs]) => ({ name, metrics: this.calculateWeeklyKPIs(rs) }))
      .sort((a, b) => b.metrics.capped - a.metrics.capped);
  }

  /** Tổng hợp báo cáo (1 lần đọc dữ liệu). */
  async getReport(range: DateRange): Promise<WeeklyReportData> {
    const rows = await this.fetchContents(range);
    return {
      range,
      team: this.calculateWeeklyKPIs(rows),
      employees: this.calculateWeeklyEmployeeReport(rows),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const weeklyReportService = new WeeklyReportService();
