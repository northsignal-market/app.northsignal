create or replace function get_view_data(
  p_view text, p_account text, p_from date default null, p_to date default null,
  p_search text default null, p_search_col text default null, p_filters jsonb default '[]'::jsonb,
  p_group_by text default null, p_order_by text default null, p_order_dir text default 'desc',
  p_limit int default 25, p_offset int default 0
) returns json
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare
  c_cost text; c_clicks text; c_impr text; c_conv text; c_lost_b text; c_lost_r text;
  c_date text := 'week_start';   -- columna de fecha: week_start en semanal, date en diaria
  v_where text := 'account = ' || quote_literal(p_account);
  v_group text := ''; v_select text := '*'; v_order text := ''; v_sel_tot text;
  f jsonb; col text; op text; val text;
  v_data json; v_total int; v_totals json;
begin
  if p_view not in ('v_campaign_analisis','v_adgroup_analisis','v_keywords_analisis',
                    'v_search_terms_analisis','v_conversiones_por_accion',
                    'v_ngrams_sin_conversion','v_fuzzy_negatives','v_tendencia_semanal',
                    'v_keywords_daily','v_search_terms_daily','v_keyword_tendencia',
                    'v_campaign_daily','v_adgroup_daily') then
    raise exception 'Vista no permitida: %', p_view;
  end if;

  case p_view
    when 'v_campaign_analisis' then
      c_cost:='cost'; c_clicks:='clicks'; c_impr:='impressions'; c_conv:='conversions';
      c_lost_b:='lost_is_budget'; c_lost_r:='lost_is_rank';
    when 'v_adgroup_analisis', 'v_keywords_analisis', 'v_search_terms_analisis' then
      c_cost:='cost'; c_clicks:='clicks'; c_impr:='impressions'; c_conv:='conversions';
    when 'v_tendencia_semanal' then
      c_cost:='gasto'; c_clicks:='clics'; c_impr:='impresiones'; c_conv:='conversiones';
      c_lost_b:='perdido_presupuesto'; c_lost_r:='perdido_ranking';
    when 'v_ngrams_sin_conversion' then c_cost:='costo_total'; c_clicks:='clics_totales';
    when 'v_fuzzy_negatives' then c_cost:='gasto_perdido'; c_clicks:='clicks';
    when 'v_conversiones_por_accion' then c_conv:='primarias';
    -- Capa diaria: la columna de fecha es date, no week_start
    when 'v_keywords_daily', 'v_search_terms_daily', 'v_adgroup_daily' then
      c_cost:='cost'; c_clicks:='clicks'; c_impr:='impressions'; c_conv:='conversions'; c_date:='date';
    when 'v_campaign_daily' then
      c_cost:='cost'; c_clicks:='clicks'; c_impr:='impressions'; c_conv:='conversions';
      c_lost_b:='lost_is_budget'; c_lost_r:='lost_is_rank'; c_date:='date';
    when 'v_keyword_tendencia' then
      c_cost:='gasto_total'; c_clicks:='clics_total'; c_conv:='conversiones_total'; c_date:=null;
  end case;

  if c_date is not null then
    if p_from is not null and p_to is not null then
      v_where := v_where || ' and ' || quote_ident(c_date) || ' between ' || quote_literal(p_from) || ' and ' || quote_literal(p_to);
    elsif p_from is not null then
      v_where := v_where || ' and ' || quote_ident(c_date) || ' = ' || quote_literal(p_from);
    end if;
  end if;

  if coalesce(p_search,'') <> '' and coalesce(p_search_col,'') <> '' then
    v_where := v_where || ' and ' || quote_ident(p_search_col) || ' ilike ' || quote_literal('%'||p_search||'%');
  end if;

  for f in select * from jsonb_array_elements(coalesce(p_filters,'[]'::jsonb)) loop
    col := f->>'col'; op := coalesce(f->>'op','eq'); val := f->>'val';
    if col is null or val is null then continue; end if;
    if not exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name=p_view and column_name=col) then continue; end if;
    v_where := v_where || ' and ' || quote_ident(col) ||
      case op when 'gt' then ' > ' when 'lt' then ' < ' when 'gte' then ' >= ' when 'lte' then ' <= '
              when 'neq' then ' <> ' when 'contains' then ' ilike ' else ' = ' end ||
      case when op = 'contains' then quote_literal('%'||val||'%') else quote_literal(val) end;
  end loop;

  if coalesce(p_group_by,'') <> '' then
    v_select := quote_ident(p_group_by);
    if c_cost is not null then v_select := v_select||', sum('||quote_ident(c_cost)||') as cost'; end if;
    if c_clicks is not null then v_select := v_select||', sum('||quote_ident(c_clicks)||') as clicks'; end if;
    if c_impr is not null then v_select := v_select||', sum('||quote_ident(c_impr)||') as impressions'; end if;
    if c_conv is not null then v_select := v_select||', sum('||quote_ident(c_conv)||') as conversions'; end if;
    if c_cost is not null and c_conv is not null then
      v_select := v_select||', round(sum('||quote_ident(c_cost)||')/nullif(sum('||quote_ident(c_conv)||'),0),2) as cpa'; end if;
    if c_clicks is not null and c_impr is not null then
      v_select := v_select||', round(sum('||quote_ident(c_clicks)||')::numeric/nullif(sum('||quote_ident(c_impr)||'),0)*100,2) as ctr'; end if;
    v_group := ' group by ' || quote_ident(p_group_by);
  end if;

  if coalesce(p_order_by,'') <> '' then
    v_order := ' order by ' || quote_ident(p_order_by) ||
               case when lower(p_order_dir)='asc' then ' asc' else ' desc' end || ' nulls last';
  end if;

  v_sel_tot := 'count(*) as filas';
  if c_cost is not null then v_sel_tot := v_sel_tot||', round(coalesce(sum('||quote_ident(c_cost)||'),0),2) as cost'; end if;
  if c_clicks is not null then v_sel_tot := v_sel_tot||', coalesce(sum('||quote_ident(c_clicks)||'),0) as clicks'; end if;
  if c_impr is not null then v_sel_tot := v_sel_tot||', coalesce(sum('||quote_ident(c_impr)||'),0) as impressions'; end if;
  if c_conv is not null then v_sel_tot := v_sel_tot||', round(coalesce(sum('||quote_ident(c_conv)||'),0),2) as conversions'; end if;
  if c_cost is not null and c_conv is not null then
    v_sel_tot := v_sel_tot||', round(sum('||quote_ident(c_cost)||')/nullif(sum('||quote_ident(c_conv)||'),0),2) as cpa'; end if;
  if c_clicks is not null and c_impr is not null then
    v_sel_tot := v_sel_tot||', round(sum('||quote_ident(c_clicks)||')::numeric/nullif(sum('||quote_ident(c_impr)||'),0)*100,2) as ctr'; end if;
  if c_cost is not null and c_clicks is not null then
    v_sel_tot := v_sel_tot||', round(sum('||quote_ident(c_cost)||')/nullif(sum('||quote_ident(c_clicks)||'),0),2) as avg_cpc'; end if;
  if c_lost_b is not null then
    v_sel_tot := v_sel_tot||', case when sum(coalesce('||quote_ident(c_lost_b)||',0)) > sum(coalesce('||quote_ident(c_lost_r)||',0)) then ''presupuesto'' else ''ranking'' end as limitacion';
  else
    v_sel_tot := v_sel_tot||', null::text as limitacion';
  end if;

  execute 'select row_to_json(t) from (select '||v_sel_tot||' from '||quote_ident(p_view)||' where '||v_where||') t' into v_totals;

  if v_group <> '' then
    execute 'select count(*) from (select 1 from '||quote_ident(p_view)||' where '||v_where||v_group||') s' into v_total;
  else
    execute 'select count(*) from '||quote_ident(p_view)||' where '||v_where into v_total;
  end if;

  execute 'select coalesce(json_agg(row_to_json(t)), ''[]''::json) from (select '||v_select||' from '||quote_ident(p_view)||
          ' where '||v_where||v_group||v_order||' limit '||greatest(p_limit,1)||' offset '||greatest(p_offset,0)||') t' into v_data;

  return json_build_object('data', v_data, 'total', v_total, 'totals', v_totals);
end;
$$;;
