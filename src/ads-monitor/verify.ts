/* Ads Monitor — PHASE 5 Verification.
 * Kiểm tra KPI tính bằng SQL (function ads_monitor_query) khớp với tính lại ở JS:
 *   1) summary.total = số dòng "latest" (đếm qua phân trang).
 *   2) summary.totalAmount = SUM(amount_spent) trên latest.
 *   3) Đếm từng trạng thái = kết quả calculateAdsStatus() trên từng dòng.
 * Lưu ý: chỉ lặp qua tập "đời" (mỗi page_code+content 1 dòng, SUM qua mọi ngày) — nhỏ, KHÔNG quét toàn bộ lịch sử.
 * Sai → báo lỗi (exit 1). */
import 'dotenv/config';
import { AdsMonitorService } from './AdsMonitorService';
import { calculateAdsStatus } from './calculateAdsStatus';
import type { AdsMonitorDTO, AdsStatus } from './types';

const PAGE_SIZE = 500;

(async () => {
  const service = new AdsMonitorService();

  // KPI từ SQL (không filter → toàn bộ tập latest).
  const head = await service.getData({ page: 1, pageSize: PAGE_SIZE });
  const summary = head.summary;
  console.log(`Nguồn dữ liệu: ${head.source}  ·  total (SQL): ${summary.total}  ·  totalPages: ${head.totalPages}`);

  // Gom toàn bộ items latest (lặp trang) để tính lại KPI ở JS.
  const all: AdsMonitorDTO[] = [...head.items];
  for (let p = 2; p <= head.totalPages; p++) {
    const r = await service.getData({ page: p, pageSize: PAGE_SIZE });
    all.push(...r.items);
  }

  const expTotal = all.length;
  const expAmount = all.reduce((s, x) => s + x.amount_spent, 0);
  const cnt = (st: AdsStatus) => all.filter((x) => calculateAdsStatus(x.latest_amount ?? 0, x.lifecycle ?? 'NEW') === st).length;
  const exp = {
    duyTri: cnt('Đang duy trì'), test: cnt('Đang test'), moiChay: cnt('Mới chạy'), daTat: cnt('Đã tắt'),
  };

  const checks: { name: string; ok: boolean; detail: string }[] = [
    { name: 'summary.total = số items latest', ok: summary.total === expTotal, detail: `${summary.total} vs ${expTotal}` },
    { name: 'summary.totalAmount = SUM(amount_spent)', ok: summary.totalAmount === expAmount, detail: `${summary.totalAmount} vs ${expAmount}` },
    { name: 'Đếm Đang duy trì = calculateAdsStatus', ok: summary.duyTri === exp.duyTri, detail: `${summary.duyTri} vs ${exp.duyTri}` },
    { name: 'Đếm Đang test = calculateAdsStatus', ok: summary.test === exp.test, detail: `${summary.test} vs ${exp.test}` },
    { name: 'Đếm Mới chạy = calculateAdsStatus', ok: summary.moiChay === exp.moiChay, detail: `${summary.moiChay} vs ${exp.moiChay}` },
    { name: 'Đếm Đã tắt = calculateAdsStatus', ok: summary.daTat === exp.daTat, detail: `${summary.daTat} vs ${exp.daTat}` },
  ];

  console.log('\n=== VERIFICATION ===');
  let failed = 0;
  for (const c of checks) { console.log(`${c.ok ? '✅' : '❌'} ${c.name}  (${c.detail})`); if (!c.ok) failed++; }
  console.log('====================');
  if (failed > 0) { console.error(`\n❌ SAI: ${failed} kiểm tra thất bại.`); process.exit(1); }
  console.log('\n✅ TẤT CẢ KHỚP.');
})().catch((e) => { console.error('❌ Verify lỗi:', e?.message ?? e); process.exit(1); });
