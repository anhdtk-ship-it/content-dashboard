/* ============================================================
 * Content Performance (CP-05) — LOGIC SẮP XẾP BẢNG, thuần, KHÔNG I/O, KHÔNG JSX.
 * ------------------------------------------------------------
 * Tách riêng khỏi ContentTable.tsx để test được độc lập (cùng kiểu với
 * src/shared/weeklyMetrics.ts và web/budget/selectors.ts).
 *
 * Sắp xếp CHỈ ở client, trên dữ liệu API đã trả sẵn — KHÔNG gọi lại backend
 * (mỗi request backend phải đọc lại 2 Google Sheet, mất vài giây).
 * KHÔNG đổi số liệu, chỉ đổi thứ tự hiển thị.
 * ========================================================== */
import type { ContentPerformanceTableItem } from './contentPerformanceApi';

export type SortDir = 'asc' | 'desc';
export interface TableSort { key: string; dir: SortDir }

/**
 * 6 cột cho phép sắp xếp (chốt với chủ dự án): Chi phí · SL Data · ROAS tháng ·
 * ROAS 3 tháng · Tích cực · Tiêu cực. Trả `null` = KHÔNG có dữ liệu (khác 0).
 * Giá Data cố ý KHÔNG nằm trong danh sách — thêm sau chỉ cần 1 dòng.
 */
export const SORTERS: Record<string, (r: ContentPerformanceTableItem) => number | null> = {
  cost: (r) => r.cost,
  dataCount: (r) => r.dataCount,
  roasMonth: (r) => r.roasMonth,
  roas3Month: (r) => r.roas3Month,
  positive: (r) => (r.quality ? r.quality.positiveRate : null),
  negative: (r) => (r.quality ? r.quality.negativeRate : null),
};

export const isSortable = (key: string): boolean => key in SORTERS;

/**
 * Trả về MẢNG MỚI đã sắp xếp (không đụng mảng gốc).
 * - `sort = null` hoặc cột không hỗ trợ → giữ NGUYÊN thứ tự server trả về (Chi phí giảm dần).
 * - Dòng thiếu dữ liệu CLĐT (`quality = null`, hiển thị "—") LUÔN nằm cuối, bất kể tăng hay
 *   giảm dần: nếu coi là 0 thì khi sắp tăng dần chúng đội lên đầu, dễ đọc nhầm thành "0%".
 * - Hai dòng bằng nhau → chốt theo Chi phí giảm dần để thứ tự ổn định giữa các lần render.
 */
export function sortRows(
  rows: ContentPerformanceTableItem[],
  sort: TableSort | null,
): ContentPerformanceTableItem[] {
  if (!sort || !isSortable(sort.key)) return rows;
  const get = SORTERS[sort.key];
  const s = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va === null && vb === null) return b.cost - a.cost;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va !== vb) return (va - vb) * s;
    return b.cost - a.cost;
  });
}

/** Bấm cột đang sắp → đảo chiều; bấm cột khác → bắt đầu bằng giảm dần (cao → thấp). */
export function nextSort(current: TableSort | null, key: string): TableSort {
  return current && current.key === key
    ? { key, dir: current.dir === 'desc' ? 'asc' : 'desc' }
    : { key, dir: 'desc' };
}
