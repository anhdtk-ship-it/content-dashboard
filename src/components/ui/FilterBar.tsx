import type { ReactNode } from 'react';

export interface FilterBarProps {
  title?: ReactNode;
  children?: ReactNode;
  right?: ReactNode;
  className?: string;
}

/** Thanh filter cố định (sticky) — DESIGN_SYSTEM §8. */
export function FilterBar({ title, children, right, className = '' }: FilterBarProps) {
  return (
    <div
      className={`sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-line bg-bg/90 px-4 py-[10px] backdrop-blur ${className}`}
    >
      {title && <span className="mr-1 text-[15px] font-semibold text-fg">{title}</span>}
      {children}
      <div className="flex-1" />
      {right}
    </div>
  );
}

export function FilterBarDemo() {
  return (
    <FilterBar
      title="Tổng Quan"
      right={
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-success" /> Realtime
        </span>
      }
    >
      <select className="rounded-control border border-line bg-surface px-2 py-[6px] text-[13px] text-fg">
        <option>Tháng này</option>
      </select>
      <select className="rounded-control border border-line bg-surface px-2 py-[6px] text-[13px] text-fg">
        <option>Tất cả TT</option>
      </select>
      <button className="rounded-control border border-line bg-surface px-[10px] py-[6px] text-[13px] text-fg hover:bg-surface2">
        ✕ Xóa lọc
      </button>
    </FilterBar>
  );
}
