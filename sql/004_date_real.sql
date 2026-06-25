-- Migration: thêm cột ngày kiểu DATE, suy ra từ upload_date/test_date (TEXT).
-- KHÔNG đụng vào upload_date / test_date gốc (vẫn giữ TEXT, không mất dữ liệu).
-- Chạy trong Supabase SQL Editor.

ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS upload_date_real DATE;

ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS test_date_real DATE;
