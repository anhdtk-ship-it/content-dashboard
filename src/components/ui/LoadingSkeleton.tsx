export type SkeletonVariant = 'kpi' | 'table' | 'line' | 'block';

export interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
  className?: string;
}

const SHIMMER = 'animate-pulse rounded-md bg-gradient-to-r from-surface via-surface2 to-surface';

/** Skeleton loading theo loại nội dung (DESIGN_SYSTEM §13). */
export function LoadingSkeleton({ variant = 'block', count, className = '' }: LoadingSkeletonProps) {
  if (variant === 'kpi') {
    return (
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`}>
        {Array.from({ length: count ?? 4 }).map((_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface p-4">
            <div className={`${SHIMMER} h-[54px]`} />
          </div>
        ))}
      </div>
    );
  }
  if (variant === 'table') {
    return (
      <div className={className}>
        {Array.from({ length: count ?? 6 }).map((_, i) => (
          <div key={i} className={`${SHIMMER} mb-2 h-9`} />
        ))}
      </div>
    );
  }
  if (variant === 'line') return <div className={`${SHIMMER} h-4 ${className}`} />;
  return <div className={`${SHIMMER} h-[200px] ${className}`} />;
}

export function LoadingSkeletonDemo() {
  return (
    <div className="space-y-4">
      <LoadingSkeleton variant="kpi" count={4} />
      <LoadingSkeleton variant="table" count={4} />
    </div>
  );
}
