import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface NavItem {
  icon?: ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;   // mục có trong cấu trúc nhưng trang chưa dựng (placeholder "sắp có")
}
export interface NavGroup {
  key?: string;
  label?: string;
  icon?: ReactNode;
  /** true → nhóm Platform có thể Expand/Collapse (VD Facebook, Zalo, TikTok…). */
  collapsible?: boolean;
  items: NavItem[];
}
export interface SidebarProps {
  brand?: ReactNode;
  groups: NavGroup[];
  footer?: ReactNode;
  collapsed?: boolean;
  className?: string;
}

const ITEM_BASE =
  'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent';

/** Sidebar điều hướng theo Platform: nhóm Facebook/Zalo/… expand-collapse (accordion),
 *  tự mở nhóm chứa trang đang xem. THUẦN UI — không đụng route/logic/dữ liệu. */
export function Sidebar({ brand, groups, footer, collapsed = false, className = '' }: SidebarProps) {
  // Nhóm collapsible đang chứa mục active (theo trang hiện tại).
  const activeGroupKey = groups.find((g) => g.collapsible && g.items.some((it) => it.active))?.key ?? null;
  const [expanded, setExpanded] = useState<string | null>(activeGroupKey);
  // Điều hướng sang platform khác → tự expand nhóm tương ứng (yêu cầu 9 & 10).
  useEffect(() => { if (activeGroupKey) setExpanded(activeGroupKey); }, [activeGroupKey]);

  const renderItem = (it: NavItem, j: number) => {
    if (it.disabled) {
      return (
        <div key={j} title="Sắp có" aria-disabled="true"
          className={`${ITEM_BASE} cursor-not-allowed text-muted/40 ${collapsed ? 'justify-center px-0' : ''}`}>
          <span className="w-4 shrink-0 text-center">{it.icon}</span>
          {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
          {!collapsed && <span className="text-[9px] font-medium uppercase tracking-wide text-muted/40">sắp có</span>}
        </div>
      );
    }
    return (
      <a key={j} href={it.href} onClick={it.onClick} title={collapsed ? it.label : undefined}
        aria-current={it.active ? 'page' : undefined}
        className={`${ITEM_BASE} ${collapsed ? 'justify-center px-0' : ''} ${
          it.active ? 'bg-surface2 font-semibold text-fg' : 'text-fg/75 hover:bg-surface hover:text-fg'
        }`}>
        <span className="w-4 shrink-0 text-center">{it.icon}</span>
        {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
        {!collapsed && it.badge != null && (
          <span className="rounded-full bg-accent/15 px-1.5 text-[10px] font-medium text-accent">{it.badge}</span>
        )}
      </a>
    );
  };

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="px-3 py-3">
        {collapsed ? <div className="text-center text-lg font-bold text-fg">⚡</div> : brand}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g, i) => {
          // --- Nhóm thường (VD 🏠 Dashboard): hiển thị mục trực tiếp ---
          if (!g.collapsible) {
            return (
              <div key={i} className="mb-2">
                {g.label && !collapsed && (
                  <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted/70">{g.label}</div>
                )}
                {g.items.map(renderItem)}
              </div>
            );
          }

          // --- Rail thu gọn: chỉ hiện icon Platform, click → mục đầu tiên ---
          if (collapsed) {
            const first = g.items.find((it) => it.href && !it.disabled) ?? g.items[0];
            const groupActive = g.items.some((it) => it.active);
            return (
              <a key={i} href={first?.href} title={g.label}
                className={`${ITEM_BASE} justify-center px-0 ${groupActive ? 'bg-surface2 text-fg' : 'text-fg/75 hover:bg-surface hover:text-fg'}`}>
                <span className="w-4 shrink-0 text-center">{g.icon}</span>
              </a>
            );
          }

          // --- Nhóm Platform: header Expand/Collapse (accordion) ---
          const isOpen = expanded === g.key;
          const groupActive = g.items.some((it) => it.active);
          return (
            <div key={i} className="mb-1">
              <button type="button" onClick={() => setExpanded(isOpen ? null : (g.key ?? null))}
                aria-expanded={isOpen}
                className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[15.5px] font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  groupActive ? 'bg-surface2 text-fg' : 'text-fg/90 hover:bg-surface hover:text-fg'
                }`}>
                <span className="w-4 shrink-0 text-center text-[17px]">{g.icon}</span>
                <span className="flex-1 truncate text-left">{g.label}</span>
                <span className={`text-[11px] text-fg/60 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
              </button>
              {isOpen && (
                <div className="mb-1 ml-[18px] border-l border-line pl-2">
                  {g.items.map(renderItem)}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      {footer && <div className="border-t border-line p-2">{footer}</div>}
    </div>
  );
}

export function SidebarDemo() {
  return (
    <div className="h-[460px] w-[240px] rounded-card border border-line bg-[#0a101d]">
      <Sidebar
        brand={<div className="flex items-center gap-2 px-1 text-[15px] font-bold text-fg">⚡ Ops Dashboard</div>}
        groups={[
          { items: [{ icon: '🏠', label: 'Dashboard', active: true }] },
          { key: 'facebook', icon: '📘', label: 'Facebook', collapsible: true, items: [
            { icon: '📋', label: 'Tổng quan', active: true }, { icon: '📝', label: 'Weekly Report' },
          ] },
          { key: 'zalo', icon: '💬', label: 'Zalo', collapsible: true, items: [
            { icon: '📋', label: 'Tổng quan' }, { icon: '⚙️', label: 'Cài đặt', disabled: true },
          ] },
        ]}
        footer={<div className="px-2 py-1 text-[11px] text-muted">v2 · 2026</div>}
      />
    </div>
  );
}
