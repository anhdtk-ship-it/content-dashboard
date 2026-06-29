# PROJECT HANDOFF — Content Operations Dashboard (Seryn) + Ads Monitor

> **Handoff v2.1 · Cập nhật: 2026-06-29** (Phase 5 — Performance & Architecture cho Ads Monitor)
> Tài liệu để một phiên Claude mới tiếp tục công việc mà KHÔNG cần đọc lịch sử chat.
> Thư mục gốc: `C:\Users\Admin\Downloads\wesd\content-dashboard`
> (Lưu ý: thư mục cha `wesd` là một project Next.js KHÁC — `haiau-seo-hub` — không liên quan tài liệu này.)
> Ngày trong code (`today`) chạy theo giờ máy ≈ 2026-06-26; "Cập nhật" ở trên theo lịch hệ thống.

---

## 1. Project Overview

* **Mục tiêu:** Dashboard vận hành nội dung cho team Seryn — theo dõi test content quảng cáo (content → set ads → duy trì/tắt), KPI chất lượng test, vòng đời content, hiệu suất theo người/biên tập/thị trường, cảnh báo cần xử lý. Bổ sung module **Ads Monitor** (theo dõi chi tiêu quảng cáo theo Page).
* **Phạm vi:** App nội bộ, truy cập bằng **Share Link** (KHÔNG có Authentication — đã hủy, xem §9). Ưu tiên đọc KPI nhanh, ít click.
* **Kiến trúc tổng thể:** Google Sheets → (script sync, ts-node) → Supabase (Postgres) → Express API (`src/server.ts`) → Frontend React (Vite, `web/`). Hai "miền" độc lập trong cùng repo/server: **Dashboard Content** và **Ads Monitor**.

---

## 2. Current Status

* **Phase hiện tại:** Dashboard Content đã ổn định (V5). **Ads Monitor đã GO-LIVE (Phase 6)** — server-side pagination/filter/KPI bằng SQL + lịch sử theo ngày, chạy **dữ liệu THẬT từ Supabase** (886 ad, 9423 snapshot). **Chưa commit/deploy** lên `main`/Railway. ⚠️ Mapping Raw_Data là **giả định** (chi tiêu/ngày) — cần nghiệp vụ xác nhận (xem §8).
* **% hoàn thành (ước lượng):** Dashboard Content ~85% · Ads Monitor ~60% · Tổng thể ~75%. *(ước lượng, "Cần xác minh" theo kỳ vọng sản phẩm)*
* **Module đã hoàn thành:** Sync Engine + prune, Backfill, API V3, UI library, Dashboard Tổng Quan (+drill-down "Cần xử lý"), Thị Trường, Content & Vòng đời (tabs Explorer+Lifecycle), Global Filter chung, Ads Monitor UI + Data Layer (mock).
* **Đang làm:** Ads Monitor Phase 5 (nối Supabase thật) — **code trong working tree, CHƯA commit**.
* **Chưa bắt đầu:** Ads Monitor real-data end-to-end (tạo bảng + import thật + scale 100k), Reports/Alerts nâng cao, module Sync/User/Settings (React stub, ẩn menu).

---

## 3. Current Architecture

* **Frontend:** Vite 8 + **React 19** + Tailwind v4, thư mục `web/`. Hash router trong `web/main.tsx` (1 nguồn menu/route). UI primitives dùng chung ở `src/components/ui` (15) + `src/components/layout` (9). **Zoom UI 1.1** (`web/styles.css #root`).
* **Backend:** Node + **TypeScript (CommonJS, ts-node, không build)**, **Express 5** — `src/server.ts` (~630 dòng). Bind **`0.0.0.0`** + `process.env.PORT ?? 4000`. Có `/health`. Serve **`web/dist`** (React build). SPA fallback `/{*splat}` → `web/dist/index.html`. Đọc Supabase bằng **service_role**, cache `getContents()` TTL 10s.
* **Database:** **Supabase** (Postgres). Bảng: `contents`, `sync_logs`, `content_status_history`. Module Ads (sql/005, **CHƯA áp dụng**): bảng `ads_monitor` (khóa snapshot `(page_code,content,sheet_date)`) + VIEW `ads_monitor_latest` (DISTINCT ON) + FUNCTION `ads_monitor_query()` (KPI/list bằng SQL).
* **API:** `GET /api/config`, `/api/v3/{summary,contents,sync-status,lifecycle,content-detail,lifecycle-table}`, `GET /health`, **`GET /ads-monitor`** (Ads Monitor — **SERVER-SIDE**: `page,pageSize,content,adsOwner,location,pageCode,status,sheetDate|dateFrom|dateTo,sortField,sortDirection` → `{items,summary,total,page,pageSize,totalPages,source}`). Filter chung Content: `from,to,market,assignee,status,dateField`. `/api/v3/contents` có drill `alert,ageMin,ageMax,codes,endedExact,q,sort` + trả `editor_name`.
* **Google Sheets:** `googleapis` (Service Account, read-only). Content: `GOOGLE_SHEET_ID` (spreadsheet `1G2ZY…`, 16 tab, dùng 8 tab NĐ/QT×Hiếu/Ánh/KA/Liên). Ads: `ADS_SHEET_ID` (spreadsheet RIÊNG — **chưa cấu hình**).
* **Deployment:** GitHub `anhdtk-ship-it/content-dashboard` → **Railway** deploy nhánh `main`. Domain: `content-dashboard-production-4e96.up.railway.app`.
* **Authentication:** **KHÔNG có** — đã hủy, dùng Share Link (xem §9).

---

## 4. Repository Structure
```
content-dashboard/
├── src/
│   ├── server.ts                ← Express API (Content + /ads-monitor + /health + SPA fallback)
│   ├── sync-all-content.ts      ← Sync Content (upsert + KHỬ TRÙNG stale, có guard)
│   ├── sync-scheduler.ts        ← Scheduler node-cron (SYNC_ENABLED/SYNC_CRON)
│   ├── backfill-dates.ts · date-util.ts · sheets-reader.ts · ...
│   ├── components/ui/ (15) · components/layout/ (9)   ← UI library dùng chung
│   └── ads-monitor/             ← MODULE ADS MONITOR (backend, độc lập)
│       ├── types.ts · calculateAdsStatus.ts · mock.ts
│       ├── AdsMonitorRepository.ts · AdsMonitorService.ts · routes.ts
│       ├── AdsMonitorSyncProvider.ts (interface) · GoogleSheetAdsSyncProvider.ts (impl)
│       ├── import.ts (npm ads:import) · verify.ts (npm ads:verify)
├── web/                         ← App React
│   ├── main.tsx (router/menu) · styles.css (zoom 1.1) · GlobalFilter.tsx · editor-name.ts
│   ├── OverviewPage · MarketsPage · AssigneesPage · ExplorerPage · LifecyclePage
│   ├── UsagePage · AnalyticsPage · Tabs.tsx · UsageCompare.tsx · AlertDrawer.tsx
│   └── ads-monitor/ (pages/AdsMonitorPage · components/{AdsSummaryCards,AdsFilters,AdsTable} · types · utils)
├── public/index.html            ← Dashboard VANILLA (LEGACY — KHÔNG còn được serve; đừng sửa)
├── sql/ 001..005_*.sql          ← migrations (chạy tay; 005 CHƯA áp dụng)
├── .env (.env.example/.local/.production) · credentials/ (gitignored)
└── PROJECT_SPEC.md · PROJECT_BACKLOG.md · DESIGN_SYSTEM.md · (file này) · ...
```

---

## 5. Completed Work
* **Sync Engine** idempotent 8 sheet → `contents` + **khử trùng content mồ côi** (xóa stale, env `SYNC_PRUNE_STALE`, guard: bỏ qua nếu lỗi/đọc<1000/stale>ngưỡng). Đã dọn 53 content mồ côi (Supabase 1522→1469).
* **Scheduler** node-cron (`npm run scheduler`) — chống chạy chồng, không crash khi lỗi.
* **API V3** đầy đủ; thêm `editor_name` vào `/contents` (drill "Cần xử lý").
* **Dashboard Tổng Quan:** 6 KPI nghiệp vụ (tooltip công thức render qua **portal**, không bị cắt) + **"Cần xử lý" dạng cảnh báo màu, click mở Drawer drill-down** (2 filter, kế thừa filter) + **So sánh tháng này/trước** + **nhúng "Content theo trạng thái" + "Bảng xếp hạng"** (theo bộ lọc trên cùng).
* **Dashboard Thị Trường** (standalone) · **Content & Vòng đời** (tabs: Explorer + Lifecycle).
* **GlobalFilter** dùng chung 4 dashboard; chuẩn hóa "Nhân viên Ads", **tên Biên tập đầy đủ** (mapping `web/editor-name.ts`).
* **Menu V5:** Tổng Quan · Thị Trường · Content & Vòng đời · Ads Monitor (Sync/User/Settings ẩn, route giữ).
* **Env chuẩn hóa** (.env.example/.local/.production) · `0.0.0.0` + `/health` (fix Railway 502).
* **Ads Monitor Phase 1-3 (đã commit/deploy):** scaffold menu/route, UI đầy đủ (mock), Data Layer (Repository/Service/API mock + `calculateAdsStatus` + sql/005 thiết kế).

---

## 6. Work In Progress
* **Ads Monitor Phase 4 + 5 — CODE XONG nhưng CHƯA COMMIT** (working tree, chưa push, Railway chưa có):
  * Phase 4: `GoogleSheetAdsSyncProvider.ts` + `import.ts` (đọc Sheet Ads → upsert `ads_monitor`, logging, error-handling, dry-run).
  * Phase 5 (data layer): `AdsMonitorRepository` + `Service` + API + frontend fetch thật, `verify.ts`, proxy Vite, xóa frontend mock.
  * **Phase 5 (Performance & Architecture — MỚI):**
    * `sql/005`: đổi khóa → snapshot `(page_code,content,sheet_date)`, thêm VIEW `ads_monitor_latest` + FUNCTION `ads_monitor_query()` (KPI/list/filter/sort/paginate bằng SQL) + index.
    * `AdsMonitorRepository.query()` gọi RPC (bỏ `findAll()` tải toàn bộ) + fallback mock tính trong RAM.
    * `Service.getData(params)` trả 1 trang + KPI từ SQL + `total/totalPages`.
    * `routes.ts` parse query params (validate sort/pageSize), `import.ts` upsert theo khóa snapshot (giữ lịch sử), `verify.ts` phân trang qua tập latest.
    * Frontend: `AdsFilters` controlled, `AdsTable` phân trang server + sort header, `AdsMonitorPage` quản state + querystring + debounce. **Giao diện giữ nguyên.**
* **Hiện tại Ads Monitor chạy bằng MOCK** (`src/ads-monitor/mock.ts`) vì `ads_monitor` chưa tạo + `ADS_SHEET_ID` chưa cấu hình. Đã verify đường mock (pagination/filter/sort/KPI) qua Express :4099.

---

## 7. Next Priorities
**P1**
* Commit + push Phase 4/5 Ads Monitor lên `main` (Railway deploy).
* Chạy `sql/005_ads_monitor.sql` trên Supabase (tạo **bảng + VIEW `ads_monitor_latest` + FUNCTION `ads_monitor_query`** + index).
* Cấu hình `ADS_SHEET_ID` + `ADS_SHEET_TAB` + share quyền đọc cho Service Account → chạy `npm run ads:import` → `npm run ads:verify`.
* Sau khi có bảng thật: chạy `EXPLAIN ANALYZE ads_monitor_query(...)` ở mốc dữ liệu lớn để xác nhận index dùng đúng (đặc biệt `DISTINCT ON`).

**P2**
* ✅ **(ĐÃ XONG Phase 5)** Server-side pagination/filter/KPI bằng SQL; bỏ load-all-in-memory.
* Xác minh khóa định danh Ads `(page_code, content, sheet_date)` đúng thực tế nghiệp vụ (1 ad/ngày).
* Nếu cần search `content` nhanh trên bảng rất lớn: thêm extension `pg_trgm` + GIN index (chưa làm — tránh index dư thừa).
* Cân nhắc `ads_sync_logs` + scheduler import hằng ngày (worker riêng, không chạy trên web service).

**P3**
* Sửa lỗi năm parse 2025→2026 (date-util) cho ~76 content.
* Reports/Alerts nâng cao, ghi `content_status_history`, module Sync/User/Settings (React).
* Scheduler chạy như worker riêng trên hạ tầng (Railway web service KHÔNG tự chạy scheduler).

---

## 8. Known Issues / Inconsistencies
* **Ads Monitor Phase 4/5 CHƯA commit** → `main`/Railway vẫn là Phase 3 (mock). Code trong working tree.
* **Bảng `ads_monitor` CHƯA tồn tại** trong Supabase ("Could not find the table") → Repository fallback **mock**; dashboard Ads hiển thị `source: mock`.
* **Ads Sheet đã cấu hình + GO-LIVE:** `ADS_SHEET_ID=1kqVs8dyOgnk5l3CsgcGlhex-eI7OHhAkS6GLKnXh4j0`, `ADS_SHEET_TAB=Raw_Data` (đã share SA `content-dashboard@content-dashboard-500413.iam.gserviceaccount.com`). Import lần đầu 9423 dòng OK.
* **⚠️ MAPPING Raw_Data là GIẢ ĐỊNH (cần nghiệp vụ xác nhận):** Raw_Data là export FB Ads cấp ad/ngày, KHÔNG có cột content/location/ads_owner/page_code → suy ra: `content←ad_name`, `page_code←adset_name`, `ads_owner←token đầu adset_name`, `location←TQ/NN trong campaign_name`, `amount_spent←SUM bản sao theo (page_code,content,ngày)` = **chi tiêu/NGÀY**. Hệ quả: ad không chi tiêu ngày mới nhất bị tính **"Đã tắt"** (daTat=510/886). Nếu nghiệp vụ muốn status theo **chi tiêu tích lũy/đời** → đổi cách gộp ở `GoogleSheetAdsSyncProvider`. `ads_owner` chưa chuẩn hóa hoa/thường (cân nhắc join Config account_id→Ads_name).
* **Phase 6 (#4) đã đổi hành vi fallback:** Ads Monitor mock CHỈ khi chưa cấu hình Supabase hoặc `ADS_USE_MOCK=true`; đã cấu hình mà RPC lỗi → API trả 500 (không che bằng mock).
* ~~**Ads Monitor không chịu tải 100k** (load-all-in-memory + phân trang client)~~ → **ĐÃ SỬA Phase 5**: server-side pagination/filter/KPI bằng SQL (function `ads_monitor_query`). Còn lại: cần tạo bảng/function thật + `EXPLAIN ANALYZE` ở mốc lớn để chốt.
* **"Test quá lâu"** tính theo **`upload_date_real`** (Ngày Up Trello) chứ KHÔNG phải `test_date_real` — `DANG_TEST` và upload cũ hơn 14 ngày. *Cần xác minh* đây có đúng ý nghiệp vụ không.
* **Parse năm cố định 2026** trong `date-util.ts` → ~76 content năm 2025 lệch tháng/năm (đã biết, đừng "sửa" tùy ý).
* **Scheduler không tự chạy trên Railway** (web service chỉ chạy `npm start`); sync/import chỉ mới khi chạy tay/worker.
* **`content_status_history` rỗng** → lifecycle/retention dùng derived từ `test_date_real`.
* **Dashboard vanilla `public/index.html`** không còn được serve (server serve `web/dist`); là legacy, đừng sửa.
* **Filter ở phần nhúng Tổng Quan / Ads** một số chưa lọc server-side (editor lọc client; Ads filter UI-only).
* Nhánh **`demo-v2`** = baseline `b64fc50` (trước Ads Monitor) — giữ nguyên có chủ đích.
* **Tài liệu cũ** `PROJECT_CONTEXT.md / CURRENT_STATE.md / TODO.md / ROADMAP.md` **KHÔNG tồn tại** trong repo (chỉ có PROJECT_SPEC/BACKLOG/DESIGN_SYSTEM + các review R2–R6).

---

## 9. Important Decisions (không tự ý đổi)
* **KHÔNG Authentication** — dùng **Share Link**. Sprint Auth đã **Cancelled** (`PROJECT_BACKLOG.md`). Đừng tái tạo tài liệu/đề xuất Auth.
* **PROJECT_SPEC.md là source of truth** — mọi thay đổi schema/API/sync/dashboard phải cập nhật vào đó.
* **KPI bất biến:** Đã test = {Đang test, Duy trì-*, Đã test-ko chạy, Đã chạy-Tắt}; Thành công = {Duy trì-*, Đã chạy-Tắt}; Tỷ lệ thành công = Thành công ÷ Đã test. **Vòng đời = today − `test_date_real`** (Ngày Set Ads), KHÔNG dùng upload.
* **"Content được cấp" tính theo Ngày Up Trello** (`upload_date_real`).
* **status_group / màu trạng thái chuẩn** (xem `tokens.ts` + DESIGN_SYSTEM §11): Duy trì=xanh lá · Đang test=vàng · Chờ chạy=cam · Không duyệt=đỏ · Đã test-ko chạy=xám · Đã chạy-Tắt=xanh dương nhạt.
* **Ads status KHÔNG lưu cứng** — luôn tính `calculateAdsStatus(amount_spent)`: =0 Đã tắt · ≤100k Mới chạy · ≤4.999.999 Đang test · ≥5tr Đang duy trì. Badge: 🔴🟡🟠🟢.
* **Ads Monitor là module độc lập** — KHÔNG dùng service/repo/bảng của Dashboard Content.
* **Ràng buộc chung:** không đổi DB schema (thêm migration mới), không đổi công thức KPI/lifecycle/sync, API chỉ thêm additive, không mock khi đã có dữ liệu thật, không tạo màu/typography ngoài DESIGN_SYSTEM, backward-compatible.

---

## 10. Environment (biến môi trường)
| Biến | Bắt buộc | Dùng cho |
|---|---|---|
| `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | ✅ (server throw nếu thiếu) | Server + Sync + Ads |
| `SUPABASE_ANON_KEY` | ⏺ | `/api/config` (realtime) |
| `GOOGLE_SHEET_ID` · `GOOGLE_CREDENTIALS_PATH` | ✅ (cho sync Content) | Sync Content |
| `PORT` | (Railway cấp; default 4000) | Express |
| `SYNC_ENABLED` · `SYNC_CRON` (default `*/15 * * * *`) · `SYNC_PRUNE_STALE` (default true) | ⏺ | Scheduler + khử trùng |
| `ADS_SHEET_ID` · `ADS_SHEET_TAB` | ⏺ (cho import Ads) | Ads Import — **CHƯA cấu hình** |
> `.env` gitignored. `.env.example` là template (commit). `credentials/*.json` gitignored.

---

## 11. Deployment Status
* **GitHub:** `github.com/anhdtk-ship-it/content-dashboard`. Nhánh: **`main`** (`793934a`, Phase 3) · **`demo-v2`** (`b64fc50`, baseline trước Ads). *Phase 4/5 chưa push.*
* **Railway:** deploy từ `main`. Bind `0.0.0.0`, serve `web/dist` + API. Domain `content-dashboard-production-4e96.up.railway.app`. ⚠️ Scheduler/import KHÔNG tự chạy trên web service.
* **Supabase:** project đang dùng (URL trong `.env`). Bảng Content có dữ liệu (~1469 content); `ads_monitor` **chưa tạo**.
* **Vercel:** không dùng.
* **Domain khác:** không. (Service Account Google + Trello link trong dữ liệu.)

---

## 12. Database Status
* **Schema:** `contents` (PK id, content_code, title, market, assignee_name, cgsd, editor_name, trello_link, upload_date(_real), current_status, test_date(_real), created_at; UNIQUE (content_code,market,assignee_name)) · `sync_logs` · `content_status_history` (rỗng).
* **Migration:** `sql/001..004` đã áp dụng. **`sql/005_ads_monitor.sql` CHƯA áp dụng** (Phase 5: bảng `ads_monitor` — content/location/ads_owner/page_code/amount_spent/updated_at/created_at/**sheet_date NOT NULL**, **không có cột status**, **unique `(page_code,content,sheet_date)`** = snapshot ngày · **VIEW `ads_monitor_latest`** DISTINCT ON · **FUNCTION `ads_monitor_query()`** trả `{kpi,total,items}` bằng SQL).
* **Thay đổi gần đây:** xóa 53 content mồ côi (Supabase 1522→1469); sync giờ tự khử trùng stale.

---

## 13. Google Sheets Status
* **Content (đang kết nối):** spreadsheet `1G2ZY21nszf-F1Q6bIMunymOaHysecj-S2iAelqnQNdc`, 16 tab — dùng 8 tab `NĐ/QT × Hiếu/Ánh/KA/Liên` (loại trừ Khiêm + tab phụ). Sync: chạy tay `npm run sync` (hoặc scheduler nếu bật). Mapping ở `mapping-spec.md` + `transformSheet`.
* **Ads (CHƯA kết nối):** spreadsheet RIÊNG, `ADS_SHEET_ID` chưa đặt. Mapping (theo tên header): Content→content · Địa lý→location · Nhân viên Ads→ads_owner · Mã Page→page_code · Amount Spent→amount_spent · Ngày→sheet_date. status KHÔNG đọc từ Sheet.
* **Còn thiếu:** ID + tab spreadsheet Ads, share quyền đọc cho Service Account, chạy import lần đầu, xác minh khóa định danh.
* **Phase 5 — lịch sử theo ngày:** khóa import giờ là `(page_code, content, sheet_date)`; cột `Ngày` trên Sheet → `sheet_date` (rỗng → ngày chạy import). Mỗi ngày = 1 snapshot, dashboard hiển thị mới nhất qua VIEW `ads_monitor_latest`.

---

## 14. Session Summary (phiên gần nhất)
* Dashboard Content: đổi tên "Người Nhận"→"Tiến độ Test Content"/"Nhân viên Ads"; đồng bộ GlobalFilter; tên Biên tập đầy đủ; **drill-down "Cần xử lý"** (Drawer 2 filter); **So sánh tháng**; **V5**: gộp Markets standalone + Explorer/Lifecycle tabs + nhúng chart/bảng vào Tổng Quan + bỏ filter thứ 2; **fix tooltip portal**; **zoom 1.1**.
* Sync: **khử trùng stale** (xóa 53 mồ côi, fix lệch dữ liệu vs Sheet); fix Railway 502 (`0.0.0.0` + `/health` + serve `web/dist`); fix `package.json` engines.
* **Ads Monitor**: Phase 1 (scaffold) → 5 (nối Supabase + frontend→API + verify). Phase 1-3 đã commit/push; **Phase 4-5 chưa commit**.
* **Phase 5 (Performance & Architecture) — phiên này:** server-side pagination + filter + sort + KPI bằng SQL (VIEW `ads_monitor_latest` + FUNCTION `ads_monitor_query`); bỏ `findAll()` load-all; đổi khóa sang snapshot ngày `(page_code,content,sheet_date)` để **giữ lịch sử**; import idempotent theo ngày; frontend chuyển sang fetch server-side (giao diện giữ nguyên). Typecheck + vite build sạch; verify đường mock OK. **Chưa commit, chưa tạo bảng/function trên Supabase.**

---

## 15. Next Session Instructions (cho Claude mới)
1. **Đọc trước:** file này → `PROJECT_SPEC.md` → `PROJECT_BACKLOG.md` → `DESIGN_SYSTEM.md`. Source chính: `src/server.ts`, `web/main.tsx`, `web/GlobalFilter.tsx`, `src/components/ui/tokens.ts`, và toàn bộ `src/ads-monitor/` + `web/ads-monitor/`.
2. **cwd:** luôn `cd /c/Users/Admin/Downloads/wesd/content-dashboard` (Bash hay nhảy về `wesd` — project Next.js khác).
3. **Chạy:** `npm run dashboard` (Express :4000, serve web/dist + API) · `npm run dev` (Vite :5173, proxy `/api` + `/ads-monitor` → :4000) · `npm run build` (vite build) · `npm run typecheck`. Sync: `npm run sync` / `scheduler` / `ads:import` / `ads:verify`. Sau khi sửa `server.ts`/`src/ads-monitor` phải **restart Express** (ts-node không reload).
4. **Git/Deploy:** làm trên `main`; commit + `git push origin main` → Railway tự deploy. **`git status` đang có Phase 4/5 chưa commit** — quyết định commit trước khi làm việc mới. Repo dùng `git config` local (user.email phamcao62@gmail.com).
5. **Verify:** screenshot tool hay timeout → dùng `preview_eval` (DOM) hoặc test trên bản build qua Express :4000 (`/#/...`). Đối chiếu Supabase bằng script `ts-node` tạm rồi xóa.
6. **TUYỆT ĐỐI KHÔNG:** đổi KPI/lifecycle/sync formula, đổi DB schema (thêm migration mới), sửa `public/index.html` (legacy), tái tạo Authentication, dùng service/repo Content cho Ads. Ads Monitor giữ độc lập.
7. **Việc tiếp theo gợi ý:** xem §7 (P1: commit Phase 4/5 + tạo `ads_monitor` + cấu hình Ads Sheet; P2: scale 100k server-side).

> Nếu chỉ đọc 1 mục: đọc **§9 (Important Decisions)** + **§8 (Known Issues)** trước khi viết code.
