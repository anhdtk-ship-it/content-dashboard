/* Weekly Report — trang chính (PHASE 9). PDF = bản IN của chính báo cáo (ReportDocument) qua window.print().
 * Chrome (filter/nút/tiêu đề web) bọc .no-print → tự ẩn khi in. Module ĐỘC LẬP; Business Rule riêng. */
import { useEffect, useMemo, useState } from 'react';
import { PageContainer, SectionHeader, LoadingSkeleton, EmptyState } from '../../../src/components/ui';
import { ReportFilters } from '../components/ReportFilters';
import { ExportBar } from '../components/ExportBar';
import { ReportDocument } from '../components/ReportDocument';
import { useWeeklyReport } from '../hooks/useWeeklyReport';
import { evaluateEmployee } from '../services/ruleEngine';
import type { ReportNarrative, WeeklyReportData } from '../types/report';

function todayLabel(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function WeeklyReportPage() {
  const { range, data, loading, error, setFrom, setTo, thisWeek } = useWeeklyReport();
  const [preview, setPreview] = useState(true);
  const exportedAt = useMemo(todayLabel, []);

  const [narrative, setNarrative] = useState<ReportNarrative>({ assessments: {}, actions: {} });
  useEffect(() => {
    if (!data) return;
    const assessments: Record<string, string[]> = {};
    const actions: Record<string, string[]> = {};
    for (const e of data.employees) { const ev = evaluateEmployee(e); assessments[e.name] = ev.assessments; actions[e.name] = ev.actions; }
    setNarrative({ assessments, actions });
  }, [data]);

  const onAssessment = (name: string, items: string[]) =>
    setNarrative((n) => ({ ...n, assessments: { ...n.assessments, [name]: items } }));
  const onAction = (name: string, items: string[]) =>
    setNarrative((n) => ({ ...n, actions: { ...n.actions, [name]: items } }));

  // Xuất PDF = in báo cáo. Ép Xem trước (bullet, không input) rồi gọi print.
  const handlePrint = () => { setPreview(true); setTimeout(() => window.print(), 200); };

  const exportData: WeeklyReportData = data ?? { range, team: {} as any, employees: [], generatedAt: '' };

  return (
    <div className="text-fg">
      <PageContainer>
        <div className="no-print">
          <SectionHeader title="📝 Báo cáo tuần" action={<ExportBar data={exportData} narrative={narrative} onPrint={handlePrint} />} />
          <ReportFilters
            range={range} preview={preview}
            onFrom={setFrom} onTo={setTo} onThisWeek={thisWeek}
            onTogglePreview={() => setPreview((p) => !p)}
          />
        </div>

        {error ? <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`} />
          : loading && !data ? (
            <div className="space-y-4"><LoadingSkeleton variant="kpi" count={6} /><LoadingSkeleton variant="block" /></div>
          ) : data && data.employees.length === 0 ? (
            <EmptyState message="Không có dữ liệu content trong khoảng thời gian đã chọn" />
          ) : data ? (
            <ReportDocument
              data={data} narrative={narrative} preview={preview} exportedAt={exportedAt}
              onAssessment={onAssessment} onAction={onAction}
            />
          ) : null}
      </PageContainer>
    </div>
  );
}
