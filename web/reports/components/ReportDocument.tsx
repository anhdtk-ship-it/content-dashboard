/* Weekly Report — TÀI LIỆU BÁO CÁO (PHASE 9). Dùng CHUNG web + in (PDF = bản in của chính nó).
 * Header lặp mỗi trang bằng <thead> của 1 <table> bao toàn báo cáo → trình duyệt tự lặp + CHỪA CHỖ
 * (không đè nội dung — fix lỗi "lồng chữ ở đầu trang" của position:fixed).
 * Bố cục văn bản print-friendly: KHÔNG card dashboard / biểu đồ / bảng Excel. .emp-block không bị cắt giữa trang. */
import { fmtNum } from '../utils/format';
import { SectionII, SectionIII } from './NarrativeSections';
import type { ReportMetrics, WeeklyReportData, ReportNarrative } from '../types/report';

function KpiRows({ m }: { m: ReportMetrics }) {
  const rows: [string, string][] = [
    ['Đã cấp', fmtNum(m.capped)],
    ['Không test', fmtNum(m.notTest)],
    ['Chờ chạy (Tồn)', fmtNum(m.choChay)],
    ['Đang test', fmtNum(m.dangTest)],
    ['Content test win', fmtNum(m.win)],
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

/** Bảng "Theo từng nhân viên" — 7 cột, hàng nhân viên (động) + dòng Tổng. Đơn giản, in PDF tốt. */
function EmployeeTable({ employees, team }: { employees: WeeklyReportData['employees']; team: ReportMetrics }) {
  const cols = ['Nhân viên', 'Đã cấp', 'Không test', 'Chờ chạy', 'Đang test', 'Content test win'];
  const vals = (m: ReportMetrics) => [fmtNum(m.capped), fmtNum(m.notTest), fmtNum(m.choChay), fmtNum(m.dangTest), fmtNum(m.win)];
  const num = 'border border-line px-2 py-1 text-right tabular-nums text-fg';
  return (
    <table className="emp-table w-full border-collapse text-[13px]">
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={c} className={`emp-th border border-line bg-surface2 px-2 py-1 font-semibold text-muted ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {employees.map((e) => (
          <tr key={e.name}>
            <td className="border border-line px-2 py-1 text-left text-fg">{e.name}</td>
            {vals(e.metrics).map((v, i) => <td key={i} className={num}>{v}</td>)}
          </tr>
        ))}
        <tr className="total-row">
          <td className="border border-line bg-surface2 px-2 py-1 text-left font-bold text-fg">Tổng</td>
          {vals(team).map((v, i) => <td key={i} className={`${num} bg-surface2 font-bold`}>{v}</td>)}
        </tr>
      </tbody>
    </table>
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
    <table id="report-doc" className="report-table mx-auto w-full max-w-[820px] border-collapse">
      {/* HEADER — nằm trong thead → tự LẶP trên mỗi trang khi in, chừa chỗ (không đè nội dung). */}
      <thead className="report-thead">
        <tr><td className="p-0">
          <div className="report-header pb-2">
            <div className="report-title text-[18px] font-extrabold uppercase tracking-wide text-fg">Báo cáo content tuần</div>
            <div className="text-[12px] text-muted">Kỳ: {data.range.label} · Ngày xuất: {exportedAt}</div>
          </div>
        </td></tr>
      </thead>

      <tbody>
        <tr><td className="p-0 align-top">
          {/* I. TIẾN ĐỘ CONTENT */}
          <section className="report-section mb-4">
            <SectionHead>I. Tiến độ Content</SectionHead>
            <div className="emp-block mb-3">
              <div className="mb-1 text-[13px] font-semibold text-fg">Tổng quan Team</div>
              <KpiRows m={data.team} />
            </div>
            <div className="mb-1 text-[13px] font-semibold text-muted">Theo từng nhân viên</div>
            <EmployeeTable employees={data.employees} team={data.team} />
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
        </td></tr>
      </tbody>
    </table>
  );
}
