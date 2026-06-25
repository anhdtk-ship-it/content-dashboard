// Showcase/Gallery — hiển thị tất cả component (KHÔNG phải dashboard thật).
// Render: <Showcase /> trong 1 app React có Tailwind + import './tokens.css'.
import {
  PageContainerDemo, SectionHeader, MetricTooltipDemo, ActionButtonDemo, SearchBoxDemo,
  KPICardDemo, StatCardDemo, ContentCardDemo, ChartCardDemo, StatusBadgeDemo,
  FilterBarDemo, DateRangePickerDemo, DataTableDemo, EmptyStateDemo, LoadingSkeletonDemo,
} from './index';

const ITEMS: { name: string; node: React.ReactNode }[] = [
  { name: 'PageContainer', node: <PageContainerDemo /> },
  { name: 'SectionHeader', node: <SectionHeader title="KPI nghiệp vụ" action={<span className="text-xs text-muted">phụ</span>} /> },
  { name: 'MetricTooltip', node: <MetricTooltipDemo /> },
  { name: 'ActionButton', node: <ActionButtonDemo /> },
  { name: 'SearchBox', node: <SearchBoxDemo /> },
  { name: 'KPICard', node: <KPICardDemo /> },
  { name: 'StatCard', node: <StatCardDemo /> },
  { name: 'ContentCard', node: <ContentCardDemo /> },
  { name: 'ChartCard', node: <ChartCardDemo /> },
  { name: 'StatusBadge', node: <StatusBadgeDemo /> },
  { name: 'FilterBar', node: <FilterBarDemo /> },
  { name: 'DateRangePicker', node: <DateRangePickerDemo /> },
  { name: 'DataTable', node: <DataTableDemo /> },
  { name: 'EmptyState', node: <EmptyStateDemo /> },
  { name: 'LoadingSkeleton', node: <LoadingSkeletonDemo /> },
];

export function Showcase() {
  return (
    <div className="min-h-screen bg-bg p-6 text-fg">
      <h1 className="mb-1 text-lg font-bold">⚡ UI Component Library</h1>
      <p className="mb-6 text-sm text-muted">{ITEMS.length} component · theo DESIGN_SYSTEM.md · dark-mode-first</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ITEMS.map((it) => (
          <section key={it.name} className="rounded-card border border-line bg-surface p-4">
            <div className="mb-3 font-mono text-xs text-accent">&lt;{it.name} /&gt;</div>
            <div>{it.node}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default Showcase;
