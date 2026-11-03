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

/* ============================================================
 * GIỚI HẠN ĐỘ DÀI CỘT (khớp schema Postgres thật, đã đọc từ bảng — KHÔNG đoán)
 * ------------------------------------------------------------
 * Postgres từ chối giá trị dài hơn varchar(n) bằng lỗi
 *   "value too long for type character varying(n)"
 * và lỗi đó làm CHẾT CẢ LỆNH upsert, không chỉ dòng sai.
 *
 * SỰ CỐ THẬT (24/10 → 03/11/2026): ô "ID content 1" tại `NĐ Liên`!C177 bị dán một
 * link reel Facebook dài 280 ký tự. content_code là varchar(100)
 * nên mỗi đêm cả lô 415 bản ghi bị từ chối → dashboard đứng ở ngày 23/10 suốt 10 ngày
 * mà không ai biết, vì trang vẫn hiện số (số cũ).
 *
 * Từ nay: cột KHOÁ quá dài → LOẠI đúng bản ghi đó + ghi rõ lý do vào sync_logs.
 *         cột MỀM quá dài → CẮT bớt, vẫn giữ content (thà mất phần đuôi ghi chú
 *         hơn là mất cả content).
 * ========================================================== */
const MAX_LEN: Record<string, number> = {
  content_code: 100, market: 10, assignee_name: 100,
  cgsd: 100, editor_name: 100, current_status: 50,
};
/** Cột khoá/nhận dạng — quá dài thì KHÔNG lưu được, phải loại bản ghi. */
const KEY_LIMITED = ['content_code', 'market', 'assignee_name'] as const;
/** Cột mềm — quá dài thì cắt, KHÔNG loại bản ghi. */
const SOFT_LIMITED = ['cgsd', 'editor_name', 'current_status'] as const;

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
  /** Lý do loại từng bản ghi (ô nào trên Sheet cần sửa) — để báo ra log/sync_logs. */
  invalidDetails: string[];
  /** Mô tả các ô cột mềm bị cắt vì quá dài. */
  clampedDetails: string[];
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
export function validateRecord(r: ContentRecord): string | null {
  if (!r.content_code) return 'thiếu content_code';
  if (r.market !== 'noi_dia' && r.market !== 'quoc_te') return `market không hợp lệ: "${r.market}"`;
  if (!r.assignee_name) return 'thiếu assignee_name';
  // Quá dài ở cột khoá → Postgres từ chối CẢ LỆNH upsert, nên phải loại tại đây.
  for (const f of KEY_LIMITED) {
    const v = String((r as any)[f] ?? '');
    if (v.length > MAX_LEN[f]) {
      return `${f} dài ${v.length} ký tự, vượt giới hạn ${MAX_LEN[f]} — sửa ô này trên Sheet: "${v.slice(0, 60)}…"`;
    }
  }
  return null;
}

/**
 * Cắt các cột MỀM quá dài. Trả mô tả nếu có cắt, null nếu không.
 * Cắt chứ không loại: mất phần đuôi của một ghi chú vẫn tốt hơn mất cả content.
 */
export function clampSoftFields(r: ContentRecord): string | null {
  const cut: string[] = [];
  for (const f of SOFT_LIMITED) {
    const v = String((r as any)[f] ?? '');
    if (v.length > MAX_LEN[f]) {
      (r as any)[f] = v.slice(0, MAX_LEN[f]);
      cut.push(`${f} ${v.length}→${MAX_LEN[f]}`);
    }
  }
  return cut.length ? `${r.assignee_name}/${r.market} "${r.content_code.slice(0, 40)}": ${cut.join(', ')}` : null;
}

/**
 * Upsert chịu lỗi: thử ghi cả mảng trong 1 lệnh; nếu Postgres từ chối thì CHIA ĐÔI
 * và thử lại, đệ quy tới từng bản ghi. Nhờ vậy một dòng bẩn chỉ làm mất chính nó,
 * không kéo cả lô xuống như sự cố 24/10/2026.
 * Trả về: số bản ghi ghi được + danh sách bản ghi lỗi kèm thông báo của Postgres.
 */
export async function upsertResilient(
  db: SupabaseClient,
  rows: ContentRecord[],
  logger: Logger,
): Promise<{ written: number; failed: { rec: ContentRecord; message: string }[]; calls: number }> {
  let calls = 0;
  const failed: { rec: ContentRecord; message: string }[] = [];

  const run = async (batch: ContentRecord[]): Promise<number> => {
    if (!batch.length) return 0;
    calls++;
    const { error } = await db.from('contents').upsert(batch, { onConflict: CONFLICT_KEY, ignoreDuplicates: false });
    if (!error) return batch.length;
    if (batch.length === 1) {
      failed.push({ rec: batch[0], message: error.message });
      logger(`  ✗ Bỏ qua 1 bản ghi lỗi: ${batch[0].assignee_name}/${batch[0].market} "${batch[0].content_code.slice(0, 50)}" → ${error.message}`);
      return 0;
    }
    const mid = Math.floor(batch.length / 2);
    return (await run(batch.slice(0, mid))) + (await run(batch.slice(mid)));
  };

  const written = await run(rows);
  return { written, failed, calls };
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
  const invalidDetails: string[] = [];
  const clampedDetails: string[] = [];
  const dedup = new Map<string, ContentRecord>();
  for (const rec of raw) {
    const err = validateRecord(rec);
    if (err) {
      invalid++;
      // Giữ tối đa 20 lý do — đủ để biết sửa ô nào, không làm phình sync_logs.
      if (invalidDetails.length < 20) invalidDetails.push(`${rec.assignee_name || '?'}/${rec.market || '?'}: ${err}`);
      continue;
    }
    const cut = clampSoftFields(rec);
    if (cut && clampedDetails.length < 20) clampedDetails.push(cut);
    dedup.set(keyOf(rec), rec);
  }
  const records = [...dedup.values()];
  const validKeys = new Set(dedup.keys());
  logger(`Đọc Sheet: ${rowsRead} dòng · hợp lệ+dedupe: ${records.length} · loại: ${invalid}`);
  if (invalidDetails.length) {
    logger(`⚠️  ${invalid} dòng bị loại — cần sửa trên Sheet:`);
    invalidDetails.forEach((d) => logger(`     • ${d}`));
  }
  if (clampedDetails.length) {
    logger(`⚠️  ${clampedDetails.length} ô cột mềm bị cắt vì quá dài:`);
    clampedDetails.forEach((d) => logger(`     • ${d}`));
  }

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

  // ---- B5) Upsert chịu lỗi: 1 lệnh khi tập nhỏ, chia đôi khi bị từ chối ----
  // Trước đây tập ≤ ATOMIC_UPSERT_MAX ghi trong ĐÚNG 1 lệnh, nên 1 dòng bẩn = mất cả lô
  // (sự cố 24/10/2026). Nay vẫn 1 lệnh ở đường happy-path, chỉ chia đôi khi có lỗi.
  let errors = 0;
  let atomic = false;
  if (toWrite.length > 0) {
    const batches = toWrite.length <= ATOMIC_UPSERT_MAX
      ? [toWrite]
      : Array.from({ length: Math.ceil(toWrite.length / BATCH_SIZE) }, (_, i) => toWrite.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE));
    let calls = 0;
    for (const b of batches) {
      const r = await upsertResilient(db, b, logger);
      calls += r.calls;
      errors += r.failed.length;
      r.failed.slice(0, 20).forEach((f) => errorDetails.push({
        stage: 'upsert',
        message: `${f.rec.assignee_name}/${f.rec.market} "${f.rec.content_code.slice(0, 50)}": ${f.message}`,
      }));
    }
    // atomic = ghi trọn tập trong đúng 1 lệnh (không phải chia đôi lần nào).
    atomic = batches.length === 1 && calls === 1;
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
  // invalid > 0 nghĩa là Sheet có ô cần sửa → KHÔNG báo 'success' để không ai bỏ lọt.
  const status: SyncResult['status'] =
    errors >= toWrite.length && toWrite.length > 0 ? 'failed'
      : (errors > 0 || invalid > 0) ? 'partial'
        : 'success';

  // ---- B7) Ghi log ----
  const parts: string[] = [];
  if (errorDetails.length) parts.push(`${errors} errors: ${JSON.stringify(errorDetails)}`);
  if (invalidDetails.length) parts.push(`${invalid} invalid: ${JSON.stringify(invalidDetails)}`);
  if (clampedDetails.length) parts.push(`${clampedDetails.length} clamped: ${JSON.stringify(clampedDetails)}`);
  const errMsg = parts.length ? parts.join(' | ').slice(0, 4000) : null;
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
    source, status, rowsRead, deduped: records.length, invalid, invalidDetails, clampedDetails,
    inserted, updated: updatedCount, unchanged, pruned, errors,
    durationMs, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
    errorDetails, logId, atomic,
  };
}
