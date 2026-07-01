# PROJECT HANDOFF — Content Operations Dashboard (Seryn) + Ads Monitor + Weekly Report

> **Handoff v3.0 · Cập nhật: 2026-07-01** (sau Phase 4→11: Ads Monitor GO-LIVE + Weekly Report + trạng thái "Không test")
> Tài liệu để một phiên Claude mới tiếp tục công việc mà KHÔNG cần đọc lịch sử chat.
> Thư mục gốc: `C:\Users\Admin\Downloads\wesd\content-dashboard`
> (Lưu ý: thư mục cha `wesd` là một project Next.js KHÁC — `haiau-seo-hub` — không liên quan tài liệu này.)
> `git` HEAD hiện tại: **`ed1c820`** (nhánh `main`, working tree sạch). Ngày trong code chạy theo giờ máy.

---

## 1. Project Overview

* **Mục tiêu:** App nội bộ vận hành nội dung cho team Seryn. Gồm **3 miền độc lập** trong cùng repo/server:
  1. **Dashboard Content** — theo dõi vòng đời test content (cấp → test → duy trì/tắt/không test), KPI chất lượng, hiệu suất theo Nhân viên Ads / Biên tập / thị trường, cảnh báo.
  2. **Ads Monitor** — theo dõi chi tiêu quảng cáo Facebook theo Page/Content, trạng thái động (Lifecycle + chi tiêu ngày mới nhất).
  3. **Weekly Report** — báo cáo tuần (Reports → Weekly Report), chỉ đọc dữ liệu Content, có xuất PDF (in trình duyệt).
* **Phạm vi:** App nội bộ, truy cập bằng **Share Link** (KHÔNG có Authentication — đã hủy, §9). Ưu tiên đọc KPI nhanh.
* **Kiến trúc tổng thể:** Google Sheets → (script sync/import, ts-node) → Supabase (Postgres) → Express API (`src/server.ts`) → Frontend React (Vite, `web/`).

---

## 2. Current Status

* **Phase hiện tại:** Đã xong **Phase 11**. Cả 3 miền chạy **dữ liệu THẬT**, đã commit + push `main` (Railway auto-deploy).
* **% hoàn thành (ước lượng — Cần xác minh theo kỳ vọng sản phẩm):** Dashboard Content ~90% · Ads Monitor ~90% (live, còn chờ xác nhận mapping nghiệp vụ) · Weekly Report ~85% (chờ persist II/III + DOCX) · Tổng thể ~88%.
* **Module đã hoàn thành:** Sync Engine + prune, API V3, UI library, Dashboard Content (Tổng Quan/Thị Trường/Content&Vòng đời), GlobalFilter; **Ads Monitor go-live** (server-side SQL, lịch sử theo ngày, Lifecycle + status, filter động, loại Khiêm); **Weekly Report** (KPI 2 nhóm, Rule Engine, print PDF); trạng thái **"Không test"** (Content + Weekly).
* **Đang làm:** không có việc dở trong working tree (đã commit hết).
* **Chưa bắt đầu / còn treo:** worker chạy `ads:import` tự động hằng ngày trên hạ tầng; persist phần II/III của Weekly Report (đang lưu cục bộ); export DOCX; xác nhận nghiệp vụ mapping Ads + định nghĩa win.

---

## 3. Current Architecture

* **Frontend:** Vite 8 + **React 19** + Tailwind v4, thư mục `web/`. Hash router trong `web/main.tsx` (1 nguồn menu/route). UI primitives `src/components/ui` + layout `src/components/layout`. **Zoom UI 1.1** (`web/styles.css #root`). `@media print` (in Weekly Report → PDF).
* **Backend:** Node + **TypeScript (CommonJS, ts-node, KHÔNG build)**, **Express 5** — `src/server.ts` (~648 dòng). Bind `0.0.0.0` + `PORT ?? 4000`. `/health`. Serve `web/dist`. SPA fallback `/{*splat}`. Đọc Supabase bằng **service_role**, cache `getContents()` TTL 10s.
* **Database:** **Supabase** (Postgres). Bảng: `contents`, `sync_logs`, `content_status_history` (rỗng), **`ads_monitor`** (snapshot ngày), **`ads_monitor_lifecycle`** (Phase 7). VIEW/FUNCTION Ads (xem §12). Migrations 001–006 **đã áp dụng**.
* **API (chỉ thêm, không đổi cũ):**
  * Content: `GET /api/config`, `/api/v3/{summary,contents,sync-status,lifecycle,content-detail,lifecycle-table}`, `/health`. `summary` trả thêm **`contentKpi`** (Phase 11: capped/khongTest/win + choChay/dangTest). `/contents` drill `alert,ageMin,ageMax,codes,endedExact,q,sort` + `editor_name`.
  * Ads: **`GET /ads-monitor`** — server-side, gọi RPC `ads_monitor_query`. Params `page,pageSize,content,adsOwner,location,pageCode,status,month|sheetDate|dateFrom/dateTo,sortField,sortDirection`. Trả `{items,summary,total,page,pageSize,totalPages,source,owners,generatedAt}`.
* **Google Sheets:** `googleapis` (Service Account `content-dashboard@content-dashboard-500413.iam.gserviceaccount.com`, read-only). Content sheet + Ads sheet — CẢ HAI đã kết nối (xem §13).
* **Deployment:** GitHub `anhdtk-ship-it/content-dashboard` → **Railway** deploy nhánh `main`. Domain `content-dashboard-production-4e96.up.railway.app`.
* **Authentication:** KHÔNG có — Share Link (§9).

---

## 4. Repository Structure
```
content-dashboard/
├── src/
│   ├── server.ts                ← Express API (Content + /ads-monitor + /health + SPA fallback)
│   ├── sync-all-content.ts · sync-scheduler.ts · backfill-dates.ts · date-util.ts · sheets-reader.ts · transform-content.ts …
│   ├── components/ui/ · components/layout/    ← UI library dùng chung
│   └── ads-monitor/             ← MODULE ADS MONITOR (backend, độc lập)
│       ├── types.ts · calculateAdsStatus.ts(latestAmount,lifecycle) · mock.ts
│       ├── AdsMonitorRepository.ts · AdsMonitorService.ts · routes.ts
│       ├── AdsMonitorSyncProvider.ts · GoogleSheetAdsSyncProvider.ts (map Raw_Data FB Ads)
│       ├── import.ts (ads:import) · verify.ts (ads:verify) · ads-scheduler.ts (ads:scheduler)
├── web/                         ← App React
│   ├── main.tsx · styles.css(zoom+@media print) · GlobalFilter.tsx · editor-name.ts
│   ├── OverviewPage · MarketsPage · AssigneesPage · ExplorerPage · LifecyclePage · UsagePage · AnalyticsPage · UsageCompare · AlertDrawer · Tabs
│   ├── ads-monitor/ (pages/AdsMonitorPage · components/{AdsSummaryCards,AdsFilters,AdsTable} · types · utils)
│   └── reports/                 ← MODULE WEEKLY REPORT (độc lập, Phase 8-11)
│       ├── types/report.ts · utils/{week,format}.ts · hooks/useWeeklyReport.ts
│       ├── services/{WeeklyReportService,ruleEngine,exporters}.ts
│       └── components/{ReportFilters,ExportBar,ReportDocument,NarrativeSections}.tsx · pages/WeeklyReportPage.tsx
├── public/index.html            ← Dashboard VANILLA (LEGACY — KHÔNG serve; đừng sửa)
├── sql/ 001..006_*.sql          ← migrations (chạy tay Supabase SQL Editor; 001–006 đã áp dụng)
├── run-ads-import.bat + ads-import.log  ← wrapper Windows chạy ads:import (gitignored, cục bộ máy)
├── .env (+ .env.example commit) · credentials/ (gitignored)
└── PROJECT_SPEC.md · CURRENT_STATE.md · PROJECT_BACKLOG.md · DESIGN_SYSTEM.md · WIREFRAMES.md · mapping-spec.md · (file này) · reviews R2–R6
```

---

## 5. Completed Work
* **Sync Engine** idempotent 8 sheet → `contents` + khử trùng stale (env `SYNC_PRUNE_STALE`, có guard). `npm run scheduler` (node-cron, chống chạy chồng).
* **Dashboard Content:** Tổng Quan (Phase 11: **thẻ KPI 5 nhóm mới** Đã cấp/Không test/Chờ chạy/Đang test/Content test win + funnel + phân bố trạng thái + "Cần xử lý" drill-down + So sánh tháng + nhúng bảng xếp hạng), Thị Trường, Content & Vòng đời (Explorer + Lifecycle), GlobalFilter chung.
* **Trạng thái "Không test" (Phase 10):** `statusGroup`→`KHONG_TEST`, thêm vào filter/màu/breakdown, loại khỏi cảnh báo "chưa test".
* **"Test quá lâu"** (`buildSummary` + drill): tính theo `test_date_real`, ngưỡng **>10 ngày** (đổi từ upload/14 ngày).
* **Ads Monitor — GO-LIVE (Phase 4→7):** đọc Sheet Ads Raw_Data → `ads_monitor` (khóa snapshot `(page_code,content,sheet_date)`, giữ lịch sử ngày); server-side pagination/filter/sort/KPI bằng SQL function; **Lifecycle NEW/TEST/MAINTAIN** (bảng riêng, monotonic, refresh khi import); trạng thái hiển thị = chi tiêu **ngày dữ liệu mới nhất** + Lifecycle; filter Nhân viên Ads **động**; **loại trừ Khiêm**; import lịch (`ads:scheduler`/Task Scheduler 09:35).
* **Weekly Report (Phase 8→11):** module `web/reports/` độc lập, Business Rule riêng (`WeeklyReportService`), KPI 2 nhóm, **Rule Engine** (Đánh giá + Hành động, độc lập theo KPI từng NV Ads), bảng theo nhân viên + dòng Tổng, bộ lọc khoảng thời gian tùy chỉnh, **xuất PDF = in trình duyệt** (`@media print`, header lặp qua `<thead>`, A4).

---

## 6. Work In Progress
* Không có code dở trong working tree — tất cả đã commit + push `main` (HEAD `ed1c820`).
* Việc vận hành còn treo (chưa code): (a) chạy `ads:import` tự động hằng ngày trên hạ tầng luôn-bật; (b) persist phần soạn II/III của Weekly Report; (c) export DOCX; (d) xác nhận nghiệp vụ (mapping Ads owner, định nghĩa win).

---

## 7. Next Priorities
**P1**
* **Scheduler import Ads hằng ngày** trên máy/hạ tầng luôn-bật (Windows Task Scheduler `run-ads-import.bat` 09:35 đã dựng cục bộ; hoặc worker Railway riêng chạy `npm run ads:scheduler`). Railway web service KHÔNG tự chạy.
* **Xác nhận nghiệp vụ mapping Ads:** `ads_owner` còn nhiễu `Br/BR/S` + hoa/thường `LIÊN` (cân nhắc join tab `Config` account_id→Ads_name); xác nhận khóa `(page_code, content, sheet_date)`.
* Khi Google Sheet Content có content trạng thái **"Không test"** → kiểm tra số lên đúng ở Dashboard + Weekly Report.

**P2**
* Persist phần II/III Weekly Report (thêm bảng `weekly_report_notes` — migration mới) để giữ chỉnh sửa qua các lần mở.
* `EXPLAIN ANALYZE ads_monitor_query(...)` ở mốc dữ liệu lớn (100k–500k) xác nhận index/`DISTINCT ON`.
* Xác nhận ngữ nghĩa "Content Test Win" (hiện = trạng thái "Duy trì") có đúng nghiệp vụ.

**P3**
* Export DOCX Weekly Report (interface đã có, chưa implement).
* Sửa lỗi parse năm 2025→2026 (`date-util.ts`) cho ~76 content.
* Module Sync/User/Settings (hiện React stub, ẩn menu); ghi `content_status_history`.

---

## 8. Known Issues / Inconsistencies
* **⚠️ Mapping Ads Raw_Data là GIẢ ĐỊNH nghiệp vụ:** Raw_Data = export FB Ads cấp ad/ngày, KHÔNG có cột content/location/ads_owner/page_code → suy ra: `content←ad_name`, `page_code←adset_name`, `ads_owner←token đầu adset_name`, `location←TQ/NN trong campaign_name`, `sheet_date←date`, `amount_spent←SUM bản sao theo (page_code,content,ngày)`. **Cần nghiệp vụ xác nhận.**
* **`ads_owner` nhiễu:** hiện có `Br`, `BR` (prefix page Branding), `S` (rác), `LIÊN` (hoa) trong danh sách filter động. Chưa lọc/chuẩn hóa (chờ quyết định — có thể join `Config`). Khiêm ĐÃ bị loại trừ hoàn toàn.
* **Trạng thái "Ads đã tắt" = chi tiêu ngày dữ liệu mới nhất (global `max(sheet_date)`) = 0.** Sheet FB bỏ qua ngày không chi tiêu → content không có dòng ngày mới nhất bị coi là "Đã tắt" (đúng ý "ngừng chi tiêu = tắt", đã xác nhận).
* **"Không test" hiện = 0** ở mọi nơi vì Google Sheet Content **chưa có** content trạng thái này. Logic sẵn sàng; khi Sheet thêm (đúng chính tả "Không test") → tự lên số. KHÔNG có ngày-đổi-trạng-thái (`content_status_history` rỗng) → "Không test theo tháng" của Weekly tính theo **upload trong kỳ** (cohort), đã chốt nghiệp vụ.
* **Weekly Report §7/§11 — cơ sở ngày khác nhau:** Đã cấp/Không test/Win = cohort upload trong kỳ; Chờ chạy/Đang test = trạng thái hiện tại all-time → KHÔNG có đẳng thức cộng trừ giữa các KPI. II/III lưu **cục bộ** (chưa persist).
* **Parse năm cố định 2026** trong `date-util.ts` → ~76 content năm 2025 lệch tháng/năm (đã biết, đừng "sửa" tùy ý).
* **`content_status_history` rỗng** → lifecycle/retention Content dùng derived từ `test_date_real`.
* **Scheduler KHÔNG tự chạy trên Railway web service** (chỉ chạy `npm start`); import/sync chỉ khi chạy tay hoặc worker riêng.
* **Dashboard vanilla `public/index.html`** không còn serve (server serve `web/dist`) — legacy, đừng sửa.
* Tài liệu cũ **`PROJECT_CONTEXT.md / TODO.md / ROADMAP.md` KHÔNG tồn tại**. Có: `PROJECT_SPEC.md` (source of truth), `CURRENT_STATE.md`, `PROJECT_BACKLOG.md`, `DESIGN_SYSTEM.md`, `WIREFRAMES.md`, `mapping-spec.md`, reviews R2–R6.
* Nhánh **`demo-v2`** = baseline trước Ads Monitor — giữ nguyên có chủ đích.

---

## 9. Important Decisions (KHÔNG tự ý đổi)
* **KHÔNG Authentication** — dùng Share Link (Sprint Auth Cancelled). Đừng tái tạo.
* **PROJECT_SPEC.md là source of truth** — mọi thay đổi schema/API/sync/dashboard/report phải cập nhật vào đó (+ CURRENT_STATE.md).
* **3 miền tách biệt Business Rule:** Dashboard Content, Ads Monitor, Weekly Report **KHÔNG dùng chung** logic. Cụ thể: Weekly Report có `WeeklyReportService`/`ruleEngine` RIÊNG, KHÔNG gọi `calculateAdsStatus`/`ads_monitor_lifecycle`/status Dashboard.
* **Ads Monitor (Phase 7) — trạng thái ĐỘNG, KHÔNG lưu cứng:**
  * `Lifecycle` = theo **tổng chi tiêu ĐỜI** (mọi ngày): `>3.000.000` MAINTAIN · `>100.000` TEST · còn lại NEW. **Monotonic** (chỉ nâng). Lưu bảng `ads_monitor_lifecycle`, refresh **chỉ khi import** (`ads_monitor_refresh_lifecycle()`).
  * Trạng thái hiển thị = `calculateAdsStatus(latestAmount, lifecycle)`: chi tiêu **ngày dữ liệu mới nhất = 0** → "Đã tắt"; >0 → NEW=Mới chạy · TEST=Đang test · MAINTAIN=Đang duy trì.
* **KPI Content bất biến (Dashboard):** Vòng đời = today − `test_date_real`; "Content được cấp" theo Ngày Up Trello (`upload_date_real`); màu trạng thái chuẩn (`tokens.ts` + DESIGN_SYSTEM §11), thêm `KHONG_TEST` = xám trung tính.
* **KPI Weekly Report (Phase 11) — 2 nhóm:** A (cohort upload trong kỳ) = Đã cấp/Không test/Content test win(="Duy trì"); B (trạng thái hiện tại all-time) = Chờ chạy (Tồn)/Đang test. Weekly group theo `assignee_name` = **Nhân viên Ads** (KHÔNG dùng `editor_name`).
* **PDF Weekly Report = IN chính báo cáo** (`window.print()` + `@media print`), KHÔNG template/HTML riêng.
* **Ràng buộc chung:** thêm migration mới (không sửa migration cũ đã áp dụng), API additive, không mock khi đã cấu hình Supabase (mock chỉ dev / `ADS_USE_MOCK=true`), không tạo màu/typography ngoài DESIGN_SYSTEM.

---

## 10. Environment (biến môi trường — file `.env`, gitignored)
| Biến | Bắt buộc | Dùng cho |
|---|---|---|
| `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | ✅ (server throw nếu thiếu) | Server + Sync + Ads |
| `SUPABASE_ANON_KEY` | ⏺ | `/api/config` |
| `GOOGLE_SHEET_ID` · `GOOGLE_CREDENTIALS_PATH` | ✅ | Sync Content |
| `ADS_SHEET_ID` (`1kqVs8dy…`) · `ADS_SHEET_TAB` (`Raw_Data`) | ✅ (cho `ads:import`) | Ads Import — **ĐÃ cấu hình** |
| `ADS_USE_MOCK` | ⏺ (dev) | Ép mock dù đã cấu hình Supabase (mặc định off) |
| `PORT` | (Railway cấp; default 4000) | Express |
| `SYNC_ENABLED` · `SYNC_CRON` (`*/15 * * * *`) · `SYNC_PRUNE_STALE` (true) | ⏺ | Scheduler Content |
| `ADS_SYNC_ENABLED` (true) · `ADS_SYNC_CRON` (`35 9 * * *`) | ⏺ | Scheduler Ads import (`ads:scheduler`) |
> `.env.example` là template (commit). `credentials/*.json` gitignored. Lưu ý dotenv CHỈ đọc `.env` (không đọc `.env.local`).

---

## 11. Deployment Status
* **GitHub:** `github.com/anhdtk-ship-it/content-dashboard`. `main` = HEAD **`ed1c820`** (Phase 11, working tree sạch). Nhánh `demo-v2` = baseline cũ.
* **Railway:** deploy tự động từ `main`. Bind `0.0.0.0`, serve `web/dist` + API. Domain `content-dashboard-production-4e96.up.railway.app`. ⚠️ Cần đặt env `ADS_SHEET_ID/ADS_SHEET_TAB` + `SUPABASE_*` trên Railway; **KHÔNG** đặt `ADS_USE_MOCK`. Scheduler/import KHÔNG tự chạy trên web service.
* **Supabase:** đang dùng (URL trong `.env`). Migrations 001–006 **đã áp dụng**. (DDL chạy tay trong SQL Editor — service_role qua PostgREST không chạy DDL.)
* **Vercel:** không dùng. **Domain khác:** không.

---

## 12. Database Status
* **`contents`** (1.469 dòng): PK id, content_code, title, market, assignee_name(=Nhân viên Ads), cgsd, editor_name(=Biên tập), trello_link, upload_date(_real), current_status, test_date(_real), created_at. UNIQUE (content_code, market, assignee_name). `current_status` gồm cả **"Không test"** (Phase 10).
* **`ads_monitor`** (~9.570 dòng thô, lịch sử theo ngày): content/location/ads_owner/page_code/amount_spent/updated_at/created_at/**sheet_date NOT NULL**. **KHÔNG có cột status**. UNIQUE `(page_code, content, sheet_date)`. Index: daily_key, sheet_date, ads_owner.
* **`ads_monitor_lifecycle`** (902 dòng — 1/content): page_code, content, lifecycle(NEW/TEST/MAINTAIN), lifetime_spent, updated_at. PK (page_code, content).
* **`sync_logs`** (5) · **`content_status_history`** (0 — rỗng).
* **Function/View Ads:** `ads_monitor_query(...)` (plpgsql, filter+sort+paginate+KPI+owners, loại trừ Khiêm, trạng thái = latest-day + lifecycle) · `ads_monitor_refresh_lifecycle()` (refresh monotonic). *(VIEW `ads_monitor_lifetime` định nghĩa ở sql/006 nhưng app dùng function, không dùng view — Cần xác minh view đã tạo trên DB hay chưa.)*
* **Migration:** `sql/001..004` (Content) + `sql/005` (ads_monitor + query + index) + `sql/006` (lifecycle + refresh + query lifecycle-based + backfill) — **tất cả đã áp dụng**.

---

## 13. Google Sheets Status
* **Content (đang kết nối):** spreadsheet `1G2ZY21nszf-F1Q6bIMunymOaHysecj-S2iAelqnQNdc`, dùng 8 tab `NĐ/QT × Hiếu/Ánh/KA/Liên` (loại Khiêm). Sync: `npm run sync` (hoặc scheduler). Mapping: `mapping-spec.md` + `transformSheet`.
* **Ads (ĐÃ kết nối — Phase 6):** spreadsheet RIÊNG `1kqVs8dyOgnk5l3CsgcGlhex-eI7OHhAkS6GLKnXh4j0`, tab **`Raw_Data`** (export FB Ads cấp ad/ngày). Đã share cho Service Account. Import: `npm run ads:import` → upsert theo `(page_code,content,sheet_date)` (giữ lịch sử) → tự `refresh_lifecycle`. Verify: `npm run ads:verify`.
* **Mapping Ads:** xem §8 (giả định, cần xác nhận). Các tab khác của workbook: Config (account→Ads_name), Seryn Page (Mã page/Địa lý), Data_M+TT, Logs…
* **Còn thiếu:** chuẩn hóa `ads_owner`; tự động hóa import hằng ngày trên hạ tầng.

---

## 14. Session Summary (phiên gần nhất — rất dài, Phase 5→11)
* **Phase 5 (Ads Perf):** server-side pagination/filter/sort/KPI bằng SQL; bỏ `findAll()`; khóa snapshot ngày (giữ lịch sử).
* **Phase 6 (Go-live):** chạy `sql/005` trên Supabase; cấu hình + import thật (9423 dòng); bỏ fallback-mock âm thầm; sửa provider map đúng schema Raw_Data (FB Ads); ban đầu chi tiêu/NGÀY.
* **Chỉnh Ads:** đổi `amount_spent` sang **tích lũy/đời**; fix trạng thái theo **ngày dữ liệu mới nhất** (không phải ngày cuối riêng content); filter Nhân viên Ads **động**; **loại trừ Khiêm**.
* **Phase 7:** mô hình **Lifecycle + Current Status** (bảng `ads_monitor_lifecycle`, `refresh` monotonic, `calculateAdsStatus(latestAmount, lifecycle)`); scheduler `ads:scheduler` (09:35).
* **Content Dashboard:** "test quá lâu" theo test_date >10 ngày; fix tooltip "i" (màu cố định).
* **Phase 8–9 (Weekly Report):** module `web/reports/` độc lập; lọc khoảng thời gian tùy chỉnh (bỏ Địa lý); Section II Rule Engine độc lập; **PDF = in trình duyệt** (`@media print`, header lặp qua `<thead>`, A4); Section I "theo nhân viên" dạng **bảng + dòng Tổng**.
* **Phase 10:** trạng thái **"Không test"** (Content Dashboard additive + Weekly Report KPI + Tồn mới).
* **Phase 11:** bộ KPI Content **2 nhóm** (A phát sinh trong tháng / B trạng thái hiện tại all-time); Overview đổi sang 5 thẻ KPI mới (`summary.contentKpi`).
* Mọi thay đổi đã commit + push `main`. Ads Monitor giữ nguyên qua Phase 8–11 (verified `source: supabase`).

---

## 15. Next Session Instructions (cho Claude mới)
1. **Đọc trước:** file này → `PROJECT_SPEC.md` → `CURRENT_STATE.md` → `DESIGN_SYSTEM.md`. Source chính: `src/server.ts`, `web/main.tsx`, `web/OverviewPage.tsx`, `src/components/ui/tokens.ts`, toàn bộ `src/ads-monitor/` + `web/ads-monitor/` + `web/reports/`. SQL: `sql/005` + `sql/006`.
2. **cwd:** luôn `cd /c/Users/Admin/Downloads/wesd/content-dashboard` (Bash hay nhảy về `wesd` — project Next.js khác).
3. **Chạy:** `npm run dashboard` (Express :4000, serve web/dist + API) · `npm run dev` (Vite :5173, proxy `/api`+`/ads-monitor`→:4000) · `npm run build` · `npm run typecheck` (chỉ check `src/`; `web/` do vite build kiểm). Sync/Ads: `npm run sync|scheduler|ads:import|ads:verify|ads:scheduler`. **Sửa `server.ts`/`src/ads-monitor` phải RESTART Express** (ts-node không reload).
4. **Git/Deploy:** làm trên `main`; commit + `git push origin main` → Railway tự deploy. Working tree hiện sạch. Trước khi commit: `git diff --cached --name-only | grep -iE "\.env$|credentials"` để chắc KHÔNG lộ secret.
5. **DDL Supabase:** service_role qua PostgREST KHÔNG chạy được DDL → migration mới phải chạy TAY trong SQL Editor (`https://supabase.com/dashboard/project/<ref>/sql/new`, Ctrl+A rồi dán, tránh chạy thiếu). Có thể copy file vào clipboard qua PowerShell `Get-Content -Raw file | Set-Clipboard`.
6. **Verify:** `preview_start` (dashboard) rồi `preview_eval` (DOM) — screenshot hay timeout. Đối chiếu Supabase qua `curl` PostgREST (apikey=service_role) hoặc script `ts-node` tạm (đặt trong `src/` để resolve node_modules, rồi xóa). KHÔNG click "Xuất PDF" trong preview (mở hộp thoại in gây treo) — kiểm tra qua Ctrl+P thật.
7. **TUYỆT ĐỐI KHÔNG:** sửa Ads Monitor khi đang làm Content/Weekly (và ngược lại); đổi công thức Lifecycle/Status Ads; sửa `public/index.html` (legacy); tái tạo Authentication; dùng chung Business Rule giữa 3 miền.

> Nếu chỉ đọc 1 mục: đọc **§9 (Important Decisions)** + **§8 (Known Issues)** trước khi viết code.
