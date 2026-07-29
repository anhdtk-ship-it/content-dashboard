/* ============================================================
 * FB-ADS-02 — Dashboard 1 THỊ TRƯỜNG (Nội Địa hoặc Quốc Tế).
 * KPI · Stacked column chart · Bảng phân tích · Phân bổ % · Chỉ số mới · Bảng theo NV.
 * Thuần hiển thị từ MarketAnalysis (đã memoize ở trang). KHÔNG query lại.
 * ========================================================== */
import { useMemo, useState } from 'react';
import { KPICard, SectionHeader, DataTable, type Column } from '../../src/components/ui';
import { fmtNum, fmtVND, fmtVNDShort, pct } from './format';
import { GROUPS, type GroupKey, type GroupStat, type EmployeeRow, type MarketAnalysis } from './selectors';

type Drill = (title: string, rows: MarketAnalysis['rows']) => void;

/* ---------- Column chart (4 nhóm) — HTML/CSS, không thư viện ngoài ---------- */
function GroupChart({ groups, onPick }: { groups: GroupStat[]; onPick: (g: GroupStat) => void }) {
  const max = Math.max(...groups.map((g) => g.budget), 1);
  return (
    <div className="flex items-end justify-around gap-3" style={{ height: 220 }}>
      {groups.map((g) => (
        <button key={g.key} onClick={() => onPick(g)}
          title={`${g.label}\ncontent: ${fmtNum(g.content)}\nNgân sách: ${fmtVND(g.budget)}\nTrung bình: ${fmtVND(g.avg)}\n% ngân sách: ${pct(g.pctBudget)}`}
          className="group flex h-full flex-1 flex-col items-center justify-end gap-1 outline-none">
          <span className="text-[11px] font-semibold tabular-nums text-fg">{fmtVNDShort(g.budget)}</span>
          <div className="w-full max-w-[64px] rounded-t-md transition group-hover:brightness-110"
            style={{ height: `${(g.budget / max) * 100}%`, minHeight: 4, background: g.color }} />
          <span className="text-[11px] text-muted">{g.short}</span>
          <span className="text-[10px] tabular-nums text-muted">{fmtNum(g.content)} ct · {pct(g.pctBudget)}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Biểu đồ cột NHÓM theo nhân viên — GỘP ngân sách + content trên 1 biểu đồ ----------
 * Mỗi nhân viên = 1 cụm 4 cột (Cũ<5tr / Cũ>5tr / Tươi<5tr / Tươi>5tr).
 * Chiều cao cột = NGÂN SÁCH; nhãn trên đầu ghi CẢ ngân sách (đậm) và số content. */
function EmployeeChart({ employees, onCell }: { employees: EmployeeRow[]; onCell: (name: string, g: GroupKey) => void }) {
  const H = 200;   // chiều cao vùng vẽ cột (px)
  const LBL = 26;  // chừa chỗ cho nhãn 2 dòng (ngân sách + content) trên đầu cột
  // Thang đo chung theo ngân sách: cột lớn nhất trên MỌI nhân viên & MỌI nhóm.
  const max = Math.max(...employees.flatMap((e) => GROUPS.map((g) => e.budgets[g.key])), 1);
  const list = [...employees].sort((a, b) => b.totalBudget - a.totalBudget);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] text-muted">Cột cao = ngân sách · nhãn mỗi cột: <b className="text-fg">ngân sách</b> / số content</span>
        <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1">
          {GROUPS.map((g) => (
            <span key={g.key} className="inline-flex items-center gap-1 text-[11px] text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />{g.short}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        {/* Mỗi nhân viên chiếm phần bằng nhau (flex:1) → trải đều hết chiều ngang;
            đông nhân viên thì min-width giữ cột đủ rộng và tự cuộn ngang. */}
        <div className="flex" style={{ minWidth: '100%' }}>
          {list.map((e) => (
            <div key={e.name} className="flex flex-col items-center" style={{ flex: '1 1 0', minWidth: 108 }}>
              {/* cụm 4 cột đứng cạnh nhau, canh giữa trong phần của nhân viên */}
              <div className="flex w-full items-end justify-center gap-2 border-b border-line" style={{ height: H }}>
                {GROUPS.map((g) => {
                  const budget = e.budgets[g.key];
                  const content = e.counts[g.key];
                  const h = budget > 0 ? Math.max((budget / max) * (H - LBL), 2) : 0;
                  return (
                    <button key={g.key} onClick={() => content > 0 && onCell(e.name, g.key)}
                      title={`${e.name} · ${g.short}\nNgân sách: ${fmtVND(budget)}\nContent: ${fmtNum(content)}`}
                      className="flex h-full flex-col items-center justify-end outline-none" style={{ width: 22 }}>
                      <span className="mb-0.5 flex flex-col items-center leading-none" style={{ height: LBL - 4 }}>
                        {budget > 0 ? (<>
                          <b className="text-[9px] tabular-nums text-fg">{fmtVNDShort(budget)}</b>
                          <span className="text-[9px] tabular-nums text-muted">{fmtNum(content)} ct</span>
                        </>) : null}
                      </span>
                      <div className="w-full rounded-t-[3px] transition hover:brightness-110"
                        style={{ height: `${h}px`, background: g.color }} />
                    </button>
                  );
                })}
              </div>
              <span className="mt-1 block max-w-full truncate px-1 text-[11px] font-medium text-fg" title={e.name}>{e.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Bảng theo nhân viên (sort + filter + click ô) ---------- */
const EMP_COLS: { key: GroupKey; label: string }[] = GROUPS.map((g) => ({ key: g.key, label: g.short }));
type SortKey = 'name' | GroupKey | 'totalContent' | 'totalBudget' | 'avg';

function EmployeeTable({ employees, onCell }: { employees: EmployeeRow[]; onCell: (name: string, g: GroupKey) => void }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'totalBudget', dir: -1 });
  const rows = useMemo(() => {
    const f = employees.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase()));
    const val = (e: EmployeeRow): number | string =>
      sort.k === 'name' ? e.name
      : sort.k === 'totalContent' ? e.totalContent
      : sort.k === 'totalBudget' ? e.totalBudget
      : sort.k === 'avg' ? e.avg
      : e.counts[sort.k];
    return [...f].sort((a, b) => { const av = val(a), bv = val(b); if (av === bv) return 0; return (av > bv ? 1 : -1) * sort.dir; });
  }, [employees, q, sort]);
  const toggle = (k: SortKey) => setSort((s) => (s.k === k ? { k, dir: (s.dir === 1 ? -1 : 1) } : { k, dir: -1 }));
  const arrow = (k: SortKey) => (sort.k === k ? (sort.dir === -1 ? ' ▼' : ' ▲') : '');
  const th = 'cursor-pointer select-none border-b border-line bg-surface px-2 py-2 text-[11px] font-semibold text-muted hover:text-fg';

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lọc nhân viên…"
        className="mb-2 w-[200px] rounded-control border border-line bg-surface px-2 py-1.5 text-[13px] text-fg" />
      <div className="overflow-auto rounded-card border border-line">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className={`${th} text-left`} onClick={() => toggle('name')}>Nhân viên{arrow('name')}</th>
              {EMP_COLS.map((c) => <th key={c.key} className={`${th} text-right`} title="Số content · ngân sách" onClick={() => toggle(c.key)}>{c.label}{arrow(c.key)}</th>)}
              <th className={`${th} text-right`} onClick={() => toggle('totalContent')}>Tổng content{arrow('totalContent')}</th>
              <th className={`${th} text-right`} onClick={() => toggle('totalBudget')}>Tổng ngân sách{arrow('totalBudget')}</th>
              <th className={`${th} text-right`} onClick={() => toggle('avg')}>Ngân sách TB{arrow('avg')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-muted">Không có dữ liệu</td></tr>
              : rows.map((e) => (
                <tr key={e.name} className="border-b border-line">
                  <td className="px-2 py-1.5 font-semibold text-fg">{e.name}</td>
                  {EMP_COLS.map((c) => (
                    <td key={c.key} className="px-2 py-1.5 text-right tabular-nums">
                      {e.counts[c.key] > 0
                        ? <button onClick={() => onCell(e.name, c.key)} className="text-accent hover:underline" title={`${e.name} · ${c.label}`}>
                            {e.counts[c.key]} <span className="text-muted">· {fmtVNDShort(e.budgets[c.key])}</span>
                          </button>
                        : <span className="text-muted">0</span>}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-fg">{fmtNum(e.totalContent)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-fg">{fmtVND(e.totalBudget)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">{fmtVND(e.avg)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Dashboard 1 thị trường ---------- */
export function MarketDashboard({ a, onDrill }: { a: MarketAnalysis; onDrill: Drill }) {
  const drillGroup = (key: GroupKey, label: string) => onDrill(`${a.marketLabel} · ${label}`, a.rows.filter((r) => r.group === key));
  const drillCell = (name: string, key: GroupKey) =>
    onDrill(`${a.marketLabel} · ${name} · ${GROUPS.find((g) => g.key === key)!.short}`, a.rows.filter((r) => r.ads_owner === name && r.group === key));

  const groupCols: Column<GroupStat>[] = [
    { key: 'label', header: 'Nhóm', render: (r) => <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} /><b className="text-fg">{r.label}</b></span> },
    { key: 'content', header: 'Số content', align: 'right', render: (r) => fmtNum(r.content) },
    { key: 'pctContent', header: '%', align: 'right', render: (r) => <span className="text-muted">{pct(r.pctContent)}</span> },
    { key: 'budget', header: 'Ngân sách', align: 'right', render: (r) => fmtVND(r.budget) },
    { key: 'pctBudget', header: '%', align: 'right', render: (r) => <span className="text-muted">{pct(r.pctBudget)}</span> },
    { key: 'avg', header: 'Ngân sách TB / content', align: 'right', render: (r) => fmtVND(r.avg) },
  ];

  return (
    <div className="rounded-card border border-line bg-surface/40 p-4">
      <div className="mb-3 text-[15px] font-bold text-fg">📘 {a.marketLabel}</div>

      {/* KPI đầu trang */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Tổng ngân sách" value={fmtVNDShort(a.kpi.totalBudget)} tone="accent" sub={fmtVND(a.kpi.totalBudget)} />
        <KPICard label="Tổng content" value={fmtNum(a.kpi.totalContent)} tone="info" />
        <KPICard label="Ngân sách TB / content" value={fmtVNDShort(a.kpi.avgBudget)} tone="good" />
        <KPICard label="Content cũ" value={fmtNum(a.kpi.contentCu)} tone="warn" />
        <KPICard label="Content tươi" value={fmtNum(a.kpi.contentTuoi)} tone="good" />
      </div>

      {/* Chỉ số phân tích */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <KPICard label="Tỷ lệ ngân sách content tươi" value={pct(a.indices.freshBudgetRatio)} tone="good" tooltip="Ngân sách content tươi ÷ Tổng ngân sách" />
        <KPICard label="Tỷ lệ ngân sách content cũ" value={pct(a.indices.oldBudgetRatio)} tone="orange" tooltip="Ngân sách content cũ ÷ Tổng ngân sách" />
        <KPICard label="Ngân sách trung bình / content" value={fmtVNDShort(a.indices.avgBudget)} tone="default" />
        <KPICard label="Chỉ số phân bổ ngân sách" value={pct(a.indices.distributionIndex)} tone="info" tooltip="Tỷ trọng ngân sách rơi vào content ≥ ngưỡng 5 triệu" />
      </div>

      {/* Biểu đồ + Phân bổ */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-3">
          <SectionHeader title="Ngân sách theo nhóm" />
          <GroupChart groups={a.groups} onPick={(g) => drillGroup(g.key, g.label)} />
        </div>
        <div className="rounded-card border border-line bg-surface p-3">
          <SectionHeader title="Phân bổ ngân sách (%)" />
          <div className="flex flex-col gap-2.5">
            {a.groups.map((g) => (
              <div key={g.key}>
                <div className="mb-0.5 flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1.5 text-muted"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />{g.label}</span>
                  <span className="tabular-nums text-fg">Budget {pct(g.pctBudget)} · Content {pct(g.pctContent)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-pill bg-surface2"><div className="h-full rounded-pill" style={{ width: `${g.pctBudget * 100}%`, background: g.color }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bảng phân tích nhóm */}
      <div className="mt-4">
        <SectionHeader title="Bảng phân tích theo nhóm" action={<span className="text-xs text-muted">bấm dòng để xem content</span>} />
        <DataTable columns={groupCols} rows={[...a.groups, a.total]} rowKey={(r, i) => (i < a.groups.length ? r.key : 'total')}
          onRowClick={(r) => { const g = a.groups.find((x) => x.key === r.key && x.label === r.label); if (g) drillGroup(g.key, g.label); }} maxHeight={9999} />
      </div>

      {/* Phân tích theo nhân viên — biểu đồ cột chồng + bảng chi tiết */}
      <div className="mt-4">
        <SectionHeader title="Phân tích theo nhân viên Ads" action={<span className="text-xs text-muted">mỗi cột = 1 nhân viên · chia theo nhóm</span>} />
        <div className="rounded-card border border-line bg-surface p-3">
          <EmployeeChart employees={a.employees} onCell={drillCell} />
        </div>
      </div>
      <div className="mt-3">
        <SectionHeader title="Bảng chi tiết theo nhân viên" action={<span className="text-xs text-muted">mỗi ô: số content · ngân sách — bấm để xem content</span>} />
        <EmployeeTable employees={a.employees} onCell={drillCell} />
      </div>
    </div>
  );
}
