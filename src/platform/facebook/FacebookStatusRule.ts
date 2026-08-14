/* ============================================================
 * PHASE 13 — FacebookStatusRule.
 * Cài đặt StatusRule cho nền tảng Facebook.
 *
 * ⚠️ File MỚI. SAO Y NGUYÊN VĂN công thức trạng thái Facebook đang chạy trong
 *    `src/server.ts` (statusGroup / GROUP_LABEL / S_TESTED). KHÔNG import và
 *    KHÔNG sửa server.ts → Dashboard Facebook giữ nguyên 100%. Đây là bản
 *    "gương" để tầng đa-nền-tảng gọi qua interface chung; nếu sau này FB đổi
 *    rule thì cập nhật ĐỒNG BỘ cả hai (hiện chưa được phép đổi FB).
 *
 * KHÔNG dùng chung với ZaloStatusRule.
 * ========================================================== */
import type { Platform, StatusRule } from '../types';

// ----- Sao y src/server.ts -----
const GROUP_LABEL: Record<string, string> = {
  CHO_CHAY: 'Chờ chạy', CHO_DANG_BAI: 'Chờ đăng bài', DANG_TEST: 'Đang test', DUY_TRI: 'Duy trì',
  DA_DUNG: 'Đã dừng', KHONG_TEST: 'Không test', KHONG_DUYET: 'Không duyệt', CHUA_PHAN_LOAI: 'Chưa phân loại',
};
const GROUP_ORDER = ['CHO_CHAY', 'CHO_DANG_BAI', 'DANG_TEST', 'DUY_TRI', 'DA_DUNG', 'KHONG_TEST', 'KHONG_DUYET', 'CHUA_PHAN_LOAI'];

// "Đã test" của FB (server.ts S_TESTED): Đang test + Duy trì* + Đã test-ko chạy + Đã chạy-Tắt.
const TESTED = new Set(['Đang test', 'Duy trì - Chưa vít', 'Duy trì - Đã vít', 'Đã test-ko chạy', 'Đã chạy-Tắt']);

// Danh sách trạng thái thô hợp lệ (theo Sheet FB hiện tại).
const ALL_STATUSES = [
  'Chờ chạy', 'Chờ đăng bài', 'Đang test', 'Duy trì - Chưa vít', 'Duy trì - Đã vít',
  'Đã test-ko chạy', 'Đã chạy-Tắt', 'Không test', 'Không được duyệt',
];

export const facebookStatusRule: StatusRule = {
  platform: 'facebook' as Platform,

  statusGroup(s) {
    const v = (s ?? '').trim();
    if (v === '') return 'CHUA_PHAN_LOAI';
    if (v === 'Chờ chạy') return 'CHO_CHAY';
    if (v === 'Chờ đăng bài') return 'CHO_DANG_BAI';
    if (v === 'Đang test') return 'DANG_TEST';
    if (v.startsWith('Duy trì')) return 'DUY_TRI';
    if (v === 'Đã test-ko chạy' || v === 'Đã chạy-Tắt') return 'DA_DUNG';
    if (v === 'Không test') return 'KHONG_TEST';
    if (v === 'Không được duyệt') return 'KHONG_DUYET';
    return 'CHUA_PHAN_LOAI';
  },

  groupLabel(g) { return GROUP_LABEL[g] ?? g; },
  groupOrder() { return [...GROUP_ORDER]; },
  isTested(s) { return TESTED.has((s ?? '').trim()); },
  isClosed(s) { const v = (s ?? '').trim(); return v === 'Không test' || v === 'Không được duyệt'; },
  allStatuses() { return [...ALL_STATUSES]; },
};
