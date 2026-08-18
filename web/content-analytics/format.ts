/* Content Analytics — helper format số/phần trăm (thuần, không phụ thuộc module khác). */
export const fmtNum = (n: number) => (n ?? 0).toLocaleString('vi-VN');
export const fmtPct = (x: number) => `${Math.round((x ?? 0) * 10) / 10}%`;
