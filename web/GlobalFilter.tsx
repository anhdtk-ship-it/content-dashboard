import { useEffect, useState, type ReactNode } from 'react';

export interface GlobalFilterState {
  preset: string; from?: string; to?: string;
  market: string; assignee: string; editor: string; status: string;
}
export interface GlobalFilterProps {
  value: GlobalFilterState;
  onChange: (patch: Partial<GlobalFilterState>) => void;
  onReset: () => void;
  right?: ReactNode;
}

const PRESETS: [string, string][] = [
  ['today', 'Hôm nay'], ['yesterday', 'Hôm qua'], ['last7', '7 ngày'], ['last30', '30 ngày'],
  ['thisweek', 'Tuần này'], ['lastweek', 'Tuần trước'], ['thismonth', 'Tháng này'], ['lastmonth', 'Tháng trước'],
  ['custom', 'Tùy chỉnh…'],
];
// Trạng thái: 7 nhãn nghiệp vụ. (Đã chạy-Tắt & Đã test-ko chạy cùng nhóm DA_DUNG do cơ chế lọc theo status_group.)
const STATUS_OPTS: [string, string][] = [
  ['ALL', 'Tất cả'], ['CHO_CHAY', 'Chờ chạy'], ['DANG_TEST', 'Đang test'], ['DUY_TRI', 'Duy trì'],
  ['DA_DUNG', 'Đã chạy - Tắt'], ['DA_DUNG', 'Đã test - Không chạy'], ['KHONG_DUYET', 'Không được duyệt'],
];

/* lấy danh sách Biên tập từ dữ liệu thực (đọc 1 lần, cache toàn cục — không đổi API/logic) */
let _editorsCache: Promise<string[]> | null = null;
function getEditors(): Promise<string[]> {
  if (!_editorsCache) {
    _editorsCache = fetch('/api/v3/lifecycle-table').then((r) => r.json()).then((d) => {
      const set = new Set<string>();
      for (const it of (d.items ?? [])) { const e = (it.editor_name ?? '').trim(); if (e) set.add(e); }
      return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
    }).catch(() => []);
  }
  return _editorsCache;
}

/* Kích thước lớn dễ đọc 14–24": label 16px, control cao 44px, font 15px. */
const ctrl = 'h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-fg focus:border-accent focus:outline-none';
const lbl = 'mb-1 text-[16px] leading-none text-muted';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex shrink-0 flex-col">{label && <label className={lbl}>{label}</label>}{children}</div>;
}

export function GlobalFilter({ value, onChange, onReset, right }: GlobalFilterProps) {
  const [editors, setEditors] = useState<string[]>([]);
  useEffect(() => { getEditors().then(setEditors); }, []);

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-end gap-4 lg:flex-nowrap lg:overflow-x-auto">
        {/* Thời gian */}
        <Field label="Thời gian">
          <div className="flex items-center gap-2">
            <select className={ctrl} value={value.preset} onChange={(e) => onChange({ preset: e.target.value })}>
              {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {value.preset === 'custom' && (
              <>
                <input type="date" className={ctrl} value={value.from ?? ''} onChange={(e) => onChange({ from: e.target.value })} />
                <span className="text-muted">→</span>
                <input type="date" className={ctrl} value={value.to ?? ''} onChange={(e) => onChange({ to: e.target.value })} />
              </>
            )}
          </div>
        </Field>

        {/* Địa lý */}
        <Field label="Địa lý">
          <select className={ctrl} value={value.market} onChange={(e) => onChange({ market: e.target.value })}>
            <option value="ALL">Tất cả</option><option value="noi_dia">Nội Địa</option><option value="quoc_te">Quốc Tế</option>
          </select>
        </Field>

        {/* Nhân viên Ads */}
        <Field label="Nhân viên Ads">
          <select className={ctrl} value={value.assignee} onChange={(e) => onChange({ assignee: e.target.value })}>
            <option value="ALL">Tất cả</option><option>Hiếu</option><option>Ánh</option><option>KA</option><option>Liên</option>
          </select>
        </Field>

        {/* Biên tập */}
        <Field label="Biên tập">
          <select className={ctrl} value={value.editor} onChange={(e) => onChange({ editor: e.target.value })}>
            <option value="ALL">Tất cả</option>
            {editors.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </Field>

        {/* Trạng thái */}
        <Field label="Trạng thái">
          <select className={ctrl} value={value.status} onChange={(e) => onChange({ status: e.target.value })}>
            {STATUS_OPTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
          </select>
        </Field>

        {/* Reset */}
        <Field label=" ">
          <button onClick={onReset} className={`${ctrl} cursor-pointer whitespace-nowrap hover:bg-surface2`}>✕ Reset</button>
        </Field>

        {right && <div className="ml-auto flex shrink-0 items-end pb-1">{right}</div>}
      </div>
    </div>
  );
}
