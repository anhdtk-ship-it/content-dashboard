import type { ReactNode } from 'react';

export interface EmptyStateProps {
  message?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Trạng thái rỗng — viền đứt, muted (DESIGN_SYSTEM §3/§13). */
export function EmptyState({ message = 'Không có dữ liệu', icon = '📭', action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-8 text-center text-muted ${className}`}>
      <div className="text-2xl">{icon}</div>
      <div>{message}</div>
      {action}
    </div>
  );
}

export function EmptyStateDemo() {
  return (
    <EmptyState
      message="Không có content khớp bộ lọc"
      action={<button className="rounded-control border border-line bg-surface px-[10px] py-[6px] text-[13px] text-fg hover:bg-surface2">Xóa lọc</button>}
    />
  );
}
