/* ============================================================
 * ZaloStatusRule — Business Rule TRẠNG THÁI của Zalo (ĐỘC LẬP với Facebook).
 * ------------------------------------------------------------
 * KHÔNG dùng chung với FacebookStatusRule. Chỉ áp dụng cho Dashboard/Weekly/Sync Zalo.
 *
 * ĐỊNH NGHĨA (chốt theo dữ liệu THẬT — cột "TT Team" trên Sheet Zalo):
 *   "đang chạy"  → DUY_TRI      : content đang chạy = Duy trì.
 *   "chờ chạy"   → TON          : Tồn (backlog cần xử lý).
 *   "không chạy" → KHONG_TEST   : Không test (đã chốt không chạy).
 *   (rỗng/khác)  → CHUA_PHAN_LOAI: content chưa có trạng thái (cột "tình trạng content" trống).
 *   (giữ tương thích các nhãn cũ: Duy trì / Tồn / Không test / Đang test.)
 *
 *   isTested (đã đưa vào chạy) = DUY_TRI (đang chạy) hoặc DANG_TEST.
 *   isClosed (đã chốt không chạy, KHÔNG tính Tồn) = KHONG_TEST (không chạy).
 * ========================================================== */
import type { Platform, StatusRule } from '../types';

/** Khoá nhóm trạng thái Zalo. */
export const ZALO_GROUPS = {
  KHONG_TEST: 'KHONG_TEST',
  TON: 'TON',
  DANG_TEST: 'DANG_TEST',
  DUY_TRI: 'DUY_TRI',
  CHUA_PHAN_LOAI: 'CHUA_PHAN_LOAI',
} as const;

const GROUP_LABEL: Record<string, string> = {
  KHONG_TEST: 'Không test',
  TON: 'Tồn',
  DANG_TEST: 'Đang test',
  DUY_TRI: 'Duy trì',
  CHUA_PHAN_LOAI: 'Chưa phân loại',
};

// Thứ tự hiển thị theo luồng nghiệp vụ: Tồn → Đang test → Duy trì → Không test → Chưa phân loại.
const GROUP_ORDER = ['TON', 'DANG_TEST', 'DUY_TRI', 'KHONG_TEST', 'CHUA_PHAN_LOAI'];

// Trạng thái thô hợp lệ trên Sheet Zalo (cột "TT Team").
const ALL_STATUSES = ['đang chạy', 'chờ chạy', 'không chạy'];

/** Chuẩn hoá 1 trạng thái thô ("TT Team") → khoá nhóm. So khớp không phân biệt hoa/thường/khoảng trắng. */
function toGroup(s: string | null | undefined): string {
  const v = (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (v === '') return 'CHUA_PHAN_LOAI';
  // Bộ trạng thái THẬT của Zalo:
  if (v === 'đang chạy') return 'DUY_TRI';
  if (v === 'chờ chạy') return 'TON';
  if (v === 'không chạy') return 'KHONG_TEST';
  // Tương thích nhãn cũ (nếu Sheet dùng):
  if (v === 'duy trì' || v.startsWith('duy trì')) return 'DUY_TRI';
  if (v === 'tồn') return 'TON';
  if (v === 'không test') return 'KHONG_TEST';
  if (v === 'đang test') return 'DANG_TEST';
  return 'CHUA_PHAN_LOAI';
}

export const zaloStatusRule: StatusRule = {
  platform: 'zalo' as Platform,

  statusGroup(s) { return toGroup(s); },
  groupLabel(g) { return GROUP_LABEL[g] ?? g; },
  groupOrder() { return [...GROUP_ORDER]; },

  /** Đã đưa vào test = Đang test hoặc Duy trì. */
  isTested(s) { const g = toGroup(s); return g === 'DANG_TEST' || g === 'DUY_TRI'; },

  /** Đã chốt không chạy = Không test (Tồn KHÔNG tính — vẫn là việc cần xử lý). */
  isClosed(s) { return toGroup(s) === 'KHONG_TEST'; },

  allStatuses() { return [...ALL_STATUSES]; },
};

/** Tiện ích: là trạng thái "Duy trì" không. */
export const isDuyTri = (s: string | null | undefined) => toGroup(s) === 'DUY_TRI';
