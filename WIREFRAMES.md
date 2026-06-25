# WIREFRAMES.md — Content Operations Dashboard (Redesign V2)

> Wireframe low-fidelity (ASCII, không code). Mục tiêu: **hiện đại · đọc KPI trong 3 giây · ưu tiên quản trị nội bộ · không ưu tiên hiệu ứng.**
> Tuân thủ [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Liên kết: [PROJECT_SPEC.md](PROJECT_SPEC.md) · [PROJECT_BACKLOG.md](PROJECT_BACKLOG.md)
> Cập nhật: 2026-06-25

## Nguyên tắc bố cục (đọc trong 3 giây)

1. **KPI nằm dòng trên cùng**, cỡ số lớn, tối đa 1 hàng — mắt quét trái→phải.
2. **F-pattern:** quan trọng nhất ở trên-trái; chi tiết/bảng ở dưới.
3. Mỗi màn hình ≤ 3 tầng thông tin: **KPI → trực quan (chart/bars) → bảng chi tiết.**
4. Số > biểu đồ. Bảng đặc gọn, pill màu trạng thái để nhận diện tức thì.
5. Filter toàn cục cố định ở Header; trạng thái filter hiện ở Chips.

---

## 0. App Shell (dùng chung mọi màn hình)

```
┌────────────────┬───────────────────────────────────────────────────────────┐
│  ⚡ Ops Dash    │  HEADER                                                    │
│                │  [Tiêu đề màn hình]   [Kỳ▾][TT▾][Người▾][Trạng thái▾][✕]    │
│  DASHBOARDS    │                       [🔍 Tìm…]      [● Realtime] [◯ User▾] │
│  📋 Tổng Quan  ├───────────────────────────────────────────────────────────┤
│  👤 Người Nhận │  CHIPS:  🕒 Tháng này (01–30/06)  · TT: Nội Địa ✕          │
│  🌐 Thị Trường ├───────────────────────────────────────────────────────────┤
│                │                                                            │
│  CONTENT       │   ▓▓▓  VÙNG NỘI DUNG MODULE  ▓▓▓                            │
│  🔎 Explorer   │                                                            │
│  ⏳ Vòng đời   │                                                            │
│                │                                                            │
│  INSIGHTS      │                                                            │
│  📊 Reports    │                                                            │
│  🔔 Alerts ④   │  (④ = badge số cảnh báo chưa xử lý)                        │
│                │                                                            │
│  SYSTEM        │                                                            │
│  🔄 Sync       │                                                            │
│  👥 User       │                                                            │
│  ⚙️  Settings  │                                                            │
└────────────────┴───────────────────────────────────────────────────────────┘
```

- **Sidebar (210px):** brand trên cùng; nav **gom nhóm** (Dashboards / Content / Insights / System) — phân cấp rõ cho quản trị. Item active nền sáng hơn. Badge số trên **Alerts**.
- **Header (sticky):** trái = tiêu đề; giữa = bộ lọc toàn cục + ô tìm; phải = chỉ báo Realtime + menu User (avatar → đổi role view / đăng xuất). Nút **✕ Xóa lọc**.
- **Chips:** hàng mảnh hiển thị các filter đang áp, mỗi cái có ✕ để gỡ.
- **Responsive:** ≤760px sidebar thu thành thanh icon ngang; filter xếp dòng.

---

## 1. Dashboard Tổng Quan  `#/overview`

```
HEADER: Tổng Quan ............................. [filters] [search] [● RT]
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Content  │ Đã được  │ Test     │ Đang     │ Tồn kho  │ Không    │  ← KPI (3s)
│ được cấp │ test     │ thành công│ test    │          │ duyệt    │
│  311  ⓘ  │  64% ⓘ   │  14% ⓘ   │  14% ⓘ   │  36% ⓘ   │  0% ⓘ    │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
┌───────────────────────────────┬───────────────────────────────────┐
│  FUNNEL TEST                   │  PHÂN BỐ TRẠNG THÁI                │
│  Tổng ███████████ 311  100%    │  Chờ chạy   ▓▓        13           │
│  Chờ  █ 13           ↓4%        │  Đang test  ▓▓▓▓      44           │
│  Test ███ 44         ↓338%      │  Duy trì    ▓▓▓       21           │
│  Duy  ██ 21          ↓48%       │  Đã dừng    ▓▓▓▓▓▓▓▓  134          │
│                                │  Chưa pl    ▓▓▓▓      98           │
└───────────────────────────────┴───────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────┐
│  CẦN XỬ LÝ   [Chưa pl 98] [Test>14d 3] [Chưa test 96] [Thiếu test…]  │ → click sang Alerts/Explorer
└────────────────────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | KPI row (6 card 1 hàng) → 2 cột (Funnel \| Status bars) → strip cảnh báo |
| **Card** | 6 KPI nghiệp vụ, số lớn 25px + ⓘ tooltip công thức; click KPI → drill Explorer |
| **Table** | Không (Tổng Quan là snapshot) |
| **Chart** | Funnel (thanh ngang + % conversion), Status (thanh ngang HTML — đọc nhanh) |
| **Sidebar/Header** | Shell chuẩn; filter áp toàn bộ KPI |

---

## 2. Dashboard Người Nhận  `#/assignees`

```
HEADER: Người Nhận ............................ [filters] [● RT]
┌──────────┬──────────┬──────────┬──────────┐
│ Hiếu     │ Ánh      │ KA       │ Liên     │  ← KPI tổng/người (success%)
│ 77 · 0%  │ 78 · 14% │ 76 · 38% │ 76 · 11% │
└──────────┴──────────┴──────────┴──────────┘
┌────────────────────────────────────────────────────────────────────┐
│  HIỆU SUẤT THEO NGƯỜI NHẬN              (sort ▼ theo Tỷ lệ thành công)│
│ ┌────────┬──────┬───────┬────────┬───────┬─────────────┬──────────┐ │
│ │Người   │Cấp   │% test │%TC     │% test │% tồn kho    │% k.duyệt │ │
│ ├────────┼──────┼───────┼────────┼───────┼─────────────┼──────────┤ │
│ │KA      │ 77   │ 42%   │ 38% ███│  4%   │ 58%         │ 0%       │ │ ← click → Explorer(KA)
│ │Ánh     │ 78   │ …     │ 14% █  │  …    │ …           │ …        │ │
│ │Liên    │ 76   │ …     │ 11% █  │  …    │ …           │ …        │ │
│ │Hiếu    │ 77   │ …     │  0%    │  …    │ …           │ …        │ │
│ └────────┴──────┴───────┴────────┴───────┴─────────────┴──────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | KPI mini/người (4) → bảng hiệu suất 1 khối |
| **Card** | 4 card tóm tắt (tổng + % thành công) — màu theo ngưỡng |
| **Table** | 1 bảng: Người · Cấp · 6 KPI nghiệp vụ; header có ⓘ công thức; sort theo % TC; click hàng → Explorer lọc người |
| **Chart** | Thanh mini trong ô % thành công (inline bar) thay vì chart riêng |
| **Sidebar/Header** | Shell chuẩn |

---

## 3. Dashboard Thị Trường  `#/markets`

```
HEADER: Thị Trường ............................ [filters] [● RT]
┌─────────────────────────────────┬─────────────────────────────────┐
│  NỘI ĐỊA           TC 14% ▓▓     │  QUỐC TẾ           TC 12% ▓▓     │
│  Cấp 155 · Test 72% · Duy 21     │  Cấp 156 · Test 55% · Duy 17    │
│  ┌────┬────┬────┬────┬────┬────┐ │  ┌────┬────┬────┬────┬────┬────┐│
│  │Cấp │%tst│%TC │%tst│%tồn│%kd │ │  │Cấp │%tst│%TC │%tst│%tồn│%kd ││  ← 6 KPI/thị trường
│  │155 │72% │14% │ 4% │58% │ 0% │ │  │156 │55% │12% │ … │ …  │ … ││
│  └────┴────┴────┴────┴────┴────┘ │  └────┴────┴────┴────┴────┴────┘│
│  [Xem theo người nhận →]         │  [Xem theo người nhận →]        │
└─────────────────────────────────┴─────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────┐
│  SO SÁNH TRỰC TIẾP  (thanh nhóm)                                    │
│  Cấp     Nội ████████ 155   Quốc ████████ 156                       │
│  Đang TT Nội ▓ 6            Quốc ▓ 38                               │
│  Duy trì Nội ▓▓ 21          Quốc ▓ 17                               │
└────────────────────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | 2 thẻ thị trường cạnh nhau → khối so sánh trực tiếp |
| **Card** | 2 market card lớn, click → Người nhận (drill); badge % thành công |
| **Table** | Mini-grid 6 KPI trong mỗi card |
| **Chart** | Thanh nhóm so sánh Nội vs Quốc (HTML bars) |
| **Sidebar/Header** | Shell chuẩn |

---

## 4. Content Explorer  `#/explorer`

```
HEADER: Content Explorer ........ [filters] [🔍 content_code/title…] [● RT]
┌────────────────────────────────────────────────────────────────────┐
│  311 content  · [⬇ Export]                         ◀ 1/16 ▶          │
│ ┌─────────┬───────┬─────┬──────┬───────────┬───────┬────────┐       │
│ │code     │title  │TT   │Người │Trạng thái │Upload │Test    │       │
│ ├─────────┼───────┼─────┼──────┼───────────┼───────┼────────┤       │
│ │260620-..│ …     │[NĐ] │Liên  │[Đang test]│16/06  │24/06   │ →Trello│
│ │260615-..│ …     │[QT] │Hiếu  │[Duy trì]  │16/06  │—       │       │
│ │ … 20 dòng/trang … pill màu thị trường + tag màu trạng thái …      │
│ └─────────┴───────┴─────┴──────┴───────────┴───────┴────────┘       │
└────────────────────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | Toolbar (đếm + search + export + pager) → bảng đầy đủ chiều rộng |
| **Card** | Không (màn dữ liệu thuần) |
| **Table** | Cột: code(mono, link Trello) · title · TT(pill) · Người · Trạng thái(tag) · Upload · Test; sort cột; phân trang 20; nhận drill từ mọi nơi |
| **Chart** | Không |
| **Sidebar/Header** | Shell + ô search nổi bật trên header |

---

## 5. Vòng đời Content  `#/lifecycle`

```
HEADER: Content Lifecycle · tính từ Ngày Set Ads ........ [filters]
┌────────┬────────────┬────────────┬────────────┬────────────┐
│Tuổi thọ│Đang duy trì│Đã từng duy │Mới vào Duy │Kết thúc    │  ← KPI chất lượng
│TB      │lâu nhất    │trì lâu nhất│trì trong kỳ│trong kỳ    │
│81 ngày │164 ngày →  │165 ngày →  │   65       │   212      │   (→ = click timeline)
└────────┴────────────┴────────────┴────────────┴────────────┘
┌───────────────────────────────┬───────────────────────────────────┐
│ TUỔI THỌ TB / BIÊN TẬP        │ TUỔI THỌ TB / NGƯỜI NHẬN          │
│ tthphuc ███████ 116           │ Hiếu  ███████ 111                 │
│ Tuyền   ██████ 109            │ Ánh   █████ 94                    │
└───────────────────────────────┴───────────────────────────────────┘
┌───────────────────────────────┬───────────────────────────────────┐
│ TUỔI THỌ TB / THỊ TRƯỜNG      │ PHÂN BỐ VÒNG ĐỜI (card nhỏ)       │
│ Nội ████ 81   Quốc ████ 82    │ 0–7 ▓ · 8–30 ▓ · 31–60 ▓ · 91–180 │
└───────────────────────────────┴───────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────┐
│ TOP 20 ĐANG DUY TRÌ LÂU NHẤT                       (sort ▼ số ngày) │
│ STT·Content·Biên tập·Người·TT·Ngày test·Số ngày duy trì·Trạng thái  │
│  1 · 260110-… · Phương · Liên · [NĐ] · 12/01 · 164 · [Duy trì]      │ → timeline
└────────────────────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | KPI chất lượng (5) → 2×2 lưới phân tích TB → bảng Top 20 |
| **Card** | 5 KPI (2 card click mở **Timeline chi tiết**) |
| **Table** | Top 20 Duy trì: 8 cột gồm **Biên tập**; sort số ngày; click → Timeline |
| **Chart** | Thanh TB theo Biên tập/Người/Thị trường + card phân bố nhỏ |
| **Sidebar/Header** | Shell; filter kỳ áp trên `test_date_real` |

**Trang chi tiết (Timeline) — overlay/route con:**
```
[← Quay lại]  260110-SC … · [Trello ↗]
Người: Liên · TT: [NĐ] · Trạng thái: [Duy trì] · Số ngày duy trì: 164
  ● Ngày upload        09/01
  │
  ● Ngày Set Ads(test) 12/01
  │
  ● Trạng thái hiện tại: Duy trì - Chưa vít
```

---

## 6. Reports  `#/reports`  🔲(mới)

```
HEADER: Reports ............................... [Kỳ▾][so sánh kỳ trước ☐]
┌──────────────┬─────────────────────────────────────────────────────┐
│ LOẠI BÁO CÁO │  XEM TRƯỚC                              [⬇ Excel][⬇PDF]│
│ ○ Tổng hợp   │  ┌───────────────────────────────────────────────┐  │
│ ○ Theo người │  │ Tiêu đề · Kỳ 01–30/06 vs 01–31/05            │  │
│ ○ Theo TT    │  │ KPI summary  ▲▼ so với kỳ trước              │  │
│ ○ Vòng đời   │  │ [bảng/biểu đồ tổng hợp theo loại đã chọn]    │  │
│ ○ Sync log   │  │ Ghi chú/insight tự sinh                       │  │
│              │  └───────────────────────────────────────────────┘  │
│ MẪU ĐÃ LƯU   │  [💾 Lưu mẫu] [📧 Lên lịch gửi email]                │
│ • Tuần CN    │                                                     │
└──────────────┴─────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | 2 cột: trái = chọn loại + mẫu đã lưu; phải = preview + export |
| **Card** | KPI summary có chỉ số **so với kỳ trước** (▲/▼) |
| **Table** | Bảng tổng hợp theo loại báo cáo chọn |
| **Chart** | Biểu đồ tóm tắt + so sánh kỳ (cột/đường) |
| **Sidebar/Header** | Header có toggle "so sánh kỳ trước"; export Excel/PDF; lên lịch email |

---

## 7. Alerts  `#/alerts`  🔔(mới)

```
HEADER: Alerts ........................ [Mức độ▾][Loại▾][Trạng thái▾]
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│Chưa pl   │Test>7d   │Chờ>30d   │Duy trì   │Thiếu     │Thiếu     │  ← thẻ cảnh báo
│  98 🔴   │  21 🟠   │  33 🟠   │>180 0    │ngày test │upload    │
│          │          │          │          │ 507 🟡   │ 27 🟡    │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
┌────────────────────────────────────────────────────────────────────┐
│  DANH SÁCH CONTENT CẢNH BÁO            [Chọn loại: Test>7d ▾]        │
│ ┌─────────┬──────┬─────┬───────────┬────────┬──────────────────┐    │
│ │code     │Người │TT   │Trạng thái │Số ngày │Hành động         │    │
│ ├─────────┼──────┼─────┼───────────┼────────┼──────────────────┤    │
│ │…        │Hiếu  │[NĐ] │[Đang test]│  19    │[Mở Trello][Bỏ qua]│   │
│ └─────────┴──────┴─────┴───────────┴────────┴──────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | Lưới thẻ cảnh báo (đọc số nhanh) → bảng content theo cảnh báo chọn |
| **Card** | 6 thẻ cảnh báo có **mức độ màu** (🔴🟠🟡), click lọc bảng dưới |
| **Table** | Content vi phạm: code · người · TT · trạng thái · số ngày · **hành động** (mở Trello/đánh dấu xử lý) |
| **Chart** | Không (ưu tiên hành động) |
| **Sidebar/Header** | Sidebar có badge tổng cảnh báo; header lọc theo mức độ/loại |

---

## 8. Sync  `#/sync`

```
HEADER: Đồng bộ dữ liệu .................................. [⟳ Chạy Sync]
┌──────────┬──────────────┬──────────────┬───────────────────────────┐
│Tổng      │upload_real   │test_real     │Lần sync gần nhất           │  ← KPI sức khỏe
│record    │  1483 (98%)  │ 1003 (66%)   │ 02:35 25/06 · success      │
│  1510    │              │              │                            │
└──────────┴──────────────┴──────────────┴───────────────────────────┘
┌───────────────────────────────┬───────────────────────────────────┐
│ ĐỘ PHỦ DỮ LIỆU NGÀY           │ PHÂN BỔ THỊ TRƯỜNG                │
│ upload_real ███████████ 98%   │ Nội ████████ 764  Quốc ███████ 746│
│ test_real   ███████ 66%       │                                   │
└───────────────────────────────┴───────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────┐
│ LỊCH SỬ ĐỒNG BỘ (sync_logs)                                         │
│ Bắt đầu · Đọc · Insert · Update · Trạng thái                        │
│ 02:35 25/06 · 1518 · 0 · 1510 · [success]                           │
└────────────────────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | KPI sức khỏe (4) → 2 cột phủ ngày/thị trường → bảng lịch sử |
| **Card** | Tổng record, coverage `*_real`, lần sync gần nhất (status màu) |
| **Table** | `sync_logs` gần nhất (đọc/insert/update/status) |
| **Chart** | Thanh coverage + phân bổ (HTML bars) |
| **Sidebar/Header** | Header có nút **⟳ Chạy Sync** (chỉ Admin) + lịch auto-sync |

---

## 9. User  `#/users`  👥(mới, Admin)

```
HEADER: Quản lý User ................. [Role▾][Trạng thái▾] [+ Mời user]
┌────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────┬─────────┬─────────┬────────────┬────────┐ │
│ │Email                 │Role     │Trạng thái│Đăng nhập   │        │ │
│ ├──────────────────────┼─────────┼─────────┼────────────┼────────┤ │
│ │admin@…               │[Admin]  │● Active │25/06 09:12 │[⋯]     │ │
│ │viewer@seryn.vn       │[Viewer] │● Active │24/06 17:40 │[⋯]     │ │
│ │new@seryn.vn          │[Viewer] │○ Pending│—           │[⋯]     │ │
│ └──────────────────────┴─────────┴─────────┴────────────┴────────┘ │
│  ⋯ menu: Đổi role · Vô hiệu hóa · Xóa                               │
└────────────────────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | Toolbar (lọc role/trạng thái + mời) → bảng user |
| **Card** | (tùy chọn) thẻ tóm tắt: tổng user · admin · viewer · pending |
| **Table** | Email · Role(tag) · Trạng thái(chấm) · Lần đăng nhập · menu ⋯ (đổi role/vô hiệu/xóa) |
| **Chart** | Không |
| **Sidebar/Header** | Chỉ Admin thấy; header có nút **+ Mời user**; tự gán Viewer cho `@seryn.vn` |

---

## 10. Settings  `#/settings`  ⚙️(mới, Admin)

```
HEADER: Cài đặt
┌──────────────┬─────────────────────────────────────────────────────┐
│ TAB          │  NỘI DUNG TAB                                        │
│ ▸ Chung      │  ┌─────────────────────────────────────────────┐    │
│ ▸ Ngưỡng     │  │ EXCLUDED_SHEETS: [QT Khiêm][NĐ Khiêm][+]     │    │
│ ▸ Sync       │  │ Năm parse ngày: [2026 ▾]                     │    │
│ ▸ Giao diện  │  │ Google Sheet ID: ●●●●●●  Supabase: ●●●●●●     │    │
│ ▸ Tích hợp   │  │ ──────────────────────────────────────────  │    │
│              │  │ (Ngưỡng) Test quá lâu: [7] ngày              │    │
│              │  │          Duy trì cảnh báo: [180] ngày        │    │
│              │  │ (Sync)   Auto-sync: ◉ Bật  Mỗi [30] phút     │    │
│              │  │ (Giao diện) Theme: ◉ Dark ○ Light            │    │
│              │  │                              [Hủy] [💾 Lưu]   │    │
│              │  └─────────────────────────────────────────────┘    │
└──────────────┴─────────────────────────────────────────────────────┘
```

| Khía cạnh | Mô tả |
|---|---|
| **Layout** | 2 cột: tab dọc trái + form nội dung phải |
| **Card** | Mỗi nhóm cài đặt là 1 khối form (Chung/Ngưỡng/Sync/Giao diện/Tích hợp) |
| **Table** | EXCLUDED_SHEETS dạng chip-list thêm/xóa |
| **Chart** | Không |
| **Sidebar/Header** | Chỉ Admin; lưu cấu hình ngưỡng cảnh báo, lịch sync, theme, năm parse |

---

## Bảng đối chiếu nhanh (mọi màn hình)

| Màn hình | KPI top | Chart chính | Bảng | Vai trò |
|---|---|---|---|---|
| Tổng Quan | 6 KPI nghiệp vụ | Funnel + Status | — | All |
| Người Nhận | 4 mini/người | inline bars | Hiệu suất/người | All |
| Thị Trường | 6/thị trường ×2 | So sánh nhóm | mini-grid | All |
| Explorer | — | — | Content đầy đủ | All |
| Vòng đời | 5 chất lượng | TB Biên tập/Người/TT | Top 20 Duy trì | All |
| Reports | summary so kỳ | so sánh kỳ | tổng hợp | All |
| Alerts | 6 thẻ cảnh báo | — | content vi phạm | All |
| Sync | 4 sức khỏe | coverage bars | sync_logs | Admin (run) |
| User | (tóm tắt) | — | danh sách user | Admin |
| Settings | — | — | EXCLUDED chips | Admin |

> Ghi chú: **Reports, Alerts, User, Settings là màn hình mới** (chưa code — thuộc backlog Sprint 4–5). Tài liệu này là wireframe định hướng; khi build phải bám DESIGN_SYSTEM.md và cập nhật PROJECT_SPEC.md.
