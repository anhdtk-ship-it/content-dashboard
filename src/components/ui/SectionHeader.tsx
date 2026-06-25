import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

/** Tiêu đề section: 13px UPPERCASE, muted, letter-spacing .04em (DESIGN_SYSTEM §2). */
export function SectionHeader({ title, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-[10px] mt-1 flex items-center justify-between gap-2 ${className}`}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{title}</h2>
      {action}
    </div>
  );
}

export function SectionHeaderDemo() {
  return (
    <SectionHeader
      title="KPI nghiệp vụ"
      action={<span className="text-xs text-muted">di chuột vào ⓘ để xem công thức</span>}
    />
  );
}
