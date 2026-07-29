/* ============================================================
 * FB-ADS-02 — ĐỌC dữ liệu từ API Ads Monitor HIỆN CÓ (/ads-monitor).
 * KHÔNG tạo API mới, KHÔNG bảng mới, KHÔNG duplicate dữ liệu. Chỉ đọc.
 * ========================================================== */

/** 1 bản ghi Ads (đã gộp theo content trong THÁNG) từ API /ads-monitor. */
export interface AdsRow {
  id: number;
  content: string;
  location: string;      // 'TQ' (Nội Địa) | 'NN' (Quốc Tế)
  ads_owner: string;
  page_code: string;
  amount_spent: number;  // tổng chi tiêu trong THÁNG đang xem
  status: string;        // Đã tắt | Mới chạy | Đang test | Đang duy trì
  sheet_date?: string | null;
}

/** Tháng hiện tại 'YYYY-MM'. */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Lấy TOÀN BỘ bản ghi Ads của 1 tháng (lặp trang vì API phân trang tối đa 200). Cả 2 thị trường. */
export async function fetchAdsForMonth(month: string): Promise<AdsRow[]> {
  const out: AdsRow[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const p = new URLSearchParams({ month, page: String(page), pageSize: '200' });
    const res = await fetch('/ads-monitor?' + p.toString());
    const d = await res.json();
    if (!res.ok || d?.error) throw new Error(d?.error || `HTTP ${res.status}`);
    for (const x of (d.items ?? []) as any[]) {
      out.push({
        id: x.id, content: x.content ?? '', location: x.location ?? '',
        ads_owner: x.ads_owner ?? '', page_code: x.page_code ?? '',
        amount_spent: Number(x.amount_spent) || 0, status: x.status ?? '',
        sheet_date: x.sheet_date ?? null,
      });
    }
    totalPages = d.totalPages ?? 1;
    page++;
  } while (page <= totalPages);
  return out;
}
