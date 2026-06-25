import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  sort?: SortState;
  onSort?: (key: string) => void;
  empty?: ReactNode;
  maxHeight?: number;
  className?: string;
}

const alignCls = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

/** Bảng dữ liệu chung: sort, click hàng, cuộn trong khung (DESIGN_SYSTEM §5). */
export function DataTable<T>({
  columns, rows, rowKey, onRowClick, sort, onSort, empty, maxHeight = 460, className = '',
}: DataTableProps<T>) {
  return (
    <div className={`overflow-auto rounded-card border border-line ${className}`} style={{ maxHeight }}>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {columns.map((c) => {
              const sorted = sort?.key === c.key;
              const clickable = c.sortable && onSort;
              return (
                <th
                  key={c.key}
                  onClick={clickable ? () => onSort!(c.key) : undefined}
                  className={`sticky top-0 border-b border-line bg-surface px-[9px] py-2 text-xs font-semibold text-muted ${alignCls(c.align)} ${clickable ? 'cursor-pointer select-none hover:text-fg' : ''}`}
                >
                  {c.header}
                  {sorted ? (sort!.dir === 'desc' ? ' ▼' : ' ▲') : ''}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-muted">
                {empty ?? 'Không có dữ liệu'}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr
                key={rowKey(r, i)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-b border-line ${onRowClick ? 'cursor-pointer hover:bg-surface2' : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-[9px] py-2 ${alignCls(c.align)}`}>
                    {c.render ? c.render(r) : ((r as Record<string, unknown>)[c.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface DemoRow { code: string; assignee: string; days: number; }
export function DataTableDemo() {
  const rows: DemoRow[] = [
    { code: 'C-001', assignee: 'Hiếu', days: 164 },
    { code: 'C-002', assignee: 'Liên', days: 120 },
    { code: 'C-003', assignee: 'KA', days: 51 },
  ];
  const columns: Column<DemoRow>[] = [
    { key: 'code', header: 'Content', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: 'assignee', header: 'Người nhận' },
    { key: 'days', header: 'Số ngày', align: 'right', sortable: true, render: (r) => <b>{r.days}</b> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.code}
      sort={{ key: 'days', dir: 'desc' }}
      onSort={() => {}}
      onRowClick={() => {}}
      maxHeight={240}
    />
  );
}
