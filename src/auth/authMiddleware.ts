import 'dotenv/config';
import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

/* ============================================================
 * AUTH middleware (Supabase Auth Google) — Authentication + Authorization.
 * Chỉ BỔ SUNG. KHÔNG đụng business logic Dashboard/Ads/Weekly.
 *
 * Kiểm tra theo thứ tự:
 *   1. Có Bearer JWT (Supabase) hợp lệ                → nếu không: 401.
 *   2. email thuộc domain cho phép (@seryn.vn)        → nếu không: 403.
 *   3. email tồn tại trong bảng `users`               → nếu không: 403.
 *   4. is_active = true                               → nếu không: 403.
 * 403 luôn kèm thông báo: "Bạn không có quyền truy cập hệ thống."
 * ========================================================== */

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) throw new Error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auth).');

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// Robust: bỏ ký tự '@' đầu nếu lỡ đặt "@seryn.vn", bỏ khoảng trắng, fallback nếu rỗng.
export const ALLOWED_DOMAIN = ((process.env.AUTH_ALLOWED_DOMAIN || 'seryn.vn').trim().toLowerCase().replace(/^@+/, '')) || 'seryn.vn';
export const DENY_MESSAGE = 'Bạn không có quyền truy cập hệ thống.';

export interface AuthUser { email: string; full_name: string | null; role: string; }

/* Cache token đã xác thực (giảm gọi Supabase Auth khi Dashboard poll 30s). TTL ngắn. */
const CACHE_TTL = 60_000;
const cache = new Map<string, { at: number; user: AuthUser }>();

async function resolveUser(token: string): Promise<{ status: number; user?: AuthUser; error?: string; reason?: string }> {
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < CACHE_TTL) return { status: 200, user: hit.user };

  // 1) Xác thực JWT qua Supabase.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { status: 401, error: 'Phiên đăng nhập không hợp lệ.', reason: 'invalid_token' };
  const email = (data.user.email || '').trim().toLowerCase();
  if (!email) return { status: 403, error: DENY_MESSAGE, reason: 'no_email' };

  // 2) Domain @seryn.vn.
  if (!email.endsWith('@' + ALLOWED_DOMAIN)) return { status: 403, error: DENY_MESSAGE, reason: `domain(want=${ALLOWED_DOMAIN})` };

  // 3) + 4) Có trong bảng users & is_active.
  const { data: u, error: uErr } = await admin
    .from('users').select('email, full_name, role, is_active').eq('email', email).maybeSingle();
  if (uErr) return { status: 500, error: uErr.message, reason: 'users_query_error' };
  if (!u) return { status: 403, error: DENY_MESSAGE, reason: 'not_in_users' };
  if (!u.is_active) return { status: 403, error: DENY_MESSAGE, reason: 'inactive' };

  const user: AuthUser = { email, full_name: u.full_name ?? null, role: u.role ?? 'viewer' };
  cache.set(token, { at: Date.now(), user });
  return { status: 200, user };
}

/** Middleware Express — gắn `req.authUser` nếu hợp lệ, ngược lại trả 401/403. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authz = req.get('authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
    if (!token) { res.status(401).json({ error: 'Chưa đăng nhập.' }); return; }

    const r = await resolveUser(token);
    if (r.status !== 200 || !r.user) { res.status(r.status).json({ error: r.error, reason: r.reason }); return; }
    (req as any).authUser = r.user;
    next();
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) });
  }
}
