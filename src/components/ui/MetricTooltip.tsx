import type { ReactNode } from 'react';

export interface MetricTooltipProps {
  tip: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Tooltip công thức KPI — hover hiện (DESIGN_SYSTEM §3/§10). */
export function MetricTooltip({ tip, children, className = '' }: MetricTooltipProps) {
  return (
    <span className={`group relative inline-flex items-center gap-1 ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[130%] left-0 z-50 w-[250px] rounded-control border border-line bg-[#0a101d] px-[11px] py-[9px] text-xs font-normal leading-snug text-fg opacity-0 shadow-[0_8px_24px_rgba(0,0,0,.55)] transition-opacity duration-150 group-hover:opacity-100"
      >
        {tip}
      </span>
    </span>
  );
}

export function MetricTooltipDemo() {
  return (
    <MetricTooltip tip="Thành công ÷ Đã được test. Thành công = Duy trì + Đã chạy-Tắt.">
      <span className="cursor-help text-sm text-fg">
        Tỷ lệ test thành công
        <span className="ml-1 inline-flex h-[14px] w-[14px] items-center justify-center rounded-full bg-surface2 text-[10px] text-muted">
          i
        </span>
      </span>
    </MetricTooltip>
  );
}
