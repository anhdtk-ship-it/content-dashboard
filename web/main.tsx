import { StrictMode, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import '../src/components/ui/tokens.css';
import {
  AppShell, Sidebar, Header, Breadcrumb, NotificationArea, UserMenu, DarkModeToggle,
} from '../src/components/layout';
import { SearchBox, PageContainer, EmptyState } from '../src/components/ui';
import { OverviewPage } from './OverviewPage';
import { AssigneesPage } from './AssigneesPage';
import { MarketsPage } from './MarketsPage';
import { ExplorerPage } from './ExplorerPage';
import { LifecyclePage } from './LifecyclePage';
import { UsagePage } from './UsagePage';
import { AnalyticsPage } from './AnalyticsPage';

/* ---------- menu & routes (1 nguồn duy nhất) ----------
 * Menu (V5) đã gộp: chỉ hiện Tổng Quan + 2 trang gộp. Các route cũ
 * (assignees/markets/explorer/lifecycle/sync/users/settings) GIỮ NGUYÊN
 * trong PAGES (không xóa route/code), chỉ ẩn khỏi menu điều hướng. */
const NAV: { label: string; items: { icon: string; label: string; href: string; key: string }[] }[] = [
  { label: '📊 Dashboard', items: [
    { icon: '📋', label: 'Tổng Quan', href: '#/overview', key: 'overview' },
    { icon: '🌐', label: 'Thị Trường', href: '#/markets', key: 'markets' },
    { icon: '🔎', label: 'Content & Vòng đời', href: '#/analytics', key: 'analytics' },
  ] },
];

function Stub({ title }: { title: string }) {
  return <PageContainer><div className="py-20"><EmptyState icon="🛠️" message={`${title} — màn hình đang phát triển (Sprint 4)`} /></div></PageContainer>;
}

const PAGES: Record<string, { title: string; el: ReactNode }> = {
  overview: { title: 'Tổng Quan', el: <OverviewPage /> },
  // Trang gộp (V5)
  usage: { title: 'Tiến độ sử dụng Content', el: <UsagePage /> },
  analytics: { title: 'Content & Vòng đời', el: <AnalyticsPage /> },
  // Route cũ giữ nguyên (ẩn khỏi menu — vẫn truy cập được qua URL)
  assignees: { title: 'Tiến độ Test Content', el: <AssigneesPage /> },
  markets: { title: 'Thị Trường', el: <MarketsPage /> },
  lifecycle: { title: 'Vòng đời Content', el: <LifecyclePage /> },
  explorer: { title: 'Explorer', el: <ExplorerPage /> },
  sync: { title: 'Quản lý Sync', el: <Stub title="Quản lý Sync" /> },
  users: { title: 'User', el: <Stub title="Quản lý User" /> },
  settings: { title: 'Cài đặt', el: <Stub title="Cài đặt" /> },
};

const routeKey = (h: string) => (h || '').replace(/^#\//, '').split('?')[0] || 'overview';

/* ---------- App ---------- */
function App() {
  const [hash, setHash] = useState(() => location.hash);
  const [q, setQ] = useState('');
  useEffect(() => {
    const h = () => setHash(location.hash);
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const key = routeKey(hash);
  const page = PAGES[key] ?? PAGES.overview;
  useEffect(() => { document.title = `${page.title} — Ops Dashboard`; }, [page.title]); // Meta title đồng bộ tên trang
  const group = NAV.find((g) => g.items.some((it) => it.key === key))?.label ?? '📊 Dashboard';
  const groupName = group.replace(/^\S+\s/, ''); // bỏ emoji cho breadcrumb

  const navGroups = NAV.map((g) => ({
    label: g.label,
    items: g.items.map((it) => ({ ...it, active: it.key === key })),
  }));

  return (
    <AppShell
      sidebar={({ collapsed, onToggleCollapse }) => (
        <Sidebar
          collapsed={collapsed}
          brand={<div className="px-1 text-[15px] font-bold text-fg">⚡ Ops Dashboard</div>}
          groups={navGroups}
          footer={
            <button
              onClick={onToggleCollapse}
              className="hidden w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-muted outline-none hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-accent lg:flex"
              title={collapsed ? 'Mở rộng' : 'Thu gọn'}
            >
              {collapsed ? '»' : '« Thu gọn'}
            </button>
          }
        />
      )}
      header={({ onMenuClick }) => (
        <Header
          onMenuClick={onMenuClick}
          left={<Breadcrumb items={[{ label: groupName, href: '#/overview' }, { label: page.title }]} />}
          center={<div className="w-[260px]"><SearchBox value={q} onChange={setQ} placeholder="Tìm nhanh… (⌘K)" /></div>}
          right={
            <>
              <NotificationArea items={[
                { id: '1', title: 'Sync hoàn tất: 1510 cập nhật', time: '2 phút trước', unread: true },
                { id: '2', title: '3 content đang test quá 14 ngày', time: '1 giờ trước', unread: true },
                { id: '3', title: 'Backfill ngày hoàn tất', time: 'Hôm qua' },
              ]} />
              <DarkModeToggle />
              <UserMenu
                name="Phạm Cao" email="phamcao62@gmail.com" role="Team Leader"
                items={[{ label: 'Cài đặt', icon: '⚙️', onClick: () => { location.hash = '#/settings'; } }, { label: 'Đăng xuất', icon: '⏻', danger: true }]}
              />
            </>
          }
        />
      )}
    >
      {page.el}
    </AppShell>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
