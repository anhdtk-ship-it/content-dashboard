# PHASE 12 — Auto-Sync Dashboard Content (Webhook + Debounce)

> Ngày: 2026-07-01 · Phạm vi: **CHỈ Dashboard Content + Weekly Report**. KHÔNG đụng Ads.
> Trạng thái code: đã implement + test (typecheck/build/integration pass). Chưa deploy/chưa gắn Apps Script.

---

## 1. Kiến trúc Sync mới

```
Google Sheet Content (8 tab NĐ/QT × Hiếu/Ánh/KA/Liên)
        │  (onChange / onEdit)
        ▼
Google Apps Script Trigger  ──POST──►  Webhook  POST /api/content-sync
        │                                   │   (x-content-sync-secret)
        │                                   ▼
        │                          Debounce Queue (SyncQueue)
        │                          · debounce 60s (reset mỗi tín hiệu)
        │                          · Maximum Wait 5 phút
        │                          · Mutex (không chạy chồng)
        │                                   ▼
        │                          ContentSyncService.runContentSync()
        │                          1) đọc Sheet   2) validate
        │                          3) so sánh signature (chỉ bản ghi đổi)
        │                          4) upsert (atomic khi nhỏ)  5) prune (guarded)
        │                          6) ghi sync_logs
        │                                   ▼
        │                              Supabase (contents)
        │                                   ▼
        │                     invalidateContentsCache()
        │                                   ▼
        └───────────────►  Dashboard Content (poll 30s) + Weekly Report (đọc Supabase)
```

Nguyên tắc: **Webhook chỉ báo hiệu, Queue quyết định thời điểm, Service làm việc thật.**

---

## 2. Danh sách file ĐÃ TẠO

| File | Vai trò |
|---|---|
| `src/content-sync/ContentSyncService.ts` | Nguồn logic Sync DUY NHẤT: đọc Sheet → validate → **diff signature (chỉ upsert bản ghi đổi)** → prune guarded → ghi log. Library-safe (không `process.exit`). |
| `src/content-sync/SyncQueue.ts` | Debounce 60s + Maximum Wait 5m + Mutex chống chạy chồng. Chỉ hẹn giờ gọi `runFn`, không đọc Sheet/ghi DB. |
| `src/content-sync/routes.ts` | `POST /api/content-sync` (webhook, secret) + `GET /api/content-sync/status`. Trả 202 ngay, đẩy vào queue. |
| `sql/007_sync_logs_source.sql` | ALTER `sync_logs` thêm `source`, `rows_unchanged`, `rows_pruned`, `duration_ms` (additive, chạy tay). |
| `PHASE_12_AUTO_SYNC.md` | Tài liệu này. |

## 3. Danh sách file ĐÃ SỬA

| File | Thay đổi |
|---|---|
| `src/server.ts` | + import & mount `createContentSyncRouter({ onSynced: invalidateContentsCache })` **trước SPA fallback**; + hàm `invalidateContentsCache()` (xoá cache `getContents`). |
| `src/sync-all-content.ts` | Rút gọn thành **CLI wrapper** gọi `runContentSync({ source: 'manual-cli' })` (DRY). Hành vi `npm run sync` + scheduler P4 giữ nguyên. |
| `.env.example` | + `CONTENT_SYNC_SECRET`, `CONTENT_SYNC_DEBOUNCE_MS` (60000), `CONTENT_SYNC_MAX_WAIT_MS` (300000). |
| `PROJECT_SPEC.md` · `CURRENT_STATE.md` | Ghi nhận Phase 12 (§9 source of truth). |

> **KHÔNG file Ads nào bị sửa.** (`src/ads-monitor/*`, `web/ads-monitor/*` nguyên vẹn.)

---

## 4. Luồng hoạt động Google Sheet → Dashboard

1. Người dùng sửa 1 ô trong Sheet Content.
2. Apps Script trigger `onEdit`/`onChange` chạy → `UrlFetchApp.fetch()` gửi `POST /api/content-sync` kèm header secret.
3. Webhook xác thực secret → gọi `queue.enqueue()` → trả **202** ngay (không chờ).
4. Queue hẹn Sync sau 60s. Nếu còn sửa tiếp trong 60s → reset. Trần 5 phút thì buộc chạy.
5. Hết debounce → `runContentSync()`: đọc 8 tab, validate, **so khớp signature** để chỉ ghi bản ghi thay đổi, prune mồ côi (có guard), ghi `sync_logs`.
6. Sync xong → `invalidateContentsCache()`.
7. Dashboard (auto-poll 30s) gọi `/api/v3/summary` → cache đã mới → hiển thị số mới. Weekly Report đọc Supabase → số mới.

**Độ trễ tổng:** sửa Sheet → thấy trên Dashboard ≈ 60s (debounce) + ≤3s (sync) + ≤30s (poll) ≈ **~1–1.5 phút** (tối đa 5 phút nếu Sheet bị sửa liên tục).

---

## 5. Cách hoạt động của Debounce Queue

- Tín hiệu đầu tiên: đặt `firstRequestAt`, hẹn timer 60s.
- Mỗi tín hiệu tiếp theo: **clear timer cũ, đặt timer mới** (reset về 60s) → gom nhiều lần sửa thành 1 lần Sync.
- Ví dụ: 09:00:05 → 09:00:20 (reset) → 09:00:40 (reset) → im lặng → **09:01:40 Sync**.
- Lợi ích: nhiều người sửa dồn dập chỉ tốn 1 lần đọc Sheet + ghi DB.

## 6. Cách hoạt động của Maximum Wait

- Không để debounce trì hoãn vô hạn khi Sheet bị sửa liên tục.
- Mỗi lần hẹn: `wait = min(debounce 60s, maxWait 5m − thời gian đã trôi kể từ firstRequestAt)`.
- Khi đã chờ gần 5 phút, `wait` co về 0 → **buộc Sync ngay**, kết thúc chu kỳ, mở chu kỳ mới.
- Đảm bảo: dù sửa liên tục, **tối đa 5 phút phải có 1 lần Sync**.

---

## 7. Kiểm thử (đã chạy)

| Trường hợp | Cách test | Kết quả |
|---|---|---|
| ✓ **Sheet cập nhật 1 lần** | SyncQueue debounce 200ms, 1 tín hiệu | chạy đúng 1 lần sau debounce ✅ |
| ✓ **Sheet cập nhật liên tục** | Bắn tín hiệu mỗi 100ms trong 900ms (debounce 200, maxWait 500) | Max-Wait buộc chạy lần đầu ≈500ms rồi lần 2 khi ngừng ✅ |
| ✓ **Nhiều người cùng lúc** (mutex) | Tín hiệu tới trong lúc đang Sync (runFn 300ms) | không chạy chồng (`maxConcurrent=1`), pending mở chu kỳ mới (2 lần chạy) ✅ |
| ✓ **Webhook bảo mật** | POST không/sai/đúng secret | 401 / 401 / 202 ✅ |
| ✓ **Debounce coalesce thật** | 3 webhook trong 3s (integration server) | log "gộp 3 tín hiệu" → 1 sync ✅ |
| ✓ **Chỉ ghi bản ghi đổi** | Sync khi Sheet không đổi | `mới 0 · đổi 0 · giữ nguyên 1446 · ghi 0` ✅ |
| ✓ **Dashboard tự cập nhật** | `invalidateContentsCache()` gọi sau sync + poll 30s sẵn có | cache clear → poll thấy dữ liệu mới ✅ |
| ✓ **Weekly Report lấy dữ liệu mới** | đọc Supabase (không cache riêng) | tự thấy số mới sau sync ✅ |

Typecheck (`tsc`) + build web (vite) + integration (Express :4055) đều PASS.

---

## 8. Logging (`sync_logs`)

Mỗi lần Sync ghi 1 dòng: `source` (manual-cli/webhook/scheduler), `started_at`, `finished_at`, `rows_read`, `rows_inserted`, `rows_updated`, `rows_unchanged`, `rows_pruned`, `duration_ms`, `status` (success/partial/failed), `error_message`.

> Trước khi áp `sql/007`: service **fallback** payload tối thiểu (8 cột cũ) — vẫn ghi log, chỉ thiếu source/duration. Sau khi áp 007 → log đầy đủ.

## 9. Error Handling / "không ghi dở dang"

- Tập thay đổi nhỏ (≤5000, trường hợp incremental thường ngày) → **upsert 1 câu lệnh** = 1 statement Postgres = atomic (không có trạng thái ghi nửa vời).
- Có lỗi upsert → `status=partial/failed`, **BỎ QUA prune** (không xoá khi sync lỗi), ghi `error_message`, KHÔNG gọi `invalidateContentsCache` khi `failed`.
- Upsert idempotent theo `(content_code, market, assignee_name)` → chạy lại là tự chữa.
- *(Giới hạn: bulk >5000 dòng lô hoá qua nhiều statement — không nguyên tử tuyệt đối. Với luồng webhook incremental thực tế điều này gần như không xảy ra. Nếu cần atomic tuyệt đối cho bulk, xem "Đề xuất mở rộng" cuối file.)*

---

## 10. Xác nhận độc lập với Ads Monitor

- Không sửa bất kỳ file nào trong `src/ads-monitor/` hay `web/ads-monitor/`.
- `server.ts`: chỉ **thêm** 1 dòng mount `/api/content-sync`; route `/ads-monitor` + thứ tự đăng ký giữ nguyên.
- ContentSyncService KHÔNG gọi `calculateAdsStatus`/`ads_monitor_*`. Business Rule 3 miền vẫn tách biệt (§9).
- Ads Scheduler/Import/Lifecycle không liên quan cơ chế webhook này.

---

## 11. Đề xuất triển khai Google Apps Script (chưa viết code chính thức)

**Bước cấu hình phía Railway/Server:**
1. Đặt env trên Railway: `CONTENT_SYNC_SECRET=<chuỗi bí mật mạnh>` (bắt buộc; chưa có → webhook 503).
2. (Tuỳ chọn) `CONTENT_SYNC_DEBOUNCE_MS`, `CONTENT_SYNC_MAX_WAIT_MS`.
3. Áp `sql/007_sync_logs_source.sql` trong Supabase SQL Editor (để log đầy đủ).
4. **Lưu ý Railway free/hobby:** web service có thể ngủ khi không có traffic → debounce timer trong RAM có thể mất. Dùng plan luôn-bật, hoặc giữ scheduler P4 làm lưới an toàn (đọc §12).

**Google Apps Script (gắn vào Spreadsheet Content):**
- Trigger: **On change** (bao trùm cả sửa/nhập/xoá; `onEdit` chỉ bắt sửa tay). Cài qua *Triggers → Add Trigger → From spreadsheet → On change*.
- Handler đề xuất (mã minh hoạ, sẽ hoàn thiện ở bước sau):

```javascript
const WEBHOOK_URL = 'https://content-dashboard-production-4e96.up.railway.app/api/content-sync';
const SECRET = '...'; // đặt trong Script Properties, KHÔNG hardcode

function onChangeContent(e) {
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-content-sync-secret': PropertiesService.getScriptProperties().getProperty('SYNC_SECRET') },
    payload: JSON.stringify({ source: 'apps-script', changeType: e && e.changeType }),
    muteHttpExceptions: true,
  });
}
```

- Lưu secret bằng **Script Properties** (`PropertiesService`), không để lộ trong code.
- Debounce đã nằm ở server → Apps Script cứ bắn mỗi lần đổi, không cần tự gom.
- Quota Apps Script `UrlFetchApp`: ~20k lần/ngày (thừa cho use-case này).

---

## 12. Đề xuất mở rộng (tương lai, không bắt buộc)

- **Lưới an toàn:** giữ scheduler P4 (`npm run scheduler`) chạy thưa (vd mỗi 30–60 phút) trên worker luôn-bật, phòng khi webhook lỡ (server ngủ, Apps Script lỗi).
- **Atomic bulk tuyệt đối:** chuyển upsert sang RPC plpgsql nhận `jsonb[]` để cả bulk trong 1 transaction (chỉ cần khi thường xuyên bulk >5000 dòng thay đổi).
- **Realtime thay polling:** bật Supabase Realtime cho bảng `contents` để Dashboard cập nhật tức thì (hiện poll 30s là đủ theo spec §6).
- **Endpoint bảo vệ `/status`** bằng secret nếu muốn kín hoàn toàn.
