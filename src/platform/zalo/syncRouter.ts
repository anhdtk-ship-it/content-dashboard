/* ============================================================
 * Webhook đồng bộ Zalo (ĐỘC LẬP với /api/content-sync của Facebook).
 * Mount tại /api/zalo-sync.
 *   POST /api/zalo-sync         → nhận tín hiệu "Sheet Zalo đổi" → Debounce Queue RIÊNG.
 *   GET  /api/zalo-sync/status  → trạng thái queue + kết quả sync gần nhất.
 * Bảo mật: ZALO_SYNC_SECRET (không cấu hình → khoá 503). Queue riêng, secret riêng.
 * ========================================================== */
import express from 'express';
import { SyncQueue } from '../../content-sync/SyncQueue';
import { runZaloSync } from './ZaloSyncService';

const nowIso = () => new Date().toISOString();
/** Đánh dấu phiên bản router — đổi mỗi lần deploy để xác nhận build mới đã live. */
const ZALO_SYNC_VERSION = 'zalo-04.2-tabsdiag';

export function createZaloSyncRouter(deps: { onSynced?: () => void } = {}): express.Router {
  const router = express.Router();
  const secret = process.env.ZALO_SYNC_SECRET?.trim() || '';
  const debounceMs = Number(process.env.ZALO_SYNC_DEBOUNCE_MS ?? 60_000);
  const maxWaitMs = Number(process.env.ZALO_SYNC_MAX_WAIT_MS ?? 300_000);
  const log = (m: string) => console.log(`[zalo-sync ${nowIso()}] ${m}`);

  const queue = new SyncQueue({
    debounceMs, maxWaitMs, log,
    runFn: async () => {
      const res = await runZaloSync({ source: 'webhook', logger: log });
      if (res.status !== 'failed') deps.onSynced?.();
      log(`Kết quả: ${res.status} · mới ${res.inserted} · đổi ${res.updated} · giữ ${res.unchanged} · prune ${res.pruned} · ${res.durationMs}ms`);
      return res;
    },
  });

  router.use(express.json({ limit: '64kb' }));

  const provided = (req: express.Request) =>
    // Chấp nhận cả 'x-zalo-sync-secret' lẫn 'x-content-sync-secret' (Apps Script Zalo dùng header sau).
    (req.get('x-zalo-sync-secret') || req.get('x-content-sync-secret') || (req.query.secret as string) || (req.body && req.body.secret) || '').toString();
  const safeEq = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  };

  router.post('/', (req, res) => {
    if (!secret) return res.status(503).json({ error: 'ZALO_SYNC_SECRET chưa cấu hình — webhook đang khoá.' });
    const given = provided(req);
    if (!given || !safeEq(given, secret)) { log('Từ chối: sai/thiếu secret.'); return res.status(401).json({ error: 'unauthorized' }); }
    const info = queue.enqueue();
    log(info.busy ? 'Đang sync, xếp hàng chu kỳ mới.' : `Hẹn sync sau ~${Math.round((info.willFireInMs ?? 0) / 1000)}s.`);
    return res.status(202).json({ accepted: true, ...info, state: queue.getState() });
  });

  router.get('/status', (_req, res) => {
    res.json({
      ...queue.getState(),
      version: ZALO_SYNC_VERSION,
      config: { debounceMs, maxWaitMs, secretConfigured: !!secret, sheetIdConfigured: !!(process.env.ZALO_GOOGLE_SHEET_ID || process.env.ZALO_SHEET_ID) },
      generatedAt: nowIso(),
    });
  });

  return router;
}
