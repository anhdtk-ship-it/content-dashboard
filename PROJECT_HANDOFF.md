# PROJECT HANDOFF — Content Operations Dashboard (Seryn)

> Tài liệu bàn giao để một phiên Claude mới **tiếp tục công việc mà không cần đọc lại lịch sử chat**.
> Cập nhật: 2026-06-25 · Thư mục gốc: `C:\Users\Admin\Downloads\wesd\content-dashboard`

---

## 0. START HERE (đọc 20 dòng này là hiểu ngay)

1. Dự án: **dashboard vận hành nội dung** cho team Seryn. Luồng: **Google Sheets → Supabase → API Express → 2 frontend**.
2. **Hai frontend song song** (đừng nhầm): (a) **dashboard vanilla** `public/index.html` (1 file HTML + JS thuần + Chart.js, KHÔNG build) — bản gốc đầy đủ 7 module; (b) **app React refactor** trong `web/` (Vite + React 19 + Tailwind v4) — bản đang phát triển, đẹp hơn, dùng component library.
3. Backend: **`src/server.ts`** (Express 5, ts-node, ~640 dòng) phục vụ API `/api/v3/*` + serve `public/`. Đọc Supabase bằng **service_role**, cache `getContents()` TTL 10s.
4. Dữ liệu: bảng **`contents`** (1510 dòng), `sync_logs`, `content_status_history` (rỗng). Nguồn: 8 sheet Google (`NĐ/QT × Hiếu/Ánh/KA/Liên`), loại trừ `*Khiêm`.
5. **Nghiệp vụ cốt lõi:** content → set ads (test) → duy trì/tắt. `status_group` & "vòng đời tính từ `test_date_real` (Ngày Set Ads), KHÔNG dùng upload_date".
6. **Tài liệu gốc bắt buộc đọc & cập nhật:** `PROJECT_SPEC.md`, `DESIGN_SYSTEM.md`, `PROJECT_BACKLOG.md`. Mọi thay đổi phải cập nhật `PROJECT_SPEC.md`.
7. **App React route (hash):** `#/` Tổng Quan · `#/assignees` Người Nhận · `#/markets` Thị Trường · `#/explorer` Content Explorer · `#/lifecycle` Vòng đời · `#/sync|users|settings` (stub).
8. **AppShell đã wire** (Sidebar 4 nhóm + Header breadcrumb/search/dark-toggle/notif/user). Mọi page React dùng chung 1 shell.
9. **Chạy:** Terminal 1 `npm run dashboard` (Express :4000). Terminal 2 `npm run web:dev` (Vite :5173, proxy `/api`→:4000). Build kiểm tra: `npx vite build`.
10. **Tuyệt đối KHÔNG:** đổi DB schema, đổi API (trừ additive khi thật cần), đổi công thức KPI, đổi logic sync, sửa dashboard vanilla.
11. **Định nghĩa KPI (bất biến):** Đã test = {Đang test, Duy trì-*, Đã test-ko chạy, Đã chạy-Tắt}; Thành công = {Duy trì-*, Đã chạy-Tắt}; Tỷ lệ thành công = Thành công ÷ Đã test.
12. **Màu trạng thái chuẩn:** Duy trì=xanh lá · Đang test=vàng · Chờ chạy=cam · Không duyệt=đỏ · Đã test-ko chạy=xám · Đã chạy-Tắt=xanh dương nhạt (xem `tokens.ts` `statusStyle()`).
13. **Component library:** `src/components/ui/` (15) + `src/components/layout/` (9). Dùng lại, đừng tạo Card mới.
14. **Cách xác minh:** screenshot tool hay timeout → dùng `preview_eval` (DOM inspection) + đối chiếu Supabase bằng script `ts-node` tạm.
15. **Dữ liệu đã được kiểm 100% khớp Supabase** (Sprint Review R1). Đừng nghi ngờ số liệu; nghi ngờ thì chạy lại script đối chiếu.
16. Ngày máy hiện tại ≈ **2026-06-25**. `today` trong code = `Date.UTC(now)`. Filter mặc định "Tháng này" = June 2026.
17. Quan trọng: **cwd của Bash tool hay nhảy về thư mục cha** (`wesd`, project Next.js khác) → LUÔN `cd /c/Users/Admin/Downloads/wesd/content-dashboard &&` trong mọi lệnh.
18. Sau khi sửa server.ts (ts-node, không auto-reload) → **restart Express**. Sau khi sửa class Tailwind mới trong `src/components` → **restart Vite dev** (regen CSS).
19. Việc tiếp theo gợi ý: global filter giữ state giữa các màn (R3), hợp nhất Explorer (R3), gzip + client cache (R4), tách `web/lib`+`useApi` (R5), dashboard Reports/Alerts/Sync/User/Settings (Sprint 4).
20. Đọc tiếp các mục bên dưới để biết chi tiết.

---

## 1. Mục tiêu cuối cùng

Xây **Operations Dashboard** giúp **Team Leader & nhân viên** theo dõi tiến độ **test content quảng cáo** hằng ngày: content được cấp → set ads (test) → duy trì hay tắt; đánh giá **chất lượng test** (tỷ lệ đã test, tỷ lệ thành công), **vòng đời content**, **hiệu suất theo người/biên tập/thị trường**, và **cảnh báo** cần xử lý. Ưu tiên: đọc KPI nhanh (3 giây), ít click, quản trị nội bộ.

---

## 2. Kiến trúc hiện tại

### Công nghệ
- **Backend:** Node.js + **TypeScript** (CommonJS), **Express 5**, chạy bằng **ts-node** (không build).
- **DB:** **Supabase** (Postgres + PostgREST + Realtime). Server dùng `@supabase/supabase-js` với **service_role**; client realtime dùng **anon key**.
- **Nguồn dữ liệu:** **Google Sheets** qua `googleapis` (Service Account, read-only).
- **Frontend A (vanilla):** `public/index.html` — HTML + JS thuần + **Chart.js CDN** + supabase-js CDN. Không build.
- **Frontend B (refactor):** **Vite 8 + React 19 + Tailwind v4** (`@tailwindcss/vite`). Thư mục `web/`.
- **Khác:** `dotenv`, `cors`, `zod` (chưa dùng nhiều), `node-cron` (cài nhưng chưa wire), `axios`.

### Folder structure
```
content-dashboard/
├── PROJECT_SPEC.md            ← tài liệu gốc (kiến trúc/schema/API)
├── PROJECT_BACKLOG.md         ← sprint/task
├── DESIGN_SYSTEM.md           ← UI tokens/màu/typography
├── WIREFRAMES.md              ← wireframe 10 màn hình
├── mapping-spec.md            ← mapping Sheet→Supabase
├── PROJECT_HANDOFF.md         ← (file này)
├── SPRINT_REVIEW_2.md         ← R1 review dữ liệu
├── UI_REVIEW_R2.md            ← R2 review UI
├── UX_REVIEW_R3.md            ← R3 review UX
├── PERF_REVIEW_R4.md          ← R4 review performance
├── CODE_REVIEW_R5.md          ← R5 review code
├── BUSINESS_REVIEW_R6.md      ← R6 review nghiệp vụ
├── package.json · tsconfig.json · tailwind.config.js · vite.config.ts
├── .env                       ← SUPABASE_*, GOOGLE_* (gitignored)
├── credentials/credentials.json  ← Google Service Account (gitignored)
├── sql/ 001..004_*.sql        ← migrations (chạy tay trong Supabase SQL Editor)
├── src/
│   ├── server.ts              ← Express API V3 (routes + transform + lifecycle helpers)
│   ├── sync-all-content.ts    ← Sync Engine (upsert idempotent)
│   ├── backfill-dates.ts      ← backfill *_real
│   ├── date-util.ts           ← parseDdmmToReal()
│   ├── sheets-reader.ts / analyze-headers.ts / check-duplicates.ts
│   ├── transform-content.ts / import-sample.ts / test-google-connection.ts (POC/dev)
│   └── components/
│       ├── ui/    (15 component + tokens.ts/.css + Showcase + index.ts + tsconfig.json)
│       └── layout/(9 component + LayoutShowcase + index.ts + tsconfig.json)
├── public/index.html          ← dashboard VANILLA (đừng sửa)
└── web/                        ← app REACT refactor
    ├── index.html · main.tsx · styles.css
    ├── OverviewPage.tsx · AssigneesPage.tsx · MarketsPage.tsx
    ├── ExplorerPage.tsx · LifecyclePage.tsx · GlobalFilter.tsx
    └── dist/ (build output)
```

### Database schema (Supabase)
- **`contents`** (1510 dòng): `id` bigint PK · `content_code` · `title` · `market` (`noi_dia|quoc_te`) · `assignee_name` (Hiếu/Ánh/KA/Liên) · `cgsd` · `editor_name` · `trello_link` · `upload_date` text · `upload_date_real` date · `test_date` text · `test_date_real` date (**= Ngày Set Ads, mốc vòng đời**) · `current_status` · `created_at` · `updated_at`. UNIQUE `(content_code, market, assignee_name)`.
- **`sync_logs`**: `id` bigint · `started_at` · `finished_at` · `rows_read` · `rows_inserted` · `rows_updated` · `status` · `error_message`.
- **`content_status_history`** (0 rows): `id` · `content_id` FK · `status` · `changed_at` · `note`. (Retention/timeline chính xác sẽ bật khi có dữ liệu.)

### API (`/api/v3/*`, base `http://localhost:4000`)
Filter chung: `from,to` (YYYY-MM-DD) · `market` · `assignee` · `status` (status_group) · `dateField` (`upload_date_real|test_date_real`).
| Endpoint | Vai trò |
|---|---|
| `GET /api/config` | trả `url`+`anonKey` realtime |
| `GET /api/v3/summary` | KPI nghiệp vụ (metrics), funnel, byAssignee, byMarket, byStatus, alerts, trend |
| `GET /api/v3/contents` | list + phân trang + `q` + drill (`alert,ageMin,ageMax,codes,endedExact,sort`) |
| `GET /api/v3/lifecycle` | KPI vòng đời, byEditorAvg/byAssigneeAvg/byMarketAvg, distribution, top20 (lọc theo `test_date_real`) |
| `GET /api/v3/lifecycle-table` | full list đã tính `ageDays/maintainDays` + `editor_name` (client tự lọc/sort/export) |
| `GET /api/v3/content-detail` | chi tiết 1 content + timeline + history (`code,market,assignee`) |
| `GET /api/v3/sync-status` | độ phủ ngày + `sync_logs` |

---

## 3. Module đã hoàn thành

| Module | Chức năng | File | Trạng thái |
|---|---|---|---|
| Sync Engine | upsert idempotent 8 sheet → contents + log | `src/sync-all-content.ts` | ✅ Complete |
| Backfill ngày | sinh `*_real` từ text dd/mm | `src/backfill-dates.ts`, `src/date-util.ts` | ✅ Complete |
| API V3 | mọi endpoint trên | `src/server.ts` | ✅ Complete |
| UI Component Library | 15 component (KPICard, DataTable, StatusBadge, ChartCard, FilterBar, …) | `src/components/ui/*` | ✅ Complete |
| Layout Library | AppShell, Sidebar, Header, Breadcrumb, NotificationArea, UserMenu, DarkModeToggle, PageContainer/PageHeader, TopNavigation | `src/components/layout/*` | ✅ Complete (đã wire) |
| AppShell tích hợp | 1 shell dùng chung + 8 menu + collapse + mobile drawer | `web/main.tsx` | ✅ Complete |
| Dashboard Tổng Quan | 6 KPI nghiệp vụ (màu theo trạng thái) + funnel + status + alerts | `web/OverviewPage.tsx` | ✅ Complete |
| Dashboard Người Nhận | bảng xếp hạng 13 cột + chart trạng thái + drill | `web/AssigneesPage.tsx` | ✅ Complete |
| Dashboard Thị Trường | 2 thẻ market + so sánh + 3 chart + drill | `web/MarketsPage.tsx` | ✅ Complete |
| Content Explorer | bảng sticky header+cột, sort, paginate, Drawer chi tiết, export CSV, drill giữ filter qua hash | `web/ExplorerPage.tsx` | ✅ Complete |
| Vòng đời Content | 5 KPI + Top20 + TB theo biên tập/người/thị trường + phân bố + Drawer (tái dùng) | `web/LifecyclePage.tsx` | ✅ Complete |
| Global Filter chuẩn hóa | filter lớn dễ đọc, tên/thứ tự mới, Biên tập từ data | `web/GlobalFilter.tsx` | ✅ Complete (Tổng Quan/Người Nhận/Thị Trường) |
| Quản lý Sync (React) | — | `web/main.tsx` (Stub) | 🔲 TODO (vanilla có) |
| User / Cài đặt | — | `web/main.tsx` (Stub) | 🔲 TODO |
| Reports / Alerts (nâng cao) | — | — | 🔲 TODO |
| Auth / Phân quyền | Admin/Viewer @seryn.vn | — | 🔲 TODO (Sprint 4) |
| Dashboard vanilla | 7 module đầy đủ (bản gốc) | `public/index.html` | ✅ Complete (legacy, đừng sửa) |

---

## 4. Thay đổi trong PHIÊN CHAT NÀY

Phiên này chủ yếu **Sprint 2 (refactor sang React) + Sprint Review 2 + S3-001/001.1**:
- **S2-001**: tạo Component Library `src/components/ui/` (15 component) + tokens + Tailwind v4 setup.
- **S2-002**: tạo Layout Library `src/components/layout/` (9 component).
- **S2-003**: dựng Vite/React, refactor **Tổng Quan** sang ui component (`web/`).
- **S2-004**: refactor **Người Nhận**.
- **S2-005**: refactor **Thị Trường**.
- **S2-006**: build **Content Explorer** (drawer, sticky) + thêm `editor_name` vào `/api/v3/lifecycle-table` (additive).
- **S2-007**: build **Vòng đời** + thêm `status_group,trello_link` vào top20 của `/api/v3/lifecycle` (additive) + export `DetailDrawer`.
- **Sprint Review 2 (R1–R6)**: tạo 6 báo cáo review (data/UI/UX/perf/code/business) — không sửa code.
- **S3-001**: tích hợp **AppShell** toàn app (Sidebar/Header), nâng AppShell (collapse, cuộn độc lập) + Sidebar (collapsed), gỡ shell độc lập ở 5 page.
- **S3-001.1**: chuẩn hóa **GlobalFilter** (kích thước/tên/thứ tự + filter Biên tập) chỉ ở 3 dashboard; **chuẩn hóa màu trạng thái** (`statusStyle/groupStyle` + StatusBadge + KPI màu) + severity; cập nhật DESIGN_SYSTEM §11.

---

## 5. Quyết định thiết kế đã thống nhất

- **Tài liệu gốc:** `PROJECT_SPEC.md` là single source of truth — mọi thay đổi schema/API/sync/dashboard/phân quyền PHẢI cập nhật vào đó.
- **Code:** TypeScript strict; CommonJS cho server (ts-node), ESM/react-jsx cho `src/components` & `web` (tsconfig riêng). File kebab-case (script), PascalCase `.tsx` (component), camelCase biến, UPPER_SNAKE hằng. Comment tiếng Việt.
- **Dữ liệu:** không mock — luôn Supabase/Sheets thật. Biến đổi nghiệp vụ (status_group, metrics, vòng đời) ở **tầng dashboard/API**, KHÔNG ghi DB. Sync **idempotent** theo `(content_code, market, assignee_name)`.
- **Nghiệp vụ (BẤT BIẾN):** Đã test = 5 trạng thái; Thành công = Duy trì-* + Đã chạy-Tắt; Tỷ lệ thành công = Thành công ÷ Đã test. **Vòng đời = `today − test_date_real`** (Ngày Set Ads), KHÔNG dùng upload_date.
- **status_group:** Chờ chạy→CHO_CHAY · Đang test→DANG_TEST · Duy trì-*→DUY_TRI · (Đã test-ko chạy | Đã chạy-Tắt)→DA_DUNG · Không được duyệt→KHONG_DUYET · rỗng→CHUA_PHAN_LOAI.
- **Màu trạng thái chuẩn (S3-001.1):** Duy trì=xanh lá `#34d399` · Đang test=vàng `#fbbf24` · Chờ chạy=cam `#fb923c` · Không duyệt=đỏ `#f87171` · Đã test-ko chạy=xám `#94a3b8` · Đã chạy-Tắt=xanh dương nhạt `#7dd3fc`. Dùng `statusStyle()` (theo current_status gốc) / `groupStyle()` (theo nhóm).
- **Severity (chỉ hiển thị):** Chờ chạy="Cần xử lý" · Không duyệt="Khẩn cấp" · Đang test="Theo dõi" · Duy trì="Ổn định".
- **Design tokens:** dark-first; CSS variables trong `web/styles.css` (@theme) + `src/components/ui/tokens.css`. KHÔNG tự tạo màu mới ngoài bảng tokens.
- **Filter:** Global Filter (date/market/assignee/editor/status) chỉ ở Tổng Quan/Người Nhận/Thị Trường; Explorer & Lifecycle có filter riêng. Control 44px, label 16px, font 15px; 1 hàng desktop, wrap mobile.
- **Responsive:** breakpoint `lg` (1024px). Grid co theo `sm/lg`; bảng cuộn-x; sidebar drawer ở <lg.
- **Performance:** server cache `getContents` 10s; chart bằng thanh HTML (ops-first, hạn chế Chart.js trong app React); skeleton + empty state.

---

## 6. Bug còn tồn tại

1. **Filter không giữ state giữa các màn** (mỗi React page có state riêng, reset về "Tháng này" khi chuyển màn). Vanilla dashboard có global filter; React thì chưa.
2. **2 "Content Explorer" khác nhau:** Người Nhận/Thị Trường drill mở **explorer nhúng** (bảng đơn giản, KHÔNG drawer), không phải trang `#/explorer` đầy đủ. Explorer nhúng bấm content = không phản hồi (cụt).
3. **KPI Tổng Quan không click-drill** (trông như bấm được nhưng không).
4. **`body` color mặc định đen** (Tailwind preflight) — rủi ro chữ chưa style; hiện các page bọc `text-fg` nên chưa lộ.
5. **Filter Biên tập trên Tổng Quan là UI-only** (endpoint `/summary` gom server không nhận param editor) — chỉ hoạt động ở Người Nhận/Thị Trường (lọc client-side).
6. **Dropdown Trạng thái:** "Đã chạy-Tắt" & "Đã test-Không chạy" cùng map `status_group=DA_DUNG` (không tách được qua cơ chế lọc theo nhóm).
7. **`base font 16px` + font-stack mặc định Tailwind** lệch DESIGN_SYSTEM (14px + stack riêng) — component override nên ít lộ.
8. **Screenshot tool (preview)** hay timeout ở các trang nặng — dùng `preview_eval` thay thế để verify.

---

## 7. TODO theo ưu tiên

**Cao**
1. **Global filter dùng chung** giữ state khi chuyển màn (sửa bug #1).
2. **Hợp nhất Content Explorer**: drill từ dashboard → `#/explorer?<filter>` (đã hỗ trợ đọc hash), bỏ explorer nhúng (sửa bug #2).
3. **KPI clickable** drill (sửa bug #3).
4. **gzip/brotli** API (compression middleware) — payload `lifecycle-table` 724KB→~100KB.

**Trung bình**
5. **`web/lib/` + hook `useApi()`** — xoá trùng lặp helper (`presetRange/liveDays/pct/ymd` lặp ở 5 page) (R5).
6. Client cache theo filter-key (hết refetch khi quay lại màn).
7. Tách `server.ts` (640 dòng) → `lib/transform`, `services/contents`, `routes/*`; thêm `web/types.ts`.
8. Sticky cột đầu cho bảng Người Nhận/Top20; chuẩn font 14px + `body{color:var(--fg)}`.
9. Dashboard **Quản lý Sync** (React, hiện stub) + nút trigger sync.

**Thấp / Sprint 4**
10. **Auth + phân quyền** Admin/Viewer (@seryn.vn), RLS, module User/Settings.
11. **Reports** (so kỳ, export PDF), **Alerts center** (hành động được), **trend theo thời gian / năng suất** (R6).
12. **Ghi `content_status_history`** khi sync đổi status → mở khóa Retention & cycle-time.
13. Auto-sync (node-cron), xóa content stale, code-split route, virtual table (chỉ khi render >200 dòng).

---

## 8. File cần đọc đầu tiên
1. `PROJECT_HANDOFF.md` (file này) · 2. `PROJECT_SPEC.md` · 3. `DESIGN_SYSTEM.md` · 4. `PROJECT_BACKLOG.md`
5. `src/server.ts` (API + nghiệp vụ) · 6. `web/main.tsx` (router + AppShell) · 7. `web/GlobalFilter.tsx`
8. `src/components/ui/tokens.ts` (màu + statusStyle) · 9. một page mẫu `web/OverviewPage.tsx` · 10. `mapping-spec.md`.

---

## 9. File KHÔNG sửa nếu không thật cần
- `public/index.html` (**dashboard vanilla** — bản gốc, dễ vỡ; đừng đụng).
- `src/sync-all-content.ts`, `src/backfill-dates.ts`, `src/date-util.ts` (sync/dữ liệu đã chạy ổn).
- `sql/*.sql` (migrations đã áp; muốn đổi schema → tạo file mới `005_*.sql`).
- `.env`, `credentials/credentials.json` (bí mật, không commit).
- `src/components/ui/*` & `layout/*` — chỉ **thêm prop/biến thể**, đừng đổi API component đang dùng.

---

## 10. Ràng buộc bắt buộc
- ❌ KHÔNG đổi **database schema** (Supabase) — cần đổi thì thêm migration `sql/00x_*.sql` + cập nhật PROJECT_SPEC.
- ❌ KHÔNG đổi **công thức KPI / logic vòng đời / logic sync / query gốc**.
- ❌ KHÔNG đổi **API** trừ **additive** (thêm field/param tùy chọn) và phải không phá vanilla dashboard.
- ❌ KHÔNG **mock dữ liệu** — luôn Supabase/Sheets thật.
- ❌ KHÔNG tự tạo **màu mới / typography mới** ngoài DESIGN_SYSTEM.
- ❌ KHÔNG sửa **dashboard khác** khi đang làm 1 dashboard.
- ✅ LUÔN **backward compatible** (vanilla dashboard vẫn chạy; param mới là optional).
- ✅ LUÔN cập nhật `PROJECT_SPEC.md` (và `DESIGN_SYSTEM.md`/`BACKLOG` khi liên quan) cùng thay đổi.

---

## 11. Feature đang dang dở
- **GlobalFilter (S3-001.1):** đã xong UI + wire ở 3 dashboard. **Còn lại:** (a) filter Biên tập trên Tổng Quan chỉ UI (cần `/summary` hỗ trợ param `editor` — nhưng đang cấm đổi API; cân nhắc client-side hoặc thêm param additive); (b) tách "Đã chạy-Tắt" vs "Đã test-ko chạy" trong dropdown cần filter theo raw status (hiện chỉ status_group).
- **Stub Sync/User/Settings:** mới là `EmptyState` "đang phát triển". Bước tiếp: dựng React Sync page từ `/api/v3/sync-status` (vanilla đã có mẫu trong `public/index.html`).

---

## 12. Giả định KHÔNG được tự ý đưa ra
- Đừng giả định **năm** của ngày `dd/mm` ngoài **2026** (đã cố định trong `date-util.ts`; có ~76 content 2025 sẽ lệch năm — đã biết, đừng "sửa" tùy ý).
- Đừng giả định `content_code` **unique** — KHÔNG unique; khóa là `(content_code, market, assignee_name)`.
- Đừng giả định `content_status_history` **có dữ liệu** — hiện rỗng; lifecycle dùng **derived** từ `test_date_real`.
- Đừng giả định **Chart.js có trong app React** — app React dùng thanh HTML; Chart.js chỉ ở vanilla.
- Đừng giả định **filter giữ state giữa màn** — hiện KHÔNG.
- Đừng giả định **`today`** = ngày thật của bạn — code dùng giờ máy (≈2026-06-25).
- Đừng giả định Bash **cwd** đã đúng — luôn `cd` vào content-dashboard.

---

## 13. Lệnh chạy project
```bash
cd /c/Users/Admin/Downloads/wesd/content-dashboard

# Cài đặt (nếu cần)
npm install

# Backend API (Express, :4000) — phục vụ vanilla dashboard + API
npm run dashboard          # = ts-node src/server.ts

# Frontend React refactor (Vite, :5173, proxy /api -> :4000)
npm run web:dev

# Build kiểm tra React (bắt lỗi compile/Tailwind)
npx vite build             # hoặc: npm run web:build

# Type-check component libraries
npm run typecheck:ui
npm run typecheck:layout

# Đồng bộ dữ liệu Sheet -> Supabase (chạy tay khi sheet đổi)
npm run sync
npm run backfill           # sinh lại *_real

# Server.ts type-check
npx tsc --noEmit
```
> Migrations `sql/*.sql` chạy **thủ công** trong Supabase SQL Editor (không qua CLI).

---

## 14. Lỗi đã gặp & cách xử lý
- **ts-node "exit 0 không output" với `import`**: thiếu `tsconfig.json` (Node 24 + TS6). Đã thêm `module:commonjs` + `ignoreDeprecations:"6.0"`.
- **`@supabase/supabase-js` làm mất `@types/node`**: thêm `"types":["node"]` vào tsconfig server.
- **Tailwind v3 (project cha) xung đột v4**: `css:{postcss:{plugins:[]}}` trong `vite.config.ts` để @tailwindcss/vite tự xử lý.
- **Tailwind không sinh class trong `src/components`**: thêm `@source "../src/components/ui"` & `layout` trong `web/styles.css`.
- **Class layout (lg:w-[60px]) không áp**: dùng `max-lg:w-[240px]` thay base `w-[240px]`; và **restart Vite dev** để regen CSS.
- **sync_logs schema khác migration**: dùng đúng cột thật (`rows_inserted/rows_updated/error_message`, không `duration_ms/detail`).
- **content_code/sheet có khoảng trắng thừa** (`QT Liên `): resolve tên sheet thật từ metadata trước khi đọc.
- **Bash cwd nhảy về cha** → luôn `cd` đầy đủ.
- **Screenshot timeout** → verify bằng `preview_eval`.

---

## 15. Danh sách file đã chỉnh sửa/ tạo trong phiên này
**Tạo mới:** toàn bộ `src/components/ui/*` (16 file), `src/components/layout/*` (12 file), `web/*` (index.html, main.tsx, styles.css, OverviewPage, AssigneesPage, MarketsPage, ExplorerPage, LifecyclePage, GlobalFilter), `vite.config.ts`, `tailwind.config.js`; các tài liệu `PROJECT_SPEC.md, PROJECT_BACKLOG.md, DESIGN_SYSTEM.md, WIREFRAMES.md, SPRINT_REVIEW_2.md, UI_REVIEW_R2.md, UX_REVIEW_R3.md, PERF_REVIEW_R4.md, CODE_REVIEW_R5.md, BUSINESS_REVIEW_R6.md, PROJECT_HANDOFF.md`; `sql/001..004`.
**Sửa:** `src/server.ts` (thêm field additive: `editor_name` vào lifecycle-table; `status_group,trello_link` vào lifecycle top20; endpoints lifecycle/contents/sync-status; dateField test_date_real), `package.json` (scripts + deps), `tsconfig.json` (exclude components, ignoreDeprecations), `src/sync-all-content.ts` (sinh `*_real`).
**Sửa S3-001/001.1:** `src/components/layout/AppShell.tsx`, `Sidebar.tsx`; `web/main.tsx`; `web/{Overview,Assignees,Markets,Explorer,Lifecycle}Page.tsx`; `src/components/ui/{tokens.ts,StatusBadge.tsx,KPICard.tsx,PageContainer.tsx}`; `web/GlobalFilter.tsx`; `DESIGN_SYSTEM.md`.

---

## 16. Context kỹ thuật trước khi viết code
- **Hai tsconfig riêng** cho `src/components/ui` và `layout` (jsx react-jsx, ESM). Server dùng tsconfig gốc (commonjs, **exclude `src/components/**`**). Đừng để server build quét file `.tsx`.
- **Tailwind v4**: cấu hình màu qua `@theme` trong `web/styles.css` (map sang CSS var trong `tokens.css`). Class arbitrary (`text-[#fb923c]`, `h-11`) hợp lệ. Thêm class mới trong `src/components` → **restart Vite dev** mới có CSS.
- **Vite root = `web/`**, proxy `/api` → `:4000`. Phải có **Express chạy song song** mới có dữ liệu.
- **Server cache 10s**: sau khi sửa server.ts phải **restart Express** (ts-node không reload); dữ liệu có thể trễ ≤10s.
- **DetailDrawer** (Explorer) đã export, tái dùng ở Lifecycle — đừng tạo drawer mới.
- **GlobalFilter** lấy danh sách Biên tập bằng 1 fetch `/api/v3/lifecycle-table` (cache module-level) — read-only.
- **Verify chuẩn:** `preview_eval` đọc DOM/computed-style; đối chiếu Supabase bằng script `ts-node` tạm (`src/_x.ts` rồi `rm`). Đừng tin "cảm giác" — đo.
- **Realtime**: client dùng anon key (`/api/config`), polling 30s fallback.

---

## 17. (đã đặt ở đầu — xem mục 0 "START HERE")
```

> Nếu chỉ đọc 1 mục: đọc **mục 0 START HERE**. Nếu sắp viết code: đọc thêm **mục 5 (quyết định)**, **mục 10 (ràng buộc)**, **mục 16 (context kỹ thuật)**.
```
