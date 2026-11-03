/* ============================================================
 * Ads Report (AR-01) — TẦNG NGHIỆP VỤ. Thuần tính toán + gọi 2 provider, KHÔNG Express,
 * KHÔNG Excel. Dùng chung cho cả route JSON (dashboard) và route xuất Excel → hai đường
 * ra KHÔNG BAO GIỜ lệch số.
 *
 * ════ NGUYÊN TẮC SỐ LIỆU (chốt với chủ dự án 2026-11-03) ════
 * LẤY CON SỐ THỰC TẾ TRÊN GOOGLE SHEET, KHÔNG TỰ TÍNH.
 *   Mục A  ← tab `Roas tổng`      : đọc nguyên Chi phí · SL data · Giá data · Roas tháng ·
 *                                   Roas 3 tháng cho từng nhân viên × từng nhóm địa lý.
 *   Mục B  ← tab nhân viên        : đọc nguyên chỉ số từng content, chỉ SẮP XẾP + cắt Top N.
 *   Mục C  ← tab nhân viên        : như trên, thêm bộ lọc "có ROAS".
 *
 * Một nguồn DUY NHẤT (file ROAS) nên số ở 3 mục nhất quán với nhau. Phiên bản trước lấy
 * mục A/B từ Raw_Data (Ads) rồi tự cộng, khiến cùng một content hiện 2 chi phí khác nhau
 * (lệch ~12%) và ROAS tự tính lệch hẳn Sheet (Hiếu T10: 740,97% vs 227,00% của Sheet).
 *
 * CHỖ DUY NHẤT CÒN PHẢI CỘNG: dòng "cả team". Chủ dự án loại Quản Cao Khiêm, mà Khiêm có
 * phát sinh T01–T03/2026 nên dòng `Tổng cộng` của Sheet ở 3 tháng đó đã gồm anh ấy →
 * không dùng được. Khi đó cộng Chi phí + SL data của 4 người và BỎ TRỐNG Giá data/ROAS
 * (ROAS cần doanh thu, Sheet không công khai nên không suy ra được — thà để "—" còn hơn
 * bịa một con số). Từ T04/2026 trở đi Khiêm = 0 nên dòng `Tổng cộng` CHÍNH LÀ 4 người,
 * khi đó đọc thẳng dòng đó của Sheet.
 * ========================================================== */
import { NHAN_VIEN_ADS, TEN_DONG_TONG_SHEET, timTheoKey } from './config';
import { RoasTongProvider, TAB_ROAS_TONG } from './RoasTongProvider';
import { RoasTabsProvider } from './RoasTabsProvider';
import type {
  AdsReportQuery, AdsReportResult, ChiSoKy, DongChiTieu, DongRoas,
  KhoiRoasNhanVien, LocThiTruong, NhomDiaLy, TongChiTieu,
} from './types';

const chiSoRong = (): ChiSoKy => ({ chiPhi: 0, slData: 0, giaData: 0, roasThang: 0, roas3Thang: 0 });

/** 'YYYY-MM' hợp lệ? */
export function thangHopLe(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test((s || '').trim());
}

/** Tháng hiện tại 'YYYY-MM'. */
export function thangHienTai(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * "Phát sinh ROAS" — quy tắc chốt với chủ dự án:
 *   Roas trong tháng > 0 HOẶC Roas 3 tháng > 0.
 * Ví dụ của chủ dự án: content ROAS tháng = 0 nhưng ROAS 3 tháng = 32% thì VẪN TÍNH.
 */
export function coRoas(c: { roasThang: number; roas3Thang: number }): boolean {
  return c.roasThang > 0 || c.roas3Thang > 0;
}

/** Nhóm địa lý cần hiển thị theo bộ lọc. */
function nhomCanHien(loc: LocThiTruong): NhomDiaLy[] {
  if (loc === 'noi_dia') return ['noiDia'];
  if (loc === 'quoc_te') return ['quocTe'];
  return ['noiDia', 'quocTe'];
}

export async function buildAdsReport(q: AdsReportQuery): Promise<AdsReportResult> {
  const thang = thangHopLe(q.thang) ? q.thang : thangHienTai();
  const soThang = parseInt(thang.slice(5, 7), 10);
  const chonNV = timTheoKey(q.nhanVien);
  const dsNV = chonNV ? [chonNV] : NHAN_VIEN_ADS;
  const nhom = nhomCanHien(q.thiTruong);
  const canhBao: string[] = [];

  // Hai tab đọc SONG SONG. Cả hai đều trong cùng file ROAS.
  const [bangTong, tabs] = await Promise.all([
    new RoasTongProvider().fetchThang(thang),
    new RoasTabsProvider().fetchTabs(dsNV.map((nv) => nv.roasTab), soThang),
  ]);

  /* ---------- Mục A: đọc NGUYÊN dòng của tab "Roas tổng" ---------- */
  const thieuDong: string[] = [];
  const theoNhanVien: TongChiTieu[] = dsNV.map((nv) => {
    const d = bangTong.get(nv.tenRoasTong);
    if (!d) thieuDong.push(nv.full);
    return {
      nhanVienKey: nv.key, nhan: nv.nhan, full: nv.full,
      tong: d?.tong ?? chiSoRong(),
      noiDia: d?.noiDia ?? chiSoRong(),
      quocTe: d?.quocTe ?? chiSoRong(),
      tuSheet: !!d,
      thieuChiSoGop: false,
    };
  });
  if (thieuDong.length) {
    canhBao.push(`Tab "${TAB_ROAS_TONG}" không có dòng tháng này cho: ${thieuDong.join(', ')} — các ô liên quan hiển thị 0.`);
  }

  /* ---------- Dòng "cả team" ---------- */
  let team: TongChiTieu;
  if (chonNV) {
    team = { ...theoNhanVien[0] };
  } else {
    // Cộng Chi phí + SL data của 4 người (phép cộng thuần, không suy diễn).
    const cong = (lay: (t: TongChiTieu) => ChiSoKy): ChiSoKy => ({
      ...chiSoRong(),
      chiPhi: theoNhanVien.reduce((s, t) => s + lay(t).chiPhi, 0),
      slData: theoNhanVien.reduce((s, t) => s + lay(t).slData, 0),
    });
    const gop = { tong: cong((t) => t.tong), noiDia: cong((t) => t.noiDia), quocTe: cong((t) => t.quocTe) };

    // Nếu dòng "Tổng cộng" của Sheet trùng tổng 4 người (tức tháng đó Khiêm = 0) thì
    // ĐỌC THẲNG dòng Sheet để có luôn Giá data + ROAS thật, thay vì bỏ trống.
    const dongTong = bangTong.get(TEN_DONG_TONG_SHEET);
    const khopSheet = !!dongTong && Math.abs(dongTong.tong.chiPhi - gop.tong.chiPhi) <= 2;

    if (khopSheet && dongTong) {
      team = {
        nhanVienKey: 'team', nhan: 'Cả team',
        full: `Cả team (${NHAN_VIEN_ADS.map((x) => x.nhan).join(' + ')})`,
        tong: dongTong.tong, noiDia: dongTong.noiDia, quocTe: dongTong.quocTe,
        tuSheet: true, thieuChiSoGop: false,
      };
    } else {
      team = {
        nhanVienKey: 'team', nhan: 'Cả team',
        full: `Cả team (${NHAN_VIEN_ADS.map((x) => x.nhan).join(' + ')})`,
        ...gop, tuSheet: false, thieuChiSoGop: true,
      };
      canhBao.push(`Tháng này dòng "${TEN_DONG_TONG_SHEET}" của Sheet có gồm người ngoài 4 nhân viên ads (Quản Cao Khiêm), nên dòng CẢ TEAM chỉ cộng Chi phí và SL data của 4 người. Giá data và ROAS để trống vì Sheet không có sẵn dòng tương ứng và hai chỉ số này không suy ra được bằng phép cộng.`);
    }
  }

  /* ---------- Mục B: mọi content, đọc nguyên chỉ số ô ---------- */
  const rows: DongChiTieu[] = [];
  for (const nv of dsNV) {
    const kq = tabs[nv.roasTab];
    if (!kq) continue;
    for (const x of kq.rows) {
      for (const g of nhom) {
        if (x[g].chiPhi <= 0) continue;
        rows.push({
          content: x.content, phanLoai: x.phanLoai,
          nhanVienKey: nv.key, nhanVien: nv.nhan,
          diaLy: g, chiSo: x[g],
        });
      }
    }
  }
  rows.sort((a, b) => b.chiSo.chiPhi - a.chiSo.chiPhi);

  /* ---------- Mục C: content phát sinh ROAS (KHÔNG có bản "cả team") ---------- */
  let boQuaDong = 0, boQuaData = 0;
  const roas: KhoiRoasNhanVien[] = dsNV.map((nv) => {
    const kq = tabs[nv.roasTab] ?? { rows: [] as DongRoas[], boQua: { soDong: 0, dataNoiDia: 0, dataQuocTe: 0 } };
    boQuaDong += kq.boQua.soDong;
    boQuaData += (nhom.includes('noiDia') ? kq.boQua.dataNoiDia : 0) + (nhom.includes('quocTe') ? kq.boQua.dataQuocTe : 0);

    const lam = (g: NhomDiaLy) => {
      const list = nhom.includes(g)
        ? kq.rows.filter((x) => coRoas(x[g])).sort((a, b) => b[g].chiPhi - a[g].chiPhi)
        : [];
      return {
        rows: list,
        tongChiPhi: list.reduce((s, x) => s + x[g].chiPhi, 0),
        tongSlData: list.reduce((s, x) => s + x[g].slData, 0),
      };
    };
    return {
      nhanVienKey: nv.key, nhan: nv.nhan, full: nv.full, roasTab: nv.roasTab,
      noiDia: lam('noiDia'), quocTe: lam('quocTe'),
    };
  });

  if (boQuaData > 0) {
    canhBao.push(`Tab nhân viên có ${boQuaDong} dòng không phải content (“Ko có tên content”, link reel/landing) mang ${boQuaData.toLocaleString('vi-VN')} data nhưng chi phí 0 đ — không liệt kê theo content được nên không có ở mục B và C. Mục A vẫn tính đủ vì đọc từ tab "${TAB_ROAS_TONG}".`);
  }

  return {
    thang,
    chiTieu: { theoNhanVien, team, rows },
    roas,
    meta: {
      taoLuc: new Date().toISOString(),
      nguon: [
        `Mục A: tab "${TAB_ROAS_TONG}" — đọc nguyên giá trị ô`,
        `Mục B & C: tab ${dsNV.map((n) => `"${n.roasTab}"`).join(', ')} — đọc nguyên giá trị ô`,
      ],
      canhBao,
    },
  };
}
