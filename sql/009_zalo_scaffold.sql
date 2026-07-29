-- ⛔ ĐÃ THAY THẾ BỞI sql/010_zalo.sql — KHÔNG CHẠY FILE NÀY.
--    (010 dùng bảng đa nền tảng platform_contents, không ràng buộc Video/Banner → mở rộng được.)
--
-- Migration 009 (PHASE 13 — SCAFFOLD Zalo). Bảng RIÊNG cho nền tảng Zalo.
-- ADDITIVE tuyệt đối: KHÔNG đụng bảng contents / ads_monitor / sync_logs / users của Facebook.
-- Chạy TAY trong Supabase SQL Editor KHI bắt đầu phát triển Zalo (chưa cần chạy ngay).
--
-- ⚠️ Đây là KHUNG MẪU — chỉnh cột cho khớp Google Sheet Zalo thực tế trước khi dùng.

create table if not exists public.zalo_contents (
  id               uuid primary key default gen_random_uuid(),
  content_code     text not null,
  assignee_name    text,
  content_format   text,                 -- 'Video' | 'Banner' (CHỈ Zalo; FB không có)
  current_status   text,                 -- trạng thái thô (ZaloStatusRule map nhóm)
  upload_date      text,
  upload_date_real date,
  test_date        text,
  test_date_real   date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (content_code, assignee_name)   -- TODO(Zalo): chốt khoá duy nhất theo nghiệp vụ
);

-- Ràng buộc giá trị content_format (nới/bỏ nếu Sheet có thêm định dạng).
alter table public.zalo_contents drop constraint if exists zalo_content_format_chk;
alter table public.zalo_contents add constraint zalo_content_format_chk
  check (content_format is null or content_format in ('Video', 'Banner'));

-- create index if not exists zalo_upload_idx on public.zalo_contents (upload_date_real);
