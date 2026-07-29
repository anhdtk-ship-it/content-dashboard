/* ============================================================
 * Đọc/ghi cấu hình Zalo từ bảng platform_settings (spec §XII — Leader sửa, không đổi code).
 *   key 'test_warning_days'   → warningDays
 *   key 'target:<Định dạng>'  → targets[<Định dạng>]  (VD 'target:Video' → targets['Video'])
 * KHÔNG hardcode định dạng: target nào có trong bảng thì đọc lên.
 * ========================================================== */
import type { SupabaseClient } from '../db';
import { DEFAULT_WARNING_DAYS, DEFAULT_WARNING_THRESHOLD, type ZaloSettings } from './zaloMetrics';

const PLATFORM = 'zalo';
const TARGET_PREFIX = 'target:';

export async function fetchZaloSettings(db: SupabaseClient): Promise<ZaloSettings> {
  const targets: Record<string, number> = {};
  let warningDays = DEFAULT_WARNING_DAYS;
  let warningThreshold = DEFAULT_WARNING_THRESHOLD;

  const { data, error } = await db
    .from('platform_settings').select('key, value').eq('platform', PLATFORM);
  if (error) {
    // Bảng chưa tạo (migration chưa chạy) → dùng mặc định, KHÔNG chặn Dashboard.
    return { targets, warningDays, warningThreshold };
  }
  for (const row of (data ?? []) as { key: string; value: string }[]) {
    const key = (row.key ?? '').trim();
    if (key === 'test_warning_days') {
      const n = Number(row.value);
      if (Number.isFinite(n) && n > 0) warningDays = Math.round(n);
    } else if (key === 'warning_threshold') {
      const n = Number(row.value);
      if (Number.isFinite(n) && n > 0) warningThreshold = Math.round(n);
    } else if (key.toLowerCase().startsWith(TARGET_PREFIX)) {
      const format = key.slice(TARGET_PREFIX.length).trim();
      const n = Number(row.value);
      if (format && Number.isFinite(n) && n >= 0) targets[format] = n;
    }
  }
  return { targets, warningDays, warningThreshold };
}

/** Ghi 1 cấu hình (dùng cho API cho Leader chỉnh mục tiêu). */
export async function upsertZaloSetting(db: SupabaseClient, key: string, value: string): Promise<void> {
  const { error } = await db
    .from('platform_settings')
    .upsert({ platform: PLATFORM, key: key.trim(), value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'platform,key' });
  if (error) throw new Error(error.message);
}
