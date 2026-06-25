-- Migration: khớp bảng contents với 9 trường import từ Google Sheet
-- Chạy trong Supabase SQL Editor.

-- 1) Đổi upload_date sang text để giữ nguyên giá trị gốc dạng "dd/mm" (thiếu năm).
alter table contents
  alter column upload_date type text using upload_date::text;

-- 2) Thêm cột test_date (text) còn thiếu.
alter table contents
  add column if not exists test_date text;

-- (Tuỳ chọn) nếu sau này muốn truy vấn nhanh theo content_code:
-- create index if not exists idx_contents_content_code on contents (content_code);
