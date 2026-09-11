# CURRENT_STATE — Content Operations Dashboard (Seryn)

> Ảnh chụp trạng thái mới nhất. Source of truth: `PROJECT_SPEC.md`. (`PROJECT_HANDOFF.md` đang lỗi thời — chưa cập nhật sau 31/07.)
> Cập nhật: **2026-09-11** — đã gỡ auto-sync tức thời + Railway, chốt đồng bộ 1 lần/ngày 10:00 giờ VN trên Vercel. Production: `https://content-dashboard-five-kappa.vercel.app`
> Các mục bên dưới xếp theo thứ tự **mới → cũ**; phần từ "VERCEL MIGRATION" trở xuống là lịch sử giữ nguyên để tra cứu.

## 2026-09-11 — QUYẾT ĐỊNH: đồng bộ 1 lần/ngày · gỡ auto-sync tức thời · bỏ hẳn Railway

> Hai chỉ đạo của chủ dự án: (1) Dashboard **không cần tự làm mới 30 giây** nữa, dữ liệu cập nhật **cố định 1 khung giờ mỗi ngày**; (2) **bỏ mọi thứ liên quan Railway**, chỉ tập trung Vercel.

### Chốt nhịp đồng bộ: 10:00 giờ VN mỗi ngày
- `vercel.json`: `crons` đổi từ `30 3 * * *` → **`0 3 * * *`** UTC = **10:00 giờ VN**, cho cả `/api/cron/daily/content` và `/api/cron/daily/zalo`.
- ⚠️ **Gói Hobby chỉ bảo đảm chạy trong khoảng 1 giờ quanh lịch.** Đo 8 ngày liên tiếp với lịch cũ: luôn trễ **đúng ~36 phút** (đặt 10:30 → chạy 11:06). Vậy lịch 10:00 dự kiến chạy khoảng **10:00–10:40**. Chủ dự án đã chấp nhận sai số này.
- Cần đúng phút ⇒ phải dùng cron ngoài (cron-job.org, miễn phí) hoặc nâng Vercel Pro. Chưa làm.

### Đã GỠ khỏi code (không phải vô hiệu hoá — xoá hẳn)
| Thành phần | File |
|---|---|
| Webhook Content + `/status` | `src/content-sync/routes.ts` |
| Webhook Zalo | `src/platform/zalo/syncRouter.ts` |
| Cron tick Content/Zalo | `src/content-sync/tickRoutes.ts` |
| Hàng đợi debounce | `src/content-sync/DbSyncQueue.ts` |
| 2 script trigger Google Sheet | cả thư mục `apps-script/` |
| Mount + import tương ứng | `src/app.ts` |
| Env `CONTENT_SYNC_SECRET` · `ZALO_SYNC_SECRET` · `*_DEBOUNCE_MS` · `*_MAX_WAIT_MS` | `.env.example` |

- **Bảng `sync_debounce` trên Supabase GIỮ NGUYÊN** (không xoá dữ liệu), chỉ không còn được đọc/ghi. Migration `sql/012` giữ lại theo quy ước không sửa migration đã áp dụng.
- **Còn giữ:** `/api/test-sync/*` (secret riêng `VERCEL_TEST_SYNC_SECRET`, dùng để đo Sync trên serverless) và `npm run scheduler` (node-cron chạy trên máy local, không liên quan Vercel).

### Đã bỏ Railway
- Railway app **đã bị xoá** — xác nhận trực tiếp: `GET .../health` → `404 {"message":"Application not found"}`. Đây chính là lý do webhook chết âm thầm từ 18/08 (Apps Script vẫn bắn vào domain đó, và `.gs` được viết để không bao giờ throw).
- Gỡ mọi mô tả Railway khỏi `.env.example`, `src/server.ts`, `PROJECT_SPEC.md`. `src/server.ts` **được giữ lại** — đó là entry chạy local (`npm run dashboard` / `npm run dev:server`), không phải file của Railway.
- **Domain production chính thức: `https://content-dashboard-five-kappa.vercel.app`** (trước đây không được ghi ở bất kỳ tài liệu nào — nay đã bổ sung).

### Giao diện
- Gỡ `setInterval(load, 30000)` ở **`web/OverviewPage.tsx`** và **`web/zalo/ZaloDashboardPage.tsx`** — 2 trang duy nhất còn polling. Trang chỉ tải dữ liệu khi mở hoặc khi đổi bộ lọc.
- Thay nhãn "Auto 30s" bằng **"Dữ liệu cập nhật: dd/MM HH:mm"** đọc từ `/api/v3/sync-status` (`lastSync`), giờ hiển thị theo giờ VN. Chấm tròn xanh khi lần sync gần nhất `success`.
- Zalo Tổng quan: nhãn đổi thành "Đồng bộ 1 lần/ngày (10:00)".

### Kiểm chứng
`npx tsc --noEmit` sạch · `npm run build` thành công (`web/dist/assets/index-*.js` 570 kB). **Chưa kiểm tra bằng mắt trên trình duyệt** vì app bắt buộc đăng nhập Google `@seryn.vn` — cần bạn mở `https://content-dashboard-five-kappa.vercel.app/#/overview` sau khi deploy để xác nhận dòng "Dữ liệu cập nhật".

### Hệ quả phải nhớ
- **Content xoá khỏi Google Sheet sẽ KHÔNG bị xoá khỏi dashboard** — route cron hardcode `prune=false`. Muốn dọn "mồ côi" phải chạy tay `npm run sync` (CLI có prune + guard). Nên đặt lịch nhắc định kỳ.
- Sửa Sheet giữa ngày sẽ không lên dashboard cho tới 10:00 hôm sau, trừ khi chạy tay.


## 2026-08 → 2026-09 — Các thay đổi CHƯA từng được ghi vào tài liệu

> 14 commit kể từ `7852d1a` (31/07) — thời điểm `PROJECT_HANDOFF.md` v4.0 được viết. Đã bổ sung vào `PROJECT_SPEC.md` ngày 2026-09-11 (§3.2, §4.10, §7, §8, §10, §12.2, §14, §15, §16).

### Module MỚI
- **Content Analytics (CONTENT-ANALYTICS-03)** — `21e384b` → `5550cf1` (18/08). Menu 📊 *Phân tích Data Content*, route `#/content-analytics`, API `GET /api/content-analytics`. Phân tích **Data (purchases) đến từ Content Mới hay Cũ theo tháng**, đọc THẲNG Sheet `Raw_Data` mỗi request (stateless, không cache, **không thêm bảng Supabase**). Rule quan trọng: Content = `ad_name` chuẩn hoá; dedup theo đủ 5 khoá `(date, ad_id, account_id, campaign_id, adset_id)` giữ `purchases` lớn nhất; `first_seen` tính trên TOÀN lịch sử; Employee suy từ `account_name` về **đúng 4 người KA/Hiếu/Ánh/Liên**, không khớp → "Không xác định". Chi tiết: `PROJECT_SPEC.md §15`.
- **Content Performance (CP-04)** — `71ed4ad` → `7fb75ef` (19/08). Menu 📈 *Phân tích Hiệu quả Content*, route `#/content-performance`, API `GET /api/content-performance`. Ghép **Performance/ROAS Sheet** + **Quality/CLĐT Sheet** + `editor_name` từ bảng `contents`. V1 **chỉ kênh Facebook** (PR để V2). Hai fix quan trọng sau khi go-live: `1cb3183` bù phần chênh SL Data cho category không liệt kê đủ content, `7fb75ef` **đọc thẳng dòng subtotal của Sheet cho Tổng quan** để ROAS khớp 100% với Sheet. Chi tiết: `PROJECT_SPEC.md §16`.
- ⚠️ Cả 2 module cần env mới: `PERFORMANCE_SHEET_ID/_TAB`, `QUALITY_SHEET_ID/_TAB` (Content Analytics dùng lại `ADS_SHEET_ID/_TAB`). Nhớ **share 2 Sheet mới cho Service Account**.

### Nghiệp vụ Content
- **Trạng thái "Chờ đăng bài"** (`0931f08`, 14/08) — nhóm `CHO_DANG_BAI` RIÊNG: content đã test/duyệt xong, chờ lên lịch đăng. **KHÔNG** gộp vào Tồn, **KHÔNG** để rơi vào "Chưa phân loại".
- **Fix công thức Tồn của Weekly** (`2dfd75b`, 14/08) — Tồn = **ĐÚNG** `current_status === 'Chờ chạy'`, không suy ra từ "đã cấp − đã test" như trước. Nguồn duy nhất: `src/shared/weeklyMetrics.ts` (đã viết lại `PROJECT_SPEC.md §12.2` cho khớp).

### Hạ tầng / vận hành
- **Full-sync 10:30 hằng ngày** (`bb7b3d6`, 18/08) — `vercel.json` khai báo **Vercel Cron native** gọi `/api/cron/daily/content` + `/api/cron/daily/zalo` lúc `30 3 * * *` UTC = **10:30 giờ VN**. Gọi thẳng `runContentSync`/`runZaloSync`, **KHÔNG qua debounce queue**, `prune` hardcode `false`. Đây là **lưới an toàn** chạy song song với cơ chế webhook + tick (§3.1).
- **Cho phép Vercel Cron gọi bằng GET** (`0d2cb06`, 03/09) — Vercel Cron native dùng `GET` + header `Authorization: Bearer <CRON_SECRET>`; route daily nhận cả GET lẫn POST (method khác → 405).
- **Endpoint test sync an toàn** (`d16a954`, 17/08) — `POST /api/test-sync/{content,zalo}`, secret RIÊNG `VERCEL_TEST_SYNC_SECRET` (KHÔNG fallback sang secret khác), `prune:false` cứng. Dùng để đo thời gian chạy Sync thật trên serverless, **không phải route production**.
- **Serverless-ready** (`9a8c35c`, 14/08) — hoàn tất tách `src/app.ts` / `src/server.ts` / `api/index.ts`.

### Giao diện
- **Ẩn "Tiến độ Content" khỏi sidebar Facebook** (`058055c`, 18/08) — route `#/usage` vẫn truy cập được qua URL.
- Menu hiện tại đầy đủ: xem `PROJECT_SPEC.md §4.10`.
- ⚠️ **Nợ kỹ thuật:** `NotificationArea` + `UserMenu` trong `web/main.tsx` vẫn là **dữ liệu giả hardcode** (3 thông báo mẫu, tên/email cố định "Phạm Cao"), chưa nối với user thật đang đăng nhập.

## 2026-09-11 — Đồng bộ tay + CHẨN ĐOÁN hạ tầng sync (đã có bằng chứng)

### Kết quả `npm run sync` (thủ công, có prune)
Backup trước khi chạy: `backup/contents_PRE-SYNC_2026-09-11T02-07-22-249Z.json` (2.218 dòng).

```
Rows Read : 2253  (hợp lệ+dedupe: 2246, loại: 0)   → 7 dòng trùng khoá trong Sheet, dedupe last-wins
Inserted  : 28 · Updated : 93 · Unchanged : 2125 · Pruned : 0 · Errors : 0
Atomic    : true · Duration : 4.22s · Status : success (sync_logs id=727)
```

**Đối soát sau sync: DB = 2.246 dòng = đúng số bản ghi hợp lệ của Sheet.** 0 trùng khoá `(content_code, market, assignee_name)`, 0 content mồ côi ⇒ **khớp 100% với Google Sheet**.

| Phân bố | |
|---|---|
| Thị trường | noi_dia 1.185 · quoc_te 1.061 |
| Nhân viên Ads | Hiếu 642 · Liên 585 · KA 535 · Ánh 484 |
| `current_status` | Đã test-ko chạy 1.483 · Đã chạy-Tắt 399 · Không test 116 · Duy trì-Chưa vít 70 · Đang test 62 · Chờ chạy 60 · **Chờ đăng bài 40** · Không được duyệt 7 · Duy trì-Đã vít 7 · trống 2 |
| Chất lượng dữ liệu | thiếu `upload_date_real` **85** · thiếu `test_date_real` 485 (phần lớn là content chưa test — bình thường) |

> ⚠️ 85 dòng thiếu `upload_date_real` ⇒ **không lọt vào cohort "Đã cấp" của Weekly Report / Overview** (mọi KPI theo kỳ đều lọc theo cột này). Nguyên nhân thường gặp: ô "Ngày up trello" trống hoặc sai định dạng `dd/mm`. Nên rà lại trên Sheet.

### Lần sync thứ 2 trong ngày (sync_logs id=728, cách lần đầu 5 phút)

`Read 2253 · Insert 0 · Update 23 · Unchanged 2223 · Pruned 0 · Errors 0 · 3.69s` — tổng DB vẫn **2.246** (không thêm/bớt content, chỉ đổi trạng thái).

Thay đổi trạng thái giữa 2 lần sync (bằng chứng cho thấy Sheet được sửa liên tục trong giờ làm việc):

| `current_status` | id=727 | id=728 | Δ |
|---|---:|---:|---:|
| Chờ đăng bài | 40 | 20 | **−20** |
| Chờ chạy | 60 | 76 | **+16** |
| Đang test | 62 | 66 | **+4** |
| *(các trạng thái còn lại)* | — | — | không đổi |

⇒ 20 content rời nhóm "Chờ đăng bài" (16 → Chờ chạy, 4 → Đang test); 3 bản ghi còn lại đổi ở trường khác (ngày/tiêu đề…).

> 💡 Đây chính là minh hoạ cho vấn đề ở mục dưới: Sheet thay đổi liên tục trong ngày nhưng hệ thống **chỉ tự sync 1 lần/ngày**, nên phải chạy tay mới thấy số mới.

### 🔴 PHÁT HIỆN: Auto-Sync tức thời (webhook) ĐÃ CHẾT từ 2026-08-18

Đọc trực tiếp Supabase:

- **Bảng `sync_debounce` ĐÃ CÓ** ⇒ `sql/012` **đã được áp dụng** (2 dòng: `content`, `zalo`). Gạch bỏ nghi vấn cũ.
- Nhưng dòng `queue_key='content'` đang: `pending = true`, `first_signal_at = last_signal_at = 2026-08-18T09:55:08Z`, **`claimed_at = null`, `last_run_at = null`, `running = false`**.
  ⇒ Có tín hiệu webhook từ **18/08** nằm treo **gần 1 tháng** mà **chưa ai claim để chạy** ⇒ **KHÔNG có cron ngoài nào gọi `/api/cron/tick/content`**.
- Nguồn 30 lần sync gần nhất: `webhook` 14 lần nhưng **lần cuối là 2026-08-14** · `vercel-test` lần cuối 19/08 · `daily-cron` **vẫn chạy đều** · `manual-cli` hôm nay.

**Kết luận:**
1. ✅ **Đang deploy trên VERCEL** — `daily-cron` (Vercel Cron native) chạy đều mỗi ngày (~04:06 UTC ≈ 11:06 VN; lịch khai báo 03:30 UTC, Vercel Hobby chạy xê dịch trong giờ). Railway coi như đã ngưng vai trò.
2. ❌ **Cơ chế webhook + debounce + tick KHÔNG hoạt động** vì thiếu cron ngoài gọi tick mỗi phút (bước 4 trong checklist cutover `PROJECT_HANDOFF.md §11` chưa làm hoặc job đã chết).
3. ⇒ Thực tế dữ liệu Content/Zalo **chỉ được cập nhật 1 lần/ngày** bởi `daily-cron`, KHÔNG phải "gần thời gian thực" như thiết kế Phase 12. Sửa Sheet buổi chiều thì sáng hôm sau dashboard mới thấy.

**Cách khắc phục (chọn 1):**
- **(A)** Đăng ký lại 2 cron job ngoài (cron-job.org…) gọi `POST /api/cron/tick/content` và `/api/cron/tick/zalo` mỗi ~1 phút, header `x-cron-secret: <CRON_SECRET>`. Đúng thiết kế Phase 12, giữ nguyên code.
- **(B)** Thêm lịch cron native của Vercel dày hơn cho tick (gói Hobby giới hạn tần suất — cần kiểm tra hạn mức hiện hành).
- **(C)** Chấp nhận 1 lần/ngày, thêm vài mốc `daily-cron` nữa trong `vercel.json` (vd 10:30 + 15:30 + 18:30) và **bỏ hẳn** webhook cho gọn.
- Dù chọn cách nào: nên **xoá tín hiệu treo** (`pending=true` từ 18/08) để lần tick đầu tiên không chạy oan.

## ⚠️ Điểm còn treo (cập nhật sau quyết định 2026-09-11)

1. ~~`sql/012` đã chạy chưa?~~ → **ĐÃ CHẠY** (bảng `sync_debounce` tồn tại). Nay **không còn được dùng** sau khi gỡ debounce — giữ nguyên, không xoá.
2. ~~Railway hay Vercel?~~ → **VERCEL**, domain `content-dashboard-five-kappa.vercel.app`. Railway đã bị xoá (404).
3. ~~Cron ngoài gọi tick không sống~~ → **KHÔNG CÒN LIÊN QUAN** — cơ chế tick đã gỡ bỏ, thay bằng Vercel Cron 10:00 hằng ngày.
4. **`ads:import` vẫn phụ thuộc máy Windows cục bộ** (Task Scheduler 09:35) — máy tắt là mất dữ liệu Ads ngày đó. Nên thêm route `/api/cron/daily/ads` để Vercel Cron lo luôn. **Đây là việc P1 còn lại.**
5. **Zalo không sync được từ máy local** — `.env` thiếu `ZALO_SHEET_ID` (đã bổ sung placeholder vào `.env.example`). Production vẫn chạy bình thường.
6. **85 content thiếu `upload_date_real`** → bị loại khỏi mọi KPI theo kỳ. Cần rà cột "Ngày up trello" trên Sheet (83 ô trống + 2 ô ghi «SC»).
7. **Content xoá khỏi Sheet không tự biến mất khỏi dashboard** (cron `prune=false`) — cần chạy tay `npm run sync` định kỳ.

## Trạng thái git (2026-09-11)
- HEAD `0d2cb06` trên `main`; nhánh `demo-v2` = baseline cũ, giữ có chủ đích.
- **Working tree chưa sạch:** `package.json` + `package-lock.json` đã sửa nhưng CHƯA commit; 6 file trong `output/` chưa track (`AdsMonitor_Top10_*`, `Order_*.xlsx`, `PageID_*`) — cần quyết định commit hay bỏ vào `.gitignore`.


## VERCEL MIGRATION (LỊCH SỬ 08/2026) — giữ để tra cứu

> ⚠️ Tiêu đề gốc là "còn 5 bước thủ công". Cập nhật 2026-09-11: **bước 1 (chạy `sql/012`), 2 (tạo project Vercel), 3 (env), 5 (Redirect URL), 6 (WEBHOOK_URL) coi như đã xong** — Vercel Cron chạy được nghĩa là deploy + env đã đúng. **Chỉ còn thiếu bước 4 (cron ngoài gọi tick)** — xem mục chẩn đoán 2026-09-11 ở trên.
- **Lý do:** Railway auto-deploy không cập nhật bundle sau nhiều lần push (không rõ nguyên nhân từ phía Railway).
- **Vấn đề kỹ thuật cốt lõi:** Vercel serverless không share RAM giữa các request → debounce webhook cũ (`SyncQueue.ts`, `setTimeout` 60s trong RAM) không hoạt động đúng.
- **Đã làm (code, đã typecheck+build+test local sạch):**
  - Tách `src/server.ts` → `src/app.ts` (`createApp()`, toàn bộ route API, không static/SPA/listen) + `src/server.ts` mỏng (local/Railway: app.ts + static + listen) + `api/index.ts` (Vercel: app.ts, không static).
  - `SyncQueue.ts` (RAM) → **xoá**, thay bằng `src/content-sync/DbSyncQueue.ts` — debounce lưu ở Supabase, bảng **`sync_debounce`** (`sql/012_sync_debounce.sql`, **CHƯA áp dụng**), 3 RPC atomic (`sync_enqueue`/`sync_tick_claim`/`sync_tick_finish`, có tự phục hồi "stuck").
  - Webhook (`/api/content-sync`, `/api/zalo-sync`) giờ CHỈ ghi tín hiệu debounce, KHÔNG tự chạy Sync.
  - Route mới **`/api/cron/tick/content`** + **`/api/cron/tick/zalo`** (secret riêng `CRON_SECRET`) — nơi THỰC SỰ chạy Sync, gọi bởi cron ngoài mỗi ~1 phút (Vercel Hobby Cron chỉ 1 lần/ngày, không đủ tần suất).
  - `vercel.json` (buildCommand/outputDirectory/rewrites/maxDuration) + `CRON_SECRET` thêm vào `.env.example`.
- **⚠️ CHƯA làm (5 bước thủ công, người dùng thực hiện):** 1) chạy `sql/012` trên Supabase, 2) tạo project Vercel + set env vars, 3) đăng ký 2 cron job ngoài (cron-job.org) gọi tick mỗi phút, 4) thêm domain Vercel vào Supabase Auth Redirect URLs, 5) đổi `WEBHOOK_URL` trong Apps Script (`ContentSync.gs`/`ContentSyncZalo.gs`) sang domain Vercel.
- **Cho tới khi xong 5 bước trên:** Railway vẫn là bản chạy chính. Nếu Railway tự deploy code mới này TRƯỚC KHI chạy `sql/012` + đăng ký cron ngoài → Auto-Sync trên Railway cũng sẽ đứng im (webhook vẫn 202 nhưng không ai tick để claim chạy Sync) — cần làm 2 bước 1 và 3 sớm nhất có thể, bất kể deploy ở đâu.

## Authentication / Authorization (ĐẢO NGƯỢC §9 cũ "không auth")
- **Cơ chế:** Supabase Auth (Google). Chỉ email **@seryn.vn** (`AUTH_ALLOWED_DOMAIN`). Sau đăng nhập: kiểm tra bảng `users` + `is_active`; sai → **403 "Bạn không có quyền truy cập hệ thống."**. role LƯU nhưng CHƯA phân quyền.
- **File mới:** `sql/008_users.sql` (bảng users + RLS) · `src/auth/authMiddleware.ts` (`requireAuth`) · `src/auth/routes.ts` (`/api/auth/me`) · `web/auth/{supabaseClient,authFetch,LoginPage,AuthGate}.ts(x)`.
- **File sửa (chỉ THÊM):** `src/server.ts` (mount `/api/auth` + `requireAuth` trên `/api/v3` & `/ads-monitor`) · `web/main.tsx` (bọc App trong AuthGate + fetch interceptor) · `.env.example`.
- **Public (không auth):** `/health`, `/api/config`, `/api/content-sync` (secret riêng), static SPA. **Bảo vệ:** `/api/v3/*`, `/ads-monitor`.
- ✅ **KHÔNG đổi** Dashboard/Business Rule/Ads Monitor/Weekly Report — chỉ bọc auth quanh chúng. Verified: API dữ liệu không token → 401.
- ⚠️ **Vận hành cần:** bật Google provider + OAuth creds (Supabase/Google Cloud) + redirect URL; `SUPABASE_ANON_KEY` trên Railway; chạy `sql/008`; thêm user đầu tiên.

## Phase 12 — Auto-Sync Dashboard Content (Webhook + Debounce)
- **Mục tiêu:** Content không cần Sync tay. Google Sheet đổi → Apps Script bắn webhook → Debounce Queue → ContentSyncService → Supabase → Dashboard (poll 30s) + Weekly Report.
- **File mới:** `src/content-sync/ContentSyncService.ts` (nguồn logic sync DUY NHẤT: đọc Sheet → validate → **so sánh signature, CHỈ upsert bản ghi đổi** → prune guarded → log), `src/content-sync/SyncQueue.ts` (debounce 60s + Max-Wait 5m + mutex chống chạy chồng), `src/content-sync/routes.ts` (`POST /api/content-sync` webhook + `GET /api/content-sync/status`), `sql/007_sync_logs_source.sql`.
- **File sửa:** `src/server.ts` (mount router trước SPA fallback + `invalidateContentsCache()` sau sync), `src/sync-all-content.ts` (thành CLI wrapper mỏng gọi service — DRY, scheduler P4 vẫn chạy), `.env.example` (+`CONTENT_SYNC_SECRET/_DEBOUNCE_MS/_MAX_WAIT_MS`).
- **Bảo mật:** webhook bắt buộc `CONTENT_SYNC_SECRET` (header `x-content-sync-secret`); chưa cấu hình → 503; sai → 401.
- **Hiệu năng:** chỉ ghi bản ghi thay đổi (diff signature), upsert 1-câu-lệnh (atomic) khi tập nhỏ; guard prune giữ nguyên; thiết kế chịu được ~50k dòng.
- **Migration 007 (mở rộng `sync_logs`: source/rows_unchanged/rows_pruned/duration_ms) — CẦN chạy tay Supabase.** Chưa chạy thì service tự fallback payload tối thiểu (vẫn hoạt động, chỉ thiếu cột mới).
- ✅ **Ads Monitor / Ads Sync / Ads Scheduler / Lifecycle Ads KHÔNG đụng.** Weekly Report giữ nguyên Business Rule/KPI (chỉ hưởng lợi dữ liệu mới trong Supabase).
- ⚠️ **Triển khai vận hành còn cần:** đặt `CONTENT_SYNC_SECRET` trên Railway; gắn Apps Script trigger (đề xuất trong `PHASE_12_AUTO_SYNC.md`); áp migration 007.

### 2026-07-01 — GoogleAuthFactory (fix sync trên Railway)
- **Vấn đề phát hiện:** webhook chạy đúng nhưng Sync trên Railway **failed** vì `ENOENT credentials/credentials.json` — Railway không có file credentials (thư mục `credentials/` bị gitignore).
- **File mới `src/google-auth.ts`** — `createGoogleAuth()` / `createSheetsClient()`. Thứ tự: **`GOOGLE_CREDENTIALS_JSON`** (Railway/cloud, không cần file) → **`GOOGLE_CREDENTIALS_PATH`** (file, local) → throw rõ ràng.
- **Refactor 7 nơi** dùng GoogleAuth về factory (chỉ đổi cách khởi tạo auth, KHÔNG đổi logic): `content-sync/ContentSyncService.ts`, `ads-monitor/GoogleSheetAdsSyncProvider.ts`, `sheets-reader.ts`, `transform-content.ts`, `analyze-headers.ts`, `check-duplicates.ts`, `test-google-connection.ts`. Bỏ các guard `GOOGLE_CREDENTIALS_PATH` cũ (chặn nhầm nhánh JSON).
- **Verify:** nhánh JSON kết nối Sheet OK (dù PATH sai) · nhánh PATH local OK · thiếu cả hai → throw đúng thông báo. Typecheck+build xanh.
- **Railway CẦN đặt `GOOGLE_CREDENTIALS_JSON`** (nội dung Service Account JSON) — sau đó webhook sync mới chạy được. Không cần thư mục credentials / Start Command đặc biệt.

## 2026-07-01 — Sửa Tỷ lệ test thành công + sync DB
- **Sync**: chạy `npm run sync` (DB cũ 5 ngày). Kết quả: +11 mới, −34 mồ côi, 1435 updated → DB = **1446 dòng** khớp Google Sheet. "Không test" lần đầu lên **11** (trước = 0).
- **Công thức Tỷ lệ test thành công (CHỐT)**: Thành công = **CHỈ Duy trì** (Chưa vít + Đã vít) — bỏ 'Đã chạy-Tắt'. Mẫu = **Đã có kết quả cuối** = Duy trì + Đã test-ko chạy + Đã chạy-Tắt (**loại 'Đang test'**). Sửa: `src/server.ts metrics()` (S_SUCCESS + S_FINALIZED), `web/AssigneesPage.tsx` (per-NV + overall), `web/MarketsPage.tsx` + tooltip. `kpi.testSuccessRate` (buildSummary) vốn đã đúng, giữ nguyên.
- ✅ Ads Monitor & Weekly Report KHÔNG đổi.

## Phase 11 — 2 nhóm KPI (Weekly Report Content)
- **A. Phát sinh trong tháng** (cohort theo upload trong kỳ): **Đã cấp** (upload trong kỳ, KHÔNG cumulative) · **Không test** (upload trong kỳ & 'Không test') · **Content test win** (upload trong kỳ & 'Duy trì').
- **B. Trạng thái hiện tại** (ALL, không giới hạn tháng): **Chờ chạy (Tồn)** · **Đang test** — backlog thực tế theo `current_status`.
- Weekly Report: bộ KPI mới (5 team overview / 6 cột bảng); **bỏ** Đã test/Tồn-cũ/Tỷ lệ test/Tỷ lệ win. Rule Engine đổi nhận xét theo KPI mới (Chờ chạy cao / Đang test cao / Không test cao / win). `WeeklyReportService` fetch TOÀN BỘ content (no date filter).
- Verified: kỳ 01–30/06 → cấp 297; kỳ 01–07/06 → cấp 87 (theo tháng) nhưng Chờ chạy 31 / Đang test 39 **giữ nguyên** (all-time) ✓.
- **Overview (Tổng Quan) đã đổi thẻ KPI** sang đúng bộ 5 (Đã cấp · Không test · Chờ chạy (Tồn) · Đang test · Content test win) — server trả `summary.contentKpi` (A trên F cohort, B trên base all-time); bỏ các thẻ tỷ lệ cũ. Verified: June capped 297 vs week1 87 (theo tháng); Chờ chạy 31/Đang test 39 giữ nguyên (all-time).
- ✅ Ads Monitor KHÔNG đổi (server.ts chỉ thêm `contentKpi` ở buildSummary Content; route/ads-monitor + status/lifecycle nguyên vẹn — verified source=supabase).

## Phase 10 — Trạng thái "Không test" (Content Dashboard + Weekly Report)
- **Content Dashboard (additive):** nhận diện `current_status = 'Không test'` → group `KHONG_TEST` (`server.ts` statusGroup/metrics/byStatus); thêm vào **bộ lọc trạng thái** (GlobalFilter), **màu** (tokens: statusStyle/groupStyle/STATUS_GROUPS + OverviewPage chart), loại khỏi cảnh báo "chưa test". KHÔNG đổi công thức KPI/giao diện hiện có.
- **Weekly Report (§4+§7):** thêm KPI **Không test** (team overview + cột bảng); **Tồn** = upload ≤ cuối kỳ & chưa test đến cuối kỳ & ≠ Không test; **§7 as-of cuối kỳ**: Đã cấp cumulative (upload ≤ cuối kỳ), Đã test theo test-date trong kỳ → content upload tháng trước/test tháng sau tính đúng. Rule Engine thêm nhận xét "Không test cao". Verified: kỳ 01–15/06 → cấp 1.304 (cumulative) · test 157 · không test 0 · tồn 367.
- ⚠️ "Không test" hiện = 0 vì Google Sheet **chưa có** content trạng thái này; khi Sheet thêm → tự lên số. Không có ngày-đổi-trạng-thái → Không test tính **cumulative**.
- ✅ **Ads Monitor KHÔNG đổi** (không file Ads nào sửa; API/status/lifecycle nguyên vẹn — verified).

## Phase 8 — Weekly Report (module mới, BUSINESS RULE RIÊNG)
- Menu **Reports → Weekly Report** (`web/reports/` — types/services/components/pages/**hooks**/**utils**, `#/weekly-report`). KHÔNG đụng Content/Ads/Sync/DB/API.
- **Service riêng** `WeeklyReportService` (`calculateWeeklyKPIs`/`calculateWeeklyEmployeeReport`) — KHÔNG dùng `calculateAdsStatus`/Lifecycle/metrics Dashboard. Đọc **dữ liệu thô** `/api/v3/contents` (phân trang) + tự tính.
- KPI (§6): Đã cấp · Đã test (`test_date_real != null`) · Tồn (`cấp−test`) · Tỷ lệ test (1 chữ số TP) · Content test win (đạt "Duy trì") · Tỷ lệ win. ⚠️ "win = Duy trì" tính bằng rule riêng trên dữ liệu Content (KHÔNG dùng ads_monitor_lifecycle — grain khác) — **cần nghiệp vụ xác nhận**.
- Bộ lọc **Khoảng thời gian tùy chỉnh** (Từ/Đến theo ngày, mặc định tuần hiện tại) — **đã bỏ Địa lý**. Group theo `assignee_name` = Nhân viên Ads (không dùng Biên tập).
- **Bố cục print-friendly (`ReportDocument`)**: I (text KPI) · II "Đánh giá" (Đánh giá ≤2 + Hành động tuần tới ≤2, Rule Engine độc lập theo KPI từng người, không so sánh) · III "Kế hoạch tuần tới" (checklist ☐). Nhập tay (cục bộ, chưa persist).
- **Xuất PDF (Phase 9) = `window.print()` in chính `#report-doc`** — không template riêng; `@media print` trong `web/styles.css`: A4 portrait, ẩn chrome (aside/header/.no-print), header lặp mỗi trang, footer số trang, `.emp-block` không cắt giữa trang. Copy chạy; DOCX để dành. *(Pagination cuối cùng nên kiểm bằng Ctrl+P trên trình duyệt.)*
- Verified preview tuần 01–07/06: cấp 87 · test 65 · tồn 22 · tỷ lệ test 74.7% · win 9 · tỷ lệ win 13.8%.

## Phase 7 — Lifecycle + Current Status (thuật toán trạng thái mới)
- Trạng thái KHÔNG còn chỉ dựa amount. **Đã tắt** = chi tiêu **NGÀY DỮ LIỆU MỚI NHẤT (global)** = 0; ngược lại theo **Lifecycle** (NEW→Mới chạy · TEST→Đang test · MAINTAIN→Đang duy trì).
- **FIX (quan trọng):** `latest_amount` lấy theo `max(sheet_date)` TOÀN HỆ THỐNG, không phải ngày-cuối-riêng-content. Sheet bỏ qua ngày không chi tiêu → content ngừng chạy không có dòng ngày mới nhất → 0 → Đã tắt. *(Trước fix: lấy nhầm ngày cuối riêng → ad ngừng vài ngày vẫn báo còn chạy.)* Verified: ngày 06-29 có 63 content chi tiêu >0 = đúng 63 "còn chạy"; 832 Đã tắt.
- **Lifecycle** (NEW/TEST/MAINTAIN) theo **tổng chi tiêu ĐỜI** (>3tr MAINTAIN · >100k TEST · còn lại NEW), **monotonic**, lưu bảng `ads_monitor_lifecycle`, refresh **chỉ khi import** (`ads_monitor_refresh_lifecycle()`), dashboard chỉ đọc.
- **Migration `sql/006`** (bảng + 2 function + backfill) — ⏳ **chờ chạy trên Supabase** rồi mới deploy code (code mới đọc `latest_amount`/`lifecycle`).
- File sửa: `sql/006` (mới), `calculateAdsStatus.ts` (chữ ký mới), `types.ts`, `AdsMonitorRepository.ts` (normalizeRow+mock), `AdsMonitorService.ts`, `import.ts` (gọi refresh), `verify.ts`. **Frontend KHÔNG đổi** (lifecycle ẩn; build hash không đổi).
- Đã verify logic TS (mock) + dữ liệu thật (verify PASS, 4 ví dụ khớp) + production đồng bộ.

## Ads Import Scheduler (mới)
- `npm run ads:scheduler` (`src/ads-monitor/ads-scheduler.ts`) — node-cron, spawn `npm run ads:import` theo lịch. Độc lập scheduler Content.
- Env: `ADS_SYNC_ENABLED` (default true), `ADS_SYNC_CRON` (default `35 9 * * *` = 09:35, sau khi Sheet cập nhật **09:20**). Chống chạy chồng, không crash, validate cron.
- ⚠️ Cần chạy trên **worker/máy luôn bật** (Railway web service KHÔNG tự chạy scheduler).
- **Triển khai thực tế (máy Windows này):** Task Scheduler `AdsMonitorDailyImport` chạy `run-ads-import.bat` → `npm run ads:import` lúc **09:35 hằng ngày** (log: `ads-import.log`). Đổi giờ: `schtasks /Change /TN AdsMonitorDailyImport /ST hh:mm` (nếu hỏi mật khẩu thì dùng `schtasks /Create /F …`).

## Phase 6 (Go Live) — ✅ LIVE PRODUCTION với dữ liệu thật, tích lũy (2026-06-29)
- ✅ Migration `005` đã chạy (bảng + FUNCTION `ads_monitor_query` tích lũy). `.env` + Railway env có `ADS_SHEET_ID=1kqVs8dyOgnk5l3CsgcGlhex-eI7OHhAkS6GLKnXh4j0`, `ADS_SHEET_TAB=Raw_Data`; SA đã share.
- ✅ Import lần đầu: **Read 9423 / Insert 9423 / 0 lỗi**. ads_monitor có **9423 dòng thô** (lịch sử `2026-03-23` → `2026-06-28`); gộp đời = **886 ad**.
- ✅ Code Phase 4/5/6 commit + push `main` (`5207afe`); **Railway production LIVE** (`content-dashboard-production-4e96.up.railway.app`): `/health` 200, `/ads-monitor` `source: supabase`.
- ✅ **amount_spent = TÍCH LŨY/ĐỜI** = `SUM` theo `(page_code, content)` qua mọi ngày (function GROUP BY). Verify PASS: total 886 · totalAmount **9.122.961.003** · duyTri **310** · test 563 · moiChay 5 · daTat **8**.
- ✅ Bỏ fallback-mock âm thầm: mock CHỈ khi chưa cấu hình Supabase hoặc `ADS_USE_MOCK=true`.

### Bộ lọc Tháng (mới) — server-side, mặc định tháng hiện tại
- UI thêm field "📅 Tháng" (input month, MM/YYYY); API nhận `month=YYYY-MM` → route đổi thành range `sheet_date` (đầu→cuối tháng), KHÔNG đổi SQL/DDL. KPI + bảng + filter khác đều theo tháng đang chọn. Verified: 2026-06 → 391 ad/3.01B; tháng rỗng → 0; không month → 886/9.12B (đời).
- ⚠️ Thay đổi này (route + frontend) **chưa commit/push** (kèm CURRENT_STATE/PROJECT_SPEC). Cần commit để Railway deploy.

### ⚠️ Còn lại / cần lưu ý
- **VIEW chưa khớp migration:** trên DB vẫn còn `ads_monitor_latest` (cũ), chưa tạo `ads_monitor_lifetime`. KHÔNG ảnh hưởng dashboard (app dùng FUNCTION, không dùng view). Chạy lại phần "VIEW" trong `sql/005` để khớp (tùy chọn).
- **Mapping Raw_Data là GIẢ ĐỊNH:** `content←ad_name · page_code←adset_name · ads_owner←token đầu adset_name · location←TQ/NN từ campaign_name · sheet_date←date`. `ads_owner` chưa chuẩn hóa hoa/thường ("LIÊN" vs "Khiêm") → cân nhắc join Config (account_id→Ads_name).
- Lịch import hằng ngày (worker riêng) + `EXPLAIN ANALYZE` ở mốc lớn — chưa làm.

## Tổng quan nhanh (cập nhật 2026-09-11)

| Miền | Trạng thái |
|---|---|
| **Dashboard Content (FB)** | ✅ Ổn định, dữ liệu thật. Có thêm trạng thái "Chờ đăng bài" |
| **Ads Monitor** | ✅ LIVE `source: supabase` (KHÔNG còn mock). Import 09:35 hằng ngày qua Task Scheduler cục bộ |
| **Weekly Report (FB)** | ✅ KPI dùng chung `weeklyMetrics.ts` cho web + PDF |
| **Zalo** | ✅ Dashboard + Weekly + sync 2 tab Video/Banner |
| **Budget Allocation** | ✅ Chỉ đọc `/ads-monitor`, 4 nhóm Tươi/Cũ × ngưỡng 5tr |
| **Content Analytics** | ✅ MỚI (18/08) — stateless, đọc thẳng `Raw_Data` |
| **Content Performance** | ✅ MỚI (19/08) — stateless, đọc Performance + CLĐT Sheet |
| **Phân quyền theo `role`** | 🟡 Cột đã lưu, **chưa có logic chặn** |
| **`content_status_history`** | 🔲 Vẫn rỗng → Retention Curve chưa mở được; "Duy trì tháng" chỉ là proxy |

> Phần bảng ngay bên dưới là **lịch sử Phase 5** (giữ để tra cứu) — không phản ánh trạng thái hôm nay.

## Ads Monitor sau Phase 5
| Hạng mục | Trạng thái |
|---|---|
| Server-side pagination (`page/pageSize`) | ✅ Repository chỉ trả đúng số dòng 1 trang (qua SQL function) |
| Server-side filter (content/adsOwner/location/pageCode/status/ngày) | ✅ Toàn bộ ở SQL; React/JS không lọc |
| KPI bằng SQL (`COUNT/SUM/FILTER`) | ✅ Function `ads_monitor_query` trả `kpi` |
| Index | ✅ `(page_code,content,sheet_date)` unique, `(sheet_date)`, `(ads_owner)` |
| Lưu lịch sử theo ngày | ✅ Khóa snapshot `(page_code,content,sheet_date)` + VIEW `ads_monitor_latest` |
| Giao diện | ✅ Giữ nguyên (chỉ rewire data flow) |
| Typecheck / Vite build | ✅ Sạch |
| Verify đường mock (paginate/filter/sort/KPI) | ✅ qua Express :4099 |

## Việc cần làm tiếp (cập nhật 2026-09-11)

> 4 việc P1 cũ của Phase 5 (commit code Ads, chạy `sql/005`, cấu hình `ADS_SHEET_ID`, go-live) **ĐÃ XONG** từ Phase 6 — đã bỏ khỏi danh sách.

**P1 — chặn vận hành**
1. **Xác nhận `sql/012_sync_debounce.sql` đã chạy trên Supabase** (xem mục "Những điểm CẦN XÁC NHẬN" ở đầu file). Thiếu bảng này = auto-sync tức thời không bao giờ chạy.
2. **Chốt lại nơi deploy thật (Railway hay Vercel)** và ghi vào file này + `PROJECT_HANDOFF.md §11`; kiểm tra cron ngoài gọi `/api/cron/tick/*` còn sống.
3. **Chuyển `ads:import` khỏi máy Windows cục bộ** lên hạ tầng luôn-bật (worker chạy `npm run ads:scheduler`, hoặc thêm route cron daily cho Ads giống `/api/cron/daily/*`).
4. **Dọn working tree**: commit hoặc `.gitignore` cho `package.json`/`package-lock.json` đang sửa dở và 6 file `output/` chưa track.

**P2 — nghiệp vụ / chất lượng dữ liệu**
5. **Phân quyền theo `role`** (Admin/Viewer) — hiện mọi email `@seryn.vn` hợp lệ có quyền ngang nhau, kể cả auto-provision lần đầu đăng nhập.
6. **Xác nhận mapping Ads `Raw_Data`** (`content←ad_name`, `page_code←adset_name`, `ads_owner←token đầu adset_name`) — vẫn là GIẢ ĐỊNH; `ads_owner` còn nhiễu `Br/BR/S` và không đồng nhất hoa/thường (`LIÊN`).
7. **Ghi `content_status_history`** khi phát hiện đổi `current_status` lúc sync → mở khoá Retention Curve và làm "Duy trì tháng" thành số thật thay vì proxy.
8. Nối `UserMenu`/`NotificationArea` (`web/main.tsx`) với user thật thay cho dữ liệu giả hardcode.

**P3**
9. Persist phần soạn tay II/III của Weekly Report (bảng `weekly_report_notes` + migration mới) · Export DOCX.
10. `EXPLAIN ANALYZE ads_monitor_query(...)` ở mốc dữ liệu lớn (lần `ads:import` gần nhất đọc ~16.700 dòng từ Sheet).
11. Đồng bộ lại `PROJECT_BACKLOG.md` (vẫn ghi Sprint 4 Auth "Cancelled / Share Link" — sai) và `PROJECT_HANDOFF.md` (mới tới HEAD `7852d1a`).

## Ràng buộc còn hiệu lực

- **7 miền nghiệp vụ ĐỘC LẬP**, KHÔNG dùng chung Business Rule: Dashboard Content (FB) · Ads Monitor · Weekly Report · Zalo · Budget Allocation · Content Analytics · Content Performance.
- **Facebook = Stable Version** — làm module khác thì KHÔNG đụng code/logic Facebook.
- **Ads Monitor:** `status` KHÔNG lưu trong bảng — tính động từ `calculateAdsStatus(latestAmount, lifecycle)`; riêng **`lifecycle` CÓ lưu** ở `ads_monitor_lifecycle` (monotonic, chỉ refresh khi import). *(Câu "luôn tính từ `amount_spent`" của Phase 5 đã lỗi thời từ Phase 7.)*
- **KHÔNG sửa `public/index.html`** (dashboard vanilla legacy, không còn được serve).
- **KHÔNG tắt lại Authentication** (đã đảo ngược quyết định Share Link cũ).
- **Migration:** chỉ thêm file `sql/0xx_*.sql` mới, KHÔNG sửa migration đã áp dụng; DDL phải chạy TAY trong Supabase SQL Editor.
- **Quy tắc vàng:** đổi schema/API/sync/dashboard/phân quyền → cập nhật `PROJECT_SPEC.md` trong cùng thay đổi đó.
