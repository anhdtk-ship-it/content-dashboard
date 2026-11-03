/* ============================================================
 * Ads Report (AR-01) — ĐỐI SOÁT với Google Sheet.
 *   npm run report:ads:audit
 *
 * Kiểm module có ĐỌC ĐÚNG NGUYÊN giá trị ô Sheet không. DUNG SAI = 0: module không được
 * làm tròn, không được tính lại (xem PROJECT_SPEC §17.1).
 *
 * Script tự đọc Sheet THÔ bằng googleapis (không qua provider của module) để làm "sự thật",
 * rồi so với kết quả `buildAdsReport()`. Nhờ vậy chạy được trên bất kỳ máy nào có credentials,
 * không phụ thuộc file dump cục bộ.
 *
 * Chạy lại script này mỗi khi file ROAS đổi bố cục (thêm/bớt cột, đổi tên tab, đổi tên nhân sự).
 * ========================================================== */
import 'dotenv/config';
import { google } from 'googleapis';
import { createGoogleAuth } from '../google-auth';
import { buildAdsReport, coRoas } from './AdsReportService';
import { RoasTabsProvider } from './RoasTabsProvider';
import { PHAN_LOAI_TONG_FB, TAB_ROAS_TONG, nhanThang } from './RoasTongProvider';
import { NHAN_VIEN_ADS, TEN_DONG_TONG_SHEET } from './config';
import type { ChiSoKy } from './types';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const vnd = (n: number) => Math.round(n).toLocaleString('vi-VN');

let loi = 0, ok = 0;
function eq(nhan: string, a: number, b: number): void {
  if (a === b) { ok++; return; }
  loi++;
  console.log(`  ✗ ${nhan}\n      module=${a}  ô Sheet=${b}`);
}
function eqChiSo(nhan: string, m: ChiSoKy, row: unknown[], base: number): void {
  eq(`${nhan} · Chi phí`, m.chiPhi, num(row[base]));
  eq(`${nhan} · SL data`, m.slData, num(row[base + 1]));
  eq(`${nhan} · Giá data`, m.giaData, num(row[base + 2]));
  eq(`${nhan} · Roas tháng`, m.roasThang, num(row[base + 3]));
  eq(`${nhan} · Roas 3 tháng`, m.roas3Thang, num(row[base + 4]));
}

/** Tháng đem ra đối soát. Sửa ở đây nếu muốn kiểm kỳ khác. */
const THANG = ['2026-07', '2026-08', '2026-09', '2026-10'];
/** Tháng mà Quản Cao Khiêm CÒN phát sinh — dùng kiểm nhánh "cộng 4 dòng". */
const THANG_CO_KHIEM = '2026-03';

(async () => {
  const spreadsheetId = process.env.PERFORMANCE_SHEET_ID?.trim();
  if (!spreadsheetId) throw new Error('Thiếu PERFORMANCE_SHEET_ID trong env.');
  const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });

  const docTab = async (tab: string): Promise<unknown[][]> => {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `'${tab.replace(/'/g, "''")}'`, valueRenderOption: 'UNFORMATTED_VALUE',
    });
    return (r.data.values ?? []) as unknown[][];
  };

  console.log(`Đọc thô ${1 + NHAN_VIEN_ADS.length} tab của file ROAS để làm đối chứng…\n`);
  const tong = await docTab(TAB_ROAS_TONG);
  const rawTab: Record<string, unknown[][]> = {};
  for (const nv of NHAN_VIEN_ADS) rawTab[nv.key] = await docTab(nv.roasTab);

  /** Tra dòng thô trong tab "Roas tổng". */
  const timDong = (thang: string, ten: string): unknown[] | null => {
    const nhan = nhanThang(thang);
    for (let r = 5; r < tong.length; r++) {
      const row = tong[r] ?? [];
      if ((row[1] ?? '').toString().trim() !== nhan) continue;
      if ((row[8] ?? '').toString().trim() !== PHAN_LOAI_TONG_FB) continue;
      if ((row[9] ?? '').toString().trim() !== ten) continue;
      return row;
    }
    return null;
  };

  /* ── KIỂM 1 ── */
  console.log('═══ KIỂM 1 — Mục A: nhân viên × tháng × 3 nhóm địa lý × 5 chỉ số, so TỪNG Ô\n');
  const reps: Record<string, Awaited<ReturnType<typeof buildAdsReport>>> = {};
  for (const th of THANG) {
    reps[th] = await buildAdsReport({ thang: th, thiTruong: 'all', nhanVien: 'ALL' });
    for (const nv of NHAN_VIEN_ADS) {
      const row = timDong(th, nv.tenRoasTong);
      const m = reps[th].chiTieu.theoNhanVien.find((x) => x.nhanVienKey === nv.key);
      if (!row || !m) { console.log(`  ? ${th} ${nv.nhan}: thiếu dòng Sheet hoặc dữ liệu module`); loi++; continue; }
      eqChiSo(`${th} ${nv.nhan} TỔNG`, m.tong, row, 10);
      eqChiSo(`${th} ${nv.nhan} TRONG NƯỚC`, m.noiDia, row, 15);
      eqChiSo(`${th} ${nv.nhan} NƯỚC NGOÀI`, m.quocTe, row, 20);
    }
  }
  console.log(`  → ${ok} ô khớp, ${loi} lệch\n`);

  /* ── KIỂM 2 ── */
  console.log('═══ KIỂM 2 — Dòng CẢ TEAM (2 nhánh: Khiêm = 0 và Khiêm ≠ 0)\n');
  {
    const truoc = loi;
    const thangSach = THANG[THANG.length - 1];
    const t = reps[thangSach].chiTieu.team;
    const rowTong = timDong(thangSach, TEN_DONG_TONG_SHEET);
    if (!rowTong) { console.log(`  ? thiếu dòng "${TEN_DONG_TONG_SHEET}"`); loi++; }
    else {
      eq(`${thangSach} CẢ TEAM tuSheet (1=đọc nguyên dòng Sheet)`, t.tuSheet ? 1 : 0, 1);
      eq(`${thangSach} CẢ TEAM thieuChiSoGop (0)`, t.thieuChiSoGop ? 1 : 0, 0);
      eqChiSo(`${thangSach} CẢ TEAM TỔNG`, t.tong, rowTong, 10);
      eqChiSo(`${thangSach} CẢ TEAM TRONG NƯỚC`, t.noiDia, rowTong, 15);
      eqChiSo(`${thangSach} CẢ TEAM NƯỚC NGOÀI`, t.quocTe, rowTong, 20);
    }

    const rk = await buildAdsReport({ thang: THANG_CO_KHIEM, thiTruong: 'all', nhanVien: 'ALL' });
    const tk = rk.chiTieu.team;
    const rowTongK = timDong(THANG_CO_KHIEM, TEN_DONG_TONG_SHEET);
    const rowKhiem = timDong(THANG_CO_KHIEM, 'Quản Cao Khiêm');
    eq(`${THANG_CO_KHIEM} CẢ TEAM tuSheet (0=phải tự cộng vì Sheet gồm Khiêm)`, tk.tuSheet ? 1 : 0, 0);
    eq(`${THANG_CO_KHIEM} CẢ TEAM thieuChiSoGop (1)`, tk.thieuChiSoGop ? 1 : 0, 1);
    eq(`${THANG_CO_KHIEM} CẢ TEAM = cộng các dòng nhân viên`,
      tk.tong.chiPhi, rk.chiTieu.theoNhanVien.reduce((s, x) => s + x.tong.chiPhi, 0));
    if (rowTongK && rowKhiem) {
      eq(`${THANG_CO_KHIEM} phần chênh so dòng Sheet đúng bằng Khiêm`,
        Math.round(num(rowTongK[10]) - tk.tong.chiPhi), Math.round(num(rowKhiem[10])));
      console.log(`     ${THANG_CO_KHIEM}: Sheet "${TEN_DONG_TONG_SHEET}" ${vnd(num(rowTongK[10]))} − Khiêm ${vnd(num(rowKhiem[10]))} = team ${vnd(tk.tong.chiPhi)}`);
    }
    console.log(`  → ${loi === truoc ? 'TẤT CẢ KHỚP' : (loi - truoc) + ' lệch'}\n`);
  }

  /* ── KIỂM 3 ── */
  console.log('═══ KIỂM 3 — Mục B: gộp content của cả team có đúng không\n');
  {
    const truoc = loi;
    const thangSach = THANG[THANG.length - 1];
    const soThang = parseInt(thangSach.slice(5, 7), 10);
    const rep = reps[thangSach];
    const COT: Record<'noiDia' | 'quocTe', number> = {
      noiDia: 19 + (soThang - 1) * 15 + 5,
      quocTe: 19 + (soThang - 1) * 15 + 10,
    };

    // 3a. Dựng lại bảng gộp TRỰC TIẾP từ ô Sheet thô rồi so với module, từng content một.
    for (const g of ['noiDia', 'quocTe'] as const) {
      const base = COT[g];
      const mong = new Map<string, { chiPhi: number; slData: number; nguon: number }>();
      for (const nv of NHAN_VIEN_ADS) {
        const raw = rawTab[nv.key];
        for (let r = 6; r < raw.length; r++) {
          const ten = (raw[r]?.[3] ?? '').toString().trim();
          if (!ten || ten.length <= 2 || ten === 'Ko có tên content' || ten === '#REF!'
            || ten === 'Quảng cáo' || /^https?:\/\//i.test(ten) || /^th[ửư]\s*nghi[eệ]m\s*-/i.test(ten)
            || ten.toLowerCase() === 'test') continue;
          const c = num(raw[r][base]);
          if (c <= 0) continue;
          const o = mong.get(ten) ?? { chiPhi: 0, slData: 0, nguon: 0 };
          o.chiPhi += c; o.slData += num(raw[r][base + 1]); o.nguon++;
          mong.set(ten, o);
        }
      }
      const thuc = rep.chiTieu.rows.filter((d) => d.diaLy === g);
      eq(`${g} — số content sau gộp`, thuc.length, mong.size);
      for (const [ten, o] of mong) {
        const d = thuc.find((x) => x.content === ten);
        if (!d) { console.log(`  ✗ ${g}: thiếu content "${ten.slice(0, 44)}"`); loi++; continue; }
        eq(`${g} chi phí · ${ten.slice(0, 34)}`, Math.round(d.chiPhi), Math.round(o.chiPhi));
        eq(`${g} SL data · ${ten.slice(0, 34)}`, d.slData, o.slData);
        eq(`${g} số nguồn · ${ten.slice(0, 34)}`, d.nguon.length, o.nguon);
        // Dòng gộp từ >1 nguồn PHẢI bỏ trống ROAS; 1 nguồn phải giữ nguyên ô Sheet.
        eq(`${g} ROAS null khi gộp · ${ten.slice(0, 28)}`,
          d.roasThang === null ? 1 : 0, o.nguon > 1 ? 1 : 0);
        // Giá data = Chi phí ÷ SL data (đã kiểm là đúng cách Sheet tính).
        eq(`${g} giá data · ${ten.slice(0, 34)}`, d.giaData, o.slData > 0 ? Math.round(o.chiPhi / o.slData) : 0);
      }
    }

    // 3b. Gộp KHÔNG được làm mất hay nhân đôi tiền: Σ mục B = Σ chi phí content của 4 tab.
    for (const g of ['noiDia', 'quocTe'] as const) {
      const base = COT[g];
      let sheet = 0;
      for (const nv of NHAN_VIEN_ADS) {
        const raw = rawTab[nv.key];
        for (let r = 6; r < raw.length; r++) {
          const ten = (raw[r]?.[3] ?? '').toString().trim();
          if (!ten || ten.length <= 2 || ten === 'Ko có tên content' || ten === '#REF!'
            || ten === 'Quảng cáo' || /^https?:\/\//i.test(ten) || /^th[ửư]\s*nghi[eệ]m\s*-/i.test(ten)
            || ten.toLowerCase() === 'test') continue;
          sheet += num(raw[r][base]);
        }
      }
      const mod = rep.chiTieu.rows.filter((d) => d.diaLy === g).reduce((s, d) => s + d.chiPhi, 0);
      eq(`${g} — tổng chi phí sau gộp = tổng ô Sheet`, Math.round(mod), Math.round(sheet));
    }

    // 3c. Ví dụ chủ dự án nêu: content do Kim Anh + Liên cùng chạy.
    const VD = '260515-SC CGSĐ Hiếu nửa mặt U60 260410 260225 260324 4258t tvc v2';
    const d = rep.chiTieu.rows.find((x) => x.content === VD && x.diaLy === 'noiDia');
    if (!d) { console.log(`  ✗ không tìm thấy content ví dụ`); loi++; }
    else {
      let congTay = 0;
      for (const nv of NHAN_VIEN_ADS) {
        const raw = rawTab[nv.key];
        for (let r = 6; r < raw.length; r++) {
          if ((raw[r]?.[3] ?? '').toString().trim() !== VD) continue;
          congTay += num(raw[r][COT.noiDia]);
        }
      }
      eq(`ví dụ "nửa mặt U60 … tvc v2" — chi phí gộp`, Math.round(d.chiPhi), Math.round(congTay));
      console.log(`     ví dụ: [${d.nhanVien.join(' + ')}] = ${vnd(d.chiPhi)} đ · ROAS ${d.roasThang === null ? '"—" (đúng, vì gộp)' : 'CÓ GIÁ TRỊ (SAI)'}`);
    }
    console.log(`  → ${loi === truoc ? 'TẤT CẢ KHỚP' : (loi - truoc) + ' lệch'}\n`);
  }


  /* ── KIỂM 4 ── */
  console.log('═══ KIỂM 4 — Bất biến: Σ content trong tab + phần bỏ qua = dòng "Roas tổng"\n');
  {
    const truoc = loi;
    const thangSach = THANG[THANG.length - 1];
    const soThang = parseInt(thangSach.slice(5, 7), 10);
    const tabs = await new RoasTabsProvider().fetchTabs(NHAN_VIEN_ADS.map((n) => n.roasTab), soThang);
    for (const nv of NHAN_VIEN_ADS) {
      const kq = tabs[nv.roasTab];
      const fb = kq.rows.filter((x) => x.kenh === 'Facebook');
      const row = timDong(thangSach, nv.tenRoasTong);
      if (!row) continue;
      eq(`${nv.nhan} chi phí NĐ`, Math.round(fb.reduce((s, x) => s + x.noiDia.chiPhi, 0)), Math.round(num(row[15])));
      eq(`${nv.nhan} chi phí QT`, Math.round(fb.reduce((s, x) => s + x.quocTe.chiPhi, 0)), Math.round(num(row[20])));
      eq(`${nv.nhan} SL data NĐ (+${kq.boQua.dataNoiDia} bỏ qua)`,
        fb.reduce((s, x) => s + x.noiDia.slData, 0) + kq.boQua.dataNoiDia, num(row[16]));
      eq(`${nv.nhan} SL data QT (+${kq.boQua.dataQuocTe} bỏ qua)`,
        fb.reduce((s, x) => s + x.quocTe.slData, 0) + kq.boQua.dataQuocTe, num(row[21]));
    }
    console.log(`  → ${loi === truoc ? 'TẤT CẢ KHỚP' : (loi - truoc) + ' lệch'}\n`);
  }

  /* ── KIỂM 5 ── */
  console.log('═══ KIỂM 5 — Luật "phát sinh ROAS" (Roas tháng > 0 HOẶC Roas 3 tháng > 0)\n');
  {
    const truoc = loi;
    const thangSach = THANG[THANG.length - 1];
    const soThang = parseInt(thangSach.slice(5, 7), 10);
    const rep = reps[thangSach];
    const tabs = await new RoasTabsProvider().fetchTabs(NHAN_VIEN_ADS.map((n) => n.roasTab), soThang);
    for (const nv of NHAN_VIEN_ADS) {
      const all = tabs[nv.roasTab].rows;
      const k = rep.roas.find((x) => x.nhanVienKey === nv.key);
      if (!k) continue;
      eq(`${nv.nhan} SL content ra ROAS NĐ`, k.noiDia.rows.length, all.filter((x) => coRoas(x.noiDia)).length);
      eq(`${nv.nhan} SL content ra ROAS QT`, k.quocTe.rows.length, all.filter((x) => coRoas(x.quocTe)).length);
      const sai = k.noiDia.rows.filter((x) => !coRoas(x.noiDia)).length
        + k.quocTe.rows.filter((x) => !coRoas(x.quocTe)).length;
      eq(`${nv.nhan} số dòng lọt sai luật`, sai, 0);
    }
    console.log(`  → ${loi === truoc ? 'TẤT CẢ KHỚP' : (loi - truoc) + ' lệch'}\n`);
  }

  console.log('═'.repeat(62));
  if (loi === 0) {
    console.log(`✅ TOÀN BỘ ${ok} PHÉP KIỂM ĐỀU KHỚP (dung sai 0)`);
  } else {
    console.log(`❌ ${loi} LỆCH / ${ok + loi} tổng`);
    process.exit(1);
  }
})().catch((e) => { console.error('LỖI:', e?.message ?? e); process.exit(1); });
