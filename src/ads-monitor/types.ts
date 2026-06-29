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

/** Tham số truy vấn server-side (PHASE 5): phân trang + filter + sort. Tất cả filter chạy ở SQL. */
export interface AdsQueryParams {
  page: number;
  pageSize: number;
  content?: string | null;
  adsOwner?: string | null;
  location?: string | null;
  pageCode?: string | null;
  status?: AdsStatus | string | null;   // map sang WHERE theo amount_spent ở SQL
  dateFrom?: string | null;              // 'YYYY-MM-DD' (theo sheet_date)
  dateTo?: string | null;                // 'YYYY-MM-DD'
  sortField?: string;                    // whitelist ở SQL/route
  sortDir?: 'asc' | 'desc';
}

/** Kết quả 1 trang (PHASE 5): chỉ chứa đúng số dòng của trang + KPI (tính bằng SQL) + tổng để phân trang. */
export interface AdsQueryResult {
  items: AdsMonitorRecord[];
  total: number;                         // số dòng khớp TẤT CẢ filter (gồm status) — cho phân trang
  kpi: AdsMonitorSummary;                // KPI theo dimension+ngày (KHÔNG lọc status) — cho 6 thẻ
}
