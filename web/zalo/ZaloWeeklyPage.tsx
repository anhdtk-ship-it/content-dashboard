/* ============================================================
 * Weekly Report ZALO (ĐỘC LẬP với Weekly Report Facebook).
 * Bố cục: I. Tổng quan · II. Tiến độ · III. Cần xử lý · IV. So sánh định dạng · V. Đề xuất.
 * Xuất PDF nhanh = window.print (controls .no-print tự ẩn). PDF chuyên nghiệp: reports/zalo_report_pdf.py.
 * ========================================================== */
import { useEffect, useMemo, useState } from 'react';
import {
  PageContainer, SectionHeader, KPICard, LoadingSkeleton, EmptyState, ActionButton,
  DataTable, type Column,
} from '../../src/components/ui';
import { zaloApi, num, pct, type ZaloWeekly, type FormatKpi } from './zaloApi';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function thisWeek(): { from: string; to: string } {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: ymd(mon), to: ymd(sun) };
}

const ATTN = [
  { key: 'testQuaLau', label: 'Test quá lâu' }, { key: 'thieuNgayTest', label: 'Thiếu ngày test' },
  { key: 'chuaPhanLoai', label: 'Chưa phân loại' }, { key: 'chuaTest', label: 'Chưa test' },
] as const;

export function ZaloWeeklyPage() {
  const init = useMemo(thisWeek, []);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [data, setData] = useState<ZaloWeekly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true; setLoading(true);
    zaloApi.weekly(from, to)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [from, to]);

  const cmpCols: Column<FormatKpi>[] = [
    { key: 'label', header: 'Định dạng', render: (r) => <b className="text-fg">{r.label}</b> },
    { key: 'capped', header: 'Đã cấp', align: 'right', render: (r) => num(r.capped) },
    { key: 'tested', header: 'Đã test', align: 'right', render: (r) => num(r.tested) },
    { key: 'ton', header: 'Tồn', align: 'right', render: (r) => num(r.ton) },
    { key: 'duyTri', header: 'Duy trì', align: 'right', render: (r) => num(r.duyTri) },
    { key: 'rateTest', header: 'Tỷ lệ test', align: 'right', render: (r) => pct(r.rateTest) },
    { key: 'rateDuyTri', header: 'Tỷ lệ duy trì', align: 'right', render: (r) => <b className="text-success">{pct(r.rateDuyTri)}</b> },
  ];

  const ctrl = 'rounded-control border border-line bg-surface px-2 py-[6px] text-[13px] text-fg';
  const hasData = !!data && data.byFormat.some((k) => k.capped > 0 || k.duyTri > 0);

  return (
    <div className="text-fg">
      <PageContainer>
        <div className="no-print">
          <SectionHeader title="💬 Báo cáo tuần — Zalo" action={
            <div className="flex items-center gap-2">
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={ctrl} />
              <span className="text-muted">→</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={ctrl} />
              <ActionButton onClick={() => { const w = thisWeek(); setFrom(w.from); setTo(w.to); }}>Tuần này</ActionButton>
              <ActionButton onClick={() => window.print()}>🖨️ Xuất PDF</ActionButton>
            </div>
          } />
        </div>

        {error ? <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`} />
          : loading && !data ? <div className="space-y-4"><LoadingSkeleton variant="kpi" count={4} /><LoadingSkeleton variant="block" /></div>
          : !hasData ? <EmptyState message="Không có dữ liệu Zalo trong khoảng đã chọn" />
          : (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-lg font-bold text-fg">BÁO CÁO CONTENT TUẦN — ZALO</h1>
              <div className="text-[12px] text-muted">Kỳ: {data!.range.label}</div>
            </div>

            {/* I. Tổng quan */}
            <div>
              <SectionHeader title="I. Tổng quan" />
              {data!.byFormat.map((k) => (
                <div key={k.format || '__none__'} className="mb-3">
                  <div className="mb-1.5 text-[13px] font-semibold text-fg">{k.label}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <KPICard label="Đã cấp" value={num(k.capped)} tone="accent" />
                    <KPICard label="Đã test" value={num(k.tested)} tone="info" />
                    <KPICard label="Tồn" value={num(k.ton)} tone="warn" />
                    <KPICard label="Duy trì" value={num(k.duyTri)} tone="good" />
                  </div>
                </div>
              ))}
            </div>

            {/* II. Tiến độ sử dụng + IV. So sánh (dùng chung bảng) */}
            <div>
              <SectionHeader title="II. Tiến độ sử dụng & IV. So sánh hiệu quả theo định dạng" />
              <DataTable columns={cmpCols} rows={[...data!.byFormat, { ...data!.team, label: 'TỔNG' }]} rowKey={(r) => r.format || r.label} maxHeight={9999} />
            </div>

            {/* III. Cần xử lý */}
            <div>
              <SectionHeader title="III. Cần xử lý" />
              <DataTable
                columns={[
                  { key: 'label', header: 'Định dạng', render: (r: any) => <b className="text-fg">{r.label}</b> },
                  ...ATTN.map((a) => ({ key: a.key, header: a.label, align: 'right' as const, render: (r: any) => (r[a.key] > 0 ? <b className="text-danger">{r[a.key]}</b> : <span className="text-muted">0</span>) })),
                ]}
                rows={data!.attention}
                rowKey={(r: any) => r.format || r.label}
                maxHeight={9999}
              />
            </div>

            {/* V. Đề xuất tuần tới */}
            <div>
              <SectionHeader title="V. Đề xuất tuần tới" />
              <ul className="ml-1 space-y-1.5">
                {data!.narrative.plans.map((p, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-fg"><span className="text-accent">☐</span><span>{p}</span></li>
                ))}
              </ul>
            </div>

            <div className="border-t border-line pt-2 text-center text-[11px] text-muted">
              Content Operations · Báo cáo nội bộ Zalo · {new Date(data!.generatedAt).toLocaleString('vi-VN')}
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  );
}
