# Mapping Spec: Google Sheets → Supabase

> Phạm vi: 8 sheet content hợp lệ
> `NĐ Hiếu`, `QT Hiếu`, `NĐ Ánh`, `QT Ánh`, `NĐ KA`, `QT KA`, `NĐ Liên`, `QT Liên`
>
> Đã loại trừ tuyệt đối: `QT Khiêm`, `NĐ Khiêm` (xem `EXCLUDED_SHEETS`).
> Tài liệu này chỉ đặc tả mapping — **không ghi DB, không sửa code hiện có.**

---

## 1. Cấu trúc chung của 8 sheet

- **Dòng 1–2:** trang trí / ghi chú / tên page (không phải dữ liệu).
- **Dòng header thật:** dòng chứa ô `STT` (thường là dòng 3).
- **Cột A** luôn trống (lề trái) → bỏ qua.
- **Dữ liệu:** từ dòng ngay sau header trở xuống.
- 14 cột đầu **giống nhau hoàn toàn** ở cả 8 sheet.
- Từ cột thứ 15 trở đi là **các cột Page Facebook** (số lượng & tên thay đổi theo từng sheet).

### Bảng cột cố định (14 cột chuẩn)

| Cột (sau A) | Header gốc        | Ví dụ giá trị                                             | Ý nghĩa |
|-------------|-------------------|----------------------------------------------------------|---------|
| B           | `STT`             | `1`, `2`, `3`                                             | Số thứ tự dòng |
| C           | `ID content 1`    | `250525-CGSĐ Hiếu làm 1 nhận 5 250412 tvc v1`            | Định danh + mô tả content |
| D           | `ID content 2`    | `tthuyen-3DNDT-2D-NDT-mt-tvc-mass-ads.hieuvm`            | Mã sản xuất / mã đặt tên ads |
| E           | `CGSĐ`            | `Hiếu`, `Xuân`, `TH`                                      | Chuyên gia sắc đẹp xuất hiện trong content |
| F           | `Biên tập`        | `tthuyen`, `Quỳnh`, `Hân`                                 | Người biên tập |
| G           | `Link trello`     | `https://trello.com/c/...`                                | Link thẻ Trello |
| H           | `Note`            | `Meta Codex`, `SC`, ``                                    | Ghi chú |
| I           | `Ngày up trello`  | `07/04`, `18/08`                                          | Ngày đưa lên Trello (dd/mm) |
| J           | `Mức độ ưu tiên`  | `Ưu tiên`, `TRUE`, ``                                     | Mức ưu tiên |
| K           | `Tình trạng`      | `Đã up RM`                                                | Trạng thái quy trình (upload RM) |
| L           | `TVOL NOTE`       | `FALSE`, `Ưu tiên`, ``                                    | Ghi chú TVOL |
| M           | `Địa Lý`          | `QT Hiếu`, `NĐ Liên`, ``                                  | Nhãn địa lý nội bộ (thường trùng thông tin sheet) |
| N           | `Trạng thái ads`  | `Đã chạy-Tắt`, `Duy trì - Chưa vít`, `Đã test-ko chạy`   | **Trạng thái chạy ads hiện tại** |
| O           | `Ngày test`       | `01/09`, `5/7`, ``                                        | Ngày test ads (dd/mm) |
| P → …       | *(tên page FB)*   | `1388581546029892`, `https://facebook.com/reel/...`      | ID/URL bài đăng theo từng page → xem mục 4 |

---

## 2. Mapping Google Sheet → Supabase (các trường bắt buộc)

| Trường Supabase   | Nguồn (sheet)                         | Kiểu dữ liệu | Ghi chú chuẩn hóa |
|-------------------|----------------------------------------|--------------|-------------------|
| `content_code`    | `ID content 1`                         | `text`       | Định danh chính. Tách được mã ngày ở đầu (`YYMMDD`) nếu cần. **Không unique toàn cục** (xem §3). |
| `title`           | `ID content 1` (đã làm sạch)           | `text`       | Tiêu đề mô tả = `ID content 1` sau khi bỏ tiền tố `YYMMDD-`. |
| `market`          | **Tên sheet** (`QT`/`NĐ`)              | `enum/text`  | `QT` → `quoc_te`, `NĐ` → `noi_dia`. Không có cột riêng. |
| `assignee_name`   | **Tên sheet** (phần sau prefix)        | `text`       | `Hiếu`, `Ánh`, `KA` (= Kim Anh), `Liên`. |
| `cgsd`            | `CGSĐ` (cột E)                          | `text`       | Chuyên gia trong content (khác `assignee_name`). |
| `editor_name`     | `Biên tập` (cột F)                      | `text`       | |
| `trello_link`     | `Link trello` (cột G)                   | `text`       | Có thể validate dạng URL `trello.com/c/...`. |
| `upload_date`     | `Ngày up trello` (cột I)                | `date` + raw | Gốc `dd/mm`, **thiếu năm** → lưu kèm `upload_date_raw` (text). |
| `current_status`  | `Trạng thái ads` (cột N)                | `text/enum`  | Trạng thái chạy ads thực tế (xem tập giá trị §2.1). |
| `test_date`       | `Ngày test` (cột O)                     | `date` + raw | Gốc `dd/mm`, thiếu năm → lưu kèm `test_date_raw`. |

### 2.1. Tập giá trị quan sát được của `current_status` (`Trạng thái ads`)
- `Đã chạy-Tắt`
- `Duy trì - Chưa vít`
- `Đã test-ko chạy`
- `Đã test-ko chạy` / `Không được duyệt`
- *(trống)*

> Khuyến nghị: lưu `text` trước, sau khi gom đủ giá trị mới chuẩn hóa thành `enum`/bảng tra cứu `ad_statuses`.

### 2.2. Các cột nên map thêm (ngoài 10 trường bắt buộc)
Để không mất dữ liệu, nên đưa vào schema:

| Trường Supabase     | Nguồn            | Kiểu   | Ghi chú |
|---------------------|------------------|--------|---------|
| `production_code`   | `ID content 2`   | `text` | Mã sản xuất/ads (chứa editor + mã định dạng). |
| `note`              | `Note`           | `text` | |
| `priority`          | `Mức độ ưu tiên` | `text` | `Ưu tiên` / `TRUE` / trống → có thể map `is_priority boolean`. |
| `workflow_status`   | `Tình trạng`     | `text` | Khác `current_status`; thường `Đã up RM`. |
| `tvol_note`         | `TVOL NOTE`      | `text` | |
| `geo_label`         | `Địa Lý`         | `text` | Nhãn nội bộ; thường trùng market/assignee. |
| `stt`               | `STT`            | `int`  | Số thứ tự trong sheet (tham chiếu). |

### 2.3. Metadata nguồn (để truy vết & idempotent sync)
| Trường        | Nguồn        | Ghi chú |
|---------------|--------------|---------|
| `source_sheet`| tên sheet    | vd `QT Hiếu` |
| `source_row`  | chỉ số dòng  | dòng trong sheet (để cập nhật/đối soát) |
| `synced_at`   | thời điểm sync | `timestamptz` |

---

## 3. Lưu ý quan trọng về khóa & trùng lặp

- **`content_code` (ID content 1) KHÔNG unique toàn cục.** Cùng một creative xuất hiện ở nhiều sheet/market khác nhau
  (vd `250525-CGSĐ Hiếu làm 1 nhận 5 250412 tvc v1` có ở cả `QT Hiếu` và `QT Liên`).
- **Khóa chính:** dùng `id uuid` (surrogate).
- **Ràng buộc unique đề xuất:** `UNIQUE (content_code, market, assignee_name)`
  → một content thuộc về một (market, assignee) là một bản ghi.
- `upload_date` / `test_date` định dạng `dd/mm` **không có năm**, đôi khi `d/m` (vd `5/7`). Luôn lưu thêm cột `*_raw`,
  parse `date` ở bước sau (suy luận năm theo ngữ cảnh tháng/quý), tránh ép kiểu ngay khi import.

---

## 4. Các cột Page Facebook (bên phải)

### 4.1. Bản chất
- Từ cột **P trở đi**, mỗi cột = **một Page Facebook**.
- **Tên cột (header) thay đổi theo từng sheet**, có 2 dạng:
  - Tên ngắn: `Hiếu 83`, `Hiếu 84`, `ÁNH 90`, `Ánh 134` …
  - Tên đầy đủ: `Chuyên gia trẻ hóa Lại Minh Hiếu - Mega Gangnam Hàn Quốc`, `Lại Minh Hiếu - Seryn Clinic` …
  - Một số header **chứa cả URL page** và **bị xuống dòng** (vd `Phòng khám đa\nkhoa Seryn\nViệt Nam https://facebook.com/...`).
- **Giá trị ô** = bài đăng của content đó trên page tương ứng, ở các dạng:
  - ID số: `1388581546029892`
  - Có tiền tố: `facebook.com/1117946306513310`
  - URL reel đầy đủ kèm tracking: `https://www.facebook.com/reel/4077937722427301/?__cft__...`
  - Đôi khi text: `đăng`, hoặc số dạng khoa học `4,13E+20` (lỗi định dạng Sheets).

### 4.2. ❌ Không nên: tạo cột động cho mỗi page
Số page khác nhau giữa các sheet và thay đổi theo thời gian → schema cột cứng sẽ vỡ.

### 4.3. ✅ Đề xuất: chuẩn hóa sang **bảng quan hệ 1-nhiều** (long format)

Bảng `content_facebook_posts`:

| Cột            | Kiểu          | Ghi chú |
|----------------|---------------|---------|
| `id`           | `uuid` PK     | |
| `content_id`   | `uuid` FK → `contents.id` | content gốc |
| `page_name`    | `text`        | header cột (chuẩn hóa: trim, gộp xuống dòng thành 1 dòng) |
| `page_url`     | `text` null   | tách URL từ header nếu có |
| `fb_post_id`   | `text` null   | ID số sau khi trích từ giá trị ô |
| `fb_post_url`  | `text` null   | URL đầy đủ nếu ô là link reel |
| `raw_value`    | `text`        | **giữ nguyên giá trị gốc** để đối soát |
| `column_index` | `int`         | vị trí cột trong sheet (tham chiếu) |

**Quy tắc trích xuất `fb_post_id` / `fb_post_url` từ `raw_value`:**
1. Bỏ ô trống.
2. Nếu khớp `^\d{6,}$` → `fb_post_id`.
3. Nếu chứa `facebook.com/<digits>` → lấy `<digits>` làm `fb_post_id`.
4. Nếu là URL `facebook.com/reel/...` → lưu `fb_post_url`, lấy `reel/<id>` làm `fb_post_id`.
5. Dạng `4,13E+20`, `đăng`, … → để `fb_post_id = null`, **giữ `raw_value`** và gắn cờ cần review.

> Một content có thể không có bài trên page nào, hoặc có trên nhiều page → đúng mô hình 1-nhiều.
> Tổng hợp dạng wide (mỗi page 1 cột) có thể tạo lại bằng VIEW khi cần hiển thị.

---

## 5. Schema Supabase đề xuất (DDL tham khảo)

```sql
-- Bảng content chính
create table contents (
  id                uuid primary key default gen_random_uuid(),
  content_code      text not null,            -- ID content 1
  title             text,                      -- ID content 1 đã làm sạch
  production_code   text,                      -- ID content 2
  market            text not null,             -- quoc_te | noi_dia (từ tên sheet)
  assignee_name     text not null,             -- Hiếu | Ánh | KA | Liên (từ tên sheet)
  cgsd              text,                      -- CGSĐ
  editor_name       text,                      -- Biên tập
  trello_link       text,                      -- Link trello
  note              text,                      -- Note
  upload_date       date,                      -- parse từ Ngày up trello
  upload_date_raw   text,                      -- giá trị gốc dd/mm
  priority          text,                      -- Mức độ ưu tiên
  workflow_status   text,                      -- Tình trạng (Đã up RM…)
  tvol_note         text,                      -- TVOL NOTE
  geo_label         text,                      -- Địa Lý
  current_status    text,                      -- Trạng thái ads
  test_date         date,                      -- parse từ Ngày test
  test_date_raw     text,                      -- giá trị gốc dd/mm
  stt               int,                       -- STT
  source_sheet      text not null,             -- tên sheet nguồn
  source_row        int,                       -- dòng nguồn
  synced_at         timestamptz default now(),
  unique (content_code, market, assignee_name)
);

-- Bảng bài đăng Facebook (chuẩn hóa cột page)
create table content_facebook_posts (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references contents(id) on delete cascade,
  page_name     text not null,
  page_url      text,
  fb_post_id    text,
  fb_post_url   text,
  raw_value     text not null,
  column_index  int,
  synced_at     timestamptz default now()
);

create index on contents (market, assignee_name);
create index on contents (content_code);
create index on content_facebook_posts (content_id);
```

---

## 6. Quy tắc suy ra `market` & `assignee_name` từ tên sheet

| Tên sheet | `market`  | `assignee_name` |
|-----------|-----------|-----------------|
| `QT Hiếu` | `quoc_te` | `Hiếu`          |
| `NĐ Hiếu` | `noi_dia` | `Hiếu`          |
| `QT Ánh`  | `quoc_te` | `Ánh`           |
| `NĐ Ánh`  | `noi_dia` | `Ánh`           |
| `QT KA`   | `quoc_te` | `KA` (Kim Anh)  |
| `NĐ KA`   | `noi_dia` | `KA` (Kim Anh)  |
| `QT Liên` | `quoc_te` | `Liên`          |
| `NĐ Liên` | `noi_dia` | `Liên`          |

> Prefix khớp không phân biệt hoa thường và bỏ khoảng trắng thừa (`QT Liên ` cũng hợp lệ).

---

## 7. Tóm tắt quyết định mapping

1. **10 trường bắt buộc** → cột cố định + suy ra từ tên sheet (market, assignee).
2. **content_code = ID content 1**, không unique toàn cục → khóa surrogate + unique `(content_code, market, assignee_name)`.
3. **current_status = `Trạng thái ads`** (không phải `Tình trạng`).
4. **Cột Page Facebook** → **không** tạo cột động; chuẩn hóa sang bảng `content_facebook_posts` (long format), giữ `raw_value`.
5. **Ngày tháng** thiếu năm → lưu raw + parse sau, không ép kiểu khi import.
6. Giữ thêm các cột phụ (`production_code`, `note`, `priority`, `workflow_status`, `tvol_note`, `geo_label`) để không mất dữ liệu.
