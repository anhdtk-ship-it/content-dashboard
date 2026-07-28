/* ============================================================
 * PHASE 13 — Weekly Report Zalo (SKELETON, ĐỘC LẬP với weekly Facebook).
 * KHÔNG import src/shared/weeklyMetrics.ts (đó là của Facebook) — Business Rule riêng.
 * Dùng ZaloStatusRule cho mọi phán đoán trạng thái.
 *
 * ⚠️ Khung mẫu: tinh chỉnh KPI theo nghiệp vụ Zalo khi có dữ liệu thật.
 *    Có thể bổ sung KPI theo content_format (Video/Banner) — điểm khác biệt của Zalo.
 * ========================================================== */
import { zaloStatusRule } from './ZaloStatusRule';
import type { ZaloContent } from './ZaloContent';
import type { ContentFormat } from '../types';

export interface ZaloWeeklyKpi {
  capped: number;                       // Đã cấp trong kỳ
  tested: number;                       // Đã chạy (isTested của Zalo)
  ton: number;                          // Tồn = cấp − test − chốt-không-chạy
  byFormat: Record<ContentFormat, number>; // ĐẶC TRƯNG ZALO: đếm theo Video/Banner
  // TODO(Zalo): thêm KPI Duy trì/tỷ lệ… theo nghiệp vụ Zalo.
}

const inPeriod = (r: ZaloContent, from: string, to: string) =>
  !!r.upload_date_real && r.upload_date_real >= from && r.upload_date_real <= to;

/** Tính KPI Zalo cho 1 tập content trong kỳ. TODO: mở rộng theo nghiệp vụ Zalo. */
export function calcZaloKpi(rows: ZaloContent[], from: string, to: string): ZaloWeeklyKpi {
  const coh = rows.filter((r) => inPeriod(r, from, to));
  const tested = coh.filter((r) => zaloStatusRule.isTested(r.current_status)).length;
  const closed = coh.filter((r) => zaloStatusRule.isClosed(r.current_status)).length;
  const byFormat: Record<ContentFormat, number> = { Video: 0, Banner: 0 };
  for (const r of coh) if (r.content_format) byFormat[r.content_format]++;
  return { capped: coh.length, tested, ton: coh.length - tested - closed, byFormat };
}
