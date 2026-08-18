import express from 'express';
import { runContentSync } from './ContentSyncService';
import { runZaloSync } from '../platform/zalo/ZaloSyncService';

/* ============================================================
 * Daily Full-Sync Router (PHASE VERCEL-06)
 * ------------------------------------------------------------
 * POST /api/cron/daily/content  → runContentSync({ source: 'daily-cron', prune: false })
 * POST /api/cron/daily/zalo     → runZaloSync({ source: 'daily-cron', prune: false })
 *
 * Gọi bởi Vercel Cron NATIVE (khai báo trong vercel.json `crons`), lịch 03:30 UTC = 10:30
 * Asia/Ho_Chi_Minh mỗi ngày. Vercel Cron tự gửi header `Authorization: Bearer <CRON_SECRET>`.
 *
 * ĐỘC LẬP HOÀN TOÀN với /api/cron/tick/* (debounce webhook, tickRoutes.ts KHÔNG bị đụng):
 *  - KHÔNG gọi DbSyncQueue/queue/debounce — gọi thẳng runContentSync/runZaloSync mỗi lần.
 *  - Đây là FULL SYNC trực tiếp từ Google Sheet, chạy theo lịch cố định, không phụ thuộc
 *    tín hiệu webhook.
 *
 * prune LUÔN false — hardcode tại route, KHÔNG đọc SYNC_PRUNE_STALE/ZALO_SYNC_PRUNE_STALE,
 * KHÔNG cho query/body override.
 *
 * Bảo mật: dùng CHUNG biến `CRON_SECRET` với /api/cron/tick/* (cùng mục đích: cron nội bộ,
 * không phải webhook công khai), nhưng đọc qua `Authorization: Bearer` (khớp Vercel Cron
 * native) thay vì header `x-cron-secret` — helper riêng, KHÔNG sửa checkAuth của tickRoutes.ts.
 * ========================================================== */

const nowIso = () => new Date().toISOString();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Chỉ chấp nhận `Authorization: Bearer <secret>` (khớp Vercel Cron native) — không đọc query/body. */
function bearerToken(req: express.Request): string {
  const h = req.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/**
 * checkAuth trả `false` VÀ tự trả response lỗi nếu:
 *  - method không phải POST → 405
 *  - CRON_SECRET chưa cấu hình → 503
 *  - secret sai/thiếu → 401
 */
function checkAuth(req: express.Request, res: express.Response): boolean {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method không được hỗ trợ — chỉ nhận POST.' });
    return false;
  }
  const secret = process.env.CRON_SECRET?.trim() || '';
  if (!secret) {
    res.status(503).json({ error: 'CRON_SECRET chưa cấu hình — daily sync đang bị khóa.' });
    return false;
  }
  const given = bearerToken(req);
  if (!given || !timingSafeEqual(given, secret)) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export function createDailySyncRouter(deps: { onContentSynced?: () => void; onZaloSynced?: () => void } = {}): express.Router {
  const router = express.Router();

  router.all('/daily/content', async (req, res) => {
    if (!checkAuth(req, res)) return;
    const log = (m: string) => console.log(`[daily-sync][facebook ${nowIso()}] ${m}`);
    log('start');
    try {
      const result = await runContentSync({ source: 'daily-cron', prune: false, logger: log });
      if (result.status !== 'failed') deps.onContentSynced?.();
      log(
        `end · duration=${result.durationMs}ms · status=${result.status} · ` +
        `processed=${result.deduped} · inserted=${result.inserted} · updated=${result.updated} · ` +
        `unchanged=${result.unchanged} · pruned=${result.pruned}`,
      );
      res.json({
        success: result.status !== 'failed',
        platform: 'facebook',
        processed: result.deduped,
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
        pruned: result.pruned,
        durationMs: result.durationMs,
        status: result.status,
        source: result.source,
        rowsRead: result.rowsRead,
        errors: result.errors,
      });
    } catch (e: any) {
      log(`FAILED: ${e?.message ?? e}`);
      res.status(500).json({ success: false, platform: 'facebook', error: e?.message ?? String(e) });
    }
  });

  router.all('/daily/zalo', async (req, res) => {
    if (!checkAuth(req, res)) return;
    const log = (m: string) => console.log(`[daily-sync][zalo ${nowIso()}] ${m}`);
    log('start');
    try {
      const result = await runZaloSync({ source: 'daily-cron', prune: false, logger: log });
      if (result.status !== 'failed') deps.onZaloSynced?.();
      log(
        `end · duration=${result.durationMs}ms · status=${result.status} · ` +
        `processed=${result.deduped} · inserted=${result.inserted} · updated=${result.updated} · ` +
        `unchanged=${result.unchanged} · pruned=${result.pruned}`,
      );
      res.json({
        success: result.status !== 'failed',
        platform: 'zalo',
        processed: result.deduped,
        inserted: result.inserted,
        updated: result.updated,
        unchanged: result.unchanged,
        pruned: result.pruned,
        durationMs: result.durationMs,
        status: result.status,
        source: 'daily-cron',
        rowsRead: result.rowsRead,
        errors: result.errors,
      });
    } catch (e: any) {
      log(`FAILED: ${e?.message ?? e}`);
      res.status(500).json({ success: false, platform: 'zalo', error: e?.message ?? String(e) });
    }
  });

  return router;
}
