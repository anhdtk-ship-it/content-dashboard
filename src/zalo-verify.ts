/* ============================================================
 * CLI kiểm chứng số liệu Zalo trên DỮ LIỆU SUPABASE THẬT (ZALO-02).
 *   npm run zalo:verify            → tháng hiện tại (giờ VN)
 *   npm run zalo:verify -- 2026-07 → tháng chỉ định
 * Chứng minh: Dashboard (buildZaloSummary) và Weekly (buildZaloWeekly) — CÙNG kỳ →
 * KPI TỪNG ĐỊNH DẠNG khớp 100% (vì dùng chung module PURE). Thoát mã 1 nếu lệch.
 * ========================================================== */
import { createSupa } from './platform/db';
import { fetchZaloContents } from './platform/zalo/repository';
import { fetchZaloSettings } from './platform/zalo/settings';
import { buildZaloSummary, monthBounds } from './platform/zalo/zaloMetrics';
import { buildZaloWeekly } from './platform/zalo/zaloWeeklyMetrics';

function todayVN(): string {
  const now = new Date();
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}
const pctS = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main() {
  const month = process.argv[2] && /^\d{4}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : todayVN().slice(0, 7);
  const db = createSupa();
  const [all, settings] = await Promise.all([fetchZaloContents(db), fetchZaloSettings(db)]);
  console.log(`Nguồn: Supabase · platform_contents(zalo)=${all.length} bản ghi · tháng kiểm=${month}`);
  console.log(`Settings: warningDays=${settings.warningDays} · targets=${JSON.stringify(settings.targets)}`);
  if (all.length === 0) {
    console.error('❌ Chưa có dữ liệu Zalo trong Supabase. Chạy `npm run zalo:seed` (sau khi đã chạy sql/010).');
    process.exit(1);
  }

  const gen = new Date().toISOString();
  const { from, to } = monthBounds(month);
  const summary = buildZaloSummary(all, month, todayVN(), settings, gen);
  // Weekly với range = TRỌN THÁNG → phải khớp block Dashboard theo từng định dạng.
  const weekly = buildZaloWeekly(all, { from, to, label: month }, settings, gen);

  const wkByFmt = new Map(weekly.byFormat.map((k) => [k.format, k]));
  const attnByFmt = new Map(summary.attention.map((a) => [a.format, a]));

  let fails = 0;
  console.log('\n=== §V/§VIII Dashboard blocks (nguồn Supabase) ===');
  console.log('ĐỊNH DẠNG'.padEnd(20) + 'cấp  test  tồn  đang  duytrì  ktest  rTest  rDuyTrì');
  for (const b of summary.blocks) {
    console.log(
      b.label.padEnd(20) +
      `${b.capped}`.padEnd(5) + `${b.tested}`.padEnd(6) + `${b.ton}`.padEnd(5) +
      `${b.dangTest}`.padEnd(6) + `${b.duyTri}`.padEnd(8) + `${b.khongTest}`.padEnd(7) +
      pctS(b.rateTest).padEnd(7) + pctS(b.rateDuyTri),
    );
    // 1) Nội bộ: capped = tổng các nhóm.
    const attn = attnByFmt.get(b.format)!;
    const sumGroups = b.khongTest + b.ton + b.dangTest + b.duyTri + attn.chuaPhanLoai;
    if (sumGroups !== b.capped) { fails++; console.log(`   ✗ [${b.label}] capped(${b.capped}) ≠ tổng nhóm(${sumGroups})`); }
    // 2) Parity Dashboard vs Weekly (cùng kỳ).
    const w = wkByFmt.get(b.format);
    if (!w) { fails++; console.log(`   ✗ [${b.label}] thiếu ở Weekly`); continue; }
    for (const key of ['capped', 'tested', 'ton', 'dangTest', 'duyTri', 'khongTest'] as const) {
      if ((b as any)[key] !== (w as any)[key]) { fails++; console.log(`   ✗ [${b.label}] ${key}: Dashboard=${(b as any)[key]} ≠ Weekly=${(w as any)[key]}`); }
    }
  }

  // 3) Tổng team khớp.
  if (summary.totals.capped !== weekly.team.capped) { fails++; console.log(`✗ TỔNG capped: Dashboard=${summary.totals.capped} ≠ Weekly=${weekly.team.capped}`); }

  console.log('\n=== §VII Cần xử lý (Dashboard) ===');
  for (const a of summary.attention) if (a.chuaPhanLoai + a.chuaTest + a.testQuaLau + a.thieuNgayTest > 0)
    console.log(`${a.label.padEnd(20)} chưaPL=${a.chuaPhanLoai} chưaTest=${a.chuaTest} testQuáLâu=${a.testQuaLau} thiếuNgàyTest=${a.thieuNgayTest}`);
  console.log('=== §IX Data Quality (Dashboard) ===');
  for (const q of summary.quality) if (q.thieuTrangThai + q.thieuBatBuoc + q.thieuNgayTest + q.trung > 0)
    console.log(`${q.label.padEnd(20)} thiếuTrạngThái=${q.thieuTrangThai} thiếuBắtBuộc=${q.thieuBatBuoc} thiếuNgàyTest=${q.thieuNgayTest} trùng=${q.trung}`);

  if (fails === 0) { console.log('\n✅ ĐỒNG NHẤT: Dashboard = Weekly (0 lệch) trên dữ liệu Supabase thật.'); }
  else { console.error(`\n❌ ${fails} điểm lệch — xem chi tiết ở trên.`); process.exit(1); }
}
main().catch((e) => { console.error('FATAL', e?.message ?? e); process.exit(1); });
