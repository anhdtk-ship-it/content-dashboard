/* ============================================================
 * Webhook đồng bộ Zalo (ĐỘC LẬP với /api/content-sync của Facebook).
 * Mount tại /api/zalo-sync.
 *   POST /api/zalo-sync         → nhận tín hiệu "Sheet Zalo đổi" → ghi vào sync_debounce.
 *   GET  /api/zalo-sync/status  → trạng thái debounce + kết quả sync gần nhất.
 * Bảo mật: ZALO_SYNC_SECRET (không cấu hình → khoá 503). Queue riêng, secret riêng.
 *
 * VERCEL MIGRATION: việc THỰC SỰ chạy Sync (đọc Sheet, upsert platform_contents) đã
 * chuyển sang route tick (`content-sync/tickRoutes.ts`, POST /api/cron/tick/zalo),
 * gọi bởi cron ngoài mỗi ~1 phút — route này chỉ còn ghi tín hiệu debounce.
 * ========================================================== */
import express from 'express';
import { DbSyncQueue } from '../../content-sync/DbSyncQueue';

const nowIso = () => new Date().toISOString();
/** Đánh dấu phiên bản router — đổi mỗi lần deploy để xác nhận build mới đã live. */
const ZALO_SYNC_VERSION = 'zalo-05-vercel-debounce-db';

export function createZaloSyncRouter(): express.Router {
  const router = express.Router();
  const secret = process.env.ZALO_SYNC_SECRET?.trim() || '';
  const debounceMs = Number(process.env.ZALO_SYNC_DEBOUNCE_MS ?? 60_000);
  const maxWaitMs = Number(process.env.ZALO_SYNC_MAX_WAIT_MS ?? 300_000);
  const log = (m: string) => console.log(`[zalo-sync ${nowIso()}] ${m}`);

  const queue = new DbSyncQueue('zalo');

  router.use(express.json({ limit: '64kb' }));

  const provided = (req: express.Request) =>
    // Chấp nhận cả 'x-zalo-sync-secret' lẫn 'x-content-sync-secret' (Apps Script Zalo dùng header sau).
    (req.get('x-zalo-sync-secret') || req.get('x-content-sync-secret') || (req.query.secret as string) || (req.body && req.body.secret) || '').toString();
  const safeEq = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  };

  router.post('/', async (req, res) => {
    if (!secret) return res.status(503).json({ error: 'ZALO_SYNC_SECRET chưa cấu hình — webhook đang khoá.' });
    const given = provided(req);
    if (!given || !safeEq(given, secret)) { log('Từ chối: sai/thiếu secret.'); return res.status(401).json({ error: 'unauthorized' }); }
    try {
      await queue.enqueue();
      log('Đã ghi tín hiệu, chờ tick kế tiếp xử lý.');
      const state = await queue.getState();
      return res.status(202).json({ accepted: true, state });
    } catch (e: any) {
      log(`Lỗi ghi tín hiệu: ${e?.message ?? e}`);
      return res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  router.get('/status', async (_req, res) => {
    try {
      const state = await queue.getState();
      res.json({
        ...state,
        version: ZALO_SYNC_VERSION,
        config: { debounceMs, maxWaitMs, secretConfigured: !!secret, sheetIdConfigured: !!(process.env.ZALO_GOOGLE_SHEET_ID || process.env.ZALO_SHEET_ID) },
        generatedAt: nowIso(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  return router;
}
