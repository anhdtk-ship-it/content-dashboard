import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* Supabase client phía trình duyệt — CHỈ dùng cho Authentication (Google OAuth).
 * Lấy url + anon key từ /api/config (public). KHÔNG đọc dữ liệu Dashboard qua client này. */

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => {
        if (!cfg?.url || !cfg?.anonKey) throw new Error('Thiếu cấu hình Supabase (SUPABASE_ANON_KEY) — chưa bật được đăng nhập.');
        return createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
      });
  }
  return clientPromise;
}

/** Access token hiện tại (JWT Supabase) — dùng để gắn Authorization cho API. */
export async function getAccessToken(): Promise<string | null> {
  const s = await getSupabase();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}
