-- Migration 012 (VERCEL MIGRATION): bảng sync_debounce — thay thế debounce in-memory
-- (SyncQueue.ts, setTimeout trong RAM) bằng debounce lưu ở Supabase, để webhook
-- Auto-Sync (Content + Zalo) hoạt động đúng trên serverless (Vercel) — mỗi request
-- có thể chạy trên instance khác nhau, không share RAM.
-- Chạy TAY trong Supabase SQL Editor. Idempotent (chạy lại an toàn).
-- KHÔNG đụng contents/platform_contents/ads_monitor/sync_logs.

create table if not exists public.sync_debounce (
  queue_key       text primary key,           -- 'content' | 'zalo'
  pending         boolean     not null default false, -- có tín hiệu chưa được xử lý
  running         boolean     not null default false, -- đang chạy Sync (mutex)
  first_signal_at timestamptz,                 -- mốc tín hiệu ĐẦU của chu kỳ hiện tại (cho Maximum Wait)
  last_signal_at  timestamptz,                 -- mốc tín hiệu GẦN NHẤT (cho Debounce)
  claimed_at      timestamptz,                 -- mốc claim quyền chạy (phát hiện "stuck" nếu treo quá lâu)
  last_result     jsonb,                       -- kết quả lần Sync gần nhất (SyncResult)
  last_run_at     timestamptz,
  updated_at      timestamptz not null default now()
);

insert into public.sync_debounce (queue_key) values ('content'), ('zalo')
  on conflict (queue_key) do nothing;

-- ENQUEUE — webhook gọi khi nhận tín hiệu "Sheet đã đổi". An toàn dù đang running hay không:
-- chỉ ghi nhận tín hiệu, KHÔNG tự chạy Sync ở đây.
create or replace function public.sync_enqueue(p_key text) returns void
language sql as $$
  update public.sync_debounce
     set pending = true,
         last_signal_at = now(),
         first_signal_at = coalesce(first_signal_at, now()),
         updated_at = now()
   where queue_key = p_key;
$$;

-- TICK CLAIM — gọi từ /api/cron/tick/* (cron ngoài, mỗi ~1 phút). Trả về row nếu claim
-- được quyền chạy Sync ngay bây giờ, NULL nếu chưa đủ điều kiện (chưa hết debounce/max-wait,
-- hoặc đang có 1 lần chạy khác). Xóa pending/first_signal_at NGAY khi claim (không phải lúc
-- finish) — để 1 tín hiệu đến giữa lúc đang chạy tự mở đúng 1 chu kỳ debounce MỚI, không bị
-- gộp nhầm hay bị "quên".
create or replace function public.sync_tick_claim(
  p_key text, p_debounce_ms integer, p_max_wait_ms integer, p_stuck_ms integer default 540000
) returns public.sync_debounce
language plpgsql as $$
declare v_row public.sync_debounce;
begin
  -- Tự phục hồi: 1 lần claim không bao giờ gọi finish (crash/timeout giữa chừng) sẽ tự nhả
  -- sau p_stuck_ms, tránh deadlock vĩnh viễn (running=true mãi mãi, không tick nào chạy được nữa).
  update public.sync_debounce
     set running = false, claimed_at = null, updated_at = now()
   where queue_key = p_key and running = true and claimed_at is not null
     and now() - claimed_at >= make_interval(secs => p_stuck_ms / 1000.0);

  -- Claim thật: chỉ khi hiện KHÔNG running, có pending, và đã hết debounce HOẶC đã chạm max-wait.
  update public.sync_debounce
     set running = true, pending = false, first_signal_at = null,
         claimed_at = now(), updated_at = now()
   where queue_key = p_key and running = false and pending = true
     and (
       now() - last_signal_at  >= make_interval(secs => p_debounce_ms  / 1000.0)
       or now() - first_signal_at >= make_interval(secs => p_max_wait_ms / 1000.0)
     )
   returning * into v_row;

  return v_row;
end; $$;

-- TICK FINISH — gọi sau khi Sync thật (runContentSync/runZaloSync) chạy xong (hoặc lỗi).
-- CHỈ đụng running/claimed_at/last_result/last_run_at — KHÔNG bao giờ đụng
-- pending/first_signal_at/last_signal_at (những cột đó đã được sync_tick_claim xử lý).
create or replace function public.sync_tick_finish(p_key text, p_result jsonb) returns void
language sql as $$
  update public.sync_debounce
     set running = false, claimed_at = null,
         last_result = p_result, last_run_at = now(), updated_at = now()
   where queue_key = p_key;
$$;

-- RLS: bật nhưng KHÔNG có policy nào cho anon/authenticated → chỉ service_role (server) truy
-- cập được, giống bảng users (migration 008). Các hàm RPC chạy qua service_role cũng không bị chặn.
alter table public.sync_debounce enable row level security;
