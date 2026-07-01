import type { ReactNode } from 'react';
import { MetricTooltip } from './MetricTooltip';

export type KPITone = 'default' | 'accent' | 'good' | 'warn' | 'orange' | 'danger' | 'info';

export interface KPICardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: KPITone;
  tooltip?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

const TONE: Record<KPITone, string> = {
  default: 'text-fg',
  accent: 'text-accent',
  good: 'text-success',
  warn: 'text-warn',
  orange: 'text-[#fb923c]',   // Chờ chạy / Cần xử lý
  danger: 'text-danger',       // Không duyệt / Khẩn cấp
  info: 'text-[#7dd3fc]',      // Đã chạy-Tắt
};

/** Thẻ KPI — số lớn đọc nhanh, tooltip công thức (DESIGN_SYSTEM §3). */
export function KPICard({ label, value, sub, tone = 'default', tooltip, active, onClick, className = '' }: KPICardProps) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={`rounded-card border bg-surface px-[15px] py-[13px] transition ${
        active ? 'border-accent shadow-[inset_0_0_0_1px_var(--accent)]' : 'border-line'
      } ${clickable ? 'cursor-pointer hover:border-accent' : ''} ${className}`}
    >
      <div className="mb-[5px] flex items-center gap-1 text-xs text-muted">
        <span>{label}</span>
        {tooltip && (
          <MetricTooltip tip={tooltip}>
            <span className="inline-flex h-[15px] w-[15px] shrink-0 cursor-help items-center justify-center rounded-full border border-accent bg-surface2 text-[10px] font-bold leading-none text-accent">
              i
            </span>
          </MetricTooltip>
        )}
      </div>
      <div className={`text-[25px] font-bold leading-[1.1] ${TONE[tone]}`}>{value}</div>
      {sub && <div className="mt-[3px] text-[11px] tabular-nums text-muted">{sub}</div>}
    </div>
  );
}

export function KPICardDemo() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KPICard label="Tổng Content" value="311" tone="accent" />
      <KPICard label="Tỷ lệ thành công" value="14%" sub="27/199" tone="good" tooltip="Thành công (Duy trì) ÷ Đã có kết quả cuối" />
      <KPICard label="Đang Test" value="44" tone="warn" />
      <KPICard label="Đã Dừng" value="134" onClick={() => {}} active />
    </div>
  );
}
