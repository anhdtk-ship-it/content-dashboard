-- Migration 005 — Bảng ads_monitor (module Ads Monitor, ĐỘC LẬP).
-- KHÔNG sửa/đụng bất kỳ bảng nào đang có (contents, sync_logs, content_status_history).
-- LƯU Ý: cố ý KHÔNG có cột `status` — trạng thái LUÔN tính từ amount_spent
--        bằng calculateAdsStatus() ở tầng app (không lưu cứng).
-- Chạy thủ công trong Supabase SQL Editor (như các migration 001–004). PHASE 3 chưa bắt buộc áp dụng.

create table if not exists public.ads_monitor (
  id            bigint generated always as identity primary key,
  content       text        not null,
  location      text,                         -- 'TQ' | 'NN' (giá trị thô)
  ads_owner     text,
  page_code     text,
  amount_spent  bigint      not null default 0,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  sheet_date    date
);

create index if not exists ads_monitor_page_code_idx on public.ads_monitor (page_code);
create index if not exists ads_monitor_owner_idx     on public.ads_monitor (ads_owner);
create index if not exists ads_monitor_sheet_date_idx on public.ads_monitor (sheet_date);
