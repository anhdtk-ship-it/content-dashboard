/* ============================================================
 * DỮ LIỆU DEMO Zalo (ZALO-04) — chỉ dùng để kiểm thử khi CHƯA nối Google Sheet thật.
 * Mô phỏng đúng mô hình mới: 2 định dạng Video/Banner (theo tên Sheet), có `title`
 * (Tên Content), KHÔNG có người phụ trách. content_code = khoá định danh ổn định.
 * Mọi mã có tiền tố "ZL-DEMO-" để dễ xoá sạch khi có dữ liệu thật (npm run zalo:seed -- --clear).
 * ========================================================== */
import { parseDdmmToReal } from '../../date-util';

export interface SeedRow {
  content_code: string;
  title: string;
  content_format: string | null;
  current_status: string;
  upload_date: string;   // dd/mm
  test_date: string;     // dd/mm | ''
}

export function buildSeedRows(): SeedRow[] {
  const rows: SeedRow[] = [];
  let seq = 0;
  const code = () => `ZL-DEMO-${String(++seq).padStart(4, '0')}`;
  const add = (format: string | null, title: string, status: string, up: string, test: string) =>
    rows.push({ content_code: code(), title, content_format: format, current_status: status, upload_date: up, test_date: test });

  /* ---------- THÁNG HIỆN TẠI 07/2026 — VIDEO ---------- */
  add('Video', 'Video review sản phẩm A', 'Duy trì', '02/07', '05/07');
  add('Video', 'Video unbox B', 'Duy trì', '03/07', '06/07');
  add('Video', 'Video hướng dẫn C', 'Duy trì', '04/07', '07/07');
  add('Video', 'Video trend D', 'Đang test', '24/07', '25/07');
  add('Video', 'Video KOL E', 'Đang test', '26/07', '27/07');
  add('Video', 'Video cũ F', 'Đang test', '03/07', '03/07');    // test quá lâu
  add('Video', 'Video thiếu ngày test G', 'Đang test', '27/07', ''); // thiếu ngày test
  add('Video', 'Video chờ chạy H', 'Tồn', '20/07', '');
  add('Video', 'Video chờ chạy I', 'Tồn', '21/07', '');
  add('Video', 'Video loại K', 'Không test', '15/07', '');
  add('Video', '', 'Đang test', '22/07', '23/07');              // thiếu Tên Content (bắt buộc)
  add('Video', 'Video chưa rõ L', '', '22/07', '');             // chưa phân loại + thiếu trạng thái
  add('Video', 'Video review sản phẩm A', 'Đang test', '28/07', '28/07'); // TRÙNG tên "Video review sản phẩm A"

  /* ---------- THÁNG HIỆN TẠI 07/2026 — BANNER ---------- */
  add('Banner', 'Banner khuyến mãi A', 'Duy trì', '04/07', '08/07');
  add('Banner', 'Banner sự kiện B', 'Duy trì', '06/07', '09/07');
  add('Banner', 'Banner mới C', 'Đang test', '24/07', '24/07');
  add('Banner', 'Banner chờ D', 'Tồn', '25/07', '');
  add('Banner', 'Banner chờ E', 'Tồn', '26/07', '');
  add('Banner', 'Banner chờ F', 'Tồn', '27/07', '');
  add('Banner', 'Banner loại G', 'Không test', '12/07', '');

  /* ---------- THÁNG TRƯỚC 06/2026 (so cùng kỳ) ---------- */
  add('Video', 'Video T6 a', 'Duy trì', '05/06', '08/06');
  add('Video', 'Video T6 b', 'Duy trì', '10/06', '13/06');
  add('Video', 'Video T6 c', 'Đang test', '20/06', '21/06');
  add('Video', 'Video T6 d', 'Tồn', '22/06', '');
  add('Video', 'Video T6 e', 'Không test', '15/06', '');
  add('Banner', 'Banner T6 a', 'Duy trì', '06/06', '09/06');
  add('Banner', 'Banner T6 b', 'Đang test', '18/06', '19/06');
  add('Banner', 'Banner T6 c', 'Tồn', '25/06', '');

  /* ---------- THÁNG CŨ 05/2026 ---------- */
  add('Video', 'Video T5 a', 'Duy trì', '05/05', '08/05');
  add('Banner', 'Banner T5 a', 'Duy trì', '09/05', '12/05');

  return rows;
}

/** Cấu hình DEMO (Leader chỉnh sau qua Dashboard). */
export const SEED_SETTINGS: { key: string; value: string }[] = [
  { key: 'test_warning_days', value: '5' },
  { key: 'warning_threshold', value: '3' },
  { key: 'target:Video', value: '40' },
  { key: 'target:Banner', value: '30' },
];

/** Chuyển SeedRow → bản ghi platform_contents (platform='zalo', assignee rỗng). */
export function toContentRow(r: SeedRow): Record<string, any> {
  return {
    platform: 'zalo',
    content_code: r.content_code,
    title: r.title,
    assignee_name: '',
    content_format: r.content_format,
    current_status: r.current_status,
    upload_date: r.upload_date,
    upload_date_real: parseDdmmToReal(r.upload_date),
    test_date: r.test_date,
    test_date_real: parseDdmmToReal(r.test_date),
    updated_at: new Date().toISOString(),
  };
}
