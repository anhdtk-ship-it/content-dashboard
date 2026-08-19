/* Content Performance — helper format số/tiền/phần trăm (thuần, không phụ thuộc module khác). */
export const fmtNum = (n: number) => (n ?? 0).toLocaleString('vi-VN');
export const fmtVND = (n: number) => `${(n ?? 0).toLocaleString('vi-VN')}đ`;
export const fmtPct = (x: number) => `${Math.round((x ?? 0) * 10) / 10}%`;
