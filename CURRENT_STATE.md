# CURRENT_STATE — Content Operations Dashboard (Seryn) + Ads Monitor

> Ảnh chụp trạng thái mới nhất. Chi tiết đầy đủ: `PROJECT_HANDOFF.md`. Source of truth: `PROJECT_SPEC.md`.
> Cập nhật: 2026-07-01 — **Phase 12 (Auto-Sync Content qua Webhook)**.

## Phase 12 — Auto-Sync Dashboard Content (Webhook + Debounce)
- **Mục tiêu:** Content không cần Sync tay. Google Sheet đổi → Apps Script bắn webhook → Debounce Queue → ContentSyncService → Supabase → Dashboard (poll 30s) + Weekly Report.
- **File mới:** `src/content-sync/ContentSyncService.ts` (nguồn logic sync DUY NHẤT: đọc Sheet → validate → **so sánh signature, CHỈ upsert bản ghi đổi** → prune guarded → log), `src/content-sync/SyncQueue.ts` (debounce 60s + Max-Wait 5m + mutex chống chạy chồng), `src/content-sync/routes.ts` (`POST /api/content-sync` webhook + `GET /api/content-sync/status`), `sql/007_sync_logs_source.sql`.
- **File sửa:** `src/server.ts` (mount router trước SPA fallback + `invalidateContentsCache()` sau sync), `src/sync-all-content.ts` (thành CLI wrapper mỏng gọi service — DRY, scheduler P4 vẫn chạy), `.env.example` (+`CONTENT_SYNC_SECRET/_DEBOUNCE_MS/_MAX_WAIT_MS`).
- **Bảo mật:** webhook bắt buộc `CONTENT_SYNC_SECRET` (header `x-content-sync-secret`); chưa cấu hình → 503; sai → 401.
- **Hiệu năng:** chỉ ghi bản ghi thay đổi (diff signature), upsert 1-câu-lệnh (atomic) khi tập nhỏ; guard prune giữ nguyên; thiết kế chịu được ~50k dòng.
- **Migration 007 (mở rộng `sync_logs`: source/rows_unchanged/rows_pruned/duration_ms) — CẦN chạy tay Supabase.** Chưa chạy thì service tự fallback payload tối thiểu (vẫn hoạt động, chỉ thiếu cột mới).
- ✅ **Ads Monitor / Ads Sync / Ads Scheduler / Lifecycle Ads KHÔNG đụng.** Weekly Report giữ nguyên Business Rule/KPI (chỉ hưởng lợi dữ liệu mới trong Supabase).
- ⚠️ **Triển khai vận hành còn cần:** đặt `CONTENT_SYNC_SECRET` trên Railway; gắn Apps Script trigger (đề xuất trong `PHASE_12_AUTO_SYNC.md`); áp migration 007.

## 2026-07-01 — Sửa Tỷ lệ test thành công + sync DB
- **Sync**: chạy `npm run sync` (DB cũ 5 ngày). Kết quả: +11 mới, −34 mồ côi, 1435 updated → DB = **1446 dòng** khớp Google Sheet. "Không test" lần đầu lên **11** (trước = 0).
- **Công thức Tỷ lệ test thành công (CHỐT)**: Thành công = **CHỈ Duy trì** (Chưa vít + Đã vít) — bỏ 'Đã chạy-Tắt'. Mẫu = **Đã có kết quả cuối** = Duy trì + Đã test-ko chạy + Đã chạy-Tắt (**loại 'Đang test'**). Sửa: `src/server.ts metrics()` (S_SUCCESS + S_FINALIZED), `web/AssigneesPage.tsx` (per-NV + overall), `web/MarketsPage.tsx` + tooltip. `kpi.testSuccessRate` (buildSummary) vốn đã đúng, giữ nguyên.
- ✅ Ads Monitor & Weekly Report KHÔNG đổi.

## Phase 11 — 2 nhóm KPI (Weekly Report Content)
- **A. Phát sinh trong tháng** (cohort theo upload trong kỳ): **Đã cấp** (upload trong kỳ, KHÔNG cumulative) · **Không test** (upload trong kỳ & 'Không test') · **Content test win** (upload trong kỳ & 'Duy trì').
- **B. Trạng thái hiện tại** (ALL, không giới hạn tháng): **Chờ chạy (Tồn)** · **Đang test** — backlog thực tế theo `current_status`.
- Weekly Report: bộ KPI mới (5 team overview / 6 cột bảng); **bỏ** Đã test/Tồn-cũ/Tỷ lệ test/Tỷ lệ win. Rule Engine đổi nhận xét theo KPI mới (Chờ chạy cao / Đang test cao / Không test cao / win). `WeeklyReportService` fetch TOÀN BỘ content (no date filter).
- Verified: kỳ 01–30/06 → cấp 297; kỳ 01–07/06 → cấp 87 (theo tháng) nhưng Chờ chạy 31 / Đang test 39 **giữ nguyên** (all-time) ✓.
- **Overview (Tổng Quan) đã đổi thẻ KPI** sang đúng bộ 5 (Đã cấp · Không test · Chờ chạy (Tồn) · Đang test · Content test win) — server trả `summary.contentKpi` (A trên F cohort, B trên base all-time); bỏ các thẻ tỷ lệ cũ. Verified: June capped 297 vs week1 87 (theo tháng); Chờ chạy 31/Đang test 39 giữ nguyên (all-time).
- ✅ Ads Monitor KHÔNG đổi (server.ts chỉ thêm `contentKpi` ở buildSummary Content; route/ads-monitor + status/lifecycle nguyên vẹn — verified source=supabase).

## Phase 10 — Trạng thái "Không test" (Content Dashboard + Weekly Report)
- **Content Dashboard (additive):** nhận diện `current_status = 'Không test'` → group `KHONG_TEST` (`server.ts` statusGroup/metrics/byStatus); thêm vào **bộ lọc trạng thái** (GlobalFilter), **màu** (tokens: statusStyle/groupStyle/STATUS_GROUPS + OverviewPage chart), loại khỏi cảnh báo "chưa test". KHÔNG đổi công thức KPI/giao diện hiện có.
- **Weekly Report (§4+§7):** thêm KPI **Không test** (team overview + cột bảng); **Tồn** = upload ≤ cuối kỳ & chưa test đến cuối kỳ & ≠ Không test; **§7 as-of cuối kỳ**: Đã cấp cumulative (upload ≤ cuối kỳ), Đã test theo test-date trong kỳ → content upload tháng trước/test tháng sau tính đúng. Rule Engine thêm nhận xét "Không test cao". Verified: kỳ 01–15/06 → cấp 1.304 (cumulative) · test 157 · không test 0 · tồn 367.
- ⚠️ "Không test" hiện = 0 vì Google Sheet **chưa có** content trạng thái này; khi Sheet thêm → tự lên số. Không có ngày-đổi-trạng-thái → Không test tính **cumulative**.
- ✅ **Ads Monitor KHÔNG đổi** (không file Ads nào sửa; API/status/lifecycle nguyên vẹn — verified).

## Phase 8 — Weekly Report (module mới, BUSINESS RULE RIÊNG)
- Menu **Reports → Weekly Report** (`web/reports/` — types/services/components/pages/**hooks**/**utils**, `#/weekly-report`). KHÔNG đụng Content/Ads/Sync/DB/API.
- **Service riêng** `WeeklyReportService` (`calculateWeeklyKPIs`/`calculateWeeklyEmployeeReport`) — KHÔNG dùng `calculateAdsStatus`/Lifecycle/metrics Dashboard. Đọc **dữ liệu thô** `/api/v3/contents` (phân trang) + tự tính.
- KPI (§6): Đã cấp · Đã test (`test_date_real != null`) · Tồn (`cấp−test`) · Tỷ lệ test (1 chữ số TP) · Content test win (đạt "Duy trì") · Tỷ lệ win. ⚠️ "win = Duy trì" tính bằng rule riêng trên dữ liệu Content (KHÔNG dùng ads_monitor_lifecycle — grain khác) — **cần nghiệp vụ xác nhận**.
- Bộ lọc **Khoảng thời gian tùy chỉnh** (Từ/Đến theo ngày, mặc định tuần hiện tại) — **đã bỏ Địa lý**. Group theo `assignee_name` = Nhân viên Ads (không dùng Biên tập).
- **Bố cục print-friendly (`ReportDocument`)**: I (text KPI) · II "Đánh giá" (Đánh giá ≤2 + Hành động tuần tới ≤2, Rule Engine độc lập theo KPI từng người, không so sánh) · III "Kế hoạch tuần tới" (checklist ☐). Nhập tay (cục bộ, chưa persist).
- **Xuất PDF (Phase 9) = `window.print()` in chính `#report-doc`** — không template riêng; `@media print` trong `web/styles.css`: A4 portrait, ẩn chrome (aside/header/.no-print), header lặp mỗi trang, footer số trang, `.emp-block` không cắt giữa trang. Copy chạy; DOCX để dành. *(Pagination cuối cùng nên kiểm bằng Ctrl+P trên trình duyệt.)*
- Verified preview tuần 01–07/06: cấp 87 · test 65 · tồn 22 · tỷ lệ test 74.7% · win 9 · tỷ lệ win 13.8%.

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
