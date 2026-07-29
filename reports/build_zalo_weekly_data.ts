/* Weekly Report ZALO — DATA PREP cho reports/zalo_report_pdf.py.
 * ĐỘC LẬP, CHỈ ĐỌC. Toàn bộ KPI + Đánh giá + Đề xuất lấy từ src/platform/zalo/zaloWeeklyMetrics.ts
 * — ĐÚNG module Dashboard Weekly Zalo dùng → PDF và Dashboard KHÔNG THỂ lệch số.
 *
 * Chạy:
 *   npx ts-node reports/build_zalo_weekly_data.ts --from 2026-07-21 --to 2026-07-27 --out reports/report_zalo.json
 *   (bỏ --from/--to → 7 ngày gần nhất)
 */
import 'dotenv/config';
import * as fs from 'fs';
import { createSupa } from '../src/platform/db';
import { fetchZaloContents } from '../src/platform/zalo/repository';
import { fetchZaloSettings } from '../src/platform/zalo/settings';
import { buildZaloWeekly, buildZaloNarrative, type ZaloDateRange } from '../src/platform/zalo/zaloWeeklyMetrics';

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const dmy = (iso: string) => iso.split('-').reverse().join('/');

async function main() {
  const to = arg('to') ?? new Date().toISOString().slice(0, 10);
  const from = arg('from') ?? new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const outPath = arg('out') ?? 'reports/report_zalo.json';
  const range: ZaloDateRange = { from, to, label: `${dmy(from)} – ${dmy(to)}` };

  const db = createSupa();
  const [rows, settings] = await Promise.all([fetchZaloContents(db), fetchZaloSettings(db)]);
  const data = buildZaloWeekly(rows, range, settings, new Date().toISOString());
  const narrative = buildZaloNarrative(data);
  const payload = { ...data, narrative, exportedAt: dmy(new Date().toISOString().slice(0, 10)) };

  fs.mkdirSync(outPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`✅ Ghi ${outPath} · kỳ ${range.label} · ${rows.length} content Zalo · ${data.byFormat.length} định dạng`);
  for (const k of data.byFormat) {
    console.log(`  ${k.label.padEnd(16)} cấp ${k.capped} · test ${k.tested} · tồn ${k.ton} · duy trì ${k.duyTri} · tỷ lệ test ${(k.rateTest * 100).toFixed(1)}%`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
