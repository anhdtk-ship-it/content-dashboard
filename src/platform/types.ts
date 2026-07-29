/* ============================================================
 * PHASE 13 — Multi-Platform (Facebook + Zalo): INTERFACE CHUNG.
 * ------------------------------------------------------------
 * Lớp trừu tượng ĐỘC LẬP, chỉ THÊM MỚI. KHÔNG sửa bất kỳ file Facebook nào
 * (server.ts / tokens.ts / StatusBadge.tsx / content-sync / ads-monitor / weekly …).
 *
 * Nguyên tắc: mỗi nền tảng có Business Rule RIÊNG nhưng cùng tuân theo interface này,
 * nên tầng dùng (dashboard/sync/report mới) chỉ gọi `StatusRule` chung — không phụ thuộc
 * chi tiết từng nền tảng. Facebook và Zalo KHÔNG dùng chung logic trạng thái.
 * ========================================================== */

export type Platform = 'facebook' | 'zalo';

/** Định dạng content — CHỈ các nền tảng có content_format dùng (VD Zalo). Facebook KHÔNG có.
 *  KIỂU TỰ DO (string): KHÔNG hardcode 'Video'/'Banner' → thêm định dạng mới (VD 'TikTok Ads',
 *  'Story') chỉ cần có dữ liệu/cấu hình, Dashboard tự hiển thị, không phải sửa code. */
export type ContentFormat = string;

/** Màu/nhãn hiển thị 1 nhóm trạng thái (tuỳ chọn — nền tảng có thể tự định nghĩa). */
export interface StatusStyle {
  label: string;
  bg?: string;
  fg?: string;
}

/** ============================================================
 * StatusRule — HỢP ĐỒNG CHUNG cho công thức trạng thái của MỘT nền tảng.
 * Mỗi nền tảng cài đặt riêng (FacebookStatusRule / ZaloStatusRule).
 * ========================================================== */
export interface StatusRule {
  /** Nền tảng sở hữu rule này. */
  readonly platform: Platform;

  /** Gom trạng thái thô (current_status) → khoá nhóm (VD 'DUY_TRI'). */
  statusGroup(status: string | null | undefined): string;

  /** Nhãn hiển thị của 1 khoá nhóm. */
  groupLabel(group: string): string;

  /** Danh sách khoá nhóm theo thứ tự hiển thị. */
  groupOrder(): string[];

  /** "Đã test / đã đưa vào chạy" — tuỳ nghiệp vụ từng nền tảng. */
  isTested(status: string | null | undefined): boolean;

  /** "Đã chốt không chạy" (không tính tồn) — tuỳ nền tảng; mặc định false. */
  isClosed(status: string | null | undefined): boolean;

  /** Toàn bộ trạng thái hợp lệ của nền tảng (để validate/hiển thị bộ lọc). */
  allStatuses(): string[];
}

/** ============================================================
 * PlatformModule — cấu hình 1 nền tảng, đăng ký vào registry.
 * ========================================================== */
export interface PlatformModule {
  readonly platform: Platform;
  /** Tên hiển thị (VD 'Facebook', 'Zalo'). */
  readonly label: string;
  /** Rule trạng thái riêng của nền tảng. */
  readonly statusRule: StatusRule;
  /** Có dùng trường content_format (Video/Banner) không. FB=false, Zalo=true. */
  readonly hasContentFormat: boolean;
  /** Tên biến env chứa Google Sheet ID nguồn (mỗi nền tảng 1 Sheet riêng). */
  readonly sheetEnvKey: string;
}
