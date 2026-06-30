# CURRENT_STATE — Content Operations Dashboard (Seryn) + Ads Monitor

> Ảnh chụp trạng thái mới nhất. Chi tiết đầy đủ: `PROJECT_HANDOFF.md`. Source of truth: `PROJECT_SPEC.md`.
> Cập nhật: 2026-06-29 — **Phase 7 (Lifecycle + Current Status)** cho Ads Monitor.

## Phase 7 — Lifecycle + Current Status (thuật toán trạng thái mới)
- Trạng thái KHÔNG còn chỉ dựa amount. **Đã tắt** = chi tiêu **NGÀY DỮ LIỆU MỚI NHẤT (global)** = 0; ngược lại theo **Lifecycle** (NEW→Mới chạy · TEST→Đang test · MAINTAIN→Đang duy trì).
- **FIX (quan trọng):** `latest_amount` lấy theo `max(sheet_date)` TOÀN HỆ THỐNG, không phải ngày-cuối-riêng-content. Sheet bỏ qua ngày không chi tiêu → content ngừng chạy không có dòng ngày mới nhất → 0 → Đã tắt. *(Trước fix: lấy nhầm ngày cuối riêng → ad ngừng vài ngày vẫn báo còn chạy.)* Verified: ngày 06-29 có 63 content chi tiêu >0 = đúng 63 "còn chạy"; 832 Đã tắt.
- **Lifecycle** (NEW/TEST/MAINTAIN) theo **tổng chi tiêu ĐỜI** (>3tr MAINTAIN · >100k TEST · còn lại NEW), **monotonic**, lưu bảng `ads_monitor_lifecycle`, refresh **chỉ khi import** (`ads_monitor_refresh_lifecycle()`), dashboard chỉ đọc.
- **Migration `sql/006`** (bảng + 2 function + backfill) — ⏳ **chờ chạy trên Supabase** rồi mới deploy code (code mới đọc `latest_amount`/`lifecycle`).
- File sửa: `sql/006` (mới), `calculateAdsStatus.ts` (chữ ký mới), `types.ts`, `AdsMonitorRepository.ts` (normalizeRow+mock), `AdsMonitorService.ts`, `import.ts` (gọi refresh), `verify.ts`. **Frontend KHÔNG đổi** (lifecycle ẩn; build hash không đổi).
- Đã verify logic TS (mock) + dữ liệu thật (verify PASS, 4 ví dụ khớp) + production đồng bộ.

## Ads Import Scheduler (mới)
- `npm run ads:scheduler` (`src/ads-monitor/ads-scheduler.ts`) — node-cron, spawn `npm run ads:import` theo lịch. Độc lập scheduler Content.
- Env: `ADS_SYNC_ENABLED` (default true), `ADS_SYNC_CRON` (default `35 9 * * *` = 09:35, sau khi Sheet cập nhật **09:20**). Chống chạy chồng, không crash, validate cron.
- ⚠️ Cần chạy trên **worker/máy luôn bật** (Railway web service KHÔNG tự chạy scheduler).
- **Triển khai thực tế (máy Windows này):** Task Scheduler `AdsMonitorDailyImport` chạy `run-ads-import.bat` → `npm run ads:import` lúc **09:35 hằng ngày** (log: `ads-import.log`). Đổi giờ: `schtasks /Change /TN AdsMonitorDailyImport /ST hh:mm` (nếu hỏi mật khẩu thì dùng `schtasks /Create /F …`).

## Phase 6 (Go Live) — ✅ LIVE PRODUCTION với dữ liệu thật, tích lũy (2026-06-29)
- ✅ Migration `005` đã chạy (bảng + FUNCTION `ads_monitor_query` tích lũy). `.env` + Railway env có `ADS_SHEET_ID=1kqVs8dyOgnk5l3CsgcGlhex-eI7OHhAkS6GLKnXh4j0`, `ADS_SHEET_TAB=Raw_Data`; SA đã share.
- ✅ Import lần đầu: **Read 9423 / Insert 9423 / 0 lỗi**. ads_monitor có **9423 dòng thô** (lịch sử `2026-03-23` → `2026-06-28`); gộp đời = **886 ad**.
- ✅ Code Phase 4/5/6 commit + push `main` (`5207afe`); **Railway production LIVE** (`content-dashboard-production-4e96.up.railway.app`): `/health` 200, `/ads-monitor` `source: supabase`.
- ✅ **amount_spent = TÍCH LŨY/ĐỜI** = `SUM` theo `(page_code, content)` qua mọi ngày (function GROUP BY). Verify PASS: total 886 · totalAmount **9.122.961.003** · duyTri **310** · test 563 · moiChay 5 · daTat **8**.
- ✅ Bỏ fallback-mock âm thầm: mock CHỈ khi chưa cấu hình Supabase hoặc `ADS_USE_MOCK=true`.

### Bộ lọc Tháng (mới) — server-side, mặc định tháng hiện tại
- UI thêm field "📅 Tháng" (input month, MM/YYYY); API nhận `month=YYYY-MM` → route đổi thành range `sheet_date` (đầu→cuối tháng), KHÔNG đổi SQL/DDL. KPI + bảng + filter khác đều theo tháng đang chọn. Verified: 2026-06 → 391 ad/3.01B; tháng rỗng → 0; không month → 886/9.12B (đời).
- ⚠️ Thay đổi này (route + frontend) **chưa commit/push** (kèm CURRENT_STATE/PROJECT_SPEC). Cần commit để Railway deploy.

### ⚠️ Còn lại / cần lưu ý
- **VIEW chưa khớp migration:** trên DB vẫn còn `ads_monitor_latest` (cũ), chưa tạo `ads_monitor_lifetime`. KHÔNG ảnh hưởng dashboard (app dùng FUNCTION, không dùng view). Chạy lại phần "VIEW" trong `sql/005` để khớp (tùy chọn).
- **Mapping Raw_Data là GIẢ ĐỊNH:** `content←ad_name · page_code←adset_name · ads_owner←token đầu adset_name · location←TQ/NN từ campaign_name · sheet_date←date`. `ads_owner` chưa chuẩn hóa hoa/thường ("LIÊN" vs "Khiêm") → cân nhắc join Config (account_id→Ads_name).
- Lịch import hằng ngày (worker riêng) + `EXPLAIN ANALYZE` ở mốc lớn — chưa làm.

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
