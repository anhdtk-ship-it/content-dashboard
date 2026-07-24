/* Weekly Report — TÀI LIỆU BÁO CÁO. Dùng CHUNG web + in.
 * Header lặp mỗi trang bằng <thead> của 1 <table> bao toàn báo cáo (không đè nội dung).
 * Bố cục: I. Tổng quan Team (Nội địa / Quốc tế) · II. Tiến độ nhân viên (2 bảng)
 *         III. Đánh giá nhân viên (chia market) · IV. Phương án tuần tới (chia market).
 * Số liệu lấy từ module dùng chung `src/shared/weeklyMetrics.ts` → khớp tuyệt đối với PDF. */
import { fmtNum, fmtPct } from '../types/report';
import type { MarketBlock, MarketKey, WeeklyKpi, WeeklyReportData, ReportNarrative } from '../types/report';
import { SectionReviews, SectionPlans } from './NarrativeSections';

/* ---------- KPI Card (6 thẻ / khối market) ---------- */
const KPI_DEFS: { label: string; get: (k: WeeklyKpi) => string; tone?: 'good' | 'warn' }[] = [
  { label: 'Đã cấp', get: (k) => fmtNum(k.capped) },
  { label: 'Đã test', get: (k) => fmtNum(k.tested) },
  { label: 'Tồn', get: (k) => fmtNum(k.ton), tone: 'warn' },
  { label: 'Tỷ lệ test', get: (k) => fmtPct(k.rateTest) },
  { label: 'Content Duy trì', get: (k) => fmtNum(k.duyTriThang), tone: 'good' },
  { label: 'Tỷ lệ Duy trì', get: (k) => fmtPct(k.rateDuyTri), tone: 'good' },
];

function KpiCards({ kpi }: { kpi: WeeklyKpi }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {KPI_DEFS.map((d) => (
        <div key={d.label} className="kpi-card rounded-card border border-line bg-surface2 px-2 py-2 text-center">
          <div className={`text-[19px] font-bold tabular-nums ${d.tone === 'good' ? 'text-success' : d.tone === 'warn' ? 'text-warn' : 'text-fg'}`}>
            {d.get(kpi)}
          </div>
          <div className="text-[11px] leading-tight text-muted">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Bảng tiến độ nhân viên (1 bảng / market) ---------- */
const COLS = ['Nhân viên', 'Đã cấp', 'Đã test', 'Tồn', 'Tỷ lệ test', 'Duy trì tháng', 'Đang duy trì'];
const cells = (k: WeeklyKpi) => [fmtNum(k.capped), fmtNum(k.tested), fmtNum(k.ton), fmtPct(k.rateTest), fmtNum(k.duyTriThang), fmtNum(k.dangDuyTri)];

function EmployeeTable({ block }: { block: MarketBlock }) {
  const num = 'border border-line px-2 py-1 text-right tabular-nums text-fg';
  return (
    <table className="emp-table w-full border-collapse text-[13px]">
      <thead>
        <tr>
          {COLS.map((c, i) => (
            <th key={c} className={`emp-th border border-line bg-surface2 px-2 py-1 font-semibold text-muted ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.employees.map((e) => (
          <tr key={e.name}>
            <td className="border border-line px-2 py-1 text-left text-fg">{e.name}</td>
            {cells(e.kpi).map((v, i) => <td key={i} className={num}>{v}</td>)}
          </tr>
        ))}
        <tr className="total-row">
          <td className="border border-line bg-surface2 px-2 py-1 text-left font-bold text-fg">TỔNG</td>
          {cells(block.team).map((v, i) => <td key={i} className={`${num} bg-surface2 font-bold`}>{v}</td>)}
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
  data, narrative, preview, exportedAt, employeeNames, onReview, onPlan,
}: {
  data: WeeklyReportData;
  narrative: ReportNarrative;
  preview: boolean;
  exportedAt: string;
  employeeNames: string[];
  onReview: (key: string, items: string[]) => void;
  onPlan: (market: MarketKey, items: string[]) => void;
}) {
  return (
    <table id="report-doc" className="report-table mx-auto w-full max-w-[820px] border-collapse">
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
          {/* I. TỔNG QUAN TEAM — tách Nội địa / Quốc tế */}
          <section className="report-section mb-4">
            <SectionHead>I. Tổng quan Team</SectionHead>
            {data.markets.map((b) => (
              <div key={b.market} className="emp-block mb-3">
                <div className="mb-1 text-[13px] font-semibold text-fg">{b.label}</div>
                <KpiCards kpi={b.team} />
              </div>
            ))}
          </section>

          {/* II. TIẾN ĐỘ NHÂN VIÊN — 2 bảng */}
          <section className="report-section mb-4">
            <SectionHead>II. Tiến độ nhân viên</SectionHead>
            {data.markets.map((b, i) => (
              <div key={b.market} className="emp-block mb-3">
                <div className="mb-1 text-[13px] font-semibold text-muted">{String.fromCharCode(65 + i)}. {b.label}</div>
                <EmployeeTable block={b} />
              </div>
            ))}
          </section>

          {/* III. ĐÁNH GIÁ NHÂN VIÊN */}
          <section className="report-section mb-4">
            <SectionHead>III. Đánh giá nhân viên</SectionHead>
            <SectionReviews data={data} narrative={narrative} preview={preview} onReview={onReview} employeeNames={employeeNames} />
          </section>

          {/* IV. PHƯƠNG ÁN TUẦN TỚI */}
          <section className="report-section">
            <SectionHead>IV. Phương án tuần tới</SectionHead>
            <SectionPlans data={data} narrative={narrative} preview={preview} onPlan={onPlan} />
          </section>
        </td></tr>
      </tbody>
    </table>
  );
}
