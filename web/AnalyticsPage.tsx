import { useState } from 'react';
import { TabBar, type TabDef } from './Tabs';
import { ExplorerPage } from './ExplorerPage';
import { LifecyclePage } from './LifecyclePage';

/* Gộp giao diện: Content Explorer + Vòng đời Content.
 * Mỗi Tab render NGUYÊN trang hiện có — không đổi chỉ số/bộ lọc/bảng/logic. */
const TABS: TabDef[] = [
  { key: 'explorer', label: 'Content Explorer' },
  { key: 'lifecycle', label: 'Vòng đời Content' },
];

export function AnalyticsPage() {
  const [tab, setTab] = useState('explorer');
  return (
    <div className="text-fg">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'explorer' ? <ExplorerPage /> : <LifecyclePage />}
    </div>
  );
}
