# DESIGN_SYSTEM.md — Content Operations Dashboard

> Định nghĩa toàn bộ giao diện. **Mọi màn hình/dashboard phải tuân thủ tài liệu này.**
> Nguồn chuẩn: `public/index.html` (`<style>` + Chart.js options). Liên kết: [PROJECT_SPEC.md](PROJECT_SPEC.md) · [PROJECT_BACKLOG.md](PROJECT_BACKLOG.md)
> Cập nhật lần cuối: 2026-06-25 · Theme mặc định: **Dark**

---

## 0. Design tokens (CSS variables)

| Token | Giá trị | Vai trò |
|---|---|---|
| `--bg` | `#0b1220` | nền trang |
| `--panel` | `#131c2e` | nền card/panel |
| `--panel2` | `#1b2740` | nền phụ (track, hover, chip) |
| `--text` | `#e6edf6` | chữ chính |
| `--muted` | `#8b9bb4` | chữ phụ/nhãn |
| `--line` | `#243049` | viền/đường kẻ |
| `--accent` | `#4f9dff` | nhấn (link, KPI chính, primary) |
| `--green` | `#34d399` | thành công / Duy trì |
| `--amber` | `#fbbf24` | cảnh báo / Đang test |
| `--red` | `#f87171` | nguy hiểm / lỗi |
| `--violet` | `#a78bfa` | phụ (status bar, chưa phân loại) |
| `--slate` | `#64748b` | trung tính / Đã dừng |

> Quy ước: **luôn dùng token**, không hardcode mã màu rời (trừ bảng màu trạng thái/biểu đồ đã chuẩn hóa bên dưới).

---

## 1. Font

- **Font family:** `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (system stack, không tải webfont — tối ưu tốc độ).
- **Monospace** (mã content_code): `ui-monospace, monospace`.
- **Trọng số:** 400 (thường) · 600 (nhãn/tiêu đề phụ) · 700 (số KPI, nhấn mạnh).

## 2. Font size

| Vai trò | Size | Weight | Màu |
|---|---|---|---|
| Base / body | `14px` | 400 | `--text` |
| Brand sidebar | `15px` | 700 | `--text` |
| Tiêu đề trang (topbar `.ttl`) | `15px` | 600 | `--text` |
| Tiêu đề panel `h3` | `14px` | 600 | `--text` |
| Section header `h2.sec` | `13px` | 600 | `--muted`, UPPERCASE, letter-spacing `.04em` |
| Nav item | `13.5px` | — | `--muted` (active: trắng) |
| Control/label phụ | `12–13px` | — | `--muted` |
| KPI value | `25px` | 700 | theo loại |
| KPI label | `12px` | — | `--muted` |
| KPI sub | `11px` | — | `--muted`, tabular-nums |
| Bảng (td/th) | `13px` / `12px` | th 600 | th `--muted` |
| Pill / chip / tag | `11–12px` | — | theo loại |
| Tooltip công thức | `12px` | 400 | `--text` |

## 3. Card

- **KPI card:** nền `--panel`, viền `1px --line`, **radius 12px**, padding `13px 15px`.
  - label 12px `--muted` (mb 5px) → value 25px/700 → sub 11px `--muted`.
  - Biến thể màu value: `.accent`→`--accent`, `.good`→`--green`, `.warn`→`--amber`.
  - `.click` → con trỏ pointer, hover đổi viền `--accent`. `.active` → viền + inset shadow `--accent`.
- **Panel (khối lớn):** nền `--panel`, viền `--line`, radius 12px, padding `16px`, `margin-bottom 16px`; `h3` 14px có hàng phụ `--muted` 12px bên phải.
- **Market card:** padding 16px, radius 12px, hover viền `--accent`, click được.
- **Alert card:** nền `--panel`, **viền trái 3px** (`--amber` mặc định, `--green` khi =0, `--red` khi nguy hiểm), radius 10px, padding `11px 13px`; số 22px/700, nhãn 12px `--muted`.
- **Card nhỏ "Phân bố vòng đời":** danh sách hàng `nhãn — thanh — số`, font 13px.

## 4. Button

- **Mặc định:** nền `--panel`, viền `1px --line`, radius 8px, padding `6px 10px`, font 13px, con trỏ pointer.
- **`.ghost`:** như mặc định, hover nền `--panel2`.
- **`.primary`:** nền `#1d4ed8`, viền cùng màu (dùng cho hành động chính).
- **Segmented (Ngày/Tuần/Tháng):** nút nhỏ padding `3px 8px`, mục đang chọn nền `#1d4ed8`.
- **Disabled:** dùng thuộc tính `disabled` (mờ + không bấm) cho nút phân trang ở biên.

## 5. Table

- Width 100%, `border-collapse: collapse`, font 13px.
- `th`: 12px, 600, màu `--muted`, canh trái; `td/th` padding `8px 9px`, viền dưới `1px --line`.
- Hàng bấm được `tr.click`: con trỏ pointer, hover nền `--panel2`.
- `.tablewrap`: bọc bảng, `max-height 420–560px`, `overflow:auto` (cuộn trong khung); header có thể sticky.
- **Header sort:** `th.sortable` con trỏ pointer, hiển thị `▼` (desc) / `▲` (asc).
- **Phân trang `.pager`:** flex, canh phải, gap 10px, font 13px `--muted`, nút `← Trước` / `Sau →`.
- **Ô đặc thù:** `content_code` dùng `.code` (monospace 12px); thị trường & trạng thái render bằng pill/tag (xem §11).

## 6. Chart (Chart.js)

- **Loại dùng:** `line` (xu hướng/trend), `bar` (trạng thái) — phần lớn dùng **thanh HTML** thay biểu đồ để đọc nhanh (ops-first).
- **Trục:** ticks màu `--muted` (`#8b9bb4`); grid Y màu `--line` (`#243049`), grid X ẩn; `beginAtZero: true`; X `maxRotation:0, autoSkip:true`.
- **Legend:** chữ `--muted`, `boxWidth: 12`.
- **Màu chuỗi trend:** Content được cấp = `--accent` · Đang test = `--amber` · Duy trì = `--green`.
- **Bar trạng thái:** `--violet`, `borderRadius: 6`.
- **Tooltip:** mặc định Chart.js; với chart trạng thái có `afterBody` liệt kê `current_status` gốc.
- **Bảng màu phân bố vòng đời (`DIST_COLORS`):** `0–7`=`#f87171` · `8–30`=`#fb923c` · `31–60`=`#fbbf24` · `61–90`=`#34d399` · `91–180`=`#4f9dff` · `180+`=`#a78bfa`.
- **Thanh tiến độ (bar HTML):** track `--panel2` cao 12–18px radius 5px; fill bo góc, màu theo ngữ cảnh; giá trị canh phải `tabular-nums` 600.

## 7. Sidebar

- Rộng cố định **210px**, nền `#0a101d`, viền phải `1px --line`, padding `14px 10px`, sticky cao `100vh`.
- **Brand:** `⚡ Ops Dashboard`, 15px/700, padding `6px 10px 14px`.
- **Nav item:** flex (icon + nhãn), padding `9px 12px`, radius 9px, font 13.5px, màu `--muted`.
  - hover: nền `--panel`, chữ `--text`.
  - active: nền `--panel2`, chữ trắng.
- Icon nav rộng 18px canh giữa.

## 8. Header (Topbar / Filter bar)

- Sticky top, nền `rgba(11,18,32,.92)` + `backdrop-filter: blur(6px)`, viền dưới `--line`, padding `10px 16px`, `z-index 30`.
- Thành phần (trái→phải): **Tiêu đề trang** (`.ttl` 15px/600) → nhóm filter (`Kỳ`, `TT`, `Người`, `Trạng thái`, ô ngày tùy chỉnh) → nút **Xóa lọc** → `spacer` → **chỉ báo Realtime** (chấm + text).
- **Chấm realtime:** `.dot` 8px tròn, `--amber` (đang/poll) → `--green` (`.on`, đã kết nối).
- **Chips (breadcrumb filter):** ngay dưới header, nền `--panel2`, radius 999px, padding `3px 9px`, font 12px; giá trị in đậm `--accent`; có dấu `✕` gỡ filter (hover đỏ).
- **Control filter:** select/input nền `--panel`, viền `--line`, radius 8px, padding `6px 8px`, font 13px; nhãn 11px `--muted`.

## 9. Khoảng cách (spacing)

- **Thang spacing:** `6 · 8 · 10 · 12 · 14 · 16 · 18px` (gap & padding chọn trong thang này).
- Padding panel `16px`; KPI `13–15px`; alert `11–13px`; control `6–10px`.
- Gap grid: `10–16px`; gap hàng thanh `9px`; gap nhóm filter `5–8px`.
- Vùng nội dung `.view`: padding `18px 16px`, **max-width 1180px**, căn giữa.
- Margin dưới panel/section: `16–18px`.
- **Radius scale:** `6` (tag trạng thái) · `8` (button/control/funnel) · `9` (nav) · `10` (alert) · `12` (card/panel) · `999` (pill/chip/dot).

## 10. Icon

- **Bộ icon:** emoji (không phụ thuộc thư viện, nhẹ). Mỗi module 1 icon cố định:
  - ⚡ Brand · 📋 Tổng quan · 🧪 Tiến độ Test · 👤 Người nhận · 🌐 Thị trường · 🔎 Content Explorer · ⏳ Content Lifecycle · 🔄 Đồng bộ dữ liệu.
- **Icon chức năng:** `ⓘ`/`i` (tooltip công thức — `.qm` 14px tròn `--panel2`), `✕` (gỡ filter/đóng), `▼ ▲` (sort), `← →` (phân trang), `↓` (funnel/conversion), `⬇` (export), `→` (xem danh sách).
- Kích thước icon nav: 18px; icon inline theo cỡ chữ dòng.

## 11. Màu sắc (ngữ nghĩa)

**Trạng thái (chuẩn nghiệp vụ Seryn — S3-001.1)** — tag padding `2px 8px`, radius 6px, font 11px. Tô màu theo `current_status` GỐC; kèm mức độ cảnh báo (chỉ hiển thị):
| current_status | Màu (ý nghĩa) | Nền | Chữ | Mức độ |
|---|---|---|---|---|
| Duy trì - Chưa vít / Đã vít | **Xanh lá** | `#0f3320` | `#34d399` | Ổn định |
| Đang test | **Vàng** | `#3a2a14` | `#fbbf24` | Theo dõi |
| Chờ chạy | **Cam** | `#3a2410` | `#fb923c` | Cần xử lý |
| Không được duyệt | **Đỏ** | `#3a1d1d` | `#f87171` | Khẩn cấp |
| Đã test - không chạy | **Xám** | `#22293a` | `#94a3b8` | — |
| Đã chạy - Tắt | **Xanh dương nhạt** | `#13283a` | `#7dd3fc` | — |
| (rỗng) Chưa phân loại | Tím | `#2a2030` | `#c4b5fd` | — |

> Mọi Dashboard & Badge dùng `statusStyle()` / `<StatusBadge>` để đảm bảo màu thống nhất. Nhóm gom `status_group` dùng `groupStyle()` (DA_DUNG = xám).

**Thị trường (pill)** — padding `2px 8px`, radius 999px, font 11px:
| Thị trường | Nền | Chữ |
|---|---|---|
| `noi_dia` (Nội Địa) | `#0f3d3a` | `#5eead4` |
| `quoc_te` (Quốc Tế) | `#2b2b6b` | `#b6c2ff` |

**Ngữ nghĩa chung:** xanh dương `--accent` = nhấn/chính · xanh lá `--green` = tốt/thành công · vàng `--amber` = chú ý/đang test · đỏ `--red` = lỗi/nguy hiểm · tím `--violet` = phụ · xám `--slate`/`--muted` = trung tính.

## 12. Dark Mode

- **Dark là theme mặc định & duy nhất hiện tại** — toàn bộ token thiết kế cho nền tối (`--bg #0b1220`).
- Nguyên tắc: nền tối phân tầng (`--bg` < `--panel` < `--panel2`); chữ `--text`/`--muted`; viền `--line` mảnh; nhấn bằng màu bão hòa vừa phải (không chói).
- 🔲 **Light mode (kế hoạch):** khi cần, định nghĩa lại bộ token trong `:root[data-theme="light"]` và toggle qua attribute — **không** sửa rải rác. (Thuộc Sprint sau, xem backlog.)

## 13. Responsive

- **Layout chính `.app`:** grid `210px 1fr` (sidebar + nội dung).
- **≤ 860px:** lưới 2 cột (`.charts`, một số `.grid2`) gộp về **1 cột**.
- **≤ 820px:** `.grid2` / `.mcards` về **1 cột**.
- **≤ 760px:** sidebar chuyển ngang (`.nav` cuộn ngang, item `white-space:nowrap`), nội dung full-width.
- **Lưới KPI:** `repeat(auto-fit, minmax(140–170px, 1fr))` — tự co số cột theo bề rộng.
- **Bảng:** bọc `.tablewrap` cuộn dọc/ngang trong khung; không vỡ layout.
- Đã kiểm thử ở mobile (~375px) và desktop (1280px).

---

## Quản trị Design System

- Mọi UI mới **dùng token & class có sẵn**; cần token/biến thể mới → bổ sung vào `<style>` **và** cập nhật file này.
- Không hardcode màu/spacing ngoài thang đã định. Escape HTML mọi giá trị động.
- Thay đổi giao diện → cập nhật DESIGN_SYSTEM.md trong cùng thay đổi (đồng bộ với Quy tắc vàng của PROJECT_SPEC).
