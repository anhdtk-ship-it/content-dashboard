import type { ReactNode } from 'react';

export interface HeaderProps {
  left?: ReactNode;     // thường là Breadcrumb / tiêu đề
  center?: ReactNode;   // thường là ô tìm / command (⌘K)
  right?: ReactNode;    // notifications + theme + user
  onMenuClick?: () => void; // mở sidebar trên mobile
  className?: string;
}

/** Header/Top bar mảnh (h-12) — Linear/Vercel: breadcrumb trái, actions phải. */
export function Header({ left, center, right, onMenuClick, className = '' }: HeaderProps) {
  return (
    <header className={`flex h-12 items-center gap-3 border-b border-line bg-bg/80 px-3 backdrop-blur sm:px-4 ${className}`}>
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          aria-label="Mở menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg lg:hidden"
        >
          ☰
        </button>
      )}
      <div className="min-w-0 flex-1">{left}</div>
      {center && <div className="hidden md:block">{center}</div>}
      <div className="flex items-center gap-1.5">{right}</div>
    </header>
  );
}

export function HeaderDemo() {
  return (
    <div className="rounded-card border border-line">
      <Header
        left={<span className="text-[13px] text-muted">Dashboards <span className="text-muted/50">/</span> <span className="text-fg">Tổng Quan</span></span>}
        center={
          <button className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-muted hover:text-fg">
            🔍 Tìm nhanh <span className="rounded bg-surface2 px-1 text-[10px]">⌘K</span>
          </button>
        }
        right={<span className="text-xs text-muted">🔔  🌙  ◯</span>}
      />
    </div>
  );
}
