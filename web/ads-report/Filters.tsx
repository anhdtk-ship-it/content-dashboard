/* Ads Report (AR-01) — thanh bộ lọc + nút xuất file.
 * Toàn bộ thanh này mang class `no-print` để biến mất khi in PDF (xem web/styles.css §PRINT). */
import type { LocThiTruong, NhanVienOption } from './adsReportApi';

export interface AdsReportFilterState {
  thang: string;
  thiTruong: LocThiTruong;
  nhanVien: string;   // 'ALL' hoặc key
  topN: number;       // chỉ ảnh hưởng hiển thị bảng Top chi tiêu
}

const ctrl = 'h-9 rounded-control border border-line bg-surface px-2.5 text-[13px] text-fg focus:border-accent focus:outline-none';
const lbl = 'mb-1 text-[11px] text-muted';

const TT_OPTS: [LocThiTruong, string][] = [['all', 'Tất cả'], ['noi_dia', 'Nội Địa'], ['quoc_te', 'Quốc Tế']];
const TOP_OPTS = [10, 20, 30, 50, 100];

export function Filters({
  value, nhanVienOptions, dangTai, onChange, onExcel, onPrint,
}: {
  value: AdsReportFilterState;
  nhanVienOptions: NhanVienOption[];
  dangTai: boolean;
  onChange: (patch: Partial<AdsReportFilterState>) => void;
  onExcel: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className={lbl}>Tháng</label>
        <input type="month" value={value.thang} className={ctrl}
          onChange={(e) => onChange({ thang: e.target.value })} />
      </div>

      <div className="flex flex-col">
        <label className={lbl}>Thị trường</label>
        <select value={value.thiTruong} className={ctrl}
          onChange={(e) => onChange({ thiTruong: e.target.value as LocThiTruong })}>
          {TT_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="flex flex-col">
        <label className={lbl}>Nhân viên Ads</label>
        <select value={value.nhanVien} className={ctrl} onChange={(e) => onChange({ nhanVien: e.target.value })}>
          <option value="ALL">Cả team</option>
          {nhanVienOptions.map((nv) => <option key={nv.key} value={nv.key}>{nv.full}</option>)}
        </select>
      </div>

      <div className="flex flex-col">
        <label className={lbl}>Hiện Top</label>
        <select value={value.topN} className={ctrl} onChange={(e) => onChange({ topN: Number(e.target.value) })}>
          {TOP_OPTS.map((n) => <option key={n} value={n}>Top {n}</option>)}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button onClick={onExcel} disabled={dangTai}
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-[13px] text-fg hover:border-accent disabled:opacity-50">
          📊 Xuất Excel
        </button>
        <button onClick={onPrint} disabled={dangTai}
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-[13px] text-fg hover:border-accent disabled:opacity-50">
          📄 Xuất PDF
        </button>
      </div>
    </div>
  );
}
