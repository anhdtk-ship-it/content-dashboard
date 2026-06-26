/* Thanh Tab dùng chung cho các trang gộp (chỉ UI — không đổi logic). */
export interface TabDef { key: string; label: string; }

export function TabBar({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-line bg-bg px-4 pt-3">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`rounded-t-lg border border-b-0 px-4 py-2 text-[14px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent ${
            active === t.key
              ? 'border-line bg-surface text-fg'
              : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
