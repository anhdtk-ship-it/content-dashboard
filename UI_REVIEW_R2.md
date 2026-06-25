# SPRINT REVIEW 2 — Task R2: Đánh giá toàn bộ UI

> Phạm vi: **app refactor React** (`web/`) — 5 màn hình: Tổng Quan · Người Nhận · Thị Trường · Content Explorer · Vòng đời.
> Phương pháp: đo computed style thật qua DOM + đối chiếu [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
> Thang điểm: **A** (đạt chuẩn) · **B** (ổn, có điểm cần chỉnh) · **C** (thiếu/lệch rõ).
> Ngày: 2026-06-25 · **Không sửa code — chỉ báo cáo.**

## Baseline đo được (thực tế)
| Hạng mục | Giá trị đo | Chuẩn DESIGN_SYSTEM | Nhận xét |
|---|---|---|---|
| Token màu | bg `#0b1220` · surface `#131c2e` · fg `#e6edf6` · accent `#4f9dff` | đúng | ✅ |
| Theme | `data-theme="dark"` | dark mặc định | ✅ |
| Base font-size | **16px** | 14px | ⚠️ lệch (component override 13px nên ít lộ) |
| Font family | `ui-sans-serif, system-ui…` (mặc định Tailwind) | `system-ui, -apple-system, Segoe UI, Roboto` | ⚠️ lệch nhẹ (đều system) |
| `body` color | **rgb(0,0,0)** (đen) | nên = fg | ⚠️ rủi ro chữ không style |
| KPI value | 25px | 25px | ✅ |
| FilterBar | sticky · padding 10×16 | sticky · 10×16 | ✅ |
| **Sidebar trong app React** | **không có** | có (S2-002) | ❌ chưa tích hợp |

## Đánh giá theo từng tiêu chí (toàn app)

| Tiêu chí | Điểm | Nhận xét |
|---|:--:|---|
| **Khoảng trắng** | A− | Thang spacing nhất quán (gap 12/14, padding panel 16, mb-4). Một số bảng nhiều cột hơi chật ở mobile. |
| **Màu sắc** | A− | Token chuẩn, tối giản, tag trạng thái/market đúng ngữ nghĩa. Trừ điểm: `body` color đen mặc định (chữ chưa style sẽ tàng hình). |
| **Font** | B | Cỡ chữ explicit khớp chuẩn (13/12/25), nhưng base 16px + font-stack mặc định Tailwind khác DESIGN_SYSTEM. |
| **Kích thước** | A− | KPI 25px, label 12px, table 13px — đồng nhất, đọc tốt. |
| **Responsive** | A | Đã kiểm desktop/laptop/tablet/mobile: grid co đúng, bảng cuộn-x, drawer full-width, filter wrap. |
| **Sidebar** | C | Component Sidebar/AppShell đã build (S2-002) nhưng **chưa wire vào app**; điều hướng chỉ qua URL hash, không có menu hiển thị. |
| **Header** | B− | FilterBar đóng vai header (sticky, tiêu đề + filter + realtime), nhưng thiếu breadcrumb / user menu / notifications / theme toggle (đã có component, chưa dùng). |
| **Card** | A− | `KPICard/StatCard/ContentCard/ChartCard` tái dùng nhất quán, có tooltip công thức. |
| **Chart** | B+ | Thanh HTML "ops-first" rõ, đọc nhanh, màu tiết chế. Thiếu đa dạng (không có trend line trong app refactor). |
| **Table** | A−/B | Explorer xuất sắc (sticky header + sticky cột Mã, sort, paginate, hover, drawer). Bảng Người Nhận (13 cột) & Top20 chưa sticky cột đầu → cuộn-x hơi khó theo dõi. |
| **Drawer** | A− | Drawer Explorer đầy đủ (thông tin + timeline + history + trello + tuổi thọ), tái dùng ở Vòng đời. Thiếu: đóng bằng phím ESC, focus-trap. |

## Đánh giá theo từng màn hình

| Màn hình | Khoảng trắng | Màu | Font | Kích thước | Responsive | Card | Chart | Table | Drawer | **Tổng** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Tổng Quan** | A | A | B | A | A | A | B+ | — | — | **B+** |
| **Người Nhận** | B+ | A | B | A | A | A | B | B | A | **B+** |
| **Thị Trường** | A | A | B | A | A | A | B+ | — | A | **B+** |
| **Content Explorer** | A | A | B | A | A | A | — | A | A | **A−** |
| **Vòng đời** | A− | A | B | A | A | A | B+ | B | A | **B+** |

> Sidebar & Header chấm ở mức app (C / B−) áp dụng chung cho mọi màn hình do chưa tích hợp shell điều hướng.

**Điểm tổng app: B+** — component library & màn hình nội dung chất lượng cao (A−), bị kéo xuống bởi **thiếu khung điều hướng (Sidebar/Header)** và vài lệch nhỏ về font.

## Đề xuất cải tiến (ưu tiên)

### Cao
1. **Tích hợp `AppShell` + `Sidebar` + `Header`** (đã có ở S2-002) vào `web/` để có điều hướng cố định, breadcrumb, user menu, **DarkModeToggle**, notifications — thay vì điều hướng chỉ qua URL. Đây là khoảng trống lớn nhất.
2. **Sticky cột đầu** cho bảng Người Nhận (13 cột) và Top20 Vòng đời — giúp theo dõi khi cuộn ngang (như đã làm ở Explorer).

### Trung bình
3. Đặt `font-family` theo DESIGN_SYSTEM và **base 14px**; set `body { color: var(--fg) }` để tránh lỗi chữ đen tiềm ẩn.
4. Bảng nhiều cột: thêm **mật độ (compact)** và **ẩn/hiện cột** cho màn Người Nhận.
5. Drawer: hỗ trợ **ESC để đóng** + focus-trap (a11y).
6. Trạng thái focus (bàn phím) cho hàng bảng / card click; thêm `aria-label`.

### Thấp
7. Overview: cân nhắc 1 sparkline/trend nhỏ để "đọc xu hướng trong 3 giây".
8. Empty/Loading: đã có skeleton + empty — đồng bộ thêm trạng thái lỗi (retry) ở mọi trang (hiện có ở phần lớn).
9. Tinh chỉnh khoảng trắng mật độ bảng trên mobile (padding ô).

## Kết luận

UI **đạt mức B+**: hệ thống component & 5 màn hình nội dung bám sát DESIGN_SYSTEM (màu/kích thước/responsive tốt, Explorer mức A−). Hai việc nâng hạng lên **A**: (1) tích hợp **khung điều hướng Sidebar/Header** đã dựng sẵn, (2) chuẩn hóa **font base + body color** và **sticky cột** cho các bảng rộng. Không có lỗi UI nghiêm trọng; các đề xuất là cải thiện trải nghiệm, không phải sửa lỗi chặn.
