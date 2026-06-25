# Layout System (`src/components/layout`)

Task **S2-002** — khung layout toàn hệ thống, phong cách **Linear / Vercel / Stripe**.
React + TypeScript + Tailwind · dark-mode-first · responsive · mỗi component có Demo.

> ⚠️ Độc lập — **không sửa dashboard** vanilla (`public/index.html`, `server.ts`).

## Component (9)

| Component | Vai trò |
|---|---|
| `AppShell` | Khung tổng: sidebar (drawer mobile / cố định desktop) + header + content |
| `Sidebar` | Điều hướng gom nhóm + badge + footer |
| `Header` | Top bar mảnh (h-12): breadcrumb trái · command ⌘K giữa · actions phải |
| `Breadcrumb` | Phân cấp đường dẫn |
| `TopNavigation` | Tab cấp trang (gạch chân active) |
| `NotificationArea` | Chuông + badge unread + dropdown |
| `UserMenu` | Avatar + dropdown (tên/email/role + hành động) |
| `DarkModeToggle` | Bật/tắt Dark/Light (ghi `<html data-theme>` + localStorage) |
| `PageContainer` + `PageHeader` | Khung nội dung 1180px + tiêu đề trang (breadcrumb/mô tả/actions/tabs) |

## Dùng

```tsx
import { AppShell, Sidebar, Header, Breadcrumb, NotificationArea, UserMenu, DarkModeToggle, PageHeader, PageContainer } from './components/layout';
// import './components/ui/tokens.css' một lần ở root
```

`AppShell` nhận `header` là hàm `({ onMenuClick }) => ReactNode` để gắn nút mở sidebar trên mobile.

## Showcase

`LayoutShowcase.tsx` ráp toàn bộ thành 1 khung mẫu (không phải dashboard thật):
```tsx
import { LayoutShowcase } from './components/layout/LayoutShowcase';
```

## Type check

```bash
npm run typecheck:layout   # tsc -p src/components/layout/tsconfig.json
```
