/* Ads Monitor — format hiển thị (PHASE 5). */

export const MARKET_LABEL: Record<string, string> = { TQ: 'Nội Địa', NN: 'Quốc Tế' };

/** 12500000 -> "12.500.000 VNĐ" */
export function formatVND(n: number): string {
  const v = Math.max(0, Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v} VNĐ`;
}

/** 1250 -> "1.250" */
export function formatNumber(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** ISO string | epoch ms -> "dd/MM/yyyy HH:mm" */
export function formatDateTime(v: string | number): string {
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
