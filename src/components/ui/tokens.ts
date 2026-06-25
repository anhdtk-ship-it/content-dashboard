// Bảng màu trạng thái & thị trường — nguồn: DESIGN_SYSTEM.md §11.
export const STATUS_GROUPS = {
  CHO_CHAY: { label: 'Chờ chạy', bg: '#3a3320', fg: '#fde68a' },
  DANG_TEST: { label: 'Đang test', bg: '#3a2a14', fg: '#fbbf24' },
  DUY_TRI: { label: 'Duy trì', bg: '#0f3320', fg: '#34d399' },
  DA_DUNG: { label: 'Đã dừng', bg: '#22293a', fg: '#94a3b8' },
  KHONG_DUYET: { label: 'Không duyệt', bg: '#3a1d1d', fg: '#f87171' },
  CHUA_PHAN_LOAI: { label: 'Chưa phân loại', bg: '#2a2030', fg: '#c4b5fd' },
} as const;

export const MARKETS = {
  noi_dia: { label: 'Nội Địa', bg: '#0f3d3a', fg: '#5eead4' },
  quoc_te: { label: 'Quốc Tế', bg: '#2b2b6b', fg: '#b6c2ff' },
} as const;

export type StatusGroupKey = keyof typeof STATUS_GROUPS;
export type MarketKey = keyof typeof MARKETS;

/**
 * Chuẩn màu trạng thái theo nghiệp vụ Seryn (S3-001.1) — keyed theo current_status GỐC.
 * Duy trì → xanh lá · Đang test → vàng · Chờ chạy → cam · Không duyệt → đỏ
 * Đã test-ko chạy → xám · Đã chạy-Tắt → xanh dương nhạt.
 * Kèm mức độ cảnh báo (severity) chỉ để HIỂN THỊ, không đổi logic.
 */
export interface StatusStyle { label: string; bg: string; fg: string; severity?: string; }
export function statusStyle(raw?: string): StatusStyle {
  const v = (raw ?? '').trim();
  if (v.startsWith('Duy trì')) return { label: v, bg: '#0f3320', fg: '#34d399', severity: 'Ổn định' };       // xanh lá
  if (v === 'Đã chạy-Tắt') return { label: v, bg: '#13283a', fg: '#7dd3fc' };                                  // xanh dương nhạt
  if (v === 'Đã test-ko chạy') return { label: v, bg: '#22293a', fg: '#94a3b8' };                              // xám
  if (v === 'Đang test') return { label: v, bg: '#3a2a14', fg: '#fbbf24', severity: 'Theo dõi' };             // vàng
  if (v === 'Chờ chạy') return { label: v, bg: '#3a2410', fg: '#fb923c', severity: 'Cần xử lý' };             // cam
  if (v === 'Không được duyệt') return { label: v, bg: '#3a1d1d', fg: '#f87171', severity: 'Khẩn cấp' };      // đỏ
  return { label: v || 'Chưa phân loại', bg: '#2a2030', fg: '#c4b5fd' };
}
/** Màu theo status_group (cho biểu đồ gom nhóm). DA_DUNG = xám (mix). */
export function groupStyle(group: string): StatusStyle {
  switch (group) {
    case 'DUY_TRI': return { label: 'Duy trì', bg: '#0f3320', fg: '#34d399', severity: 'Ổn định' };
    case 'DANG_TEST': return { label: 'Đang test', bg: '#3a2a14', fg: '#fbbf24', severity: 'Theo dõi' };
    case 'CHO_CHAY': return { label: 'Chờ chạy', bg: '#3a2410', fg: '#fb923c', severity: 'Cần xử lý' };
    case 'KHONG_DUYET': return { label: 'Không duyệt', bg: '#3a1d1d', fg: '#f87171', severity: 'Khẩn cấp' };
    case 'DA_DUNG': return { label: 'Đã dừng', bg: '#22293a', fg: '#94a3b8' };
    default: return { label: 'Chưa phân loại', bg: '#2a2030', fg: '#c4b5fd' };
  }
}
