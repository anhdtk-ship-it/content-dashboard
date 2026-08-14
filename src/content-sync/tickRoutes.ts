import express from 'express';
import { DbSyncQueue } from './DbSyncQueue';
import { runContentSync } from './ContentSyncService';
import { runZaloSync } from '../platform/zalo/ZaloSyncService';

/* ============================================================
 * Cron Tick Router (VERCEL MIGRATION)
 * ------------------------------------------------------------
 * POST /api/cron/tick/content
 * POST /api/cron/tick/zalo
 *
 * Gọi bởi 1 dịch vụ cron NGOÀI (vd cron-job.org, mỗi ~1 phút) — KHÔNG phải webhook công
 * khai từ Apps Script. Mỗi lần gọi: cố "claim" quyền chạy Sync qua RPC atomic
 * (sync_tick_claim, xem sql/012_sync_debounce.sql); nếu đủ điều kiện (đã hết debounce
 * HOẶC đã chạm Maximum Wait, và không có lần chạy khác đang running) thì THỰC SỰ đọc
 * Sheet + upsert DB (runContentSync/runZaloSync). Nếu chưa đủ điều kiện → trả về ngay,
 * không làm gì (đây là cơ chế bình thường, không phải lỗi).
 *
 * Tách 2 route riêng (không gộp 1 tick chung): 1 lần sync Facebook chậm không kéo theo
 * timeout của tick Zalo, và cron ngoài theo dõi lịch sử thành công/lỗi độc lập từng cái.
 *
 * Bảo mật: CRON_SECRET RIÊNG — khác secret webhook công khai (CONTENT_SYNC_SECRET/
 * ZALO_SYNC_SECRET) vì endpoint này thực sự trigger đọc Sheet + ghi DB.
 * ========================================================== */

const nowIso = () => new Date().toISOString();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function createCronTickRouter(deps: { onContentSynced?: () => void; onZaloSynced?: () => void } = {}): express.Router {
  const router = express.Router();
  const secret = process.env.CRON_SECRET?.trim() || '';

  const contentQueue = new DbSyncQueue('content');
  const contentCfg = {
    debounceMs: Number(process.env.CONTENT_SYNC_DEBOUNCE_MS ?? 60_000),
    maxWaitMs: Number(process.env.CONTENT_SYNC_MAX_WAIT_MS ?? 300_000),
  };
  const zaloQueue = new DbSyncQueue('zalo');
  const zaloCfg = {
    debounceMs: Number(process.env.ZALO_SYNC_DEBOUNCE_MS ?? 60_000),
    maxWaitMs: Number(process.env.ZALO_SYNC_MAX_WAIT_MS ?? 300_000),
  };

  function checkAuth(req: express.Request, res: express.Response): boolean {
    if (!secret) { res.status(503).json({ error: 'CRON_SECRET chưa cấu hình — tick đang bị khóa.' }); return false; }
    const given = (req.get('x-cron-secret') || (req.query.secret as string) || '').toString();
    if (!given || !timingSafeEqual(given, secret)) { res.status(401).json({ error: 'unauthorized' }); return false; }
    return true;
  }

  router.post('/tick/content', async (req, res) => {
    if (!checkAuth(req, res)) return;
    const log = (m: string) => console.log(`[cron-tick-content ${nowIso()}] ${m}`);
    try {
      const outcome = await contentQueue.tick(contentCfg, async () => {
        const r = await runContentSync({ source: 'webhook', logger: log });
        if (r.status !== 'failed') deps.onContentSynced?.();
        log(`Kết quả: ${r.status} · mới ${r.inserted} · đổi ${r.updated} · giữ ${r.unchanged} · prune ${r.pruned} · ${r.durationMs}ms`);
        return r;
      });
      log(outcome.ranSync ? 'Đã claim và chạy Sync.' : 'Chưa đủ điều kiện (chờ tick sau).');
      res.json({ ...outcome, generatedAt: nowIso() });
    } catch (e: any) {
      log(`Lỗi: ${e?.message ?? e}`);
      res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  router.post('/tick/zalo', async (req, res) => {
    if (!checkAuth(req, res)) return;
    const log = (m: string) => console.log(`[cron-tick-zalo ${nowIso()}] ${m}`);
    try {
      const outcome = await zaloQueue.tick(zaloCfg, async () => {
        const r = await runZaloSync({ source: 'webhook', logger: log });
        if (r.status !== 'failed') deps.onZaloSynced?.();
        log(`Kết quả: ${r.status} · mới ${r.inserted} · đổi ${r.updated} · giữ ${r.unchanged} · prune ${r.pruned} · ${r.durationMs}ms`);
        return r;
      });
      log(outcome.ranSync ? 'Đã claim và chạy Sync.' : 'Chưa đủ điều kiện (chờ tick sau).');
      res.json({ ...outcome, generatedAt: nowIso() });
    } catch (e: any) {
      log(`Lỗi: ${e?.message ?? e}`);
      res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  return router;
}
