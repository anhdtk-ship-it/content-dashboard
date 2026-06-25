-- Migration: bảng lưu log mỗi lần sync
-- Chạy trong Supabase SQL Editor.

create table if not exists sync_logs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null,
  finished_at  timestamptz not null,
  duration_ms  integer not null,
  rows_read    integer not null default 0,
  inserted     integer not null default 0,
  updated      integer not null default 0,
  errors       integer not null default 0,
  status       text not null,            -- 'success' | 'partial' | 'failed'
  detail       jsonb,                    -- thông tin lỗi/chi tiết
  created_at   timestamptz not null default now()
);
