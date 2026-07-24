/* Weekly Report — SERVICE. Đọc dữ liệu THÔ qua /api/v3/contents (API có sẵn, KHÔNG sửa),
 * rồi giao toàn bộ việc tính KPI cho `src/shared/weeklyMetrics.ts` — module DÙNG CHUNG với PDF
 * → Dashboard Weekly Report và PDF không thể lệch số liệu.
 *
 * Business Rule Weekly ĐỘC LẬP với Ads Monitor / Dashboard Content. */
import { buildWeeklyReport, type DateRange, type RawContent, type WeeklyReportData } from '../../../src/shared/weeklyMetrics';

export class WeeklyReportService {
  /** Đọc TOÀN BỘ content (KHÔNG lọc ngày) — cần cho "Đang duy trì" (all-time). */
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
        market: x.market || '',
        assignee_name: x.assignee_name || '(trống)',
        current_status: x.current_status ?? '',
        upload_date_real: x.upload_date_real ?? null,
      }));
      out.push(...items);
      if (items.length < pageSize || page >= (d.totalPages ?? 1)) break;
    }
    return out;
  }

  async getReport(range: DateRange): Promise<WeeklyReportData> {
    const rows = await this.fetchContents();
    return buildWeeklyReport(rows, range, new Date().toISOString());
  }
}

export const weeklyReportService = new WeeklyReportService();
