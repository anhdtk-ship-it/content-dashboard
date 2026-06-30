/* Weekly Report — format hiển thị (PHASE 8). Riêng module, không dùng chung Dashboard. */

export const fmtNum = (n: number) => (Number(n) || 0).toLocaleString('vi-VN');

/** Tỷ lệ làm tròn 1 chữ số thập phân (vd 0.792 → "79.2%"). Theo §6. */
export const fmtPct1 = (x: number) => `${((Number(x) || 0) * 100).toFixed(1)}%`;
