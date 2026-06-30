/* Ads Monitor — thuật toán TRẠNG THÁI (PHASE 7: Lifecycle + Current Status).
 * Trạng thái KHÔNG còn chỉ dựa amount_spent. Quy tắc:
 *   1) Chi tiêu NGÀY MỚI NHẤT trong kỳ = 0  → "Đã tắt"  (không xét Lifecycle).
 *   2) Chi tiêu ngày mới nhất > 0 → theo Lifecycle: NEW→"Mới chạy" · TEST→"Đang test" · MAINTAIN→"Đang duy trì".
 * KHÔNG hardcode/lưu cứng trạng thái — luôn tính từ (latest_amount, lifecycle). */
import type { AdsStatus, Lifecycle } from './types';

export function calculateAdsStatus(latestAmount: number, lifecycle: Lifecycle): AdsStatus {
  if (!(latestAmount > 0)) return 'Đã tắt';   // chi tiêu hôm nay = 0 (hoặc thiếu) → tắt
  switch (lifecycle) {
    case 'MAINTAIN': return 'Đang duy trì';
    case 'TEST':     return 'Đang test';
    default:         return 'Mới chạy';        // NEW
  }
}

/* ---- Lifecycle helpers (dùng cho mock + tham chiếu logic refresh trong SQL) ---- */

/** Lifecycle theo TỔNG CHI TIÊU ĐỜI: >3.000.000 MAINTAIN · >100.000 TEST · còn lại NEW. */
export function lifecycleFromLifetime(lifetimeSpent: number): Lifecycle {
  if (lifetimeSpent > 3_000_000) return 'MAINTAIN';
  if (lifetimeSpent > 100_000) return 'TEST';
  return 'NEW';
}

const RANK: Record<Lifecycle, number> = { NEW: 0, TEST: 1, MAINTAIN: 2 };

/** Nâng cấp MONOTONIC — chỉ giữ hạng cao hơn, không bao giờ hạ cấp. */
export function upgradeLifecycle(prev: Lifecycle, next: Lifecycle): Lifecycle {
  return RANK[next] > RANK[prev] ? next : prev;
}
