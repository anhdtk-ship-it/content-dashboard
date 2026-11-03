/* ============================================================
 * Ads Report (AR-01) — client API. Gọi /api/ads-report (requireAuth).
 * Tự gắn `Authorization: Bearer` bằng getAccessToken() — KHÔNG nằm trong danh sách
 * PROTECTED của web/auth/authFetch.ts (không sửa file đó), giống contentPerformanceApi.ts.
 * ĐỘC LẬP với contentPerformanceApi/contentAnalyticsApi/budgetApi/zaloApi.
 * ========================================================== */
import { getAccessToken } from '../auth/supabaseClient';

export type LocThiTruong = 'all' | 'noi_dia' | 'quoc_te';
/** File ROAS chỉ có 2 nhóm địa lý — KHÔNG có nhóm "chưa xác định". */
export type NhomDiaLy = 'noiDia' | 'quocTe';

/** Bộ 5 chỉ số file ROAS tính sẵn. ROAS dạng thập phân: 1.527 = 152,7%. */
export interface ChiSoKy {
  chiPhi: number;
  slData: number;
  giaData: number;
  roasThang: number;
  roas3Thang: number;
}

export interface DongChiTieu {
  content: string;
  phanLoai: string;
  nhanVienKey: string;
  nhanVien: string;
  diaLy: NhomDiaLy;
  chiSo: ChiSoKy;
}

export interface TongChiTieu {
  nhanVienKey: string;
  nhan: string;
  full: string;
  tong: ChiSoKy;
  noiDia: ChiSoKy;
  quocTe: ChiSoKy;
  /** true = đọc nguyên 1 dòng của Sheet · false = dòng "cả team" phải cộng 4 dòng nhân viên. */
  tuSheet: boolean;
  /** true = Giá data và ROAS KHÔNG suy ra được → hiển thị "—". */
  thieuChiSoGop: boolean;
}

export interface DongRoas {
  content: string;
  phanLoai: string;
  kenh: string;
  noiDia: ChiSoKy;
  quocTe: ChiSoKy;
}

export interface KhoiRoasNhanVien {
  nhanVienKey: string;
  nhan: string;
  full: string;
  roasTab: string;
  /** `tongChiPhi`/`tongSlData` = cộng riêng các content đang liệt kê, KHÔNG phải tổng kỳ. */
  noiDia: { rows: DongRoas[]; tongChiPhi: number; tongSlData: number };
  quocTe: { rows: DongRoas[]; tongChiPhi: number; tongSlData: number };
}

export interface AdsReportResult {
  thang: string;
  chiTieu: { theoNhanVien: TongChiTieu[]; team: TongChiTieu; rows: DongChiTieu[] };
  roas: KhoiRoasNhanVien[];
  meta: { taoLuc: string; nguon: string[]; canhBao: string[] };
}

export interface NhanVienOption { key: string; nhan: string; full: string }

export interface AdsReportQuery {
  thang: string;
  thiTruong: LocThiTruong;
  nhanVien: string;   // 'ALL' hoặc key
}

/** Tháng hiện tại 'YYYY-MM'. */
export function thangHienTai(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toParams(q: AdsReportQuery): URLSearchParams {
  const p = new URLSearchParams();
  p.set('thang', q.thang);
  if (q.thiTruong && q.thiTruong !== 'all') p.set('thiTruong', q.thiTruong);
  if (q.nhanVien && q.nhanVien !== 'ALL') p.set('nhanVien', q.nhanVien);
  return p;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  return token ? { Authorization: 'Bearer ' + token } : {};
}

export async function fetchAdsReport(q: AdsReportQuery): Promise<AdsReportResult> {
  const res = await fetch('/api/ads-report?' + toParams(q).toString(), { headers: await authHeaders() });
  const d = await res.json();
  if (!res.ok || d?.error) throw new Error(d?.error || `HTTP ${res.status}`);
  return d as AdsReportResult;
}

export async function fetchNhanVien(): Promise<NhanVienOption[]> {
  const res = await fetch('/api/ads-report/nhan-vien', { headers: await authHeaders() });
  const d = await res.json();
  if (!res.ok || d?.error) throw new Error(d?.error || `HTTP ${res.status}`);
  return d as NhanVienOption[];
}

/**
 * Tải .xlsx. Phải fetch kèm Bearer rồi tạo blob — KHÔNG mở thẳng URL bằng thẻ <a>
 * vì route có requireAuth, trình duyệt sẽ không tự gắn token và nhận 401.
 * Tên file lấy từ Content-Disposition của server để màn hình và file luôn cùng tên.
 */
export async function taiExcel(q: AdsReportQuery): Promise<void> {
  const res = await fetch('/api/ads-report/excel?' + toParams(q).toString(), { headers: await authHeaders() });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json())?.error || msg; } catch { /* body không phải JSON */ }
    throw new Error(msg);
  }
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="([^"]+)"/i);
  const ten = m ? decodeURIComponent(m[1]) : `BaoCaoAds_${q.thang}.xlsx`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ten;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
