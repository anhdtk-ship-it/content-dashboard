import 'dotenv/config';
import { google, sheets_v4 } from 'googleapis';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { parseDdmmToReal } from './date-util';

/* ============================================================
 * Cấu hình
 * ========================================================== */
const TARGET_SHEETS = [
  'NĐ Hiếu', 'QT Hiếu', 'NĐ Ánh', 'QT Ánh',
  'NĐ KA', 'QT KA', 'NĐ Liên', 'QT Liên',
];
const CONFLICT_KEY = 'content_code,market,assignee_name';
const BATCH_SIZE = 500;

/* ============================================================
 * Types
 * ========================================================== */
interface ContentRecord {
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

/* ============================================================
 * Helpers - Sheets
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
function keyOf(r: ContentRecord): string {
  return `${r.content_code}||${r.market}||${r.assignee_name}`;
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
      upload_date_real: parseDdmmToReal(upload_date), // tự sinh DATE từ text
      current_status: cell(row, idx.status),
      test_date,
      test_date_real: parseDdmmToReal(test_date),     // tự sinh DATE từ text
    });
  }
  return out;
}

/* ============================================================
 * Main
 * ========================================================== */
async function main(): Promise<void> {
  const startedAt = new Date();
  const t0 = Date.now();

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!spreadsheetId) throw new Error('Thiếu GOOGLE_SHEET_ID trong .env');
  if (!process.env.GOOGLE_CREDENTIALS_PATH) throw new Error('Thiếu GOOGLE_CREDENTIALS_PATH trong .env');
  if (!url || !serviceKey) throw new Error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env');

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ---- 1) Đọc 8 sheet ----
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets: sheets_v4.Sheets = google.sheets({ version: 'v4', auth });

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

  // ---- 2) Transform ----
  const raw: ContentRecord[] = [];
  resolved.forEach((r, i) => {
    raw.push(...transformSheet(r.target, (valueRanges[i]?.values ?? []) as string[][]));
  });
  const rowsRead = raw.length;

  // ---- 2b) Dedupe theo khóa (last-wins) -> không tạo trùng ----
  const dedupMap = new Map<string, ContentRecord>();
  for (const rec of raw) dedupMap.set(keyOf(rec), rec);
  const records = [...dedupMap.values()];

  // ---- 3) Pre-fetch khóa hiện có để phân loại insert/update ----
  const existing = new Set<string>();
  {
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('contents')
        .select('content_code, market, assignee_name')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const d of data as any[]) existing.add(`${d.content_code}||${d.market}||${d.assignee_name}`);
      if (data.length < pageSize) break;
    }
  }
  let inserted = records.filter((r) => !existing.has(keyOf(r))).length;
  let updated = records.length - inserted;

  // ---- 4) Upsert theo lô ----
  let errors = 0;
  const errorDetails: { batch: number; message: string }[] = [];
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('contents')
      .upsert(batch, { onConflict: CONFLICT_KEY, ignoreDuplicates: false });
    if (error) {
      errors += batch.length;
      errorDetails.push({ batch: i / BATCH_SIZE, message: error.message });
      console.error(`  ✗ Lô ${i / BATCH_SIZE}: ${error.message}`);
    }
  }
  // Nếu có lô lỗi, trừ phần lỗi khỏi inserted/updated ước tính (xấp xỉ theo tỉ lệ).
  if (errors > 0) {
    const ok = records.length - errors;
    const ratio = records.length ? ok / records.length : 0;
    inserted = Math.round(inserted * ratio);
    updated = ok - inserted;
  }

  // ---- 4b) Khử trùng: xóa content "mồ côi" — có trong DB nhưng KHÔNG còn trong Sheet ----
  // Nhiều lớp guard để TUYỆT ĐỐI không xóa nhầm khi đọc Sheet lỗi/bất thường.
  let pruned = 0;
  const pruneEnabled = (process.env.SYNC_PRUNE_STALE ?? 'true').trim().toLowerCase() !== 'false';
  if (!pruneEnabled) {
    console.log('ℹ️  SYNC_PRUNE_STALE=false → bỏ qua khử trùng.');
  } else if (errors > 0) {
    console.warn('⚠️  Upsert có lỗi → BỎ QUA khử trùng (tránh xóa khi sync chưa trọn vẹn).');
  } else if (records.length < 1000) {
    console.warn(`⚠️  Chỉ đọc được ${records.length} content (< 1000) → BỎ QUA khử trùng (nghi ngờ đọc Sheet lỗi).`);
  } else {
    const validKeys = new Set(dedupMap.keys());
    // Lấy id + khóa toàn bộ DB (sau upsert) để xác định mồ côi
    const dbRows: { id: number; key: string }[] = [];
    {
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('contents')
          .select('id, content_code, market, assignee_name')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const d of data as any[]) dbRows.push({ id: d.id, key: `${d.content_code}||${d.market}||${d.assignee_name}` });
        if (data.length < pageSize) break;
      }
    }
    const staleIds = dbRows.filter((r) => !validKeys.has(r.key)).map((r) => r.id);
    const cap = Math.max(200, Math.floor(dbRows.length * 0.3));
    if (staleIds.length > cap) {
      console.warn(`⚠️  Số mồ côi ${staleIds.length} > ngưỡng an toàn ${cap} → BỎ QUA khử trùng (cần rà tay).`);
    } else if (staleIds.length > 0) {
      for (let i = 0; i < staleIds.length; i += 25) {
        const batch = staleIds.slice(i, i + 25);
        const { error, count } = await supabase.from('contents').delete({ count: 'exact' }).in('id', batch);
        if (error) { console.error(`  ✗ Prune lô ${i / 25}: ${error.message}`); break; }
        pruned += count ?? 0;
      }
      console.log(`🧹 Khử trùng: đã xóa ${pruned} content mồ côi (không còn trong Sheet).`);
    } else {
      console.log('🧹 Khử trùng: không có content mồ côi.');
    }
  }

  const finishedAt = new Date();
  const durationMs = Date.now() - t0;
  const status = errors === 0 ? 'success' : (errors < records.length ? 'partial' : 'failed');

  // ---- 5) Ghi sync_logs (khớp schema thực tế của bảng) ----
  let logRow: any = null;
  try {
    const payload = {
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      rows_read: rowsRead,
      rows_inserted: inserted,
      rows_updated: updated,
      status,
      error_message: errors > 0 ? `${errors} errors: ${JSON.stringify(errorDetails)}` : null,
    };
    const { data, error: logErr } = await supabase.from('sync_logs').insert(payload).select().single();
    if (logErr) console.warn(`⚠️  Không ghi được sync_logs: ${logErr.message}`);
    else logRow = data;
  } catch (e: any) {
    console.warn(`⚠️  Không ghi được sync_logs: ${e?.message ?? e}`);
  }

  // ---- 6) In kết quả ----
  console.log('\n================ SYNC RESULT ================');
  console.log(`Rows Read : ${rowsRead}  (sau dedupe: ${records.length})`);
  console.log(`Inserted  : ${inserted}`);
  console.log(`Updated   : ${updated}`);
  console.log(`Pruned    : ${pruned}`);
  console.log(`Errors    : ${errors}`);
  console.log(`Duration  : ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`Status    : ${status}`);
  console.log('=============================================');

  // ---- 7) Hiển thị record vừa ghi vào sync_logs ----
  console.log('\n--- sync_logs record ---');
  console.log(logRow ? JSON.stringify(logRow, null, 2) : '(không ghi được)');
}

main().catch((e) => {
  console.error('❌ Lỗi:', e instanceof Error ? e.message : e);
  process.exit(1);
});
