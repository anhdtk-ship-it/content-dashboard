-- Migration 007 (PHASE 12): mở rộng sync_logs cho auto-sync Content.
-- ADDITIVE — KHÔNG sửa cột cũ. Chạy TAY trong Supabase SQL Editor.
-- Bảng sync_logs thực tế đang có: id, started_at, finished_at,
-- rows_read, rows_inserted, rows_updated, status, error_message.
-- Thêm 4 cột phục vụ log giàu thông tin (nguồn, số giữ nguyên, số prune, thời lượng):

alter table sync_logs add column if not exists source         text default 'manual';
alter table sync_logs add column if not exists rows_unchanged integer;
alter table sync_logs add column if not exists rows_pruned    integer;
alter table sync_logs add column if not exists duration_ms    integer;

-- Ghi chú: ContentSyncService tự fallback về payload tối thiểu nếu 4 cột
-- này CHƯA tồn tại, nên app vẫn chạy trước khi migration được áp dụng —
-- nhưng khi đó source/duration sẽ KHÔNG được lưu. Áp dụng migration để log đầy đủ.
