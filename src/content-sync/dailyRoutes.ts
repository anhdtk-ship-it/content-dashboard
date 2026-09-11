import express from 'express';
import { runContentSync } from './ContentSyncService';
import { runZaloSync } from '../platform/zalo/ZaloSyncService';

/* ============================================================
 * Daily Full-Sync Router — CƠ CHẾ ĐỒNG BỘ DUY NHẤT của hệ thống.
 * ------------------------------------------------------------
 * GET|POST /api/cron/daily/content  → runContentSync({ source: 'daily-cron', prune: false })
 * GET|POST /api/cron/daily/zalo     → runZaloSync({ source: 'daily-cron', prune: false })
 *
 * Gọi bởi Vercel Cron NATIVE (khai báo trong vercel.json `crons`), lịch `0 3 * * *` UTC
 * = 10:00 Asia/Ho_Chi_Minh mỗi ngày. Lưu ý: gói Hobby chỉ bảo đảm chạy TRONG KHOẢNG 1 GIỜ
 * quanh lịch (quan sát thực tế: trễ đều ~36 phút → rơi vào khoảng 10:30–10:40 giờ VN).
 *
 * Vercel Cron gọi bằng **GET** và tự gửi header `Authorization: Bearer <CRON_SECRET>` —
 * vì vậy checkAuth chấp nhận cả GET lẫn POST (method khác vẫn 405).
 *
 * LỊCH SỬ: trước đây còn 1 cơ chế thứ hai (webhook Apps Script → bảng sync_debounce →
 * /api/cron/tick/*) cho đồng bộ gần thời gian thực. Cơ chế đó đã được GỠ BỎ HOÀN TOÀN
 * (2026-09-11) theo quyết định "dữ liệu chỉ cần cập nhật 1 lần/ngày vào khung giờ cố định".
 * KHÔNG khôi phục nếu không có yêu cầu rõ ràng — xem PROJECT_SPEC.md §3.
 *
 * prune LUÔN false — hardcode tại route, KHÔNG đọc SYNC_PRUNE_STALE/ZALO_SYNC_PRUNE_STALE,
 * KHÔNG cho query/body override. ⇒ Content bị xoá khỏi Google Sheet sẽ KHÔNG bị xoá khỏi DB;
 * muốn dọn "mồ côi" phải chạy tay `npm run sync` (CLI có prune + guard).
 *
 * Bảo mật: `CRON_SECRET`, đọc qua `Authorization: Bearer` (khớp Vercel Cron native).
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
 *  - method không phải GET/POST → 405
 *  - CRON_SECRET chưa cấu hình → 503
 *  - secret sai/thiếu → 401
 */
function checkAuth(req: express.Request, res: express.Response): boolean {
  // Vercel Cron native gọi endpoint bằng GET → phải cho GET đi qua, nếu không sẽ 405 và
  // sync KHÔNG BAO GIỜ chạy. POST vẫn giữ (caller thủ công/ngoài repo). Xác thực
  // CRON_SECRET bên dưới áp dụng NHƯ NHAU cho cả GET lẫn POST — GET KHÔNG được bypass.
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method không được hỗ trợ — chỉ nhận GET hoặc POST.' });
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
