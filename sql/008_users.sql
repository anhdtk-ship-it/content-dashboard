-- Migration 008 (AUTH): bảng users cho Authentication/Authorization Dashboard.
-- Chạy TAY trong Supabase SQL Editor. Idempotent (chạy lại an toàn).
-- Chỉ bổ sung Auth — KHÔNG đụng contents/ads_monitor/sync_logs.

create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  email       text        not null unique,   -- email đăng nhập Google (@seryn.vn)
  full_name   text,
  role        text        not null default 'viewer',  -- LƯU để dùng sau (Phase này CHƯA phân quyền theo role)
  is_active   boolean     not null default true,       -- false → chặn truy cập
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Chuẩn hoá email chữ thường để so khớp chắc chắn (server cũng lower()).
create unique index if not exists users_email_lower_idx on public.users (lower(email));

-- Tự cập nhật updated_at khi UPDATE.
create or replace function public.users_set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before update on public.users
  for each row execute function public.users_set_updated_at();

-- RLS: bật + KHÔNG policy → chỉ service_role (server) đọc/ghi được; anon/authenticated bị chặn.
alter table public.users enable row level security;

-- ------------------------------------------------------------------
-- THÊM USER ĐẦU TIÊN (đổi email/tên rồi chạy — xem PROJECT_SPEC/hướng dẫn):
-- insert into public.users (email, full_name, role, is_active)
-- values ('admin@seryn.vn', 'Quản trị', 'admin', true)
-- on conflict (email) do update set is_active = true, full_name = excluded.full_name, role = excluded.role;
-- ------------------------------------------------------------------
