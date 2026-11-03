/* ============================================================
 * Ads Report (AR-01) — CẤU HÌNH NGHIỆP VỤ
 * ------------------------------------------------------------
 * Nơi DUY NHẤT khai báo "ai là nhân viên ads" cho báo cáo tháng. Mọi quy tắc đã chốt
 * với chủ dự án (2026-11-03) nằm ở file này để sửa 1 chỗ, không rải khắp code.
 *
 * Toàn bộ số liệu lấy từ file ROAS ("2026_Báo cáo roas kênh Facebook gửi nhân sự"):
 *   - `tenRoasTong` = giá trị cột "Tên nhân sự" trong tab tổng hợp `Roas tổng`.
 *   - `roasTab`     = tên tab chi tiết theo content của riêng người đó.
 * Hai chỗ này ghi tên KHÁC NHAU (tab dùng tên ngắn, bảng tổng dùng tên đầy đủ) nên bắt
 * buộc phải khai báo cả hai, không suy ra được từ nhau.
 * ========================================================== */

export interface NhanVienAds {
  /** Khoá kỹ thuật, dùng trong URL/JSON — không dấu, không khoảng trắng. */
  key: string;
  /** Tên ngắn hiển thị trên dashboard. */
  nhan: string;
  /** Tên đầy đủ — trùng cột "Tên nhân sự" của tab `Roas tổng`. */
  full: string;
  /** Khoá tra cứu trong tab `Roas tổng`. */
  tenRoasTong: string;
  /** Tên tab chi tiết theo content trong file ROAS. */
  roasTab: string;
}

export const NHAN_VIEN_ADS: NhanVienAds[] = [
  { key: 'hieu', nhan: 'Hiếu', full: 'Vũ Minh Hiếu', tenRoasTong: 'Vũ Minh Hiếu', roasTab: 'Roas content.Hiếu' },
  { key: 'kimanh', nhan: 'Kim Anh', full: 'Đặng Thị Kim Anh', tenRoasTong: 'Đặng Thị Kim Anh', roasTab: 'Roas content.Kim Anh' },
  { key: 'anh', nhan: 'Ánh', full: 'Nguyễn Tiến Ánh', tenRoasTong: 'Nguyễn Tiến Ánh', roasTab: 'Roas content.Ánh' },
  { key: 'lien', nhan: 'Liên', full: 'Nguyễn Thị Liên', tenRoasTong: 'Nguyễn Thị Liên', roasTab: 'Roas content.Liên' },
];

/**
 * Tên nhân sự có trong file ROAS nhưng KHÔNG đưa vào báo cáo.
 * Danh sách này chỉ để tra cứu/kiểm tra — việc loại trừ thực thi bằng cách `NHAN_VIEN_ADS`
 * là DANH SÁCH TRẮNG: ai không nằm trong đó thì không xuất hiện ở bất kỳ con số nào.
 *   - Quản Cao Khiêm: chủ dự án chốt loại bỏ hoàn toàn. Còn phát sinh T01–T03/2026
 *     (1.582.337.546 đ cả năm) nên dòng "Tổng cộng" của Sheet ở 3 tháng đó ĐÃ GỒM anh ấy
 *     → không dùng được làm dòng "cả team" (xem AdsReportService).
 *   - Facebook hotline / PR hotline: không phải người, là nhóm chiến dịch.
 */
export const KHONG_DUA_VAO_BAO_CAO = ['Quản Cao Khiêm', 'Facebook hotline', 'PR hotline'];

/** Giá trị "Tên nhân sự" của dòng tổng do chính Sheet tính (GỒM cả Khiêm). */
export const TEN_DONG_TONG_SHEET = 'Tổng cộng';

/** Tra nhân viên theo `key`. `'ALL'`/rỗng → null (nghĩa là cả team). */
export function timTheoKey(key: string): NhanVienAds | null {
  const k = (key || '').trim().toLowerCase();
  if (!k || k === 'all') return null;
  return NHAN_VIEN_ADS.find((nv) => nv.key === k) ?? null;
}
