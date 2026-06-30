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
  6. **Khử trùng (4b)**: xóa content "mồ côi" — khóa có trong `contents` nhưng KHÔNG còn trong Sheet. Bật/tắt qua `SYNC_PRUNE_STALE` (mặc định `true`). **Guard an toàn**: bỏ qua nếu upsert có lỗi, hoặc đọc Sheet < 1000 content, hoặc số mồ côi > `max(200, 30% DB)`.
  7. Ghi `sync_logs` + in `Rows Read / Inserted / Updated / Pruned / Errors / Duration`.
- **Backfill ngày** (`src/backfill-dates.ts`): tính lại `*_real` cho toàn bộ (update theo `id`, 25 luồng song song).
- **Đặc tính**: upsert + **khử trùng 1 chiều** (Sheet → DB; xóa dòng đã biến mất khỏi sheet, có guard). ✅ đồng bộ xóa stale (thay cho trạng thái kế hoạch trước đây).
- **Tự động hoá**: scheduler `node-cron` (`src/sync-scheduler.ts`, `npm run scheduler`) — `SYNC_ENABLED`/`SYNC_CRON`. Hoặc chạy tay: `npm run sync`.

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

### 12.2 Công thức KPI (RIÊNG — chỉnh ở `WeeklyReportService`)
- **Đã cấp** = số content giao cho nhân viên (rows).
- **Đã test** = đã đưa vào chạy test ≥1 lần → `test_date_real != null`.
- **Tồn** = `Đã cấp − Đã test` (động, không lưu DB).
- **Tỷ lệ test** = `Đã test / Đã cấp` (làm tròn 1 chữ số thập phân).
- **Content test win** = chuyển test→maintain → content đạt trạng thái **"Duy trì"** (và đã test). ⚠️ Tính bằng rule riêng của Weekly trên dữ liệu Content; KHÔNG gọi `ads_monitor_lifecycle` (grain khác). *Cần nghiệp vụ xác nhận.*
- **Tỷ lệ win** = `win / Đã test` (1 chữ số thập phân).

### 12.3 Cấu trúc báo cáo (PHASE 9 — print-friendly, `ReportDocument`)
Bố cục **văn bản** (KHÔNG KPICard/biểu đồ/bảng Excel), dùng CHUNG cho web + in.
- **I. Tiến độ Content**: Tổng quan team (6 KPI dạng hàng nhãn–giá trị) + block từng nhân viên.
- **II. Đánh giá**: theo nhân viên — **Đánh giá (≤2)** + **Hành động tuần tới (≤2)**, sinh bằng **RULE ENGINE** (`services/ruleEngine.ts`): độc lập theo KPI của chính nhân viên (ngưỡng cố định; KHÔNG xếp hạng / so sánh / trung bình team), mỗi ý gắn **KPI cụ thể** + hành động rõ ràng. Nhập tay được.
- **III. Kế hoạch tuần tới**: checklist (☐) lấy từ Hành động tuần tới của từng nhân viên.
- **Chế độ Xem trước** (toggle); phần II/III lưu **cục bộ** (CHƯA persist).

### 12.4 Xuất PDF = IN báo cáo (PHASE 9)
- **PDF = bản in của chính `#report-doc`** qua `window.print()` — KHÔNG template/HTML/component riêng. Mọi thay đổi Weekly Report tự phản ánh khi in.
- **`@media print`** (`web/styles.css`): @page A4 portrait + lề; ẩn chrome (`aside`/`header`/`.no-print`); chữ đen nền trắng; `.print-header` lặp mỗi trang (tên báo cáo + kỳ + ngày xuất); footer số trang `counter(page)`; `.emp-block { break-inside: avoid }` → không cắt block nhân viên giữa trang.
- Copy (đã chạy) · DOCX (`enabled:false`, để dành). Nút "Xuất PDF" ép Xem trước rồi `window.print()`.

### 12.5 Mở rộng Monthly Report
Tái dùng `WeeklyReportService` + `ruleEngine` + `ReportDocument` + print CSS; chỉ đổi `utils/week`→`utils/month`, thêm route `#/monthly-report`.

---

> **Quy tắc vàng:** PR/commit nào đổi schema, API, sync, dashboard, phân quyền → **cập nhật PROJECT_SPEC.md trong cùng thay đổi đó**.
