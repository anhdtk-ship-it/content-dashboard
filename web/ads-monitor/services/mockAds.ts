/* Ads Monitor — dữ liệu MOCK (PHASE 2). KHÔNG kết nối Sheet/Supabase/API.
 * Trạng thái KHÔNG lưu ở đây — luôn tính bằng computeStatus(amountSpent). */
import type { AdsRow, AdsSummary } from '../types/ads';

const ASSIGNEES = ['Hiếu', 'Ánh', 'KA', 'Liên', 'Minh', 'Trang'];
const MARKETS: AdsRow['market'][] = ['TQ', 'NN'];
const CONTENTS = [
  'CGSĐ làm đẹp da', 'Review serum mới', 'Mini game tặng quà', 'Khách hàng thực tế',
  'So sánh trước–sau', 'Tư vấn 1-1', 'Ưu đãi cuối tháng', 'Câu chuyện khách hàng',
];
// 30 mức Amount đa dạng, phủ đủ 4 trạng thái (gồm =0, nhỏ, vừa, lớn).
const AMOUNTS = [
  0, 50_000, 99_000, 120_000, 850_000, 2_500_000, 4_999_999, 5_200_000, 12_000_000, 0,
  75_000, 100_001, 3_000_000, 6_000_000, 18_000_000, 0, 30_000, 450_000, 4_500_000, 9_000_000,
  250_000_000, 0, 100_000, 200_000, 4_000_000, 5_000_000, 7_500_000, 95_000, 1_500_000, 25_000_000,
];
const BASE = new Date(2026, 5, 26, 9, 0).getTime(); // mốc cố định để mock ổn định

export const MOCK_ADS: AdsRow[] = AMOUNTS.map((amount, i) => ({
  id: i + 1,
  content: `${CONTENTS[i % CONTENTS.length]} #${i + 1}`,
  market: MARKETS[i % MARKETS.length],
  assignee: ASSIGNEES[i % ASSIGNEES.length],
  pageCode: `PAGE${String((i % 12) + 1).padStart(3, '0')}`,
  amountSpent: amount,
  updatedAt: BASE - i * 3_600_000, // lùi mỗi dòng 1 giờ
}));

// Thanh KPI: số tổng quan mock (đại diện toàn bộ dữ liệu, không phải 30 dòng bảng).
export const MOCK_SUMMARY: AdsSummary = {
  total: 1250, duyTri: 325, test: 510, moiChay: 210, daTat: 205, totalAmount: 2_350_000_000,
};
