/* Ads Monitor — kiểu dữ liệu frontend (PHASE 5: khớp DTO + response phân trang từ API /ads-monitor). */
export type AdsStatus = 'Đã tắt' | 'Mới chạy' | 'Đang test' | 'Đang duy trì';

/** 1 dòng từ API (status đã được tính ở backend bằng calculateAdsStatus). */
export interface AdsItem {
  id: number;
  content: string;
  location: string;       // giá trị thô (vd TQ/NN) → hiển thị qua MARKET_LABEL
  ads_owner: string;
  page_code: string;
  amount_spent: number;
  updated_at: string;     // ISO
  sheet_date?: string | null;
  status: AdsStatus;
}

export interface AdsSummary {
  total: number; duyTri: number; test: number; moiChay: number; daTat: number; totalAmount: number;
}

/** Response phân trang server-side (1 trang items + KPI + tổng). */
export interface AdsResponse {
  items: AdsItem[];
  summary: AdsSummary;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  source: string;
  generatedAt: string;
}

/** Trạng thái bộ lọc (gửi lên server). */
export interface AdsFilterState {
  content: string;
  adsOwner: string;
  location: string;
  pageCode: string;
  status: string;
}

export const EMPTY_FILTERS: AdsFilterState = {
  content: '', adsOwner: 'ALL', location: 'ALL', pageCode: '', status: 'ALL',
};
