import { useState } from 'react';
import { TabBar, type TabDef } from './Tabs';
import { AssigneesPage } from './AssigneesPage';
import { MarketsPage } from './MarketsPage';

/* Gộp giao diện: Tiến độ Test Content (Nhân viên Ads) + Thị Trường.
 * Mỗi Tab render NGUYÊN dashboard hiện có — không đổi nội dung/chỉ số/logic. */
const TABS: TabDef[] = [
  { key: 'assignee', label: 'Theo Nhân viên Ads' },
  { key: 'market', label: 'Theo Thị trường' },
];

export function UsagePage() {
  const [tab, setTab] = useState('assignee');
  return (
    <div className="text-fg">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'assignee' ? <AssigneesPage /> : <MarketsPage />}
    </div>
  );
}
