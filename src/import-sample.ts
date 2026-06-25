import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

interface ContentRecord {
  content_code: string;
  market: string;
  assignee_name: string;
  cgsd: string;
  editor_name: string;
  trello_link: string;
  upload_date: string;
  current_status: string;
  test_date: string;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error('Thiếu SUPABASE_URL trong .env');
  if (!serviceKey) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env');

  // Đọc dữ liệu mẫu
  const inFile = path.join(process.cwd(), 'output', 'sample-import.json');
  if (!fs.existsSync(inFile)) throw new Error(`Không tìm thấy file: ${inFile}`);
  const records: ContentRecord[] = JSON.parse(fs.readFileSync(inFile, 'utf-8'));
  console.log(`Đọc ${records.length} record từ ${path.relative(process.cwd(), inFile)}\n`);

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const rec of records) {
    try {
      // Kiểm tra tồn tại theo content_code
      const { data: existing, error: selErr } = await supabase
        .from('contents')
        .select('id')
        .eq('content_code', rec.content_code)
        .limit(1)
        .maybeSingle();

      if (selErr) throw selErr;

      if (existing) {
        // UPDATE
        const { error: updErr } = await supabase
          .from('contents')
          .update(rec)
          .eq('content_code', rec.content_code);
        if (updErr) throw updErr;
        updated++;
      } else {
        // INSERT
        const { error: insErr } = await supabase.from('contents').insert(rec);
        if (insErr) throw insErr;
        inserted++;
      }
    } catch (e: any) {
      errors++;
      const msg =
        e?.message || e?.details || e?.hint || e?.code
          ? `${e.message ?? ''}${e.details ? ' | details: ' + e.details : ''}${e.hint ? ' | hint: ' + e.hint : ''}${e.code ? ' | code: ' + e.code : ''}`
          : JSON.stringify(e);
      console.error(`  ✗ "${rec.content_code}": ${msg}`);
    }
  }

  console.log('\n================ KẾT QUẢ ================');
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log('========================================');
}

main().catch((e) => {
  console.error('❌ Lỗi:', e instanceof Error ? e.message : e);
  process.exit(1);
});
