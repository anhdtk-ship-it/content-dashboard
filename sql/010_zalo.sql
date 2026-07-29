-- ============================================================
-- Migration 010 — MODULE ZALO (đa nền tảng, ĐỘC LẬP Facebook).
-- ------------------------------------------------------------
-- ADDITIVE tuyệt đối. KHÔNG đụng bảng Facebook: contents / sync_logs / ads_* / users.
-- Chạy TAY trong Supabase SQL Editor (PostgREST không chạy được DDL).
--
-- THIẾT KẾ ĐA NỀN TẢNG (spec ZALO-01 #10 — dễ thêm TikTok…):
--   Mọi nền tảng NGOÀI Facebook dùng chung 3 bảng, phân biệt bằng cột `platform`.
--   Facebook GIỮ NGUYÊN bảng `contents` riêng → không ảnh hưởng.
--   Thêm nền tảng mới = chèn dữ liệu với platform mới, KHÔNG cần đổi schema.
--
-- (Thay thế bản nháp sql/009_zalo_scaffold.sql — KHÔNG chạy 009 nữa.)
-- ============================================================

-- 1) Content đa nền tảng (Zalo hiện tại; TikTok/khác về sau) --------------------
create table if not exists public.platform_contents (
  id               uuid primary key default gen_random_uuid(),
  platform         text not null,                 -- 'zalo' | 'tiktok' | …  (KHÔNG dùng 'facebook')
  content_code     text not null,
  assignee_name    text not null default '',
  content_format   text,                          -- 'Video' | 'Banner' | … TỰ DO (không ràng buộc → mở rộng)
  current_status   text,                          -- trạng thái thô (StatusRule của nền tảng map nhóm)
  upload_date      text,                          -- chuỗi gốc trên Sheet (dd/mm)
  upload_date_real date,                          -- đã parse
  test_date        text,
  test_date_real   date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (platform, content_code, assignee_name)  -- khoá đồng bộ (upsert theo bộ này)
);

create index if not exists platform_contents_platform_idx on public.platform_contents (platform);
create index if not exists platform_contents_upload_idx    on public.platform_contents (platform, upload_date_real);
create index if not exists platform_contents_format_idx    on public.platform_contents (platform, content_format);

-- 2) Cấu hình theo nền tảng (mục tiêu, cảnh báo…) — Leader sửa KHÔNG cần đổi code -
create table if not exists public.platform_settings (
  platform    text not null,
  key         text not null,   -- 'test_warning_days' | 'target:Video' | 'target:Banner' | 'target:<Định dạng>'
  value       text not null,
  updated_at  timestamptz not null default now(),
  primary key (platform, key)
);

-- Giá trị nền tảng mặc định cho Zalo (chỉ ngưỡng cảnh báo — KHÔNG hardcode định dạng nào).
insert into public.platform_settings (platform, key, value) values
  ('zalo', 'test_warning_days', '5')
on conflict (platform, key) do nothing;
-- Mục tiêu theo định dạng do Leader tự đặt, ví dụ:
--   insert into public.platform_settings values ('zalo','target:Video','40',now());
--   insert into public.platform_settings values ('zalo','target:Banner','60',now());
--   (Định dạng mới, ví dụ TikTok: insert ('zalo','target:TikTok','20') — Dashboard tự hiện.)

-- 3) Log đồng bộ theo nền tảng (Queue/Sync riêng) --------------------------------
create table if not exists public.platform_sync_logs (
  id             bigint generated always as identity primary key,
  platform       text not null,
  source         text,                 -- 'manual-cli' | 'webhook' | 'scheduler'
  started_at     timestamptz,
  finished_at    timestamptz,
  rows_read      integer,
  rows_inserted  integer,
  rows_updated   integer,
  rows_unchanged integer,
  rows_pruned    integer,
  duration_ms    integer,
  status         text,                 -- 'success' | 'partial' | 'failed'
  error_message  text,
  created_at     timestamptz not null default now()
);
create index if not exists platform_sync_logs_platform_idx on public.platform_sync_logs (platform, id desc);

-- 4) RLS: bật + KHÓA hoàn toàn (chỉ service_role của backend truy cập; giống bảng FB) --
alter table public.platform_contents  enable row level security;
alter table public.platform_settings  enable row level security;
alter table public.platform_sync_logs enable row level security;
-- Không tạo policy cho anon/authenticated → mọi truy cập public bị chặn; backend dùng service_role (bypass RLS).
