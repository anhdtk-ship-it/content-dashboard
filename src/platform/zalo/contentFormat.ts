/* ============================================================
 * content_format của Zalo — KIỂU TỰ DO, KHÔNG hardcode Video/Banner.
 * ------------------------------------------------------------
 * Yêu cầu ZALO-01 §VIII/§IX/#9: Dashboard tự hiển thị mọi định dạng có trong dữ liệu
 * (hoặc có cấu hình mục tiêu) — thêm 'TikTok', 'Story'… KHÔNG cần sửa code.
 * Vì vậy KHÔNG có danh sách cố định; chỉ chuẩn hoá chuỗi thô từ Sheet.
 * ========================================================== */
import type { ContentFormat } from '../types';

/**
 * Chuẩn hoá giá trị content_format thô từ Sheet Zalo.
 *  - cắt khoảng trắng thừa,
 *  - gộp khoảng trắng liên tiếp,
 *  - GIỮ NGUYÊN cách viết (không ép Video/Banner) để hỗ trợ định dạng bất kỳ.
 * Trả null nếu rỗng.
 */
export function parseContentFormat(v: unknown): ContentFormat | null {
  const s = (v ?? '').toString().trim().replace(/\s+/g, ' ');
  return s === '' ? null : s;
}

/** Nhãn hiển thị cho định dạng chưa phân loại (content_format rỗng). */
export const UNSPECIFIED_FORMAT_LABEL = 'Chưa có định dạng';

export type { ContentFormat };
