-- ============================================================
-- Migration 011 (ZALO-04) — thêm cột `title` (Tên Content) cho platform_contents.
-- ADDITIVE. KHÔNG đụng Facebook (bảng contents riêng). Chạy TAY trong Supabase SQL Editor.
-- ============================================================
alter table public.platform_contents add column if not exists title text;

-- Cấu hình mặc định cho Zalo (Leader chỉnh sau qua Dashboard; KHÔNG hardcode trong code).
insert into public.platform_settings (platform, key, value) values
  ('zalo', 'test_warning_days', '5'),
  ('zalo', 'warning_threshold', '3')
on conflict (platform, key) do nothing;
-- Mục tiêu định dạng (ví dụ — Leader tự đặt):
--   insert into public.platform_settings values ('zalo','target:Video','40',now());
--   insert into public.platform_settings values ('zalo','target:Banner','30',now());
