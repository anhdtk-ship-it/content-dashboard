import type { ReactNode } from 'react';

export interface ChartCardProps {
  title: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Card chứa biểu đồ: tiêu đề + controls (segmented) + vùng chart (DESIGN_SYSTEM §6). */
export function ChartCard({ title, controls, children, className = '' }: ChartCardProps) {
  return (
    <div className={`mb-4 rounded-card border border-line bg-surface p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {controls}
      </div>
      <div className="min-h-[140px]">{children}</div>
    </div>
  );
}

/** Demo dùng thanh HTML (ops-first), không phụ thuộc thư viện chart. */
export function ChartCardDemo() {
  const rows = [
    { label: 'Chờ chạy', value: 13, color: 'var(--warn)' },
    { label: 'Đang test', value: 44, color: 'var(--accent)' },
    { label: 'Duy trì', value: 21, color: 'var(--success)' },
    { label: 'Đã dừng', value: 134, color: 'var(--slate)' },
  ];
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ChartCard
      title="Phân bố trạng thái"
      controls={
        <div className="flex gap-1">
          {['Ngày', 'Tuần', 'Tháng'].map((t, i) => (
            <span key={t} className={`rounded-control px-2 py-[3px] text-xs ${i === 0 ? 'bg-[#1d4ed8] text-white' : 'text-muted'}`}>{t}</span>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-[9px]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-[10px]">
            <span className="w-[110px] text-[13px] text-muted">{r.label}</span>
            <div className="h-[18px] flex-1 overflow-hidden rounded-[5px] bg-surface2">
              <div className="h-full rounded-[5px]" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
            </div>
            <span className="w-[46px] text-right font-semibold tabular-nums text-fg">{r.value}</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
