import { useEffect, useState } from 'react';
import { PageContainer, LoadingSkeleton, EmptyState, ActionButton } from '../../src/components/ui';
import { fetchContentPerformance, currentMonth, type ContentPerformanceResult } from './contentPerformanceApi';
import { Filters, type ContentPerformanceFilterState } from './Filters';
import { OverviewCards } from './OverviewCards';
import { ContentTable } from './ContentTable';

/* ============================================================
 * Phân tích Hiệu quả Content (CP-04) — MODULE MỚI, ĐỘC LẬP với Content Analytics/Content
 * Sync/Ads Monitor/Zalo/Vòng đời Content. V1: CHỈ kênh Facebook (CGSĐ/BS/mess Nữ MB/remar/
 * hotline) — PR để dành V2. Đọc trực tiếp 2 Google Sheet mới (Performance/ROAS + Quality/
 * CLĐT) mỗi lần đổi filter, KHÔNG lưu bảng Supabase riêng. Biên tập lấy từ Content Sheet
 * (bảng `contents` có sẵn) — KHÔNG dùng Ads Employee.
 * ========================================================== */
export function ContentPerformancePage() {
  const [filters, setFilters] = useState<ContentPerformanceFilterState>({
    month: currentMonth(), channel: 'ALL', editor: 'ALL', geography: 'all', search: '',
  });
  const [data, setData] = useState<ContentPerformanceResult | null>(null);
  const [channelOptions, setChannelOptions] = useState<string[]>([]);
  const [editorOptions, setEditorOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchContentPerformance(filters)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
        // Chỉ cập nhật danh sách Kênh/Biên tập khi đang xem "Tất cả" tương ứng — tránh dropdown
        // bị co lại còn 1 lựa chọn khi user vừa chọn cụ thể (giống contentAnalyticsApi).
        if (filters.channel === 'ALL') setChannelOptions(d.meta.channelsAvailable);
        if (filters.editor === 'ALL') setEditorOptions(d.meta.editorsAvailable);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.month, filters.channel, filters.editor, filters.geography, filters.search, reload]);

  const onFilterChange = (patch: Partial<ContentPerformanceFilterState>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="text-fg">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-semibold text-fg">📈 Phân tích Hiệu quả Content</span>
        <span className="ml-auto text-[11px] text-muted">Nguồn: Performance/ROAS + Quality/CLĐT Sheet (đọc trực tiếp) — hiện tại chỉ kênh Facebook</span>
      </div>

      <PageContainer>
        {error ? (
          <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`} action={<ActionButton onClick={() => setReload((n) => n + 1)}>Thử lại</ActionButton>} />
        ) : loading && !data ? (
          <div className="space-y-4"><LoadingSkeleton variant="kpi" count={5} /><LoadingSkeleton variant="block" /></div>
        ) : data ? (
          <>
            <Filters value={filters} channelOptions={channelOptions} editorOptions={editorOptions} onChange={onFilterChange} />

            {data.meta.warnings.length > 0 && (
              <div className="mb-4 rounded-card border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] text-warn">
                {data.meta.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}

            <OverviewCards overview={data.overview} />

            {data.table.length === 0 ? (
              <EmptyState message="Không có Content nào hoạt động khớp bộ lọc trong tháng này." />
            ) : (
              <>
                <div className="mb-2 mt-1 text-[13px] font-semibold text-fg">Chi tiết theo Content</div>
                <ContentTable rows={data.table} />
              </>
            )}
          </>
        ) : (
          <EmptyState message="Không có dữ liệu." />
        )}
      </PageContainer>
    </div>
  );
}
