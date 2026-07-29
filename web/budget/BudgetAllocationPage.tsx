/* ============================================================
 * FB-ADS-02 — Budget Allocation Analytics (Phân bổ ngân sách).
 * Dashboard PHÂN TÍCH ĐỘC LẬP. CHỈ ĐỌC /ads-monitor. KHÔNG đụng Ads Monitor/DB/API/Sync.
 * Tách hoàn toàn Nội Địa | Quốc Tế trên cùng 1 trang. Responsive.
 * ========================================================== */
import { useEffect, useMemo, useState } from 'react';
import { PageContainer, SectionHeader, LoadingSkeleton, EmptyState, ActionButton } from '../../src/components/ui';
import { fetchAdsForMonth, currentMonth, type AdsRow } from './budgetApi';
import { buildMarketAnalysis, type EnrichedRow } from './selectors';
import { BUDGET_THRESHOLD } from './config';
import { MarketDashboard } from './MarketDashboard';
import { BudgetDrawer } from './BudgetDrawer';

type DrillState = { title: string; rows: EnrichedRow[] } | null;

export function BudgetAllocationPage() {
  const [month, setMonth] = useState(currentMonth);
  const [rows, setRows] = useState<AdsRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [drill, setDrill] = useState<DrillState>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAdsForMonth(month)
      .then((d) => { if (!alive) return; setRows(d); setError(null); })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [month, reload]);

  // Memoize: chỉ tính lại khi rows/month đổi — không query lại, không làm chậm.
  const noiDia = useMemo(() => (rows ? buildMarketAnalysis(rows, 'TQ', month, BUDGET_THRESHOLD) : null), [rows, month]);
  const quocTe = useMemo(() => (rows ? buildMarketAnalysis(rows, 'NN', month, BUDGET_THRESHOLD) : null), [rows, month]);

  const onDrill = (title: string, r: EnrichedRow[]) => setDrill({ title, rows: r });
  const hasData = !!rows && ((noiDia?.kpi.totalContent ?? 0) + (quocTe?.kpi.totalContent ?? 0) > 0);

  return (
    <div className="text-fg">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-semibold text-fg">💰 Phân bổ ngân sách (Budget Allocation)</span>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">Tháng
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="rounded-control border border-line bg-surface px-2 py-[5px] text-[13px] text-fg" />
        </label>
        <span className="ml-auto text-[11px] text-muted">Ngưỡng: {(BUDGET_THRESHOLD / 1_000_000).toLocaleString('vi-VN')}tr · nguồn: Ads Monitor (chỉ đọc)</span>
      </div>

      <PageContainer>
        {error ? (
          <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu Ads: ${error}`} action={<ActionButton onClick={() => setReload((n) => n + 1)}>Thử lại</ActionButton>} />
        ) : loading && !rows ? (
          <div className="space-y-4"><LoadingSkeleton variant="kpi" count={5} /><LoadingSkeleton variant="block" /></div>
        ) : !hasData ? (
          <EmptyState icon="💰" message={`Không có Ads chi tiêu (>0đ) trong tháng ${month.split('-').reverse().join('/')}. Chọn tháng khác.`} />
        ) : (
          <>
            <SectionHeader title="Nội Địa vs Quốc Tế" action={<span className="text-xs text-muted">Chỉ tính Amount Spent &gt; 0 · mọi trạng thái</span>} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {noiDia && <MarketDashboard a={noiDia} onDrill={onDrill} />}
              {quocTe && <MarketDashboard a={quocTe} onDrill={onDrill} />}
            </div>
          </>
        )}
      </PageContainer>

      {drill && <BudgetDrawer title={drill.title} rows={drill.rows} onClose={() => setDrill(null)} />}
    </div>
  );
}
