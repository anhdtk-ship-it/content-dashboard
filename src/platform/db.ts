/* ============================================================
 * Truy cập DB đa nền tảng (Zalo/TikTok…). Bảng platform_contents / platform_settings /
 * platform_sync_logs — TÁCH BIỆT hoàn toàn với bảng `contents` của Facebook.
 * ========================================================== */
import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createSupa(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) throw new Error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type { SupabaseClient };
