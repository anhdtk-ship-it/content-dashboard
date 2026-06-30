/* Weekly Report — trang chính (PHASE 8). Module ĐỘC LẬP; Business Rule riêng (WeeklyReportService).
 * Bố cục mẫu báo cáo công ty: I. Tiến độ Content · II. Vấn đề/Phương án · III. HĐ tuần tới. Có Xem trước. */
import { useEffect, useState } from 'react';
import { PageContainer, SectionHeader, LoadingSkeleton, EmptyState } from '../../../src/components/ui';
import { ReportFilters } from '../components/ReportFilters';
import { ExportBar } from '../components/ExportBar';
import { TeamSummaryBlock, EmployeeBlock } from '../components/SummaryBlocks';
import { AssessmentSection, ActionSection } from '../components/NarrativeSections';
import { useWeeklyReport } from '../hooks/useWeeklyReport';
import { evaluateEmployee } from '../services/ruleEngine';
import type { ReportNarrative, WeeklyReportData } from '../types/report';

export function WeeklyReportPage() {
  const { range, data, loading, error, setFrom, setTo, thisWeek } = useWeeklyReport();
  const [preview, setPreview] = useState(true);

  // Phần soạn (II + III) — Rule Engine sinh mặc định khi dữ liệu đổi; nhập tay (cục bộ, CHƯA persist DB).
  const [narrative, setNarrative] = useState<ReportNarrative>({ assessments: {}, actions: {} });
  useEffect(() => {
    if (!data) return;
    const assessments: Record<string, string[]> = {};
    const actions: Record<string, string[]> = {};
    for (const e of data.employees) { const ev = evaluateEmployee(e); assessments[e.name] = ev.assessments; actions[e.name] = ev.actions; }
    setNarrative({ assessments, actions });
  }, [data]);

  const setAssessment = (name: string, items: string[]) =>
    setNarrative((n) => ({ ...n, assessments: { ...n.assessments, [name]: items } }));
  const setAction = (name: string, items: string[]) =>
    setNarrative((n) => ({ ...n, actions: { ...n.actions, [name]: items } }));

  const exportData: WeeklyReportData = data ?? { range, team: {} as any, employees: [], generatedAt: '' };

  return (
    <div className="text-fg">
      <PageContainer>
        <SectionHeader title="📝 Báo cáo tuần" action={<ExportBar data={exportData} narrative={narrative} />} />

        <ReportFilters
          range={range} preview={preview}
          onFrom={setFrom} onTo={setTo} onThisWeek={thisWeek}
          onTogglePreview={() => setPreview((p) => !p)}
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
                <SectionHeader title="II. Đánh giá" />
                <AssessmentSection employees={data.employees} assessments={narrative.assessments} preview={preview} onChange={setAssessment} />
              </section>

              <section>
                <SectionHeader title="III. Hành động tuần tới" />
                <ActionSection employees={data.employees} actions={narrative.actions} preview={preview} onChange={setAction} />
              </section>
            </div>
          ) : null}
      </PageContainer>
    </div>
  );
}
