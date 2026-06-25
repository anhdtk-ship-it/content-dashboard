import type { ReactNode } from 'react';

// Tái xuất PageContainer từ UI library (không trùng lặp định nghĩa).
export { PageContainer } from '../ui/PageContainer';
export type { PageContainerProps } from '../ui/PageContainer';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}

/** Tiêu đề trang chuẩn: breadcrumb + tiêu đề + mô tả + actions + tabs (Vercel/Stripe). */
export function PageHeader({ title, description, breadcrumb, actions, tabs, className = '' }: PageHeaderProps) {
  return (
    <div className={`border-b border-line ${className}`}>
      <div className="mx-auto w-full max-w-content px-4 pt-4">
        {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-fg">{title}</h1>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {tabs && <div className="mt-3">{tabs}</div>}
      </div>
    </div>
  );
}

export function PageHeaderDemo() {
  return (
    <PageHeader
      title="Vòng đời Content"
      description="Tính từ Ngày Set Ads · 277 content đã chạy"
      actions={
        <button className="rounded-control border border-line bg-surface px-[10px] py-[6px] text-[13px] text-fg hover:bg-surface2">⬇ Export</button>
      }
    />
  );
}
