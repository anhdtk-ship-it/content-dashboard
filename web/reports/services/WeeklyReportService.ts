/* Weekly Report — SERVICE RIÊNG (PHASE 11 §1+§2). Business Rule ĐỘC LẬP với Ads Monitor.
 * Tự đọc dữ liệu THÔ qua /api/v3/contents (API có sẵn, KHÔNG sửa) và tự tính KPI theo 2 nhóm:
 *
 *   A. PHÁT SINH TRONG THÁNG (cohort theo upload_date trong kỳ [from,to]):
 *      - Đã cấp = content upload trong kỳ.
 *      - Không test = upload trong kỳ & trạng thái "Không test" (không cộng dồn tháng sau).
 *      - Content test win = upload trong kỳ & đạt "Duy trì" (rule win không đổi).
 *   B. TRẠNG THÁI HIỆN TẠI (ALL — không giới hạn tháng, backlog thực tế):
 *      - Chờ chạy (Tồn) = trạng thái hiện tại "Chờ chạy".
 *      - Đang test = trạng thái hiện tại "Đang test".
 *
 * "Đang test" ở đây CHỈ để thống kê Dashboard/Weekly — KHÔNG liên quan Business Rule Ads Monitor.
 */
import type { ReportMetrics, DateRange, WeeklyReportData, EmployeeReport } from '../types/report';

interface RawContent {
  assignee_name: string;
  current_status: string;
  upload_date_real: string | null;   // 'YYYY-MM-DD'
}

const st = (r: RawContent) => (r.current_status ?? '').trim();
const uploadedInPeriod = (r: RawContent, from: string, to: string) =>
  !!r.upload_date_real && r.upload_date_real >= from && r.upload_date_real <= to;

export class WeeklyReportService {
  /** Đọc TOÀN BỘ content (KHÔNG lọc ngày) — cần cho KPI trạng thái hiện tại (Chờ chạy/Đang test, all-time). */
  async fetchContents(): Promise<RawContent[]> {
    const out: RawContent[] = [];
    const pageSize = 100;
    for (let page = 1; ; page++) {
      const p = new URLSearchParams();
      p.set('page', String(page)); p.set('pageSize', String(pageSize));
      const res = await fetch('/api/v3/contents?' + p.toString());
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      const items: RawContent[] = (d.items ?? []).map((x: any) => ({
        assignee_name: x.assignee_name || '(trống)',
        current_status: x.current_status ?? '',
        upload_date_real: x.upload_date_real ?? null,
      }));
      out.push(...items);
      if (items.length < pageSize || page >= (d.totalPages ?? 1)) break;
    }
    return out;
  }

  /** KPI cho 1 tập content (team hoặc từng nhân viên). */
  calculateWeeklyKPIs(rows: RawContent[], range: DateRange): ReportMetrics {
    const { from, to } = range;
    const inPeriod = rows.filter((r) => uploadedInPeriod(r, from, to));
    return {
      // A. cohort theo upload trong kỳ
      capped: inPeriod.length,
      notTest: inPeriod.filter((r) => st(r) === 'Không test').length,
      win: inPeriod.filter((r) => st(r).startsWith('Duy trì')).length,
      // B. trạng thái hiện tại (ALL)
      choChay: rows.filter((r) => st(r) === 'Chờ chạy').length,
      dangTest: rows.filter((r) => st(r) === 'Đang test').length,
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
      // sắp theo Đã cấp trong kỳ; loại nhân viên không có gì để hiển thị
      .filter((e) => e.metrics.capped > 0 || e.metrics.choChay > 0 || e.metrics.dangTest > 0)
      .sort((a, b) => b.metrics.capped - a.metrics.capped);
  }

  async getReport(range: DateRange): Promise<WeeklyReportData> {
    const rows = await this.fetchContents();
    return {
      range,
      team: this.calculateWeeklyKPIs(rows, range),
      employees: this.calculateWeeklyEmployeeReport(rows, range),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const weeklyReportService = new WeeklyReportService();
