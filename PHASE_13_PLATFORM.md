# PHASE 13 — Multi-Platform (Facebook + Zalo)

> Phạm vi: **kiến trúc + interface** (đã chốt). Chỉ THÊM MỚI trong `src/platform/`.
> **Facebook giữ nguyên 100%** — 0 file FB bị sửa (bundle web build ra trùng hash cũ `index-DKahLe3S.js`).

## Kiến trúc mới (additive)
```
src/platform/
├── types.ts            ← interface CHUNG: StatusRule, PlatformModule, Platform, ContentFormat
├── registry.ts         ← điểm vào duy nhất: getPlatform('facebook'|'zalo'), listPlatforms()
├── facebook/
│   ├── FacebookStatusRule.ts  ← SAO Y công thức trạng thái server.ts (file mới, KHÔNG đụng FB)
│   └── index.ts               ← facebookModule (hasContentFormat=false, sheet=GOOGLE_SHEET_ID)
└── zalo/
    ├── ZaloStatusRule.ts      ← Business Rule RIÊNG của Zalo (KHÔNG dùng chung FB) — skeleton, có TODO
    ├── contentFormat.ts       ← Video | Banner (CHỈ Zalo)
    ├── ZaloContent.ts         ← kiểu bản ghi Zalo (có content_format)
    ├── ZaloSyncProvider.ts    ← sync Sheet Zalo riêng (skeleton, TODO)
    ├── zaloWeeklyMetrics.ts   ← weekly Zalo riêng (skeleton, có KPI theo format)
    └── index.ts               ← zaloModule (hasContentFormat=true, sheet=ZALO_SHEET_ID)
sql/009_zalo_scaffold.sql      ← bảng zalo_contents riêng (chưa cần chạy ngay)
```

**Nguyên tắc:**
- Mọi công thức trạng thái đi qua interface `StatusRule`. Tầng dùng gọi `getPlatform(p).statusRule` → không phụ thuộc chi tiết nền tảng.
- `FacebookStatusRule` và `ZaloStatusRule` **độc lập hoàn toàn**, không dùng chung logic.
- Facebook: không content_format. Zalo: có content_format (Video/Banner).
- Facebook dùng Sheet `GOOGLE_SHEET_ID` (hiện tại); Zalo dùng Sheet RIÊNG `ZALO_SHEET_ID`.

## Vì sao Facebook KHÔNG đổi
- Dashboard/Weekly/PDF/Ads/Sync/API/SQL/KPI Facebook **không import** `src/platform/` → chạy y như cũ.
- `FacebookStatusRule` chỉ **sao chép** công thức của `server.ts` sang file mới cho tầng đa-nền-tảng; **không sửa** `server.ts`. (Nếu sau này được phép đổi rule FB thì cập nhật đồng bộ 2 nơi.)

## Cần gì để phát triển Zalo (phase sau)
1. Điền trạng thái thật + cách gom nhóm + "đã chạy"/"chốt không chạy" trong `ZaloStatusRule.ts`.
2. Đặt env `ZALO_SHEET_ID`; hoàn thiện mapping cột trong `ZaloSyncProvider.ts`.
3. Chạy `sql/009_zalo_scaffold.sql` (chỉnh cột cho khớp Sheet) để có bảng `zalo_contents`.
4. Xây route/dashboard Zalo dùng chung component UI, gọi `getPlatform('zalo')`.
5. Hoàn thiện KPI weekly Zalo trong `zaloWeeklyMetrics.ts` (gồm KPI theo Video/Banner).
