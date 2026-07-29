/* FB-ADS-02 — format hiển thị (độc lập). */
export const MARKET_LABEL: Record<string, string> = { TQ: 'Nội Địa', NN: 'Quốc Tế' };

/** 12500000 → "12.500.000" */
export function fmtNum(n: number): string {
  return Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
export const fmtVND = (n: number) => `${fmtNum(n)} ₫`;
/** Rút gọn tiền: 12.5tr, 950k. */
export function fmtVNDShort(n: number): string {
  const v = Math.round(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}tr`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}
export const pct = (x: number) => `${Math.round((x || 0) * 1000) / 10}%`;
