/* Weekly Report — trang chính (PHASE 8). Module ĐỘC LẬP; chỉ đọc /api/v3/summary.
 * Bố cục theo mẫu báo cáo công ty: I. Tiến độ Content · II. Vấn đề/Phương án · III. HĐ tuần tới.
 * Có chế độ Xem trước. Phần II/III tự sinh từ Dashboard + nhập tay (lưu cục bộ, chưa persist). */
import { useEffect, useState } from 'react';
import { PageContainer, SectionHeader, LoadingSkeleton, EmptyState } from '../../../src/components/ui';
import { ReportFilters } from '../components/ReportFilters';
import { ExportBar } from '../components/ExportBar';
import { TeamSummaryBlock, EmployeeBlock } from '../components/SummaryBlocks';
import { IssuesSection, NextWeekSection } from '../components/NarrativeSections';
import { fetchWeeklyReport, currentWeek, shiftWeek } from '../services/reportService';
import { autoIssues, autoPlan } from '../services/insights';
import type { Geo, WeekRange, WeeklyReportData, ReportNarrative, IssueItem } from '../types/report';

export function WeeklyReportPage() {
  const [week, setWeek] = useState<WeekRange>(() => currentWeek());
  const [geo, setGeo] = useState<Geo>('ALL');
  const [preview, setPreview] = useState(true);

  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phần soạn (II + III) — cục bộ, khởi tạo từ tự sinh khi dữ liệu đổi (chưa persist DB).
  const [narrative, setNarrative] = useState<ReportNarrative>({ issues: {}, plans: {} });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchWeeklyReport(week, geo)
      .then((d) => {
        if (!alive) return;
        setData(d); setError(null);
        const issues: Record<string, IssueItem[]> = {};
        const plans: Record<string, string[]> = {};
        for (const e of d.employees) { issues[e.name] = autoIssues(e).items; plans[e.name] = autoPlan(e).tasks; }
        setNarrative({ issues, plans });
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [week, geo]);

  const setIssues = (name: string, items: IssueItem[]) =>
    setNarrative((n) => ({ ...n, issues: { ...n.issues, [name]: items } }));
  const setPlan = (name: string, tasks: string[]) =>
    setNarrative((n) => ({ ...n, plans: { ...n.plans, [name]: tasks } }));

  return (
    <div className="text-fg">
      <PageContainer>
        <SectionHeader title="📝 Báo cáo tuần"
          action={<ExportBar data={data ?? { week, geo, team: {} as any, employees: [], generatedAt: '' }} narrative={narrative} />} />

        <ReportFilters
          week={week} geo={geo} preview={preview}
          onPrevWeek={() => setWeek((w) => shiftWeek(w, -1))}
          onNextWeek={() => setWeek((w) => shiftWeek(w, 1))}
          onThisWeek={() => setWeek(currentWeek())}
          onGeo={setGeo}
          onTogglePreview={() => setPreview((p) => !p)}
        />

        {error ? <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`} />
          : loading && !data ? (
            <div className="space-y-4"><LoadingSkeleton variant="kpi" count={6} /><LoadingSkeleton variant="block" /></div>
          ) : data && data.employees.length === 0 ? (
            <EmptyState message="Không có dữ liệu content trong tuần/địa lý đã chọn" />
          ) : data ? (
            <div className="flex flex-col gap-5">
              {/* I. Tiến độ Content */}
              <section>
                <SectionHeader title="I. Tiến độ Content" />
                <div className="mb-1 text-[13px] font-semibold text-muted">Tổng quan team</div>
                <TeamSummaryBlock team={data.team} />
                <div className="mt-3 text-[13px] font-semibold text-muted">Theo từng nhân viên</div>
                <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.employees.map((e) => <EmployeeBlock key={e.name} emp={e} />)}
                </div>
              </section>

              {/* II. Vấn đề / Phương án */}
              <section>
                <SectionHeader title="II. Vấn đề / Phương án" />
                <IssuesSection employees={data.employees} issues={narrative.issues} preview={preview} onChange={setIssues} />
              </section>

              {/* III. HĐ tuần tới + Đề xuất */}
              <section>
                <SectionHeader title="III. HĐ tuần tới + Đề xuất" />
                <NextWeekSection employees={data.employees} plans={narrative.plans} preview={preview} onChange={setPlan} />
              </section>
            </div>
          ) : null}
      </PageContainer>
    </div>
  );
}
