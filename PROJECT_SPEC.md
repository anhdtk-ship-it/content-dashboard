# PROJECT_SPEC.md — Content Operations Dashboard

> **Tài liệu gốc (single source of truth).** Mọi thay đổi về kiến trúc, schema, sync, dashboard, API, phân quyền… **bắt buộc cập nhật vào file này**.
>
> Cập nhật lần cuối: 2026-06-25 · Trạng thái: đang phát triển
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
  6. Ghi `sync_logs` + in `Rows Read / Inserted / Updated / Errors / Duration`.
- **Backfill ngày** (`src/backfill-dates.ts`): tính lại `*_real` cho toàn bộ (update theo `id`, 25 luồng song song).
- **Đặc tính**: chỉ upsert (KHÔNG xóa dòng đã biến mất khỏi sheet). 🟡 đồng bộ 2 chiều (xóa stale) = kế hoạch.
- **Tự động hoá**: 🔲 cron auto-sync (đã cài `node-cron` nhưng chưa wire). Hiện chạy tay: `npm run sync`.

Lệnh: `npm run sync` · `npm run backfill`.

---

## 4. Dashboard (SPA — `public/index.html`)

Filter toàn cục (sticky): **Thời gian** (9 preset + tùy chỉnh) · **Thị trường** · **Người nhận** · **Trạng thái** · nút Xóa lọc. Mọi KPI/biểu đồ/bảng đều theo filter. Realtime (anon key) + polling 30s. Drill-down đa tầng (set filter chồng nhau → Content Explorer). Loading skeleton + empty state.

**Chuẩn hóa `status_group`** (tầng dashboard, không đổi DB):
`Chờ chạy→CHO_CHAY` · `Đang test→DANG_TEST` · `Duy trì - Chưa vít/Đã vít→DUY_TRI` · `Đã test-ko chạy / Đã chạy-Tắt→DA_DUNG` · `Không được duyệt→KHONG_DUYET` · rỗng→`CHUA_PHAN_LOAI`.

**Định nghĩa chất lượng (current_status gốc)**: Đã được test = {Đang test, Duy trì*, Đã test-ko chạy, Đã chạy-Tắt}; Thành công = {Duy trì*, Đã chạy-Tắt}; Thất bại = {Đã test-ko chạy}.

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

---

## 5. Phân quyền 🔲 (thiết kế — chưa triển khai)

| Vai trò | Quyền |
|---|---|
| **Admin** | Toàn quyền: xem mọi dashboard, chạy sync, quản lý user, sửa cài đặt |
| **Viewer** (email `@seryn.vn`) | Chỉ đọc dashboard; không sync/không cài đặt/không quản lý user |

**Hướng triển khai dự kiến**: Supabase Auth (email OTP/SSO) → kiểm tra domain `@seryn.vn` cấp role `viewer`, danh sách admin cấu hình riêng. RLS bật trên `contents`/`sync_logs` cho client anon; API service-role chỉ chạy phía server. Hiện tại **chưa có auth** — dashboard mở, anon key chỉ phục vụ realtime.

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
SPA Dashboard  (realtime anon + polling 30s)
```

Khi sheet đổi → chạy `npm run sync` → DB cập nhật → API cache hết hạn (≤10s) / realtime → UI refresh.

---

## 7. API (Express — base `http://localhost:4000`)

Query filter chung: `from,to` (YYYY-MM-DD) · `market` · `assignee` · `status` · `dateField` (`upload_date_real`\|`test_date_real`).

| Method · Path | Vai trò |
|---|---|
| `GET /api/config` | Trả `url` + `anonKey` cho realtime client ✅ |
| `GET /api/v3/summary` | KPI, metrics nghiệp vụ, funnel, byAssignee, byMarket, byStatus, alerts, trend (`trend=day\|week\|month`) ✅ |
| `GET /api/v3/contents` | Danh sách + phân trang (`page,pageSize`) + `q` + drill (`alert,ageMin,ageMax,codes,endedExact,sort`) ✅ |
| `GET /api/v3/sync-status` | Tổng quan độ phủ ngày + `sync_logs` gần nhất ✅ |
| `GET /api/v3/lifecycle` | KPI vòng đời, byEditorAvg/byAssigneeAvg/byMarketAvg, distribution, top20 (lọc kỳ theo `test_date_real`) ✅ |
| `GET /api/v3/lifecycle-table` | Danh sách đã tính `ageDays`/`maintainDays` (client tự lọc/export) ✅ |
| `GET /api/v3/content-detail` | Chi tiết 1 content + timeline (`code,market,assignee`) ✅ |

> Quy ước: tham số mới phải **tùy chọn** (không phá hành vi mặc định của module khác).

---

## 8. Folder structure

```
content-dashboard/
├── PROJECT_SPEC.md          ← tài liệu gốc (file này)
├── mapping-spec.md          ← đặc tả mapping Sheet→Supabase
├── package.json             ← scripts: dashboard|dev|sync|backfill
├── tsconfig.json            ← CommonJS, strict, types:[node]
├── .env                     ← SUPABASE_*, GOOGLE_* (gitignored)
├── credentials/
│   ├── credentials.json     ← Service Account key (gitignored)
│   └── README.md
├── sql/
│   ├── 001_fix_contents.sql
│   ├── 002_unique_key.sql
│   ├── 003_sync_logs.sql
│   └── 004_date_real.sql
├── src/
│   ├── server.ts              ← Express API V3 + transform/aggregation
│   ├── sync-all-content.ts    ← Sync Engine (upsert)
│   ├── backfill-dates.ts      ← backfill *_real
│   ├── date-util.ts           ← parseDdmmToReal()
│   ├── sheets-reader.ts       ← đọc/đếm toàn bộ sheet (+ EXCLUDED_SHEETS)
│   ├── transform-content.ts   ← export mẫu 20 record
│   ├── import-sample.ts       ← import mẫu (POC)
│   ├── analyze-headers.ts     ← phân tích header
│   ├── check-duplicates.ts    ← phân tích trùng khóa
│   └── test-google-connection.ts ← kiểm tra kết nối Sheets
├── public/
│   └── index.html           ← SPA 7 module
├── output/                  ← JSON xuất (contents-report, sample-import)
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
- [x] Kết nối Google Sheets (Service Account)
- [x] Supabase: `contents`, `sync_logs`, `content_status_history`
- [x] Migrations 001–004 (unique key, `*_real`)
- [x] Sync Engine (upsert idempotent + dedupe + `sync_logs`)
- [x] Backfill `*_real`
- [x] Loại trừ `QT/NĐ Khiêm`
- [ ] Auto-sync theo lịch (cron) 🔲
- [ ] Đồng bộ xóa content stale (2 chiều) 🔲
- [ ] Ghi `content_status_history` khi đổi `current_status` 🔲

### Dashboard
- [x] Filter toàn cục + drill-down + realtime + skeleton/empty
- [x] Tổng Quan (6 KPI + tooltip)
- [x] Người Nhận
- [x] Thị Trường
- [x] Content Explorer (search/sort/phân trang/export CSV)
- [x] Vòng đời Content (tính từ Set Ads)
- [x] Quản lý Sync (xem log)
- [ ] Trigger sync từ UI 🔲
- [ ] Retention Curve (chờ history) 🟡
- [ ] Quản lý User 🔲
- [ ] Cài đặt 🔲

### Phân quyền & vận hành
- [ ] Supabase Auth (đăng nhập) 🔲
- [ ] Role Admin / Viewer (@seryn.vn) 🔲
- [ ] RLS cho client anon 🔲
- [ ] Deploy (hiện chạy local `:4000`) 🔲

### Tài liệu
- [x] `mapping-spec.md`
- [x] `PROJECT_SPEC.md` (file này — tài liệu gốc)

---

> **Quy tắc vàng:** PR/commit nào đổi schema, API, sync, dashboard, phân quyền → **cập nhật PROJECT_SPEC.md trong cùng thay đổi đó**.
