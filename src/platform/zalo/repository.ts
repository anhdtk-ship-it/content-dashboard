/* ============================================================
 * Đọc content Zalo từ bảng platform_contents (platform='zalo').
 * Tách biệt hoàn toàn với bảng `contents` của Facebook.
 * ========================================================== */
import type { SupabaseClient } from '../db';
import type { ZaloContent } from './ZaloContent';

const PLATFORM = 'zalo';

/** Nạp TOÀN BỘ content Zalo (mọi tháng) — Dashboard/Weekly tự lọc theo kỳ trên bộ nhớ. */
export async function fetchZaloContents(db: SupabaseClient): Promise<ZaloContent[]> {
  const out: ZaloContent[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from('platform_contents')
      .select('content_code, title, assignee_name, content_format, current_status, upload_date, upload_date_real, test_date, test_date_real')
      .eq('platform', PLATFORM)
      .range(from, from + pageSize - 1);
    if (error) {
      // Bảng chưa tạo → coi như chưa có dữ liệu (Dashboard hiện Empty State, không lỗi).
      if (out.length === 0) return [];
      throw error;
    }
    if (!data || data.length === 0) break;
    for (const d of data as any[]) {
      out.push({
        content_code: d.content_code ?? '',
        title: d.title ?? '',
        assignee_name: d.assignee_name ?? '',
        content_format: (d.content_format ?? null) || null,
        current_status: d.current_status ?? '',
        upload_date: d.upload_date ?? '',
        upload_date_real: d.upload_date_real ?? null,
        test_date: d.test_date ?? '',
        test_date_real: d.test_date_real ?? null,
      });
    }
    if (data.length < pageSize) break;
  }
  return out;
}
