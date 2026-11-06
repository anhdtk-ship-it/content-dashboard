# PROJECT_SPEC.md — Content Operations Dashboard

> **Tài liệu gốc (single source of truth).** Mọi thay đổi về kiến trúc, schema, sync, dashboard, API, phân quyền… **bắt buộc cập nhật vào file này**.
>
> Cập nhật lần cuối: 2026-11-03 — **§17 module MỚI Ads Report (AR-01)**: trang `#/ads-report` báo cáo Ads theo tháng đơn lẻ (chi tiêu & ROAS theo nhân viên + top content tiêu nhiều tiền + content phát sinh ROAS), xuất **Excel** và **PDF**. **Nguyên tắc số liệu: ĐỌC NGUYÊN giá trị ô file ROAS, KHÔNG tự tính** (§17.1) — đã gỡ hẳn `RawDataProvider`, nhờ đó hết mâu thuẫn 12% giữa 2 mục và nhanh hơn 2,8 lần. Mục B **gộp content theo cả team** (§17.6). Đối soát **1.369/1.369 phép kiểm khớp, dung sai 0** (§17.10). Trước đó 2026-09-16: §16.5 sắp xếp bảng Chi tiết theo Content (6 cột ▼▲) · `typecheck:web` cho app React · fix nhãn biểu đồ Budget (§14). Trước đó 2026-09-11: gỡ auto-sync tức thời + Railway, chốt đồng bộ 1 lần/ngày 10:00 giờ VN trên Vercel (§3.1).
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

### 3.3 Chống "1 ô Sheet làm chết cả lô" — sự cố 24/10 → 03/11/2026 ⚠️ BÀI HỌC

**Hiện tượng:** suốt 10 ngày, dashboard đứng ở dữ liệu ngày 23/10 mà **không ai biết** — trang vẫn hiện số, chỉ là số cũ. Phát hiện nhờ người dùng hỏi "tháng 11 sao không có dữ liệu của Kim Anh".

**Nguyên nhân:** ô `NĐ Liên`!C177 (cột "ID content 1") bị dán một **link reel Facebook dài 280 ký tự**. Cột `contents.content_code` là `varchar(100)` → Postgres trả `value too long for type character varying(100)`. Vì tập ghi (414–415 bản ghi) nhỏ hơn `ATOMIC_UPSERT_MAX` nên sync ghi trong **ĐÚNG 1 lệnh upsert** → một dòng bẩn làm **cả lô bị từ chối**, không dòng nào vào DB. `sync_logs` id 781→791 đều `status: failed`, lần success cuối là id 780 (23/10).

**Thiệt hại khi đối soát (03/11):** 110 content có trên Sheet mà thiếu trong dashboard · 615 ô lệch giá trị (240 `test_date_real`, 126 `current_status`…).

**Đã sửa (`src/content-sync/ContentSyncService.ts`):**

| Lớp bảo vệ | Hành vi |
|---|---|
| `MAX_LEN` | Khai báo giới hạn độ dài **đúng theo schema Postgres thật** (đã đọc từ bảng, không đoán): `content_code` 100 · `market` 10 · `assignee_name` 100 · `cgsd` 100 · `editor_name` 100 · `current_status` 50. `trello_link`/`upload_date`/`test_date` là `text` — không giới hạn. |
| `validateRecord()` + `KEY_LIMITED` | Cột **khoá** quá dài → **loại đúng bản ghi đó**, kèm lý do nêu rõ ô nào trên Sheet cần sửa. |
| `clampSoftFields()` + `SOFT_LIMITED` | Cột **mềm** quá dài → **cắt bớt**, vẫn giữ content. Thà mất phần đuôi ghi chú hơn mất cả content. |
| `upsertResilient()` | Thất bại thì **chia đôi và thử lại**, đệ quy tới từng bản ghi ⇒ một dòng bẩn chỉ làm mất chính nó. Đường happy-path vẫn **đúng 1 lệnh** (`atomic = true`) nên không chậm thêm. |
| `status` | `invalid > 0` **không được** báo `success` → trả `partial`. `error_message` của `sync_logs` ghi kèm `N invalid: [...]` và `N clamped: [...]` để lần sau nhìn log là biết sửa ô nào. |

**Quy tắc rút ra:** mọi sync Sheet → DB phải (1) biết giới hạn cột của DB, (2) không để một dòng dữ liệu bẩn chặn các dòng còn lại, (3) **không bao giờ báo `success` khi có dòng bị loại**.

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
| 📘 **Facebook** | 📋 Tổng quan `#/overview` · 📝 Weekly Report `#/weekly-report` · 🔎 Content Explorer `#/explorer` · ♻️ Vòng đời Content `#/lifecycle` · 📡 Ads Monitor `#/ads-monitor` · 💰 Phân bổ ngân sách `#/budget-allocation` · 📊 Phân tích Data Content `#/content-analytics` · 📈 Phân tích Hiệu quả Content `#/content-performance` · 🧾 Báo cáo Ads tháng `#/ads-report` |
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
| `GET /api/ads-report` · `/excel` · `/nhan-vien` | Báo cáo Ads tháng (chi tiêu + content ra ROAS), `/excel` tải `.xlsx` — xem §17 ✅ |

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
│   ├── ads-report/          ← §17 — config (quy tắc team/ánh xạ tên) · RawDataProvider · RoasTabsProvider
│   │                           · AdsReportService · ExcelBuilder · routes · types
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
│   └── content-analytics/ · content-performance/ · ads-report/
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
- [x] Content Analytics (§15) · Content Performance (§16) · Ads Report (§17 — xuất Excel/PDF)
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
| **Tồn** (`ton`) | TOÀN BỘ content & `current_status === 'Chờ chạy'` — **ĐÚNG trạng thái này, không gì khác** (kể cả trống/chưa phân loại) | **ALL-TIME**, không giới hạn kỳ |
| **Chờ đăng bài** (`choDangBai`) | cohort & `current_status === 'Chờ đăng bài'` — nhóm **RIÊNG**, KHÔNG cộng vào Tồn | trong kỳ |
| **Tỷ lệ test** (`rateTest`) | `Đã test / Đã cấp` | trong kỳ |
| **Duy trì tháng** (`duyTriThang`) | cohort & đang `Duy trì*` | trong kỳ |
| **Tỷ lệ Duy trì** (`rateDuyTri`) | `Duy trì tháng / Đã test` | trong kỳ |
| **Đang duy trì** (`dangDuyTri`) | TOÀN BỘ content đang `Duy trì*` | **ALL-TIME**, không giới hạn kỳ |

- ⚠️ **"Duy trì tháng" là PROXY**: hệ thống KHÔNG lưu ngày đổi trạng thái (`content_status_history` rỗng) nên chỉ đo được "hiện đang Duy trì" chứ không phải "đã chuyển sang Duy trì trong kỳ".
- **Cấu trúc báo cáo** (`buildWeeklyReport`): 2 khối market **Nội địa / Quốc tế**; trong mỗi khối, nhân viên xếp theo `EMPLOYEE_ORDER = [Hiếu, KA, Liên, Ánh]` (người ngoài danh sách xếp sau, A→Z) và **ẩn nhân viên có `capped = 0` và `dangDuyTri = 0` và `ton = 0`** ở market đó (phải xét cả `ton` vì Tồn là all-time — nếu không, người chỉ còn tồn sẽ bị ẩn và tổng team không bằng tổng các dòng nhân viên). Group theo `assignee_name` = Nhân viên Ads (KHÔNG dùng `editor_name`).

#### 12.2.1 Tồn = ALL-TIME (chốt 2026-11-06) ✅

> Chủ dự án: *"Tồn = tất cả content ở trạng thái Chờ chạy trong Google Sheet, **không tính khoảng thời gian** — cứ Chờ chạy = Tồn."*

Trước đây `ton` lọc theo cohort (chỉ đếm content **upload trong kỳ** mà còn "Chờ chạy"), nên báo cáo tuần hiện số **thấp hơn thực tế**: đo ngày 06/11/2026 — hiện **13** trong khi Sheet có **39** content "Chờ chạy".

Lý do công thức cũ sai về nghiệp vụ: **Tồn là TỒN KHO hiện tại, không phải việc phát sinh trong tuần.** Một content cấp tháng trước mà vẫn chưa chạy thì tuần này **vẫn đang tồn** — đó mới là việc cần xử lý. Lọc theo kỳ làm tồn cũ "biến mất" khỏi báo cáo đúng lúc nó tồn lâu nhất.

Nay `ton = all.filter(current_status === 'Chờ chạy')`, **cùng cách tính với thẻ "Chờ chạy (Tồn)" của trang Tổng Quan** (`app.ts` đếm trên `base`, không giới hạn ngày) ⇒ hai trang không còn lệch nhau.

Đối soát sau khi sửa: Tồn = **39** (Nội địa 6 + Quốc tế 33) ở **cả 3 kỳ thử** (tuần này · tuần trước · cả năm 2026) — khớp đúng số "Chờ chạy" trên Sheet, và tổng các dòng nhân viên = dòng team ở mọi khối.

`choDangBai` **giữ nguyên cohort** (chưa có yêu cầu đổi). Hiện Sheet **không có dòng nào** mang trạng thái "Chờ đăng bài" nên cột này bằng 0 ở mọi kỳ.
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
- **Sửa lỗi 2026-09-16:** nhãn dưới mỗi cột biểu đồ (`MarketDashboard.tsx`) đọc `g.short` trên `GroupStat` — trường KHÔNG tồn tại (`selectors.ts` dựng object với `label: g.short`), nên nhãn **render rỗng** từ khi module ra đời. Đã đổi thành `g.label` ⇒ hiện đúng `Cũ <5tr` / `Cũ >5tr` / `Tươi <5tr` / `Tươi >5tr`, khớp với chú thích màu. Lỗi này do `npm run typecheck:web` (mới thêm) phát hiện — KHÔNG đổi số liệu.

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

> ✅ **Nợ kỹ thuật phát hiện khi làm CP-05 — ĐÃ XỬ LÝ cùng ngày:** `npm run typecheck` chỉ `include: ["src/**/*.ts", "api/**/*.ts"]` nên **toàn bộ app React `web/` chưa bao giờ được typecheck** (Vite chỉ transpile). Đã thêm `web/tsconfig.json` + script **`npm run typecheck:web`**. Kiểm chứng: thêm tsconfig KHÔNG làm đổi bản build — build lại cho ra file **giống hệt từng byte** (cùng md5 JS + CSS, cùng hash tên file). Không có CI/git hook nào tự chạy, Vercel deploy bằng `npm run build` nên không ảnh hưởng triển khai. Lần chạy đầu bắt được đúng 1 lỗi thật (nhãn biểu đồ Budget, xem §14); hiện **0 lỗi**.

---

---

## 17. Ads Report (AR-01) — Báo cáo Ads theo tháng, xuất Excel/PDF ✅

> **Module ĐỘC LẬP.** Không import code của Ads Monitor / Content Analytics / Content Performance / Budget / Zalo; chỉ dùng chung `createGoogleAuth()` và thư viện UI. Route `#/ads-report`, API `/api/ads-report` (`requireAuth`).
> Mục tiêu: theo dõi **theo tháng đơn lẻ** trên dashboard và **tự xuất file** — không cần ai chạy script hộ.

### 17.1 ⚠️ NGUYÊN TẮC SỐ LIỆU — LẤY SỐ THỰC TẾ CỦA SHEET, KHÔNG TỰ TÍNH

Chủ dự án chốt (2026-11-03): **"dữ liệu không được tính, mà lấy con số thực tế trên file Google Sheet."**
File ROAS đã tính sẵn Chi phí · SL data · Giá data · Roas trong tháng · Roas 3 tháng ở đúng những cấp độ báo cáo cần → **đọc nguyên giá trị ô**, không suy diễn.

| Mục | Nguồn | Thao tác duy nhất được phép |
|---|---|---|
| **A.** Chi tiêu & ROAS theo nhân viên | tab `Roas tổng` | tra dòng, đọc ô |
| **B.** Content tiêu nhiều tiền nhất | 4 tab nhân viên | **gộp theo content** + sắp xếp + cắt Top N — xem §17.6 |
| **C.** Content phát sinh ROAS | 4 tab nhân viên | lọc theo luật ROAS + sắp xếp |

**Phiên bản đầu (đã bỏ) sai ở đâu** — ghi lại để không lặp lại:
1. Mục A/B đọc **Raw_Data (Ads)** rồi tự khử trùng + cộng → cùng một content hiện **2 chi phí khác nhau** ở 2 mục (lệch ~12%).
2. Bảng tóm tắt tự tính **ROAS bình quân trọng số** trên riêng nhóm content ra ROAS → lệch hẳn Sheet vì **mẫu số khác nhau**:

| | Tự tính (sai) | Sheet ghi (đúng) |
|---|---|---|
| Vũ Minh Hiếu — Nội Địa | 740,97% *(chỉ trên 59,7 tr content ra ROAS)* | **141,44%** *(trên toàn bộ 313,0 tr)* |
| Đặng Thị Kim Anh — Tổng | 64,80% | **64,38%** |

3. Bản trước đó nữa còn hiển thị **"ROAS cao nhất"** → ra `24.422%` (content chỉ tiêu vài trăm nghìn), vô nghĩa để so sánh.

Nhờ dùng một nguồn duy nhất: **hết mâu thuẫn 12%**, và thời gian dựng báo cáo **8,1 s → 2,9 s**.

> **Chỗ DUY NHẤT còn phải cộng** là dòng *CẢ TEAM* — xem §17.4. Hai dòng *"CỘNG n CONTENT ĐANG LIỆT KÊ"* ở mục B/C là phép cộng của đúng các dòng đang hiển thị, **ghi rõ chữ "đang liệt kê"** để không ai nhầm với tổng kỳ (tổng kỳ nằm ở mục A).
> Ô nào Sheet không có thì in **"—"**, tuyệt đối không suy ra.

### 17.2 Quy tắc nghiệp vụ (chốt với chủ dự án 2026-11-03)

| # | Quy tắc | Khai báo tại |
|---|---|---|
| 1 | **ROAS KHÔNG có bản "cả team" theo content** — mục C tách riêng từng người, lấy từ tab của chính họ | `AdsReportService` |
| 2 | **"Cả team" = đúng 4 nhân viên ads**: Vũ Minh Hiếu · Đặng Thị Kim Anh · Nguyễn Tiến Ánh · Nguyễn Thị Liên | `config.ts` `NHAN_VIEN_ADS` |
| 3 | **Quản Cao Khiêm loại bỏ hoàn toàn** khỏi mọi báo cáo | `config.ts` — xem §17.4 |
| 4 | Báo cáo theo **tháng đơn lẻ** | `routes.ts` |
| 5 | **"Phát sinh ROAS" = `Roas trong tháng > 0` HOẶC `Roas 3 tháng > 0`** — content ROAS tháng = 0 nhưng ROAS 3 tháng = 32% **vẫn tính** | `AdsReportService.coRoas()` |

`NHAN_VIEN_ADS` là **DANH SÁCH TRẮNG**: ai không có tên trong đó thì không xuất hiện ở bất kỳ con số nào. Nhờ vậy `Br`/`Nhóm` (token `adset_name` của Raw_Data cũ) và `Facebook hotline`/`PR hotline` tự động bị loại, không cần danh sách đen.

**Tên nhân viên ghi khác nhau ở hai chỗ trong CÙNG file ROAS** nên phải khai báo cả hai, không suy ra được:

| `tenRoasTong` (cột "Tên nhân sự" tab `Roas tổng`) | `roasTab` (tab chi tiết) |
|---|---|
| Vũ Minh Hiếu | `Roas content.Hiếu` |
| Đặng Thị Kim Anh | `Roas content.Kim Anh` |
| Nguyễn Tiến Ánh | `Roas content.Ánh` |
| Nguyễn Thị Liên | `Roas content.Liên` |

### 17.3 Bố cục file ROAS (env `PERFORMANCE_SHEET_ID`)

**Tab `Roas tổng`** — "BÁO CÁO ROAS THEO TÊN NHÂN SỰ", dạng DÒNG, dữ liệu từ dòng 5:
`cột 1` Tháng báo cáo (`Tổng năm 2026` | `2026_T01`..`2026_T12`) · `7` Kênh · `8` Phân loại · `9` Tên nhân sự
`10–14` TỔNG CỘNG · `15–19` TRONG NƯỚC · `20–24` NƯỚC NGOÀI — mỗi nhóm: Chi phí · SL data · Giá data · Roas trong tháng · Roas 3 tháng.
Phân loại dùng cho báo cáo: **`Tổng kênh_Facbeook`** *(chính tả sai là của Sheet, giữ nguyên)*.

**Tab nhân viên** — dạng CỘT, dữ liệu từ dòng 6 (phía trên là subtotal, nhận biết bằng "Tên content" rỗng):
`cột 1/2/3` Kênh / Phân loại / Tên content · khối TỔNG NĂM ở cột 4 · **khối THÁNG n ở cột `19 + (n−1)×15`**
trong mỗi khối tháng: offset `0` TỔNG CỘNG · `+5` TRONG NƯỚC · `+10` NƯỚC NGOÀI, mỗi nhóm 5 chỉ số như trên.
File ROAS **không có** nhóm "chưa xác định địa lý" — `TỔNG CỘNG = TRONG NƯỚC + NƯỚC NGOÀI`.

> ⚠️ **Bẫy: KHÔNG dùng tab tổng `Roas content`.** Tab đó xếp chồng 4 khối chia lại CÙNG một số tiền — A "Roas theo CGSĐ" (r19–29) · B "Roas theo tên thương hiệu" (r31–33) · C "Roas theo Mã số mẫu" (r35–156) · D "Chi tiết danh sách content" (r158+). Quét cả tab rồi cộng sẽ **đếm tiền 3 lần** (T10/2026: 2,8 tỷ thành 8,4 tỷ); khối A/B để trống cột "Kênh" nên dễ bị xếp nhầm vào nhóm "(trống)". Tab nhân viên chỉ có khối chi tiết nên không dính bẫy này.

### 17.4 Dòng CẢ TEAM — chỗ duy nhất phải cộng, và vì sao

Quy tắc 3 loại Quản Cao Khiêm, nhưng dòng `Tổng cộng` của Sheet **đã gồm anh ấy**. Khiêm chỉ phát sinh **T01–T03/2026** (1.582.337.546 đ cả năm), từ T04 trở đi = 0:

| Trường hợp | Xử lý | `tuSheet` | `thieuChiSoGop` |
|---|---|---|---|
| Khiêm = 0 (T04/2026 trở đi) → `Tổng cộng` **chính là** 4 người | **đọc nguyên dòng `Tổng cộng`** của Sheet | `true` | `false` |
| Khiêm ≠ 0 (T01–T03/2026) | cộng Chi phí + SL data của 4 dòng; **Giá data và ROAS để "—"** | `false` | `true` |

Nhận biết tự động bằng cách so `Tổng cộng` với tổng 4 dòng (sai số ≤ 2 đ do làm tròn của Sheet).
**Không bịa Giá data/ROAS cho trường hợp 2**: ROAS cần doanh thu mà Sheet không công khai, nên thà để trống còn hơn đưa ra con số sai. UI hiện "—" kèm nhãn *(cộng 4 dòng trên)* và một cảnh báo.

### 17.5 Dòng không phải content trong tab nhân viên — bỏ qua nhưng PHẢI báo

Tab nhân viên có các dòng `Ko có tên content`, `#REF!`, link reel/landing… — **chi phí 0 đ nhưng VẪN MANG DATA**. Mục B/C không liệt kê được theo content nên bỏ qua:

| Tháng | Số dòng | Data bỏ qua | Chi phí bỏ qua |
|---|---:|---:|---:|
| T10/2026 | 12 | 103 | **0 đ** |
| T9/2026 | 6 | 83 | **0 đ** |

`RoasTabsProvider` trả kèm `boQua { soDong, dataNoiDia, dataQuocTe }`, service đẩy vào `meta.canhBao` để con số này **không biến mất im lặng**. **Mục A không bị ảnh hưởng** vì đọc từ `Roas tổng` (đã gồm đủ).
Bất biến phải giữ: `Σ content trong tab + phần bỏ qua = dòng nhân viên ở "Roas tổng"` (KIỂM 4 §17.9).

### 17.6 Mục B — GỘP theo content của CẢ TEAM

Chủ dự án chốt (2026-11-03): *"báo cáo là content tiêu nhiều tiền nhất của **cả team** chứ không phải của từng nhân viên — content nào có nhiều nhân viên chạy thì phải cộng lại."*

**Khoá gộp = TÊN CONTENT CHÍNH XÁC + thị trường.** Trùng đúng cách tab tổng `Roas content` gộp. Đuôi phiên bản là một phần của tên nên **`tvc v1` và `tvc v2` là HAI content khác nhau, không gộp chung**:

| Tab | Tên đầy đủ | Chi phí NĐ T10 |
|---|---|---:|
| `Roas content.Liên` | `…4258t tvc **v1**` | 1.239.667 |
| `Roas content.Kim Anh` | `…4258t tvc **v2**` | 70.587.477 |
| `Roas content.Liên` | `…4258t tvc **v2**` | 28.483.409 |
| → gộp `v2` | | **99.070.887** |

Khớp đúng dòng `r603` của tab tổng (`99.070.887`), và `v1` vẫn đứng riêng ở `r602` — tức module gộp **giống hệt** cách Sheet gộp.

**Mức độ ảnh hưởng (T10/2026):** Nội Địa **64/144** content do nhiều nhân viên cùng chạy, Quốc Tế **30/71**. Tổng 322 dòng → **215 content**, 94 cái được gộp. Thứ hạng đổi hẳn: quán quân Nội Địa thành `261005-SC CGSĐ Hiếu Có biến hình 58t` (**117.556.414 đ**, do Hiếu + Kim Anh + Ánh cùng chạy) — để rời thì content này **không lọt nổi Top 5**.

**Trường nào cộng được, trường nào không:**

| Trường | Cách xử lý | Vì sao |
|---|---|---|
| Chi phí · SL data | **Σ** các dòng nguồn | phép cộng thuần |
| Giá data | **Σ chi phí ÷ Σ SL data** | đã kiểm đúng cách Sheet tính — **554/554 ô** khớp (sai số ≤1 đ do làm tròn) |
| Roas tháng · Roas 3 tháng | **1 nguồn → giữ nguyên ô Sheet · nhiều nguồn → `null`, hiển thị "—"** | xem dưới |

> ⚠️ **ROAS KHÔNG cộng được — đã thử và chứng minh là sai.** Công thức trọng số `Σ(roas×chiPhi) ÷ Σchiphí` nhìn thì đúng về toán, nhưng đối chiếu ở **cấp nhân viên** (nơi Sheet đã có đáp án sẵn) thì lệch tới **257 điểm %**:
>
> | | Công thức | Sheet |
> |---|---|---|
> | Ánh — QT Roas 3 tháng T10 | 191,89% | **448,92%** |
> | Kim Anh — NĐ Roas tháng T10 | 34,68% | **62,56%** |
>
> Nguyên nhân: có content **tháng này chi phí 0 nhưng vẫn phát sinh doanh thu** (doanh thu về từ chi tiêu tháng trước). Công thức bỏ qua các dòng đó vì mẫu số bằng 0, Sheet thì vẫn tính doanh thu của chúng. Không tái dựng được từ các cột đang có → **không bịa số**.
>
> Dòng gộp để "—" nhưng **không mất thông tin**: `DongChiTieu.nguon[]` giữ nguyên ROAS + chi phí của từng nhân viên, UI cho rê chuột vào ô "—" để xem (`Hiếu: 0,00% (9.757.681đ) · Kim Anh: 0,00% (58.926.495đ) · Ánh: 24,55% (48.872.239đ)`). ROAS thật của từng người xem mục A.

**Cột "Nhân viên chạy"** liệt kê những ai cùng chạy, kèm huy hiệu `×n` khi gộp từ n dòng Sheet. Cột "Phân loại" nối bằng ` + ` khi content nằm ở nhiều phân loại.

**Sheet Excel `Top - <nhân viên>`** tách phần đóng góp của RIÊNG người đó từ `nguon[]` (hàm `rowsCuaNhanVien`), nên **không lẫn** chi phí của người khác vào bảng cá nhân.

### 17.7 API

| Method · Path | Vai trò |
|---|---|
| `GET /api/ads-report` | JSON cho dashboard. Query: `thang` (`YYYY-MM`, mặc định tháng hiện tại) · `thiTruong` (`all`\|`noi_dia`\|`quoc_te`) · `nhanVien` (`ALL` hoặc `key`) ✅ |
| `GET /api/ads-report/excel` | Tải `.xlsx` — **cùng query, CÙNG service** nên số trong file luôn khớp màn hình ✅ |
| `GET /api/ads-report/nhan-vien` | Danh sách nhân viên cho dropdown (không đọc Sheet) ✅ |

Stateless: đọc thẳng Sheet mỗi request, **KHÔNG cache, KHÔNG bảng Supabase mới** — giống §15/§16. Hai tab đọc **song song** (`Promise.all`), 4 tab nhân viên gộp **1 lần `batchGet`**. Thực đo **~2,9 giây/request**; `vercel.json` đặt `maxDuration: 60`.
`meta.nguon` liệt kê đúng tên file/tab đã đọc và in cả trong PDF, để người xem truy ngược được từng con số.
> Mỗi lần đổi bộ lọc phải đọc lại Sheet nên trang **KHÔNG tự gọi lại định kỳ**. Đổi "Hiện Top" chỉ cắt danh sách ở client.

### 17.8 Màn hình `#/ads-report`

Bộ lọc: **Tháng** · **Thị trường** · **Nhân viên Ads** (Cả team / từng người) · **Hiện Top** (10/20/30/50/100). Hai nút: **Xuất Excel** · **Xuất PDF**.

**Ngoài `#report-doc`** (chỉ màn hình, `no-print`): dải **5 thẻ KPI** (tổng chi tiêu · Nội Địa · Quốc Tế · **ROAS cả team** · số content ra ROAS) + **thanh nhảy mục** A/B/C và tới từng nhân viên. Bản in không cần thẻ KPI vì mục A đầy đủ hơn.

Thân báo cáo (`#report-doc`):
- **A.** header 2 tầng NỘI ĐỊA / QUỐC TẾ / TỔNG CỘNG, mỗi nhóm 5 chỉ số **đọc nguyên từ Sheet**, thêm cột `% chi tiêu`, dòng CẢ TEAM.
- **B.** 2 khối Nội Địa · Quốc Tế, **mỗi dòng là MỘT content của cả team** (§17.6). Top 1–3 tô màu nhấn, cột `% khối`, **thanh nền tỷ trọng** sau ô Ngân sách, cột "Nhân viên chạy" kèm huy hiệu `×n`, ô ROAS gộp hiện "—" nhưng rê chuột xem được từng nguồn.
- **C.** **bảng TÓM TẮT 4 nhân viên trước**, rồi chi tiết từng người. Tóm tắt **CỐ Ý không có cột ROAS** — ROAS thật của từng người đã ở mục A; tự tính ROAS trên riêng nhóm content ra ROAS sẽ cho số khác hẳn và gây hiểu nhầm (xem §17.1).
- **Nguồn số liệu + Ghi chú** cuối báo cáo — nằm TRONG `#report-doc` để bản PDF cũng mang theo.

**Quy ước đọc lướt:** sọc ngựa vằn · header dính trong bảng dài · tên content cắt bằng `truncate` kèm tooltip đầy đủ · ROAS tô màu **≥100% xanh · >0% cam · =0% xám** · thẻ KPI dùng số rút gọn ("2,77 tỷ") còn bảng luôn số đầy đủ, RIÊNG *giá data* luôn đầy đủ vì rút gọn che mất chênh lệch hàng chục nghìn đồng.

**Xuất PDF** = `window.print()` in chính `#report-doc`, **tái dùng nguyên vẹn** block `@media print` của Weekly Report trong `web/styles.css` — **không sửa CSS**. Điều kiện in đúng: mọi điều khiển mang `no-print`, mọi bảng dùng `.emp-table` + có `<thead>` (header lặp mỗi trang), mỗi khối bọc `.emp-block`. Thanh nền tỷ trọng tự mất khi in do `#report-doc * { background: transparent !important }` — chủ ý, số liệu còn nguyên.
> ⚠️ `.print-only` khai báo ở `web/styles.css:44` nhưng **không bao giờ được bật lại** trong `@media print` → class này **vô tác dụng**. AR-01 **không dùng** nó.

**Xuất Excel** phải fetch kèm `Authorization: Bearer` rồi tạo blob — KHÔNG mở thẳng URL bằng thẻ `<a>` vì route có `requireAuth`, trình duyệt sẽ nhận 401. Sổ 10 sheet: `Tổng quan` · `Top chi tiêu - Cả team` · `Top - <4 NV>` · `ROAS - <4 NV>`. ROAS lưu dạng **thập phân** + `numFmt '0.00%'`; ô "—" ghi chuỗi nên numFmt tự bỏ qua.

### 17.9 File

```
src/ads-report/
├── config.ts             ← NHAN_VIEN_ADS (DANH SÁCH TRẮNG) · ánh xạ tên 2 chỗ trong file ROAS
│                            — nơi DUY NHẤT sửa quy tắc 1–3
├── types.ts              ← ChiSoKy (bộ 5 chỉ số Sheet) · kiểu riêng của module
├── RoasTongProvider.ts   ← tab "Roas tổng" → mục A
├── RoasTabsProvider.ts   ← batchGet 4 tab nhân viên → mục B & C, kèm thống kê `boQua`
├── AdsReportService.ts   ← nghiệp vụ + GỘP content cả team (§17.6), dùng CHUNG cho JSON và Excel
├── ExcelBuilder.ts       ← dựng .xlsx TỪ KẾT QUẢ service (không đọc Sheet, không tính lại)
├── routes.ts             ← 3 route §17.6
├── audit.ts              ← `npm run report:ads:audit` — tự đọc Sheet THÔ bằng googleapis rồi
│                            so với kết quả module, dung sai 0 (§17.9). Chạy lại mỗi khi
│                            file ROAS đổi bố cục.
└── cli.ts                ← `npm run report:ads -- 10 2026` — dùng CHÍNH service + ExcelBuilder
                             của route /excel nên file CLI và file tải từ dashboard giống hệt nhau

web/ads-report/
├── adsReportApi.ts · format.ts · Filters.tsx
├── SummaryCards.tsx      ← 5 thẻ KPI (ngoài #report-doc, không in)
├── ReportDocument.tsx    ← 3 mục A/B/C + tóm tắt ROAS + nguồn & ghi chú (in được)
└── AdsReportPage.tsx
```

> **Đã gỡ:** `RawDataProvider.ts` (đọc Raw_Data + khử trùng 5 khoá + tách token TQ/NN). Module không còn chạm tới Raw_Data hay `ads_monitor`.

### 17.10 Kiểm chứng (2026-11-03) — **1.369/1.369 phép kiểm khớp, dung sai 0**

Script: `src/ads-report/audit.ts` — chạy bằng **`npm run report:ads:audit`**. Script TỰ đọc Sheet thô bằng `googleapis` (không qua provider của module) để làm "sự thật", rồi so với kết quả `buildAdsReport()`; **mọi so sánh dùng dung sai = 0** vì module phải trả đúng giá trị ô. Chạy lại mỗi khi file ROAS đổi bố cục (thêm/bớt cột, đổi tên tab, đổi tên nhân sự).

| # | Nội dung | Kết quả |
|---|---|---|
| 1 | Mục A: 4 NV × 4 tháng (T7–T10) × 3 nhóm địa lý × 5 chỉ số, so **từng ô** | **240/240 ô** |
| 2 | Dòng CẢ TEAM: T10 phải lấy nguyên dòng `Tổng cộng`; T03 phải chuyển sang cộng 4 dòng + báo thiếu chỉ số. Kiểm chéo: `Tổng cộng T03 − Khiêm = team` → 3.642.506.668 − 497.180.687 = 3.145.325.981 | khớp |
| 3 | **Mục B — gộp content**: dựng lại bảng gộp trực tiếp từ ô Sheet thô rồi so từng content (chi phí · SL data · số nguồn · giá data · ROAS phải null khi gộp); Σ sau gộp = Σ ô Sheet (không mất, không nhân đôi); kiểm riêng content ví dụ của chủ dự án | khớp |
| 4 | Bất biến `Σ content + phần bỏ qua = dòng "Roas tổng"` | khớp |
| 5 | Luật "phát sinh ROAS" đếm đúng, không lọt dòng sai | khớp |

Số liệu T10/2026 (đều là số Sheet): CẢ TEAM `2.770.070.745 đ` · `2.474` data · giá data `1.119.673 đ` · **Roas tháng `149,39%`** · Roas 3 tháng `242,48%`. Content ra ROAS: Hiếu 4 NĐ/9 QT · Kim Anh 6/5 · Ánh 8/10 · Liên 10/7 (**59**).

- `npm run typecheck` + `npm run typecheck:web`: **0 lỗi**. `npm run build`: OK.
- Giao diện kiểm bằng trang xem thử tạm với **dữ liệu thật** (đã xoá sau khi kiểm), đối chiếu text đã render với ô Sheet: **12/12** bảng có `<thead>`, **5/5** phần tử `no-print` ẩn khi áp rule in, `#report-doc` chuyển đen-trắng, thanh tỷ trọng tự mất.
  > ⚠️ Khung xem thử phải **mô phỏng đúng độ sâu DOM của `AppShell`** (`#root > div > div > main > trang`). Khung nông hơn khiến rule `#root > div > div { display:block !important }` trong `@media print` **đè nhầm** lên `.no-print` (selector ID thắng class) → báo nhầm là thanh tiêu đề không ẩn khi in.

> **Lưu ý khi so với Ads Monitor:** chi tiêu của module này giờ theo **file ROAS**, cao hơn `ads_monitor` khoảng 12% (T10: 2.770.070.745 vs 2.466.193.719). Đã loại trừ thiếu ngày (`ads_monitor` đủ 31/31) và VAT (tỷ lệ lệch khác nhau từng người: 11,5%–13,2%). **Nguyên nhân gốc chưa truy ra** — là chênh lệch thật giữa 2 hệ thống, không phải lỗi gộp số.


> **Quy tắc vàng:** PR/commit nào đổi schema, API, sync, dashboard, phân quyền → **cập nhật PROJECT_SPEC.md trong cùng thay đổi đó**.
