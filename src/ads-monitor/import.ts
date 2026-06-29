/* Ads Monitor — PHASE 5: Import Google Sheet → Supabase (bảng ads_monitor) — LƯU LỊCH SỬ THEO NGÀY.
 * Idempotent theo khóa SNAPSHOT (page_code, content, sheet_date):
 *   - Import lại CÙNG ngày  → update đúng dòng ngày đó (không nhân đôi).
 *   - Ngày KHÁC             → dòng mới → GIỮ lịch sử, KHÔNG ghi đè ngày trước.
 * Status KHÔNG import — tính ở tầng app bằng calculateAdsStatus().
 * Chạy: `npm run ads:import` (ghi DB) hoặc `npm run ads:import -- --dry-run` (chỉ đọc+map+log).
 * Lỗi Sheet → log + thoát, KHÔNG ảnh hưởng Dashboard/Server (script riêng). */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleSheetAdsSyncProvider } from './GoogleSheetAdsSyncProvider';
import type { AdsMonitorRecord } from './types';

// PHASE 5: khóa snapshot theo ngày → giữ lịch sử thay vì ghi đè.
const CONFLICT_KEY = 'page_code,content,sheet_date';
const BATCH = 500;
// Ngày chạy import (fallback khi dòng Sheet không có cột Ngày) — mọi dòng cùng lần import dùng chung 1 ngày.
const RUN_DATE = new Date().toISOString().slice(0, 10);
const sheetDateOf = (r: AdsMonitorRecord) => r.sheet_date ?? RUN_DATE;
const keyOf = (r: AdsMonitorRecord) => `${r.page_code}||${r.content}||${sheetDateOf(r)}`;

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const provider = new GoogleSheetAdsSyncProvider();

  // (6) Error handling: lỗi đọc Sheet → KHÔNG crash, log rõ ràng.
  let records: AdsMonitorRecord[];
  try {
    records = await provider.fetchRecords();
  } catch (e: any) {
    console.error('❌ Lỗi đọc Google Sheet Ads:', e?.message ?? e);
    console.error('   → Bỏ qua import. Dashboard/Server KHÔNG bị ảnh hưởng (đây là script độc lập).');
    process.exit(1);
  }

  const read = records.length;
  // Dedupe theo khóa snapshot (last-wins) → không tạo duplicate trong cùng ngày.
  const dmap = new Map<string, AdsMonitorRecord>();
  let skip = 0;
  for (const r of records) { if (dmap.has(keyOf(r))) skip++; dmap.set(keyOf(r), r); }
  const unique = [...dmap.values()];

  if (dryRun) {
    console.log('================ ADS IMPORT (DRY-RUN — không ghi DB) ================');
    console.log(`Read   : ${read}  (unique: ${unique.length} · trùng bỏ: ${skip})`);
    console.log('Ví dụ 3 dòng đã map (status sẽ tính ở tầng app, không lưu):');
    unique.slice(0, 3).forEach((r) => console.log('  ', JSON.stringify(r)));
    console.log('====================================================================');
    return;
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supa = createClient(url, key, { auth: { persistSession: false } });

  // Pre-fetch khóa snapshot hiện có → phân loại insert/update (chỉ lấy snapshot của các ngày đang import).
  const days = [...new Set(unique.map(sheetDateOf))];
  const existing = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from('ads_monitor').select('page_code, content, sheet_date')
      .in('sheet_date', days).range(from, from + 999);
    if (error) throw error;
    if (!data || !data.length) break;
    for (const d of data as any[]) existing.add(`${d.page_code}||${d.content}||${d.sheet_date}`);
    if (data.length < 1000) break;
  }
  let inserted = unique.filter((r) => !existing.has(keyOf(r))).length;
  let updated = unique.length - inserted;

  // Payload: KHÔNG gồm id (identity) · KHÔNG created_at (giữ khi update / default khi insert) · KHÔNG status.
  // sheet_date luôn có giá trị (fallback RUN_DATE) vì là thành phần khóa snapshot.
  const payload = unique.map((r) => ({
    content: r.content, location: r.location, ads_owner: r.ads_owner,
    page_code: r.page_code, amount_spent: r.amount_spent, sheet_date: sheetDateOf(r), updated_at: r.updated_at,
  }));

  let errors = 0;
  for (let i = 0; i < payload.length; i += BATCH) {
    const batch = payload.slice(i, i + BATCH);
    const { error } = await supa.from('ads_monitor').upsert(batch, { onConflict: CONFLICT_KEY, ignoreDuplicates: false });
    if (error) { errors += batch.length; console.error(`  ✗ Lô ${i / BATCH}: ${error.message}`); }
  }
  if (errors > 0) {
    const ok = unique.length - errors; const ratio = unique.length ? ok / unique.length : 0;
    inserted = Math.round(inserted * ratio); updated = ok - inserted;
  }

  console.log('================ ADS IMPORT RESULT ================');
  console.log(`Read    : ${read}`);
  console.log(`Insert  : ${inserted}`);
  console.log(`Update  : ${updated}`);
  console.log(`Skip    : ${skip}  (dòng trùng khóa)`);
  console.log(`Errors  : ${errors}`);
  console.log(`Status  : ${errors === 0 ? 'success' : 'partial'}`);
  console.log('===================================================');
}

main().catch((e) => { console.error('❌ Import lỗi:', e instanceof Error ? e.message : e); process.exit(1); });
