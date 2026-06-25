import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseDdmmToReal } from './date-util';

/**
 * Backfill upload_date_real / test_date_real cho toàn bộ contents hiện có.
 * - Đọc upload_date / test_date (TEXT) -> parse -> DATE.
 * - Không hợp lệ -> NULL.
 * - KHÔNG đụng các cột khác (không mất dữ liệu cũ).
 * Yêu cầu: đã chạy migration 004_date_real.sql.
 */
async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) throw new Error('Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env');

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 0) Tiền kiểm tra: cột *_real đã tồn tại chưa (migration 004)
  {
    const { error } = await supabase.from('contents').select('upload_date_real, test_date_real').limit(1);
    if (error) {
      throw new Error('Bảng chưa có cột upload_date_real/test_date_real. Hãy chạy sql/004_date_real.sql trước, rồi chạy lại backfill.');
    }
  }

  // 1) Đọc toàn bộ (chỉ các cột cần)
  const rows: { id: number; upload_date: string | null; test_date: string | null }[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('contents')
      .select('id, upload_date, test_date')
      .range(from, from + pageSize - 1);
    if (error) {
      if (/upload_date_real|test_date_real/.test(error.message)) {
        throw new Error('Bảng chưa có cột *_real. Hãy chạy sql/004_date_real.sql trước.');
      }
      throw error;
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as any[]));
    if (data.length < pageSize) break;
  }

  console.log(`Đọc ${rows.length} dòng. Bắt đầu backfill...`);

  let updated = 0, uploadParsed = 0, testParsed = 0, uploadNull = 0, testNull = 0, errors = 0;
  const CONCURRENCY = 25;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const slice = rows.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map(async (r) => {
      const upReal = parseDdmmToReal(r.upload_date);
      const tsReal = parseDdmmToReal(r.test_date);
      upReal ? uploadParsed++ : uploadNull++;
      tsReal ? testParsed++ : testNull++;
      const { error } = await supabase
        .from('contents')
        .update({ upload_date_real: upReal, test_date_real: tsReal })
        .eq('id', r.id);
      if (error) {
        errors++;
        if (errors <= 5) console.error(`  ✗ id=${r.id}: ${error.message}`);
      } else {
        updated++;
      }
    }));
    process.stdout.write(`\r  Đã xử lý ${Math.min(i + CONCURRENCY, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');

  console.log('\n================ BACKFILL RESULT ================');
  console.log(`Rows scanned        : ${rows.length}`);
  console.log(`Updated             : ${updated}`);
  console.log(`Errors              : ${errors}`);
  console.log(`upload_date_real ✓  : ${uploadParsed}   (NULL: ${uploadNull})`);
  console.log(`test_date_real   ✓  : ${testParsed}   (NULL: ${testNull})`);
  console.log('================================================');
}

main().catch((e) => {
  console.error('❌ Lỗi:', e instanceof Error ? e.message : e);
  process.exit(1);
});
