/* ============================================================
 * Content Performance (CP-04) — MODULE MỚI, ĐỘC LẬP với Content Analytics.
 * V1 CHỈ kênh Facebook (CGSĐ/BS/mess Nữ MB/remar/hotline) — PR để dành V2 theo quyết định
 * đã chốt (Tên content của PR là tên chiến dịch chữ, không phải content_code số, không
 * join được với Content Sheet theo cùng cơ chế).
 * ========================================================== */

export type GeographyFilter = 'all' | 'noi_dia' | 'quoc_te';

/** 1 dòng Content thô đọc từ Performance Sheet (đã lọc kênh Facebook, đã bỏ dòng rác). */
export interface PerformanceMonthMetrics {
  cost: number;
  dataCount: number;
  dataPrice: number;
  roasMonth: number;   // đơn vị % (vd 146.33 nghĩa là 146,33%)
  roas3Month: number;  // % — ĐÃ TÍNH SẴN trong Sheet, KHÔNG tự tính lại công thức rolling
}
export interface PerformanceGeoMetrics {
  total: PerformanceMonthMetrics;
  noiDia: PerformanceMonthMetrics;
  quocTe: PerformanceMonthMetrics;
}
export interface RawPerformanceContentRow {
  channel: string;                          // "Facebook CGSĐ" | "Facebook BS" | ...
  contentName: string;                      // "Tên content" thô từ Sheet
  months: Record<string, PerformanceGeoMetrics>; // key = 'YYYY-MM'
}

/** KHÓA nhóm hợp lệ để tra `subtotals` — đúng nhãn "Phân loại" trong Sheet, cộng 1 khóa tổng riêng. */
export const TOTAL_FACEBOOK_KEY = 'Tổng kênh Facebook';
export interface PerformanceSheetData {
  contents: RawPerformanceContentRow[];
  /** Dòng subtotal ĐÃ CÓ SẴN trong Sheet (Tổng kênh Facebook + từng category) — dùng để hiển thị
   * Tổng quan (KPI) khớp CHÍNH XÁC 100% với Sheet khi bộ lọc khớp đúng 1 dòng subtotal có sẵn
   * (channel=ALL hoặc 1 category cụ thể, KHÔNG lọc Biên tập/Tìm kiếm). KHÔNG tự suy ra công thức
   * ROAS 3 tháng rolling — luôn đọc giá trị Sheet đã tính sẵn. */
  subtotals: Map<string, Record<string, PerformanceGeoMetrics>>;
}

/** 1 dòng Quality thô đọc từ CLĐT Sheet — MỖI block tháng sinh ra 1 dòng riêng cho cùng content. */
export interface QualityMetrics {
  carePriceCount: number; carePriceRate: number;
  positiveCount: number; positiveRate: number;
  negativeCount: number; negativeRate: number;
  unknownCount: number; unknownRate: number;
}
export interface RawQualityContentRow {
  channel: string;   // nhóm kênh suy ra từ dòng group-header phía trên (positional)
  contentName: string;
  month: string;     // 'YYYY-MM'
  grandTotal: QualityMetrics; // dùng cột "Grand Total" (gộp cả Trong nước + Nước ngoài) cho V1
}

export interface ContentPerformanceParams {
  month: string;            // 'YYYY-MM' — bắt buộc
  channel: string;          // 'ALL' hoặc đúng 1 trong 5 giá trị kênh Facebook
  editor: string;           // 'ALL' hoặc đúng editor_name gốc (từ Content Sheet)
  geography: GeographyFilter;
  search: string;
}

export interface ContentPerformanceOverview {
  cost: number;
  dataCount: number;
  dataPrice: number;  // = cost / dataCount (tính lại, KHÔNG lấy trung bình cộng)
  roasMonth: number;  // % — weighted theo cost (KHÔNG trung bình cộng % đơn giản)
  roas3Month: number; // % — weighted theo cost
}

export interface ContentPerformanceTableItem {
  content: string;
  editor: string;       // từ Content Sheet (editor_name); '(Không xác định)' nếu không khớp được
  channel: string;
  cost: number;
  dataCount: number;
  dataPrice: number;
  roasMonth: number;
  roas3Month: number;
  quality: QualityMetrics | null; // null nếu không có dữ liệu CLĐT khớp content+tháng
}

export interface ContentPerformanceMeta {
  channelsAvailable: string[];
  editorsAvailable: string[];
  monthsAvailable: string[]; // các 'YYYY-MM' có dữ liệu thật trong Performance Sheet
  contentsUnmatchedEditor: number; // số Content (trong kết quả đang hiển thị) không tìm được Biên tập từ Content Sheet
  /** true = Tổng quan lấy TRỰC TIẾP dòng subtotal có sẵn trong Sheet (khớp 100%).
   * false = KHÔNG có subtotal khớp bộ lọc hiện tại (đang lọc Biên tập/Tìm kiếm) → Tổng quan
   * là ƯỚC LƯỢNG tự tính (Chi phí/SL Data vẫn cộng đúng; ROAS tháng/3 tháng chỉ là xấp xỉ vì
   * Sheet không cung cấp subtotal cho tổ hợp lọc tuỳ ý này). */
  overviewFromSheetSubtotal: boolean;
  warnings: string[];
}

export interface ContentPerformanceResult {
  month: string;
  overview: ContentPerformanceOverview;
  table: ContentPerformanceTableItem[];
  meta: ContentPerformanceMeta;
}
