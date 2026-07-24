/* Weekly Report — kiểu dữ liệu. Module ĐỘC LẬP, KHÔNG dùng chung logic Dashboard Content/Ads.
 * Toàn bộ ĐỊNH NGHĨA KPI + công thức nằm ở `src/shared/weeklyMetrics.ts` (dùng chung với PDF)
 * → Dashboard và PDF luôn hiển thị CÙNG số liệu. File này chỉ re-export + type xuất báo cáo. */

export type {
  MarketKey,
  DateRange,
  RawContent,
  WeeklyKpi,
  EmployeeKpi,
  MarketBlock,
  WeeklyReportData,
  ReportNarrative,
} from '../../../src/shared/weeklyMetrics';

export { MARKETS, EMPLOYEE_ORDER, fmtNum, fmtPct } from '../../../src/shared/weeklyMetrics';

import type { WeeklyReportData, ReportNarrative } from '../../../src/shared/weeklyMetrics';

/* ---------- Interface XUẤT BÁO CÁO ---------- */
export type ExportFormat = 'copy' | 'pdf' | 'docx';

export interface ReportExporter {
  format: ExportFormat;
  label: string;
  enabled: boolean;   // false = "sắp có" (chưa implement)
  /** Xuất báo cáo. Ném lỗi nếu chưa hỗ trợ. */
  export(data: WeeklyReportData, narrative: ReportNarrative): Promise<void>;
}
