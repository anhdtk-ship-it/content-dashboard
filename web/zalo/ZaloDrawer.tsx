/* Drawer drill-down danh sách content Zalo (dùng cho click KPI/cảnh báo/định dạng). */
import { useEffect, useState } from 'react';
import { DataTable, type Column, LoadingSkeleton, EmptyState } from '../../src/components/ui';
import { zaloApi, type ZaloContentItem } from './zaloApi';

const STATUS_COLOR: Record<string, string> = {
  TON: '#fb923c', DANG_TEST: 'var(--warn)', DUY_TRI: 'var(--success)',
  KHONG_TEST: '#a1a1aa', CHUA_PHAN_LOAI: 'var(--violet)',
};

export function ZaloDrawer({ title, params, onClose }: {
  title: string; params: Record<string, string | number>; onClose: () => void;
}) {
  const [rows, setRows] = useState<ZaloContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    zaloApi.contents({ ...params, page: 1, pageSize: 100 })
      .then((d) => { if (!alive) return; setRows(d.items); setTotal(d.total); setError(null); })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [JSON.stringify(params)]);

  const columns: Column<ZaloContentItem>[] = [
    { key: 'title', header: 'Tên Content', render: (r) => r.title || <span className="font-mono text-[11px] text-muted">{r.content_code}</span> },
    { key: 'content_format', header: 'Định dạng', render: (r) => r.content_format || <span className="text-muted">—</span> },
    { key: 'current_status', header: 'Trạng thái', render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[r.status_group] ?? 'var(--slate)' }} />
        {r.current_status || <span className="text-muted">(trống)</span>}
      </span>
    ) },
    { key: 'upload_date', header: 'Ngày đăng', align: 'right', render: (r) => r.upload_date || '—' },
    { key: 'test_date', header: 'Ngày test', align: 'right', render: (r) => r.test_date || '—' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="flex h-full w-full max-w-[760px] flex-col border-l border-line bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-fg">{title}</div>
            <div className="text-xs text-muted">{total} content</div>
          </div>
          <button onClick={onClose} className="rounded-control px-2 py-1 text-sm text-muted hover:bg-surface hover:text-fg">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {error ? <EmptyState icon="⚠️" message={`Lỗi: ${error}`} />
            : loading ? <LoadingSkeleton variant="block" />
            : <DataTable columns={columns} rows={rows} rowKey={(r) => r.content_code + r.assignee_name} maxHeight={9999} />}
        </div>
      </div>
    </div>
  );
}
