# CURRENT_STATE — Content Operations Dashboard (Seryn) + Ads Monitor

> Ảnh chụp trạng thái mới nhất. Chi tiết đầy đủ: `PROJECT_HANDOFF.md`. Source of truth: `PROJECT_SPEC.md`.
> Cập nhật: 2026-06-29 — sau **Phase 5** + bắt đầu **Phase 6 (Go Live)** của Ads Monitor.

## Phase 6 (Go Live) — ✅ LIVE với dữ liệu thật (2026-06-29)
- ✅ Migration `005` đã chạy trên Supabase (bảng + VIEW `ads_monitor_latest` + FUNCTION `ads_monitor_query`).
- ✅ `.env`: `ADS_SHEET_ID=1kqVs8dyOgnk5l3CsgcGlhex-eI7OHhAkS6GLKnXh4j0`, `ADS_SHEET_TAB=Raw_Data`; SA đã được share.
- ✅ Import lần đầu: **Read 9423 / Insert 9423 / 0 lỗi**. ads_monitor có **9423 dòng thô** (lịch sử `2026-03-23` → `2026-06-28`), VIEW latest = **886 ad**.
- ✅ Dashboard chạy `source: supabase` (KHÔNG mock). Verify PASS (KPI SQL = tính lại). total 886 · totalAmount 209.534.542 · duyTri 2 · test 337 · moiChay 37 · daTat 510.
- ✅ Bỏ fallback-mock âm thầm: mock CHỈ khi chưa cấu hình Supabase hoặc `ADS_USE_MOCK=true`.

### ⚠️ Mapping Raw_Data (FB Ads cấp ad/ngày) — GIẢ ĐỊNH, cần nghiệp vụ xác nhận
`content←ad_name · page_code←adset_name · ads_owner←token đầu adset_name · location←TQ/NN trong campaign_name · sheet_date←date · amount_spent←SUM bản sao theo (page_code,content,ngày)`.
- **CẢNH BÁO ngữ nghĩa:** `amount_spent` là **chi tiêu/NGÀY** (không tích lũy). VIEW latest lấy ngày mới nhất → ad không chi tiêu ngày cuối (`2026-06-28`) bị tính **"Đã tắt"** (=0). Đó là lý do daTat=510/886. Nếu nghiệp vụ muốn trạng thái theo **chi tiêu tích lũy/đời** thì phải đổi cách gộp (chưa làm — chờ xác nhận).
- `ads_owner` chưa chuẩn hóa hoa/thường ("LIÊN" vs "Khiêm"). Cân nhắc join Config (account_id→Ads_name) để chuẩn hơn.

## Tổng quan nhanh
- **Dashboard Content:** ổn định (V5). KHÔNG đụng tới trong phiên này.
- **Ads Monitor:** đã tối ưu kiến trúc chịu tải 100k–500k+ (server-side). Code xong, **chưa commit**, **chưa tạo bảng/function trên Supabase**, đang chạy **fallback mock**.

## Ads Monitor sau Phase 5
| Hạng mục | Trạng thái |
|---|---|
| Server-side pagination (`page/pageSize`) | ✅ Repository chỉ trả đúng số dòng 1 trang (qua SQL function) |
| Server-side filter (content/adsOwner/location/pageCode/status/ngày) | ✅ Toàn bộ ở SQL; React/JS không lọc |
| KPI bằng SQL (`COUNT/SUM/FILTER`) | ✅ Function `ads_monitor_query` trả `kpi` |
| Index | ✅ `(page_code,content,sheet_date)` unique, `(sheet_date)`, `(ads_owner)` |
| Lưu lịch sử theo ngày | ✅ Khóa snapshot `(page_code,content,sheet_date)` + VIEW `ads_monitor_latest` |
| Giao diện | ✅ Giữ nguyên (chỉ rewire data flow) |
| Typecheck / Vite build | ✅ Sạch |
| Verify đường mock (paginate/filter/sort/KPI) | ✅ qua Express :4099 |

## Việc cần làm tiếp (P1)
1. `git add` Phase 4/5 + commit + push `main` → Railway deploy.
2. Chạy `sql/005_ads_monitor.sql` trên Supabase (bảng + VIEW + FUNCTION + index).
3. Cấu hình `ADS_SHEET_ID` + `ADS_SHEET_TAB` + share Service Account → `npm run ads:import` → `npm run ads:verify`.
4. `EXPLAIN ANALYZE ads_monitor_query(...)` ở mốc dữ liệu lớn để xác nhận index/`DISTINCT ON`.

## Ràng buộc còn hiệu lực
- Ads Monitor ĐỘC LẬP với Content (không dùng chung service/repo/bảng).
- `status` KHÔNG lưu — luôn tính từ `amount_spent`.
- KHÔNG đụng Dashboard Content / Lifecycle / Sync Content / UI.
