import type { ReactNode } from 'react';

export interface NavItem {
  icon?: ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}
export interface SidebarProps {
  brand?: ReactNode;
  groups: NavGroup[];
  footer?: ReactNode;
  collapsed?: boolean;
  className?: string;
}

/** Sidebar điều hướng có nhóm, hỗ trợ collapse + keyboard focus — phong cách Linear/Vercel. */
export function Sidebar({ brand, groups, footer, collapsed = false, className = '' }: SidebarProps) {
  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="px-3 py-3">
        {collapsed ? <div className="text-center text-lg font-bold text-fg">⚡</div> : brand}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g, i) => (
          <div key={i} className="mb-3">
            {g.label && !collapsed && (
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                {g.label}
              </div>
            )}
            {collapsed && i > 0 && <div className="mx-2 my-2 border-t border-line" />}
            {g.items.map((it, j) => (
              <a
                key={j}
                href={it.href}
                onClick={it.onClick}
                title={collapsed ? it.label : undefined}
                aria-current={it.active ? 'page' : undefined}
                className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  collapsed ? 'justify-center px-0' : ''
                } ${it.active ? 'bg-surface2 text-fg' : 'text-muted hover:bg-surface hover:text-fg'}`}
              >
                <span className="w-4 shrink-0 text-center">{it.icon}</span>
                {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                {!collapsed && it.badge != null && (
                  <span className="rounded-full bg-accent/15 px-1.5 text-[10px] font-medium text-accent">{it.badge}</span>
                )}
                {collapsed && it.badge != null && (
                  <span className="absolute right-1 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </a>
            ))}
          </div>
        ))}
      </nav>
      {footer && <div className="border-t border-line p-2">{footer}</div>}
    </div>
  );
}

export function SidebarDemo() {
  return (
    <div className="h-[420px] w-[240px] rounded-card border border-line bg-[#0a101d]">
      <Sidebar
        brand={<div className="flex items-center gap-2 px-1 text-[15px] font-bold text-fg">⚡ Ops Dashboard</div>}
        groups={[
          { label: 'Dashboards', items: [{ icon: '📋', label: 'Tổng Quan', active: true }, { icon: '👤', label: 'Người Nhận' }] },
          { label: 'System', items: [{ icon: '🔄', label: 'Sync' }, { icon: '⚙️', label: 'Settings' }] },
        ]}
        footer={<div className="px-2 py-1 text-[11px] text-muted">v2 · 2026</div>}
      />
    </div>
  );
}
