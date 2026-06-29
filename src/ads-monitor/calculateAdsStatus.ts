/* Ads Monitor — utility tính trạng thái (PHASE 3).
 * Status LUÔN tính từ amount_spent — KHÔNG lưu cứng, KHÔNG viết trong component.
 *   =0            → Đã tắt
 *   1–100.000     → Mới chạy
 *   100.001–4.999.999 → Đang test
 *   ≥5.000.000    → Đang duy trì
 */
import type { AdsStatus } from './types';

export function calculateAdsStatus(amountSpent: number): AdsStatus {
  if (amountSpent <= 0) return 'Đã tắt';
  if (amountSpent <= 100_000) return 'Mới chạy';
  if (amountSpent <= 4_999_999) return 'Đang test';
  return 'Đang duy trì';
}
