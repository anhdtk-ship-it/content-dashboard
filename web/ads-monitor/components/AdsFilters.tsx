/* Ads Monitor — bộ lọc (PHASE 2: UI-only, chưa lọc thật). */
import { useState, type ReactNode } from 'react';
import { ActionButton, SearchBox } from '../../../src/components/ui';

const ctrl = 'h-9 rounded-control border border-line bg-surface px-2 text-[13px] text-fg focus:border-accent focus:outline-none';
const ASSIGNEES = ['Hiếu', 'Ánh', 'KA', 'Liên', 'Minh', 'Trang'];
const STATUSES = ['Đã tắt', 'Mới chạy', 'Đang test', 'Đang duy trì'];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-0.5"><label className="text-[12px] text-muted">{label}</label>{children}</div>;
}

export function AdsFilters() {
  const [content, setContent] = useState('');
  const [assignee, setAssignee] = useState('ALL');
  const [market, setMarket] = useState('ALL');
  const [page, setPage] = useState('');
  const [status, setStatus] = useState('ALL');
  const reset = () => { setContent(''); setAssignee('ALL'); setMarket('ALL'); setPage(''); setStatus('ALL'); };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Field label="Content">
        <SearchBox value={content} onChange={setContent} placeholder="Tìm content…" className="w-[180px]" />
      </Field>
      <Field label="Nhân viên Ads">
        <select className={ctrl} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="ALL">Tất cả</option>
          {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </Field>
      <Field label="Địa lý">
        <select className={ctrl} value={market} onChange={(e) => setMarket(e.target.value)}>
          <option value="ALL">Tất cả</option>
          <option value="TQ">Nội Địa</option>
          <option value="NN">Quốc Tế</option>
        </select>
      </Field>
      <Field label="Mã Page">
        <SearchBox value={page} onChange={setPage} placeholder="Mã Page…" className="w-[140px]" />
      </Field>
      <Field label="Trạng thái">
        <select className={ctrl} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">Tất cả</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <ActionButton variant="ghost" onClick={reset}>✕ Reset bộ lọc</ActionButton>
    </div>
  );
}
