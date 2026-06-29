-- Migration 005 — Bảng ads_monitor (module Ads Monitor, ĐỘC LẬP) + lớp SQL tối ưu (PHASE 5).
-- KHÔNG sửa/đụng bất kỳ bảng nào đang có (contents, sync_logs, content_status_history).
-- LƯU Ý: cố ý KHÔNG có cột `status` — trạng thái LUÔN tính từ amount_spent
--        bằng calculateAdsStatus() ở tầng app / CASE WHEN ở SQL (không lưu cứng).
-- Chạy thủ công trong Supabase SQL Editor (như các migration 001–004). Bảng CHƯA tạo lần nào.
--
-- PHASE 5 — mô hình LƯU LỊCH SỬ THEO NGÀY (snapshot):
--   * Khóa tự nhiên = (page_code, content, sheet_date) → mỗi (quảng cáo × ngày) là 1 dòng.
--   * Import lại trong CÙNG ngày = idempotent (update đúng dòng ngày đó, không nhân đôi).
--   * Ngày KHÁC = dòng mới → GIỮ TOÀN BỘ lịch sử, KHÔNG ghi đè ngày trước.
--   * amount_spent mỗi dòng = chi tiêu/NGÀY của content (đã gộp bản sao). Lịch sử giữ theo ngày.
--   * Dashboard hiển thị chi tiêu TÍCH LŨY/ĐỜI = SUM(amount_spent) theo (page_code, content) qua mọi ngày
--     (VIEW ads_monitor_lifetime + function ads_monitor_query). Status tính trên tổng đời này.
--   * KPI/filter/phân trang tính TRỰC TIẾP bằng SQL trong function ads_monitor_query().

-- ===================================================================
-- 1) BẢNG
-- ===================================================================
create table if not exists public.ads_monitor (
  id            bigint generated always as identity primary key,
  content       text        not null,
  location      text,                                   -- 'TQ' | 'NN' (giá trị thô)
  ads_owner     text,
  page_code     text,
  amount_spent  bigint      not null default 0,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  sheet_date    date        not null default current_date  -- PHASE 5: ngày của snapshot (thành phần khóa)
);

-- ===================================================================
-- 2) INDEX (xem giải thích từng index trong PROJECT_SPEC §Ads / báo cáo Phase 5)
-- ===================================================================
-- (a) KHÓA SNAPSHOT THEO NGÀY — vừa bảo đảm import idempotent (ON CONFLICT),
--     vừa phục vụ DISTINCT ON (page_code, content) ORDER BY sheet_date DESC ở view "mới nhất".
create unique index if not exists ads_monitor_daily_key
  on public.ads_monitor (page_code, content, sheet_date desc);

-- (b) sheet_date — lọc theo ngày / khoảng ngày + truy vấn lịch sử "tính đến ngày".
create index if not exists ads_monitor_sheet_date_idx
  on public.ads_monitor (sheet_date);

-- (c) ads_owner — lọc theo "Nhân viên Ads" (cardinality trung bình–cao, lọc trước khi DISTINCT ON).
create index if not exists ads_monitor_owner_idx
  on public.ads_monitor (ads_owner);

-- KHÔNG tạo các index sau (cố ý tránh index dư thừa):
--   * page_code  → đã là CỘT DẪN ĐẦU của ads_monitor_daily_key (prefix dùng lại được).
--   * amount_spent → filter trạng thái áp trên tập "latest" (nhỏ) sau DISTINCT ON, không quét bảng gốc theo amount.
--   * location   → cardinality cực thấp (TQ/NN) → seq scan rẻ hơn index.
--   * content    → filter là ILIKE '%...%' (substring) nên btree vô dụng; nếu cần, dùng pg_trgm GIN sau.

-- ===================================================================
-- 3) VIEW "ĐỜI" — tổng chi tiêu TÍCH LŨY cho mỗi (page_code, content) qua mọi ngày.
-- ===================================================================
drop view if exists public.ads_monitor_latest;   -- bỏ view "mới nhất" cũ (đổi sang tích lũy)
create or replace view public.ads_monitor_lifetime as
  select page_code, content,
         max(location)     as location,
         max(ads_owner)    as ads_owner,
         sum(amount_spent) as amount_spent,    -- tổng chi tiêu đời
         max(sheet_date)   as sheet_date,      -- ngày hoạt động gần nhất
         max(updated_at)   as updated_at,
         min(id)           as id
  from public.ads_monitor
  group by page_code, content;

-- ===================================================================
-- 4) FUNCTION TỔNG HỢP — filter + phân trang + KPI, TẤT CẢ trong SQL.
--    Trả JSON: { kpi:{...}, total, items:[...] }.
--    * kpi   = COUNT/SUM/FILTER trên tập "latest" đã lọc theo dimension+ngày (KHÔNG lọc theo status)
--              → 6 thẻ KPI luôn hiển thị đầy đủ phân bố trong phạm vi lọc.
--    * total = số dòng khớp TẤT CẢ filter (gồm status) → dùng cho phân trang.
--    * items = đúng 1 trang (LIMIT/OFFSET) đã sort.
--    Ngưỡng status khớp calculateAdsStatus(): =0 Đã tắt · 1–100k Mới chạy · 100.001–4.999.999 Đang test · ≥5tr Đang duy trì.
-- ===================================================================
create or replace function public.ads_monitor_query(
  p_content    text default null,
  p_ads_owner  text default null,
  p_location   text default null,
  p_page_code  text default null,
  p_status     text default null,
  p_date_from  date default null,
  p_date_to    date default null,
  p_sort_field text default 'updated_at',
  p_sort_dir   text default 'desc',
  p_page       int  default 1,
  p_page_size  int  default 50
) returns json
language plpgsql
stable
as $fn$
declare
  v_size   int  := least(greatest(coalesce(p_page_size, 50), 1), 500);
  v_pg     int  := greatest(coalesce(p_page, 1), 1);
  v_offset int;
  v_order  text;
  v_sql    text;
  v_result json;
begin
  v_offset := (v_pg - 1) * v_size;

  -- Whitelist cột sort (chống SQL injection qua p_sort_field).
  v_order := case lower(coalesce(p_sort_field, 'updated_at'))
    when 'content'      then 'content'
    when 'ads_owner'    then 'ads_owner'
    when 'location'     then 'location'
    when 'page_code'    then 'page_code'
    when 'amount_spent' then 'amount_spent'
    when 'sheet_date'   then 'sheet_date'
    else 'updated_at' end;
  v_order := v_order || case when lower(coalesce(p_sort_dir, 'desc')) = 'asc' then ' asc' else ' desc' end;

  v_sql := format($q$
    with dim as (
      -- TÍCH LŨY/ĐỜI: tổng chi tiêu theo (page_code, content) qua mọi ngày trong cửa sổ lọc.
      -- (lọc dimension/ngày áp TRƯỚC khi gộp → dùng index; status áp SAU trên tổng đời.)
      select page_code, content,
             max(location)     as location,
             max(ads_owner)    as ads_owner,
             sum(amount_spent) as amount_spent,
             max(sheet_date)   as sheet_date,
             max(updated_at)   as updated_at,
             min(id)           as id
      from public.ads_monitor
      where ($1 is null or sheet_date >= $1)
        and ($2 is null or sheet_date <= $2)
        and ($3 is null or content   ilike '%%' || $3 || '%%')
        and ($4 is null or ads_owner = $4)
        and ($5 is null or location  = $5)
        and ($6 is null or page_code ilike '%%' || $6 || '%%')
      group by page_code, content
    ),
    filtered as (
      select * from dim
      where ($7 is null or
        case $7
          when 'Đã tắt'      then amount_spent <= 0
          when 'Mới chạy'    then amount_spent between 1 and 100000
          when 'Đang test'   then amount_spent between 100001 and 4999999
          when 'Đang duy trì' then amount_spent >= 5000000
          else true end)
    )
    select json_build_object(
      'kpi', (select json_build_object(
                'total',       count(*),
                'daTat',       count(*) filter (where amount_spent <= 0),
                'moiChay',     count(*) filter (where amount_spent between 1 and 100000),
                'test',        count(*) filter (where amount_spent between 100001 and 4999999),
                'duyTri',      count(*) filter (where amount_spent >= 5000000),
                'totalAmount', coalesce(sum(amount_spent), 0)
              ) from dim),
      'total', (select count(*) from filtered),
      'items', (select coalesce(json_agg(row_to_json(p)), '[]'::json) from (
                  select id, content, location, ads_owner, page_code, amount_spent, updated_at, sheet_date
                  from filtered
                  order by %s
                  limit %s offset %s
                ) p)
    )
  $q$, v_order, v_size, v_offset);

  execute v_sql
    into v_result
    using p_date_from, p_date_to, p_content, p_ads_owner, p_location, p_page_code, p_status;

  return v_result;
end
$fn$;
