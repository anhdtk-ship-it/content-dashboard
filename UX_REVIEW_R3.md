# SPRINT REVIEW 2 — Task R3: Đánh giá trải nghiệm sử dụng (UX)

> Phạm vi: app refactor React (`web/`) — luồng **Dashboard → Filter → Click KPI → Content Explorer → Drawer → Quay lại**.
> Phương pháp: trace luồng thật qua DOM (đếm thao tác, kiểm điều hướng & drawer).
> Ngày: 2026-06-25 · **Không sửa code — chỉ báo cáo UX.**

## Luồng kỳ vọng vs thực tế (đo được)

| Bước | Kỳ vọng | Thực tế (đo) | Trạng thái |
|---|---|---|---|
| Dashboard → Filter | Lọc tại chỗ | OK (FilterBar mỗi màn) | ✅ |
| Click KPI → Explorer | Bấm KPI để drill | **Overview KPI KHÔNG click được** (`cursor` không phải pointer) | ❌ |
| Drill → Content Explorer | Mở Content Explorer thật, giữ filter | Người Nhận/Thị Trường mở **explorer nhúng khác** (hash vẫn `#/assignees`), **không phải** trang `#/explorer` | ⚠️ |
| Explorer → Drawer | Bấm content mở Drawer | **Explorer nhúng KHÔNG có Drawer** (bấm content = không phản hồi) | ❌ |
| Drawer → Quay lại | Đóng nhanh | Drawer thật: ✕ / backdrop (1 thao tác) — OK ở `#/explorer` & Vòng đời | ✅ |

> Tồn tại **2 "Content Explorer"**: (a) trang đầy đủ `#/explorer` (toolbar + sort + sticky + **Drawer**), (b) explorer **nhúng** trong Người Nhận/Thị Trường (bảng đơn giản, **không Drawer**, không toolbar). Drill từ dashboard rơi vào (b), không phải (a).

## Trả lời các câu hỏi review

### 1. Có thao tác nào dư không? — **CÓ**
- **Filter không giữ khi chuyển màn** (đã kiểm: Overview `market=noi_dia` → Người Nhận về `ALL`). Người dùng phải **đặt lại bộ lọc ở mỗi màn** → thao tác lặp.
- **Đường tới chi tiết content vòng vèo:** từ Người Nhận bấm 1 người → explorer nhúng **cụt** (không drawer). Muốn xem chi tiết phải tự mở `#/explorer`, chọn lại người, bấm content. → nhiều thao tác thừa.

### 2. Có màn hình nào khó hiểu không? — **CÓ**
- **Hai màn "CONTENT EXPLORER" trùng tên nhưng khác năng lực** (nhúng vs trang thật) gây nhầm: người dùng tưởng là cùng một chỗ nhưng explorer nhúng thiếu sort/sticky/drawer.
- **Explorer nhúng cụt đường:** bấm vào một content **không có gì xảy ra** (không drawer, không link) → người dùng tưởng hỏng.
- Thiếu **khung điều hướng** (Sidebar/Header — xem R2): không có "bạn đang ở đâu", chuyển màn phải qua URL.

### 3. Có KPI nào khó hiểu không? — **PHẦN LỚN OK**
- ✅ Mọi KPI đều có **tooltip công thức** → độ khó hiểu thấp.
- ⚠️ KPI Overview **trông như bấm được nhưng không** (không có affordance rõ) → kỳ vọng sai.
- ⚠️ "Tỷ lệ tồn kho", phân biệt "Đã test" vs "Thành công" cần đọc tooltip mới rõ (chấp nhận được, nhưng tên chưa tự giải thích 100%).
- ⚠️ Vòng đời: "Đang duy trì lâu nhất" vs "Đã từng duy trì lâu nhất" dễ lẫn nếu không đọc tooltip.

### 4. Có thể giảm số click không? — **CÓ, đáng kể**

| Tác vụ | Hiện tại | Tối ưu đề xuất | Tiết kiệm |
|---|---|---|---|
| Xem chi tiết 1 content của KA | Người Nhận→KA (cụt) → tự mở `#/explorer` → chọn KA → bấm content → drawer (~5 thao tác + gõ URL) | Drill thẳng `#/explorer?assignee=KA` → bấm content → drawer (**2 click**) | **~3 click + bỏ điều hướng tay** |
| Lọc Overview theo "Đang test" | mở select Trạng thái + chọn (**2 click**) | bấm KPI "Đang test" (**1 click**) | **1 click** |
| Đổi kỳ rồi xem nhiều dashboard | đặt kỳ lại ở từng màn | đặt 1 lần (global filter) dùng mọi màn | **n×1-2 click** |

## Chấm điểm luồng

| Giai đoạn | Điểm | Ghi chú |
|---|:--:|---|
| Filter | B | tiện tại chỗ nhưng **không global** |
| Click KPI → Explorer | C | Overview KPI không drill; drill khác rơi vào explorer nhúng |
| Content Explorer | B | trang thật (`#/explorer`) rất tốt, nhưng **không phải đích của drill** |
| Drawer | A− | đầy đủ, đóng nhanh (ở explorer thật/Vòng đời) |
| Quay lại | A | 1 thao tác |
| **Tổng UX luồng** | **B−** | Component tốt nhưng **luồng drill chưa liền mạch & filter không giữ** |

## Đề xuất cải tiến (không sửa trong task này)

### Cao — làm luồng liền mạch
1. **Thống nhất 1 Content Explorer**: drill từ mọi dashboard điều hướng tới `#/explorer?<filter>` (đã hỗ trợ đọc filter từ hash) thay vì explorer nhúng. Bỏ explorer nhúng → hết trùng lặp & cụt đường.
2. **KPI Overview clickable** (drill theo trạng thái/thị trường) — giảm 1 click & đúng kỳ vọng.
3. **Global filter** dùng chung mọi màn (giữ kỳ/market/người khi chuyển màn) — như dashboard vanilla.

### Trung bình
4. Thêm **Sidebar/Header** (R2) để có ngữ cảnh điều hướng + breadcrumb "Người Nhận → KA → content".
5. Trong Drawer thêm nút **"Mở trong Explorer"** và điều hướng kế tiếp/trước content.
6. Nhãn KPI tự giải thích hơn (vd "Tồn kho (chưa test)") để giảm phụ thuộc tooltip.

### Thấp
7. Affordance bấm được: con trỏ pointer + hover rõ cho KPI/hàng bảng drill.
8. Lưu bộ lọc gần nhất (localStorage) để quay lại không phải set lại.

## Kết luận

Trải nghiệm hiện ở mức **B−**: từng màn riêng lẻ mượt, **Drawer & Content Explorer thật rất tốt**, nhưng **luồng drill chưa liền mạch** (KPI Overview không bấm được, drill rơi vào explorer nhúng không có drawer) và **bộ lọc không giữ giữa các màn**. Ba việc nâng UX lên **A**: (1) hợp nhất về một Content Explorer làm đích drill, (2) cho KPI bấm được, (3) bộ lọc global — tổng cộng giảm 2–4 click cho các tác vụ chính và xoá đường cụt.
