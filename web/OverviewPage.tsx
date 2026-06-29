import { useEffect, useMemo, useState } from 'react';
import {
  PageContainer, SectionHeader, KPICard, ChartCard,
  LoadingSkeleton, EmptyState, ActionButton,
  type DateRangeValue,
} from '../src/components/ui';
import { GlobalFilter } from './GlobalFilter';
import { AlertDrawer, type AlertDef } from './AlertDrawer';
import { UsageCompare } from './UsageCompare';
import { AssigneesPage } from './AssigneesPage';

/* ---------- helpers ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pct = (x: number) => `${Math.round((x ?? 0) * 100)}%`;

function presetRange(p: string): { from?: string; to?: string } {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = (x: number) => { const c = new Date(now); c.setDate(c.getDate() + x); return c; };
  const mon = (b: Date) => { const c = new Date(b); const w = (c.getDay() + 6) % 7; c.setDate(c.getDate() - w); return c; };
  switch (p) {
    case 'today': return { from: ymd(now), to: ymd(now) };
    case 'yesterday': return { from: ymd(d(-1)), to: ymd(d(-1)) };
    case 'last7': return { from: ymd(d(-6)), to: ymd(now) };
    case 'last30': return { from: ymd(d(-29)), to: ymd(now) };
    case 'thisweek': { const m = mon(now); const s = new Date(m); s.setDate(s.getDate() + 6); return { from: ymd(m), to: ymd(s) }; }
    case 'lastweek': { const m = mon(now); m.setDate(m.getDate() - 7); const s = new Date(m); s.setDate(s.getDate() + 6); return { from: ymd(m), to: ymd(s) }; }
    case 'thismonth': return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case 'lastmonth': return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
    default: return {};
  }
}

const selectCls = 'rounded-control border border-line bg-surface px-2 py-[6px] text-[13px] text-fg';
// Màu chuẩn nghiệp vụ (S3-001.1): Chờ chạy=cam · Đang test=vàng · Duy trì=xanh lá · Đã dừng=xám · Không duyệt=đỏ
const STATUS_COLOR: Record<string, string> = {
  CHO_CHAY: '#fb923c', DANG_TEST: 'var(--warn)', DUY_TRI: 'var(--success)',
  DA_DUNG: 'var(--slate)', KHONG_DUYET: 'var(--danger)', CHUA_PHAN_LOAI: 'var(--violet)',
};
// Ngưỡng "Test quá lâu" — chỉ để HIỂN THỊ (khớp ngưỡng >14d của /summary). Không đổi logic server.
const TEST_OVERDUE_DAYS = 14;
// Card "Cần xử lý" — cảnh báo trực quan theo mức độ (đã bỏ "Thiếu link Trello").
const ALERTS: { key: string; label: string; icon: string; color: string; sub?: string; badge?: string }[] = [
  { key: 'chuaPhanLoai', label: 'Chưa phân loại', icon: '⚠️', color: '#ef4444', badge: 'Khẩn cấp', sub: 'Mức ưu tiên cao nhất' },
  { key: 'testQuaLau', label: 'Test quá lâu', icon: '⏰', color: '#f87171', sub: `Quá ${TEST_OVERDUE_DAYS} ngày` },
  { key: 'thieuNgayTest', label: 'Thiếu ngày test', icon: '📅', color: '#fb923c' },
  { key: 'chuaTest', label: 'Chưa test', icon: '🧪', color: '#fbbf24' },
];

/* Card cảnh báo: border màu + nền nhạt + icon + badge mức độ. Click → mở Drawer drill-down. */
function AlertCard({ icon, label, value, color, sub, badge, onClick }: {
  icon: string; label: string; value: number; color: string; sub?: string; badge?: string; onClick?: () => void;
}) {
  return (
    <div role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className="cursor-pointer rounded-card border p-3 outline-none transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent"
      style={{ borderColor: color, background: `${color}14` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <span className="text-[16px] leading-none">{icon}</span>{label}
        </span>
        {badge && (
          <span className="rounded-pill px-2 py-0.5 text-[10px] font-bold" style={{ background: color, color: '#0b0f17' }}>{badge}</span>
        )}
      </div>
      <div className="mt-1 text-[26px] font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="flex items-center justify-between">
        {sub ? <span className="text-[11px] text-muted">{sub}</span> : <span />}
        <span className="text-[11px] text-muted opacity-70">Xem →</span>
      </div>
    </div>
  );
}

interface Summary {
  metrics: { capped: number; tested: number; success: number; dangTest: number; tonKho: number; khongDuyet: number;
    rateTested: number; rateSuccess: number; rateDangTest: number; rateTonKho: number; rateKhongDuyet: number };
  funnel: { stage: string; value: number; conv: number }[];
  byStatus: { group: string; label: string; value: number }[];
  alerts: Record<string, number>;
  generatedAt: string;
}

/* ---------- Bars (HTML — ops-first, không tạo Card mới) ---------- */
function Bars({ rows }: { rows: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-[9px]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-[10px]">
          <span className="w-[120px] shrink-0 truncate text-[13px] text-muted">{r.label}</span>
          <div className="h-[18px] flex-1 overflow-hidden rounded-[5px] bg-surface2">
            <div className="h-full rounded-[5px]" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? 'var(--accent)' }} />
          </div>
          <span className="w-[46px] text-right font-semibold tabular-nums text-fg">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Page ---------- */
export function OverviewPage() {
  const [range, setRange] = useState<DateRangeValue>({ preset: 'thismonth' });
  const [market, setMarket] = useState('ALL');
  const [assignee, setAssignee] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [editor, setEditor] = useState('ALL');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<AlertDef | null>(null); // card "Cần xử lý" đang mở Drawer

  const period = range.preset === 'custom' ? { from: range.from, to: range.to } : presetRange(range.preset);

  const query = useMemo(() => {
    const r = range.preset === 'custom' ? { from: range.from, to: range.to } : presetRange(range.preset);
    const p = new URLSearchParams();
    if (r.from) p.set('from', r.from);
    if (r.to) p.set('to', r.to);
    if (market !== 'ALL') p.set('market', market);
    if (assignee !== 'ALL') p.set('assignee', assignee);
    if (status !== 'ALL') p.set('status', status);
    return p.toString();
  }, [range, market, assignee, status]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch('/api/v3/summary?' + query)
        .then((r) => r.json())
        .then((d) => { if (!alive) return; if (d.error) throw new Error(d.error); setData(d); setError(null); })
        .catch((e) => alive && setError(e.message))
        .finally(() => alive && setLoading(false));
    };
    setLoading(true); load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [query]);

  const clearAll = () => { setRange({ preset: 'thismonth' }); setMarket('ALL'); setAssignee('ALL'); setStatus('ALL'); setEditor('ALL'); };

  const m = data?.metrics;

  return (
    <div className="text-fg">
      <GlobalFilter
        value={{ preset: range.preset, from: range.from, to: range.to, market, assignee, editor, status }}
        onChange={(p) => {
          if ('preset' in p || 'from' in p || 'to' in p)
            setRange({ preset: (p.preset ?? range.preset) as DateRangeValue['preset'], from: p.from ?? range.from, to: p.to ?? range.to });
          if (p.market !== undefined) setMarket(p.market);
          if (p.assignee !== undefined) setAssignee(p.assignee);
          if (p.editor !== undefined) setEditor(p.editor);
          if (p.status !== undefined) setStatus(p.status);
        }}
        onReset={clearAll}
        right={
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-success" /> Auto 30s
            {data && <span>· {new Date(data.generatedAt).toLocaleTimeString('vi-VN')}</span>}
          </span>
        }
      />

      <PageContainer>
        {error ? (
          <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`} action={<ActionButton onClick={clearAll}>Thử lại</ActionButton>} />
        ) : loading && !data ? (
          <div className="space-y-4">
            <LoadingSkeleton variant="kpi" count={6} />
            <LoadingSkeleton variant="block" />
          </div>
        ) : m ? (
          <>
            <SectionHeader title="KPI nghiệp vụ" action={<span className="text-xs text-muted">di chuột vào ⓘ để xem công thức</span>} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KPICard label="Content được cấp" value={m.capped} tone="accent"
                tooltip="Đếm theo Ngày Up Trello (upload_date_real) trong kỳ lọc." />
              <KPICard label="Tỷ lệ đã được test" value={pct(m.rateTested)} sub={`${m.tested}/${m.capped}`}
                tooltip="Đã được test ÷ Content được cấp" />
              <KPICard label="Tỷ lệ test thành công" value={pct(m.rateSuccess)} sub={`${m.success}/${m.tested}`} tone="good"
                tooltip="Thành công ÷ Đã được test" />
              <KPICard label="Tỷ lệ đang test" value={pct(m.rateDangTest)} sub={`${m.dangTest}/${m.capped}`} tone="warn"
                tooltip="Đang test ÷ Content được cấp" />
              <KPICard label="Tỷ lệ tồn kho" value={pct(m.rateTonKho)} sub={`${m.tonKho}/${m.capped}`} tone="orange"
                tooltip="Tồn kho ÷ Content được cấp" />
              <KPICard label="Tỷ lệ không duyệt" value={pct(m.rateKhongDuyet)} sub={`${m.khongDuyet}/${m.capped}`} tone="danger"
                tooltip="Không duyệt ÷ Content được cấp" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Funnel test">
                <Bars rows={(data!.funnel ?? []).map((f) => ({ label: f.stage, value: f.value }))} />
              </ChartCard>
              <ChartCard title="Phân bố trạng thái">
                <Bars rows={(data!.byStatus ?? []).map((s) => ({ label: s.label, value: s.value, color: STATUS_COLOR[s.group] }))} />
              </ChartCard>
            </div>

            <div className="mt-2">
              <SectionHeader title="Cần xử lý" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ALERTS.map((a) => (
                  <AlertCard key={a.key} icon={a.icon} label={a.label} color={a.color}
                    badge={a.badge} sub={a.sub} value={data!.alerts?.[a.key] ?? 0}
                    onClick={() => setDrill({ key: a.key, label: a.label, color: a.color })} />
                ))}
              </div>
            </div>

            <UsageCompare market={market} assignee={assignee} editor={editor} />
          </>
        ) : (
          <EmptyState message="Không có dữ liệu trong kỳ lọc" />
        )}
      </PageContainer>

      {/* Di chuyển từ "Tiến độ sử dụng Content": Content theo trạng thái + Bảng xếp hạng.
          Nhúng — ẩn khối KPI riêng + ẩn thanh lọc dưới; chạy theo bộ lọc trên cùng của Tổng Quan. */}
      <AssigneesPage embedded filter={{ preset: range.preset, from: range.from, to: range.to, market, assignee, status, editor }} />

      {drill && (
        <AlertDrawer
          alert={drill}
          filters={{ from: period.from, to: period.to, market, assignee, status, editor }}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
