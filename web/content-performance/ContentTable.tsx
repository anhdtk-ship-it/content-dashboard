import { useMemo, useState } from 'react';
import { DataTable, type Column, type SortState } from '../../src/components/ui';
import { editorLabel } from '../editor-name';
import type { ContentPerformanceTableItem } from './contentPerformanceApi';
import { fmtNum, fmtVND, fmtPct } from './format';
import { sortRows, nextSort, type TableSort } from './sortRows';

/**
 * Bảng Content (V1 — CP-02 §21) — Content/Biên tập/Kênh/Chi phí/SL Data/Giá Data/ROAS tháng/
 * ROAS 3 tháng + 2 chỉ số CLĐT chính (Tích cực/Tiêu cực). Care giá/MQH chưa XĐ vẫn có trong
 * API (field `quality`) nhưng không hiển thị ở bảng để giữ gọn theo đúng scope V1.
 *
 * SẮP XẾP (CP-05): bấm tiêu đề 6 cột số (Chi phí · SL Data · ROAS tháng · ROAS 3 tháng ·
 * Tích cực · Tiêu cực) để đổi thứ tự — lần 1 cao→thấp, bấm lại thấp→cao; mũi tên ▼▲ do
 * `DataTable` hiển thị. Toàn bộ phép so sánh nằm ở `sortRows.ts` (thuần, test được).
 */

/** Tiêu đề cột bấm được — thêm tooltip để người dùng biết là bấm được. */
const SortableHeader = ({ label }: { label: string }) => <span title="Bấm để sắp xếp">{label}</span>;

export function ContentTable({ rows }: { rows: ContentPerformanceTableItem[] }) {
  // Giữ nguyên lựa chọn sắp xếp khi đổi tháng/bộ lọc (tiện so sánh giữa các kỳ).
  const [sort, setSort] = useState<TableSort | null>(null);
  const onSort = (key: string) => setSort((s) => nextSort(s, key));

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  const columns: Column<ContentPerformanceTableItem>[] = [
    { key: 'content', header: 'Content', render: (r) => <span title={r.content} className="line-clamp-2 max-w-[320px] text-[13px] text-fg">{r.content}</span> },
    { key: 'editor', header: 'Biên tập', render: (r) => <span className="text-[13px] text-muted">{editorLabel(r.editor)}</span> },
    { key: 'channel', header: 'Kênh', render: (r) => <span className="rounded-pill bg-surface2 px-2 py-0.5 text-[11px] text-muted">{r.channel}</span> },
    { key: 'cost', header: <SortableHeader label="Chi phí" />, align: 'right', sortable: true, render: (r) => <b className="tabular-nums">{fmtVND(r.cost)}</b> },
    { key: 'dataCount', header: <SortableHeader label="SL Data" />, align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtNum(r.dataCount)}</span> },
    { key: 'dataPrice', header: 'Giá Data', align: 'right', render: (r) => <span className="tabular-nums text-muted">{fmtVND(r.dataPrice)}</span> },
    { key: 'roasMonth', header: <SortableHeader label="ROAS tháng" />, align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-success">{fmtPct(r.roasMonth)}</span> },
    { key: 'roas3Month', header: <SortableHeader label="ROAS 3 tháng" />, align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-[#fb923c]">{fmtPct(r.roas3Month)}</span> },
    { key: 'positive', header: <SortableHeader label="Tích cực" />, align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-success">{r.quality ? fmtPct(r.quality.positiveRate) : '—'}</span> },
    { key: 'negative', header: <SortableHeader label="Tiêu cực" />, align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-danger">{r.quality ? fmtPct(r.quality.negativeRate) : '—'}</span> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={sorted}
      rowKey={(r, i) => `${r.content}__${i}`}
      sort={(sort as SortState) ?? undefined}
      onSort={onSort}
      empty="Không có Content nào khớp bộ lọc trong tháng này."
      maxHeight={560}
    />
  );
}
