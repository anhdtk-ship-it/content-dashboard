/* Ads Monitor — Data Layer types (PHASE 3). Module độc lập, không dùng kiểu của module khác. */

export type AdsStatus = 'Đã tắt' | 'Mới chạy' | 'Đang test' | 'Đang duy trì';

/** Bản ghi LƯU TRỮ (bảng ads_monitor). KHÔNG có `status` — status được tính từ amount_spent. */
export interface AdsMonitorRecord {
  id: number;
  content: string;
  location: string;        // 'TQ' | 'NN' (giá trị dữ liệu thô)
  ads_owner: string;
  page_code: string;
  amount_spent: number;    // VND
  updated_at: string;      // ISO datetime
  created_at: string;      // ISO datetime
  sheet_date: string | null; // ngày của dòng trên Sheet (Phase 4)
}

/** Bản ghi TRẢ RA (đã kèm status tính động). */
export interface AdsMonitorDTO extends AdsMonitorRecord {
  status: AdsStatus;
}

/** Thống kê KPI (tính từ status). */
export interface AdsMonitorSummary {
  total: number; duyTri: number; test: number; moiChay: number; daTat: number; totalAmount: number;
}
