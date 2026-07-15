import { Router } from 'express';
import { requireAuth } from './authMiddleware';

/* ============================================================
 * AUTH routes. GET /api/auth/me — trả hồ sơ nếu ĐÃ đăng nhập & được cấp quyền.
 * SPA gọi endpoint này để quyết định: 200 → vào Dashboard · 403 → "không có quyền" · 401 → chưa đăng nhập.
 * Đăng nhập/đăng xuất do client tự làm qua Supabase Auth (Google) — không cần route riêng.
 * ========================================================== */

const router = Router();

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: (req as any).authUser });
});

export default router;
