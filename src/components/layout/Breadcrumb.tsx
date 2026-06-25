import type { ReactNode } from 'react';

export interface Crumb {
  label: ReactNode;
  href?: string;
}
export interface BreadcrumbProps {
  items: Crumb[];
  className?: string;
}

/** Breadcrumb — phân cấp đường dẫn (Vercel/Stripe style). */
export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className={`flex items-center gap-1.5 text-[13px] ${className}`}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted/50">/</span>}
            {c.href && !last ? (
              <a href={c.href} className="text-muted transition-colors hover:text-fg">{c.label}</a>
            ) : (
              <span className={last ? 'font-medium text-fg' : 'text-muted'}>{c.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function BreadcrumbDemo() {
  return <Breadcrumb items={[{ label: 'Dashboards', href: '#' }, { label: 'Vòng đời', href: '#' }, { label: 'Chi tiết content' }]} />;
}
