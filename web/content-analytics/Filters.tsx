import { ActionButton } from '../../src/components/ui';
import type { ContentTypeFilter } from './contentAnalyticsApi';

export interface ContentAnalyticsFilterState {
  month: string;
  employee: string; // 'ALL' hoặc 1 trong 4 tên nhân viên (KA/Hiếu/Ánh/Liên) / "Không xác định"
  type: ContentTypeFilter;
  search: string; // lọc theo tên Content TRƯỚC khi tính tổng — không hiển thị danh sách content nào
}

const ctrl = 'h-9 rounded-control border border-line bg-surface px-2.5 text-[13px] text-fg focus:border-accent focus:outline-none';
const lbl = 'mb-1 text-[11px] text-muted';

const TYPE_OPTS: [ContentTypeFilter, string][] = [['all', 'Tất cả'], ['new', 'Mới'], ['old', 'Cũ']];

export function Filters({
  value, employeeOptions, onChange, onRefresh,
}: {
  value: ContentAnalyticsFilterState;
  employeeOptions: string[];
  onChange: (patch: Partial<ContentAnalyticsFilterState>) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className={lbl}>Tháng</label>
        <input type="month" value={value.month} className={ctrl}
          onChange={(e) => onChange({ month: e.target.value })} />
      </div>

      <div className="flex flex-col">
        <label className={lbl}>Nhân viên Ads</label>
        <select value={value.employee} className={ctrl} onChange={(e) => onChange({ employee: e.target.value })}>
          <option value="ALL">Tất cả</option>
          {employeeOptions.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="flex flex-col">
        <label className={lbl}>Loại Content</label>
        <select value={value.type} className={ctrl} onChange={(e) => onChange({ type: e.target.value as ContentTypeFilter })}>
          {TYPE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="flex min-w-[200px] flex-1 flex-col">
        <label className={lbl}>Tìm kiếm Content</label>
        <input type="text" placeholder="Nhập từ khóa…" value={value.search} className={ctrl}
          onChange={(e) => onChange({ search: e.target.value })} />
      </div>

      <ActionButton variant="primary" icon={<span>⟳</span>} onClick={onRefresh}>Làm mới</ActionButton>
    </div>
  );
}
