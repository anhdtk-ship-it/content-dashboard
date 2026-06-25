import { useState } from 'react';

export type DatePreset =
  | 'today' | 'yesterday' | 'last7' | 'last30'
  | 'thisweek' | 'lastweek' | 'thismonth' | 'lastmonth' | 'custom';

export interface DateRangeValue {
  preset: DatePreset;
  from?: string; // YYYY-MM-DD (khi preset = custom)
  to?: string;
}

export interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  className?: string;
}

export const DATE_PRESETS: [DatePreset, string][] = [
  ['today', 'Hôm nay'],
  ['yesterday', 'Hôm qua'],
  ['last7', '7 ngày'],
  ['last30', '30 ngày'],
  ['thisweek', 'Tuần này'],
  ['lastweek', 'Tuần trước'],
  ['thismonth', 'Tháng này'],
  ['lastmonth', 'Tháng trước'],
  ['custom', 'Tùy chỉnh…'],
];

const inputCls = 'rounded-control border border-line bg-surface px-2 py-[6px] text-[13px] text-fg focus:border-accent focus:outline-none';

/** Bộ lọc thời gian: 9 preset + khoảng ngày tùy chỉnh (DESIGN_SYSTEM §8). */
export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <select
        value={value.preset}
        onChange={(e) => onChange({ ...value, preset: e.target.value as DatePreset })}
        className={inputCls}
      >
        {DATE_PRESETS.map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
      {value.preset === 'custom' && (
        <span className="flex items-center gap-1">
          <input type="date" value={value.from ?? ''} onChange={(e) => onChange({ ...value, from: e.target.value })} className={inputCls} />
          <span className="text-muted">→</span>
          <input type="date" value={value.to ?? ''} onChange={(e) => onChange({ ...value, to: e.target.value })} className={inputCls} />
        </span>
      )}
    </div>
  );
}

export function DateRangePickerDemo() {
  const [v, setV] = useState<DateRangeValue>({ preset: 'thismonth' });
  return (
    <div>
      <DateRangePicker value={v} onChange={setV} />
      <p className="mt-2 text-xs text-muted">Đang chọn: {v.preset}{v.from ? ` (${v.from} → ${v.to ?? '…'})` : ''}</p>
    </div>
  );
}
