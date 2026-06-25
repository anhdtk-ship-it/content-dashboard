import { useState } from 'react';
import type { ReactNode } from 'react';

export interface AppShellRenderArgs {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMenuClick: () => void;
}

export interface AppShellProps {
  sidebar: ReactNode | ((p: AppShellRenderArgs) => ReactNode);
  header?: ReactNode | ((p: AppShellRenderArgs) => ReactNode);
  children: ReactNode;
  className?: string;
}

/**
 * Khung ứng dụng dùng chung: sidebar (cố định desktop / drawer mobile, có collapse)
 * + header luôn hiển thị + vùng nội dung cuộn độc lập.
 * Responsive theo DESIGN_SYSTEM §13 (breakpoint lg).
 */
export function AppShell({ sidebar, header, children, className = '' }: AppShellProps) {
  const [open, setOpen] = useState(false);        // drawer mobile
  const [collapsed, setCollapsed] = useState(false); // rail desktop
  const args: AppShellRenderArgs = {
    collapsed,
    onToggleCollapse: () => setCollapsed((c) => !c),
    onMenuClick: () => setOpen(true),
  };
  const sb = typeof sidebar === 'function' ? sidebar(args) : sidebar;
  const hd = typeof header === 'function' ? header(args) : header;
  const widthLg = collapsed ? 'lg:w-[60px]' : 'lg:w-[240px]';

  return (
    <div className={`flex h-screen overflow-hidden bg-bg text-fg ${className}`}>
      {/* overlay mobile */}
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {/* sidebar: drawer mobile / static desktop (collapse) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 max-lg:w-[240px] transform border-r border-line bg-[#0a101d] transition-all duration-200 lg:static lg:z-auto lg:translate-x-0 ${widthLg} ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sb}
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {hd}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
