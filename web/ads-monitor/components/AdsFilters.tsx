/* Ads Monitor — bộ lọc (PHASE 5: controlled — đẩy filter lên server, KHÔNG lọc ở React). */
import { type ReactNode } from 'react';
import { ActionButton, SearchBox } from '../../../src/components/ui';
import type { AdsFilterState } from '../types/ads';

const ctrl = 'h-9 rounded-control border border-line bg-surface px-2 text-[13px] text-fg focus:border-accent focus:outline-none';
const STATUSES = ['Đã tắt', 'Mới chạy', 'Đang test', 'Đang duy trì'];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-0.5"><label className="text-[12px] text-muted">{label}</label>{children}</div>;
}

export function AdsFilters({
  value, onChange, onReset, owners = [],
}: {
  value: AdsFilterState;
  onChange: (patch: Partial<AdsFilterState>) => void;
  onReset: () => void;
  owners?: string[];   // danh sách Nhân viên Ads lấy động từ dữ liệu thật
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <Field label="📅 Tháng">
        <input type="month" className={ctrl} value={value.month} onChange={(e) => onChange({ month: e.target.value })} />
      </Field>
      <Field label="Content">
        <SearchBox value={value.content} onChange={(v) => onChange({ content: v })} placeholder="Tìm content…" className="w-[180px]" />
      </Field>
      <Field label="Nhân viên Ads">
        <select className={ctrl} value={value.adsOwner} onChange={(e) => onChange({ adsOwner: e.target.value })}>
          <option value="ALL">Tất cả</option>
          {owners.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </Field>
      <Field label="Địa lý">
        <select className={ctrl} value={value.location} onChange={(e) => onChange({ location: e.target.value })}>
          <option value="ALL">Tất cả</option>
          <option value="TQ">Nội Địa</option>
          <option value="NN">Quốc Tế</option>
        </select>
      </Field>
      <Field label="Mã Page">
        <SearchBox value={value.pageCode} onChange={(v) => onChange({ pageCode: v })} placeholder="Mã Page…" className="w-[140px]" />
      </Field>
      <Field label="Trạng thái">
        <select className={ctrl} value={value.status} onChange={(e) => onChange({ status: e.target.value })}>
          <option value="ALL">Tất cả</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <ActionButton variant="ghost" onClick={onReset}>✕ Reset bộ lọc</ActionButton>
    </div>
  );
}
