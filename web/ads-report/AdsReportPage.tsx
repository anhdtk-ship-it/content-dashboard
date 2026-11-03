/* ============================================================
 * Báo cáo Ads tháng (AR-01) — MODULE MỚI, ĐỘC LẬP với Ads Monitor / Content Analytics /
 * Content Performance / Budget / Zalo. Báo cáo theo THÁNG ĐƠN LẺ, gồm 3 mục:
 *   A. Chi tiêu theo nhân viên   (Raw_Data — khớp 100% Ads Monitor)
 *   B. Content tiêu nhiều tiền nhất, tách Nội Địa / Quốc Tế
 *   C. Content phát sinh ROAS, lấy từ TAB RIÊNG của từng nhân viên trong file ROAS
 *      (KHÔNG có bản "cả team" — đã chốt với chủ dự án)
 *
 * Mỗi lần đổi bộ lọc phải đọc lại Raw_Data (~7s) nên KHÔNG tự gọi lại định kỳ; đổi "Hiện
 * Top" chỉ cắt danh sách ở client, KHÔNG gọi lại backend.
 * ========================================================== */
import { useEffect, useState } from 'react';
import { PageContainer, LoadingSkeleton, EmptyState, ActionButton } from '../../src/components/ui';
import {
  fetchAdsReport, fetchNhanVien, taiExcel, thangHienTai,
  type AdsReportResult, type NhanVienOption,
} from './adsReportApi';
import { Filters, type AdsReportFilterState } from './Filters';
import { ReportDocument } from './ReportDocument';
import { SummaryCards } from './SummaryCards';
import { fmtGio } from './format';

export function AdsReportPage() {
  const [filters, setFilters] = useState<AdsReportFilterState>({
    thang: thangHienTai(), thiTruong: 'all', nhanVien: 'ALL', topN: 30,
  });
  const [data, setData] = useState<AdsReportResult | null>(null);
  const [nhanVienOptions, setNhanVienOptions] = useState<NhanVienOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thongBao, setThongBao] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => { fetchNhanVien().then(setNhanVienOptions).catch(() => { /* dropdown vẫn dùng được với 'Cả team' */ }); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAdsReport({ thang: filters.thang, thiTruong: filters.thiTruong, nhanVien: filters.nhanVien })
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [filters.thang, filters.thiTruong, filters.nhanVien, reload]);

  const flash = (m: string) => { setThongBao(m); setTimeout(() => setThongBao(null), 5000); };

  const onExcel = async () => {
    flash('Đang dựng file Excel…');
    try {
      await taiExcel({ thang: filters.thang, thiTruong: filters.thiTruong, nhanVien: filters.nhanVien });
      flash('Đã tải file Excel.');
    } catch (e: any) {
      flash(`Lỗi xuất Excel: ${e?.message ?? e}`);
    }
  };

  // PDF = in chính #report-doc. setTimeout để React kịp vẽ xong trước khi mở hộp thoại in.
  const onPrint = () => setTimeout(() => window.print(), 100);

  return (
    <div className="text-fg">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-bg/95 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] font-semibold text-fg">🧾 Báo cáo Ads tháng</span>
        <span className="ml-auto text-[11px] text-muted">
          Nguồn: Raw_Data (Ads) + file ROAS (tab từng nhân viên) — đọc trực tiếp, không cache
          {data ? ` · dựng lúc ${fmtGio(data.meta.taoLuc)}` : ''}
        </span>
      </div>

      <PageContainer>
        <Filters
          value={filters}
          nhanVienOptions={nhanVienOptions}
          dangTai={loading}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onExcel={onExcel}
          onPrint={onPrint}
        />

        {thongBao && <div className="no-print mb-3 text-[12px] text-muted">{thongBao}</div>}

        {error ? (
          <EmptyState icon="⚠️" message={`Lỗi tải dữ liệu: ${error}`}
            action={<ActionButton onClick={() => setReload((n) => n + 1)}>Thử lại</ActionButton>} />
        ) : loading && !data ? (
          <div className="space-y-4">
            <div className="text-[12px] text-muted">Đang đọc Raw_Data và file ROAS — thường mất 7–10 giây…</div>
            <LoadingSkeleton variant="block" />
          </div>
        ) : data ? (
          <>
            {data.meta.canhBao.length > 0 && (
              <div className="no-print mb-4 space-y-1 rounded-card border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] text-warn">
                {data.meta.canhBao.map((c, i) => <div key={i}>⚠ {c}</div>)}
              </div>
            )}
            {loading && <div className="no-print mb-2 text-[12px] text-muted">Đang cập nhật…</div>}
            {/* Thẻ KPI nằm NGOÀI #report-doc: bản in đã có mục A đầy đủ hơn, in thêm thẻ là thừa giấy. */}
            <div className="no-print"><SummaryCards data={data} /></div>
            <ReportDocument data={data} topN={filters.topN} />
          </>
        ) : (
          <EmptyState message="Không có dữ liệu." />
        )}
      </PageContainer>
    </div>
  );
}
