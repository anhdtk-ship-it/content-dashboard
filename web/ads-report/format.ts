/* Ads Report (AR-01) — helper format. Thuần, không phụ thuộc module khác. */

/* File ROAS trả số thực (vd 59.745.597,6) — LÀM TRÒN trước khi hiện, nếu không bảng sẽ
 * đầy số lẻ vô nghĩa. Excel giữ nguyên số gốc và để numFmt '#,##0' lo phần hiển thị. */
export const fmtNum = (n: number) => Math.round(n ?? 0).toLocaleString('vi-VN');
export const fmtVND = (n: number) => `${Math.round(n ?? 0).toLocaleString('vi-VN')}đ`;

/** ROAS lưu dạng thập phân (1.527) → "152,7%". */
export const fmtRoas = (x: number) => `${((x ?? 0) * 100).toFixed(2).replace('.', ',')}%`;

/** Số tiền dạng NGẮN cho thẻ KPI: 2.466.193.719 → "2,47 tỷ". Bảng vẫn dùng số đầy đủ. */
export function fmtVNDngan(n: number): string {
  const v = Math.round(n ?? 0);
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2).replace('.', ',')} tỷ`;
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')} tr`;
  if (a >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

/** Tỷ trọng 0.1234 → "12,3%". Khác fmtRoas ở chỗ chỉ 1 chữ số thập phân. */
export const fmtTyTrong = (x: number) => `${((x ?? 0) * 100).toFixed(1).replace('.', ',')}%`;

/**
 * Phân nhóm ROAS để tô màu — giúp đọc lướt biết content nào thực sự hiệu quả.
 *   >= 100% : đạt (xanh) · > 0% : chưa đạt (cam) · = 0% : chưa có (xám)
 */
export function tongRoas(x: number): 'dat' | 'chuaDat' | 'khong' {
  if ((x ?? 0) >= 1) return 'dat';
  if ((x ?? 0) > 0) return 'chuaDat';
  return 'khong';
}

export const mauRoas = (x: number) =>
  ({ dat: 'text-success', chuaDat: 'text-[#fb923c]', khong: 'text-muted' }[tongRoas(x)]);

/** 'YYYY-MM' → 'Tháng 10/2026'. */
export const fmtThang = (s: string) => (/^\d{4}-\d{2}$/.test(s) ? `Tháng ${s.slice(5)}/${s.slice(0, 4)}` : s);

/** ISO (UTC) → giờ VN dạng 'dd/MM HH:mm'. */
export function fmtGio(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Nhãn thị trường để hiển thị. */
export const nhanThiTruong = (t: 'TQ' | 'NN' | '') =>
  t === 'TQ' ? 'Nội Địa' : t === 'NN' ? 'Quốc Tế' : 'Chưa XĐ';
