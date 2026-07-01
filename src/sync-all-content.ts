import 'dotenv/config';
import { runContentSync } from './content-sync/ContentSyncService';

/* ============================================================
 * CLI Sync Content (`npm run sync`)
 * ------------------------------------------------------------
 * Từ PHASE 12: chỉ là lớp vỏ MỎNG gọi ContentSyncService (nguồn
 * logic Sync duy nhất, dùng chung với webhook auto-sync). Hành vi
 * CLI giữ nguyên: in kết quả + exit 0 (success/partial) / exit 1 (lỗi).
 * Scheduler (P4) spawn `npm run sync` vẫn hoạt động như cũ.
 * ========================================================== */

async function main(): Promise<void> {
  const res = await runContentSync({ source: 'manual-cli', logger: (m) => console.log(m) });

  console.log('\n================ SYNC RESULT ================');
  console.log(`Source    : ${res.source}`);
  console.log(`Rows Read : ${res.rowsRead}  (hợp lệ+dedupe: ${res.deduped}, loại: ${res.invalid})`);
  console.log(`Inserted  : ${res.inserted}`);
  console.log(`Updated   : ${res.updated}`);
  console.log(`Unchanged : ${res.unchanged}  (không ghi lại)`);
  console.log(`Pruned    : ${res.pruned}`);
  console.log(`Errors    : ${res.errors}`);
  console.log(`Atomic    : ${res.atomic}`);
  console.log(`Duration  : ${(res.durationMs / 1000).toFixed(2)}s`);
  console.log(`Status    : ${res.status}  (sync_logs id=${res.logId ?? 'n/a'})`);
  console.log('=============================================');

  if (res.status === 'failed') process.exit(1);
}

main().catch((e) => {
  console.error('❌ Lỗi:', e instanceof Error ? e.message : e);
  process.exit(1);
});
