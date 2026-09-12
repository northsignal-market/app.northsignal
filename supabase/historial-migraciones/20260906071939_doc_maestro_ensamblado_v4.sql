create table if not exists doc_maestro_humano (
  id bigserial primary key, account text not null, seccion text not null, orden int not null default 0,
  contenido text not null, version int not null default 1, vigente boolean not null default true,
  editado_por text default 'andres', editado_el timestamptz default now(), unique (account, seccion, version)
);
create index if not exists idx_doc_humano_vigente on doc_maestro_humano (account, vigente, orden);
alter table doc_maestro_humano enable row level security;
revoke all on doc_maestro_humano from anon;
comment on table doc_maestro_humano is 'Capa humana del doc maestro: lo que solo Andres sabe. Cada edicion crea una version nueva. Nunca se borra.';

create or replace function doc_maestro_editar(p_account text, p_seccion text, p_contenido text, p_editado_por text default 'andres')
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ver int; v_orden int;
begin
  select coalesce(max(version), 0) + 1, coalesce(max(orden), 0) into v_ver, v_orden from doc_maestro_humano where account = p_account and seccion = p_seccion;
  update doc_maestro_humano set vigente = false where account = p_account and seccion = p_seccion and vigente;
  insert into doc_maestro_humano (account, seccion, orden, contenido, version, editado_por) values (p_account, p_seccion, v_orden, p_contenido, v_ver, p_editado_por);
  return v_ver;
end $$;
revoke execute on function doc_maestro_editar from anon, authenticated, public;

create or replace function doc_serie_cpa(p_account text, p_semanas int default 12) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  with s as (select date_trunc('week', date)::date as lunes, sum(gasto) g, sum(conversiones) c, bool_or(madurez <> 'consolidado') as parcial
             from v_serie_diaria where account = p_account group by 1 order by 1 desc limit p_semanas)
  select '| Semana del | CPA | Conversiones | Gasto | |' || E'\n|---|---|---|---|---|\n' ||
         string_agg(format('| %s | %s | %s | %s | %s |', lunes, case when c > 0 then round(g / c, 2)::text else '—' end, round(c, 1)::text, round(g, 2)::text, case when parcial then 'parcial' else '' end), E'\n' order by lunes desc)
  from s;
$$;

create or replace function doc_estado_conversiones(p_account text) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  with ult as (select max(snapshot_date) d from config_snapshot where account = p_account and entity_type = 'conversion_action')
  select 'Foto del ' || (select d from ult)::text || E':\n\n| Acción | Primaria | Recuento | Valor | Modelo |\n|---|---|---|---|---|\n' ||
         string_agg(format('| %s | %s | %s | %s | %s |', entity_name, case when (config->>'primary_for_goal')::boolean then '**SÍ**' else 'no' end,
           coalesce(config->>'counting_type', '—'), coalesce(config->>'default_value', '—'), coalesce(config->>'attribution_model', '—')), E'\n' order by (config->>'primary_for_goal')::boolean desc, entity_name)
  from config_snapshot where account = p_account and entity_type = 'conversion_action' and snapshot_date = (select d from ult) and config->>'status' = 'ENABLED';
$$;

create or replace function doc_umbrales(p_account text) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  select format(E'**Objetivos (origen: %s):** %s conversiones/mes, CPA máximo %s, presupuesto máximo %s/mes, ciclo de venta %s días. %s\n\n**Anomalías:** desvío estadístico contra la media móvil de 7 días (`v_anomalias_diarias`): crítica si z ≥ 3, alta si z ≥ 2,5, media si z ≥ 2. Días provisionales se ignoran. La explicación considera la hora del primer cambio.\n\n**Alertas fijas:** cambio auto-aplicado por Google (ALTA siempre), conversión primaria sin datos (ALTA), keyword con más de %s sin conversiones en 7 días.',
    coalesce(t.cpa_maximo_origen, 'sin origen'), coalesce(t.conversiones_mes_objetivo::text, '—'), coalesce(t.cpa_maximo::text, '—'), coalesce(t.presupuesto_mes_maximo::text, '—'), coalesce(t.ciclo_venta_dias::text, '—'),
    case when t.cpa_maximo_origen = 'historico' then '⚠ Provisionales: derivados del histórico, no confirmados con el cliente.' else 'Confirmados con el cliente.' end,
    case p_account when 'KAREDO' then '60 EUR' when 'BHI' then '40.000 CLP' else '30.000 CLP' end)
  from account_targets t where t.account = p_account;
$$;

create or replace function doc_cronologia(p_account text, p_dias int default 60) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  with ev as (
    select fecha as f, 'Andrés: ' || left(que_cambio, 160) || coalesce(' (' || donde || ')', '') as txt from operator_log where account = p_account and fecha >= current_date - p_dias
    union all
    select substring(change_datetime from 1 for 10)::date,
           'Google Ads: ' || coalesce(entity_name, resource_type) || ' · ' || coalesce(changed_field, operation) || coalesce(': ' || left(old_value, 30) || ' → ' || left(new_value, 30), '') ||
           case when client_type like '%RECOMMENDATION%' then ' **[AUTO]**' else '' end
    from change_events where account = p_account and substring(change_datetime from 1 for 10)::date >= current_date - p_dias
  )
  select string_agg(format('**%s** — %s', f, txt), E'\n' order by f desc) from (select * from ev order by f desc limit 40) x;
$$;

create table if not exists doc_maestro_consolidado (account text primary key, aprendizajes text, hipotesis_abiertas text, pendientes text, sincronizado_el timestamptz default now());
alter table doc_maestro_consolidado enable row level security;
revoke all on doc_maestro_consolidado from anon;

create or replace function get_doc_maestro(p_account text) returns text
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare v text := ''; r record; c record;
begin
  v := format(E'# DOC MAESTRO — %s\n\n**Ensamblado:** %s · Capa humana editada por Andrés; series, umbrales, estado de conversiones y cronología calculados desde Supabase; aprendizajes y pendientes desde Notion.\n\n', p_account, to_char(now(), 'DD Mon YYYY HH24:MI'));
  v := v || E'## DÓNDE VIVE CADA COSA\n\n| Dato | Fuente |\n|---|---|\n| Campañas, grupos, keywords, negativas, estados | `get_entidades()`, `keywords`, `negatives`, `account_state` |\n| Acciones de conversión y cuáles son primarias | `config_snapshot` (foto diaria) y `v_cambios_detectados` |\n| Cambios aplicados | `v_todos_los_cambios` (Google + snapshot + operador) |\n| Impacto de lo ejecutado | `v_impacto_accionables` |\n| Este documento | `get_doc_maestro()`; Drive es export |\n\nSi la capa humana contradice a Supabase, gana Supabase y hay que corregir la capa humana.\n\n---\n\n';
  for r in select seccion, contenido from doc_maestro_humano where account = p_account and vigente order by orden loop
    v := v || r.contenido || E'\n\n---\n\n';
  end loop;
  v := v || E'## SERIE SEMANAL DE CPA (calculada)\n\n' || coalesce(doc_serie_cpa(p_account), '_sin datos_') || E'\n\n---\n\n';
  v := v || E'## ESTADO DE CONVERSIONES (calculado)\n\n' || coalesce(doc_estado_conversiones(p_account), '_sin snapshot_') || E'\n\n---\n\n';
  v := v || E'## OBJETIVOS Y UMBRALES (calculados)\n\n' || coalesce(doc_umbrales(p_account), '_sin account_targets_') || E'\n\n---\n\n';
  select * into c from doc_maestro_consolidado where account = p_account;
  v := v || E'## APRENDIZAJES CONSOLIDADOS (desde Notion)\n\n' || coalesce(c.aprendizajes, '_sin sincronizar_') || E'\n\n';
  v := v || E'## HIPÓTESIS ABIERTAS (desde Notion)\n\n' || coalesce(c.hipotesis_abiertas, '_ninguna_') || E'\n\n';
  v := v || E'## PENDIENTES BLOQUEADOS (desde Notion)\n\n' || coalesce(c.pendientes, '_ninguno_') || E'\n\n---\n\n';
  v := v || E'## CRONOLOGÍA · últimos 60 días (calculada)\n\n' || coalesce(doc_cronologia(p_account), '_sin eventos_') || E'\n';
  return v;
end $$;
revoke execute on function get_doc_maestro from anon;
comment on function get_doc_maestro is 'Doc maestro ensamblado: capa humana (editable, versionada) + calculadas (SQL, sin LLM) + consolidada (espejo de Notion). La tarea semanal lee esto. Tamano acotado.';
select 'ok';;
