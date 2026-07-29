/* ============================================================
 * ZaloSyncService — ĐỒNG BỘ Google Sheet Zalo → Supabase (platform_contents, platform='zalo').
 * ------------------------------------------------------------
 * ĐỘC LẬP hoàn toàn với ContentSyncService (Facebook). Library-safe (không process.exit).
 * So sánh SIGNATURE → chỉ upsert bản ghi mới/đổi. Prune có guard an toàn. Ghi platform_sync_logs.
 * ========================================================== */
import { createSupa, type SupabaseClient } from '../db';
import { ZaloSyncProvider } from './ZaloSyncProvider';
import type { ZaloContent } from './ZaloContent';

const PLATFORM = 'zalo';
const CONFLICT_KEY = 'platform,content_code,assignee_name';
const BATCH_SIZE = 500;
const ATOMIC_UPSERT_MAX = 5000;

const SIG_FIELDS = ['title', 'content_format', 'current_status', 'upload_date', 'upload_date_real', 'test_date', 'test_date_real'] as const;

export interface ZaloSyncResult {
  platform: string;
  status: 'success' | 'partial' | 'failed';
  rowsRead: number; deduped: number; invalid: number;
  inserted: number; updated: number; unchanged: number; pruned: number; errors: number;
  durationMs: number; startedAt: string; finishedAt: string;
  errorDetails: { stage: string; message: string }[]; logId: number | string | null; atomic: boolean;
}

type Logger = (m: string) => void;
const noop: Logger = () => {};

const keyOf = (r: { content_code: string; assignee_name: string }) => `${r.content_code}||${r.assignee_name}`;
const signatureOf = (r: Record<string, any>) => SIG_FIELDS.map((f) => (r[f] == null ? '' : String(r[f]))).join('␟');

function validate(r: ZaloContent): string | null {
  if (!r.content_code) return 'thiếu content_code';
  return null;
}
function toRow(r: ZaloContent): Record<string, any> {
  return {
    platform: PLATFORM,
    content_code: r.content_code,
    title: r.title ?? '',
    assignee_name: r.assignee_name ?? '',
    content_format: r.content_format,
    current_status: r.current_status ?? '',
    upload_date: r.upload_date ?? '',
    upload_date_real: r.upload_date_real,
    test_date: r.test_date ?? '',
    test_date_real: r.test_date_real,
    updated_at: new Date().toISOString(),
  };
}

export interface RunZaloOpts { source?: string; prune?: boolean; logger?: Logger }

/** ============================================================
 * ZaloContentSyncService (ZALO-04) — dịch vụ đồng bộ Content Zalo.
 * Đọc ĐỒNG THỜI Sheet Video + Banner (qua ZaloSyncProvider) → merge → upsert Supabase.
 * ĐỘC LẬP hoàn toàn với ContentSyncService của Facebook.
 * ========================================================== */
export class ZaloContentSyncService {
  /** Chạy 1 lần đồng bộ. `source`: 'manual-cli' | 'webhook' | 'scheduler'. */
  sync(opts: RunZaloOpts = {}): Promise<ZaloSyncResult> {
    return runZaloSync(opts);
  }
}
export const zaloContentSyncService = new ZaloContentSyncService();

export async function runZaloSync(opts: RunZaloOpts = {}): Promise<ZaloSyncResult> {
  const source = opts.source ?? 'manual';
  const logger = opts.logger ?? noop;
  const startedAt = new Date();
  const t0 = Date.now();
  const errorDetails: { stage: string; message: string }[] = [];
  const db: SupabaseClient = createSupa();

  // B1) Đọc Sheet Zalo
  const raw = await new ZaloSyncProvider().fetchRecords();
  const rowsRead = raw.length;

  // B2) Validate + dedupe (last-wins)
  let invalid = 0;
  const dedup = new Map<string, ZaloContent>();
  for (const rec of raw) {
    if (validate(rec)) { invalid++; continue; }
    dedup.set(keyOf(rec), rec);
  }
  const records = [...dedup.values()];
  const validKeys = new Set(dedup.keys());
  logger(`Đọc Sheet Zalo: ${rowsRead} dòng · hợp lệ+dedupe ${records.length} · loại ${invalid}`);

  // B3) Nạp bản ghi hiện có (platform='zalo')
  const existing = new Map<string, { id: string; sig: string }>();
  {
    const pageSize = 1000;
    const cols = ['id', 'content_code', 'assignee_name', ...SIG_FIELDS].join(', ');
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db.from('platform_contents').select(cols).eq('platform', PLATFORM).range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const d of data as any[]) existing.set(keyOf(d), { id: d.id, sig: signatureOf(d) });
      if (data.length < pageSize) break;
    }
  }

  // B4) Diff
  const toWrite: Record<string, any>[] = [];
  let inserted = 0, updated = 0, unchanged = 0;
  for (const rec of records) {
    const cur = existing.get(keyOf(rec));
    const row = toRow(rec);
    if (!cur) { toWrite.push(row); inserted++; }
    else if (cur.sig !== signatureOf(row)) { toWrite.push(row); updated++; }
    else unchanged++;
  }
  logger(`So sánh: mới ${inserted} · đổi ${updated} · giữ ${unchanged} → ghi ${toWrite.length}`);

  // B5) Upsert
  let errors = 0, atomic = false;
  if (toWrite.length > 0) {
    if (toWrite.length <= ATOMIC_UPSERT_MAX) {
      atomic = true;
      const { error } = await db.from('platform_contents').upsert(toWrite, { onConflict: CONFLICT_KEY, ignoreDuplicates: false });
      if (error) { errors = toWrite.length; errorDetails.push({ stage: 'upsert', message: error.message }); logger(`  ✗ Upsert lỗi: ${error.message}`); }
    } else {
      for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
        const batch = toWrite.slice(i, i + BATCH_SIZE);
        const { error } = await db.from('platform_contents').upsert(batch, { onConflict: CONFLICT_KEY, ignoreDuplicates: false });
        if (error) { errors += batch.length; errorDetails.push({ stage: `upsert:${i / BATCH_SIZE}`, message: error.message }); }
      }
    }
  }

  // B6) Prune orphan (guard an toàn)
  let pruned = 0;
  const pruneEnabled = opts.prune != null ? opts.prune : (process.env.ZALO_SYNC_PRUNE_STALE ?? 'true').trim().toLowerCase() !== 'false';
  if (!pruneEnabled) {
    logger('ℹ️  Prune tắt.');
  } else if (errors > 0) {
    logger('⚠️  Upsert có lỗi → BỎ QUA prune.');
  } else if (records.length === 0) {
    logger('⚠️  Sheet đọc 0 bản ghi → BỎ QUA prune (nghi ngờ lỗi đọc/cấu hình).');
  } else {
    const dbRows: { id: string; key: string }[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db.from('platform_contents').select('id, content_code, assignee_name').eq('platform', PLATFORM).range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const d of data as any[]) dbRows.push({ id: d.id, key: keyOf(d) });
      if (data.length < pageSize) break;
    }
    const staleIds = dbRows.filter((r) => !validKeys.has(r.key)).map((r) => r.id);
    const cap = Math.max(50, Math.floor(dbRows.length * 0.5));
    if (staleIds.length > cap) {
      logger(`⚠️  Orphan ${staleIds.length} > ngưỡng ${cap} → BỎ QUA prune (rà tay).`);
    } else if (staleIds.length > 0) {
      for (let i = 0; i < staleIds.length; i += 25) {
        const { error, count } = await db.from('platform_contents').delete({ count: 'exact' }).in('id', staleIds.slice(i, i + 25));
        if (error) { errorDetails.push({ stage: 'prune', message: error.message }); break; }
        pruned += count ?? 0;
      }
      logger(`🧹 Prune: xoá ${pruned} orphan.`);
    }
  }

  const finishedAt = new Date();
  const durationMs = Date.now() - t0;
  const status: ZaloSyncResult['status'] = errors === 0 ? 'success' : (errors < toWrite.length ? 'partial' : 'failed');

  // B7) Ghi log
  let logId: number | string | null = null;
  try {
    const { data, error } = await db.from('platform_sync_logs').insert({
      platform: PLATFORM, source,
      started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
      rows_read: rowsRead, rows_inserted: inserted, rows_updated: updated,
      rows_unchanged: unchanged, rows_pruned: pruned, duration_ms: durationMs,
      status, error_message: errorDetails.length ? JSON.stringify(errorDetails) : null,
    }).select('id').single();
    if (!error && data) logId = (data as any).id ?? null;
    else if (error) logger(`⚠️  Không ghi được platform_sync_logs: ${error.message}`);
  } catch (e: any) { logger(`⚠️  Log lỗi: ${e?.message ?? e}`); }

  return {
    platform: PLATFORM, status, rowsRead, deduped: records.length, invalid,
    inserted, updated, unchanged, pruned, errors,
    durationMs, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
    errorDetails, logId, atomic,
  };
}
