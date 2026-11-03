/* ============================================================
 * Ads Report (AR-01) — dải thẻ KPI đọc lướt, đặt ngay đầu trang (NGOÀI #report-doc).
 *
 * MỌI SỐ Ở ĐÂY LÀ SỐ CỦA SHEET, KHÔNG TỰ TÍNH:
 *   - Chi phí · SL data · Giá data · ROAS lấy nguyên từ dòng tổng của tab "Roas tổng".
 *   - Hai chỗ duy nhất là phép chia/đếm hiển nhiên: tỷ trọng Nội Địa/Quốc Tế trên tổng,
 *     và đếm số content ra ROAS.
 * Thẻ nào Sheet không có số (dòng cả team ở tháng loại trừ Khiêm) thì hiện "—".
 * ========================================================== */
import { KPICard } from '../../src/components/ui';
import type { AdsReportResult } from './adsReportApi';
import { fmtNum, fmtRoas, fmtTyTrong, fmtVND, fmtVNDngan, tongRoas } from './format';

const TRONG = '—';

export function SummaryCards({ data }: { data: AdsReportResult }) {
  const t = data.chiTieu.team;
  const tong = t.tong.chiPhi;
  const thieu = t.thieuChiSoGop;

  const roasND = data.roas.reduce((s, k) => s + k.noiDia.rows.length, 0);
  const roasQT = data.roas.reduce((s, k) => s + k.quocTe.rows.length, 0);
  const chiPhiRoas = data.roas.reduce((s, k) => s + k.noiDia.tongChiPhi + k.quocTe.tongChiPhi, 0);

  const tyLe = (x: number) => (tong > 0 ? fmtTyTrong(x / tong) : TRONG);
  /** Tone của thẻ ROAS: đạt → xanh, chưa đạt → cam. */
  const toneRoas = tongRoas(t.tong.roasThang) === 'dat' ? 'good' : 'orange';

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KPICard
        label="Tổng chi tiêu"
        value={fmtVNDngan(tong)}
        sub={fmtVND(tong)}
        tone="accent"
        tooltip={t.tuSheet
          ? 'Đọc nguyên dòng tổng của tab "Roas tổng".'
          : 'Cộng chi phí 4 nhân viên ads — tháng này dòng tổng của Sheet có gồm người ngoài team.'}
      />
      <KPICard
        label="Nội Địa"
        value={fmtVNDngan(t.noiDia.chiPhi)}
        sub={`${tyLe(t.noiDia.chiPhi)} tổng · ${fmtNum(t.noiDia.slData)} data`}
        tooltip='Cột TRONG NƯỚC của tab "Roas tổng".'
      />
      <KPICard
        label="Quốc Tế"
        value={fmtVNDngan(t.quocTe.chiPhi)}
        sub={`${tyLe(t.quocTe.chiPhi)} tổng · ${fmtNum(t.quocTe.slData)} data`}
        tooltip='Cột NƯỚC NGOÀI của tab "Roas tổng".'
      />
      <KPICard
        label="ROAS cả team"
        value={thieu ? TRONG : fmtRoas(t.tong.roasThang)}
        sub={thieu ? 'Sheet không có dòng tương ứng' : `Roas 3 tháng ${fmtRoas(t.tong.roas3Thang)}`}
        tone={thieu ? 'default' : toneRoas}
        tooltip='Số do chính file ROAS tính, trên TOÀN BỘ chi tiêu trong kỳ — không phải chỉ các content ra ROAS.'
      />
      <KPICard
        label="Content phát sinh ROAS"
        value={fmtNum(roasND + roasQT)}
        sub={`${roasND} Nội Địa · ${roasQT} Quốc Tế · ${fmtVNDngan(chiPhiRoas)}`}
        tone="good"
        tooltip="Đếm theo từng thị trường (1 content ra ROAS ở cả 2 nơi tính 2 lần). Điều kiện: Roas tháng > 0 HOẶC Roas 3 tháng > 0."
      />
    </div>
  );
}
