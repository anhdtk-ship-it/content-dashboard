/* PHASE 13 — Kiểu bản ghi content Zalo. RIÊNG Zalo (có content_format). */
import type { ContentFormat } from '../types';

export interface ZaloContent {
  content_code: string;
  assignee_name: string;
  content_format: ContentFormat | null; // Video | Banner — CHỈ Zalo
  current_status: string;               // trạng thái thô (ZaloStatusRule map nhóm)
  upload_date_real: string | null;      // 'YYYY-MM-DD'
  test_date_real: string | null;
  // TODO(Zalo): bổ sung cột theo Sheet Zalo thực tế (market? page? …).
}
