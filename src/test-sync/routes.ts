import express from 'express';
import { runContentSync } from '../content-sync/ContentSyncService';
import { runZaloSync } from '../platform/zalo/ZaloSyncService';

/* ============================================================
 * Test Sync Router (PHASE VERCEL-04C) — TEST ONLY, KHÔNG PHẢI PRODUCTION.
 * ------------------------------------------------------------
 * POST /api/test-sync/content  → runContentSync({ source: 'vercel-test', prune: false })
 * POST /api/test-sync/zalo     → runZaloSync({ source: 'vercel-test', prune: false })
 *
 * Mục đích: xác nhận Sync (đọc Google Sheet thật, transform, upsert Supabase thật) chạy
 * đúng trên serverless (Vercel) — đo execution time, KHÔNG xoá bất kỳ record nào
 * (prune:false CỨNG, không đọc từ SYNC_PRUNE_STALE/ZALO_SYNC_PRUNE_STALE, không cho
 * override qua query/body).
 *
 * KHÔNG dùng chung logic/route với production:
 *  - KHÔNG đụng /api/content-sync, /api/zalo-sync (webhook thật).
 *  - KHÔNG đụng /api/cron/tick/content, /api/cron/tick/zalo (cron thật).
 *  - KHÔNG đổi ContentSyncService.ts / ZaloSyncService.ts (chỉ GỌI với opts khác).
 *
 * Bảo mật: secret RIÊNG `VERCEL_TEST_SYNC_SECRET` — KHÔNG fallback sang CRON_SECRET/
 * CONTENT_SYNC_SECRET/ZALO_SYNC_SECRET dù thiếu cấu hình. Header: `Authorization: Bearer <secret>`.
 * ========================================================== */

const nowIso = () => new Date().toISOString();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Chỉ chấp nhận `Authorization: Bearer <secret>` — không đọc query/body (tránh secret lộ qua log truy cập/URL). */
function bearerToken(req: express.Request): string {
  const h = req.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/**
 * checkAuth trả `false` VÀ tự trả response lỗi nếu:
 *  - method không phải POST → 405
 *  - VERCEL_TEST_SYNC_SECRET chưa cấu hình → 503 (KHÔNG fallback sang secret khác)
 *  - secret sai/thiếu → 401
 */
function checkAuth(req: express.Request, res: express.Response): boolean {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method không được hỗ trợ — chỉ nhận POST.' });
    return false;
  }
  const secret = process.env.VERCEL_TEST_SYNC_SECRET?.trim() || '';
  if (!secret) {
    res.status(503).json({ error: 'VERCEL_TEST_SYNC_SECRET chưa cấu hình — test-sync đang bị khóa.' });
    return false;
  }
  const given = bearerToken(req);
  if (!given || !timingSafeEqual(given, secret)) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export function createTestSyncRouter(): express.Router {
  const router = express.Router();

  router.all('/content', async (req, res) => {
    if (!checkAuth(req, res)) return;
    const log = (m: string) => console.log(`[test-sync][facebook ${nowIso()}] ${m}`);
    log('start');
    const startedAt = Date.now();
    try {
      const result = await runContentSync({ source: 'vercel-test', prune: false });
      const durationMs = Date.now() - startedAt; // đo tại route — bao gồm cả overhead cold-start serverless
      log(
        `end · duration=${durationMs}ms (service=${result.durationMs}ms) · status=${result.status} · ` +
        `processed=${result.deduped} · inserted=${result.inserted} · updated=${result.updated} · ` +
        `unchanged=${result.unchanged} · pruned=${result.pruned}`,
      );
      res.json({
        success: result.status !== 'failed',
        durationMs,
        processed: result.deduped,
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
        pruned: result.pruned,
        status: result.status,
        source: result.source,
        rowsRead: result.rowsRead,
        errors: result.errors,
      });
    } catch (e: any) {
      log(`FAILED (after ${Date.now() - startedAt}ms): ${e?.message ?? e}`);
      res.status(500).json({ success: false, error: e?.message ?? String(e) });
    }
  });

  router.all('/zalo', async (req, res) => {
    if (!checkAuth(req, res)) return;
    const log = (m: string) => console.log(`[test-sync][zalo ${nowIso()}] ${m}`);
    log('start');
    const startedAt = Date.now();
    try {
      const result = await runZaloSync({ source: 'vercel-test', prune: false });
      const durationMs = Date.now() - startedAt; // đo tại route — bao gồm cả overhead cold-start serverless
      log(
        `end · duration=${durationMs}ms (service=${result.durationMs}ms) · status=${result.status} · ` +
        `processed=${result.deduped} · inserted=${result.inserted} · updated=${result.updated} · ` +
        `unchanged=${result.unchanged} · pruned=${result.pruned}`,
      );
      res.json({
        success: result.status !== 'failed',
        durationMs,
        processed: result.deduped,
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
        pruned: result.pruned,
        status: result.status,
        source: 'vercel-test',
        rowsRead: result.rowsRead,
        errors: result.errors,
      });
    } catch (e: any) {
      log(`FAILED (after ${Date.now() - startedAt}ms): ${e?.message ?? e}`);
      res.status(500).json({ success: false, error: e?.message ?? String(e) });
    }
  });

  return router;
}
