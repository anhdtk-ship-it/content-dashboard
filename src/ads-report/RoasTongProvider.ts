/* ============================================================
 * Ads Report (AR-01) — đọc tab "Roas tổng" của file ROAS.
 * CHỈ ĐỌC. Đây là nguồn cho MỤC A (chi tiêu + ROAS theo nhân viên).
 *
 * NGUYÊN TẮC (chốt với chủ dự án 2026-11-03): **KHÔNG tự tính lại con số nào mà Sheet
 * đã có sẵn.** Chi phí · SL data · Giá data · Roas trong tháng · Roas 3 tháng đều được
 * chính file ROAS tính sẵn cho từng nhân viên × từng nhóm địa lý → đọc nguyên giá trị ô.
 *
 * Trước đây module tự cộng Raw_Data rồi tự tính ROAS bình quân trọng số, cho ra số LỆCH
 * HẲN với Sheet (vd Hiếu T10: tự tính 740,97% vs Sheet 227,00%) vì mẫu số khác nhau —
 * tự tính chỉ trên các content ra ROAS, Sheet tính trên toàn bộ chi tiêu. Số của Sheet
 * mới là số dùng để báo cáo.
 *
 * BỐ CỤC TAB (đã audit, KHÔNG suy đoán):
 *   Dòng 4 = header. Dữ liệu từ dòng 5.
 *   Cột 1 Tháng báo cáo ("Tổng năm 2026" | "2026_T01".."2026_T12")
 *   Cột 7 Kênh · Cột 8 Phân loại · Cột 9 Tên nhân sự
 *   Cột 10-14 TỔNG CỘNG · 15-19 TRONG NƯỚC · 20-24 NƯỚC NGOÀI
 *     (mỗi nhóm: Chi phí · SL data · Giá data · Roas trong tháng · Roas 3 tháng)
 * ========================================================== */
import { google } from 'googleapis';
import { createGoogleAuth } from '../google-auth';
import type { ChiSoKy } from './types';

/** Phân loại tổng hợp cho KÊNH FACEBOOK — gộp CGSĐ + BS + mess Nữ MB + remar + hotline. */
export const PHAN_LOAI_TONG_FB = 'Tổng kênh_Facbeook';   // (chính tả này là của Sheet, giữ nguyên)

/** Tên tab. Đặt hằng số để chỗ nào cần cũng dùng chung một chuỗi. */
export const TAB_ROAS_TONG = 'Roas tổng';

/** Nhãn tháng trong cột "Tháng báo cáo": 10 → "2026_T10". */
export const nhanThang = (thang: string): string => `${thang.slice(0, 4)}_T${thang.slice(5, 7)}`;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Bộ 5 chỉ số bắt đầu từ cột `base`. */
function docChiSo(row: unknown[], base: number): ChiSoKy {
  return {
    chiPhi: num(row[base]),
    slData: num(row[base + 1]),
    giaData: num(row[base + 2]),
    roasThang: num(row[base + 3]),
    roas3Thang: num(row[base + 4]),
  };
}

/** 1 dòng của tab, đã tách sẵn 3 nhóm địa lý. */
export interface DongRoasTong {
  tenNhanSu: string;
  phanLoai: string;
  tong: ChiSoKy;
  noiDia: ChiSoKy;
  quocTe: ChiSoKy;
}

export class RoasTongProvider {
  /** Đọc toàn bộ dòng của MỘT tháng, phân loại `Tổng kênh_Facbeook`. Khoá = Tên nhân sự. */
  async fetchThang(thang: string): Promise<Map<string, DongRoasTong>> {
    const spreadsheetId = process.env.PERFORMANCE_SHEET_ID?.trim();
    if (!spreadsheetId) throw new Error('Thiếu PERFORMANCE_SHEET_ID trong env.');

    const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TAB_ROAS_TONG}'`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rows = (res.data.values ?? []) as unknown[][];
    const nhan = nhanThang(thang);
    const out = new Map<string, DongRoasTong>();
    for (let r = 5; r < rows.length; r++) {
      const row = rows[r] ?? [];
      if ((row[1] ?? '').toString().trim() !== nhan) continue;
      if ((row[8] ?? '').toString().trim() !== PHAN_LOAI_TONG_FB) continue;
      const ten = (row[9] ?? '').toString().trim();
      if (!ten) continue;
      out.set(ten, {
        tenNhanSu: ten,
        phanLoai: PHAN_LOAI_TONG_FB,
        tong: docChiSo(row, 10),
        noiDia: docChiSo(row, 15),
        quocTe: docChiSo(row, 20),
      });
    }
    return out;
  }
}
