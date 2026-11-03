/* ============================================================
 * Ads Report (AR-01) — đọc TAB RIÊNG của từng nhân viên trong file ROAS.
 * CHỈ ĐỌC. Dùng env PERFORMANCE_SHEET_ID (cùng file với Content Performance) nhưng ĐỌC TAB
 * KHÁC: Content Performance đọc tab tổng "Roas content", module này đọc 4 tab nhân viên.
 *
 * TẠI SAO KHÔNG dùng tab tổng "Roas content" (đã kiểm chứng 2026-11-03):
 *   Tab tổng xếp chồng 4 khối trên cùng một số tiền —
 *     A "Roas theo CGSĐ" (r19-29) · B "Roas theo tên thương hiệu" (r31-33)
 *     C "Roas theo Mã số mẫu" (r35-156) · D "Chi tiết danh sách content" (r158+)
 *   Quét cả tab rồi cộng sẽ đếm tiền 3 lần (T10/2026: 2,8 tỷ → 8,4 tỷ).
 *   Tab nhân viên CHỈ có khối chi tiết nên không dính bẫy này, và tổng 5 tab khớp
 *   TUYỆT ĐỐI với khối D của tab tổng ở mọi tháng (chênh = 0 đ).
 *
 * BỐ CỤC TAB (giống hệt nhau ở cả 5 tab, đã audit):
 *   Dòng 1 tiêu đề · Dòng 4 Địa lý · Dòng 6 trở đi = dữ liệu (dòng 6-? là subtotal, bỏ qua
 *   bằng cách chỉ nhận dòng có "Tên content").
 *   Cột 1/2/3 = Kênh / Phân loại / Tên content.
 *   Khối TỔNG NĂM ở cột 4; THÁNG n ở cột 19 + (n-1)*15.
 *   Trong mỗi khối tháng: 3 nhóm địa lý × 5 chỉ số —
 *     offset 0 = TỔNG CỘNG · 5 = TRONG NƯỚC · 10 = NƯỚC NGOÀI
 *     5 chỉ số: Chi phí · SL data · Giá data · Roas trong tháng · Roas 3 tháng
 *   ROAS đã TÍNH SẴN trong Sheet — KHÔNG tự suy ra công thức rolling.
 * ========================================================== */
import { google } from 'googleapis';
import { createGoogleAuth } from '../google-auth';
import type { ChiSoKy, DongRoas } from './types';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Cột đầu của khối: tháng 1..12, nhóm địa lý 0 Tổng / 1 Trong nước / 2 Nước ngoài. */
export const cotKhoi = (thang: number, diaLy: number): number => 19 + (thang - 1) * 15 + diaLy * 5;

/** Dòng rác đã xác nhận qua audit CP-03A trên dữ liệu thật — loại khỏi mọi báo cáo. */
export function laDongRac(ten: string): boolean {
  const n = (ten || '').trim();
  if (!n || n.length <= 2) return true;
  if (n === 'Ko có tên content' || n === '#REF!' || n === 'Quảng cáo') return true;
  if (/^th[ửư]\s*nghi[eệ]m\s*-/i.test(n)) return true;
  if (/^https?:\/\//i.test(n)) return true;
  if (n.toLowerCase() === 'test') return true;
  return false;
}

function docChiSo(row: unknown[], base: number): ChiSoKy {
  return {
    chiPhi: num(row[base]),
    slData: num(row[base + 1]),
    giaData: num(row[base + 2]),
    roasThang: num(row[base + 3]),
    roas3Thang: num(row[base + 4]),
  };
}

/**
 * Thống kê phần BỊ LOẠI khi đọc 1 tab. Cần thiết vì các dòng rác ("Ko có tên content",
 * URL reel/landing) có chi phí = 0 nhưng VẪN MANG DATA — đã đối soát T10/2026: 103 data
 * trên 4 tab. Không có số này thì tổng SL data của báo cáo thấp hơn tab "Roas tổng" mà
 * không ai biết vì sao. Chi phí KHÔNG bị ảnh hưởng (các dòng đó đều 0 đ).
 */
export interface ThongKeBoQua {
  soDong: number;
  dataNoiDia: number;
  dataQuocTe: number;
}

export interface KetQuaDocTab {
  rows: DongRoas[];
  boQua: ThongKeBoQua;
}

export class RoasTabsProvider {
  /**
   * Đọc NHIỀU tab trong MỘT lần gọi API (batchGet) — 4 lần gọi tuần tự mất ~4s,
   * batchGet chỉ ~1s. Trả map: tên tab → { danh sách content, thống kê phần bị loại }.
   */
  async fetchTabs(tabs: string[], thang: number): Promise<Record<string, KetQuaDocTab>> {
    const spreadsheetId = process.env.PERFORMANCE_SHEET_ID?.trim();
    if (!spreadsheetId) throw new Error('Thiếu PERFORMANCE_SHEET_ID trong env.');
    if (thang < 1 || thang > 12) throw new Error(`Tháng không hợp lệ: ${thang}`);

    const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: tabs.map((t) => `'${t.replace(/'/g, "''")}'`),
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const out: Record<string, KetQuaDocTab> = {};
    const ranges = res.data.valueRanges ?? [];
    const baseND = cotKhoi(thang, 1);
    const baseQT = cotKhoi(thang, 2);
    tabs.forEach((tab, i) => {
      const rows = (ranges[i]?.values ?? []) as unknown[][];
      const list: DongRoas[] = [];
      const boQua: ThongKeBoQua = { soDong: 0, dataNoiDia: 0, dataQuocTe: 0 };
      // Bắt đầu từ dòng 6 (index 6) — phía trên là tiêu đề + các dòng subtotal không có Tên content.
      for (let r = 6; r < rows.length; r++) {
        const row = rows[r] ?? [];
        const ten = (row[3] ?? '').toString().trim();
        if (!ten) continue;   // dòng subtotal / dòng trống — không phải dòng bị loại
        if (laDongRac(ten)) {
          const dND = num(row[baseND + 1]);
          const dQT = num(row[baseQT + 1]);
          if (dND || dQT || num(row[baseND]) || num(row[baseQT])) {
            boQua.soDong++;
            boQua.dataNoiDia += dND;
            boQua.dataQuocTe += dQT;
          }
          continue;
        }
        list.push({
          kenh: (row[1] ?? '').toString().trim(),
          phanLoai: (row[2] ?? '').toString().trim(),
          content: ten,
          noiDia: docChiSo(row, baseND),
          quocTe: docChiSo(row, baseQT),
        });
      }
      out[tab] = { rows: list, boQua };
    });
    return out;
  }
}
