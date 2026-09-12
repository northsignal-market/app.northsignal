-- ================================================================
-- CICLO CERRADO: predicciones, calibracion, memoria semantica, briefing, ejecucion aprobada
-- ================================================================

-- ---- 1. PREDICCIONES: el semanal predice; el lunes siguiente se compara ----
create table if not exists predicciones (
  id bigserial primary key,
  account text not null,
  semana date not null,                         -- lunes de la semana predicha
  metrica text not null check (metrica in ('conversiones','cpa','gasto','conv_rate')),
  valor_min numeric not null, valor_max numeric not null,
  probabilidad numeric not null check (probabilidad between 0.5 and 0.99),
  razonamiento text,
  escrita_el timestamptz default now(), escrita_por text default 'opus-5-semanal',
  -- Se llena el lunes siguiente
  valor_real numeric, acerto boolean, evaluada_el timestamptz,
  unique (account, semana, metrica)
);
alter table predicciones enable row level security; revoke all on predicciones from anon, authenticated;
comment on table predicciones is 'El semanal predice la semana que empieza con rango y probabilidad. evaluar_predicciones() las compara el lunes siguiente. v_calibracion muestra si el 80% de confianza acierta el 80% de las veces.';

create or replace function evaluar_predicciones() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0; r record; v numeric;
begin
  for r in select * from predicciones where acerto is null and semana + 6 < current_date - 2 loop
    select case r.metrica when 'conversiones' then sum(conversiones) when 'gasto' then sum(gasto) when 'cpa' then sum(gasto) / nullif(sum(conversiones), 0) when 'conv_rate' then sum(conversiones) / nullif(sum(clics), 0) * 100 end
      into v from v_serie_diaria where account = r.account and date between r.semana and r.semana + 6;
    if v is not null then
      update predicciones set valor_real = round(v, 2), acerto = (v between r.valor_min and r.valor_max), evaluada_el = now() where id = r.id; n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace view v_calibracion as
with e as (select * from predicciones where acerto is not null)
select account, metrica, count(*) n, sum(case when acerto then 1 else 0 end) aciertos,
       round(avg(probabilidad) * 100) confianza_prometida_pct, round(avg(case when acerto then 1 else 0 end) * 100) acierto_real_pct,
       case when count(*) < 4 then 'Pocas predicciones todavía'
            when avg(case when acerto then 1 else 0 end) >= avg(probabilidad) - 0.1 then 'Calibrado: acierta lo que promete'
            when avg(case when acerto then 1 else 0 end) < avg(probabilidad) - 0.2 then 'Sobreconfiado: promete más de lo que acierta'
            else 'Ligeramente sobreconfiado' end as veredicto
from e group by account, metrica;
-- Global
create or replace view v_calibracion_global as
select count(*) n, sum(case when acerto then 1 else 0 end) aciertos, round(avg(probabilidad) * 100) prometido_pct, round(avg(case when acerto then 1 else 0 end) * 100) real_pct
from predicciones where acerto is not null;

-- ---- 2. MEMORIA SEMANTICA: pgvector ----
create extension if not exists vector with schema extensions;
create table if not exists memoria (
  id bigserial primary key,
  account text,
  tipo text not null check (tipo in ('reflexion','hallazgo','accionable','handoff','leccion')),
  fecha date not null,
  texto text not null,
  origen_id text,                                  -- id en la tabla de origen
  embedding extensions.vector(768),
  creado timestamptz default now(),
  unique (tipo, origen_id)
);
create index if not exists idx_memoria_acct on memoria (account, fecha desc);
alter table memoria enable row level security; revoke all on memoria from anon, authenticated;
comment on table memoria is 'Memoria semantica: reflexiones, hallazgos de pulsos, accionables, handoffs y lecciones con embedding (Gemini text-embedding, 768). parecido_a() busca por similitud. Es lo que convierte "conecta_con" en retrieval real.';

create or replace function parecido_a(p_embedding extensions.vector(768), p_account text default null, p_k int default 5, p_excluir_desde date default null) returns jsonb
language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'fecha', fecha, 'account', account, 'texto', left(texto, 400), 'similitud', round((1 - (embedding <=> p_embedding))::numeric, 3)) order by embedding <=> p_embedding), '[]')
  from (select * from memoria where embedding is not null and (p_account is null or account = p_account) and (p_excluir_desde is null or fecha < p_excluir_desde) order by embedding <=> p_embedding limit p_k) m;
$$;
-- Cola de textos sin embedding (el server los embebe)
create or replace view v_memoria_pendiente as select id, tipo, texto from memoria where embedding is null order by creado limit 50;
-- Ingesta: lo que hay que recordar, desde las tablas de origen
create or replace function memoria_ingestar() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0;
begin
  insert into memoria (account, tipo, fecha, texto, origen_id) select account, 'reflexion', run_date, que_haria_distinto, 'reflexion:' || id from reflexiones where que_haria_distinto is not null on conflict do nothing; get diagnostics n = row_count;
  insert into memoria (account, tipo, fecha, texto, origen_id) select account, 'hallazgo', fecha, coalesce(hallazgo_principal, '') || '. ' || left(resumen, 600), 'pulso:' || account || ':' || fecha from pulso_diario where hallazgo_principal is not null on conflict do nothing;
  insert into memoria (account, tipo, fecha, texto, origen_id) select account, 'accionable', coalesce(detectado, current_date), titulo || '. ' || coalesce(por_que, ''), 'accionable:' || notion_id from accionables_espejo where titulo <> '' on conflict do nothing;
  return n;
end $$;

-- ---- 3. BRIEFING MATINAL: que hay para vos hoy, en una llamada ----
create or replace function get_briefing() returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'fecha', current_date, 'es_lunes', extract(dow from current_date) = 1,
    'alertas_hoy', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'titulo', titulo, 'accion', accion)), '[]') from alertas where estado = 'abierta' and nivel = 'hoy'),
    'alertas_semana', (select count(*) from alertas where estado in ('abierta','vista') and nivel = 'semana'),
    'accionables_listos', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'titulo', titulo, 'prioridad', prioridad)), '[]') from accionables_espejo where estado = 'Propuesto' and reemplazado_por is null),
    'accionables_por_confirmar', (select count(*) from accionables_espejo where estado = 'Bloqueado' and reemplazado_por is null),
    'reportes_por_aprobar', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'periodo', periodo_desde || ' a ' || periodo_hasta)), '[]') from reportes_cliente where estado = 'borrador'),
    'pulsos_ayer', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'nivel', nivel, 'hallazgo', hallazgo_principal)), '[]') from pulso_diario where fecha = current_date - 1),
    'datos_al_dia', (select bool_and(coalesce(estado, 'OK') = 'OK') from v_data_health),
    'impactos_nuevos', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'titulo', titulo, 'veredicto', veredicto, 'variacion', variacion_pct)), '[]') from v_impacto_accionables where ejecutado_el = current_date - 14),
    'tickets_respondidos', (select count(*) from tickets where estado = 'resuelto' and resuelto_el >= now() - interval '1 day')
  );
$$;

-- ---- 4. EJECUCION APROBADA: negativas y pausas, nada mas ----
create table if not exists acciones_aprobadas (
  id bigserial primary key,
  account text not null, notion_id text,
  tipo text not null check (tipo in ('negativa_grupo','negativa_campana','pausar_keyword','pausar_anuncio')),
  campana text, grupo text, keyword text, match_type text default 'PHRASE', ad_id text,
  aprobada_el timestamptz default now(), aprobada_por text default 'andres',
  estado text not null default 'pendiente' check (estado in ('pendiente','simulada','ejecutada','fallida','revertida')),
  modo text not null default 'simular' check (modo in ('simular','ejecutar')),
  resultado text, ejecutada_el timestamptz,
  revertible boolean default true, revertida_el timestamptz
);
create index if not exists idx_acciones_pend on acciones_aprobadas (estado, account);
alter table acciones_aprobadas enable row level security; revoke all on acciones_aprobadas from anon, authenticated;
comment on table acciones_aprobadas is 'Lo que Andres aprobo con un clic para que el script ejecutor lo aplique en Google Ads. Solo negativas y pausas (reversibles). modo=simular escribe que haria sin tocar la cuenta; ejecutar aplica. Nunca presupuesto, puja ni conversiones.';
insert into escritores (entidad, dueno, proponen, leen, regla) values ('acciones_aprobadas', 'andres', '{}', '{ejecutor}', 'Solo Andres aprueba desde la app. El script ejecutor lee y aplica; escribe solo resultado y estado.') on conflict (entidad) do nothing;
-- Lo que el script lee: pendientes en formato plano
create or replace view v_acciones_pendientes as select id, account, tipo, campana, grupo, keyword, match_type, ad_id, modo from acciones_aprobadas where estado = 'pendiente' order by aprobada_el;

-- Cron: evaluar predicciones e ingestar memoria, lunes 09:05 UTC (antes de las tareas)
select cron.unschedule(jobid) from cron.job where jobname in ('evaluar_predicciones','memoria_ingestar');
select cron.schedule('evaluar_predicciones', '5 9 * * 1', $$select evaluar_predicciones()$$);
select cron.schedule('memoria_ingestar', '50 9 * * *', $$select memoria_ingestar()$$);
select memoria_ingestar() as ingestados_ahora;;
