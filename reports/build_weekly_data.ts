/* Weekly Report — DATA PREP cho weekly_report_pdf.py.
 * ĐỘC LẬP, CHỈ ĐỌC. KHÔNG chứa công thức: toàn bộ KPI + Đánh giá + Kế hoạch lấy từ
 * `src/shared/weeklyMetrics.ts` — ĐÚNG module mà Dashboard Weekly Report đang dùng
 * → PDF và Dashboard KHÔNG THỂ lệch số liệu (và lệch chữ đánh giá).
 *
 * Chạy: npx ts-node reports/build_weekly_data.ts --from 2026-07-14 --to 2026-07-20 --out reports/report.json
 * (bỏ --from/--to → mặc định 7 ngày gần nhất)
 */
import 'dotenv/config';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { buildWeeklyReport, buildNarrative, type RawContent, type DateRange } from '../src/shared/weeklyMetrics';

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const dmy = (iso: string) => iso.split('-').reverse().join('/');

async function main() {
  const to = arg('to') ?? new Date().toISOString().slice(0, 10);
  const from = arg('from') ?? new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const outPath = arg('out') ?? 'reports/report.json';
  const range: DateRange = { from, to, label: `${dmy(from)} – ${dmy(to)}` };

  const supa = createClient(process.env.SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), { auth: { persistSession: false } });
  const rows: RawContent[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supa.from('contents').select('market, assignee_name, current_status, upload_date_real').range(f, f + 999);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data.map((x: any) => ({
      market: x.market || '',
      assignee_name: x.assignee_name || '(trống)',
      current_status: x.current_status ?? '',
      upload_date_real: x.upload_date_real ?? null,
    })));
    if (data.length < 1000) break;
  }

  const data = buildWeeklyReport(rows, range, new Date().toISOString());
  const narrative = buildNarrative(data);
  const payload = { ...data, narrative, exportedAt: dmy(new Date().toISOString().slice(0, 10)) };

  fs.mkdirSync(outPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`✅ Ghi ${outPath} · kỳ ${range.label} · ${rows.length} content`);
  for (const b of data.markets) {
    const t = b.team;
    console.log(`  ${b.label.padEnd(8)} cấp ${t.capped} · test ${t.tested} · tồn ${t.ton} · tỷ lệ test ${(t.rateTest * 100).toFixed(1)}% · duy trì tháng ${t.duyTriThang} · tỷ lệ duy trì ${(t.rateDuyTri * 100).toFixed(1)}% · đang duy trì ${t.dangDuyTri} · ${b.employees.length} NV`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
