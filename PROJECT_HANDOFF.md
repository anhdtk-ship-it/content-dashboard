# PROJECT HANDOFF — Content Operations Dashboard (Seryn) + Ads Monitor + Weekly Report + Zalo + Budget Analytics

> **Handoff v4.0 · Cập nhật: 2026-07-31** (sau Phase 12→13 + Auth + Zalo + Budget Analytics — kể từ v3.0 @ `ed1c820`)
> Tài liệu để một phiên Claude mới tiếp tục công việc mà KHÔNG cần đọc lịch sử chat.
> Thư mục gốc: `C:\Users\Admin\Downloads\wesd\content-dashboard`
> (Lưu ý: thư mục cha `wesd` là một project Next.js KHÁC — `haiau-seo-hub` — không liên quan tài liệu này.)
> `git` HEAD hiện tại: **`7852d1a`** (nhánh `main`, working tree sạch). Ngày trong code chạy theo giờ máy.

---

## 1. Project Overview

* **Mục tiêu:** App nội bộ vận hành nội dung cho team Seryn. Gồm **5 miền độc lập** trong cùng repo/server:
  1. **Dashboard Content (Facebook)** — theo dõi vòng đời test content (cấp → test → duy trì/tắt/không test), KPI chất lượng, hiệu suất theo Nhân viên Ads / Biên tập / thị trường, cảnh báo.
  2. **Ads Monitor** — theo dõi chi tiêu quảng cáo Facebook theo Page/Content, trạng thái động (Lifecycle + chi tiêu ngày mới nhất).
  3. **Weekly Report** — báo cáo tuần cho cả Facebook và Zalo, xuất PDF (reportlab chuẩn cho Zalo; in trình duyệt cho Facebook).
  4. **Zalo (đa nền tảng, Phase 13)** — dashboard/API/sync/webhook/weekly/PDF riêng cho content Zalo, kiến trúc `platform_*` chung để mở rộng nền tảng mới (TikTok…) chỉ bằng cách thêm 1 platform.
  5. **Budget Allocation Analytics (FB-ADS-02)** — module phân tích ngân sách/nhân viên độc lập, chỉ ĐỌC dữ liệu Ads Monitor (không ghi, không sync riêng).
* **Phạm vi:** App nội bộ, **Authentication ĐÃ BẬT** kể từ `105f1a5` (Supabase Auth Google, chỉ email `@seryn.vn`) — mô hình Share Link cũ đã bị **đảo ngược**, xem §9.
* **Kiến trúc tổng thể:** Google Sheets (Content/Ads/Zalo — 3 spreadsheet riêng) → (sync engine + webhook, ts-node) → Supabase (Postgres) → Express API (`src/server.ts`, có `requireAuth`) → Frontend React (Vite, `web/`, bọc `AuthGate`).

---

## 2. Current Status

* **Phase hiện tại:** Đã xong **Phase 13** (kiến trúc đa nền tảng + Zalo) + Auth + Budget Analytics. Tất cả 5 miền chạy **dữ liệu THẬT**, đã commit + push `main` (Railway auto-deploy).
* **Module đã hoàn thành kể từ v3.0:**
  * **Phase 12** — Auto-Sync Content qua webhook + debounce (không cần bấm Sync tay).
  * **GoogleAuthFactory** — sync chạy được trên Railway (không cần file credentials, đọc `GOOGLE_CREDENTIALS_JSON`).
  * **Authentication + Authorization** — Supabase Auth Google, domain `@seryn.vn`, bảng `users` + `is_active` + `role` (role lưu, CHƯA phân quyền).
  * **Weekly Report** — 2 nhóm KPI (Phase 11), trạng thái "Không test" (Phase 10), đổi nhãn "Content duy trì", đánh giá cá nhân theo tỷ lệ, kế hoạch cả team, báo cáo theo market + PDF chuyên nghiệp (reportlab.platypus, standalone).
  * **Phase 13 — Zalo:** dashboard/API/sync/webhook/weekly/PDF riêng, additive, KHÔNG đụng Facebook.
  * **Budget Allocation Analytics (FB-ADS-02):** module mới, phân tích ngân sách + content theo nhân viên (biểu đồ cột nhóm Nội Địa/Quốc Tế), chỉ đọc Ads Monitor.
* **Đang làm:** không có việc dở trong working tree (đã commit hết, HEAD `7852d1a`).
* **Chưa bắt đầu / còn treo:** phân quyền theo `role` (Admin/Viewer) — cột đã có, logic chưa code; worker chạy `ads:import` tự động hằng ngày trên hạ tầng luôn-bật (hiện chạy Windows Task Scheduler cục bộ); persist phần II/III Weekly Report; export DOCX.

---

## 3. Current Architecture

* **Frontend:** Vite 8 + **React 19** + Tailwind v4, thư mục `web/`. Hash router trong `web/main.tsx`, **bọc trong `AuthGate`** + `installAuthFetch()` (tự gắn `Authorization: Bearer <JWT>` cho mọi request `/api/v3`, `/ads-monitor`, `/api/auth`, `/api/zalo`). UI primitives `src/components/ui` + layout `src/components/layout`. **Zoom UI 1.1** (`web/styles.css #root`, đã fix double-scrollbar). `@media print` cho Weekly Report Facebook.
* **Backend:** Node + **TypeScript (CommonJS, ts-node, KHÔNG build cho nhánh local/Railway)**, **Express 5**. ⚠️ **VERCEL MIGRATION (đang chuyển đổi):** route/business-logic tách khỏi `src/server.ts` sang **`src/app.ts`** (`createApp()` — KHÔNG static, KHÔNG SPA, KHÔNG `.listen()`). `src/server.ts` (local/Railway) = `createApp()` + static `web/dist` + SPA fallback `/{*splat}` + `.listen(PORT ?? 4000, '0.0.0.0')`. `api/index.ts` (Vercel serverless) = `createApp()` export trực tiếp, KHÔNG static (Vercel serve `web/dist` riêng qua `vercel.json`). Đọc Supabase bằng **service_role**, cache `getContents()` TTL 10s (tự invalidate sau webhook sync — cache này chỉ có ý nghĩa trong 1 lần cold-start trên Vercel, KHÔNG sao).
* **Database:** **Supabase** (Postgres). Bảng Content: `contents`, `sync_logs`, `content_status_history` (rỗng). Bảng Ads: `ads_monitor`, `ads_monitor_lifecycle`. Bảng Auth: **`users`** (Phase Auth, RLS chỉ service_role). Bảng đa nền tảng (Zalo): **`platform_contents`**, **`platform_settings`**, **`platform_sync_logs`**. Bảng **`sync_debounce`** (migration 012 — VERCEL MIGRATION, xem §8/§11) thay cho `SyncQueue.ts` in-memory. Migrations 001–012 (012 **CHƯA áp dụng**, xem §12).
* **API (chỉ thêm, không đổi cũ):**
  * Auth: `GET/POST /api/auth/me` — kiểm tra JWT + domain + `is_active`, auto-provision user mới. Bảo vệ toàn bộ `/api/v3/*` và `/ads-monitor` bằng `requireAuth`.
  * Content (FB): `GET /api/config`, `/api/v3/{summary,contents,sync-status,lifecycle,content-detail,lifecycle-table}`, `/health`.
  * Content-Sync webhook (public, secret riêng): `POST /api/content-sync` (chỉ ghi tín hiệu vào `sync_debounce`, KHÔNG tự Sync), `GET /api/content-sync/status`.
  * **Cron Tick (VERCEL MIGRATION, mới):** `POST /api/cron/tick/content`, `POST /api/cron/tick/zalo` (secret riêng `CRON_SECRET`) — gọi bởi cron NGOÀI (~1 phút/lần), claim quyền chạy Sync qua RPC `sync_tick_claim` rồi mới thực sự đọc Sheet/ghi DB. Xem §8.
  * Ads: `GET /ads-monitor` (server-side, RPC `ads_monitor_query`).
  * Zalo: `/api/zalo/*` (`summary`·`contents`·`weekly`·`sync-status`·`settings`, `requireAuth`); webhook public riêng `POST /api/zalo-sync` (secret `ZALO_SYNC_SECRET`, cũng chỉ ghi tín hiệu — Sync thật qua cron tick).
  * Budget Analytics: KHÔNG có route riêng — frontend (`web/budget/`) gọi trực tiếp `/ads-monitor`.
* **Google Sheets:** `googleapis` (Service Account, qua `GoogleAuthFactory` — `GOOGLE_CREDENTIALS_JSON` ưu tiên cho Railway/Vercel, fallback file local). **3 spreadsheet riêng:** Content, Ads (`Raw_Data`), Zalo (2 tab `Video`/`Banner`).
* **Deployment:** GitHub `anhdtk-ship-it/content-dashboard`. ⚠️ **Đang chuyển từ Railway sang Vercel** (deploy auto-detect không ổn định trên Railway) — xem §11 cho trạng thái/checklist chi tiết. Railway (cũ): domain `content-dashboard-production-4e96.up.railway.app`.
* **Authentication:** **CÓ** — Supabase Auth (Google), domain `@seryn.vn` bắt buộc. Xem §9 (đảo ngược quyết định v3.0 cũ). Khi cutover sang Vercel: cần thêm domain Vercel vào Redirect URLs allowlist của Supabase Auth (§11).

---

## 4. Repository Structure
```
content-dashboard/
├── api/
│   └── index.ts                 ← Entry point VERCEL (serverless) — export createApp(), KHÔNG static/SPA/listen
├── src/
│   ├── app.ts                   ← createApp(): TOÀN BỘ route API (Content+Ads+Zalo+Auth+Content-Sync+Cron Tick),
│   │                                KHÔNG static/SPA/listen — dùng chung bởi server.ts (local/Railway) VÀ api/index.ts (Vercel)
│   ├── server.ts                ← Entry point LOCAL DEV + RAILWAY: createApp() + static web/dist + SPA fallback + listen()
│   ├── auth/                    ← MODULE AUTH: authMiddleware.ts (requireAuth) · routes.ts (/api/auth/me)
│   ├── content-sync/            ← MODULE AUTO-SYNC (Phase 12 → Vercel Migration): ContentSyncService.ts ·
│   │                                DbSyncQueue.ts (debounce lưu Supabase, bảng sync_debounce — THAY SyncQueue.ts cũ) ·
│   │                                routes.ts (webhook enqueue) · tickRoutes.ts (cron tick /api/cron/tick/*)
│   ├── platform/zalo/           ← MODULE ZALO (Phase 13, độc lập FB): ZaloStatusRule.ts · ZaloContent.ts ·
│   │                                ZaloSyncProvider.ts · ZaloSyncService.ts · zaloMetrics.ts · zaloWeeklyMetrics.ts · api.ts · syncRouter.ts
│   ├── google-auth.ts            ← GoogleAuthFactory (createGoogleAuth/createSheetsClient) — dùng chung 7+ nơi
│   ├── sync-all-content.ts (CLI wrapper mỏng gọi ContentSyncService) · sync-scheduler.ts · backfill-dates.ts ·
│   │   date-util.ts · sheets-reader.ts · transform-content.ts · zalo-sync.ts · zalo-seed.ts · zalo-verify.ts …
│   ├── components/ui/ · components/layout/    ← UI library dùng chung
│   └── ads-monitor/             ← MODULE ADS MONITOR (backend, độc lập)
│       ├── types.ts · calculateAdsStatus.ts(latestAmount,lifecycle) · mock.ts
│       ├── AdsMonitorRepository.ts · AdsMonitorService.ts · routes.ts
│       ├── AdsMonitorSyncProvider.ts · GoogleSheetAdsSyncProvider.ts (map Raw_Data FB Ads)
│       ├── import.ts (ads:import) · verify.ts (ads:verify) · ads-scheduler.ts (ads:scheduler)
├── web/                         ← App React
│   ├── main.tsx (bọc AuthGate) · styles.css(zoom+@media print) · GlobalFilter.tsx · editor-name.ts
│   ├── auth/                    ← MODULE AUTH (frontend): supabaseClient.ts · authFetch.ts · LoginPage.tsx · AuthGate.tsx
│   ├── OverviewPage · MarketsPage · AssigneesPage · ExplorerPage · LifecyclePage · UsagePage · AnalyticsPage · UsageCompare · AlertDrawer · Tabs
│   ├── ads-monitor/ (pages/AdsMonitorPage · components/{AdsSummaryCards,AdsFilters,AdsTable} · types · utils)
│   ├── budget/                  ← MODULE BUDGET ANALYTICS (FB-ADS-02, độc lập, chỉ đọc /ads-monitor)
│   │   └── BudgetAllocationPage.tsx · budgetApi.ts · BudgetDrawer.tsx
│   ├── zalo/                    ← MODULE ZALO (frontend): ZaloDashboardPage.tsx · ZaloWeeklyPage.tsx ·
│   │   └── ZaloDrawer.tsx · ZaloSettingsPanel.tsx · zaloApi.ts
│   └── reports/                 ← MODULE WEEKLY REPORT (độc lập, Phase 8-13)
│       ├── types/report.ts · utils/{week,format}.ts · hooks/useWeeklyReport.ts
│       ├── services/{WeeklyReportService,ruleEngine,exporters}.ts
│       └── components/{ReportFilters,ExportBar,ReportDocument,NarrativeSections}.tsx · pages/WeeklyReportPage.tsx
│   reports/ (Python)             ← build_zalo_weekly_data.ts + zalo_report_pdf.py (reportlab.platypus, PDF chuẩn Zalo)
├── apps-script/                  ← Google Apps Script trigger webhook: ContentSync.gs · ContentSyncZalo.gs
├── public/index.html            ← Dashboard VANILLA (LEGACY — KHÔNG serve; đừng sửa)
├── sql/ 001..012_*.sql          ← migrations (chạy tay Supabase SQL Editor; 001–011 đã áp dụng, 012 CHƯA — xem §12)
├── vercel.json                   ← MỚI: buildCommand/outputDirectory/rewrites/maxDuration cho Vercel
├── run-ads-import.bat + ads-import.log  ← wrapper Windows chạy ads:import (gitignored, cục bộ máy)
├── .env (+ .env.example commit) · credentials/ (gitignored)
└── PROJECT_SPEC.md · CURRENT_STATE.md · PROJECT_BACKLOG.md · DESIGN_SYSTEM.md · WIREFRAMES.md · mapping-spec.md ·
    ZALO_SETUP.md · PHASE_12_AUTO_SYNC.md · (file này) · reviews R2–R6
```

---

## 5. Completed Work
* **Sync Engine** idempotent 8 sheet Content → `contents` + khử trùng stale (env `SYNC_PRUNE_STALE`, có guard). `npm run scheduler` (node-cron, chống chạy chồng).
* **Dashboard Content:** Tổng Quan, Thị Trường, Content & Vòng đời (Explorer + Lifecycle), GlobalFilter chung. Trạng thái **"Không test"**, KPI 2 nhóm, "Test quá lâu" (ngưỡng đã hạ 10→5 ngày), "Thiếu ngày test" loại trừ "Không test".
* **Ads Monitor — GO-LIVE:** đọc Sheet Ads Raw_Data → `ads_monitor`; server-side pagination/filter/sort/KPI; Lifecycle NEW/TEST/MAINTAIN; import lịch (Task Scheduler 09:35).
* **Weekly Report (Phase 8→13):** module `web/reports/` độc lập, KPI 2 nhóm, Rule Engine, đánh giá cá nhân theo tỷ lệ, kế hoạch cả team, báo cáo theo market, PDF chuẩn (`reportlab.platypus`, standalone không phụ thuộc trình duyệt).
* **Phase 12 — Auto-Sync Content:** webhook `POST /api/content-sync` + Debounce Queue (60s, max-wait 5 phút) + so sánh signature (chỉ upsert bản ghi đổi). `ContentSyncService.ts` là nguồn logic sync DUY NHẤT (CLI + webhook đều gọi).
* **GoogleAuthFactory:** `src/google-auth.ts` — chạy được trên Railway (`GOOGLE_CREDENTIALS_JSON`) không cần file `credentials/*.json`. Refactor 7+ nơi dùng chung.
* **Authentication + Authorization:** Supabase Auth Google, domain `@seryn.vn`, bảng `users` (RLS chỉ service_role), auto-provision user mới, 403 nếu `is_active=false` hoặc sai domain. Bảo vệ toàn bộ `/api/v3` + `/ads-monitor` + `/api/zalo`.
* **Phase 13 — Zalo (đa nền tảng):** bảng `platform_*` dùng chung cho nền tảng mới; `ZaloStatusRule` (Business Rule riêng: Tồn/Đang test/Duy trì/Không test); dashboard theo tháng + định dạng (Video/Banner, tự do không hardcode); sync 2 tab Sheet + webhook riêng; Weekly Zalo + PDF Python (`reportlab`).
* **Budget Allocation Analytics (FB-ADS-02):** module `web/budget/` độc lập, chỉ đọc `/ads-monitor`; phân tích ngân sách + content theo nhân viên, biểu đồ cột nhóm Nội Địa/Quốc Tế, loại NV "Br" khỏi Nội Địa.

---

## 6. Work In Progress
* Không có code dở trong working tree — tất cả đã commit + push `main` (HEAD `7852d1a`).
* Việc vận hành còn treo (chưa code): (a) chạy `ads:import` tự động hằng ngày trên hạ tầng luôn-bật (hiện chỉ chạy trên máy Windows cục bộ); (b) persist phần soạn II/III của Weekly Report; (c) export DOCX; (d) phân quyền thật theo `role` (Admin/Viewer) — cột đã lưu, logic chưa code.

---

## 7. Next Priorities
**P1**
* **Phân quyền theo `role`** — hiện mọi user hợp lệ (`@seryn.vn` + `is_active`) có quyền như nhau; nếu cần phân biệt Admin/Viewer phải code thêm (kiểm tra `role` trong `authMiddleware` hoặc route-level).
* **Scheduler import Ads hằng ngày** trên máy/hạ tầng luôn-bật (Windows Task Scheduler `run-ads-import.bat` 09:35 đã dựng cục bộ; hoặc worker Railway riêng chạy `npm run ads:scheduler`). Railway web service KHÔNG tự chạy.
* **Vận hành Auth trên Railway:** xác nhận đã bật Google provider + OAuth Client ID/Secret (Supabase/Google Cloud) + Redirect URL đúng domain production; `SUPABASE_ANON_KEY` đã set; đã có ít nhất 1 user admin trong bảng `users`.
* **Cập nhật `PROJECT_SPEC.md §5`** (Phân quyền) — hiện vẫn ghi "chưa triển khai/chưa có auth", đã lỗi thời so với thực tế (auth đã live) — cần đồng bộ.

**P2**
* Persist phần II/III Weekly Report (thêm bảng `weekly_report_notes` — migration mới) để giữ chỉnh sửa qua các lần mở.
* Xác nhận nghiệp vụ mapping Ads (`ads_owner` còn nhiễu `Br/BR/S`).
* `EXPLAIN ANALYZE ads_monitor_query(...)` ở mốc dữ liệu lớn (100k–500k) xác nhận index/`DISTINCT ON`.

**P3**
* Export DOCX Weekly Report (interface đã có, chưa implement).
* Thêm nền tảng thứ 3 (TikTok…) tái dùng kiến trúc `platform_*` (chỉ cần `src/platform/<tên>/` + đăng ký `registry.ts` + mount route 1 dòng).
* Sửa lỗi parse năm 2025→2026 (`date-util.ts`) cho content cũ.

---

## 8. Known Issues / Inconsistencies
* **⚠️ VERCEL MIGRATION đang dở dang** — code đã tách xong (`app.ts`/`server.ts`/`api/index.ts`, `DbSyncQueue` thay `SyncQueue`, `vercel.json`, migration `sql/012_sync_debounce.sql`), nhưng **CHƯA**: (a) chạy migration 012 trên Supabase, (b) tạo project Vercel + set env vars, (c) đăng ký cron ngoài (cron-job.org) gọi `/api/cron/tick/content` + `/api/cron/tick/zalo` mỗi ~1 phút (bắt buộc — không có cron ngoài thì Sync KHÔNG BAO GIỜ tự chạy, dù enqueue vẫn ghi tín hiệu bình thường), (d) thêm domain Vercel vào Supabase Auth Redirect URLs, (e) cập nhật `WEBHOOK_URL` trong Apps Script (`ContentSync.gs`/`ContentSyncZalo.gs`) sang domain Vercel. Cho tới khi xong cả 5 việc này, **Railway vẫn phải là bản chạy chính** (webhook cũ trên Railway KHÔNG còn tương thích code mới nếu deploy nhầm — code mới BẮT BUỘC phải có bảng `sync_debounce` + cron ngoài mới hoạt động).
* **`PROJECT_SPEC.md §5` (Phân quyền) lỗi thời** — vẫn ghi "chưa có auth/chưa triển khai" dù Authentication đã live từ `105f1a5`. `CURRENT_STATE.md` là nguồn đúng nhất hiện tại cho phần Auth.
* **Phân quyền `role` chỉ hình thức** — mọi user `@seryn.vn` hợp lệ có quyền ngang nhau (kể cả thao tác nhạy cảm nếu có trong tương lai); cột `role` đã lưu (`sql/008_users.sql`) nhưng chưa dùng để chặn route nào.
* **Auto-provision không cần duyệt trước** — bất kỳ ai có email `@seryn.vn` đăng nhập Google lần đầu được tự động thêm vào `users` với `is_active=true`; muốn khoá phải vào Supabase set `is_active=false` thủ công.
* **Mapping Ads Raw_Data là GIẢ ĐỊNH nghiệp vụ** (xem §11 `PROJECT_SPEC.md` để biết chi tiết suy luận `content←ad_name`, `page_code←adset_name`…) — cần nghiệp vụ xác nhận. `ads_owner` còn nhiễu `Br/BR/S`, hoa/thường `LIÊN`.
* **"Không test" (Facebook)** hiện đã lên số thật (không còn = 0 như v3.0) sau lần sync gần nhất — logic hoạt động đúng khi Sheet có content trạng thái này.
* **Scheduler KHÔNG tự chạy trên Railway web service** (chỉ chạy `npm start`); import Ads/scheduler chỉ khi chạy tay hoặc worker riêng (hiện dùng Windows Task Scheduler cục bộ).
* **Dashboard vanilla `public/index.html`** không còn serve (server serve `web/dist`) — legacy, đừng sửa.
* Nhánh **`demo-v2`** = baseline trước Ads Monitor — giữ nguyên có chủ đích.
* Budget Allocation Analytics **không có backend route riêng** — chỉ đọc `/ads-monitor` phía frontend; nếu logic Ads Monitor đổi, kiểm tra ảnh hưởng module này.

---

## 9. Important Decisions (KHÔNG tự ý đổi)
* **⚠️ ĐẢO NGƯỢC quyết định v3.0 cũ "KHÔNG Authentication":** kể từ `105f1a5`, app **CÓ** Authentication (Supabase Auth Google, domain `@seryn.vn` bắt buộc). KHÔNG quay lại mô hình Share Link nếu không có yêu cầu rõ ràng.
  * Route public (không cần đăng nhập): `/health`, `/api/config`, `/api/content-sync` (secret riêng), `/api/zalo-sync` (secret riêng), static SPA.
  * Route bảo vệ: `/api/v3/*`, `/ads-monitor`, `/api/zalo`.
  * `role` đã lưu trong bảng `users` nhưng **CHƯA** dùng để phân quyền — mọi user hợp lệ quyền ngang nhau.
* **PROJECT_SPEC.md là source of truth** — mọi thay đổi schema/API/sync/dashboard/report phải cập nhật vào đó (+ CURRENT_STATE.md).
* **5 miền tách biệt Business Rule:** Dashboard Content (FB), Ads Monitor, Weekly Report, Zalo, Budget Analytics **KHÔNG dùng chung** logic nghiệp vụ. Zalo có `ZaloStatusRule` RIÊNG (KHÔNG dùng `calculateAdsStatus`/status Dashboard FB). Weekly Report có `WeeklyReportService`/`ruleEngine` RIÊNG.
* **Facebook = Stable Version** — khi phát triển Zalo/platform mới, KHÔNG đụng code/logic Facebook.
* **Kiến trúc đa nền tảng (`platform_*`)** — thêm nền tảng mới (TikTok…) = tạo `src/platform/<nền-tảng>/` + đăng ký `registry.ts` + mount route, KHÔNG đổi schema/logic nền tảng cũ.
* **Ads Monitor (Phase 7) — trạng thái ĐỘNG, KHÔNG lưu cứng:** Lifecycle theo tổng chi tiêu ĐỜI (monotonic), trạng thái hiển thị = `calculateAdsStatus(latestAmount, lifecycle)`. Chi tiết công thức: xem `PROJECT_SPEC.md §11`.
* **Budget Allocation Analytics** — module chỉ ĐỌC (`/ads-monitor`), KHÔNG có sync/API/bảng riêng; không tự ý thêm ghi dữ liệu.
* **PDF:** Weekly Report Facebook = in trình duyệt (`window.print()` + `@media print`). Weekly Zalo = PDF chuẩn qua Python `reportlab.platypus` (standalone, không phụ thuộc trình duyệt).
* **Ràng buộc chung:** thêm migration mới (không sửa migration cũ đã áp dụng), API additive, không mock khi đã cấu hình Supabase, không tạo màu/typography ngoài DESIGN_SYSTEM.
* **Debounce Auto-Sync (VERCEL MIGRATION) — trạng thái lưu Supabase, KHÔNG trong RAM:** `enqueue()` (webhook) chỉ ghi tín hiệu vào bảng `sync_debounce`; **chỉ route tick** (`/api/cron/tick/content`, `/api/cron/tick/zalo`, gọi bởi cron ngoài) mới thực sự claim + chạy Sync, qua RPC atomic `sync_tick_claim`/`sync_tick_finish` (xem `sql/012_sync_debounce.sql`). KHÔNG quay lại `setTimeout` trong RAM (không hoạt động đúng trên serverless).

---

## 10. Environment (biến môi trường — file `.env`, gitignored)
| Biến | Bắt buộc | Dùng cho |
|---|---|---|
| `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server + Sync + Ads + Zalo + Auth |
| `SUPABASE_ANON_KEY` | ✅ | `/api/config` + Supabase Auth phía client |
| `GOOGLE_CREDENTIALS_JSON` (Railway/cloud) hoặc `GOOGLE_CREDENTIALS_PATH` (local) | ✅ (1 trong 2) | `GoogleAuthFactory` — Sync Content/Ads/Zalo |
| `GOOGLE_SHEET_ID` | ✅ | Sync Content |
| `ADS_SHEET_ID` · `ADS_SHEET_TAB` (`Raw_Data`) | ✅ | Ads Import |
| `ZALO_SHEET_ID` (alias `ZALO_GOOGLE_SHEET_ID`) | ✅ | Sync Zalo (2 tab Video/Banner) |
| `AUTH_ALLOWED_DOMAIN` (`seryn.vn`) | ✅ | Auth — domain check |
| `CONTENT_SYNC_SECRET` · `_DEBOUNCE_MS` · `_MAX_WAIT_MS` | ✅ (webhook) | Content-Sync webhook (Phase 12) |
| `ZALO_SYNC_SECRET` · `ZALO_SYNC_DEBOUNCE_MS` · `ZALO_SYNC_MAX_WAIT_MS` | ✅ (webhook) | Zalo webhook |
| **`CRON_SECRET`** (MỚI — VERCEL MIGRATION) | ✅ (bắt buộc để Sync thật sự chạy) | `/api/cron/tick/*` — cron ngoài gọi mỗi ~1 phút |
| `ADS_USE_MOCK` | ⏺ (dev) | Ép mock dù đã cấu hình Supabase (mặc định off) |
| `PORT` | (Railway cấp; default 4000; KHÔNG cần trên Vercel) | Express (`server.ts`, không dùng ở `api/index.ts`) |
| `SYNC_ENABLED` · `SYNC_CRON` · `SYNC_PRUNE_STALE` | ⏺ | Scheduler Content |
| `ADS_SYNC_ENABLED` · `ADS_SYNC_CRON` (`35 9 * * *`) | ⏺ | Scheduler Ads import |
> `.env.example` là template (commit). `credentials/*.json` gitignored. dotenv CHỈ đọc `.env` (không đọc `.env.local`).

---

## 11. Deployment Status
* **GitHub:** `github.com/anhdtk-ship-it/content-dashboard`. Nhánh `demo-v2` = baseline cũ.
* **⚠️ ĐANG CHUYỂN Railway → Vercel** (lý do: Railway auto-deploy không cập nhật bundle sau nhiều lần push). Code đã sẵn sàng cho cả 2 (xem §3), nhưng **chưa cutover xong** — checklist còn thiếu (thứ tự nên làm):
  1. Chạy `sql/012_sync_debounce.sql` trên Supabase SQL Editor (bảng + 3 RPC — **bắt buộc**, thiếu bảng này thì webhook vẫn nhận tín hiệu nhưng KHÔNG BAO GIỜ tự Sync).
  2. Tạo project Vercel, import repo GitHub này. KHÔNG cần preset đặc biệt — `vercel.json` (root) tự quyết định `buildCommand: npm run build`, `outputDirectory: web/dist`, `rewrites` (route `/health`, `/api/*`, `/ads-monitor*` vào `api/index.ts`; còn lại Vercel serve static). `functions["api/index.ts"].maxDuration = 60` — **verify lại trần thực tế của gói Hobby trên Vercel dashboard/docs tại thời điểm deploy** (số này đổi theo chính sách Vercel).
  3. Set env vars trên Vercel (xem §10) — gồm cả **`CRON_SECRET` mới**. `PORT` không cần.
  4. Đăng ký **2 cron job miễn phí** (vd cron-job.org — Vercel Hobby Cron chỉ chạy 1 lần/ngày, KHÔNG đủ) gọi `POST https://<domain-vercel>/api/cron/tick/content` và `.../zalo` mỗi ~1 phút, header `x-cron-secret: <CRON_SECRET>`. **Thiếu bước này = Auto-Sync đứng im vĩnh viễn** (enqueue vẫn ghi tín hiệu, không ai tick để claim).
  5. Supabase Dashboard → Authentication → URL Configuration → thêm domain Vercel mới vào Redirect URLs (giữ domain Railway cũ trong lúc chuyển tiếp).
  6. Cập nhật Script Property `WEBHOOK_URL` trong Apps Script `ContentSync.gs` VÀ `ContentSyncZalo.gs` sang domain Vercel (không cần sửa code `.gs`).
  7. Test end-to-end (sửa 1 dòng Sheet → chờ webhook + tick → xác nhận Dashboard cập nhật) TRƯỚC khi tắt Railway. Chạy full sync tay 1 lần (`npm run sync`, `npm run zalo:sync`) trước khi giao hẳn cho webhook/tick, để lần đầu không phải chạy đua cold-start với ~1900+ dòng.
* **Railway (đang chạy, giữ song song cho tới khi Vercel verify xong):** deploy tự động từ `main` (không ổn định — lý do đổi sang Vercel). Bind `0.0.0.0`, serve `web/dist` + API qua `src/server.ts` (KHÔNG đổi, vẫn hoạt động như cũ trên nhánh này). Domain `content-dashboard-production-4e96.up.railway.app`. Cần đặt thêm `CRON_SECRET` nếu vẫn dùng Railway sau khi code này deploy (webhook trên Railway giờ cũng cần cron ngoài tick, KHÔNG còn tự debounce trong RAM).
* **Supabase:** migrations 001–011 đã áp dụng; **012 (sync_debounce) CHƯA áp dụng** — xem checklist trên.

---

## 12. Database Status
* **`contents`** — Content Facebook. UNIQUE (content_code, market, assignee_name). `current_status` gồm cả "Không test".
* **`ads_monitor`** (lịch sử theo ngày, UNIQUE `page_code,content,sheet_date`) + **`ads_monitor_lifecycle`** (NEW/TEST/MAINTAIN, 1/content).
* **`sync_logs`** (mở rộng migration 007: source/rows_unchanged/rows_pruned/duration_ms) · **`content_status_history`** (rỗng).
* **`users`** (migration 008) — `email`, `role`, `is_active`, RLS bật, chỉ service_role truy cập được (không có policy anon/authenticated).
* **`platform_contents` / `platform_settings` / `platform_sync_logs`** (migration 010, thay thế 009) — bảng đa nền tảng, cột `platform` phân biệt Facebook/Zalo. `platform_contents` có thêm `title` (migration 011, riêng cho Zalo).
* **`sync_debounce`** (migration 012 — **CHƯA áp dụng**, VERCEL MIGRATION) — PK `queue_key` ('content'/'zalo'), thay `SyncQueue.ts` in-memory. 3 RPC: `sync_enqueue(p_key)`, `sync_tick_claim(p_key,p_debounce_ms,p_max_wait_ms,p_stuck_ms)`, `sync_tick_finish(p_key,p_result)`. Có tự phục hồi "stuck" (claim treo quá `p_stuck_ms` do crash/timeout → tự nhả).
* **Function/View Ads:** `ads_monitor_query(...)` · `ads_monitor_refresh_lifecycle()`.
* **Migration:** `sql/001`→`sql/011` **đã áp dụng**; **`sql/012` (sync_debounce) CHƯA** — cần chạy trước khi Auto-Sync hoạt động trên code mới. Chi tiết từng bảng/cột: `PROJECT_SPEC.md §2, §3.1, §11, §13`.

---

## 13. Google Sheets Status
* **Content (Facebook):** spreadsheet riêng, 8 tab `NĐ/QT × Hiếu/Ánh/KA/Liên` (loại Khiêm). Sync: `npm run sync` hoặc **auto qua webhook (Phase 12)**.
* **Ads:** spreadsheet riêng, tab `Raw_Data` (export FB Ads cấp ad/ngày). Import: `npm run ads:import`, verify `npm run ads:verify`.
* **Zalo:** spreadsheet riêng, **đúng 2 tab** `Video`/`Banner` (header trải nhiều hàng — cột TT Team/Ngày Test ở hàng trên, ID/Trello/Ngày up ở hàng dưới). Sync: `npm run zalo:sync`, hoặc **auto qua webhook** `/api/zalo-sync`. Verify: `npm run zalo:verify`.
* **Còn thiếu:** chuẩn hóa `ads_owner`; tự động hóa import Ads hằng ngày trên hạ tầng luôn-bật.

---

## 14. Session Summary (kể từ v3.0 @ `ed1c820`, Phase 12→13)
* **Phase 12 (Auto-Sync Content):** webhook `POST /api/content-sync` + Debounce Queue + so sánh signature; `ContentSyncService.ts` gom logic sync về 1 chỗ (CLI + webhook đều gọi).
* **GoogleAuthFactory:** fix Sync fail trên Railway (thiếu file credentials) — factory đọc `GOOGLE_CREDENTIALS_JSON` trước, refactor 7+ nơi dùng chung.
* **Fix KPI:** tỷ lệ test thành công = Duy trì ÷ (Duy trì + Đã test-ko chạy + Đã chạy-Tắt).
* **Overview:** đổi nhãn "Content duy trì", thêm cột "Đang test all-time", bỏ cột "Duy trì >90d"; sau đó hạ ngưỡng "Test quá lâu" 10→5 ngày + thêm cột "Tồn" cạnh "Đã test".
* **Weekly Report PDF (Facebook):** chuyển sang `reportlab.platypus` standalone (không phụ thuộc trình duyệt).
* **Weekly Report:** "Content duy trì" + đánh giá cá nhân theo tỷ lệ (không phải số tuyệt đối) + kế hoạch chuyển sang CẢ TEAM (1 danh sách).
* **UI fix:** bỏ thanh cuộn thừa của `body` do `#root{zoom:1.1}`.
* **Authentication + Authorization (`105f1a5`, `37c13c5`):** Supabase Auth Google `@seryn.vn`; fix domain check bền hơn + trả `reason` để chẩn đoán 403.
* **Weekly Report nâng cấp:** báo cáo quản trị theo market (Nội địa/Quốc tế) + PDF chuyên nghiệp; Tồn loại trừ "Không test"/"Không được duyệt".
* **Auth mở rộng (`485ae67`):** cho phép MỌI email `@seryn.vn` đăng nhập (bỏ yêu cầu allowlist thủ công).
* **Phase 13 (`07e91fb` → `b554821`):** kiến trúc đa nền tảng (`platform_*`), deploy module Zalo đầy đủ (dashboard/API/webhook/weekly/PDF/sync) — additive, Facebook giữ nguyên.
* **Vá lỗi Zalo (nhiều commit):** sidebar theo cấu trúc Platform; chuẩn hoá `content_format` từ tên tab; đọc header trải nhiều hàng; Business Rule đúng theo cột "TT Team"; khoá sync match cả khi header có chú thích; "Test quá lâu" đếm nhóm "Đang test" quá 5 ngày.
* **Budget Allocation Analytics (`3ac20e0` → `a0919a4`):** module FB-ADS-02 mới — phân tích ngân sách + content theo nhân viên, tách tab Nội Địa/Quốc Tế, biểu đồ cột nhóm, loại NV "Br" khỏi Nội Địa, gộp ngân sách+content vào 1 biểu đồ (bỏ toggle).
* **Fix Overview:** "Thiếu ngày test" bỏ qua content trạng thái "Không test".
* Mọi thay đổi đã commit + push `main`. HEAD hiện tại `7852d1a`.

---

## 15. Next Session Instructions (cho Claude mới)
1. **Đọc trước:** file này → `PROJECT_SPEC.md` → `CURRENT_STATE.md` → `DESIGN_SYSTEM.md` → `ZALO_SETUP.md` (nếu đụng Zalo). Source chính: `src/server.ts`, `web/main.tsx`, `src/auth/`, `web/auth/`, `src/content-sync/`, `src/platform/zalo/` + `web/zalo/`, `web/budget/`, toàn bộ `src/ads-monitor/` + `web/ads-monitor/` + `web/reports/`. SQL: `sql/008` (users) + `sql/010`/`011` (platform/Zalo).
2. **cwd:** luôn `cd /c/Users/Admin/Downloads/wesd/content-dashboard` (Bash hay nhảy về `wesd` — project Next.js khác).
3. **Chạy:** `npm run dashboard` (Express :4000) · `npm run dev` (Vite :5173, proxy) · `npm run build` · `npm run typecheck`. Sync: `npm run sync|scheduler|ads:import|ads:verify|ads:scheduler|zalo:sync|zalo:verify`. **Sửa `server.ts`/backend phải RESTART Express** (ts-node không reload).
4. **Git/Deploy:** làm trên `main`; commit + `git push origin main` → Railway tự deploy. Trước khi commit: `git diff --cached --name-only | grep -iE "\.env$|credentials"` để chắc KHÔNG lộ secret.
5. **DDL Supabase:** service_role qua PostgREST KHÔNG chạy được DDL → migration mới phải chạy TAY trong SQL Editor.
6. **Đăng nhập khi test:** app yêu cầu đăng nhập Google `@seryn.vn` — chuẩn bị tài khoản test hợp lệ hoặc kiểm tra qua `curl` với JWT thật (API sẽ 401 nếu không có token).
7. **TUYỆT ĐỐI KHÔNG:** sửa module này khi đang làm module khác trong số 5 miền (Content FB/Ads Monitor/Weekly Report/Zalo/Budget Analytics); đổi công thức Lifecycle/Status Ads; sửa `public/index.html` (legacy); **tắt lại Authentication** (đã đảo ngược quyết định cũ — xem §9) trừ khi có yêu cầu rõ ràng; dùng chung Business Rule giữa các miền.

> Nếu chỉ đọc 1 mục: đọc **§9 (Important Decisions)** + **§8 (Known Issues)** trước khi viết code.
