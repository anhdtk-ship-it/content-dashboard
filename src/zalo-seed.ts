/* ============================================================
 * CLI seed dữ liệu DEMO Zalo vào Supabase (ZALO-02, KHÔNG dùng Google Sheet).
 *   npm run zalo:seed            → upsert dữ liệu DEMO + settings
 *   npm run zalo:seed -- --clear → XOÁ toàn bộ content Zalo (giữ settings)
 *   npm run zalo:seed -- --purge → XOÁ cả content lẫn settings Zalo
 * An toàn: chỉ tác động platform='zalo' (KHÔNG đụng dữ liệu Facebook).
 * ========================================================== */
import { createSupa } from './platform/db';
import { buildSeedRows, toContentRow, SEED_SETTINGS } from './platform/zalo/seedData';

const CONFLICT = 'platform,content_code,assignee_name';

async function clearContents() {
  const db = createSupa();
  const { error, count } = await db.from('platform_contents').delete({ count: 'exact' }).eq('platform', 'zalo');
  if (error) throw new Error(error.message);
  console.log(`🧹 Đã xoá ${count ?? 0} content Zalo.`);
}
async function clearSettings() {
  const db = createSupa();
  const { error, count } = await db.from('platform_settings').delete({ count: 'exact' }).eq('platform', 'zalo');
  if (error) throw new Error(error.message);
  console.log(`🧹 Đã xoá ${count ?? 0} settings Zalo.`);
}

async function seed() {
  const db = createSupa();
  const rows = buildSeedRows().map(toContentRow);

  // 1) Xoá sạch DEMO cũ trước (theo tiền tố) để không tồn dư khi đổi bộ dữ liệu.
  await db.from('platform_contents').delete().eq('platform', 'zalo').like('content_code', 'ZL-DEMO-%');

  // 2) Upsert content.
  const { error } = await db.from('platform_contents').upsert(rows, { onConflict: CONFLICT, ignoreDuplicates: false });
  if (error) throw new Error(`Upsert content lỗi: ${error.message}`);

  // 3) Upsert settings.
  const settingRows = SEED_SETTINGS.map((s) => ({ platform: 'zalo', key: s.key, value: s.value, updated_at: new Date().toISOString() }));
  const { error: sErr } = await db.from('platform_settings').upsert(settingRows, { onConflict: 'platform,key', ignoreDuplicates: false });
  if (sErr) throw new Error(`Upsert settings lỗi: ${sErr.message}`);

  console.log(`✅ Seed xong: ${rows.length} content DEMO + ${settingRows.length} settings (platform='zalo').`);
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--purge')) { await clearContents(); await clearSettings(); return; }
    if (args.includes('--clear')) { await clearContents(); return; }
    await seed();
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/column .*title.* does not exist|'title' column/i.test(msg)) {
      console.error("❌ Thiếu cột 'title'. Hãy chạy sql/011_zalo_title.sql trong Supabase SQL Editor, rồi seed lại.");
    } else if (/schema cache|does not exist|Could not find the table/i.test(msg)) {
      console.error('❌ Bảng chưa tồn tại. Hãy chạy sql/010_zalo.sql (và sql/011_zalo_title.sql) trong Supabase SQL Editor TRƯỚC.');
    } else {
      console.error('❌ Lỗi:', msg);
    }
    process.exit(1);
  }
}
main();
