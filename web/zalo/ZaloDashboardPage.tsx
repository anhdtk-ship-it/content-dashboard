/* ============================================================
 * Dashboard Tổng Quan ZALO (ĐỘC LẬP với Dashboard Facebook).
 * Chia toàn bộ KPI theo TỪNG ĐỊNH DẠNG (động — không hardcode Video/Banner).
 * §V khối định dạng · §VI tiến độ+forecast · §VII cần xử lý · §VIII so sánh · §IX data quality.
 * ========================================================== */
import { useEffect, useMemo, useState } from 'react';
import {
  PageContainer, SectionHeader, KPICard, ChartCard, LoadingSkeleton, EmptyState, ActionButton,
  DataTable, type Column,
} from '../../src/components/ui';
import { ZaloDrawer } from './ZaloDrawer';
import { ZaloSettingsPanel } from './ZaloSettingsPanel';
import {
  zaloApi, num, pct, signedPct, SCHEDULE_LABEL,
  type ZaloSummary, type FormatKpi, type FormatProgress, type FormatAttention, type FormatQuality,
} from './zaloApi';

const nowMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const SCHEDULE_TONE: Record<FormatProgress['scheduleStatus'], string> = {
  ahead: 'var(--success)', on: 'var(--accent)', behind: 'var(--danger)', na: 'var(--muted)',
};

type DrillState = { title: string; params: Record<string, string | number> } | null;

/* ---------- §V: khối 1 định dạng ---------- */
function FormatBlock({ month, k, onDrill }: { month: string; k: FormatKpi; onDrill: (d: DrillState) => void }) {
  const base = { month, format: k.format || '__NONE__' };
  return (
    <div className="mb-4 rounded-card border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-fg">🎬 {k.label}</h3>
        <span className="text-[11px] text-muted">Tỷ lệ test {pct(k.rateTest)} · Tỷ lệ duy trì {pct(k.rateDuyTri)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Đã cấp" value={num(k.capped)} tone="accent" onClick={() => onDrill({ title: `${k.label} · Đã cấp`, params: base })} />
        <KPICard label="Không test" value={num(k.khongTest)} tone="orange" onClick={() => onDrill({ title: `${k.label} · Không test`, params: { ...base, status: 'KHONG_TEST' } })} />
        <KPICard label="Tồn" value={num(k.ton)} tone="warn" onClick={() => onDrill({ title: `${k.label} · Tồn`, params: { ...base, status: 'TON' } })} />
        <KPICard label="Đang test" value={num(k.dangTest)} tone="info" onClick={() => onDrill({ title: `${k.label} · Đang test`, params: { ...base, status: 'DANG_TEST' } })} />
        <KPICard label="Duy trì" value={num(k.duyTri)} tone="good" onClick={() => onDrill({ title: `${k.label} · Duy trì`, params: { ...base, status: 'DUY_TRI' } })} />
      </div>
    </div>
  );
}

/* ---------- §VI: tiến độ + forecast 1 định dạng ---------- */
function ProgressCard({ p }: { p: FormatProgress }) {
  const hasTarget = p.target != null && p.target > 0;
  const pctVal = p.pctComplete == null ? 0 : Math.min(1, p.pctComplete);
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-fg">{p.label}</h4>
        <span className="text-[12px] font-bold tabular-nums text-fg">
          {num(p.actual)}{hasTarget ? <span className="text-muted"> / {num(p.target!)}</span> : <span className="text-muted"> (chưa đặt mục tiêu)</span>}
        </span>
      </div>
      {hasTarget && (
        <div className="mt-2 h-[10px] overflow-hidden rounded-pill bg-surface2">
          <div className="h-full rounded-pill" style={{ width: `${pctVal * 100}%`, background: 'var(--accent)' }} />
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
        <div><div className="text-[10px] text-muted">% hoàn thành</div><b className="text-fg">{hasTarget ? pct(p.pctComplete) : '—'}</b></div>
        <div><div className="text-[10px] text-muted">So cùng kỳ tháng trước</div>
          <b style={{ color: p.deltaPrevPct == null ? 'var(--muted)' : p.deltaPrevPct >= 0 ? 'var(--success)' : 'var(--danger)' }}>{signedPct(p.deltaPrevPct)}</b>
          <span className="text-muted"> ({num(p.prevSame)})</span>
        </div>
        <div><div className="text-[10px] text-muted">So tiến độ lịch</div>
          <b style={{ color: SCHEDULE_TONE[p.scheduleStatus] }}>{SCHEDULE_LABEL[p.scheduleStatus]}</b>
          {p.expected != null && <span className="text-muted"> (KV {num(Math.round(p.expected))})</span>}
        </div>
        <div><div className="text-[10px] text-muted">Forecast cuối tháng</div><b className="text-fg">{p.forecast == null ? '—' : num(p.forecast)}</b></div>
      </div>
    </div>
  );
}

/* ---------- §VII: cần xử lý (ẩn khi = 0). Ưu tiên: Test quá N ngày → Thiếu ngày test → Chưa phân loại → Chưa test ---------- */
const ATTN_DEFS: { key: keyof Omit<FormatAttention, 'format' | 'label'>; label: string; color: string; alert: string }[] = [
  { key: 'testQuaLau', label: 'Test quá lâu', color: '#ef4444', alert: 'testQuaLau' },           // 1 — Đỏ
  { key: 'thieuNgayTest', label: 'Thiếu ngày test', color: '#f59e0b', alert: 'thieuNgayTest' },  // 2 — Cam
  { key: 'chuaPhanLoai', label: 'Chưa phân loại', color: '#fb923c', alert: 'chuaPhanLoai' },     // 3 — Cam
  { key: 'chuaTest', label: 'Chưa test (tồn)', color: '#fbbf24', alert: 'chuaTest' },            // 4 — Vàng
];
function AttentionRow({ month, a, warningDays, threshold, onDrill }: { month: string; a: FormatAttention; warningDays: number; threshold: number; onDrill: (d: DrillState) => void }) {
  const items = ATTN_DEFS.map((d) => ({ ...d, value: a[d.key] })).filter((d) => d.value > 0);
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="mb-1 text-[12px] font-semibold text-fg">{a.label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((d) => {
          const urgent = d.value >= threshold;
          return (
            <button key={d.key} onClick={() => onDrill({ title: `${a.label} · ${d.label}`, params: { month, format: a.format || '__NONE__', alert: d.alert } })}
              className="flex items-center gap-2 rounded-card px-3 py-1.5 text-[12px] outline-none transition hover:brightness-110"
              style={{ border: `${urgent ? 2 : 1}px solid ${d.color}`, background: `${d.color}${urgent ? '22' : '14'}` }}
              title={urgent ? `Vượt ngưỡng cảnh báo (${threshold})` : undefined}>
              <span className="text-muted">{d.label}{d.key === 'testQuaLau' ? ` (>${warningDays}d)` : ''}</span>
              <b className="tabular-nums" style={{ color: d.color }}>{d.value}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- §IX: data quality (ẩn khi = 0) ---------- */
const QUAL_DEFS: { key: keyof Omit<FormatQuality, 'format' | 'label'>; label: string; alert?: string }[] = [
  { key: 'thieuTrangThai', label: 'Thiếu trạng thái', alert: 'thieuTrangThai' },
  { key: 'thieuNgayTest', label: 'Thiếu ngày test', alert: 'thieuNgayTest' },
  { key: 'trung', label: 'Content trùng' },
  { key: 'thieuBatBuoc', label: 'Thiếu dữ liệu bắt buộc', alert: 'thieuBatBuoc' },
];
function QualityRow({ month, qy, onDrill }: { month: string; qy: FormatQuality; onDrill: (d: DrillState) => void }) {
  const items = QUAL_DEFS.map((d) => ({ ...d, value: qy[d.key] })).filter((d) => d.value > 0);
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="mb-1 text-[12px] font-semibold text-fg">{qy.label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((d) => (
          <button key={d.key} disabled={!d.alert}
            onClick={() => d.alert && onDrill({ title: `${qy.label} · ${d.label}`, params: { month, format: qy.format || '__NONE__', alert: d.alert } })}
            className={`flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-1.5 text-[12px] ${d.alert ? 'hover:border-accent' : 'cursor-default'}`}>
            <span className="text-muted">{d.label}</span><b className="tabular-nums text-danger">{d.value}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export function ZaloDashboardPage() {
  const [month, setMonth] = useState(nowMonth);
  const [data, setData] = useState<ZaloSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<DrillState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      zaloApi.summary(month)
        .then((d) => { if (!alive) return; setData(d); setError(null); })
        .catch((e) => alive && setError(e.message))
        .finally(() => alive && setLoading(false));
    };
    setLoading(true); load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [month, reload]);

  const cmpCols: Column<FormatKpi>[] = useMemo(() => [
    { key: 'label', header: 'Định dạng', render: (r) => <b className="text-fg">{r.label}</b> },
    { key: 'capped', header: 'Đã cấp', align: 'right', render: (r) => num(r.capped) },
    { key: 'tested', header: 'Đã test', align: 'right', render: (r) => num(r.tested) },
    { key: 'duyTri', header: 'Duy trì', align: 'right', render: (r) => num(r.duyTri) },
    { key: 'rateTest', header: 'Tỷ lệ test', align: 'right', render: (r) => pct(r.rateTest) },
    { key: 'rateDuyTri', header: 'Tỷ lệ duy trì', align: 'right', render: (r) => <b className="text-success">{pct(r.rateDuyTri)}</b> },
  ], []);

  const hasData = !!data && data.totals.capped > 0;

  return (
    <div className="text-fg">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-semibold text-fg">💬 Zalo — Tổng Quan</span>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">Tháng
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value || nowMonth())}
            className="rounded-control border border-line bg-surface px-2 py-[5px] text-[13px] text-fg" />
        </label>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-success" /> Auto 30s
            {data && <span>· {new Date(data.generatedAt).toLocaleTimeString('vi-VN')}</span>}
          </span>
          <ActionButton onClick={() => setSettingsOpen(true)} icon={<span>⚙️</span>}>Cấu hình</ActionButton>
        </div>
      </div>

      <PageContainer>
        {error ? (
          <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`} action={<ActionButton onClick={() => setMonth((m) => m)}>Thử lại</ActionButton>} />
        ) : loading && !data ? (
          <div className="space-y-4"><LoadingSkeleton variant="kpi" count={5} /><LoadingSkeleton variant="block" /></div>
        ) : !hasData ? (
          <EmptyState icon="💬" message={`Chưa có content Zalo nào được cấp trong tháng ${data?.monthLabel ?? ''}. Chọn tháng khác hoặc nạp dữ liệu vào Supabase.`} />
        ) : (
          <>
            <SectionHeader title="Tổng quan theo định dạng" action={<span className="text-xs text-muted">Kỳ: {data!.monthLabel}</span>} />
            {data!.blocks.map((k) => <FormatBlock key={k.format || '__none__'} month={month} k={k} onDrill={setDrill} />)}

            <SectionHeader title="Tiến độ sử dụng Content" />
            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {data!.progress.map((p) => <ProgressCard key={p.format || '__none__'} p={p} />)}
            </div>

            <SectionHeader title="Cần xử lý" />
            <ChartCard title={`Ngưỡng cảnh báo: test quá ${data!.warningDays} ngày`}>
              {data!.attention.every((a) => a.chuaPhanLoai + a.chuaTest + a.testQuaLau + a.thieuNgayTest === 0)
                ? <div className="py-4 text-center text-[13px] text-success">✓ Không có việc cần xử lý trong kỳ.</div>
                : data!.attention.map((a) => <AttentionRow key={a.format || '__none__'} month={month} a={a} warningDays={data!.warningDays} threshold={data!.warningThreshold} onDrill={setDrill} />)}
            </ChartCard>

            <SectionHeader title="So sánh hiệu quả theo định dạng" />
            <div className="mb-4">
              <DataTable columns={cmpCols} rows={[...data!.blocks, { ...data!.totals, label: 'TỔNG' }]} rowKey={(r) => r.format || r.label} maxHeight={9999} />
            </div>

            <SectionHeader title="Kiểm tra chất lượng dữ liệu" />
            <ChartCard title="Data Quality">
              {data!.quality.every((q) => q.thieuTrangThai + q.thieuDinhDang + q.thieuNgayTest + q.trung === 0)
                ? <div className="py-4 text-center text-[13px] text-success">✓ Dữ liệu sạch — không phát hiện vấn đề.</div>
                : data!.quality.map((q) => <QualityRow key={q.format || '__none__'} month={month} qy={q} onDrill={setDrill} />)}
            </ChartCard>
          </>
        )}
      </PageContainer>

      {drill && <ZaloDrawer title={drill.title} params={drill.params} onClose={() => setDrill(null)} />}
      {settingsOpen && (
        <ZaloSettingsPanel
          formats={data?.formats ?? []}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => setReload((n) => n + 1)}
        />
      )}
    </div>
  );
}
