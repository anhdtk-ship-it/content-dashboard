import type { ReactNode } from 'react';

export interface StatDelta {
  value: string;
  dir: 'up' | 'down' | 'flat';
}

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  delta?: StatDelta;
  className?: string;
}

/** Thẻ thống kê có icon + delta so kỳ trước (DESIGN_SYSTEM §3, dùng cho Sync/Reports). */
export function StatCard({ label, value, icon, delta, className = '' }: StatCardProps) {
  const dcol = delta?.dir === 'up' ? 'text-success' : delta?.dir === 'down' ? 'text-danger' : 'text-muted';
  const arrow = delta?.dir === 'up' ? '▲' : delta?.dir === 'down' ? '▼' : '→';
  return (
    <div className={`rounded-card border border-line bg-surface px-[15px] py-[13px] ${className}`}>
      <div className="mb-[5px] flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="flex items-end gap-2">
        <div className="text-[22px] font-bold text-fg">{value}</div>
        {delta && <span className={`pb-1 text-xs ${dcol}`}>{arrow} {delta.value}</span>}
      </div>
    </div>
  );
}

export function StatCardDemo() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard label="Tổng record" value="1510" icon={<span>📦</span>} />
      <StatCard label="upload_real" value="1483" delta={{ value: '98%', dir: 'up' }} />
      <StatCard label="test_real" value="1003" delta={{ value: '66%', dir: 'down' }} />
    </div>
  );
}
