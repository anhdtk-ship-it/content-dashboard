/* ============================================================
 * Content Performance Router (CP-04)
 * ------------------------------------------------------------
 * GET /api/content-performance — stateless, đọc Performance/Quality Sheet trực tiếp mỗi
 * request (KHÔNG cache, KHÔNG bảng Supabase mới). Bảo vệ bằng `requireAuth`, gắn ở nơi mount
 * (src/app.ts), giống /api/v3 và /api/content-analytics.
 * ========================================================== */
import express from 'express';
import { buildContentPerformance } from './ContentPerformanceService';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function createContentPerformanceRouter(): express.Router {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const month = ((req.query.month as string) || '').trim() || currentMonth();
      const channel = ((req.query.channel as string) || '').trim() || 'ALL';
      const editor = ((req.query.editor as string) || '').trim() || 'ALL';
      const geoRaw = ((req.query.geography as string) || '').trim().toLowerCase();
      const geography = geoRaw === 'noi_dia' || geoRaw === 'quoc_te' ? geoRaw : 'all';
      const search = ((req.query.search as string) || '').trim();

      const result = await buildContentPerformance({ month, channel, editor, geography, search });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  return router;
}
