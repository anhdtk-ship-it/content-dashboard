# ZALO-01 — Module Dashboard Zalo (độc lập Facebook)

> Facebook = **Stable Version**, KHÔNG bị đụng. Zalo là module đa nền tảng, thêm mới hoàn toàn.
> Kiến trúc `platform` sẵn sàng cho nền tảng kế tiếp (TikTok…) chỉ bằng cách thêm 1 Platform.

## 1) Cơ sở dữ liệu (chạy 1 lần, theo thứ tự)
Mở **Supabase → SQL Editor**, dán & chạy lần lượt:
1. [`sql/010_zalo.sql`](sql/010_zalo.sql) — tạo `platform_contents` / `platform_settings` / `platform_sync_logs`.
2. [`sql/011_zalo_title.sql`](sql/011_zalo_title.sql) — thêm cột `title` (Tên Content) + cấu hình mặc định.

(KHÔNG đụng bảng Facebook `contents`. KHÔNG chạy `sql/009_*` — đã thay thế.)

## 2) Biến môi trường (Railway + `.env` local)
| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `ZALO_SHEET_ID` | ✅ | ID Google Sheet **riêng** của Zalo |
| `ZALO_SHEET_TABS` | — | Danh sách tab, phân tách dấu phẩy. Bỏ trống = đọc mọi tab |
| `ZALO_SYNC_SECRET` | ✅ (webhook) | Secret webhook `/api/zalo-sync` (đặt trùng bên Apps Script) |
| `ZALO_SYNC_DEBOUNCE_MS` / `ZALO_SYNC_MAX_WAIT_MS` | — | Mặc định 60s / 5 phút |
| `ZALO_HEADER_CODE/ASSIGNEE/FORMAT/STATUS/UPLOAD/TEST` | — | Thêm tên cột tuỳ biến nếu Sheet đặt header khác mặc định |

Google credentials dùng chung cơ chế sẵn có: `GOOGLE_CREDENTIALS_JSON` (Railway) hoặc `GOOGLE_CREDENTIALS_PATH` (local).
Nhớ **share Sheet Zalo** cho email service account (quyền Viewer).

## 3) Cấu trúc Google Sheet Zalo (ZALO-04)
Google Sheet Zalo có **đúng 2 Sheet: `Video` và `Banner`**. `content_format` = **TÊN SHEET** (không có cột định dạng).
Backend đọc **đồng thời cả 2 Sheet** → merge → sync. Map cột theo **tên header** (không theo vị trí cột, không theo số dòng):
| Trường | Header nhận diện (mặc định) | → |
|---|---|---|
| Tên Content | `Tên Content`, `Tên`, `Content` | `title` |
| Ngày Up Trello | `Ngày Up Trello`, `Ngày cấp`, `Ngày up` | ngày "Đã cấp" |
| Ngày test | `Ngày test`, `Ngày set ads` | `test_date` |
| Trạng thái | `Trạng thái`, `Status` | `status` |
| *(tuỳ chọn)* Content ID / Trello | `Content ID`, `Trello`, `Link Trello` | khoá upsert |

**Khoá định danh:** ưu tiên `Content ID` → `Trello Card ID` → nếu không có thì **hash ổn định** `(định dạng|tên|ngày up)`
(KHÔNG dùng số dòng Sheet → re-sync không sinh trùng).
**Trạng thái hợp lệ:** `Tồn` · `Đang test` · `Duy trì` · `Không test` (rỗng = Chưa phân loại).
Nếu tab đặt tên khác Video/Banner: đặt env `ZALO_SHEET_TABS="Tên1,Tên2"`.

## 4) Mục tiêu & cấu hình (Leader tự đổi, không sửa code)
Bảng `platform_settings` (platform='zalo'):
```sql
insert into public.platform_settings values ('zalo','target:Video','40', now());
insert into public.platform_settings values ('zalo','target:Banner','60', now());
insert into public.platform_settings values ('zalo','test_warning_days','5', now());
```
Hoặc gọi API: `PUT /api/zalo/settings  { "key": "target:Video", "value": "40" }`.
Định dạng mới (VD TikTok): thêm `target:TikTok` → Dashboard tự hiện.

## 4b) Dữ liệu DEMO (ZALO-02 — khi CHƯA nối Google Sheet)
Sau khi chạy `sql/010`, nạp dữ liệu mẫu trực tiếp vào Supabase để dùng/kiểm chứng Dashboard:
```bash
npm run zalo:seed              # nạp 34 content DEMO (Video/Banner/Story) + target Video/Banner
npm run zalo:verify            # kiểm chứng Dashboard = Weekly (0 lệch) trên dữ liệu Supabase
npm run zalo:seed -- --clear   # xoá toàn bộ content Zalo (giữ settings) khi có dữ liệu thật
npm run zalo:seed -- --purge   # xoá cả content lẫn settings Zalo
```
Content DEMO có tiền tố `ZL-DEMO-` để dễ nhận biết. Khi có dữ liệu thật, `--clear` rồi nạp qua sync (mục 5).

## 5) Đồng bộ dữ liệu (khi dùng Google Sheet — không bắt buộc ở ZALO-02)
- Thủ công: `npm run zalo:sync`
- Tự động (real-time): dán [`apps-script/ContentSyncZalo.gs`](apps-script/ContentSyncZalo.gs) vào project Apps Script **gắn với Sheet Zalo**,
  đặt Script properties `WEBHOOK_URL=https://<domain>/api/zalo-sync` + `SYNC_SECRET=<ZALO_SYNC_SECRET>`,
  chạy `createOnChangeTrigger` 1 lần (và `testContentSyncWebhook` để kiểm tra — kỳ vọng code 202).

## 6) Xem Dashboard
Menu **💬 Zalo → Tổng Quan Zalo** và **Weekly Zalo**. Tất cả API dưới `/api/zalo/*` (yêu cầu đăng nhập như Facebook).

## 7) PDF tuần (tùy chọn)
```bash
pip install reportlab
npx ts-node reports/build_zalo_weekly_data.ts --from 2026-07-21 --to 2026-07-27 --out reports/report_zalo.json
python reports/zalo_report_pdf.py --data reports/report_zalo.json --out reports/zalo_weekly.pdf
```

## Kiến trúc (tóm tắt)
```
src/platform/
  types.ts · registry.ts · db.ts
  facebook/  (StatusRule gương — KHÔNG đụng code FB đang chạy)
  zalo/
    ZaloStatusRule.ts   Business Rule RIÊNG (Tồn/Đang test/Duy trì/Không test)
    contentFormat.ts    định dạng TỰ DO (không hardcode)
    zaloMetrics.ts      §V–IX (PURE, dùng chung API+Web+PDF)
    zaloWeeklyMetrics.ts Weekly (PURE)
    ZaloSyncProvider.ts  đọc Sheet Zalo theo tên header
    ZaloSyncService.ts   → platform_contents (platform='zalo')
    repository.ts · settings.ts
    api.ts (/api/zalo/*) · syncRouter.ts (/api/zalo-sync)
sql/010_zalo.sql   web/zalo/*   reports/*zalo*   apps-script/ContentSyncZalo.gs
```
**Thêm nền tảng mới (TikTok…):** tạo `src/platform/tiktok/` (StatusRule + module), đăng ký vào `registry.ts`,
mount `/api/tiktok` trong `server.ts` (1 dòng) — dùng lại toàn bộ bảng `platform_*`, KHÔNG đổi schema/logic có sẵn.
