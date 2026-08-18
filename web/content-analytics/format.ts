/* Content Analytics — helper format số/phần trăm/giờ (thuần, không phụ thuộc module khác). */
export const fmtNum = (n: number) => (n ?? 0).toLocaleString('vi-VN');
export const fmtPct = (x: number) => `${Math.round((x ?? 0) * 10) / 10}%`;

const pad2 = (n: number) => String(n).padStart(2, '0');
/** "18/08/2026 12:30" — thời điểm client fetch xong dữ liệu (KHÔNG phải giờ Sheet cập nhật). */
export const fmtDateTime = (d: Date) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
