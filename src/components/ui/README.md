# UI Component Library (`src/components/ui`)

Task **S2-001** — bộ component dùng chung, **tuân thủ [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md)**.
React + TypeScript + Tailwind · dark-mode-first · responsive · mỗi component có Demo (Story).

> ⚠️ Đây là **thư viện component độc lập** — KHÔNG sửa dashboard hiện tại (`public/index.html` vanilla giữ nguyên).

## Cài đặt / sử dụng

1. Import token CSS một lần ở root app: `import './tokens.css'` (định nghĩa biến màu + light/dark).
2. Tailwind dùng `tailwind.config.js` (ở project root) — màu trỏ vào CSS variables.
3. Đổi theme: đặt `data-theme="dark"` (mặc định) hoặc `"light"` trên `<html>`.

```tsx
import { KPICard, DataTable, StatusBadge } from './components/ui';
```

## Danh sách component (15)

| Component | Vai trò |
|---|---|
| `PageContainer` | Khung trang max-w 1180px |
| `SectionHeader` | Tiêu đề section (uppercase muted) |
| `MetricTooltip` | Tooltip công thức (hover) |
| `ActionButton` | Nút: default / ghost / primary |
| `SearchBox` | Ô tìm kiếm có icon |
| `KPICard` | Thẻ KPI (số lớn + tooltip + tone) |
| `StatCard` | Thẻ thống kê + delta so kỳ |
| `ContentCard` | Panel chung |
| `ChartCard` | Card chứa biểu đồ + controls |
| `StatusBadge` | Tag trạng thái / pill thị trường |
| `FilterBar` | Thanh filter sticky |
| `DateRangePicker` | 9 preset + khoảng ngày tùy chỉnh |
| `DataTable` | Bảng generic (sort, click, cuộn) |
| `EmptyState` | Trạng thái rỗng |
| `LoadingSkeleton` | Skeleton (kpi/table/line/block) |

## Demo / Showcase

- Mỗi file export `<Name>Demo` (Story đơn giản).
- `Showcase.tsx` render toàn bộ Demo trong 1 gallery: `import { Showcase } from './components/ui/Showcase'`.

## Kiểm tra type

```bash
npm run typecheck:ui   # tsc -p src/components/ui/tsconfig.json
```
