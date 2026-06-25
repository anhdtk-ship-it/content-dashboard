import { MARKETS, statusStyle, groupStyle, STATUS_GROUPS } from './tokens';

export interface StatusBadgeProps {
  /** 'status' = status_group code, 'market' = noi_dia/quoc_te */
  kind?: 'status' | 'market';
  value: string;
  /** current_status GỐC — nếu có sẽ tô màu chính xác theo nghiệp vụ (S3-001.1). */
  label?: string;
  /** Hiện thêm pill mức độ cảnh báo (Cần xử lý / Khẩn cấp / Theo dõi / Ổn định). */
  severity?: boolean;
  className?: string;
}

/** Tag trạng thái / pill thị trường — màu chuẩn nghiệp vụ Seryn (DESIGN_SYSTEM §11). */
export function StatusBadge({ kind = 'status', value, label, severity = false, className = '' }: StatusBadgeProps) {
  if (kind === 'market') {
    const t = (MARKETS as any)[value] as { label: string; bg: string; fg: string } | undefined;
    return (
      <span className={`inline-block rounded-pill px-2 py-[2px] text-[11px] ${className}`}
        style={t ? { backgroundColor: t.bg, color: t.fg } : { backgroundColor: 'var(--surface2)', color: 'var(--muted)' }}>
        {t?.label ?? value}
      </span>
    );
  }
  // status: ưu tiên màu theo current_status gốc (label); fallback theo group.
  const st = label ? statusStyle(label) : groupStyle(value);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span title={st.severity ? `Mức độ: ${st.severity}` : undefined}
        className={`inline-block rounded-tag px-2 py-[2px] text-[11px] ${className}`}
        style={{ backgroundColor: st.bg, color: st.fg }}>
        {st.label}
      </span>
      {severity && st.severity && (
        <span className="rounded-pill px-1.5 py-[1px] text-[10px]" style={{ backgroundColor: st.bg, color: st.fg }}>
          {st.severity}
        </span>
      )}
    </span>
  );
}

export function StatusBadgeDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.keys(STATUS_GROUPS).map((k) => <StatusBadge key={k} value={k} />)}
      <StatusBadge kind="market" value="noi_dia" />
      <StatusBadge kind="market" value="quoc_te" />
    </div>
  );
}
