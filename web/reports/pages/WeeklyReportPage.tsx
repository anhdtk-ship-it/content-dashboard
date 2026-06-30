/* Weekly Report — trang chính (PHASE 8). Module ĐỘC LẬP; Business Rule riêng (WeeklyReportService).
 * Bố cục mẫu báo cáo công ty: I. Tiến độ Content · II. Vấn đề/Phương án · III. HĐ tuần tới. Có Xem trước. */
import { useEffect, useState } from 'react';
import { PageContainer, SectionHeader, LoadingSkeleton, EmptyState } from '../../../src/components/ui';
import { ReportFilters } from '../components/ReportFilters';
import { ExportBar } from '../components/ExportBar';
import { TeamSummaryBlock, EmployeeBlock } from '../components/SummaryBlocks';
import { IssuesSection, NextWeekSection } from '../components/NarrativeSections';
import { useWeeklyReport } from '../hooks/useWeeklyReport';
import { autoIssues, autoPlan } from '../services/insights';
import type { ReportNarrative, IssueItem, WeeklyReportData } from '../types/report';

export function WeeklyReportPage() {
  const { week, geo, data, loading, error, setGeo, prevWeek, nextWeek, thisWeek } = useWeeklyReport();
  const [preview, setPreview] = useState(true);

  // Phần soạn (II + III) — cục bộ, khởi tạo từ tự sinh khi dữ liệu đổi (CHƯA persist DB).
  const [narrative, setNarrative] = useState<ReportNarrative>({ issues: {}, plans: {} });
  useEffect(() => {
    if (!data) return;
    const issues: Record<string, IssueItem[]> = {};
    const plans: Record<string, string[]> = {};
    for (const e of data.employees) { issues[e.name] = autoIssues(e).items; plans[e.name] = autoPlan(e).tasks; }
    setNarrative({ issues, plans });
  }, [data]);

  const setIssues = (name: string, items: IssueItem[]) =>
    setNarrative((n) => ({ ...n, issues: { ...n.issues, [name]: items } }));
  const setPlan = (name: string, tasks: string[]) =>
    setNarrative((n) => ({ ...n, plans: { ...n.plans, [name]: tasks } }));

  const exportData: WeeklyReportData = data ?? { week, geo, team: {} as any, employees: [], generatedAt: '' };

  return (
    <div className="text-fg">
      <PageContainer>
        <SectionHeader title="📝 Báo cáo tuần" action={<ExportBar data={exportData} narrative={narrative} />} />

        <ReportFilters
          week={week} geo={geo} preview={preview}
          onPrevWeek={prevWeek} onNextWeek={nextWeek} onThisWeek={thisWeek}
          onGeo={setGeo} onTogglePreview={() => setPreview((p) => !p)}
        />

        {error ? <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`} />
          : loading && !data ? (
            <div className="space-y-4"><LoadingSkeleton variant="kpi" count={6} /><LoadingSkeleton variant="block" /></div>
          ) : data && data.employees.length === 0 ? (
            <EmptyState message="Không có dữ liệu content trong tuần/địa lý đã chọn" />
          ) : data ? (
            <div className="flex flex-col gap-5">
              <section>
                <SectionHeader title="I. Tiến độ Content" />
                <div className="mb-1 text-[13px] font-semibold text-muted">Tổng quan team</div>
                <TeamSummaryBlock team={data.team} />
                <div className="mt-3 text-[13px] font-semibold text-muted">Theo từng nhân viên</div>
                <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.employees.map((e) => <EmployeeBlock key={e.name} emp={e} />)}
                </div>
              </section>

              <section>
                <SectionHeader title="II. Vấn đề / Phương án" />
                <IssuesSection employees={data.employees} issues={narrative.issues} preview={preview} onChange={setIssues} />
              </section>

              <section>
                <SectionHeader title="III. HĐ tuần tới" />
                <NextWeekSection employees={data.employees} plans={narrative.plans} preview={preview} onChange={setPlan} />
              </section>
            </div>
          ) : null}
      </PageContainer>
    </div>
  );
}
