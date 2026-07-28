/* ============================================================
 * PHASE 13 — ZaloStatusRule (ĐỘC LẬP, Business Rule riêng của Zalo).
 * KHÔNG dùng chung với FacebookStatusRule.
 *
 * ⚠️ SKELETON: các trạng thái/nhóm dưới đây là KHUNG MẪU để Zalo phát triển.
 *    Khi có Google Sheet Zalo thật, ĐIỀU CHỈNH danh sách trạng thái + cách gom
 *    nhóm + định nghĩa "đã test"/"chốt không chạy" cho đúng nghiệp vụ Zalo.
 *    Sửa Ở ĐÂY là đủ — không ảnh hưởng Facebook.
 * ========================================================== */
import type { Platform, StatusRule } from '../types';

// TODO(Zalo): thay bằng nhãn nhóm thực tế của Zalo.
const GROUP_LABEL: Record<string, string> = {
  CHO_DANG: 'Chờ đăng',
  DANG_CHAY: 'Đang chạy',
  DUY_TRI: 'Duy trì',
  DA_DUNG: 'Đã dừng',
  KHONG_DANG: 'Không đăng',
  CHUA_PHAN_LOAI: 'Chưa phân loại',
};
const GROUP_ORDER = ['CHO_DANG', 'DANG_CHAY', 'DUY_TRI', 'DA_DUNG', 'KHONG_DANG', 'CHUA_PHAN_LOAI'];

// TODO(Zalo): thay bằng trạng thái thô thực tế trên Sheet Zalo.
const ALL_STATUSES = ['Chờ đăng', 'Đang chạy', 'Duy trì', 'Đã dừng', 'Không đăng'];

export const zaloStatusRule: StatusRule = {
  platform: 'zalo' as Platform,

  // TODO(Zalo): map theo trạng thái thật của Zalo. Đây chỉ là khung mẫu.
  statusGroup(s) {
    const v = (s ?? '').trim();
    if (v === '') return 'CHUA_PHAN_LOAI';
    if (v === 'Chờ đăng') return 'CHO_DANG';
    if (v === 'Đang chạy') return 'DANG_CHAY';
    if (v.startsWith('Duy trì')) return 'DUY_TRI';
    if (v === 'Đã dừng') return 'DA_DUNG';
    if (v === 'Không đăng') return 'KHONG_DANG';
    return 'CHUA_PHAN_LOAI';
  },

  groupLabel(g) { return GROUP_LABEL[g] ?? g; },
  groupOrder() { return [...GROUP_ORDER]; },
  // TODO(Zalo): định nghĩa "đã chạy/đã đăng" theo nghiệp vụ Zalo.
  isTested(s) { const v = (s ?? '').trim(); return v === 'Đang chạy' || v.startsWith('Duy trì') || v === 'Đã dừng'; },
  isClosed(s) { return (s ?? '').trim() === 'Không đăng'; },
  allStatuses() { return [...ALL_STATUSES]; },
};
