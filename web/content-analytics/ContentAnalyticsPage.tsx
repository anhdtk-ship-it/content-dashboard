import { useEffect, useState } from 'react';
import { PageContainer, LoadingSkeleton, EmptyState, ActionButton } from '../../src/components/ui';
import { fetchContentAnalytics, currentMonth, type ContentAnalyticsResult } from './contentAnalyticsApi';
import { Filters, type ContentAnalyticsFilterState } from './Filters';
import { OverviewCards } from './OverviewCards';
import { EmployeeTable } from './EmployeeTable';
import { ContentSummaryPanel } from './ContentSummaryPanel';

/* ============================================================
 * Phân tích Data Content (PHASE CONTENT-ANALYTICS-03, sửa layout ở PHASE 04, tinh chỉnh UI theo
 * mockup ở PHASE 05) — MODULE MỚI, ĐỘC LẬP. Stateless: đọc Google Sheet Raw_Data trực tiếp qua
 * /api/content-analytics mỗi lần đổi filter. KHÔNG liên quan Ads Monitor / Content Sync / Zalo /
 * Weekly Report / Dashboard cũ. Vẫn KHÔNG có bảng liệt kê từng Content (explorer) — dashboard chỉ
 * để đọc nhanh tỷ trọng Content Mới/Cũ + phân tích theo 4 nhân viên thật (KA/Hiếu/Ánh/Liên).
 * "search" chỉ lọc TRƯỚC khi tính tổng (row-level), không hiển thị danh sách content nào khớp.
 * ========================================================== */
export function ContentAnalyticsPage() {
  const [filters, setFilters] = useState<ContentAnalyticsFilterState>({
    month: currentMonth(), employee: 'ALL', type: 'all', search: '',
  });
  const [data, setData] = useState<ContentAnalyticsResult | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchContentAnalytics(filters)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
        setUpdatedAt(new Date());
        // Chỉ cập nhật danh sách Nhân viên khi đang xem "Tất cả" — tránh dropdown bị co
        // lại còn 1 người khi user vừa chọn 1 nhân viên cụ thể.
        if (filters.employee === 'ALL') {
          setEmployeeOptions([...new Set(d.byEmployee.map((e) => e.employee))].sort((a, b) => a.localeCompare(b, 'vi')));
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.month, filters.employee, filters.type, filters.search, reload]);

  const onFilterChange = (patch: Partial<ContentAnalyticsFilterState>) => setFilters((f) => ({ ...f, ...patch }));
  const onRefresh = () => setReload((n) => n + 1);

  return (
    <div className="text-fg">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-semibold text-fg">📊 Phân tích Data Content</span>
        <span className="ml-auto text-[11px] text-muted">Nguồn: Google Sheet Raw_Data (đọc trực tiếp, không lưu bảng riêng)</span>
      </div>

      <PageContainer>
        {error ? (
          <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`} action={<ActionButton onClick={() => setReload((n) => n + 1)}>Thử lại</ActionButton>} />
        ) : loading && !data ? (
          <div className="space-y-4"><LoadingSkeleton variant="kpi" count={3} /><LoadingSkeleton variant="block" /></div>
        ) : data ? (
          <>
            <Filters value={filters} employeeOptions={employeeOptions} onChange={onFilterChange} onRefresh={onRefresh} />

            {data.meta.warnings.length > 0 && (
              <div className="mb-4 rounded-card border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] text-warn">
                {data.meta.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}

            <OverviewCards overview={data.overview} />

            {data.overview.dataTotal === 0 ? (
              <EmptyState message="Không có Data (purchases) nào khớp bộ lọc trong tháng này." />
            ) : (
              <>
                <div className="mb-2 mt-1 text-[13px] font-semibold text-fg">Tổng quan Data Content theo Nhân viên Ads</div>
                <EmployeeTable rows={data.byEmployee} />
                <ContentSummaryPanel overview={data.overview} month={data.month} updatedAt={updatedAt} />
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
