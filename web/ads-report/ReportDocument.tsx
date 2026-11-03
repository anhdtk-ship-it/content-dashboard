/* ============================================================
 * Ads Report (AR-01) — THÂN BÁO CÁO. Web và PDF dùng CHUNG markup này:
 * "Xuất PDF" = window.print() in chính khối `#report-doc` (quy tắc @media print đã có sẵn
 * trong web/styles.css, dựng cho Weekly Report — tái dùng nguyên vẹn, KHÔNG sửa CSS).
 * Vì vậy mọi điều khiển (bộ lọc, nút) phải nằm NGOÀI khối này hoặc mang class `no-print`.
 *
 * ════ MỌI CON SỐ Ở ĐÂY ĐỀU ĐỌC NGUYÊN TỪ FILE ROAS ════
 * Component này KHÔNG tính toán gì ngoài việc sắp xếp và cắt Top N. Hai dòng "CỘNG … đang
 * liệt kê" là phép cộng thuần của đúng các dòng hiển thị, và được ghi rõ như vậy để không
 * ai nhầm với tổng kỳ của Sheet (tổng kỳ nằm ở mục A).
 * Ô nào Sheet không có thì in "—", KHÔNG suy ra.
 *
 * ƯU TIÊN ĐỌC LƯỚT:
 *   - Sọc ngựa vằn + header dính trong bảng dài → không lạc dòng.
 *   - Thanh nền tỷ trọng sau cột Ngân sách → thấy ngay cái gì tiêu nhiều.
 *     (In ra giấy thanh này tự mất vì `#report-doc * { background: transparent }` —
 *      số vẫn nguyên, không ảnh hưởng bản PDF.)
 *   - ROAS tô màu theo ngưỡng: ≥100% xanh · >0% cam · =0% xám.
 * ========================================================== */
import { Fragment } from 'react';
import type { AdsReportResult, DongChiTieu, KhoiRoasNhanVien, NhomDiaLy, TongChiTieu } from './adsReportApi';
import { fmtNum, fmtRoas, fmtThang, fmtTyTrong, fmtVND, mauRoas } from './format';

const th = 'emp-th border border-line bg-surface2 px-2 py-2 text-[11px] font-semibold text-muted';
const thSticky = th + ' sticky top-0 z-[1]';
const td = 'border border-line px-2 py-[5px] text-[12px]';
const num = td + ' text-right tabular-nums';
const TRONG = '—';
/* Sọc ngựa vằn — chỉ trên màn hình; bản in bị `background: transparent !important` xoá, đúng ý. */
const zebra = (i: number) => (i % 2 === 1 ? 'bg-surface2/40' : '');

const NHAN_DIA_LY: Record<NhomDiaLy, string> = { noiDia: 'NỘI ĐỊA', quocTe: 'QUỐC TẾ' };
const DIA_LY: NhomDiaLy[] = ['noiDia', 'quocTe'];

function TieuDeMuc({ id, children }: { id: string; children: React.ReactNode }) {
  return <div id={id} className="section-head mb-2 mt-7 scroll-mt-16 border-l-[3px] border-accent pl-2 text-[15px] font-bold text-fg">{children}</div>;
}

function TieuDeKhoi({ children, dem }: { children: React.ReactNode; dem?: string }) {
  return (
    <div className="mb-1.5 mt-3 flex items-center gap-2 text-[12px] font-semibold text-accent">
      <span>{children}</span>
      {dem && <span className="rounded-pill bg-surface2 px-2 py-0.5 text-[10px] font-normal text-muted">{dem}</span>}
    </div>
  );
}

/** Tên content dài — cắt bằng CSS, giữ tooltip đầy đủ, KHÔNG xuống nhiều dòng làm vỡ bảng. */
const TenContent = ({ ten }: { ten: string }) => (
  <span title={ten} className="block max-w-[440px] truncate">{ten}</span>
);

/** Ô ngân sách có thanh nền thể hiện tỷ trọng so với dòng lớn nhất trong khối. */
const ONganSach = ({ tien, tyLe }: { tien: number; tyLe: number }) => (
  <div className="relative">
    <div className="absolute inset-y-0 right-0 rounded-sm bg-accent/20" style={{ width: `${Math.max(2, tyLe * 100)}%` }} aria-hidden />
    <span className="relative font-semibold">{fmtVND(tien)}</span>
  </div>
);

/* ---------- A. Chi tiêu & ROAS theo nhân viên — đọc nguyên tab "Roas tổng" ---------- */
function BangChiTieu({ theoNhanVien, team }: { theoNhanVien: TongChiTieu[]; team: TongChiTieu }) {
  const nhieu = theoNhanVien.length > 1;
  const tongTeam = team.tong.chiPhi;

  const boO = (t: TongChiTieu, g: 'noiDia' | 'quocTe' | 'tong') => {
    const c = t[g];
    const thieu = t.thieuChiSoGop;
    return (
      <>
        <td className={num + (g === 'tong' ? ' font-semibold' : '')}>{fmtVND(c.chiPhi)}</td>
        <td className={num}>{fmtNum(c.slData)}</td>
        <td className={num}>{thieu ? <span className="text-muted">{TRONG}</span> : fmtVND(c.giaData)}</td>
        <td className={num + ' ' + (thieu ? 'text-muted' : mauRoas(c.roasThang))}>{thieu ? TRONG : fmtRoas(c.roasThang)}</td>
        <td className={num + ' ' + (thieu ? 'text-muted' : mauRoas(c.roas3Thang))}>{thieu ? TRONG : fmtRoas(c.roas3Thang)}</td>
      </>
    );
  };

  const hang = (t: TongChiTieu, dam: boolean, i: number) => (
    <tr key={t.nhanVienKey} className={dam ? 'total-row font-bold' : zebra(i)}>
      <td className={td + ' whitespace-nowrap'}>
        {dam ? (t.tuSheet ? 'CẢ TEAM' : 'CẢ TEAM') : t.full}
        {dam && !t.tuSheet && <span className="ml-1 text-[10px] font-normal text-warn">(cộng 4 dòng trên)</span>}
      </td>
      {boO(t, 'noiDia')}
      {boO(t, 'quocTe')}
      {boO(t, 'tong')}
      {nhieu && <td className={num}>{dam ? '100%' : tongTeam > 0 ? fmtTyTrong(t.tong.chiPhi / tongTeam) : TRONG}</td>}
    </tr>
  );

  const nhomHeader = () => (
    <>
      <th className={th}>Chi phí</th><th className={th}>SL data</th><th className={th}>Giá data</th>
      <th className={th}>Roas tháng</th><th className={th}>Roas 3 tháng</th>
    </>
  );

  return (
    <table className="emp-table w-full border-collapse">
      <thead>
        <tr>
          <th className={th + ' whitespace-nowrap text-left'} rowSpan={2}>Nhân viên</th>
          <th className={th} colSpan={5}>NỘI ĐỊA</th>
          <th className={th} colSpan={5}>QUỐC TẾ</th>
          <th className={th} colSpan={5}>TỔNG CỘNG</th>
          {nhieu && <th className={th} rowSpan={2}>% chi tiêu</th>}
        </tr>
        <tr>{nhomHeader()}{nhomHeader()}{nhomHeader()}</tr>
      </thead>
      <tbody>
        {theoNhanVien.map((t, i) => hang(t, false, i))}
        {nhieu && hang(team, true, 0)}
      </tbody>
    </table>
  );
}

/* ---------- B. Top content tiêu nhiều tiền nhất ---------- */
function BangTopChiTieu({ rows, topN, hienCotNV }: {
  rows: DongChiTieu[]; topN: number; hienCotNV: boolean;
}) {
  return (
    <>
      {DIA_LY.map((g) => {
        const all = rows.filter((d) => d.diaLy === g);
        if (!all.length) return null;
        const list = all.slice(0, topN);
        const chiPhi = list.reduce((s, d) => s + d.chiSo.chiPhi, 0);
        const slData = list.reduce((s, d) => s + d.chiSo.slData, 0);
        const tongKhoi = all.reduce((s, d) => s + d.chiSo.chiPhi, 0);
        const max = list[0]?.chiSo.chiPhi || 1;
        return (
          <div key={g} className="emp-block mb-4">
            <TieuDeKhoi dem={`${list.length}/${all.length} content · toàn khối ${fmtVND(tongKhoi)}`}>
              {NHAN_DIA_LY[g]}
            </TieuDeKhoi>
            <div className="max-h-[520px] overflow-auto rounded-card border border-line">
              <table className="emp-table w-full border-collapse">
                <thead>
                  <tr>
                    <th className={thSticky + ' w-9'}>#</th>
                    <th className={thSticky + ' text-left'}>Tên content</th>
                    <th className={thSticky}>Phân loại</th>
                    {hienCotNV && <th className={thSticky}>Nhân viên</th>}
                    <th className={thSticky}>Giá data</th>
                    <th className={thSticky}>Ngân sách</th>
                    <th className={thSticky}>SL data</th>
                    <th className={thSticky}>Roas tháng</th>
                    <th className={thSticky}>Roas 3 tháng</th>
                    <th className={thSticky}>% khối</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((d, i) => (
                    <tr key={`${d.content}__${d.phanLoai}__${d.nhanVienKey}__${i}`} className={zebra(i)}>
                      <td className={num + (i < 3 ? ' font-bold text-accent' : ' text-muted')}>{i + 1}</td>
                      <td className={td}><TenContent ten={d.content} /></td>
                      <td className={td + ' whitespace-nowrap text-muted'}>{d.phanLoai}</td>
                      {hienCotNV && <td className={td + ' whitespace-nowrap'}>{d.nhanVien}</td>}
                      <td className={num}>{fmtVND(d.chiSo.giaData)}</td>
                      <td className={num}><ONganSach tien={d.chiSo.chiPhi} tyLe={d.chiSo.chiPhi / max} /></td>
                      <td className={num}>{fmtNum(d.chiSo.slData)}</td>
                      <td className={num + ' ' + mauRoas(d.chiSo.roasThang)}>{fmtRoas(d.chiSo.roasThang)}</td>
                      <td className={num + ' ' + mauRoas(d.chiSo.roas3Thang)}>{fmtRoas(d.chiSo.roas3Thang)}</td>
                      <td className={num + ' text-muted'}>{tongKhoi > 0 ? fmtTyTrong(d.chiSo.chiPhi / tongKhoi) : TRONG}</td>
                    </tr>
                  ))}
                  <tr className="total-row font-bold">
                    <td className={td} />
                    <td className={td}>CỘNG {list.length} CONTENT ĐANG LIỆT KÊ{all.length > list.length ? ` (trên tổng ${all.length})` : ''}</td>
                    <td className={td} />
                    {hienCotNV && <td className={td} />}
                    <td className={num + ' text-muted'}>{TRONG}</td>
                    <td className={num}>{fmtVND(chiPhi)}</td>
                    <td className={num}>{fmtNum(slData)}</td>
                    <td className={num + ' text-muted'}>{TRONG}</td>
                    <td className={num + ' text-muted'}>{TRONG}</td>
                    <td className={num}>{tongKhoi > 0 ? fmtTyTrong(chiPhi / tongKhoi) : TRONG}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------- C. Tóm tắt ROAS ----------
 * CỐ Ý không có cột ROAS: ROAS của từng nhân viên đã nằm ở mục A với con số THẬT của
 * Sheet (tính trên toàn bộ chi tiêu). Nếu ở đây tự tính ROAS trên riêng nhóm content
 * ra ROAS sẽ cho số khác hẳn mục A và gây hiểu nhầm. */
function TomTatRoas({ roas }: { roas: KhoiRoasNhanVien[] }) {
  return (
    <table className="emp-table mb-2 w-full border-collapse">
      <thead>
        <tr>
          <th className={th + ' whitespace-nowrap text-left'} rowSpan={2}>Nhân viên</th>
          <th className={th} colSpan={3}>NỘI ĐỊA</th>
          <th className={th} colSpan={3}>QUỐC TẾ</th>
        </tr>
        <tr>
          {DIA_LY.map((g) => (
            <Fragment key={g}>
              <th className={th}>SL content</th>
              <th className={th}>Chi phí nhóm này</th>
              <th className={th}>SL data</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {roas.map((k, i) => (
          <tr key={k.nhanVienKey} className={zebra(i)}>
            <td className={td + ' whitespace-nowrap font-semibold'}>{k.full}</td>
            {DIA_LY.map((g) => (
              <Cum key={g} n={k[g].rows.length} chiPhi={k[g].tongChiPhi} slData={k[g].tongSlData} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Cum({ n, chiPhi, slData }: { n: number; chiPhi: number; slData: number }) {
  return (
    <>
      <td className={num}>{n || TRONG}</td>
      <td className={num}>{n ? fmtVND(chiPhi) : TRONG}</td>
      <td className={num}>{n ? fmtNum(slData) : TRONG}</td>
    </>
  );
}

/* ---------- C. Chi tiết ROAS từng nhân viên ---------- */
function KhoiRoas({ k }: { k: KhoiRoasNhanVien }) {
  const co = k.noiDia.rows.length > 0 || k.quocTe.rows.length > 0;
  return (
    <div className="emp-block mb-5">
      <div id={`roas-${k.nhanVienKey}`} className="mb-1 scroll-mt-16 border-b border-line pb-1 text-[13px] font-bold text-fg">
        {k.full}
      </div>
      {!co && <div className="text-[12px] italic text-muted">Không có content nào phát sinh ROAS trong kỳ này.</div>}
      {DIA_LY.map((g) => {
        const khoi = k[g];
        if (!khoi.rows.length) return null;
        return (
          <div key={g}>
            <TieuDeKhoi dem={`${khoi.rows.length} content · ${fmtVND(khoi.tongChiPhi)}`}>{NHAN_DIA_LY[g]}</TieuDeKhoi>
            <table className="emp-table w-full border-collapse">
              <thead>
                <tr>
                  <th className={th + ' w-9'}>#</th>
                  <th className={th + ' text-left'}>Tên content</th>
                  <th className={th}>Phân loại</th>
                  <th className={th}>Chi phí</th>
                  <th className={th}>SL data</th>
                  <th className={th}>Giá data</th>
                  <th className={th}>Roas trong tháng</th>
                  <th className={th}>Roas 3 tháng</th>
                </tr>
              </thead>
              <tbody>
                {khoi.rows.map((x, i) => {
                  const c = x[g];
                  return (
                    <tr key={x.content + i} className={zebra(i)}>
                      <td className={num + ' text-muted'}>{i + 1}</td>
                      <td className={td}><TenContent ten={x.content} /></td>
                      <td className={td + ' whitespace-nowrap text-muted'}>{x.phanLoai}</td>
                      <td className={num + ' font-semibold'}>{fmtVND(c.chiPhi)}</td>
                      <td className={num}>{fmtNum(c.slData)}</td>
                      <td className={num}>{fmtVND(c.giaData)}</td>
                      <td className={num + ' ' + mauRoas(c.roasThang)}>{fmtRoas(c.roasThang)}</td>
                      <td className={num + ' ' + mauRoas(c.roas3Thang)}>{fmtRoas(c.roas3Thang)}</td>
                    </tr>
                  );
                })}
                <tr className="total-row font-bold">
                  <td className={td} />
                  <td className={td}>CỘNG {khoi.rows.length} CONTENT ĐANG LIỆT KÊ</td>
                  <td className={td} />
                  <td className={num}>{fmtVND(khoi.tongChiPhi)}</td>
                  <td className={num}>{fmtNum(khoi.tongSlData)}</td>
                  <td className={num + ' text-muted'}>{TRONG}</td>
                  <td className={num + ' text-muted'}>{TRONG}</td>
                  <td className={num + ' text-muted'}>{TRONG}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Thanh nhảy mục (chỉ màn hình) ---------- */
function ThanhNhay({ roas }: { roas: KhoiRoasNhanVien[] }) {
  const nhay = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const nut = 'rounded-pill border border-line px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-fg';
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted">Đi tới:</span>
      <button className={nut} onClick={nhay('muc-a')}>A. Chi tiêu &amp; ROAS</button>
      <button className={nut} onClick={nhay('muc-b')}>B. Top chi tiêu</button>
      <button className={nut} onClick={nhay('muc-c')}>C. Content ra ROAS</button>
      {roas.map((k) => (
        <button key={k.nhanVienKey} className={nut} onClick={nhay(`roas-${k.nhanVienKey}`)}>↳ {k.nhan}</button>
      ))}
    </div>
  );
}

/* ---------- Thân báo cáo ---------- */
export function ReportDocument({ data, topN }: { data: AdsReportResult; topN: number }) {
  const nhieuNV = data.chiTieu.theoNhanVien.length > 1;

  return (
    <>
      <ThanhNhay roas={data.roas} />

      <div id="report-doc">
        <div className="report-header mb-4 border-b border-line pb-2">
          <div className="report-title text-[19px] font-bold text-fg">
            BÁO CÁO ADS — {fmtThang(data.thang).toUpperCase()}
          </div>
          <div className="text-[12px] text-muted">{data.chiTieu.team.full}</div>
          <div className="mt-0.5 text-[10px] text-muted">
            Toàn bộ số liệu đọc nguyên từ file ROAS — không tính lại.
          </div>
        </div>

        <div className="report-section">
          <TieuDeMuc id="muc-a">
            A. Chi tiêu &amp; ROAS theo nhân viên{' '}
            <span className="text-[12px] font-normal text-muted">— đọc nguyên tab “Roas tổng”</span>
          </TieuDeMuc>
          <BangChiTieu theoNhanVien={data.chiTieu.theoNhanVien} team={data.chiTieu.team} />
        </div>

        <div className="report-section">
          <TieuDeMuc id="muc-b">
            B. Content tiêu nhiều tiền nhất{' '}
            <span className="text-[12px] font-normal text-muted">— Top {topN} mỗi thị trường</span>
          </TieuDeMuc>
          <BangTopChiTieu rows={data.chiTieu.rows} topN={topN} hienCotNV={nhieuNV} />
        </div>

        <div className="report-section">
          <TieuDeMuc id="muc-c">
            C. Content phát sinh ROAS{' '}
            <span className="text-[12px] font-normal text-muted">
              — tính khi Roas tháng &gt; 0 HOẶC Roas 3 tháng &gt; 0
            </span>
          </TieuDeMuc>
          {nhieuNV && (
            <div className="emp-block mb-4">
              <TieuDeKhoi>TÓM TẮT</TieuDeKhoi>
              <TomTatRoas roas={data.roas} />
              <div className="mt-1 text-[11px] text-muted">
                Chi phí ở đây chỉ cộng các content phát sinh ROAS — không phải tổng chi tiêu cả kỳ. Tổng kỳ và ROAS thật của từng người xem mục A.
              </div>
            </div>
          )}
          {data.roas.map((k) => <KhoiRoas key={k.nhanVienKey} k={k} />)}
        </div>

        {/* Nguồn + ghi chú nằm TRONG #report-doc để bản PDF cũng mang theo. Hộp cảnh báo phía
            trên mang class `no-print` nên sẽ biến mất khi in — không trùng lặp trên giấy. */}
        <div className="emp-block mt-6 border-t border-line pt-2 text-[11px] leading-relaxed text-muted">
          <div className="mb-1 font-semibold">Nguồn số liệu</div>
          {data.meta.nguon.map((n, i) => <div key={i}>• {n}</div>)}
          {data.meta.canhBao.length > 0 && (
            <>
              <div className="mb-1 mt-2 font-semibold">Ghi chú</div>
              {data.meta.canhBao.map((c, i) => <div key={i}>({i + 1}) {c}</div>)}
            </>
          )}
        </div>
      </div>
    </>
  );
}
