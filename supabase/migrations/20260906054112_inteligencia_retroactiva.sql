-- ================================================================
-- INTELIGENCIA RETROACTIVA
-- ================================================================
-- El sistema aprende de sus propios resultados sin intervencion manual.
-- Tres piezas, siguiendo el patron Reflexion (Princeton, 2023):
--   1. EVALUADOR: calcula el impacto real de cada accionable ejecutado
--   2. DIAGNOSTICO: cada corrida escribe que haria distinto (memoria episodica)
--   3. ACTUALIZACION: lo que se repite se convierte en regla; los parametros
--      estimados se reemplazan por los reales cuando hay datos
-- ================================================================

-- ---- 1. EVALUADOR: impacto real de accionables ----
-- Espejo de los accionables Hechos de Notion, con la metrica objetivo y las
-- entidades. Lo llena el cron leyendo Notion. Con esto el impacto se calcula
-- en SQL desde la capa diaria, no a mano en el prompt.
create table if not exists accionables_ejecutados (
  notion_id text primary key,
  account text not null,
  titulo text not null,
  ejecutado_el date not null,
  metrica_objetivo text,          -- 'cpa' | 'gasto' | 'conversiones' | 'ctr' | 'clics'
  direccion_esperada text,        -- 'baja' | 'sube'
  entidad_tipo text,              -- 'campaign' | 'ad_group' | 'keyword' | 'cuenta'
  entidad_nombre text,
  causa_raiz text,
  naturaleza text,
  sincronizado_el timestamptz default now()
);
alter table accionables_ejecutados enable row level security;
comment on table accionables_ejecutados is 'Espejo de accionables en estado Hecho con Ejecutado el, sincronizado desde Notion por el cron. Permite calcular impacto en SQL. metrica_objetivo y direccion_esperada se extraen del campo "Verificar el" del accionable.';

-- Impacto: 14 dias antes vs 14 dias despues, desde la capa diaria
create or replace view v_impacto_accionables as
with ventanas as (
  select a.*,
         a.ejecutado_el - 14 as antes_desde, a.ejecutado_el - 1 as antes_hasta,
         a.ejecutado_el + 1 as despues_desde, a.ejecutado_el + 14 as despues_hasta
  from accionables_ejecutados a
),
metricas as (
  select v.notion_id,
         -- ANTES
         (select round(sum(gasto),2) from v_serie_diaria s where s.account=v.account and s.date between v.antes_desde and v.antes_hasta) as gasto_antes,
         (select round(sum(conversiones),2) from v_serie_diaria s where s.account=v.account and s.date between v.antes_desde and v.antes_hasta) as conv_antes,
         (select round(avg(ctr),2) from v_serie_diaria s where s.account=v.account and s.date between v.antes_desde and v.antes_hasta) as ctr_antes,
         (select count(*) from v_serie_diaria s where s.account=v.account and s.date between v.antes_desde and v.antes_hasta) as dias_antes,
         -- DESPUES (solo consolidados: las conversiones provisionales no cuentan)
         (select round(sum(gasto),2) from v_serie_diaria s where s.account=v.account and s.date between v.despues_desde and v.despues_hasta and s.madurez='consolidado') as gasto_despues,
         (select round(sum(conversiones),2) from v_serie_diaria s where s.account=v.account and s.date between v.despues_desde and v.despues_hasta and s.madurez='consolidado') as conv_despues,
         (select round(avg(ctr),2) from v_serie_diaria s where s.account=v.account and s.date between v.despues_desde and v.despues_hasta and s.madurez='consolidado') as ctr_despues,
         (select count(*) from v_serie_diaria s where s.account=v.account and s.date between v.despues_desde and v.despues_hasta and s.madurez='consolidado') as dias_despues
  from ventanas v
)
select v.notion_id, v.account, v.titulo, v.ejecutado_el, v.metrica_objetivo, v.direccion_esperada, v.causa_raiz, v.naturaleza,
       m.dias_antes, m.dias_despues,
       m.gasto_antes, m.gasto_despues, m.conv_antes, m.conv_despues,
       round(m.gasto_antes / nullif(m.conv_antes,0), 2) as cpa_antes,
       round(m.gasto_despues / nullif(m.conv_despues,0), 2) as cpa_despues,
       m.ctr_antes, m.ctr_despues,
       -- Variacion de la metrica objetivo
       case v.metrica_objetivo
         when 'cpa' then round(((m.gasto_despues/nullif(m.conv_despues,0)) - (m.gasto_antes/nullif(m.conv_antes,0))) / nullif(m.gasto_antes/nullif(m.conv_antes,0),0) * 100, 1)
         when 'gasto' then round((m.gasto_despues - m.gasto_antes) / nullif(m.gasto_antes,0) * 100, 1)
         when 'conversiones' then round((m.conv_despues - m.conv_antes) / nullif(m.conv_antes,0) * 100, 1)
         when 'ctr' then round((m.ctr_despues - m.ctr_antes) / nullif(m.ctr_antes,0) * 100, 1)
       end as variacion_pct,
       -- Veredicto automatico
       case
         when m.dias_despues < 7 then 'PENDIENTE: menos de 7 dias consolidados despues'
         when v.metrica_objetivo is null then 'SIN METRICA: el accionable no declaro que medir'
         when v.direccion_esperada = 'baja' and (case v.metrica_objetivo
            when 'cpa' then (m.gasto_despues/nullif(m.conv_despues,0)) < (m.gasto_antes/nullif(m.conv_antes,0)) * 0.9
            when 'gasto' then m.gasto_despues < m.gasto_antes * 0.9 end) then 'FUNCIONO: bajo mas de 10%'
         when v.direccion_esperada = 'sube' and (case v.metrica_objetivo
            when 'conversiones' then m.conv_despues > m.conv_antes * 1.1
            when 'ctr' then m.ctr_despues > m.ctr_antes * 1.1 end) then 'FUNCIONO: subio mas de 10%'
         when abs(coalesce(case v.metrica_objetivo
            when 'cpa' then ((m.gasto_despues/nullif(m.conv_despues,0)) - (m.gasto_antes/nullif(m.conv_antes,0))) / nullif(m.gasto_antes/nullif(m.conv_antes,0),0)
            when 'gasto' then (m.gasto_despues - m.gasto_antes) / nullif(m.gasto_antes,0)
            when 'conversiones' then (m.conv_despues - m.conv_antes) / nullif(m.conv_antes,0)
            when 'ctr' then (m.ctr_despues - m.ctr_antes) / nullif(m.ctr_antes,0) end, 0)) < 0.1 then 'NEUTRO: menos de 10% de cambio'
         else 'EMPEORO: se movio en direccion contraria'
       end as veredicto
from ventanas v join metricas m on m.notion_id = v.notion_id;

comment on view v_impacto_accionables is 'Impacto real de cada accionable ejecutado: la metrica objetivo 14 dias antes vs 14 dias despues (solo dias consolidados). Veredicto automatico: FUNCIONO / NEUTRO / EMPEORO / PENDIENTE. Es la funcion de evaluacion del sistema: lo que dice si el analisis acierta. La tarea semanal lo copia a Resultado observado en Notion; no lo calcula.';


-- ---- 2. DIAGNOSTICO: memoria episodica de reflexiones ----
create table if not exists reflexiones (
  id bigserial primary key,
  account text not null,
  run_date date not null default current_date,
  tipo text not null check (tipo in ('regla_no_funciono','dato_faltante','herramienta_fallo','inferencia_incorrecta','acierto','otro')),
  que_paso text not null,           -- que ocurrio, en una linea
  que_haria_distinto text not null, -- la leccion, como regla
  regla_del_prompt text,            -- a que regla o paso del prompt se refiere, si aplica
  confianza text default 'media' check (confianza in ('baja','media','alta')),
  aplicada boolean default false,   -- si ya se incorporo al prompt
  created_at timestamptz default now()
);
create index if not exists idx_reflexiones_acct on reflexiones (account, run_date desc);
alter table reflexiones enable row level security;
comment on table reflexiones is 'Memoria episodica del patron Reflexion: cada corrida escribe que haria distinto. La tarea siguiente lee las ultimas 10 de su cuenta al inicio. Cuando una reflexion se repite en 2+ corridas, es una propuesta de cambio al prompt (v_reflexiones_recurrentes). aplicada=true cuando ya se incorporo.';

-- Reflexiones que se repiten = propuesta de cambio al prompt
create or replace view v_reflexiones_recurrentes as
select account, tipo,
       -- Agrupar por similitud: primeras 6 palabras de la leccion
       regexp_replace(lower(que_haria_distinto), '^((\S+\s+){0,5}\S+).*$', '\1') as clave,
       count(*) as veces, min(run_date) as primera_vez, max(run_date) as ultima_vez,
       (array_agg(que_haria_distinto order by run_date desc))[1] as leccion_mas_reciente,
       (array_agg(regla_del_prompt order by run_date desc))[1] as regla,
       bool_or(aplicada) as ya_aplicada
from reflexiones
group by account, tipo, regexp_replace(lower(que_haria_distinto), '^((\S+\s+){0,5}\S+).*$', '\1')
having count(*) >= 2 and not bool_or(aplicada)
order by veces desc, ultima_vez desc;

comment on view v_reflexiones_recurrentes is 'Reflexiones que aparecieron en 2 o mas corridas y aun no se aplicaron al prompt. Cada fila es una propuesta de cambio con evidencia. Cuando se incorpora, marcar aplicada=true en las filas de reflexiones.';


-- ---- 3. ACTUALIZACION: parametros estimados -> reales ----
-- Win rates de la escalera: cuando v_win_rates_reales tiene 10+ leads por
-- etapa, reemplaza el estimado. Sin intervencion.
create or replace function actualizar_win_rates() returns table(account text, etapa text, antes numeric, despues numeric)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  with reales as (
    select w.account, w.stage_order, w.win_rate_real
    from v_win_rates_reales w where w.win_rate_real is not null
  ),
  upd as (
    update funnel_stages f
    set win_rate_to_close = r.win_rate_real, win_rate_origen = 'calculado', actualizado = now()
    from reales r
    where f.account = r.account and f.stage_order = r.stage_order
      and (f.win_rate_origen <> 'calculado' or abs(f.win_rate_to_close - r.win_rate_real) > 0.05)
    returning f.account, f.stage_name, r.win_rate_real, f.win_rate_to_close
  )
  select upd.account, upd.stage_name, upd.win_rate_to_close, upd.win_rate_real from upd;
end $$;
comment on function actualizar_win_rates is 'Reemplaza los win rates estimados de funnel_stages por los reales de v_win_rates_reales cuando hay 10+ leads por etapa. Idempotente. Correr en el cron semanal. Devuelve que cambio.';

-- Eventos por etapa: contar automaticamente desde funnel_events
create or replace function actualizar_eventos_escalera() returns void
language sql security definer set search_path = public, pg_temp as $$
  update funnel_stages f set eventos_ultimos_30d = coalesce((
    select count(*) from funnel_events e
    where e.account = f.account and e.stage_order = f.stage_order and e.reached_at >= now() - interval '30 days'
  ), f.eventos_ultimos_30d)
  where exists (select 1 from funnel_events e where e.account = f.account);
$$;
comment on function actualizar_eventos_escalera is 'Recalcula eventos_ultimos_30d en funnel_stages desde funnel_events. Con esto listo_para_primaria se actualiza solo y la tarea semanal detecta cuando una etapa llega a 15 sin que nadie cuente a mano.';


-- ---- 4. TASA DE ACIERTO: la metrica del sistema entero ----
create or replace view v_tasa_acierto as
select account,
       count(*) as accionables_evaluados,
       count(*) filter (where veredicto like 'FUNCIONO%') as funcionaron,
       count(*) filter (where veredicto like 'NEUTRO%') as neutros,
       count(*) filter (where veredicto like 'EMPEORO%') as empeoraron,
       count(*) filter (where veredicto like 'PENDIENTE%') as pendientes,
       round(count(*) filter (where veredicto like 'FUNCIONO%')::numeric / nullif(count(*) filter (where veredicto not like 'PENDIENTE%' and veredicto not like 'SIN METRICA%'), 0) * 100, 1) as tasa_acierto_pct,
       -- Por naturaleza: las Observaciones deberian acertar mas que las Inferencias
       round(count(*) filter (where veredicto like 'FUNCIONO%' and naturaleza = 'Observacion')::numeric / nullif(count(*) filter (where naturaleza = 'Observacion' and veredicto not like 'PENDIENTE%'), 0) * 100, 1) as acierto_observaciones_pct,
       round(count(*) filter (where veredicto like 'FUNCIONO%' and naturaleza in ('Inferencia','Hipotesis'))::numeric / nullif(count(*) filter (where naturaleza in ('Inferencia','Hipotesis') and veredicto not like 'PENDIENTE%'), 0) * 100, 1) as acierto_inferencias_pct
from v_impacto_accionables group by account;

comment on view v_tasa_acierto is 'La metrica del sistema entero: de los accionables ejecutados, cuantos movieron la metrica en la direccion esperada. Si acierto_inferencias es mucho menor que acierto_observaciones, el sistema esta proponiendo demasiado sin evidencia. Si tasa_acierto baja entre meses, el analisis se degrada.';

select 'inteligencia retroactiva: 2 tablas, 4 vistas, 2 funciones' as ok;;
