/* Weekly Report — DATA PREP (chuẩn bị JSON cho weekly_report_pdf.py).
 * ĐỘC LẬP, CHỈ ĐỌC. KHÔNG sửa web/ (WeeklyReportService/ruleEngine giữ nguyên).
 * Sao chép NGUYÊN công thức KPI của WeeklyReportService để số liệu KHỚP web:
 *   A. cohort theo upload trong kỳ: capped · notTest · win(Duy trì)
 *   B. trạng thái hiện tại (ALL):   choChay · dangTest
 * THÊM (chỉ để HIỂN THỊ PDF, KHÔNG đổi Business Rule/KPI web):
 *   tested = cohort trong kỳ & đã test {Đang test, Duy trì*, Đã test-ko chạy, Đã chạy-Tắt}
 * II/III sinh theo ĐÚNG rule của ruleEngine (KPI-based, không chung chung).
 *
 * Chạy:  npx ts-node reports/build_weekly_data.ts --from 2026-06-01 --to 2026-06-30 --out reports/report.json
 */
import 'dotenv/config';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

interface Raw { assignee_name: string; current_status: string; upload_date_real: string | null; }
const st = (r: Raw) => (r.current_status ?? '').trim();
const inPeriod = (r: Raw, from: string, to: string) => !!r.upload_date_real && r.upload_date_real >= from && r.upload_date_real <= to;
const TESTED = (s: string) => s === 'Đang test' || s.startsWith('Duy trì') || s === 'Đã test-ko chạy' || s === 'Đã chạy-Tắt';

// Bộ KPI 1 tập content (khớp WeeklyReportService.calculateWeeklyKPIs + tested hiển-thị).
function kpis(rows: Raw[], from: string, to: string) {
  const coh = rows.filter((r) => inPeriod(r, from, to));
  return {
    capped: coh.length,                                             // Đã cấp (cohort)
    tested: coh.filter((r) => TESTED(st(r))).length,               // Đã test (cohort — CHỈ hiển thị PDF)
    notTest: coh.filter((r) => st(r) === 'Không test').length,      // Không test (cohort)
    win: coh.filter((r) => st(r).startsWith('Duy trì')).length,     // Content Duy trì (cohort)
    choChay: rows.filter((r) => st(r) === 'Chờ chạy').length,       // Chờ chạy (ALL)
    dangTest: rows.filter((r) => st(r) === 'Đang test').length,     // Đang test (ALL)
  };
}
type KPI = ReturnType<typeof kpis>;

const fmtNum = (n: number) => (n ?? 0).toLocaleString('vi-VN');
const fmtPct1 = (x: number) => `${(100 * (x ?? 0)).toFixed(1)}%`;

// Rule Engine (sao đúng web/reports/services/ruleEngine.ts) — MAX 3 để II có 2–3 dòng.
function evaluate(m: KPI): { assessments: string[]; actions: string[] } {
  const rules = [
    { when: m.choChay >= 5, p: 1,
      a: `Khối lượng content chờ triển khai còn nhiều (Chờ chạy ${fmtNum(m.choChay)}).`,
      x: `Ưu tiên xử lý content chờ chạy trước khi nhận thêm content mới.` },
    { when: m.dangTest >= 10, p: 2,
      a: `Đang triển khai nhiều content đồng thời (Đang test ${fmtNum(m.dangTest)}).`,
      x: `Theo dõi sát kết quả test để sớm đưa ra quyết định.` },
    { when: m.capped > 0 && m.notTest / m.capped >= 0.2, p: 2,
      a: `Content không phù hợp triển khai còn cao (Không test ${fmtNum(m.notTest)}/${fmtNum(m.capped)} = ${fmtPct1(m.notTest / m.capped)}).`,
      x: `Rà soát lại tiêu chí lựa chọn content trước khi cấp cho Ads.` },
    { when: m.capped >= 3 && m.win === 0, p: 3,
      a: `Content cấp trong kỳ chưa có Duy trì (0/${fmtNum(m.capped)}).`,
      x: `Tối ưu nội dung/nhắm mục tiêu để sớm đạt Duy trì.` },
    { when: m.win > 0, p: 5,
      a: `Đạt ${fmtNum(m.win)} content Duy trì trong kỳ.`,
      x: `Nhân bản hướng nội dung của ${fmtNum(m.win)} content Duy trì.` },
  ].filter((r) => r.when).sort((a, b) => a.p - b.p).slice(0, 3);
  if (!rules.length) return { assessments: [`Đã cấp ${fmtNum(m.capped)} · đã test ${fmtNum(m.tested)} · Duy trì ${fmtNum(m.win)} trong kỳ.`], actions: [`Duy trì nhịp triển khai; bổ sung nhận định thủ công nếu cần.`] };
  return { assessments: rules.map((r) => r.a), actions: rules.map((r) => r.x) };
}

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

async function main() {
  const to = arg('to') ?? new Date().toISOString().slice(0, 10);
  const from = arg('from') ?? new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const outPath = arg('out') ?? 'reports/report.json';
  const ORDER = ['Hiếu', 'KA', 'Liên', 'Ánh']; // thứ tự dòng theo yêu cầu

  const supa = createClient(process.env.SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), { auth: { persistSession: false } });
  const rows: Raw[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supa.from('contents').select('assignee_name, current_status, upload_date_real').range(f, f + 999);
    if (error) throw error; if (!data?.length) break;
    rows.push(...data.map((x: any) => ({ assignee_name: x.assignee_name || '(trống)', current_status: x.current_status ?? '', upload_date_real: x.upload_date_real ?? null })));
    if (data.length < 1000) break;
  }

  const byName = new Map<string, Raw[]>();
  for (const r of rows) { const k = r.assignee_name || '(trống)'; (byName.get(k) ?? byName.set(k, []).get(k)!).push(r); }

  const names = [...ORDER.filter((n) => byName.has(n)), ...[...byName.keys()].filter((n) => !ORDER.includes(n))];
  const employees = names.map((name) => {
    const m = kpis(byName.get(name)!, from, to);
    const ev = evaluate(m);
    return { name, metrics: m, assessments: ev.assessments, actions: ev.actions };
  });

  const label = `${from.split('-').reverse().join('/')} – ${to.split('-').reverse().join('/')}`;
  const report = {
    range: { from, to, label },
    team: kpis(rows, from, to),
    employees,
    generatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(outPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✅ Ghi ${outPath}  ·  kỳ ${label}  ·  ${employees.length} nhân viên`);
  console.log('Team:', JSON.stringify(report.team));
  employees.forEach((e) => console.log(`  ${e.name}:`, JSON.stringify(e.metrics)));
}
main().catch((e) => { console.error(e); process.exit(1); });
