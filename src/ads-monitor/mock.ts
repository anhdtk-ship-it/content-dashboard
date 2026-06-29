/* Ads Monitor — dữ liệu MOCK cho Data Layer (PHASE 3).
 * KHÔNG đọc Google Sheet / Supabase. KHÔNG lưu status (tính ở tầng app). */
import type { AdsMonitorRecord } from './types';

const OWNERS = ['Hiếu', 'Ánh', 'KA', 'Liên', 'Minh', 'Trang'];
const LOCS: AdsMonitorRecord['location'][] = ['TQ', 'NN'];
const CONTENTS = [
  'CGSĐ làm đẹp da', 'Review serum mới', 'Mini game tặng quà', 'Khách hàng thực tế',
  'So sánh trước–sau', 'Tư vấn 1-1', 'Ưu đãi cuối tháng', 'Câu chuyện khách hàng',
];
// 30 mức amount đa dạng (gồm =0, nhỏ, vừa, lớn) → phủ đủ 4 trạng thái.
const AMOUNTS = [
  0, 50_000, 99_000, 120_000, 850_000, 2_500_000, 4_999_999, 5_200_000, 12_000_000, 0,
  75_000, 100_001, 3_000_000, 6_000_000, 18_000_000, 0, 30_000, 450_000, 4_500_000, 9_000_000,
  250_000_000, 0, 100_000, 200_000, 4_000_000, 5_000_000, 7_500_000, 95_000, 1_500_000, 25_000_000,
];
const BASE = Date.UTC(2026, 5, 26, 2, 0); // mốc cố định để mock ổn định

export const MOCK_ADS_RECORDS: AdsMonitorRecord[] = AMOUNTS.map((amount, i) => {
  const updated = new Date(BASE - i * 3_600_000);
  const created = new Date(BASE - i * 86_400_000);
  return {
    id: i + 1,
    content: `${CONTENTS[i % CONTENTS.length]} #${i + 1}`,
    location: LOCS[i % LOCS.length],
    ads_owner: OWNERS[i % OWNERS.length],
    page_code: `PAGE${String((i % 12) + 1).padStart(3, '0')}`,
    amount_spent: amount,
    updated_at: updated.toISOString(),
    created_at: created.toISOString(),
    sheet_date: created.toISOString().slice(0, 10),
  };
});
