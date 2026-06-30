-- Migration 006 — PHASE 7: mô hình LIFECYCLE + CURRENT STATUS cho Ads Monitor (ĐỘC LẬP).
-- KHÔNG đụng bảng Content. KHÔNG thêm cột vào ads_monitor. KHÔNG sửa Google Sheet.
-- Thay thuật toán trạng thái: KHÔNG còn chỉ dựa amount_spent.
--   * Lifecycle (NEW/TEST/MAINTAIN): theo TỔNG CHI TIÊU ĐỜI của content, chỉ NÂNG cấp (monotonic),
--     lưu ở bảng ads_monitor_lifecycle, chỉ cập nhật khi import/sync (KHÔNG tính lại mỗi lần mở dashboard).
--   * Trạng thái hiển thị: chi tiêu NGÀY MỚI NHẤT trong kỳ = 0 → "Đã tắt"; >0 → theo Lifecycle.
-- Chạy thủ công trong Supabase SQL Editor (như 001–005). Idempotent (chạy lại an toàn).
-- LƯU Ý THỨ TỰ TRIỂN KHAI: chạy migration này TRƯỚC khi deploy code app Phase 7.

-- ===================================================================
-- 1) BẢNG LIFECYCLE (1 dòng / content). Nội bộ — KHÔNG hiển thị trên dashboard.
-- ===================================================================
create table if not exists public.ads_monitor_lifecycle (
  page_code      text        not null,
  content        text        not null,
  lifecycle      text        not null default 'NEW',   -- NEW | TEST | MAINTAIN (chỉ nâng cấp)
  lifetime_spent bigint      not null default 0,         -- tổng chi tiêu đời (SUM mọi ngày)
  updated_at     timestamptz not null default now(),
  primary key (page_code, content)
);

-- ===================================================================
-- 2) REFRESH LIFECYCLE — tính tổng đời + nâng cấp MONOTONIC. Gọi SAU mỗi import/sync.
--    Ngưỡng: >3.000.000 → MAINTAIN · >100.000 → TEST · còn lại → NEW.
--    "lần đầu vượt 3tr → MAINTAIN" + "không bao giờ hạ cấp" được bảo đảm bằng ON CONFLICT (giữ hạng cao hơn).
-- ===================================================================
create or replace function public.ads_monitor_refresh_lifecycle() returns void
language sql
as $$
  insert into public.ads_monitor_lifecycle as t (page_code, content, lifecycle, lifetime_spent, updated_at)
  select page_code, content,
         case when s > 3000000 then 'MAINTAIN'
              when s > 100000  then 'TEST'
              else 'NEW' end,
         s, now()
  from (select page_code, content, sum(amount_spent) as s
        from public.ads_monitor
        group by page_code, content) agg
  on conflict (page_code, content) do update
    set lifetime_spent = excluded.lifetime_spent,
        updated_at     = now(),
        -- MONOTONIC: giữ hạng cao hơn giữa hạng cũ và hạng mới (không hạ cấp).
        lifecycle = case
          when t.lifecycle = 'MAINTAIN' or excluded.lifecycle = 'MAINTAIN' then 'MAINTAIN'
          when t.lifecycle = 'TEST'     or excluded.lifecycle = 'TEST'     then 'TEST'
          else 'NEW' end;
$$;

-- ===================================================================
-- 3) QUERY function (thay thế bản ở 005): trạng thái = chi tiêu ngày mới nhất + Lifecycle.
--    Trả thêm latest_amount + lifecycle (nội bộ) để tầng app tính trạng thái (KHÔNG hardcode).
--    "Tổng chi tiêu" (amount_spent) = SUM trong kỳ — KHÔNG quyết định trạng thái.
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
    with win as (
      -- dòng trong cửa sổ ngày + lọc dimension (dùng index).
      select page_code, content, location, ads_owner, amount_spent, sheet_date, updated_at, id
      from public.ads_monitor
      where ($1 is null or sheet_date >= $1)
        and ($2 is null or sheet_date <= $2)
        and ($3 is null or content   ilike '%%' || $3 || '%%')
        and ($4 is null or ads_owner = $4)
        and ($5 is null or location  = $5)
        and ($6 is null or page_code ilike '%%' || $6 || '%%')
    ),
    agg as (   -- Tổng chi tiêu trong kỳ (+ thuộc tính đại diện của content)
      select page_code, content,
             sum(amount_spent) as amount_spent,
             max(sheet_date)   as sheet_date,   -- ngày hoạt động gần nhất CỦA content (tham chiếu)
             max(location)     as location,
             max(ads_owner)    as ads_owner,
             max(updated_at)   as updated_at,
             min(id)           as id
      from win group by page_code, content
    ),
    latest as (   -- chi tiêu của NGÀY DỮ LIỆU MỚI NHẤT trong kỳ (global). Sheet bỏ qua ngày không chi
                  -- tiêu → content KHÔNG có dòng ngày này sẽ không xuất hiện ở đây → latest_amount=0 → Đã tắt.
      select page_code, content, sum(amount_spent) as latest_amount
      from win
      where sheet_date = (select max(sheet_date) from win)
      group by page_code, content
    ),
    dim as (
      select a.page_code, a.content, a.amount_spent, a.sheet_date,
             coalesce(l.latest_amount, 0) as latest_amount,   -- không có dòng ngày mới nhất → 0
             a.location, a.ads_owner, a.updated_at, a.id,
             coalesce(lc.lifecycle, 'NEW') as lifecycle        -- Lifecycle ĐỜI (độc lập kỳ lọc)
      from agg a
      left join latest l on l.page_code = a.page_code and l.content = a.content
      left join public.ads_monitor_lifecycle lc on lc.page_code = a.page_code and lc.content = a.content
    ),
    filtered as (
      select * from dim
      where ($7 is null or
        case $7
          when 'Đã tắt'       then latest_amount <= 0
          when 'Mới chạy'     then latest_amount > 0 and lifecycle = 'NEW'
          when 'Đang test'    then latest_amount > 0 and lifecycle = 'TEST'
          when 'Đang duy trì' then latest_amount > 0 and lifecycle = 'MAINTAIN'
          else true end)
    )
    select json_build_object(
      'kpi', (select json_build_object(
                'total',       count(*),
                'daTat',       count(*) filter (where latest_amount <= 0),
                'moiChay',     count(*) filter (where latest_amount > 0 and lifecycle = 'NEW'),
                'test',        count(*) filter (where latest_amount > 0 and lifecycle = 'TEST'),
                'duyTri',      count(*) filter (where latest_amount > 0 and lifecycle = 'MAINTAIN'),
                'totalAmount', coalesce(sum(amount_spent), 0)
              ) from dim),
      'total', (select count(*) from filtered),
      'items', (select coalesce(json_agg(row_to_json(p)), '[]'::json) from (
                  select id, content, location, ads_owner, page_code, amount_spent,
                         latest_amount, lifecycle, updated_at, sheet_date
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

-- ===================================================================
-- 4) BACKFILL: tính Lifecycle ngay từ lịch sử hiện có (Phase 7 §6 — không cần nhập tay).
-- ===================================================================
select public.ads_monitor_refresh_lifecycle();
