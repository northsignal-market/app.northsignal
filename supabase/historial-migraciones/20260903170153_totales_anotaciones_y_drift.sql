-- 1. Agregados calculados en la base, no trayendo filas a Node.
-- PostgREST corta en 1000 filas por defecto, asi que sumar del lado del
-- cliente da totales silenciosamente incorrectos apenas crece el dataset.
create or replace function get_view_totals(
  p_view text,
  p_account text,
  p_week date default null
) returns json
language plpgsql
stable
as $$
declare
  v_sql text;
  v_result json;
begin
  if p_view not in ('v_campaign_analisis','v_adgroup_analisis','v_keywords_analisis',
                    'v_search_terms_analisis','v_conversiones_por_accion',
                    'v_ngrams_sin_conversion','v_fuzzy_negatives') then
    raise exception 'Vista no permitida: %', p_view;
  end if;

  if p_view in ('v_ngrams_sin_conversion','v_fuzzy_negatives','v_conversiones_por_accion') then
    v_sql := format(
      'select json_build_object(''filas'', count(*)) from %I where account = $1 %s',
      p_view,
      case when p_week is null then '' else 'and week_start = $2' end);
  else
    v_sql := format(
      'select json_build_object(
         ''filas'', count(*),
         ''cost'', round(coalesce(sum(cost),0), 2),
         ''clicks'', coalesce(sum(clicks),0),
         ''impressions'', coalesce(sum(impressions),0),
         ''conversions'', round(coalesce(sum(conversions),0), 2),
         ''cpa'', round(coalesce(sum(cost) / nullif(sum(conversions),0), 0), 2),
         ''ctr'', round(coalesce(sum(clicks)::numeric / nullif(sum(impressions),0) * 100, 0), 2),
         ''avg_cpc'', round(coalesce(sum(cost) / nullif(sum(clicks),0), 0), 2)
       ) from %I where account = $1 %s',
      p_view,
      case when p_week is null then '' else 'and week_start = $2' end);
  end if;

  if p_week is null then
    execute v_sql into v_result using p_account;
  else
    execute v_sql into v_result using p_account, p_week;
  end if;

  return v_result;
end;
$$;

comment on function get_view_totals(text, text, date) is 'Agregados del conjunto completo calculados en Postgres. CPA se calcula como gasto total sobre conversiones totales y CTR como clics sobre impresiones, nunca como promedio de los valores por fila, que da un numero incorrecto.';


-- 2. Cambios agrupados por dia, para superponer sobre las series temporales.
-- Responde la pregunta que un analista se hace siempre frente a un movimiento:
-- esto lo causo un cambio mio o es del mercado.
create or replace view v_change_annotations as
select
  account,
  substring(change_datetime from 1 for 10) as fecha,
  count(*)                                  as cantidad_cambios,
  bool_or(client_type like '%RECOMMENDATION%') as incluye_auto_google,
  string_agg(distinct resource_type, ', ')  as recursos_tocados,
  string_agg(distinct changed_field, ', ')  as campos_tocados
from change_events
where change_datetime is not null
group by account, substring(change_datetime from 1 for 10);

comment on view v_change_annotations is 'Cambios por dia y cuenta, para dibujar marcadores sobre los graficos de tendencia. incluye_auto_google marca los dias en que Google aplico algo por su cuenta: esos siempre requieren revision.';


-- 3. Anotaciones manuales del analista.
-- Contexto que ninguna API expone: cambios de landing, campanas del cliente,
-- feriados, eventos del sector.
create table if not exists annotations (
  id bigserial primary key,
  account text not null,
  fecha date not null,
  titulo text not null,
  detalle text,
  tipo text default 'nota' check (tipo in ('nota','cambio_externo','estacionalidad','incidente','hipotesis')),
  creado_por text,
  created_at timestamptz default now()
);
create index if not exists idx_annotations_acct on annotations (account, fecha);
alter table annotations enable row level security;

comment on table annotations is 'Notas del analista ancladas a una fecha y cuenta. Sirven para registrar contexto que no vive en ninguna API: cambio de landing, campana del cliente en otro canal, feriado local, incidente de tracking. Se superponen sobre los graficos junto con los cambios de plataforma.';;
