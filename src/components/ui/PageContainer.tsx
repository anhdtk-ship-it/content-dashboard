import type { ReactNode } from 'react';

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/** Khung nội dung trang: căn giữa, max-width 1180px, padding chuẩn (DESIGN_SYSTEM §9). */
export function PageContainer({ children, className = '' }: PageContainerProps) {
  return <div className={`mx-auto w-full max-w-[1180px] px-4 py-[18px] ${className}`}>{children}</div>;
}

export function PageContainerDemo() {
  return (
    <PageContainer>
      <div className="rounded-card border border-dashed border-line p-6 text-center text-muted">
        Nội dung trang nằm trong PageContainer (max-w 1180px)
      </div>
    </PageContainer>
  );
}
