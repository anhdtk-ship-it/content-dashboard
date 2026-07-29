/* ============================================================
 * ZaloStatusRule — Business Rule TRẠNG THÁI của Zalo (ĐỘC LẬP với Facebook).
 * ------------------------------------------------------------
 * KHÔNG dùng chung với FacebookStatusRule. Chỉ áp dụng cho Dashboard/Weekly/Sync Zalo.
 *
 * ĐỊNH NGHĨA (chốt theo spec ZALO-01 §III):
 *   "Không test"  → KHONG_TEST   : NV quyết định không test (đã chốt không chạy).
 *   "Tồn"         → TON           : chờ chạy (backlog cần xử lý — KHÁC Facebook).
 *   "Đang test"   → DANG_TEST     : đang chạy test.
 *   "Duy trì"     → DUY_TRI       : content hiệu quả được duy trì.
 *   (rỗng/khác)   → CHUA_PHAN_LOAI: thiếu/không nhận diện được trạng thái.
 *
 *   isTested (đã đưa vào test) = DANG_TEST hoặc DUY_TRI.
 *   isClosed (đã chốt không chạy, KHÔNG tính Tồn) = KHONG_TEST.
 *     → Tồn KHÔNG phải "closed": vẫn là việc tồn đọng cần xử lý.
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

// Trạng thái thô hợp lệ trên Sheet Zalo.
const ALL_STATUSES = ['Tồn', 'Đang test', 'Duy trì', 'Không test'];

/** Chuẩn hoá 1 trạng thái thô → khoá nhóm. Chấp nhận biến thể "Duy trì - ..." nếu Sheet dùng. */
function toGroup(s: string | null | undefined): string {
  const v = (s ?? '').trim();
  if (v === '') return 'CHUA_PHAN_LOAI';
  if (v === 'Không test') return 'KHONG_TEST';
  if (v === 'Tồn') return 'TON';
  if (v === 'Đang test') return 'DANG_TEST';
  if (v === 'Duy trì' || v.startsWith('Duy trì')) return 'DUY_TRI';
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
