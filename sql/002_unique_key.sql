-- Migration: áp khóa duy nhất nghiệp vụ cho bảng contents
-- Khóa: (content_code, market, assignee_name)
-- Chạy trong Supabase SQL Editor.

-- 1) Dọn trùng lặp hiện có (nếu có): giữ lại 1 dòng cho mỗi bộ khóa.
--    Dùng ctid (định danh dòng vật lý của Postgres) để chọn dòng giữ lại.
delete from contents a
using contents b
where a.ctid < b.ctid
  and a.content_code = b.content_code
  and coalesce(a.market, '')        = coalesce(b.market, '')
  and coalesce(a.assignee_name, '') = coalesce(b.assignee_name, '');

-- 2) Áp ràng buộc UNIQUE để phục vụ upsert onConflict.
alter table contents
  drop constraint if exists contents_code_market_assignee_key;

alter table contents
  add constraint contents_code_market_assignee_key
  unique (content_code, market, assignee_name);

-- Sau migration này có thể dùng:
--   supabase.from('contents').upsert(record,
--     { onConflict: 'content_code,market,assignee_name' })
