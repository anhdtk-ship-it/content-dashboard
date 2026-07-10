/* Weekly Report — kiểu dữ liệu (PHASE 8). Module ĐỘC LẬP, KHÔNG dùng chung logic Dashboard Content/Ads.
 * Chỉ ĐỌC dữ liệu đã có qua API /api/v3/summary (Single Source of Truth). KHÔNG đọc Google Sheet. */

/** Khoảng thời gian báo cáo (tùy chỉnh theo ngày), ISO 'YYYY-MM-DD'. */
export interface DateRange {
  from: string;
  to: string;
  label: string;   // "23/06/2026 – 29/06/2026"
}

/** Bộ KPI 1 nhân viên / cả team (BUSINESS RULE RIÊNG Weekly — PHASE 11: 2 nhóm, xem WeeklyReportService). */
export interface ReportMetrics {
  // A. Phát sinh trong tháng (cohort theo upload trong kỳ):
  capped: number;   // Đã cấp = content UPLOAD trong kỳ (KHÔNG cumulative)
  notTest: number;  // Không test = upload trong kỳ & trạng thái "Không test" (không cộng dồn tháng sau)
  win: number;      // Content duy trì = upload trong kỳ & đạt "Duy trì" (định nghĩa: content chuyển sang trạng thái Duy trì)
  // B. Trạng thái hiện tại (ALL, KHÔNG giới hạn tháng — backlog thực tế):
  choChay: number;  // Chờ chạy (Tồn) = trạng thái hiện tại "Chờ chạy"
  dangTest: number; // Đang test = trạng thái hiện tại "Đang test"
}

export interface EmployeeReport {
  name: string;
  metrics: ReportMetrics;
}

/** Dữ liệu báo cáo tuần (phần tự sinh từ Dashboard). */
export interface WeeklyReportData {
  range: DateRange;
  team: ReportMetrics;
  employees: EmployeeReport[];
  generatedAt: string;
}

/** Phần soạn thảo — Rule Engine sinh mặc định, nhập tay được. */
export interface ReportNarrative {
  assessments: Record<string, string[]>; // II. Đánh giá — theo TỪNG nhân viên (key = tên)
  teamActions: string[];                  // III. Kế hoạch tuần tới — CẢ TEAM (không chia nhân viên)
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
