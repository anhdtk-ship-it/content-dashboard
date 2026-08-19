import { editorLabel } from '../editor-name';
import type { GeographyFilter } from './contentPerformanceApi';

export interface ContentPerformanceFilterState {
  month: string;
  channel: string;    // 'ALL' hoặc 1 trong 5 kênh Facebook
  editor: string;     // 'ALL' hoặc editor_name gốc
  geography: GeographyFilter;
  search: string;
}

const ctrl = 'h-9 rounded-control border border-line bg-surface px-2.5 text-[13px] text-fg focus:border-accent focus:outline-none';
const lbl = 'mb-1 text-[11px] text-muted';

const GEO_OPTS: [GeographyFilter, string][] = [['all', 'Tất cả'], ['noi_dia', 'Nội Địa'], ['quoc_te', 'Quốc Tế']];

export function Filters({
  value, channelOptions, editorOptions, onChange,
}: {
  value: ContentPerformanceFilterState;
  channelOptions: string[];
  editorOptions: string[];
  onChange: (patch: Partial<ContentPerformanceFilterState>) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className={lbl}>Tháng</label>
        <input type="month" value={value.month} className={ctrl}
          onChange={(e) => onChange({ month: e.target.value })} />
      </div>

      <div className="flex flex-col">
        <label className={lbl}>Kênh</label>
        <select value={value.channel} className={ctrl} onChange={(e) => onChange({ channel: e.target.value })}>
          <option value="ALL">Tất cả</option>
          {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex flex-col">
        <label className={lbl}>Biên tập</label>
        <select value={value.editor} className={ctrl} onChange={(e) => onChange({ editor: e.target.value })}>
          <option value="ALL">Tất cả</option>
          {editorOptions.map((e) => <option key={e} value={e}>{editorLabel(e)}</option>)}
        </select>
      </div>

      <div className="flex flex-col">
        <label className={lbl}>Địa lý</label>
        <select value={value.geography} className={ctrl} onChange={(e) => onChange({ geography: e.target.value as GeographyFilter })}>
          {GEO_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="flex min-w-[200px] flex-1 flex-col">
        <label className={lbl}>Tìm Content</label>
        <input type="text" placeholder="Nhập tên content…" value={value.search} className={ctrl}
          onChange={(e) => onChange({ search: e.target.value })} />
      </div>
    </div>
  );
}
