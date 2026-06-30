/* Weekly Report — TÀI LIỆU BÁO CÁO (PHASE 9). Dùng CHUNG cho web + in (PDF = bản in của chính nó).
 * Bố cục văn bản print-friendly: KHÔNG card dashboard, KHÔNG biểu đồ, KHÔNG bảng Excel.
 * #report-doc = vùng in; .print-header lặp mỗi trang; .emp-block không bị cắt giữa trang. */
import { fmtNum, fmtPct1 } from '../utils/format';
import { SectionII, SectionIII } from './NarrativeSections';
import type { ReportMetrics, WeeklyReportData, ReportNarrative } from '../types/report';

/** Hàng KPI căn nhãn – giá trị (text, dễ đọc). */
function KpiRows({ m }: { m: ReportMetrics }) {
  const rows: [string, string][] = [
    ['Đã cấp', fmtNum(m.capped)],
    ['Đã test', fmtNum(m.tested)],
    ['Tồn', fmtNum(m.ton)],
    ['Tỷ lệ test', fmtPct1(m.testRate)],
    ['Content test win', fmtNum(m.win)],
    ['Tỷ lệ win', fmtPct1(m.winRate)],
  ];
  return (
    <div className="max-w-[380px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-6 border-b border-line/40 py-[3px] text-[13px]">
          <span className="text-muted">{k}</span>
          <span className="font-semibold tabular-nums text-fg">{v}</span>
        </div>
      ))}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="section-head mb-2 mt-1 border-y-2 border-line py-1 text-[15px] font-bold uppercase tracking-wide text-fg">
      {children}
    </h2>
  );
}

export function ReportDocument({
  data, narrative, preview, exportedAt, onAssessment, onAction,
}: {
  data: WeeklyReportData;
  narrative: ReportNarrative;
  preview: boolean;
  exportedAt: string;
  onAssessment: (name: string, items: string[]) => void;
  onAction: (name: string, items: string[]) => void;
}) {
  return (
    <div id="report-doc" className="mx-auto max-w-[820px]">
      {/* Header lặp mỗi trang khi IN (ẩn trên web) */}
      <div className="print-header text-[11px] text-fg">
        <div className="flex items-center justify-between border-b border-line pb-1">
          <span className="font-bold uppercase">Báo cáo content tuần</span>
          <span>Kỳ: {data.range.label} · Ngày xuất: {exportedAt}</span>
        </div>
      </div>

      {/* Tiêu đề (hiển thị trên web; khi in đã có .print-header) */}
      <div className="no-print mb-3">
        <div className="report-title text-[18px] font-extrabold uppercase tracking-wide text-fg">Báo cáo content tuần</div>
        <div className="text-[13px] text-muted">Kỳ: {data.range.label} · Ngày xuất: {exportedAt}</div>
      </div>

      {/* I. TIẾN ĐỘ CONTENT */}
      <section className="report-section mb-4">
        <SectionHead>I. Tiến độ Content</SectionHead>
        <div className="emp-block mb-3">
          <div className="mb-1 text-[13px] font-semibold text-fg">Tổng quan Team</div>
          <KpiRows m={data.team} />
        </div>
        <div className="mb-1 text-[13px] font-semibold text-muted">Theo từng nhân viên</div>
        <div className="flex flex-col gap-3">
          {data.employees.map((e) => (
            <div key={e.name} className="emp-block">
              <div className="mb-1 text-[13px] font-bold uppercase tracking-wide text-fg">{e.name}</div>
              <KpiRows m={e.metrics} />
            </div>
          ))}
        </div>
      </section>

      {/* II. ĐÁNH GIÁ */}
      <section className="report-section mb-4">
        <SectionHead>II. Đánh giá</SectionHead>
        <SectionII
          employees={data.employees}
          assessments={narrative.assessments}
          actions={narrative.actions}
          preview={preview}
          onAssessment={onAssessment}
          onAction={onAction}
        />
      </section>

      {/* III. KẾ HOẠCH TUẦN TỚI */}
      <section className="report-section">
        <SectionHead>III. Kế hoạch tuần tới</SectionHead>
        <SectionIII employees={data.employees} actions={narrative.actions} />
      </section>
    </div>
  );
}
