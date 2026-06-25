import type { ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: ReactNode;
  active?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}
export interface TopNavigationProps {
  tabs: TabItem[];
  className?: string;
}

/** Tab điều hướng cấp trang (Vercel project tabs) — gạch chân active. */
export function TopNavigation({ tabs, className = '' }: TopNavigationProps) {
  return (
    <div className={`flex gap-1 overflow-x-auto border-b border-line ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={t.onClick}
          className={`relative -mb-px flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[13px] transition-colors ${
            t.active ? 'text-fg' : 'text-muted hover:text-fg'
          }`}
        >
          {t.label}
          {t.badge != null && <span className="rounded-full bg-surface2 px-1.5 text-[10px] text-muted">{t.badge}</span>}
          {t.active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-accent" />}
        </button>
      ))}
    </div>
  );
}

export function TopNavigationDemo() {
  return (
    <TopNavigation
      tabs={[
        { key: 'overview', label: 'Tổng quan', active: true },
        { key: 'progress', label: 'Tiến độ' },
        { key: 'alerts', label: 'Alerts', badge: 4 },
        { key: 'settings', label: 'Cài đặt' },
      ]}
    />
  );
}
