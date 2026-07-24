/* Weekly Report — trang chính. PDF (bản in nhanh) = in chính báo cáo qua window.print().
 * Bản PDF chuyên nghiệp (reportlab) dùng CÙNG dữ liệu qua `src/shared/weeklyMetrics.ts`.
 * Chrome (filter/nút/tiêu đề web) bọc .no-print → tự ẩn khi in. */
import { useEffect, useMemo, useState } from 'react';
import { PageContainer, SectionHeader, LoadingSkeleton, EmptyState } from '../../../src/components/ui';
import { ReportFilters } from '../components/ReportFilters';
import { ExportBar } from '../components/ExportBar';
import { ReportDocument } from '../components/ReportDocument';
import { useWeeklyReport } from '../hooks/useWeeklyReport';
import { buildNarrative, allEmployeeNames } from '../services/ruleEngine';
import type { MarketKey, ReportNarrative, WeeklyReportData } from '../types/report';

function todayLabel(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const EMPTY_NARRATIVE: ReportNarrative = { reviews: {}, plans: { noi_dia: [], quoc_te: [] } };

export function WeeklyReportPage() {
  const { range, data, loading, error, setFrom, setTo, thisWeek } = useWeeklyReport();
  const [preview, setPreview] = useState(true);
  const exportedAt = useMemo(todayLabel, []);

  const [narrative, setNarrative] = useState<ReportNarrative>(EMPTY_NARRATIVE);
  useEffect(() => { if (data) setNarrative(buildNarrative(data)); }, [data]);

  const employeeNames = useMemo(() => (data ? allEmployeeNames(data) : []), [data]);

  const onReview = (key: string, items: string[]) =>
    setNarrative((n) => ({ ...n, reviews: { ...n.reviews, [key]: items } }));
  const onPlan = (market: MarketKey, items: string[]) =>
    setNarrative((n) => ({ ...n, plans: { ...n.plans, [market]: items } }));

  // Xuất PDF nhanh = in báo cáo. Ép Xem trước (bullet, không input) rồi gọi print.
  const handlePrint = () => { setPreview(true); setTimeout(() => window.print(), 200); };

  const exportData: WeeklyReportData = data ?? { range, markets: [], generatedAt: '' };
  const hasData = !!data && data.markets.some((m) => m.employees.length > 0);

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
          ) : !hasData ? (
            <EmptyState message="Không có dữ liệu content trong khoảng thời gian đã chọn" />
          ) : (
            <ReportDocument
              data={data!} narrative={narrative} preview={preview} exportedAt={exportedAt}
              employeeNames={employeeNames} onReview={onReview} onPlan={onPlan}
            />
          )}
      </PageContainer>
    </div>
  );
}
