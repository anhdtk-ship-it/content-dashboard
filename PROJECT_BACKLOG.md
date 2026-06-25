# PROJECT_BACKLOG.md — Content Operations Dashboard

> **Tài liệu quản lý dự án.** Toàn bộ project được quản lý theo backlog này.
> Mọi công việc phải gắn với một Task ID; trạng thái cập nhật tại đây. Thay đổi phạm vi → bổ sung Task mới, không làm ngoài backlog.
>
> Liên kết: [PROJECT_SPEC.md](PROJECT_SPEC.md) (tài liệu gốc) · cập nhật lần cuối: 2026-06-25

## Quy ước

**Trạng thái:** ✅ Done · 🟡 In progress · 🔲 Todo · ⛔ Blocked
**Độ ưu tiên:** `Cao` (bắt buộc) · `TB` (nên có) · `Thấp` (tùy chọn)
**Task ID:** `S<sprint>-T<số>` — ví dụ `S2-T01`.

## Tổng quan tiến độ

| Sprint | Chủ đề | Trạng thái |
|---|---|---|
| Sprint 1 | Nền tảng & Pipeline dữ liệu | ✅ Hoàn thành |
| Sprint 2 | Dashboard lõi | ✅ Hoàn thành |
| Sprint 3 | Phân tích nâng cao & Vòng đời | ✅ Hoàn thành |
| Sprint 4 | Xác thực, Phân quyền & Quản trị | ❌ Cancelled — dùng Share Link, hoãn Auth |
| Sprint 5 | Tự động hóa, Chất lượng & Triển khai | 🔲 Chưa bắt đầu |

---

## Sprint 1 — Nền tảng & Pipeline dữ liệu
**Mục tiêu:** Dựng project, kết nối Google Sheets, thiết kế schema Supabase, xây Sync Engine idempotent đưa dữ liệu sheet → DB.
**Trạng thái:** ✅ Hoàn thành

| ID | Mô tả | Ưu tiên | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| S1-T01 | Khởi tạo project Node + TypeScript (deps, tsconfig CommonJS, scripts) | Cao | — | ✅ |
| S1-T02 | Kết nối Google Sheets qua Service Account (test-google-connection) | Cao | S1-T01 | ✅ |
| S1-T03 | Đọc & phân tích sheet; loại trừ `QT/NĐ Khiêm` (sheets-reader, analyze-headers) | Cao | S1-T02 | ✅ |
| S1-T04 | Thiết kế mapping Sheet → Supabase (mapping-spec.md) | Cao | S1-T03 | ✅ |
| S1-T05 | Tạo bảng `contents` + migration `001_fix_contents` | Cao | S1-T04 | ✅ |
| S1-T06 | Phân tích trùng khóa + UNIQUE (content_code, market, assignee) `002` | Cao | S1-T05 | ✅ |
| S1-T07 | Sync Engine: upsert idempotent + dedupe + `sync_logs` (`003`) | Cao | S1-T06 | ✅ |
| S1-T08 | Cột `*_real` (`004`) + `parseDdmmToReal` + backfill | TB | S1-T07 | ✅ |

---

## Sprint 2 — Dashboard lõi
**Mục tiêu:** API V3 + SPA; bộ lọc toàn cục, chuẩn hóa trạng thái, drill-down, realtime; dashboard Tổng Quan.
**Trạng thái:** ✅ Hoàn thành

| ID | Mô tả | Ưu tiên | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| S2-T01 | Express API + serve SPA + `/api/config` (anon key realtime) | Cao | S1-T07 | ✅ |
| S2-T02 | Dashboard Tổng Quan (KPI cards, funnel, status, alerts) | Cao | S2-T01 | ✅ |
| S2-T03 | Endpoint `/api/v3/summary` + `/api/v3/contents` | Cao | S2-T01 | ✅ |
| S2-T04 | Bộ lọc toàn cục: 9 preset thời gian + market/assignee/status + Xóa lọc | Cao | S2-T02 | ✅ |
| S2-T05 | Chuẩn hóa `status_group` + tooltip (tầng dashboard) | Cao | S2-T02 | ✅ |
| S2-T06 | Drill-down đa tầng → Content Explorer | Cao | S2-T04 | ✅ |
| S2-T07 | Realtime (Supabase) + polling fallback | TB | S2-T01 | ✅ |
| S2-T08 | Tách SPA thành module + hash router, layout ops tối giản | Cao | S2-T02 | ✅ |

---

## Sprint 3 — Phân tích nâng cao & Vòng đời
**Mục tiêu:** KPI nghiệp vụ (thành công/thất bại), các dashboard chuyên sâu, Vòng đời Content, Quản lý Sync, tài liệu gốc.
**Trạng thái:** ✅ Hoàn thành

| ID | Mô tả | Ưu tiên | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| S3-T01 | KPI nghiệp vụ (Đã test/Thành công/Thất bại/Tồn kho) + tooltip công thức | Cao | S2-T05 | ✅ |
| S3-T02 | Dashboard Người Nhận (KPI/người, sort theo tỷ lệ) | Cao | S3-T01 | ✅ |
| S3-T03 | Dashboard Thị Trường (Nội Địa/Quốc Tế) | Cao | S3-T01 | ✅ |
| S3-T04 | Content Explorer (search, sort, phân trang, export CSV) | Cao | S2-T06 | ✅ |
| S3-T05 | Vòng đời Content — tính từ Ngày Set Ads (`test_date_real`) | Cao | S1-T08 | ✅ |
| S3-T06 | Quản lý Sync (độ phủ ngày + lịch sử `sync_logs`) | TB | S2-T01 | ✅ |
| S3-T07 | Tài liệu PROJECT_SPEC.md (tài liệu gốc) | TB | — | ✅ |
| S3-T08 | Re-sync & kiểm tra drift Sheet ↔ DB | TB | S1-T07 | ✅ |

---

## Sprint 4 — Xác thực, Phân quyền & Quản trị
**Mục tiêu:** Đăng nhập, phân quyền Admin / Viewer (@seryn.vn), bảo mật dữ liệu, module Quản lý User & Cài đặt.
**Trạng thái:** ❌ **CANCELLED**
**Lý do:** Project sử dụng mô hình **Share Link**, không triển khai Authentication ở giai đoạn hiện tại. Authentication được **hoãn sang giai đoạn sau — không thuộc phạm vi của phiên bản hiện tại**. Toàn bộ task S4-T01…S4-T07 dưới đây bị huỷ.

| ID | Mô tả | Ưu tiên | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| S4-T01 | Tích hợp Supabase Auth (đăng nhập email/OTP) | Cao | S2-T01 | 🔲 |
| S4-T02 | Role Admin / Viewer — tự gán Viewer cho email `@seryn.vn`, Admin theo allowlist | Cao | S4-T01 | 🔲 |
| S4-T03 | Bật RLS cho client anon trên `contents` / `sync_logs` | Cao | S4-T01 | 🔲 |
| S4-T04 | Bảo vệ API: tách endpoint chỉ-Admin (sync, settings, user) | Cao | S4-T02 | 🔲 |
| S4-T05 | Module Quản lý User (danh sách, gán/đổi role, vô hiệu hóa) | TB | S4-T02 | 🔲 |
| S4-T06 | Module Cài đặt (EXCLUDED_SHEETS, ngưỡng cảnh báo, năm parse, lịch sync) | TB | S4-T02 | 🔲 |
| S4-T07 | Cập nhật PROJECT_SPEC §5 Phân quyền theo triển khai thực tế | Thấp | S4-T02 | 🔲 |

---

## Sprint 5 — Tự động hóa, Chất lượng & Triển khai
**Mục tiêu:** Auto-sync, ghi lịch sử trạng thái (mở khóa Retention), đồng bộ 2 chiều, kiểm thử, deploy production.
**Trạng thái:** 🔲 Chưa bắt đầu

| ID | Mô tả | Ưu tiên | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| S5-T01 | Auto-sync theo lịch (node-cron, cấu hình interval) | Cao | S1-T07 | 🔲 |
| S5-T02 | Trigger sync thủ công từ UI (module Quản lý Sync) | TB | S5-T01, S4-T04 | 🔲 |
| S5-T03 | Ghi `content_status_history` khi phát hiện đổi `current_status` lúc sync | Cao | S1-T07 | 🔲 |
| S5-T04 | Retention Curve (tự bật khi có history) | TB | S5-T03 | 🔲 |
| S5-T05 | Đồng bộ xóa content stale (2 chiều Sheet ↔ DB) | TB | S1-T07 | 🔲 |
| S5-T06 | Deploy production (host server, env, domain, HTTPS) | Cao | S4-T03 | 🔲 |
| S5-T07 | Monitoring + cảnh báo khi sync lỗi | Thấp | S5-T01 | 🔲 |
| S5-T08 | Test tự động (unit: transform, metrics, lifecycle, parse ngày) | TB | — | 🔲 |

---

## Quản trị backlog

- **Mỗi việc làm phải gắn 1 Task ID.** Việc phát sinh ngoài danh sách → thêm Task mới vào sprint phù hợp trước khi làm.
- **Cập nhật trạng thái** Task ngay khi bắt đầu (🟡) và khi xong (✅).
- **Phụ thuộc** dùng Task ID; không bắt đầu task khi phụ thuộc chưa ✅ (trừ khi tách rõ).
- **Đồng bộ tài liệu:** thay đổi schema/API/sync/dashboard/phân quyền → cập nhật cả [PROJECT_SPEC.md](PROJECT_SPEC.md) (xem Quy tắc vàng §10 trong spec).
- **Thứ tự ưu tiên hiện tại:** Sprint 4 (Authentication) đã **Cancelled** — project dùng mô hình **Share Link**; Authentication hoãn sang giai đoạn sau, không thuộc phạm vi bản hiện tại. Không còn ràng buộc "đăng nhập trước khi deploy".
