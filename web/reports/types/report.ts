/* Weekly Report — kiểu dữ liệu (PHASE 8). Module ĐỘC LẬP, KHÔNG dùng chung logic Dashboard Content/Ads.
 * Chỉ ĐỌC dữ liệu đã có qua API /api/v3/summary (Single Source of Truth). KHÔNG đọc Google Sheet. */

export type Geo = 'ALL' | 'noi_dia' | 'quoc_te';

export const GEO_LABEL: Record<Geo, string> = { ALL: 'Tất cả', noi_dia: 'Nội Địa', quoc_te: 'Quốc Tế' };

/** Khoảng tuần (Thứ 2 → Chủ nhật), ISO 'YYYY-MM-DD'. */
export interface WeekRange {
  from: string;
  to: string;
  label: string;   // "Tuần 23/06 – 29/06/2026"
}

/** Bộ KPI 1 nhân viên / cả team trong kỳ. */
export interface ReportMetrics {
  capped: number;     // Đã cấp (Content được cấp — theo Ngày Up Trello)
  tested: number;     // Đã test
  notTested: number;  // Chưa test = capped − tested
  used: number;       // Đã sử dụng = tested − "Đã test-ko chạy" (= success + đang test)
  usageRate: number;  // Tỷ lệ sử dụng = used / tested
  win: number;        // Content test win = Thành công (Duy trì + Đã chạy-Tắt)
  winRate: number;    // Tỷ lệ test win = win / tested
}

export interface EmployeeReport {
  name: string;
  metrics: ReportMetrics;
}

/** II. Vấn đề / Phương án (≤3 ý/nhân viên). */
export interface IssueItem { problem: string; proposal: string; }
export interface EmployeeIssues { name: string; items: IssueItem[]; auto: boolean; }

/** III. HĐ tuần tới + Đề xuất (2–3 đầu việc/nhân viên). */
export interface EmployeePlan { name: string; tasks: string[]; auto: boolean; }

/** Dữ liệu báo cáo tuần (phần tự sinh từ Dashboard). */
export interface WeeklyReportData {
  week: WeekRange;
  geo: Geo;
  team: ReportMetrics;
  employees: EmployeeReport[];
  generatedAt: string;
}

/** Phần soạn thảo (II + III) — tách khỏi dữ liệu tự sinh; có thể nhập tay, sau này AI tự sinh. */
export interface ReportNarrative {
  issues: Record<string, IssueItem[]>; // key = tên nhân viên
  plans: Record<string, string[]>;     // key = tên nhân viên
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
