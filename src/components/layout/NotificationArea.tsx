import { useState } from 'react';
import type { ReactNode } from 'react';

export interface NotificationItem {
  id: string;
  title: ReactNode;
  time?: string;
  unread?: boolean;
}
export interface NotificationAreaProps {
  items: NotificationItem[];
  onItemClick?: (item: NotificationItem) => void;
  className?: string;
}

/** Khu thông báo: chuông + badge + dropdown (Linear/Stripe style). */
export function NotificationArea({ items, onItemClick, className = '' }: NotificationAreaProps) {
  const [open, setOpen] = useState(false);
  const unread = items.filter((i) => i.unread).length;
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Thông báo"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-fg"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-80 rounded-xl border border-line bg-surface p-1 shadow-2xl">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold text-muted">Thông báo</span>
              {unread > 0 && <span className="text-[11px] text-accent">{unread} chưa đọc</span>}
            </div>
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted">Không có thông báo</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { onItemClick?.(n); setOpen(false); }}
                  className="flex w-full gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface2"
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.unread ? 'bg-accent' : 'bg-transparent'}`} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-fg">{n.title}</span>
                    {n.time && <span className="block text-[11px] text-muted">{n.time}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function NotificationAreaDemo() {
  return (
    <NotificationArea
      items={[
        { id: '1', title: 'Sync hoàn tất: 1510 cập nhật', time: '2 phút trước', unread: true },
        { id: '2', title: '3 content đang test quá 14 ngày', time: '1 giờ trước', unread: true },
        { id: '3', title: 'Backfill ngày xong', time: 'Hôm qua' },
      ]}
    />
  );
}
