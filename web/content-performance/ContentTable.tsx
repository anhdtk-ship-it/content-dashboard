import { DataTable, type Column } from '../../src/components/ui';
import { editorLabel } from '../editor-name';
import type { ContentPerformanceTableItem } from './contentPerformanceApi';
import { fmtNum, fmtVND, fmtPct } from './format';

/**
 * Bảng Content (V1 — CP-02 §21) — Content/Biên tập/Kênh/Chi phí/SL Data/Giá Data/ROAS tháng/
 * ROAS 3 tháng + 2 chỉ số CLĐT chính (Tích cực/Tiêu cực). Care giá/MQH chưa XĐ vẫn có trong
 * API (field `quality`) nhưng không hiển thị ở bảng để giữ gọn theo đúng scope V1.
 */
export function ContentTable({ rows }: { rows: ContentPerformanceTableItem[] }) {
  const columns: Column<ContentPerformanceTableItem>[] = [
    { key: 'content', header: 'Content', render: (r) => <span title={r.content} className="line-clamp-2 max-w-[320px] text-[13px] text-fg">{r.content}</span> },
    { key: 'editor', header: 'Biên tập', render: (r) => <span className="text-[13px] text-muted">{editorLabel(r.editor)}</span> },
    { key: 'channel', header: 'Kênh', render: (r) => <span className="rounded-pill bg-surface2 px-2 py-0.5 text-[11px] text-muted">{r.channel}</span> },
    { key: 'cost', header: 'Chi phí', align: 'right', sortable: true, render: (r) => <b className="tabular-nums">{fmtVND(r.cost)}</b> },
    { key: 'dataCount', header: 'SL Data', align: 'right', render: (r) => <span className="tabular-nums">{fmtNum(r.dataCount)}</span> },
    { key: 'dataPrice', header: 'Giá Data', align: 'right', render: (r) => <span className="tabular-nums text-muted">{fmtVND(r.dataPrice)}</span> },
    { key: 'roasMonth', header: 'ROAS tháng', align: 'right', render: (r) => <span className="tabular-nums text-success">{fmtPct(r.roasMonth)}</span> },
    { key: 'roas3Month', header: 'ROAS 3 tháng', align: 'right', render: (r) => <span className="tabular-nums text-[#fb923c]">{fmtPct(r.roas3Month)}</span> },
    { key: 'positive', header: 'Tích cực', align: 'right', render: (r) => <span className="tabular-nums text-success">{r.quality ? fmtPct(r.quality.positiveRate) : '—'}</span> },
    { key: 'negative', header: 'Tiêu cực', align: 'right', render: (r) => <span className="tabular-nums text-danger">{r.quality ? fmtPct(r.quality.negativeRate) : '—'}</span> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r, i) => `${r.content}__${i}`}
      empty="Không có Content nào khớp bộ lọc trong tháng này."
      maxHeight={560}
    />
  );
}
