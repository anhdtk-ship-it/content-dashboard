/* ============================================================
 * Content Analytics (PHASE CONTENT-ANALYTICS-03) — MODULE MỚI, ĐỘC LẬP.
 * Phân tích tỷ lệ Data (purchases) từ Content MỚI/CŨ theo tháng, đọc trực tiếp
 * Google Sheet Raw_Data (Ads). KHÔNG liên quan Ads Monitor / Facebook Content Sync /
 * Zalo / Auth — chỉ dùng chung createGoogleAuth() và requireAuth (không sửa 2 file đó).
 * ========================================================== */

/** 1 dòng thô cần thiết từ Raw_Data (chỉ các trường dùng cho business rule). */
export interface RawAdsAnalyticsRow {
  date: string;          // 'YYYY-MM-DD'
  adId: string;
  adName: string;        // dùng để suy ra Content (normalize)
  accountId: string;     // CHỈ dùng nội bộ cho khóa dedup — KHÔNG xuất ra API/UI
  accountName: string;   // Nguồn để suy ra Employee — xem resolveEmployee() (PHASE 04):
                          // chỉ nhận diện 1 trong 4 tên cố định KA/Hiếu/Ánh/Liên, còn lại
                          // → UNKNOWN_EMPLOYEE. KHÔNG hiển thị accountName nguyên văn ra UI.
  campaignId: string;    // CHỈ dùng nội bộ cho khóa dedup
  adsetId: string;       // CHỈ dùng nội bộ cho khóa dedup
  purchases: number;     // Data
}

export type ContentType = 'new' | 'old';
export type ContentTypeFilter = 'all' | ContentType;

export interface EmployeeDataSlice { employee: string; data: number }

export interface ByContentItem {
  content: string;
  employee: string;                    // các employee nối bằng ", " (không ép về 1 người)
  firstSeen: string;                    // 'YYYY-MM-DD' — MIN(date) toàn bộ lịch sử
  type: ContentType;
  data: number;                         // SUM purchases của content trong tháng
  pctOfTotal: number;                   // % trên tổng data đang hiển thị (đã áp filter)
  employeeBreakdown: EmployeeDataSlice[]; // bổ sung minh bạch — không thay business rule
}

export interface ByEmployeeItem {
  employee: string;
  dataNew: number;
  dataOld: number;
  dataTotal: number;
  pctNew: number;
  pctOld: number;
}

export interface ContentAnalyticsOverview {
  dataNew: number;
  dataOld: number;
  dataTotal: number;
  pctNew: number;
  pctOld: number;
}

export interface ContentAnalyticsMeta {
  historyStartDate: string | null; // MIN(date) toàn bộ Raw_Data sau dedup
  rowsRead: number;                // số dòng đọc thô từ Sheet (toàn bộ lịch sử)
  rowsAfterDedup: number;          // số dòng còn lại sau dedup (toàn bộ lịch sử)
  duplicateGroups: number;         // số nhóm (date,ad_id,account_id,campaign_id,adset_id) có >1 dòng
  contentsUnknownEmployee: number; // số Content (trong kết quả đang hiển thị) có employee = "(Không xác định)"
  warnings: string[];
}

export interface ContentAnalyticsResult {
  month: string; // 'YYYY-MM'
  overview: ContentAnalyticsOverview;
  byContent: ByContentItem[];
  byEmployee: ByEmployeeItem[];
  meta: ContentAnalyticsMeta;
}

export interface ContentAnalyticsParams {
  month: string;              // 'YYYY-MM'
  employee: string;           // 'ALL' hoặc account_name chính xác
  type: ContentTypeFilter;    // 'all' | 'new' | 'old'
  search: string;             // substring khớp Content (không phân biệt hoa/thường)
}

/** Đúng 4 nhân viên Ads thật (PHASE 04) — thứ tự cố định dùng để hiển thị bảng Nhân viên. */
export const EMPLOYEE_NAMES = ['KA', 'Hiếu', 'Ánh', 'Liên'] as const;

export const UNKNOWN_EMPLOYEE = 'Không xác định';
