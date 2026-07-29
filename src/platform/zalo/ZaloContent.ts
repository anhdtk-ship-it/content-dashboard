/* Kiểu bản ghi content Zalo (ĐỘC LẬP với Facebook).
 * ZALO-04: content_format suy ra từ TÊN SHEET (Video/Banner). KHÔNG có market/người phụ trách.
 * `title` = Tên Content. `content_code` = khoá định danh ỔN ĐỊNH (Content ID / Trello / hash). */
import type { ContentFormat } from '../types';

export interface ZaloContent {
  content_code: string;                  // khoá định danh ổn định (KHÔNG phải số dòng Sheet)
  title: string;                         // Tên Content
  assignee_name: string;                 // Zalo KHÔNG có người phụ trách → '' (giữ để hợp khoá bảng)
  content_format: ContentFormat | null;  // 'Video' | 'Banner' … (theo tên Sheet)
  current_status: string;                // trạng thái thô (ZaloStatusRule map nhóm)
  upload_date: string;                   // Ngày Up Trello (chuỗi gốc)
  upload_date_real: string | null;       // 'YYYY-MM-DD'
  test_date: string;                     // Ngày test (chuỗi gốc)
  test_date_real: string | null;         // 'YYYY-MM-DD'
}

export interface ZaloContentRow extends ZaloContent {
  id?: string;
  platform?: string;
}
