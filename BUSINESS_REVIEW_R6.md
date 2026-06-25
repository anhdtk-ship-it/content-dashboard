# SPRINT REVIEW 2 — Task R6: Review nghiệp vụ (góc nhìn Team Leader)

> Câu hỏi: Dashboard đã đủ để **quản lý Team Content** chưa? Thiếu KPI / báo cáo / drill-down / cảnh báo / thống kê nào?
> Chỉ đánh giá **nghiệp vụ** (không đánh giá code). Ngày: 2026-06-25.

## Hiện trạng — Dashboard đang trả lời tốt câu hỏi gì?
- ✅ **Hiện trạng & chất lượng:** Tổng content, phân bổ Nội/Quốc, theo người/biên tập, theo trạng thái.
- ✅ **Chất lượng test:** Tỷ lệ đã test, tỷ lệ test thành công, tồn kho, không duyệt (có tooltip công thức).
- ✅ **Vòng đời:** tuổi thọ TB, duy trì lâu nhất, phân bố vòng đời, top duy trì.
- ✅ **Tra cứu:** Content Explorer (lọc/tìm/drawer), Sync (độ tươi dữ liệu).

→ Dashboard hiện là **bảng theo dõi sức khỏe (health snapshot)** rất tốt.

## Kết luận tổng: **CHƯA ĐỦ** để quản trị Team đầy đủ

Đủ để **giám sát hiện trạng**, nhưng **chưa đủ** để Team Leader trả lời 4 câu hỏi quản trị cốt lõi:
1. *Đội đang chạy nhanh/chậm thế nào theo thời gian?* (thiếu trend/năng suất)
2. *Có đạt mục tiêu không?* (thiếu target vs actual)
3. *Ai cần hỗ trợ, ai quá tải?* (thiếu cân bằng tải, cycle-time, chất lượng theo biên tập)
4. *Tôi cần hành động gì hôm nay?* (cảnh báo chưa hành động được)

---

## 1. Thiếu KPI nào?
| KPI thiếu | Vì sao Team Leader cần |
|---|---|
| **Năng suất theo thời gian** (content được cấp / test / lên duy trì mỗi tuần-tháng, theo người & biên tập) | Đo throughput & xu hướng, không chỉ ảnh chụp |
| **Cycle time / Lead time** (Upload→Test, Test→Duy trì bao nhiêu ngày) | Phát hiện nghẽn quy trình; hiện chỉ có cảnh báo "chờ >30 ngày" |
| **Tỷ lệ thành công theo Biên tập** (đang chỉ có tuổi thọ TB theo biên tập) | Đánh giá chất lượng đầu vào của từng editor |
| **Target vs Actual** (vd: 50 content test/tháng, tỷ lệ thành công ≥20%) | Quản trị theo mục tiêu, không có mốc để biết "đủ tốt" |
| **Chi phí / ROAS / hiệu quả** | Dữ liệu sheet có nhắc "ROAS" nhưng dashboard không có cột chi phí/doanh thu → không đánh giá được hiệu quả tiền |
| **Cân bằng tải (workload balance)** | Ai đang ôm nhiều/ít so với năng lực |
| **Tỷ lệ tái sử dụng content** (cùng content_code dùng nhiều market/người) | Đo hiệu quả tái sử dụng creative (dữ liệu cho thấy tái dùng rất nhiều) |

## 2. Thiếu báo cáo nào?
- **Báo cáo định kỳ tự động** (tuần/tháng) + **so sánh kỳ trước** (▲▼), gửi email — *module Reports đang ở kế hoạch, chưa có.*
- **Báo cáo 1:1 từng nhân viên** (thẻ hiệu suất để review trực tiếp với từng người).
- **Báo cáo cohort/retention** (content tạo tháng X còn "sống" sau 30/60/90 ngày) — *Retention đang bị ẩn vì thiếu lịch sử trạng thái.*
- **Báo cáo theo Biên tập** (đầy đủ, không chỉ tuổi thọ TB).
- **Xuất PDF cho cấp trên** (hiện chỉ có Export CSV).

## 3. Thiếu Drill Down nào?
- **Drill theo Biên tập** → danh sách content của editor đó (editor mới chỉ là filter trong Explorer, chưa có dashboard/biểu đồ drill).
- **Drill từ Cảnh báo → danh sách → hành động** (gán lại người, đánh dấu xử lý). Cảnh báo hiện là **con số**, chưa bấm để xử lý.
- **Drill theo thời gian** (bấm 1 tuần/điểm xu hướng → content trong kỳ đó) — chưa có vì thiếu biểu đồ xu hướng.
- **Drill content → các content tái sử dụng** (xem 1 creative đang chạy ở những market/người nào).
- **Drill KPI Tổng Quan → Explorer** (hiện KPI Tổng Quan không bấm được — vấn đề UX đã nêu ở R3).

## 4. Thiếu cảnh báo nào?
- **Mất cân bằng người nhận** (một người tồn đọng gấp ~2× người khác).
- **Tồn kho đang tăng** (chờ chạy tăng theo xu hướng) — hiện chỉ là con số tĩnh, không cảnh báo xu hướng.
- **Tỷ lệ thành công đang giảm** (theo người/market/kỳ) — cảnh báo suy giảm chất lượng.
- **Biên tập có tỷ lệ fail cao** (cảnh báo chất lượng theo editor).
- **Vi phạm SLA theo giai đoạn** (chờ test quá X ngày, test quá Y ngày — cấu hình được ngưỡng).
- **Content cần làm mới** (duy trì quá lâu → mỏi creative, cần thay).

## 5. Thiếu thống kê nào?
- **Xu hướng theo thời gian (trend)** — app hiện **không có biểu đồ xu hướng** (chỉ bản vanilla cũ có). Team Leader cần week-over-week throughput/thành công.
- **Thống kê cycle-time** (TB/median lead-time từng giai đoạn).
- **Phân phối hiệu suất theo người** (ngoài bảng xếp hạng — vd boxplot/khoảng).
- **Thống kê tái sử dụng creative** (mỗi content_code dùng bao nhiêu lần / nơi).
- **Thống kê đầy đủ theo Biên tập** (số lượng, tỷ lệ thành công, tuổi thọ).
- **Lịch/heatmap sản xuất** (content theo ngày — nhịp độ đội).
- **Funnel theo từng người** (chuyển đổi qua các giai đoạn của mỗi assignee).

---

## Ưu tiên cho Team Leader (must-have tiếp theo)

### Phải có
1. **Biểu đồ xu hướng + năng suất theo thời gian** (theo người & biên tập) — trả lời "nhanh/chậm".
2. **Target vs Actual** + báo cáo định kỳ tuần/tháng có so kỳ trước.
3. **Cảnh báo hành động được** (drill → danh sách → gán/đánh dấu) + cảnh báo cân bằng tải & suy giảm chất lượng.

### Nên có
4. **KPI & dashboard theo Biên tập** (tỷ lệ thành công, fail, tuổi thọ).
5. **Cycle-time / lead-time** từng giai đoạn (cần ghi `content_status_history`).
6. **Retention curve** (mở khóa khi có lịch sử trạng thái).

### Tốt nếu có
7. Chi phí/ROAS (nếu tích hợp được số liệu ads).
8. Thống kê tái sử dụng creative.

## Kết luận

Với vai trò Team Leader, dashboard **đủ để giám sát hiện trạng & chất lượng test**, nhưng **chưa đủ để điều hành đội**: thiếu **trend/năng suất theo thời gian, mục tiêu (target), cảnh báo hành động được, KPI theo biên tập, và cycle-time**. Ưu tiên bổ sung **xu hướng theo thời gian + target + cảnh báo hành động** sẽ chuyển dashboard từ "theo dõi" sang "điều hành đội".
