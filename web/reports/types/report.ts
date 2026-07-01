/* Weekly Report — kiểu dữ liệu (PHASE 8). Module ĐỘC LẬP, KHÔNG dùng chung logic Dashboard Content/Ads.
 * Chỉ ĐỌC dữ liệu đã có qua API /api/v3/summary (Single Source of Truth). KHÔNG đọc Google Sheet. */

/** Khoảng thời gian báo cáo (tùy chỉnh theo ngày), ISO 'YYYY-MM-DD'. */
export interface DateRange {
  from: string;
  to: string;
  label: string;   // "23/06/2026 – 29/06/2026"
}

/** Bộ KPI 1 nhân viên / cả team (BUSINESS RULE RIÊNG Weekly — §7 xuyên vòng đời theo tháng, xem WeeklyReportService). */
export interface ReportMetrics {
  capped: number;   // Đã cấp = content upload ≤ cuối kỳ (cumulative)
  tested: number;   // Đã test = có test_date trong kỳ
  notTest: number;  // Không test = trạng thái "Không test" (cumulative, upload ≤ cuối kỳ) — PHASE 10
  ton: number;      // Tồn = upload ≤ cuối kỳ & chưa test (đến cuối kỳ) & ≠ Không test (động, KHÔNG lưu DB)
  testRate: number; // Tỷ lệ test = tested / capped (0..1)
  win: number;      // Content test win = tested & Content đạt "Duy trì"
  winRate: number;  // Tỷ lệ win = win / tested (0..1)
}

export interface EmployeeReport {
  name: string;
  metrics: ReportMetrics;
}

/** Kết quả Rule Engine cho 1 nhân viên (độc lập, theo KPI của chính họ). */
export interface EmployeeEvaluation {
  assessments: string[];   // II. Đánh giá (≤2) — mỗi ý gắn KPI cụ thể
  actions: string[];       // III. Hành động tuần tới (≤2) — hành động rõ ràng
}

/** Dữ liệu báo cáo tuần (phần tự sinh từ Dashboard). */
export interface WeeklyReportData {
  range: DateRange;
  team: ReportMetrics;
  employees: EmployeeReport[];
  generatedAt: string;
}

/** Phần soạn thảo (II + III) — Rule Engine sinh mặc định, nhập tay được. Key = tên nhân viên. */
export interface ReportNarrative {
  assessments: Record<string, string[]>; // II. Đánh giá (≤2)
  actions: Record<string, string[]>;      // III. Hành động tuần tới (≤2)
}

/* ---------- Interface XUẤT BÁO CÁO (PHASE 8: chỉ thiết kế, chưa implement đầy đủ) ---------- */
export type ExportFormat = 'copy' | 'pdf' | 'docx';

export interface ReportExporter {
  format: ExportFormat;
  label: string;
  enabled: boolean;   // false = "sắp có" (chưa implement)
  /** Xuất báo cáo. Ném lỗi nếu chưa hỗ trợ. */
  export(data: WeeklyReportData, narrative: ReportNarrative): Promise<void>;
}
