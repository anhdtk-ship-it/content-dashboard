/* ============================================================
 * Ads Report (AR-01) — CLI sinh file Excel ngoài dashboard.
 *   npx ts-node src/ads-report/cli.ts 10 2026 [noi_dia|quoc_te] [key-nhan-vien]
 *
 * Dùng CHÍNH AdsReportService + ExcelBuilder của route `/api/ads-report/excel`,
 * nên file CLI sinh ra và file tải từ dashboard LUÔN giống nhau — không có 2 bộ
 * tính toán song song để lệch nhau về sau.
 * ========================================================== */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { buildAdsReport, thangHienTai } from './AdsReportService';
import { buildExcel } from './ExcelBuilder';
import type { LocThiTruong } from './types';

const thangSo = process.argv[2];
const namSo = process.argv[3];
const thang = thangSo && namSo ? `${namSo}-${String(thangSo).padStart(2, '0')}` : thangHienTai();
const ttRaw = (process.argv[4] || 'all').toLowerCase();
const thiTruong = (ttRaw === 'noi_dia' || ttRaw === 'quoc_te' ? ttRaw : 'all') as LocThiTruong;
const nhanVien = process.argv[5] || 'ALL';

(async () => {
  console.log(`Đang dựng báo cáo ${thang} (thị trường=${thiTruong}, nhân viên=${nhanVien})…`);
  const data = await buildAdsReport({ thang, thiTruong, nhanVien });
  const buf = await buildExcel(data);

  const hau = nhanVien !== 'ALL' ? `_${nhanVien}` : '';
  const dir = path.join(process.cwd(), 'output');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `BaoCaoAds_Thang${thang.slice(5)}_${thang.slice(0, 4)}${hau}.xlsx`);
  fs.writeFileSync(file, buf);

  const t = data.chiTieu.team.tong;
  console.log(`  Chi tiêu: ${Math.round(t.chiPhi).toLocaleString('vi-VN')} đ · ${t.slData} data · ${data.chiTieu.rows.length} content`);
  console.log(`  Content ra ROAS: ${data.roas.reduce((s, k) => s + k.noiDia.rows.length + k.quocTe.rows.length, 0)}`);
  data.meta.canhBao.forEach((c, i) => console.log(`  ⚠ (${i + 1}) ${c}`));
  console.log(`\nĐã tạo: ${file}`);
})().catch((e) => { console.error('LỖI:', e?.message ?? e); process.exit(1); });
