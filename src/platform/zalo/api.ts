/* ============================================================
 * API Zalo (ĐỘC LẬP với API Facebook). Mount tại /api/zalo/*.
 *   GET /summary?month=YYYY-MM        → toàn bộ số liệu Dashboard (§V–IX)
 *   GET /contents?month&format&status&alert&q&page&pageSize → drill-down danh sách
 *   GET /weekly?from&to               → dữ liệu Weekly Report + narrative
 *   GET /sync-status                  → log đồng bộ + độ tươi dữ liệu
 *   GET /settings                     → cấu hình hiện tại (mục tiêu, cảnh báo)
 *   PUT /settings   {key,value}       → Leader cập nhật cấu hình (không cần sửa code)
 * Toàn bộ số liệu tính bằng module PURE (zaloMetrics/zaloWeeklyMetrics) → khớp Web/PDF.
 * ========================================================== */
import express from 'express';
import { createSupa, type SupabaseClient } from '../db';
import { fetchZaloContents } from './repository';
import { fetchZaloSettings, upsertZaloSetting } from './settings';
import { zaloStatusRule } from './ZaloStatusRule';
import { buildZaloSummary, monthBounds, shiftIso } from './zaloMetrics';
import { buildZaloWeekly, buildZaloNarrative, type ZaloDateRange } from './zaloWeeklyMetrics';
import type { ZaloContent } from './ZaloContent';

/** Ngày "hôm nay" theo giờ Việt Nam (UTC+7) — mốc tính lịch/cảnh báo. */
function todayVN(): string {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 3600_000);
  return vn.toISOString().slice(0, 10);
}
const monthOfToday = () => todayVN().slice(0, 7);
const okMonth = (s: any): s is string => typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);
const okDate = (s: any): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export interface ZaloApi { router: express.Router; invalidate: () => void }

export function createZaloRouter(deps: { onSynced?: () => void } = {}): ZaloApi {
  const router = express.Router();
  const db: SupabaseClient = createSupa();

  // Cache nhẹ (giống Dashboard FB) — content + settings.
  let cache: { at: number; rows: ZaloContent[]; settings: Awaited<ReturnType<typeof fetchZaloSettings>> } | null = null;
  const TTL = 10_000;
  async function load() {
    if (cache && Date.now() - cache.at < TTL) return cache;
    const [rows, settings] = await Promise.all([fetchZaloContents(db), fetchZaloSettings(db)]);
    cache = { at: Date.now(), rows, settings };
    return cache;
  }
  const invalidate = () => { cache = null; deps.onSynced?.(); };

  router.get('/summary', async (req, res) => {
    try {
      const { rows, settings } = await load();
      const month = okMonth(req.query.month) ? (req.query.month as string) : monthOfToday();
      res.json(buildZaloSummary(rows, month, todayVN(), settings, new Date().toISOString()));
    } catch (e: any) { res.status(500).json({ error: e?.message ?? String(e) }); }
  });

  router.get('/contents', async (req, res) => {
    try {
      const { rows, settings } = await load();
      const month = okMonth(req.query.month) ? (req.query.month as string) : monthOfToday();
      const { from, to } = monthBounds(month);
      const format = (req.query.format as string) || 'ALL';
      const statusGroup = (req.query.status as string) || 'ALL';
      const alert = (req.query.alert as string) || '';
      const q = ((req.query.q as string) || '').trim().toLowerCase();
      const staleBefore = shiftIso(todayVN(), -(settings.warningDays || 5));

      let list = rows.filter((r) => !!r.upload_date_real && r.upload_date_real >= from && r.upload_date_real <= to);
      if (format !== 'ALL') list = list.filter((r) => ((r.content_format ?? '').trim()) === (format === '__NONE__' ? '' : format));
      if (statusGroup !== 'ALL') list = list.filter((r) => zaloStatusRule.statusGroup(r.current_status) === statusGroup);
      if (alert) {
        list = list.filter((r) => {
          const g = zaloStatusRule.statusGroup(r.current_status);
          switch (alert) {
            case 'tested': return zaloStatusRule.isTested(r.current_status);
            case 'chuaPhanLoai': return g === 'CHUA_PHAN_LOAI';
            case 'chuaTest': return g === 'TON';
            case 'testQuaLau': return g === 'DUY_TRI' && !!r.test_date_real && r.test_date_real < staleBefore;
            case 'thieuNgayTest': return zaloStatusRule.isTested(r.current_status) && !r.test_date_real;
            case 'thieuDinhDang': return !(r.content_format ?? '').trim();
            case 'thieuBatBuoc': return !(r.title ?? '').trim(); // thiếu Tên Content (bắt buộc)
            case 'thieuTrangThai': return (r.current_status ?? '').trim() === '';
            default: return true;
          }
        });
      }
      if (q) list = list.filter((r) => r.content_code.toLowerCase().includes(q) || (r.title ?? '').toLowerCase().includes(q));

      list = [...list].sort((a, b) => (b.upload_date_real ?? '').localeCompare(a.upload_date_real ?? ''));
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize as string) || 20));
      const total = list.length;
      const items = list.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
        content_code: r.content_code, title: r.title ?? '', assignee_name: r.assignee_name,
        content_format: r.content_format ?? '', current_status: r.current_status ?? '',
        status_group: zaloStatusRule.statusGroup(r.current_status),
        upload_date: r.upload_date ?? '', upload_date_real: r.upload_date_real ?? null,
        test_date: r.test_date ?? '', test_date_real: r.test_date_real ?? null,
      }));
      res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (e: any) { res.status(500).json({ error: e?.message ?? String(e) }); }
  });

  router.get('/weekly', async (req, res) => {
    try {
      const { rows, settings } = await load();
      const to = okDate(req.query.to) ? (req.query.to as string) : todayVN();
      const from = okDate(req.query.from) ? (req.query.from as string) : shiftIso(to, -6);
      const dmy = (iso: string) => iso.split('-').reverse().join('/');
      const range: ZaloDateRange = { from, to, label: `${dmy(from)} – ${dmy(to)}` };
      const data = buildZaloWeekly(rows, range, settings, new Date().toISOString());
      res.json({ ...data, narrative: buildZaloNarrative(data) });
    } catch (e: any) { res.status(500).json({ error: e?.message ?? String(e) }); }
  });

  router.get('/sync-status', async (_req, res) => {
    try {
      const { rows } = await load();
      const withUpload = rows.filter((r) => r.upload_date_real).length;
      const withTest = rows.filter((r) => r.test_date_real).length;
      let logs: any[] = [];
      const { data } = await db.from('platform_sync_logs').select('*').eq('platform', 'zalo').order('id', { ascending: false }).limit(20);
      if (data) logs = data;
      res.json({
        totals: { total: rows.length, withUpload, withTest },
        logs, lastSync: logs[0] ?? null, generatedAt: new Date().toISOString(),
      });
    } catch (e: any) { res.status(500).json({ error: e?.message ?? String(e) }); }
  });

  router.get('/settings', async (_req, res) => {
    try { const { settings } = await load(); res.json(settings); }
    catch (e: any) { res.status(500).json({ error: e?.message ?? String(e) }); }
  });

  router.put('/settings', express.json({ limit: '16kb' }), async (req, res) => {
    try {
      const key = (req.body?.key ?? '').toString().trim();
      const value = req.body?.value;
      if (!key || value == null) return res.status(400).json({ error: 'Thiếu key/value.' });
      await upsertZaloSetting(db, key, String(value));
      invalidate();
      const { settings } = await load();
      res.json({ ok: true, settings });
    } catch (e: any) { res.status(500).json({ error: e?.message ?? String(e) }); }
  });

  return { router, invalidate };
}
