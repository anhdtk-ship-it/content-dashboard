import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface MetricTooltipProps {
  tip: ReactNode;
  children: ReactNode;
  className?: string;
}

const TIP_W = 250;

/**
 * Tooltip công thức KPI — hover/focus hiện (DESIGN_SYSTEM §3/§10).
 * Render popup qua PORTAL ra document.body + position:fixed nên KHÔNG bị
 * cắt bởi vùng cuộn `overflow-auto` của AppShell hay mép viewport
 * (kẹp ngang trong màn hình; lật xuống dưới nếu sát mép trên).
 */
export function MetricTooltip({ tip, children, className = '' }: MetricTooltipProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean }>({ left: 0, top: 0, above: true });

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = Math.min(r.left, window.innerWidth - TIP_W - 8);
    left = Math.max(8, left);
    const above = r.top > 110; // đủ chỗ phía trên thì hiện trên, không thì lật xuống
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1 ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              width: TIP_W,
              transform: pos.above ? 'translateY(-100%)' : 'none',
            }}
            className="pointer-events-none z-[1000] rounded-control border border-[#243049] bg-[#0a101d] px-[11px] py-[9px] text-xs font-normal leading-snug text-[#e6edf6] shadow-[0_8px_24px_rgba(0,0,0,.55)]"
          >
            {tip}
          </span>,
          document.body,
        )}
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
