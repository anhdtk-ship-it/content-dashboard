/* Ads Monitor — kiểu dữ liệu (PHASE 2, mock UI). */
export type AdsStatus = 'Đã tắt' | 'Mới chạy' | 'Đang test' | 'Đang duy trì';

export interface AdsRow {
  id: number;
  content: string;
  market: 'TQ' | 'NN';   // giá trị dữ liệu; hiển thị: TQ→Nội Địa, NN→Quốc Tế
  assignee: string;
  pageCode: string;
  amountSpent: number;   // VND
  updatedAt: number;     // epoch ms
}

export interface AdsSummary {
  total: number; duyTri: number; test: number; moiChay: number; daTat: number; totalAmount: number;
}
