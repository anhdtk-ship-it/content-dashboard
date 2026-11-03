/* ============================================================
 * Ads Report (AR-01) — KIỂU DỮ LIỆU. Module độc lập, KHÔNG dùng kiểu của module khác.
 *
 * NGUYÊN TẮC: mọi con số dưới đây đều ĐỌC THẲNG từ file ROAS (Google Sheet), KHÔNG tự
 * tính lại. Chỗ duy nhất phải cộng là dòng "cả team" — vì chủ dự án loại Quản Cao Khiêm
 * nên những tháng Khiêm có phát sinh (T01–T03/2026), Sheet không có sẵn dòng nào ứng với
 * "4 nhân viên không gồm Khiêm". Xem `TongChiTieu.tuSheet`.
 * ========================================================== */

/** Bộ 5 chỉ số mà file ROAS tính sẵn cho mỗi ô. ROAS dạng thập phân: 1.527 = 152,7%. */
export interface ChiSoKy {
  chiPhi: number;
  slData: number;
  giaData: number;
  roasThang: number;
  roas3Thang: number;
}

/** Bộ lọc thị trường trên UI. */
export type LocThiTruong = 'all' | 'noi_dia' | 'quoc_te';

/** Nhóm địa lý trong file ROAS. File ROAS KHÔNG có nhóm "chưa xác định". */
export type NhomDiaLy = 'noiDia' | 'quocTe';

/** 1 dòng nguồn góp vào một content đã gộp — giữ lại để tra ngược ai chạy, ROAS bao nhiêu. */
export interface NguonDong {
  nhanVienKey: string;
  nhanVien: string;
  phanLoai: string;
  chiPhi: number;
  slData: number;
  roasThang: number;
  roas3Thang: number;
}

/**
 * 1 dòng trong khối "Top chi tiêu" — MỘT CONTENT trong MỘT thị trường, đã GỘP mọi nhân
 * viên cùng chạy (chốt với chủ dự án 2026-11-03: báo cáo là của CẢ TEAM, không phải của
 * từng người). Gộp theo TÊN CONTENT CHÍNH XÁC — trùng cách tab tổng `Roas content` gộp;
 * đuôi `tvc v1` / `tvc v2` là hai content khác nhau nên KHÔNG gộp chung.
 *
 * T10/2026: Nội Địa 64/144 content do nhiều nhân viên cùng chạy, Quốc Tế 30/71.
 */
export interface DongChiTieu {
  content: string;
  diaLy: NhomDiaLy;
  /** Σ của các dòng nguồn — phép cộng thuần. */
  chiPhi: number;
  slData: number;
  /** Σ chi phí ÷ Σ SL data. Đã kiểm: đúng cách Sheet tính Giá data (554/554 ô). */
  giaData: number;
  /**
   * `null` khi gộp từ >1 dòng nguồn: ROAS **KHÔNG cộng được**. Đã thử công thức trọng số
   * Σ(roas×chiPhi)/Σchiphí và đối chiếu cấp nhân viên — lệch tới 257 điểm %, vì có content
   * tháng này chi phí 0 nhưng vẫn phát sinh doanh thu (công thức bỏ qua, Sheet thì không).
   * Dòng gộp hiển thị "—"; ROAS từng nguồn vẫn tra được qua `nguon`.
   */
  roasThang: number | null;
  roas3Thang: number | null;
  /** Tên ngắn các nhân viên cùng chạy content này. */
  nhanVien: string[];
  /** Các "Phân loại" xuất hiện (1 content có thể nằm ở nhiều phân loại). */
  phanLoai: string[];
  nguon: NguonDong[];
}

/** Tổng của 1 nhân viên (hoặc dòng cả team) — nguồn tab "Roas tổng". */
export interface TongChiTieu {
  nhanVienKey: string;   // 'team' cho dòng tổng
  nhan: string;
  full: string;
  tong: ChiSoKy;
  noiDia: ChiSoKy;
  quocTe: ChiSoKy;
  /**
   * true  = đọc nguyên một dòng có sẵn của Sheet.
   * false = dòng "cả team" phải cộng Chi phí/SL data từ 4 dòng nhân viên.
   */
  tuSheet: boolean;
  /**
   * Chỉ gặp ở dòng "cả team" của tháng Khiêm có phát sinh: Giá data và ROAS KHÔNG suy ra
   * được từ phép cộng (ROAS cần doanh thu, Sheet không công khai) → hiển thị "—".
   */
  thieuChiSoGop: boolean;
}

/** 1 content trong khối "phát sinh ROAS". */
export interface DongRoas {
  content: string;
  phanLoai: string;
  kenh: string;
  noiDia: ChiSoKy;
  quocTe: ChiSoKy;
}

/** Khối ROAS của 1 nhân viên — KHÔNG có bản "cả team" (đã chốt). */
export interface KhoiRoasNhanVien {
  nhanVienKey: string;
  nhan: string;
  full: string;
  roasTab: string;
  /** `tong` ở đây là CỘNG của riêng các content trong danh sách, KHÔNG phải tổng kỳ của Sheet. */
  noiDia: { rows: DongRoas[]; tongChiPhi: number; tongSlData: number };
  quocTe: { rows: DongRoas[]; tongChiPhi: number; tongSlData: number };
}

/** Payload trả về cho dashboard. */
export interface AdsReportResult {
  /** 'YYYY-MM' */
  thang: string;
  chiTieu: {
    theoNhanVien: TongChiTieu[];
    team: TongChiTieu;
    /** TOÀN BỘ dòng content khớp bộ lọc, đã sắp giảm dần theo chi phí — client tự cắt Top N. */
    rows: DongChiTieu[];
  };
  roas: KhoiRoasNhanVien[];
  meta: {
    taoLuc: string;
    /** Tên file + tab đã đọc, để người xem biết số đến từ đâu. */
    nguon: string[];
    canhBao: string[];
  };
}

export interface AdsReportQuery {
  /** 'YYYY-MM'. */
  thang: string;
  thiTruong: LocThiTruong;
  /** 'ALL' hoặc `key` nhân viên. */
  nhanVien: string;
}
