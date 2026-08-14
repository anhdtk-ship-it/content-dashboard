import express from 'express';
import { DbSyncQueue } from './DbSyncQueue';

/* ============================================================
 * Content Sync Router (PHASE 12 → VERCEL MIGRATION)
 * ------------------------------------------------------------
 * POST /api/content-sync         → Webhook: chỉ báo "Sheet đã đổi",
 *                                  ghi tín hiệu vào bảng sync_debounce (KHÔNG đọc
 *                                  Sheet, KHÔNG ghi contents tại đây).
 * GET  /api/content-sync/status  → Trạng thái debounce + kết quả Sync gần nhất.
 *
 * Việc THỰC SỰ chạy Sync (đọc Sheet, upsert contents) đã chuyển sang route tick
 * (`tickRoutes.ts`, POST /api/cron/tick/content`), gọi bởi cron ngoài mỗi ~1 phút —
 * vì trên Vercel (serverless) không thể tự hẹn giờ 60s sau trong RAM như trước.
 *
 * Bảo mật: bắt buộc CONTENT_SYNC_SECRET. Không cấu hình → khóa (503).
 * Chỉ áp dụng cho Dashboard Content. KHÔNG liên quan Ads.
 * ========================================================== */

const nowIso = () => new Date().toISOString();

export function createContentSyncRouter(): express.Router {
  const router = express.Router();

  const secret = process.env.CONTENT_SYNC_SECRET?.trim() || '';
  const debounceMs = Number(process.env.CONTENT_SYNC_DEBOUNCE_MS ?? 60_000);
  const maxWaitMs = Number(process.env.CONTENT_SYNC_MAX_WAIT_MS ?? 300_000);
  const log = (m: string) => console.log(`[content-sync ${nowIso()}] ${m}`);

  const queue = new DbSyncQueue('content');

  // Body parser CHỈ cho router này (app chính không dùng express.json).
  router.use(express.json({ limit: '64kb' }));

  function providedSecret(req: express.Request): string {
    return (
      req.get('x-content-sync-secret') ||
      (req.query.secret as string) ||
      (req.body && req.body.secret) ||
      ''
    ).toString();
  }
  function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // Webhook: nhận tín hiệu → ghi vào sync_debounce → trả 202 NGAY (không chờ Sync).
  router.post('/', async (req, res) => {
    if (!secret) {
      return res.status(503).json({ error: 'CONTENT_SYNC_SECRET chưa cấu hình — webhook đang bị khóa.' });
    }
    const given = providedSecret(req);
    if (!given || !timingSafeEqual(given, secret)) {
      log('Webhook bị từ chối: sai/thiếu secret.');
      return res.status(401).json({ error: 'unauthorized' });
    }
    try {
      const src = (req.body && req.body.source) || 'sheet';
      await queue.enqueue();
      log(`Webhook nhận (source=${src}) → đã ghi tín hiệu, chờ tick kế tiếp xử lý.`);
      const state = await queue.getState();
      return res.status(202).json({ accepted: true, state });
    } catch (e: any) {
      log(`Lỗi ghi tín hiệu: ${e?.message ?? e}`);
      return res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  // Trạng thái debounce (read-only, không secret — chỉ metadata, không chứa dữ liệu nhạy cảm).
  router.get('/status', async (_req, res) => {
    try {
      const state = await queue.getState();
      res.json({ ...state, config: { debounceMs, maxWaitMs, secretConfigured: !!secret }, generatedAt: nowIso() });
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? String(e) });
    }
  });

  return router;
}
