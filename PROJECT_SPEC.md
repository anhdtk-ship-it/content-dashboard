# PROJECT_SPEC.md — Content Operations Dashboard

> **Tài liệu gốc (single source of truth).** Mọi thay đổi về kiến trúc, schema, sync, dashboard, API, phân quyền… **bắt buộc cập nhật vào file này**.
>
> Cập nhật lần cuối: 2026-09-16 — **§16.5: sắp xếp bảng Chi tiết theo Content (6 cột, bấm tiêu đề ▼▲)**. Trước đó 2026-09-11: gỡ auto-sync tức thời + Railway, chốt đồng bộ 1 lần/ngày 10:00 giờ VN trên Vercel (§3.1).
> Ký hiệu: ✅ đã triển khai · 🟡 một phần · 🔲 kế hoạch (chưa code)

---

## 1. Kiến trúc hệ thống

```
┌────────────────┐   service account    ┌─────────────────────┐
│  Google Sheets │ ───────────────────► │   Sync Engine (Node) │
│  "2026_S_FB…"  │   googleapis (read)  │   ts-node scripts    │
└────────────────┘                      └─────────┬───────────┘
                                                   │ upsert (service role)
                                                   ▼
                                        ┌─────────────────────┐
                                        │   Supabase (Postgres)│
                                        │  contents / logs / … │
                                        └─────────┬───────────┘
                                          service │ read       ▲ realtime (anon)
                                          role     ▼            │
                                        ┌─────────────────────┐ │
                                        │  Express API (V3)   │─┘
                                        │  src/server.ts:4000 │
                                        └─────────┬───────────┘
                                                  │ JSON /api/v3/*
                                                  ▼
                                        ┌─────────────────────┐
                                        │  SPA (public/index)  │
                                        │  Chart.js + hash nav │
                                        └─────────────────────┘
```

- **Backend**: Node.js + TypeScript (CommonJS, ts-node). Express 5 phục vụ API JSON + static SPA. ✅
- **Data store**: Supabase (Postgres + PostgREST + Realtime). ✅
- **Frontend**: SPA một file `public/index.html` — hash router 7 module, Chart.js + `@supabase/supabase-js` qua CDN, không build step. ✅
- **Nguồn dữ liệu gốc**: 1 Google Spreadsheet, đọc qua Service Account (read-only). ✅
- **Nguyên tắc**: dữ liệu thật 100% (không mock); mọi biến đổi nghiệp vụ (status_group, vòng đời…) thực hiện ở **tầng dashboard**, không đổi dữ liệu DB. ✅

**Stack & thư viện** (`package.json`): express, cors, dotenv, @supabase/supabase-js, googleapis, node-cron, zod, axios; dev: typescript, ts-node, nodemon, @types/*.

---

## 2. Database schema (Supabase)

### Bảng `contents` ✅
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint PK | surrogate |
| `content_code` | text | = "ID content 1" (KHÔNG unique toàn cục) |
| `title` | text | |
| `market` | text | `noi_dia` \| `quoc_te` (suy từ tên sheet) |
| `assignee_name` | text | Hiếu \| Ánh \| KA \| Liên |
| `cgsd` | text | chuyên gia trong content |
| `editor_name` | text | "Biên tập" |
| `trello_link` | text | |
| `upload_date` | text | gốc `dd/mm` (giữ nguyên) |
| `upload_date_real` | date | parse từ `upload_date`, năm 2026 |
| `test_date` | text | gốc `dd/mm` = Ngày Set Ads |
| `test_date_real` | date | parse từ `test_date` = **mốc bắt đầu vòng đời** |
| `current_status` | text | trạng thái ads gốc |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Ràng buộc**: `UNIQUE (content_code, market, assignee_name)` — khóa upsert (migration `002`).

### Bảng `sync_logs` ✅
`id` bigint PK · `started_at` · `finished_at` · `rows_read` int · `rows_inserted` int · `rows_updated` int · `status` text (`success`\|`partial`\|`failed`) · `error_message` text.

### Bảng `content_status_history` ✅ (tồn tại, **hiện 0 rows**)
`id` · `content_id` (FK → contents.id) · `status` text · `changed_at` timestamptz · `note` text.
→ Dùng cho timeline & lifecycle chính xác. Khi có dữ liệu, lifecycle tự chuyển từ **derived** sang **history**.

### Migrations (`sql/`)
- `001_fix_contents.sql` — `upload_date`→text, thêm `test_date`.
- `002_unique_key.sql` — dedupe + UNIQUE (content_code, market, assignee_name).
- `003_sync_logs.sql` — tạo `sync_logs` (lưu ý: bảng thực tế dùng `rows_inserted/rows_updated/error_message`).
- `004_date_real.sql` — thêm `upload_date_real`, `test_date_real` (DATE).

> ⚠️ Quy ước: **không sửa schema trực tiếp**; mọi thay đổi schema = 1 file migration mới `sql/00x_*.sql` + cập nhật mục này.

---

## 3. Sync Engine

**Mục tiêu**: đồng bộ 8 sheet hợp lệ → `contents` (idempotent, không tạo trùng).

- **Sheet hợp lệ (8)**: `NĐ Hiếu, QT Hiếu, NĐ Ánh, QT Ánh, NĐ KA, QT KA, NĐ Liên, QT Liên`.
- **Loại trừ tuyệt đối** (`EXCLUDED_SHEETS`): `QT Khiêm`, `NĐ Khiêm` — không đọc/đếm/log.
- **Mapping** (chi tiết: `mapping-spec.md`):
  - `content_code` ← "ID content 1"; `market`/`assignee_name` ← tên sheet (QT→quoc_te, NĐ→noi_dia).
  - `cgsd` ← CGSĐ; `editor_name` ← Biên tập; `trello_link` ← Link trello.
  - `upload_date` ← Ngày up trello; `test_date` ← Ngày test (Set Ads); `current_status` ← Trạng thái ads.
  - `*_real` sinh tự động từ text qua `parseDdmmToReal()` (năm 2026, sai → NULL).
- **Quy trình** (`src/sync-all-content.ts`):
  1. Đọc metadata → resolve tên sheet thật (chịu được khoảng trắng thừa, vd `QT Liên `).
  2. `batchGet` toàn bộ 8 sheet (1 request).
  3. Transform → record; **dedupe** theo `(content_code, market, assignee_name)` (last-wins).
  4. Pre-fetch khóa hiện có → phân loại Insert/Update.
  5. **Upsert theo lô 500** (`onConflict: content_code,market,assignee_name`).
  6. **Khử trùng (4b)**: xóa content "mồ côi" — khóa có trong `contents` nhưng KHÔNG còn trong Sheet. Bật/tắt qua `SYNC_PRUNE_STALE` (mặc định `true`). **Guard an toàn**: bỏ qua nếu upsert có lỗi, hoặc đọc Sheet < 1000 content, hoặc số mồ côi > `max(200, 30% DB)`.
  7. Ghi `sync_logs` + in `Rows Read / Inserted / Updated / Pruned / Errors / Duration`.
- **Backfill ngày** (`src/backfill-dates.ts`): tính lại `*_real` cho toàn bộ (update theo `id`, 25 luồng song song).
- **Đặc tính**: upsert + **khử trùng 1 chiều** (Sheet → DB; xóa dòng đã biến mất khỏi sheet, có guard). ✅ đồng bộ xóa stale (thay cho trạng thái kế hoạch trước đây).
- **Tự động hoá**: scheduler `node-cron` (`src/sync-scheduler.ts`, `npm run scheduler`) — `SYNC_ENABLED`/`SYNC_CRON`. Hoặc chạy tay: `npm run sync`.

### 3.1 Cách hệ thống tự đồng bộ — MỘT cơ chế DUY NHẤT (chốt 2026-09-11) ✅

> **Quyết định nghiệp vụ:** dữ liệu chỉ cần cập nhật **1 lần/ngày vào khung giờ cố định**. Mọi cơ chế đồng bộ gần-thời-gian-thực đã bị **gỡ bỏ hoàn toàn** khỏi code.

```
Vercel Cron native  ──GET + Authorization: Bearer <CRON_SECRET>──►  /api/cron/daily/content
   (vercel.json, "0 3 * * *" UTC = 10:00 giờ VN)                    /api/cron/daily/zalo
                                                                          │
                                                    runContentSync() / runZaloSync()
                                                    đọc Sheet → diff signature → upsert
                                                                          ▼
                                                                      Supabase
```

- **Route**: `GET|POST /api/cron/daily/content` và `/api/cron/daily/zalo` (`src/content-sync/dailyRoutes.ts`). Gọi thẳng service, **không qua hàng đợi/debounce**.
- **Lịch**: khai báo ở `vercel.json → crons`, `0 3 * * *` UTC = **10:00 giờ Việt Nam**.
- **⚠️ Độ chính xác**: gói Vercel **Hobby chỉ bảo đảm chạy TRONG KHOẢNG 1 GIỜ** quanh lịch. Đo thực tế 8 ngày liên tiếp (lịch cũ 10:30): luôn chạy trễ **~36 phút**. Vậy với lịch 10:00, dự kiến rơi vào khoảng **10:00–10:40**. Cần đúng phút thì phải dùng cron ngoài hoặc nâng gói Pro.
- **Bảo mật**: `CRON_SECRET`, đọc qua header `Authorization: Bearer` (khớp cách Vercel Cron native gửi). Chấp nhận cả GET lẫn POST; method khác → 405. Chưa cấu hình → 503, sai → 401.
- **`prune` LUÔN `false`** — hardcode tại route, không đọc env, không cho override. ⇒ **Content bị xoá khỏi Google Sheet sẽ KHÔNG bị xoá khỏi DB.** Muốn dọn "mồ côi" phải chạy tay `npm run sync` (CLI có prune + guard + nên backup trước).
- Sau mỗi lần sync thành công: `invalidateContentsCache()` / `zaloApi.invalidate()`.
- **Hệ quả trên giao diện**: Dashboard **không còn tự làm mới 30 giây**. Trang Tổng Quan hiển thị dòng "Dữ liệu cập nhật: …" lấy từ `sync_logs` (`/api/v3/sync-status`) để người xem biết độ tươi.

#### Đã GỠ BỎ (2026-09-11) — không khôi phục nếu không có yêu cầu rõ ràng
| Thành phần | Trạng thái |
|---|---|
| `POST /api/content-sync` + `GET /api/content-sync/status` (webhook Content) | ❌ xoá (`src/content-sync/routes.ts`) |
| `POST /api/zalo-sync` (webhook Zalo) | ❌ xoá (`src/platform/zalo/syncRouter.ts`) |
| `POST /api/cron/tick/content` · `/tick/zalo` | ❌ xoá (`src/content-sync/tickRoutes.ts`) |
| `DbSyncQueue` (debounce + max-wait + mutex) | ❌ xoá (`src/content-sync/DbSyncQueue.ts`) |
| `apps-script/ContentSync.gs` · `ContentSyncZalo.gs` | ❌ xoá cả thư mục |
| Env `CONTENT_SYNC_SECRET`, `ZALO_SYNC_SECRET`, `*_DEBOUNCE_MS`, `*_MAX_WAIT_MS` | ❌ không còn được đọc ở đâu — nên xoá khỏi Vercel |
| Bảng `sync_debounce` + 3 RPC (`sql/012`) | 🟡 **giữ nguyên trên Supabase** (không xoá dữ liệu), chỉ không còn được dùng. Migration `sql/012` giữ lại theo quy ước "không sửa/xoá migration đã áp dụng" |

**Lý do gỡ:** cơ chế này đã **chết âm thầm từ 2026-08-18** — Apps Script bắn webhook vào domain Railway đã bị xoá (xác nhận: `Application not found`), còn route tick thì chưa từng có cron ngoài nào gọi (`claimed_at`/`last_run_at` = null vĩnh viễn). Giữ lại code chết chỉ gây hiểu nhầm là hệ thống đang chạy realtime.

### 3.2 Chạy tay / theo lịch cục bộ

| Lệnh | Việc |
|---|---|
| `npm run sync` | Sync Content từ CLI — **CÓ prune** (theo `SYNC_PRUNE_STALE`, mặc định `true`) + guard an toàn. Dùng khi cần dọn content đã xoá khỏi Sheet. |
| `npm run zalo:sync` · `npm run zalo:verify` | Sync / đối soát Zalo (cần `ZALO_SHEET_ID`). |
| `npm run ads:import` · `npm run ads:verify` | Import / đối soát Ads (xem §11). |
| `npm run backfill` | Tính lại toàn bộ `*_real`. |
| `npm run scheduler` | node-cron chạy sync Content trên máy luôn-bật (`SYNC_ENABLED`/`SYNC_CRON`). KHÔNG dùng trên Vercel. |

---

## 4. Dashboard — App React (`web/`) ✅

> ⚠️ Bản vanilla `public/index.html` là **LEGACY, KHÔNG còn được serve** (server serve `web/dist`) — đừng sửa. Toàn bộ mô tả dưới đây áp dụng cho app React trong `web/`; điều hướng thực tế xem §4.10.

Filter toàn cục (sticky): **Thời gian** (9 preset + tùy chỉnh) · **Thị trường** · **Người nhận** · **Trạng thái** · nút Xóa lọc. Mọi KPI/biểu đồ/bảng đều theo filter. Realtime (anon key) + polling 30s. Drill-down đa tầng (set filter chồng nhau → Content Explorer). Loading skeleton + empty state.

**Chuẩn hóa `status_group`** (tầng dashboard, không đổi DB):
`Chờ chạy→CHO_CHAY` · `Chờ đăng bài→CHO_DANG_BAI` (đã test/duyệt xong, chờ lên lịch đăng — RIÊNG, KHÔNG gộp vào Chờ chạy/Tồn) · `Đang test→DANG_TEST` · `Duy trì - Chưa vít/Đã vít→DUY_TRI` · `Đã test-ko chạy / Đã chạy-Tắt→DA_DUNG` · `Không test→KHONG_TEST` · `Không được duyệt→KHONG_DUYET` · rỗng→`CHUA_PHAN_LOAI`.

**Định nghĩa chất lượng (current_status gốc)**: Đã được test = {Đang test, Duy trì*, Đã test-ko chạy, Đã chạy-Tắt}; **Thành công = {Duy trì*}** (CHỈ Duy trì Chưa vít + Đã vít — KHÔNG tính Đã chạy-Tắt); Thất bại = {Đã test-ko chạy}.
> **Tỷ lệ test thành công (chốt 2026-07-01)** = Thành công ÷ **Đã có kết quả cuối**, với Đã có kết quả cuối = {Duy trì*, Đã test-ko chạy, Đã chạy-Tắt} (**LOẠI** 'Đang test' vì chưa xong). Áp dụng ở `metrics()` (server), `AssigneesPage`, `MarketsPage`.

### 4.1 Dashboard Tổng Quan (`#/overview`) ✅
6 KPI nghiệp vụ + tooltip công thức: Content được cấp · Tỷ lệ đã được test · Tỷ lệ test thành công · Tỷ lệ đang test · Tỷ lệ tồn kho · Tỷ lệ không duyệt. Funnel + status bars + khối cảnh báo.

### 4.2 Dashboard Người Nhận (`#/assignees`) ✅
Bảng theo người nhận (6 KPI nghiệp vụ/người), sort theo tỷ lệ test thành công, click → Explorer.

### 4.3 Dashboard Thị Trường (`#/markets`) ✅
2 thẻ Nội Địa / Quốc Tế (6 KPI/thị trường) + tooltip, click → Người nhận.

### 4.4 Content Explorer (`#/explorer`) ✅
Bảng content có search/sort/lọc/phân trang; nhận drill-down (market/assignee/status/alert/age/codes/ended/sort). Cột: content_code, title, market, assignee, current_status, upload_date(_real), test_date(_real). Link Trello.

### 4.5 Vòng đời Content (`#/lifecycle`) ✅
**Vòng đời = số ngày kể từ Ngày Set Ads (`test_date_real`)** — KHÔNG dùng upload. Duy trì→hôm nay; Đã chạy-Tắt→ngày chuyển (history; derived = hôm nay). Lọc kỳ theo `test_date_real`.
KPI: Tuổi thọ TB · Đang duy trì lâu nhất · Đã từng duy trì lâu nhất · Mới vào Duy trì trong kỳ · Kết thúc trong kỳ. Biểu đồ: Tuổi thọ TB theo **Biên tập** / Người nhận / Thị trường · card nhỏ Phân bố vòng đời · **Top 20 đang duy trì lâu nhất** (STT, Content, Biên tập, Người nhận, Thị trường, Ngày test, Số ngày duy trì, Trạng thái — sort giảm dần). Trang chi tiết = Timeline. Retention 🟡 ẩn cho tới khi có `content_status_history`.

### 4.6 Quản lý Sync (`#/sync`) ✅
Độ phủ `*_real`, phân bổ thị trường, lịch sử `sync_logs`. 🔲 nút trigger sync từ UI (hiện chạy CLI).

### 4.7 Quản lý User 🔲 (kế hoạch)
CRUD user, gán vai trò (Admin/Viewer), liên kết Supabase Auth. Chưa code.

### 4.8 Cài đặt 🔲 (kế hoạch)
Cấu hình EXCLUDED_SHEETS, ngưỡng cảnh báo (test>7, duy trì>180…), năm mặc định parse ngày, lịch auto-sync. Chưa code.

### 4.9 Ghi chú refactor React (`web/`) — chuẩn hóa tên & filter (S3-001.2)
Chỉ áp dụng cho **frontend React** (`web/`); bản vanilla `public/index.html` giữ nguyên. Chỉ đổi UI/UX và tên hiển thị — KHÔNG đổi DB/API/query/logic KPI/lifecycle.
- **Đổi tên dashboard:** "Dashboard Người Nhận" (`#/assignees`) → **"Tiến độ Test Content"** (đồng bộ menu Sidebar, Header/Breadcrumb, page title, `document.title`). Thuật ngữ "Người"/"Người nhận" → **"Nhân viên Ads"** trên toàn bộ giao diện React (cột bảng, biểu đồ, drawer chi tiết).
- **KPI "Tiến độ Test Content":** ngoài Tỷ lệ đã test · Tỷ lệ test thành công · Tuổi thọ content TB, hiển thị thêm số content **đang duy trì > 30 / > 60 / > 90 / > 180 ngày** (đếm theo `maintainDays`, cùng logic đã có ở Dashboard Thị Trường — không đổi công thức KPI).
- **Filter dùng chung (`GlobalFilter`):** Tổng Quan · Tiến độ Test Content · Thị Trường · **Vòng đời Content** đều dùng cùng `GlobalFilter` (5 field: Thời gian · Địa lý · Nhân viên Ads · Biên tập · Trạng thái). Vòng đời Content trước đây dùng FilterBar riêng ("Tất cả TT"/"Người") nay đã thay bằng `GlobalFilter`. Lưu ý: endpoint `/api/v3/lifecycle` không nhận `editor`/`status` nên 2 field này hiển thị để đồng bộ giao diện nhưng KHÔNG ảnh hưởng dữ liệu Vòng đời (giữ nguyên query: `from/to/market/assignee`).


### 4.10 Điều hướng thực tế (`web/main.tsx` — NAV theo Platform) ✅

Sidebar gom theo **nền tảng**, mỗi nhóm expand/collapse và tự mở nhóm chứa trang đang xem:

| Nhóm | Mục menu → route |
|---|---|
| 🏠 (đơn) | Dashboard → `#/overview` |
| 📘 **Facebook** | 📋 Tổng quan `#/overview` · 📝 Weekly Report `#/weekly-report` · 🔎 Content Explorer `#/explorer` · ♻️ Vòng đời Content `#/lifecycle` · 📡 Ads Monitor `#/ads-monitor` · 💰 Phân bổ ngân sách `#/budget-allocation` · 📊 Phân tích Data Content `#/content-analytics` · 📈 Phân tích Hiệu quả Content `#/content-performance` |
| 💬 **Zalo** | 📋 Tổng quan `#/zalo` · 📝 Weekly Report `#/zalo-weekly` |

- **Route ẩn khỏi menu nhưng VẪN truy cập được qua URL:** `#/usage` ("Tiến độ Content" — ẩn theo yêu cầu, commit `058055c`), `#/assignees` ("Tiến độ Test Content"), `#/markets`, `#/analytics`.
- **Route còn là Stub** (chưa dựng màn hình): `#/sync`, `#/users`, `#/settings` — khớp với §4.6/4.7/4.8.
- Thêm nền tảng mới (TikTok…) chỉ cần thêm 1 object nhóm trong `NAV` — không phải sửa lại cấu trúc.
- ⚠️ **Nợ kỹ thuật UI:** `NotificationArea` và `UserMenu` trong `main.tsx` đang là **dữ liệu giả hardcode** (3 thông báo mẫu; tên/email/vai trò cố định) — chưa nối với user thật đang đăng nhập qua `AuthGate`.

---

## 5. Authentication / Phân quyền ✅ Auth live · 🟡 Role chưa dùng để phân quyền

> **ĐẢO NGƯỢC quyết định trước đây ("KHÔNG auth, dùng Share Link")**: kể từ commit `105f1a5`, app **CÓ** Authentication. Chi tiết vận hành/luồng đăng nhập đầy đủ: `CURRENT_STATE.md` (mục Authentication) + `PROJECT_HANDOFF.md §9`.

- **Cơ chế ✅:** Supabase Auth (Google OAuth), chỉ chấp nhận email domain **`@seryn.vn`** (env `AUTH_ALLOWED_DOMAIN`). Sau đăng nhập, `requireAuth` (`src/auth/authMiddleware.ts`) xác thực JWT qua Supabase Admin → check domain → tra bảng `users` → 403 nếu `is_active=false` hoặc sai domain → **auto-provision** user mới (role mặc định `viewer`, `is_active=true`) nếu lần đầu đăng nhập.
- **Bảng `users` ✅** (`sql/008_users.sql`): `email`, `role`, `is_active`. RLS bật, **không có policy** cho anon/authenticated → chỉ service_role (server) truy cập được.
- **Route bảo vệ ✅:** `/api/v3/*`, `/ads-monitor`, `/api/zalo`, `/api/content-analytics`, `/api/content-performance`. **Route public (không auth):** `/health`, `/api/config`, `/api/cron/daily/*` (secret `CRON_SECRET` riêng), `/api/test-sync/*` (secret riêng), static SPA (Vercel serve).
- **Frontend ✅:** `web/main.tsx` bọc app trong `AuthGate` + `installAuthFetch()` (tự gắn header `Authorization: Bearer <JWT>`). Chưa đăng nhập → `LoginPage`; 403 → màn hình chặn truy cập.

| Vai trò | Quyền hiện tại | Quyền dự kiến (🔲 chưa code) |
|---|---|---|
| **Admin** | Giống Viewer (chưa phân biệt) | Toàn quyền: xem mọi dashboard, chạy sync, quản lý user, sửa cài đặt |
| **Viewer** (mọi email `@seryn.vn` hợp lệ) | Xem đầy đủ mọi dashboard (Content/Ads/Zalo/Budget/Weekly Report) | Chỉ đọc; không sync/không cài đặt/không quản lý user |

- **🔲 Còn thiếu:** cột `role` đã lưu nhưng **CHƯA** có logic nào đọc/chặn theo role — mọi user hợp lệ quyền ngang nhau. Muốn phân quyền thật cần thêm check `role` trong `authMiddleware` hoặc ở từng route nhạy cảm.
- **⚠️ Vận hành cần đảm bảo trên Vercel:** bật Google provider + OAuth Client ID/Secret (Supabase Dashboard + Google Cloud Console) + Redirect URL trỏ đúng domain Vercel; set `SUPABASE_ANON_KEY`; đã chạy `sql/008_users.sql`; có ít nhất 1 user trong bảng `users` (auto-provision sẽ tự tạo khi đăng nhập lần đầu).

---

## 6. Luồng dữ liệu

```
Google Sheets (8 sheet hợp lệ, trừ *Khiêm)
        │  googleapis read · Service Account
        ▼
Sync Engine  ── transform + dedupe + parse *_real ──►  upsert(onConflict)
        ▼
Supabase  contents / sync_logs / content_status_history
        │  Express API (service role) · cache TTL 10s
        ▼
/api/v3/*  ── status_group / metrics / lifecycle (derived) ──►
        ▼
Dashboard React (tải khi mở trang / đổi bộ lọc — KHÔNG còn polling 30s)
```

Nhịp cập nhật: **1 lần/ngày lúc 10:00 giờ VN** (Vercel Cron → `/api/cron/daily/*` → Sync → Supabase). Người xem mở trang Tổng Quan sẽ thấy dòng "Dữ liệu cập nhật: …" lấy từ `sync_logs`. Cần dữ liệu mới ngay giữa ngày → chạy tay `npm run sync` (xem §3.2).

---

## 7. API (Express — base local `http://localhost:4000`)

> Toàn bộ route dựng trong `src/app.ts` (`createApp()`). Production chạy trên **Vercel** qua `api/index.ts`; `src/server.ts` chỉ dùng cho local dev (thêm static `web/dist` + SPA fallback + `.listen()`).
> Query filter chung của Content FB: `from,to` (YYYY-MM-DD) · `market` · `assignee` · `status` · `dateField` (`upload_date_real`|`test_date_real`).

### 7.1 Public — KHÔNG qua `requireAuth` (mỗi route có secret riêng)
| Method · Path | Vai trò |
|---|---|
| `GET /health` | Health check ✅ |
| `GET /api/config` | Trả `url` + `anonKey` cho Supabase client (realtime + Auth) ✅ |
| `GET|POST /api/cron/daily/content` · `/api/cron/daily/zalo` | **Đồng bộ hằng ngày 10:00 giờ VN** — CƠ CHẾ SYNC DUY NHẤT (Vercel Cron native, `Authorization: Bearer <CRON_SECRET>`), `prune` hardcode `false` — xem §3.1 ✅ |
| `POST /api/test-sync/content` · `/api/test-sync/zalo` | **TEST ONLY** — chạy Sync thật để đo thời gian trên serverless; `prune:false` CỨNG; secret RIÊNG `VERCEL_TEST_SYNC_SECRET` (không fallback secret khác; chưa cấu hình → 503) ✅ |

### 7.2 Bảo vệ bằng `requireAuth`
| Method · Path | Vai trò |
|---|---|
| `GET /api/auth/me` | Kiểm tra JWT + domain + `is_active`, auto-provision user mới ✅ |
| `GET /api/v3/summary` | KPI, metrics nghiệp vụ, `contentKpi`, funnel, byAssignee, byMarket, byStatus, alerts, trend (`trend=day\|week\|month`) ✅ |
| `GET /api/v3/contents` | Danh sách + phân trang (`page,pageSize`) + `q` + drill (`alert,ageMin,ageMax,codes,endedExact,sort`) ✅ |
| `GET /api/v3/sync-status` | Độ phủ ngày + `sync_logs` gần nhất ✅ |
| `GET /api/v3/lifecycle` | KPI vòng đời, byEditorAvg/byAssigneeAvg/byMarketAvg, distribution, top20 (lọc kỳ theo `test_date_real`) ✅ |
| `GET /api/v3/lifecycle-table` | Danh sách đã tính `ageDays`/`maintainDays` (client tự lọc/export) ✅ |
| `GET /api/v3/content-detail` | Chi tiết 1 content + timeline (`code,market,assignee`) ✅ |
| `GET /ads-monitor` | Ads Monitor server-side qua RPC `ads_monitor_query` — xem §11 ✅ |
| `GET /api/zalo/{summary,contents,weekly,sync-status,settings}` · `PUT /api/zalo/settings` | Module Zalo — xem §13 ✅ |
| `GET /api/content-analytics` | Phân tích Data Content Mới/Cũ — xem §15 ✅ |
| `GET /api/content-performance` | Phân tích Hiệu quả Content (Cost/ROAS/CLĐT) — xem §16 ✅ |

> Quy ước: tham số mới phải **tùy chọn** (không phá hành vi mặc định của module khác). Lỗi trả `{ error }` + HTTP 500.

---

## 8. Folder structure

```
content-dashboard/
├── PROJECT_SPEC.md          ← tài liệu gốc (file này) · CURRENT_STATE.md · PROJECT_HANDOFF.md
├── PROJECT_BACKLOG.md · DESIGN_SYSTEM.md · WIREFRAMES.md · mapping-spec.md · ZALO_SETUP.md
├── PHASE_12_AUTO_SYNC.md · PHASE_13_PLATFORM.md · reviews R2–R6
├── package.json · tsconfig.json · vite.config.ts · tailwind.config.js
├── vercel.json              ← buildCommand/outputDirectory/rewrites/maxDuration + crons native 10:30
├── .env (gitignored) · .env.example (commit) · credentials/ (gitignored)
├── api/
│   └── index.ts             ← entry VERCEL (serverless): export createApp(), KHÔNG static/SPA/listen
├── src/
│   ├── app.ts               ← createApp(): TOÀN BỘ route API + transform/aggregation Content
│   ├── server.ts            ← entry LOCAL/RAILWAY: createApp() + static web/dist + SPA fallback + listen()
│   ├── auth/                ← authMiddleware.ts (requireAuth) · routes.ts (/api/auth/me)
│   ├── content-sync/        ← ContentSyncService.ts (nguồn logic sync DUY NHẤT)
│   │                           · dailyRoutes.ts (Vercel Cron 10:00 — route sync duy nhất)
│   ├── test-sync/routes.ts  ← TEST ONLY, secret riêng VERCEL_TEST_SYNC_SECRET (§7.1)
│   ├── ads-monitor/         ← types · calculateAdsStatus · AdsMonitorRepository/Service/routes
│   │                           · GoogleSheetAdsSyncProvider · import.ts · verify.ts · ads-scheduler.ts · mock.ts
│   ├── platform/            ← db.ts · types.ts · registry.ts · facebook/ · zalo/ (§13)
│   ├── content-analytics/   ← §15 — Provider · Service · routes · types
│   ├── content-performance/ ← §16 — PerformanceSheetProvider · QualitySheetProvider · Service · routes · types
│   ├── shared/weeklyMetrics.ts ← KPI Weekly DÙNG CHUNG web + PDF (§12.2)
│   ├── google-auth.ts       ← GoogleAuthFactory (createGoogleAuth/createSheetsClient)
│   ├── sync-all-content.ts (CLI wrapper) · sync-scheduler.ts · backfill-dates.ts · date-util.ts
│   ├── sheets-reader.ts · transform-content.ts · analyze-headers.ts · check-duplicates.ts
│   ├── zalo-sync.ts · zalo-seed.ts · zalo-verify.ts · test-google-connection.ts
│   └── components/ui/ · components/layout/   ← thư viện UI dùng chung (Sidebar, DataTable, KPICard…)
├── web/                     ← APP REACT (Vite 8 + React 19 + Tailwind v4) — đây là frontend ĐANG CHẠY
│   ├── main.tsx (NAV + router hash + AuthGate) · styles.css · GlobalFilter.tsx · editor-name.ts
│   ├── OverviewPage · AssigneesPage · MarketsPage · ExplorerPage · LifecyclePage · UsagePage
│   │   · AnalyticsPage · UsageCompare · AlertDrawer · Tabs
│   ├── auth/ · ads-monitor/ · budget/ · zalo/ · reports/
│   └── content-analytics/ · content-performance/
├── reports/                 ← build_weekly_data.ts + weekly_report_pdf.py · build_zalo_weekly_data.ts
│                               + zalo_report_pdf.py (reportlab.platypus) · report.json · report_zalo.json
├── apps-script/             ← ContentSync.gs · ContentSyncZalo.gs (trigger webhook từ Google Sheet)
├── sql/ 001..012_*.sql      ← migrations (chạy TAY trong Supabase SQL Editor)
├── public/index.html        ← Dashboard VANILLA (LEGACY — KHÔNG còn được serve; ĐỪNG sửa)
├── output/ · backup/        ← JSON/CSV/XLSX xuất ra (không phải nguồn dữ liệu)
├── run-ads-import.bat + ads-import.log ← wrapper Windows Task Scheduler chạy ads:import 09:35
└── .claude/launch.json      ← cấu hình preview (port 4000)
```

---

## 9. Coding convention

- **Ngôn ngữ**: TypeScript strict, CommonJS (`module: commonjs`, `moduleResolution: node`, `types: ["node"]`). Chạy bằng `ts-node` (không build).
- **Đặt tên file**: kebab-case (`sync-all-content.ts`). Hàm/biến: camelCase. Hằng cấu hình: UPPER_SNAKE (`EXCLUDED_SHEETS`, `BATCH_SIZE`).
- **Comment**: tiếng Việt, giải thích "tại sao", đặt trên block logic nghiệp vụ.
- **Nguyên tắc dữ liệu**:
  - Không mock — luôn lấy từ Supabase/Sheets thật.
  - Biến đổi nghiệp vụ (status_group, metrics, vòng đời) ở **tầng dashboard/API**, KHÔNG ghi DB.
  - Sync **idempotent** theo `(content_code, market, assignee_name)`; dedupe đầu vào.
  - Ngày `dd/mm` thiếu năm → lưu text gốc + cột `*_real` (năm 2026), sai → NULL.
- **API**: tham số mới phải optional; không phá module hiện có. Lỗi trả `{ error }` + HTTP 500.
- **Bảo mật**: `service_role` chỉ phía server; `anon` chỉ cho realtime client. `.env` & `credentials/*.json` không commit.
- **Migration**: mọi thay đổi schema = file `sql/00x_*.sql` mới + cập nhật mục §2.
- **Frontend**: 1 file SPA, hash router; ưu tiên số/bảng/thanh tiến độ hơn biểu đồ; escape HTML mọi giá trị động.

---

## 10. Checklist toàn bộ project

### Hạ tầng & dữ liệu
- [x] Kết nối Google Sheets (Service Account) — qua `GoogleAuthFactory` (`GOOGLE_CREDENTIALS_JSON` ưu tiên cho cloud)
- [x] Supabase: `contents`, `sync_logs`, `content_status_history`
- [x] Migrations 001–011 đã áp dụng
- [x] Migration `sql/012` đã áp dụng (bảng `sync_debounce` tồn tại) — **nhưng không còn được dùng** sau khi gỡ debounce; giữ nguyên trên Supabase, không xoá
- [x] Sync Engine (upsert idempotent + dedupe + diff signature + `sync_logs`)
- [x] Backfill `*_real`
- [x] Loại trừ `QT/NĐ Khiêm`
- [x] Auto-sync: **1 cơ chế DUY NHẤT** — Vercel Cron native gọi `/api/cron/daily/*` lúc 10:00 giờ VN (§3.1). Cơ chế webhook + debounce + tick đã gỡ bỏ ✅
- [x] Đồng bộ xóa content stale (1 chiều Sheet → DB, có guard; `prune` TẮT ở mọi route cron/test)
- [ ] Ghi `content_status_history` khi đổi `current_status` 🔲 (chặn Retention + làm "Duy trì tháng" chỉ là proxy)

### Dashboard
- [x] Filter toàn cục + drill-down + realtime + skeleton/empty
- [x] Tổng Quan · Tiến độ Test Content · Thị Trường · Content Explorer · Vòng đời Content
- [x] Ads Monitor · Weekly Report (FB) · Zalo + Weekly Zalo · Budget Allocation
- [x] Content Analytics (§15) · Content Performance (§16)
- [ ] Trigger sync từ UI 🔲 (route `#/sync` hiện là Stub)
- [ ] Retention Curve (chờ `content_status_history`) 🟡
- [ ] Quản lý User 🔲 · Cài đặt 🔲 (cả hai vẫn là Stub trong `web/main.tsx`)
- [ ] Persist phần soạn tay II/III của Weekly Report 🔲 · Export DOCX 🔲

### Phân quyền & vận hành
- [x] Supabase Auth (đăng nhập Google, domain `@seryn.vn`) ✅
- [ ] Role Admin / Viewer — cột đã lưu, **logic phân quyền CHƯA code** 🟡
- [x] RLS bật trên bảng `users` (chỉ service_role) ✅
- [x] Deploy **Vercel** (`content-dashboard-five-kappa.vercel.app`) — Railway đã ngưng hoàn toàn, domain cũ trả 404 ✅
- [x] **Đã cutover sang Vercel** — kiểm chứng 2026-09-11: `sync_logs.source='daily-cron'` (Vercel Cron native) chạy đều hằng ngày ✅
- [x] Đồng bộ tự động: **1 lần/ngày lúc 10:00 giờ VN** qua Vercel Cron native (§3.1) — cơ chế duy nhất ✅
- [x] Import Ads hằng ngày 09:35 qua Windows Task Scheduler (máy cục bộ) — chưa chuyển lên hạ tầng luôn-bật 🟡

### Tài liệu
- [x] `mapping-spec.md`
- [x] `PROJECT_SPEC.md` (file này — tài liệu gốc)
- [ ] `PROJECT_BACKLOG.md` **đã lỗi thời** — vẫn ghi Sprint 4 (Auth) "Cancelled / dùng Share Link" dù Auth đã live 🔲
- [ ] `PROJECT_HANDOFF.md` mới cập nhật tới HEAD `7852d1a` (31/07/2026) — chưa có §15/§16 và các thay đổi tháng 8–9 🔲

---

## 11. Ads Monitor (module độc lập) — PHASE 5: tối ưu chịu tải 100k–500k+

> Module ĐỘC LẬP với Dashboard Content (không dùng chung service/repo/bảng). `status` KHÔNG lưu.
> **PHASE 7 — Lifecycle + Current Status (xem §11.5):** trạng thái KHÔNG còn chỉ dựa amount. Quy tắc: chi tiêu **ngày mới nhất trong kỳ = 0** → "Đã tắt"; >0 → theo **Lifecycle** (NEW→Mới chạy · TEST→Đang test · MAINTAIN→Đang duy trì). *(Ngưỡng amount cũ `≤100k/≤4.999.999/≥5tr` đã BỎ.)*

### 11.1 Schema (`sql/005_ads_monitor.sql`) — mô hình LƯU LỊCH SỬ THEO NGÀY
- Bảng `ads_monitor(id, content, location, ads_owner, page_code, amount_spent, updated_at, created_at, sheet_date NOT NULL)`. **KHÔNG có cột `status`.**
- **Khóa snapshot:** `UNIQUE (page_code, content, sheet_date)` (thay cho `(page_code, content)` cũ — đã đổi để **giữ lịch sử theo ngày**, không ghi đè).
- **VIEW `ads_monitor_latest`** = `DISTINCT ON (page_code, content) … ORDER BY sheet_date DESC` → "mới nhất" cho mỗi quảng cáo.
- **FUNCTION `ads_monitor_query(...)`** (plpgsql, STABLE): nhận filter + phân trang + sort, trả JSON `{ kpi, total, items }` — KPI bằng `COUNT/SUM/FILTER`, list bằng `LIMIT/OFFSET`, tất cả ở SQL.

### 11.2 Index (giải thích)
- `ads_monitor_daily_key UNIQUE (page_code, content, sheet_date DESC)` — idempotent upsert theo ngày **+** phục vụ `DISTINCT ON` của view latest.
- `ads_monitor_sheet_date_idx (sheet_date)` — lọc theo ngày/khoảng ngày + truy vấn lịch sử.
- `ads_monitor_owner_idx (ads_owner)` — lọc "Nhân viên Ads".
- *Cố ý KHÔNG tạo:* `page_code` (đã là prefix của khóa), `amount_spent` (lọc trên tập latest nhỏ), `location` (cardinality cực thấp), `content` (ILIKE substring → btree vô dụng; dùng `pg_trgm` nếu cần sau).

### 11.3 API — `GET /ads-monitor` (SERVER-SIDE)
- Query params: `page, pageSize, content, adsOwner, location, pageCode, status, month (YYYY-MM) | sheetDate | dateFrom/dateTo, sortField, sortDirection`.
- **Bộ lọc Tháng:** `month=YYYY-MM` (vd `2026-06`) → route đổi thành range `sheet_date >= 'YYYY-MM-01' AND <= 'YYYY-MM-<ngày cuối>'` (trên cột DATE = `< đầu tháng kế tiếp`; range scan dùng index `sheet_date`, KHÔNG dùng EXTRACT/MONTH). Ưu tiên: `month` > `sheetDate` > `dateFrom/dateTo`. Frontend mặc định **tháng hiện tại**, lọc 100% ở server.
- Trả: `{ items, summary, total, page, pageSize, totalPages, source, owners, generatedAt }`. `source` = `supabase|mock`. `owners` = distinct `ads_owner` toàn bảng (bộ lọc "Nhân viên Ads" **động** — KHÔNG hardcode; đã bỏ Minh/Trang mock).
- **Loại trừ nhân viên:** `ads_monitor_query` loại `ads_owner ∈ {Khiêm}` khỏi MỌI tính toán (KPI/bảng/tổng/owners) — `where coalesce(ads_owner,'') <> all(array['Khiêm'])`. Mở rộng list tại function + `EXCLUDED_OWNERS` (mock). *(Còn `Br/BR/S` là dữ liệu nhiễu do `ads_owner`=token đầu adset_name — chưa lọc, chờ quyết định.)*
- **KHÔNG còn `findAll()` tải toàn bộ.** Filter/sort/phân trang/KPI đều ở SQL (function). Repository fallback **mock** (tính trong RAM, ~30 dòng) khi bảng/function chưa tồn tại.

### 11.4 Import (`npm run ads:import`) + Mapping Sheet thật (PHASE 6 — Go Live)
- Upsert theo khóa `(page_code, content, sheet_date)`; `sheet_date` rỗng → ngày chạy import. Import lại cùng ngày = idempotent; ngày khác = dòng mới (giữ lịch sử). Verify: `npm run ads:verify`.
- **Nguồn thật:** `ADS_SHEET_TAB=Raw_Data` — export **Facebook Ads cấp ad/ngày** (cột `date, account_*, campaign_name, adset_name, ad_name, amount_spent, ...`). KHÁC giả định 6-cột ban đầu.
- **Mapping (`GoogleSheetAdsSyncProvider`, suy luận từ dữ liệu — GIẢ ĐỊNH, cần nghiệp vụ xác nhận):**
  - `content ← ad_name` · `page_code ← adset_name` · `ads_owner ← token đầu adset_name` · `location ← 'TQ'|'NN' tách từ campaign_name` · `sheet_date ← date`.
  - `amount_spent ← SUM` theo `(page_code, content, sheet_date)` (gộp các bản sao ad trong cùng ngày) ⇒ **chi tiêu/NGÀY**.
- **⚠️ Ngữ nghĩa cần chốt:** ngưỡng status (`≥5tr`…) đang áp trên chi tiêu/ngày của ngày mới nhất → ad không chi ngày cuối = "Đã tắt". Nếu muốn theo chi tiêu **tích lũy/đời**, đổi cách gộp ở provider (chưa làm).
- Kết quả import lần đầu: 9423 dòng thô (lịch sử 2026-03-23→06-28), 886 ad ở VIEW latest.

### 11.5 Lifecycle + Current Status (PHASE 7 — `sql/006_ads_lifecycle.sql`)
- **Lifecycle (nội bộ, KHÔNG hiển thị):** `NEW | TEST | MAINTAIN`, lưu ở bảng **`ads_monitor_lifecycle`** (PK `(page_code, content)`), theo **tổng chi tiêu ĐỜI** (mọi ngày): `>3.000.000` MAINTAIN · `>100.000` TEST · còn lại NEW. **Monotonic — chỉ nâng, không hạ.**
- **Cập nhật Lifecycle:** function **`ads_monitor_refresh_lifecycle()`** (set-based, ON CONFLICT giữ hạng cao hơn). Gọi **sau mỗi import** (`import.ts`), KHÔNG tính lại khi mở dashboard. Backfill từ lịch sử = chạy 1 lần (đã nhúng cuối `sql/006`).
- **Trạng thái hiển thị (tính ở `calculateAdsStatus(latestAmount, lifecycle)` + KPI `CASE WHEN` SQL):**
  - `latest_amount` = chi tiêu của **NGÀY DỮ LIỆU MỚI NHẤT trong kỳ** (global `max(sheet_date)`), KHÔNG phải ngày-cuối-riêng-của-content. **Sheet FB bỏ qua ngày không chi tiêu** → content không có dòng ngày mới nhất ⇒ `latest_amount = 0` ⇒ **Đã tắt** (đúng "ngừng chi tiêu = tắt").
  - `latest_amount = 0` → **Đã tắt** (bỏ qua lifecycle). `> 0` → NEW→**Mới chạy** · TEST→**Đang test** · MAINTAIN→**Đang duy trì**.
- **`ads_monitor_query`** (thay bản 005): trả thêm `latest_amount`, `lifecycle`; KPI đếm theo (latest_amount, lifecycle). "Tổng chi tiêu" (`amount_spent`) = SUM trong kỳ — KHÔNG quyết định trạng thái.
- **Thứ tự triển khai:** chạy `sql/006` TRƯỚC khi deploy code Phase 7 (code mới đọc `latest_amount`/`lifecycle` từ function).

---

## 12. Weekly Report (module độc lập) — PHASE 8

> Module **Reports → Weekly Report** (`web/reports/`, route `#/weekly-report`). ĐỘC LẬP — KHÔNG dùng chung logic Content/Ads, KHÔNG đọc Google Sheet, KHÔNG đổi DB/API. **Chỉ đọc `/api/v3/summary`** (Single Source of Truth).

### 12.1 Nguồn dữ liệu & luồng + Service riêng
**BUSINESS RULE RIÊNG** (§5): KHÔNG dùng `calculateAdsStatus()`, Lifecycle (Ads), hay metrics()/status-set của Dashboard. `WeeklyReportService` (`services/WeeklyReportService.ts`) tự đọc **dữ liệu thô** qua `/api/v3/contents?from&to` (phân trang) rồi tự tính KPI: `calculateWeeklyKPIs()` + `calculateWeeklyEmployeeReport()`. "Đã cấp" theo Ngày Up Trello (dateField mặc định). Bộ lọc: **Khoảng thời gian TÙY CHỈNH** (Từ/Đến chọn theo ngày, mặc định tuần hiện tại). *(Đã BỎ bộ lọc Địa lý.)* Group theo `assignee_name` = **Nhân viên Ads** (KHÔNG dùng `editor_name`/Biên tập).

### 12.2 Công thức KPI (RIÊNG — nguồn DUY NHẤT: `src/shared/weeklyMetrics.ts`)

> **Đã rà soát lại 2026-09-11 để khớp 100% với code.** `weeklyMetrics.ts` là module **PURE** (không I/O, không DOM) được import bởi CẢ `web/reports/services/WeeklyReportService.ts` (Dashboard) **và** `reports/build_weekly_data.ts` (PDF) ⇒ web và PDF **không thể lệch số**. Muốn đổi công thức: sửa DUY NHẤT file này.

Ký hiệu: **cohort** = content có `upload_date_real` nằm trong kỳ `[from, to]`. `Duy trì*` = mọi trạng thái bắt đầu bằng "Duy trì".

| KPI | Công thức thật (code) | Phạm vi |
|---|---|---|
| **Đã cấp** (`capped`) | đếm cohort | trong kỳ |
| **Đã test** (`tested`) | cohort & `current_status ∈ {Đang test, Duy trì*, Đã test-ko chạy, Đã chạy-Tắt}` | trong kỳ |
| **Tồn** (`ton`) | cohort & `current_status === 'Chờ chạy'` — **ĐÚNG trạng thái này, không gì khác** (kể cả trống/chưa phân loại) | trong kỳ |
| **Chờ đăng bài** (`choDangBai`) | cohort & `current_status === 'Chờ đăng bài'` — nhóm **RIÊNG**, KHÔNG cộng vào Tồn | trong kỳ |
| **Tỷ lệ test** (`rateTest`) | `Đã test / Đã cấp` | trong kỳ |
| **Duy trì tháng** (`duyTriThang`) | cohort & đang `Duy trì*` | trong kỳ |
| **Tỷ lệ Duy trì** (`rateDuyTri`) | `Duy trì tháng / Đã test` | trong kỳ |
| **Đang duy trì** (`dangDuyTri`) | TOÀN BỘ content đang `Duy trì*` | **ALL-TIME**, không giới hạn kỳ |

- ⚠️ **"Duy trì tháng" là PROXY**: hệ thống KHÔNG lưu ngày đổi trạng thái (`content_status_history` rỗng) nên chỉ đo được "hiện đang Duy trì" chứ không phải "đã chuyển sang Duy trì trong kỳ".
- **Cấu trúc báo cáo** (`buildWeeklyReport`): 2 khối market **Nội địa / Quốc tế**; trong mỗi khối, nhân viên xếp theo `EMPLOYEE_ORDER = [Hiếu, KA, Liên, Ánh]` (người ngoài danh sách xếp sau, A→Z) và **ẩn nhân viên có `capped = 0` và `dangDuyTri = 0`** ở market đó. Group theo `assignee_name` = Nhân viên Ads (KHÔNG dùng `editor_name`).
- **Ngưỡng Rule Engine** (cũng nằm trong `weeklyMetrics.ts`): `rateTest < 0.7` → cảnh báo chậm đưa vào Ads · `ton >= 3` → ưu tiên xử lý tồn · `choDangBai >= 3` → ưu tiên lên lịch đăng · `rateDuyTri >= 0.1` → ghi nhận tốt · `dangDuyTri >= 5` → quản lý ổn định.
- KHÔNG dùng chung logic với Ads Monitor / Dashboard Content (Business Rule riêng — xem §9 `PROJECT_HANDOFF.md`).

### 12.3 Cấu trúc báo cáo (PHASE 9 — print-friendly, `ReportDocument`)
Bố cục **văn bản** (KHÔNG KPICard/biểu đồ/bảng Excel), dùng CHUNG cho web + in.
- **I. Tiến độ Content** (PHASE 11): Tổng quan team (5 KPI: Đã cấp · Không test · Chờ chạy (Tồn) · Đang test · Content test win) + **bảng "Theo từng nhân viên"** (cột: Nhân viên · Đã cấp · Không test · Chờ chạy · Đang test · Content test win; hàng nhân viên động + dòng **Tổng** nổi bật). Header nền xám nhạt, không card/biểu đồ/màu đậm; nền header+Tổng giữ khi in (`print-color-adjust: exact`).
- **II. Đánh giá**: theo nhân viên — **Đánh giá (≤2)** + **Hành động tuần tới (≤2)**, sinh bằng **RULE ENGINE** (`services/ruleEngine.ts`): độc lập theo KPI của chính nhân viên (ngưỡng cố định; KHÔNG xếp hạng / so sánh / trung bình team), mỗi ý gắn **KPI cụ thể** + hành động rõ ràng. Nhập tay được.
- **III. Kế hoạch tuần tới**: checklist (☐) lấy từ Hành động tuần tới của từng nhân viên.
- **Chế độ Xem trước** (toggle); phần II/III lưu **cục bộ** (CHƯA persist).

### 12.4 Xuất PDF = IN báo cáo (PHASE 9)
- **PDF = bản in của chính `#report-doc`** qua `window.print()` — KHÔNG template/HTML/component riêng. Mọi thay đổi Weekly Report tự phản ánh khi in.
- **`@media print`** (`web/styles.css`): @page A4 portrait + lề; ẩn chrome (`aside`/`header`/`.no-print`); chữ đen nền trắng; footer số trang `counter(page)`; `.emp-block { break-inside: avoid }` → không cắt block nhân viên giữa trang.
- **Header lặp mỗi trang** = đặt trong `<thead>` của `<table id="report-doc">` (`display: table-header-group`) → trình duyệt tự lặp **và chừa chỗ**, KHÔNG đè nội dung (đã fix lỗi "lồng chữ đầu trang" của `position:fixed`).
- Copy (đã chạy) · DOCX (`enabled:false`, để dành). Nút "Xuất PDF" ép Xem trước rồi `window.print()`.

### 12.5 Mở rộng Monthly Report
Tái dùng `WeeklyReportService` + `ruleEngine` + `ReportDocument` + print CSS; chỉ đổi `utils/week`→`utils/month`, thêm route `#/monthly-report`.

---

## 13. Module ZALO (ZALO-01) — Đa nền tảng, ĐỘC LẬP Facebook

Facebook = **Stable Version** (không đụng). Zalo là module thêm mới hoàn toàn; kiến trúc `platform` sẵn cho nền tảng kế (TikTok…) chỉ bằng cách thêm 1 Platform. Chi tiết vận hành: [`ZALO_SETUP.md`](ZALO_SETUP.md).

### 13.1 Schema (`sql/010_zalo.sql`, thay thế `009`)
3 bảng đa nền tảng keyed by cột `platform` (KHÔNG đụng bảng FB `contents`): `platform_contents` (có `content_format` TỰ DO — không ràng buộc Video/Banner), `platform_settings` (`target:<Định dạng>`, `test_warning_days` — Leader sửa không cần code), `platform_sync_logs`. RLS khoá, chỉ service_role.

### 13.2 Business Rule Zalo (`src/platform/zalo/ZaloStatusRule.ts`) — RIÊNG, KHÔNG chung FB
Trạng thái: **Tồn** (chờ chạy) · **Đang test** · **Duy trì** · **Không test** (rỗng = Chưa phân loại). `isTested`=Đang test|Duy trì; `isClosed`=Không test. Zalo KHÔNG có market — chia theo **định dạng** (động, không hardcode).

### 13.3 Dashboard (menu 💬 Zalo) — theo THÁNG, chia theo định dạng
§V Khối định dạng (Đã cấp·Không test·Tồn·Đang test·Duy trì) · §VI Tiến độ (Actual/Target·%·so cùng kỳ tháng trước·so lịch·forecast) · §VII Cần xử lý (ẩn khi 0, ưu tiên Đỏ/Cam/Vàng) · §VIII So sánh định dạng (bảng, tự thêm định dạng mới) · §IX Data Quality. Số liệu PURE dùng chung API/Web/PDF: `zaloMetrics.ts` + `zaloWeeklyMetrics.ts` (không lệch).

### 13.4 API / Sync / PDF
- API `/api/zalo/*` (requireAuth): `summary`·`contents`·`weekly`·`sync-status`·`settings`(GET/PUT). Mount ADDITIVE trong `server.ts`, KHÔNG đổi `/api/v3` của FB.
- Sync: đọc Sheet RIÊNG theo **tên header** (env `ZALO_SHEET_ID`) → `platform_contents`. CLI `npm run zalo:sync`; tự động qua `POST /api/cron/daily/zalo` (Vercel Cron 10:00 giờ VN — xem §3.1). Webhook `/api/zalo-sync` + Apps Script ĐÃ GỠ BỎ 2026-09-11.
- Weekly Zalo (menu Weekly Zalo) + PDF A4 dọc, KHÔNG QR: `reports/build_zalo_weekly_data.ts` → `reports/zalo_report_pdf.py`.

### 13.5 Thêm nền tảng mới (TikTok…)
Tạo `src/platform/<nền-tảng>/` (StatusRule + module), đăng ký `registry.ts`, mount `/api/<nền-tảng>` trong `server.ts` (1 dòng) — dùng lại bảng `platform_*`, KHÔNG đổi schema/logic có sẵn.

### 13.6 ZALO-04 — nối Google Sheet thật (2 tab)
Google Sheet Zalo có ĐÚNG 2 tab `Video`/`Banner`; `content_format` = **tên tab** (không có cột định dạng/thị trường/người phụ trách). Backend đọc đồng thời 2 tab → merge → sync (`ZaloContentSyncService` + `ZaloSyncProvider.transformTab`). Mapping: Tên Content→`title` (cột thêm ở `sql/011_zalo_title.sql`), Ngày Up Trello→"đã cấp", Ngày test, Trạng thái. **Khoá định danh ổn định**: Content ID → Trello card id → hash(format|title|ngày up) — KHÔNG dùng số dòng → chống trùng khi re-sync. Settings thêm `warning_threshold`; Leader chỉnh Target/ngưỡng ngay trong Dashboard (`ZaloSettingsPanel`). Data Quality: "thiếu dữ liệu bắt buộc" (thiếu tên) + "trùng" theo TÊN. Đồng bộ tự động qua Vercel Cron 10:00 giờ VN (§3.1).

---

## 14. Budget Allocation Analytics (FB-ADS-02) — module độc lập, CHỈ ĐỌC

> Menu **💰 Phân bổ ngân sách** (`web/budget/`, route `#/budget-allocation`). Phân tích ngân sách + số content theo nhân viên Ads cho Facebook. **ĐỘC LẬP hoàn toàn**: không bảng/API/sync riêng — **chỉ đọc `/ads-monitor`** (`budgetApi.ts` gọi thẳng route Ads Monitor có sẵn). Không ghi dữ liệu, không đổi logic Ads Monitor.

- **Cấu trúc file:** `BudgetAllocationPage.tsx` (trang, memoize phân tích) · `MarketDashboard.tsx` (dashboard 1 thị trường) · `selectors.ts` (TOÀN BỘ phép tính, thuần, không I/O) · `config.ts` (ngưỡng — sửa DUY NHẤT tại đây) · `budgetApi.ts` · `BudgetDrawer.tsx` · `format.ts`.
- **Business Rule RIÊNG (`selectors.ts`)** — KHÔNG dùng rule Ads Monitor:
  - Chỉ lấy dòng **Amount Spent > 0** (mọi trạng thái: Đang test / Đang duy trì / Đã tắt / Mới chạy).
  - **Ngày cấp** = 6 số đầu của `content` (`YYMMDD` → `YYYY-MM-DD`) — bản riêng của module.
  - **Content Tươi** = ngày cấp thuộc THÁNG đang xem · **Content Cũ** = trước tháng đang xem.
  - **Ngưỡng ngân sách** `BUDGET_THRESHOLD = 5.000.000` (`config.ts`): `< ngưỡng` → "dưới 5tr", `>= ngưỡng` → "trên 5tr" (đúng bằng ngưỡng tính là "trên").
  - ⇒ **4 nhóm**: `old_lt` (Cũ <5tr) · `old_gte` (Cũ >5tr) · `fresh_lt` (Tươi <5tr) · `fresh_gte` (Tươi >5tr).
- **Hiển thị:** 2 thị trường `TQ`→**Nội Địa**, `NN`→**Quốc Tế**; mỗi thị trường có KPI (tổng ngân sách · tổng content · TB/content · content Cũ/Tươi), column chart 4 nhóm (HTML/CSS thuần, **không thư viện ngoài**), bảng phân tích nhóm, bảng theo nhân viên, và bộ chỉ số (`freshBudgetRatio`, `oldBudgetRatio`, `avgBudget`, `distributionIndex`). Click cột/dòng → Drawer danh sách content.
- **Loại trừ nhân viên:** `NOIDIA_EXCLUDE_OWNERS` (hiện là `Br`) trong `config.ts` — chỉ áp cho Nội Địa, do nhiễu dữ liệu `ads_owner` (cùng vấn đề §11.4). Sửa danh sách tại `config.ts`, KHÔNG hardcode trong `selectors.ts`.
- **Ràng buộc:** KHÔNG thêm route backend riêng trừ khi thật sự cần tính phía server; nếu sửa `ads_monitor_query`/schema Ads Monitor phải kiểm tra ảnh hưởng `budgetApi.ts`. Bảo vệ bởi `requireAuth` qua chính `/ads-monitor` (§5).

---

## 15. Content Analytics (CONTENT-ANALYTICS-03) — Data từ Content Mới vs Cũ ✅

> Menu **📊 Phân tích Data Content** (`web/content-analytics/`, route `#/content-analytics`). API `GET /api/content-analytics` (`requireAuth`).
> **STATELESS**: đọc THẲNG Google Sheet `Raw_Data` (Ads) mỗi request — **KHÔNG cache, KHÔNG bảng Supabase mới**. Độc lập hoàn toàn với Ads Monitor (không import, không tái dùng logic gộp); chỉ dùng chung `createGoogleAuth()` + `requireAuth` (2 file đó KHÔNG bị sửa).

### 15.1 Nguồn & env
`ADS_SHEET_ID` + `ADS_SHEET_TAB` (**dùng lại cùng spreadsheet/tab của Ads Monitor**, chỉ đọc thêm cột). Cột bắt buộc trên `Raw_Data`: `date, ad_id, ad_name, account_id, account_name, campaign_id, adset_id, purchases` — thiếu bất kỳ cột nào → API trả 500 kèm thông báo rõ. Header dò theo TÊN cột (không theo vị trí); dòng thiếu `date`/`ad_id`/`ad_name` bị bỏ qua.

### 15.2 Business Rule (`ContentAnalyticsService.ts` — pure function, dễ test)
- **Content** = `ad_name` chuẩn hoá (trim + gộp khoảng trắng). **KHÔNG** dùng `ad_id` làm định danh Content.
- **Dedup** CHỈ khi trùng **đủ 5 khoá** `(date, ad_id, account_id, campaign_id, adset_id)` → giữ dòng có `purchases` LỚN NHẤT (Raw_Data có mẫu export nhiều lần/ngày). Trùng `(date, ad_id)` nhưng khác account/campaign/adset → **giữ tất cả**.
- **`first_seen(content)`** = `MIN(date)` trên **TOÀN BỘ lịch sử sau dedup** — KHÔNG tính lại sau khi lọc tháng.
- **Mới / Cũ**: `first_seen` thuộc tháng đang xem → **Mới**; trước đó → **Cũ**.
- **Data** = `SUM(purchases)`. 1 Content có thể thuộc nhiều nhân viên → **KHÔNG ép về 1 người**, giữ `employeeBreakdown` đầy đủ.
- **Employee** = suy từ `account_name` qua `resolveEmployee()`: tách theo `-`, lấy token khớp **đúng 4 nhân viên thật KA · Hiếu · Ánh · Liên**; không khớp → **"Không xác định"** (KHÔNG tự gán bừa, KHÔNG hiển thị `account_name` nguyên văn ra UI). Khi `employee=ALL`, bảng nhân viên LUÔN đủ 4 dòng theo thứ tự cố định (0 nếu không có data), cộng dòng "Không xác định" nếu có data thật.
- **Thứ tự pipeline (bắt buộc giữ):** đọc → dedup toàn lịch sử → `first_seen` toàn lịch sử → lọc tháng → lọc employee/search ở mức DÒNG → group theo Content → gán Mới/Cũ → lọc `type` → tính overview/byEmployee trên ĐÚNG tập đã lọc ⇒ overview · byContent · byEmployee luôn nhất quán với nhau.

### 15.3 API
`GET /api/content-analytics?month=YYYY-MM&employee=ALL|<tên>&type=all|new|old&search=<chuỗi>` (mặc định: tháng hiện tại · ALL · all · rỗng).
Trả `{ month, overview{dataNew,dataOld,dataTotal,pctNew,pctOld}, byContent[], byEmployee[], meta }`. `meta` gồm `historyStartDate`, `rowsRead`, `rowsAfterDedup`, `duplicateGroups`, `contentsUnknownEmployee`, `warnings` — trong đó có **cảnh báo lịch sử chưa đủ sâu** (nếu `historyStartDate` ≥ tháng đang xem thì mọi Content có thể bị tính nhầm là "Mới").

---

## 16. Content Performance (CP-04) — Cost / ROAS / Chất lượng data ✅

> Menu **📈 Phân tích Hiệu quả Content** (`web/content-performance/`, route `#/content-performance`). API `GET /api/content-performance` (`requireAuth`).
> **STATELESS**: đọc THẲNG 2 Google Sheet (Performance/ROAS + Quality/CLĐT) mỗi request — KHÔNG cache, KHÔNG bảng mới. **V1 CHỈ kênh Facebook** (đã chốt); PR để dành V2 vì "Tên content" của PR là tên chiến dịch chữ, không join được với Content Sheet theo cùng cơ chế.

### 16.1 Nguồn & env
| Env | Sheet | Vai trò |
|---|---|---|
| `PERFORMANCE_SHEET_ID` · `PERFORMANCE_SHEET_TAB` | "Roas content" | Chi phí · SL data · Giá data · Roas trong tháng · Roas 3 tháng |
| `QUALITY_SHEET_ID` · `QUALITY_SHEET_TAB` | "CLDT CONTENT" | Care giá · Tích cực · Tiêu cực · MQH chưa XĐ |

Ngoài ra đọc bảng **`contents`** (chỉ `content_code` + `editor_name`) để gán **Biên tập** — KHÔNG dùng `account_name`/Employee của §15.

### 16.2 Cấu trúc Sheet thật (đã audit CP-03A — KHÔNG suy đoán)
- **Performance Sheet**: header 3 tầng — THÁNG (13 khối: Tổng năm + 12 tháng) × ĐỊA LÝ (TỔNG CỘNG / TRONG NƯỚC / NƯỚC NGOÀI) × 5 chỉ số. Cột 1/2/3 = Kênh / Phân loại / Tên content; cột "Tên CGSĐ" KHÔNG dùng (không phải Biên tập chính thức). Năm lấy từ dòng tiêu đề, **không hard-code**. 5 category Facebook thật: `Facebook CGSĐ · Facebook BS · Facebook mess Nữ MB · Facebook remar · Facebook hotline`.
- **Quality Sheet**: nhiều **block tháng nối tiếp theo chiều dọc**; trong mỗi block, dòng tên kênh là dòng NHÓM, Content thật nằm ở các dòng SAU nó (thuộc nhóm theo **vị trí**, không có cột kênh riêng trên từng dòng). V1 dùng cột **"Grand Total"** (Trong nước + Nước ngoài). ROAS ở Sheet này KHÔNG dùng — tránh 2 nguồn ROAS xung đột.
- **Lọc rác** (đã xác nhận trên dữ liệu thật): `Ko có tên content`, `#REF!`, `Thử nghiệm - ...`, URL Facebook, `test`, `Quảng cáo`, tên ≤ 2 ký tự.

### 16.3 Business Rule
- **ROAS tháng / ROAS 3 tháng ĐÃ TÍNH SẴN trong Sheet — KHÔNG tự dựng lại công thức rolling.**
- **Tổng quan (KPI) ưu tiên đọc TRỰC TIẾP dòng subtotal có sẵn trong Sheet** ⇒ khớp 100% với Sheet. Chỉ dùng được khi bộ lọc khớp đúng 1 dòng subtotal (`channel=ALL` → "Tổng kênh Facebook", hoặc đúng 1 category) **và KHÔNG lọc Biên tập/Tìm kiếm**.
- Khi KHÔNG có subtotal khớp (đang lọc Biên tập/Tìm kiếm): tự tính — Chi phí/SL Data **vẫn chính xác** (cộng được), Giá data = `cost / dataCount` (tính lại, KHÔNG lấy trung bình cộng), ROAS = **weighted theo cost** và chỉ là **ƯỚC LƯỢNG**. Cờ `meta.overviewFromSheetSubtotal = false` + `warnings` báo rõ cho người xem.
- **Reconcile gap**: category có subtotal lớn hơn tổng các content liệt kê → phần chênh được giữ lại để Chi phí/SL Data không bị hụt so với Sheet.
- **Biên tập** = map từ bảng `contents` theo `content_code`; không khớp → `(Không xác định)` (đếm ở `meta.contentsUnmatchedEditor`).
- **Chất lượng (CLĐT)** ghép theo khoá `contentName||YYYY-MM`; không có dữ liệu → `quality = null` (KHÔNG bịa 0).
- Bỏ content không hoạt động trong tháng/địa lý đang lọc (`cost <= 0 && dataCount <= 0`). Bảng sắp xếp giảm dần theo Chi phí.

### 16.4 API
`GET /api/content-performance?month=YYYY-MM&channel=ALL|<kênh>&editor=ALL|<biên tập>&geography=all|noi_dia|quoc_te&search=<chuỗi>`.
Trả `{ month, overview{cost,dataCount,dataPrice,roasMonth,roas3Month}, table[], meta{channelsAvailable,editorsAvailable,monthsAvailable,contentsUnmatchedEditor,overviewFromSheetSubtotal,warnings} }`. `monthsAvailable` chỉ gồm tháng **thật sự có hoạt động** (cost hoặc data > 0) để tránh chọn tháng trống.

### 16.5 Sắp xếp bảng "Chi tiết theo Content" (CP-05, 2026-09-16) ✅

> Thuần giao diện — **KHÔNG đổi API, KHÔNG đổi công thức, KHÔNG đụng backend**. Thẻ Tổng quan (§16.3) giữ nguyên số liệu bất kể sắp xếp thế nào.

- **6 cột bấm được** (chốt với chủ dự án): `Chi phí` · `SL Data` · `ROAS tháng` · `ROAS 3 tháng` · `Tích cực` · `Tiêu cực`. **`Giá Data`, `Content`, `Biên tập`, `Kênh` KHÔNG sắp xếp** — thêm sau chỉ cần 1 dòng trong `SORTERS`.
- **Thao tác:** bấm tiêu đề lần 1 → **cao → thấp**; bấm lại → **thấp → cao**; mũi tên ▼▲ do `DataTable` hiển thị sẵn. Tooltip "Bấm để sắp xếp" trên 6 tiêu đề đó.
- **Sắp xếp CHỈ ở client** trên mảng `table` API đã trả (không phân trang, vài trăm dòng) ⇒ tức thì, **không gọi lại backend**. Đây là điểm bắt buộc: mỗi request backend phải đọc lại 2 Google Sheet (mất vài giây + tốn quota), nên **KHÔNG được** chuyển sang sort server-side.
- **Quy tắc đã chốt:**
  1. Chưa bấm cột nào → giữ **nguyên thứ tự server** (Chi phí giảm dần, `ContentPerformanceService`).
  2. Dòng thiếu dữ liệu CLĐT (`quality = null`, hiển thị "—") **LUÔN nằm cuối**, bất kể tăng hay giảm dần. Lý do: coi "—" là 0 thì khi sắp tăng dần chúng đội lên đầu bảng, đọc nhầm thành "content có 0% tiêu cực".
  3. Hai dòng bằng nhau → chốt theo **Chi phí giảm dần** để thứ tự ổn định giữa các lần render.
  4. **Giữ nguyên lựa chọn sắp xếp khi đổi tháng/bộ lọc** (đang xem ROAS thấp nhất tháng 8, sang tháng 9 vẫn thấy ROAS thấp nhất).
- **File:** logic thuần ở `web/content-performance/sortRows.ts` (`SORTERS`, `sortRows()`, `nextSort()`, `isSortable()` — không I/O, không JSX, test được độc lập như `src/shared/weeklyMetrics.ts`); `ContentTable.tsx` chỉ giữ state + nối vào `DataTable`. **Không sửa file nào ngoài `web/content-performance/`.**
- **Kiểm chứng:** 19/19 test pass trên chính module `sortRows.ts` (thứ tự mặc định · 6 cột · dòng "—" nằm cuối · tie-break · không đụng mảng gốc · hành vi bấm header).

> ⚠️ **Ghi chú nợ kỹ thuật (phát hiện khi làm CP-05):** `npm run typecheck` **KHÔNG kiểm tra thư mục `web/`** — `tsconfig.json` chỉ `include: ["src/**/*.ts", "api/**/*.ts"]`, và không có `web/tsconfig.json`. Toàn bộ app React hiện chỉ được Vite transpile, **không hề typecheck**. Nên thêm `web/tsconfig.json` + script `typecheck:web`.

---

> **Quy tắc vàng:** PR/commit nào đổi schema, API, sync, dashboard, phân quyền → **cập nhật PROJECT_SPEC.md trong cùng thay đổi đó**.
