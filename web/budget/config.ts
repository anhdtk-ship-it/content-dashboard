/* ============================================================
 * FB-ADS-02 — Budget Allocation Analytics · CẤU HÌNH.
 * Module PHÂN TÍCH ĐỘC LẬP, CHỈ ĐỌC dữ liệu Ads Monitor. KHÔNG đụng logic/DB/API cũ.
 * ------------------------------------------------------------
 * Ngưỡng ngân sách — KHÔNG hardcode rải rác trong code; sửa DUY NHẤT tại đây.
 *   < BUDGET_THRESHOLD  → "Dưới 5 triệu"
 *   >= BUDGET_THRESHOLD → "Trên 5 triệu"  (= đúng ngưỡng cũng tính "Trên")
 * ========================================================== */
export const BUDGET_THRESHOLD = 5_000_000;
