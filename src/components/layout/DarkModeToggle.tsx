import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

/** Đọc theme hiện tại từ <html data-theme>. */
export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
}
/** Ghi theme vào <html> + localStorage. */
export function applyTheme(t: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('theme', t); } catch { /* ignore */ }
}

export interface DarkModeToggleProps {
  className?: string;
}

/** Nút bật/tắt Dark Mode — đổi data-theme trên <html> (DESIGN_SYSTEM §12). */
export function DarkModeToggle({ className = '' }: DarkModeToggleProps) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    let saved: Theme | null = null;
    try { saved = localStorage.getItem('theme') as Theme | null; } catch { /* ignore */ }
    const init = saved ?? getTheme();
    applyTheme(init);
    setTheme(init);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Chuyển sang Light' : 'Chuyển sang Dark'}
      aria-label="Đổi giao diện sáng/tối"
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-fg ${className}`}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}

export function DarkModeToggleDemo() {
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted">
      <DarkModeToggle /> Bấm để đổi Dark/Light (ghi vào &lt;html data-theme&gt;)
    </div>
  );
}
