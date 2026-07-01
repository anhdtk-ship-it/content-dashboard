import 'dotenv/config';
import { google, sheets_v4 } from 'googleapis';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { parseDdmmToReal } from '../date-util';
import { createGoogleAuth } from '../google-auth';

/* ============================================================
 * ContentSyncService (PHASE 12)
 * ------------------------------------------------------------
 * Nguồn DUY NHẤT của logic Sync Content (Google Sheet → Supabase).
 * Dùng chung cho: CLI (`npm run sync`), Scheduler (P4) và Webhook
 * auto-sync (Phase 12). Library-safe: KHÔNG gọi process.exit().
 *
 * Điểm mới so với sync cũ:
 *  - So sánh SIGNATURE từng bản ghi → CHỈ upsert bản ghi THAY ĐỔI
 *    (bỏ qua bản ghi giống hệt) → ít ghi, mở rộng tốt tới ~50k dòng.
 *  - Validate dữ liệu trước khi ghi (loại bản ghi thiếu khóa).
 *  - Upsert 1 lần (atomic) khi tập thay đổi nhỏ → không "ghi dở dang";
 *    lô hoá chỉ khi tập thay đổi rất lớn (bulk lần đầu).
 *
 * KHÔNG liên quan Ads Monitor (module Ads giữ nguyên hoàn toàn).
 * ========================================================== */

export const TARGET_SHEETS = [
  'NĐ Hiếu', 'QT Hiếu', 'NĐ Ánh', 'QT Ánh',
  'NĐ KA', 'QT KA', 'NĐ Liên', 'QT Liên',
];
const CONFLICT_KEY = 'content_code,market,assignee_name';
const BATCH_SIZE = 500;
/** Nếu số bản ghi cần ghi ≤ ngưỡng này → upsert 1 lần (1 câu lệnh = atomic). */
const ATOMIC_UPSERT_MAX = 5000;

/** Các cột "mềm" mà Sync ghi đè — dùng để so sánh thay đổi (KHÔNG gồm title: Sync không đọc title). */
const SIG_FIELDS = [
  'cgsd', 'editor_name', 'trello_link',
  'upload_date', 'upload_date_real',
  'current_status', 'test_date', 'test_date_real',
] as const;

export interface ContentRecord {
  content_code: string;
  market: string;
  assignee_name: string;
  cgsd: string;
  editor_name: string;
  trello_link: string;
  upload_date: string;
  upload_date_real: string | null;
  current_status: string;
  test_date: string;
  test_date_real: string | null;
}

export interface SyncResult {
  source: string;
  status: 'success' | 'partial' | 'failed';
  rowsRead: number;      // số dòng đọc được từ Sheet (có content_code)
  deduped: number;       // sau khử trùng khóa
  invalid: number;       // bản ghi bị loại do validate
  inserted: number;
  updated: number;
  unchanged: number;     // bản ghi giống hệt → KHÔNG ghi
  pruned: number;
  errors: number;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  errorDetails: { stage: string; message: string }[];
  logId: number | string | null;
  atomic: boolean;       // true nếu upsert trong 1 câu lệnh
}

type Logger = (m: string) => void;
const noop: Logger = () => {};

/* ============================================================
 * Helpers đọc Sheet (nguồn gốc: sync-all-content.ts, gom về đây)
 * ========================================================== */
function isEmptyRow(row: string[]): boolean {
  return !row || row.every((c) => (c ?? '').toString().trim() === '');
}
function cell(row: string[], idx: number): string {
  return idx < 0 ? '' : (row[idx] ?? '').toString().trim();
}
function parseSheetName(name: string): { market: string; assignee: string } {
  const t = name.trim();
  if (/^QT(\s+|$)/i.test(t)) return { market: 'quoc_te', assignee: t.replace(/^QT/i, '').trim() };
  if (/^NĐ(\s+|$)/i.test(t)) return { market: 'noi_dia', assignee: t.replace(/^NĐ/i, '').trim() };
  return { market: '', assignee: '' };
}
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.some((c) => (c ?? '').toString().trim().toUpperCase() === 'STT')) return i;
  }
  return -1;
}
function colIndex(header: string[], name: string): number {
  const target = name.trim().toLowerCase();
  return header.findIndex((c) => (c ?? '').toString().trim().toLowerCase() === target);
}

export function keyOf(r: { content_code: string; market: string; assignee_name: string }): string {
  return `${r.content_code}||${r.market}||${r.assignee_name}`;
}
/** Chữ ký của các cột mềm — để phát hiện thay đổi. null/undefined coi như ''. */
function signatureOf(r: Record<string, any>): string {
  return SIG_FIELDS.map((f) => (r[f] == null ? '' : String(r[f]))).join('␟');
}

function transformSheet(sheetTarget: string, values: string[][]): ContentRecord[] {
  const { market, assignee } = parseSheetName(sheetTarget);
  const headerIdx = findHeaderRowIndex(values);
  if (headerIdx === -1) return [];
  const header = values[headerIdx];
  const idx = {
    code: colIndex(header, 'ID content 1'),
    cgsd: colIndex(header, 'CGSĐ'),
    editor: colIndex(header, 'Biên tập'),
    trello: colIndex(header, 'Link trello'),
    upload: colIndex(header, 'Ngày up trello'),
    status: colIndex(header, 'Trạng thái ads'),
    test: colIndex(header, 'Ngày test'),
  };
  const out: ContentRecord[] = [];
  for (const row of values.slice(headerIdx + 1)) {
    if (isEmptyRow(row)) continue;
    const content_code = cell(row, idx.code);
    if (!content_code) continue;
    const upload_date = cell(row, idx.upload);
    const test_date = cell(row, idx.test);
    out.push({
      content_code,
      market,
      assignee_name: assignee,
      cgsd: cell(row, idx.cgsd),
      editor_name: cell(row, idx.editor),
      trello_link: cell(row, idx.trello),
      upload_date,
      upload_date_real: parseDdmmToReal(upload_date),
      current_status: cell(row, idx.status),
      test_date,
      test_date_real: parseDdmmToReal(test_date),
    });
  }
  return out;
}

/** B1. Đọc toàn bộ 8 sheet Content → ContentRecord[] (chưa dedupe/validate). */
export async function readContentSheet(): Promise<ContentRecord[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error('Thiếu GOOGLE_SHEET_ID trong .env');

  const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const titles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? '');
  const resolved = TARGET_SHEETS.map((t) => {
    const actual = titles.find((x) => x.trim() === t.trim());
    if (!actual) throw new Error(`Không tìm thấy sheet "${t}"`);
    return { target: t, actual };
  });

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: resolved.map((r) => `'${r.actual.replace(/'/g, "''")}'`),
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const valueRanges = res.data.valueRanges ?? [];

  const raw: ContentRecord[] = [];
  resolved.forEach((r, i) => {
    raw.push(...transformSheet(r.target, (valueRanges[i]?.values ?? []) as string[][]));
  });
  return raw;
}

/** B2. Validate 1 bản ghi. Trả lỗi (string) nếu không hợp lệ, hoặc null nếu OK. */
function validateRecord(r: ContentRecord): string | null {
  if (!r.content_code) return 'thiếu content_code';
  if (r.market !== 'noi_dia' && r.market !== 'quoc_te') return `market không hợp lệ: "${r.market}"`;
  if (!r.assignee_name) return 'thiếu assignee_name';
  return null;
}

function supa(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) throw new Error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/* ============================================================
 * Ghi sync_logs — thử payload đầy đủ (source/duration/…); nếu cột
 * chưa tồn tại (migration 007 chưa chạy) → fallback payload tối thiểu
 * (đúng schema hiện tại). Log không được làm hỏng quá trình Sync.
 * ========================================================== */
async function writeLog(
  db: SupabaseClient,
  full: Record<string, any>,
  minimal: Record<string, any>,
  logger: Logger,
): Promise<number | string | null> {
  try {
    const { data, error } = await db.from('sync_logs').insert(full).select('id').single();
    if (!error && data) return (data as any).id ?? null;
    // Cột mở rộng chưa có → thử payload tối thiểu.
    const { data: d2, error: e2 } = await db.from('sync_logs').insert(minimal).select('id').single();
    if (e2) { logger(`⚠️  Không ghi được sync_logs: ${e2.message}`); return null; }
    logger('ℹ️  sync_logs: dùng payload tối thiểu (migration 007 chưa áp dụng → thiếu source/duration_ms).');
    return d2 ? (d2 as any).id ?? null : null;
  } catch (e: any) {
    logger(`⚠️  Không ghi được sync_logs: ${e?.message ?? e}`);
    return null;
  }
}

/* ============================================================
 * runContentSync — toàn bộ pipeline
 * ========================================================== */
export interface RunOpts {
  source?: string;              // 'manual-cli' | 'scheduler' | 'webhook' | ...
  prune?: boolean;              // ghi đè SYNC_PRUNE_STALE nếu set
  logger?: Logger;
}

export async function runContentSync(opts: RunOpts = {}): Promise<SyncResult> {
  const source = opts.source ?? 'manual';
  const logger = opts.logger ?? noop;
  const startedAt = new Date();
  const t0 = Date.now();
  const errorDetails: { stage: string; message: string }[] = [];

  const db = supa();

  // ---- B1) Đọc Sheet ----
  const raw = await readContentSheet();
  const rowsRead = raw.length;

  // ---- B2) Validate + dedupe (last-wins) ----
  let invalid = 0;
  const dedup = new Map<string, ContentRecord>();
  for (const rec of raw) {
    const err = validateRecord(rec);
    if (err) { invalid++; continue; }
    dedup.set(keyOf(rec), rec);
  }
  const records = [...dedup.values()];
  const validKeys = new Set(dedup.keys());
  logger(`Đọc Sheet: ${rowsRead} dòng · hợp lệ+dedupe: ${records.length} · loại: ${invalid}`);

  // ---- B3) Nạp bản ghi hiện có (id + khóa + cột mềm) để so sánh ----
  const existing = new Map<string, { id: number; sig: string }>();
  {
    const pageSize = 1000;
    const cols = ['id', 'content_code', 'market', 'assignee_name', ...SIG_FIELDS].join(', ');
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db.from('contents').select(cols).range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const d of data as any[]) existing.set(keyOf(d), { id: d.id, sig: signatureOf(d) });
      if (data.length < pageSize) break;
    }
  }

  // ---- B4) So sánh → CHỈ lấy bản ghi mới hoặc đã đổi ----
  const toWrite: ContentRecord[] = [];
  let inserted = 0, updatedCount = 0, unchanged = 0;
  for (const rec of records) {
    const cur = existing.get(keyOf(rec));
    if (!cur) { toWrite.push(rec); inserted++; }
    else if (cur.sig !== signatureOf(rec)) { toWrite.push(rec); updatedCount++; }
    else unchanged++;
  }
  logger(`So sánh: mới ${inserted} · đổi ${updatedCount} · giữ nguyên ${unchanged} → ghi ${toWrite.length} bản ghi.`);

  // ---- B5) Upsert (atomic 1 lần khi tập nhỏ; lô hoá khi bulk lớn) ----
  let errors = 0;
  let atomic = false;
  if (toWrite.length > 0) {
    if (toWrite.length <= ATOMIC_UPSERT_MAX) {
      atomic = true;
      const { error } = await db.from('contents').upsert(toWrite, { onConflict: CONFLICT_KEY, ignoreDuplicates: false });
      if (error) { errors = toWrite.length; errorDetails.push({ stage: 'upsert', message: error.message }); logger(`  ✗ Upsert atomic lỗi: ${error.message}`); }
    } else {
      for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
        const batch = toWrite.slice(i, i + BATCH_SIZE);
        const { error } = await db.from('contents').upsert(batch, { onConflict: CONFLICT_KEY, ignoreDuplicates: false });
        if (error) { errors += batch.length; errorDetails.push({ stage: `upsert:${i / BATCH_SIZE}`, message: error.message }); logger(`  ✗ Lô ${i / BATCH_SIZE}: ${error.message}`); }
      }
    }
  }

  // ---- B6) Khử trùng (prune) — GIỮ NGUYÊN guard an toàn của bản cũ ----
  let pruned = 0;
  const pruneEnabled = opts.prune != null
    ? opts.prune
    : (process.env.SYNC_PRUNE_STALE ?? 'true').trim().toLowerCase() !== 'false';
  if (!pruneEnabled) {
    logger('ℹ️  Prune tắt → bỏ qua khử trùng.');
  } else if (errors > 0) {
    logger('⚠️  Upsert có lỗi → BỎ QUA khử trùng (tránh xóa khi sync chưa trọn vẹn).');
  } else if (records.length < 1000) {
    logger(`⚠️  Chỉ đọc được ${records.length} content (< 1000) → BỎ QUA khử trùng (nghi ngờ đọc Sheet lỗi).`);
  } else {
    const dbRows: { id: number; key: string }[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await db.from('contents').select('id, content_code, market, assignee_name').range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const d of data as any[]) dbRows.push({ id: d.id, key: keyOf(d) });
      if (data.length < pageSize) break;
    }
    const staleIds = dbRows.filter((r) => !validKeys.has(r.key)).map((r) => r.id);
    const cap = Math.max(200, Math.floor(dbRows.length * 0.3));
    if (staleIds.length > cap) {
      logger(`⚠️  Số mồ côi ${staleIds.length} > ngưỡng an toàn ${cap} → BỎ QUA khử trùng (cần rà tay).`);
    } else if (staleIds.length > 0) {
      for (let i = 0; i < staleIds.length; i += 25) {
        const batch = staleIds.slice(i, i + 25);
        const { error, count } = await db.from('contents').delete({ count: 'exact' }).in('id', batch);
        if (error) { errorDetails.push({ stage: 'prune', message: error.message }); logger(`  ✗ Prune lô ${i / 25}: ${error.message}`); break; }
        pruned += count ?? 0;
      }
      logger(`🧹 Khử trùng: đã xóa ${pruned} content mồ côi.`);
    } else {
      logger('🧹 Khử trùng: không có content mồ côi.');
    }
  }

  const finishedAt = new Date();
  const durationMs = Date.now() - t0;
  const status: SyncResult['status'] = errors === 0 ? 'success' : (errors < toWrite.length ? 'partial' : 'failed');

  // ---- B7) Ghi log ----
  const errMsg = errorDetails.length ? `${errors} errors: ${JSON.stringify(errorDetails)}` : null;
  const minimal = {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    rows_read: rowsRead,
    rows_inserted: inserted,
    rows_updated: updatedCount,
    status,
    error_message: errMsg,
  };
  const full = { ...minimal, source, rows_unchanged: unchanged, rows_pruned: pruned, duration_ms: durationMs };
  const logId = await writeLog(db, full, minimal, logger);

  return {
    source, status, rowsRead, deduped: records.length, invalid,
    inserted, updated: updatedCount, unchanged, pruned, errors,
    durationMs, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
    errorDetails, logId, atomic,
  };
}
