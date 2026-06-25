# SPRINT REVIEW 2 — Task R5: Review toàn bộ Source Code

> Phương pháp: liệt kê file + grep phát hiện trùng lặp/unused thực tế. Không sửa code — chỉ báo cáo.
> Ngày: 2026-06-25

## Tổng quan (đo được)
- **Backend:** `src/server.ts` = **617 dòng** (monolith: routes + helpers + transform + types).
- **Component library:** `src/components/ui` (15) + `src/components/layout` (9) — chất lượng tốt, tách bạch.
- **App React:** `web/` — 5 trang (Overview/Assignees/Markets/Explorer/Lifecycle) + `main.tsx`.
- **Scripts:** sync, backfill (runtime) + 5 script POC (dev).

## Bằng chứng trùng lặp & unused (grep)

| Vấn đề | Số file/đo |
|---|---|
| `presetRange()` lặp | **5 trang web** |
| `pct/ymd/pad` lặp | 3 trang |
| `liveDays()` lặp | 3 trang |
| `todayMs` lặp | 3 trang + server |
| `selectCls` lặp | 4 trang |
| `ExplorerView` (inline) trùng | **2 trang** (Assignees + Markets) |
| `aggregate()` trùng | 2 trang (Assignees + Markets) |
| fetch+`useEffect` (data fetch) lặp | **mọi trang** (không có hook chung) |
| `components/layout/*` được dùng | **0** (đã build S2-002, chưa wire) |
| `ui/Showcase.tsx` import | **0** (chỉ README) |

## Đánh giá theo hạng mục

| Hạng mục | Điểm | Nhận xét |
|---|:--:|---|
| **Folder structure** | B+ | `ui`/`layout`/`web`/`sql` rõ ràng. Nhưng `web/` để phẳng (5 trang + helper lẫn lộn), `src/` trộn server + scripts + components. |
| **Naming** | A− | Nhất quán: file script kebab-case, component PascalCase `.tsx`, biến camelCase, hằng UPPER_SNAKE. |
| **Unused code** | C | `components/layout/*` (9) + `Showcase` **chưa dùng**; script POC (`analyze-headers`, `check-duplicates`, `transform-content`, `import-sample`, `test-google-connection`) là one-off (`import-sample` đã bị `sync-all-content` thay thế). |
| **Duplicate code** | C+ | Nặng: `presetRange` ×5, `liveDays/todayMs/pct/ymd` ×3, `ExplorerView` ×2, `aggregate` ×2, `selectCls` ×4. |
| **Component** | B+ | `ui` tái dùng tốt; nhưng các trang web có **component inline** (`Bars`, `DuoBar`, `AvgBars`, `Metric`, `MarketCard`, `ExplorerView`) nên trích ra dùng chung. `DetailDrawer` đã chia sẻ (Explorer+Lifecycle) ✅. |
| **Hook** | C | **Không có custom hook**; logic `fetch + loading + error + refetch` lặp ở mọi trang → cần `useApi()`. |
| **API** | B | Logic đúng & gọn, nhưng `server.ts` **617 dòng monolith**; `lifecycle-table` và `contents` chồng vai trò (cùng trả list). |
| **Type** | C+ | Type lặp/độc lập mỗi file (`Item`, `Row`, `Agg`, `Lifecycle`…); **không có file type dùng chung** và **không chia sẻ schema client↔server**. |
| **Utility** | C+ | `date-util.ts` (server, CommonJS) và util ngày trong `web/` **tách rời, lặp logic**; chưa có `web/lib`. |

**Tổng chất lượng code: B** — thiết kế component & logic nghiệp vụ tốt, nhưng **trùng lặp nhiều ở tầng trang**, **server monolith**, **layout code chết**, **thiếu hook/type/util dùng chung**.

## Đề xuất Refactor (ưu tiên)

### Cao — xoá trùng lặp
1. **`web/lib/` dùng chung:** gom `presetRange`, `ymd`, `pct`, `liveDays`, `todayMs`, `selectCls`, bản đồ status/market vào 1 module → xoá lặp ở 5 trang.
2. **Custom hook `useApi(url)`** → `{ data, loading, error, refetch }`. Thay toàn bộ `fetch+useEffect` lặp.
3. **`useContentDrill()` / hợp nhất Explorer:** bỏ 2 bản `ExplorerView` inline; drill điều hướng tới `#/explorer?<filter>` (đồng thời sửa UX R3) → 1 nguồn duy nhất.
4. **`aggregate(rows)` chung** cho Assignees/Markets (1 hàm gom nhóm theo key).

### Trung bình — cấu trúc
5. **Tách `server.ts`** thành: `server/lib/transform.ts` (statusGroup/metrics/lifecycle helpers), `server/services/contents.ts` (getContents + cache), `server/routes/*.ts` (summary/contents/lifecycle/sync). ~617 → module nhỏ.
6. **`web/types.ts` dùng chung** (Content, Summary, Lifecycle, Item) — lý tưởng dùng **zod** ở server và suy ra type cho client (1 schema).
7. **Tổ chức `web/`**: `web/pages/`, `web/lib/`, `web/hooks/`, `web/components/` (Bars/DuoBar/Metric…).

### Thấp — dọn dẹp
8. **Quyết định `components/layout`**: wire vào app (R2/R3 đề xuất) **hoặc** đánh dấu rõ là "library chờ dùng" để không bị coi là dead code.
9. **Dời script POC** vào `scripts/dev/` (hoặc xoá `import-sample` đã lỗi thời) — tách khỏi runtime.
10. **Hợp nhất util ngày** server/web (cùng quy ước parse) để tránh lệch logic.

## Kết luận

Source ở mức **B**: nền tảng component & nghiệp vụ vững, **không có lỗi cấu trúc nghiêm trọng**, nhưng nợ kỹ thuật rõ ở **trùng lặp tầng trang** và **thiếu lớp dùng chung (lib/hook/type)**. Ba việc tác động lớn, rủi ro thấp:
1. **`web/lib` + `useApi` hook** (xoá ~80% lặp tầng trang).
2. **Hợp nhất Explorer** (bỏ 2 bản inline, kèm lợi UX).
3. **Tách `server.ts`** theo module + shared types.

Layout components & script POC nên được **wire hoặc dọn** để hết "code chết".
