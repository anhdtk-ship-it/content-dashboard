// LayoutShowcase — ráp toàn bộ layout primitive thành 1 khung mẫu (KHÔNG phải dashboard thật).
// Render <LayoutShowcase /> trong app React có Tailwind + import '../ui/tokens.css'.
import {
  AppShell, Sidebar, Header, Breadcrumb, TopNavigation,
  NotificationArea, UserMenu, DarkModeToggle, PageHeader, PageContainer,
} from './index';

const NAV = [
  { label: 'Dashboards', items: [
    { icon: '📋', label: 'Tổng Quan', active: true }, { icon: '👤', label: 'Người Nhận' }, { icon: '🌐', label: 'Thị Trường' },
  ] },
  { label: 'Content', items: [{ icon: '🔎', label: 'Explorer' }, { icon: '⏳', label: 'Vòng đời' }] },
  { label: 'Insights', items: [{ icon: '📊', label: 'Reports' }, { icon: '🔔', label: 'Alerts', badge: 4 }] },
  { label: 'System', items: [{ icon: '🔄', label: 'Sync' }, { icon: '👥', label: 'User' }, { icon: '⚙️', label: 'Settings' }] },
];

export function LayoutShowcase() {
  return (
    <AppShell
      sidebar={
        <Sidebar
          brand={<div className="px-1 text-[15px] font-bold text-fg">⚡ Ops Dashboard</div>}
          groups={NAV}
          footer={<div className="px-2 py-1 text-[11px] text-muted">Workspace · Seryn</div>}
        />
      }
      header={({ onMenuClick }) => (
        <Header
          onMenuClick={onMenuClick}
          left={<Breadcrumb items={[{ label: 'Dashboards', href: '#' }, { label: 'Tổng Quan' }]} />}
          center={
            <button className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-muted hover:text-fg">
              🔍 Tìm nhanh <span className="rounded bg-surface2 px-1 text-[10px]">⌘K</span>
            </button>
          }
          right={
            <>
              <NotificationArea items={[
                { id: '1', title: 'Sync hoàn tất: 1510 cập nhật', time: '2 phút trước', unread: true },
                { id: '2', title: '3 content test quá 14 ngày', time: '1 giờ trước', unread: true },
              ]} />
              <DarkModeToggle />
              <UserMenu name="Phạm Cao" email="viewer@seryn.vn" role="Viewer"
                items={[{ label: 'Cài đặt', icon: '⚙️' }, { label: 'Đăng xuất', icon: '⏻', danger: true }]} />
            </>
          }
        />
      )}
    >
      <PageHeader
        title="Tổng Quan"
        description="Snapshot vận hành nội dung"
        tabs={<TopNavigation tabs={[
          { key: 'kpi', label: 'KPI', active: true }, { key: 'funnel', label: 'Funnel' }, { key: 'alerts', label: 'Alerts', badge: 4 },
        ]} />}
        actions={<button className="rounded-control border border-line bg-surface px-[10px] py-[6px] text-[13px] text-fg hover:bg-surface2">⬇ Export</button>}
      />
      <PageContainer>
        <div className="rounded-card border border-dashed border-line p-10 text-center text-muted">
          Vùng nội dung trang (module dashboard sẽ render ở đây)
        </div>
      </PageContainer>
    </AppShell>
  );
}

export default LayoutShowcase;
