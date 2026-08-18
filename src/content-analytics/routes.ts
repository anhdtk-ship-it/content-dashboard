/* ============================================================
 * Content Analytics Router (PHASE CONTENT-ANALYTICS-03)
 * ------------------------------------------------------------
 * GET /api/content-analytics — stateless, đọc Google Sheet Raw_Data trực tiếp mỗi request
 * (KHÔNG cache, KHÔNG bảng Supabase mới). Bảo vệ bằng `requireAuth` — gắn ở nơi mount
 * (src/app.ts), giống hệt cách /api/v3 đang làm, KHÔNG định nghĩa lại auth ở đây.
 * ========================================================== */
import express from 'express';
import { buildContentAnalytics } from './ContentAnalyticsService';
import type { ContentTypeFilter } from './types';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function parseTypeParam(v: unknown): ContentTypeFilter {
  const s = (v ?? '').toString().trim().toLowerCase();
  return s === 'new' || s === 'old' ? s : 'all';
}

export function createContentAnalyticsRouter(): express.Router {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const month = ((req.query.month as string) || '').trim() || currentMonth();
      const employee = ((req.query.employee as string) || '').trim() || 'ALL';
      const type = parseTypeParam(req.query.type);
      const search = ((req.query.search as string) || '').trim();

      const result = await buildContentAnalytics({ month, employee, type, search });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  return router;
}
