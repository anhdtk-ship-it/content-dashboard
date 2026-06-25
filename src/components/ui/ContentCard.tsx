import type { ReactNode } from 'react';

export interface ContentCardProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Panel chung: nền surface, viền line, radius 12, padding 16 (DESIGN_SYSTEM §3). */
export function ContentCard({ title, action, children, className = '' }: ContentCardProps) {
  return (
    <div className={`mb-4 rounded-card border border-line bg-surface p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-fg">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function ContentCardDemo() {
  return (
    <ContentCard title="Phân bổ thị trường" action={<span className="text-xs text-muted">tháng này</span>}>
      <div className="flex items-center gap-3 text-sm text-fg">
        <span>Nội Địa: 764</span>
        <span className="text-muted">·</span>
        <span>Quốc Tế: 746</span>
      </div>
    </ContentCard>
  );
}
