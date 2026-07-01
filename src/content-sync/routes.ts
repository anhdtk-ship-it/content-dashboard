import express from 'express';
import { runContentSync } from './ContentSyncService';
import { SyncQueue } from './SyncQueue';

/* ============================================================
 * Content Sync Router (PHASE 12)
 * ------------------------------------------------------------
 * POST /api/content-sync         → Webhook: chỉ báo "Sheet đã đổi",
 *                                  đưa vào Debounce Queue (KHÔNG đọc
 *                                  Sheet, KHÔNG ghi DB tại đây).
 * GET  /api/content-sync/status  → Trạng thái queue + kết quả Sync gần nhất.
 *
 * Bảo mật: bắt buộc CONTENT_SYNC_SECRET. Không cấu hình → khóa (503).
 * Chỉ áp dụng cho Dashboard Content. KHÔNG liên quan Ads.
 * ========================================================== */

const nowIso = () => new Date().toISOString();

export function createContentSyncRouter(deps: { onSynced?: () => void } = {}): express.Router {
  const router = express.Router();

  const secret = process.env.CONTENT_SYNC_SECRET?.trim() || '';
  const debounceMs = Number(process.env.CONTENT_SYNC_DEBOUNCE_MS ?? 60_000);
  const maxWaitMs = Number(process.env.CONTENT_SYNC_MAX_WAIT_MS ?? 300_000);
  const log = (m: string) => console.log(`[content-sync ${nowIso()}] ${m}`);

  const queue = new SyncQueue({
    debounceMs,
    maxWaitMs,
    log,
    runFn: async () => {
      const res = await runContentSync({ source: 'webhook', logger: log });
      // Sync thành công (kể cả 'partial') → làm mới cache Dashboard.
      if (res.status !== 'failed') deps.onSynced?.();
      log(`Kết quả: ${res.status} · mới ${res.inserted} · đổi ${res.updated} · giữ ${res.unchanged} · prune ${res.pruned} · ${res.durationMs}ms`);
      return res;
    },
  });

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

  // Webhook: nhận tín hiệu → enqueue → trả 202 NGAY (không chờ Sync).
  router.post('/', (req, res) => {
    if (!secret) {
      return res.status(503).json({ error: 'CONTENT_SYNC_SECRET chưa cấu hình — webhook đang bị khóa.' });
    }
    const given = providedSecret(req);
    if (!given || !timingSafeEqual(given, secret)) {
      log('Webhook bị từ chối: sai/thiếu secret.');
      return res.status(401).json({ error: 'unauthorized' });
    }
    const src = (req.body && req.body.source) || 'sheet';
    const info = queue.enqueue();
    log(
      `Webhook nhận (source=${src}) → ` +
      (info.busy ? 'đang Sync, xếp hàng chu kỳ mới.' : `hẹn Sync sau ~${Math.round((info.willFireInMs ?? 0) / 1000)}s.`),
    );
    return res.status(202).json({ accepted: true, ...info, state: queue.getState() });
  });

  // Trạng thái queue (read-only, không secret — chỉ metadata, không chứa dữ liệu nhạy cảm).
  router.get('/status', (_req, res) => {
    res.json({
      ...queue.getState(),
      config: { debounceMs, maxWaitMs, secretConfigured: !!secret },
      generatedAt: nowIso(),
    });
  });

  return router;
}
