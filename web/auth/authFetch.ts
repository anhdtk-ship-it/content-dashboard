import { getAccessToken } from './supabaseClient';

/* Chèn Authorization: Bearer <JWT> vào MỌI request tới API cần bảo vệ
 * (/api/v3, /ads-monitor, /api/auth) — KHÔNG phải sửa từng trang Dashboard.
 * Bỏ qua /api/config (public, tránh đệ quy khi khởi tạo Supabase client). */

const PROTECTED = ['/api/v3', '/ads-monitor', '/api/auth', '/api/zalo'];

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.pathname;
  if (input instanceof Request) return input.url;
  return String(input);
}
function needsAuth(u: string): boolean {
  // chấp nhận cả path tương đối lẫn URL tuyệt đối cùng origin
  let path = u;
  try { path = new URL(u, window.location.origin).pathname; } catch { /* giữ nguyên */ }
  return PROTECTED.some((p) => path.startsWith(p));
}

export function installAuthFetch(): void {
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (needsAuth(urlOf(input))) {
      const token = await getAccessToken();
      if (token) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.set('Authorization', 'Bearer ' + token);
        init = { ...init, headers };
      }
    }
    return orig(input as any, init);
  };
}
