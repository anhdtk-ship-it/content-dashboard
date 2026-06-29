/* Ads Monitor — format & tính trạng thái (PHASE 2). */
import type { AdsStatus } from '../types/ads';

export const MARKET_LABEL: Record<'TQ' | 'NN', string> = { TQ: 'Nội Địa', NN: 'Quốc Tế' };

/** 12500000 -> "12.500.000 VNĐ" */
export function formatVND(n: number): string {
  const v = Math.max(0, Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v} VNĐ`;
}

/** 1250 -> "1.250" */
export function formatNumber(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Trạng thái LUÔN tính từ Amount Spent (không lưu cứng).
 *  =0 → Đã tắt · 1–100.000 → Mới chạy · 100.001–4.999.999 → Đang test · ≥5.000.000 → Đang duy trì */
export function computeStatus(amount: number): AdsStatus {
  if (amount <= 0) return 'Đã tắt';
  if (amount <= 100_000) return 'Mới chạy';
  if (amount <= 4_999_999) return 'Đang test';
  return 'Đang duy trì';
}

/** epoch ms -> "dd/MM/yyyy HH:mm" */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
