import { useState } from 'react';

export interface UserMenuAction {
  label: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
}
export interface UserMenuProps {
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
  items?: UserMenuAction[];
  className?: string;
}

/** Menu user: avatar + dropdown (tên/email/role + hành động) — Linear/Vercel style. */
export function UserMenu({ name, email, role, avatarUrl, items = [], className = '' }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const initials = name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
            {initials}
          </span>
        )}
        <span className="hidden text-[13px] text-fg sm:block">{name}</span>
        <span className="hidden text-muted sm:block">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-60 rounded-xl border border-line bg-surface p-1 shadow-2xl">
            <div className="px-3 py-2">
              <div className="text-[13px] font-medium text-fg">{name}</div>
              <div className="truncate text-[11px] text-muted">{email}</div>
              {role && <span className="mt-1.5 inline-block rounded bg-surface2 px-1.5 py-0.5 text-[10px] text-muted">{role}</span>}
            </div>
            <div className="my-1 h-px bg-line" />
            {items.map((it, i) => (
              <button
                key={i}
                onClick={() => { it.onClick?.(); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-surface2 ${
                  it.danger ? 'text-danger' : 'text-fg'
                }`}
              >
                {it.icon && <span className="w-4 text-center">{it.icon}</span>}
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function UserMenuDemo() {
  return (
    <UserMenu
      name="Phạm Cao"
      email="viewer@seryn.vn"
      role="Viewer"
      items={[
        { label: 'Cài đặt', icon: '⚙️' },
        { label: 'Trợ giúp', icon: '❔' },
        { label: 'Đăng xuất', icon: '⏻', danger: true },
      ]}
    />
  );
}
