# SPRINT REVIEW 2 — Task R4: Đánh giá Performance

> Phương pháp: đo thật bằng `curl` (time/size) + kích thước bundle Vite. Server Express `:4000`, app React `web/`.
> Ngày: 2026-06-25 · **Không sửa code — chỉ báo cáo.**

## Số liệu đo được

### API timing & payload (kỳ June 2026)
| Endpoint | Thời gian | Payload | HTTP |
|---|---:|---:|:--:|
| `/api/v3/summary` | 0.44s* / **<5ms** (warm) | 4.2 KB | 200 |
| `/api/v3/lifecycle` | 93 ms | 10 KB | 200 |
| `/api/v3/lifecycle-table` (June) | 2.4 ms | **148 KB** | 200 |
| `/api/v3/lifecycle-table` (toàn bộ) | 5.6 ms | **724 KB** | 200 |
| `/api/v3/contents?page=1` | 1.6 ms | 8.5 KB | 200 |

\* Lần gọi đầu (cache miss) ~440 ms do `getContents()` fetch 1510 dòng từ Supabase. Sau đó warm.

### Cache server (`getContents` TTL 10s)
| | Thời gian |
|---|---:|
| Call 1 (warm) | 4.5 ms |
| Call 2 (warm) | 2.4 ms |
| Cold (lần đầu, fetch Supabase) | ~440 ms |

### Bundle (Vite, 1 chunk)
| File | Size | Gzip ~ |
|---|---:|---:|
| `index.js` | **250 KB** | ~74 KB |
| `index.css` | 29 KB | ~6 KB |

## Đánh giá theo hạng mục

| Hạng mục | Điểm | Nhận xét (đo) |
|---|:--:|---|
| **API** | A− | Warm < 10 ms nhờ cache 10s; cold ~440 ms (1 lần). Tính toán aggregate in-memory rất nhanh. |
| **Query** | A | 1 query/cache-miss, **batch 1000 dòng** (2 round-trip cho 1510); không N+1. `content-detail` thêm 1 query history/lần mở drawer (rẻ). |
| **Render** | A− | React + **`useMemo`** cho aggregate/sort (đã có). Bảng chỉ render **25 dòng/trang** → DOM nhẹ. |
| **Chart** | A | App React dùng **thanh HTML/CSS** (không Chart.js) → render gần như miễn phí. |
| **Table** | B+ | Phân trang phía client; chỉ 25 dòng trong DOM. Chưa virtual (chưa cần ở quy mô này). |
| **Pagination** | B+ | Client-side `slice` → tức thì, **nhưng** phải tải **toàn bộ set trước** (724 KB ở chế độ "tất cả"). |
| **Payload/Network** | **B−** | `lifecycle-table` **724 KB** (toàn bộ) / 148 KB (tháng), **không gzip** (Express thiếu compression). Đây là điểm nặng nhất. |
| **Bundle** | B | 1 chunk 250 KB (~74 KB gzip), **không code-split** theo route. |
| **Skeleton** | A | `LoadingSkeleton` (kpi/table/block) đã dùng ở các trang. |
| **Cache client** | C | Mỗi trang (Explorer/Người Nhận/Thị Trường) **fetch độc lập**, không cache chung; quay lại màn cũ là **fetch lại** 148–724 KB. |

**Tổng: B+** — nền tảng tốt (cache server, memoization, chart rẻ, skeleton), bị kéo xuống bởi **payload lớn không nén** + **không cache phía client** + **bundle 1 chunk**.

## Đề xuất (theo từng kỹ thuật yêu cầu)

### Caching
1. **Bật gzip/brotli** (compression middleware) trên Express → 724 KB → ~80–120 KB. **Lợi lớn nhất, dễ nhất.**
2. **HTTP cache headers** (`Cache-Control: max-age` / `ETag`) cho `/api/v3/*` (dữ liệu đổi theo sync) → trình duyệt/CDN tái dùng.
3. **Client cache theo filter-key** (SWR/react-query hoặc Map đơn giản): tránh refetch khi quay lại màn cũ với cùng bộ lọc.

### Lazy Loading
4. **Code-split theo route** (`React.lazy` + `Suspense`) → bundle ban đầu nhỏ, chỉ tải trang đang xem.
5. Nếu sau này thêm Chart.js → **lazy import** chỉ khi cần.

### Memoization
6. Đã dùng `useMemo` cho aggregate/sort. Bổ sung **`React.memo`** cho hàng bảng (row) và component thanh chart để tránh re-render thừa khi đổi trang/sort.
7. Memo hóa hàm format/parse ngày (đang tạo mới mỗi render — nhẹ nhưng gọn hơn).

### Virtual Table
8. **Chưa cần** ở quy mô hiện tại (render 25 dòng/trang). **Chỉ áp dụng** nếu thêm chế độ "hiện tất cả" hoặc pageSize lớn (>200) → dùng `react-window`/`@tanstack/virtual` để render theo viewport.

### Skeleton
9. Đã có. Đề xuất **đồng bộ skeleton ở mọi trạng thái tải** (một số panel hiện dùng block chung) và thêm **optimistic UI**/giữ dữ liệu cũ khi đổi filter (tránh nháy trắng) — kết hợp với client cache (#3).

## Kết luận

Hiệu năng hiện ở mức **B+**, **không có nút thắt nghiêm trọng** ở quy mô ~1500 content: server cache + memoization + chart CSS + skeleton đều tốt. Ba việc nâng lên **A** với chi phí thấp:
1. **Gzip** API (giảm ~6× payload) — ưu tiên #1.
2. **Client cache theo filter** (hết refetch khi quay lại màn).
3. **Code-split route** (bundle ban đầu nhỏ hơn).

Virtual table **chưa cần** cho tới khi render >200 dòng cùng lúc.
