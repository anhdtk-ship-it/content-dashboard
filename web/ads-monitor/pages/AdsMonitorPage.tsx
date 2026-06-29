/* Ads Monitor — trang chính (PHASE 5: SERVER-SIDE. Filter/sort/phân trang đẩy hết lên API /ads-monitor;
 * KHÔNG lọc/cắt trang ở React). Giao diện giữ nguyên: 6 thẻ KPI + bộ lọc + bảng. */
import { useEffect, useState } from 'react';
import { PageContainer, SectionHeader, LoadingSkeleton, EmptyState } from '../../../src/components/ui';
import { AdsSummaryCards } from '../components/AdsSummaryCards';
import { AdsFilters } from '../components/AdsFilters';
import { AdsTable } from '../components/AdsTable';
import { EMPTY_FILTERS, currentMonth, type AdsFilterState, type AdsResponse } from '../types/ads';

const PAGE_SIZE = 50;

/** Ghép querystring — chỉ thêm filter có giá trị (rỗng/ALL bỏ qua → server hiểu là không lọc). */
function buildQuery(f: AdsFilterState, page: number, sortField: string, sortDir: string): string {
  const p = new URLSearchParams();
  p.set('page', String(page));
  p.set('pageSize', String(PAGE_SIZE));
  p.set('sortField', sortField);
  p.set('sortDirection', sortDir);
  if (f.content.trim()) p.set('content', f.content.trim());
  if (f.adsOwner !== 'ALL') p.set('adsOwner', f.adsOwner);
  if (f.location !== 'ALL') p.set('location', f.location);
  if (f.pageCode.trim()) p.set('pageCode', f.pageCode.trim());
  if (f.status !== 'ALL') p.set('status', f.status);
  if (f.month) p.set('month', f.month); // YYYY-MM → server đổi thành range sheet_date
  return p.toString();
}

export function AdsMonitorPage() {
  // Mặc định: tháng hiện tại (MM/YYYY).
  const [filters, setFilters] = useState<AdsFilterState>(() => ({ ...EMPTY_FILTERS, month: currentMonth() }));
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [data, setData] = useState<AdsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch server-side (debounce 300ms để gõ Content/Mã Page không spam request).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const qs = buildQuery(filters, page, sortField, sortDir);
    const t = setTimeout(() => {
      fetch(`/ads-monitor?${qs}`)
        .then((r) => r.json())
        .then((d) => { if (!alive) return; if (d.error) throw new Error(d.error); setData(d); setError(null); })
        .catch((e) => alive && setError(e.message))
        .finally(() => alive && setLoading(false));
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [filters, page, sortField, sortDir]);

  // Đổi filter → quay về trang 1.
  const patchFilter = (patch: Partial<AdsFilterState>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const resetFilters = () => { setFilters({ ...EMPTY_FILTERS, month: currentMonth() }); setPage(1); };

  // Click header: cùng cột → đảo chiều; cột khác → chọn cột mới (desc) và về trang 1.
  const onSort = (field: string) => {
    if (field === sortField) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  return (
    <div className="text-fg">
      <PageContainer>
        <SectionHeader title="📡 Ads Monitor"
          action={<span className="text-xs text-muted">{data ? `Nguồn: ${data.source}` : 'API /ads-monitor'}</span>} />

        {error ? <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`} />
          : loading && !data ? (
            <div className="space-y-4"><LoadingSkeleton variant="kpi" count={6} /><LoadingSkeleton variant="block" /></div>
          ) : data ? (
            <>
              <AdsSummaryCards summary={data.summary} />
              <div className="mt-4">
                <AdsFilters value={filters} onChange={patchFilter} onReset={resetFilters} />
                <AdsTable
                  rows={data.items}
                  total={data.total}
                  page={data.page}
                  pageSize={data.pageSize}
                  totalPages={data.totalPages}
                  sortField={sortField}
                  sortDir={sortDir}
                  onPageChange={setPage}
                  onSort={onSort}
                />
              </div>
            </>
          ) : <EmptyState message="Không có dữ liệu" />}
      </PageContainer>
    </div>
  );
}
