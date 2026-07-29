/* Bảng cấu hình Zalo cho Leader (spec XII) — chỉnh Target/ngưỡng ngay trong Dashboard.
 * Lưu qua PUT /api/zalo/settings (key/value). KHÔNG hardcode. */
import { useEffect, useState } from 'react';
import { ActionButton, LoadingSkeleton, EmptyState } from '../../src/components/ui';
import { zaloApi } from './zaloApi';

export function ZaloSettingsPanel({ formats, onClose, onSaved }: {
  formats: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [warningDays, setWarningDays] = useState('5');
  const [warningThreshold, setWarningThreshold] = useState('3');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Danh sách định dạng cần đặt target = định dạng đang hiển thị + Video/Banner (đảm bảo luôn có).
  const targetFormats = Array.from(new Set(['Video', 'Banner', ...formats.filter(Boolean)]));

  useEffect(() => {
    let alive = true;
    zaloApi.settings()
      .then((s) => {
        if (!alive) return;
        const t: Record<string, string> = {};
        for (const f of targetFormats) t[f] = s.targets[f] != null ? String(s.targets[f]) : '';
        setTargets(t);
        setWarningDays(String(s.warningDays ?? 5));
        setWarningThreshold(String(s.warningThreshold ?? 3));
        setError(null);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []); // eslint-disable-line

  const save = async () => {
    setSaving(true); setError(null);
    try {
      for (const f of targetFormats) {
        const v = (targets[f] ?? '').trim();
        if (v !== '') await zaloApi.saveSetting(`target:${f}`, String(Math.max(0, parseInt(v) || 0)));
      }
      await zaloApi.saveSetting('test_warning_days', String(Math.max(1, parseInt(warningDays) || 5)));
      await zaloApi.saveSetting('warning_threshold', String(Math.max(1, parseInt(warningThreshold) || 3)));
      onSaved();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const inp = 'w-full rounded-control border border-line bg-surface px-2 py-[6px] text-[13px] text-fg';
  const lbl = 'flex flex-col gap-1 text-[12px] text-muted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[440px] rounded-card border border-line bg-bg p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-fg">⚙️ Cấu hình Zalo</h3>
          <button onClick={onClose} className="rounded-control px-2 py-1 text-sm text-muted hover:bg-surface hover:text-fg">✕</button>
        </div>

        {error && <div className="mb-2 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div>}

        {loading ? <LoadingSkeleton variant="block" /> : (
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Mục tiêu tháng (Target)</div>
            <div className="grid grid-cols-2 gap-3">
              {targetFormats.map((f) => (
                <label key={f} className={lbl}>{f}
                  <input className={inp} type="number" min={0} inputMode="numeric" placeholder="chưa đặt"
                    value={targets[f] ?? ''} onChange={(e) => setTargets((t) => ({ ...t, [f]: e.target.value }))} />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
              <label className={lbl}>Cảnh báo test quá (ngày)
                <input className={inp} type="number" min={1} value={warningDays} onChange={(e) => setWarningDays(e.target.value)} />
              </label>
              <label className={lbl}>Ngưỡng tô đỏ (số lượng)
                <input className={inp} type="number" min={1} value={warningThreshold} onChange={(e) => setWarningThreshold(e.target.value)} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <ActionButton onClick={onClose}>Huỷ</ActionButton>
              <ActionButton onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : '💾 Lưu'}</ActionButton>
            </div>
          </div>
        )}
        {!loading && targetFormats.length === 0 && <EmptyState message="Chưa có định dạng nào." />}
      </div>
    </div>
  );
}
