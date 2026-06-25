# SPRINT REVIEW 2 — Task R1: Đối chiếu dữ liệu Dashboard ↔ Supabase

> Mục tiêu: kiểm tra 100% dữ liệu hiển thị trên Dashboard so với database thật.
> Phương pháp: đọc raw `contents` trực tiếp từ Supabase (**Database**) + gọi các API mà Dashboard sử dụng (**Dashboard**), so từng chỉ số.
> Phạm vi mẫu: **toàn bộ dữ liệu, không lọc ngày** (so sánh sạch, loại nhiễu bộ lọc).
> Ngày review: 2026-06-25 · Không sửa code — chỉ báo cáo.

## Nguồn dữ liệu mỗi Dashboard
| Dashboard | API (Dashboard) | Đối chiếu (Database) |
|---|---|---|
| Tổng Quan | `/api/v3/summary` (metrics) | đếm/đo trực tiếp trên `contents` |
| Người Nhận | `/api/v3/lifecycle-table` → gom theo người | đếm theo `assignee_name` |
| Thị Trường | `/api/v3/lifecycle-table` → gom theo market | đếm theo `market` |
| Content Explorer | `/api/v3/lifecycle-table` | tổng dòng `contents` |
| Vòng đời | `/api/v3/lifecycle` | tính `today − test_date_real` |

## Kết quả đối chiếu (toàn bộ 1510 content)

| Chỉ số | Dashboard | Database | Chênh lệch |
|---|---:|---:|:---:|
| **Tổng Content** | 1510 | 1510 | **0** ✅ |
| **Nội Địa** | 764 | 764 | **0** ✅ |
| **Quốc Tế** | 746 | 746 | **0** ✅ |
| Người nhận — Hiếu | 427 | 427 | **0** ✅ |
| Người nhận — Ánh | 303 | 303 | **0** ✅ |
| Người nhận — KA | 347 | 347 | **0** ✅ |
| Người nhận — Liên | 433 | 433 | **0** ✅ |
| Trạng thái — CHO_CHAY (Chờ chạy) | 67 | 67 | **0** ✅ |
| Trạng thái — DANG_TEST (Đang test) | 45 | 45 | **0** ✅ |
| Trạng thái — DUY_TRI (Duy trì) | 59 | 59 | **0** ✅ |
| Trạng thái — DA_DUNG (Đã dừng) | 1239 | 1239 | **0** ✅ |
| Trạng thái — KHONG_DUYET (Không duyệt) | 7 | 7 | **0** ✅ |
| Trạng thái — CHUA_PHAN_LOAI (Chưa phân loại) | 93 | 93 | **0** ✅ |
| **KPI** — Đã được test | 1343 | 1343 | **0** ✅ |
| **KPI** — Thành công | 319 | 319 | **0** ✅ |
| **Tỷ lệ Test** | 88.94% | 88.94% | **0** ✅ |
| **Tỷ lệ Thành Công** | 23.75% | 23.75% | **0** ✅ |
| **Tuổi thọ Content TB** | 80 ngày | 80 ngày | **0** ✅ |
| Quần thể vòng đời (ran) | 284 | 284 | **0** ✅ |
| Explorer (tổng dòng) | 1510 | 1510 | **0** ✅ |

> Định nghĩa dùng để đối chiếu (đồng nhất 2 phía):
> - Đã được test = {Đang test, Duy trì - Chưa vít/Đã vít, Đã test-ko chạy, Đã chạy-Tắt}
> - Thành công = {Duy trì - Chưa vít/Đã vít, Đã chạy-Tắt} · Tỷ lệ Thành Công = Thành công ÷ Đã được test
> - Tỷ lệ Test = Đã được test ÷ Tổng
> - Tuổi thọ Content = `Hôm nay − test_date_real` (Ngày Set Ads) trên content Duy trì + Đã chạy-Tắt (không dùng upload_date)

## Kiểm tra bộ lọc theo kỳ (đã xác minh ở các task trước)
| Dashboard | Mẫu (Tháng này / June 2026) | Database | Khớp |
|---|---|---|---|
| Tổng Quan | Tổng 311 · Nội 155 · Quốc 156 | 311 / 155 / 156 | ✅ |
| Người Nhận | KA: tổng 77 · Chờ 25 · Test-ko chạy 35 · Duy trì 8 · Đang test 3 · Chạy-Tắt 6 | đúng từng số | ✅ |
| Thị Trường | Nội Địa total 155 (Test-ko chạy 79, Đang test 18, Chờ 15, Duy trì 14, Chạy-Tắt 4) | đúng | ✅ |
| Content Explorer | noi_dia + Đang test = 18 | 18 | ✅ |
| Vòng đời | ranCount 38 · Duy trì 20 · Đã chạy-Tắt 18 · avgAge 17 · max 24 | đúng | ✅ |

## Kết luận

**✅ KHÔNG CÓ SAI LỆCH.** Toàn bộ 20 chỉ số đối chiếu trên toàn dataset đều **Δ = 0** (Dashboard = Database), và các mẫu lọc theo kỳ ở 5 dashboard cũng khớp 100%.

- Mọi Dashboard đọc cùng nguồn `contents` (Supabase) qua API; các biến đổi nghiệp vụ (status_group, metrics, vòng đời) được tính ở tầng dashboard và **đã được xác minh đúng công thức** bằng phép tính độc lập trên DB.
- Tổng Content, phân bổ Nội Địa/Quốc Tế, theo người nhận, theo trạng thái, KPI tỷ lệ Test/Thành Công, và Tuổi thọ Content — tất cả chính xác.

**Khuyến nghị:** không cần hành động sửa lỗi dữ liệu. Đề xuất chạy lại R1 này sau mỗi lần `npm run sync` để phát hiện drift sớm (chỉ là báo cáo, không sửa code).
