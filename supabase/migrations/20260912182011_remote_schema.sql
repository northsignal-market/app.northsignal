


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE TYPE "public"."plataforma_pub" AS ENUM (
    'google',
    'meta'
);


ALTER TYPE "public"."plataforma_pub" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accion_encolar_valida"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare cap record;
begin
  select * into cap from capacidades_ejecucion where verbo = new.tipo;
  if cap.verbo is null and new.tipo not in ('negativa_campana','negativa_grupo') then
    raise exception 'Verbo desconocido: %. Los verbos validos estan en capacidades_ejecucion', new.tipo;
  end if;
  if cap.verbo is not null and not cap.ejecutable then
    raise exception 'El verbo % no lo puede ejecutar un script: %', new.tipo, cap.por_que_no;
  end if;
  if new.tipo in ('cambiar_presupuesto','cambiar_objetivo_puja','cambiar_cpc_keyword') and new.valor_actual is null then
    raise exception 'La accion % necesita valor_actual: sin el valor anterior el cambio no se puede revertir', new.tipo;
  end if;
  if new.tipo = 'cambiar_estrategia_puja' and coalesce(new.estrategia_destino, '') = '' then
    raise exception 'cambiar_estrategia_puja necesita estrategia_destino';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."accion_encolar_valida"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accionable_existente"("p_account" "text", "p_entidad" "text", "p_causa" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select notion_id from accionables_espejo where account = p_account and estado in ('Propuesto','Bloqueado','En curso') and reemplazado_por is null
    and ((entidad_especifica(p_entidad) and normalizar_entidad(entidad) = normalizar_entidad(p_entidad))
         or (p_causa is not null and causa_raiz is not null and length(p_causa) > 20 and extensions.similarity(normalizar_entidad(causa_raiz), normalizar_entidad(p_causa)) > 0.6))
  order by detectado desc limit 1;
$$;


ALTER FUNCTION "public"."accionable_existente"("p_account" "text", "p_entidad" "text", "p_causa" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accionables_vigentes"("p_account" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object('id', notion_id, 'titulo', titulo, 'estado', estado, 'origen', origen, 'entidad', entidad, 'causa_raiz', causa_raiz, 'detectado', detectado, 'vence', vence, 'version', version, 'accion', accion, 'accion_valida', accion_valida) order by detectado desc), '[]')
  from accionables_espejo where account = p_account and estado in ('Propuesto','Bloqueado','En curso') and reemplazado_por is null;
$$;


ALTER FUNCTION "public"."accionables_vigentes"("p_account" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actor_desde_prefijo"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select case
    when p is null or p = 'notion' or p = 'reciente' or p = 'desconocido' then 'semanal'
    when upper(p) like 'ANDRES%' or upper(p) like 'APP%' then 'andres'
    when upper(p) like 'TAREA SEMANAL%' or upper(p) like 'SEMANAL%' or p = 'v' or upper(p) like 'OPUS-5-SEMANAL%' then 'semanal'
    when upper(p) like 'PULSO%' then 'pulso'
    when upper(p) like 'MENSUAL%' or upper(p) like 'REVISION MENSUAL%' or upper(p) like 'OPUS-5-MENSUAL%' then 'mensual'
    when upper(p) like 'RECONCILIADOR%' then 'reconciliador'
    when upper(p) like 'POL%TICA%' then 'politica'
    when upper(p) like 'INVARIANTE%' then 'invariante'
    when upper(p) like 'ANOMAL%' then 'anomalias'
    when upper(p) like 'CLAUDE%' then 'claude'
    else 'agente' end;
$$;


ALTER FUNCTION "public"."actor_desde_prefijo"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."actualizar_eventos_escalera"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  update funnel_stages f set eventos_ultimos_30d = coalesce((
    select count(*) from funnel_events e
    where e.account = f.account and e.stage_order = f.stage_order and e.reached_at >= now() - interval '30 days'
  ), f.eventos_ultimos_30d)
  where exists (select 1 from funnel_events e where e.account = f.account);
$$;


ALTER FUNCTION "public"."actualizar_eventos_escalera"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."actualizar_eventos_escalera"() IS 'Recalcula eventos_ultimos_30d en funnel_stages desde funnel_events. Con esto listo_para_primaria se actualiza solo y la tarea semanal detecta cuando una etapa llega a 15 sin que nadie cuente a mano.';



CREATE OR REPLACE FUNCTION "public"."actualizar_win_rates"() RETURNS TABLE("account" "text", "etapa" "text", "antes" numeric, "despues" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."actualizar_win_rates"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."actualizar_win_rates"() IS 'Reemplaza los win rates estimados de funnel_stages por los reales de v_win_rates_reales cuando hay 10+ leads por etapa. Idempotente. Correr en el cron semanal. Devuelve que cambio.';



CREATE OR REPLACE FUNCTION "public"."alerta_registrar"("p_account" "text", "p_nivel" "text", "p_tipo" "text", "p_titulo" "text", "p_detalle" "text", "p_accion" "text", "p_origen" "text", "p_entidad" "text" DEFAULT NULL::"text", "p_fecha_dato" "date" DEFAULT CURRENT_DATE) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_key text; v_id bigint;
begin
  v_key := coalesce(p_account, 'SYS') || ':' || p_tipo || ':' || coalesce(p_entidad, '') || ':' || p_fecha_dato::text;
  -- Si esta silenciada y vigente, no se registra
  if exists (select 1 from alertas where dedupe_key like coalesce(p_account, 'SYS') || ':' || p_tipo || ':' || coalesce(p_entidad, '') || ':%' and estado = 'silenciada' and silenciada_hasta >= current_date) then return null; end if;
  insert into alertas (account, nivel, tipo, titulo, detalle, accion, origen, entidad, fecha_dato, dedupe_key)
  values (p_account, p_nivel, p_tipo, p_titulo, p_detalle, p_accion, p_origen, p_entidad, p_fecha_dato, v_key)
  on conflict (dedupe_key) do nothing returning id into v_id;
  return v_id;
end $$;


ALTER FUNCTION "public"."alerta_registrar"("p_account" "text", "p_nivel" "text", "p_tipo" "text", "p_titulo" "text", "p_detalle" "text", "p_accion" "text", "p_origen" "text", "p_entidad" "text", "p_fecha_dato" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."alertas_ejecucion_perdida"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int := 0; r record;
begin
  for r in select account, count(*) c, string_agg(distinct verbo_sugerido, ', ') verbos, string_agg(left(titulo, 60), ' | ') titulos from v_ejecucion_perdida group by account loop
    if exists (select 1 from alertas where account = r.account and tipo = 'ejecucion_perdida' and estado = 'abierta') then continue; end if;
    perform alerta_registrar(r.account, 'semana', 'ejecucion_perdida',
      r.c || ' accionable(s) de ' || r.account || ' se podrian ejecutar solos y estan como trabajo manual',
      'Verbos detectados: ' || r.verbos || '. Accionables: ' || left(r.titulos, 400) || '. Un script de Google Ads puede hacer estos cambios, pero el accionable no trae Accion JSON, asi que no aparece el boton de ejecutar.',
      'Abrir cada accionable y completar el Accion JSON con la entidad exacta resuelta contra la base. Nunca adivinar el nombre de la keyword o la campana desde el titulo.',
      'capacidades', null, current_date);
    n := n + 1;
  end loop;
  return n;
end $$;


ALTER FUNCTION "public"."alertas_ejecucion_perdida"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."alertas_fechas_campana"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int := 0; r record;
begin
  for r in
    select f.account, f.campaign, f.end_date, sum(d.cost) gasto
    from campaign_fechas f join campaign_daily d on d.account = f.account and d.campaign = f.campaign and d.date > f.end_date
    where f.end_date is not null and f.end_date < current_date group by f.account, f.campaign, f.end_date having sum(d.cost) > 0
  loop
    perform alerta_registrar(r.account, 'hoy', 'campana_vencida', 'La campana ' || r.campaign || ' sigue gastando despues de su fecha de fin',
      'Termino el ' || r.end_date || ' y gasto ' || round(r.gasto, 2) || ' despues. Si era una promo, el anuncio sigue prometiendo algo que ya no existe.',
      'Pausarla en Google Ads, o mover la fecha de fin si la promo se extendio.', 'fechas', r.campaign, current_date);
    n := n + 1;
  end loop;
  return n;
end $$;


ALTER FUNCTION "public"."alertas_fechas_campana"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."alertas_integridad"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int := 0; r record;
begin
  for r in select * from auditar_integridad() where estado = 'FALLA' loop
    perform alerta_registrar(nullif(r.cuenta, '-'), 'hoy', 'integridad_' || r.prueba,
      'Falla de integridad: ' || r.prueba || case when r.cuenta <> '-' then ' en ' || r.cuenta else '' end,
      r.detalle, 'Revisar la extraccion y el mapeo antes de usar estos numeros para decidir nada.', 'auditoria', null, current_date);
    n := n + 1;
  end loop;
  return n;
end $$;


ALTER FUNCTION "public"."alertas_integridad"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."alertas_umbrales_diarios"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare n int := 0; r record;
begin
  -- U1. Gasto diario bajo 50% del presupuesto tres dias seguidos (excluye dias sin extraccion)
  for r in
    select c.account, c.presupuesto_diario, string_agg(d.date::text || '=' || round(d.gasto), ', ' order by d.date) dias
    from cuentas c join lateral (select date, sum(cost) gasto from campaign_daily where account = c.account and date >= current_date - 4 and date < current_date group by date order by date desc limit 3) d on true
    where c.activa and c.presupuesto_diario > 0 group by c.account, c.presupuesto_diario
    having count(*) = 3 and bool_and(d.gasto < c.presupuesto_diario * 0.5)
  loop
    perform alerta_registrar(r.account, 'hoy', 'gasto_bajo', 'Gasto bajo 50% del presupuesto tres dias seguidos en ' || r.account, 'Presupuesto ' || r.presupuesto_diario || '; gasto por dia: ' || r.dias, 'Revisar en Google Ads si la campana esta limitada (estado, aprobacion de anuncios, puja, presupuesto compartido). Si fue un cambio tuyo, anotalo en Bitacora.', 'umbrales', null, current_date - 1);
    n := n + 1;
  end loop;
  -- U2. Mas de 30% de leads nuevos de la semana sin click id (360 y cualquier cuenta con funnel_events)
  for r in
    select account, count(*) leads, count(*) filter (where coalesce(click_id, '') = '') sin_click
    from funnel_events where reached_at >= current_date - 7 and stage_order = (select min(stage_order) from funnel_events f2 where f2.account = funnel_events.account)
    group by account having count(*) >= 3 and count(*) filter (where coalesce(click_id, '') = '')::numeric / count(*) > 0.3
  loop
    perform alerta_registrar(r.account, 'semana', 'leads_sin_gclid', r.sin_click || ' de ' || r.leads || ' leads nuevos sin click id esta semana en ' || r.account, 'Sin GCLID no se pueden subir como conversion offline; Smart Bidding no aprende de ellos.', 'Revisar el formulario y el mapeo de GCLID en el CRM (GHL o Asana). Mientras, esos leads no cuentan.', 'umbrales', null, current_date - 1);
    n := n + 1;
  end loop;
  return n;
end $$;


ALTER FUNCTION "public"."alertas_umbrales_diarios"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atender_nota"("p_id" bigint, "p_por" "text", "p_respuesta" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  update notas_para_agentes set atendida_el = now(), atendida_por = p_por, respuesta = p_respuesta where id = p_id;
$$;


ALTER FUNCTION "public"."atender_nota"("p_id" bigint, "p_por" "text", "p_respuesta" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auditar_integridad"() RETURNS TABLE("prueba" "text", "cuenta" "text", "estado" "text", "detalle" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select 'contagio_entidades', coalesce(cuentas, '-'), 'FALLA', 'La campana "' || entidad || '" aparece en: ' || cuentas
  from (select campaign entidad, string_agg(distinct account, ', ') cuentas from campaign group by 1 having count(distinct account) > 1) x
  union all
  select 'contagio_keywords', cuentas, 'FALLA', 'La keyword "' || entidad || '" aparece en: ' || cuentas
  from (select campaign || ' > ' || keyword entidad, string_agg(distinct account, ', ') cuentas from keywords group by 1 having count(distinct account) > 1) x
  union all
  select 'semanal_vs_diario', w.account, case when abs(w.g - d.g) < greatest(1, w.g * 0.01) then 'OK' else 'FALLA' end,
    'Semana ' || w.week_start || ': semanal ' || round(w.g, 2) || ' vs diario ' || round(d.g, 2)
  from (select account, week_start, sum(cost)::numeric g from campaign group by 1,2) w
  join (select account, (date - ((extract(dow from date)::int + 6) % 7))::date ws, count(distinct date) dias, sum(cost)::numeric g from campaign_daily group by 1,2) d
    on d.account = w.account and d.ws = w.week_start and d.dias = 7
  union all
  select 'jerarquia_grupos', c.account, case when g.g <= c.g * 1.01 then 'OK' else 'FALLA' end,
    'Ultima semana: campanas ' || round(c.g, 2) || ' vs grupos ' || round(g.g, 2)
  from (select c.account, sum(c.cost)::numeric g from campaign c where c.week_start = (select max(week_start) from campaign c2 where c2.account = c.account) group by 1) c
  join (select a.account, sum(a.cost)::numeric g from adgroup a where a.week_start = (select max(week_start) from adgroup a2 where a2.account = a.account) group by 1) g on g.account = c.account
  union all
  select 'mapeo_objetivos', c.account, case when abs(c.g - o.g) < 0.02 then 'OK' else 'FALLA' end,
    'Total ' || round(c.g, 2) || ' vs suma por objetivo ' || round(o.g, 2)
  from (select c.account, sum(c.cost)::numeric g from campaign c where c.week_start = (select max(week_start) from campaign c2 where c2.account = c.account) group by 1) c
  join (select v.account, sum(v.gasto)::numeric g from v_por_objetivo_semanal v where v.week_start = (select max(week_start) from campaign c2 where c2.account = v.account) group by 1) o on o.account = c.account
  where c.account in (select account from cuentas where perfil_analisis = 'cadena')
  union all
  select 'definicion_objetivos', account, 'FALLA', lectura from v_integridad_mapeo where not tiene_definicion and objetivo <> 'generico'
  union all
  select 'frescura_diaria', account, case when current_date - max(date) <= 2 then 'OK' else 'FALLA' end,
    'Ultimo dia: ' || max(date) || ' (' || (current_date - max(date)) || ' dias de atraso)' from campaign_daily group by account
  union all
  select 'pulso_al_dia', c.account, case when p.ultimo is null then 'FALLA' when current_date - p.ultimo <= 2 then 'OK' else 'FALLA' end,
    coalesce('Ultimo pulso: ' || p.ultimo, 'Nunca corrio')
  from cuentas c left join (select account, max(fecha) ultimo from pulso_diario group by 1) p on p.account = c.account where c.activa
  -- Verificaciones nuevas: coherencia interna de los numeros que da Google
  union all
  select 'valores_imposibles', account, case when count(*) = 0 then 'OK' else 'FALLA' end,
    case when count(*) = 0 then 'Sin gasto negativo, conversiones sin clics ni valor sin conversiones'
         else count(*) || ' fila(s) con valores imposibles' end
  from campaign where cost < 0 or (conversions > 0 and clicks = 0) or (conv_value > 0 and conversions = 0) group by account
  union all
  select 'sin_duplicados', 'todas', case when count(*) = 0 then 'OK' else 'FALLA' end,
    case when count(*) = 0 then 'Ninguna semana ni dia duplicado por campana' else count(*) || ' duplicado(s)' end
  from (select account, campaign, week_start from campaign group by 1,2,3 having count(*) > 1
        union all select account, campaign, date from campaign_daily group by 1,2,3 having count(*) > 1) x
  union all
  select 'ficha_y_doc_maestro', c.account,
    case when c.notion_ficha_id is null then 'FALLA'
         when not exists (select 1 from doc_maestro_humano d where d.account = c.account and d.vigente) then 'FALLA'
         else 'OK' end,
    case when c.notion_ficha_id is null then 'Sin ficha de Notion vinculada'
         when not exists (select 1 from doc_maestro_humano d where d.account = c.account and d.vigente) then 'Sin doc maestro vigente'
         else 'Ficha y doc maestro en su lugar' end
  from cuentas c where c.activa;
$$;


ALTER FUNCTION "public"."auditar_integridad"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auditar_integridad"() IS 'Verificaciones de integridad automatizadas. Nota sobre clics > impresiones: Google puede reportarlo con numeros muy chicos (1 impresion, 2 clics) por atribucion entre fechas. No es un error de extraccion y por eso NO se audita.';



CREATE OR REPLACE FUNCTION "public"."auditar_objetos"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int := 0; r record; vok int; vfa int; fok int; ffa int; det jsonb;
begin
  select count(*) filter (where estado='OK'), count(*) filter (where estado='FALLA') into vok, vfa from probar_todas_las_vistas();
  select count(*) filter (where estado='OK'), count(*) filter (where estado='FALLA') into fok, ffa from probar_funciones_de_cuenta();
  select coalesce(jsonb_agg(jsonb_build_object('objeto', objeto, 'error', error)), '[]') into det from (
    select objeto, error from probar_todas_las_vistas() where estado='FALLA'
    union all select funcion || ' (' || cuenta || ')', error from probar_funciones_de_cuenta() where estado='FALLA') x;
  delete from auditoria_objetos_ultima;
  insert into auditoria_objetos_ultima (vistas_ok, vistas_falla, funciones_ok, funciones_falla, detalle) values (vok, vfa, fok, ffa, det);
  for r in select (e->>'objeto') objeto, (e->>'error') error from jsonb_array_elements(det) e loop
    if exists (select 1 from alertas where tipo = 'objeto_roto' and entidad = r.objeto and estado = 'abierta') then continue; end if;
    perform alerta_registrar(null, 'hoy', 'objeto_roto', 'El objeto ' || r.objeto || ' no responde',
      'Al consultarlo devuelve: ' || r.error || '. Una vista o funcion puede romperse por un DROP CASCADE o un cambio de columna, y nadie se entera hasta que un agente la usa en plena corrida.',
      'Revisarlo antes de la proxima corrida de agentes.', 'auditoria', r.objeto, current_date);
    n := n + 1;
  end loop;
  return n;
end $$;


ALTER FUNCTION "public"."auditar_objetos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."campaign_dim_refrescar"("p_account" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int := 0;
begin
  insert into campaign_dim (account, campaign, location, objetivo, tipo_campana, patron, resuelto_el)
  select c.account, c.campaign, r->>'location', coalesce(r->>'objetivo','generico'), r->>'tipo', r->>'patron', now()
  from (
    select distinct account, campaign from campaign where p_account is null or account = p_account
    union
    select distinct account, campaign from campaign_daily where (p_account is null or account = p_account) and date >= current_date - 45
    union
    select distinct account, entity_name from config_snapshot where entity_type = 'campaign' and (p_account is null or account = p_account)
      and snapshot_date >= current_date - 7
  ) c, lateral resolver_campana(c.account, c.campaign) r
  on conflict (account, campaign) do update set
    location = excluded.location, objetivo = excluded.objetivo,
    tipo_campana = excluded.tipo_campana, patron = excluded.patron, resuelto_el = now();
  get diagnostics n = row_count;
  return n;
end $$;


ALTER FUNCTION "public"."campaign_dim_refrescar"("p_account" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."campaign_fechas_sincronizar"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int := 0;
begin
  insert into campaign_fechas (account, campaign, start_date, end_date, estado_google, estado_real, actualizado)
  select c.account, c.entity_name,
    nullif(c.config->>'start_date','')::date, nullif(c.config->>'end_date','')::date,
    c.config->>'status', coalesce(c.config->>'estado_real', c.config->>'status'), now()
  from config_snapshot c
  where c.entity_type = 'campaign'
    and c.snapshot_date = (select max(snapshot_date) from config_snapshot c2 where c2.account = c.account and c2.entity_type = 'campaign')
  on conflict (account, campaign) do update set start_date = excluded.start_date, end_date = excluded.end_date,
    estado_google = excluded.estado_google, estado_real = excluded.estado_real, actualizado = now();
  get diagnostics n = row_count;
  -- Respaldo: account_state del semanal, para cuentas sin corrida diaria aun
  insert into campaign_fechas (account, campaign, start_date, end_date, estado_google, estado_real, actualizado)
  select a.account, a.item,
    nullif((regexp_match(a.detail, 'desde (\d{4}-\d{2}-\d{2})'))[1],'')::date,
    nullif((regexp_match(a.detail, 'hasta (\d{4}-\d{2}-\d{2})'))[1],'')::date,
    case when a.value in ('FINALIZADA','PROGRAMADA') then 'ENABLED' else a.value end, a.value, now()
  from account_state a
  where a.section = 'campanas' and a.run_ts = (select max(run_ts) from account_state a2 where a2.account = a.account)
    and not exists (select 1 from campaign_fechas f where f.account = a.account and f.campaign = a.item and f.start_date is not null)
  on conflict (account, campaign) do nothing;
  return n;
end $$;


ALTER FUNCTION "public"."campaign_fechas_sincronizar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."completitud_de_cuenta"("p_account" "text") RETURNS TABLE("requisito" "text", "cumple" boolean, "detalle" "text", "por_que_importa" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with c as (select * from cuentas where account = p_account)
  select 'doc maestro', (select count(*) from doc_maestro_humano d where d.account = p_account and d.vigente) >= 5,
    (select count(*)::text || ' secciones vigentes' from doc_maestro_humano d where d.account = p_account and d.vigente),
    'Sin doc maestro el agente no sabe que es el negocio ni que esta prohibido decir.'
  union all
  select 'reglas de dominio', (select reglas_dominio is not null and length(reglas_dominio) > 100 from c),
    (select coalesce(length(reglas_dominio)::text || ' caracteres', 'vacio') from c),
    'Son las restricciones que no se negocian. Sin ellas el agente propone cosas que hay que descartar.'
  union all
  select 'nucleo semantico', (select nucleo is not null from c), (select coalesce(left(nucleo::text, 60), 'vacio') from c),
    'La invariante I0 protege el nucleo. Sin nucleo definido, I0 no protege nada.'
  union all
  select 'terminos protegidos', (select count(*) from terminos_protegidos t where t.account = p_account) > 0,
    (select count(*)::text || ' terminos, ' || coalesce(round(sum(conversiones_90d))::text,'0') || ' conversiones cubiertas' from terminos_protegidos t where t.account = p_account),
    'La invariante I2 impide negativizar lo que convierte. Sin protegidos, una negativa puede matar la conversion.'
  union all
  select 'ficha de Notion', (select notion_ficha_id is not null from c), (select coalesce(notion_ficha_id, 'sin vincular') from c),
    'Sin ficha, el espejo no resuelve la cuenta y los accionables quedan huerfanos.'
  union all
  select 'objetivo de cuenta', (select count(*) from account_targets a where a.account = p_account) > 0,
    (select count(*)::text || ' objetivo(s)' from account_targets a where a.account = p_account),
    'Sin objetivo no hay headroom ni brecha: el agente no sabe si la cuenta va bien o mal.'
  union all
  select 'datos frescos', (select coalesce(max(date) >= current_date - 2, false) from campaign_daily d where d.account = p_account),
    (select 'ultimo dia: ' || coalesce(max(date)::text, 'ninguno') from campaign_daily d where d.account = p_account),
    'Un analisis sobre datos viejos es peor que ninguno.'
  union all
  select 'semanas de historia', (select count(distinct week_start) from campaign w where w.account = p_account) >= 4,
    (select count(distinct week_start)::text || ' semanas' from campaign w where w.account = p_account),
    'Con menos de 4 semanas no hay tendencia: cualquier movimiento parece significativo.'
  union all
  select 'destinatarios de reporte', (select destinatarios_reporte is not null and array_length(destinatarios_reporte, 1) > 0 from c),
    (select coalesce(array_to_string(destinatarios_reporte, ', '), 'SIN CARGAR') from c),
    'Sin destinatarios el reporte se aprueba y no se envia: el briefing lo saltea en silencio.'
  union all
  select 'objetivos de conversion', (select perfil_analisis from c) <> 'cadena'
    or (select count(*) from objetivos_conversion o where o.account = p_account) > 0,
    (select count(*)::text || ' objetivos definidos' from objetivos_conversion o where o.account = p_account),
    'Solo obligatorio en perfil cadena: sin ellos no se puede separar compra online de visitas.'
  union all
  select 'mapeo de campanas', not exists (select 1 from v_campanas_sin_dim s where s.account = p_account),
    (select count(*)::text || ' campanas con gasto fuera de campaign_dim' from v_campanas_sin_dim s where s.account = p_account),
    'Una campana fuera de campaign_dim no se puede atribuir a un local ni a un objetivo.';
$$;


ALTER FUNCTION "public"."completitud_de_cuenta"("p_account" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."completitud_de_cuenta"("p_account" "text") IS 'Que le falta a una cuenta para operar bien. Nacio de que Fresh Monkee llevaba desde su alta con cero terminos protegidos y 3.124 conversiones sin cubrir: las verificaciones eran del sistema entero y ninguna miraba cuenta por cuenta.';



CREATE OR REPLACE FUNCTION "public"."correr_relaciones"("p_cuenta" "text" DEFAULT NULL::"text") RETURNS TABLE("cumplen" integer, "violan" integer, "no_aplican" integer, "errores" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare r record; cta text; izq numeric; der numeric; aplica boolean; dif numeric;
        n_ok int := 0; n_viola int := 0; n_na int := 0; n_err int := 0;
        objetivos text[];
begin
  for r in select * from relaciones_verdad where activa order by id loop

    -- Una relacion global se corre una sola vez, sin cuenta. Una de cuenta, una vez por cuenta.
    if r.ambito = 'global' then
      if p_cuenta is not null then continue; end if;   -- no tiene sentido filtrarla por cuenta
      objetivos := array[null::text];
    else
      select array_agg(account) into objetivos
        from cuentas where activa and (p_cuenta is null or account = p_cuenta);
    end if;

    foreach cta in array objetivos loop
      begin
        aplica := true;
        if r.dominio_valido is not null then
          execute 'select (' || replace(r.dominio_valido, '$CUENTA$', quote_literal(coalesce(cta,''))) || ')::boolean' into aplica;
        end if;

        if not coalesce(aplica, false) then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
          values (r.id, cta, 'no_aplicaba', 'El dominio de validez no se cumple aca. No es una violacion.');
          n_na := n_na + 1; continue;
        end if;

        execute 'select (' || replace(r.sql_izquierda, '$CUENTA$', quote_literal(coalesce(cta,''))) || ')::numeric' into izq;
        execute 'select (' || replace(r.sql_derecha,   '$CUENTA$', quote_literal(coalesce(cta,''))) || ')::numeric' into der;

        if izq is null and der is null then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
          values (r.id, cta, 'no_aplicaba', 'Los dos lados dieron NULL: no hay datos para evaluar.');
          n_na := n_na + 1; continue;
        end if;

        dif := abs(coalesce(izq,0) - coalesce(der,0)) / nullif(greatest(abs(coalesce(izq,0)), abs(coalesce(der,0))), 0);

        if coalesce(dif, 0) <= r.tolerancia_rel then
          insert into corridas_verdad (relacion_id, cuenta, veredicto, valor_izq, valor_der, diferencia_rel)
          values (r.id, cta, 'cumple', izq, der, dif);
          n_ok := n_ok + 1;
        else
          insert into corridas_verdad (relacion_id, cuenta, veredicto, valor_izq, valor_der, diferencia_rel, detalle)
          values (r.id, cta, 'viola', izq, der, dif,
                  r.que_afirma || ' Izquierda ' || izq || ', derecha ' || der || ', diferencia ' || round(dif*100,2) || '%.');
          n_viola := n_viola + 1;
        end if;
      exception when others then
        insert into corridas_verdad (relacion_id, cuenta, veredicto, detalle)
        values (r.id, cta, 'error', sqlerrm);
        n_err := n_err + 1;
      end;
    end loop;
  end loop;
  return query select n_ok, n_viola, n_na, n_err;
end $_$;


ALTER FUNCTION "public"."correr_relaciones"("p_cuenta" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."correr_relaciones"("p_cuenta" "text") IS 'Corre todas las relaciones activas sobre todas las cuentas activas. $CUENTA$ se reemplaza por el nombre de la cuenta, escapado con quote_literal. Cuatro veredictos, y no_aplicaba NO es una falla: es la relacion diciendo que su dominio de validez no se cumple aca.';



CREATE OR REPLACE FUNCTION "public"."corrida_redundante"("p_account" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with ult as (
    select semana_analizada, created_at, foto_leida, ultimo_evento_visto, ultima_extraccion_vista
    from run_quality where account = p_account
      and coalesce(que_fallo, '') not ilike 'redundante%' and coalesce(que_fallo, '') not ilike 'semana cerrada no disponible%'
    order by created_at desc limit 1
  ),
  datos as (select max(date) diaria, (select max(week_start) from campaign where account = p_account) semanal from campaign_daily where account = p_account),
  ahora as (
    select (select max(event_date) from google_live_events g where g.account = p_account and g.event_type in ('USER_CHANGE','AUTO_CHANGE') and coalesce(g.client_type,'') <> 'AI_MAX_SETTING') ev,
           (select max(run_ts) from run_log r where r.account = p_account and upper(r.status) = 'OK') ex
  ),
  nuevo as (
    select exists (select 1 from pulso_diario p, ult where p.account = p_account and p.created_at > ult.created_at) as pulso_nuevo,
           exists (select 1 from operator_log o, ult where o.account = p_account and o.created_at > ult.created_at) as operador_nuevo,
           (select ev from ahora) > coalesce((select ultimo_evento_visto from ult), '-infinity'::timestamptz) as google_nuevo,
           (select ex from ahora) > coalesce((select ultima_extraccion_vista from ult), '-infinity'::timestamptz) as extraccion_nueva,
           (select ultima_extraccion_vista from ult) is null as sin_marcadores
  ),
  lunes as (select (current_date - ((extract(dow from current_date)::int + 6) % 7))::date as este_lunes)
  select jsonb_build_object(
    'ultima_corrida', (select created_at from ult), 'semana_analizada', (select semana_analizada from ult),
    'semana_disponible', (select semanal from datos), 'diaria_hasta', (select diaria from datos),
    'semana_a_analizar', (select este_lunes - 7 from lunes),
    'semana_cerrada_disponible', (select semanal from datos) >= (select este_lunes - 7 from lunes) and (select diaria from datos) >= (select este_lunes - 1 from lunes),
    'hubo_corrida_hoy', coalesce((select created_at::date = current_date from ult), false),
    'misma_semana_ya_analizada', coalesce((select semana_analizada from ult) = (select este_lunes - 7 from lunes), false),
    'marcadores_para_la_proxima', jsonb_build_object('ultimo_evento_visto', (select ev from ahora), 'ultima_extraccion_vista', (select ex from ahora)),
    'hay_datos_nuevos', coalesce((select pulso_nuevo or operador_nuevo or coalesce(google_nuevo, false) or coalesce(extraccion_nueva, false) or sin_marcadores from nuevo), true),
    'detalle', (select jsonb_build_object('pulso', pulso_nuevo, 'operador', operador_nuevo, 'google', coalesce(google_nuevo, false), 'extraccion', coalesce(extraccion_nueva, false), 'primera_corrida_con_marcadores', sin_marcadores) from nuevo),
    'como_registrar', 'Al escribir la fila en run_quality, copia marcadores_para_la_proxima en ultimo_evento_visto y ultima_extraccion_vista. Sin eso la proxima corrida no puede saber que ya viste.',
    -- La condicion ya NO es "hubo corrida hoy". Era demasiado angosta: si la tarea
    -- disparaba el lunes y otra vez el martes sobre la MISMA semana y sin datos
    -- nuevos, el martes pasaba el guardarrail y reescribia el mismo analisis.
    -- Lo que importa es si la semana que toca analizar YA se analizo y no llego
    -- nada nuevo desde entonces, sin importar cuantos dias pasaron.
    'redundante', coalesce((select semana_analizada from ult) = (select este_lunes - 7 from lunes), false)
      and not coalesce((select pulso_nuevo or operador_nuevo or coalesce(google_nuevo, false) or coalesce(extraccion_nueva, false) or sin_marcadores from nuevo), true),
    'por_que', case
      when not coalesce((select semana_analizada from ult) = (select este_lunes - 7 from lunes), false)
        then 'La semana ' || (select este_lunes - 7 from lunes) || ' todavia no se analizo. Corre.'
      when coalesce((select pulso_nuevo or operador_nuevo or coalesce(google_nuevo, false) or coalesce(extraccion_nueva, false) or sin_marcadores from nuevo), true)
        then 'La semana ya se analizo pero llegaron datos nuevos desde entonces. Corre y decilo en el brief.'
      else 'La semana ' || (select este_lunes - 7 from lunes) || ' ya se analizo el ' ||
        (select created_at::date from ult) || ' y no llego nada nuevo. Registra redundante y para.' end
  );
$$;


ALTER FUNCTION "public"."corrida_redundante"("p_account" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."corrida_redundante"("p_account" "text") IS 'Antes de analizar: si ya hubo corrida hoy y no entro nada nuevo (pulso, operador, Google, extraccion) desde entonces, redundante = true y la tarea termina en una linea.';



CREATE OR REPLACE FUNCTION "public"."declarar_umbral"("p_account" "text", "p_script" "text", "p_umbral" "text", "p_valor" numeric) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  insert into umbrales_de_scripts (account, script, umbral, valor, declarado_el)
  values (p_account, p_script, p_umbral, p_valor, now())
  on conflict (account, script, umbral) do update set valor = excluded.valor, declarado_el = now();
$$;


ALTER FUNCTION "public"."declarar_umbral"("p_account" "text", "p_script" "text", "p_umbral" "text", "p_valor" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dejar_nota_para_agente"("p_contenido" "text", "p_account" "text" DEFAULT NULL::"text", "p_para" "text" DEFAULT 'semanal'::"text", "p_tipo" "text" DEFAULT 'pregunta'::"text") RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  insert into notas_para_agentes (account, para, tipo, contenido)
  values (p_account, p_para, p_tipo, p_contenido) returning id;
$$;


ALTER FUNCTION "public"."dejar_nota_para_agente"("p_contenido" "text", "p_account" "text", "p_para" "text", "p_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detectar_cambios_config"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int := 0;
begin
  insert into cambios_config (account, entidad, entity_type, campo, valor_anterior, valor_nuevo, detectado_el, foto_anterior, foto_actual)
  select h.account, h.entity_name, h.entity_type, k.campo,
         a.config->>k.campo, h.config->>k.campo, current_date, a.snapshot_date, h.snapshot_date
  from config_snapshot h
  join lateral (select max(snapshot_date) d from config_snapshot x where x.account = h.account and x.snapshot_date < h.snapshot_date) prev on true
  join config_snapshot a on a.account = h.account and a.entity_name = h.entity_name and a.entity_type = h.entity_type and a.snapshot_date = prev.d
  cross join lateral (select unnest(array['status','estado_real','bidding_strategy','target_cpa','target_roas','daily_budget','end_date','primary_for_goal','include_in_conversions','counting_type','default_value']) campo) k
  where h.snapshot_date = (select max(snapshot_date) from config_snapshot y where y.account = h.account)
    and coalesce(a.config->>k.campo, '~') is distinct from coalesce(h.config->>k.campo, '~')
  on conflict (account, entidad, campo, foto_actual) do nothing;
  get diagnostics n = row_count;
  -- Los que importan generan alerta: estado, puja y conversion primaria
  insert into alertas (account, nivel, tipo, titulo, detalle, accion, origen, entidad, fecha_dato, estado)
  select c.account, 'hoy', 'cambio_no_registrado',
    'Cambio en ' || c.entidad || ' que Google no registro en el historial',
    c.campo || ': ' || coalesce(c.valor_anterior, 'sin valor') || ' -> ' || coalesce(c.valor_nuevo, 'sin valor') || '. Detectado comparando la foto del ' || c.foto_anterior || ' con la del ' || c.foto_actual || '. No aparece en change_events: puede haberlo hecho el cliente, un franquiciado, o Google sin registrarlo.',
    'Confirmar quien lo hizo y si es deliberado. Si fue el cliente, anotarlo en la bitacora.',
    'diff_config', c.entidad, c.foto_actual, 'abierta'
  from cambios_config c
  where c.detectado_el = current_date and not c.visto
    and c.campo in ('status','bidding_strategy','primary_for_goal','include_in_conversions')
    and not exists (select 1 from change_events e where e.account = c.account and e.change_datetime::date between c.foto_anterior and c.foto_actual and coalesce(e.campaign_name, e.entity_name) = c.entidad)
    and not exists (select 1 from alertas al where al.account = c.account and al.tipo = 'cambio_no_registrado' and al.entidad = c.entidad and al.fecha_dato = c.foto_actual);
  return n;
end $$;


ALTER FUNCTION "public"."detectar_cambios_config"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detectar_cambios_no_informados"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare n int := 0; r record;
begin
  for r in
    select a.id, a.account, a.keyword, a.resultado, c.changed_field, c.old_value, c.new_value,
           c.change_datetime::timestamptz as cuando
    from acciones_aprobadas a
    join change_events c on c.account = a.account
      -- ::timestamptz explicito: la columna es TEXT. Sin el cast, la funcion no compila
      -- y la tarea muere entera, arrastrando a la que corre en el mismo job.
      and c.change_datetime::timestamptz between a.ejecutada_el - interval '5 minutes' and a.ejecutada_el + interval '60 minutes'
      and (a.keyword is null or normalizar_entidad(coalesce(c.entity_name, '')) like '%' || normalizar_entidad(a.keyword) || '%')
    where a.estado = 'ejecutada' and a.ejecutada_el >= now() - interval '7 days'
      and c.changed_field is not null
      and (c.changed_field ilike '%cpc%' and a.resultado not ilike '%cpc%'
        or c.changed_field ilike '%url%' and a.resultado not ilike '%url%'
        or c.changed_field ilike '%bid%' and a.resultado not ilike '%puja%' and a.resultado not ilike '%cpc%')
  loop
    perform alerta_registrar(r.account, 'semana', 'cambio_no_informado',
      'El script cambio algo que no reporto en ' || coalesce(r.keyword, 'la entidad'),
      'Google registro: ' || r.changed_field || ' de ' || coalesce(r.old_value, '?') || ' a ' || coalesce(r.new_value, '?') || '. El resultado del script decia: ' || left(r.resultado, 200),
      'Revisar en Google Ads > Historial de cambios y corregir si hace falta. Si el script tiene que cambiar, ticket.',
      'reconciliador', r.keyword, r.cuando::date);
    n := n + 1;
  end loop;
  return n;
end $$;


ALTER FUNCTION "public"."detectar_cambios_no_informados"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detectar_cambios_no_informados"() IS 'Cruza acciones ejecutadas contra change_events para detectar cambios que el script hizo y no reporto. OJO: change_events.change_datetime es TEXT, no timestamp. Toda comparacion de fechas contra esa columna necesita ::timestamptz explicito. Sin el cast la funcion no compila y la tarea muere, arrastrando a la que corre en el mismo job de pg_cron.';



CREATE OR REPLACE FUNCTION "public"."detectar_conflictos"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
declare n int := 0; r record;
begin
  -- Solo abiertos con accion valida
  create temp table ab on commit drop as
    select notion_id, account, titulo, estado, causa_raiz, accion, accion->>'verbo' verbo,
           accion->'objeto'->>'campana' campana, accion->'objeto'->>'grupo' grupo, accion->'objeto'->>'keyword' keyword,
           accion->'objeto'->>'match_type' mt, accion->'parametros'->>'match_type_destino' mt_destino, accion->'parametros'->>'nivel' nivel
    from accionables_espejo where estado in ('Propuesto','Bloqueado','En curso') and reemplazado_por is null and accion_valida;

  -- R1. Misma keyword, dos acciones abiertas: se ejecuta una, la otra espera
  for r in select x.account, x.notion_id a, y.notion_id b, x.keyword from ab x join ab y on x.account = y.account and x.notion_id < y.notion_id
    and x.keyword is not null and normalizar_entidad(x.keyword) = normalizar_entidad(y.keyword) and coalesce(x.grupo,'') = coalesce(y.grupo,'')
    and x.verbo in ('pausar_keyword','cambiar_concordancia','reactivar_keyword','cambiar_puja') and y.verbo in ('pausar_keyword','cambiar_concordancia','reactivar_keyword','cambiar_puja') loop
    insert into accionable_relaciones (account, a, b, tipo, regla, motivo, severidad) values (r.account, r.a, r.b, 'conflicta_con', 'R1_misma_keyword', 'Dos acciones abiertas sobre la misma keyword "' || r.keyword || '". Se ejecuta una y se mide 14 dias antes de la otra.', 'bloquea') on conflict do nothing; n := n + 1;
  end loop;

  -- R2. Negativa propuesta bloquearia una keyword activa de la cuenta (regla literal de Google)
  for r in select x.account, x.notion_id a, x.keyword neg, coalesce(x.mt_destino, x.mt, 'PHRASE') mt, x.nivel, x.campana, x.grupo,
      k.keyword kw_activa, k.ad_group, k.campaign
    from ab x join keywords k on k.account = x.account and k.keyword_status = 'ENABLED' and k.week_start = (select max(week_start) from keywords where account = x.account)
      and (x.nivel = 'campana' and k.campaign = x.campana or coalesce(x.nivel,'grupo') = 'grupo' and k.ad_group = x.grupo)
    where x.verbo = 'agregar_negativa' and negativa_bloquea(x.keyword, coalesce(x.mt_destino, x.mt, 'PHRASE'), regexp_replace(k.keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) loop
    insert into accionable_relaciones (account, a, b, tipo, regla, motivo, severidad) values (r.account, r.a, 'keyword:' || r.kw_activa, 'bloquea_keyword', 'R2_negativa_vs_activa', 'La negativa "' || r.neg || '" (' || r.mt || ') bloquearia la keyword activa "' || r.kw_activa || '" en ' || r.ad_group || '. Google la dejaria sin subastas.', 'bloquea') on conflict do nothing; n := n + 1;
  end loop;

  -- R3. Negativa vs crear/reactivar keyword abierto con el mismo texto
  for r in select x.account, x.notion_id a, y.notion_id b, x.keyword from ab x join ab y on x.account = y.account and x.notion_id <> y.notion_id
    where x.verbo = 'agregar_negativa' and y.verbo in ('crear_keyword','reactivar_keyword') and negativa_bloquea(x.keyword, coalesce(x.mt_destino, x.mt, 'PHRASE'), y.keyword) loop
    insert into accionable_relaciones (account, a, b, tipo, regla, motivo, severidad) values (r.account, r.a, r.b, 'conflicta_con', 'R3_negativa_vs_crear', 'Una negativa y una creacion o reactivacion se pisan en "' || r.keyword || '". Decidir cual gana.', 'bloquea') on conflict do nothing; n := n + 1;
  end loop;

  -- R4. Misma campaña, dos cambios estructurales (puja, presupuesto, estrategia, conversion): uno a la vez
  for r in select x.account, x.notion_id a, y.notion_id b, x.campana from ab x join ab y on x.account = y.account and x.notion_id < y.notion_id
    and coalesce(x.campana, '') = coalesce(y.campana, '') and x.campana is not null
    where x.verbo in ('cambiar_estrategia_puja','cambiar_presupuesto','cambiar_puja','cambiar_conversion') and y.verbo in ('cambiar_estrategia_puja','cambiar_presupuesto','cambiar_puja','cambiar_conversion') loop
    insert into accionable_relaciones (account, a, b, tipo, regla, motivo, severidad) values (r.account, r.a, r.b, 'conflicta_con', 'R4_estructural_misma_campana', 'Dos cambios estructurales en ' || r.campana || '. Smart Bidding reaprende con cada uno: hacer uno, esperar 14 dias, medir, despues el otro.', 'avisa') on conflict do nothing; n := n + 1;
  end loop;

  -- R5. Dependencia: cambiar estrategia de puja depende de que la conversion primaria este resuelta
  for r in select x.account, x.notion_id a, y.notion_id b from ab x join ab y on x.account = y.account
    where x.verbo = 'cambiar_estrategia_puja' and y.verbo = 'cambiar_conversion' loop
    insert into accionable_relaciones (account, a, b, tipo, regla, motivo, severidad) values (r.account, r.a, r.b, 'depende_de', 'R5_puja_depende_conversion', 'Cambiar la estrategia de puja antes de arreglar la conversion primaria optimiza hacia la señal equivocada. Primero la conversion.', 'bloquea') on conflict do nothing; n := n + 1;
  end loop;

  -- R6. Causa compartida: informativo
  for r in select x.account, x.notion_id a, y.notion_id b, x.causa_raiz from ab x join ab y on x.account = y.account and x.notion_id < y.notion_id
    where x.causa_raiz is not null and length(x.causa_raiz) > 20 and normalizar_entidad(x.causa_raiz) = normalizar_entidad(y.causa_raiz) loop
    insert into accionable_relaciones (account, a, b, tipo, regla, motivo, severidad) values (r.account, r.a, r.b, 'comparte_causa', 'R6_misma_causa', 'Misma causa raiz: "' || left(r.causa_raiz, 120) || '". Resolver uno puede resolver o invalidar el otro.', 'avisa') on conflict do nothing; n := n + 1;
  end loop;

  -- Cerrar relaciones cuyos miembros ya no estan abiertos
  update accionable_relaciones rel set resuelta = true, resuelta_el = now(), resuelta_por = 'cierre'
  where not resuelta and (not exists (select 1 from ab where ab.notion_id = rel.a) or (rel.b not like 'keyword:%' and not exists (select 1 from ab where ab.notion_id = rel.b)));
  return jsonb_build_object('detectadas', n, 'corrida', now());
end $_$;


ALTER FUNCTION "public"."detectar_conflictos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."diccionario_datos"() RETURNS TABLE("capa" "text", "objeto" "text", "usar_para" "text", "cuidado" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce(n.capa, 'ANALISIS'), v.viewname,
    coalesce(n.usar_para, '(sin documentar: agregar nota en notas_de_objetos)'),
    coalesce(n.cuidado, obj_description(('public.' || quote_ident(v.viewname))::regclass))
  from pg_views v left join notas_de_objetos n on n.objeto = v.viewname
  where v.schemaname = 'public'
  union all
  -- Se cruza por el NOMBRE de la funcion, no por la firma: antes 20 funciones
  -- documentadas figuraban como sin documentar porque la nota decia get_briefing
  -- y el diccionario devolvia get_briefing().
  select coalesce(n.capa, 'ENTRADA'),
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    coalesce(n.usar_para, '(sin documentar)'),
    coalesce(n.cuidado, obj_description(p.oid))
  from pg_proc p left join notas_de_objetos n on n.objeto = p.proname
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and (p.proname ~ '^(get_|nav_)' or n.objeto is not null)
  order by 1, 2;
$$;


ALTER FUNCTION "public"."diccionario_datos"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."diccionario_datos"() IS 'Catalogo de que hay disponible y para que sirve. Se genera del esquema real cruzado con notas_de_objetos, asi que un objeto nuevo aparece solo, marcado como sin documentar. Nunca queda mas viejo que la base.';



CREATE OR REPLACE FUNCTION "public"."disparar_pulso_respaldo"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare v_secret text; v_url text; v_req bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  if v_secret is null or v_url is null then
    raise notice 'disparar_pulso_respaldo: faltan secretos cron_secret o app_url en Vault';
    return null;
  end if;
  -- Solo dispara si no hay pulso de ayer para alguna cuenta
  if (select count(*) from pulso_diario where fecha = current_date - 1) >= 3 then
    return null;
  end if;
  select net.http_post(
    url := v_url || '/api/cron/pulso-diario',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{"origen":"pg_net_respaldo"}'::jsonb,
    timeout_milliseconds := 280000
  ) into v_req;
  return v_req;
end $$;


ALTER FUNCTION "public"."disparar_pulso_respaldo"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."disparar_pulso_respaldo"() IS 'Respaldo: llama a /api/cron/pulso-diario via pg_net si a las 10:45 UTC no hay pulso de ayer para las 3 cuentas. Secretos en Vault (cron_secret, app_url). Fire-and-forget: la respuesta queda en net._http_response.';



CREATE OR REPLACE FUNCTION "public"."doc_cronologia"("p_account" "text", "p_dias" integer DEFAULT 60) RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."doc_cronologia"("p_account" "text", "p_dias" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."doc_estado_conversiones"("p_account" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with ult as (select max(snapshot_date) d from config_snapshot where account = p_account and entity_type = 'conversion_action')
  select 'Foto del ' || (select d from ult)::text || E':\n\n| Acción | Primaria | Recuento | Valor | Modelo |\n|---|---|---|---|---|\n' ||
         string_agg(format('| %s | %s | %s | %s | %s |', entity_name, case when (config->>'primary_for_goal')::boolean then '**SÍ**' else 'no' end,
           coalesce(config->>'counting_type', '—'), coalesce(config->>'default_value', '—'), coalesce(config->>'attribution_model', '—')), E'\n' order by (config->>'primary_for_goal')::boolean desc, entity_name)
  from config_snapshot where account = p_account and entity_type = 'conversion_action' and snapshot_date = (select d from ult) and config->>'status' = 'ENABLED';
$$;


ALTER FUNCTION "public"."doc_estado_conversiones"("p_account" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."doc_maestro_editar"("p_account" "text", "p_seccion" "text", "p_contenido" "text", "p_editado_por" "text" DEFAULT 'andres'::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_ver int; v_orden int;
begin
  select coalesce(max(version), 0) + 1, coalesce(max(orden), 0) into v_ver, v_orden from doc_maestro_humano where account = p_account and seccion = p_seccion;
  update doc_maestro_humano set vigente = false where account = p_account and seccion = p_seccion and vigente;
  insert into doc_maestro_humano (account, seccion, orden, contenido, version, editado_por) values (p_account, p_seccion, v_orden, p_contenido, v_ver, p_editado_por);
  return v_ver;
end $$;


ALTER FUNCTION "public"."doc_maestro_editar"("p_account" "text", "p_seccion" "text", "p_contenido" "text", "p_editado_por" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."doc_serie_cpa"("p_account" "text", "p_semanas" integer DEFAULT 12) RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with s as (select date_trunc('week', date)::date as lunes, sum(gasto) g, sum(conversiones) c, bool_or(madurez <> 'consolidado') as parcial
             from v_serie_diaria where account = p_account group by 1 order by 1 desc limit p_semanas)
  select '| Semana del | CPA | Conversiones | Gasto | |' || E'\n|---|---|---|---|---|\n' ||
         string_agg(format('| %s | %s | %s | %s | %s |', lunes, case when c > 0 then round(g / c, 2)::text else '—' end, round(c, 1)::text, round(g, 2)::text, case when parcial then 'parcial' else '' end), E'\n' order by lunes desc)
  from s;
$$;


ALTER FUNCTION "public"."doc_serie_cpa"("p_account" "text", "p_semanas" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."doc_umbrales"("p_account" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select format(E'**Objetivos (origen: %s):** %s conversiones/mes, CPA máximo %s, presupuesto máximo %s/mes, ciclo de venta %s días. %s\n\n**Anomalías:** desvío estadístico contra la media móvil de 7 días (`v_anomalias_diarias`): crítica si z ≥ 3, alta si z ≥ 2,5, media si z ≥ 2. Días provisionales se ignoran. La explicación considera la hora del primer cambio.\n\n**Alertas fijas:** cambio auto-aplicado por Google (ALTA siempre), conversión primaria sin datos (ALTA), keyword con más de %s sin conversiones en 7 días.',
    coalesce(t.cpa_maximo_origen, 'sin origen'), coalesce(t.conversiones_mes_objetivo::text, '—'), coalesce(t.cpa_maximo::text, '—'), coalesce(t.presupuesto_mes_maximo::text, '—'), coalesce(t.ciclo_venta_dias::text, '—'),
    case when t.cpa_maximo_origen = 'historico' then '⚠ Provisionales: derivados del histórico, no confirmados con el cliente.' else 'Confirmados con el cliente.' end,
    case p_account when 'KAREDO' then '60 EUR' when 'BHI' then '40.000 CLP' else '30.000 CLP' end)
  from account_targets t where t.account = p_account;
$$;


ALTER FUNCTION "public"."doc_umbrales"("p_account" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."en_cuarentena"("p_tabla" "text", "p_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (select 1 from cuarentena where tabla = p_tabla and registro_id = p_id);
$$;


ALTER FUNCTION "public"."en_cuarentena"("p_tabla" "text", "p_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."entidad_especifica"("t" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce(t, '') <> '' and (
    -- formato campaña|grupo|keyword con al menos grupo o keyword no vacios
    (position('|' in t) > 0 and (coalesce(nullif(trim(split_part(t, '|', 2)), ''), nullif(trim(split_part(t, '|', 3)), '')) is not null))
    -- o texto libre de mas de una palabra que no sea solo el nombre de una campaña conocida
    or (position('|' in t) = 0 and length(trim(t)) > 12)
  );
$$;


ALTER FUNCTION "public"."entidad_especifica"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."entidad_existe"("p_account" "text", "p_accion" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  with o as (select p_accion->'objeto' obj, p_accion->>'verbo' verbo)
  select case
    when (select verbo from o) is null then jsonb_build_object('ok', false, 'detalle', 'La accion no tiene verbo.')
    when (select verbo from o) in ('preguntar_andres','preguntar_cliente','investigar','tarea_externa')
      then jsonb_build_object('ok', true, 'nota', 'Verbo que no ejecuta: no se valida la entidad.')
    when coalesce((select obj->>'keyword' from o), (select obj->>'campana' from o)) like '%, %'
      then jsonb_build_object('ok', true, 'nota', 'El objeto lista varias entidades: se valida al ejecutar cada una.')
    when (select verbo from o) = 'quitar_negativa' and (select obj->>'keyword' from o) is not null
      then case when exists (select 1 from negatives n where n.account = p_account
             and lower(n.negative_keyword) = lower((select obj->>'keyword' from o)))
        then jsonb_build_object('ok', true)
        else jsonb_build_object('ok', false, 'que', 'negativa', 'nombre', (select obj->>'keyword' from o),
          'detalle', 'La negativa "' || (select obj->>'keyword' from o) || '" no figura en negatives para ' || p_account ||
            '. Puede que ya se haya quitado, o que el nivel sea distinto del que dice el accionable.',
          'parecidas', (select coalesce(jsonb_agg(x.k), '[]') from (
            select distinct n.negative_keyword k from negatives n where n.account = p_account
            and similarity(n.negative_keyword, (select obj->>'keyword' from o)) > 0.3 order by 1 limit 5) x)) end
    when (select verbo from o) = 'agregar_negativa' then jsonb_build_object('ok', true, 'nota', 'Una negativa nueva no tiene que existir todavia.')
    when (select obj->>'keyword' from o) is not null
      and not exists (select 1 from keywords k where k.account = p_account and lower(k.keyword) = lower((select obj->>'keyword' from o)))
      then jsonb_build_object('ok', false, 'que', 'keyword', 'nombre', (select obj->>'keyword' from o),
        'detalle', 'La keyword "' || (select obj->>'keyword' from o) || '" NO EXISTE en ' || p_account ||
          '. Resolvela contra la base: adivinar un nombre es la regla que mas veces rompio el sistema.',
        'parecidas', (select coalesce(jsonb_agg(x.keyword), '[]') from (
          select distinct k.keyword from keywords k where k.account = p_account
          and similarity(k.keyword, (select obj->>'keyword' from o)) > 0.3 order by 1 limit 5) x))
    when (select obj->>'campana' from o) is not null
      and not exists (select 1 from campaign c where c.account = p_account and lower(c.campaign) = lower((select obj->>'campana' from o)))
      then jsonb_build_object('ok', false, 'que', 'campana', 'nombre', (select obj->>'campana' from o),
        'detalle', 'La campana "' || (select obj->>'campana' from o) || '" NO EXISTE en ' || p_account || '.',
        'parecidas', (select coalesce(jsonb_agg(x.campaign), '[]') from (
          select distinct c.campaign from campaign c where c.account = p_account
          and similarity(c.campaign, (select obj->>'campana' from o)) > 0.3 order by 1 limit 5) x))
    when (select obj->>'grupo' from o) is not null
      and not exists (select 1 from adgroup g where g.account = p_account and lower(g.ad_group) = lower((select obj->>'grupo' from o)))
      then jsonb_build_object('ok', false, 'que', 'grupo', 'nombre', (select obj->>'grupo' from o),
        'detalle', 'El grupo "' || (select obj->>'grupo' from o) || '" NO EXISTE en ' || p_account || '.')
    else jsonb_build_object('ok', true) end;
$$;


ALTER FUNCTION "public"."entidad_existe"("p_account" "text", "p_accion" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."entidad_existe"("p_account" "text", "p_accion" "jsonb") IS 'Verifica que la entidad de una accion exista de verdad. Las invariantes no lo detectan: una keyword inventada pasa limpia porque ninguna invariante matchea. Distingue negativas (viven en negatives) de keywords, y saltea los verbos que no ejecutan.';



CREATE OR REPLACE FUNCTION "public"."estado_de_los_flujos"() RETURNS TABLE("flujo" "text", "cuentas" "text", "quien_escribe" "text", "estado" "text", "ultimo_dato" "text", "lectura" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select 'Extraccion semanal de Google', 'las 4', 'northsignal_semanal en Google Ads, lunes 07:00',
    case when (select max(week_start) from campaign) >= current_date - 14 then 'VIVO' else 'CORTADO' end,
    (select max(week_start)::text from campaign),
    'Es la base de todo el analisis. Si se corta, ningun agente puede juzgar una semana.'
  union all
  select 'Extraccion diaria', 'las 4', 'northsignal_diario en Google Ads, 06:00',
    case when (select max(date) from campaign_daily) >= current_date - 2 then 'VIVO' else 'CORTADO' end,
    (select max(date)::text from campaign_daily),
    'Alimenta el pulso y las anomalias. Los ultimos 2 dias son provisionales.'
  union all
  select 'Centinela intradia', 'las 4', 'centinela en Google Ads, cada 4 horas',
    case when (select max(created_at) from google_live_events) > now() - interval '8 hours' then 'VIVO' else 'CORTADO' end,
    (select max(created_at)::text from google_live_events),
    'Detecta picos de gasto y cambios que Google aplica solo.'
  union all
  select 'Espejo de accionables', 'las 4', 'cron de novedades cada 30 minutos, desde Notion',
    case when (select max(sincronizado) from accionables_espejo) > now() - interval '2 hours' then 'VIVO' else 'CORTADO' end,
    (select max(sincronizado)::text from accionables_espejo),
    'Sin esto la app muestra accionables viejos y el pre-vuelo decide sobre datos desactualizados.'
  union all
  select 'Ejecucion en Google Ads', 'las 4', 'ejecutor en Google Ads, cada hora',
    case when exists (select 1 from acciones_aprobadas where estado='ejecutada' and aprobada_el > now() - interval '30 days')
      then 'VIVO' else 'SIN USO RECIENTE' end,
    (select max(aprobada_el)::text from acciones_aprobadas where estado='ejecutada'),
    'Lee v_acciones_pendientes. Si no hay ejecuciones, puede ser que no haya nada que ejecutar, no que este roto.'
  union all
  select 'Cierres reales del negocio', 'BHI (GoHighLevel), 360 (Asana)', 'webhooks a /api/webhooks',
    case when (select count(*) from funnel_events) > 0 then 'VIVO' else 'NUNCA RECIBIO NADA' end,
    coalesce((select max(created_at)::text from funnel_events), 'ningun evento'),
    'ATENCION: las reglas de 360 mandan usar v_cierres_totales y de BHI dicen que la verdad esta en GoHighLevel, pero ningun webhook entrego nunca un evento. El agente busca ahi y no encuentra: tiene que saber que el flujo no esta conectado, no que no hubo cierres.'
  union all
  select 'Notas entre Andres y los agentes', 'las 4', 'el asistente de la app escribe, el agente lee al empezar',
    case when exists (select 1 from notas_para_agentes) then 'VIVO' else 'sin uso todavia' end,
    (select max(creada)::text from notas_para_agentes),
    'Pendientes: ' || (select count(*)::text from v_notas_pendientes) || '. Se leen al EMPEZAR la corrida.'
  union all
  select 'Memoria semantica', 'las 4', 'cron 06:50 calcula embeddings de lecciones y reflexiones',
    case when not exists (select 1 from v_memoria_pendiente) then 'VIVO' else 'CON PENDIENTES' end,
    (select max(fecha)::text from memoria),
    'parecido_a la consulta. Excluye lo que esta en cuarentena.';
$$;


ALTER FUNCTION "public"."estado_de_los_flujos"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."estado_de_los_flujos"() IS 'Cada flujo de datos del sistema con quien lo escribe, si esta vivo y que significa que este cortado. Nacio de descubrir que los webhooks de cierres nunca recibieron un evento mientras las reglas de dos cuentas mandan usar esos datos.';



CREATE OR REPLACE FUNCTION "public"."evaluar_predicciones"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."evaluar_predicciones"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exigir_control_al_cerrar"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n_controles int; n_probados int;
begin
  if new.estado = 'resuelto' and coalesce(old.estado,'') <> 'resuelto'
     and new.tipo in ('bug','dato_incorrecto') then
    select count(*), count(*) filter (where r.mutante_resultado in ('mato_al_mutante','responde_al_inverso'))
      into n_controles, n_probados
      from controles_de_ticket ct
      join relaciones_verdad r on r.id = ct.relacion_id and r.activa
     where ct.ticket_id = new.id;

    if n_controles = 0 then
      raise exception 'El ticket % no se puede cerrar: ningun control vigila que vuelva. Ata una relacion en controles_de_ticket, o cerralo como "no_aplica" en vez de "resuelto".', new.id;
    end if;
    if n_probados = 0 then
      raise exception 'El ticket % tiene % control(es) pero ninguno probo que responde al dato. Corre su mutante (o su inverso, si la relacion ya esta en rojo) y dejalo en mutante_resultado.', new.id, n_controles;
    end if;
    if new.auditoria_de_escape is null then
      raise exception 'El ticket % necesita auditoria_de_escape antes de cerrar: si habia un control que cubriera esto, por que paso en verde, y que cambia para que no escape otra vez.', new.id;
    end if;
  end if;

  if coalesce(old.estado,'') = 'resuelto' and new.estado = 'abierto' then
    new.veces_reabierto := coalesce(old.veces_reabierto, 0) + 1;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."exigir_control_al_cerrar"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."exigir_control_al_cerrar"() IS 'Un ticket de bug no cierra hasta que exista una relacion que atrape su regreso, esa relacion haya matado a su mutante, y esten respondidas las tres preguntas del escape. Es la regla que convierte los detectores sueltos en un ciclo.';



CREATE OR REPLACE FUNCTION "public"."explicar_accionable"("p_notion_id" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select jsonb_build_object(
    'titulo', a.titulo, 'cuenta', a.account, 'estado', a.estado,
    'prioridad', a.prioridad, 'naturaleza', a.naturaleza,
    'quien_lo_propuso', coalesce(a.origen, 'sin registrar'),
    'cuando', a.detectado,
    'el_razonamiento', a.por_que,
    'causa_raiz', a.causa_raiz,
    'sobre_que_entidad', a.entidad,
    'como_hacerlo', a.como_hacerlo,
    'donde', a.donde,
    'se_puede_ejecutar', jsonb_build_object(
      'si_o_no', coalesce(a.accion_valida, false) and exists (
        select 1 from capacidades_ejecucion c where c.verbo = a.accion->>'verbo' and c.plataforma='google' and c.ejecutable),
      'verbo', a.accion->>'verbo',
      'por_que_no', case
        when a.accion is null then 'No tiene Accion JSON: el agente no lo dejo ejecutable. Si el verbo era ejecutable, es un error del agente y aparece en v_ejecucion_perdida.'
        when not coalesce(a.accion_valida, false) then a.accion_error
        when not exists (select 1 from capacidades_ejecucion c where c.verbo = a.accion->>'verbo' and c.plataforma='google' and c.ejecutable)
          then coalesce((select por_que_no from capacidades_ejecucion c where c.verbo = a.accion->>'verbo' and c.plataforma='google'), 'verbo desconocido')
        else null end,
      'accion', a.accion),
    'lo_frena_algo', prevuelo(a.notion_id),
    'invariantes', case when a.accion is not null then verificar_invariantes(a.account, a.accion) else null end,
    'que_paso_con_cambios_parecidos', (
      select coalesce(jsonb_agg(jsonb_build_object('cuando', o.fecha, 'que', left(o.que_cambio, 140), 'por_que', left(o.por_que, 140))), '[]')
      from (select * from operator_log o2 where o2.account = a.account and o2.fecha > current_date - 60 order by o2.fecha desc limit 5) o),
    'lecciones_relacionadas', (
      select coalesce(jsonb_agg(left(l.leccion, 250)), '[]')
      from (select * from v_lecciones_vigentes l2 where (l2.account = a.account or l2.account is null)
            and coalesce(l2.confianza,0) >= 0.85 order by l2.fecha desc limit 4) l),
    'reglas_de_la_cuenta', (select left(reglas_dominio, 900) from cuentas c where c.account = a.account),
    'url_en_notion', a.url)
  from accionables_espejo a where a.notion_id = p_notion_id;
$$;


ALTER FUNCTION "public"."explicar_accionable"("p_notion_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."explicar_accionable"("p_notion_id" "text") IS 'Todo lo que se sabe de un accionable para poder explicar su razonamiento SIN inventarlo: quien lo propuso, con que evidencia, que invariantes toca, si se puede ejecutar y por que no, y que paso con cambios parecidos.';



CREATE OR REPLACE FUNCTION "public"."filtrar_hallazgos_a_accionables"("p_account" "text", "p_fecha" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_conf numeric; v_sev numeric; v_max int; v_out jsonb;
begin
  select valor into v_conf from filtro_umbrales where clave = 'confianza_minima';
  select valor into v_sev from filtro_umbrales where clave = 'severidad_minima';
  select valor into v_max from filtro_umbrales where clave = 'max_accionables_dia_cuenta';
  select coalesce(jsonb_agg(h), '[]') into v_out from (
    select h from pulso_diario p, jsonb_array_elements(p.hallazgos) h
    where p.account = p_account and p.fecha = p_fecha
      and (h->>'confianza')::numeric >= v_conf
      and (case h->>'severidad' when 'baja' then 1 when 'media' then 2 when 'alta' then 3 when 'critica' then 4 else 0 end) >= v_sev
      and (h ? 'entidad') and length(coalesce(h->>'evidencia_texto', '')) > 40
    order by (case h->>'severidad' when 'critica' then 4 when 'alta' then 3 when 'media' then 2 else 1 end) desc, (h->>'confianza')::numeric desc
    limit v_max
  ) x;
  return v_out;
end $$;


ALTER FUNCTION "public"."filtrar_hallazgos_a_accionables"("p_account" "text", "p_fecha" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."filtrar_hallazgos_a_accionables"("p_account" "text", "p_fecha" "date") IS 'Filtro determinista de hallazgos a accionables. Umbrales en filtro_umbrales. El modelo detecta; esto decide.';



CREATE OR REPLACE FUNCTION "public"."get_briefing"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select jsonb_build_object(
    'fecha', current_date, 'es_lunes', extract(dow from current_date) = 1,
    -- Agrupadas: 16 avisos de AI Max del mismo dia son UN hecho en 16 campanas.
    -- Sueltas, tapaban todo lo demas del correo.
    'alertas_hoy', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'titulo', titulo,
        'cuantas', cuantas, 'detalle', left(detalle, 180))), '[]') from v_alertas_agrupadas where nivel = 'hoy'),
    'alertas_semana', (select count(*) from v_alertas_agrupadas where nivel = 'semana'),
    'orden_del_dia', (select coalesce(jsonb_object_agg(bloque, n), '{}') from
      (select bloque, count(*) n from orden_del_dia() group by 1) o),
    'accionables_listos', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', cuenta, 'titulo', titulo)), '[]')
      from orden_del_dia() where bloque = 'Un clic'),
    'accionables_por_confirmar', (select count(*) from accionables_espejo where estado = 'Bloqueado' and reemplazado_por is null),
    'reportes_por_aprobar', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'periodo', periodo_desde || ' a ' || periodo_hasta)), '[]') from reportes_cliente where estado = 'borrador'),
    'pulsos_ayer', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'nivel', nivel, 'hallazgo', hallazgo_principal)), '[]') from pulso_diario where fecha = current_date - 1),
    'datos_al_dia', (select bool_and(coalesce(estado, 'OK') = 'OK') from v_data_health),
    'flujos_cortados', (select coalesce(jsonb_agg(jsonb_build_object('flujo', flujo, 'lectura', left(lectura, 150))), '[]')
      from estado_de_los_flujos() where estado in ('CORTADO','NUNCA RECIBIO NADA')),
    'respuestas_de_agentes', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', cuenta, 'pregunta', left(pregunta,100), 'respuesta', left(respuesta,220))), '[]')
      from v_respuestas_de_agentes where cuando > now() - interval '1 day'),
    'impactos_nuevos', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'titulo', titulo, 'veredicto', veredicto, 'variacion', variacion_pct)), '[]') from v_impacto_accionables where ejecutado_el = current_date - 14),
    'tickets_respondidos', (select count(*) from tickets where estado = 'resuelto' and resuelto_el >= now() - interval '1 day')
  );
$$;


ALTER FUNCTION "public"."get_briefing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_contexto_sistema"("p_cuenta" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
select jsonb_build_object(
  'al', now(),
  'como_usar_esto', 'Estado vivo del sistema, generado al momento. No lo copies a un archivo: se consulta cada vez porque cambia todos los dias.',
  'empeza_por_aca', 'Lee ultima_sesion para entender la trama, despues salud para el estado, despues cambios_recientes para no deshacer lo recien hecho. Al terminar: registrar_cambio(que, por_que, objetos, version, revierte_como).',

  'ultima_sesion', (select jsonb_build_object(
      'fecha', fecha, 'titulo', titulo, 'versiones', desde_version || ' a ' || hasta_version,
      'con_que_empezo', con_que_empezo, 'que_se_construyo', que_se_construyo,
      'que_se_aprendio', que_se_aprendio, 'que_quedo_pendiente', que_quedo_pendiente)
    from v_ultima_sesion),

  'salud', get_salud_sistema(),
  'completitud_por_cuenta', (select coalesce(jsonb_object_agg(account, faltantes), '{}')
    from (select account, jsonb_agg(requisito) faltantes from v_cuentas_incompletas group by account) z),
  'cambios_recientes', (select coalesce(jsonb_agg(jsonb_build_object('cuando', cuando, 'que', que, 'por_que', left(por_que, 300), 'version', version) order by cuando desc), '[]') from v_cambios_recientes),

  'cuentas', (select coalesce(jsonb_agg(jsonb_build_object(
      'account', c.account, 'cliente', c.nombre_cliente, 'moneda', c.moneda, 'zona', c.zona_horaria,
      'perfil', c.perfil_analisis, 'cid', c.cid, 'plataformas', c.plataformas,
      'paquete_a_usar', case when c.perfil_analisis = 'cadena' then 'get_weekly_package_cadena' else 'get_weekly_package' end,
      'reglas_propias', c.reglas_dominio,
      'reporte_va_a', array_to_string(c.destinatarios_reporte, ', ') || ' (Andres lo reenvia; el texto se redacta para el cliente)',
      'semanas_de_historia', (select count(distinct week_start) from campaign w where w.account = c.account),
      'dias_capa_diaria', (select dias_en_30d from v_ventana_real v where v.account = c.account),
      'cpa_inflado_por_primarias', (select factor_de_inflado from v_primarias_solapadas p where p.account = c.account),
      'accionables_abiertos', (select count(*) from accionables_espejo a where a.account = c.account and a.estado in ('Propuesto','Bloqueado','Aprobado','En curso'))
    ) order by c.account), '[]') from cuentas c where c.activa),

  'flujos_de_datos', (select coalesce(jsonb_agg(jsonb_build_object('flujo', flujo, 'quien_escribe', quien_escribe, 'estado', estado, 'ultimo', ultimo_dato)), '[]') from estado_de_los_flujos()),

  'que_puede_ejecutar_un_script', (select jsonb_build_object(
      'ejecutables', (select jsonb_agg(jsonb_build_object('verbo', verbo, 'plataforma', plataforma, 'riesgo', riesgo, 'requiere', requiere) order by plataforma, riesgo, verbo) from capacidades_ejecucion where ejecutable),
      'no_ejecutables', (select jsonb_agg(jsonb_build_object('verbo', verbo, 'plataforma', plataforma, 'por_que', por_que_no) order by plataforma, verbo) from capacidades_ejecucion where not ejecutable))),

  'guardarrailes', jsonb_build_object(
    'antes_de_analizar', 'corrida_redundante(cuenta), v_notas_pendientes, completitud_de_cuenta(cuenta)',
    'antes_de_proponer', 'entidad_existe(cuenta, accion) para no adivinar nombres, verificar_invariantes(cuenta, accion)',
    'antes_de_ejecutar', 'prevuelo(notion_id): conflictos, fecha de espera, cambio estructural en 3 dias, invariantes',
    'antes_de_citar_un_numero', 'v_ventana_real (la capa diaria tiene 15-17 dias, no 30) y v_primarias_solapadas (BHI infla el CPA 2,4x)',
    'antes_de_abrir_un_ticket', 'Buscar en tickets abiertos de TODAS las cuentas: el mismo bug se reporto dos veces',
    'meta', 'puede_escribir_en(cuenta, meta): 30 cambios por hora deshabilitan la cuenta'),

  'donde_esta_cada_cosa', jsonb_build_object(
    'catalogo', 'select * from diccionario_datos() — 142 objetos con para que sirve cada uno',
    'estado_de_una_cuenta', 'get_estado_cuenta(cuenta), incluye vacios_explicados',
    'que_le_falta_a_una_cuenta', 'completitud_de_cuenta(cuenta)',
    'lecciones', 'v_lecciones_vigentes, NUNCA la tabla lecciones',
    'historia_de_construccion', 'sesiones y cambios_de_sistema',
    'codigo', 'GitHub northsignal-market/app.northsignal, legible por el conector MCP',
    'respaldo_del_esquema', 'Sistema > Salud en la app'),

  'aprendido', (select coalesce(jsonb_agg(jsonb_build_object('leccion', left(l.leccion, 380), 'confianza', l.confianza) order by l.confianza desc nulls last, l.fecha desc), '[]')
    from (select * from v_lecciones_vigentes l2 where coalesce(l2.confianza, 0) >= 0.9
          and (p_cuenta is null or l2.account is null or l2.account = p_cuenta)
          order by l2.confianza desc nulls last, l2.fecha desc limit 15) l),

  'tickets_abiertos', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'cuenta', t.cuenta, 'titulo', t.titulo) order by t.id), '[]')
    from tickets t where t.estado = 'abierto'),

  'detalle_de_cuenta', case when p_cuenta is null then null else jsonb_build_object(
      'estado', get_estado_cuenta(p_cuenta),
      'completitud', (select coalesce(jsonb_agg(jsonb_build_object('requisito', requisito, 'cumple', cumple, 'detalle', detalle)), '[]') from completitud_de_cuenta(p_cuenta)),
      'doc_maestro', (select jsonb_object_agg(seccion, left(contenido, 1500)) from doc_maestro_humano where account = p_cuenta and vigente)) end
);
$$;


ALTER FUNCTION "public"."get_contexto_sistema"("p_cuenta" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_contexto_sistema"("p_cuenta" "text") IS 'Estado vivo del sistema para cualquier chat que empiece de cero. Se consulta, no se copia a un archivo: un documento de contexto viejo enganna mas que un vacio. Sin argumento da el panorama; con una cuenta agrega su detalle.';



CREATE OR REPLACE FUNCTION "public"."get_cuenta"("p_account" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select to_jsonb(c) from cuentas c where c.account = p_account;
$$;


ALTER FUNCTION "public"."get_cuenta"("p_account" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_doc_maestro"("p_account" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."get_doc_maestro"("p_account" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_doc_maestro"("p_account" "text") IS 'Doc maestro ensamblado: capa humana (editable, versionada) + calculadas (SQL, sin LLM) + consolidada (espejo de Notion). La tarea semanal lee esto. Tamano acotado.';



CREATE OR REPLACE FUNCTION "public"."get_entidades"("p_entidad" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text" DEFAULT NULL::"text", "p_order_by" "text" DEFAULT 'cost'::"text", "p_order_dir" "text" DEFAULT 'desc'::"text", "p_limit" integer DEFAULT 1000, "p_offset" integer DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_sql text; v_where text; v_search text := '';
  v_data json; v_total int; v_totals json; v_dias int;
begin
  if p_entidad not in ('campaign','adgroup','keyword','search_term') then
    raise exception 'Entidad no permitida: %', p_entidad;
  end if;
  v_where := format('account = %L and date between %L and %L', p_account, p_from, p_to);

  -- Cuantos dias del rango tienen datos: para saber si el rango esta completo
  select count(distinct date) into v_dias from campaign_daily
    where account = p_account and date between p_from and p_to;

  if p_entidad = 'campaign' then
    if p_search is not null and p_search <> '' then v_search := format(' and campaign ilike %L', '%'||p_search||'%'); end if;
    v_sql := format($q$
      select campaign, max(status) as status, max(bid_strategy) as bid_strategy, max(currency) as currency,
             sum(impressions) as impressions, sum(clicks) as clicks, round(sum(cost),2) as cost,
             round(sum(conversions),2) as conversions,
             round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
             round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc,
             round(sum(cost)/nullif(sum(conversions),0),2) as cost_per_conv,
             round(sum(conversions)/nullif(sum(clicks),0)*100,2) as conv_rate,
             round(sum(impr_share*impressions)/nullif(sum(impressions),0),1) as impr_share,
             round(sum(lost_is_budget*impressions)/nullif(sum(impressions),0),1) as lost_is_budget,
             round(sum(lost_is_rank*impressions)/nullif(sum(impressions),0),1) as lost_is_rank,
             case when sum(coalesce(lost_is_budget,0)*impressions) > sum(coalesce(lost_is_rank,0)*impressions) then 'presupuesto' else 'ranking' end as limitada_por,
             count(distinct date) as dias_con_datos
      from campaign_daily where %s %s group by campaign$q$, v_where, v_search);

  elsif p_entidad = 'adgroup' then
    if p_search is not null and p_search <> '' then v_search := format(' and ad_group ilike %L', '%'||p_search||'%'); end if;
    v_sql := format($q$
      select ad_group, campaign, max(ad_group_status) as ad_group_status, max(currency) as currency,
             sum(impressions) as impressions, sum(clicks) as clicks, round(sum(cost),2) as cost,
             round(sum(conversions),2) as conversions,
             round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
             round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc,
             round(sum(cost)/nullif(sum(conversions),0),2) as cost_per_conv,
             round(sum(conversions)/nullif(sum(clicks),0)*100,2) as conv_rate,
             round(sum(impr_share*impressions)/nullif(sum(impressions),0),1) as impr_share,
             count(distinct date) as dias_con_datos
      from adgroup_daily where %s %s group by ad_group, campaign$q$, v_where, v_search);

  elsif p_entidad = 'keyword' then
    if p_search is not null and p_search <> '' then v_search := format(' and keyword ilike %L', '%'||p_search||'%'); end if;
    v_sql := format($q$
      select keyword, match_type, ad_group, campaign, max(keyword_status) as keyword_status,
             max(serving_status) as serving_status, max(currency) as currency,
             sum(impressions) as impressions, sum(clicks) as clicks, round(sum(cost),2) as cost,
             round(sum(conversions),2) as conversions,
             round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
             round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc,
             round(sum(cost)/nullif(sum(conversions),0),2) as cost_per_conv,
             round(sum(conversions)/nullif(sum(clicks),0)*100,2) as conv_rate,
             round(sum(quality_score*impressions)/nullif(sum(impressions),0),1) as quality_score,
             round(sum(impr_share*impressions)/nullif(sum(impressions),0),1) as impr_share,
             count(distinct date) as dias_con_datos
      from keywords_daily where %s %s group by keyword, match_type, ad_group, campaign$q$, v_where, v_search);

  else
    if p_search is not null and p_search <> '' then v_search := format(' and search_term ilike %L', '%'||p_search||'%'); end if;
    v_sql := format($q$
      select search_term, match_type, triggered_keyword, ad_group, campaign, max(currency) as currency,
             sum(impressions) as impressions, sum(clicks) as clicks, round(sum(cost),2) as cost,
             round(sum(conversions),2) as conversions,
             round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
             round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc,
             round(sum(cost)/nullif(sum(conversions),0),2) as cost_per_conv,
             case when sum(conversions) > 0 then 'convierte'
                  when sum(cost) > 0 then 'gasta sin convertir' else 'sin gasto' end as clasificacion,
             count(distinct date) as dias_con_datos
      from search_terms_daily where %s %s group by search_term, match_type, triggered_keyword, ad_group, campaign$q$, v_where, v_search);
  end if;

  -- Orden: solo columnas conocidas
  if coalesce(p_order_by, '') not in ('cost','clicks','impressions','conversions','ctr','avg_cpc','cost_per_conv','conv_rate','impr_share','quality_score','lost_is_budget','lost_is_rank','campaign','ad_group','keyword','search_term','dias_con_datos') then
    p_order_by := 'cost';
  end if;

  execute format('select count(*) from (%s) s', v_sql) into v_total;

  execute format($t$select row_to_json(t) from (
    select count(*) as filas, round(coalesce(sum(cost),0),2) as cost, coalesce(sum(clicks),0) as clicks,
           coalesce(sum(impressions),0) as impressions, round(coalesce(sum(conversions),0),2) as conversions,
           round(sum(cost)/nullif(sum(conversions),0),2) as cpa,
           round(sum(clicks)::numeric/nullif(sum(impressions),0)*100,2) as ctr,
           round(sum(cost)/nullif(sum(clicks),0),2) as avg_cpc
    from (%s) s) t$t$, v_sql) into v_totals;

  execute format('select coalesce(json_agg(row_to_json(t)), ''[]''::json) from (select * from (%s) s order by %I %s nulls last limit %s offset %s) t',
                 v_sql, p_order_by, case when lower(coalesce(p_order_dir, 'desc'))='asc' then 'asc' else 'desc' end, greatest(coalesce(p_limit, 1000), 1), greatest(coalesce(p_offset, 0), 0)) into v_data;

  return json_build_object('data', v_data, 'total', v_total, 'totals', v_totals,
                           'dias_con_datos', v_dias, 'dias_en_rango', (p_to - p_from + 1),
                           'rango_completo', v_dias = (p_to - p_from + 1));
end;
$_$;


ALTER FUNCTION "public"."get_entidades"("p_entidad" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_entidades"("p_entidad" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) IS 'Entidades (campaign, adgroup, keyword, search_term) con metricas sumadas en cualquier rango de fechas, desde la capa diaria. Tasas recalculadas sobre sumas; impression share y QS ponderados por impresiones. Devuelve dias_con_datos vs dias_en_rango para saber si el rango esta cubierto. Es la forma correcta de responder a un selector de fechas arbitrario, como Google Ads.';



CREATE OR REPLACE FUNCTION "public"."get_estado_cuenta"("p_account" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select (get_estado_cuenta_base(p_account))::jsonb
    || jsonb_build_object('vacios_explicados', por_que_esta_vacio(p_account))
    -- Lo que Andres le pregunto o indico al asistente y todavia nadie atendio.
    -- Sin esto una conversacion con el asistente muere ahi y el agente vuelve a
    -- analizar lo de siempre sin saber que a Andres le preocupa otra cosa.
    || jsonb_build_object('notas_de_andres', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', n.id, 'cuando', n.creada, 'tipo', n.tipo, 'dice', n.contenido,
          'dias_esperando', round(extract(epoch from (now() - n.creada))/86400.0, 1))
          order by n.creada), '[]')
        from notas_para_agentes n
        where n.atendida_el is null and (n.account = p_account or n.account is null)));
$$;


ALTER FUNCTION "public"."get_estado_cuenta"("p_account" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_estado_cuenta"("p_account" "text") IS 'La foto unica de la cuenta: lo primero que se lee en cualquier corrida. Incluye vacios_explicados (por que esta vacio lo que este vacio) y notas_de_andres (lo que pregunto o indico al asistente y nadie atendio todavia).';



CREATE OR REPLACE FUNCTION "public"."get_estado_cuenta_base"("p_account" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select (
    select jsonb_build_object(
    'cuenta', p_account, 'foto_tomada', now(),
    'ultima_extraccion', (select jsonb_build_object('diaria', max(date), 'semanal', (select max(week_start) from campaign where account = p_account)) from campaign_daily where account = p_account),
    'plan_vigente', (select jsonb_build_object('id', id, 'semana', semana, 'contexto', contexto, 'indicadores', indicadores, 'hipotesis', hipotesis, 'condiciones_escalamiento', condiciones_escalamiento, 'escrito_el', escrito_el) from plan_semanal where account = p_account and semana <= current_date order by semana desc limit 1),
    'accionables_abiertos', accionables_vigentes(p_account),
    'accionables_hechos_14d', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'ejecutado_el', ejecutado_el, 'entidad', entidad)), '[]') from accionables_espejo where account = p_account and estado = 'Hecho' and ejecutado_el >= current_date - 14),
    'relaciones_abiertas', (select coalesce(jsonb_agg(jsonb_build_object('a', a, 'b', b, 'tipo', tipo, 'severidad', severidad, 'motivo', motivo)), '[]') from accionable_relaciones where account = p_account and not resuelta),
    'pulsos_recientes', (select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'nivel', nivel, 'hallazgo', hallazgo_principal, 'evidencia', evidencia, 'hipotesis_movidas', hipotesis_movidas) order by fecha desc), '[]') from (select * from pulso_diario where account = p_account order by fecha desc limit 7) p),
    'alertas_abiertas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nivel', nivel, 'tipo', tipo, 'titulo', titulo, 'entidad', entidad, 'fecha', fecha_dato)), '[]') from alertas where account = p_account and estado in ('abierta','vista')),
    'operator_log_14d', (select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'que', que_cambio, 'donde', donde, 'por_que', por_que) order by fecha desc), '[]') from operator_log where account = p_account and fecha >= current_date - 14),
    'cambios_google_7d', (select coalesce(jsonb_agg(jsonb_build_object('fecha', event_date, 'entidad', entity_name, 'tipo', event_type, 'quien', user_email)), '[]') from google_live_events where account = p_account and event_type in ('USER_CHANGE','AUTO_CHANGE') and event_date >= now() - interval '7 days'),
    'reflexiones_vigentes', (select coalesce(jsonb_agg(que_haria_distinto order by run_date desc), '[]') from (select que_haria_distinto, run_date from reflexiones where account = p_account order by run_date desc limit 5) r),
    'hipotesis_consolidadas', (select hipotesis_abiertas from doc_maestro_consolidado where account = p_account limit 1),
    'objetivos', (select jsonb_build_object('cpa_max', cpa_maximo, 'conv_mes', conversiones_mes_objetivo, 'provisional', cpa_maximo_origen = 'historico', 'ambicion_90d', conv_mes_objetivo_90d) from account_targets where account = p_account),
    'brecha', (select jsonb_build_object('conv_mes_actual', conv_mes_actual, 'objetivo', coalesce(conv_mes_objetivo_90d, conv_mes_objetivo), 'brecha', brecha_conv_mes, 'dias_restantes', dias_restantes, 'lectura', lectura) from v_brecha_objetivo where account = p_account),
    'reglas', (select reglas_dominio from cuentas where account = p_account),
    'por_que_limitada', (select jsonb_build_object('qs_ponderado', qs_ponderado, 'por_que', por_que, 'pct_landing', pct_gasto_lp_baja, 'pct_relevancia', pct_gasto_rel_baja, 'pct_ctr', pct_gasto_ctr_bajo, 'peores', peores) from v_por_que_limitada where account = p_account),
    'predicciones_pendientes', (select coalesce(jsonb_agg(jsonb_build_object('semana', semana, 'metrica', metrica, 'rango', valor_min || '-' || valor_max, 'prob', probabilidad, 'acerto', acerto, 'real', valor_real) order by semana desc), '[]') from (select * from predicciones where account = p_account order by semana desc limit 4) x),
    'calibracion', (select jsonb_agg(jsonb_build_object('metrica', metrica, 'n', n, 'prometido', confianza_prometida_pct, 'real', acierto_real_pct, 'veredicto', veredicto)) from v_calibracion where account = p_account),
    'lecciones', (select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'leccion', leccion, 'contexto', contexto, 'confianza', confianza, 'veces', veces_confirmada) order by confianza desc, veces_confirmada desc), '[]') from (select * from lecciones where (account = p_account or account is null) and confianza >= 0.5 order by confianza desc limit 8) l),
    'acierto_por_tipo', (select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'n', n, 'veredicto', veredicto, 'variacion', variacion_promedio_pct)), '[]') from v_acierto_por_tipo where account = p_account),
    'conocimiento_vigente', (select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'tema', tema, 'titulo', titulo, 'accion', accion_derivada, 'fuente', fuente_tipo) order by fecha desc), '[]') from (select * from conocimiento_externo where ('TODAS' = any(aplica_a) or p_account = any(aplica_a)) and (vigente_hasta is null or vigente_hasta >= current_date - 30) order by fecha desc limit 8) k),
    'propuestas_abiertas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'titulo', titulo, 'estado', estado, 'fecha', fecha, 'resultado_esperado', resultado_esperado) order by fecha desc), '[]') from propuestas_estrategicas where account = p_account and estado in ('propuesta','aprobada','en_test'))
  ));
$$;


ALTER FUNCTION "public"."get_estado_cuenta_base"("p_account" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pulso_input"("p_account" "text", "p_fecha" "date" DEFAULT (CURRENT_DATE - 1)) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select jsonb_build_object(
    'cuenta', p_account, 'fecha_analizada', p_fecha,
    'plan', (select jsonb_build_object('id', id, 'semana', semana, 'contexto', contexto, 'indicadores', indicadores, 'hipotesis', hipotesis, 'condiciones_escalamiento', condiciones_escalamiento) from plan_semanal where account = p_account and semana <= p_fecha order by semana desc limit 1),
    'leading_7d', (select coalesce(jsonb_agg(to_jsonb(l) - 'account' order by date), '[]') from v_leading_indicators_diarios l where account = p_account and date between p_fecha - 6 and p_fecha),
    'serie_7d', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'gasto', gasto, 'clics', clics, 'conv', conversiones, 'cpa', cpa, 'madurez', madurez) order by date), '[]') from v_serie_diaria where account = p_account and date between p_fecha - 6 and p_fecha),
    'anomalias_2d', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'sev', severidad, 'metrica', metrica_anomala, 'explicacion', explicacion)), '[]') from v_anomalia_explicada where account = p_account and date between p_fecha - 1 and p_fecha),
    'conv_por_grupo_3d', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'grupo', ad_group, 'conv', conv) order by date, ad_group), '[]') from (select date, ad_group, sum(conversions) conv from v_conversiones_por_grupo where account = p_account and date between p_fecha - 2 and p_fecha group by 1, 2) g),
    'grupos_ayer', (select coalesce(jsonb_agg(jsonb_build_object('grupo', ad_group, 'clics', clicks, 'gasto', round(cost, 2), 'conv', conversions, 'conv_rate', round(conversions / nullif(clicks, 0) * 100, 1)) order by cost desc), '[]') from adgroup_daily where account = p_account and date = p_fecha and cost > 0),
    'cambios_detectados', (select coalesce(jsonb_agg(jsonb_build_object('entidad', entity_name, 'tipo', entity_type, 'campos', campos_cambiados)), '[]') from v_cambios_detectados where account = p_account and detectado_hasta >= p_fecha),
    'operator_log_2d', (select coalesce(jsonb_agg(jsonb_build_object('d', fecha, 'que', left(que_cambio, 200), 'donde', donde) order by fecha desc), '[]') from operator_log where account = p_account and fecha >= p_fecha - 1),
    'cambios_google_ayer', (select coalesce(jsonb_agg(jsonb_build_object('entidad', entity_name, 'tipo', event_type, 'quien', user_email)), '[]') from google_live_events where account = p_account and event_type in ('USER_CHANGE','AUTO_CHANGE') and event_date::date = p_fecha),
    'terminos_nuevos_con_gasto', (select coalesce(jsonb_agg(jsonb_build_object('t', search_term, 'kw', keyword_disparadora, 'grupo', ad_group, 'gasto', gasto_acumulado, 'conv', conversiones_acumuladas) order by gasto_acumulado desc), '[]') from (select * from v_terminos_nuevos where account = p_account and primera_aparicion = p_fecha and gasto_acumulado > 0 limit 10) t),
    'pulsos_previos_3d', (select coalesce(jsonb_agg(jsonb_build_object('d', fecha, 'nivel', nivel, 'hallazgo', hallazgo_principal, 'evidencia', evidencia) order by fecha desc), '[]') from pulso_diario where account = p_account and fecha between p_fecha - 3 and p_fecha - 1),
    'reflexiones_recientes', (select coalesce(jsonb_agg(que_haria_distinto order by run_date desc), '[]') from (select que_haria_distinto, run_date from reflexiones where account = p_account order by run_date desc limit 5) r),
    'objetivos', (select jsonb_build_object('cpa_max', cpa_maximo, 'conv_mes', conversiones_mes_objetivo, 'provisional', cpa_maximo_origen = 'historico') from account_targets where account = p_account)
  );
$$;


ALTER FUNCTION "public"."get_pulso_input"("p_account" "text", "p_fecha" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pulso_input"("p_account" "text", "p_fecha" "date") IS 'Paquete de entrada para el pulso diario de Gemini: todo lo relevante de ayer en un JSON de ~4-5k tokens. Una llamada, tamano constante.';



CREATE OR REPLACE FUNCTION "public"."get_reporte_datos"("p_account" "text", "p_desde" "date", "p_hasta" "date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with act as (select sum(gasto) cost, sum(conversiones) conversions, sum(clics) clicks, sum(impresiones) impressions from v_serie_diaria where account = p_account and date between p_desde and p_hasta),
  ant as (select sum(gasto) cost, sum(conversiones) conversions, sum(clics) clicks, sum(impresiones) impressions from v_serie_diaria where account = p_account and date between p_desde - (p_hasta - p_desde + 1) and p_desde - 1),
  is_act as (select round(sum(impr_share * impressions) / nullif(sum(impressions), 0), 1) impr_share from campaign_daily where account = p_account and date between p_desde and p_hasta),
  camp as (select * from jsonb_to_recordset(((get_entidades('campaign', p_account, p_desde, p_hasta))::jsonb)->'data') as x(campaign text, cost numeric, conversions numeric, cost_per_conv numeric, ctr numeric)),
  grp as (select * from jsonb_to_recordset(((get_entidades('adgroup', p_account, p_desde, p_hasta))::jsonb)->'data') as x(ad_group text, campaign text, cost numeric, conversions numeric, cost_per_conv numeric))
  select jsonb_build_object(
    'metricas', jsonb_build_object(
      'cost', jsonb_build_object('actual', round(a.cost, 2), 'anterior', round(n.cost, 2)),
      'conversions', jsonb_build_object('actual', round(a.conversions, 1), 'anterior', round(n.conversions, 1)),
      'cpa', jsonb_build_object('actual', round(a.cost / nullif(a.conversions, 0), 2), 'anterior', round(n.cost / nullif(n.conversions, 0), 2)),
      'ctr', jsonb_build_object('actual', round(a.clicks::numeric / nullif(a.impressions, 0) * 100, 2), 'anterior', round(n.clicks::numeric / nullif(n.impressions, 0) * 100, 2)),
      'clicks', jsonb_build_object('actual', a.clicks, 'anterior', n.clicks),
      'impr_share', jsonb_build_object('actual', i.impr_share, 'anterior', null)),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object('d', date, 'conv', conversiones, 'cpa', cpa, 'gasto', gasto, 'madurez', madurez) order by date), '[]') from v_serie_diaria where account = p_account and date between p_hasta - 13 and p_hasta),
    'campanas', (select coalesce(jsonb_agg(jsonb_build_object('nombre', campaign, 'gasto', cost, 'conv', conversions, 'cpa', cost_per_conv, 'ctr', ctr) order by cost desc), '[]') from camp where cost > 0),
    'grupos', (select coalesce(jsonb_agg(jsonb_build_object('nombre', ad_group, 'campana', campaign, 'gasto', cost, 'conv', conversions, 'cpa', cost_per_conv) order by cost desc), '[]') from (select * from grp where cost > 0 order by cost desc limit 12) g),
    'accionables_ejecutados', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'ejecutado', ejecutado_el, 'veredicto', veredicto, 'variacion', variacion_pct) order by ejecutado_el desc), '[]') from v_impacto_accionables where account = p_account and ejecutado_el between p_desde - 14 and p_hasta)
  ) from act a, ant n, is_act i;
$$;


ALTER FUNCTION "public"."get_reporte_datos"("p_account" "text", "p_desde" "date", "p_hasta" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_salud_sistema"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select jsonb_build_object('al', now(),
    'veredicto', case when exists (select 1 from v_salud_sistema where estado = 'FALLA') then 'hay algo roto'
      when exists (select 1 from v_salud_sistema where estado = 'ATENCION') then 'funciona, con cosas para mirar' else 'todo bien' end,
    'fallas', (select coalesce(jsonb_agg(jsonb_build_object('area', area, 'prueba', prueba, 'cuenta', cuenta, 'detalle', detalle)), '[]') from v_salud_sistema where estado = 'FALLA'),
    'atencion', (select coalesce(jsonb_agg(jsonb_build_object('area', area, 'prueba', prueba, 'cuenta', cuenta, 'detalle', detalle)), '[]') from v_salud_sistema where estado = 'ATENCION'),
    'flujos', (select coalesce(jsonb_agg(jsonb_build_object('flujo', flujo, 'estado', estado)), '[]') from estado_de_los_flujos()),
    'por_cuenta', (select coalesce(jsonb_object_agg(account, faltantes), '{}') from (select account, jsonb_agg(requisito) faltantes from v_cuentas_incompletas group by account) z),
    'tareas_en_silencio', (select coalesce(jsonb_agg(jsonb_build_object('tarea', tarea, 'estado', estado)), '[]') from v_tareas_en_silencio),
    'en_cuarentena', (select count(*) from cuarentena),
    'ok', (select count(*) from v_salud_sistema where estado = 'OK'));
$$;


ALTER FUNCTION "public"."get_salud_sistema"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_salud_sistema"() IS 'Una consulta que dice si el sistema esta sano. Reune la auditoria de integridad, el trabajo manual evitable, el estado del espejo, el mapeo, los tickets y las ejecuciones fallidas. El briefing la lee: si hay una falla, sale en el mail antes de que Andres la descubra leyendo la salida de un agente.';



CREATE OR REPLACE FUNCTION "public"."get_view_data"("p_view" "text", "p_account" "text", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date", "p_search" "text" DEFAULT NULL::"text", "p_search_col" "text" DEFAULT NULL::"text", "p_filters" "jsonb" DEFAULT '[]'::"jsonb", "p_group_by" "text" DEFAULT NULL::"text", "p_order_by" "text" DEFAULT NULL::"text", "p_order_dir" "text" DEFAULT 'desc'::"text", "p_limit" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_view_data"("p_view" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_search_col" "text", "p_filters" "jsonb", "p_group_by" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_view_data"("p_view" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_search_col" "text", "p_filters" "jsonb", "p_group_by" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) IS 'Devuelve datos, conteo y totales de una vista en una sola llamada, resolviendo filtros, busqueda, agrupacion, orden y paginacion en Postgres. El orden se aplica sobre el conjunto completo antes de paginar: ordenar en el cliente sobre una pagina ya cortada da un resultado incorrecto que parece correcto. Cada vista nombra sus metricas distinto (cost, gasto, costo_total, gasto_perdido), por eso el mapa interno: un COALESCE sobre columnas inexistentes no devuelve null, falla la ejecucion.';



CREATE OR REPLACE FUNCTION "public"."get_view_totals"("p_view" "text", "p_account" "text", "p_week" "date" DEFAULT NULL::"date") RETURNS json
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."get_view_totals"("p_view" "text", "p_account" "text", "p_week" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_view_totals"("p_view" "text", "p_account" "text", "p_week" "date") IS 'Agregados del conjunto completo calculados en Postgres. CPA se calcula como gasto total sobre conversiones totales y CTR como clics sobre impresiones, nunca como promedio de los valores por fila, que da un numero incorrecto.';



CREATE OR REPLACE FUNCTION "public"."get_weekly_package"("p_account" "text") RETURNS json
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with sem as (select max(week_start) s from weekly_brief where account = p_account)
  select json_build_object(
    'cuenta', p_account,
    'semana', (select s from sem),
    -- Ticket 13/31/33: cambios_semana traia la tabla ENTERA sin filtrar, y el
    -- bloque de resumen decia "0 cambios" mientras el array traia 13 filas de
    -- semanas viejas. Ahora se filtra por la semana analizada y se dice cuantas
    -- filas hay de VERDAD en esa ventana, mas la fecha del dato mas nuevo de la
    -- tabla, para que se vea de una si change_events esta congelada.
    'cambios_semana', (
      select coalesce(json_agg(json_build_object(
        'fecha', change_datetime, 'usuario', user_email, 'origen', client_type,
        'recurso', resource_type, 'campo', changed_field,
        'antes', old_value, 'despues', new_value,
        'auto_aplicado', (client_type like '%RECOMMENDATION%')
      ) order by change_datetime desc), '[]'::json)
      from change_events
      where account = p_account
        and change_datetime::date between (select s from sem) and (select s from sem) + 6),
    'cambios_semana_meta', (
      select json_build_object(
        'en_la_semana', (select count(*) from change_events c where c.account = p_account
          and c.change_datetime::date between (select s from sem) and (select s from sem) + 6),
        'en_toda_la_tabla', (select count(*) from change_events c where c.account = p_account),
        'dato_mas_nuevo', (select max(change_datetime)::date from change_events c where c.account = p_account),
        'cuidado', case when (select max(change_datetime)::date from change_events c where c.account = p_account) < current_date - 7
          then 'change_events esta CONGELADA: su dato mas nuevo es del ' ||
            (select max(change_datetime)::date from change_events c where c.account = p_account)::text ||
            '. No se puede afirmar que algo no cambio. Usar v_cambios_detectados, que compara fotos de configuracion.'
          end)),
    'brief', (
      select coalesce(json_agg(json_build_object(
        'seccion', section, 'item', item, 'detalle', detail,
        'valor', value, 'previo', prev_value, 'delta', delta_pct, 'nota', note
      ) order by id), '[]'::json)
      from weekly_brief where account = p_account and week_start = (select s from sem)),
    -- Coherencia interna: el delta del brief se calcula en el script y puede
    -- venir de una base distinta de la serie. Karedo publico +25,1% cuando contra
    -- la misma fuente era +19,0%. Ahora el paquete trae las DOS lecturas al lado.
    'coherencia_del_delta', (
      with serie as (
        select cpa, lag(cpa) over (order by week_start) cpa_prev
        from (select week_start, cpa from v_tendencia_semanal where account = p_account order by week_start desc limit 2) x
        order by week_start desc limit 1)
      select json_build_object(
        'delta_cpa_segun_la_serie', (select round(((cpa - cpa_prev) / nullif(cpa_prev,0) * 100)::numeric, 1) from serie),
        'como_leerlo', 'Si el delta del brief no coincide con este, el brief se calculo sobre una base distinta. La serie semanal es la fuente buena: sale de una sola tabla.')),
    'estado_cuenta', (
      select coalesce(json_agg(json_build_object('seccion', section, 'item', item, 'valor', value, 'detalle', detail) order by id), '[]'::json)
      from account_state where account = p_account),
    'alertas_altas', (
      select coalesce(json_agg(json_build_object('tipo', type, 'entidad', entity, 'detalle', detail, 'valor', value, 'umbral', threshold)), '[]'::json)
      from alerts where account = p_account and severity = 'ALTA'
        and week_start = (select max(week_start) from alerts where account = p_account)),
    'alertas_medias_conteo', (select count(*) from alerts where account = p_account and severity = 'MEDIA'
      and week_start = (select max(week_start) from alerts where account = p_account)),
    'ventana_real', (select json_build_object('dias_capa_diaria', dias_en_30d, 'semanas', semanas, 'cuidado', lectura)
      from v_ventana_real where account = p_account),
    'tendencia_8_semanas', (
      select coalesce(json_agg(json_build_object(
        'semana', week_start, 'gasto', gasto, 'conversiones', conversiones, 'cpa', cpa,
        'ctr', ctr_promedio, 'impr_share', impr_share_promedio,
        'perdido_presupuesto', perdido_presupuesto, 'perdido_ranking', perdido_ranking
      ) order by week_start desc), '[]'::json)
      from (select * from v_tendencia_semanal where account = p_account order by week_start desc limit 8) t),
    'keywords_atencion', (
      select coalesce(json_agg(json_build_object('campana', campaign, 'grupo', ad_group, 'keyword', keyword,
        'concordancia', match_type, 'motivo', motivo, 'gasto', cost, 'quality_score', quality_score)), '[]'::json)
      from v_keywords_atencion where account = p_account
        and week_start = (select max(week_start) from keywords where account = p_account))
  );
$$;


ALTER FUNCTION "public"."get_weekly_package"("p_account" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_weekly_package"("p_account" "text") IS 'Devuelve el paquete completo del analisis semanal en UNA sola llamada: brief pre-agregado, estado estructural de la cuenta, alertas altas con el conteo de medias, tendencia de 8 semanas, keywords que requieren atencion con su motivo, y cambios de la semana marcando los auto-aplicados por Google. Reemplaza cuatro o cinco consultas separadas. Uso: select get_weekly_package(''KAREDO'');';



CREATE OR REPLACE FUNCTION "public"."get_weekly_package_cadena"("p_account" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select public.get_weekly_package_cadena_base(p_account)
    || jsonb_build_object(

      'ventana_real', (
        select jsonb_build_object(
          'dias_capa_diaria', v.dias_en_30d,
          'semanas', v.semanas,
          'cuidado', v.lectura)
        from v_ventana_real v where v.account = p_account),

      'cambios_semana_meta', (
        select jsonb_build_object(
          'en_toda_la_tabla', count(*),
          'dato_mas_nuevo', max(ce.change_datetime::date),
          'cuidado', case
            when count(*) = 0
              then 'change_events NO tiene ninguna fila de esta cuenta. No se puede afirmar que algo no cambio.'
            when max(ce.change_datetime::date) < current_date - 7
              then 'change_events esta CONGELADA: su dato mas nuevo es del ' || max(ce.change_datetime::date) ||
                   '. No se puede afirmar que algo no cambio. Usar v_cambios_detectados, que compara fotos de configuracion.'
            else 'Al dia.' end)
        from change_events ce where ce.account = p_account),

      -- En una cadena el delta de CPA de cuenta no significa nada (regla 1: objetivos
      -- mezclados). Lo que si se contrasta es el gasto, que es una cifra sin ambiguedad
      -- y sirve igual para detectar que el brief se calculo sobre otra base.
      'coherencia_del_gasto', (
        select jsonb_build_object(
          'gasto_semana_segun_la_serie', round(sum(c.cost) filter (where c.week_start = s.ultima)::numeric, 2),
          'gasto_semana_previa_segun_la_serie', round(sum(c.cost) filter (where c.week_start = s.previa)::numeric, 2),
          'delta_gasto_pct', case
            when sum(c.cost) filter (where c.week_start = s.previa) > 0
            then round((((sum(c.cost) filter (where c.week_start = s.ultima)
                        - sum(c.cost) filter (where c.week_start = s.previa))
                       / sum(c.cost) filter (where c.week_start = s.previa)) * 100)::numeric, 1)
            end,
          'como_leerlo', 'Si una cifra del brief no coincide con esta, el brief se calculo sobre otra base. ' ||
                         'La serie semanal es la fuente buena: sale de una sola tabla. ' ||
                         'NO existe un delta de CPA de cuenta aca y no hay que inventarlo: los objetivos ' ||
                         'estan mezclados y el promedio no significa nada (regla 1).')
        from campaign c
        cross join (
          select max(week_start) as ultima,
                 (select max(week_start) from campaign
                   where account = p_account
                     and week_start < (select max(week_start) from campaign where account = p_account)) as previa
            from campaign where account = p_account) s
        where c.account = p_account and c.week_start in (s.ultima, s.previa))
    );
$$;


ALTER FUNCTION "public"."get_weekly_package_cadena"("p_account" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_weekly_package_cadena"("p_account" "text") IS 'Paquete semanal de una cuenta perfil cadena, con los mismos guardarrailes que el de cuenta unica: ventana_real (la capa diaria tiene 15 dias en FRESH_MONKEE, no 30), cambios_semana_meta (avisa si change_events esta congelada) y coherencia_del_gasto (contraste contra la serie semanal). Envuelve a get_weekly_package_cadena_base, que no hay que llamar directo.';



CREATE OR REPLACE FUNCTION "public"."get_weekly_package_cadena_base"("p_account" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  rank4 as (select * from v_location_ranking_bayes(p_account, 4)),
  destacados as (select location from (select location, puesto, count(*) over (partition by objetivo) n from rank4 where evidencia not like 'poca:%') x where puesto <= 5 or puesto > n - 5)
  select jsonb_build_object(
    'cuenta', p_account, 'perfil', 'cadena', 'semana', (select w from sem), 'armado', now(),
    'como_leer', 'Paquete jerarquico. Primero los objetivos, despues el ranking de locales ajustado por volumen DENTRO de su grupo de pares, y solo el detalle de los locales que importan. Las campanas corporativas van aparte en "corporativas": no son locales y no compiten en el ranking. Nunca cites el CPA crudo de un local: usa tasa_ajustada y evidencia.',
    'por_objetivo', (select coalesce(jsonb_agg(jsonb_build_object('objetivo', o.objetivo, 'campanas', o.campanas, 'gasto', round(o.gasto, 2), 'conversiones', round(o.conversiones, 1), 'cpa', round(o.cpa, 2), 'roas', round(o.roas, 2),
        'metrica_valida', (select metrica_principal from objetivos_conversion oc where oc.account = p_account and oc.objetivo = o.objetivo),
        'campanas_activas', (select count(*) from campaign_fechas f join campaign_dim d on d.account = f.account and d.campaign = f.campaign where f.account = p_account and d.objetivo = o.objetivo and f.estado_real = 'ENABLED')) order by o.gasto desc), '[]')
      from v_por_objetivo_semanal o, sem where o.account = p_account and o.week_start = sem.w),
    'tendencia_por_objetivo', (select coalesce(jsonb_agg(t), '[]') from (select jsonb_build_object('objetivo', objetivo, 'semanas', jsonb_agg(jsonb_build_object('s', week_start, 'gasto', round(gasto), 'conv', round(conversiones, 1)) order by week_start)) t from v_por_objetivo_semanal where account = p_account and week_start >= (select w from sem) - 28 group by objetivo) x),
    'ranking_locales', (select coalesce(jsonb_agg(jsonb_build_object('local', location, 'grupo_par', grupo_par, 'objetivo', objetivo, 'puesto', puesto, 'de_cuantos', de_cuantos, 'clics', clics, 'conv', conv, 'gasto', gasto, 'tasa_cruda', tasa_cruda, 'tasa_ajustada', tasa_ajustada, 'cpa_ajustado', cpa_ajustado, 'evidencia', evidencia, 'vs_mediana', vs_mediana, 'lectura', lectura) order by objetivo, grupo_par, puesto), '[]') from rank4),
    'corporativas', (select coalesce(jsonb_agg(jsonb_build_object('campana', campana, 'objetivo', objetivo, 'gasto', gasto, 'conv', conv, 'cpa', cpa, 'pct_conv_cuenta', pct_conv_cuenta)), '[]') from v_corporativas(p_account, 4)),
    -- Sobre las vistas ya resueltas: antes cada subconsulta llamaba resolver_campana
    -- por fila y el paquete entero tardaba 20 segundos.
    'detalle_locales_clave', (select coalesce(jsonb_object_agg(loc, det), '{}') from (
        select v.location loc, jsonb_build_object(
          'campanas', (select jsonb_agg(jsonb_build_object('campana', c.campaign, 'gasto', round(c.cost, 2), 'conv', round(c.conversions, 1), 'clics', c.clicks, 'estado', f.estado_real, 'fin', f.end_date)) from v_campana_resuelta c left join campaign_fechas f on f.account = p_account and f.campaign = c.campaign, sem where c.account = p_account and c.week_start = sem.w and c.location = v.location and c.cost > 0),
          'keywords_top', (select jsonb_agg(jsonb_build_object('kw', k.keyword, 'mt', k.match_type, 'clics', k.clicks, 'conv', round(k.conversions, 1), 'gasto', round(k.cost, 2), 'qs', k.quality_score) order by k.cost desc) from (select k.* from v_keywords_resueltas k, sem where k.account = p_account and k.week_start = sem.w and k.cost > 0 and k.location = v.location order by k.cost desc limit 12) k),
          'terminos_top', (select jsonb_agg(jsonb_build_object('t', s.search_term, 'clics', s.clicks, 'conv', round(s.conversions, 1), 'gasto', round(s.cost, 2)) order by s.cost desc) from (select s.* from v_terminos_resueltos s, sem where s.account = p_account and s.week_start = sem.w and s.cost > 0 and s.location = v.location order by s.cost desc limit 10) s)) det
        from (select distinct location from destacados) v where v.location is not null) y),
    'transversal', jsonb_build_object(
      'keywords_en_muchos_locales', (select coalesce(jsonb_agg(jsonb_build_object('kw', keyword, 'locales', locales, 'convierte_en', locales_que_convierten, 'gasto', gasto, 'conv', conv, 'cpa', cpa, 'lectura', lectura)), '[]') from (select * from v_keywords_entre_locales(p_account, 1) where locales >= 3 limit 15) z),
      'terminos_nuevos', (select coalesce(jsonb_agg(jsonb_build_object('t', search_term, 'clics', clics, 'gasto', gasto)), '[]') from (select s.search_term, sum(s.clicks) clics, round(sum(s.cost), 2) gasto from search_terms s, sem where s.account = p_account and s.week_start = sem.w and s.cost > 0 and not exists (select 1 from search_terms p where p.account = p_account and p.search_term = s.search_term and p.week_start < sem.w) group by 1 order by sum(s.cost) desc limit 15) z)),
    'campanas_terminadas', (select coalesce(jsonb_agg(jsonb_build_object('campana', campaign, 'fin', end_date, 'dias', current_date - end_date)), '[]') from campaign_fechas where account = p_account and estado_real = 'FINALIZADA'),
    'cambios_sin_registrar', (select coalesce(jsonb_agg(jsonb_build_object('entidad', entidad, 'campo', campo, 'de', valor_anterior, 'a', valor_nuevo, 'entre', foto_anterior || ' y ' || foto_actual)), '[]') from cambios_config where account = p_account and detectado_el >= current_date - 7 and campo in ('status','bidding_strategy','primary_for_goal')),
    'carteras_puja', (select coalesce(jsonb_agg(jsonb_build_object('grupo', grupo, 'campanas', campanas, 'conv', conv, 'tasa', tasa, 'cpa', cpa, 'veredicto', veredicto)), '[]') from v_carteras_puja(p_account, 4)),
    'estado_cuenta', get_estado_cuenta(p_account));
$$;


ALTER FUNCTION "public"."get_weekly_package_cadena_base"("p_account" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_weekly_package_cadena_base"("p_account" "text") IS 'Nucleo del paquete de cadena. NO llamar directo desde un prompt: usar get_weekly_package_cadena, que le agrega los guardarrailes de ventana, coherencia y cambios.';



CREATE OR REPLACE FUNCTION "public"."handle_pending_mutations_realtime"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  payload json;
BEGIN
  -- Si cambia a APPLIED (mutation_applied)
  IF (TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status = 'APPLIED') THEN
    payload := json_build_object(
      'id', NEW.id,
      'account', NEW.account,
      'status', NEW.status
    );
    PERFORM realtime.send(payload, 'broadcast', 'agency:command-center', 'mutation_applied');
  
  -- Si se inserta un UNDO_CHANGE (undo_change_created)
  ELSIF (TG_OP = 'INSERT' AND NEW.action_type = 'UNDO_CHANGE') THEN
    payload := json_build_object(
      'id', NEW.id,
      'account', NEW.account,
      'action_type', NEW.action_type,
      'status', NEW.status
    );
    PERFORM realtime.send(payload, 'broadcast', 'agency:command-center', 'undo_change_created');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_pending_mutations_realtime"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_true_roas_realtime"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  payload json;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    payload := json_build_object(
      'id', NEW.id,
      'client', NEW.client,
      'monto', NEW.monto,
      'event_date', NEW.event_date
    );
    PERFORM realtime.send(payload, 'broadcast', 'agency:command-center', 'roas_event_created');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_true_roas_realtime"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."latir"("p_tarea" "text", "p_ok" boolean DEFAULT true, "p_error" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  insert into latidos (tarea, ultimo_ok, ultimo_intento, ultimo_error, corridas_ok, corridas_falla, en_vigilancia)
  values (p_tarea, case when p_ok then now() end, now(), case when not p_ok then p_error end,
          case when p_ok then 1 else 0 end, case when p_ok then 0 else 1 end, p_ok)
  on conflict (tarea) do update set
    ultimo_ok = case when p_ok then now() else latidos.ultimo_ok end,
    ultimo_intento = now(), ultimo_error = case when p_ok then null else p_error end,
    corridas_ok = latidos.corridas_ok + case when p_ok then 1 else 0 end,
    corridas_falla = latidos.corridas_falla + case when p_ok then 0 else 1 end,
    en_vigilancia = latidos.en_vigilancia or p_ok;
$$;


ALTER FUNCTION "public"."latir"("p_tarea" "text", "p_ok" boolean, "p_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."limite_de_tasa"("p_clave" "text", "p_ruta" "text", "p_max" integer DEFAULT 10, "p_ventana" interval DEFAULT '00:15:00'::interval) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int; n_fallos int; espera int;
begin
  select count(*), count(*) filter (where not exito) into n, n_fallos
  from intentos where clave = p_clave and ruta = p_ruta and cuando > now() - p_ventana;

  -- Bloqueo progresivo por fallos: 5 fallos seguidos y la espera se estira.
  -- Contra fuerza bruta esto importa mas que el limite general.
  if n_fallos >= 5 then
    select greatest(0, extract(epoch from (max(cuando) + (interval '1 minute' * least(60, power(2, n_fallos - 4))) - now()))::int)
    into espera from intentos where clave = p_clave and ruta = p_ruta and not exito and cuando > now() - p_ventana;
    if espera > 0 then
      return jsonb_build_object('permitido', false, 'motivo', 'demasiados intentos fallidos',
        'esperar_segundos', espera, 'fallos', n_fallos);
    end if;
  end if;

  if n >= p_max then
    return jsonb_build_object('permitido', false, 'motivo', 'limite de tasa',
      'esperar_segundos', greatest(1, extract(epoch from (
        (select min(cuando) from intentos where clave = p_clave and ruta = p_ruta and cuando > now() - p_ventana)
        + p_ventana - now()))::int),
      'intentos', n, 'maximo', p_max);
  end if;
  return jsonb_build_object('permitido', true, 'intentos', n, 'maximo', p_max);
end $$;


ALTER FUNCTION "public"."limite_de_tasa"("p_clave" "text", "p_ruta" "text", "p_max" integer, "p_ventana" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."limpiar_intentos"() RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with borradas as (delete from intentos where cuando < now() - interval '48 hours' returning 1)
  select count(*)::int from borradas;
$$;


ALTER FUNCTION "public"."limpiar_intentos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."limpiar_pulso_intradia"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  n_borradas int;
begin
  -- Las metricas horarias mas viejas que 3 dias ya estan cubiertas por
  -- campaign_daily, que ademas trae el dato corregido.
  delete from google_live_events
  where event_type = 'METRICS'
    and event_date < now() - interval '3 days';
  get diagnostics n_borradas = row_count;

  -- Los cambios se conservan 90 dias: son el historial que permite
  -- explicar por que se movio una metrica meses despues.
  delete from google_live_events
  where event_type in ('USER_CHANGE','AUTO_CHANGE')
    and event_date < now() - interval '90 days';

  return 'Snapshots de metricas borrados: ' || n_borradas;
end;
$$;


ALTER FUNCTION "public"."limpiar_pulso_intradia"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."limpiar_pulso_intradia"() IS 'Borra snapshots horarios de mas de 3 dias, que ya estan cubiertos por la capa diaria con el dato corregido. Los cambios se conservan 90 dias. Ejecutar semanalmente.';



CREATE OR REPLACE FUNCTION "public"."madurez_dato"("p_fecha" "date") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select case
    when current_date - p_fecha <= 2 then 'provisional'
    when current_date - p_fecha <= 6 then 'madurando'
    else 'consolidado'
  end;
$$;


ALTER FUNCTION "public"."madurez_dato"("p_fecha" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."madurez_dato"("p_fecha" "date") IS 'provisional: el costo sirve, las conversiones no. madurando: mirar con reservas. consolidado: numero final. Nunca sacar conclusiones sobre conversiones de datos provisionales.';



CREATE OR REPLACE FUNCTION "public"."mantenimiento_semanal"() RETURNS TABLE("tabla" "text", "filas_borradas" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n bigint;
begin
  delete from google_live_events where event_type = 'METRICS' and event_date < current_date - 3;
  get diagnostics n = row_count; tabla := 'google_live_events METRICS >3d'; filas_borradas := n; return next;
  delete from google_live_events where event_type in ('USER_CHANGE','AUTO_CHANGE') and event_date < current_date - 90;
  get diagnostics n = row_count; tabla := 'google_live_events cambios >90d'; filas_borradas := n; return next;
  delete from config_snapshot where snapshot_date < current_date - 90;
  get diagnostics n = row_count; tabla := 'config_snapshot >90d'; filas_borradas := n; return next;
  delete from run_log where run_ts < now() - interval '180 days';
  get diagnostics n = row_count; tabla := 'run_log >180d'; filas_borradas := n; return next;
  delete from webhook_events where received_at < now() - interval '90 days';
  get diagnostics n = row_count; tabla := 'webhook_events >90d'; filas_borradas := n; return next;
  tabla := 'capa diaria y semanal: NUNCA se borran (archivo permanente)'; filas_borradas := 0; return next;
end $$;


ALTER FUNCTION "public"."mantenimiento_semanal"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mantenimiento_semanal"() IS 'Limpieza con politica de retencion por tabla. Correr semanalmente (Make, lunes 06:00, antes de las tareas). La capa diaria y semanal nunca se borran: son el archivo permanente desde que Google retiene solo 37 meses.';



CREATE OR REPLACE FUNCTION "public"."marcar_ejecutabilidad_real"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v text; plat plataforma_pub; ejec boolean; motivo text; hay boolean;
begin
  if new.accion is null then
    new.accion_valida := false;
    new.accion_error  := coalesce(new.accion_error,
      'Sin Accion JSON. No es un error si el verbo no es ejecutable: una pregunta no lleva JSON.');
    return new;
  end if;

  v := new.accion->>'verbo';
  if v is null or v = '' then
    new.accion_valida := false;
    new.accion_error  := 'El JSON no declara verbo.';
    return new;
  end if;

  begin
    plat := coalesce(new.accion->>'plataforma', 'google')::plataforma_pub;
  exception when others then
    plat := 'google'::plataforma_pub;
  end;

  select true, c.ejecutable, c.por_que_no into hay, ejec, motivo
    from capacidades_ejecucion c
   where c.verbo = v and c.plataforma = plat
   limit 1;

  if not coalesce(hay, false) then
    new.accion_valida := false;
    new.accion_error  := 'Verbo desconocido: "' || v || '". Los validos estan en capacidades_ejecucion.';
  elsif not coalesce(ejec, false) then
    -- El JSON puede estar impecable. Igual no es un clic.
    new.accion_valida := false;
    new.accion_error  := 'No ejecutable por script: ' || coalesce(motivo, 'sin motivo registrado') ||
                         ' Se hace a mano con los pasos de "Como hacerlo".';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."marcar_ejecutabilidad_real"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."marcar_ejecutabilidad_real"() IS 'accion_valida significa "se puede ejecutar de un clic", no "el JSON parsea". Un accionable con JSON impecable y verbo preguntar_andres NO es valido para ejecutar, y el motivo queda en accion_error. Sin esto la app ofrece botones que el servidor rechaza.';



CREATE OR REPLACE FUNCTION "public"."marcar_grupo_leido"("p_cuenta" "text", "p_tipo" "text", "p_actor" "text", "p_dia" "date") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with r as (update novedades set leida_el = now()
    where leida_el is null and coalesce(account,'(sistema)') = p_cuenta and tipo = p_tipo
      and coalesce(actor, autor, 'sistema') = p_actor and creada::date = p_dia returning 1)
  select count(*)::int from r;
$$;


ALTER FUNCTION "public"."marcar_grupo_leido"("p_cuenta" "text", "p_tipo" "text", "p_actor" "text", "p_dia" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."marcar_grupo_leido"("p_cuenta" "text", "p_tipo" "text", "p_actor" "text", "p_dia" "date") IS 'Marca leidas de una vez todas las novedades del mismo hecho. Cerrar 16 avisos identicos uno por uno es trabajo inventado.';



CREATE OR REPLACE FUNCTION "public"."marcar_para_retiro"("p_objeto" "text", "p_tipo" "text", "p_por_que" "text", "p_que_se_pierde" "text", "p_como_volver" "text", "p_semanas_de_observacion" integer DEFAULT 4) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_lecturas bigint; v_usa text; v_id bigint;
begin
  select coalesce(seq_scan, 0) + coalesce(idx_scan, 0) into v_lecturas
  from pg_stat_user_tables where relname = p_objeto;

  select nullif(concat_ws(' · ',
    nullif((select string_agg(viewname, ', ') from pg_views where schemaname='public' and definition ~* ('\m' || p_objeto || '\M')), ''),
    nullif((select string_agg(proname, ', ') from pg_proc where pronamespace='public'::regnamespace and pg_get_functiondef(oid) ~* ('\m' || p_objeto || '\M')), '')), '')
  into v_usa;

  insert into candidatos_a_retiro (objeto, tipo, por_que_se_propone, que_se_pierde, quien_lo_usa,
    lecturas_al_marcar, observar_hasta, como_volver)
  values (p_objeto, p_tipo, p_por_que, p_que_se_pierde, coalesce(v_usa, '(nadie que se detecte)'),
    v_lecturas, current_date + (p_semanas_de_observacion * 7), p_como_volver)
  returning id into v_id;
  return v_id;
end $$;


ALTER FUNCTION "public"."marcar_para_retiro"("p_objeto" "text", "p_tipo" "text", "p_por_que" "text", "p_que_se_pierde" "text", "p_como_volver" "text", "p_semanas_de_observacion" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_actionables"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" bigint, "title" "text", "justificacion" "text", "resolucion" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    actionables_memory.id,
    actionables_memory.title,
    actionables_memory.justificacion,
    actionables_memory.resolucion,
    1 - (actionables_memory.embedding <=> query_embedding) AS similarity
  FROM actionables_memory
  WHERE 1 - (actionables_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY actionables_memory.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_actionables"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."memoria_ingestar"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int := 0;
begin
  insert into memoria (account, tipo, fecha, texto, origen_id)
  select account, 'reflexion', run_date, que_haria_distinto, 'reflexion:' || id
  from reflexiones r where que_haria_distinto is not null
    and not exists (select 1 from cuarentena c where c.tabla = 'reflexiones' and c.registro_id = r.id::text)
  on conflict do nothing;
  get diagnostics n = row_count;
  insert into memoria (account, tipo, fecha, texto, origen_id)
  select account, 'leccion', fecha, leccion, 'leccion:' || id
  from lecciones l where leccion is not null
    and not exists (select 1 from cuarentena c where c.tabla = 'lecciones' and c.registro_id = l.id::text)
  on conflict do nothing;
  return n;
end $$;


ALTER FUNCTION "public"."memoria_ingestar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mensual_puede_correr"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with lunes as (select (current_date - ((extract(dow from current_date)::int + 6) % 7))::date l),
  semana_a_analizar as (select l - 7 s from lunes),
  activas as (select account from cuentas where activa),
  semanales as (
    select a.account,
      (select max(r.created_at) from run_quality r where r.account = a.account
         and r.semana_analizada = (select s from semana_a_analizar)
         and coalesce(r.que_fallo, '') not ilike 'redundante%'
         and coalesce(r.que_fallo, '') not ilike 'semana cerrada no disponible%') corrio,
      (select count(*) from campaign c where c.account = a.account) filas
    from activas a),
  mensual as (
    -- Una corrida anulada no cuenta como la mensual del mes: si nacio sobre estado
    -- viejo, dejarla contar impide corregirla hasta el mes siguiente.
    select max(created_at) ultima from run_quality
    where account = 'MENSUAL' and coalesce(que_fallo, '') not ilike 'redundante%'
      and not en_cuarentena('run_quality', id::text)),
  pendientes as (select account from semanales where corrio is null and filas > 0)
  select jsonb_build_object(
    'semana_a_analizar', (select s from semana_a_analizar),
    'cuentas_activas', (select count(*) from activas),
    'semanales_hechas', (select count(*) from semanales where corrio is not null),
    'semanales_pendientes', (select coalesce(jsonb_agg(account), '[]') from pendientes),
    'detalle', (select coalesce(jsonb_agg(jsonb_build_object('cuenta', account, 'corrio', corrio,
      'semanas_de_historia', (select count(distinct week_start) from campaign c where c.account = semanales.account))), '[]') from semanales),
    'ultima_mensual_real', (select ultima from mensual),
    'mensuales_anuladas', (select coalesce(jsonb_agg(jsonb_build_object('id', registro_id, 'por_que', left(por_que, 200))), '[]')
      from cuarentena where tabla = 'run_quality'),
    'ya_corrio_este_mes', coalesce((select date_trunc('month', ultima) = date_trunc('month', current_date) from mensual), false),
    'es_primer_lunes', extract(dow from current_date) = 1 and extract(day from current_date) <= 7,
    'puede_correr', not exists (select 1 from pendientes)
      and not coalesce((select date_trunc('month', ultima) = date_trunc('month', current_date) from mensual), false),
    'motivo', case
      when coalesce((select date_trunc('month', ultima) = date_trunc('month', current_date) from mensual), false)
        then 'Ya hubo una revision mensual real este mes el ' || (select ultima::date from mensual) || '. Registrar redundante y parar.'
      when exists (select 1 from pendientes)
        then 'Faltan las semanales de: ' || (select string_agg(account, ', ') from pendientes) || '. La mensual lee el estado de cada cuenta: si corre antes, lee un estado viejo. Esperar y reintentar.'
      when exists (select 1 from cuarentena where tabla = 'run_quality')
        then 'Puede correr. ATENCION: hay una mensual anulada este mes, escrita sobre estado viejo. Esta corrida la reemplaza: reescribi los briefs mensuales de las cuatro cuentas desde cero, no los edites.'
      else 'Puede correr: todas las semanales de la semana ' || (select s from semana_a_analizar) || ' ya pasaron y no hubo mensual este mes.' end);
$$;


ALTER FUNCTION "public"."mensual_puede_correr"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mensual_puede_correr"() IS 'Guard de orden y de redundancia para la revision mensual. Verifica que TODAS las cuentas activas hayan corrido su semanal sobre la semana que toca antes de dejar correr la mensual, y que no haya habido una mensual real este mes. Nacio del caso del 7 de septiembre de 2026: la mensual corrio a las 02:24 UTC y la semanal de BHI a las 11:45, asi que el brief mensual de BHI se escribio con el triple conteo de conversiones que la semanal corrigio despues.';



CREATE OR REPLACE FUNCTION "public"."metrica_conversiones"("p_account" "text", "p_tipo" "text" DEFAULT 'semanal_4'::"text") RETURNS numeric
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select round(coalesce(sum(c.conversions), 0)::numeric, 1)
    from campaign c, ventana_metrica(p_account, p_tipo) v
   where c.account = p_account and c.week_start between v.desde and v.hasta;
$$;


ALTER FUNCTION "public"."metrica_conversiones"("p_account" "text", "p_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."metrica_cpa"("p_account" "text", "p_tipo" "text" DEFAULT 'semanal_4'::"text") RETURNS numeric
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select round(metrica_gasto(p_account, p_tipo) / nullif(metrica_conversiones(p_account, p_tipo), 0), 2);
$$;


ALTER FUNCTION "public"."metrica_cpa"("p_account" "text", "p_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."metrica_gasto"("p_account" "text", "p_tipo" "text" DEFAULT 'semanal_4'::"text") RETURNS numeric
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select round(coalesce(sum(c.cost), 0)::numeric, 2)
    from campaign c, ventana_metrica(p_account, p_tipo) v
   where c.account = p_account and c.week_start between v.desde and v.hasta;
$$;


ALTER FUNCTION "public"."metrica_gasto"("p_account" "text", "p_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nav_campanas"("p_account" "text", "p_location" "text" DEFAULT NULL::"text", "p_objetivo" "text" DEFAULT NULL::"text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("campana" "text", "objetivo" "text", "tipo" "text", "location" "text", "estado" "text", "inicio" "date", "fin" "date", "gasto" numeric, "clics" numeric, "conv" numeric, "cpa" numeric, "ai_max" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  agg as (
    select v.campaign c, v.objetivo o, v.tipo t, v.location loc,
      sum(v.cost)::numeric g, sum(v.clicks)::numeric cl, sum(v.conversions)::numeric cv
    from v_campana_resuelta v, sem
    where v.account = p_account and v.week_start > sem.w - p_semanas * 7
      and (p_location is null or v.location = p_location) and (p_objetivo is null or v.objetivo = p_objetivo)
    group by 1,2,3,4)
  select a.c, a.o, a.t, a.loc, coalesce(f.estado_real, 'desconocido'), f.start_date, f.end_date,
    round(a.g, 2), round(a.cl), round(a.cv, 1), round(a.g / nullif(a.cv, 0), 2),
    exists (select 1 from google_live_events e where e.account = p_account and e.client_type = 'AI_MAX_SETTING' and e.entity_name = a.c)
  from agg a left join campaign_fechas f on f.account = p_account and f.campaign = a.c
  where a.g > 0 or coalesce(f.estado_real,'') = 'ENABLED' order by a.g desc;
$$;


ALTER FUNCTION "public"."nav_campanas"("p_account" "text", "p_location" "text", "p_objetivo" "text", "p_semanas" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nav_contadores"("p_account" "text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("dimension" "text", "valor" "text", "etiqueta" "text", "n" integer, "gasto" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  base as (select v.* from v_campana_resuelta v, sem where v.account = p_account and v.week_start > sem.w - p_semanas * 7 and v.cost > 0)
  select 'objetivo', b.objetivo, coalesce((select nombre_humano from objetivos_conversion oc where oc.account = p_account and oc.objetivo = b.objetivo), initcap(replace(b.objetivo,'_',' '))), count(distinct b.campaign)::int, round(sum(b.cost)::numeric, 2) from base b group by b.objetivo
  union all
  select 'local', coalesce(b.location, '(corporativa)'), coalesce((select nombre from locations l where l.account = p_account and l.codigo = b.location), coalesce(b.location, 'Corporativas')), count(distinct b.campaign)::int, round(sum(b.cost)::numeric, 2) from base b group by b.location
  union all
  select 'grupo_par', coalesce(l.grupo_par, 'sin_grupo'), initcap(replace(coalesce(l.grupo_par,'sin grupo'),'_',' ')), count(distinct b.campaign)::int, round(sum(b.cost)::numeric, 2)
  from base b left join locations l on l.account = p_account and l.codigo = b.location group by l.grupo_par
  order by 1, 5 desc;
$$;


ALTER FUNCTION "public"."nav_contadores"("p_account" "text", "p_semanas" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nav_grupos"("p_account" "text", "p_location" "text" DEFAULT NULL::"text", "p_campana" "text" DEFAULT NULL::"text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("location" "text", "campana" "text", "grupo" "text", "gasto" numeric, "clics" numeric, "conv" numeric, "cpa" numeric, "ctr" numeric, "keywords" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with sem as (select max(week_start) w from campaign where account = p_account)
  select g.location, g.campaign, g.ad_group,
    round(sum(g.cost)::numeric, 2), round(sum(g.clicks)::numeric), round(sum(g.conversions)::numeric, 1),
    round(sum(g.cost)::numeric / nullif(sum(g.conversions), 0)::numeric, 2),
    round(sum(g.clicks)::numeric / nullif(sum(g.impressions), 0)::numeric * 100, 2),
    (select count(distinct k.keyword)::int from v_keywords_resueltas k where k.account = p_account and k.campaign = g.campaign and k.ad_group = g.ad_group and k.week_start > (select w from sem) - p_semanas * 7)
  from v_grupos_resueltos g, sem
  where g.account = p_account and g.week_start > sem.w - p_semanas * 7
    and (p_location is null or g.location = p_location) and (p_campana is null or g.campaign = p_campana)
  group by 1,2,3 having sum(g.cost) > 0 order by sum(g.cost) desc;
$$;


ALTER FUNCTION "public"."nav_grupos"("p_account" "text", "p_location" "text", "p_campana" "text", "p_semanas" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nav_keywords"("p_account" "text", "p_location" "text" DEFAULT NULL::"text", "p_campana" "text" DEFAULT NULL::"text", "p_grupo" "text" DEFAULT NULL::"text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("location" "text", "campana" "text", "grupo" "text", "keyword" "text", "concordancia" "text", "qs" integer, "gasto" numeric, "clics" numeric, "conv" numeric, "cpa" numeric, "ctr" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with sem as (select max(week_start) w from campaign where account = p_account)
  select k.location, k.campaign, k.ad_group, k.keyword, k.match_type, max(k.quality_score)::int,
    round(sum(k.cost)::numeric, 2), round(sum(k.clicks)::numeric), round(sum(k.conversions)::numeric, 1),
    round(sum(k.cost)::numeric / nullif(sum(k.conversions), 0)::numeric, 2),
    round(sum(k.clicks)::numeric / nullif(sum(k.impressions), 0)::numeric * 100, 2)
  from v_keywords_resueltas k, sem
  where k.account = p_account and k.week_start > sem.w - p_semanas * 7
    and (p_location is null or k.location = p_location) and (p_campana is null or k.campaign = p_campana) and (p_grupo is null or k.ad_group = p_grupo)
  group by 1,2,3,4,5 having sum(k.cost) > 0 order by sum(k.cost) desc limit 300;
$$;


ALTER FUNCTION "public"."nav_keywords"("p_account" "text", "p_location" "text", "p_campana" "text", "p_grupo" "text", "p_semanas" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nav_objetivos"("p_account" "text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("objetivo" "text", "nombre" "text", "metrica" "text", "campanas" integer, "campanas_activas" integer, "gasto" numeric, "clics" numeric, "conv" numeric, "cpa" numeric, "roas" numeric, "locales" integer, "gasto_prev" numeric, "conv_prev" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  act as (select v.objetivo o, sum(v.cost)::numeric g, sum(v.clicks)::numeric cl, count(distinct v.campaign)::int n, count(distinct v.location)::int nl
          from v_campana_resuelta v, sem where v.account = p_account and v.week_start > sem.w - p_semanas * 7 group by 1),
  prev as (select v.objetivo o, sum(v.cost)::numeric g, sum(v.conversions)::numeric cv
           from v_campana_resuelta v, sem where v.account = p_account and v.week_start > sem.w - p_semanas * 14 and v.week_start <= sem.w - p_semanas * 7 group by 1),
  cvs as (select x.objetivo o, sum(x.conversiones)::numeric cv, sum(x.valor)::numeric val
          from v_por_objetivo_semanal x, sem where x.account = p_account and x.week_start > sem.w - p_semanas * 7 group by 1)
  select a.o,
    coalesce((select nombre_humano from objetivos_conversion oc where oc.account = p_account and oc.objetivo = a.o), initcap(replace(a.o,'_',' '))),
    coalesce((select metrica_principal from objetivos_conversion oc where oc.account = p_account and oc.objetivo = a.o), 'cpa'),
    a.n, (select count(*)::int from campaign_fechas f join campaign_dim d on d.account = f.account and d.campaign = f.campaign where f.account = p_account and d.objetivo = a.o and f.estado_real = 'ENABLED'),
    round(a.g, 2), round(a.cl), round(coalesce(c.cv, 0), 1),
    round(a.g / nullif(c.cv, 0), 2), round(c.val / nullif(a.g, 0), 2),
    a.nl, round(coalesce(p.g, 0), 2), round(coalesce(p.cv, 0), 1)
  from act a left join cvs c on c.o = a.o left join prev p on p.o = a.o order by a.g desc;
$$;


ALTER FUNCTION "public"."nav_objetivos"("p_account" "text", "p_semanas" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nav_terminos"("p_account" "text", "p_location" "text" DEFAULT NULL::"text", "p_campana" "text" DEFAULT NULL::"text", "p_grupo" "text" DEFAULT NULL::"text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("location" "text", "campana" "text", "grupo" "text", "termino" "text", "disparo_por" "text", "concordancia" "text", "gasto" numeric, "clics" numeric, "conv" numeric, "cpa" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with sem as (select max(week_start) w from campaign where account = p_account)
  select s.location, s.campaign, s.ad_group, s.search_term, s.triggered_keyword, s.match_type,
    round(sum(s.cost)::numeric, 2), round(sum(s.clicks)::numeric), round(sum(s.conversions)::numeric, 1),
    round(sum(s.cost)::numeric / nullif(sum(s.conversions), 0)::numeric, 2)
  from v_terminos_resueltos s, sem
  where s.account = p_account and s.week_start > sem.w - p_semanas * 7
    and (p_location is null or s.location = p_location) and (p_campana is null or s.campaign = p_campana) and (p_grupo is null or s.ad_group = p_grupo)
  group by 1,2,3,4,5,6 having sum(s.cost) > 0 order by sum(s.cost) desc limit 300;
$$;


ALTER FUNCTION "public"."nav_terminos"("p_account" "text", "p_location" "text", "p_campana" "text", "p_grupo" "text", "p_semanas" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."negativa_bloquea"("p_negativa" "text", "p_match" "text", "p_keyword" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select case
    when p_match = 'EXACT' then normalizar_entidad(p_negativa) = normalizar_entidad(p_keyword)
    when p_match = 'PHRASE' then position(' ' || normalizar_entidad(p_negativa) || ' ' in ' ' || normalizar_entidad(p_keyword) || ' ') > 0
    else not exists (select 1 from unnest(string_to_array(normalizar_entidad(p_negativa), ' ')) w where position(' ' || w || ' ' in ' ' || normalizar_entidad(p_keyword) || ' ') = 0)
  end;
$$;


ALTER FUNCTION "public"."negativa_bloquea"("p_negativa" "text", "p_match" "text", "p_keyword" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nivel_de_vistas"() RETURNS TABLE("vista" "text", "nivel" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with recursive aristas as (
    select distinct h.relname hijo, p.relname padre
    from pg_depend d
    join pg_rewrite r on r.oid = d.objid
    join pg_class h on h.oid = r.ev_class
    join pg_class p on p.oid = d.refobjid
    join pg_namespace nh on nh.oid = h.relnamespace
    join pg_namespace np on np.oid = p.relnamespace
    where nh.nspname = 'public' and np.nspname = 'public'
      and h.relkind = 'v' and p.relkind = 'v' and h.relname <> p.relname
  ),
  todas as (select viewname v from pg_views where schemaname = 'public'),
  camino as (
    select t.v vista, 0 nivel, array[t.v] visto from todas t
    where not exists (select 1 from aristas a where a.hijo = t.v)
    union all
    select a.hijo, c.nivel + 1, c.visto || a.hijo
    from camino c join aristas a on a.padre = c.vista
    where c.nivel < 12 and not (a.hijo = any(c.visto))
  )
  select vista, max(nivel)::int from camino group by vista;
$$;


ALTER FUNCTION "public"."nivel_de_vistas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalizar_entidad"("t" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select regexp_replace(lower(extensions.unaccent(coalesce(t, ''))), '\s+', ' ', 'g');
$$;


ALTER FUNCTION "public"."normalizar_entidad"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."novedades_generar"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare n int := 0;
begin
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'editado', e.account, 'accionable', v.notion_id, 'Editaron: ' || left(e.titulo, 80),
    'Cambió ' || (select string_agg(case k when 'por_que' then 'el por qué' when 'accion' then 'la acción' when 'titulo' then 'el título' when 'prioridad' then 'la prioridad' when 'entidad' then 'la entidad' else k end, ', ') from jsonb_object_keys(v.diff) k),
    coalesce(v.autor, 'agente'), 'semanal', 'edito', e.titulo, v.fecha, 'version:' || v.notion_id || ':' || v.version
  from accionable_versiones v join accionables_espejo e on e.notion_id = v.notion_id
  where v.version > 1 and v.fecha >= now() - interval '7 days' and (v.diff ? 'por_que' or v.diff ? 'accion' or v.diff ? 'titulo' or v.diff ? 'prioridad')
    and e.estado in ('Propuesto','Bloqueado','En curso')
  on conflict (clave) do nothing; get diagnostics n = row_count;
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'propuesta', account, 'propuesta', id::text, 'Propuesta estratégica: ' || left(titulo, 80), resultado_esperado, escrita_por, case when escrita_por ilike '%mensual%' then 'mensual' else 'semanal' end, 'propuso', titulo, fecha::timestamptz, 'propuesta:' || id
  from propuestas_estrategicas where estado = 'propuesta' and fecha >= current_date - 7 on conflict (clave) do nothing;
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'ticket', cuenta, 'ticket', id::text, 'Ticket #' || id || ' respondido: ' || left(titulo, 70), left(respuesta, 200), 'claude', 'claude', 'respondio', titulo, resuelto_el, 'ticket:' || id || ':' || estado
  from tickets where estado in ('resuelto','descartado') and resuelto_el >= now() - interval '7 days' and creado_por = 'andres' on conflict (clave) do nothing;
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'ejecucion', account, 'ejecucion', id::text, (case when estado = 'fallida' then 'Falló: ' else 'Ejecutado: ' end) || replace(tipo, '_', ' ') || ' ' || coalesce(keyword, array_to_string(keywords, ', ')), left(resultado, 200), coalesce(aprobada_por, 'script'), case when por_politica then 'politica' else 'script' end, case when estado = 'fallida' then 'fallo' else 'ejecuto' end, replace(tipo, '_', ' ') || ' ' || coalesce(keyword, array_to_string(keywords, ', ')), ejecutada_el, 'ejecucion:' || id || ':' || estado
  from acciones_aprobadas where estado in ('ejecutada','fallida') and ejecutada_el >= now() - interval '7 days' and (por_politica or estado = 'fallida') on conflict (clave) do nothing;
  insert into novedades (tipo, account, ref_tipo, ref_id, titulo, texto, autor, actor, verbo, objeto_titulo, creada, clave)
  select 'alerta', account, 'alerta', id::text, titulo, accion, origen, case origen when 'mensual' then 'mensual' when 'centinela' then 'script' when 'pulso' then 'pulso' when 'claude' then 'claude' else 'sistema' end, 'alerto', titulo, creada, 'alerta:' || id
  from alertas where estado = 'abierta' and nivel = 'hoy' and creada >= now() - interval '7 days' on conflict (clave) do nothing;
  update novedades set actor = actor_desde_prefijo(autor), verbo = 'comento' where tipo = 'comentario' and actor is null;
  return n;
end $$;


ALTER FUNCTION "public"."novedades_generar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orden_del_dia"() RETURNS TABLE("bloque" "text", "orden" integer, "cuenta" "text", "titulo" "text", "por_que" "text", "cuanto_cuesta" "text", "notion_id" "text", "urgencia" "text", "url" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with clasificado as (
    select a.*, (a.accion->>'verbo') verbo,
      coalesce(c.ejecutable, false) verbo_ejecutable,
      prevuelo(a.notion_id) bloqueo
    from accionables_espejo a
    left join capacidades_ejecucion c on c.verbo = (a.accion->>'verbo') and c.plataforma = 'google'
    where a.estado in ('Propuesto','Bloqueado'))
  select x.bloque, x.orden, x.cuenta, x.titulo, x.por_que, x.cuanto_cuesta, x.notion_id, x.urgencia, x.url
  from (
    select 'Un clic'::text bloque, 1 orden, a.account cuenta, a.titulo, left(a.por_que, 220) por_que,
      'un clic y el ejecutor lo aplica dentro de la hora'::text cuanto_cuesta,
      a.notion_id, coalesce(a.prioridad, 'Media') urgencia, a.url
    from clasificado a where a.verbo_ejecutable and a.accion_valida and a.bloqueo is null
    union all
    select 'Responder', 2, a.account, a.titulo, left(a.por_que, 220),
      case when a.verbo = 'preguntar_cliente' then 'un mensaje al cliente' else 'lo sabes vos: responder y cerrar' end,
      a.notion_id, coalesce(a.prioridad, 'Media'), a.url
    from clasificado a where a.verbo in ('preguntar_andres','preguntar_cliente')
    union all
    select 'Esperan una fecha o un conflicto', 3, a.account, a.titulo, coalesce(a.bloqueo, left(a.por_que, 220)),
      'hoy no se puede: el pre-vuelo lo frena', a.notion_id, coalesce(a.prioridad, 'Media'), a.url
    from clasificado a where a.bloqueo is not null and coalesce(a.verbo,'') not in ('preguntar_andres','preguntar_cliente')
    union all
    select 'A mano', 4, a.account, a.titulo, left(a.por_que, 220),
      case
        when a.verbo in ('crear_anuncio','editar_anuncio') then 'la interfaz de Google: los RSA no se crean por script'
        when a.verbo = 'cambiar_conversion_primaria' then 'Objetivos > Conversiones'
        when a.verbo = 'tarea_externa' then coalesce('en ' || (a.accion->'parametros'->>'donde'), 'fuera de Google Ads')
        when a.verbo = 'investigar' then 'diagnostico: mirar antes de decidir'
        when a.titulo ~* 'make|sheet|crm|gtm|asana' then 'fuera de Google Ads: otro sistema'
        when a.titulo ~* 'investigar|revisar|analizar' then 'diagnostico: mirar antes de decidir'
        else 'a mano en la interfaz de Google Ads' end,
      a.notion_id, coalesce(a.prioridad, 'Media'), a.url
    from clasificado a
    where not a.verbo_ejecutable and a.bloqueo is null
      and coalesce(a.verbo, '') not in ('preguntar_andres','preguntar_cliente')
  ) x
  order by x.orden, case x.urgencia when 'Alta' then 1 when 'Media' then 2 else 3 end, x.cuenta;
$$;


ALTER FUNCTION "public"."orden_del_dia"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."orden_del_dia"() IS 'Lo que espera decision de Andres, ordenado por costo de decidirlo. El criterio NO es accion_valida: eso solo dice que el JSON parsea, y una pregunta tiene JSON valido sin ser ejecutable. El criterio es si el verbo es ejecutable segun capacidades_ejecucion.';



CREATE OR REPLACE FUNCTION "public"."parecido_a"("p_embedding" "extensions"."vector", "p_account" "text" DEFAULT NULL::"text", "p_k" integer DEFAULT 5, "p_excluir_desde" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  -- Los registros en cuarentena no se devuelven. El agente no se entera de que
  -- existieron, que es el punto: avisarle que su memoria puede estar mal lo hace
  -- desconfiar de todo, y un agente que duda de lo ya resuelto pierde la corrida.
  select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'fecha', fecha, 'account', account,
    'texto', left(texto, 400), 'similitud', round((1 - (embedding <=> p_embedding))::numeric, 3))
    order by embedding <=> p_embedding), '[]')
  from (select * from memoria m
        where m.embedding is not null
          and (p_account is null or m.account = p_account)
          and (p_excluir_desde is null or m.fecha < p_excluir_desde)
          and not exists (select 1 from cuarentena c where c.tabla = 'memoria' and c.registro_id = m.id::text)
        order by m.embedding <=> p_embedding limit p_k) m;
$$;


ALTER FUNCTION "public"."parecido_a"("p_embedding" "extensions"."vector", "p_account" "text", "p_k" integer, "p_excluir_desde" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."parecido_a"("p_embedding" "extensions"."vector", "p_account" "text", "p_k" integer, "p_excluir_desde" "date") IS 'Busqueda semantica en la memoria. Excluye lo que esta en cuarentena: un hecho que resulto falso no debe volver por similitud, porque el agente que lo recupera no tiene como saber que fue corregido.';



CREATE OR REPLACE FUNCTION "public"."plan_valido"("p_ind" "jsonb", "p_hip" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare i jsonb; h jsonb;
begin
  if jsonb_typeof(p_ind) <> 'array' or jsonb_array_length(p_ind) < 1 or jsonb_array_length(p_ind) > 10 then return false; end if;
  for i in select * from jsonb_array_elements(p_ind) loop
    if not (i ? 'nombre' and i ? 'umbral' and i ? 'direccion' and i ? 'habilita') then return false; end if;
    if i->>'direccion' not in ('sube','baja','cruza') then return false; end if;
    if i->>'nombre' not in ('clics','conv_rate','impresiones','cpc','lost_is_budget','lost_is_rank','pct_terminos_nuevos','cpa_marginal','ctr','conversiones','gasto','conv_rate_grupo') then return false; end if;
  end loop;
  if jsonb_typeof(p_hip) <> 'array' or jsonb_array_length(p_hip) > 6 then return false; end if;
  for h in select * from jsonb_array_elements(p_hip) loop
    if not (h ? 'id' and h ? 'texto' and h ? 'evidencia_que_la_mueve') then return false; end if;
  end loop;
  return true;
end $$;


ALTER FUNCTION "public"."plan_valido"("p_ind" "jsonb", "p_hip" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."politica_aplica"("p_account" "text", "p_tipo" "text", "p_origen" "text", "p_confianza" numeric, "p_entidad" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare pol politicas_auto; general boolean; gasto14 numeric;
begin
  select (valor->>'activa')::boolean into general from ajustes_sistema where clave = 'auto_ejecucion';
  if not coalesce(general, false) then return null; end if;
  select * into pol from politicas_auto where tipo = p_tipo and activa;
  if pol is null then return null; end if;
  if not (p_account = any(pol.cuentas)) then return null; end if;
  if not (coalesce(p_origen, 'Semanal') = any(pol.solo_origen)) then return null; end if;
  if coalesce(p_confianza, 1) < pol.confianza_min then return null; end if;
  if pol.gasto_max is not null and p_tipo = 'pausar_keyword' then
    select sum(cost) into gasto14 from keywords_daily where account = p_account and date >= current_date - 14 and normalizar_entidad(keyword) = normalizar_entidad(split_part(p_entidad, '|', 3));
    if coalesce(gasto14, 0) > pol.gasto_max then return null; end if;
  end if;
  return pol.modo;
end $$;


ALTER FUNCTION "public"."politica_aplica"("p_account" "text", "p_tipo" "text", "p_origen" "text", "p_confianza" numeric, "p_entidad" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."poner_en_cuarentena"("p_tabla" "text", "p_id" "text", "p_por_que" "text", "p_cuenta" "text" DEFAULT NULL::"text", "p_reemplazado_por" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  insert into cuarentena (tabla, registro_id, cuenta, por_que, reemplazado_por)
  values (p_tabla, p_id, p_cuenta, p_por_que, p_reemplazado_por)
  on conflict (tabla, registro_id) do update set por_que = excluded.por_que,
    reemplazado_por = excluded.reemplazado_por
  returning id;
$$;


ALTER FUNCTION "public"."poner_en_cuarentena"("p_tabla" "text", "p_id" "text", "p_por_que" "text", "p_cuenta" "text", "p_reemplazado_por" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."por_que_esta_vacio"("p_account" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare foto jsonb; salida jsonb := '{}'; k text; vacio boolean;
begin
  foto := get_estado_cuenta_base(p_account);
  for k in select jsonb_object_keys(foto) loop
    vacio := jsonb_typeof(foto -> k) = 'null'
      or (jsonb_typeof(foto -> k) = 'array' and jsonb_array_length(foto -> k) = 0)
      or (jsonb_typeof(foto -> k) = 'object' and (select count(*) from jsonb_object_keys(foto -> k)) = 0);
    if not vacio then continue; end if;
    salida := salida || jsonb_build_object(k, case k
      when 'calibracion' then 'Todavia ninguna prediccion vencio. Hay ' ||
        (select count(*) from predicciones p where p.account = p_account) || ' escrita(s), la primera vence el ' ||
        coalesce((select min(semana + 7)::text from predicciones p where p.account = p_account), 'sin fecha') ||
        '. No es que el sistema no acierte: todavia no se puede saber.'
      when 'acierto_por_tipo' then 'Sin predicciones evaluadas todavia: la tasa de acierto no se puede calcular hasta que venza la primera.'
      when 'alertas_abiertas' then 'Sin alertas abiertas. Es una BUENA noticia, no un hueco: el centinela corre cada 4 horas y no encontro nada que rompa un umbral.'
      when 'accionables_abiertos' then 'No hay accionables abiertos. Si Notion tiene alguno, el espejo no sincronizo: mirar v_espejo_huerfano.'
      when 'accionables_hechos_14d' then 'Ningun accionable cumplio 14 dias desde que se ejecuto: todavia no se puede medir su impacto.'
      when 'pulsos_recientes' then 'Sin pulso en la ventana. El pulso corre a las 06:45; si falta, mirar v_tareas_en_silencio.'
      when 'operator_log_14d' then 'Nadie toco la cuenta en 14 dias. Es un dato, no un hueco: no hay cambios que medir.'
      when 'propuestas_abiertas' then 'Sin propuestas estrategicas esperando decision.'
      when 'relaciones_abiertas' then 'Ningun accionable esta en conflicto o dependencia con otro.'
      when 'cambios_google_7d' then 'Google no registro cambios en 7 dias. OJO: change_events esta congelada en las cuatro cuentas (ticket 32). NO se puede afirmar que nadie toco nada: cruzar con v_cambios_detectados, que compara fotos de configuracion.'
      when 'hipotesis_consolidadas' then 'La ficha de Notion no tiene hipotesis consolidadas cargadas. NO significa que la cuenta no tenga preguntas abiertas: mirar accionables_abiertos y las Hipotesis abiertas de la ficha.'
      when 'reflexiones_vigentes' then 'Sin reflexiones de corridas anteriores para esta cuenta.'
      when 'conocimiento_vigente' then 'Sin entradas de conocimiento externo vigentes para esta cuenta.'
      when 'brecha' then 'Sin objetivo cargado en account_targets, o sin datos suficientes: no se puede calcular la brecha.'
      when 'objetivos' then 'Sin objetivos cargados para esta cuenta.'
      when 'plan_vigente' then 'Sin plan de la semana escrito todavia: lo escribe la corrida semanal.'
      when 'notas_de_andres' then 'Andres no dejo notas para esta cuenta.'
      when 'predicciones_pendientes' then 'Sin predicciones esperando evaluacion.'
      when 'por_que_limitada' then 'Sin datos de cuota perdida en el periodo: puede ser que la cuenta no este limitada, o que falte la extraccion.'
      when 'lecciones' then 'Sin lecciones vigentes para esta cuenta. Si esperabas alguna, verificar cuarentena.'
      else 'Campo vacio SIN explicacion registrada. Esto es un hueco del sistema: abrir ticket citando la clave "' || k || '".'
    end);
  end loop;
  return salida;
end $$;


ALTER FUNCTION "public"."por_que_esta_vacio"("p_account" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."por_que_esta_vacio"("p_account" "text") IS 'Ticket 39. Se genera contra las claves REALES de la foto: recorre lo que devuelve get_estado_cuenta_base y explica cada campo vacio. Antes explicaba claves que no existian y se salteaba las que si. Un campo vacio sin explicacion ahora dice explicitamente que es un hueco y que hay que abrir ticket.';



CREATE OR REPLACE FUNCTION "public"."prevuelo"("p_notion_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare rel text; inv jsonb; acc record; motivos text[] := '{}'; det text; espera date; ultimo record; ex jsonb;
begin
  select string_agg(motivo, ' | ') into rel from accionable_relaciones where not resuelta and severidad = 'bloquea' and (a = p_notion_id or b = p_notion_id);
  if rel is not null then motivos := motivos || rel; end if;
  select account, accion, titulo into acc from accionables_espejo where notion_id = p_notion_id;
  if acc.accion is not null then
    -- La entidad tiene que EXISTIR. Las invariantes no lo detectan: una keyword
    -- inventada pasa limpia porque ninguna invariante matchea, y el ejecutor falla
    -- despues en Google sin explicacion util. Adivinar un nombre es la regla que
    -- mas veces rompio el sistema, y hasta ahora nada la hacia cumplir.
    ex := entidad_existe(acc.account, acc.accion);
    if not (ex->>'ok')::boolean then
      motivos := motivos || ((ex->>'detalle') ||
        case when jsonb_array_length(coalesce(ex->'parecidas','[]'::jsonb)) > 0
          then ' Parecidas que SI existen: ' || (select string_agg(v::text, ', ') from jsonb_array_elements_text(ex->'parecidas') v) || '.'
          else '' end);
    end if;
    espera := nullif(acc.accion->'parametros'->>'no_ejecutar_antes_de', '')::date;
    if espera is not null and current_date < espera then
      motivos := motivos || ('El accionable pide no ejecutarse antes del ' || espera || ' y hoy es ' || current_date ||
        '. Faltan ' || (espera - current_date) || ' dias. Si la razon de esperar ya no vale, editá el accionable y sacá la fecha; no lo fuerces.');
    end if;
    if (acc.accion->>'verbo') in ('cambiar_estrategia_puja','cambiar_objetivo_puja','cambiar_presupuesto','pausar_campana','reactivar_campana','cambiar_concordancia') then
      select o.fecha, o.que_cambio into ultimo from operator_log o
      where o.account = acc.account and o.fecha >= current_date - 3
        and o.donde ilike '%' || coalesce(acc.accion->'objeto'->>'campana', '~~') || '%'
        and (o.que_cambio ilike '%puja%' or o.que_cambio ilike '%presupuesto%' or o.que_cambio ilike '%concordancia%' or o.que_cambio ilike '%estrategia%')
      order by o.fecha desc, o.id desc limit 1;
      if ultimo.fecha is not null then
        motivos := motivos || ('Ya hubo un cambio estructural en ' || (acc.accion->'objeto'->>'campana') || ' el ' || ultimo.fecha ||
          ': "' || left(ultimo.que_cambio, 90) || '". Dos cambios estructurales sobre la misma campana en menos de 3 dias hacen imposible saber cual causo que. Esperar.');
      end if;
    end if;
    inv := verificar_invariantes(acc.account, acc.accion);
    for det in select e->>'detalle' from jsonb_array_elements(inv) e where (e->>'bloquea')::boolean loop
      motivos := motivos || det;
    end loop;
  end if;
  return nullif(array_to_string(motivos, ' | '), '');
end $$;


ALTER FUNCTION "public"."prevuelo"("p_notion_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevuelo"("p_notion_id" "text") IS 'Chequeo antes de encolar una ejecucion. Devuelve el motivo si algo bloquea, null si puede pasar. Incluye: conflictos entre accionables, la fecha explicita parametros.no_ejecutar_antes_de, un cambio estructural sobre la misma campana en los ultimos 3 dias, y las invariantes que bloquean. Nacio del caso del 7 de septiembre de 2026: un accionable que pedia esperar al 21 de septiembre se ejecutó el mismo dia en que Google migró esa campana a AI Max, porque la condicion estaba en prosa y nada la hacia cumplir.';



CREATE OR REPLACE FUNCTION "public"."probar_funciones_de_cuenta"() RETURNS TABLE("funcion" "text", "cuenta" "text", "estado" "text", "error" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare f text; a text; e text;
begin
  foreach f in array array['get_estado_cuenta','get_doc_maestro','get_weekly_package','get_pulso_input'] loop
    foreach a in array array['KAREDO','BHI','360','FRESH_MONKEE'] loop
      begin
        if f = 'get_pulso_input' then execute format('select %I($1, $2)', f) using a, current_date - 1;
        else execute format('select %I($1)', f) using a; end if;
        funcion := f; cuenta := a; estado := 'OK'; error := null; return next;
      exception when others then funcion := f; cuenta := a; estado := 'FALLA'; error := sqlerrm; return next; end;
    end loop;
  end loop;
  foreach a in array array['KAREDO','BHI','360','FRESH_MONKEE'] loop
    foreach e in array array['campaign','adgroup','keyword','search_term'] loop
      begin
        execute 'select count(*) from get_entidades($1, $2, $3, $4, null, null, null, 5, 0)' using e, a, current_date - 30, current_date;
        funcion := 'get_entidades(' || e || ')'; cuenta := a; estado := 'OK'; error := null; return next;
      exception when others then funcion := 'get_entidades(' || e || ')'; cuenta := a; estado := 'FALLA'; error := sqlerrm; return next; end;
    end loop;
  end loop;
  foreach f in array array['v_location_ranking_bayes','v_carteras_puja','v_corporativas','v_keywords_entre_locales','v_geolift_pares','nav_objetivos','nav_contadores'] loop
    begin execute format('select count(*) from %I($1)', f) using 'FRESH_MONKEE';
      funcion := f; cuenta := 'FRESH_MONKEE'; estado := 'OK'; error := null; return next;
    exception when others then funcion := f; cuenta := 'FRESH_MONKEE'; estado := 'FALLA'; error := sqlerrm; return next; end;
  end loop;
  begin execute 'select get_weekly_package_cadena($1)' using 'FRESH_MONKEE';
    funcion := 'get_weekly_package_cadena'; cuenta := 'FRESH_MONKEE'; estado := 'OK'; return next;
  exception when others then funcion := 'get_weekly_package_cadena'; cuenta := 'FRESH_MONKEE'; estado := 'FALLA'; error := sqlerrm; return next; end;
end $_$;


ALTER FUNCTION "public"."probar_funciones_de_cuenta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."probar_mutantes"() RETURNS TABLE("relacion" "text", "resultado" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare r record; viola int; total int;
begin
  for r in select id, nombre, mutante_sql from relaciones_verdad
            where activa and mutante_sql is not null and mutante_sql not like 'no aplica%'
              and mutante_sql ~ '^\s*(update|insert|delete)\s' order by id
  loop
    begin
      execute r.mutante_sql;
      perform correr_relaciones();
      select count(*) filter (where cv.veredicto='viola'), count(*)
        into viola, total
        from corridas_verdad cv
       where cv.relacion_id = r.id and cv.corrida_el > now() - interval '20 seconds';
      relacion := r.nombre;
      resultado := case when viola > 0 then 'mato_al_mutante' else 'sobrevivio' end;
      return next;
      raise exception 'rollback del mutante';
    exception when others then
      if sqlerrm <> 'rollback del mutante' then
        relacion := r.nombre; resultado := 'error: ' || sqlerrm; return next;
      end if;
    end;
  end loop;
end $$;


ALTER FUNCTION "public"."probar_mutantes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."probar_mutantes"() IS 'Corre cada relacion contra su propio mutante dentro de una transaccion y revierte. Solo toma mutantes que son UPDATE, INSERT o DELETE: los que exigen cambiar una definicion (DDL) se prueban a mano, porque un rollback de DDL fallido dejaria la base en un estado raro. Una relacion que no mata a su mutante no es un control, es una esperanza.';



CREATE OR REPLACE FUNCTION "public"."probar_todas_las_vistas"() RETURNS TABLE("objeto" "text", "estado" "text", "error" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare r record;
begin
  for r in select viewname v from pg_views
    where schemaname = 'public'
      -- v_salud_sistema llama a esta funcion: consultarla desde aca es recursion infinita
      and viewname not in ('v_salud_sistema')
    order by 1 loop
    begin
      execute 'select 1 from public.' || quote_ident(r.v) || ' limit 1';
      objeto := r.v; estado := 'OK'; error := null; return next;
    exception when others then
      objeto := r.v; estado := 'FALLA'; error := sqlerrm; return next;
    end;
  end loop;
end $$;


ALTER FUNCTION "public"."probar_todas_las_vistas"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."probar_todas_las_vistas"() IS 'Consulta cada vista del esquema publico. Excluye v_salud_sistema porque esa vista invoca esta funcion: incluirla es recursion infinita.';



CREATE OR REPLACE FUNCTION "public"."propuesta_cambiar_estado"("p_id" bigint, "p_estado" "text", "p_nota" "text" DEFAULT NULL::"text", "p_ejecucion_real" "text" DEFAULT NULL::"text", "p_por" "text" DEFAULT 'andres'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare ant text; acc text; tit text;
begin
  select estado, account, titulo into ant, acc, tit from propuestas_estrategicas where id = p_id;
  if ant is null then return jsonb_build_object('error', 'no existe'); end if;
  update propuestas_estrategicas set
    estado = p_estado,
    decision_andres = coalesce(p_nota, decision_andres),
    decidida_el = case when p_estado in ('aprobada','descartada','adoptada') then current_date else decidida_el end,
    ejecucion_real = coalesce(p_ejecucion_real, ejecucion_real),
    test_inicio = case when p_estado = 'en_test' and test_inicio is null then current_date else test_inicio end,
    evaluada_el = case when p_estado = 'adoptada' then current_date else evaluada_el end,
    historial = historial || jsonb_build_object('fecha', now(), 'de', ant, 'a', p_estado, 'nota', p_nota, 'por', p_por)
  where id = p_id;
  if p_estado = 'en_test' and p_ejecucion_real is not null then
    insert into operator_log (account, fecha, hora, que_cambio, donde, por_que) values (acc, current_date, now()::time, left(p_ejecucion_real, 200), 'Propuesta estrategica #' || p_id || ': ' || left(tit, 80), 'Test de la propuesta estrategica. Evaluar contra lo hecho, no contra lo propuesto.');
  end if;
  return jsonb_build_object('ok', true, 'de', ant, 'a', p_estado);
end $$;


ALTER FUNCTION "public"."propuesta_cambiar_estado"("p_id" bigint, "p_estado" "text", "p_nota" "text", "p_ejecucion_real" "text", "p_por" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."puede_escribir_en"("p_account" "text", "p_plataforma" "public"."plataforma_pub" DEFAULT 'meta'::"public"."plataforma_pub") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with lim as (select valor, ventana, que_pasa_si_se_viola from limites_plataforma
               where plataforma = p_plataforma and regla = 'escrituras_por_hora'),
  hechas as (select count(*) n from acciones_aprobadas a, lim
             where a.account = p_account and a.plataforma = p_plataforma
               and a.estado in ('ejecutada','pendiente') and a.modo = 'ejecutar'
               and a.aprobada_el > now() - lim.ventana)
  select jsonb_build_object(
    'permitido', (select n from hechas) < (select valor from lim),
    'hechas_en_la_ventana', (select n from hechas),
    'maximo', (select valor from lim),
    'motivo', case when (select n from hechas) >= (select valor from lim)
      then 'Tope de escrituras alcanzado: ' || (select n from hechas) || ' en la ultima hora. ' || (select que_pasa_si_se_viola from lim)
      else null end);
$$;


ALTER FUNCTION "public"."puede_escribir_en"("p_account" "text", "p_plataforma" "public"."plataforma_pub") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."puede_escribir_en"("p_account" "text", "p_plataforma" "public"."plataforma_pub") IS 'Frena las rafagas de escritura antes de que la plataforma las lea como automatizacion. Se consulta antes de encolar en Meta.';



CREATE OR REPLACE FUNCTION "public"."que_publique_con"("p_objeto" "text") RETURNS TABLE("cuenta" "text", "brief_id" "text", "etiqueta" "text", "valor" numeric, "veredicto" "text", "publicada_el" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with recursive aguas_abajo as (
    select p_objeto as objeto
    union
    select l.objeto from v_linaje l join aguas_abajo a on l.depende_de = a.objeto
  )
  select c.cuenta, c.brief_id, c.etiqueta, c.valor, c.veredicto, c.publicada_el
    from cifras_publicadas c
   where exists (
     select 1 from aguas_abajo a
      where c.sql_origen ilike '%' || a.objeto || '%'
         or a.objeto = any (c.objetos_usados))
   order by c.publicada_el desc;
$$;


ALTER FUNCTION "public"."que_publique_con"("p_objeto" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."que_publique_con"("p_objeto" "text") IS 'Dado un objeto que resulto estar mal, devuelve las cifras ya publicadas que salieron de el o de cualquier vista que lo use, recorriendo el grafo hacia abajo. Es la pregunta que el 8 de septiembre no se pudo responder cuando aparecieron numeros equivocados ya copiados a briefs y a Notion.';



CREATE OR REPLACE FUNCTION "public"."raices"("t" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select coalesce(array_agg(w order by w), '{}') from (
    select distinct w from unnest(string_to_array(regexp_replace(lower(extensions.unaccent(coalesce(t, ''))), '[^a-z0-9 ]', ' ', 'g'), ' ')) w
    where length(w) > 2 and w not in ('de','la','el','los','las','del','para','por','con','sin','una','uno','und','fur','der','die','das','den','von','mit')
  ) s;
$$;


ALTER FUNCTION "public"."raices"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconciliar"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare n_venc int := 0; n_dup int := 0; n_hecho int := 0; n_alert int := 0; r record;
begin
  for r in select notion_id, account, titulo from accionables_espejo where estado in ('Propuesto','Bloqueado') and vence is not null and vence < current_date and reemplazado_por is null loop
    insert into reconciliaciones (account, regla, objeto, accion, detalle) values (r.account, 'R1_vencido', 'accionable:' || r.notion_id, 'vencer', 'Vencio sin ejecutarse: ' || r.titulo) on conflict do nothing; n_venc := n_venc + 1;
  end loop;
  -- R2: solo entidades especificas (grupo o keyword), nunca campaña sola
  for r in select a.account, a.notion_id as viejo, b.notion_id as nuevo, a.entidad from accionables_espejo a join accionables_espejo b
    on a.account = b.account and a.notion_id < b.notion_id and normalizar_entidad(a.entidad) = normalizar_entidad(b.entidad) and entidad_especifica(a.entidad)
    where a.estado in ('Propuesto','Bloqueado','En curso') and b.estado in ('Propuesto','Bloqueado','En curso') and a.reemplazado_por is null and b.reemplazado_por is null loop
    insert into reconciliaciones (account, regla, objeto, accion, detalle) values (r.account, 'R2_duplicado', 'accionable:' || r.nuevo, 'duplicado', 'Misma entidad que ' || r.viejo || ' (' || r.entidad || '). Pasa a Reemplazado por el mas viejo.') on conflict do nothing; n_dup := n_dup + 1;
  end loop;
  for r in select e.notion_id, e.account, e.titulo, g.event_date from accionables_espejo e
    join google_live_events g on g.account = e.account and g.event_type = 'USER_CHANGE' and g.event_date::date >= coalesce(e.detectado, current_date - 30)
      and entidad_especifica(e.entidad) and normalizar_entidad(g.entity_name) like '%' || split_part(normalizar_entidad(e.entidad), '|', array_length(string_to_array(e.entidad, '|'), 1)) || '%'
    where e.estado in ('Propuesto','Bloqueado') and e.reemplazado_por is null loop
    insert into reconciliaciones (account, regla, objeto, accion, detalle) values (r.account, 'R3_posible_hecho', 'accionable:' || r.notion_id, 'ya_hecho', 'Cambio de usuario en esa entidad el ' || r.event_date::date || '. Confirmar si corresponde a "' || r.titulo || '".') on conflict do nothing; n_hecho := n_hecho + 1;
  end loop;
  for r in select a.id, a.account, a.entidad from alertas a where a.tipo = 'plan_condicion' and a.estado in ('abierta','vista')
    and not exists (select 1 from pulso_diario p, jsonb_array_elements(p.evidencia) e where p.account = a.account and p.fecha = (select max(fecha) from pulso_diario where account = a.account) and (e->>'cumple')::boolean and coalesce(e->>'grupo', e->>'nombre') = a.entidad) loop
    update alertas set estado = 'resuelta', resuelta_el = now() where id = r.id;
    insert into reconciliaciones (account, regla, objeto, accion, detalle, aplicada, aplicada_el) values (r.account, 'R4_condicion_cesa', 'alerta:' || r.id, 'cerrar_alerta', 'La condicion dejo de cumplirse en el ultimo pulso.', true, now()); n_alert := n_alert + 1;
  end loop;
  return jsonb_build_object('vencidos', n_venc, 'duplicados', n_dup, 'posibles_hechos', n_hecho, 'alertas_cerradas', n_alert, 'corrida', now());
end $$;


ALTER FUNCTION "public"."reconciliar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_cambio"("p_que" "text", "p_por_que" "text" DEFAULT NULL::"text", "p_objetos" "text"[] DEFAULT NULL::"text"[], "p_version" "text" DEFAULT NULL::"text", "p_revierte_como" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  insert into cambios_de_sistema (que, por_que, objetos, version, revierte_como)
  values (p_que, p_por_que, p_objetos, p_version, p_revierte_como) returning id;
$$;


ALTER FUNCTION "public"."registrar_cambio"("p_que" "text", "p_por_que" "text", "p_objetos" "text"[], "p_version" "text", "p_revierte_como" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_intento"("p_clave" "text", "p_ruta" "text", "p_exito" boolean DEFAULT false, "p_detalle" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  insert into intentos (clave, ruta, exito, detalle) values (p_clave, p_ruta, p_exito, p_detalle);
  -- Al acertar se limpia el historial de esa clave: no se castiga a quien ya entro
  delete from intentos where p_exito and clave = p_clave and ruta = p_ruta and not exito;
$$;


ALTER FUNCTION "public"."registrar_intento"("p_clave" "text", "p_ruta" "text", "p_exito" boolean, "p_detalle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reporte_token"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  select replace(replace(replace(encode(extensions.gen_random_bytes(18), 'base64'), '/', '_'), '+', '-'), '=', '')
$$;


ALTER FUNCTION "public"."reporte_token"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reporte_token"() IS 'Token para el link publico de un reporte. base64url, no base64: los caracteres / y + rompen la ruta /r/:token.';



CREATE OR REPLACE FUNCTION "public"."reporte_token_url"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'extensions'
    AS $$ select translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_') $$;


ALTER FUNCTION "public"."reporte_token_url"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolver_campana"("p_account" "text", "p_campaign" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $_$
  with m as (
    select location_codigo, objetivo, tipo_campana, patron from campaign_mapa
    where account = p_account and activa and p_campaign ~* patron order by prioridad, length(patron) desc limit 1
  ),
  loc as (
    select codigo from locations where account = p_account
      and normalizar_entidad(p_campaign) ~ ('(^|[^a-z0-9])' || normalizar_entidad(replace(codigo, ' ', '[ _-]?')) || '([^a-z0-9]|$)')
    order by length(codigo) desc limit 1
  )
  select jsonb_build_object(
    'location', coalesce((select location_codigo from m), (select codigo from loc)),
    'objetivo', coalesce((select objetivo from m), 'generico'),
    'tipo', (select tipo_campana from m),
    'patron', (select patron from m));
$_$;


ALTER FUNCTION "public"."resolver_campana"("p_account" "text", "p_campaign" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolver_grupo_alertas"("p_account" "text", "p_tipo" "text", "p_dia" "date") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with r as (update alertas set estado = 'resuelta', resuelta_el = now()
    where estado = 'abierta' and account = p_account and tipo = p_tipo and creada::date = p_dia returning 1)
  select count(*)::int from r;
$$;


ALTER FUNCTION "public"."resolver_grupo_alertas"("p_account" "text", "p_tipo" "text", "p_dia" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolver_grupo_alertas"("p_account" "text", "p_tipo" "text", "p_dia" "date") IS 'Resuelve de una vez todas las alertas del mismo tipo, cuenta y dia. Cerrar 16 avisos del mismo hecho uno por uno es trabajo inventado.';



CREATE OR REPLACE FUNCTION "public"."resolver_keyword"("p_account" "text", "p_keyword" "text", "p_pista" "text" DEFAULT ''::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
  with k as (
    select campaign, ad_group, match_type, keyword, cost
    from keywords where account = p_account and week_start = (select max(week_start) from keywords where account = p_account)
      and keyword_status = 'ENABLED'
      and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(regexp_replace(p_keyword, '^[\[\"]+|[\]\"]+$', '', 'g'))
  )
  select jsonb_build_object('campana', campaign, 'grupo', ad_group, 'match_type', match_type, 'keyword', keyword)
  from k order by (case when normalizar_entidad(p_pista) like '%' || normalizar_entidad(ad_group) || '%' then 0 else 1 end), cost desc nulls last limit 1;
$_$;


ALTER FUNCTION "public"."resolver_keyword"("p_account" "text", "p_keyword" "text", "p_pista" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."respaldar_memoria"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v jsonb; n int; b int;
begin
  select jsonb_build_object(
    'operator_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from operator_log t),
    'reflexiones', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from reflexiones t),
    'doc_maestro_humano', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from doc_maestro_humano t),
    'doc_maestro_consolidado', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from doc_maestro_consolidado t),
    'account_targets', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from account_targets t),
    'funnel_stages', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from funnel_stages t),
    'funnel_events', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from funnel_events t),
    'run_quality', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from run_quality t),
    'true_roas_events', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from true_roas_events t),
    'cierres_sin_atribucion', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from cierres_sin_atribucion t),
    'accionables_ejecutados', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from accionables_ejecutados t)
  ) into v;
  select sum(jsonb_array_length(value)) into n from jsonb_each(v);
  b := octet_length(v::text);
  insert into backups_memoria (tablas, filas_total, bytes) values (v, n, b);
  delete from backups_memoria where creado < now() - interval '84 days';
  return jsonb_build_object('filas', n, 'bytes', b, 'tablas', (select count(*) from jsonb_object_keys(v)));
end $$;


ALTER FUNCTION "public"."respaldar_memoria"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."respaldar_memoria"() IS 'Respalda en JSON las 11 tablas que NO se pueden re-extraer de Google Ads: lo que Andres escribio, lo que el sistema aprendio, objetivos, escalera, cierres reales. Retencion 12 semanas. Para restaurar: select tablas->''operator_log'' from backups_memoria order by creado desc limit 1.';



CREATE OR REPLACE FUNCTION "public"."simular_negativa"("p_account" "text", "p_negativa" "text", "p_match" "text", "p_nivel" "text" DEFAULT 'campana'::"text", "p_grupo" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
  with cobertura as (select min(date) desde, max(date) hasta from search_terms_daily where account = p_account),
  terms30 as (
    select search_term, sum(clicks) clics, sum(cost) gasto, sum(conversions) conv
    from search_terms_daily where account = p_account and date >= current_date - 30 and (p_nivel <> 'grupo' or ad_group = p_grupo) group by 1
  ),
  bloq30 as (select * from terms30 where negativa_bloquea(p_negativa, p_match, search_term)),
  terms90 as (
    select search_term, sum(clicks) clics, sum(cost) gasto, sum(conversions) conv
    from search_terms where account = p_account and week_start >= current_date - 90 and (p_nivel <> 'grupo' or ad_group = p_grupo) group by 1
  ),
  bloq90 as (select * from terms90 where negativa_bloquea(p_negativa, p_match, search_term))
  select jsonb_build_object(
    'ventana_diaria_real', (select 'del ' || desde || ' al ' || hasta from cobertura),
    'terminos_bloqueados', (select count(*) from bloq30),
    'clics_bloqueados', (select coalesce(sum(clics), 0) from bloq30),
    'gasto_bloqueado', (select coalesce(round(sum(gasto), 2), 0) from bloq30),
    'conversiones_bloqueadas', (select coalesce(sum(conv), 0) from bloq30),
    'terminos_bloqueados_90d', (select count(*) from bloq90),
    'conversiones_bloqueadas_90d', (select coalesce(sum(conv), 0) from bloq90),
    'gasto_bloqueado_90d', (select coalesce(round(sum(gasto)), 0) from bloq90),
    'ejemplos', (select coalesce(jsonb_agg(jsonb_build_object('t', search_term, 'clics', clics, 'conv', conv) order by conv desc, gasto desc), '[]') from (select * from bloq90 order by conv desc, gasto desc limit 8) x),
    'protegidos_afectados', (select coalesce(jsonb_agg(termino), '[]') from terminos_protegidos tp where tp.account = p_account and negativa_bloquea(p_negativa, p_match, tp.termino)),
    -- El veredicto que importa: cualquier evidencia de conversion, en cualquiera de las dos ventanas
    'bloquearia_conversiones', (select coalesce(sum(conv), 0) from bloq30) > 0 or (select coalesce(sum(conv), 0) from bloq90) > 0
      or exists (select 1 from terminos_protegidos tp where tp.account = p_account and negativa_bloquea(p_negativa, p_match, tp.termino))
  );
$$;


ALTER FUNCTION "public"."simular_negativa"("p_account" "text", "p_negativa" "text", "p_match" "text", "p_nivel" "text", "p_grupo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."terminos_protegidos_actualizar"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
declare n int := 0;
begin
  -- Keywords con conversion en 90 dias (semanal)
  insert into terminos_protegidos (account, termino, motivo, conversiones_90d, gasto_90d)
  select account, regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g'), 'convirtio_90d', sum(conversions), sum(cost)
  from keywords where week_start >= current_date - 90 group by account, regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g') having sum(conversions) >= 1
  on conflict (account, termino) do update set conversiones_90d = excluded.conversiones_90d, gasto_90d = excluded.gasto_90d;
  get diagnostics n = row_count;
  -- Terminos de busqueda que convirtieron (no solo keywords)
  insert into terminos_protegidos (account, termino, motivo, conversiones_90d, gasto_90d)
  select account, search_term, 'convirtio_90d', sum(conversions), sum(cost) from search_terms where week_start >= current_date - 90 group by account, search_term having sum(conversions) >= 1
  on conflict (account, termino) do update set conversiones_90d = greatest(terminos_protegidos.conversiones_90d, excluded.conversiones_90d);
  -- Marca: del nombre del cliente
  insert into terminos_protegidos (account, termino, motivo) select account, lower(split_part(nombre_cliente, ' ', 1)), 'marca' from cuentas where activa on conflict do nothing;
  return n;
end $_$;


ALTER FUNCTION "public"."terminos_protegidos_actualizar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."testeabilidad"("p_conv_por_semana" numeric, "p_semanas" integer DEFAULT 4, "p_split" numeric DEFAULT 0.5) RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  -- Aproximacion: MDE relativo para dos proporciones con alpha 0.05, potencia 0.8.
  -- Con n conversiones por brazo, el MDE relativo ~ 2.8 / sqrt(n) (regla practica para tasas bajas).
  select jsonb_build_object(
    'conv_por_brazo', round(p_conv_por_semana * p_semanas * p_split, 1),
    'mde_relativo_pct', round(280 / sqrt(greatest(p_conv_por_semana * p_semanas * p_split, 1)), 0),
    'veredicto', case
      when 280 / sqrt(greatest(p_conv_por_semana * p_semanas * p_split, 1)) <= 20 then 'TESTEABLE: detecta cambios de 20% o mas'
      when 280 / sqrt(greatest(p_conv_por_semana * p_semanas * p_split, 1)) <= 35 then 'TESTEABLE SOLO PARA EFECTOS GRANDES: necesita 35%+ de diferencia'
      else 'NO TESTEABLE en ' || p_semanas || ' semanas: el efecto minimo detectable supera 35%. Registrar la pregunta, no correr el test.'
    end
  );
$$;


ALTER FUNCTION "public"."testeabilidad"("p_conv_por_semana" numeric, "p_semanas" integer, "p_split" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."testeabilidad"("p_conv_por_semana" numeric, "p_semanas" integer, "p_split" numeric) IS 'Dado el volumen semanal de conversiones, cuanto tendria que moverse una metrica para que un test A/B de N semanas lo detecte. Si el MDE supera 35%, no hay test que responda: se registra la pregunta como no testeable hoy. Evita proponer experimentos que no pueden decidir nada.';



CREATE OR REPLACE FUNCTION "public"."toca_nucleo"("p_account" "text", "p_texto" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select c from cuentas, unnest(nucleo) c where account = p_account
    and not exists (
      select 1 from unnest(raices(c)) pc
      where not exists (select 1 from unnest(raices(p_texto)) pt where pt like pc || '%' or (length(pc) >= 5 and pc like pt || '%' and length(pt) >= 5))
    )
  limit 1;
$$;


ALTER FUNCTION "public"."toca_nucleo"("p_account" "text", "p_texto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v_capacidades_coherentes_chk"() RETURNS TABLE("verbo" "text", "problema" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select c.verbo, 'el sistema exige valor_actual pero el registro no lo declara: un agente que lea el registro va a escribir un JSON que rebota'
  from capacidades_ejecucion c
  where c.verbo in ('cambiar_presupuesto','cambiar_objetivo_puja','cambiar_cpc_keyword')
    and coalesce(c.requiere,'') not ilike '%valor_actual%'
  union all
  select c.verbo, 'verbo ejecutable sin metodo o sin forma de revertir declarada'
  from capacidades_ejecucion c where c.ejecutable and (c.metodo is null or c.reversible is null)
  union all
  select c.verbo, 'verbo no ejecutable sin explicacion de por que'
  from capacidades_ejecucion c where not c.ejecutable and coalesce(length(c.por_que_no),0) < 20;
$$;


ALTER FUNCTION "public"."v_capacidades_coherentes_chk"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v_carteras_puja"("p_account" "text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("grupo" "text", "campanas" integer, "lista" "text", "clics" numeric, "conv" numeric, "gasto" numeric, "tasa" numeric, "cpa" numeric, "veredicto" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with base as (
    select campaign, objetivo, sum(clicks)::numeric cl, sum(conversions)::numeric cv, sum(cost)::numeric g
    from v_campana_resuelta where account = p_account and week_start >= (select max(week_start) from campaign where account = p_account) - (p_semanas - 1) * 7
    group by 1, 2 having sum(cost) > 0
  ),
  t as (select *, (cv / nullif(cl, 0))::numeric tasa from base),
  mediana as (select objetivo, (percentile_cont(0.5) within group (order by tasa))::numeric m from t where cl > 0 group by objetivo),
  clasif as (select t.*, case when t.cv = 0 and t.cl >= 100 then 'excluir_medicion_dudosa' when t.tasa >= m.m * 1.5 then 'alta' when t.tasa <= m.m * 0.5 then 'baja' else 'media' end tier from t join mediana m on m.objetivo = t.objetivo)
  select objetivo || ' - ' || tier, count(*)::int, left(string_agg(campaign, ', ' order by cv desc), 180),
    round(sum(cl)), round(sum(cv), 1), round(sum(g), 2),
    round(sum(cv) / nullif(sum(cl), 0) * 100, 2), round(sum(g) / nullif(sum(cv), 0), 2),
    case when tier = 'excluir_medicion_dudosa' then 'NO agrupar: cero conversiones con clics de sobra contamina la cartera entera'
         when sum(cv) >= 30 then 'Cartera viable: ' || round(sum(cv)) || ' conv/mes supera el umbral de 30'
         else 'Aun agrupadas no llegan a 30 conv/mes: dejar en Maximizar conversiones sin objetivo' end
  from clasif group by objetivo, tier order by objetivo, sum(g) desc;
$$;


ALTER FUNCTION "public"."v_carteras_puja"("p_account" "text", "p_semanas" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."v_carteras_puja"("p_account" "text", "p_semanas" integer) IS 'Agrupa campanas por objetivo y tramo de tasa de conversion para carteras de puja. El umbral de 30 conv/30 dias se cumple sobre la cartera, no sobre cada campana. No mezcla tasas dispares (Google pujaria mal en las dos) ni campanas con medicion dudosa (contaminan el pool).';



CREATE OR REPLACE FUNCTION "public"."v_corporativas"("p_account" "text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("campana" "text", "objetivo" "text", "gasto" numeric, "conv" numeric, "cpa" numeric, "pct_conv_cuenta" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with sem as (select max(week_start) w from campaign where account = p_account),
  tot as (select sum(conversions)::numeric c from campaign, sem where account = p_account and week_start >= sem.w - (p_semanas - 1) * 7)
  select v.campaign, v.objetivo, round(sum(v.cost)::numeric, 2), round(sum(v.conversions)::numeric, 1),
    round(sum(v.cost)::numeric / nullif(sum(v.conversions), 0)::numeric, 2),
    round(sum(v.conversions)::numeric / nullif((select c from tot), 0) * 100, 1)
  from v_campana_resuelta v, sem
  where v.account = p_account and v.location is null and v.week_start >= sem.w - (p_semanas - 1) * 7 and v.cost > 0
  group by 1, 2 order by 3 desc;
$$;


ALTER FUNCTION "public"."v_corporativas"("p_account" "text", "p_semanas" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."v_corporativas"("p_account" "text", "p_semanas" integer) IS 'Campanas que no pertenecen a un local: promos corporativas, franquicias, nacionales. Se muestran aparte del ranking de locales porque no son comparables: CT_Corp_BOGO50 tenia el 19% de las conversiones de la cuenta y salia primero en un ranking de locales sin ser un local.';



CREATE OR REPLACE FUNCTION "public"."v_geolift_pares"("p_account" "text", "p_min_semanas" integer DEFAULT 8) RETURNS TABLE("local_a" "text", "local_b" "text", "semanas" integer, "correlacion" numeric, "gasto_a" numeric, "gasto_b" numeric, "apto" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with serie as (select coalesce(location, '(sin local)') loc, week_start, sum(conversiones)::numeric cv, sum(gasto)::numeric g from v_por_location_semanal where account = p_account group by 1, 2),
  pares as (select a.loc la, b.loc lb, count(*) n, corr(a.cv, b.cv)::numeric c, sum(a.g)::numeric ga, sum(b.g)::numeric gb
    from serie a join serie b on a.week_start = b.week_start and a.loc < b.loc group by a.loc, b.loc having count(*) >= p_min_semanas)
  select la, lb, n::int, round(c, 3), round(ga, 2), round(gb, 2),
    case when c >= 0.95 then 'Apto: correlacion sobre 0,95, el estandar de mercados pareados'
         when c >= 0.85 then 'Aceptable dentro de una canasta de control sintetico, no como par unico'
         else 'No apto' end
  from pares where c is not null and c >= 0.85 order by c desc limit 60;
$$;


ALTER FUNCTION "public"."v_geolift_pares"("p_account" "text", "p_min_semanas" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."v_geolift_pares"("p_account" "text", "p_min_semanas" integer) IS 'Pares de locales con series correlacionadas para armar el control sintetico de un test de incrementalidad. El estandar de mercados pareados pide 0,95; de 0,85 para arriba sirve dentro de una canasta ponderada. Requiere 8 semanas minimo, idealmente 26.';



CREATE OR REPLACE FUNCTION "public"."v_keywords_entre_locales"("p_account" "text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("keyword" "text", "match_type" "text", "locales" integer, "locales_que_convierten" integer, "en_corporativa" boolean, "clics" numeric, "conv" numeric, "gasto" numeric, "cpa" numeric, "tasa" numeric, "lectura" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with base as (
    select k.keyword kw, k.match_type mt, k.location loc, sum(k.clicks)::numeric cl, sum(k.conversions)::numeric cv, sum(k.cost)::numeric g
    from v_keywords_resueltas k
    where k.account = p_account and k.week_start >= (select max(week_start) from campaign where account = p_account) - (p_semanas - 1) * 7 and k.cost > 0
    group by 1, 2, 3
  ),
  agg as (select kw, mt,
      count(distinct loc) filter (where loc is not null)::int n_loc,
      count(distinct loc) filter (where loc is not null and cv > 0)::int n_conv,
      bool_or(loc is null) corp, sum(cl) cl, sum(cv) cv, sum(g) g
    from base group by 1, 2)
  select kw, mt, n_loc, n_conv, corp, round(cl), round(cv, 1), round(g, 2),
    round(g / nullif(cv, 0), 2), round(cv / nullif(cl, 0) * 100, 2),
    case when n_loc = 0 and corp then 'Solo en campana corporativa, no en locales'
         when n_loc = 1 then 'Solo en un local' || case when corp then ', mas la corporativa' else '' end
         when n_conv = 0 then 'En ' || n_loc || ' locales y no convierte en ninguno: revisar en toda la cuenta'
         when n_conv::numeric / n_loc < 0.4 then 'Convierte en ' || n_conv || ' de ' || n_loc || ' locales: funciona en algunos mercados, no en todos'
         when n_conv::numeric / n_loc < 0.8 then 'Convierte en ' || n_conv || ' de ' || n_loc || ' locales: desigual'
         else 'Convierte en ' || n_conv || ' de ' || n_loc || ' locales: consistente' end
  from agg order by g desc;
$$;


ALTER FUNCTION "public"."v_keywords_entre_locales"("p_account" "text", "p_semanas" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."v_keywords_entre_locales"("p_account" "text", "p_semanas" integer) IS 'Una fila por keyword unica de toda la cuenta: en cuantos locales corre, en cuantos convierte, y si ademas esta en la corporativa. Sin esto, ordenar keywords por gasto devuelve la misma keyword 28 veces con numeros chicos.';



CREATE OR REPLACE FUNCTION "public"."v_location_ranking_bayes"("p_account" "text", "p_semanas" integer DEFAULT 4) RETURNS TABLE("location" "text", "nombre" "text", "objetivo" "text", "grupo_par" "text", "clics" numeric, "conv" numeric, "gasto" numeric, "tasa_cruda" numeric, "tasa_ajustada" numeric, "cpa_crudo" numeric, "cpa_ajustado" numeric, "evidencia" "text", "puesto" bigint, "de_cuantos" bigint, "vs_mediana" numeric, "lectura" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with base as (
    select v.location loc, l.nombre nom, v.objetivo obj, coalesce(l.grupo_par, 'sin_fecha') gp,
           sum(v.clics)::numeric cl, sum(v.conversiones)::numeric cv, sum(v.gasto)::numeric g
    from v_por_location_semanal v left join locations l on l.account = v.account and l.codigo = v.location
    where v.account = p_account and v.week_start >= (select max(week_start) from campaign where account = p_account) - (p_semanas - 1) * 7
      and v.location <> '(sin local)'
    group by 1, 2, 3, 4
  ),
  prior as (select obj, gp, (sum(cv) / nullif(sum(cl), 0))::numeric tasa_media, coalesce(var_samp(cv / nullif(cl, 0)), 0)::numeric varianza, count(*) n from base where cl > 0 group by obj, gp),
  prior_cuenta as (select obj, (sum(cv) / nullif(sum(cl), 0))::numeric tasa_media, coalesce(var_samp(cv / nullif(cl, 0)), 0)::numeric varianza from base where cl > 0 group by obj),
  k as (select p.obj, p.gp, case when p.n >= 3 then p.tasa_media else pc.tasa_media end tasa_media,
          greatest(30::numeric, least(500::numeric, case when (case when p.n >= 3 then p.varianza else pc.varianza end) > 0
            then (case when p.n >= 3 then p.tasa_media else pc.tasa_media end) * (1 - (case when p.n >= 3 then p.tasa_media else pc.tasa_media end)) / (case when p.n >= 3 then p.varianza else pc.varianza end)
            else 200::numeric end)) k_clics, p.n
        from prior p join prior_cuenta pc on pc.obj = p.obj),
  ajust as (select b.*, k.tasa_media, k.k_clics, ((b.cv + k.tasa_media * k.k_clics) / nullif(b.cl + k.k_clics, 0))::numeric tasa_aj from base b join k on k.obj = b.obj and k.gp = b.gp),
  med as (select obj, gp, (percentile_cont(0.5) within group (order by tasa_aj))::numeric m, count(*) n from ajust group by obj, gp)
  select a.loc, a.nom, a.obj, a.gp, round(a.cl), round(a.cv, 1), round(a.g, 2),
    round(a.cv / nullif(a.cl, 0) * 100, 2), round(a.tasa_aj * 100, 2),
    round(a.g / nullif(a.cv, 0), 2), round(a.g / nullif(a.cl * a.tasa_aj, 0), 2),
    case when a.cl < a.k_clics * 0.3 then 'poca: la estimacion es casi el promedio de su grupo'
         when a.cl < a.k_clics then 'media: la estimacion sigue tirando al promedio'
         else 'suficiente: el numero es del local' end,
    rank() over (partition by a.obj, a.gp order by a.tasa_aj desc), m.n,
    round(a.tasa_aj / nullif(m.m, 0), 2),
    case when a.cl < a.k_clics * 0.3 then 'Sin evidencia suficiente para juzgarlo'
         when a.cv = 0 and a.cl >= a.k_clics then 'Cero conversiones con clics de sobra: revisar medicion antes que rendimiento'
         when a.tasa_aj > m.m * 1.4 then 'Rinde por encima de sus pares (' || a.gp || '): candidato a escalar'
         when a.tasa_aj < m.m * 0.6 then 'Rinde por debajo de sus pares (' || a.gp || '), ya ajustado por volumen'
         else 'En rango dentro de su grupo (' || a.gp || ')' end
  from ajust a join med m on m.obj = a.obj and m.gp = a.gp order by a.obj, a.gp, 13;
$$;


ALTER FUNCTION "public"."v_location_ranking_bayes"("p_account" "text", "p_semanas" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v_umbrales_alcanzables"() RETURNS TABLE("account" "text", "umbral" "text", "valor" numeric, "referencia" numeric, "veredicto" "text", "lectura" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  with r as (
    select d.account,
      max(g) gasto_max_dia,
      round(percentile_cont(0.6) within group (order by g))::numeric gasto_tipico,
      round(avg(g))::numeric gasto_promedio
    from (select account, date, sum(cost) g from campaign_daily where date >= current_date - 30 group by 1,2) d
    group by d.account)
  select c.account, 'sin_conv_min_gasto', c.sin_conv_min_gasto, r.gasto_max_dia,
    case when coalesce(c.sin_conv_min_gasto, 0) = 0 then 'APAGADO'
         when c.sin_conv_min_gasto > r.gasto_max_dia then 'IMPOSIBLE'
         when c.sin_conv_min_gasto < r.gasto_promedio * 0.3 then 'DEMASIADO BAJO'
         else 'OK' end,
    case when coalesce(c.sin_conv_min_gasto, 0) = 0 then 'Umbral en cero: nunca avisa por gasto sin conversion.'
         when c.sin_conv_min_gasto > r.gasto_max_dia then 'El umbral (' || c.sin_conv_min_gasto || ') es mayor que el gasto maximo de un dia (' || round(r.gasto_max_dia) || '): no puede dispararse nunca.'
         when c.sin_conv_min_gasto < r.gasto_promedio * 0.3 then 'El umbral es menos de un tercio del gasto diario promedio: va a avisar casi todos los dias y se vuelve ruido.'
         else 'Alcanzable y con margen.' end
  from cuentas c join r on r.account = c.account where c.activa
  union all
  select c.account, 'pico_de_gasto', round(c.presupuesto_diario * c.pico_gasto_factor), r.gasto_max_dia,
    case when c.presupuesto_diario * c.pico_gasto_factor > r.gasto_max_dia * 2 then 'IMPOSIBLE'
         when c.presupuesto_diario * c.pico_gasto_factor < r.gasto_tipico then 'DEMASIADO BAJO'
         else 'OK' end,
    case when c.presupuesto_diario * c.pico_gasto_factor > r.gasto_max_dia * 2 then 'El umbral de pico esta al doble del maximo historico: no va a disparar.'
         when c.presupuesto_diario * c.pico_gasto_factor < r.gasto_tipico then 'El umbral de pico esta por debajo de un dia tipico: va a avisar constantemente.'
         else 'Alcanzable: el maximo de 30 dias fue ' || round(r.gasto_max_dia) || ' contra un umbral de ' || round(c.presupuesto_diario * c.pico_gasto_factor) || '.' end
  from cuentas c join r on r.account = c.account where c.activa;
$$;


ALTER FUNCTION "public"."v_umbrales_alcanzables"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."v_umbrales_alcanzables"() IS 'Contrasta cada umbral de alerta contra lo que la cuenta realmente gasta. Un umbral mayor que el gasto maximo de un dia no puede dispararse nunca, y se ve igual de bien configurado que uno correcto.';



CREATE OR REPLACE FUNCTION "public"."validar_tipo_de_accion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v text; plat plataforma_pub; ok boolean;
begin
  -- Nombres historicos de la cola que no son verbos. Se mantienen porque el ejecutor
  -- los usa para saber a que nivel va la negativa; se traducen para validar.
  v := case new.tipo
         when 'negativa_campana' then 'agregar_negativa'
         when 'negativa_grupo'   then 'agregar_negativa'
         else new.tipo end;

  begin plat := coalesce(new.plataforma, 'google')::plataforma_pub;
  exception when others then plat := 'google'::plataforma_pub; end;

  select c.ejecutable into ok
    from capacidades_ejecucion c
   where c.verbo = v and c.plataforma = plat
   limit 1;

  if ok is null then
    raise exception 'Tipo de accion desconocido: "%". Los validos son los verbos de capacidades_ejecucion para la plataforma %, mas los alias historicos negativa_campana y negativa_grupo.', new.tipo, plat;
  end if;
  if not ok then
    raise exception 'El verbo "%" esta registrado como NO ejecutable por script en capacidades_ejecucion. No se encola: se hace a mano con los pasos de "Como hacerlo".', v;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."validar_tipo_de_accion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validar_tipo_de_accion"() IS 'Valida acciones_aprobadas.tipo contra capacidades_ejecucion en vez de contra una lista cableada. Reemplaza a acciones_aprobadas_tipo_check, que aceptaba 5 tipos mientras capacidades declaraba 14 y el ejecutor implementaba 14: nueve verbos no podian entrar a la cola aunque la app mostrara el boton. Si se agrega un verbo a capacidades_ejecucion, la cola lo acepta sola.';



CREATE OR REPLACE FUNCTION "public"."ventana_metrica"("p_account" "text", "p_tipo" "text" DEFAULT 'semanal_4'::"text") RETURNS TABLE("desde" "date", "hasta" "date", "dias" integer, "semanas" integer, "fuente" "text", "honesta" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select * from (
    -- 4 semanas COMPLETAS de la tabla semanal. Es la fuente para volumen y retrospectiva:
    -- la capa diaria tiene 15 a 17 dias y devolver eso etiquetado "30d" fue el ticket 37.
    select min(c.week_start) as desde,
           max(c.week_start) + 6 as hasta,
           (count(distinct c.week_start) * 7)::int as dias,
           count(distinct c.week_start)::int as semanas,
           'campaign (semanal)'::text as fuente,
           count(distinct c.week_start) >= 3 as honesta
      from campaign c
     where p_tipo = 'semanal_4'
       and c.account = p_account
       and c.week_start > (select max(week_start) from campaign c2 where c2.account = p_account) - 28
    union all
    -- La capa diaria, con los dias que REALMENTE tiene. Nunca asumir 30.
    select min(d.date), max(d.date), count(distinct d.date)::int,
           (count(distinct d.date) / 7)::int, 'campaign_daily (diaria)'::text,
           count(distinct d.date) >= 14
      from campaign_daily d
     where p_tipo = 'diaria_real' and d.account = p_account
    union all
    select min(c.week_start), max(c.week_start) + 6,
           (count(distinct c.week_start) * 7)::int, count(distinct c.week_start)::int,
           'campaign (semanal, 13 semanas)'::text, count(distinct c.week_start) >= 8
      from campaign c
     where p_tipo = 'trimestre' and c.account = p_account
       and c.week_start > current_date - 91
  ) q
  where q.desde is not null;
$$;


ALTER FUNCTION "public"."ventana_metrica"("p_account" "text", "p_tipo" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ventana_metrica"("p_account" "text", "p_tipo" "text") IS 'Ventana REAL de una cuenta, no la pedida. honesta=false significa que no hay historia suficiente para sostener un veredicto sobre esa ventana. Toda vista que necesite una ventana llama a esto en vez de escribir current_date - N.';



CREATE OR REPLACE FUNCTION "public"."verbo_probable"("p_titulo" "text", "p_por_que" "text" DEFAULT ''::"text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select case
    when p_titulo ~* '(agregar|añadir|sumar|crear).{0,30}negativ'                         then 'agregar_negativa'
    when p_titulo ~* '(quitar|sacar|eliminar|revisar|remover).{0,30}negativ'              then 'quitar_negativa'
    when p_titulo ~* 'pausar.{0,40}(keyword|palabra|termino)'                             then 'pausar_keyword'
    when p_titulo ~* '(reactivar|habilitar|activar).{0,40}(keyword|palabra)'              then 'reactivar_keyword'
    when p_titulo ~* 'pausar.{0,30}anuncio'                                               then 'pausar_anuncio'
    when p_titulo ~* 'pausar.{0,30}(grupo|ad group)'                                      then 'pausar_grupo'
    when p_titulo ~* 'pausar.{0,30}campa'                                                 then 'pausar_campana'
    when p_titulo ~* '(cambiar|pasar|ajustar).{0,40}concordancia'                         then 'cambiar_concordancia'
    when p_titulo ~* '(cambiar|pasar).{0,50}(estrategia de puja|maximizar (conversion|valor)|puja de|a maximizar)' then 'cambiar_estrategia_puja'
    when p_titulo ~* '(subir|bajar|quitar|ajustar|cambiar).{0,30}(tcpa|troas|cpa objetivo|roas objetivo|objetivo de (cpa|roas))' then 'cambiar_objetivo_puja'
    when p_titulo ~* '(subir|bajar|ajustar|cambiar).{0,30}presupuesto'                    then 'cambiar_presupuesto'
    else null end;
$$;


ALTER FUNCTION "public"."verbo_probable"("p_titulo" "text", "p_por_que" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."verbo_probable"("p_titulo" "text", "p_por_que" "text") IS 'Detecta si el titulo de un accionable describe algo que un script SI puede ejecutar. No adivina la entidad, solo el verbo: sirve para avisar que falta el Accion JSON, nunca para construirlo solo.';



CREATE OR REPLACE FUNCTION "public"."verificar_cifras"("p_brief" "text" DEFAULT NULL::"text", "p_limite" integer DEFAULT 200) RETURNS TABLE("verificadas" integer, "coinciden" integer, "difieren" integer, "no_reproducibles" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare r record; v numeric; n int := 0; ok int := 0; dif int := 0; nore int := 0; s text;
begin
  for r in
    select id, sql_origen, valor from cifras_publicadas
     where veredicto is null and (p_brief is null or brief_id = p_brief)
     order by publicada_el limit p_limite
  loop
    s := lower(btrim(r.sql_origen));

    -- Guarda de forma: el SQL lo escribe un agente, asi que solo se acepta UNA consulta
    -- de lectura. Sin esto la tabla seria una via de ejecucion arbitraria contra la base.
    if s !~ '^(select|with)\s' or s like '%;%'
       or s ~ '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do)\m' then
      update cifras_publicadas
         set veredicto = 'no_reproducible', verificada_el = now(),
             detalle = 'El SQL de origen no es una sola consulta de lectura. Solo se acepta un SELECT o WITH, sin punto y coma ni sentencias de escritura.'
       where id = r.id;
      nore := nore + 1; n := n + 1; continue;
    end if;

    begin
      execute 'select (' || r.sql_origen || ')::numeric' into v;
    exception when others then
      update cifras_publicadas
         set veredicto = 'no_reproducible', verificada_el = now(),
             detalle = 'La consulta ya no corre o no devuelve un solo numero: ' || sqlerrm ||
                       '. Suele significar que cambio una vista aguas abajo, que es justo lo que hay que saber.'
       where id = r.id;
      nore := nore + 1; n := n + 1; continue;
    end;

    -- Tolerancia relativa de una milesima: absorbe redondeo, no absorbe un error real.
    if v is not null and abs(v - r.valor) <= greatest(abs(r.valor) * 0.001, 0.01) then
      update cifras_publicadas
         set veredicto = 'coincide', valor_recalculado = v, verificada_el = now(), detalle = null
       where id = r.id;
      ok := ok + 1;
    else
      update cifras_publicadas
         set veredicto = 'difiere', valor_recalculado = v, verificada_el = now(),
             detalle = 'Publicado ' || r.valor || ', recalculado ' || coalesce(v::text, 'NULL') ||
                       '. La cifra del brief no se reproduce desde su propia fuente.'
       where id = r.id;
      dif := dif + 1;
    end if;
    n := n + 1;
  end loop;
  return query select n, ok, dif, nore;
end $$;


ALTER FUNCTION "public"."verificar_cifras"("p_brief" "text", "p_limite" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."verificar_cifras"("p_brief" "text", "p_limite" integer) IS 'Recalcula cada cifra publicada desde el SQL que la produjo. Determinista, sin modelo. Valida la forma del SQL antes de ejecutarlo porque el texto lo escribe un agente: solo una sentencia SELECT o WITH, sin punto y coma ni escrituras.';



CREATE OR REPLACE FUNCTION "public"."verificar_invariantes"("p_account" "text", "p_accion" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $_$
declare v jsonb := '[]'; verbo text; kw text; mt text; nivel text; grupo text; campana text;
        sim jsonb; conv90 numeric; topconv numeric; k text; nuc text; impr numeric;
        c_dia numeric; c_90 numeric; prot jsonb; semanas int; donde_convierte text;
begin
  verbo := p_accion->>'verbo'; kw := p_accion->'objeto'->>'keyword'; grupo := p_accion->'objeto'->>'grupo'; campana := p_accion->'objeto'->>'campana';
  mt := coalesce(p_accion->'parametros'->>'match_type_destino', p_accion->'objeto'->>'match_type', 'PHRASE'); nivel := coalesce(p_accion->'parametros'->>'nivel', 'grupo');

  if verbo in ('agregar_negativa', 'pausar_keyword') then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      nuc := toca_nucleo(p_account, k);
      if nuc is null then continue; end if;
      if verbo = 'pausar_keyword' then
        select coalesce(sum(impressions), 0) into impr from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(k);
        if impr = 0 then continue; end if;
      end if;
      v := v || jsonb_build_object('invariante', 'I0_toca_nucleo', 'bloquea', true, 'detalle', (case verbo when 'agregar_negativa' then 'La negativa "' else 'Pausar "' end) || k || '" toca el nucleo de la cuenta ("' || nuc || '")' || (case when verbo = 'pausar_keyword' then ' y tuvo ' || impr || ' impresiones en 30 dias' else '' end) || ': es la intencion en la que se basa la subasta.');
    end loop;
  end if;

  if verbo = 'agregar_negativa' then
    select count(distinct week_start) into semanas from campaign where account = p_account;
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      sim  := simular_negativa(p_account, k, mt, nivel, grupo);
      c_dia := coalesce((sim->>'conversiones_bloqueadas')::numeric, 0);
      c_90  := coalesce((sim->>'conversiones_bloqueadas_90d')::numeric, 0);
      prot  := coalesce(sim->'protegidos_afectados', '[]'::jsonb);

      if c_dia > 0 or c_90 > 0 then
        -- Dentro del alcance elegido se pierden conversiones. Bloquea siempre.
        v := v || jsonb_build_object('invariante', 'I2_negativa_bloquea_conversiones', 'bloquea', true, 'detalle',
          'La negativa "' || k || '" bloquearia trafico que convirtio DENTRO de su alcance (' || nivel ||
          case when nivel = 'grupo' and grupo is not null then ' ' || grupo else '' end || '): ' ||
          c_dia || ' conversiones en la ventana diaria (' || coalesce(sim->>'ventana_diaria_real','sin datos') ||
          ') y ' || c_90 || ' en 90 dias sobre la capa semanal.', 'simulacion', sim);

      elsif jsonb_array_length(prot) > 0 and nivel = 'grupo' and coalesce(semanas, 0) >= 8 then
        -- El termino esta protegido a nivel CUENTA pero no convierte en este grupo, y hay
        -- historia semanal suficiente para afirmarlo. Aviso con el dato, no bloqueo.
        select string_agg(distinct s.ad_group, ', ') into donde_convierte
          from search_terms s
         where s.account = p_account and s.week_start > current_date - 90
           and normalizar_entidad(s.search_term) = normalizar_entidad(k)
           and s.conversions > 0 and s.ad_group is distinct from grupo;
        v := v || jsonb_build_object('invariante', 'I2b_protegido_en_otro_alcance', 'bloquea', false, 'detalle',
          'La negativa "' || k || '" NO bloquea ninguna conversion en ' || coalesce(grupo, 'este grupo') ||
          ' (0 en la ventana diaria y 0 en ' || semanas || ' semanas), pero el termino figura en ' ||
          'terminos_protegidos, que es una lista de CUENTA: convierte en ' ||
          coalesce(donde_convierte, 'otro grupo de la cuenta') ||
          '. Por eso la exclusion va a nivel grupo y no de campana. Confirmar que es lo que se quiere.',
          'simulacion', sim);

      elsif (sim->>'bloquearia_conversiones')::boolean then
        -- Nivel campana, o sin historia semanal suficiente: se mantiene el bloqueo de antes.
        -- Un cero sin historia puede ser falta de datos y no ausencia de conversiones.
        v := v || jsonb_build_object('invariante', 'I2_negativa_bloquea_conversiones', 'bloquea', true, 'detalle',
          'La negativa "' || k || '" toca terminos protegidos: ' || prot::text ||
          '. Alcance ' || nivel || case when coalesce(semanas,0) < 8 then ', y la capa semanal tiene solo ' || coalesce(semanas,0) || ' semanas: un cero ahi puede ser falta de datos.' else '. A nivel campana la exclusion alcanza a todos los grupos, incluido donde convierte.' end,
          'simulacion', sim);
      end if;
    end loop;
  end if;

  if verbo = 'pausar_keyword' then
    for k in select jsonb_array_elements_text(coalesce(p_accion->'objeto'->'keywords', jsonb_build_array(kw))) loop
      if k is null then continue; end if;
      select sum(conversions) into conv90 from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(k);
      if coalesce(conv90, 0) > 0 then v := v || jsonb_build_object('invariante', 'I3_pausar_convierte', 'bloquea', true, 'detalle', 'La keyword "' || k || '" convirtio ' || conv90 || ' veces en 30 dias. No se pausa.'); end if;
      if exists (select 1 from terminos_protegidos where account = p_account and normalizar_entidad(termino) = normalizar_entidad(k)) then v := v || jsonb_build_object('invariante', 'I3b_pausar_protegido', 'bloquea', true, 'detalle', 'La keyword "' || k || '" es un termino protegido.'); end if;
    end loop;
  end if;

  if verbo = 'cambiar_concordancia' and kw is not null then
    select sum(conversions) into conv90 from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, '^[\[\"]+|[\]\"]+$', '', 'g')) = normalizar_entidad(kw);
    select sum(conversions) into topconv from keywords_daily where account = p_account and date >= current_date - 30 and ad_group = grupo;
    if coalesce(conv90, 0) > 0 and coalesce(topconv, 0) > 0 and conv90 / topconv > 0.4 then v := v || jsonb_build_object('invariante', 'I4_concordancia_keyword_principal', 'bloquea', false, 'detalle', 'La keyword "' || kw || '" trae el ' || round(conv90 / topconv * 100) || '% de las conversiones de ' || grupo || '. Medir 14 dias antes de otra cosa en el grupo.'); end if;
    if toca_nucleo(p_account, kw) is not null and coalesce(p_accion->'parametros'->>'match_type_destino', '') = 'EXACT' then v := v || jsonb_build_object('invariante', 'I4b_nucleo_a_exacta', 'bloquea', false, 'detalle', 'Pasar un termino del nucleo a exacta corta todas sus variantes.'); end if;
  end if;

  if verbo = 'cambiar_presupuesto' and (p_accion->'parametros'->>'valor_actual') is not null and (p_accion->'parametros'->>'valor_nuevo') is not null then
    if (p_accion->'parametros'->>'valor_nuevo')::numeric < (p_accion->'parametros'->>'valor_actual')::numeric * 0.7 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_baja_brusca', 'bloquea', false, 'detalle', 'Bajar mas de 30% de una vez reinicia el aprendizaje. En dos pasos.'); end if;
    if (p_accion->'parametros'->>'valor_nuevo')::numeric > (p_accion->'parametros'->>'valor_actual')::numeric * 1.2 then v := v || jsonb_build_object('invariante', 'I5_presupuesto_sube_brusca', 'bloquea', false, 'detalle', 'Subir mas de 20% de una vez: el CPA sube unos dias. En dos pasos.'); end if;
  end if;

  if verbo in ('cambiar_estrategia_puja', 'cambiar_puja') and campana is not null then
    if exists (select 1 from operator_log where account = p_account and fecha >= current_date - 14 and (que_cambio ilike '%puja%' or que_cambio ilike '%presupuesto%' or que_cambio ilike '%conversi%') and donde ilike '%' || campana || '%') then v := v || jsonb_build_object('invariante', 'I6_estructural_reciente', 'bloquea', false, 'detalle', 'Hubo otro cambio estructural en ' || campana || ' hace menos de 14 dias. Esperar.'); end if;
  end if;

  return v;
end $_$;


ALTER FUNCTION "public"."verificar_invariantes"("p_account" "text", "p_accion" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."verificar_invariantes"("p_account" "text", "p_accion" "jsonb") IS 'Invariantes antes de encolar una accion. I2 mide el radio de la evidencia: bloquea siempre que se pierdan conversiones DENTRO del alcance elegido, y a nivel grupo degrada a aviso (I2b) cuando el termino solo esta protegido a nivel cuenta y hay al menos 8 semanas de historia semanal para afirmar el cero. A nivel campana se mantiene el bloqueo completo, que es el caso que motivo la invariante.';



CREATE OR REPLACE FUNCTION "public"."verificar_pulso_del_dia"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare esperadas int; escritas int; dia date;
begin
  -- El pulso analiza el dia anterior, asi que se le da margen: cuenta como al dia si hay
  -- filas de ayer o de hoy.
  select count(*) into esperadas from cuentas where activa;
  select count(distinct account), max(fecha) into escritas, dia
    from pulso_diario where fecha >= current_date - 1;

  if escritas >= esperadas then
    perform latir('pulso_diario', true);
    return 'ok: ' || escritas || ' de ' || esperadas || ' cuentas con pulso al ' || dia;
  else
    perform latir('pulso_diario', false,
      'Solo ' || escritas || ' de ' || esperadas || ' cuentas tienen pulso de ayer u hoy. ' ||
      'El dato mas nuevo de pulso_diario es del ' || coalesce((select max(fecha)::text from pulso_diario), 'nunca') ||
      '. Ojo: pulso_respaldo puede figurar OK igual, porque ese latido mide el disparo y no el efecto.');
    return 'falla: ' || escritas || ' de ' || esperadas;
  end if;
end $$;


ALTER FUNCTION "public"."verificar_pulso_del_dia"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."verificar_pulso_del_dia"() IS 'Vigila el EFECTO del pulso diario, no su disparo. pulso_respaldo late OK cuando la llamada sale sin excepcion, aunque la app falle despues y no escriba nada: asi el pulso estuvo muerto dos dias en las cuatro cuentas sin que ninguna alarma sonara.';



CREATE OR REPLACE FUNCTION "public"."volcar_crons"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'cron', 'pg_temp'
    AS $$
  select '-- ============================================================' || E'\n'
      || '-- NORTHSIGNAL · TAREAS PROGRAMADAS' || E'\n'
      || '-- Generado el ' || now()::date || '.' || E'\n'
      || '-- Sin esto el esquema esta completo y el sistema no hace nada solo.' || E'\n'
      || '-- Los horarios son UTC. Buenos Aires es UTC-3.' || E'\n'
      || '-- ============================================================' || E'\n\n'
      || string_agg(
        '-- ' || j.jobname || ' · ' || j.schedule || ' UTC' || E'\n'
        || 'select cron.unschedule(jobid) from cron.job where jobname = ' || quote_literal(j.jobname) || ';' || E'\n'
        || 'select cron.schedule(' || quote_literal(j.jobname) || ', ' || quote_literal(j.schedule) || ', ' || quote_literal(j.command) || ');',
        E'\n\n' order by j.schedule, j.jobname)
  from cron.job j where j.active;
$$;


ALTER FUNCTION "public"."volcar_crons"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."volcar_crons"() IS 'Vuelca las tareas programadas para el respaldo. SECURITY DEFINER a proposito: lee el schema cron, que pg_cron reserva para postgres, y la app llama con otro rol. Si vuelve a INVOKER, /api/respaldo devuelve 500 y el bloque de Sistema deja de renderizarse sin decir por que.';



CREATE OR REPLACE FUNCTION "public"."volcar_esquema"() RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
with partes as (
  -- 0. Extensiones que el esquema necesita
  select 0 orden, 0 sub, 'extensiones' nombre,
    E'-- Extensiones\ncreate extension if not exists pgcrypto with schema extensions;\ncreate extension if not exists vector with schema extensions;\ncreate extension if not exists pg_cron;\ncreate extension if not exists pg_net with schema extensions;' bloque
  union all
  -- 1. Tablas, sin restricciones todavia
  select 1, 0, c.relname,
    'create table if not exists public.' || quote_ident(c.relname) || E' (\n  ' || string_agg(
      quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
      || case when a.attnotnull then ' not null' else '' end
      || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''), E',\n  ' order by a.attnum) || E'\n);'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r' group by c.relname
  union all
  -- 2. Claves primarias y unicas primero: las foraneas las necesitan
  select 2, case co.contype when 'p' then 0 when 'u' then 1 when 'c' then 2 else 3 end, co.conname,
    'alter table public.' || quote_ident(c.relname) || ' add constraint ' || quote_ident(co.conname) || ' ' || pg_get_constraintdef(co.oid) || ';'
  from pg_constraint co join pg_class c on c.oid = co.conrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and co.contype in ('p','u','c','f')
  union all
  -- 3. Indices que no vienen de una restriccion
  select 3, 0, i.indexname, replace(i.indexdef, 'CREATE INDEX', 'CREATE INDEX IF NOT EXISTS') || ';'
  from pg_indexes i where i.schemaname = 'public'
    and not exists (select 1 from pg_constraint co where co.conname = i.indexname)
  union all
  -- 4. Funciones. Van antes que las vistas: una vista puede llamar a una funcion
  -- y Postgres no la crea si la funcion no existe todavia.
  select 4, 0, p.proname, pg_get_functiondef(p.oid) || E';'
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  union all
  -- 5. Vistas POR NIVEL de dependencia. 18 de nuestras vistas dependen de otras vistas
  -- (148 aristas): crearlas en orden alfabetico falla.
  select 5, nv.nivel, v.viewname,
    'create or replace view public.' || quote_ident(v.viewname) || ' with (security_invoker = true) as' || E'\n' || v.definition
  from pg_views v join nivel_de_vistas() nv on nv.vista = v.viewname
  where v.schemaname = 'public'
  union all
  -- 6. RLS
  select 6, 0, c.relname, 'alter table public.' || quote_ident(c.relname) || ' enable row level security;'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  union all
  -- 7. Triggers
  select 7, 0, t.tgname, pg_get_triggerdef(t.oid) || ';'
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
  union all
  -- 8. Comentarios: la unica documentacion pegada al objeto que describe
  select 8, 0, c.relname, 'comment on table public.' || quote_ident(c.relname) || ' is ' || quote_literal(obj_description(c.oid)) || ';'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and obj_description(c.oid) is not null
  union all
  select 8, 1, p.proname, 'comment on function public.' || quote_ident(p.proname) || '(' || pg_get_function_identity_arguments(p.oid) || ') is ' || quote_literal(obj_description(p.oid)) || ';'
  from pg_proc p where p.pronamespace = 'public'::regnamespace and obj_description(p.oid) is not null
  union all
  select 8, 2, c.relname, 'comment on column public.' || quote_ident(c.relname) || '.' || quote_ident(a.attname) || ' is ' || quote_literal(col_description(c.oid, a.attnum)) || ';'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0
  where n.nspname = 'public' and col_description(c.oid, a.attnum) is not null
)
select E'-- ============================================================\n'
    || E'-- NORTHSIGNAL · LINEA BASE DEL ESQUEMA\n'
    || '-- Generado el ' || now()::date || E' desde el catalogo de Postgres.\n'
    || E'-- Este archivo reconstruye la base entera desde cero. Los datos que el\n'
    || E'-- sistema necesita para funcionar van en el archivo de semillas.\n'
    || E'-- Las tareas programadas van en el archivo de crons.\n'
    || E'-- ============================================================\n\n'
    || string_agg(bloque, E'\n\n' order by orden, sub, nombre)
from partes;
$$;


ALTER FUNCTION "public"."volcar_esquema"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."volcar_semillas"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  t text; out text := ''; fila text; cols text;
  tablas text[] := array['cuentas','capacidades_ejecucion','objetivos_conversion','campaign_mapa',
    'locations','filtro_umbrales','terminos_protegidos','doc_maestro_humano','account_targets',
    'grupos_reporte','politicas_auto','escritores','ajustes_sistema','funnel_stages','bid_targets'];
begin
  out := '-- ============================================================' || E'\n'
      || '-- NORTHSIGNAL · DATOS SEMILLA' || E'\n'
      || '-- Generado el ' || now()::date || '.' || E'\n'
      || '-- Estas filas SON el sistema: sin ellas el esquema esta completo y nada funciona.' || E'\n'
      || '-- No incluye datos de Google Ads: esos los repone la extraccion.' || E'\n'
      || '-- ============================================================' || E'\n';
  foreach t in array tablas loop
    if not exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then continue; end if;
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns where table_schema='public' and table_name=t
      and column_name not in ('id','created_at','updated_at') and is_generated='NEVER';
    execute format(
      'select string_agg(''insert into public.%I (%s) values ('' || linea || '') on conflict do nothing;'', E''\n'') from ('
      || 'select (select string_agg(case when v is null then ''null'' else quote_literal(v) end, '', '') '
      || 'from unnest(array[%s]) v) linea from public.%I) x',
      t, cols,
      (select string_agg('(' || quote_ident(column_name) || ')::text', ', ' order by ordinal_position)
       from information_schema.columns where table_schema='public' and table_name=t
         and column_name not in ('id','created_at','updated_at') and is_generated='NEVER'),
      t) into fila;
    if fila is not null then
      out := out || E'\n-- ' || t || E'\n' || fila || E'\n';
    end if;
  end loop;
  return out;
end $$;


ALTER FUNCTION "public"."volcar_semillas"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accionable_comentarios" (
    "comment_id" "text" NOT NULL,
    "notion_id" "text" NOT NULL,
    "account" "text",
    "autor" "text" NOT NULL,
    "prefijo" "text",
    "texto" "text" NOT NULL,
    "creado" timestamp with time zone NOT NULL,
    "sincronizado" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."accionable_comentarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accionable_relaciones" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "a" "text" NOT NULL,
    "b" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "regla" "text" NOT NULL,
    "motivo" "text" NOT NULL,
    "severidad" "text" DEFAULT 'bloquea'::"text" NOT NULL,
    "detectada" timestamp with time zone DEFAULT "now"(),
    "resuelta" boolean DEFAULT false,
    "resuelta_el" timestamp with time zone,
    "resuelta_por" "text",
    CONSTRAINT "accionable_relaciones_severidad_check" CHECK (("severidad" = ANY (ARRAY['bloquea'::"text", 'avisa'::"text"]))),
    CONSTRAINT "accionable_relaciones_tipo_check" CHECK (("tipo" = ANY (ARRAY['conflicta_con'::"text", 'depende_de'::"text", 'comparte_causa'::"text", 'reemplaza'::"text", 'bloquea_keyword'::"text"])))
);


ALTER TABLE "public"."accionable_relaciones" OWNER TO "postgres";


COMMENT ON TABLE "public"."accionable_relaciones" IS 'Grafo entre accionables. bloquea = no se ejecuta uno mientras el otro este abierto; avisa = se muestra. Lo escribe detectar_conflictos() cada manana y antes de cada ejecucion (pre-vuelo).';



CREATE SEQUENCE IF NOT EXISTS "public"."accionable_relaciones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."accionable_relaciones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."accionable_relaciones_id_seq" OWNED BY "public"."accionable_relaciones"."id";



CREATE TABLE IF NOT EXISTS "public"."accionable_versiones" (
    "id" bigint NOT NULL,
    "notion_id" "text" NOT NULL,
    "version" integer NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"(),
    "autor" "text",
    "diff" "jsonb" NOT NULL,
    "motivo" "text",
    "hash" "text" NOT NULL
);


ALTER TABLE "public"."accionable_versiones" OWNER TO "postgres";


COMMENT ON TABLE "public"."accionable_versiones" IS 'Historial de cada accionable: version, fecha, autor, diff por campo, motivo. Lo escribe el server al sincronizar (hash de titulo+por_que+accion+como_hacerlo+entidad+prioridad). El agente edita en Notion; esto lo registra. Append-only.';



CREATE SEQUENCE IF NOT EXISTS "public"."accionable_versiones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."accionable_versiones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."accionable_versiones_id_seq" OWNED BY "public"."accionable_versiones"."id";



CREATE TABLE IF NOT EXISTS "public"."accionables_ejecutados" (
    "notion_id" "text" NOT NULL,
    "account" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "ejecutado_el" "date" NOT NULL,
    "metrica_objetivo" "text",
    "direccion_esperada" "text",
    "entidad_tipo" "text",
    "entidad_nombre" "text",
    "causa_raiz" "text",
    "naturaleza" "text",
    "sincronizado_el" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."accionables_ejecutados" OWNER TO "postgres";


COMMENT ON TABLE "public"."accionables_ejecutados" IS 'Espejo de accionables en estado Hecho con Ejecutado el, sincronizado desde Notion por el cron. Permite calcular impacto en SQL. metrica_objetivo y direccion_esperada se extraen del campo "Verificar el" del accionable.';



CREATE TABLE IF NOT EXISTS "public"."accionables_espejo" (
    "notion_id" "text" NOT NULL,
    "account" "text",
    "titulo" "text",
    "estado" "text",
    "prioridad" "text",
    "naturaleza" "text",
    "origen" "text",
    "entidad" "text",
    "causa_raiz" "text",
    "por_que" "text",
    "detectado" "date",
    "ejecutado_el" "date",
    "vence" "date",
    "reemplazado_por" "text",
    "semanas_pendiente" integer,
    "revision_ia" "text",
    "ultima_edicion" timestamp with time zone,
    "sincronizado" timestamp with time zone DEFAULT "now"(),
    "accion" "jsonb",
    "accion_valida" boolean,
    "accion_error" "text",
    "hash" "text",
    "version" integer DEFAULT 1,
    "como_hacerlo" "text",
    "donde" "text",
    "url" "text",
    "plataforma" "public"."plataforma_pub" DEFAULT 'google'::"public"."plataforma_pub" NOT NULL
);


ALTER TABLE "public"."accionables_espejo" OWNER TO "postgres";


COMMENT ON COLUMN "public"."accionables_espejo"."accion" IS 'Estado estructurado {verbo, objeto, parametros, verificar}, validado por el server contra el estandar y contra la base. accion_valida=false con accion_error dice por que.';



CREATE TABLE IF NOT EXISTS "public"."acciones_aprobadas" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "notion_id" "text",
    "tipo" "text" NOT NULL,
    "campana" "text",
    "grupo" "text",
    "keyword" "text",
    "match_type" "text" DEFAULT 'PHRASE'::"text",
    "ad_id" "text",
    "aprobada_el" timestamp with time zone DEFAULT "now"(),
    "aprobada_por" "text" DEFAULT 'andres'::"text",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "modo" "text" DEFAULT 'simular'::"text" NOT NULL,
    "resultado" "text",
    "ejecutada_el" timestamp with time zone,
    "revertible" boolean DEFAULT true,
    "revertida_el" timestamp with time zone,
    "por_politica" boolean DEFAULT false,
    "match_type_destino" "text",
    "keywords" "text"[],
    "nivel" "text",
    "estrategia_destino" "text",
    "valor_actual" numeric,
    "valor_nuevo" numeric,
    "etiqueta" "text",
    "plataforma" "public"."plataforma_pub" DEFAULT 'google'::"public"."plataforma_pub" NOT NULL,
    "no_ejecutar_antes_de" "date",
    CONSTRAINT "acciones_aprobadas_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'simulada'::"text", 'ejecutada'::"text", 'fallida'::"text", 'revertida'::"text"]))),
    CONSTRAINT "acciones_aprobadas_match_type_destino_check" CHECK (("match_type_destino" = ANY (ARRAY['EXACT'::"text", 'PHRASE'::"text", 'BROAD'::"text"]))),
    CONSTRAINT "acciones_aprobadas_modo_check" CHECK (("modo" = ANY (ARRAY['simular'::"text", 'ejecutar'::"text"])))
);


ALTER TABLE "public"."acciones_aprobadas" OWNER TO "postgres";


COMMENT ON TABLE "public"."acciones_aprobadas" IS 'Lo que Andres aprobo con un clic para que el script ejecutor lo aplique en Google Ads. Solo negativas y pausas (reversibles). modo=simular escribe que haria sin tocar la cuenta; ejecutar aplica. Nunca presupuesto, puja ni conversiones.';



COMMENT ON COLUMN "public"."acciones_aprobadas"."keywords" IS 'Lote: lista de keywords para pausar o agregar como negativas en una sola accion. El ejecutor itera y reporta una por una.';



COMMENT ON COLUMN "public"."acciones_aprobadas"."valor_actual" IS 'Valor antes del cambio. Obligatorio en cambiar_presupuesto, cambiar_objetivo_puja y cambiar_cpc_keyword: sin el no se puede revertir.';



COMMENT ON COLUMN "public"."acciones_aprobadas"."no_ejecutar_antes_de" IS 'Copiada del accionable al aprobar. v_acciones_pendientes no entrega la fila hasta esta fecha. Es la red por si la accion entra por un camino que no pasa por prevuelo().';



CREATE SEQUENCE IF NOT EXISTS "public"."acciones_aprobadas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."acciones_aprobadas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."acciones_aprobadas_id_seq" OWNED BY "public"."acciones_aprobadas"."id";



CREATE TABLE IF NOT EXISTS "public"."account_state" (
    "id" bigint NOT NULL,
    "account" "text",
    "section" "text",
    "item" "text",
    "value" "text",
    "detail" "text",
    "run_ts" "text"
);


ALTER TABLE "public"."account_state" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_state" IS 'Estructura real de la cuenta, regenerada cada semana. UNICA fuente de verdad sobre que existe: campanas, grupos, targets, conteos de keywords, negativas y acciones de conversion. Si algo no aparece aca, no existe.';



CREATE SEQUENCE IF NOT EXISTS "public"."account_state_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."account_state_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."account_state_id_seq" OWNED BY "public"."account_state"."id";



CREATE TABLE IF NOT EXISTS "public"."account_targets" (
    "account" "text" NOT NULL,
    "conversiones_mes_objetivo" numeric,
    "conversiones_mes_origen" "text",
    "cpa_maximo" numeric,
    "cpa_maximo_origen" "text",
    "presupuesto_mes_maximo" numeric,
    "ciclo_venta_dias" integer,
    "conversiones_minimas_smart_bidding" integer DEFAULT 15,
    "notas" "text",
    "actualizado" timestamp with time zone DEFAULT "now"(),
    "actualizado_por" "text",
    "conv_mes_objetivo_90d" numeric,
    "objetivo_90d_desde" "date",
    "objetivo_90d_nota" "text"
);


ALTER TABLE "public"."account_targets" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_targets" IS 'Objetivos declarados por cuenta. Sin esto, el analisis solo compara contra la semana previa; con esto, compara contra lo que el negocio necesita. cpa_maximo debe venir del margen (finanzas), no de la historia: es el unico numero defendible. Si el origen es provisional, las proyecciones se marcan tentativas.';



COMMENT ON COLUMN "public"."account_targets"."conv_mes_objetivo_90d" IS 'A cuantas conversiones/mes queremos llegar en 90 dias. Es la ambicion; el semanal mide la brecha y propone que la cierra.';



CREATE TABLE IF NOT EXISTS "public"."adgroup" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "campaign_status" "text",
    "ad_group" "text",
    "ad_group_status" "text",
    "ad_group_type" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "cost" numeric,
    "conversions" numeric,
    "all_conversions" numeric,
    "conv_value" numeric,
    "cost_per_conv" numeric,
    "conv_rate" numeric,
    "impr_share" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."adgroup" OWNER TO "postgres";


COMMENT ON TABLE "public"."adgroup" IS 'CAPA SEMANAL. Grupos de anuncios por semana. Para analisis diario usar adgroup_daily. No mezclar ambas en una misma suma.';



CREATE TABLE IF NOT EXISTS "public"."adgroup_daily" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "date" "date" NOT NULL,
    "campaign" "text" NOT NULL,
    "ad_group" "text" NOT NULL,
    "campaign_status" "text",
    "ad_group_status" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "cost" numeric,
    "conversions" numeric,
    "cost_per_conv" numeric,
    "conv_rate" numeric,
    "impr_share" numeric,
    "run_ts" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."adgroup_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."adgroup_daily" IS 'CAPA DIARIA. Grupos por dia, ventana movil de 14 dias con correccion. Consultar via v_adgroup_daily para tener la marca de madurez.';



CREATE SEQUENCE IF NOT EXISTS "public"."adgroup_daily_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."adgroup_daily_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."adgroup_daily_id_seq" OWNED BY "public"."adgroup_daily"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."adgroup_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."adgroup_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."adgroup_id_seq" OWNED BY "public"."adgroup"."id";



CREATE TABLE IF NOT EXISTS "public"."ads" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "ad_group" "text",
    "ad_id" numeric,
    "ad_type" "text",
    "ad_strength" "text",
    "status" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "cost" numeric,
    "conversions" numeric,
    "conv_value" numeric,
    "cost_per_conv" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."ads" OWNER TO "postgres";


COMMENT ON TABLE "public"."ads" IS 'CAPA SEMANAL. Anuncios con metricas de la semana. Solo los que tuvieron impresiones.';



CREATE SEQUENCE IF NOT EXISTS "public"."ads_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ads_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ads_id_seq" OWNED BY "public"."ads"."id";



CREATE TABLE IF NOT EXISTS "public"."ai_max_estado" (
    "account" "text" NOT NULL,
    "entidad" "text" NOT NULL,
    "firma" "text" NOT NULL,
    "visto_el" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_max_estado" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_max_estado" IS 'Estado de AI Max ya conocido por campana. AI Max activo es un estado, no un evento: sin esto el centinela avisaba 16 campanas en cada corrida, 384 mails por dia con el centinela cada hora. Solo se avisa cuando la firma cambia.';



CREATE TABLE IF NOT EXISTS "public"."ajustes_sistema" (
    "clave" "text" NOT NULL,
    "valor" "jsonb" NOT NULL,
    "actualizado" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ajustes_sistema" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alertas" (
    "id" bigint NOT NULL,
    "account" "text",
    "nivel" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "detalle" "text",
    "accion" "text",
    "origen" "text" NOT NULL,
    "entidad" "text",
    "fecha_dato" "date",
    "estado" "text" DEFAULT 'abierta'::"text" NOT NULL,
    "silenciada_hasta" "date",
    "silenciada_por_que" "text",
    "creada" timestamp with time zone DEFAULT "now"(),
    "vista_el" timestamp with time zone,
    "resuelta_el" timestamp with time zone,
    "dedupe_key" "text",
    CONSTRAINT "alertas_estado_check" CHECK (("estado" = ANY (ARRAY['abierta'::"text", 'vista'::"text", 'resuelta'::"text", 'silenciada'::"text"]))),
    CONSTRAINT "alertas_nivel_check" CHECK (("nivel" = ANY (ARRAY['hoy'::"text", 'semana'::"text", 'digest'::"text"])))
);


ALTER TABLE "public"."alertas" OWNER TO "postgres";


COMMENT ON TABLE "public"."alertas" IS 'Alertas unificadas del sistema. nivel hoy = interrumpe (mail); semana = se ve en Hoy, no avisa; digest = se ve en Sistema. dedupe_key evita repetir. silenciar registra por que y hasta cuando (suppression logged).';



CREATE SEQUENCE IF NOT EXISTS "public"."alertas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."alertas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."alertas_id_seq" OWNED BY "public"."alertas"."id";



CREATE TABLE IF NOT EXISTS "public"."alerts" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "severity" "text",
    "type" "text",
    "entity" "text",
    "detail" "text",
    "value" "text",
    "threshold" "text",
    "run_ts" "text"
);


ALTER TABLE "public"."alerts" OWNER TO "postgres";


COMMENT ON TABLE "public"."alerts" IS 'Alertas evaluadas por el script contra los umbrales de cada cliente. Severidad ALTA requiere accion.';



CREATE SEQUENCE IF NOT EXISTS "public"."alerts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."alerts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."alerts_id_seq" OWNED BY "public"."alerts"."id";



CREATE TABLE IF NOT EXISTS "public"."annotations" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "fecha" "date" NOT NULL,
    "titulo" "text" NOT NULL,
    "detalle" "text",
    "tipo" "text" DEFAULT 'nota'::"text",
    "creado_por" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "annotations_tipo_check" CHECK (("tipo" = ANY (ARRAY['nota'::"text", 'cambio_externo'::"text", 'estacionalidad'::"text", 'incidente'::"text", 'hipotesis'::"text"])))
);


ALTER TABLE "public"."annotations" OWNER TO "postgres";


COMMENT ON TABLE "public"."annotations" IS 'Notas del analista ancladas a una fecha y cuenta. Sirven para registrar contexto que no vive en ninguna API: cambio de landing, campana del cliente en otro canal, feriado local, incidente de tracking. Se superponen sobre los graficos junto con los cambios de plataforma.';



CREATE SEQUENCE IF NOT EXISTS "public"."annotations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."annotations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."annotations_id_seq" OWNED BY "public"."annotations"."id";



CREATE TABLE IF NOT EXISTS "public"."audiences" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "ad_group" "text",
    "audience" "text",
    "type" "text",
    "bid_modifier" numeric,
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "cost" numeric,
    "conversions" numeric,
    "conv_value" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."audiences" OWNER TO "postgres";


COMMENT ON TABLE "public"."audiences" IS 'CAPA SEMANAL. Audiencias a nivel campana y grupo, con su modificador de puja.';



CREATE SEQUENCE IF NOT EXISTS "public"."audiences_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audiences_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audiences_id_seq" OWNED BY "public"."audiences"."id";



CREATE TABLE IF NOT EXISTS "public"."auditoria_objetos_ultima" (
    "corrida_el" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vistas_ok" integer,
    "vistas_falla" integer,
    "funciones_ok" integer,
    "funciones_falla" integer,
    "detalle" "jsonb"
);


ALTER TABLE "public"."auditoria_objetos_ultima" OWNER TO "postgres";


COMMENT ON TABLE "public"."auditoria_objetos_ultima" IS 'Resultado de la ultima prueba de vistas y funciones. La salud lee esta tabla en vez de ejecutar las pruebas, que tardan segundos y no pueden correr en cada consulta.';



CREATE TABLE IF NOT EXISTS "public"."backups_memoria" (
    "id" bigint NOT NULL,
    "creado" timestamp with time zone DEFAULT "now"(),
    "tablas" "jsonb" NOT NULL,
    "filas_total" integer,
    "bytes" integer
);


ALTER TABLE "public"."backups_memoria" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."backups_memoria_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."backups_memoria_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."backups_memoria_id_seq" OWNED BY "public"."backups_memoria"."id";



CREATE TABLE IF NOT EXISTS "public"."bid_targets" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "level" "text",
    "campaign" "text",
    "ad_group" "text",
    "status" "text",
    "bid_strategy" "text",
    "target_cpa" numeric,
    "target_roas" numeric,
    "target_source" "text",
    "cpc_bid_or_budget" numeric,
    "currency" "text",
    "run_ts" "text"
);


ALTER TABLE "public"."bid_targets" OWNER TO "postgres";


COMMENT ON TABLE "public"."bid_targets" IS 'Targets efectivos por campana y grupo. target_source indica si el valor es propio del grupo o heredado de la campana.';



CREATE SEQUENCE IF NOT EXISTS "public"."bid_targets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bid_targets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bid_targets_id_seq" OWNED BY "public"."bid_targets"."id";



CREATE TABLE IF NOT EXISTS "public"."budget" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "daily_budget" numeric,
    "expected_week" numeric,
    "actual_cost" numeric,
    "pacing_pct" numeric,
    "delivery_method" "text",
    "currency" "text",
    "lost_is_budget" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."budget" OWNER TO "postgres";


COMMENT ON TABLE "public"."budget" IS 'CAPA SEMANAL. Presupuesto y ritmo de gasto. Para diario usar budget_daily.';



CREATE TABLE IF NOT EXISTS "public"."budget_daily" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "date" "date" NOT NULL,
    "campaign" "text" NOT NULL,
    "daily_budget" numeric,
    "actual_cost" numeric,
    "pacing_pct" numeric,
    "delivery_method" "text",
    "currency" "text",
    "lost_is_budget" numeric,
    "run_ts" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."budget_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."budget_daily" IS 'CAPA DIARIA. Presupuesto y gasto real por dia, con ritmo calculado.';



CREATE SEQUENCE IF NOT EXISTS "public"."budget_daily_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."budget_daily_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."budget_daily_id_seq" OWNED BY "public"."budget_daily"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."budget_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."budget_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."budget_id_seq" OWNED BY "public"."budget"."id";



CREATE TABLE IF NOT EXISTS "public"."cambios_config" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "entidad" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "campo" "text" NOT NULL,
    "valor_anterior" "text",
    "valor_nuevo" "text",
    "detectado_el" "date" NOT NULL,
    "foto_anterior" "date",
    "foto_actual" "date",
    "visto" boolean DEFAULT false
);


ALTER TABLE "public"."cambios_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."cambios_config" IS 'Cambios detectados comparando dos fotos consecutivas de config_snapshot. No depende de que Google los registre en change_events, que tiene huecos: en FRESH_MONKEE no expuso nada desde el 15 de agosto pese a que una campana se pauso el 1 de septiembre.';



CREATE SEQUENCE IF NOT EXISTS "public"."cambios_config_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cambios_config_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cambios_config_id_seq" OWNED BY "public"."cambios_config"."id";



CREATE TABLE IF NOT EXISTS "public"."cambios_de_sistema" (
    "id" bigint NOT NULL,
    "cuando" timestamp with time zone DEFAULT "now"(),
    "quien" "text" DEFAULT 'claude'::"text" NOT NULL,
    "que" "text" NOT NULL,
    "por_que" "text",
    "objetos" "text"[],
    "version" "text",
    "revierte_como" "text"
);


ALTER TABLE "public"."cambios_de_sistema" OWNER TO "postgres";


COMMENT ON TABLE "public"."cambios_de_sistema" IS 'Bitacora de cambios al sistema. Cada chat declara que toco antes de terminar. Sirve para que el siguiente no arregle lo mismo de otra forma ni deshaga lo recien hecho.';



CREATE SEQUENCE IF NOT EXISTS "public"."cambios_de_sistema_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cambios_de_sistema_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cambios_de_sistema_id_seq" OWNED BY "public"."cambios_de_sistema"."id";



CREATE TABLE IF NOT EXISTS "public"."campaign" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "status" "text",
    "channel" "text",
    "bid_strategy" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "avg_cpm" numeric,
    "cost" numeric,
    "conversions" numeric,
    "all_conversions" numeric,
    "conv_value" numeric,
    "cost_per_conv" numeric,
    "conv_rate" numeric,
    "roas" numeric,
    "impr_share" numeric,
    "top_impr_share" numeric,
    "abs_top_impr_share" numeric,
    "lost_is_budget" numeric,
    "lost_is_rank" numeric,
    "click_share" numeric,
    "run_ts" "text",
    "plataforma" "public"."plataforma_pub" DEFAULT 'google'::"public"."plataforma_pub" NOT NULL
);


ALTER TABLE "public"."campaign" OWNER TO "postgres";


COMMENT ON TABLE "public"."campaign" IS 'CAPA SEMANAL · una fila por campana y semana. Fuente de la mayoria de los briefs. NO sumar junto con campaign_daily: contienen los mismos hechos con distinta granularidad y sumarlas duplica el gasto. Verificado: la semana del 24 de agosto da 935,39 EUR en KAREDO por las dos vias.';



COMMENT ON COLUMN "public"."campaign"."conversions" IS 'Conversiones primarias de Google Ads. Solo las acciones marcadas como primarias entrenan Smart Bidding.';



COMMENT ON COLUMN "public"."campaign"."all_conversions" IS 'Suma de TODAS las acciones, primarias y secundarias. Casi nunca es negocio real. No reportar al cliente.';



COMMENT ON COLUMN "public"."campaign"."lost_is_budget" IS 'Porcentaje de cuota de impresiones perdida por presupuesto insuficiente. Si es alto, subir presupuesto genera volumen.';



COMMENT ON COLUMN "public"."campaign"."lost_is_rank" IS 'Porcentaje perdido por ad rank, es decir puja y calidad. Si es alto, subir presupuesto NO resuelve.';



CREATE TABLE IF NOT EXISTS "public"."campaign_daily" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "date" "date" NOT NULL,
    "campaign" "text" NOT NULL,
    "status" "text",
    "channel" "text",
    "bid_strategy" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "avg_cpm" numeric,
    "cost" numeric,
    "conversions" numeric,
    "cost_per_conv" numeric,
    "conv_rate" numeric,
    "impr_share" numeric,
    "top_impr_share" numeric,
    "abs_top_impr_share" numeric,
    "lost_is_budget" numeric,
    "lost_is_rank" numeric,
    "click_share" numeric,
    "run_ts" timestamp with time zone DEFAULT "now"(),
    "plataforma" "public"."plataforma_pub" DEFAULT 'google'::"public"."plataforma_pub" NOT NULL
);


ALTER TABLE "public"."campaign_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."campaign_daily" IS 'Rendimiento diario por campana. Se reextrae en ventana movil de 14 dias con upsert sobre (account, date, campaign): los dias recientes se corrigen solos a medida que Google asienta conversiones y ajusta atribucion. No expone conv_value, all_conversions ni roas, igual que la capa semanal.';



CREATE SEQUENCE IF NOT EXISTS "public"."campaign_daily_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."campaign_daily_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."campaign_daily_id_seq" OWNED BY "public"."campaign_daily"."id";



CREATE TABLE IF NOT EXISTS "public"."campaign_dim" (
    "account" "text" NOT NULL,
    "campaign" "text" NOT NULL,
    "location" "text",
    "objetivo" "text" DEFAULT 'generico'::"text" NOT NULL,
    "tipo_campana" "text",
    "patron" "text",
    "resuelto_el" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_dim" OWNER TO "postgres";


COMMENT ON TABLE "public"."campaign_dim" IS 'Cada campana resuelta a local, objetivo y tipo. Se recalcula despues de cada extraccion y cuando cambia campaign_mapa o locations. Las vistas hacen JOIN contra esto en vez de llamar resolver_campana por fila.';



CREATE TABLE IF NOT EXISTS "public"."campaign_fechas" (
    "account" "text" NOT NULL,
    "campaign" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "estado_google" "text",
    "estado_real" "text",
    "actualizado" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_fechas" OWNER TO "postgres";


COMMENT ON TABLE "public"."campaign_fechas" IS 'Fechas de inicio y fin por campana. estado_real: FINALIZADA si ENABLED con end_date pasada; PROGRAMADA si start_date futura. Google deja el estado en ENABLED aunque la campana ya no entregue: sin esto, una campana terminada parece rota.';



CREATE SEQUENCE IF NOT EXISTS "public"."campaign_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."campaign_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."campaign_id_seq" OWNED BY "public"."campaign"."id";



CREATE TABLE IF NOT EXISTS "public"."campaign_mapa" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "patron" "text" NOT NULL,
    "prioridad" integer DEFAULT 100,
    "location_codigo" "text",
    "objetivo" "text" DEFAULT 'generico'::"text" NOT NULL,
    "tipo_campana" "text",
    "activa" boolean DEFAULT true,
    "nota" "text",
    CONSTRAINT "campaign_mapa_tipo_campana_check" CHECK (("tipo_campana" = ANY (ARRAY['search'::"text", 'pmax'::"text", 'pmax_store'::"text", 'shopping'::"text", 'video'::"text", 'demand_gen'::"text", 'display'::"text", 'local'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."campaign_mapa" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."campaign_mapa_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."campaign_mapa_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."campaign_mapa_id_seq" OWNED BY "public"."campaign_mapa"."id";



CREATE TABLE IF NOT EXISTS "public"."candidatos_a_retiro" (
    "id" bigint NOT NULL,
    "objeto" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "estado" "text" DEFAULT 'observando'::"text" NOT NULL,
    "por_que_se_propone" "text" NOT NULL,
    "que_se_pierde" "text",
    "quien_lo_usa" "text",
    "lecturas_al_marcar" bigint,
    "observar_hasta" "date" NOT NULL,
    "evidencia" "jsonb" DEFAULT '{}'::"jsonb",
    "decidido_el" "date",
    "motivo_decision" "text",
    "como_volver" "text" NOT NULL,
    "marcado_el" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "candidatos_a_retiro_estado_check" CHECK (("estado" = ANY (ARRAY['observando'::"text", 'en_sombra'::"text", 'retirado'::"text", 'indultado'::"text"]))),
    CONSTRAINT "candidatos_a_retiro_tipo_check" CHECK (("tipo" = ANY (ARRAY['tabla'::"text", 'vista'::"text", 'funcion'::"text", 'extraccion'::"text", 'seccion_de_prompt'::"text"])))
);


ALTER TABLE "public"."candidatos_a_retiro" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidatos_a_retiro" IS 'Nada se saca de una. Se marca, se observa el tiempo de al menos tres corridas del consumidor mas lento, se pone en sombra, y recien despues se retira. Con la forma de volver escrita desde el dia uno.';



CREATE SEQUENCE IF NOT EXISTS "public"."candidatos_a_retiro_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."candidatos_a_retiro_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."candidatos_a_retiro_id_seq" OWNED BY "public"."candidatos_a_retiro"."id";



CREATE TABLE IF NOT EXISTS "public"."capacidades_ejecucion" (
    "verbo" "text" NOT NULL,
    "ejecutable" boolean NOT NULL,
    "metodo" "text",
    "reversible" "text",
    "riesgo" "text" NOT NULL,
    "requiere" "text",
    "por_que_no" "text",
    "verificado_el" "date" DEFAULT CURRENT_DATE,
    "plataforma" "public"."plataforma_pub" DEFAULT 'google'::"public"."plataforma_pub" NOT NULL,
    CONSTRAINT "capacidades_ejecucion_riesgo_check" CHECK (("riesgo" = ANY (ARRAY['bajo'::"text", 'medio'::"text", 'alto'::"text"])))
);


ALTER TABLE "public"."capacidades_ejecucion" OWNER TO "postgres";


COMMENT ON TABLE "public"."capacidades_ejecucion" IS 'Que verbos puede ejecutar un script de Google Ads. Verificado contra developers.google.com/google-ads/scripts. Los agentes lo consultan antes de escribir un accionable: si el verbo es ejecutable, el accionable DEBE llevar Accion JSON.';



CREATE TABLE IF NOT EXISTS "public"."change_events" (
    "id" bigint NOT NULL,
    "change_datetime" "text",
    "account" "text",
    "user_email" "text",
    "client_type" "text",
    "resource_type" "text",
    "operation" "text",
    "changed_field" "text",
    "old_value" "text",
    "new_value" "text",
    "campaign" "text",
    "ad_group" "text",
    "run_ts" "text",
    "resource_name" "text",
    "entity_name" "text",
    "campaign_name" "text",
    "ad_group_name" "text"
);


ALTER TABLE "public"."change_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."change_events" IS 'Historial de cambios con valor anterior y nuevo. Un client_type que contenga RECOMMENDATION indica cambio auto-aplicado por Google: siempre alerta ALTA.';



COMMENT ON COLUMN "public"."change_events"."entity_name" IS 'Nombre legible de la entidad modificada, resuelto por el script en el momento de la extraccion. Para keywords es el texto; para anuncios el titular principal; para grupos y campanas su nombre. Es lo que permite cruzar un cambio con el accionable que lo pedia.';



CREATE SEQUENCE IF NOT EXISTS "public"."change_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."change_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."change_events_id_seq" OWNED BY "public"."change_events"."id";



CREATE TABLE IF NOT EXISTS "public"."cierres_sin_atribucion" (
    "id" bigint NOT NULL,
    "client" "text" NOT NULL,
    "source" "text" DEFAULT 'asana'::"text" NOT NULL,
    "external_id" "text" NOT NULL,
    "nombre_tarea" "text",
    "monto" numeric,
    "motivo" "text",
    "event_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cierres_sin_atribucion" OWNER TO "postgres";


COMMENT ON TABLE "public"."cierres_sin_atribucion" IS 'Negocios cerrados que no se pueden atribuir por falta de identificador de clic. Se registran igual porque son ingresos reales: sin esto, el retorno del canal queda subestimado y nadie sabe por que. Contrastar el total contra los ingresos reportados por el cliente.';



CREATE SEQUENCE IF NOT EXISTS "public"."cierres_sin_atribucion_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cierres_sin_atribucion_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cierres_sin_atribucion_id_seq" OWNED BY "public"."cierres_sin_atribucion"."id";



CREATE TABLE IF NOT EXISTS "public"."cifras_publicadas" (
    "id" bigint NOT NULL,
    "brief_id" "text" NOT NULL,
    "cuenta" "text" NOT NULL,
    "etiqueta" "text" NOT NULL,
    "valor" numeric NOT NULL,
    "unidad" "text",
    "sql_origen" "text" NOT NULL,
    "objetos_usados" "text"[],
    "publicada_el" timestamp with time zone DEFAULT "now"() NOT NULL,
    "publicada_por" "text",
    "verificada_el" timestamp with time zone,
    "valor_recalculado" numeric,
    "veredicto" "text",
    "detalle" "text"
);


ALTER TABLE "public"."cifras_publicadas" OWNER TO "postgres";


COMMENT ON TABLE "public"."cifras_publicadas" IS 'Toda cifra que sale a un brief o a un cliente, con el SQL exacto que la produjo. verificar_cifras() la recalcula sin ver el texto del brief. veredicto no_reproducible NO es un error del verificador: es el hallazgo de que la consulta ya no devuelve lo mismo, casi siempre porque cambio una vista abajo.';



CREATE SEQUENCE IF NOT EXISTS "public"."cifras_publicadas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cifras_publicadas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cifras_publicadas_id_seq" OWNED BY "public"."cifras_publicadas"."id";



CREATE TABLE IF NOT EXISTS "public"."config_snapshot" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_name" "text" NOT NULL,
    "config" "jsonb" NOT NULL,
    "config_hash" "text" NOT NULL,
    "run_ts" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."config_snapshot" OWNER TO "postgres";


COMMENT ON TABLE "public"."config_snapshot" IS 'Foto diaria de la configuracion de cada entidad. La comparacion entre dias consecutivos detecta cambios que change_event no registra, en particular los de acciones de conversion. Es la fuente de verdad sobre QUE cambio; operator_log sigue siendo la fuente sobre POR QUE.';



CREATE SEQUENCE IF NOT EXISTS "public"."config_snapshot_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."config_snapshot_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."config_snapshot_id_seq" OWNED BY "public"."config_snapshot"."id";



CREATE TABLE IF NOT EXISTS "public"."conocimiento_externo" (
    "id" bigint NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "tema" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "resumen" "text" NOT NULL,
    "fuente" "text" NOT NULL,
    "fuente_tipo" "text" NOT NULL,
    "vigente_hasta" "date",
    "aplica_a" "text"[] DEFAULT '{}'::"text"[],
    "accion_derivada" "text",
    "registrado_por" "text" DEFAULT 'opus-5-semanal'::"text",
    "verificado" boolean DEFAULT false,
    CONSTRAINT "conocimiento_externo_fuente_tipo_check" CHECK (("fuente_tipo" = ANY (ARRAY['google_oficial'::"text", 'agencia_con_datos'::"text", 'paper'::"text", 'foro_con_staff'::"text", 'medio_especializado'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."conocimiento_externo" OWNER TO "postgres";


COMMENT ON TABLE "public"."conocimiento_externo" IS 'Lo que el sistema aprendio fuera de los datos de la cuenta: cambios de Google Ads, benchmarks, metodos, regulacion. Con fuente, fecha y a que cuentas aplica. El semanal busca cuando los datos no alcanzan; el mensual actualiza. Nunca cambia una regla de la cuenta por algo leido: lo propone con fuente.';



CREATE SEQUENCE IF NOT EXISTS "public"."conocimiento_externo_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."conocimiento_externo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."conocimiento_externo_id_seq" OWNED BY "public"."conocimiento_externo"."id";



CREATE TABLE IF NOT EXISTS "public"."contratos_columna" (
    "objeto" "text" NOT NULL,
    "columna" "text" NOT NULL,
    "promete" "text" NOT NULL,
    "ventana_dias" integer,
    "tipo_semantico" "text",
    "verificado_el" "date" DEFAULT CURRENT_DATE NOT NULL,
    "nota" "text"
);


ALTER TABLE "public"."contratos_columna" OWNER TO "postgres";


COMMENT ON TABLE "public"."contratos_columna" IS 'Que promete cada columna, declarado a mano. El detector compara la promesa contra la realidad medida. Una columna sin contrato no es sospechosa por si sola: es invisible, que es peor.';



CREATE TABLE IF NOT EXISTS "public"."controles_de_ticket" (
    "ticket_id" bigint NOT NULL,
    "relacion_id" bigint NOT NULL,
    "como_lo_atrapa" "text" NOT NULL,
    "atado_el" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."controles_de_ticket" OWNER TO "postgres";


COMMENT ON TABLE "public"."controles_de_ticket" IS 'Que relacion vigila que un ticket no vuelva. Sin esta fila, un ticket de bug no puede pasar a resuelto: es la diferencia entre arreglar y arreglar-y-que-quede-vigilado.';



CREATE TABLE IF NOT EXISTS "public"."conversion_actions" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "conversion_action" "text",
    "category" "text",
    "currency" "text",
    "conversions" numeric,
    "all_conversions" numeric,
    "conv_value" numeric,
    "all_conv_value" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."conversion_actions" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversion_actions" IS 'CAPA SEMANAL · conversiones por accion. La diaria equivalente es conversion_actions_daily.';



CREATE TABLE IF NOT EXISTS "public"."conversion_actions_daily" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "date" "date" NOT NULL,
    "campaign" "text" NOT NULL,
    "conversion_action" "text" NOT NULL,
    "category" "text" DEFAULT ''::"text" NOT NULL,
    "currency" "text",
    "conversions" numeric,
    "run_ts" timestamp with time zone DEFAULT "now"(),
    "ad_group" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."conversion_actions_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversion_actions_daily" IS 'Conversiones diarias desglosadas por accion. Solo primarias: all_conversions se omite deliberadamente porque en 360 infla 2,5 veces al sumar clics a WhatsApp, mail y llamadas.';



COMMENT ON COLUMN "public"."conversion_actions_daily"."ad_group" IS 'Grupo de anuncios. NULL en filas cargadas antes del 6 sep 2026 (script v2 extraia por campana). Desde v3, siempre presente.';



CREATE SEQUENCE IF NOT EXISTS "public"."conversion_actions_daily_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."conversion_actions_daily_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."conversion_actions_daily_id_seq" OWNED BY "public"."conversion_actions_daily"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."conversion_actions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."conversion_actions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."conversion_actions_id_seq" OWNED BY "public"."conversion_actions"."id";



CREATE TABLE IF NOT EXISTS "public"."corridas_verdad" (
    "id" bigint NOT NULL,
    "relacion_id" bigint NOT NULL,
    "cuenta" "text",
    "corrida_el" timestamp with time zone DEFAULT "now"() NOT NULL,
    "veredicto" "text" NOT NULL,
    "valor_izq" numeric,
    "valor_der" numeric,
    "diferencia_rel" numeric,
    "detalle" "text",
    CONSTRAINT "corridas_verdad_veredicto_check" CHECK (("veredicto" = ANY (ARRAY['cumple'::"text", 'viola'::"text", 'no_aplicaba'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."corridas_verdad" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."corridas_verdad_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."corridas_verdad_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."corridas_verdad_id_seq" OWNED BY "public"."corridas_verdad"."id";



CREATE TABLE IF NOT EXISTS "public"."cuarentena" (
    "id" bigint NOT NULL,
    "tabla" "text" NOT NULL,
    "registro_id" "text" NOT NULL,
    "cuenta" "text",
    "por_que" "text" NOT NULL,
    "reemplazado_por" "text",
    "puesto_el" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cuarentena" OWNER TO "postgres";


COMMENT ON TABLE "public"."cuarentena" IS 'Registros escritos sobre datos que despues resultaron falsos. Las funciones que alimentan a los agentes los saltean, para que un error corregido no se propague por la memoria. No se borran: quedan para auditoria.';



CREATE SEQUENCE IF NOT EXISTS "public"."cuarentena_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cuarentena_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cuarentena_id_seq" OWNED BY "public"."cuarentena"."id";



CREATE TABLE IF NOT EXISTS "public"."cuentas" (
    "account" "text" NOT NULL,
    "nombre_cliente" "text" NOT NULL,
    "cid" "text",
    "activa" boolean DEFAULT true NOT NULL,
    "moneda" "text" NOT NULL,
    "zona_horaria" "text" NOT NULL,
    "locale" "text" DEFAULT 'es-CL'::"text" NOT NULL,
    "idioma_reporte" "text" DEFAULT 'es'::"text" NOT NULL,
    "frecuencia_reporte" "text" DEFAULT 'semanal'::"text" NOT NULL,
    "canal_reporte" "text" DEFAULT 'email'::"text",
    "destinatarios_reporte" "text"[],
    "nombre_contacto" "text",
    "encabezado_reporte" "text",
    "metricas_destacadas" "text"[] DEFAULT '{cost,conversions,cpa,ctr}'::"text"[] NOT NULL,
    "presupuesto_diario" numeric,
    "pico_gasto_factor" numeric DEFAULT 1.5 NOT NULL,
    "sin_conv_min_gasto" numeric,
    "reglas_dominio" "text",
    "notion_ficha_id" "text",
    "hora_tarea_semanal" time without time zone,
    "creada" timestamp with time zone DEFAULT "now"(),
    "actualizada" timestamp with time zone DEFAULT "now"(),
    "nucleo" "text"[] DEFAULT '{}'::"text"[],
    "reporte_plantilla" "jsonb" DEFAULT '{}'::"jsonb",
    "perfil_analisis" "text" DEFAULT 'negocio_unico'::"text",
    "plataformas" "public"."plataforma_pub"[] DEFAULT ARRAY['google'::"public"."plataforma_pub"] NOT NULL,
    CONSTRAINT "cuentas_canal_reporte_check" CHECK (("canal_reporte" = ANY (ARRAY['email'::"text", 'slack'::"text", 'portal'::"text", 'manual'::"text"]))),
    CONSTRAINT "cuentas_frecuencia_reporte_check" CHECK (("frecuencia_reporte" = ANY (ARRAY['semanal'::"text", 'mensual'::"text", 'ninguna'::"text"]))),
    CONSTRAINT "cuentas_idioma_reporte_check" CHECK (("idioma_reporte" = ANY (ARRAY['es'::"text", 'en'::"text"]))),
    CONSTRAINT "cuentas_perfil_analisis_check" CHECK (("perfil_analisis" = ANY (ARRAY['negocio_unico'::"text", 'cadena'::"text"])))
);


ALTER TABLE "public"."cuentas" OWNER TO "postgres";


COMMENT ON TABLE "public"."cuentas" IS 'Unica fuente de verdad de los clientes. Los scripts de Google Ads la leen al arrancar (GET a /rest/v1/cuentas?activa=eq.true), el servidor la lee en vez de listas hardcodeadas, el prompt generico la lee junto al doc maestro. idioma_reporte: el brief interno es siempre en espanol; solo la seccion de reporte al cliente cambia de idioma.';



COMMENT ON COLUMN "public"."cuentas"."nucleo" IS 'Conceptos que definen la cuenta. Cualquier negativa o pausa que los toque (por raiz de palabra, sin importar plural ni articulos) se bloquea. Ejemplo BHI: seguro salud internacional.';



COMMENT ON COLUMN "public"."cuentas"."reporte_plantilla" IS '{secciones: [contexto, observaciones, cambios, atencion, proximos], kpis: [gasto, conversiones, cpa, ctr], tono: "...", firma: "..."}';



COMMENT ON COLUMN "public"."cuentas"."perfil_analisis" IS 'negocio_unico: el paquete semanal lista campanas y keywords. cadena: el paquete va por objetivo y por local, con detalle solo de los locales que importan. Sin esto, 81 campanas producen un paquete de 132 KB que ningun modelo lee bien.';



COMMENT ON COLUMN "public"."cuentas"."plataformas" IS 'Que plataformas opera esta cuenta. Fresh Monkee gasta el doble en Meta que en Google y hoy Meta esta fuera del sistema.';



CREATE TABLE IF NOT EXISTS "public"."device" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "device" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "cost" numeric,
    "conversions" numeric,
    "conv_value" numeric,
    "cost_per_conv" numeric,
    "conv_rate" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."device" OWNER TO "postgres";


COMMENT ON TABLE "public"."device" IS 'CAPA SEMANAL. Rendimiento por dispositivo.';



CREATE SEQUENCE IF NOT EXISTS "public"."device_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."device_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."device_id_seq" OWNED BY "public"."device"."id";



CREATE TABLE IF NOT EXISTS "public"."doc_maestro_consolidado" (
    "account" "text" NOT NULL,
    "aprendizajes" "text",
    "hipotesis_abiertas" "text",
    "pendientes" "text",
    "sincronizado_el" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_maestro_consolidado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_maestro_humano" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "seccion" "text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "contenido" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "vigente" boolean DEFAULT true NOT NULL,
    "editado_por" "text" DEFAULT 'andres'::"text",
    "editado_el" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."doc_maestro_humano" OWNER TO "postgres";


COMMENT ON TABLE "public"."doc_maestro_humano" IS 'Capa humana del doc maestro: lo que solo Andres sabe. Cada edicion crea una version nueva. Nunca se borra.';



CREATE SEQUENCE IF NOT EXISTS "public"."doc_maestro_humano_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."doc_maestro_humano_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."doc_maestro_humano_id_seq" OWNED BY "public"."doc_maestro_humano"."id";



CREATE TABLE IF NOT EXISTS "public"."drift_exento" (
    "patron" "text" NOT NULL,
    "por_que" "text" NOT NULL
);


ALTER TABLE "public"."drift_exento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_states" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "entity_name" "text" NOT NULL,
    "entity_type" "text",
    "cooldown_until" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."entity_states" OWNER TO "postgres";


COMMENT ON TABLE "public"."entity_states" IS 'Estado por entidad con cooldown, para evitar alertar dos veces sobre lo mismo. Sin usar todavia.';



CREATE SEQUENCE IF NOT EXISTS "public"."entity_states_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."entity_states_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."entity_states_id_seq" OWNED BY "public"."entity_states"."id";



CREATE TABLE IF NOT EXISTS "public"."escritores" (
    "entidad" "text" NOT NULL,
    "dueno" "text" NOT NULL,
    "proponen" "text"[] DEFAULT '{}'::"text"[],
    "leen" "text"[] DEFAULT '{}'::"text"[],
    "regla" "text"
);


ALTER TABLE "public"."escritores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."filtro_umbrales" (
    "clave" "text" NOT NULL,
    "valor" numeric NOT NULL,
    "descripcion" "text",
    "actualizado" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."filtro_umbrales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funnel_events" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "lead_name" "text",
    "stage_order" integer NOT NULL,
    "stage_name" "text" NOT NULL,
    "stage_value" numeric,
    "currency" "text",
    "click_id" "text",
    "click_id_type" "text",
    "reached_at" timestamp with time zone NOT NULL,
    "uploaded_to_google" boolean DEFAULT false,
    "uploaded_at" timestamp with time zone,
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "funnel_events_click_id_type_check" CHECK (("click_id_type" = ANY (ARRAY['gclid'::"text", 'gbraid'::"text", 'wbraid'::"text"])))
);


ALTER TABLE "public"."funnel_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."funnel_events" IS 'Una fila por lead y etapa alcanzada. Es la cola de subida a Google Ads: uploaded_to_google = false son los pendientes. La clave unica evita subir dos veces la misma etapa del mismo lead. El valor se congela al momento del evento: si despues cambia la escalera, los eventos viejos conservan el valor con el que se subieron.';



CREATE SEQUENCE IF NOT EXISTS "public"."funnel_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."funnel_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."funnel_events_id_seq" OWNED BY "public"."funnel_events"."id";



CREATE TABLE IF NOT EXISTS "public"."funnel_stages" (
    "id" integer NOT NULL,
    "account" "text" NOT NULL,
    "stage_order" integer NOT NULL,
    "stage_name" "text" NOT NULL,
    "source" "text" NOT NULL,
    "external_id" "text",
    "google_conversion_action" "text",
    "google_status" "text" DEFAULT 'no_existe'::"text",
    "win_rate_to_close" numeric,
    "avg_ticket" numeric,
    "stage_value" numeric GENERATED ALWAYS AS ("round"((COALESCE("win_rate_to_close", (0)::numeric) * COALESCE("avg_ticket", (0)::numeric)), 0)) STORED,
    "currency" "text",
    "eventos_ultimos_30d" integer,
    "listo_para_primaria" boolean GENERATED ALWAYS AS ((COALESCE("eventos_ultimos_30d", 0) >= 15)) STORED,
    "win_rate_origen" "text",
    "notas" "text",
    "actualizado" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "funnel_stages_google_status_check" CHECK (("google_status" = ANY (ARRAY['no_existe'::"text", 'secundaria'::"text", 'primaria'::"text"])))
);


ALTER TABLE "public"."funnel_stages" OWNER TO "postgres";


COMMENT ON TABLE "public"."funnel_stages" IS 'Escalera de valor por etapa. stage_value = win_rate_to_close x avg_ticket: es lo que vale un lead que llega a esa etapa, en esperanza. Se envia a Google como conversion offline con ese valor. listo_para_primaria dice si la etapa tiene volumen suficiente (15+/mes) para alimentar Smart Bidding sin desestabilizarlo. Actualizar win rates cada 6 meses o cuando cambie el ticket.';



CREATE SEQUENCE IF NOT EXISTS "public"."funnel_stages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."funnel_stages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."funnel_stages_id_seq" OWNED BY "public"."funnel_stages"."id";



CREATE TABLE IF NOT EXISTS "public"."geo" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "location" "text",
    "location_type" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "cost" numeric,
    "conversions" numeric,
    "conv_value" numeric,
    "cost_per_conv" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."geo" OWNER TO "postgres";


COMMENT ON TABLE "public"."geo" IS 'CAPA SEMANAL. Rendimiento por ubicacion, solo filas con clics.';



CREATE SEQUENCE IF NOT EXISTS "public"."geo_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."geo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."geo_id_seq" OWNED BY "public"."geo"."id";



CREATE TABLE IF NOT EXISTS "public"."google_live_events" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_name" "text",
    "client_type" "text",
    "user_email" "text",
    "spend_today" numeric,
    "conversions_today" numeric,
    "event_date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."google_live_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."google_live_events" IS 'PULSO INTRADIA. Snapshot horario del gasto y las conversiones del dia EN CURSO, mas los cambios detectados. Es una serie de instantaneas acumulativas, no un agregado: dos filas del mismo dia contienen el mismo gasto medido en momentos distintos. NUNCA sumar spend_today; tomar el ultimo valor del dia. Para el gasto diario cerrado usar v_serie_diaria.';



CREATE SEQUENCE IF NOT EXISTS "public"."google_live_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."google_live_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."google_live_events_id_seq" OWNED BY "public"."google_live_events"."id";



CREATE TABLE IF NOT EXISTS "public"."grupos_reporte" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" DEFAULT 'consolidado'::"text" NOT NULL,
    "destinatarios" "text",
    "nota" "text",
    CONSTRAINT "grupos_reporte_tipo_check" CHECK (("tipo" = ANY (ARRAY['consolidado'::"text", 'individual'::"text"])))
);


ALTER TABLE "public"."grupos_reporte" OWNER TO "postgres";


COMMENT ON TABLE "public"."grupos_reporte" IS 'Agrupacion para el reporte. Un local con grupo_reporte no recibe reporte individual: entra en el consolidado del grupo. Los que no tienen grupo reportan solos.';



CREATE SEQUENCE IF NOT EXISTS "public"."grupos_reporte_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."grupos_reporte_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."grupos_reporte_id_seq" OWNED BY "public"."grupos_reporte"."id";



CREATE TABLE IF NOT EXISTS "public"."hour_day" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "day_of_week" "text",
    "hour" numeric,
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "cost" numeric,
    "conversions" numeric,
    "conv_value" numeric,
    "cost_per_conv" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."hour_day" OWNER TO "postgres";


COMMENT ON TABLE "public"."hour_day" IS 'CAPA SEMANAL. Rendimiento por dia de la semana y hora. Con la capa diaria disponible, v_serie_diaria da mejor lectura de patron semanal.';



CREATE SEQUENCE IF NOT EXISTS "public"."hour_day_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."hour_day_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."hour_day_id_seq" OWNED BY "public"."hour_day"."id";



CREATE TABLE IF NOT EXISTS "public"."incidentes_atendidos" (
    "clave" "text" NOT NULL,
    "atendido_el" timestamp with time zone DEFAULT "now"() NOT NULL,
    "que_se_hizo" "text" NOT NULL,
    "atendido_por" "text"
);


ALTER TABLE "public"."incidentes_atendidos" OWNER TO "postgres";


COMMENT ON TABLE "public"."incidentes_atendidos" IS 'Que se hizo con cada incidente. Existe para poder medir la tasa de accion: si menos de la mitad de lo que el tablero muestra termina en algo, el tablero es ruido prolijo y hay que podarlo, no mirarlo mas fuerte.';



CREATE TABLE IF NOT EXISTS "public"."intentos" (
    "id" bigint NOT NULL,
    "cuando" timestamp with time zone DEFAULT "now"() NOT NULL,
    "clave" "text" NOT NULL,
    "ruta" "text" NOT NULL,
    "exito" boolean DEFAULT false NOT NULL,
    "detalle" "text"
);


ALTER TABLE "public"."intentos" OWNER TO "postgres";


COMMENT ON TABLE "public"."intentos" IS 'Intentos contra rutas sensibles, para limite de tasa y bloqueo por fuerza bruta. Se limpia sola: las filas de mas de 24 horas se borran en el mantenimiento.';



CREATE SEQUENCE IF NOT EXISTS "public"."intentos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."intentos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."intentos_id_seq" OWNED BY "public"."intentos"."id";



CREATE TABLE IF NOT EXISTS "public"."keywords" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "campaign_status" "text",
    "ad_group" "text",
    "ad_group_status" "text",
    "criterion_id" numeric,
    "keyword" "text",
    "match_type" "text",
    "keyword_status" "text",
    "serving_status" "text",
    "approval_status" "text",
    "final_url" "text",
    "currency" "text",
    "effective_cpc_bid" numeric,
    "bid_source" "text",
    "est_first_page_cpc" numeric,
    "est_top_of_page_cpc" numeric,
    "est_first_position_cpc" numeric,
    "quality_score" numeric,
    "qs_ad_relevance" "text",
    "qs_landing_page" "text",
    "qs_expected_ctr" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "cost" numeric,
    "conversions" numeric,
    "all_conversions" numeric,
    "conv_value" numeric,
    "cost_per_conv" numeric,
    "conv_rate" numeric,
    "impr_share" numeric,
    "top_impr_share" numeric,
    "lost_is_rank" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."keywords" OWNER TO "postgres";


COMMENT ON TABLE "public"."keywords" IS 'CAPA SEMANAL · inventario COMPLETO de keywords, incluidas las que no tuvieron impresiones. Esa es su diferencia con keywords_daily, que solo trae las que tuvieron actividad. Para saber que keywords EXISTEN, usar esta. Para saber que dia se movio una, usar la diaria.';



COMMENT ON COLUMN "public"."keywords"."serving_status" IS 'Estado de entrega segun Google. RARELY_SERVED significa volumen de busqueda insuficiente: la keyword no va a servir aunque este habilitada.';



COMMENT ON COLUMN "public"."keywords"."effective_cpc_bid" IS 'Puja heredada. Con Smart Bidding NO gobierna la entrega. Lo accionable son las columnas est_* de estimacion de posicion.';



COMMENT ON COLUMN "public"."keywords"."est_top_of_page_cpc" IS 'CPC estimado para aparecer en el tope de pagina. Este si es accionable: dice cuanto haria falta para competir.';



CREATE TABLE IF NOT EXISTS "public"."keywords_daily" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "date" "date" NOT NULL,
    "campaign" "text" NOT NULL,
    "ad_group" "text" NOT NULL,
    "keyword" "text" NOT NULL,
    "match_type" "text" NOT NULL,
    "keyword_status" "text" DEFAULT ''::"text" NOT NULL,
    "serving_status" "text",
    "currency" "text",
    "quality_score" numeric,
    "qs_ad_relevance" "text",
    "qs_landing_page" "text",
    "qs_expected_ctr" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "cost" numeric,
    "conversions" numeric,
    "cost_per_conv" numeric,
    "conv_rate" numeric,
    "impr_share" numeric,
    "top_impr_share" numeric,
    "lost_is_rank" numeric,
    "run_ts" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."keywords_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."keywords_daily" IS 'Keywords con actividad diaria. Solo filas con impresiones > 0: la ausencia de una keyword en una fecha significa cero actividad ese dia, no dato faltante. Permite ver el dia exacto en que una keyword empezo a gastar sin convertir, en lugar de enterarse al cierre de la semana.';



CREATE SEQUENCE IF NOT EXISTS "public"."keywords_daily_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."keywords_daily_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."keywords_daily_id_seq" OWNED BY "public"."keywords_daily"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."keywords_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."keywords_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."keywords_id_seq" OWNED BY "public"."keywords"."id";



CREATE TABLE IF NOT EXISTS "public"."landing_pages" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "landing_page" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "cost" numeric,
    "conversions" numeric,
    "conv_value" numeric,
    "cost_per_conv" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."landing_pages" OWNER TO "postgres";


COMMENT ON TABLE "public"."landing_pages" IS 'CAPA SEMANAL. Rendimiento por URL de destino.';



CREATE SEQUENCE IF NOT EXISTS "public"."landing_pages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."landing_pages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."landing_pages_id_seq" OWNED BY "public"."landing_pages"."id";



CREATE TABLE IF NOT EXISTS "public"."latidos" (
    "tarea" "text" NOT NULL,
    "ultimo_ok" timestamp with time zone,
    "ultimo_intento" timestamp with time zone,
    "ultimo_error" "text",
    "corridas_ok" integer DEFAULT 0,
    "corridas_falla" integer DEFAULT 0,
    "tolerancia" interval DEFAULT '25:00:00'::interval NOT NULL,
    "en_vigilancia" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."latidos" OWNER TO "postgres";


COMMENT ON TABLE "public"."latidos" IS 'Ultima corrida exitosa de cada tarea. Un observador externo lee esto y avisa por la AUSENCIA de latido, que es como se detecta que pg_cron dejo de disparar: el historial no registra lo que nunca corrio.';



COMMENT ON COLUMN "public"."latidos"."en_vigilancia" IS 'Falso mientras el script que la reporta todavia no esta desplegado. Una tarea que nunca latio de verdad no es una tarea caida.';



CREATE TABLE IF NOT EXISTS "public"."lecciones" (
    "id" bigint NOT NULL,
    "account" "text",
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "contexto" "text" NOT NULL,
    "decision" "text" NOT NULL,
    "resultado" "text" NOT NULL,
    "leccion" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "confianza" numeric DEFAULT 0.5 NOT NULL,
    "veces_confirmada" integer DEFAULT 1,
    "origen_id" "text",
    "escrita_por" "text" DEFAULT 'opus-5-semanal'::"text",
    CONSTRAINT "lecciones_confianza_check" CHECK ((("confianza" >= (0)::numeric) AND ("confianza" <= (1)::numeric))),
    CONSTRAINT "lecciones_tipo_check" CHECK (("tipo" = ANY (ARRAY['acierto'::"text", 'error'::"text", 'omision'::"text", 'neutro'::"text"])))
);


ALTER TABLE "public"."lecciones" OWNER TO "postgres";


COMMENT ON TABLE "public"."lecciones" IS 'Aprendizaje retroactivo estructurado: en que contexto, que se decidio, que paso, que regla queda. tipo=error es lo mas valioso. veces_confirmada sube cuando otra corrida ve lo mismo. El pulso y el semanal leen las de confianza alta en la foto unica.';



CREATE SEQUENCE IF NOT EXISTS "public"."lecciones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lecciones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lecciones_id_seq" OWNED BY "public"."lecciones"."id";



CREATE TABLE IF NOT EXISTS "public"."legacy_actionables_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notion_id" "text",
    "client" "text",
    "title" "text",
    "justificacion" "text",
    "resolucion" "text",
    "embedding" "extensions"."vector"(768)
);


ALTER TABLE "public"."legacy_actionables_memory" OWNER TO "postgres";


COMMENT ON TABLE "public"."legacy_actionables_memory" IS 'LEGACY. Fase anterior con embeddings; nunca se poblo. No es falla que este vacia. La memoria de accionables vive en accionables_espejo (sincronizado desde Notion).';



CREATE TABLE IF NOT EXISTS "public"."limites_plataforma" (
    "plataforma" "public"."plataforma_pub" NOT NULL,
    "regla" "text" NOT NULL,
    "valor" integer,
    "ventana" interval,
    "que_pasa_si_se_viola" "text" NOT NULL,
    "fuente" "text"
);


ALTER TABLE "public"."limites_plataforma" OWNER TO "postgres";


COMMENT ON TABLE "public"."limites_plataforma" IS 'Limites de comportamiento por plataforma. No son limites tecnicos de la API: son los comportamientos que hacen que la plataforma deshabilite la cuenta. Verificado para Meta en septiembre de 2026.';



CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "ciudad" "text",
    "region" "text",
    "pais" "text" DEFAULT 'US'::"text",
    "zona_horaria" "text",
    "activa" boolean DEFAULT true,
    "presupuesto_mensual" numeric,
    "cpa_objetivo_visitas" numeric,
    "cpa_objetivo_online" numeric,
    "abrio" "date",
    "notas" "text",
    "grupo_reporte" "text",
    "paga_publicidad" "text",
    "reporta_individual" boolean DEFAULT true,
    "grupo_par" "text"
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."locations"."grupo_reporte" IS 'Codigo de grupos_reporte. Si esta, el local NO recibe reporte individual.';



COMMENT ON COLUMN "public"."locations"."grupo_par" IS 'Grupo de comparacion. El error central de la analitica multi-tienda es comparar contra la base equivocada: un local que abrio hace un mes no se compara con el que abrio en 2014. Derivado de abrio; editable a mano.';



CREATE SEQUENCE IF NOT EXISTS "public"."locations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."locations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."locations_id_seq" OWNED BY "public"."locations"."id";



CREATE TABLE IF NOT EXISTS "public"."memoria" (
    "id" bigint NOT NULL,
    "account" "text",
    "tipo" "text" NOT NULL,
    "fecha" "date" NOT NULL,
    "texto" "text" NOT NULL,
    "origen_id" "text",
    "embedding" "extensions"."vector"(768),
    "creado" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "memoria_tipo_check" CHECK (("tipo" = ANY (ARRAY['reflexion'::"text", 'hallazgo'::"text", 'accionable'::"text", 'handoff'::"text", 'leccion'::"text"])))
);


ALTER TABLE "public"."memoria" OWNER TO "postgres";


COMMENT ON TABLE "public"."memoria" IS 'Memoria semantica: reflexiones, hallazgos de pulsos, accionables, handoffs y lecciones con embedding (Gemini text-embedding, 768). parecido_a() busca por similitud. Es lo que convierte "conecta_con" en retrieval real.';



CREATE SEQUENCE IF NOT EXISTS "public"."memoria_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."memoria_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."memoria_id_seq" OWNED BY "public"."memoria"."id";



CREATE TABLE IF NOT EXISTS "public"."memoria_revisada" (
    "memoria_id" bigint NOT NULL,
    "revisado_el" "date" DEFAULT CURRENT_DATE,
    "veredicto" "text" NOT NULL
);


ALTER TABLE "public"."memoria_revisada" OWNER TO "postgres";


COMMENT ON TABLE "public"."memoria_revisada" IS 'Recuerdos que v_memoria_sospechosa marco y que al revisarlos resultaron vigentes. Evita que vuelvan a aparecer como pendientes en cada corrida.';



CREATE TABLE IF NOT EXISTS "public"."metricas" (
    "nombre" "text" NOT NULL,
    "que_mide" "text" NOT NULL,
    "funcion" "text" NOT NULL,
    "ventana" "text" NOT NULL,
    "fuente" "text" NOT NULL,
    "unidad" "text" NOT NULL,
    "cuidado" "text",
    "revisada_el" "date" DEFAULT CURRENT_DATE NOT NULL,
    "vigente" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."metricas" OWNER TO "postgres";


COMMENT ON TABLE "public"."metricas" IS 'Definicion unica de cada metrica. revisada_el existe porque una definicion sin revisar tambien envejece: es frescura semantica, no estructural. Si una vista calcula una de estas inline en vez de llamar a la funcion, aparece en v_metricas_reescritas.';



CREATE TABLE IF NOT EXISTS "public"."negatives" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "account" "text",
    "level" "text",
    "campaign" "text",
    "ad_group" "text",
    "negative_keyword" "text",
    "match_type" "text",
    "run_ts" "text"
);


ALTER TABLE "public"."negatives" OWNER TO "postgres";


COMMENT ON TABLE "public"."negatives" IS 'Inventario de negativas. Snapshot semanal: comparar semanas detecta negativas que desaparecieron.';



CREATE SEQUENCE IF NOT EXISTS "public"."negatives_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."negatives_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."negatives_id_seq" OWNED BY "public"."negatives"."id";



CREATE TABLE IF NOT EXISTS "public"."notas_de_objetos" (
    "objeto" "text" NOT NULL,
    "usar_para" "text",
    "cuidado" "text",
    "capa" "text" DEFAULT 'ANALISIS'::"text"
);


ALTER TABLE "public"."notas_de_objetos" OWNER TO "postgres";


COMMENT ON TABLE "public"."notas_de_objetos" IS 'Anotaciones sobre para que sirve cada vista o funcion y que cuidado tener. El diccionario las cruza con el esquema real: si un objeto existe y no tiene nota, aparece igual marcado como sin documentar. Asi el catalogo nunca queda mas viejo que la base.';



CREATE TABLE IF NOT EXISTS "public"."notas_para_agentes" (
    "id" bigint NOT NULL,
    "creada" timestamp with time zone DEFAULT "now"(),
    "account" "text",
    "para" "text" DEFAULT 'semanal'::"text" NOT NULL,
    "de" "text" DEFAULT 'asistente'::"text" NOT NULL,
    "tipo" "text" DEFAULT 'pregunta'::"text" NOT NULL,
    "contenido" "text" NOT NULL,
    "atendida_el" timestamp with time zone,
    "atendida_por" "text",
    "respuesta" "text",
    CONSTRAINT "notas_para_agentes_para_check" CHECK (("para" = ANY (ARRAY['semanal'::"text", 'pulso'::"text", 'mensual'::"text", 'cualquiera'::"text"]))),
    CONSTRAINT "notas_para_agentes_tipo_check" CHECK (("tipo" = ANY (ARRAY['pregunta'::"text", 'instruccion'::"text", 'contexto'::"text", 'correccion'::"text"])))
);


ALTER TABLE "public"."notas_para_agentes" OWNER TO "postgres";


COMMENT ON TABLE "public"."notas_para_agentes" IS 'Lo que Andres le pregunto o indico al asistente y que un agente tiene que saber en su proxima corrida. Sin esto una conversacion con el asistente muere ahi y el agente del lunes vuelve a analizar lo de siempre.';



CREATE SEQUENCE IF NOT EXISTS "public"."notas_para_agentes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notas_para_agentes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notas_para_agentes_id_seq" OWNED BY "public"."notas_para_agentes"."id";



CREATE TABLE IF NOT EXISTS "public"."notion_espejo_cuentas" (
    "account" "text" NOT NULL,
    "cliente" "text",
    "customer_id" "text",
    "estado" "text",
    "automatizado" "text",
    "moneda" "text",
    "presupuesto_diario" numeric,
    "canales" "text"[],
    "facturacion" "text",
    "doc_maestro" "text",
    "sheet" "text",
    "sincronizado" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notion_espejo_cuentas" OWNER TO "postgres";


COMMENT ON TABLE "public"."notion_espejo_cuentas" IS 'Copia de las fichas de cliente de Notion. Existe para contrastar contra la tabla cuentas: hasta hoy Karedo tenia Meta Ads en Notion y solo google en Supabase, y nadie lo veia.';



CREATE TABLE IF NOT EXISTS "public"."novedades" (
    "id" bigint NOT NULL,
    "tipo" "text" NOT NULL,
    "account" "text",
    "ref_tipo" "text" NOT NULL,
    "ref_id" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "texto" "text",
    "autor" "text",
    "creada" timestamp with time zone DEFAULT "now"(),
    "leida_el" timestamp with time zone,
    "clave" "text",
    "actor" "text",
    "verbo" "text",
    "objeto_titulo" "text",
    CONSTRAINT "novedades_ref_tipo_check" CHECK (("ref_tipo" = ANY (ARRAY['accionable'::"text", 'propuesta'::"text", 'ticket'::"text", 'ejecucion'::"text", 'alerta'::"text"]))),
    CONSTRAINT "novedades_tipo_check" CHECK (("tipo" = ANY (ARRAY['comentario'::"text", 'editado'::"text", 'propuesta'::"text", 'ticket'::"text", 'ejecucion'::"text", 'alerta'::"text"])))
);


ALTER TABLE "public"."novedades" OWNER TO "postgres";


COMMENT ON TABLE "public"."novedades" IS 'Lo que los agentes hicieron y Andres no vio: comentaron un accionable, lo editaron, propusieron algo, respondieron un ticket, ejecutaron algo. Se marca leida al abrir el objeto.';



CREATE SEQUENCE IF NOT EXISTS "public"."novedades_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."novedades_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."novedades_id_seq" OWNED BY "public"."novedades"."id";



CREATE TABLE IF NOT EXISTS "public"."objetivos_conversion" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "objetivo" "text" NOT NULL,
    "nombre_humano" "text" NOT NULL,
    "conversion_actions" "text"[] NOT NULL,
    "metrica_principal" "text" DEFAULT 'cpa'::"text" NOT NULL,
    "objetivo_valor" numeric,
    CONSTRAINT "objetivos_conversion_metrica_principal_check" CHECK (("metrica_principal" = ANY (ARRAY['cpa'::"text", 'roas'::"text", 'conversiones'::"text"]))),
    CONSTRAINT "objetivos_conversion_objetivo_check" CHECK (("objetivo" = ANY (ARRAY['visitas'::"text", 'compra_online'::"text", 'llamadas'::"text", 'marca'::"text", 'leads'::"text", 'apertura'::"text", 'generico'::"text"])))
);


ALTER TABLE "public"."objetivos_conversion" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."objetivos_conversion_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."objetivos_conversion_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."objetivos_conversion_id_seq" OWNED BY "public"."objetivos_conversion"."id";



CREATE TABLE IF NOT EXISTS "public"."operator_log" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "hora" time without time zone DEFAULT LOCALTIME,
    "que_cambio" "text" NOT NULL,
    "donde" "text",
    "valor_anterior" "text",
    "valor_nuevo" "text",
    "por_que" "text",
    "accionable_notion_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "plataforma" "public"."plataforma_pub" DEFAULT 'google'::"public"."plataforma_pub" NOT NULL
);


ALTER TABLE "public"."operator_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."operator_log" IS 'Cambios que Andres hace a mano en las cuentas y que change_events NO captura, porque ese log es de alcance campana y no ve configuracion de nivel cuenta: acciones de conversion, objetivos, recuento, ventanas de atribucion, importaciones. Es el sensor humano del sistema. TODA tarea de analisis lo lee ANTES de concluir que algo esta roto o que existe una fuente desconocida. "No hay registro de cambio" nunca significa "no hubo cambio": significa "no lo puedo confirmar por change_events".';



COMMENT ON COLUMN "public"."operator_log"."donde" IS 'Ambito del cambio. Los de nivel cuenta (conversiones, objetivos, recuento, atribucion) son justamente los que change_events no ve.';



CREATE SEQUENCE IF NOT EXISTS "public"."operator_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."operator_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."operator_log_id_seq" OWNED BY "public"."operator_log"."id";



CREATE TABLE IF NOT EXISTS "public"."patrones_drift" (
    "patron" "text" NOT NULL,
    "metrica" "text" NOT NULL,
    "por_que" "text" NOT NULL,
    "exentos" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."patrones_drift" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_mutations" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "campaign_name" "text",
    "adgroup_name" "text",
    "keyword_text" "text",
    "match_type" "text",
    "new_value" numeric,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "approved_by" "text",
    "approved_at" timestamp with time zone,
    "applied_at" timestamp with time zone,
    "error_message" "text",
    "notion_page_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pending_mutations_action_type_check" CHECK (("action_type" = ANY (ARRAY['PAUSE_KEYWORD'::"text", 'ADD_NEGATIVE'::"text", 'UPDATE_TARGET_CPA'::"text", 'UPDATE_BUDGET'::"text", 'UNDO_CHANGE'::"text"]))),
    CONSTRAINT "pending_mutations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'APPLIED'::"text", 'FAILED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."pending_mutations" OWNER TO "postgres";


COMMENT ON TABLE "public"."pending_mutations" IS 'Cola de cambios a aplicar en Google Ads. Solo se ejecutan las filas con status APPROVED y approved_by no nulo. Nunca las PENDING.';



CREATE SEQUENCE IF NOT EXISTS "public"."pending_mutations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pending_mutations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pending_mutations_id_seq" OWNED BY "public"."pending_mutations"."id";



CREATE TABLE IF NOT EXISTS "public"."plan_semanal" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "semana" "date" NOT NULL,
    "escrito_el" timestamp with time zone DEFAULT "now"(),
    "escrito_por" "text" DEFAULT 'opus-5-semanal'::"text",
    "indicadores" "jsonb" NOT NULL,
    "hipotesis" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "condiciones_escalamiento" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "contexto" "text",
    CONSTRAINT "plan_bien_formado" CHECK ("public"."plan_valido"("indicadores", "hipotesis"))
);


ALTER TABLE "public"."plan_semanal" OWNER TO "postgres";


COMMENT ON TABLE "public"."plan_semanal" IS 'Plan que Opus 5 escribe el lunes para que Sonnet 5 vigile durante la semana. indicadores: [{nombre, umbral, direccion, habilita}]. hipotesis: [{id, texto, evidencia_que_la_mueve}]. plan_valido() rechaza un plan mal formado antes de que el diario lo lea.';



CREATE SEQUENCE IF NOT EXISTS "public"."plan_semanal_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."plan_semanal_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."plan_semanal_id_seq" OWNED BY "public"."plan_semanal"."id";



CREATE TABLE IF NOT EXISTS "public"."planes_tecnicos" (
    "id" bigint NOT NULL,
    "clave" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "account" "text",
    "estado" "text" DEFAULT 'propuesto'::"text" NOT NULL,
    "contenido" "text" NOT NULL,
    "decision_pendiente" "text",
    "fecha" "date" DEFAULT CURRENT_DATE,
    "actualizado" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "planes_tecnicos_estado_check" CHECK (("estado" = ANY (ARRAY['propuesto'::"text", 'en_curso'::"text", 'hecho'::"text", 'descartado'::"text"])))
);


ALTER TABLE "public"."planes_tecnicos" OWNER TO "postgres";


COMMENT ON TABLE "public"."planes_tecnicos" IS 'Planes de arquitectura vigentes. Un plan que vive solo en un archivo se pierde; aca lo lee el sistema y cualquier sesion futura. estado dice si se ejecuto.';



CREATE SEQUENCE IF NOT EXISTS "public"."planes_tecnicos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."planes_tecnicos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."planes_tecnicos_id_seq" OWNED BY "public"."planes_tecnicos"."id";



CREATE TABLE IF NOT EXISTS "public"."politicas_auto" (
    "tipo" "text" NOT NULL,
    "activa" boolean DEFAULT false NOT NULL,
    "modo" "text" DEFAULT 'simular'::"text" NOT NULL,
    "confianza_min" numeric DEFAULT 0.8 NOT NULL,
    "gasto_max" numeric,
    "solo_origen" "text"[] DEFAULT '{Semanal}'::"text"[],
    "cuentas" "text"[] DEFAULT '{KAREDO,BHI,360}'::"text"[],
    "nota" "text",
    "actualizada" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "politicas_auto_modo_check" CHECK (("modo" = ANY (ARRAY['simular'::"text", 'ejecutar'::"text"]))),
    CONSTRAINT "politicas_auto_tipo_check" CHECK (("tipo" = ANY (ARRAY['negativa_grupo'::"text", 'negativa_campana'::"text", 'pausar_keyword'::"text", 'pausar_anuncio'::"text", 'cambiar_concordancia'::"text"])))
);


ALTER TABLE "public"."politicas_auto" OWNER TO "postgres";


COMMENT ON TABLE "public"."politicas_auto" IS 'Reglas para que el sistema ejecute sin preguntar. Solo negativas y pausas. Cada tipo tiene un interruptor, un modo (simular primero), confianza minima, tope de gasto de la entidad, origenes habilitados y cuentas. El interruptor general esta en ajustes_sistema.auto_ejecucion.';



CREATE TABLE IF NOT EXISTS "public"."predicciones" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "semana" "date" NOT NULL,
    "metrica" "text" NOT NULL,
    "valor_min" numeric NOT NULL,
    "valor_max" numeric NOT NULL,
    "probabilidad" numeric NOT NULL,
    "razonamiento" "text",
    "escrita_el" timestamp with time zone DEFAULT "now"(),
    "escrita_por" "text" DEFAULT 'opus-5-semanal'::"text",
    "valor_real" numeric,
    "acerto" boolean,
    "evaluada_el" timestamp with time zone,
    CONSTRAINT "predicciones_metrica_check" CHECK (("metrica" = ANY (ARRAY['conversiones'::"text", 'cpa'::"text", 'gasto'::"text", 'conv_rate'::"text", 'roas'::"text", 'ctr'::"text", 'impresiones'::"text", 'clics'::"text", 'valor'::"text"]))),
    CONSTRAINT "predicciones_probabilidad_check" CHECK ((("probabilidad" >= 0.5) AND ("probabilidad" <= 0.99)))
);


ALTER TABLE "public"."predicciones" OWNER TO "postgres";


COMMENT ON TABLE "public"."predicciones" IS 'El semanal predice la semana que empieza con rango y probabilidad. evaluar_predicciones() las compara el lunes siguiente. v_calibracion muestra si el 80% de confianza acierta el 80% de las veces.';



CREATE SEQUENCE IF NOT EXISTS "public"."predicciones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."predicciones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."predicciones_id_seq" OWNED BY "public"."predicciones"."id";



CREATE TABLE IF NOT EXISTS "public"."propuestas_estrategicas" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "hipotesis" "text" NOT NULL,
    "resultado_esperado" "text" NOT NULL,
    "costo_estimado" "text",
    "riesgo" "text",
    "como_probar_barato" "text",
    "que_la_mata" "text" NOT NULL,
    "fundamento_datos" "text",
    "fundamento_externo" "text",
    "estado" "text" DEFAULT 'propuesta'::"text" NOT NULL,
    "decision_andres" "text",
    "decidida_el" "date",
    "resultado_real" "text",
    "evaluada_el" "date",
    "escrita_por" "text" DEFAULT 'opus-5-semanal'::"text",
    "ejecucion_real" "text",
    "test_inicio" "date",
    "historial" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "propuestas_estrategicas_estado_check" CHECK (("estado" = ANY (ARRAY['propuesta'::"text", 'aprobada'::"text", 'en_test'::"text", 'adoptada'::"text", 'descartada'::"text", 'pausada'::"text"]))),
    CONSTRAINT "propuestas_estrategicas_tipo_check" CHECK (("tipo" = ANY (ARRAY['campana_nueva'::"text", 'cambio_tipo_campana'::"text", 'nuevo_embudo'::"text", 'test_estructurado'::"text", 'cambio_puja_estructural'::"text", 'nuevo_canal'::"text", 'landing'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."propuestas_estrategicas" OWNER TO "postgres";


COMMENT ON TABLE "public"."propuestas_estrategicas" IS 'Las apuestas grandes que el semanal propone con ambicion y logica: campana nueva, cambio de tipo, embudo, test. Cada una con hipotesis falsable, numero esperado, costo, riesgo, test minimo y que la mata. Andres aprueba; es una decision mayor que un accionable. Una por cuenta por semana como maximo; el mensual las revisa todas.';



CREATE SEQUENCE IF NOT EXISTS "public"."propuestas_estrategicas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."propuestas_estrategicas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."propuestas_estrategicas_id_seq" OWNED BY "public"."propuestas_estrategicas"."id";



CREATE TABLE IF NOT EXISTS "public"."pulso_diario" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "fecha" "date" NOT NULL,
    "nivel" "text" NOT NULL,
    "resumen" "text" NOT NULL,
    "hallazgo_principal" "text",
    "conecta_con" "text",
    "tokens_in" integer,
    "tokens_out" integer,
    "costo_usd" numeric(8,5),
    "modelo" "text" DEFAULT 'claude-sonnet-5'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "plan_id" bigint,
    "evidencia" "jsonb",
    "hallazgos" "jsonb",
    "hipotesis_movidas" "jsonb",
    "foto_leida" timestamp with time zone,
    CONSTRAINT "pulso_diario_nivel_check" CHECK (("nivel" = ANY (ARRAY['normal'::"text", 'atencion'::"text", 'critico'::"text"])))
);


ALTER TABLE "public"."pulso_diario" OWNER TO "postgres";


COMMENT ON TABLE "public"."pulso_diario" IS 'Interpretacion diaria de Gemini por cuenta: que paso ayer y si puede esperar al lunes. nivel critico escala a Notion y mail; normal y atencion solo se muestran en la app. El semanal lee los 7 del periodo. Costo registrado por fila.';



COMMENT ON COLUMN "public"."pulso_diario"."foto_leida" IS 'Cuando se tomo la foto de get_estado_cuenta que este pulso leyo. Si otro agente escribio despues de esa hora, el pulso no lo vio.';



CREATE SEQUENCE IF NOT EXISTS "public"."pulso_diario_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pulso_diario_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pulso_diario_id_seq" OWNED BY "public"."pulso_diario"."id";



CREATE TABLE IF NOT EXISTS "public"."reconciliaciones" (
    "id" bigint NOT NULL,
    "corrida" timestamp with time zone DEFAULT "now"(),
    "account" "text",
    "regla" "text" NOT NULL,
    "objeto" "text" NOT NULL,
    "accion" "text" NOT NULL,
    "detalle" "text",
    "aplicada" boolean DEFAULT false,
    "aplicada_el" timestamp with time zone
);


ALTER TABLE "public"."reconciliaciones" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."reconciliaciones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reconciliaciones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reconciliaciones_id_seq" OWNED BY "public"."reconciliaciones"."id";



CREATE TABLE IF NOT EXISTS "public"."reflexiones" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "run_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "tipo" "text" NOT NULL,
    "que_paso" "text" NOT NULL,
    "que_haria_distinto" "text" NOT NULL,
    "regla_del_prompt" "text",
    "confianza" "text" DEFAULT 'media'::"text",
    "aplicada" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reflexiones_confianza_check" CHECK (("confianza" = ANY (ARRAY['baja'::"text", 'media'::"text", 'alta'::"text"]))),
    CONSTRAINT "reflexiones_tipo_check" CHECK (("tipo" = ANY (ARRAY['regla_no_funciono'::"text", 'dato_faltante'::"text", 'herramienta_fallo'::"text", 'inferencia_incorrecta'::"text", 'acierto'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."reflexiones" OWNER TO "postgres";


COMMENT ON TABLE "public"."reflexiones" IS 'Memoria episodica del patron Reflexion: cada corrida escribe que haria distinto. La tarea siguiente lee las ultimas 10 de su cuenta al inicio. Cuando una reflexion se repite en 2+ corridas, es una propuesta de cambio al prompt (v_reflexiones_recurrentes). aplicada=true cuando ya se incorporo.';



CREATE SEQUENCE IF NOT EXISTS "public"."reflexiones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reflexiones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reflexiones_id_seq" OWNED BY "public"."reflexiones"."id";



CREATE TABLE IF NOT EXISTS "public"."relaciones_verdad" (
    "id" bigint NOT NULL,
    "familia" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "que_afirma" "text" NOT NULL,
    "sql_izquierda" "text" NOT NULL,
    "sql_derecha" "text" NOT NULL,
    "dominio_valido" "text",
    "tolerancia_rel" numeric DEFAULT 0.001 NOT NULL,
    "por_que_existe" "text" NOT NULL,
    "activa" boolean DEFAULT true NOT NULL,
    "creada_el" "date" DEFAULT CURRENT_DATE NOT NULL,
    "mutante_sql" "text",
    "mutante_probado_el" "date",
    "mutante_resultado" "text",
    "ambito" "text" DEFAULT 'cuenta'::"text" NOT NULL,
    CONSTRAINT "relaciones_verdad_ambito_check" CHECK (("ambito" = ANY (ARRAY['cuenta'::"text", 'global'::"text"]))),
    CONSTRAINT "relaciones_verdad_familia_check" CHECK (("familia" = ANY (ARRAY['conservacion'::"text", 'monotonia'::"text", 'equivalencia'::"text", 'invariante_dominio'::"text"]))),
    CONSTRAINT "relaciones_verdad_mutante_resultado_check" CHECK (("mutante_resultado" = ANY (ARRAY['mato_al_mutante'::"text", 'responde_al_inverso'::"text", 'sobrevivio'::"text", 'trabada'::"text", 'sin_probar'::"text"])))
);


ALTER TABLE "public"."relaciones_verdad" OWNER TO "postgres";


COMMENT ON TABLE "public"."relaciones_verdad" IS 'Relaciones que tienen que cumplirse pase lo que pase. Familias metamorficas (conservacion, monotonia, equivalencia) mas invariantes de dominio, que no son lo mismo: la metamorfica compara dos ejecuciones entre si, la invariante compara una ejecucion contra una regla del negocio. dominio_valido devuelve booleano y decide si la relacion APLICA: sin eso una relacion fuera de dominio da falso positivo y se termina ignorando, que es como mueren todas las alertas.';



COMMENT ON COLUMN "public"."relaciones_verdad"."mutante_sql" IS 'UPDATE que corrompe el dato a proposito para probar que la relacion dispara. Se corre dentro de una transaccion con rollback: nunca toca produccion.';



COMMENT ON COLUMN "public"."relaciones_verdad"."mutante_resultado" IS 'mato_al_mutante: estaba en verde, se corrompio el dato y disparo. responde_al_inverso: estaba en rojo, se arreglo el dato y se puso en verde. sobrevivio o trabada: el control no responde al dato y no sirve, aunque se vea sano.';



COMMENT ON COLUMN "public"."relaciones_verdad"."ambito" IS 'cuenta: se corre una vez por cuenta activa y $CUENTA$ se reemplaza. global: se corre una sola vez, es una condicion del esquema o del sistema. Sin esta distincion, una relacion global hay que disfrazarla de por-cuenta con un dominio_valido arbitrario, y eso genera no_aplicaba falsos.';



CREATE SEQUENCE IF NOT EXISTS "public"."relaciones_verdad_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."relaciones_verdad_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."relaciones_verdad_id_seq" OWNED BY "public"."relaciones_verdad"."id";



CREATE TABLE IF NOT EXISTS "public"."reportes_cliente" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "periodo_desde" "date" NOT NULL,
    "periodo_hasta" "date" NOT NULL,
    "tipo" "text" DEFAULT 'semanal'::"text" NOT NULL,
    "idioma" "text" NOT NULL,
    "estado" "text" DEFAULT 'borrador'::"text" NOT NULL,
    "resumen_ejecutivo" "text" NOT NULL,
    "que_cambiamos" "text",
    "que_sigue" "text",
    "metricas" "jsonb" NOT NULL,
    "serie" "jsonb",
    "campanas" "jsonb",
    "brief_notion_id" "text",
    "escrito_por" "text" DEFAULT 'opus-5-semanal'::"text",
    "pdf_path" "text",
    "pdf_bytes" integer,
    "creado" timestamp with time zone DEFAULT "now"(),
    "aprobado_el" timestamp with time zone,
    "aprobado_por" "text",
    "editado" boolean DEFAULT false,
    "enviado_el" timestamp with time zone,
    "enviado_a" "text"[],
    "bloques" "jsonb",
    "token" "text",
    "visto_el" timestamp with time zone,
    "vistas" integer DEFAULT 0,
    "nota_interna" "text",
    "version" integer DEFAULT 1,
    CONSTRAINT "reportes_cliente_estado_check" CHECK (("estado" = ANY (ARRAY['borrador'::"text", 'revisado'::"text", 'aprobado'::"text", 'enviado'::"text", 'descartado'::"text"]))),
    CONSTRAINT "reportes_cliente_tipo_check" CHECK (("tipo" = ANY (ARRAY['semanal'::"text", 'mensual'::"text"])))
);


ALTER TABLE "public"."reportes_cliente" OWNER TO "postgres";


COMMENT ON TABLE "public"."reportes_cliente" IS 'ENTREGABLE AL CLIENTE, NO EVIDENCIA. Andres lo edita: tono, omisiones, suavizados. Ningun agente lo lee como fuente del estado de la cuenta ni copia su texto. La evidencia es Supabase; la memoria es el brief y la ficha. El texto inicial sale del brief o de Sonnet 5 y despues es de Andres.';



CREATE SEQUENCE IF NOT EXISTS "public"."reportes_cliente_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reportes_cliente_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reportes_cliente_id_seq" OWNED BY "public"."reportes_cliente"."id";



CREATE TABLE IF NOT EXISTS "public"."reportes_versiones" (
    "id" bigint NOT NULL,
    "reporte_id" bigint NOT NULL,
    "version" integer NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"(),
    "autor" "text" NOT NULL,
    "bloques" "jsonb" NOT NULL,
    "motivo" "text"
);


ALTER TABLE "public"."reportes_versiones" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."reportes_versiones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reportes_versiones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reportes_versiones_id_seq" OWNED BY "public"."reportes_versiones"."id";



CREATE TABLE IF NOT EXISTS "public"."rsa_assets" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "ad_group" "text",
    "field_type" "text",
    "performance_label" "text",
    "asset_text" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "cost" numeric,
    "conversions" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."rsa_assets" OWNER TO "postgres";


COMMENT ON TABLE "public"."rsa_assets" IS 'Assets de RSA. performance_label suele venir NOT_APPLICABLE cuando el volumen por asset es bajo: es limitacion de Google, no falla de extraccion.';



CREATE SEQUENCE IF NOT EXISTS "public"."rsa_assets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rsa_assets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rsa_assets_id_seq" OWNED BY "public"."rsa_assets"."id";



CREATE TABLE IF NOT EXISTS "public"."run_log" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "tabla" "text" NOT NULL,
    "filas" integer DEFAULT 0,
    "status" "text" DEFAULT 'OK'::"text" NOT NULL,
    "error_msg" "text",
    "run_ts" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "run_log_status_check" CHECK (("status" = ANY (ARRAY['OK'::"text", 'ERROR'::"text", 'VACIO'::"text"])))
);


ALTER TABLE "public"."run_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."run_log" IS 'Log de extraccion de los scripts de Google Ads (filas por tabla y semana). NO es el registro de corridas de la tarea semanal: eso es run_quality.';



CREATE SEQUENCE IF NOT EXISTS "public"."run_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."run_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."run_log_id_seq" OWNED BY "public"."run_log"."id";



CREATE TABLE IF NOT EXISTS "public"."run_quality" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "run_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "semana_analizada" "date",
    "brief_creado_o_actualizado" boolean,
    "handoff_escrito" boolean,
    "handoff_lineas" integer,
    "fechas_explicitas" boolean,
    "dias_provisionales_marcados" boolean,
    "accionables_nuevos" integer,
    "accionables_con_naturaleza" integer,
    "accionables_con_causa_raiz" integer,
    "accionables_con_verificar_fecha" integer,
    "titulos_son_acciones" boolean,
    "comentarios_respondidos" integer,
    "comentarios_pendientes" integer,
    "propagacion_ejecutada" boolean,
    "operator_log_consultado" boolean,
    "cambios_detectados_consultado" boolean,
    "inferencias_en_bloqueado" boolean,
    "preguntas_a_andres" integer,
    "duplicado_evitado" boolean,
    "revision_humana" "text",
    "revision_humana_fecha" "date",
    "que_fallo" "text",
    "tiempo_estimado_min" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "foto_leida" timestamp with time zone,
    "ultimo_evento_visto" timestamp with time zone,
    "ultima_extraccion_vista" timestamp with time zone
);


ALTER TABLE "public"."run_quality" OWNER TO "postgres";


COMMENT ON TABLE "public"."run_quality" IS 'Una fila por corrida semanal y cuenta. Chequeos deterministas que el agente verifica contra su propia salida al terminar. No mide calidad de analisis, mide cumplimiento del procedimiento: si cada campo obligatorio quedo escrito, si consulto lo que debia, si evito lo que debia evitar. revision_humana es el unico campo subjetivo y lo completa Andres.';



COMMENT ON COLUMN "public"."run_quality"."foto_leida" IS 'foto_tomada de get_estado_cuenta que la corrida leyo al arrancar.';



COMMENT ON COLUMN "public"."run_quality"."ultimo_evento_visto" IS 'Maximo event_date de google_live_events al momento de la corrida. Se compara contra esto, no contra created_at, porque el centinela reingesta los mismos eventos.';



CREATE SEQUENCE IF NOT EXISTS "public"."run_quality_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."run_quality_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."run_quality_id_seq" OWNED BY "public"."run_quality"."id";



CREATE TABLE IF NOT EXISTS "public"."search_terms" (
    "id" bigint NOT NULL,
    "week_start" "date",
    "week_end" "date",
    "account" "text",
    "campaign" "text",
    "ad_group" "text",
    "search_term" "text",
    "match_type" "text",
    "triggered_keyword" "text",
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "cost" numeric,
    "conversions" numeric,
    "conv_value" numeric,
    "cost_per_conv" numeric,
    "run_ts" "text"
);


ALTER TABLE "public"."search_terms" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_terms" IS 'CAPA SEMANAL · terminos de busqueda de la semana. Para detectar el dia en que aparecio un termino nuevo, usar search_terms_daily o v_terminos_nuevos.';



CREATE TABLE IF NOT EXISTS "public"."search_terms_daily" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "date" "date" NOT NULL,
    "campaign" "text" NOT NULL,
    "ad_group" "text" NOT NULL,
    "search_term" "text" NOT NULL,
    "match_type" "text" DEFAULT ''::"text" NOT NULL,
    "triggered_keyword" "text" DEFAULT ''::"text" NOT NULL,
    "currency" "text",
    "impressions" numeric,
    "clicks" numeric,
    "ctr" numeric,
    "avg_cpc" numeric,
    "cost" numeric,
    "conversions" numeric,
    "cost_per_conv" numeric,
    "run_ts" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."search_terms_daily" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_terms_daily" IS 'Terminos de busqueda por dia, solo con impresiones. Habilita detectar un termino nuevo el dia que aparece en lugar del lunes siguiente, y ver cuando empezo a gastar uno que no convierte.';



CREATE SEQUENCE IF NOT EXISTS "public"."search_terms_daily_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."search_terms_daily_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."search_terms_daily_id_seq" OWNED BY "public"."search_terms_daily"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."search_terms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."search_terms_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."search_terms_id_seq" OWNED BY "public"."search_terms"."id";



CREATE TABLE IF NOT EXISTS "public"."sesiones" (
    "id" bigint NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "titulo" "text" NOT NULL,
    "desde_version" "text",
    "hasta_version" "text",
    "con_que_empezo" "text",
    "que_se_construyo" "text",
    "que_se_aprendio" "text",
    "que_quedo_pendiente" "text",
    "creada" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sesiones" OWNER TO "postgres";


COMMENT ON TABLE "public"."sesiones" IS 'El arco de cada sesion de construccion. cambios_de_sistema tiene los cambios uno por uno; esto tiene por que se hicieron juntos y que se aprendio del conjunto. Un chat nuevo lee esto para entender la trama, no solo la lista.';



CREATE SEQUENCE IF NOT EXISTS "public"."sesiones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sesiones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sesiones_id_seq" OWNED BY "public"."sesiones"."id";



CREATE TABLE IF NOT EXISTS "public"."simulations" (
    "id" bigint NOT NULL,
    "account" "text",
    "campaign" "text",
    "sim_type" "text",
    "modification_method" "text",
    "start_date" "date",
    "end_date" "date",
    "target_value" numeric,
    "est_conversions" numeric,
    "est_conv_value" numeric,
    "est_clicks" numeric,
    "est_cost" numeric,
    "est_impressions" numeric,
    "est_top_slot_impressions" numeric,
    "currency" "text",
    "run_ts" "text"
);


ALTER TABLE "public"."simulations" OWNER TO "postgres";


COMMENT ON TABLE "public"."simulations" IS 'Curvas de simulacion de tCPA, tROAS y presupuesto. Vacia es legitimo: Google solo las genera con volumen suficiente. Es la unica base valida para proponer cambios de target.';



CREATE SEQUENCE IF NOT EXISTS "public"."simulations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."simulations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."simulations_id_seq" OWNED BY "public"."simulations"."id";



CREATE TABLE IF NOT EXISTS "public"."terminos_protegidos" (
    "id" bigint NOT NULL,
    "account" "text" NOT NULL,
    "termino" "text" NOT NULL,
    "motivo" "text" NOT NULL,
    "conversiones_90d" numeric,
    "gasto_90d" numeric,
    "agregado_por" "text" DEFAULT 'sistema'::"text",
    "agregado_el" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."terminos_protegidos" OWNER TO "postgres";


COMMENT ON TABLE "public"."terminos_protegidos" IS 'El nucleo semantico de cada cuenta: keywords que convirtieron en 90 dias, las que concentran el 80% de conversiones, la marca, y lo que Andres agregue. Ninguna negativa puede bloquearlas; ninguna pausa las toca sin confirmacion explicita con numeros.';



CREATE SEQUENCE IF NOT EXISTS "public"."terminos_protegidos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."terminos_protegidos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."terminos_protegidos_id_seq" OWNED BY "public"."terminos_protegidos"."id";



CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" bigint NOT NULL,
    "creado" timestamp with time zone DEFAULT "now"(),
    "creado_por" "text" DEFAULT 'andres'::"text",
    "tipo" "text" DEFAULT 'bug'::"text" NOT NULL,
    "titulo" "text" NOT NULL,
    "descripcion" "text",
    "pagina" "text",
    "cuenta" "text",
    "contexto" "jsonb",
    "estado" "text" DEFAULT 'abierto'::"text" NOT NULL,
    "respuesta" "text",
    "resuelto_el" timestamp with time zone,
    "resuelto_en_version" "text",
    "auditoria_de_escape" "text",
    "veces_reabierto" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "tickets_estado_check" CHECK (("estado" = ANY (ARRAY['abierto'::"text", 'en_curso'::"text", 'resuelto'::"text", 'descartado'::"text"]))),
    CONSTRAINT "tickets_tipo_check" CHECK (("tipo" = ANY (ARRAY['bug'::"text", 'mejora'::"text", 'pregunta'::"text", 'dato_incorrecto'::"text"])))
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


COMMENT ON TABLE "public"."tickets" IS 'Tickets que Andres crea desde la app cuando algo no cuadra. Claude los lee al inicio de cada sesion de trabajo (select * from tickets where estado = ''abierto'' order by creado) y responde en la columna respuesta. Es el canal de devolucion entre operador y constructor.';



COMMENT ON COLUMN "public"."tickets"."auditoria_de_escape" IS 'Las tres preguntas despues del incidente: 1) habia un control que cubriera esto, 2) si lo habia, por que paso en verde, 3) que cambia para que no vuelva a escapar. Se responde antes de cerrar, no despues.';



CREATE SEQUENCE IF NOT EXISTS "public"."tickets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tickets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tickets_id_seq" OWNED BY "public"."tickets"."id";



CREATE TABLE IF NOT EXISTS "public"."true_roas_events" (
    "id" bigint NOT NULL,
    "client" "text" NOT NULL,
    "gclid" "text" NOT NULL,
    "monto" numeric NOT NULL,
    "event_date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'asana'::"text",
    "external_id" "text" NOT NULL,
    "click_id_type" "text",
    CONSTRAINT "true_roas_events_click_id_type_check" CHECK (("click_id_type" = ANY (ARRAY['gclid'::"text", 'gbraid'::"text", 'wbraid'::"text"])))
);


ALTER TABLE "public"."true_roas_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."true_roas_events" IS 'Montos reales de negocio, la fuente de verdad que reemplaza a las conversiones de Google en 360 (valor inflado por regla 1,5x) y BHI (el pipeline vive en GoHighLevel). external_id + client + gclid forman la clave de deduplicacion: usar upsert con onConflict, nunca insert directo.';



COMMENT ON COLUMN "public"."true_roas_events"."external_id" IS 'ID del objeto en el sistema de origen: gid de la tarea de Asana, id de la oportunidad de GHL. Es lo que hace idempotente la escritura.';



COMMENT ON COLUMN "public"."true_roas_events"."click_id_type" IS 'Cual de los tres identificadores de Google trae la columna gclid. Determina en que campo se sube la conversion offline: gclid, gbraid o wbraid. Filtrar solo por gclid descarta el trafico de iOS.';



CREATE SEQUENCE IF NOT EXISTS "public"."true_roas_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."true_roas_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."true_roas_events_id_seq" OWNED BY "public"."true_roas_events"."id";



CREATE TABLE IF NOT EXISTS "public"."umbrales_de_scripts" (
    "account" "text" NOT NULL,
    "script" "text" NOT NULL,
    "umbral" "text" NOT NULL,
    "valor" numeric,
    "declarado_el" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."umbrales_de_scripts" OWNER TO "postgres";


COMMENT ON TABLE "public"."umbrales_de_scripts" IS 'Umbrales que cada script tiene cableados. Los declara al correr. Existe para contrastar contra cuentas: un umbral en cero es un centinela que no alerta, y hasta hoy no habia forma de verlo.';



CREATE TABLE IF NOT EXISTS "public"."umbrales_esperados" (
    "script" "text" NOT NULL,
    "umbral" "text" NOT NULL,
    "ventana" "text" NOT NULL,
    "canonico_en_cuentas" "text"
);


ALTER TABLE "public"."umbrales_esperados" OWNER TO "postgres";


COMMENT ON TABLE "public"."umbrales_esperados" IS 'Que umbral tiene que declarar cada script. Si un script no declara, v_umbrales_inconsistentes lo reporta. Sin esto, los umbrales cableados de un script que no llama a declarar_umbral son invisibles para la auditoria, que es como FRESH_MONKEE siguio con ceros en el semanal despues de que fix-v82 los corrigiera solo en el centinela.';



CREATE OR REPLACE VIEW "public"."v_360_campaign" WITH ("security_invoker"='on') AS
 SELECT "week_start",
    "week_end",
    "campaign",
    "status",
    "bid_strategy",
    "currency",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "cost",
    "conversions",
    "cost_per_conv",
    "conv_rate",
    "impr_share",
    "lost_is_budget",
    "lost_is_rank"
   FROM "public"."campaign"
  WHERE ("account" = '360'::"text");


ALTER VIEW "public"."v_360_campaign" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_360_campaign" IS 'Campanas de 360. Deliberadamente NO expone conv_value ni all_conversions: el valor esta inflado por la regla de valor 1,5x para empresa grande, y all_conversions suma clics a WhatsApp, mail y llamadas que no son negocio real. Los montos de negocio salen del campo Monto de Asana, nunca de aca.';



CREATE OR REPLACE VIEW "public"."v_accionable_relaciones" WITH ("security_invoker"='true') AS
 SELECT "r"."id",
    "r"."account",
    "r"."a",
    "r"."b",
    "r"."tipo",
    "r"."regla",
    "r"."motivo",
    "r"."severidad",
    "r"."detectada",
    "r"."resuelta",
    "r"."resuelta_el",
    "r"."resuelta_por",
    "ea"."titulo" AS "titulo_a",
    COALESCE("eb"."titulo", "replace"("r"."b", 'keyword:'::"text", 'keyword activa: '::"text")) AS "titulo_b"
   FROM (("public"."accionable_relaciones" "r"
     LEFT JOIN "public"."accionables_espejo" "ea" ON (("ea"."notion_id" = "r"."a")))
     LEFT JOIN "public"."accionables_espejo" "eb" ON (("eb"."notion_id" = "r"."b")));


ALTER VIEW "public"."v_accionable_relaciones" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_accionables_invalidos" WITH ("security_invoker"='true') AS
 WITH "clas" AS (
         SELECT "a"."account",
            "a"."notion_id",
            "a"."titulo",
            "a"."estado",
            ("a"."accion" ->> 'verbo'::"text") AS "verbo",
            "a"."accion_error",
            (EXISTS ( SELECT 1
                   FROM "public"."capacidades_ejecucion" "c"
                  WHERE (("c"."plataforma" = 'google'::"public"."plataforma_pub") AND "c"."ejecutable" AND (("a"."titulo" ~* "c"."verbo") OR (COALESCE("a"."como_hacerlo", ''::"text") ~* "c"."verbo"))))) AS "sugiere_verbo_ejecutable",
            ("a"."accion" IS NULL) AS "sin_json",
            COALESCE("a"."accion_valida", false) AS "json_valido",
            (EXISTS ( SELECT 1
                   FROM "public"."capacidades_ejecucion" "c"
                  WHERE (("c"."verbo" = ("a"."accion" ->> 'verbo'::"text")) AND ("c"."plataforma" = 'google'::"public"."plataforma_pub")))) AS "verbo_conocido"
           FROM "public"."accionables_espejo" "a"
          WHERE ("a"."estado" = ANY (ARRAY['Propuesto'::"text", 'Bloqueado'::"text", 'Aprobado'::"text", 'En curso'::"text"]))
        )
 SELECT "account",
    "notion_id",
    "titulo",
    "estado",
    "verbo",
    "accion_error",
        CASE
            WHEN ("sin_json" AND (NOT "sugiere_verbo_ejecutable")) THEN 'sin_json_correcto'::"text"
            WHEN "sin_json" THEN 'sin_json_y_deberia_tenerlo'::"text"
            WHEN (NOT "json_valido") THEN 'json_roto'::"text"
            WHEN (NOT "verbo_conocido") THEN 'verbo_desconocido'::"text"
            ELSE 'ok'::"text"
        END AS "clasificacion",
        CASE
            WHEN ("sin_json" AND (NOT "sugiere_verbo_ejecutable")) THEN 'CORRECTO: no lleva Accion JSON porque su verbo no es ejecutable por script. No es un error y no hay nada que arreglar.'::"text"
            WHEN "sin_json" THEN 'FALTA: el titulo sugiere un verbo que SI es ejecutable y el agente no dejo el JSON. Es trabajo manual evitable.'::"text"
            WHEN (NOT "json_valido") THEN ('ROTO: '::"text" || COALESCE("accion_error", 'el JSON no parsea'::"text"))
            WHEN (NOT "verbo_conocido") THEN 'Verbo fuera del registro de capacidades: revisar si falta darlo de alta.'::"text"
            ELSE 'Listo para ejecutar.'::"text"
        END AS "lectura"
   FROM "clas";


ALTER VIEW "public"."v_accionables_invalidos" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_accionables_invalidos" IS 'Ticket 38. Distingue sin_json_correcto (el verbo no es ejecutable, no es error) de sin_json_y_deberia_tenerlo y json_roto. Antes los tres se veian igual y 9 accionables correctos figuraban como invalidos.';



CREATE OR REPLACE VIEW "public"."v_acciones_pendientes" AS
 SELECT "id",
    "account",
    "tipo",
    "campana",
    "grupo",
    "keyword",
    "match_type",
    "ad_id",
    "modo",
    "match_type_destino",
    "keywords",
    "nivel",
    "estrategia_destino",
    "valor_actual",
    "valor_nuevo",
    "etiqueta"
   FROM "public"."acciones_aprobadas"
  WHERE (("estado" = 'pendiente'::"text") AND (("no_ejecutar_antes_de" IS NULL) OR ("no_ejecutar_antes_de" <= CURRENT_DATE)))
  ORDER BY "aprobada_el";


ALTER VIEW "public"."v_acciones_pendientes" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_acciones_pendientes" IS 'Lo que el ejecutor toma en cada corrida. Filtra por no_ejecutar_antes_de: una accion con fecha futura queda encolada y no se entrega. No sacar ese filtro; la fecha en el JSON del accionable sola no alcanza porque el ejecutor no lee el accionable.';



CREATE OR REPLACE VIEW "public"."v_serie_diaria" WITH ("security_invoker"='on') AS
 SELECT "account",
    "date",
    "round"("sum"("cost"), 2) AS "gasto",
    "sum"("clicks") AS "clics",
    "sum"("impressions") AS "impresiones",
    "round"("sum"("conversions"), 2) AS "conversiones",
    "round"(("sum"("cost") / NULLIF("sum"("conversions"), (0)::numeric)), 2) AS "cpa",
    "round"((("sum"("clicks") / NULLIF("sum"("impressions"), (0)::numeric)) * (100)::numeric), 2) AS "ctr",
    "round"(("sum"("cost") / NULLIF("sum"("clicks"), (0)::numeric)), 2) AS "cpc",
    "round"("avg"("lost_is_budget"), 2) AS "perdido_presupuesto",
    "round"("avg"("lost_is_rank"), 2) AS "perdido_ranking",
    "public"."madurez_dato"("date") AS "madurez",
    (EXTRACT(isodow FROM "date"))::integer AS "dia_semana"
   FROM "public"."campaign_daily"
  WHERE ("status" = 'ENABLED'::"text")
  GROUP BY "account", "date";


ALTER VIEW "public"."v_serie_diaria" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_serie_diaria" IS 'Serie diaria por cuenta, solo campanas activas. Base del centro de mando y del analisis de patrones por dia de la semana.';



CREATE OR REPLACE VIEW "public"."v_impacto_accionables" WITH ("security_invoker"='on') AS
 WITH "ventanas" AS (
         SELECT "a"."notion_id",
            "a"."account",
            "a"."titulo",
            "a"."ejecutado_el",
            "a"."metrica_objetivo",
            "a"."direccion_esperada",
            "a"."entidad_tipo",
            "a"."entidad_nombre",
            "a"."causa_raiz",
            "a"."naturaleza",
            "a"."sincronizado_el",
            ("a"."ejecutado_el" - 14) AS "antes_desde",
            ("a"."ejecutado_el" - 1) AS "antes_hasta",
            ("a"."ejecutado_el" + 1) AS "despues_desde",
            ("a"."ejecutado_el" + 14) AS "despues_hasta"
           FROM "public"."accionables_ejecutados" "a"
        ), "metricas" AS (
         SELECT "v_1"."notion_id",
            ( SELECT "round"("sum"("s"."gasto"), 2) AS "round"
                   FROM "public"."v_serie_diaria" "s"
                  WHERE (("s"."account" = "v_1"."account") AND (("s"."date" >= "v_1"."antes_desde") AND ("s"."date" <= "v_1"."antes_hasta")))) AS "gasto_antes",
            ( SELECT "round"("sum"("s"."conversiones"), 2) AS "round"
                   FROM "public"."v_serie_diaria" "s"
                  WHERE (("s"."account" = "v_1"."account") AND (("s"."date" >= "v_1"."antes_desde") AND ("s"."date" <= "v_1"."antes_hasta")))) AS "conv_antes",
            ( SELECT "round"("avg"("s"."ctr"), 2) AS "round"
                   FROM "public"."v_serie_diaria" "s"
                  WHERE (("s"."account" = "v_1"."account") AND (("s"."date" >= "v_1"."antes_desde") AND ("s"."date" <= "v_1"."antes_hasta")))) AS "ctr_antes",
            ( SELECT "count"(*) AS "count"
                   FROM "public"."v_serie_diaria" "s"
                  WHERE (("s"."account" = "v_1"."account") AND (("s"."date" >= "v_1"."antes_desde") AND ("s"."date" <= "v_1"."antes_hasta")))) AS "dias_antes",
            ( SELECT "round"("sum"("s"."gasto"), 2) AS "round"
                   FROM "public"."v_serie_diaria" "s"
                  WHERE (("s"."account" = "v_1"."account") AND (("s"."date" >= "v_1"."despues_desde") AND ("s"."date" <= "v_1"."despues_hasta")) AND ("s"."madurez" = 'consolidado'::"text"))) AS "gasto_despues",
            ( SELECT "round"("sum"("s"."conversiones"), 2) AS "round"
                   FROM "public"."v_serie_diaria" "s"
                  WHERE (("s"."account" = "v_1"."account") AND (("s"."date" >= "v_1"."despues_desde") AND ("s"."date" <= "v_1"."despues_hasta")) AND ("s"."madurez" = 'consolidado'::"text"))) AS "conv_despues",
            ( SELECT "round"("avg"("s"."ctr"), 2) AS "round"
                   FROM "public"."v_serie_diaria" "s"
                  WHERE (("s"."account" = "v_1"."account") AND (("s"."date" >= "v_1"."despues_desde") AND ("s"."date" <= "v_1"."despues_hasta")) AND ("s"."madurez" = 'consolidado'::"text"))) AS "ctr_despues",
            ( SELECT "count"(*) AS "count"
                   FROM "public"."v_serie_diaria" "s"
                  WHERE (("s"."account" = "v_1"."account") AND (("s"."date" >= "v_1"."despues_desde") AND ("s"."date" <= "v_1"."despues_hasta")) AND ("s"."madurez" = 'consolidado'::"text"))) AS "dias_despues"
           FROM "ventanas" "v_1"
        )
 SELECT "v"."notion_id",
    "v"."account",
    "v"."titulo",
    "v"."ejecutado_el",
    "v"."metrica_objetivo",
    "v"."direccion_esperada",
    "v"."causa_raiz",
    "v"."naturaleza",
    "m"."dias_antes",
    "m"."dias_despues",
    "m"."gasto_antes",
    "m"."gasto_despues",
    "m"."conv_antes",
    "m"."conv_despues",
    "round"(("m"."gasto_antes" / NULLIF("m"."conv_antes", (0)::numeric)), 2) AS "cpa_antes",
    "round"(("m"."gasto_despues" / NULLIF("m"."conv_despues", (0)::numeric)), 2) AS "cpa_despues",
    "m"."ctr_antes",
    "m"."ctr_despues",
        CASE "v"."metrica_objetivo"
            WHEN 'cpa'::"text" THEN "round"((((("m"."gasto_despues" / NULLIF("m"."conv_despues", (0)::numeric)) - ("m"."gasto_antes" / NULLIF("m"."conv_antes", (0)::numeric))) / NULLIF(("m"."gasto_antes" / NULLIF("m"."conv_antes", (0)::numeric)), (0)::numeric)) * (100)::numeric), 1)
            WHEN 'gasto'::"text" THEN "round"(((("m"."gasto_despues" - "m"."gasto_antes") / NULLIF("m"."gasto_antes", (0)::numeric)) * (100)::numeric), 1)
            WHEN 'conversiones'::"text" THEN "round"(((("m"."conv_despues" - "m"."conv_antes") / NULLIF("m"."conv_antes", (0)::numeric)) * (100)::numeric), 1)
            WHEN 'ctr'::"text" THEN "round"(((("m"."ctr_despues" - "m"."ctr_antes") / NULLIF("m"."ctr_antes", (0)::numeric)) * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS "variacion_pct",
        CASE
            WHEN ("m"."dias_despues" < 7) THEN 'PENDIENTE: menos de 7 dias consolidados despues'::"text"
            WHEN ("v"."metrica_objetivo" IS NULL) THEN 'SIN METRICA: el accionable no declaro que medir'::"text"
            WHEN (("v"."direccion_esperada" = 'baja'::"text") AND
            CASE "v"."metrica_objetivo"
                WHEN 'cpa'::"text" THEN (("m"."gasto_despues" / NULLIF("m"."conv_despues", (0)::numeric)) < (("m"."gasto_antes" / NULLIF("m"."conv_antes", (0)::numeric)) * 0.9))
                WHEN 'gasto'::"text" THEN ("m"."gasto_despues" < ("m"."gasto_antes" * 0.9))
                ELSE NULL::boolean
            END) THEN 'FUNCIONO: bajo mas de 10%'::"text"
            WHEN (("v"."direccion_esperada" = 'sube'::"text") AND
            CASE "v"."metrica_objetivo"
                WHEN 'conversiones'::"text" THEN ("m"."conv_despues" > ("m"."conv_antes" * 1.1))
                WHEN 'ctr'::"text" THEN ("m"."ctr_despues" > ("m"."ctr_antes" * 1.1))
                ELSE NULL::boolean
            END) THEN 'FUNCIONO: subio mas de 10%'::"text"
            WHEN ("abs"(COALESCE(
            CASE "v"."metrica_objetivo"
                WHEN 'cpa'::"text" THEN ((("m"."gasto_despues" / NULLIF("m"."conv_despues", (0)::numeric)) - ("m"."gasto_antes" / NULLIF("m"."conv_antes", (0)::numeric))) / NULLIF(("m"."gasto_antes" / NULLIF("m"."conv_antes", (0)::numeric)), (0)::numeric))
                WHEN 'gasto'::"text" THEN (("m"."gasto_despues" - "m"."gasto_antes") / NULLIF("m"."gasto_antes", (0)::numeric))
                WHEN 'conversiones'::"text" THEN (("m"."conv_despues" - "m"."conv_antes") / NULLIF("m"."conv_antes", (0)::numeric))
                WHEN 'ctr'::"text" THEN (("m"."ctr_despues" - "m"."ctr_antes") / NULLIF("m"."ctr_antes", (0)::numeric))
                ELSE NULL::numeric
            END, (0)::numeric)) < 0.1) THEN 'NEUTRO: menos de 10% de cambio'::"text"
            ELSE 'EMPEORO: se movio en direccion contraria'::"text"
        END AS "veredicto"
   FROM ("ventanas" "v"
     JOIN "metricas" "m" ON (("m"."notion_id" = "v"."notion_id")));


ALTER VIEW "public"."v_impacto_accionables" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_impacto_accionables" IS 'Impacto real de cada accionable ejecutado: la metrica objetivo 14 dias antes vs 14 dias despues (solo dias consolidados). Veredicto automatico: FUNCIONO / NEUTRO / EMPEORO / PENDIENTE. Es la funcion de evaluacion del sistema: lo que dice si el analisis acierta. La tarea semanal lo copia a Resultado observado en Notion; no lo calcula.';



CREATE OR REPLACE VIEW "public"."v_acierto_por_tipo" WITH ("security_invoker"='true') AS
 WITH "t" AS (
         SELECT "v_impacto_accionables"."account",
            "v_impacto_accionables"."ejecutado_el",
            "v_impacto_accionables"."veredicto",
            "v_impacto_accionables"."variacion_pct",
                CASE
                    WHEN ("v_impacto_accionables"."titulo" ~* 'negativ'::"text") THEN 'negativa'::"text"
                    WHEN ("v_impacto_accionables"."titulo" ~* 'pausar'::"text") THEN 'pausa'::"text"
                    WHEN ("v_impacto_accionables"."titulo" ~* 'puja|tcpa|cpa objetivo|maximizar'::"text") THEN 'puja'::"text"
                    WHEN ("v_impacto_accionables"."titulo" ~* 'presupuesto'::"text") THEN 'presupuesto'::"text"
                    WHEN ("v_impacto_accionables"."titulo" ~* 'concordancia|frase|exacta'::"text") THEN 'concordancia'::"text"
                    WHEN ("v_impacto_accionables"."titulo" ~* 'anuncio|rsa|titular'::"text") THEN 'anuncio'::"text"
                    WHEN ("v_impacto_accionables"."titulo" ~* 'conversi'::"text") THEN 'conversiones'::"text"
                    WHEN ("v_impacto_accionables"."titulo" ~* 'landing|url'::"text") THEN 'landing'::"text"
                    ELSE 'otro'::"text"
                END AS "tipo"
           FROM "public"."v_impacto_accionables"
          WHERE ("v_impacto_accionables"."veredicto" IS NOT NULL)
        )
 SELECT "account",
    "tipo",
    "count"(*) AS "n",
    "sum"(
        CASE
            WHEN ("veredicto" ~* '^MEJOR'::"text") THEN 1
            ELSE 0
        END) AS "mejoraron",
    "sum"(
        CASE
            WHEN ("veredicto" ~* '^PEOR'::"text") THEN 1
            ELSE 0
        END) AS "empeoraron",
    "round"("avg"("variacion_pct"), 1) AS "variacion_promedio_pct",
        CASE
            WHEN ("count"(*) < 3) THEN 'pocas para juzgar'::"text"
            WHEN ((("sum"(
            CASE
                WHEN ("veredicto" ~* '^MEJOR'::"text") THEN 1
                ELSE 0
            END))::numeric / ("count"(*))::numeric) >= 0.66) THEN 'funciona en esta cuenta'::"text"
            WHEN ((("sum"(
            CASE
                WHEN ("veredicto" ~* '^PEOR'::"text") THEN 1
                ELSE 0
            END))::numeric / ("count"(*))::numeric) >= 0.5) THEN 'suele empeorar: revisar antes de repetir'::"text"
            ELSE 'mixto'::"text"
        END AS "veredicto"
   FROM "t"
  GROUP BY "account", "tipo"
  ORDER BY "account", ("count"(*)) DESC;


ALTER VIEW "public"."v_acierto_por_tipo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_adgroup_analisis" WITH ("security_invoker"='on') AS
 SELECT "account",
    "week_start",
    "campaign",
    "campaign_status",
    "ad_group",
    "ad_group_status",
    "ad_group_type",
    "currency",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "cost",
    "conversions",
    "cost_per_conv",
    "conv_rate",
    "impr_share"
   FROM "public"."adgroup";


ALTER VIEW "public"."v_adgroup_analisis" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_adgroup_analisis" IS 'Grupos de anuncios de todas las cuentas. Incluye grupos con cero impresiones: eso es senal, no ausencia de dato.';



CREATE OR REPLACE VIEW "public"."v_adgroup_daily" WITH ("security_invoker"='on') AS
 SELECT "account",
    "date",
    "campaign",
    "campaign_status",
    "ad_group",
    "ad_group_status",
    "currency",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "cost",
    "conversions",
    "cost_per_conv",
    "conv_rate",
    "impr_share",
    "public"."madurez_dato"("date") AS "madurez",
    (CURRENT_DATE - "date") AS "dias_transcurridos"
   FROM "public"."adgroup_daily";


ALTER VIEW "public"."v_adgroup_daily" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_adgroup_daily" IS 'Grupos por dia con marca de madurez. Filtrar madurez = consolidado para conclusiones sobre conversiones.';



CREATE OR REPLACE VIEW "public"."v_alertas_abiertas" WITH ("security_invoker"='true') AS
 SELECT "id",
    "account",
    "nivel",
    "tipo",
    "titulo",
    "detalle",
    "accion",
    "origen",
    "entidad",
    "fecha_dato",
    "estado",
    "silenciada_hasta",
    "silenciada_por_que",
    "creada",
    "vista_el",
    "resuelta_el",
    "dedupe_key",
        CASE "nivel"
            WHEN 'hoy'::"text" THEN 1
            WHEN 'semana'::"text" THEN 2
            ELSE 3
        END AS "orden"
   FROM "public"."alertas" "a"
  WHERE ("estado" = ANY (ARRAY['abierta'::"text", 'vista'::"text"]))
  ORDER BY
        CASE "nivel"
            WHEN 'hoy'::"text" THEN 1
            WHEN 'semana'::"text" THEN 2
            ELSE 3
        END, "creada" DESC;


ALTER VIEW "public"."v_alertas_abiertas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_alertas_agrupadas" WITH ("security_invoker"='true') AS
 SELECT "account",
    "tipo",
    "nivel",
    ("creada")::"date" AS "dia",
    "count"(*) AS "cuantas",
        CASE
            WHEN ("count"(*) = 1) THEN "max"("titulo")
            ELSE (("count"(*) || ' entidades · '::"text") || "max"("titulo"))
        END AS "titulo",
        CASE
            WHEN ("count"(*) = 1) THEN "max"("detalle")
            ELSE "left"("string_agg"("split_part"("detalle", ' ('::"text", 1), ', '::"text" ORDER BY "a"."detalle"), 200)
        END AS "detalle",
    "min"("id") AS "id_representante",
    "array_agg"("id" ORDER BY "id") AS "ids",
        CASE
            WHEN ("count"(*) >= 5) THEN (('Un solo hecho repetido en '::"text" || "count"(*)) || ' entidades: se resuelven juntas con resolver_grupo_alertas.'::"text")
            ELSE NULL::"text"
        END AS "lectura"
   FROM "public"."alertas" "a"
  WHERE (("estado" = 'abierta'::"text") AND (COALESCE(("silenciada_hasta")::timestamp with time zone, '-infinity'::timestamp with time zone) < "now"()))
  GROUP BY "account", "tipo", "nivel", (("creada")::"date");


ALTER VIEW "public"."v_alertas_agrupadas" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_alertas_agrupadas" IS 'Alertas del mismo tipo, cuenta y dia agrupadas en una. Fresh Monkee tenia 16 de AI Max del mismo dia: es UN hecho en 16 campanas, y verlas sueltas tapa todo lo demas.';



CREATE OR REPLACE VIEW "public"."v_anomalias_diarias" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "v_serie_diaria"."account",
            "v_serie_diaria"."date",
            "v_serie_diaria"."gasto",
            "v_serie_diaria"."conversiones",
            "v_serie_diaria"."cpa",
            "v_serie_diaria"."ctr",
            "v_serie_diaria"."clics",
            "v_serie_diaria"."madurez",
            (EXTRACT(isodow FROM "v_serie_diaria"."date"))::integer AS "dow"
           FROM "public"."v_serie_diaria"
        ), "ventana" AS (
         SELECT "b"."account",
            "b"."date",
            "b"."gasto",
            "b"."conversiones",
            "b"."cpa",
            "b"."ctr",
            "b"."clics",
            "b"."madurez",
            "b"."dow",
            ( SELECT "count"(*) AS "count"
                   FROM "base" "p"
                  WHERE (("p"."account" = "b"."account") AND ("p"."date" >= ("b"."date" - 7)) AND ("p"."date" <= ("b"."date" - 1)))) AS "n_base",
            ( SELECT "avg"("p"."gasto") AS "avg"
                   FROM "base" "p"
                  WHERE (("p"."account" = "b"."account") AND ("p"."date" >= ("b"."date" - 7)) AND ("p"."date" <= ("b"."date" - 1)))) AS "gasto_media7",
            ( SELECT "stddev_samp"("p"."gasto") AS "stddev_samp"
                   FROM "base" "p"
                  WHERE (("p"."account" = "b"."account") AND ("p"."date" >= ("b"."date" - 7)) AND ("p"."date" <= ("b"."date" - 1)))) AS "gasto_sd7_raw",
            ( SELECT "count"(*) AS "count"
                   FROM "base" "p"
                  WHERE (("p"."account" = "b"."account") AND ("p"."date" >= ("b"."date" - 7)) AND ("p"."date" <= ("b"."date" - 1)) AND ("p"."cpa" IS NOT NULL))) AS "n_cpa",
            ( SELECT "avg"("p"."cpa") AS "avg"
                   FROM "base" "p"
                  WHERE (("p"."account" = "b"."account") AND ("p"."date" >= ("b"."date" - 7)) AND ("p"."date" <= ("b"."date" - 1)) AND ("p"."cpa" IS NOT NULL))) AS "cpa_media7",
            ( SELECT "stddev_samp"("p"."cpa") AS "stddev_samp"
                   FROM "base" "p"
                  WHERE (("p"."account" = "b"."account") AND ("p"."date" >= ("b"."date" - 7)) AND ("p"."date" <= ("b"."date" - 1)) AND ("p"."cpa" IS NOT NULL))) AS "cpa_sd7_raw",
            ( SELECT "p"."gasto"
                   FROM "base" "p"
                  WHERE (("p"."account" = "b"."account") AND ("p"."date" = ("b"."date" - 7)))) AS "gasto_mismo_dia_sem_prev",
            ( SELECT "p"."cpa"
                   FROM "base" "p"
                  WHERE (("p"."account" = "b"."account") AND ("p"."date" = ("b"."date" - 7)))) AS "cpa_mismo_dia_sem_prev"
           FROM "base" "b"
        ), "calc" AS (
         SELECT "v"."account",
            "v"."date",
            "v"."gasto",
            "v"."conversiones",
            "v"."cpa",
            "v"."ctr",
            "v"."clics",
            "v"."madurez",
            "v"."dow",
            "v"."n_base",
            "v"."gasto_media7",
            "v"."gasto_sd7_raw",
            "v"."n_cpa",
            "v"."cpa_media7",
            "v"."cpa_sd7_raw",
            "v"."gasto_mismo_dia_sem_prev",
            "v"."cpa_mismo_dia_sem_prev",
                CASE
                    WHEN (("v"."n_base" >= 4) AND ("v"."gasto_media7" > (0)::numeric)) THEN (("v"."gasto" - "v"."gasto_media7") / GREATEST(COALESCE("v"."gasto_sd7_raw", (0)::numeric), ("v"."gasto_media7" * 0.15)))
                    ELSE NULL::numeric
                END AS "gz",
                CASE
                    WHEN (("v"."n_cpa" >= 4) AND ("v"."cpa" IS NOT NULL) AND ("v"."cpa_media7" > (0)::numeric)) THEN (("v"."cpa" - "v"."cpa_media7") / GREATEST(COALESCE("v"."cpa_sd7_raw", (0)::numeric), ("v"."cpa_media7" * 0.15)))
                    ELSE NULL::numeric
                END AS "cz"
           FROM "ventana" "v"
        )
 SELECT "account",
    "date",
    "dow",
    "madurez",
    "n_base" AS "dias_en_baseline",
    "gasto",
    "conversiones",
    "cpa",
    "ctr",
    "clics",
    "round"("gasto_media7", 2) AS "gasto_baseline",
    "round"("cpa_media7", 2) AS "cpa_baseline",
    "gasto_mismo_dia_sem_prev",
    "cpa_mismo_dia_sem_prev",
    "round"("gz", 2) AS "gasto_z",
    "round"("cz", 2) AS "cpa_z",
        CASE
            WHEN ("gasto_mismo_dia_sem_prev" > (0)::numeric) THEN "round"(((("gasto" - "gasto_mismo_dia_sem_prev") / "gasto_mismo_dia_sem_prev") * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS "gasto_vs_sem_prev_pct",
        CASE
            WHEN (("cpa_mismo_dia_sem_prev" > (0)::numeric) AND ("cpa" IS NOT NULL)) THEN "round"(((("cpa" - "cpa_mismo_dia_sem_prev") / "cpa_mismo_dia_sem_prev") * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS "cpa_vs_sem_prev_pct",
        CASE
            WHEN ("n_base" < 4) THEN 'sin baseline'::"text"
            WHEN ("abs"(COALESCE("gz", (0)::numeric)) >= (3)::numeric) THEN 'critica'::"text"
            WHEN (("madurez" <> 'provisional'::"text") AND ("abs"(COALESCE("cz", (0)::numeric)) >= (3)::numeric)) THEN 'critica'::"text"
            WHEN ("abs"(COALESCE("gz", (0)::numeric)) >= (2)::numeric) THEN 'alta'::"text"
            WHEN (("madurez" <> 'provisional'::"text") AND ("abs"(COALESCE("cz", (0)::numeric)) >= (2)::numeric)) THEN 'alta'::"text"
            WHEN ("abs"(COALESCE("gz", (0)::numeric)) >= 1.5) THEN 'media'::"text"
            WHEN (("madurez" <> 'provisional'::"text") AND ("abs"(COALESCE("cz", (0)::numeric)) >= 1.5)) THEN 'media'::"text"
            ELSE 'normal'::"text"
        END AS "severidad",
        CASE
            WHEN (("abs"(COALESCE("gz", (0)::numeric)) >= (2)::numeric) AND ("madurez" <> 'provisional'::"text") AND ("abs"(COALESCE("cz", (0)::numeric)) >= (2)::numeric)) THEN 'gasto y cpa'::"text"
            WHEN ("abs"(COALESCE("gz", (0)::numeric)) >= (2)::numeric) THEN 'gasto'::"text"
            WHEN (("madurez" <> 'provisional'::"text") AND ("abs"(COALESCE("cz", (0)::numeric)) >= (2)::numeric)) THEN 'cpa'::"text"
            ELSE NULL::"text"
        END AS "metrica_anomala",
        CASE
            WHEN ("gz" > (0)::numeric) THEN 'sube'::"text"
            WHEN ("gz" < (0)::numeric) THEN 'baja'::"text"
            ELSE NULL::"text"
        END AS "gasto_direccion",
        CASE
            WHEN ("cz" > (0)::numeric) THEN 'sube'::"text"
            WHEN ("cz" < (0)::numeric) THEN 'baja'::"text"
            ELSE NULL::"text"
        END AS "cpa_direccion",
        CASE
            WHEN (("madurez" = 'provisional'::"text") AND ("abs"(COALESCE("cz", (0)::numeric)) >= (2)::numeric)) THEN 'El CPA de este dia parece anomalo pero el dia todavia madura: las conversiones siguen entrando y el gasto ya es final. NO abrir accionable por CPA hasta que consolide.'::"text"
            WHEN (("madurez" = 'provisional'::"text") AND ("abs"(COALESCE("gz", (0)::numeric)) >= (2)::numeric)) THEN 'Dia provisional, PERO el gasto ya es definitivo y esta fuera de rango: esto SI merece mirarse hoy, que es cuando todavia se puede actuar.'::"text"
            ELSE NULL::"text"
        END AS "lectura_de_madurez"
   FROM "calc";


ALTER VIEW "public"."v_anomalias_diarias" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_anomalias_diarias" IS 'Tickets 34 y 36. La regla de madurez se aplica POR METRICA: el gasto de ayer ya es definitivo y se juzga siempre; el CPA solo cuando el dia consolido, porque antes divide gasto completo por conversiones incompletas. Antes un CASE evaluaba provisional primero y los dos unicos dias en los que se puede actuar eran invisibles.';



CREATE OR REPLACE VIEW "public"."v_anomalia_explicada" WITH ("security_invoker"='on') AS
 WITH "cambios_dia" AS (
         SELECT "change_events"."account",
            (SUBSTRING("change_events"."change_datetime" FROM 1 FOR 10))::"date" AS "fecha",
            "min"(SUBSTRING("change_events"."change_datetime" FROM 12 FOR 5)) AS "primera_hora",
            "count"(*) AS "n",
            "bool_or"((("change_events"."client_type" ~~ '%RECOMMENDATION%'::"text") OR ("change_events"."client_type" ~~ '%GOOGLE_FIRST_PARTY%'::"text"))) AS "automatico"
           FROM "public"."change_events"
          WHERE ("change_events"."change_datetime" IS NOT NULL)
          GROUP BY "change_events"."account", (SUBSTRING("change_events"."change_datetime" FROM 1 FOR 10))::"date"
        ), "op_dia" AS (
         SELECT "operator_log"."account",
            "operator_log"."fecha",
            ("min"("operator_log"."hora"))::"text" AS "primera_hora",
            "count"(*) AS "n"
           FROM "public"."operator_log"
          GROUP BY "operator_log"."account", "operator_log"."fecha"
        )
 SELECT "a"."account",
    "a"."date",
    "a"."severidad",
    "a"."metrica_anomala",
    "a"."gasto_direccion",
    "a"."cpa_direccion",
    "a"."gasto_z",
    "a"."cpa_z",
    "a"."gasto",
    "a"."gasto_baseline",
    "a"."cpa",
    "a"."cpa_baseline",
    "a"."gasto_vs_sem_prev_pct",
    "a"."cpa_vs_sem_prev_pct",
    ( SELECT "c"."campaign"
           FROM "public"."campaign_daily" "c"
          WHERE (("c"."account" = "a"."account") AND ("c"."date" = "a"."date"))
          ORDER BY ("abs"(("c"."cost" - ( SELECT "avg"("p"."cost") AS "avg"
                   FROM "public"."campaign_daily" "p"
                  WHERE (("p"."account" = "c"."account") AND ("p"."campaign" = "c"."campaign") AND (("p"."date" >= ("a"."date" - 7)) AND ("p"."date" <= ("a"."date" - 1)))))))) DESC NULLS LAST
         LIMIT 1) AS "campana_principal",
    COALESCE("cd"."n", (0)::bigint) AS "cambios_ese_dia",
    "cd"."primera_hora" AS "hora_primer_cambio",
    COALESCE("cd"."automatico", false) AS "hubo_cambio_automatico",
    COALESCE("od"."n", (0)::bigint) AS "cambios_operador_ese_dia",
        CASE
            WHEN "cd"."automatico" THEN (('Cambio automático de Google ese día ('::"text" || "cd"."primera_hora") || ')'::"text")
            WHEN (("cd"."n" > 0) AND ("cd"."primera_hora" < '12:00'::"text")) THEN (('Cambio propio a las '::"text" || "cd"."primera_hora") || ': puede explicar el día'::"text")
            WHEN (("cd"."n" > 0) AND ("cd"."primera_hora" >= '18:00'::"text")) THEN (('Cambio propio a las '::"text" || "cd"."primera_hora") || ': demasiado tarde para causar el día. Más probable: reacción a lo que pasó'::"text")
            WHEN ("cd"."n" > 0) THEN (('Cambio propio a las '::"text" || "cd"."primera_hora") || ': explica parte del día, no todo'::"text")
            WHEN ("od"."n" > 0) THEN (('Andrés registró '::"text" || "od"."n") || ' cambio(s) en operator_log ese día. Ver el motivo ahí'::"text")
            WHEN (("a"."gasto_vs_sem_prev_pct" IS NOT NULL) AND ("abs"("a"."gasto_vs_sem_prev_pct") < (25)::numeric)) THEN 'Similar al mismo día de la semana previa: patrón semanal, no anomalía'::"text"
            ELSE 'Sin cambios registrados ese día. Siguiente paso: operator_log y v_cambios_detectados, no "fue el mercado"'::"text"
        END AS "explicacion"
   FROM (("public"."v_anomalias_diarias" "a"
     LEFT JOIN "cambios_dia" "cd" ON ((("cd"."account" = "a"."account") AND ("cd"."fecha" = "a"."date"))))
     LEFT JOIN "op_dia" "od" ON ((("od"."account" = "a"."account") AND ("od"."fecha" = "a"."date"))))
  WHERE ("a"."severidad" = ANY (ARRAY['media'::"text", 'alta'::"text", 'critica'::"text"]));


ALTER VIEW "public"."v_anomalia_explicada" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_anomalia_explicada" IS 'Dias anomalos con explicacion que considera la HORA del primer cambio. Un cambio despues de las 18:00 no puede causar el dia: es mas probable reaccion. Detectado por la tarea de BHI el 6 sep 2026. Si dice "sin cambios registrados", el siguiente paso es operator_log y v_cambios_detectados.';



CREATE OR REPLACE VIEW "public"."v_bhi_campaign" WITH ("security_invoker"='on') AS
 SELECT "week_start",
    "week_end",
    "campaign",
    "status",
    "bid_strategy",
    "currency",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "cost",
    "conversions",
    "all_conversions",
    "cost_per_conv",
    "conv_rate",
    "impr_share",
    "lost_is_budget",
    "lost_is_rank"
   FROM "public"."campaign"
  WHERE ("account" = 'BHI'::"text");


ALTER VIEW "public"."v_bhi_campaign" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_bhi_campaign" IS 'Campanas de BHI. Las conversiones de Google NO son la fuente de verdad del negocio: las solicitudes reales, el pipeline y los cierres viven en GoHighLevel, que esta base no lee. Nunca presentar estas cifras como solicitudes reales. lost_is_budget alto significa que subir presupuesto SI genera volumen, pero a un costo por conversion 55% mayor.';



CREATE OR REPLACE VIEW "public"."v_brecha_objetivo" WITH ("security_invoker"='true') AS
 WITH "sem" AS (
         SELECT "campaign"."account",
            "sum"("campaign"."conversions") AS "conv",
            "sum"("campaign"."cost") AS "gasto",
            "count"(DISTINCT "campaign"."week_start") AS "semanas"
           FROM "public"."campaign"
          WHERE ("campaign"."week_start" >= (( SELECT "max"("campaign_1"."week_start") AS "max"
                   FROM "public"."campaign" "campaign_1") - 21))
          GROUP BY "campaign"."account"
        ), "actual" AS (
         SELECT "sem"."account",
            (("sem"."conv" * 30.0) / (("sem"."semanas" * 7))::numeric) AS "conv_mes",
            ("sem"."gasto" / NULLIF("sem"."conv", (0)::numeric)) AS "cpa",
            "sem"."semanas"
           FROM "sem"
        )
 SELECT "t"."account",
    "t"."conversiones_mes_objetivo" AS "conv_mes_objetivo",
    "t"."conv_mes_objetivo_90d",
    "t"."objetivo_90d_desde",
    "t"."cpa_maximo",
    "round"("a"."conv_mes", 1) AS "conv_mes_actual",
    "round"("a"."cpa", 2) AS "cpa_actual",
    "a"."semanas" AS "semanas_base",
    "round"((COALESCE("t"."conv_mes_objetivo_90d", "t"."conversiones_mes_objetivo") - "a"."conv_mes"), 1) AS "brecha_conv_mes",
        CASE
            WHEN ("t"."objetivo_90d_desde" IS NOT NULL) THEN (("t"."objetivo_90d_desde" + 90) - CURRENT_DATE)
            ELSE NULL::integer
        END AS "dias_restantes",
        CASE
            WHEN ("a"."conv_mes" >= COALESCE("t"."conv_mes_objetivo_90d", "t"."conversiones_mes_objetivo")) THEN 'Objetivo alcanzado: subir la ambicion'::"text"
            WHEN ("a"."cpa" > "t"."cpa_maximo") THEN 'CPA sobre el maximo: primero bajar costo, despues volumen'::"text"
            WHEN ((COALESCE("t"."conv_mes_objetivo_90d", "t"."conversiones_mes_objetivo") - "a"."conv_mes") > ("a"."conv_mes" * 0.5)) THEN 'Brecha grande (>50%): no se cierra optimizando; hace falta algo estructural (campana, canal, embudo)'::"text"
            ELSE 'Brecha cerrable con optimizacion: escalar lo que funciona'::"text"
        END AS "lectura"
   FROM ("public"."account_targets" "t"
     LEFT JOIN "actual" "a" ON (("a"."account" = "t"."account")));


ALTER VIEW "public"."v_brecha_objetivo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_calibracion" WITH ("security_invoker"='true') AS
 WITH "e" AS (
         SELECT "predicciones"."id",
            "predicciones"."account",
            "predicciones"."semana",
            "predicciones"."metrica",
            "predicciones"."valor_min",
            "predicciones"."valor_max",
            "predicciones"."probabilidad",
            "predicciones"."razonamiento",
            "predicciones"."escrita_el",
            "predicciones"."escrita_por",
            "predicciones"."valor_real",
            "predicciones"."acerto",
            "predicciones"."evaluada_el"
           FROM "public"."predicciones"
          WHERE ("predicciones"."acerto" IS NOT NULL)
        )
 SELECT "account",
    "metrica",
    "count"(*) AS "n",
    "sum"(
        CASE
            WHEN "acerto" THEN 1
            ELSE 0
        END) AS "aciertos",
    "round"(("avg"("probabilidad") * (100)::numeric)) AS "confianza_prometida_pct",
    "round"(("avg"(
        CASE
            WHEN "acerto" THEN 1
            ELSE 0
        END) * (100)::numeric)) AS "acierto_real_pct",
        CASE
            WHEN ("count"(*) < 4) THEN 'Pocas predicciones todavía'::"text"
            WHEN ("avg"(
            CASE
                WHEN "acerto" THEN 1
                ELSE 0
            END) >= ("avg"("probabilidad") - 0.1)) THEN 'Calibrado: acierta lo que promete'::"text"
            WHEN ("avg"(
            CASE
                WHEN "acerto" THEN 1
                ELSE 0
            END) < ("avg"("probabilidad") - 0.2)) THEN 'Sobreconfiado: promete más de lo que acierta'::"text"
            ELSE 'Ligeramente sobreconfiado'::"text"
        END AS "veredicto"
   FROM "e"
  GROUP BY "account", "metrica";


ALTER VIEW "public"."v_calibracion" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_calibracion_global" WITH ("security_invoker"='true') AS
 SELECT "count"(*) AS "n",
    "sum"(
        CASE
            WHEN "acerto" THEN 1
            ELSE 0
        END) AS "aciertos",
    "round"(("avg"("probabilidad") * (100)::numeric)) AS "prometido_pct",
    "round"(("avg"(
        CASE
            WHEN "acerto" THEN 1
            ELSE 0
        END) * (100)::numeric)) AS "real_pct"
   FROM "public"."predicciones"
  WHERE ("acerto" IS NOT NULL);


ALTER VIEW "public"."v_calibracion_global" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_cambios_detectados" WITH ("security_invoker"='on') AS
 WITH "ordenado" AS (
         SELECT "config_snapshot"."id",
            "config_snapshot"."account",
            "config_snapshot"."snapshot_date",
            "config_snapshot"."entity_type",
            "config_snapshot"."entity_name",
            "config_snapshot"."config",
            "config_snapshot"."config_hash",
            "config_snapshot"."run_ts",
            "lag"("config_snapshot"."config") OVER (PARTITION BY "config_snapshot"."account", "config_snapshot"."entity_type", "config_snapshot"."entity_name" ORDER BY "config_snapshot"."snapshot_date") AS "config_previa",
            "lag"("config_snapshot"."config_hash") OVER (PARTITION BY "config_snapshot"."account", "config_snapshot"."entity_type", "config_snapshot"."entity_name" ORDER BY "config_snapshot"."snapshot_date") AS "hash_previo",
            "lag"("config_snapshot"."snapshot_date") OVER (PARTITION BY "config_snapshot"."account", "config_snapshot"."entity_type", "config_snapshot"."entity_name" ORDER BY "config_snapshot"."snapshot_date") AS "fecha_previa"
           FROM "public"."config_snapshot"
        )
 SELECT "account",
    "entity_type",
    "entity_name",
    "fecha_previa" AS "detectado_entre",
    "snapshot_date" AS "detectado_hasta",
    ( SELECT "jsonb_object_agg"("k"."k", "jsonb_build_object"('antes', ("ordenado"."config_previa" -> "k"."k"), 'despues', ("ordenado"."config" -> "k"."k"))) AS "jsonb_object_agg"
           FROM "jsonb_object_keys"("ordenado"."config") "k"("k")
          WHERE (("ordenado"."config_previa" -> "k"."k") IS DISTINCT FROM ("ordenado"."config" -> "k"."k"))) AS "campos_cambiados"
   FROM "ordenado"
  WHERE (("hash_previo" IS NOT NULL) AND ("hash_previo" <> "config_hash"));


ALTER VIEW "public"."v_cambios_detectados" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_cambios_detectados" IS 'Cambios de configuracion detectados por diferencia entre snapshots diarios. Cubre lo que change_event no ve. detectado_entre y detectado_hasta acotan la ventana: el cambio ocurrio en algun momento entre esas dos fechas. campos_cambiados trae solo las claves que difieren, con valor anterior y posterior.';



CREATE OR REPLACE VIEW "public"."v_cambios_fuera_del_log" WITH ("security_invoker"='on') AS
 SELECT "account",
    "entity_type",
    "entity_name",
    "detectado_entre",
    "detectado_hasta",
    "campos_cambiados"
   FROM "public"."v_cambios_detectados" "d"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."change_events" "c"
          WHERE (("c"."account" = "d"."account") AND (((SUBSTRING("c"."change_datetime" FROM 1 FOR 10))::"date" >= "d"."detectado_entre") AND ((SUBSTRING("c"."change_datetime" FROM 1 FOR 10))::"date" <= "d"."detectado_hasta")) AND ("c"."resource_type" = "upper"("d"."entity_type"))))));


ALTER VIEW "public"."v_cambios_fuera_del_log" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_cambios_fuera_del_log" IS 'Cambios detectados por snapshot que change_event no tiene. Cualquier discrepancia entre "lo que dice el registro" y "lo que muestra la cuenta" se explica mirando aca ANTES de inferir bugs o fuentes fantasma.';



CREATE OR REPLACE VIEW "public"."v_cambios_invisibles_para_google" WITH ("security_invoker"='on') AS
 SELECT "id",
    "account",
    "fecha",
    "hora",
    "que_cambio",
    "donde",
    "valor_anterior",
    "valor_nuevo",
    "por_que",
    "accionable_notion_id",
    "created_at"
   FROM "public"."operator_log" "o"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."change_events" "c"
          WHERE (("c"."account" = "o"."account") AND ((SUBSTRING("c"."change_datetime" FROM 1 FOR 10))::"date" = "o"."fecha")))));


ALTER VIEW "public"."v_cambios_invisibles_para_google" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_cambios_invisibles_para_google" IS 'Cambios que Andres registro y que change_events no tiene ese dia. Son exactamente los que producen discrepancias entre "lo que dice el registro" y "lo que muestra la pantalla". Antes de concluir que hay un bug o una fuente fantasma, mirar aca.';



CREATE OR REPLACE VIEW "public"."v_cambios_para_cruce" WITH ("security_invoker"='on') AS
 SELECT "account",
    (SUBSTRING("change_datetime" FROM 1 FOR 10))::"date" AS "fecha",
    SUBSTRING("change_datetime" FROM 12 FOR 8) AS "hora",
    "resource_type",
    "operation",
    "entity_name",
    "campaign_name",
    "ad_group_name",
    "changed_field",
    "old_value",
    "new_value",
    "user_email",
    (("client_type" ~~ '%RECOMMENDATION%'::"text") OR ("client_type" ~~ '%GOOGLE_FIRST_PARTY%'::"text")) AS "automatico",
        CASE
            WHEN (("changed_field" = 'status'::"text") AND ("new_value" = 'PAUSED'::"text")) THEN (((('Pauso '::"text" || "lower"("resource_type")) || ' "'::"text") || COALESCE("entity_name", '?'::"text")) || '"'::"text")
            WHEN (("changed_field" = 'status'::"text") AND ("new_value" = 'ENABLED'::"text")) THEN (((('Activo '::"text" || "lower"("resource_type")) || ' "'::"text") || COALESCE("entity_name", '?'::"text")) || '"'::"text")
            WHEN ("operation" = 'CREATE'::"text") THEN (((('Creo '::"text" || "lower"("resource_type")) || ' "'::"text") || COALESCE("entity_name", "new_value", '?'::"text")) || '"'::"text")
            WHEN ("operation" = 'REMOVE'::"text") THEN (((('Elimino '::"text" || "lower"("resource_type")) || ' "'::"text") || COALESCE("entity_name", '?'::"text")) || '"'::"text")
            WHEN (("changed_field" ~~ '%target_cpa%'::"text") OR ("changed_field" ~~ '%targetCpa%'::"text")) THEN ((((('Cambio tCPA de "'::"text" || COALESCE("entity_name", '?'::"text")) || '": '::"text") || COALESCE("old_value", '?'::"text")) || ' -> '::"text") || COALESCE("new_value", '?'::"text"))
            WHEN (("changed_field" ~~ '%budget%'::"text") OR ("changed_field" ~~ '%amount%'::"text")) THEN ((((('Cambio presupuesto de "'::"text" || COALESCE("entity_name", '?'::"text")) || '": '::"text") || COALESCE("old_value", '?'::"text")) || ' -> '::"text") || COALESCE("new_value", '?'::"text"))
            ELSE ((((('Modifico '::"text" || COALESCE("changed_field", '(campo no registrado)'::"text")) || ' de "'::"text") || COALESCE("entity_name", '?'::"text")) || '"'::"text") ||
            CASE
                WHEN (("old_value" IS NOT NULL) OR ("new_value" IS NOT NULL)) THEN (((': '::"text" || COALESCE("old_value", '?'::"text")) || ' -> '::"text") || COALESCE("new_value", '?'::"text"))
                ELSE ''::"text"
            END)
        END AS "descripcion"
   FROM "public"."change_events"
  WHERE ("change_datetime" IS NOT NULL);


ALTER VIEW "public"."v_cambios_para_cruce" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_cambios_para_cruce" IS 'Cada cambio con su entidad nombrada y una descripcion en una linea. Es la vista que la tarea semanal usa para decidir si un accionable se ejecuto: compara descripcion y entity_name con el texto del accionable. Si entity_name es null, el script no pudo resolverlo y el cruce debe hacerse por campana y grupo.';



CREATE OR REPLACE VIEW "public"."v_cambios_recientes" AS
 SELECT "cuando",
    "que",
    "por_que",
    "objetos",
    "version",
    "revierte_como",
    NULL::"text" AS "account"
   FROM "public"."cambios_de_sistema" "c"
  WHERE ("cuando" >= ("now"() - '7 days'::interval))
  ORDER BY "cuando" DESC;


ALTER VIEW "public"."v_cambios_recientes" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_cambios_recientes" IS 'Cambios de sistema de los ultimos 7 dias, de cambios_de_sistema. account es siempre null: son cambios globales y no pertenecen a una cuenta. La columna existe solo para que .eq(account, cliente) devuelva vacio en vez de reventar la consulta, que era el error mas frecuente de produccion hoy, 19 veces.';



CREATE OR REPLACE VIEW "public"."v_campaign_analisis" WITH ("security_invoker"='on') AS
 SELECT "account",
    "week_start",
    "week_end",
    "campaign",
    "status",
    "channel",
    "bid_strategy",
    "currency",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "avg_cpm",
    "cost",
    "conversions",
    "cost_per_conv",
    "conv_rate",
    "impr_share",
    "top_impr_share",
    "abs_top_impr_share",
    "lost_is_budget",
    "lost_is_rank",
    "click_share",
        CASE
            WHEN ("lost_is_budget" > "lost_is_rank") THEN 'presupuesto'::"text"
            ELSE 'ranking'::"text"
        END AS "limitada_por"
   FROM "public"."campaign";


ALTER VIEW "public"."v_campaign_analisis" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_campaign_analisis" IS 'Campanas de todas las cuentas para la interfaz. No expone conv_value, all_conversions ni roas: no son confiables en ninguna cuenta. La columna limitada_por dice si la restriccion principal es presupuesto o ad rank, que determina si subir presupuesto sirve o no.';



CREATE OR REPLACE VIEW "public"."v_campaign_daily" WITH ("security_invoker"='on') AS
 SELECT "account",
    "date",
    "campaign",
    "status",
    "channel",
    "bid_strategy",
    "currency",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "avg_cpm",
    "cost",
    "conversions",
    "cost_per_conv",
    "conv_rate",
    "impr_share",
    "top_impr_share",
    "abs_top_impr_share",
    "lost_is_budget",
    "lost_is_rank",
    "click_share",
        CASE
            WHEN ("lost_is_budget" > "lost_is_rank") THEN 'presupuesto'::"text"
            ELSE 'ranking'::"text"
        END AS "limitada_por",
    "public"."madurez_dato"("date") AS "madurez",
    (CURRENT_DATE - "date") AS "dias_transcurridos",
    (EXTRACT(isodow FROM "date"))::integer AS "dia_semana",
    "to_char"(("date")::timestamp with time zone, 'TMDay'::"text") AS "nombre_dia"
   FROM "public"."campaign_daily";


ALTER VIEW "public"."v_campaign_daily" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_campaign_daily" IS 'Campanas por dia con marca de madurez. Al analizar, filtrar madurez = consolidado para conclusiones sobre conversiones; los dias provisionales sirven para vigilar gasto, no para juzgar rendimiento.';



CREATE OR REPLACE VIEW "public"."v_campana_resuelta" WITH ("security_invoker"='true') AS
 SELECT "c"."account",
    "c"."week_start",
    "c"."campaign",
    "c"."cost",
    "c"."clicks",
    "c"."impressions",
    "c"."conversions",
    "c"."conv_value",
    "d"."location",
    COALESCE("d"."objetivo", 'generico'::"text") AS "objetivo",
    "d"."tipo_campana" AS "tipo"
   FROM ("public"."campaign" "c"
     LEFT JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "c"."account") AND ("d"."campaign" = "c"."campaign"))));


ALTER VIEW "public"."v_campana_resuelta" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_campanas_sin_dim" WITH ("security_invoker"='true') AS
 SELECT "c"."account",
    "c"."campaign",
    "round"("sum"("c"."cost"), 2) AS "gasto",
    "max"("c"."week_start") AS "ultima_semana"
   FROM ("public"."campaign" "c"
     LEFT JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "c"."account") AND ("d"."campaign" = "c"."campaign"))))
  WHERE ("d"."campaign" IS NULL)
  GROUP BY "c"."account", "c"."campaign"
 HAVING ("sum"("c"."cost") > (0)::numeric);


ALTER VIEW "public"."v_campanas_sin_dim" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_candidatos_con_evidencia" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."objeto",
    "c"."tipo",
    "c"."estado",
    "c"."observar_hasta",
    "c"."lecturas_al_marcar",
    ((COALESCE("s"."seq_scan", (0)::bigint) + COALESCE("s"."idx_scan", (0)::bigint)) - COALESCE("c"."lecturas_al_marcar", (0)::bigint)) AS "lecturas_desde_que_se_marco",
    (CURRENT_DATE >= "c"."observar_hasta") AS "observacion_completa",
    "c"."quien_lo_usa",
    "c"."que_se_pierde",
    "c"."como_volver",
        CASE
            WHEN ("c"."estado" <> 'observando'::"text") THEN ('Ya decidido: '::"text" || "c"."estado")
            WHEN (CURRENT_DATE < "c"."observar_hasta") THEN (('Faltan '::"text" || ("c"."observar_hasta" - CURRENT_DATE)) || ' dias de observacion. No sacar todavia.'::"text")
            WHEN (((COALESCE("s"."seq_scan", (0)::bigint) + COALESCE("s"."idx_scan", (0)::bigint)) - COALESCE("c"."lecturas_al_marcar", (0)::bigint)) > 50) THEN (('SE SIGUE USANDO: '::"text" || ((COALESCE("s"."seq_scan", (0)::bigint) + COALESCE("s"."idx_scan", (0)::bigint)) - COALESCE("c"."lecturas_al_marcar", (0)::bigint))) || ' lecturas desde que se marco. Indultar.'::"text")
            WHEN ("c"."quien_lo_usa" <> '(nadie que se detecte)'::"text") THEN (('Sin lecturas nuevas, pero lo tocan: '::"text" || "c"."quien_lo_usa") || '. Revisar esos objetos antes de sacar.'::"text")
            ELSE 'Listo para pasar a sombra: sin lecturas nuevas y sin dependencias detectadas.'::"text"
        END AS "veredicto"
   FROM ("public"."candidatos_a_retiro" "c"
     LEFT JOIN "pg_stat_user_tables" "s" ON (("s"."relname" = "c"."objeto")));


ALTER VIEW "public"."v_candidatos_con_evidencia" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_carteras_puja" WITH ("security_invoker"='true') AS
 SELECT "d"."account",
    "d"."objetivo",
        CASE
            WHEN ("c"."bid_strategy" ~~* '%value%'::"text") THEN 'maximizar valor'::"text"
            WHEN ("c"."bid_strategy" ~~* '%conversion%'::"text") THEN 'maximizar conversiones'::"text"
            WHEN (("c"."bid_strategy" ~~* '%clicks%'::"text") OR ("c"."bid_strategy" ~~* '%spend%'::"text")) THEN 'maximizar clics'::"text"
            ELSE COALESCE(NULLIF("c"."bid_strategy", ''::"text"), 'sin definir'::"text")
        END AS "estrategia",
    "count"(DISTINCT "c"."campaign") AS "campanas",
    "round"("sum"("c"."cost"), 2) AS "gasto",
    "round"("sum"("c"."conversions"), 1) AS "conversiones",
    "round"(("sum"("c"."cost") / NULLIF("sum"("c"."conversions"), (0)::numeric)), 2) AS "cpa"
   FROM ("public"."campaign" "c"
     JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "c"."account") AND ("d"."campaign" = "c"."campaign"))))
  WHERE ("c"."week_start" > (( SELECT "max"("x"."week_start") AS "max"
           FROM "public"."campaign" "x"
          WHERE ("x"."account" = "c"."account")) - 28))
  GROUP BY "d"."account", "d"."objetivo",
        CASE
            WHEN ("c"."bid_strategy" ~~* '%value%'::"text") THEN 'maximizar valor'::"text"
            WHEN ("c"."bid_strategy" ~~* '%conversion%'::"text") THEN 'maximizar conversiones'::"text"
            WHEN (("c"."bid_strategy" ~~* '%clicks%'::"text") OR ("c"."bid_strategy" ~~* '%spend%'::"text")) THEN 'maximizar clics'::"text"
            ELSE COALESCE(NULLIF("c"."bid_strategy", ''::"text"), 'sin definir'::"text")
        END;


ALTER VIEW "public"."v_carteras_puja" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_carteras_puja" IS 'Campanas por objetivo y estrategia de puja. Mezclar estrategias dentro de un objetivo hace que el CPA promedio no signifique nada.';



CREATE OR REPLACE VIEW "public"."v_change_annotations" WITH ("security_invoker"='on') AS
 SELECT "account",
    SUBSTRING("change_datetime" FROM 1 FOR 10) AS "fecha",
    "count"(*) AS "cantidad_cambios",
    "bool_or"(("client_type" ~~ '%RECOMMENDATION%'::"text")) AS "incluye_auto_google",
    "string_agg"(DISTINCT "resource_type", ', '::"text") AS "recursos_tocados",
    "string_agg"(DISTINCT "changed_field", ', '::"text") AS "campos_tocados"
   FROM "public"."change_events"
  WHERE ("change_datetime" IS NOT NULL)
  GROUP BY "account", (SUBSTRING("change_datetime" FROM 1 FOR 10));


ALTER VIEW "public"."v_change_annotations" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_change_annotations" IS 'Cambios por dia y cuenta, para dibujar marcadores sobre los graficos de tendencia. incluye_auto_google marca los dias en que Google aplico algo por su cuenta: esos siempre requieren revision.';



CREATE OR REPLACE VIEW "public"."v_cierres_totales" WITH ("security_invoker"='on') AS
 SELECT "true_roas_events"."client",
    'atribuido'::"text" AS "tipo",
    "true_roas_events"."external_id",
    "true_roas_events"."monto",
    "true_roas_events"."event_date",
    "true_roas_events"."click_id_type" AS "identificador"
   FROM "public"."true_roas_events"
UNION ALL
 SELECT "cierres_sin_atribucion"."client",
    'sin atribucion'::"text" AS "tipo",
    "cierres_sin_atribucion"."external_id",
    "cierres_sin_atribucion"."monto",
    "cierres_sin_atribucion"."event_date",
    NULL::"text" AS "identificador"
   FROM "public"."cierres_sin_atribucion";


ALTER VIEW "public"."v_cierres_totales" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_cierres_totales" IS 'Todos los cierres, con y sin atribucion. La suma de la columna monto es el negocio real generado; solo la parte atribuida se puede vincular a una campana especifica.';



CREATE OR REPLACE VIEW "public"."v_cifras_sospechosas" AS
 SELECT "cuenta",
    "brief_id",
    "etiqueta",
    "valor" AS "publicado",
    "valor_recalculado" AS "recalculado",
    "veredicto",
    "detalle",
    "publicada_el",
    "publicada_por"
   FROM "public"."cifras_publicadas" "c"
  WHERE ("veredicto" = ANY (ARRAY['difiere'::"text", 'no_reproducible'::"text"]))
  ORDER BY "publicada_el" DESC;


ALTER VIEW "public"."v_cifras_sospechosas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_conversiones_diarias" WITH ("security_invoker"='on') AS
 SELECT "account",
    "date",
    "campaign",
    "conversion_action",
    "category",
    "currency",
    "conversions",
    "public"."madurez_dato"("date") AS "madurez",
    (CURRENT_DATE - "date") AS "dias_transcurridos"
   FROM "public"."conversion_actions_daily";


ALTER VIEW "public"."v_conversiones_diarias" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_conversiones_diarias" IS 'Conversiones primarias por dia y accion. No incluye secundarias a proposito.';



CREATE OR REPLACE VIEW "public"."v_conversiones_por_accion" WITH ("security_invoker"='on') AS
 SELECT "account",
    "week_start",
    "campaign",
    "conversion_action",
    "category",
    "conversions" AS "primarias",
    "all_conversions" AS "total_incluyendo_secundarias",
    "round"(("all_conversions" - "conversions"), 2) AS "solo_secundarias"
   FROM "public"."conversion_actions";


ALTER VIEW "public"."v_conversiones_por_accion" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_conversiones_por_accion" IS 'Conversiones desglosadas. La columna primarias es la que entrena Smart Bidding. total_incluyendo_secundarias suma eventos blandos y casi nunca es negocio real. En 360, reportar el total en vez de las primarias infla el numero 2,5 veces.';



CREATE OR REPLACE VIEW "public"."v_conversiones_por_grupo" WITH ("security_invoker"='on') AS
 SELECT "account",
    "date",
    "campaign",
    "ad_group",
    "conversion_action",
    "category",
    "conversions",
    "public"."madurez_dato"("date") AS "madurez"
   FROM "public"."conversion_actions_daily"
  WHERE ("ad_group" <> ''::"text");


ALTER VIEW "public"."v_conversiones_por_grupo" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_conversiones_por_grupo" IS 'Conversiones diarias por grupo de anuncios y accion. Se llena desde la corrida del script diario v3 en adelante; las filas anteriores no tienen grupo. Responde si un deterioro de conversiones es de un grupo especifico o de toda la cuenta.';



CREATE OR REPLACE VIEW "public"."v_corporativas" WITH ("security_invoker"='true') AS
 SELECT "c"."account",
    "c"."campaign",
    "d"."objetivo",
    "round"("sum"("c"."cost"), 2) AS "gasto",
    "round"("sum"("c"."conversions"), 1) AS "conversiones"
   FROM ("public"."campaign" "c"
     JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "c"."account") AND ("d"."campaign" = "c"."campaign"))))
  WHERE (("d"."location" IS NULL) AND ("c"."week_start" > (( SELECT "max"("x"."week_start") AS "max"
           FROM "public"."campaign" "x"
          WHERE ("x"."account" = "c"."account")) - 28)))
  GROUP BY "c"."account", "c"."campaign", "d"."objetivo";


ALTER VIEW "public"."v_corporativas" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_corporativas" IS 'Campana SIN local asignado: la paga la empresa, no un franquiciado. Se saca del ranking porque no compite en el mismo tablero.';



CREATE OR REPLACE VIEW "public"."v_cpa_marginal" WITH ("security_invoker"='on') AS
 WITH "ult" AS (
         SELECT "simulations"."account",
            "simulations"."campaign",
            "simulations"."sim_type",
            "max"("simulations"."run_ts") AS "run_ts"
           FROM "public"."simulations"
          WHERE ("simulations"."sim_type" = ANY (ARRAY['BUDGET'::"text", 'TARGET_CPA'::"text", 'TARGET_CPA_ADGROUP'::"text"]))
          GROUP BY "simulations"."account", "simulations"."campaign", "simulations"."sim_type"
        ), "curva" AS (
         SELECT "s"."account",
            "s"."campaign",
            "s"."sim_type",
            "s"."target_value" AS "escalon",
            "s"."est_conversions",
            "s"."est_cost",
            "lag"("s"."target_value") OVER (PARTITION BY "s"."account", "s"."campaign", "s"."sim_type" ORDER BY "s"."target_value") AS "esc_ant",
            "lag"("s"."est_conversions") OVER (PARTITION BY "s"."account", "s"."campaign", "s"."sim_type" ORDER BY "s"."target_value") AS "conv_ant",
            "lag"("s"."est_cost") OVER (PARTITION BY "s"."account", "s"."campaign", "s"."sim_type" ORDER BY "s"."target_value") AS "cost_ant"
           FROM ("public"."simulations" "s"
             JOIN "ult" "u" ON ((("u"."account" = "s"."account") AND ("u"."campaign" = "s"."campaign") AND ("u"."sim_type" = "s"."sim_type") AND ("u"."run_ts" = "s"."run_ts"))))
        ), "actual" AS (
         SELECT "budget_daily"."account",
            "budget_daily"."campaign",
            "max"("budget_daily"."daily_budget") AS "presupuesto_actual"
           FROM "public"."budget_daily"
          WHERE ("budget_daily"."date" >= (CURRENT_DATE - 7))
          GROUP BY "budget_daily"."account", "budget_daily"."campaign"
        ), "tcpa_actual" AS (
         SELECT "bid_targets"."account",
            (("bid_targets"."campaign" || ' › '::"text") || "bid_targets"."ad_group") AS "campaign",
            "max"("bid_targets"."target_cpa") AS "tcpa_actual"
           FROM "public"."bid_targets"
          WHERE ("bid_targets"."week_start" = ( SELECT "max"("bid_targets_1"."week_start") AS "max"
                   FROM "public"."bid_targets" "bid_targets_1"))
          GROUP BY "bid_targets"."account", "bid_targets"."campaign", "bid_targets"."ad_group"
        )
 SELECT "c"."account",
    "c"."campaign",
    "c"."sim_type",
    COALESCE("a"."presupuesto_actual", "t"."tcpa_actual") AS "presupuesto_actual",
    "c"."escalon",
    "round"(("c"."est_cost" / NULLIF("c"."est_conversions", (0)::numeric)), 0) AS "cpa_promedio_en_escalon",
        CASE
            WHEN (("c"."conv_ant" IS NOT NULL) AND ("c"."est_conversions" > "c"."conv_ant")) THEN "round"((("c"."est_cost" - "c"."cost_ant") / ("c"."est_conversions" - "c"."conv_ant")), 0)
            ELSE NULL::numeric
        END AS "cpa_marginal_desde_anterior",
    "round"(((("c"."est_cost" - "c"."cost_ant") / NULLIF(("c"."est_conversions" - "c"."conv_ant"), (0)::numeric)) / NULLIF(("c"."est_cost" / NULLIF("c"."est_conversions", (0)::numeric)), (0)::numeric)), 2) AS "ratio_marginal_sobre_promedio",
        CASE
            WHEN ("c"."escalon" <= COALESCE("a"."presupuesto_actual", "t"."tcpa_actual")) THEN 'actual o menor'::"text"
            WHEN ("c"."conv_ant" IS NULL) THEN 'primer escalón'::"text"
            WHEN ("c"."est_conversions" <= "c"."conv_ant") THEN 'SIN GANANCIA: más gasto, mismas conversiones'::"text"
            WHEN ((("c"."est_cost" - "c"."cost_ant") / NULLIF(("c"."est_conversions" - "c"."conv_ant"), (0)::numeric)) > ((2)::numeric * ("c"."est_cost" / NULLIF("c"."est_conversions", (0)::numeric)))) THEN 'SATURADA: el siguiente peso cuesta más del doble'::"text"
            WHEN ((("c"."est_cost" - "c"."cost_ant") / NULLIF(("c"."est_conversions" - "c"."conv_ant"), (0)::numeric)) > (1.3 * ("c"."est_cost" / NULLIF("c"."est_conversions", (0)::numeric)))) THEN 'RENDIMIENTO DECRECIENTE: marginal 30%+ sobre promedio'::"text"
            ELSE 'HEADROOM: el siguiente peso rinde parecido'::"text"
        END AS "lectura"
   FROM (("curva" "c"
     LEFT JOIN "actual" "a" ON ((("a"."account" = "c"."account") AND ("a"."campaign" = "c"."campaign"))))
     LEFT JOIN "tcpa_actual" "t" ON ((("t"."account" = "c"."account") AND ("t"."campaign" = "c"."campaign"))))
  ORDER BY "c"."account", "c"."campaign", "c"."sim_type", "c"."escalon";


ALTER VIEW "public"."v_cpa_marginal" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_cpa_marginal" IS 'Curva de rendimientos decrecientes por campana (BUDGET) o por grupo (TARGET_CPA_ADGROUP, script v8). cpa_marginal = cuanto cuesta cada conversion adicional al pasar al siguiente escalon. Si duplica al promedio, saturada.';



CREATE OR REPLACE VIEW "public"."v_leading_indicators_diarios" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "campaign_daily"."account",
            "campaign_daily"."date",
            "sum"("campaign_daily"."clicks") AS "clics",
            "sum"("campaign_daily"."impressions") AS "impresiones",
            "sum"("campaign_daily"."cost") AS "gasto",
            "sum"("campaign_daily"."conversions") AS "conversiones",
            "round"(("sum"("campaign_daily"."cost") / NULLIF("sum"("campaign_daily"."clicks"), (0)::numeric)), 4) AS "cpc",
            "round"((("sum"("campaign_daily"."conversions") / NULLIF("sum"("campaign_daily"."clicks"), (0)::numeric)) * (100)::numeric), 2) AS "conv_rate",
            "round"((("sum"("campaign_daily"."clicks") / NULLIF("sum"("campaign_daily"."impressions"), (0)::numeric)) * (100)::numeric), 2) AS "ctr",
            "round"(("sum"(("campaign_daily"."lost_is_budget" * "campaign_daily"."impressions")) / NULLIF("sum"("campaign_daily"."impressions"), (0)::numeric)), 1) AS "lost_is_budget",
            "round"(("sum"(("campaign_daily"."lost_is_rank" * "campaign_daily"."impressions")) / NULLIF("sum"("campaign_daily"."impressions"), (0)::numeric)), 1) AS "lost_is_rank"
           FROM "public"."campaign_daily"
          GROUP BY "campaign_daily"."account", "campaign_daily"."date"
        ), "terminos" AS (
         SELECT "s"."account",
            "s"."date",
            "count"(*) FILTER (WHERE ("p"."primera" = "s"."date")) AS "terminos_nuevos",
            "count"(*) AS "terminos_total"
           FROM ("public"."search_terms_daily" "s"
             JOIN ( SELECT "search_terms_daily"."account",
                    "search_terms_daily"."search_term",
                    "min"("search_terms_daily"."date") AS "primera"
                   FROM "public"."search_terms_daily"
                  GROUP BY "search_terms_daily"."account", "search_terms_daily"."search_term") "p" ON ((("p"."account" = "s"."account") AND ("p"."search_term" = "s"."search_term"))))
          WHERE ("s"."clicks" > (0)::numeric)
          GROUP BY "s"."account", "s"."date"
        ), "marginal" AS (
         SELECT "v_cpa_marginal"."account",
            "min"("v_cpa_marginal"."ratio_marginal_sobre_promedio") FILTER (WHERE ("v_cpa_marginal"."escalon" > "v_cpa_marginal"."presupuesto_actual")) AS "cpa_marginal_ratio"
           FROM "public"."v_cpa_marginal"
          GROUP BY "v_cpa_marginal"."account"
        )
 SELECT "b"."account",
    "b"."date",
    "public"."madurez_dato"("b"."date") AS "madurez",
    "b"."clics",
    "b"."impresiones",
    "b"."gasto",
    "b"."conversiones",
    "b"."cpc",
    "b"."conv_rate",
    "b"."ctr",
    "b"."lost_is_budget",
    "b"."lost_is_rank",
    "round"((((COALESCE("t"."terminos_nuevos", (0)::bigint))::numeric / (NULLIF("t"."terminos_total", 0))::numeric) * (100)::numeric), 1) AS "pct_terminos_nuevos",
    "m"."cpa_marginal_ratio" AS "cpa_marginal",
    "round"((("regr_slope"(("b"."clics")::double precision, (EXTRACT(epoch FROM "b"."date"))::double precision) OVER "w" * (86400)::double precision))::numeric, 2) AS "clics_tendencia_3d",
    "round"((("regr_slope"(("b"."conv_rate")::double precision, (EXTRACT(epoch FROM "b"."date"))::double precision) OVER "w" * (86400)::double precision))::numeric, 3) AS "conv_rate_tendencia_3d",
    "round"((("regr_slope"(("b"."cpc")::double precision, (EXTRACT(epoch FROM "b"."date"))::double precision) OVER "w" * (86400)::double precision))::numeric, 4) AS "cpc_tendencia_3d",
    "round"((("regr_slope"(("b"."lost_is_budget")::double precision, (EXTRACT(epoch FROM "b"."date"))::double precision) OVER "w" * (86400)::double precision))::numeric, 2) AS "lost_is_budget_tendencia_3d"
   FROM (("base" "b"
     LEFT JOIN "terminos" "t" ON ((("t"."account" = "b"."account") AND ("t"."date" = "b"."date"))))
     LEFT JOIN "marginal" "m" ON (("m"."account" = "b"."account")))
  WINDOW "w" AS (PARTITION BY "b"."account" ORDER BY "b"."date" ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
  ORDER BY "b"."account", "b"."date";


ALTER VIEW "public"."v_leading_indicators_diarios" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_leading_indicators_diarios" IS 'Drivers que se mueven antes que el CPA, por cuenta y dia, con tendencia de 3 dias. El diario los lee contra el plan.';



CREATE OR REPLACE VIEW "public"."v_correlacion_leading_lagging" WITH ("security_invoker"='true') AS
 WITH "li" AS (
         SELECT "v_leading_indicators_diarios"."account",
            "v_leading_indicators_diarios"."date",
            "v_leading_indicators_diarios"."madurez",
            "v_leading_indicators_diarios"."clics",
            "v_leading_indicators_diarios"."impresiones",
            "v_leading_indicators_diarios"."gasto",
            "v_leading_indicators_diarios"."conversiones",
            "v_leading_indicators_diarios"."cpc",
            "v_leading_indicators_diarios"."conv_rate",
            "v_leading_indicators_diarios"."ctr",
            "v_leading_indicators_diarios"."lost_is_budget",
            "v_leading_indicators_diarios"."lost_is_rank",
            "v_leading_indicators_diarios"."pct_terminos_nuevos",
            "v_leading_indicators_diarios"."cpa_marginal",
            "v_leading_indicators_diarios"."clics_tendencia_3d",
            "v_leading_indicators_diarios"."conv_rate_tendencia_3d",
            "v_leading_indicators_diarios"."cpc_tendencia_3d",
            "v_leading_indicators_diarios"."lost_is_budget_tendencia_3d"
           FROM "public"."v_leading_indicators_diarios"
          WHERE ("v_leading_indicators_diarios"."madurez" = 'consolidado'::"text")
        ), "pares" AS (
         SELECT "a"."account",
            "ind"."nombre",
            "lag_dias"."n" AS "lag_dias",
            "corr"(("ind"."valor")::double precision, ("b"."conversiones")::double precision) AS "r",
            "count"(*) AS "n_pares"
           FROM ((("li" "a"
             CROSS JOIN LATERAL ( VALUES ('clics'::"text","a"."clics"), ('conv_rate'::"text","a"."conv_rate"), ('impresiones'::"text","a"."impresiones"), ('cpc'::"text","a"."cpc"), ('ctr'::"text","a"."ctr"), ('lost_is_budget'::"text","a"."lost_is_budget"), ('lost_is_rank'::"text","a"."lost_is_rank"), ('pct_terminos_nuevos'::"text","a"."pct_terminos_nuevos")) "ind"("nombre", "valor"))
             CROSS JOIN LATERAL ( VALUES (0), (1), (2), (3), (5), (7)) "lag_dias"("n"))
             JOIN "li" "b" ON ((("b"."account" = "a"."account") AND ("b"."date" = ("a"."date" + "lag_dias"."n")))))
          WHERE ("ind"."valor" IS NOT NULL)
          GROUP BY "a"."account", "ind"."nombre", "lag_dias"."n"
        )
 SELECT "account",
    "nombre" AS "indicador",
    "lag_dias",
    "round"(("r")::numeric, 3) AS "correlacion",
    "n_pares",
        CASE
            WHEN ("n_pares" < 14) THEN 'INSUFICIENTE: menos de 14 pares'::"text"
            WHEN ("abs"("r") >= (0.5)::double precision) THEN 'PREDICE: |r| >= 0,5'::"text"
            WHEN ("abs"("r") >= (0.3)::double precision) THEN 'DEBIL: |r| entre 0,3 y 0,5'::"text"
            ELSE 'NO PREDICE: |r| < 0,3. Sacar del plan.'::"text"
        END AS "veredicto"
   FROM "pares"
  ORDER BY "account", "nombre", "lag_dias";


ALTER VIEW "public"."v_correlacion_leading_lagging" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_correlacion_leading_lagging" IS 'Correlacion entre cada leading y conversiones a N dias. Con 14+ pares es legible. Si no predice, el semanal lo saca del plan.';



CREATE OR REPLACE VIEW "public"."v_cuarentena_resumen" WITH ("security_invoker"='true') AS
 SELECT "tabla",
    COALESCE("cuenta", '(todas)'::"text") AS "cuenta",
    "count"(*) AS "registros",
    "max"("puesto_el") AS "ultimo",
    "string_agg"(DISTINCT "left"("por_que", 70), ' | '::"text") AS "motivos"
   FROM "public"."cuarentena"
  GROUP BY "tabla", COALESCE("cuenta", '(todas)'::"text");


ALTER VIEW "public"."v_cuarentena_resumen" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_cuentas_incompletas" WITH ("security_invoker"='true') AS
 SELECT "c"."account",
    "f"."requisito",
    "f"."detalle",
    "f"."por_que_importa"
   FROM "public"."cuentas" "c",
    LATERAL "public"."completitud_de_cuenta"("c"."account") "f"("requisito", "cumple", "detalle", "por_que_importa")
  WHERE ("c"."activa" AND (NOT "f"."cumple"));


ALTER VIEW "public"."v_cuentas_incompletas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_data_health" WITH ("security_invoker"='true') AS
 WITH "semana_real" AS (
         SELECT "campaign"."account",
            "max"("campaign"."week_start") AS "semana_datos"
           FROM "public"."campaign"
          GROUP BY "campaign"."account"
        ), "ultima" AS (
         SELECT "r"."account",
            "max"("r"."run_ts") AS "ultimo_run"
           FROM ("public"."run_log" "r"
             JOIN "semana_real" "s" ON ((("s"."account" = "r"."account") AND ("r"."week_start" = "s"."semana_datos"))))
          GROUP BY "r"."account"
        ), "detalle" AS (
         SELECT "r"."account",
            "u"."ultimo_run",
            "s"."semana_datos",
            "count"(*) FILTER (WHERE ("r"."status" = 'OK'::"text")) AS "tablas_ok",
            "count"(*) FILTER (WHERE (("r"."status" = 'ERROR'::"text") AND ("r"."tabla" <> 'CHANGE_EVENTS'::"text"))) AS "tablas_error",
            "count"(*) FILTER (WHERE ("r"."status" = 'VACIO'::"text")) AS "tablas_vacias",
            "sum"("r"."filas") AS "filas_totales",
            "string_agg"(DISTINCT "r"."tabla", ', '::"text") FILTER (WHERE (("r"."status" = 'ERROR'::"text") AND ("r"."tabla" <> 'CHANGE_EVENTS'::"text"))) AS "tablas_con_error"
           FROM (("public"."run_log" "r"
             JOIN "ultima" "u" ON ((("u"."account" = "r"."account") AND ("r"."run_ts" = "u"."ultimo_run"))))
             JOIN "semana_real" "s" ON (("s"."account" = "r"."account")))
          GROUP BY "r"."account", "u"."ultimo_run", "s"."semana_datos"
        )
 SELECT "account",
    "ultimo_run",
    "semana_datos",
    "round"((EXTRACT(epoch FROM ("now"() - "ultimo_run")) / (3600)::numeric), 1) AS "horas_desde_actualizacion",
    "tablas_ok",
    "tablas_error",
    "tablas_vacias",
    "filas_totales",
    "tablas_con_error",
        CASE
            WHEN ("tablas_error" > 0) THEN 'ERROR'::"text"
            WHEN (("now"() - "ultimo_run") > '8 days'::interval) THEN 'DESACTUALIZADO'::"text"
            WHEN ("tablas_ok" < 10) THEN 'INCOMPLETO'::"text"
            ELSE 'OK'::"text"
        END AS "estado",
        CASE
            WHEN ("tablas_error" > 0) THEN ('Fallaron tablas en la ultima corrida: '::"text" || COALESCE("tablas_con_error", ''::"text"))
            WHEN (("now"() - "ultimo_run") > '8 days'::interval) THEN 'El script no corre hace mas de 8 dias. Los datos mostrados son viejos.'::"text"
            WHEN ("tablas_ok" < 10) THEN 'La corrida escribio menos tablas de las esperadas.'::"text"
            ELSE 'Datos completos y actualizados.'::"text"
        END AS "mensaje"
   FROM "detalle";


ALTER VIEW "public"."v_data_health" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_data_health" IS 'Estado de frescura y completitud de los datos por cuenta. La app debe consultarla al cargar y mostrar una advertencia visible cuando el estado no sea OK. Un dashboard que muestra datos viejos sin avisar es peor que uno vacio.';



CREATE OR REPLACE VIEW "public"."v_decision_estructural" WITH ("security_invoker"='on') AS
 WITH "base" AS (
         SELECT "v_serie_diaria"."account",
            "sum"("v_serie_diaria"."conversiones") FILTER (WHERE (("v_serie_diaria"."date" >= (CURRENT_DATE - 28)) AND ("v_serie_diaria"."madurez" = 'consolidado'::"text"))) AS "conv_28d",
            "sum"("v_serie_diaria"."gasto") FILTER (WHERE (("v_serie_diaria"."date" >= (CURRENT_DATE - 28)) AND ("v_serie_diaria"."madurez" = 'consolidado'::"text"))) AS "gasto_28d",
            "count"(DISTINCT "v_serie_diaria"."date") FILTER (WHERE (("v_serie_diaria"."date" >= (CURRENT_DATE - 28)) AND ("v_serie_diaria"."madurez" = 'consolidado'::"text"))) AS "dias_28d"
           FROM "public"."v_serie_diaria"
          GROUP BY "v_serie_diaria"."account"
        ), "campanas" AS (
         SELECT "campaign_daily"."account",
            "count"(DISTINCT "campaign_daily"."campaign") AS "n_campanas"
           FROM "public"."campaign_daily"
          WHERE ("campaign_daily"."date" >= (CURRENT_DATE - 7))
          GROUP BY "campaign_daily"."account"
        ), "grupos" AS (
         SELECT "adgroup_daily"."account",
            "adgroup_daily"."ad_group",
            "sum"("adgroup_daily"."conversions") AS "conv"
           FROM "public"."adgroup_daily"
          WHERE ("adgroup_daily"."date" >= (CURRENT_DATE - 28))
          GROUP BY "adgroup_daily"."account", "adgroup_daily"."ad_group"
        ), "top_grupo" AS (
         SELECT "g"."account",
            "g"."ad_group",
            "g"."conv",
            "round"((("g"."conv" / NULLIF(( SELECT "sum"("x"."conv") AS "sum"
                   FROM "grupos" "x"
                  WHERE ("x"."account" = "g"."account")), (0)::numeric)) * (100)::numeric), 0) AS "pct"
           FROM "grupos" "g"
          WHERE ("g"."conv" = ( SELECT "max"("y"."conv") AS "max"
                   FROM "grupos" "y"
                  WHERE ("y"."account" = "g"."account")))
        ), "saturacion" AS (
         SELECT "v_cpa_marginal"."account",
            "max"("v_cpa_marginal"."ratio_marginal_sobre_promedio") FILTER (WHERE (("v_cpa_marginal"."lectura" ~~ 'SATURADA%'::"text") OR ("v_cpa_marginal"."lectura" ~~ 'RENDIMIENTO%'::"text") OR ("v_cpa_marginal"."lectura" ~~ 'SIN GANANCIA%'::"text"))) AS "peor_ratio"
           FROM "public"."v_cpa_marginal"
          WHERE ("v_cpa_marginal"."escalon" > "v_cpa_marginal"."presupuesto_actual")
          GROUP BY "v_cpa_marginal"."account"
        ), "targets" AS (
         SELECT "account_targets"."account",
            "account_targets"."conversiones_mes_objetivo",
            "account_targets"."conversiones_mes_origen",
            "account_targets"."cpa_maximo",
            "account_targets"."cpa_maximo_origen",
            "account_targets"."presupuesto_mes_maximo",
            "account_targets"."ciclo_venta_dias",
            "account_targets"."conversiones_minimas_smart_bidding",
            "account_targets"."notas",
            "account_targets"."actualizado",
            "account_targets"."actualizado_por"
           FROM "public"."account_targets"
        ), "tst" AS (
         SELECT "b_1"."account",
            "public"."testeabilidad"(("b_1"."conv_28d" / 4.0), 4) AS "t"
           FROM "base" "b_1"
        )
 SELECT "b"."account",
    "round"("b"."conv_28d", 0) AS "conv_28d",
    "b"."dias_28d",
    "c"."n_campanas",
    "round"(("b"."conv_28d" / (NULLIF("c"."n_campanas", 0))::numeric), 0) AS "conv_por_campana",
    "tg"."ad_group" AS "grupo_dominante",
    "tg"."pct" AS "pct_grupo_dominante",
    (("tst"."t" ->> 'mde_relativo_pct'::"text"))::integer AS "mde_4_semanas_pct",
    ("tst"."t" ->> 'veredicto'::"text") AS "testeabilidad",
        CASE
            WHEN (("tg"."pct" >= (50)::numeric) AND (("b"."conv_28d" - "tg"."conv") >= (60)::numeric)) THEN (((((('PROPONER · Separar "'::"text" || "tg"."ad_group") || '" en campaña propia con puja manual/Max Clicks y exacta. Concentra '::"text") || "tg"."pct") || '% de las conversiones; el resto tiene '::"text") || "round"(("b"."conv_28d" - "tg"."conv"))) || ' en 28d. Reversible.'::"text")
            WHEN (("tg"."pct" >= (50)::numeric) AND (("b"."conv_28d" - "tg"."conv") >= (30)::numeric)) THEN (((((('REVISAR · "'::"text" || "tg"."ad_group") || '" concentra '::"text") || "tg"."pct") || '% pero el resto tiene solo '::"text") || "round"(("b"."conv_28d" - "tg"."conv"))) || ' conv en 28d. Evaluar con Andrés.'::"text")
            WHEN ("tg"."pct" >= (50)::numeric) THEN (((((('NO PROPONER · "'::"text" || "tg"."ad_group") || '" concentra '::"text") || "tg"."pct") || '% pero separar dejaría a la no-marca sin densidad ('::"text") || "round"(("b"."conv_28d" - "tg"."conv"))) || ' conv en 28d, mínimo 60).'::"text")
            ELSE 'NO APLICA · ningún grupo supera 50% de las conversiones.'::"text"
        END AS "separar_marca",
        CASE
            WHEN (("c"."n_campanas" > 1) AND (("b"."conv_28d" / ("c"."n_campanas")::numeric) < (15)::numeric)) THEN (((('PROPONER · '::"text" || "c"."n_campanas") || ' campañas con '::"text") || "round"(("b"."conv_28d" / ("c"."n_campanas")::numeric))) || ' conv/mes cada una: por debajo de 15. Consolidar. Reversible.'::"text")
            WHEN ("c"."n_campanas" = 1) THEN 'NO APLICA · una sola campaña.'::"text"
            ELSE (('NO PROPONER · densidad suficiente ('::"text" || "round"(("b"."conv_28d" / ("c"."n_campanas")::numeric))) || ' conv/mes por campaña).'::"text")
        END AS "consolidar",
        CASE
            WHEN ("b"."conv_28d" >= (100)::numeric) THEN 'REVISAR · volumen suficiente (100+ conv/mes) SI hay una configuración que deba diferir: presupuesto, puja, geo, primaria o landing. Nunca para reportar.'::"text"
            ELSE (('NO PROPONER · con '::"text" || "round"("b"."conv_28d")) || ' conv en 28d, una campaña nueva restaría densidad. Mínimo 100/mes.'::"text")
        END AS "crear_campana",
        CASE
            WHEN ("tg"."pct" IS NULL) THEN 'NO APLICA'::"text"
            WHEN ("b"."dias_28d" < 28) THEN (('NO PROPONER · faltan días consolidados ('::"text" || "b"."dias_28d") || ' de 28).'::"text")
            WHEN (("t"."cpa_maximo" IS NOT NULL) AND (("b"."gasto_28d" / NULLIF("b"."conv_28d", (0)::numeric)) > ((2)::numeric * "t"."cpa_maximo")) AND ("c"."n_campanas" > 1)) THEN 'REVISAR · CPA de 28d duplica el máximo. Antes de pausar: mover presupuesto a la que tiene headroom.'::"text"
            WHEN (("t"."cpa_maximo" IS NOT NULL) AND (("b"."gasto_28d" / NULLIF("b"."conv_28d", (0)::numeric)) > ((2)::numeric * "t"."cpa_maximo"))) THEN 'REVISAR · CPA de 28d duplica el máximo y es la única campaña: pausar apaga la cuenta. Antes: reducir presupuesto 20%.'::"text"
            ELSE 'NO PROPONER · CPA dentro de 2× el máximo.'::"text"
        END AS "pausar",
        CASE
            WHEN ("s"."peor_ratio" >= (2)::numeric) THEN (('NO PROPONER · saturada: el siguiente escalón cuesta '::"text" || "round"("s"."peor_ratio", 1)) || '× el CPA promedio.'::"text")
            WHEN ("s"."peor_ratio" >= 1.3) THEN (('REVISAR · rendimiento decreciente: marginal '::"text" || "round"("s"."peor_ratio", 1)) || '× el promedio. Solo si el cliente acepta ese CPA.'::"text")
            WHEN ("s"."peor_ratio" IS NOT NULL) THEN 'PROPONER · headroom real. Subir 15-20%, no más, y medir 2 semanas.'::"text"
            ELSE 'SIN DATOS · sin curva de simulación. Karedo: llega con script v8 (simulaciones de grupo).'::"text"
        END AS "escalar",
        CASE
            WHEN (("tg"."pct" >= (50)::numeric) AND ("b"."conv_28d" >= (100)::numeric)) THEN (('REVISAR · marca concentra '::"text" || "tg"."pct") || '%: geo-split de 4 semanas mide incrementalidad. Costo: perder marca en la mitad de las regiones 4 semanas.'::"text")
            WHEN ("tg"."pct" >= (50)::numeric) THEN (('NO PROPONER · marca concentra '::"text" || "tg"."pct") || '% pero sin volumen para geo-split.'::"text")
            ELSE 'NO APLICA'::"text"
        END AS "test_incrementalidad_marca"
   FROM ((((("base" "b"
     LEFT JOIN "campanas" "c" ON (("c"."account" = "b"."account")))
     LEFT JOIN "top_grupo" "tg" ON (("tg"."account" = "b"."account")))
     LEFT JOIN "saturacion" "s" ON (("s"."account" = "b"."account")))
     LEFT JOIN "targets" "t" ON (("t"."account" = "b"."account")))
     LEFT JOIN "tst" ON (("tst"."account" = "b"."account")));


ALTER VIEW "public"."v_decision_estructural" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_decision_estructural" IS 'Seis decisiones estructurales por cuenta con zona (PROPONER/REVISAR/NO PROPONER) y evidencia. NO PROPONER no se menciona. Incluye testeabilidad (MDE a 4 semanas).';



CREATE OR REPLACE VIEW "public"."v_deuda_de_control" AS
 SELECT "t"."id",
    "t"."cuenta",
    "t"."tipo",
    "left"("t"."titulo", 90) AS "titulo",
    "t"."estado",
    ("t"."resuelto_el")::"date" AS "cerrado_el",
    "t"."veces_reabierto",
    "count"("ct"."relacion_id") AS "controles",
    "count"(*) FILTER (WHERE ("r"."mutante_resultado" = 'mato_al_mutante'::"text")) AS "controles_probados",
        CASE
            WHEN ("count"("ct"."relacion_id") = 0) THEN 'Cerrado sin control. Si vuelve, nadie se entera: es como se cerro el 37 y hubo que reabrirlo.'::"text"
            WHEN ("count"(*) FILTER (WHERE ("r"."mutante_resultado" = 'mato_al_mutante'::"text")) = 0) THEN 'Tiene control pero sin mutante probado.'::"text"
            ELSE 'Cubierto.'::"text"
        END AS "lectura"
   FROM (("public"."tickets" "t"
     LEFT JOIN "public"."controles_de_ticket" "ct" ON (("ct"."ticket_id" = "t"."id")))
     LEFT JOIN "public"."relaciones_verdad" "r" ON (("r"."id" = "ct"."relacion_id")))
  WHERE (("t"."estado" = 'resuelto'::"text") AND ("t"."tipo" = ANY (ARRAY['bug'::"text", 'dato_incorrecto'::"text"])))
  GROUP BY "t"."id", "t"."cuenta", "t"."tipo", "t"."titulo", "t"."estado", "t"."resuelto_el", "t"."veces_reabierto"
 HAVING ("count"(*) FILTER (WHERE ("r"."mutante_resultado" = 'mato_al_mutante'::"text")) = 0)
  ORDER BY "t"."veces_reabierto" DESC, "t"."id" DESC;


ALTER VIEW "public"."v_deuda_de_control" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_deuda_de_control" IS 'Tickets ya cerrados que ningun control vigila. La regla del trigger protege el futuro; esta vista mide lo que se cerro antes de que la regla existiera. Ordenada por veces_reabierto: los que ya volvieron una vez son los que mas probable vuelvan.';



CREATE OR REPLACE VIEW "public"."v_dia_con_cambios" WITH ("security_invoker"='on') AS
 SELECT "s"."account",
    "s"."date",
    "s"."gasto",
    "s"."conversiones",
    "s"."cpa",
    "s"."ctr",
    "s"."madurez",
    COALESCE("c"."cantidad_cambios", (0)::bigint) AS "cambios_ese_dia",
    COALESCE("c"."incluye_auto_google", false) AS "hubo_cambio_automatico",
    "c"."campos_tocados",
    "lag"("s"."cpa") OVER (PARTITION BY "s"."account" ORDER BY "s"."date") AS "cpa_dia_previo",
    "round"(("s"."cpa" - "lag"("s"."cpa") OVER (PARTITION BY "s"."account" ORDER BY "s"."date")), 2) AS "delta_cpa"
   FROM ("public"."v_serie_diaria" "s"
     LEFT JOIN "public"."v_change_annotations" "c" ON ((("c"."account" = "s"."account") AND ("c"."fecha" = ("s"."date")::"text"))));


ALTER VIEW "public"."v_dia_con_cambios" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_dia_con_cambios" IS 'Cada dia con su rendimiento y los cambios aplicados ese mismo dia. Si una metrica se movio y hubo un cambio en la misma ventana, la explicacion mas probable es el cambio, no el mercado.';



CREATE OR REPLACE VIEW "public"."v_donde_escribir_anuncio" AS
 WITH "sem_kw" AS (
         SELECT "max"("keywords"."week_start") AS "w"
           FROM "public"."keywords"
        ), "sem_ads" AS (
         SELECT "max"("ads"."week_start") AS "w"
           FROM "public"."ads"
        ), "sem_rsa" AS (
         SELECT "max"("rsa_assets"."week_start") AS "w"
           FROM "public"."rsa_assets"
        ), "kw" AS (
         SELECT "k"."account",
            "k"."campaign",
            "k"."ad_group",
            "sum"("k"."cost") AS "gasto",
            "sum"("k"."cost") FILTER (WHERE ("k"."qs_ad_relevance" = 'BELOW_AVERAGE'::"text")) AS "gasto_rel_baja",
            "sum"("k"."cost") FILTER (WHERE ("k"."qs_landing_page" = 'BELOW_AVERAGE'::"text")) AS "gasto_landing_baja",
            "round"(("sum"(("k"."cost" * "k"."quality_score")) / NULLIF("sum"("k"."cost"), (0)::numeric)), 1) AS "qs_ponderado",
            "count"(*) AS "keywords",
            "string_agg"(DISTINCT "k"."keyword", ' | '::"text" ORDER BY "k"."keyword") AS "keywords_del_grupo"
           FROM "public"."keywords" "k",
            "sem_kw" "s"
          WHERE (("k"."week_start" = "s"."w") AND ("k"."cost" > (0)::numeric))
          GROUP BY "k"."account", "k"."campaign", "k"."ad_group"
        ), "anu" AS (
         SELECT "a"."account",
            "a"."campaign",
            "a"."ad_group",
            "count"(DISTINCT "a"."ad_id") AS "anuncios",
            "string_agg"(DISTINCT COALESCE("a"."ad_strength", 'sin dato'::"text"), ', '::"text") AS "fuerza"
           FROM "public"."ads" "a",
            "sem_ads" "s"
          WHERE (("a"."week_start" = "s"."w") AND (COALESCE("a"."status", 'ENABLED'::"text") <> 'REMOVED'::"text"))
          GROUP BY "a"."account", "a"."campaign", "a"."ad_group"
        ), "txt" AS (
         SELECT "r"."account",
            "r"."campaign",
            "r"."ad_group",
            "count"(*) FILTER (WHERE ("r"."field_type" = 'HEADLINE'::"text")) AS "titulos",
            "count"(*) FILTER (WHERE ("r"."field_type" = 'DESCRIPTION'::"text")) AS "descripciones"
           FROM "public"."rsa_assets" "r",
            "sem_rsa" "s"
          WHERE ("r"."week_start" = "s"."w")
          GROUP BY "r"."account", "r"."campaign", "r"."ad_group"
        ), "term" AS (
         SELECT "st"."account",
            "st"."campaign",
            "st"."ad_group",
            "string_agg"("st"."search_term", ' | '::"text" ORDER BY "st"."conversions" DESC, "st"."cost" DESC) AS "terminos_que_convierten",
            "count"(*) AS "n_terminos"
           FROM ( SELECT "search_terms"."account",
                    "search_terms"."campaign",
                    "search_terms"."ad_group",
                    "search_terms"."search_term",
                    "sum"("search_terms"."conversions") AS "conversions",
                    "sum"("search_terms"."cost") AS "cost"
                   FROM "public"."search_terms"
                  WHERE ("search_terms"."week_start" > (CURRENT_DATE - 30))
                  GROUP BY "search_terms"."account", "search_terms"."campaign", "search_terms"."ad_group", "search_terms"."search_term"
                 HAVING ("sum"("search_terms"."conversions") > (0)::numeric)) "st"
          GROUP BY "st"."account", "st"."campaign", "st"."ad_group"
        )
 SELECT "kw"."account",
    "d"."location",
    "d"."objetivo",
    "kw"."campaign",
    "kw"."ad_group",
    "round"("kw"."gasto") AS "gasto_semana",
    "round"(COALESCE("kw"."gasto_rel_baja", (0)::numeric)) AS "plata_en_riesgo",
    "round"(((COALESCE("kw"."gasto_rel_baja", (0)::numeric) / NULLIF("kw"."gasto", (0)::numeric)) * (100)::numeric)) AS "pct_gasto_con_relevancia_baja",
    "round"(((COALESCE("kw"."gasto_landing_baja", (0)::numeric) / NULLIF("kw"."gasto", (0)::numeric)) * (100)::numeric)) AS "pct_gasto_con_landing_baja",
    "kw"."qs_ponderado",
    "kw"."keywords",
    COALESCE("anu"."anuncios", (0)::bigint) AS "anuncios_en_el_grupo",
    "anu"."fuerza" AS "fuerza_del_anuncio",
    COALESCE("txt"."titulos", (0)::bigint) AS "titulos_actuales",
    COALESCE("term"."n_terminos", (0)::bigint) AS "terminos_que_convierten_30d",
    "kw"."keywords_del_grupo",
    "term"."terminos_que_convierten",
        CASE
            WHEN (COALESCE("kw"."gasto_landing_baja", (0)::numeric) > (COALESCE("kw"."gasto_rel_baja", (0)::numeric) * 1.5)) THEN (('NO ES EL ANUNCIO: el problema dominante es la landing ('::"text" || "round"(((COALESCE("kw"."gasto_landing_baja", (0)::numeric) / NULLIF("kw"."gasto", (0)::numeric)) * (100)::numeric))) || '% del gasto). Escribir un RSA nuevo no va a mover el Quality Score.'::"text")
            WHEN (COALESCE("anu"."anuncios", (0)::bigint) = 0) THEN 'CREAR EL PRIMER ANUNCIO: el grupo gasta y no tiene ningun RSA activo.'::"text"
            WHEN (((COALESCE("kw"."gasto_rel_baja", (0)::numeric) / NULLIF("kw"."gasto", (0)::numeric)) >= 0.5) AND (COALESCE("anu"."anuncios", (0)::bigint) = 1)) THEN 'REESCRIBIR: mas de la mitad del gasto va a keywords que el unico anuncio no menciona. Reescribirlo con el tema del grupo, y despues sumar un segundo.'::"text"
            WHEN ((COALESCE("kw"."gasto_rel_baja", (0)::numeric) / NULLIF("kw"."gasto", (0)::numeric)) >= 0.5) THEN 'REESCRIBIR: mas de la mitad del gasto va a keywords que los anuncios no mencionan.'::"text"
            WHEN (COALESCE("anu"."anuncios", (0)::bigint) = 1) THEN 'SUMAR UN SEGUNDO ANUNCIO: hay uno solo. Google mide 6,6% mas conversiones a CPA similar al pasar de uno a dos RSA, y 3,7% mas al pasar de dos a tres. Es la accion de menor esfuerzo de la lista.'::"text"
            WHEN ("anu"."fuerza" ~~* '%POOR%'::"text") THEN 'MEJORAR EL EXISTENTE: la Eficacia del anuncio es POOR. Ojo: Ad Strength es un diagnostico de la interfaz y NO entra en la subasta, asi que vale como pista de variedad, no como objetivo en si.'::"text"
            ELSE 'SIN ACCION CLARA POR ANUNCIO: la relevancia no es el cuello de este grupo.'::"text"
        END AS "que_hacer",
        CASE
            WHEN (COALESCE("kw"."gasto_landing_baja", (0)::numeric) > (COALESCE("kw"."gasto_rel_baja", (0)::numeric) * 1.5)) THEN (0)::numeric
            ELSE "round"(COALESCE("kw"."gasto_rel_baja", (0)::numeric))
        END AS "prioridad",
    "c"."locale" AS "idioma_anuncio",
    "c"."moneda",
    ("c"."perfil_analisis" = 'cadena'::"text") AS "es_cadena",
    "c"."nombre_cliente"
   FROM ((((("kw"
     JOIN "public"."cuentas" "c" ON (("c"."account" = "kw"."account")))
     LEFT JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "kw"."account") AND ("d"."campaign" = "kw"."campaign"))))
     LEFT JOIN "anu" ON ((("anu"."account" = "kw"."account") AND ("anu"."campaign" = "kw"."campaign") AND ("anu"."ad_group" = "kw"."ad_group"))))
     LEFT JOIN "txt" ON ((("txt"."account" = "kw"."account") AND ("txt"."campaign" = "kw"."campaign") AND ("txt"."ad_group" = "kw"."ad_group"))))
     LEFT JOIN "term" ON ((("term"."account" = "kw"."account") AND ("term"."campaign" = "kw"."campaign") AND ("term"."ad_group" = "kw"."ad_group"))));


ALTER VIEW "public"."v_donde_escribir_anuncio" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_donde_escribir_anuncio" IS 'Donde conviene escribir un anuncio y por que, por GRUPO DE ANUNCIOS. plata_en_riesgo es el gasto de la semana en keywords con relevancia del anuncio bajo el promedio. OJO con no confundir: la RELEVANCIA DEL ANUNCIO es componente del Quality Score y entra en la subasta; AD STRENGTH es un diagnostico de la interfaz que Google dice explicitamente que no influye en la elegibilidad de publicacion, y ademas depende de tener al menos 6 sitelinks, que no se cargan desde el generador.';



CREATE OR REPLACE VIEW "public"."v_drift_semantico" AS
 SELECT 'ventana_que_miente'::"text" AS "familia",
    "c"."objeto",
    "c"."columna",
    (((('El nombre dice '::"text" || ("regexp_match"("c"."columna", '([0-9]+)\s*d'::"text"))[1]) || ' dias y el contrato declara '::"text") || "c"."ventana_dias") || '.'::"text") AS "detalle",
    'Renombrar la columna o corregir la ventana. Un nombre que miente sobrevive a cualquier auditoria de "esta roto".'::"text" AS "que_hacer"
   FROM "public"."contratos_columna" "c"
  WHERE (("c"."columna" ~ '[0-9]+d($|_)'::"text") AND ("c"."ventana_dias" IS NOT NULL) AND ((("regexp_match"("c"."columna", '([0-9]+)\s*d'::"text"))[1])::integer <> "c"."ventana_dias"))
UNION ALL
 SELECT 'tipo_que_miente'::"text" AS "familia",
    "ic"."table_name" AS "objeto",
    "ic"."column_name" AS "columna",
    (('Se llama como una fecha y es '::"text" || ("ic"."data_type")::"text") || '. Toda comparacion contra un timestamp falla o exige cast.'::"text") AS "detalle",
    'Cambiar el tipo, o declarar el contrato con nota explicita y castear siempre.'::"text" AS "que_hacer"
   FROM "information_schema"."columns" "ic"
  WHERE ((("ic"."table_schema")::"name" = 'public'::"name") AND (("ic"."data_type")::"text" = ANY ((ARRAY['text'::character varying, 'character varying'::character varying])::"text"[])) AND (("ic"."column_name")::"name" ~ '(fecha|datetime|_el$|_at$)'::"text") AND (NOT (EXISTS ( SELECT 1
           FROM "public"."drift_exento" "e"
          WHERE (("ic"."column_name")::"name" ~~ "e"."patron")))))
UNION ALL
 SELECT 'afirmacion_sin_contrato'::"text" AS "familia",
    "ic"."table_name" AS "objeto",
    "ic"."column_name" AS "columna",
    'Booleano cuyo nombre afirma una condicion y no tiene contrato que diga que verifica exactamente.'::"text" AS "detalle",
    'Declarar en contratos_columna que condicion afirma. accion_valida decia "el JSON parsea" y la app lo leia como "se puede ejecutar".'::"text" AS "que_hacer"
   FROM "information_schema"."columns" "ic"
  WHERE ((("ic"."table_schema")::"name" = 'public'::"name") AND (("ic"."data_type")::"text" = 'boolean'::"text") AND (("ic"."column_name")::"name" ~ '(valid|ok$|correct|complet|sano|listo|puede|habilit)'::"text") AND (NOT (EXISTS ( SELECT 1
           FROM "public"."contratos_columna" "c"
          WHERE (("c"."objeto" = ("ic"."table_name")::"name") AND ("c"."columna" = ("ic"."column_name")::"name"))))))
UNION ALL
 SELECT 'sin_contrato'::"text" AS "familia",
    "t"."tabla" AS "objeto",
    '(toda la tabla)'::"text" AS "columna",
    ((("t"."sin_contrato" || ' de '::"text") || "t"."total") || ' columnas no declaran que prometen.'::"text") AS "detalle",
    'Sin contrato el drift es invisible. Empezar por las columnas que alguien cita en un brief.'::"text" AS "que_hacer"
   FROM ( SELECT "ic"."table_name" AS "tabla",
            "count"(*) AS "total",
            "count"(*) FILTER (WHERE (NOT (EXISTS ( SELECT 1
                   FROM "public"."contratos_columna" "c"
                  WHERE (("c"."objeto" = ("ic"."table_name")::"name") AND ("c"."columna" = ("ic"."column_name")::"name")))))) AS "sin_contrato"
           FROM "information_schema"."columns" "ic"
          WHERE ((("ic"."table_schema")::"name" = 'public'::"name") AND (("ic"."table_name")::"name" = ANY (ARRAY['campaign'::"name", 'campaign_daily'::"name", 'keywords'::"name", 'keywords_daily'::"name", 'change_events'::"name", 'conversion_actions'::"name", 'acciones_aprobadas'::"name", 'accionables_espejo'::"name", 'latidos'::"name", 'cuentas'::"name"])))
          GROUP BY "ic"."table_name") "t"
  WHERE ("t"."sin_contrato" = "t"."total");


ALTER VIEW "public"."v_drift_semantico" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_drift_semantico" IS 'Nombres que mienten: la forma en que el drift semantico se manifiesta en este sistema. Compara lo que el nombre promete contra lo que el contrato declara y contra el tipo real. Familia sin_contrato no es una falla, es un hueco: sin promesa declarada el drift es indetectable.';



CREATE OR REPLACE VIEW "public"."v_ejecucion_perdida" WITH ("security_invoker"='true') AS
 SELECT "e"."account",
    "e"."notion_id",
    "e"."titulo",
    "e"."estado",
    "e"."prioridad",
    "public"."verbo_probable"("e"."titulo", "e"."por_que") AS "verbo_sugerido",
    "c"."riesgo",
    "c"."requiere",
    "c"."metodo",
    (('Este accionable describe un cambio que un script SI puede hacer ('::"text" || "c"."metodo") || '), pero no tiene Accion JSON, asi que no aparece el boton de ejecutar y hay que hacerlo a mano.'::"text") AS "lectura"
   FROM ("public"."accionables_espejo" "e"
     JOIN "public"."capacidades_ejecucion" "c" ON ((("c"."verbo" = "public"."verbo_probable"("e"."titulo", "e"."por_que")) AND "c"."ejecutable")))
  WHERE (("e"."estado" = ANY (ARRAY['Propuesto'::"text", 'Aprobado'::"text", 'En curso'::"text"])) AND (NOT COALESCE("e"."accion_valida", false)) AND (COALESCE("e"."reemplazado_por", ''::"text") = ''::"text"));


ALTER VIEW "public"."v_ejecucion_perdida" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_escalera_valor" WITH ("security_invoker"='on') AS
 SELECT "account",
    "stage_order",
    "stage_name",
    "source",
    "google_conversion_action",
    "google_status",
    "win_rate_to_close",
    "avg_ticket",
    "stage_value",
    "currency",
    "eventos_ultimos_30d",
    "listo_para_primaria",
    "win_rate_origen",
        CASE
            WHEN (("google_status" = 'no_existe'::"text") AND ("source" = 'karedo_backend'::"text")) THEN 'BLOQUEADO: falta integracion con backend del cliente'::"text"
            WHEN ("google_status" = 'no_existe'::"text") THEN 'CREAR: accion de conversion offline como secundaria'::"text"
            WHEN (("google_status" = 'secundaria'::"text") AND "listo_para_primaria") THEN 'PROMOVER: tiene volumen para ser primaria'::"text"
            WHEN ("google_status" = 'secundaria'::"text") THEN 'ACUMULAR: secundaria hasta llegar a 15/mes'::"text"
            WHEN (("google_status" = 'primaria'::"text") AND ("stage_order" = 1)) THEN 'SUSTITUIR: es la etapa de entrada, senal barata y ruidosa'::"text"
            WHEN ("google_status" = 'primaria'::"text") THEN 'OK: primaria con volumen'::"text"
            ELSE NULL::"text"
        END AS "accion",
    "notas"
   FROM "public"."funnel_stages"
  ORDER BY "account", "stage_order";


ALTER VIEW "public"."v_escalera_valor" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_escalera_valor" IS 'Estado de cada etapa del funnel por cuenta: si existe en Google, si es primaria o secundaria, cuanto vale, y que accion corresponde. El objetivo es que la primaria sea la etapa mas profunda que tenga 15+ eventos al mes, no la de entrada.';



CREATE OR REPLACE VIEW "public"."v_espejo_huerfano" WITH ("security_invoker"='true') AS
 SELECT "account",
    "count"(*) AS "n",
    "max"("sincronizado") AS "ultimo",
    (('El account "'::"text" || "account") || '" no existe en cuentas: el sincronizador no pudo resolver el cliente de la pagina de Notion. Revisar si hay una ficha duplicada o con nombre distinto.'::"text") AS "lectura"
   FROM "public"."accionables_espejo" "e"
  WHERE (("account" IS NOT NULL) AND ("account" <> 'Unknown'::"text") AND (COALESCE("estado", ''::"text") <> ALL (ARRAY['Descartado'::"text", 'Hecho'::"text"])) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."cuentas" "c"
          WHERE ("c"."account" = "e"."account")))))
  GROUP BY "account";


ALTER VIEW "public"."v_espejo_huerfano" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_espejo_sin_titulo" WITH ("security_invoker"='true') AS
 SELECT "account",
    "count"(*) AS "n",
    "max"("sincronizado") AS "ultimo",
    'Accionables sin titulo en el espejo: no se pueden buscar ni citar. Suele ser que el sincronizador lee una propiedad de Notion que no existe.'::"text" AS "lectura"
   FROM "public"."accionables_espejo"
  WHERE ((COALESCE("titulo", ''::"text") = ''::"text") AND (COALESCE("estado", ''::"text") <> 'Descartado'::"text"))
  GROUP BY "account";


ALTER VIEW "public"."v_espejo_sin_titulo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_fuzzy_negatives" WITH ("security_invoker"='on') AS
 SELECT DISTINCT ON ("st"."account", "st"."search_term", "n"."negative_keyword") "st"."account",
    "st"."week_start",
    "st"."search_term" AS "termino_con_gasto",
    "n"."negative_keyword" AS "negativa_similar",
    "n"."match_type" AS "concordancia_negativa",
    "st"."cost" AS "gasto_perdido",
    "st"."clicks",
    "extensions"."levenshtein"("lower"("st"."search_term"), "lower"("n"."negative_keyword")) AS "letras_de_diferencia",
    'REVISAR A MANO: una diferencia de 1-2 letras puede ser un error de tipeo del usuario sobre tu propia marca, que es trafico bueno, o una fuga real. No aplicar sin verificar.'::"text" AS "advertencia"
   FROM ("public"."search_terms" "st"
     JOIN "public"."negatives" "n" ON ((("st"."account" = "n"."account") AND ("abs"(("length"("st"."search_term") - "length"("n"."negative_keyword"))) <= 2))))
  WHERE (("st"."conversions" = (0)::numeric) AND ("st"."cost" > (0)::numeric) AND (("extensions"."levenshtein"("lower"("st"."search_term"), "lower"("n"."negative_keyword")) >= 1) AND ("extensions"."levenshtein"("lower"("st"."search_term"), "lower"("n"."negative_keyword")) <= 2)))
  ORDER BY "st"."account", "st"."search_term", "n"."negative_keyword", "st"."cost" DESC;


ALTER VIEW "public"."v_fuzzy_negatives" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_fuzzy_negatives" IS 'Terminos con gasto y sin conversion que difieren en 1 o 2 letras de una negativa ya cargada. NUNCA aplicar automaticamente: una diferencia de una letra puede ser un usuario escribiendo mal tu propia marca, que es trafico que queres. Ejemplo real detectado: "koredo" contra la negativa "karedo". Bloquearlo seria perder trafico de marca. Requiere revision humana siempre.';



CREATE OR REPLACE VIEW "public"."v_grupos_resueltos" WITH ("security_invoker"='true') AS
 SELECT "a"."account",
    "a"."week_start",
    "d"."location",
    COALESCE("d"."objetivo", 'generico'::"text") AS "objetivo",
    "a"."campaign",
    "a"."ad_group",
    "a"."impressions",
    "a"."clicks",
    "a"."ctr",
    "a"."avg_cpc",
    "a"."cost",
    "a"."conversions",
    "a"."conv_value",
    "a"."cost_per_conv",
    "a"."conv_rate",
    "a"."impr_share"
   FROM ("public"."adgroup" "a"
     LEFT JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "a"."account") AND ("d"."campaign" = "a"."campaign"))));


ALTER VIEW "public"."v_grupos_resueltos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_headroom" AS
 WITH "ultimos14" AS (
         SELECT "s"."account",
            "sum"("s"."gasto") AS "gasto_14d",
            "sum"("s"."conversiones") AS "conv_14d",
            "round"(("sum"("s"."gasto") / NULLIF("sum"("s"."conversiones"), (0)::numeric)), 2) AS "cpa_14d",
            "count"(*) FILTER (WHERE ("s"."madurez" = 'consolidado'::"text")) AS "dias_consolidados",
            "count"(*) FILTER (WHERE (("s"."cpa" IS NOT NULL) AND ("s"."madurez" = 'consolidado'::"text") AND ("s"."cpa" <= ( SELECT "t_1"."cpa_maximo"
                   FROM "public"."account_targets" "t_1"
                  WHERE ("t_1"."account" = "s"."account"))))) AS "dias_dentro_cpa",
            "round"(("stddev_samp"("s"."cpa") / NULLIF("avg"("s"."cpa"), (0)::numeric)), 2) AS "cv_cpa",
            "avg"("s"."perdido_presupuesto") AS "lost_budget_pct",
            "avg"("s"."perdido_ranking") AS "lost_rank_pct"
           FROM "public"."v_serie_diaria" "s"
          WHERE (("s"."date" >= (CURRENT_DATE - 14)) AND ("s"."date" < (CURRENT_DATE - 1)))
          GROUP BY "s"."account"
        ), "volumen" AS (
         SELECT "c"."account",
            "round"("sum"("c"."conversions"), 1) AS "conv_ventana",
            ("count"(DISTINCT "c"."week_start") * 7) AS "dias_ventana",
            "count"(DISTINCT "c"."week_start") AS "semanas_ventana"
           FROM "public"."campaign" "c"
          WHERE ("c"."week_start" > (( SELECT "max"("c2"."week_start") AS "max"
                   FROM "public"."campaign" "c2"
                  WHERE ("c2"."account" = "c"."account")) - 28))
          GROUP BY "c"."account"
        ), "volumen_viejo" AS (
         SELECT "v_serie_diaria"."account",
            "sum"("v_serie_diaria"."conversiones") AS "conv_30d_truncada"
           FROM "public"."v_serie_diaria"
          WHERE (("v_serie_diaria"."date" >= (CURRENT_DATE - 30)) AND ("v_serie_diaria"."date" < (CURRENT_DATE - 1)))
          GROUP BY "v_serie_diaria"."account"
        ), "impr_share" AS (
         SELECT "v_campaign_daily"."account",
            "avg"("v_campaign_daily"."impr_share") AS "impr_share_pct"
           FROM "public"."v_campaign_daily"
          WHERE (("v_campaign_daily"."date" >= (CURRENT_DATE - 7)) AND ("v_campaign_daily"."status" = 'ENABLED'::"text"))
          GROUP BY "v_campaign_daily"."account"
        ), "calidad" AS (
         SELECT "k"."account",
            "round"(("sum"(("k"."cost" * "k"."quality_score")) / NULLIF("sum"("k"."cost"), (0)::numeric)), 1) AS "qs_ponderado",
            "round"((("sum"(("k"."cost" * (
                CASE "k"."qs_expected_ctr"
                    WHEN 'BELOW_AVERAGE'::"text" THEN 1
                    ELSE 0
                END)::numeric)) / NULLIF("sum"("k"."cost"), (0)::numeric)) * (100)::numeric)) AS "pct_ctr",
            "round"((("sum"(("k"."cost" * (
                CASE "k"."qs_ad_relevance"
                    WHEN 'BELOW_AVERAGE'::"text" THEN 1
                    ELSE 0
                END)::numeric)) / NULLIF("sum"("k"."cost"), (0)::numeric)) * (100)::numeric)) AS "pct_rel",
            "round"((("sum"(("k"."cost" * (
                CASE "k"."qs_landing_page"
                    WHEN 'BELOW_AVERAGE'::"text" THEN 1
                    ELSE 0
                END)::numeric)) / NULLIF("sum"("k"."cost"), (0)::numeric)) * (100)::numeric)) AS "pct_lp"
           FROM "public"."keywords" "k"
          WHERE (("k"."week_start" = ( SELECT "max"("keywords"."week_start") AS "max"
                   FROM "public"."keywords")) AND ("k"."cost" > (0)::numeric) AND ("k"."quality_score" IS NOT NULL))
          GROUP BY "k"."account"
        ), "q" AS (
         SELECT "calidad"."account",
            "calidad"."qs_ponderado",
            "calidad"."pct_ctr",
            "calidad"."pct_rel",
            "calidad"."pct_lp",
            GREATEST("calidad"."pct_ctr", "calidad"."pct_rel", "calidad"."pct_lp") AS "peor_pct",
                CASE
                    WHEN ("calidad"."pct_lp" = GREATEST("calidad"."pct_ctr", "calidad"."pct_rel", "calidad"."pct_lp")) THEN 'la experiencia de landing'::"text"
                    WHEN ("calidad"."pct_rel" = GREATEST("calidad"."pct_ctr", "calidad"."pct_rel", "calidad"."pct_lp")) THEN 'la relevancia del anuncio'::"text"
                    ELSE 'el CTR esperado'::"text"
                END AS "peor_componente",
                CASE
                    WHEN ((GREATEST("calidad"."pct_ctr", "calidad"."pct_rel", "calidad"."pct_lp") < (15)::numeric) OR (("calidad"."qs_ponderado" >= (7)::numeric) AND (GREATEST("calidad"."pct_ctr", "calidad"."pct_rel", "calidad"."pct_lp") < (40)::numeric))) THEN 'PUJA'::"text"
                    WHEN (GREATEST("calidad"."pct_ctr", "calidad"."pct_rel", "calidad"."pct_lp") >= (40)::numeric) THEN 'CALIDAD'::"text"
                    ELSE 'MIXTA'::"text"
                END AS "banda"
           FROM "calidad"
        )
 SELECT "u"."account",
    "t"."conversiones_mes_objetivo",
    "round"((("u"."conv_14d" * 30.0) / (14)::numeric), 1) AS "conv_mes_proyectado",
    "round"((((("u"."conv_14d" * 30.0) / (14)::numeric) / NULLIF("t"."conversiones_mes_objetivo", (0)::numeric)) * (100)::numeric)) AS "pct_del_objetivo",
    "u"."cpa_14d",
    "t"."cpa_maximo",
    "round"((("u"."cpa_14d" / NULLIF("t"."cpa_maximo", (0)::numeric)) * (100)::numeric)) AS "cpa_pct_del_maximo",
    "u"."dias_dentro_cpa",
    "u"."dias_consolidados",
    "u"."cv_cpa",
    "round"("u"."lost_budget_pct", 1) AS "lost_is_budget_pct",
    "round"("u"."lost_rank_pct", 1) AS "lost_is_rank_pct",
    "round"("i"."impr_share_pct", 1) AS "impr_share_pct",
    "v"."conv_ventana",
    "t"."conversiones_minimas_smart_bidding",
    ("u"."dias_dentro_cpa" >= GREATEST(("u"."dias_consolidados" - 2), (8)::bigint)) AS "senal_cpa_estable",
    ("u"."lost_budget_pct" >= (20)::numeric) AS "senal_limitada_presupuesto",
    ("u"."cv_cpa" <= 0.5) AS "senal_conversion_estable",
    ("v"."conv_ventana" >= ("t"."conversiones_minimas_smart_bidding")::numeric) AS "senal_volumen_suficiente",
    ("i"."impr_share_pct" >= (85)::numeric) AS "techo_inventario_saturado",
    ("u"."lost_rank_pct" > "u"."lost_budget_pct") AS "techo_limitada_por_ranking",
        CASE
            WHEN ("i"."impr_share_pct" >= (85)::numeric) THEN 'TECHO: inventario saturado. Escalar horizontal (keywords, geos), no presupuesto'::"text"
            WHEN ("v"."semanas_ventana" < 3) THEN ((('NO SE PUEDE SABER: solo '::"text" || "v"."semanas_ventana") || ' semana(s) completas de historia. '::"text") || 'Hacen falta al menos 3 para juzgar volumen. No emitir veredicto de escalamiento.'::"text")
            WHEN ("v"."conv_ventana" < ("t"."conversiones_minimas_smart_bidding")::numeric) THEN (((((('NO ESCALAR: '::"text" || "v"."conv_ventana") || ' conv en '::"text") || "v"."dias_ventana") || ' dias (minimo '::"text") || "t"."conversiones_minimas_smart_bidding") || '), Smart Bidding inestable'::"text")
            WHEN (("u"."lost_rank_pct" > "u"."lost_budget_pct") AND ("q"."banda" IS NULL)) THEN ((((('LIMITADA POR RANKING: pierde mas por ranking ('::"text" || "round"("u"."lost_rank_pct", 1)) || '%) que por presupuesto ('::"text") || "round"("u"."lost_budget_pct", 1)) || '%), pero NO hay datos de '::"text") || 'quality score en la ultima semana para decir si es calidad o puja. No recetar sin eso.'::"text")
            WHEN (("u"."lost_rank_pct" > "u"."lost_budget_pct") AND ("q"."banda" = 'PUJA'::"text")) THEN (((((('LIMITADA POR RANKING, POR PUJA: la calidad no lo explica. QS ponderado '::"text" || "q"."qs_ponderado") || ' y el peor componente ('::"text") || "q"."peor_componente") || ') pesa '::"text") || "q"."peor_pct") || '% del gasto. Subir la puja o el objetivo. NO tocar QS, relevancia ni landing: no es ahi.'::"text")
            WHEN (("u"."lost_rank_pct" > "u"."lost_budget_pct") AND ("q"."banda" = 'CALIDAD'::"text")) THEN (((((('LIMITADA POR RANKING, POR CALIDAD: pesa '::"text" || "q"."peor_componente") || ', '::"text") || "q"."peor_pct") || '% del gasto (QS ponderado '::"text") || "q"."qs_ponderado") || '). Ver v_por_que_limitada para las peores keywords.'::"text")
            WHEN ("u"."lost_rank_pct" > "u"."lost_budget_pct") THEN ((((((('LIMITADA POR RANKING, MIXTA: '::"text" || "q"."peor_componente") || ' pesa '::"text") || "q"."peor_pct") || '% del gasto con QS ponderado '::"text") || "q"."qs_ponderado") || '. Ni la calidad ni la puja explican '::"text") || 'sola la perdida: no recetar una sin medir la otra.'::"text")
            WHEN (("u"."dias_dentro_cpa" >= GREATEST(("u"."dias_consolidados" - 2), (8)::bigint)) AND ("u"."lost_budget_pct" >= (20)::numeric) AND ("u"."cv_cpa" <= 0.5)) THEN 'HEADROOM: CPA estable + limitada por presupuesto. Escalar 20-30%, esperar 2 ciclos'::"text"
            WHEN (("u"."dias_dentro_cpa" >= GREATEST(("u"."dias_consolidados" - 2), (8)::bigint)) AND ("u"."lost_budget_pct" < (20)::numeric)) THEN 'ESTABLE SIN MARGEN: CPA bien pero no pierde por presupuesto. Buscar volumen horizontal'::"text"
            WHEN ("u"."cv_cpa" > 0.5) THEN 'INESTABLE: CPA varia demasiado. Estabilizar antes de escalar'::"text"
            ELSE 'FUERA DE OBJETIVO: CPA sobre maximo. Optimizar antes de escalar'::"text"
        END AS "veredicto",
    "t"."cpa_maximo_origen",
    "t"."conversiones_mes_origen",
    (("t"."cpa_maximo_origen" = 'provisional'::"text") OR ("t"."conversiones_mes_origen" = ANY (ARRAY['provisional'::"text", 'historico'::"text"]))) AS "objetivos_provisionales",
    (('tabla semanal, '::"text" || "v"."semanas_ventana") || ' semanas completas'::"text") AS "conv_ventana_origen",
    "v"."dias_ventana" AS "conv_ventana_dias",
    "round"("vv"."conv_30d_truncada", 1) AS "conv_diaria_truncada",
    "q"."qs_ponderado",
    "q"."peor_pct" AS "pct_gasto_peor_componente",
    ((((((('conv_30d sale de la tabla SEMANAL ('::"text" || "v"."dias_ventana") || ' dias reales), no de la capa diaria, '::"text") || 'que tiene entre 15 y 17 dias. conv_30d_diaria_truncada es lo que devolvia antes esta vista: la '::"text") || 'diferencia es cuanto subestimaba. La banda de calidad ('::"text") || COALESCE("q"."banda", 'sin datos'::"text")) || ') sale de cruzar QS ponderado con el peso del peor componente, no de un corte unico. '::"text") || 'dias_consolidados se refiere a la ventana de 14 dias, no a esta.'::"text") AS "lectura"
   FROM ((((("ultimos14" "u"
     JOIN "public"."account_targets" "t" ON (("t"."account" = "u"."account")))
     LEFT JOIN "volumen" "v" ON (("v"."account" = "u"."account")))
     LEFT JOIN "volumen_viejo" "vv" ON (("vv"."account" = "u"."account")))
     LEFT JOIN "impr_share" "i" ON (("i"."account" = "u"."account")))
     LEFT JOIN "q" ON (("q"."account" = "u"."account")));


ALTER VIEW "public"."v_headroom" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_headroom" IS 'Veredicto de escalamiento por cuenta. El volumen se mide sobre la tabla SEMANAL (4 semanas completas, 28 dias reales) y NO sobre la capa diaria, que tiene 15 a 17 dias y devolvia el total de esa ventana con la etiqueta "30d": asi el NO ESCALAR de BHI era falso (10 contra 27 reales). La rama de ranking distingue puja de calidad mirando la descomposicion de quality score, en vez de recetar QS por defecto. Si no hay datos de QS, no receta.';



CREATE OR REPLACE VIEW "public"."v_hora_dia" WITH ("security_invoker"='on') AS
 WITH "ultima" AS (
         SELECT "hour_day"."account",
            "max"("hour_day"."week_start") AS "week_start"
           FROM "public"."hour_day"
          GROUP BY "hour_day"."account"
        )
 SELECT "h"."account",
    "h"."week_start",
    "h"."day_of_week",
        CASE "h"."day_of_week"
            WHEN 'MONDAY'::"text" THEN 1
            WHEN 'TUESDAY'::"text" THEN 2
            WHEN 'WEDNESDAY'::"text" THEN 3
            WHEN 'THURSDAY'::"text" THEN 4
            WHEN 'FRIDAY'::"text" THEN 5
            WHEN 'SATURDAY'::"text" THEN 6
            WHEN 'SUNDAY'::"text" THEN 7
            ELSE NULL::integer
        END AS "dow_num",
        CASE "h"."day_of_week"
            WHEN 'MONDAY'::"text" THEN 'Lun'::"text"
            WHEN 'TUESDAY'::"text" THEN 'Mar'::"text"
            WHEN 'WEDNESDAY'::"text" THEN 'Mié'::"text"
            WHEN 'THURSDAY'::"text" THEN 'Jue'::"text"
            WHEN 'FRIDAY'::"text" THEN 'Vie'::"text"
            WHEN 'SATURDAY'::"text" THEN 'Sáb'::"text"
            WHEN 'SUNDAY'::"text" THEN 'Dom'::"text"
            ELSE NULL::"text"
        END AS "dia",
    "h"."hour",
    "sum"("h"."impressions") AS "impresiones",
    "sum"("h"."clicks") AS "clics",
    "round"("sum"("h"."cost"), 2) AS "gasto",
    "round"("sum"("h"."conversions"), 1) AS "conversiones",
        CASE
            WHEN ("sum"("h"."conversions") > (0)::numeric) THEN "round"(("sum"("h"."cost") / "sum"("h"."conversions")), 2)
            ELSE NULL::numeric
        END AS "cpa",
        CASE
            WHEN ("sum"("h"."impressions") > (0)::numeric) THEN "round"((("sum"("h"."clicks") / "sum"("h"."impressions")) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "ctr"
   FROM ("public"."hour_day" "h"
     JOIN "ultima" "u" ON ((("u"."account" = "h"."account") AND ("u"."week_start" = "h"."week_start"))))
  GROUP BY "h"."account", "h"."week_start", "h"."day_of_week", "h"."hour";


ALTER VIEW "public"."v_hora_dia" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_hora_dia" IS 'Rendimiento por hora y dia de la semana, de la ultima semana cerrada, agregando todas las campanas. Para el mapa de calor: dow_num 1-7 en filas, hour 0-23 en columnas. Las celdas con gasto y sin conversion son candidatas a ajuste de programacion de anuncios.';



CREATE OR REPLACE VIEW "public"."v_relaciones_violadas" AS
 WITH "ultima" AS (
         SELECT "corridas_verdad"."relacion_id",
            "max"("corridas_verdad"."corrida_el") AS "cuando"
           FROM "public"."corridas_verdad"
          GROUP BY "corridas_verdad"."relacion_id"
        )
 SELECT "r"."familia",
    "r"."nombre",
    "r"."que_afirma",
    "c"."cuenta",
    "c"."valor_izq",
    "c"."valor_der",
    "round"(("c"."diferencia_rel" * (100)::numeric), 2) AS "diferencia_pct",
    "c"."detalle",
    "c"."corrida_el",
    "r"."por_que_existe"
   FROM (("public"."corridas_verdad" "c"
     JOIN "ultima" "u" ON ((("u"."relacion_id" = "c"."relacion_id") AND ("u"."cuando" = "c"."corrida_el"))))
     JOIN "public"."relaciones_verdad" "r" ON (("r"."id" = "c"."relacion_id")))
  WHERE (("c"."veredicto" = 'viola'::"text") AND "r"."activa")
  ORDER BY "r"."familia", "r"."nombre", "c"."cuenta";


ALTER VIEW "public"."v_relaciones_violadas" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_relaciones_violadas" IS 'Violaciones de la ULTIMA corrida de cada relacion. Antes tomaba la ultima por relacion y cuenta, y eso hacia inmortal a cualquier violacion de una combinacion que dejara de correrse: al pasar una relacion de ambito cuenta a global, la fila vieja con cuenta cargada no volvia a tener competencia y seguia mostrandose para siempre.';



CREATE OR REPLACE VIEW "public"."v_incidentes" AS
 WITH "rel" AS (
         SELECT "r"."nombre" AS "causa",
            "r"."familia" AS "clase",
            "string_agg"(DISTINCT "v"."cuenta", ', '::"text" ORDER BY "v"."cuenta") AS "cuentas",
            "count"(*) AS "eventos",
            ( SELECT "string_agg"(DISTINCT ("ct"."ticket_id")::"text", ', '::"text") AS "string_agg"
                   FROM ("public"."controles_de_ticket" "ct"
                     JOIN "public"."tickets" "t" ON (("t"."id" = "ct"."ticket_id")))
                  WHERE (("ct"."relacion_id" = "r"."id") AND ("t"."estado" = 'abierto'::"text"))) AS "tickets_abiertos",
            "min"("r"."por_que_existe") AS "por_que"
           FROM ("public"."v_relaciones_violadas" "v"
             JOIN "public"."relaciones_verdad" "r" ON (("r"."nombre" = "v"."nombre")))
          GROUP BY "r"."id", "r"."nombre", "r"."familia"
        ), "drift" AS (
         SELECT "d"."familia" AS "causa",
            'drift'::"text" AS "clase",
            "string_agg"(DISTINCT "d"."objeto", ', '::"text" ORDER BY "d"."objeto") AS "objetos",
            "count"(*) AS "eventos"
           FROM "public"."v_drift_semantico" "d"
          GROUP BY "d"."familia"
        )
 SELECT 'relacion'::"text" AS "origen",
    "rel"."causa",
    "rel"."clase",
    "rel"."eventos",
    "rel"."cuentas" AS "donde",
    "rel"."tickets_abiertos",
        CASE
            WHEN ("rel"."tickets_abiertos" IS NOT NULL) THEN 'seguimiento'::"text"
            ELSE 'actuar'::"text"
        END AS "severidad",
        CASE
            WHEN ("rel"."tickets_abiertos" IS NOT NULL) THEN (('Ya tiene ticket abierto ('::"text" || "rel"."tickets_abiertos") || '). No es una alerta nueva: es el estado de un bug conocido. Va al resumen.'::"text")
            ELSE 'Sin ticket. Nadie lo esta mirando: abrir uno o corregir.'::"text"
        END AS "que_hacer",
    "md5"(((('relacion|'::"text" || "rel"."causa") || '|'::"text") || "rel"."cuentas")) AS "clave",
    "left"("rel"."por_que", 200) AS "contexto"
   FROM "rel"
UNION ALL
 SELECT 'drift'::"text" AS "origen",
    "drift"."causa",
    "drift"."clase",
    "drift"."eventos",
    "drift"."objetos" AS "donde",
    NULL::"text" AS "tickets_abiertos",
        CASE "drift"."causa"
            WHEN 'ventana_que_miente'::"text" THEN 'actuar'::"text"
            WHEN 'tipo_que_miente'::"text" THEN 'actuar'::"text"
            ELSE 'informativo'::"text"
        END AS "severidad",
        CASE "drift"."causa"
            WHEN 'sin_contrato'::"text" THEN 'No hay accion inmediata: es un hueco, no una falla. Se cierra declarando contratos, empezando por las columnas que alguien cita en un brief.'::"text"
            WHEN 'afirmacion_sin_contrato'::"text" THEN 'Declarar que condicion afirma exactamente cada booleano.'::"text"
            ELSE 'Renombrar o corregir: un nombre que miente sobrevive a cualquier auditoria.'::"text"
        END AS "que_hacer",
    "md5"(('drift|'::"text" || "drift"."causa")) AS "clave",
    NULL::"text" AS "contexto"
   FROM "drift";


ALTER VIEW "public"."v_incidentes" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_incidentes" IS 'Un incidente es una causa, no un evento. Agrupa las senales de calidad por causa y las clasifica en actuar, seguimiento e informativo. Una violacion cuyo ticket ya esta abierto NO es una alerta: es un estado, y va al resumen. Sin esta separacion el tablero muestra el mismo hecho ocho veces y se deja de mirar.';



CREATE OR REPLACE VIEW "public"."v_integridad_conversiones" WITH ("security_invoker"='on') AS
 SELECT "x"."account",
    "x"."date",
    "x"."campaign",
    "x"."conv_por_accion",
    "c"."conversions" AS "conv_campaign",
    "round"(("x"."conv_por_accion" - COALESCE("c"."conversions", (0)::numeric)), 2) AS "diferencia",
        CASE
            WHEN ("abs"(("x"."conv_por_accion" - COALESCE("c"."conversions", (0)::numeric))) > 0.01) THEN 'DESCUADRE'::"text"
            ELSE 'ok'::"text"
        END AS "estado"
   FROM (( SELECT "conversion_actions_daily"."account",
            "conversion_actions_daily"."date",
            "conversion_actions_daily"."campaign",
            "sum"("conversion_actions_daily"."conversions") AS "conv_por_accion"
           FROM "public"."conversion_actions_daily"
          GROUP BY "conversion_actions_daily"."account", "conversion_actions_daily"."date", "conversion_actions_daily"."campaign") "x"
     LEFT JOIN "public"."campaign_daily" "c" ON ((("c"."account" = "x"."account") AND ("c"."date" = "x"."date") AND ("c"."campaign" = "x"."campaign"))))
  WHERE ("abs"(("x"."conv_por_accion" - COALESCE("c"."conversions", (0)::numeric))) > 0.01)
  ORDER BY "x"."account", "x"."date" DESC;


ALTER VIEW "public"."v_integridad_conversiones" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_integridad_conversiones" IS 'Dias donde conversion_actions_daily no suma lo mismo que campaign_daily. Debe estar vacia. Si tiene filas, hay duplicacion (dos versiones del script escribiendo claves distintas) o desfase de extraccion. Detectado por la tarea de BHI el 6 sep 2026.';



CREATE OR REPLACE VIEW "public"."v_integridad_datos" WITH ("security_invoker"='on') AS
 WITH "c" AS (
         SELECT "campaign"."account",
            "campaign"."week_start",
            "round"("sum"("campaign"."cost"), 2) AS "cost_campaign",
            "sum"("campaign"."clicks") AS "clicks_campaign"
           FROM "public"."campaign"
          GROUP BY "campaign"."account", "campaign"."week_start"
        ), "g" AS (
         SELECT "adgroup"."account",
            "adgroup"."week_start",
            "round"("sum"("adgroup"."cost"), 2) AS "cost_adgroup",
            "sum"("adgroup"."clicks") AS "clicks_adgroup"
           FROM "public"."adgroup"
          GROUP BY "adgroup"."account", "adgroup"."week_start"
        ), "k" AS (
         SELECT "keywords"."account",
            "keywords"."week_start",
            "round"("sum"("keywords"."cost"), 2) AS "cost_keywords",
            "sum"("keywords"."clicks") AS "clicks_keywords"
           FROM "public"."keywords"
          GROUP BY "keywords"."account", "keywords"."week_start"
        )
 SELECT "c"."account",
    "c"."week_start",
    "c"."cost_campaign",
    "g"."cost_adgroup",
    "k"."cost_keywords",
    "round"("abs"(("c"."cost_campaign" - COALESCE("g"."cost_adgroup", (0)::numeric))), 2) AS "dif_campana_vs_grupo",
    "round"("abs"(("c"."cost_campaign" - COALESCE("k"."cost_keywords", (0)::numeric))), 2) AS "dif_campana_vs_keyword",
        CASE
            WHEN ("abs"(("c"."cost_campaign" - COALESCE("g"."cost_adgroup", (0)::numeric))) > ("c"."cost_campaign" * 0.02)) THEN 'REVISAR: el gasto por grupo no cuadra con el de campana'::"text"
            WHEN ("abs"(("c"."cost_campaign" - COALESCE("k"."cost_keywords", (0)::numeric))) > ("c"."cost_campaign" * 0.05)) THEN 'ATENCION: el gasto por keyword difiere mas del 5% del de campana'::"text"
            ELSE 'OK'::"text"
        END AS "diagnostico"
   FROM (("c"
     LEFT JOIN "g" ON ((("g"."account" = "c"."account") AND ("g"."week_start" = "c"."week_start"))))
     LEFT JOIN "k" ON ((("k"."account" = "c"."account") AND ("k"."week_start" = "c"."week_start"))));


ALTER VIEW "public"."v_integridad_datos" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_integridad_datos" IS 'Compara el gasto agregado por campana, grupo y keyword de la misma semana. Deberian coincidir. Una diferencia grande indica truncado en la extraccion o filas faltantes. Una diferencia chica entre campana y keyword es normal: campanas sin keywords, como Display o PMax, no aparecen en la tabla de keywords.';



CREATE OR REPLACE VIEW "public"."v_integridad_mapeo" WITH ("security_invoker"='true') AS
 SELECT "account",
    "objetivo",
    "count"(*) AS "reglas",
    (EXISTS ( SELECT 1
           FROM "public"."objetivos_conversion" "o"
          WHERE (("o"."account" = "m"."account") AND ("o"."objetivo" = "m"."objetivo")))) AS "tiene_definicion",
        CASE
            WHEN ("objetivo" = 'generico'::"text") THEN 'ok: generico no necesita definicion'::"text"
            WHEN (EXISTS ( SELECT 1
               FROM "public"."objetivos_conversion" "o"
              WHERE (("o"."account" = "m"."account") AND ("o"."objetivo" = "m"."objetivo")))) THEN 'ok'::"text"
            ELSE 'FALTA: el objetivo se usa en campaign_mapa pero no esta en objetivos_conversion, asi que sus conversiones caen al total de la campana'::"text"
        END AS "lectura"
   FROM "public"."campaign_mapa" "m"
  WHERE "activa"
  GROUP BY "account", "objetivo";


ALTER VIEW "public"."v_integridad_mapeo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_intentos_sospechosos" WITH ("security_invoker"='true') AS
 SELECT "clave",
    "ruta",
    "count"(*) AS "intentos",
    "count"(*) FILTER (WHERE (NOT "exito")) AS "fallos",
    "min"("cuando") AS "desde",
    "max"("cuando") AS "hasta",
        CASE
            WHEN ("count"(*) FILTER (WHERE (NOT "exito")) >= 10) THEN 'posible fuerza bruta'::"text"
            WHEN ("count"(*) >= 100) THEN 'volumen alto'::"text"
            ELSE 'normal'::"text"
        END AS "lectura"
   FROM "public"."intentos"
  WHERE ("cuando" > ("now"() - '24:00:00'::interval))
  GROUP BY "clave", "ruta"
 HAVING (("count"(*) FILTER (WHERE (NOT "exito")) >= 5) OR ("count"(*) >= 60));


ALTER VIEW "public"."v_intentos_sospechosos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_karedo_campaign" WITH ("security_invoker"='on') AS
 SELECT "week_start",
    "week_end",
    "campaign",
    "status",
    "bid_strategy",
    "currency",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "cost",
    "conversions",
    "cost_per_conv",
    "conv_rate",
    "impr_share",
    "top_impr_share",
    "abs_top_impr_share",
    "lost_is_budget",
    "lost_is_rank",
    "click_share"
   FROM "public"."campaign"
  WHERE ("account" = 'KAREDO'::"text");


ALTER VIEW "public"."v_karedo_campaign" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_karedo_campaign" IS 'Campanas de Karedo. Deliberadamente NO expone conv_value ni roas: el valor de conversion es un fijo arbitrario de 20 EUR por registro definido a nivel cuenta, asi que cualquier ROAS derivado no significa nada. Las conversiones son direccionales: Enhanced Conversions con 0-15% de coincidencia y disparo en el clic, no en el registro completado. La direccion del error es DESCONOCIDA.';



CREATE OR REPLACE VIEW "public"."v_keyword_tendencia" WITH ("security_invoker"='on') AS
 SELECT "account",
    "keyword",
    "campaign",
    "ad_group",
    "match_type",
    "count"(*) AS "dias_con_actividad",
    "min"("date") AS "primer_dia",
    "max"("date") AS "ultimo_dia",
    "round"("sum"("cost"), 2) AS "gasto_total",
    "sum"("clicks") AS "clics_total",
    "round"("sum"("conversions"), 2) AS "conversiones_total",
    "round"(("sum"("cost") / NULLIF("sum"("conversions"), (0)::numeric)), 2) AS "cpa_periodo",
    "round"("avg"("quality_score"), 1) AS "qs_promedio",
    "round"("avg"("ctr"), 2) AS "ctr_promedio"
   FROM "public"."keywords_daily"
  GROUP BY "account", "keyword", "campaign", "ad_group", "match_type";


ALTER VIEW "public"."v_keyword_tendencia" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_keyword_tendencia" IS 'Acumulado por keyword sobre el rango disponible. dias_con_actividad indica en cuantos dias tuvo impresiones: una keyword con gasto alto concentrado en pocos dias se comporta distinto de una con gasto parejo, y esa diferencia no se ve en el agregado semanal.';



CREATE OR REPLACE VIEW "public"."v_keywords_analisis" WITH ("security_invoker"='on') AS
 SELECT "account",
    "week_start",
    "campaign",
    "campaign_status",
    "ad_group",
    "ad_group_status",
    "keyword",
    "match_type",
    "keyword_status",
    "serving_status",
    "approval_status",
    "currency",
    "quality_score",
    "qs_ad_relevance",
    "qs_landing_page",
    "qs_expected_ctr",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "cost",
    "conversions",
    "cost_per_conv",
    "conv_rate",
    "impr_share",
    "top_impr_share",
    "lost_is_rank",
    "est_top_of_page_cpc",
    "effective_cpc_bid",
        CASE
            WHEN ("serving_status" = 'RARELY_SERVED'::"text") THEN 'Bajo volumen de busqueda'::"text"
            WHEN (("keyword_status" = 'ENABLED'::"text") AND ("impressions" = (0)::numeric)) THEN 'Activa sin impresiones'::"text"
            WHEN ("approval_status" ~~ '%DISAPPROVED%'::"text") THEN 'Rechazada'::"text"
            WHEN (("quality_score" <= (4)::numeric) AND ("cost" > (0)::numeric)) THEN 'Quality Score bajo'::"text"
            WHEN (("conversions" = (0)::numeric) AND ("cost" > (0)::numeric)) THEN 'Gasta sin convertir'::"text"
            ELSE NULL::"text"
        END AS "motivo"
   FROM "public"."keywords" "k";


ALTER VIEW "public"."v_keywords_analisis" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_keywords_analisis" IS 'INVENTARIO COMPLETO de keywords con metricas y un motivo clasificado cuando hay problema. A diferencia de v_keywords_atencion, incluye tambien las keywords sanas: sirve para explorar, filtrar y ordenar toda la cuenta. No expone conv_value ni all_conversions.';



CREATE OR REPLACE VIEW "public"."v_keywords_atencion" WITH ("security_invoker"='on') AS
 SELECT "account",
    "week_start",
    "campaign",
    "ad_group",
    "keyword",
    "match_type",
    "serving_status",
    "quality_score",
    "impressions",
    "clicks",
    "cost",
    "conversions",
    "est_top_of_page_cpc",
    "effective_cpc_bid",
        CASE
            WHEN ("serving_status" = 'RARELY_SERVED'::"text") THEN 'Bajo volumen de busqueda: no va a servir'::"text"
            WHEN ("impressions" = (0)::numeric) THEN 'Activa pero sin impresiones'::"text"
            WHEN (("quality_score" <= (4)::numeric) AND ("cost" > (0)::numeric)) THEN 'Quality Score bajo con gasto activo'::"text"
            WHEN (("conversions" = (0)::numeric) AND ("cost" > (0)::numeric)) THEN 'Gasta sin convertir'::"text"
            ELSE NULL::"text"
        END AS "motivo"
   FROM "public"."keywords"
  WHERE (("keyword_status" = 'ENABLED'::"text") AND ("campaign_status" = 'ENABLED'::"text") AND ("ad_group_status" = 'ENABLED'::"text") AND (("serving_status" = 'RARELY_SERVED'::"text") OR ("impressions" = (0)::numeric) OR (("quality_score" <= (4)::numeric) AND ("cost" > (0)::numeric)) OR (("conversions" = (0)::numeric) AND ("cost" > (0)::numeric))));


ALTER VIEW "public"."v_keywords_atencion" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_keywords_atencion" IS 'Keywords activas que requieren atencion, con el motivo ya clasificado. Devuelve nombres exactos con su campana y grupo, listos para copiar a un accionable. Evita tener que leer el inventario completo.';



CREATE OR REPLACE VIEW "public"."v_keywords_daily" WITH ("security_invoker"='on') AS
 SELECT "account",
    "date",
    "campaign",
    "ad_group",
    "keyword",
    "match_type",
    "keyword_status",
    "serving_status",
    "currency",
    "quality_score",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "cost",
    "conversions",
    "cost_per_conv",
    "conv_rate",
    "impr_share",
    "top_impr_share",
    "lost_is_rank",
    "public"."madurez_dato"("date") AS "madurez",
    (CURRENT_DATE - "date") AS "dias_transcurridos",
        CASE
            WHEN (("conversions" = (0)::numeric) AND ("cost" > (0)::numeric)) THEN 'Gasta sin convertir'::"text"
            WHEN (("quality_score" <= (4)::numeric) AND ("cost" > (0)::numeric)) THEN 'Quality Score bajo'::"text"
            ELSE NULL::"text"
        END AS "motivo"
   FROM "public"."keywords_daily";


ALTER VIEW "public"."v_keywords_daily" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_keywords_daily" IS 'Keywords con actividad diaria y motivo clasificado. Solo filas con impresiones: la ausencia de una keyword en una fecha significa cero actividad, no dato faltante.';



CREATE OR REPLACE VIEW "public"."v_keywords_entre_locales" WITH ("security_invoker"='true') AS
 SELECT "k"."account",
    "k"."keyword",
    "count"(DISTINCT "d"."location") AS "en_locales",
    "count"(DISTINCT "d"."location") FILTER (WHERE ("k"."conversions" > (0)::numeric)) AS "convierte_en",
    "round"("sum"("k"."cost"), 2) AS "gasto_total",
    "round"("sum"("k"."conversions"), 1) AS "conversiones"
   FROM ("public"."keywords" "k"
     JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "k"."account") AND ("d"."campaign" = "k"."campaign"))))
  WHERE ("k"."week_start" > (( SELECT "max"("x"."week_start") AS "max"
           FROM "public"."keywords" "x"
          WHERE ("x"."account" = "k"."account")) - 28))
  GROUP BY "k"."account", "k"."keyword"
 HAVING ("count"(DISTINCT "d"."location") > 1);


ALTER VIEW "public"."v_keywords_entre_locales" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_keywords_entre_locales" IS 'Una keyword que corre en muchos locales y convierte en pocos es candidata a revision por local, no a pausa global.';



CREATE OR REPLACE VIEW "public"."v_keywords_resueltas" WITH ("security_invoker"='true') AS
 SELECT "k"."account",
    "k"."week_start",
    "d"."location",
    COALESCE("d"."objetivo", 'generico'::"text") AS "objetivo",
    "k"."campaign",
    "k"."ad_group",
    "k"."keyword",
    "k"."match_type",
    "k"."quality_score",
    "k"."impressions",
    "k"."clicks",
    "k"."ctr",
    "k"."avg_cpc",
    "k"."cost",
    "k"."conversions",
    "k"."conv_value",
    "k"."cost_per_conv"
   FROM ("public"."keywords" "k"
     LEFT JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "k"."account") AND ("d"."campaign" = "k"."campaign"))));


ALTER VIEW "public"."v_keywords_resueltas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lecciones_vigentes" WITH ("security_invoker"='true') AS
 SELECT "id",
    "account",
    "fecha",
    "contexto",
    "decision",
    "resultado",
    "leccion",
    "tipo",
    "confianza",
    "veces_confirmada",
    "origen_id",
    "escrita_por"
   FROM "public"."lecciones" "l"
  WHERE (NOT "public"."en_cuarentena"('lecciones'::"text", ("id")::"text"));


ALTER VIEW "public"."v_lecciones_vigentes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_linaje" AS
 SELECT DISTINCT (("dependiente"."relname")::"text" COLLATE "default") AS "objeto",
        CASE "dependiente"."relkind"
            WHEN 'v'::"char" THEN 'vista'::"text"
            WHEN 'm'::"char" THEN 'materializada'::"text"
            ELSE 'tabla'::"text"
        END AS "tipo_objeto",
    (("fuente"."relname")::"text" COLLATE "default") AS "depende_de",
        CASE "fuente"."relkind"
            WHEN 'v'::"char" THEN 'vista'::"text"
            WHEN 'm'::"char" THEN 'materializada'::"text"
            ELSE 'tabla'::"text"
        END AS "tipo_fuente"
   FROM ((((("pg_depend" "d"
     JOIN "pg_rewrite" "r" ON (("r"."oid" = "d"."objid")))
     JOIN "pg_class" "dependiente" ON (("dependiente"."oid" = "r"."ev_class")))
     JOIN "pg_class" "fuente" ON (("fuente"."oid" = "d"."refobjid")))
     JOIN "pg_namespace" "nd" ON (("nd"."oid" = "dependiente"."relnamespace")))
     JOIN "pg_namespace" "nf" ON (("nf"."oid" = "fuente"."relnamespace")))
  WHERE (("d"."classid" = ('"pg_rewrite"'::"regclass")::"oid") AND ("nd"."nspname" = 'public'::"name") AND ("nf"."nspname" = 'public'::"name") AND ("dependiente"."oid" <> "fuente"."oid"));


ALTER VIEW "public"."v_linaje" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_linaje" IS 'Grafo de dependencias a nivel objeto, leido de pg_depend y pg_rewrite. Ya existia en el catalogo. Los nombres van con COLLATE "default" a proposito: relname es name y arrastra collation C, que rompe cualquier recorrido recursivo. Para saber COMO se transforma cada columna hace falta parsear el SQL con sqlglot o LineageX; esto no lo hace.';



CREATE OR REPLACE VIEW "public"."v_location_ranking_bayes" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "d"."account",
            "d"."location",
            "d"."objetivo",
            "sum"("c"."cost") AS "gasto",
            "sum"("c"."conversions") AS "conv",
            "sum"("c"."conv_value") AS "valor"
           FROM ("public"."campaign" "c"
             JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "c"."account") AND ("d"."campaign" = "c"."campaign"))))
          WHERE (("d"."location" IS NOT NULL) AND ("c"."week_start" > (( SELECT "max"("x"."week_start") AS "max"
                   FROM "public"."campaign" "x"
                  WHERE ("x"."account" = "c"."account")) - 28)))
          GROUP BY "d"."account", "d"."location", "d"."objetivo"
        ), "grupo" AS (
         SELECT "base"."account",
            "base"."objetivo",
            ("sum"("base"."gasto") / NULLIF("sum"("base"."conv"), (0)::numeric)) AS "cpa_grupo",
            "count"(*) AS "locales"
           FROM "base"
          GROUP BY "base"."account", "base"."objetivo"
        )
 SELECT "b"."account",
    "b"."location" AS "local",
    "b"."objetivo",
    "b"."objetivo" AS "grupo_par",
    "round"("b"."gasto", 2) AS "gasto_4sem",
    "round"("b"."conv", 1) AS "conv_4sem",
    "round"(("b"."gasto" / NULLIF("b"."conv", (0)::numeric)), 2) AS "cpa_crudo",
    "round"((("b"."gasto" + ((10)::numeric * COALESCE("g"."cpa_grupo", (0)::numeric))) / NULLIF(("b"."conv" + (10)::numeric), (0)::numeric)), 2) AS "cpa_ajustado",
    "g"."locales" AS "en_el_grupo",
        CASE
            WHEN ("g"."locales" < 5) THEN (('NO COMPARABLE: su grupo tiene '::"text" || "g"."locales") || ' local(es). Con menos de 5, el promedio del grupo es practicamente este mismo local y la comparacion no dice nada. No usar para recomendar escalar ni pausar.'::"text")
            WHEN ("b"."conv" < (5)::numeric) THEN 'volumen bajo: el CPA crudo es ruido, mirar el ajustado'::"text"
            ELSE (((('comparable: '::"text" || "g"."locales") || ' locales en el grupo y '::"text") || "round"("b"."conv", 1)) || ' conversiones'::"text")
        END AS "lectura",
    (("g"."locales" >= 5) AND ("b"."conv" >= (5)::numeric)) AS "apto_para_recomendar"
   FROM ("base" "b"
     JOIN "grupo" "g" ON ((("g"."account" = "b"."account") AND ("g"."objetivo" = "b"."objetivo"))));


ALTER VIEW "public"."v_location_ranking_bayes" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_location_ranking_bayes" IS 'Ticket 35. Ranking de locales con encogimiento hacia el CPA de su grupo. apto_para_recomendar dice si la comparacion se sostiene: un grupo de menos de 5 locales tiene un promedio que es casi el propio local, y de ahi salian recomendaciones de escalar que no se sostenian.';



CREATE OR REPLACE VIEW "public"."v_memoria_pendiente" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tipo",
    "texto"
   FROM "public"."memoria"
  WHERE ("embedding" IS NULL)
  ORDER BY "creado"
 LIMIT 50;


ALTER VIEW "public"."v_memoria_pendiente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_memoria_sospechosa" WITH ("security_invoker"='true') AS
 SELECT "id",
    "account",
    "fecha",
    "left"("texto", 150) AS "texto",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tickets" "t"
          WHERE (("t"."estado" = 'resuelto'::"text") AND (NOT ("t"."cuenta" IS DISTINCT FROM "m"."account")) AND (("t"."resuelto_el")::"date" > "m"."fecha"))) AS "tickets_resueltos_despues",
    'Afirma que algo esta roto o vacio, y despues se resolvieron tickets de la misma cuenta. Verificar si el sintoma sigue: si no, cuarentena; si es un principio general, marcar en memoria_revisada.'::"text" AS "lectura"
   FROM "public"."memoria" "m"
  WHERE ((NOT "public"."en_cuarentena"('memoria'::"text", ("id")::"text")) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."memoria_revisada" "r"
          WHERE ("r"."memoria_id" = "m"."id")))) AND ("texto" ~* '\m(vacio|vacia|no existe|0 filas|cero filas|roto|no devuelve|sin filas|no se puede)\M'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."tickets" "t"
          WHERE (("t"."estado" = 'resuelto'::"text") AND (NOT ("t"."cuenta" IS DISTINCT FROM "m"."account")) AND (("t"."resuelto_el")::"date" > "m"."fecha")))));


ALTER VIEW "public"."v_memoria_sospechosa" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_memoria_vigente" WITH ("security_invoker"='true') AS
 SELECT "id",
    "account",
    "tipo",
    "fecha",
    "texto",
    "origen_id",
    "embedding",
    "creado"
   FROM "public"."memoria" "m"
  WHERE (NOT "public"."en_cuarentena"('memoria'::"text", ("id")::"text"));


ALTER VIEW "public"."v_memoria_vigente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_retencion_tablas" AS
 SELECT 'campaign_daily'::"text" AS "tabla",
    ("count"(DISTINCT "campaign_daily"."date"))::integer AS "dias"
   FROM "public"."campaign_daily"
UNION ALL
 SELECT 'keywords_daily'::"text" AS "tabla",
    ("count"(DISTINCT "keywords_daily"."date"))::integer AS "dias"
   FROM "public"."keywords_daily"
UNION ALL
 SELECT 'search_terms_daily'::"text" AS "tabla",
    ("count"(DISTINCT "search_terms_daily"."date"))::integer AS "dias"
   FROM "public"."search_terms_daily"
UNION ALL
 SELECT 'adgroup_daily'::"text" AS "tabla",
    ("count"(DISTINCT "adgroup_daily"."date"))::integer AS "dias"
   FROM "public"."adgroup_daily"
UNION ALL
 SELECT 'campaign'::"text" AS "tabla",
    (("count"(DISTINCT "campaign"."week_start") * 7))::integer AS "dias"
   FROM "public"."campaign"
UNION ALL
 SELECT 'keywords'::"text" AS "tabla",
    (("count"(DISTINCT "keywords"."week_start") * 7))::integer AS "dias"
   FROM "public"."keywords"
UNION ALL
 SELECT 'search_terms'::"text" AS "tabla",
    (("count"(DISTINCT "search_terms"."week_start") * 7))::integer AS "dias"
   FROM "public"."search_terms"
UNION ALL
 SELECT 'conversion_actions'::"text" AS "tabla",
    (("count"(DISTINCT "conversion_actions"."week_start") * 7))::integer AS "dias"
   FROM "public"."conversion_actions"
UNION ALL
 SELECT 'adgroup'::"text" AS "tabla",
    (("count"(DISTINCT "adgroup"."week_start") * 7))::integer AS "dias"
   FROM "public"."adgroup";


ALTER VIEW "public"."v_retencion_tablas" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_retencion_tablas" IS 'Cuantos dias tiene REALMENTE cada tabla de hechos. Las diarias tienen 17, las semanales 91. Es el dato que convierte al linter de ventanas en un chequeo preciso en vez de una alarma que grita en todos lados.';



CREATE OR REPLACE VIEW "public"."v_metricas_reescritas" AS
 WITH "pedidos" AS (
         SELECT ("c"."relname")::"text" AS "objeto",
            (("regexp_match"("pg_get_viewdef"("c"."oid"), 'current_date\s*-\s*([0-9]+)'::"text"))[1])::integer AS "dias_pedidos"
           FROM ("pg_class" "c"
             JOIN "pg_namespace" "n" ON (("n"."oid" = "c"."relnamespace")))
          WHERE (("n"."nspname" = 'public'::"name") AND ("c"."relkind" = ANY (ARRAY['v'::"char", 'm'::"char"])) AND ("pg_get_viewdef"("c"."oid") ~ 'current_date\s*-\s*[0-9]+'::"text") AND ("c"."relname" <> ALL (ARRAY['v_metricas_reescritas'::"name", 'v_ventana_real'::"name", 'v_retencion_tablas'::"name", 'v_drift_semantico'::"name"])))
        ), "fuentes" AS (
         SELECT "p"."objeto",
            "p"."dias_pedidos",
            "r"."tabla",
            "r"."dias" AS "dias_disponibles"
           FROM (("pedidos" "p"
             JOIN "public"."v_linaje" "l" ON ((("l"."objeto" = "p"."objeto") AND ("l"."tipo_fuente" = 'tabla'::"text"))))
             JOIN "public"."v_retencion_tablas" "r" ON (("r"."tabla" = "l"."depende_de")))
        )
 SELECT "objeto",
    'ventana'::"text" AS "metrica",
    "tabla" AS "lee_de",
    "dias_pedidos",
    "dias_disponibles",
    (((((((((('Pide '::"text" || "dias_pedidos") || ' dias sobre '::"text") || "tabla") || ', que tiene '::"text") || "dias_disponibles") || '. Devuelve el total de '::"text") || "dias_disponibles") || ' dias con la etiqueta de '::"text") || "dias_pedidos") || '.'::"text") AS "por_que",
    'ventana_metrica(cuenta, tipo)'::"text" AS "usar_en_su_lugar"
   FROM "fuentes" "f"
  WHERE ("dias_pedidos" > "dias_disponibles");


ALTER VIEW "public"."v_metricas_reescritas" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_metricas_reescritas" IS 'Vistas que piden una ventana mayor que la que su tabla de origen tiene. MIDE en vez de marcar el patron: cruza la ventana pedida, parseada de la definicion, contra la retencion real, siguiendo el linaje. La version anterior marcaba 9 objetos y los 9 eran falsos positivos.';



CREATE OR REPLACE VIEW "public"."v_negativas_que_bloquean" AS
 WITH "st" AS (
         SELECT "search_terms"."account",
            "search_terms"."campaign",
            "search_terms"."ad_group",
            "search_terms"."search_term",
            "sum"("search_terms"."conversions") AS "conv",
            "sum"("search_terms"."cost") AS "cost"
           FROM "public"."search_terms"
          WHERE (("search_terms"."week_start" > (CURRENT_DATE - 90)) AND ("search_terms"."cost" > (0)::numeric))
          GROUP BY "search_terms"."account", "search_terms"."campaign", "search_terms"."ad_group", "search_terms"."search_term"
        ), "neg" AS (
         SELECT DISTINCT "negatives"."account",
            "negatives"."campaign",
            "negatives"."negative_keyword",
            "negatives"."match_type"
           FROM "public"."negatives"
          WHERE (("negatives"."level" = 'campaign'::"text") AND ("negatives"."week_start" = ( SELECT "max"("negatives_1"."week_start") AS "max"
                   FROM "public"."negatives" "negatives_1")))
        )
 SELECT "n"."account",
    "n"."campaign",
    "n"."negative_keyword",
    "n"."match_type",
    "round"("sum"("s"."cost")) AS "gasto_de_lo_bloqueado_90d",
    "round"("sum"("s"."conv"), 1) AS "conversiones_de_lo_bloqueado_90d",
    "count"(DISTINCT "s"."ad_group") AS "grupos_afectados",
    "string_agg"(DISTINCT "s"."ad_group", ' | '::"text") AS "en_grupos",
    (('Negativa a nivel CAMPANA que alcanza terminos que convirtieron en '::"text" || "string_agg"(DISTINCT "s"."ad_group", ' | '::"text")) || '. Si ese grupo tiene que servir esas busquedas, la negativa va a nivel grupo en los otros, no en la campana. Cruce por ILIKE: verificar en pantalla antes de tocar.'::"text") AS "lectura"
   FROM ("neg" "n"
     JOIN "st" "s" ON ((("s"."account" = "n"."account") AND ("s"."campaign" = "n"."campaign") AND ("s"."search_term" ~~* (('%'::"text" || "n"."negative_keyword") || '%'::"text")) AND ("s"."conv" > (0)::numeric))))
  GROUP BY "n"."account", "n"."campaign", "n"."negative_keyword", "n"."match_type";


ALTER VIEW "public"."v_negativas_que_bloquean" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_negativas_que_bloquean" IS 'Negativas puestas a nivel campana que alcanzan terminos que convirtieron en algun grupo de esa campana. El cruce es por ILIKE y aproxima la concordancia de Google: da falsos positivos con negativas en amplia, hay que verificar en pantalla. Existe porque una negativa de campana tiene un radio mayor que la evidencia que la motivo.';



CREATE OR REPLACE VIEW "public"."v_ngrams_sin_conversion" WITH ("security_invoker"='on') AS
 SELECT "account",
    "week_start",
    "palabra",
    "count"(DISTINCT "search_term") AS "terminos_distintos",
    "round"("sum"("cost"), 2) AS "costo_total",
    "sum"("clicks") AS "clics_totales"
   FROM ( SELECT "search_terms"."account",
            "search_terms"."week_start",
            "search_terms"."search_term",
            "search_terms"."cost",
            "search_terms"."clicks",
            "search_terms"."conversions",
            "regexp_split_to_table"("lower"("search_terms"."search_term"), '\s+'::"text") AS "palabra"
           FROM "public"."search_terms"
          WHERE ("search_terms"."cost" > (0)::numeric)) "sub"
  WHERE ("length"("palabra") > 2)
  GROUP BY "account", "week_start", "palabra"
 HAVING (("sum"("conversions") = (0)::numeric) AND ("count"(DISTINCT "search_term") > 1))
  ORDER BY ("round"("sum"("cost"), 2)) DESC;


ALTER VIEW "public"."v_ngrams_sin_conversion" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_ngrams_sin_conversion" IS 'Palabras sueltas que aparecen en varios terminos de busqueda, acumulan gasto y no traen ninguna conversion. Encuentra fugas invisibles: ningun termino individual llama la atencion, pero la palabra suma. Candidatas a negativa amplia. El umbral de gasto se aplica al consultar, porque las monedas difieren entre cuentas.';



CREATE OR REPLACE VIEW "public"."v_notas_fantasma" WITH ("security_invoker"='true') AS
 SELECT "objeto",
    "capa",
    "left"("usar_para", 80) AS "usar_para",
    'Documentado en notas_de_objetos y NO EXISTE en el esquema. Un agente que lo consulte pierde la corrida. O se crea el objeto, o se borra la nota.'::"text" AS "lectura"
   FROM "public"."notas_de_objetos" "n"
  WHERE ((NOT (EXISTS ( SELECT 1
           FROM "pg_views" "v"
          WHERE (("v"."schemaname" = 'public'::"name") AND ("v"."viewname" = "n"."objeto"))))) AND (NOT (EXISTS ( SELECT 1
           FROM "pg_proc" "p"
          WHERE (("p"."pronamespace" = ('"public"'::"regnamespace")::"oid") AND ("p"."proname" = "n"."objeto"))))) AND (NOT (EXISTS ( SELECT 1
           FROM "information_schema"."tables" "t"
          WHERE ((("t"."table_schema")::"name" = 'public'::"name") AND (("t"."table_name")::"name" = "n"."objeto"))))));


ALTER VIEW "public"."v_notas_fantasma" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_notas_fantasma" IS 'Objetos documentados que no existen. Nacio de encontrar 4 vistas de cadena documentadas y nunca creadas.';



CREATE OR REPLACE VIEW "public"."v_notas_pendientes" WITH ("security_invoker"='true') AS
 SELECT "id",
    "creada",
    COALESCE("account", '(sistema)'::"text") AS "cuenta",
    "para",
    "tipo",
    "contenido",
    "round"((EXTRACT(epoch FROM ("now"() - "creada")) / 86400.0), 1) AS "dias_esperando"
   FROM "public"."notas_para_agentes"
  WHERE ("atendida_el" IS NULL)
  ORDER BY "creada";


ALTER VIEW "public"."v_notas_pendientes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_notion_vs_supabase" WITH ("security_invoker"='true') AS
 SELECT "c"."account",
    "x"."campo",
    "x"."en_supabase",
    "x"."en_notion",
    (('Notion y Supabase no coinciden en '::"text" || "x"."campo") || '. El que manda depende del campo: el CID y la moneda los define Notion, las plataformas y el perfil los define el sistema. Igualarlos.'::"text") AS "lectura"
   FROM (("public"."cuentas" "c"
     JOIN "public"."notion_espejo_cuentas" "n" ON (("n"."account" = "c"."account")))
     CROSS JOIN LATERAL ( VALUES ('cid'::"text","c"."cid","n"."customer_id"), ('moneda'::"text","c"."moneda","n"."moneda"), ('presupuesto_diario'::"text",("c"."presupuesto_diario")::"text",("n"."presupuesto_diario")::"text"), ('plataformas'::"text","array_to_string"(("c"."plataformas")::"text"[], ','::"text"),"array_to_string"(ARRAY( SELECT
                        CASE
                            WHEN ("ca"."ca" ~~* '%meta%'::"text") THEN 'meta'::"text"
                            WHEN ("ca"."ca" ~~* '%google ads%'::"text") THEN 'google'::"text"
                            ELSE NULL::"text"
                        END AS "case"
                   FROM "unnest"("n"."canales") "ca"("ca")
                  WHERE (("ca"."ca" ~~* '%meta%'::"text") OR ("ca"."ca" ~~* '%google ads%'::"text"))
                  ORDER BY
                        CASE
                            WHEN ("ca"."ca" ~~* '%meta%'::"text") THEN 'meta'::"text"
                            WHEN ("ca"."ca" ~~* '%google ads%'::"text") THEN 'google'::"text"
                            ELSE NULL::"text"
                        END), ','::"text"))) "x"("campo", "en_supabase", "en_notion"))
  WHERE ("c"."activa" AND (COALESCE("x"."en_supabase", ''::"text") IS DISTINCT FROM COALESCE("x"."en_notion", ''::"text")));


ALTER VIEW "public"."v_notion_vs_supabase" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_novedades" WITH ("security_invoker"='true') AS
 SELECT "n"."id",
    "n"."tipo",
    "n"."account",
    "n"."ref_tipo",
    "n"."ref_id",
    "n"."titulo",
    "n"."texto",
    "n"."autor",
    "n"."creada",
    "n"."leida_el",
    "n"."clave",
    "n"."actor",
    "n"."verbo",
    "n"."objeto_titulo",
    COALESCE("n"."objeto_titulo", "e"."titulo") AS "objeto"
   FROM ("public"."novedades" "n"
     LEFT JOIN "public"."accionables_espejo" "e" ON ((("n"."ref_tipo" = 'accionable'::"text") AND ("e"."notion_id" = "n"."ref_id"))))
  WHERE ("n"."leida_el" IS NULL)
  ORDER BY "n"."creada" DESC;


ALTER VIEW "public"."v_novedades" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_novedades_7d" WITH ("security_invoker"='true') AS
 SELECT "n"."id",
    "n"."tipo",
    "n"."account",
    "n"."ref_tipo",
    "n"."ref_id",
    "n"."titulo",
    "n"."texto",
    "n"."autor",
    "n"."creada",
    "n"."leida_el",
    "n"."clave",
    "n"."actor",
    "n"."verbo",
    "n"."objeto_titulo",
    COALESCE("n"."objeto_titulo", "e"."titulo") AS "objeto"
   FROM ("public"."novedades" "n"
     LEFT JOIN "public"."accionables_espejo" "e" ON ((("n"."ref_tipo" = 'accionable'::"text") AND ("e"."notion_id" = "n"."ref_id"))))
  WHERE ("n"."creada" >= ("now"() - '7 days'::interval))
  ORDER BY "n"."creada" DESC;


ALTER VIEW "public"."v_novedades_7d" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_novedades_agrupadas" WITH ("security_invoker"='true') AS
 SELECT COALESCE("account", '(sistema)'::"text") AS "cuenta",
    "tipo",
    COALESCE("actor", "autor", 'sistema'::"text") AS "actor",
    ("creada")::"date" AS "dia",
    "count"(*) AS "cuantas",
        CASE
            WHEN ("count"(*) = 1) THEN "max"("titulo")
            ELSE ((((("count"(*) || ' · '::"text") || COALESCE("max"("verbo"), "tipo")) || ' en '::"text") || "count"(*)) || ' entidades'::"text")
        END AS "titulo",
        CASE
            WHEN ("count"(*) = 1) THEN "max"("texto")
            ELSE "left"("string_agg"(DISTINCT COALESCE("objeto_titulo", "titulo"), ', '::"text"), 220)
        END AS "detalle",
    "min"("id") AS "id_representante",
    "array_agg"("id" ORDER BY "id") AS "ids",
    "max"("creada") AS "ultima"
   FROM "public"."v_novedades" "n"
  GROUP BY COALESCE("account", '(sistema)'::"text"), "tipo", COALESCE("actor", "autor", 'sistema'::"text"), (("creada")::"date")
  ORDER BY ("max"("creada")) DESC;


ALTER VIEW "public"."v_novedades_agrupadas" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_novedades_agrupadas" IS 'Novedades del mismo tipo, actor, cuenta y dia agrupadas. Habia 32 sin leer y eran DOS hechos: AI Max en 16 campanas y el agente semanal editando 14 accionables. Un evento por entidad cuando el hecho es uno solo es el patron que mas satura la bandeja.';



CREATE OR REPLACE VIEW "public"."v_objetos_sin_documentar" WITH ("security_invoker"='true') AS
 SELECT "capa",
    "objeto",
    'Existe en el esquema y ningun agente sabe para que sirve. Agregar una fila en notas_de_objetos.'::"text" AS "lectura"
   FROM "public"."diccionario_datos"() "diccionario_datos"("capa", "objeto", "usar_para", "cuidado")
  WHERE ("usar_para" ~~ '(sin documentar%'::"text");


ALTER VIEW "public"."v_objetos_sin_documentar" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_objetos_tocados_dos_veces" WITH ("security_invoker"='true') AS
 SELECT "unnest"("objetos") AS "objeto",
    "count"(*) AS "veces",
    "max"("cuando") AS "ultimo",
    'Este objeto se toco mas de una vez en 48 horas. Revisa que el segundo cambio no haya deshecho el primero.'::"text" AS "lectura"
   FROM "public"."cambios_de_sistema" "a"
  WHERE ("cuando" > ("now"() - '48:00:00'::interval))
  GROUP BY ("unnest"("objetos"))
 HAVING ("count"(*) > 1);


ALTER VIEW "public"."v_objetos_tocados_dos_veces" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_para_actuar" AS
 SELECT "i"."origen",
    "i"."causa",
    "i"."clase",
    "i"."eventos",
    "i"."donde",
    "i"."tickets_abiertos",
    "i"."severidad",
    "i"."que_hacer",
    "i"."clave",
    "i"."contexto"
   FROM ("public"."v_incidentes" "i"
     LEFT JOIN "public"."incidentes_atendidos" "a" ON (("a"."clave" = "i"."clave")))
  WHERE (("i"."severidad" = 'actuar'::"text") AND ("a"."clave" IS NULL))
  ORDER BY "i"."eventos" DESC;


ALTER VIEW "public"."v_para_actuar" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_para_actuar" IS 'Lo unico que pide una accion ahora mismo. Si esta vista esta vacia, no hay nada que hacer con la calidad de datos hoy. Lo demas vive en v_incidentes y se mira cuando uno quiere, no cuando el sistema grita.';



CREATE OR REPLACE VIEW "public"."v_pendientes_subir_google" WITH ("security_invoker"='on') AS
 SELECT "f"."account",
    "f"."external_id",
    "f"."lead_name",
    "f"."stage_name",
    "f"."stage_value",
    "f"."currency",
    "f"."click_id",
    "f"."click_id_type",
    "f"."reached_at",
    "s"."google_conversion_action",
        CASE
            WHEN ("f"."click_id" IS NULL) THEN 'SIN CLICK ID: no se puede atribuir'::"text"
            WHEN ("s"."google_conversion_action" IS NULL) THEN 'SIN ACCION EN GOOGLE: crear primero'::"text"
            ELSE 'LISTO'::"text"
        END AS "estado"
   FROM ("public"."funnel_events" "f"
     JOIN "public"."funnel_stages" "s" ON ((("s"."account" = "f"."account") AND ("s"."stage_order" = "f"."stage_order"))))
  WHERE (NOT "f"."uploaded_to_google")
  ORDER BY "f"."reached_at";


ALTER VIEW "public"."v_pendientes_subir_google" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_pendientes_subir_google" IS 'Eventos de funnel que todavia no se subieron a Google. LISTO = tiene click id y la accion existe. Los otros dos estados explican por que no se puede.';



CREATE OR REPLACE VIEW "public"."v_por_location_semanal" WITH ("security_invoker"='true') AS
 SELECT "v"."account",
    "v"."week_start",
    COALESCE("v"."location", '(sin local)'::"text") AS "location",
    "l"."nombre",
    "v"."objetivo",
    "count"(DISTINCT "v"."campaign") AS "campanas",
    "sum"("v"."cost") AS "gasto",
    "sum"("v"."clicks") AS "clics",
    "sum"("v"."conversiones") AS "conversiones",
    ("sum"("v"."cost") / NULLIF("sum"("v"."conversiones"), (0)::numeric)) AS "cpa"
   FROM (( SELECT "v_campana_resuelta"."account",
            "v_campana_resuelta"."week_start",
            "v_campana_resuelta"."campaign",
            "v_campana_resuelta"."cost",
            "v_campana_resuelta"."clicks",
            "v_campana_resuelta"."conversions" AS "conversiones",
            "v_campana_resuelta"."location",
            "v_campana_resuelta"."objetivo"
           FROM "public"."v_campana_resuelta") "v"
     LEFT JOIN "public"."locations" "l" ON ((("l"."account" = "v"."account") AND ("l"."codigo" = "v"."location"))))
  GROUP BY "v"."account", "v"."week_start", "v"."location", "l"."nombre", "v"."objetivo";


ALTER VIEW "public"."v_por_location_semanal" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_por_objetivo_semanal" WITH ("security_invoker"='true') AS
 WITH "conv" AS (
         SELECT "ca"."account",
            "ca"."week_start",
            "ca"."campaign",
            "o"."objetivo",
            "sum"("ca"."conversions") AS "conv_obj",
            "sum"("ca"."conv_value") AS "valor_obj"
           FROM ("public"."conversion_actions" "ca"
             JOIN "public"."objetivos_conversion" "o" ON ((("o"."account" = "ca"."account") AND ("ca"."conversion_action" = ANY ("o"."conversion_actions")))))
          GROUP BY "ca"."account", "ca"."week_start", "ca"."campaign", "o"."objetivo"
        )
 SELECT "v"."account",
    "v"."week_start",
    "v"."objetivo",
    "count"(DISTINCT "v"."campaign") AS "campanas",
    "sum"("v"."cost") AS "gasto",
    "sum"("v"."clicks") AS "clics",
    COALESCE("sum"("cv"."conv_obj"), "sum"("v"."conversions")) AS "conversiones",
    COALESCE("sum"("cv"."valor_obj"), "sum"("v"."conv_value")) AS "valor",
    ("sum"("v"."cost") / NULLIF(COALESCE("sum"("cv"."conv_obj"), "sum"("v"."conversions")), (0)::numeric)) AS "cpa",
    (COALESCE("sum"("cv"."valor_obj"), "sum"("v"."conv_value")) / NULLIF("sum"("v"."cost"), (0)::numeric)) AS "roas"
   FROM ("public"."v_campana_resuelta" "v"
     LEFT JOIN "conv" "cv" ON ((("cv"."account" = "v"."account") AND ("cv"."week_start" = "v"."week_start") AND ("cv"."campaign" = "v"."campaign") AND ("cv"."objetivo" = "v"."objetivo"))))
  GROUP BY "v"."account", "v"."week_start", "v"."objetivo";


ALTER VIEW "public"."v_por_objetivo_semanal" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_por_que_limitada" WITH ("security_invoker"='true') AS
 WITH "k" AS (
         SELECT "keywords"."account",
            "keywords"."week_start",
            "keywords"."keyword",
            "keywords"."ad_group",
            "keywords"."cost",
            "keywords"."quality_score",
                CASE "keywords"."qs_expected_ctr"
                    WHEN 'BELOW_AVERAGE'::"text" THEN 1
                    ELSE 0
                END AS "ctr_bajo",
                CASE "keywords"."qs_ad_relevance"
                    WHEN 'BELOW_AVERAGE'::"text" THEN 1
                    ELSE 0
                END AS "rel_baja",
                CASE "keywords"."qs_landing_page"
                    WHEN 'BELOW_AVERAGE'::"text" THEN 1
                    ELSE 0
                END AS "lp_baja"
           FROM "public"."keywords"
          WHERE (("keywords"."week_start" = ( SELECT "max"("keywords_1"."week_start") AS "max"
                   FROM "public"."keywords" "keywords_1")) AND ("keywords"."cost" > (0)::numeric) AND ("keywords"."quality_score" IS NOT NULL))
        ), "agg" AS (
         SELECT "k"."account",
            "count"(*) AS "kws",
            "sum"("k"."cost") AS "gasto",
            "round"((("sum"(("k"."cost" * ("k"."ctr_bajo")::numeric)) / NULLIF("sum"("k"."cost"), (0)::numeric)) * (100)::numeric)) AS "pct_gasto_ctr_bajo",
            "round"((("sum"(("k"."cost" * ("k"."rel_baja")::numeric)) / NULLIF("sum"("k"."cost"), (0)::numeric)) * (100)::numeric)) AS "pct_gasto_rel_baja",
            "round"((("sum"(("k"."cost" * ("k"."lp_baja")::numeric)) / NULLIF("sum"("k"."cost"), (0)::numeric)) * (100)::numeric)) AS "pct_gasto_lp_baja",
            "sum"("k"."ctr_bajo") AS "n_ctr",
            "sum"("k"."rel_baja") AS "n_rel",
            "sum"("k"."lp_baja") AS "n_lp",
            "round"("avg"("k"."quality_score"), 1) AS "qs_promedio",
            "round"(("sum"(("k"."cost" * "k"."quality_score")) / NULLIF("sum"("k"."cost"), (0)::numeric)), 1) AS "qs_ponderado"
           FROM "k"
          GROUP BY "k"."account"
        )
 SELECT "a"."account",
    "a"."kws",
    "a"."gasto",
    "a"."pct_gasto_ctr_bajo",
    "a"."pct_gasto_rel_baja",
    "a"."pct_gasto_lp_baja",
    "a"."n_ctr",
    "a"."n_rel",
    "a"."n_lp",
    "a"."qs_promedio",
    "a"."qs_ponderado",
    "h"."veredicto" AS "headroom",
        CASE
            WHEN (GREATEST("a"."pct_gasto_ctr_bajo", "a"."pct_gasto_rel_baja", "a"."pct_gasto_lp_baja") < (15)::numeric) THEN 'Los tres componentes estan en promedio o mejor. Si esta limitada por ranking, es por puja, no por calidad.'::"text"
            WHEN ("a"."pct_gasto_lp_baja" = GREATEST("a"."pct_gasto_ctr_bajo", "a"."pct_gasto_rel_baja", "a"."pct_gasto_lp_baja")) THEN (((((('La landing pesa mas: '::"text" || "a"."pct_gasto_lp_baja") || '% del gasto va a keywords con experiencia de landing bajo el promedio ('::"text") || "a"."n_lp") || ' de '::"text") || "a"."kws") || '). Es lo que solo el cliente puede cambiar.'::"text")
            WHEN ("a"."pct_gasto_rel_baja" = GREATEST("a"."pct_gasto_ctr_bajo", "a"."pct_gasto_rel_baja", "a"."pct_gasto_lp_baja")) THEN (((((('La relevancia del anuncio pesa mas: '::"text" || "a"."pct_gasto_rel_baja") || '% del gasto va a keywords cuyo anuncio no las menciona ('::"text") || "a"."n_rel") || ' de '::"text") || "a"."kws") || '). Se arregla con RSA que repitan la keyword.'::"text")
            ELSE (((((('El CTR esperado pesa mas: '::"text" || "a"."pct_gasto_ctr_bajo") || '% del gasto va a keywords que Google espera que clickeen poco ('::"text") || "a"."n_ctr") || ' de '::"text") || "a"."kws") || '). Titulares mas directos o concordancia mas cerrada.'::"text")
        END AS "por_que",
    ( SELECT COALESCE("jsonb_agg"("jsonb_build_object"('keyword', "x"."keyword", 'grupo', "x"."ad_group", 'gasto', "round"("x"."cost", 2), 'qs', "x"."quality_score", 'ctr', ("x"."ctr_bajo" = 1), 'rel', ("x"."rel_baja" = 1), 'lp', ("x"."lp_baja" = 1)) ORDER BY "x"."cost" DESC), '[]'::"jsonb") AS "coalesce"
           FROM ( SELECT "k"."account",
                    "k"."week_start",
                    "k"."keyword",
                    "k"."ad_group",
                    "k"."cost",
                    "k"."quality_score",
                    "k"."ctr_bajo",
                    "k"."rel_baja",
                    "k"."lp_baja"
                   FROM "k"
                  WHERE (("k"."account" = "a"."account") AND ((("k"."ctr_bajo" + "k"."rel_baja") + "k"."lp_baja") > 0))
                  ORDER BY "k"."cost" DESC
                 LIMIT 8) "x") AS "peores"
   FROM ("agg" "a"
     LEFT JOIN "public"."v_headroom" "h" ON (("h"."account" = "a"."account")));


ALTER VIEW "public"."v_por_que_limitada" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_por_que_limitada" IS 'Descompone "limitada por ranking" en su causa: CTR esperado, relevancia del anuncio o experiencia de landing, ponderado por gasto. Cada causa tiene un remedio distinto; la landing es la unica que depende del cliente.';



CREATE OR REPLACE VIEW "public"."v_primaria_recomendada" WITH ("security_invoker"='on') AS
 SELECT "account",
    ( SELECT "f"."stage_name"
           FROM "public"."funnel_stages" "f"
          WHERE (("f"."account" = "a"."account") AND ("f"."google_status" = 'primaria'::"text"))
          ORDER BY "f"."stage_order"
         LIMIT 1) AS "primaria_actual",
    ( SELECT "f"."stage_name"
           FROM "public"."funnel_stages" "f"
          WHERE (("f"."account" = "a"."account") AND "f"."listo_para_primaria" AND ("f"."stage_order" > 1))
          ORDER BY "f"."stage_order" DESC
         LIMIT 1) AS "primaria_recomendada",
    ( SELECT "f"."stage_value"
           FROM "public"."funnel_stages" "f"
          WHERE (("f"."account" = "a"."account") AND "f"."listo_para_primaria" AND ("f"."stage_order" > 1))
          ORDER BY "f"."stage_order" DESC
         LIMIT 1) AS "valor_primaria_recomendada",
    ( SELECT "count"(*) AS "count"
           FROM "public"."funnel_stages" "f"
          WHERE (("f"."account" = "a"."account") AND ("f"."google_status" = 'no_existe'::"text") AND ("f"."source" <> 'karedo_backend'::"text"))) AS "etapas_por_crear",
    ( SELECT "count"(*) AS "count"
           FROM "public"."funnel_stages" "f"
          WHERE (("f"."account" = "a"."account") AND ("f"."source" = 'karedo_backend'::"text"))) AS "etapas_bloqueadas_por_integracion",
        CASE
            WHEN (( SELECT "count"(*) AS "count"
               FROM "public"."funnel_stages" "f"
              WHERE (("f"."account" = "a"."account") AND "f"."listo_para_primaria" AND ("f"."stage_order" > 1))) = 0) THEN 'Ninguna etapa intermedia tiene 15+/mes. Primero crear las acciones secundarias y acumular'::"text"
            ELSE ('Mover la puja a '::"text" || ( SELECT "f"."stage_name"
               FROM "public"."funnel_stages" "f"
              WHERE (("f"."account" = "a"."account") AND "f"."listo_para_primaria" AND ("f"."stage_order" > 1))
              ORDER BY "f"."stage_order" DESC
             LIMIT 1))
        END AS "recomendacion"
   FROM ( SELECT DISTINCT "funnel_stages"."account"
           FROM "public"."funnel_stages") "a";


ALTER VIEW "public"."v_primaria_recomendada" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_primaria_recomendada" IS 'Una fila por cuenta: cual es la primaria hoy, cual deberia ser segun volumen, y que falta para llegar. La regla: la primaria debe ser la etapa mas profunda con 15+ eventos al mes. Mas profunda = mejor senal; 15+ = suficiente para que Smart Bidding aprenda.';



CREATE OR REPLACE VIEW "public"."v_primarias_solapadas" AS
 WITH "reales" AS (
         SELECT "ca"."account",
            "ca"."campaign",
            "ca"."conversion_action",
            "round"("sum"("ca"."conversions"), 1) AS "conv_90d"
           FROM "public"."conversion_actions" "ca"
          WHERE (("ca"."week_start" > (CURRENT_DATE - 90)) AND ("ca"."conversions" > (0)::numeric))
          GROUP BY "ca"."account", "ca"."campaign", "ca"."conversion_action"
        ), "por_campana" AS (
         SELECT "reales"."account",
            "reales"."campaign",
            "count"(*) AS "acciones",
            "round"("sum"("reales"."conv_90d"), 1) AS "conv_camp",
            "max"("reales"."conv_90d") AS "conv_mayor_camp"
           FROM "reales"
          GROUP BY "reales"."account", "reales"."campaign"
        ), "afectadas" AS (
         SELECT "por_campana"."account",
            "por_campana"."campaign",
            "por_campana"."acciones",
            "por_campana"."conv_camp",
            "por_campana"."conv_mayor_camp"
           FROM "por_campana"
          WHERE ("por_campana"."acciones" > 1)
        ), "limpias" AS (
         SELECT "por_campana"."account",
            "round"("sum"("por_campana"."conv_camp"), 1) AS "conv_limpias"
           FROM "por_campana"
          WHERE ("por_campana"."acciones" = 1)
          GROUP BY "por_campana"."account"
        ), "totales" AS (
         SELECT "afectadas"."account",
            "round"("sum"("afectadas"."conv_camp"), 1) AS "conv_total",
            "round"("sum"("afectadas"."conv_mayor_camp"), 1) AS "conv_mayor",
            "count"(*) AS "campanas_afectadas"
           FROM "afectadas"
          GROUP BY "afectadas"."account"
        ), "acc" AS (
         SELECT "a"."account",
            "count"(DISTINCT "r"."conversion_action") AS "acciones_con_conversiones",
            "string_agg"(DISTINCT "r"."conversion_action", ', '::"text" ORDER BY "r"."conversion_action") AS "acciones_en_juego"
           FROM ("afectadas" "a"
             JOIN "reales" "r" ON ((("r"."account" = "a"."account") AND ("r"."campaign" = "a"."campaign"))))
          GROUP BY "a"."account"
        ), "mayor" AS (
         SELECT DISTINCT ON ("z"."account") "z"."account",
            "z"."conversion_action"
           FROM ( SELECT "r"."account",
                    "r"."conversion_action",
                    "sum"("r"."conv_90d") AS "c"
                   FROM ("reales" "r"
                     JOIN "afectadas" "a" ON ((("a"."account" = "r"."account") AND ("a"."campaign" = "r"."campaign"))))
                  GROUP BY "r"."account", "r"."conversion_action") "z"
          ORDER BY "z"."account", "z"."c" DESC
        ), "declaradas" AS (
         SELECT "funnel_stages"."account",
            "count"(*) FILTER (WHERE ("funnel_stages"."google_status" = 'primaria'::"text")) AS "primarias_declaradas",
            "string_agg"("funnel_stages"."stage_name", ', '::"text") FILTER (WHERE ("funnel_stages"."google_status" = 'primaria'::"text")) AS "cuales_declaradas",
            "count"(*) AS "filas_funnel"
           FROM "public"."funnel_stages"
          GROUP BY "funnel_stages"."account"
        ), "det" AS (
         SELECT "z"."account",
            "string_agg"("z"."x", ' | '::"text" ORDER BY "z"."x") AS "detalle"
           FROM ( SELECT "a"."account",
                    (("a"."campaign" || ': '::"text") || "string_agg"(((("r"."conversion_action" || ' ('::"text") || "r"."conv_90d") || ')'::"text"), ' + '::"text" ORDER BY "r"."conv_90d" DESC)) AS "x"
                   FROM ("afectadas" "a"
                     JOIN "reales" "r" ON ((("r"."account" = "a"."account") AND ("r"."campaign" = "a"."campaign"))))
                  GROUP BY "a"."account", "a"."campaign") "z"
          GROUP BY "z"."account"
        )
 SELECT "acc"."account",
    "acc"."acciones_con_conversiones",
    COALESCE("d"."primarias_declaradas", (0)::bigint) AS "primarias_declaradas",
    "d"."cuales_declaradas",
    "t"."conv_total",
    "m"."conversion_action" AS "accion_principal",
    "t"."conv_mayor" AS "conv_de_la_principal",
    "round"(("t"."conv_total" - "t"."conv_mayor"), 1) AS "conv_que_podrian_ser_la_misma",
    "round"(("t"."conv_total" / NULLIF("t"."conv_mayor", (0)::numeric)), 2) AS "factor_de_inflado",
    "det"."detalle",
        CASE
            WHEN (COALESCE("d"."filas_funnel", (0)::bigint) = 0) THEN ((((((((((('SIN DECLARAR: la cuenta no tiene ninguna fila en funnel_stages, asi que no se puede saber cuales acciones son etapas del mismo recorrido. Lo que SI se sabe: en '::"text" || "t"."campanas_afectadas") || ' campana(s) conviven '::"text") || "acc"."acciones_con_conversiones") || ' acciones que cuentan conversiones ('::"text") || "acc"."acciones_en_juego") || ') y ahi el total puede estar inflado hasta '::"text") || "round"(("t"."conv_total" / NULLIF("t"."conv_mayor", (0)::numeric)), 2)) || 'x. Las otras '::"text") || COALESCE("l"."conv_limpias", (0)::numeric)) || ' conversiones estan en campanas con una sola accion y NO estan en riesgo. '::"text") || 'No desinflar el CPA de la cuenta entera con este factor: aplica solo a las campanas de detalle.'::"text")
            WHEN ("acc"."acciones_con_conversiones" > COALESCE("d"."primarias_declaradas", (0)::bigint)) THEN (((((((((('REVISAR: en '::"text" || "t"."campanas_afectadas") || ' campana(s) conviven '::"text") || "acc"."acciones_con_conversiones") || ' acciones que cuentan conversiones y funnel_stages declara '::"text") || COALESCE("d"."primarias_declaradas", (0)::bigint)) || ' primaria(s). Si son etapas del mismo recorrido sobre el mismo clic, el total de esas campanas esta inflado hasta '::"text") || "round"(("t"."conv_total" / NULLIF("t"."conv_mayor", (0)::numeric)), 2)) || 'x y el CPA publicado ahi es esa fraccion del real. Otras '::"text") || COALESCE("l"."conv_limpias", (0)::numeric)) || ' conversiones estan en campanas de una sola accion y no estan afectadas. Verificar en Google Ads cuales estan como primarias.'::"text")
            ELSE 'Multiples acciones declaradas conviviendo en la misma campana: verificar que midan hechos distintos y no etapas del mismo clic.'::"text"
        END AS "lectura",
    "t"."campanas_afectadas",
    COALESCE("l"."conv_limpias", (0)::numeric) AS "conv_en_campanas_limpias",
        CASE
            WHEN (COALESCE("d"."filas_funnel", (0)::bigint) = 0) THEN 'SIN DECLARAR'::"text"
            WHEN ("acc"."acciones_con_conversiones" > COALESCE("d"."primarias_declaradas", (0)::bigint)) THEN 'REVISAR'::"text"
            ELSE 'DECLARADO'::"text"
        END AS "veredicto"
   FROM ((((("acc"
     JOIN "totales" "t" ON (("t"."account" = "acc"."account")))
     LEFT JOIN "declaradas" "d" ON (("d"."account" = "acc"."account")))
     LEFT JOIN "limpias" "l" ON (("l"."account" = "acc"."account")))
     LEFT JOIN "mayor" "m" ON (("m"."account" = "acc"."account")))
     LEFT JOIN "det" ON (("det"."account" = "acc"."account")));


ALTER VIEW "public"."v_primarias_solapadas" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_primarias_solapadas" IS 'Doble conteo entre acciones de conversion, medido POR CAMPANA y no por cuenta: un clic pertenece a una campana, asi que dos acciones que no comparten campana no pueden contar el mismo clic. factor_de_inflado aplica SOLO a las campanas de detalle, nunca al CPA de la cuenta entera. veredicto SIN DECLARAR significa que la cuenta no tiene funnel_stages cargado, no que tenga cero primarias.';



CREATE OR REPLACE VIEW "public"."v_proyeccion_escalamiento" WITH ("security_invoker"='on') AS
 SELECT "account",
    "veredicto",
    "cpa_14d" AS "cpa_actual",
    "lost_is_budget_pct",
    "round"((("lost_is_budget_pct" / NULLIF(((100)::numeric - "lost_is_budget_pct"), (0)::numeric)) * (100)::numeric), 1) AS "volumen_extra_disponible_pct",
    "round"(("conv_mes_proyectado" * 1.20), 1) AS "conv_mes_si_mas_20pct",
    "round"(("conv_mes_proyectado" * 1.30), 1) AS "conv_mes_si_mas_30pct",
    "round"(("cpa_14d" * 1.15), 0) AS "cpa_esperado_optimista",
    "round"(("cpa_14d" * 1.25), 0) AS "cpa_esperado_pesimista",
    (("cpa_14d" * 1.25) <= "cpa_maximo") AS "escalable_dentro_de_cpa_max",
        CASE
            WHEN ("lost_is_budget_pct" >= (40)::numeric) THEN 'Dos pasos de +25% con 2 semanas entre cada uno'::"text"
            WHEN ("lost_is_budget_pct" >= (20)::numeric) THEN 'Un paso de +20-30%, evaluar a las 2 semanas'::"text"
            ELSE 'Sin margen por presupuesto: el volumen extra no esta ahi'::"text"
        END AS "plan_sugerido",
    "objetivos_provisionales",
    (('Proyeccion lineal sobre '::"text" || "dias_consolidados") || ' dias consolidados. No es prediccion: el CPA marginal real se conoce solo escalando.'::"text") AS "advertencia"
   FROM "public"."v_headroom" "h";


ALTER VIEW "public"."v_proyeccion_escalamiento" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_proyeccion_escalamiento" IS 'Escenarios de +20% y +30% con CPA esperado entre 15% y 25% peor que el actual, porque la demanda justo detras del cap de presupuesto es mas cara. escalable_dentro_de_cpa_max dice si aun el escenario pesimista respeta el maximo del negocio. Es proyeccion lineal, no prediccion: el marginal real solo se conoce probando.';



CREATE OR REPLACE VIEW "public"."v_pulso_hoy" WITH ("security_invoker"='on') AS
 SELECT DISTINCT ON ("account") "account",
    "spend_today" AS "gasto_hasta_ahora",
    "conversions_today" AS "conversiones_hasta_ahora",
    "event_date" AS "medido_a_las",
    "round"((EXTRACT(epoch FROM ("now"() - "event_date")) / (60)::numeric)) AS "minutos_desde_medicion"
   FROM "public"."google_live_events"
  WHERE (("event_type" = 'METRICS'::"text") AND ("event_date" > ("now"() - '24:00:00'::interval)))
  ORDER BY "account", "event_date" DESC;


ALTER VIEW "public"."v_pulso_hoy" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_pulso_hoy" IS 'Ultimo snapshot de cada cuenta del dia en curso. Usar esta vista en lugar de consultar google_live_events directamente: cada fila de esa tabla es un acumulado, y sumarlas multiplica el gasto por la cantidad de mediciones.';



CREATE OR REPLACE VIEW "public"."v_reflexiones_recurrentes" WITH ("security_invoker"='on') AS
 SELECT "account",
    "tipo",
    "regexp_replace"("lower"("que_haria_distinto"), '^((\S+\s+){0,5}\S+).*$'::"text", '\1'::"text") AS "clave",
    "count"(*) AS "veces",
    "min"("run_date") AS "primera_vez",
    "max"("run_date") AS "ultima_vez",
    ("array_agg"("que_haria_distinto" ORDER BY "run_date" DESC))[1] AS "leccion_mas_reciente",
    ("array_agg"("regla_del_prompt" ORDER BY "run_date" DESC))[1] AS "regla",
    "bool_or"("aplicada") AS "ya_aplicada"
   FROM "public"."reflexiones"
  GROUP BY "account", "tipo", ("regexp_replace"("lower"("que_haria_distinto"), '^((\S+\s+){0,5}\S+).*$'::"text", '\1'::"text"))
 HAVING (("count"(*) >= 2) AND (NOT "bool_or"("aplicada")))
  ORDER BY ("count"(*)) DESC, ("max"("run_date")) DESC;


ALTER VIEW "public"."v_reflexiones_recurrentes" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_reflexiones_recurrentes" IS 'Reflexiones que aparecieron en 2 o mas corridas y aun no se aplicaron al prompt. Cada fila es una propuesta de cambio con evidencia. Cuando se incorpora, marcar aplicada=true en las filas de reflexiones.';



CREATE OR REPLACE VIEW "public"."v_reflexiones_vigentes" WITH ("security_invoker"='true') AS
 SELECT "id",
    "account",
    "run_date",
    "tipo",
    "que_paso",
    "que_haria_distinto",
    "regla_del_prompt",
    "confianza",
    "aplicada",
    "created_at"
   FROM "public"."reflexiones" "r"
  WHERE (NOT "public"."en_cuarentena"('reflexiones'::"text", ("id")::"text"));


ALTER VIEW "public"."v_reflexiones_vigentes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_reporte_publico" WITH ("security_invoker"='true') AS
 SELECT "r"."token",
    "r"."account",
    "c"."nombre_cliente",
    "c"."encabezado_reporte",
    "r"."periodo_desde",
    "r"."periodo_hasta",
    "r"."tipo",
    "r"."idioma",
    "r"."estado",
    "r"."bloques",
    "r"."resumen_ejecutivo",
    "r"."metricas",
    "r"."serie",
    "r"."campanas",
    "r"."aprobado_el",
    "r"."enviado_el",
    "c"."reporte_plantilla",
    "r"."version"
   FROM ("public"."reportes_cliente" "r"
     JOIN "public"."cuentas" "c" ON (("c"."account" = "r"."account")))
  WHERE ("r"."estado" = ANY (ARRAY['aprobado'::"text", 'enviado'::"text"]));


ALTER VIEW "public"."v_reporte_publico" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_reporte_unidades" WITH ("security_invoker"='true') AS
 SELECT "l"."account",
    COALESCE("g"."codigo", "l"."codigo") AS "unidad",
    COALESCE("g"."nombre", "l"."nombre") AS "nombre",
        CASE
            WHEN ("g"."codigo" IS NULL) THEN 'local'::"text"
            ELSE "g"."tipo"
        END AS "nivel",
    COALESCE("g"."destinatarios", NULL::"text") AS "destinatarios",
    "array_agg"("l"."codigo" ORDER BY "l"."codigo") AS "locales",
    "count"(*) AS "n_locales"
   FROM ("public"."locations" "l"
     LEFT JOIN "public"."grupos_reporte" "g" ON ((("g"."account" = "l"."account") AND ("g"."codigo" = "l"."grupo_reporte"))))
  WHERE "l"."activa"
  GROUP BY "l"."account", COALESCE("g"."codigo", "l"."codigo"), COALESCE("g"."nombre", "l"."nombre"),
        CASE
            WHEN ("g"."codigo" IS NULL) THEN 'local'::"text"
            ELSE "g"."tipo"
        END, "g"."destinatarios";


ALTER VIEW "public"."v_reporte_unidades" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_reportes_no_entregables" WITH ("security_invoker"='true') AS
 SELECT "account",
    "canal_reporte",
    "frecuencia_reporte",
        CASE
            WHEN ("canal_reporte" <> 'email'::"text") THEN (('El canal "'::"text" || "canal_reporte") || '" no lo entrega ningun script: el briefing solo manda por email. El reporte se aprueba, entra a la cola y nunca sale.'::"text")
            WHEN (COALESCE("array_length"("destinatarios_reporte", 1), 0) = 0) THEN 'Sin destinatarios: el briefing lo saltea en silencio.'::"text"
            WHEN ("frecuencia_reporte" = 'ninguna'::"text") THEN 'Frecuencia "ninguna": nunca se genera un reporte para esta cuenta.'::"text"
            ELSE NULL::"text"
        END AS "lectura"
   FROM "public"."cuentas" "c"
  WHERE ("activa" AND (("canal_reporte" <> 'email'::"text") OR (COALESCE("array_length"("destinatarios_reporte", 1), 0) = 0) OR ("frecuencia_reporte" = 'ninguna'::"text")));


ALTER VIEW "public"."v_reportes_no_entregables" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_respaldos_pg_net" WITH ("security_invoker"='true') AS
 SELECT "id",
    "created",
    "status_code",
    "left"("content", 200) AS "respuesta",
    "error_msg"
   FROM "net"."_http_response"
  ORDER BY "created" DESC
 LIMIT 20;


ALTER VIEW "public"."v_respaldos_pg_net" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_respuestas_de_agentes" WITH ("security_invoker"='true') AS
 SELECT "id",
    COALESCE("account", '(sistema)'::"text") AS "cuenta",
    "atendida_por" AS "respondio",
    "atendida_el" AS "cuando",
    "contenido" AS "pregunta",
    "respuesta",
    "round"((EXTRACT(epoch FROM ("atendida_el" - "creada")) / 3600.0), 1) AS "horas_hasta_responder"
   FROM "public"."notas_para_agentes"
  WHERE (("atendida_el" IS NOT NULL) AND ("atendida_el" > ("now"() - '14 days'::interval)))
  ORDER BY "atendida_el" DESC;


ALTER VIEW "public"."v_respuestas_de_agentes" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_respuestas_de_agentes" IS 'Lo que los agentes respondieron a las notas de Andres. Sale en las novedades de la app y en el correo de las 9:15: sin esto el agente responde y nadie lo lee.';



CREATE OR REPLACE VIEW "public"."v_run_scorecard" WITH ("security_invoker"='on') AS
 SELECT "account",
    "run_date",
    "semana_analizada",
    ((((((((((((((COALESCE(("brief_creado_o_actualizado")::integer, 0) + COALESCE(("handoff_escrito")::integer, 0)) + COALESCE(((("handoff_lineas" >= 1) AND ("handoff_lineas" <= 5)))::integer, 0)) + COALESCE(("fechas_explicitas")::integer, 0)) + COALESCE(("dias_provisionales_marcados")::integer, 0)) + COALESCE((("accionables_con_naturaleza" = "accionables_nuevos"))::integer, 0)) + COALESCE((("accionables_con_causa_raiz" = "accionables_nuevos"))::integer, 0)) + COALESCE((("accionables_con_verificar_fecha" = "accionables_nuevos"))::integer, 0)) + COALESCE(("titulos_son_acciones")::integer, 0)) + COALESCE((("comentarios_pendientes" = 0))::integer, 0)) + COALESCE(("propagacion_ejecutada")::integer, 0)) + COALESCE(("operator_log_consultado")::integer, 0)) + COALESCE(("cambios_detectados_consultado")::integer, 0)) + COALESCE(("inferencias_en_bloqueado")::integer, 0)) + COALESCE(("duplicado_evitado")::integer, 0)) AS "puntos",
    15 AS "puntos_posibles",
    "revision_humana",
    "que_fallo",
    "preguntas_a_andres",
    "tiempo_estimado_min",
    "lag"("run_date") OVER (PARTITION BY "account" ORDER BY "run_date", "id") AS "corrida_previa",
    ("row_number"() OVER (PARTITION BY "account", "semana_analizada" ORDER BY "run_date" DESC, "id" DESC) = 1) AS "es_ultima_de_la_semana",
    "count"(*) OVER (PARTITION BY "account", "semana_analizada") AS "corridas_sobre_esta_semana"
   FROM "public"."run_quality";


ALTER VIEW "public"."v_run_scorecard" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_run_scorecard" IS 'Puntaje de cada corrida sobre 15. es_ultima_de_la_semana marca la corrida que cuenta para la tendencia; las repetidas sobre la misma semana (ej. cinco el 6 sep) se ven pero no pesan.';



CREATE OR REPLACE VIEW "public"."v_run_tendencia" WITH ("security_invoker"='on') AS
 SELECT "account",
    "count"(*) AS "semanas_evaluadas",
    "round"((("avg"("puntos") / (15)::numeric) * (100)::numeric), 1) AS "cumplimiento_promedio_pct",
    "round"((((("array_agg"("puntos" ORDER BY "semana_analizada" DESC))[1])::numeric / (15)::numeric) * (100)::numeric), 1) AS "cumplimiento_ultima_pct",
    "max"("semana_analizada") AS "ultima_semana",
    "sum"("corridas_sobre_esta_semana") AS "corridas_totales"
   FROM "public"."v_run_scorecard"
  WHERE "es_ultima_de_la_semana"
  GROUP BY "account";


ALTER VIEW "public"."v_run_tendencia" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_run_tendencia" IS 'Cumplimiento por cuenta contando UNA corrida por semana analizada (la ultima). corridas_totales muestra cuantas hubo en realidad.';



CREATE OR REPLACE VIEW "public"."v_salud_calidad" AS
 SELECT 'metricas'::"text" AS "area",
    'ventana_mayor_que_la_tabla'::"text" AS "prueba",
    "m"."objeto" AS "cuenta",
    'FALLA'::"text" AS "estado",
    (("m"."por_que" || ' Usar '::"text") || "m"."usar_en_su_lugar") AS "detalle"
   FROM "public"."v_metricas_reescritas" "m"
UNION ALL
 SELECT 'verdad'::"text" AS "area",
    'relacion_violada'::"text" AS "prueba",
    "v"."cuenta",
    'FALLA'::"text" AS "estado",
    (((("v"."familia" || ' / '::"text") || "v"."nombre") || ': '::"text") || "v"."detalle") AS "detalle"
   FROM "public"."v_relaciones_violadas" "v"
UNION ALL
 SELECT 'semantica'::"text" AS "area",
    "d"."familia" AS "prueba",
    (("d"."objeto" || '.'::"text") || "d"."columna") AS "cuenta",
        CASE
            WHEN ("d"."familia" = ANY (ARRAY['ventana_que_miente'::"text", 'tipo_que_miente'::"text"])) THEN 'FALLA'::"text"
            ELSE 'ATENCION'::"text"
        END AS "estado",
    (("d"."detalle" || ' '::"text") || "d"."que_hacer") AS "detalle"
   FROM "public"."v_drift_semantico" "d"
UNION ALL
 SELECT 'verdad'::"text" AS "area",
    'cifra_no_verificada'::"text" AS "prueba",
    "c"."cuenta",
    'ATENCION'::"text" AS "estado",
    ((("c"."etiqueta" || ': publicada el '::"text") || ("c"."publicada_el")::"date") || ' y todavia sin verificar.'::"text") AS "detalle"
   FROM "public"."cifras_publicadas" "c"
  WHERE (("c"."veredicto" IS NULL) AND ("c"."publicada_el" < ("now"() - '02:00:00'::interval)))
UNION ALL
 SELECT 'verdad'::"text" AS "area",
    'cifra_sospechosa'::"text" AS "prueba",
    "s"."cuenta",
    'FALLA'::"text" AS "estado",
    (((("s"."etiqueta" || ' ['::"text") || "s"."veredicto") || ']: '::"text") || "left"("s"."detalle", 200)) AS "detalle"
   FROM "public"."v_cifras_sospechosas" "s";


ALTER VIEW "public"."v_salud_calidad" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_salud_calidad" IS 'La capa de calidad semantica en una vista: ventanas mayores que su tabla, relaciones de verdad violadas, nombres que mienten, y cifras publicadas sin verificar o que no se reproducen. Es lo que distingue "el dato existe" de "el dato significa lo que dice".';



CREATE OR REPLACE VIEW "public"."v_tareas_en_silencio" WITH ("security_invoker"='true') AS
 SELECT "tarea",
    "ultimo_ok",
        CASE
            WHEN ("ultimo_ok" IS NULL) THEN 'nunca corrio'::"text"
            ELSE (("round"((EXTRACT(epoch FROM ("now"() - "ultimo_ok")) / 3600.0)))::"text" || ' horas sin correr'::"text")
        END AS "estado",
    "tolerancia",
    "ultimo_error",
        CASE
            WHEN ("ultimo_ok" IS NULL) THEN 'Nunca registro una corrida buena desde que se la vigila.'::"text"
            ELSE (((((('La tarea '::"text" || "tarea") || ' no corre desde hace '::"text") || "round"((EXTRACT(epoch FROM ("now"() - "ultimo_ok")) / 3600.0))) || ' horas, y se espera cada '::"text") || "round"((EXTRACT(epoch FROM "tolerancia") / 3600.0))) || '. Si son varias a la vez, mira si Supabase tuvo un incidente: pg_cron se detiene entero sin avisar.'::"text")
        END AS "lectura"
   FROM "public"."latidos" "l"
  WHERE ("en_vigilancia" AND (("ultimo_ok" IS NULL) OR ("ultimo_ok" < ("now"() - "tolerancia"))));


ALTER VIEW "public"."v_tareas_en_silencio" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_umbrales_inconsistentes" AS
 WITH "activos" AS (
         SELECT "cuentas"."account"
           FROM "public"."cuentas"
          WHERE "cuentas"."activa"
        ), "esperado" AS (
         SELECT "a"."account",
            "e"."script",
            "e"."umbral",
            "e"."canonico_en_cuentas"
           FROM ("activos" "a"
             CROSS JOIN "public"."umbrales_esperados" "e")
        ), "declarado" AS (
         SELECT "umbrales_de_scripts"."account",
            "umbrales_de_scripts"."script",
            "umbrales_de_scripts"."umbral",
            "umbrales_de_scripts"."valor",
            "umbrales_de_scripts"."declarado_el"
           FROM "public"."umbrales_de_scripts"
        ), "j" AS (
         SELECT "e"."account",
            "e"."script",
            "e"."umbral",
            "e"."canonico_en_cuentas",
            "d"."valor",
            "d"."declarado_el",
            ("d"."umbral" IS NULL) AS "sin_declarar",
                CASE "e"."canonico_en_cuentas"
                    WHEN 'presupuesto_diario'::"text" THEN "c"."presupuesto_diario"
                    WHEN 'pico_gasto_factor'::"text" THEN "c"."pico_gasto_factor"
                    WHEN 'sin_conv_min_gasto'::"text" THEN "c"."sin_conv_min_gasto"
                    ELSE NULL::numeric
                END AS "canonico"
           FROM (("esperado" "e"
             JOIN "public"."cuentas" "c" ON (("c"."account" = "e"."account")))
             LEFT JOIN "declarado" "d" ON ((("d"."account" = "e"."account") AND ("d"."script" = "e"."script") AND ("d"."umbral" = "e"."umbral"))))
        )
 SELECT "account",
    "script",
    "umbral",
    "valor" AS "valor_en_script",
    "canonico" AS "valor_en_supabase",
        CASE
            WHEN "sin_declarar" THEN (((((((('El script '::"text" || "script") || ' nunca declaro el umbral '::"text") || "umbral") || ' de '::"text") || "account") || '. Sus valores cableados son invisibles para esta auditoria: no se puede saber si estan en cero. Agregar declararUmbrales() con p_script='''::"text") || "script") || '''.'::"text")
            WHEN (COALESCE("valor", (0)::numeric) = (0)::numeric) THEN (('Umbral en CERO en '::"text" || "script") || ': la alerta esta apagada y se ve igual que una que nunca dispara. Cargarle un valor con sentido o sacar la comparacion.'::"text")
            WHEN (("canonico" IS NOT NULL) AND ("valor" IS DISTINCT FROM "canonico")) THEN (((('El script dice '::"text" || "valor") || ' y Supabase dice '::"text") || COALESCE(("canonico")::"text", 'nada'::"text")) || '. El que manda es Supabase: corregir el script.'::"text")
            WHEN ("declarado_el" < ("now"() - '8 days'::interval)) THEN (('Declarado por ultima vez el '::"text" || ("declarado_el")::"date") || '. Si el script dejo de correr, el umbral que se audita no es el que esta vigente.'::"text")
            ELSE 'Coherente.'::"text"
        END AS "lectura",
        CASE
            WHEN "sin_declarar" THEN 'NO DECLARA'::"text"
            WHEN (COALESCE("valor", (0)::numeric) = (0)::numeric) THEN 'APAGADO'::"text"
            WHEN (("canonico" IS NOT NULL) AND ("valor" IS DISTINCT FROM "canonico")) THEN 'DIVERGE'::"text"
            WHEN ("declarado_el" < ("now"() - '8 days'::interval)) THEN 'VIEJO'::"text"
            ELSE 'OK'::"text"
        END AS "veredicto"
   FROM "j"
  WHERE ("sin_declarar" OR (COALESCE("valor", (0)::numeric) = (0)::numeric) OR (("canonico" IS NOT NULL) AND ("valor" IS DISTINCT FROM "canonico")) OR ("declarado_el" < ("now"() - '8 days'::interval)));


ALTER VIEW "public"."v_umbrales_inconsistentes" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_umbrales_inconsistentes" IS 'Umbrales de los scripts que no cierran: no declarados, en cero, divergentes del canonico de cuentas, o declarados hace mas de 8 dias. La fila NO DECLARA es la importante: sin ella, un script que no llama a declarar_umbral pasa la auditoria por ausencia.';



CREATE OR REPLACE VIEW "public"."v_ventana_real" WITH ("security_invoker"='true') AS
 SELECT "account",
    ( SELECT "count"(DISTINCT "d"."date") AS "count"
           FROM "public"."campaign_daily" "d"
          WHERE (("d"."account" = "c"."account") AND ("d"."date" > (CURRENT_DATE - 30)))) AS "dias_en_30d",
    ( SELECT "min"("d"."date") AS "min"
           FROM "public"."campaign_daily" "d"
          WHERE ("d"."account" = "c"."account")) AS "primer_dia",
    ( SELECT "max"("d"."date") AS "max"
           FROM "public"."campaign_daily" "d"
          WHERE ("d"."account" = "c"."account")) AS "ultimo_dia",
    ( SELECT "count"(DISTINCT "w"."week_start") AS "count"
           FROM "public"."campaign" "w"
          WHERE ("w"."account" = "c"."account")) AS "semanas",
        CASE
            WHEN (( SELECT "count"(DISTINCT "d"."date") AS "count"
               FROM "public"."campaign_daily" "d"
              WHERE (("d"."account" = "c"."account") AND ("d"."date" > (CURRENT_DATE - 30)))) < 25) THEN (((('ATENCION: la capa diaria tiene '::"text" || ( SELECT "count"(DISTINCT "d"."date") AS "count"
               FROM "public"."campaign_daily" "d"
              WHERE (("d"."account" = "c"."account") AND ("d"."date" > (CURRENT_DATE - 30))))) || ' dias, no 30. Cualquier vista que diga "30 dias" esta sumando sobre esa ventana mas corta y su veredicto puede ser falso. Para retrospectiva usar la tabla SEMANAL, que tiene '::"text") || ( SELECT "count"(DISTINCT "w"."week_start") AS "count"
               FROM "public"."campaign" "w"
              WHERE ("w"."account" = "c"."account"))) || ' semanas.'::"text")
            ELSE 'La ventana de 30 dias esta completa.'::"text"
        END AS "lectura"
   FROM "public"."cuentas" "c"
  WHERE "activa";


ALTER VIEW "public"."v_ventana_real" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_ventana_real" IS 'Ticket 37. Cuantos dias tiene REALMENTE la capa diaria por cuenta. v_headroom emite "menos de 15 conv en 30d" sumando sobre 17 dias sin decirlo: en BHI son 10 conversiones en 17 dias, que extrapolan a 17,6 en 30, por encima del minimo. El veredicto era probablemente falso.';



CREATE OR REPLACE VIEW "public"."v_salud_sistema" AS
 WITH "x" AS (
         SELECT 'integridad'::"text" AS "area",
            "auditar_integridad"."prueba",
            "auditar_integridad"."cuenta",
            "auditar_integridad"."estado",
            "auditar_integridad"."detalle"
           FROM "public"."auditar_integridad"() "auditar_integridad"("prueba", "cuenta", "estado", "detalle")
        UNION ALL
         SELECT 'integridad'::"text",
            'primarias_solapadas'::"text",
            "v"."account",
            'FALLA'::"text",
            ((((('Doble conteo posible en '::"text" || "v"."campanas_afectadas") || ' campana(s), factor hasta '::"text") || "v"."factor_de_inflado") || 'x. NO es el CPA de la cuenta entera: '::"text") || "left"("v"."lectura", 260))
           FROM "public"."v_primarias_solapadas" "v"
          WHERE ("v"."factor_de_inflado" > 1.2)
        UNION ALL
         SELECT 'integridad'::"text",
            'ventana_truncada'::"text",
            "v_ventana_real"."account",
            'ATENCION'::"text",
            "v_ventana_real"."lectura"
           FROM "public"."v_ventana_real"
          WHERE ("v_ventana_real"."dias_en_30d" < 25)
        UNION ALL
         SELECT 'cuentas'::"text",
            'negativa_bloquea_conversion'::"text",
            "n"."account",
            'ATENCION'::"text",
            (((((((('Negativa de campana "'::"text" || "n"."negative_keyword") || '" ('::"text") || "n"."match_type") || ') alcanza '::"text") || "n"."conversiones_de_lo_bloqueado_90d") || ' conversion(es) en '::"text") || "n"."en_grupos") || '. Cruce por ILIKE, verificar en pantalla.'::"text")
           FROM "public"."v_negativas_que_bloquean" "n"
          WHERE ("n"."conversiones_de_lo_bloqueado_90d" >= (1)::numeric)
        UNION ALL
         SELECT 'flujos'::"text",
            'estado'::"text",
            "f"."cuentas",
                CASE
                    WHEN ("f"."estado" = ANY (ARRAY['CORTADO'::"text", 'NUNCA RECIBIO NADA'::"text"])) THEN 'FALLA'::"text"
                    ELSE 'OK'::"text"
                END AS "case",
            (((("f"."flujo" || ': '::"text") || "f"."estado") || '. '::"text") || "f"."lectura")
           FROM "public"."estado_de_los_flujos"() "f"("flujo", "cuentas", "quien_escribe", "estado", "ultimo_dato", "lectura")
        UNION ALL
         SELECT 'scripts'::"text",
            'umbral_inalcanzable'::"text",
            "u"."account",
            'FALLA'::"text",
            (("u"."umbral" || ': '::"text") || "u"."lectura")
           FROM "public"."v_umbrales_alcanzables"() "u"("account", "umbral", "valor", "referencia", "veredicto", "lectura")
          WHERE ("u"."veredicto" = ANY (ARRAY['IMPOSIBLE'::"text", 'APAGADO'::"text"]))
        UNION ALL
         SELECT 'scripts'::"text",
            'umbral_no_auditable'::"text",
            "i"."account",
                CASE
                    WHEN ("i"."veredicto" = ANY (ARRAY['APAGADO'::"text", 'DIVERGE'::"text"])) THEN 'FALLA'::"text"
                    ELSE 'ATENCION'::"text"
                END AS "case",
            (((((("i"."script" || ' / '::"text") || "i"."umbral") || ' ['::"text") || "i"."veredicto") || ']: '::"text") || "left"("i"."lectura", 200))
           FROM "public"."v_umbrales_inconsistentes" "i"
        UNION ALL
         SELECT 'cuenta'::"text",
            'completitud'::"text",
            "c"."account",
            'ATENCION'::"text",
            (("c"."requisito" || ': '::"text") || "c"."detalle")
           FROM "public"."v_cuentas_incompletas" "c"
        UNION ALL
         SELECT 'notion'::"text",
            'vs_supabase'::"text",
            "n"."account",
            'FALLA'::"text",
            "n"."lectura"
           FROM "public"."v_notion_vs_supabase" "n"
        UNION ALL
         SELECT 'seguridad'::"text",
            'intentos_sospechosos'::"text",
            "s"."clave",
            'ATENCION'::"text",
            "s"."lectura"
           FROM "public"."v_intentos_sospechosos" "s"
        UNION ALL
         SELECT 'tareas'::"text",
            'en_silencio'::"text",
            "t"."tarea",
            'FALLA'::"text",
            "t"."lectura"
           FROM "public"."v_tareas_en_silencio" "t"
        UNION ALL
         SELECT 'objetos'::"text",
            'vistas_y_funciones'::"text",
            '-'::"text",
                CASE
                    WHEN (("a"."vistas_falla" + "a"."funciones_falla") > 0) THEN 'FALLA'::"text"
                    WHEN ("a"."corrida_el" < ("now"() - '36:00:00'::interval)) THEN 'ATENCION'::"text"
                    ELSE 'OK'::"text"
                END AS "case",
            ((("a"."vistas_ok" || ' vistas y '::"text") || "a"."funciones_ok") || ' llamadas responden'::"text")
           FROM "public"."auditoria_objetos_ultima" "a"
        UNION ALL
         SELECT 'objetos'::"text",
            'documentadas_inexistentes'::"text",
            "f"."objeto",
            'FALLA'::"text",
            "f"."lectura"
           FROM "public"."v_notas_fantasma" "f"
        UNION ALL
         SELECT 'objetos'::"text",
            'sin_documentar'::"text",
            '-'::"text",
                CASE
                    WHEN ("count"(*) > 10) THEN 'ATENCION'::"text"
                    ELSE 'OK'::"text"
                END AS "case",
            (("count"(*) || ' sin nota de '::"text") || ( SELECT "count"(*) AS "count"
                   FROM "public"."diccionario_datos"() "d"("capa", "objeto", "usar_para", "cuidado")))
           FROM "public"."v_objetos_sin_documentar"
        UNION ALL
         SELECT 'capacidades'::"text",
            'registro_coherente'::"text",
            "c"."verbo",
            'FALLA'::"text",
            "c"."problema"
           FROM "public"."v_capacidades_coherentes_chk"() "c"("verbo", "problema")
        UNION ALL
         SELECT 'notion'::"text",
            'espejo_huerfano'::"text",
            "e"."account",
            'FALLA'::"text",
            "e"."lectura"
           FROM "public"."v_espejo_huerfano" "e"
        UNION ALL
         SELECT 'mapeo'::"text",
            'campanas_sin_dim'::"text",
            "d"."account",
            'FALLA'::"text",
            ('Campana fuera de campaign_dim: '::"text" || "d"."campaign")
           FROM "public"."v_campanas_sin_dim" "d"
        UNION ALL
         SELECT 'reportes'::"text",
            'no_entregables'::"text",
            "r"."account",
            'FALLA'::"text",
            "r"."lectura"
           FROM "public"."v_reportes_no_entregables" "r"
        UNION ALL
         SELECT 'tareas'::"text",
            'tickets_abiertos'::"text",
            COALESCE("tickets"."cuenta", '-'::"text") AS "coalesce",
                CASE
                    WHEN ("count"(*) > 12) THEN 'ATENCION'::"text"
                    ELSE 'OK'::"text"
                END AS "case",
            ("count"(*) || ' ticket(s) abiertos'::"text")
           FROM "public"."tickets"
          WHERE ("tickets"."estado" = 'abierto'::"text")
          GROUP BY "tickets"."cuenta"
        )
 SELECT "area",
    "prueba",
    "cuenta",
    "estado",
    "detalle"
   FROM "x"
  ORDER BY
        CASE "estado"
            WHEN 'FALLA'::"text" THEN 1
            WHEN 'ATENCION'::"text" THEN 2
            ELSE 3
        END, "area", "prueba";


ALTER VIEW "public"."v_salud_sistema" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_search_terms_analisis" WITH ("security_invoker"='on') AS
 SELECT "account",
    "week_start",
    "campaign",
    "ad_group",
    "search_term",
    "match_type",
    "triggered_keyword",
    "currency",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "cost",
    "conversions",
    "cost_per_conv",
        CASE
            WHEN (("conversions" = (0)::numeric) AND ("cost" > (0)::numeric)) THEN 'Gasta sin convertir'::"text"
            WHEN ("conversions" > (0)::numeric) THEN 'Convierte'::"text"
            ELSE 'Sin gasto'::"text"
        END AS "clasificacion"
   FROM "public"."search_terms";


ALTER VIEW "public"."v_search_terms_analisis" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_search_terms_analisis" IS 'Terminos de busqueda reales con clasificacion. Insumo para negativas y para keywords nuevas. No expone conv_value.';



CREATE OR REPLACE VIEW "public"."v_search_terms_daily" WITH ("security_invoker"='on') AS
 SELECT "account",
    "date",
    "campaign",
    "ad_group",
    "search_term",
    "match_type",
    "triggered_keyword",
    "currency",
    "impressions",
    "clicks",
    "ctr",
    "avg_cpc",
    "cost",
    "conversions",
    "cost_per_conv",
    "public"."madurez_dato"("date") AS "madurez",
    (CURRENT_DATE - "date") AS "dias_transcurridos",
        CASE
            WHEN (("conversions" = (0)::numeric) AND ("cost" > (0)::numeric)) THEN 'Gasta sin convertir'::"text"
            ELSE NULL::"text"
        END AS "clasificacion"
   FROM "public"."search_terms_daily";


ALTER VIEW "public"."v_search_terms_daily" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_search_terms_daily" IS 'Terminos de busqueda por dia. Solo con impresiones. Para detectar terminos nuevos usar v_terminos_nuevos.';



CREATE OR REPLACE VIEW "public"."v_snapshots_disponibles" WITH ("security_invoker"='on') AS
 SELECT "account",
    "count"(DISTINCT "snapshot_date") AS "fotos",
    "min"("snapshot_date") AS "primera",
    "max"("snapshot_date") AS "ultima",
        CASE
            WHEN ("count"(DISTINCT "snapshot_date") < 2) THEN (('SIN DIFF POSIBLE: v_cambios_detectados necesita 2 fotos. Primera el '::"text" || ("min"("snapshot_date"))::"text") || '; la segunda llega mañana.'::"text")
            ELSE (('ok: '::"text" || "count"(DISTINCT "snapshot_date")) || ' fotos, diff posible'::"text")
        END AS "estado"
   FROM "public"."config_snapshot"
  GROUP BY "account";


ALTER VIEW "public"."v_snapshots_disponibles" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_snapshots_disponibles" IS 'Cuantas fotos de configuracion hay por cuenta. v_cambios_detectados vacia con menos de 2 fotos es VACIO ESTRUCTURAL, no legitimo. Consultar antes de concluir que no hubo cambios. Detectado por la tarea de BHI el 6 sep: tres briefs lo llamaron legitimo sin verificar.';



CREATE OR REPLACE VIEW "public"."v_tasa_acierto" WITH ("security_invoker"='on') AS
 SELECT "account",
    "count"(*) AS "accionables_evaluados",
    "count"(*) FILTER (WHERE ("veredicto" ~~ 'FUNCIONO%'::"text")) AS "funcionaron",
    "count"(*) FILTER (WHERE ("veredicto" ~~ 'NEUTRO%'::"text")) AS "neutros",
    "count"(*) FILTER (WHERE ("veredicto" ~~ 'EMPEORO%'::"text")) AS "empeoraron",
    "count"(*) FILTER (WHERE ("veredicto" ~~ 'PENDIENTE%'::"text")) AS "pendientes",
    "round"(((("count"(*) FILTER (WHERE ("veredicto" ~~ 'FUNCIONO%'::"text")))::numeric / (NULLIF("count"(*) FILTER (WHERE (("veredicto" !~~ 'PENDIENTE%'::"text") AND ("veredicto" !~~ 'SIN METRICA%'::"text"))), 0))::numeric) * (100)::numeric), 1) AS "tasa_acierto_pct",
    "round"(((("count"(*) FILTER (WHERE (("veredicto" ~~ 'FUNCIONO%'::"text") AND ("naturaleza" = 'Observacion'::"text"))))::numeric / (NULLIF("count"(*) FILTER (WHERE (("naturaleza" = 'Observacion'::"text") AND ("veredicto" !~~ 'PENDIENTE%'::"text"))), 0))::numeric) * (100)::numeric), 1) AS "acierto_observaciones_pct",
    "round"(((("count"(*) FILTER (WHERE (("veredicto" ~~ 'FUNCIONO%'::"text") AND ("naturaleza" = ANY (ARRAY['Inferencia'::"text", 'Hipotesis'::"text"])))))::numeric / (NULLIF("count"(*) FILTER (WHERE (("naturaleza" = ANY (ARRAY['Inferencia'::"text", 'Hipotesis'::"text"])) AND ("veredicto" !~~ 'PENDIENTE%'::"text"))), 0))::numeric) * (100)::numeric), 1) AS "acierto_inferencias_pct"
   FROM "public"."v_impacto_accionables"
  GROUP BY "account";


ALTER VIEW "public"."v_tasa_acierto" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tasa_acierto" IS 'La metrica del sistema entero: de los accionables ejecutados, cuantos movieron la metrica en la direccion esperada. Si acierto_inferencias es mucho menor que acierto_observaciones, el sistema esta proponiendo demasiado sin evidencia. Si tasa_acierto baja entre meses, el analisis se degrada.';



CREATE OR REPLACE VIEW "public"."v_tasa_de_accion" AS
 SELECT "count"(*) FILTER (WHERE ("a"."clave" IS NOT NULL)) AS "atendidos",
    "count"(*) AS "incidentes_que_pedian_accion",
    "round"(((("count"(*) FILTER (WHERE ("a"."clave" IS NOT NULL)))::numeric / (NULLIF("count"(*), 0))::numeric) * (100)::numeric), 1) AS "tasa_pct",
        CASE
            WHEN ("count"(*) = 0) THEN 'Sin incidentes que pidan accion.'::"text"
            WHEN ((("count"(*) FILTER (WHERE ("a"."clave" IS NOT NULL)))::numeric / ("count"(*))::numeric) < 0.5) THEN 'Por debajo del 50%: hay demasiado ruido. Podar chequeos, no mirar mas fuerte.'::"text"
            WHEN ((("count"(*) FILTER (WHERE ("a"."clave" IS NOT NULL)))::numeric / ("count"(*))::numeric) < 0.7) THEN 'Entre 50 y 70%: aceptable, con margen para podar.'::"text"
            ELSE 'Arriba del 70%: el tablero esta diciendo cosas que se usan.'::"text"
        END AS "lectura"
   FROM ("public"."v_incidentes" "i"
     LEFT JOIN "public"."incidentes_atendidos" "a" ON (("a"."clave" = "i"."clave")))
  WHERE ("i"."severidad" = 'actuar'::"text");


ALTER VIEW "public"."v_tasa_de_accion" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tasa_de_accion" IS 'Que porcentaje de lo que el tablero marca como accionable termina en una accion. Es la metrica que distingue un tablero de un ruido prolijo. La referencia publicada es 70 a 80%; por debajo de 50% el problema es el tablero, no la atencion de quien lo mira.';



CREATE OR REPLACE VIEW "public"."v_tasa_de_reapertura" AS
 SELECT "count"(*) FILTER (WHERE ("veces_reabierto" > 0)) AS "reabiertos",
    "count"(*) AS "cerrados_alguna_vez",
    "round"(((("count"(*) FILTER (WHERE ("veces_reabierto" > 0)))::numeric / (NULLIF("count"(*), 0))::numeric) * (100)::numeric), 1) AS "tasa_pct",
    'La tasa de reapertura es la metrica que delata un proceso que cierra sin verificar. El ticket 37 se cerro marcado como resuelto sin estarlo y hubo que reabrirlo.'::"text" AS "lectura"
   FROM "public"."tickets"
  WHERE (("estado" = 'resuelto'::"text") OR ("veces_reabierto" > 0));


ALTER VIEW "public"."v_tasa_de_reapertura" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_tendencia_semanal" WITH ("security_invoker"='on') AS
 SELECT "account",
    "week_start",
    "sum"("cost") AS "gasto",
    "sum"("clicks") AS "clics",
    "sum"("impressions") AS "impresiones",
    "sum"("conversions") AS "conversiones",
    "round"(("sum"("cost") / NULLIF("sum"("conversions"), (0)::numeric)), 2) AS "cpa",
    "round"("avg"("ctr"), 2) AS "ctr_promedio",
    "round"("avg"("impr_share"), 2) AS "impr_share_promedio",
    "round"("avg"("lost_is_budget"), 2) AS "perdido_presupuesto",
    "round"("avg"("lost_is_rank"), 2) AS "perdido_ranking"
   FROM "public"."campaign"
  WHERE ("status" = 'ENABLED'::"text")
  GROUP BY "account", "week_start";


ALTER VIEW "public"."v_tendencia_semanal" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tendencia_semanal" IS 'Serie semanal por cuenta, solo campanas activas. Usar para tendencias en vez de leer semanas sueltas. Con volumen bajo (BHI, 360) un movimiento semanal casi nunca es significativo: mirar la serie.';



CREATE OR REPLACE VIEW "public"."v_terminos_nuevos" WITH ("security_invoker"='on') AS
 WITH "primera" AS (
         SELECT "search_terms_daily"."account",
            "search_terms_daily"."search_term",
            "min"("search_terms_daily"."date") AS "primera_aparicion"
           FROM "public"."search_terms_daily"
          GROUP BY "search_terms_daily"."account", "search_terms_daily"."search_term"
        ), "acumulado" AS (
         SELECT "s"."account",
            "s"."search_term",
            "sum"("s"."cost") AS "gasto_acumulado",
            "sum"("s"."clicks") AS "clics_acumulados",
            "sum"("s"."conversions") AS "conversiones_acumuladas",
            "sum"("s"."impressions") AS "impresiones_acumuladas",
            "mode"() WITHIN GROUP (ORDER BY "s"."triggered_keyword") AS "keyword_disparadora",
            "mode"() WITHIN GROUP (ORDER BY "s"."match_type") AS "match_type",
            "mode"() WITHIN GROUP (ORDER BY "s"."ad_group") AS "ad_group",
            "mode"() WITHIN GROUP (ORDER BY "s"."campaign") AS "campaign"
           FROM "public"."search_terms_daily" "s"
          GROUP BY "s"."account", "s"."search_term"
        )
 SELECT "p"."account",
    "p"."search_term",
    "p"."primera_aparicion",
    (CURRENT_DATE - "p"."primera_aparicion") AS "dias_desde_aparicion",
    "round"("a"."gasto_acumulado", 2) AS "gasto_acumulado",
    "a"."clics_acumulados",
    "round"("a"."conversiones_acumuladas", 1) AS "conversiones_acumuladas",
    "a"."impresiones_acumuladas",
    "a"."keyword_disparadora",
    "a"."match_type",
    "a"."ad_group",
    "a"."campaign",
        CASE
            WHEN ("a"."clics_acumulados" > (0)::numeric) THEN "round"(("a"."gasto_acumulado" / "a"."clics_acumulados"), 2)
            ELSE NULL::numeric
        END AS "cpc",
        CASE
            WHEN ("a"."conversiones_acumuladas" > (0)::numeric) THEN "round"(("a"."gasto_acumulado" / "a"."conversiones_acumuladas"), 2)
            ELSE NULL::numeric
        END AS "cpa"
   FROM ("primera" "p"
     JOIN "acumulado" "a" ON ((("a"."account" = "p"."account") AND ("a"."search_term" = "p"."search_term"))))
  WHERE ("p"."primera_aparicion" >= (CURRENT_DATE - 14));


ALTER VIEW "public"."v_terminos_nuevos" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_terminos_nuevos" IS 'Terminos de busqueda que aparecieron por primera vez en los ultimos 14 dias, con gasto, clics, conversiones e impresiones acumulados, y la keyword, grupo y campana que mas veces los disparo. Un termino con gasto y sin conversiones es candidato a negativa; con keyword_disparadora se sabe en que grupo agregarla.';



CREATE OR REPLACE VIEW "public"."v_terminos_resueltos" WITH ("security_invoker"='true') AS
 SELECT "s"."account",
    "s"."week_start",
    "d"."location",
    COALESCE("d"."objetivo", 'generico'::"text") AS "objetivo",
    "s"."campaign",
    "s"."ad_group",
    "s"."search_term",
    "s"."match_type",
    "s"."triggered_keyword",
    "s"."impressions",
    "s"."clicks",
    "s"."ctr",
    "s"."avg_cpc",
    "s"."cost",
    "s"."conversions",
    "s"."conv_value"
   FROM ("public"."search_terms" "s"
     LEFT JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "s"."account") AND ("d"."campaign" = "s"."campaign"))));


ALTER VIEW "public"."v_terminos_resueltos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_terminos_sin_cobertura" AS
 WITH "st" AS (
         SELECT "s_1"."account",
            "s_1"."campaign",
            "s_1"."ad_group",
            "s_1"."search_term",
            "s_1"."triggered_keyword",
            "sum"("s_1"."conversions") AS "conv",
            "sum"("s_1"."cost") AS "cost",
            "sum"("s_1"."clicks") AS "clicks"
           FROM "public"."search_terms" "s_1"
          WHERE (("s_1"."week_start" > (CURRENT_DATE - 30)) AND ("s_1"."cost" > (0)::numeric))
          GROUP BY "s_1"."account", "s_1"."campaign", "s_1"."ad_group", "s_1"."search_term", "s_1"."triggered_keyword"
        ), "grupo" AS (
         SELECT "st"."account",
            "st"."campaign",
            "st"."ad_group",
            "sum"("st"."cost") AS "cost_grupo",
            "sum"("st"."conv") AS "conv_grupo",
            ("sum"("st"."cost") / NULLIF("sum"("st"."conv"), (0)::numeric)) AS "cpa_grupo"
           FROM "st"
          GROUP BY "st"."account", "st"."campaign", "st"."ad_group"
        ), "otros" AS (
         SELECT "st"."account",
            "st"."campaign",
            "st"."search_term",
            "count"(DISTINCT "st"."ad_group") AS "grupos_del_termino",
            "sum"("st"."conv") AS "conv_en_la_campana",
            "string_agg"(DISTINCT "st"."ad_group", ' | '::"text") FILTER (WHERE ("st"."conv" > (0)::numeric)) AS "grupos_donde_convierte"
           FROM "st"
          GROUP BY "st"."account", "st"."campaign", "st"."search_term"
        ), "solape" AS (
         SELECT "st"."account",
            "st"."campaign",
            "st"."ad_group",
            "st"."search_term",
            "st"."triggered_keyword",
            "st"."conv",
            "st"."cost",
            "st"."clicks",
            ( SELECT "count"(*) AS "count"
                   FROM "unnest"("string_to_array"("lower"("st"."search_term"), ' '::"text")) "w"("w")
                  WHERE (("length"("w"."w") > 3) AND ("lower"(COALESCE("st"."triggered_keyword", ''::"text")) ~~ (('%'::"text" || "w"."w") || '%'::"text")))) AS "palabras_cubiertas",
            ( SELECT "count"(*) AS "count"
                   FROM "unnest"("string_to_array"("lower"("st"."search_term"), ' '::"text")) "w"("w")
                  WHERE ("length"("w"."w") > 3)) AS "palabras_del_termino"
           FROM "st"
        )
 SELECT "s"."account",
    "d"."location",
    "s"."campaign",
    "s"."ad_group",
    "s"."search_term",
    "s"."triggered_keyword",
    "round"("s"."cost") AS "gasto_30d",
    "round"("s"."conv", 1) AS "conversiones_30d",
    "s"."clicks",
    "round"(("s"."cost" / NULLIF("s"."conv", (0)::numeric)), 2) AS "cpa_del_termino",
    "round"("g"."cpa_grupo", 2) AS "cpa_del_grupo",
    "round"(("s"."cost" / NULLIF("s"."clicks", (0)::numeric))) AS "cpc_promedio",
    "s"."palabras_cubiertas",
    "s"."palabras_del_termino",
        CASE
            WHEN ("s"."palabras_del_termino" = 0) THEN 'termino de una sola palabra corta: no se puede medir el solape'::"text"
            WHEN (("s"."palabras_cubiertas" = 0) AND ("s"."conv" > (0)::numeric) AND (("s"."cost" / NULLIF("s"."conv", (0)::numeric)) < "g"."cpa_grupo")) THEN (((('MERECE SU PROPIO GRUPO O KEYWORD: convierte mejor que el grupo ('::"text" || "round"(("s"."cost" / NULLIF("s"."conv", (0)::numeric)), 2)) || ' contra '::"text") || "round"("g"."cpa_grupo", 2)) || ') y ninguna keyword del grupo lo cubre.'::"text")
            WHEN (("s"."palabras_cubiertas" = 0) AND ("s"."conv" > (0)::numeric)) THEN 'REVISAR: no esta cubierto pero convierte peor que el grupo.'::"text"
            WHEN (("s"."palabras_cubiertas" = 0) AND ("s"."conv" = (0)::numeric) AND ("s"."cost" > (0)::numeric) AND ("o"."grupos_del_termino" > 1) AND ("o"."conv_en_la_campana" > (0)::numeric)) THEN (((((((((('NEGATIVA SOLO A NIVEL GRUPO: '::"text" || "round"("s"."cost")) || ' de gasto en '::"text") || "s"."clicks") || ' clic(s) sin convertir AQUI, pero el mismo termino convierte '::"text") || "round"("o"."conv_en_la_campana", 1)) || ' vez(ces) en '::"text") || "o"."grupos_donde_convierte") || '. A nivel campana apagas las dos: ponerla solo en '::"text") || "s"."ad_group") || '.'::"text")
            WHEN (("s"."palabras_cubiertas" = 0) AND ("s"."conv" = (0)::numeric) AND ("s"."cost" > (0)::numeric)) THEN (((('CANDIDATO A NEGATIVA (nivel campana o grupo): '::"text" || "round"("s"."cost")) || ' de gasto en '::"text") || "s"."clicks") || ' clic(s), cero conversiones, y no convierte en ningun otro grupo de la campana.'::"text")
            WHEN (("s"."palabras_cubiertas" < "s"."palabras_del_termino") AND ("s"."conv" = (0)::numeric) AND ("s"."cost" > (0)::numeric)) THEN 'REVISAR: cobertura parcial y sin conversiones.'::"text"
            ELSE 'CUBIERTO: la keyword que lo disparo contiene el tema del termino.'::"text"
        END AS "veredicto",
        CASE
            WHEN (("s"."palabras_cubiertas" = 0) AND ("s"."conv" > (0)::numeric) AND (("s"."cost" / NULLIF("s"."conv", (0)::numeric)) < "g"."cpa_grupo")) THEN 'crear'::"text"
            WHEN (("s"."palabras_cubiertas" = 0) AND ("s"."conv" = (0)::numeric) AND ("s"."cost" > (0)::numeric)) THEN 'negativa'::"text"
            WHEN ("s"."palabras_cubiertas" = 0) THEN 'revisar'::"text"
            ELSE 'ok'::"text"
        END AS "accion",
    (("o"."grupos_del_termino" > 1) AND ("o"."conv_en_la_campana" > (0)::numeric) AND ("s"."conv" = (0)::numeric)) AS "conflicto_entre_grupos",
        CASE
            WHEN (("s"."conv" = (0)::numeric) AND ("o"."grupos_del_termino" > 1) AND ("o"."conv_en_la_campana" > (0)::numeric)) THEN 'grupo'::"text"
            WHEN ("s"."conv" = (0)::numeric) THEN 'campana'::"text"
            ELSE NULL::"text"
        END AS "nivel_recomendado",
    "o"."grupos_donde_convierte"
   FROM ((("solape" "s"
     JOIN "grupo" "g" ON ((("g"."account" = "s"."account") AND ("g"."campaign" = "s"."campaign") AND ("g"."ad_group" = "s"."ad_group"))))
     JOIN "otros" "o" ON ((("o"."account" = "s"."account") AND ("o"."campaign" = "s"."campaign") AND ("o"."search_term" = "s"."search_term"))))
     LEFT JOIN "public"."campaign_dim" "d" ON ((("d"."account" = "s"."account") AND ("d"."campaign" = "s"."campaign"))));


ALTER VIEW "public"."v_terminos_sin_cobertura" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_terminos_sin_cobertura" IS 'Terminos cuyo tema ninguna keyword del grupo cubre, con el veredicto Y EL NIVEL de la accion. nivel_recomendado dice grupo cuando el mismo termino convierte en otro grupo de la campana: ahi una negativa de campana apaga tambien el lado que funciona. El radio de la accion tiene que ser el radio de la evidencia.';



CREATE OR REPLACE VIEW "public"."v_tickets_sin_control" AS
 SELECT "t"."id",
    "t"."cuenta",
    "t"."tipo",
    "left"("t"."titulo", 90) AS "titulo",
    "t"."estado",
    "t"."veces_reabierto",
    "count"("ct"."relacion_id") AS "controles",
    "count"(*) FILTER (WHERE ("r"."mutante_resultado" = 'mato_al_mutante'::"text")) AS "controles_probados",
        CASE
            WHEN ("count"("ct"."relacion_id") = 0) THEN 'Sin control: si vuelve, nadie se entera.'::"text"
            WHEN ("count"(*) FILTER (WHERE ("r"."mutante_resultado" = 'mato_al_mutante'::"text")) = 0) THEN 'Tiene control pero sin mutante probado: no se sabe si puede fallar.'::"text"
            ELSE 'Cubierto.'::"text"
        END AS "lectura"
   FROM (("public"."tickets" "t"
     LEFT JOIN "public"."controles_de_ticket" "ct" ON (("ct"."ticket_id" = "t"."id")))
     LEFT JOIN "public"."relaciones_verdad" "r" ON (("r"."id" = "ct"."relacion_id")))
  WHERE (("t"."estado" = 'abierto'::"text") AND ("t"."tipo" = ANY (ARRAY['bug'::"text", 'dato_incorrecto'::"text"])))
  GROUP BY "t"."id", "t"."cuenta", "t"."tipo", "t"."titulo", "t"."estado", "t"."veces_reabierto"
  ORDER BY ("count"("ct"."relacion_id")), "t"."id";


ALTER VIEW "public"."v_tickets_sin_control" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tickets_sin_control" IS 'Tickets abiertos de bug que hoy no podrian cerrarse porque nada vigila que vuelvan. Es la cola de trabajo real: cada uno necesita una relacion antes que un arreglo.';



CREATE OR REPLACE VIEW "public"."v_todos_los_cambios" WITH ("security_invoker"='on') AS
 SELECT "operator_log"."account",
    "operator_log"."fecha",
    "operator_log"."hora",
    'operador'::"text" AS "fuente",
    COALESCE("operator_log"."donde", 'sin ambito'::"text") AS "ambito",
    "operator_log"."que_cambio" AS "detalle",
    "operator_log"."valor_anterior",
    "operator_log"."valor_nuevo",
    "operator_log"."por_que",
    false AS "automatico"
   FROM "public"."operator_log"
UNION ALL
 SELECT "change_events"."account",
    (SUBSTRING("change_events"."change_datetime" FROM 1 FOR 10))::"date" AS "fecha",
    (SUBSTRING("change_events"."change_datetime" FROM 12 FOR 8))::time without time zone AS "hora",
    'change_events'::"text" AS "fuente",
    "change_events"."resource_type" AS "ambito",
    COALESCE("change_events"."changed_field", '(campo no registrado)'::"text") AS "detalle",
    "change_events"."old_value" AS "valor_anterior",
    "change_events"."new_value" AS "valor_nuevo",
    NULL::"text" AS "por_que",
    (("change_events"."client_type" ~~ '%RECOMMENDATION%'::"text") OR ("change_events"."client_type" ~~ '%GOOGLE_FIRST_PARTY%'::"text")) AS "automatico"
   FROM "public"."change_events"
  WHERE ("change_events"."change_datetime" IS NOT NULL)
UNION ALL
 SELECT "v_cambios_detectados"."account",
    "v_cambios_detectados"."detectado_hasta" AS "fecha",
    NULL::time without time zone AS "hora",
    'snapshot'::"text" AS "fuente",
    "v_cambios_detectados"."entity_type" AS "ambito",
    (("v_cambios_detectados"."entity_name" || ' · '::"text") || ( SELECT "string_agg"("k"."k", ', '::"text") AS "string_agg"
           FROM "jsonb_object_keys"("v_cambios_detectados"."campos_cambiados") "k"("k"))) AS "detalle",
    ("v_cambios_detectados"."campos_cambiados")::"text" AS "valor_anterior",
    NULL::"text" AS "valor_nuevo",
    ((('Detectado por diferencia entre snapshots del '::"text" || "v_cambios_detectados"."detectado_entre") || ' y el '::"text") || "v_cambios_detectados"."detectado_hasta") AS "por_que",
    false AS "automatico"
   FROM "public"."v_cambios_detectados";


ALTER VIEW "public"."v_todos_los_cambios" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_todos_los_cambios" IS 'Tres fuentes en una lista: change_events (lo que Google registra), snapshot (lo que se detecta por diferencia, incluyendo conversiones), y operador (lo que Andres anota con su motivo). Si algo esta en snapshot y no en change_events, es normal: Google no registra todo.';



CREATE OR REPLACE VIEW "public"."v_ultima_sesion" WITH ("security_invoker"='true') AS
 SELECT "id",
    "fecha",
    "titulo",
    "desde_version",
    "hasta_version",
    "con_que_empezo",
    "que_se_construyo",
    "que_se_aprendio",
    "que_quedo_pendiente",
    "creada"
   FROM "public"."sesiones"
  ORDER BY "fecha" DESC, "id" DESC
 LIMIT 1;


ALTER VIEW "public"."v_ultima_sesion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" bigint NOT NULL,
    "source" "text" NOT NULL,
    "external_id" "text",
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'RECEIVED'::"text" NOT NULL,
    "error_msg" "text",
    "processed_at" timestamp with time zone,
    "received_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "webhook_events_status_check" CHECK (("status" = ANY (ARRAY['RECEIVED'::"text", 'PROCESSED'::"text", 'QUARANTINED'::"text", 'FAILED'::"text"])))
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."webhook_events" IS 'Bitacora cruda de todo webhook entrante, antes de procesarlo. Sirve para tres cosas: deduplicar por external_id, poner en cuarentena lo que no se pudo interpretar en lugar de descartarlo, y reprocesar sin pedirle al origen que reenvie. status QUARANTINED significa que llego pero no se entendio: requiere revision.';



CREATE OR REPLACE VIEW "public"."v_webhook_health" WITH ("security_invoker"='on') AS
 WITH "ultimos" AS (
         SELECT "webhook_events"."source",
            "max"("webhook_events"."received_at") AS "ultimo_evento",
            "count"(*) FILTER (WHERE ("webhook_events"."received_at" > ("now"() - '7 days'::interval))) AS "eventos_7d",
            "count"(*) FILTER (WHERE ("webhook_events"."status" = 'QUARANTINED'::"text")) AS "en_cuarentena",
            "count"(*) FILTER (WHERE ("webhook_events"."status" = 'FAILED'::"text")) AS "fallidos"
           FROM "public"."webhook_events"
          GROUP BY "webhook_events"."source"
        )
 SELECT "source",
    "ultimo_evento",
    "round"((EXTRACT(epoch FROM ("now"() - "ultimo_evento")) / (3600)::numeric), 1) AS "horas_sin_eventos",
    "eventos_7d",
    "en_cuarentena",
    "fallidos",
        CASE
            WHEN ("fallidos" > 0) THEN 'ERROR'::"text"
            WHEN ("en_cuarentena" > 0) THEN 'REVISAR'::"text"
            WHEN (("now"() - "ultimo_evento") > '7 days'::interval) THEN 'SIN ACTIVIDAD'::"text"
            ELSE 'OK'::"text"
        END AS "estado"
   FROM "ultimos";


ALTER VIEW "public"."v_webhook_health" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_webhook_health" IS 'Estado de las integraciones entrantes. SIN ACTIVIDAD durante mas de 7 dias en un webhook que deberia recibir eventos casi siempre significa que se desactivo del lado del proveedor, no que no haya novedades.';



CREATE OR REPLACE VIEW "public"."v_win_rates_reales" WITH ("security_invoker"='on') AS
 WITH "por_lead" AS (
         SELECT "funnel_events"."account",
            "funnel_events"."external_id",
            "max"("funnel_events"."stage_order") AS "etapa_max"
           FROM "public"."funnel_events"
          GROUP BY "funnel_events"."account", "funnel_events"."external_id"
        ), "por_etapa" AS (
         SELECT "s"."account",
            "s"."stage_order",
            "s"."stage_name",
            "count"(DISTINCT "e"."external_id") AS "llegaron",
            "count"(DISTINCT "e"."external_id") FILTER (WHERE ("p"."etapa_max" = ( SELECT "max"("x"."stage_order") AS "max"
                   FROM "public"."funnel_stages" "x"
                  WHERE ("x"."account" = "s"."account")))) AS "cerraron"
           FROM (("public"."funnel_stages" "s"
             LEFT JOIN "public"."funnel_events" "e" ON ((("e"."account" = "s"."account") AND ("e"."stage_order" >= "s"."stage_order"))))
             LEFT JOIN "por_lead" "p" ON ((("p"."account" = "e"."account") AND ("p"."external_id" = "e"."external_id"))))
          GROUP BY "s"."account", "s"."stage_order", "s"."stage_name"
        )
 SELECT "account",
    "stage_order",
    "stage_name",
    "llegaron",
    "cerraron",
        CASE
            WHEN ("llegaron" >= 10) THEN "round"((("cerraron")::numeric / ("llegaron")::numeric), 3)
            ELSE NULL::numeric
        END AS "win_rate_real",
        CASE
            WHEN ("llegaron" >= 10) THEN 'calculado'::"text"
            ELSE (('insuficiente ('::"text" || "llegaron") || ' leads, minimo 10)'::"text")
        END AS "confianza"
   FROM "por_etapa"
  ORDER BY "account", "stage_order";


ALTER VIEW "public"."v_win_rates_reales" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_win_rates_reales" IS 'Tasa de cierre real desde cada etapa, calculada de funnel_events. Con menos de 10 leads por etapa no se calcula. Cuando hay suficientes, reemplaza los estimados de funnel_stages: actualizar win_rate_to_close y cambiar win_rate_origen a calculado.';



CREATE SEQUENCE IF NOT EXISTS "public"."webhook_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."webhook_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."webhook_events_id_seq" OWNED BY "public"."webhook_events"."id";



CREATE TABLE IF NOT EXISTS "public"."weekly_brief" (
    "id" bigint NOT NULL,
    "account" "text",
    "week_start" "date",
    "week_end" "date",
    "section" "text",
    "item" "text",
    "detail" "text",
    "value" "text",
    "prev_value" "text",
    "delta_pct" "text",
    "note" "text",
    "run_ts" "text"
);


ALTER TABLE "public"."weekly_brief" OWNER TO "postgres";


COMMENT ON TABLE "public"."weekly_brief" IS 'Capa pre-agregada que genera el script. Punto de partida de la lectura semanal. Incluye totales comparados contra la semana previa, campanas, conversiones por accion, top keywords, terminos sin conversion, cambios, alertas y listas exactas de entidades en las secciones que empiezan con entidades_.';



CREATE SEQUENCE IF NOT EXISTS "public"."weekly_brief_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."weekly_brief_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."weekly_brief_id_seq" OWNED BY "public"."weekly_brief"."id";



ALTER TABLE ONLY "public"."accionable_relaciones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."accionable_relaciones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accionable_versiones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."accionable_versiones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."acciones_aprobadas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."acciones_aprobadas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."account_state" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."account_state_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."adgroup" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."adgroup_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."adgroup_daily" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."adgroup_daily_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ads" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ads_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alertas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."alertas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alerts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."alerts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."annotations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."annotations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audiences" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audiences_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."backups_memoria" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."backups_memoria_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bid_targets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bid_targets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."budget" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."budget_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."budget_daily" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."budget_daily_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cambios_config" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cambios_config_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cambios_de_sistema" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cambios_de_sistema_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."campaign" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."campaign_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."campaign_daily" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."campaign_daily_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."campaign_mapa" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."campaign_mapa_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."candidatos_a_retiro" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."candidatos_a_retiro_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."change_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."change_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cierres_sin_atribucion" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cierres_sin_atribucion_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cifras_publicadas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cifras_publicadas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."config_snapshot" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."config_snapshot_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."conocimiento_externo" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."conocimiento_externo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."conversion_actions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."conversion_actions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."conversion_actions_daily" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."conversion_actions_daily_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."corridas_verdad" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."corridas_verdad_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cuarentena" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cuarentena_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."device" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."device_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."doc_maestro_humano" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."doc_maestro_humano_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."entity_states" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."entity_states_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."funnel_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."funnel_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."funnel_stages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."funnel_stages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."geo" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."geo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."google_live_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."google_live_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."grupos_reporte" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."grupos_reporte_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."hour_day" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."hour_day_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."intentos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."intentos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."keywords" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."keywords_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."keywords_daily" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."keywords_daily_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."landing_pages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."landing_pages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lecciones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."lecciones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."locations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."locations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."memoria" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."memoria_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."negatives" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."negatives_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notas_para_agentes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notas_para_agentes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."novedades" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."novedades_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."objetivos_conversion" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."objetivos_conversion_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."operator_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."operator_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pending_mutations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pending_mutations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."plan_semanal" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."plan_semanal_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."planes_tecnicos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."planes_tecnicos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."predicciones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."predicciones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."propuestas_estrategicas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."propuestas_estrategicas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pulso_diario" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pulso_diario_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reconciliaciones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reconciliaciones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reflexiones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reflexiones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."relaciones_verdad" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."relaciones_verdad_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reportes_cliente" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reportes_cliente_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reportes_versiones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reportes_versiones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."rsa_assets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rsa_assets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."run_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."run_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."run_quality" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."run_quality_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."search_terms" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."search_terms_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."search_terms_daily" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."search_terms_daily_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sesiones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sesiones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."simulations" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."simulations_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."terminos_protegidos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."terminos_protegidos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tickets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tickets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."true_roas_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."true_roas_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."webhook_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."webhook_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."weekly_brief" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."weekly_brief_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accionable_comentarios"
    ADD CONSTRAINT "accionable_comentarios_pkey" PRIMARY KEY ("comment_id");



ALTER TABLE ONLY "public"."accionable_relaciones"
    ADD CONSTRAINT "accionable_relaciones_a_b_tipo_regla_key" UNIQUE ("a", "b", "tipo", "regla");



ALTER TABLE ONLY "public"."accionable_relaciones"
    ADD CONSTRAINT "accionable_relaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accionable_versiones"
    ADD CONSTRAINT "accionable_versiones_notion_id_version_key" UNIQUE ("notion_id", "version");



ALTER TABLE ONLY "public"."accionable_versiones"
    ADD CONSTRAINT "accionable_versiones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accionables_ejecutados"
    ADD CONSTRAINT "accionables_ejecutados_pkey" PRIMARY KEY ("notion_id");



ALTER TABLE ONLY "public"."accionables_espejo"
    ADD CONSTRAINT "accionables_espejo_pkey" PRIMARY KEY ("notion_id");



ALTER TABLE ONLY "public"."acciones_aprobadas"
    ADD CONSTRAINT "acciones_aprobadas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_state"
    ADD CONSTRAINT "account_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_targets"
    ADD CONSTRAINT "account_targets_pkey" PRIMARY KEY ("account");



ALTER TABLE ONLY "public"."legacy_actionables_memory"
    ADD CONSTRAINT "actionables_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adgroup_daily"
    ADD CONSTRAINT "adgroup_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adgroup"
    ADD CONSTRAINT "adgroup_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ads"
    ADD CONSTRAINT "ads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_max_estado"
    ADD CONSTRAINT "ai_max_estado_pkey" PRIMARY KEY ("account", "entidad");



ALTER TABLE ONLY "public"."ajustes_sistema"
    ADD CONSTRAINT "ajustes_sistema_pkey" PRIMARY KEY ("clave");



ALTER TABLE ONLY "public"."alertas"
    ADD CONSTRAINT "alertas_dedupe_key_key" UNIQUE ("dedupe_key");



ALTER TABLE ONLY "public"."alertas"
    ADD CONSTRAINT "alertas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audiences"
    ADD CONSTRAINT "audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auditoria_objetos_ultima"
    ADD CONSTRAINT "auditoria_objetos_ultima_pkey" PRIMARY KEY ("corrida_el");



ALTER TABLE ONLY "public"."backups_memoria"
    ADD CONSTRAINT "backups_memoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bid_targets"
    ADD CONSTRAINT "bid_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_daily"
    ADD CONSTRAINT "budget_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget"
    ADD CONSTRAINT "budget_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cambios_config"
    ADD CONSTRAINT "cambios_config_account_entidad_campo_foto_actual_key" UNIQUE ("account", "entidad", "campo", "foto_actual");



ALTER TABLE ONLY "public"."cambios_config"
    ADD CONSTRAINT "cambios_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cambios_de_sistema"
    ADD CONSTRAINT "cambios_de_sistema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_daily"
    ADD CONSTRAINT "campaign_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_dim"
    ADD CONSTRAINT "campaign_dim_pkey" PRIMARY KEY ("account", "campaign");



ALTER TABLE ONLY "public"."campaign_fechas"
    ADD CONSTRAINT "campaign_fechas_pkey" PRIMARY KEY ("account", "campaign");



ALTER TABLE ONLY "public"."campaign_mapa"
    ADD CONSTRAINT "campaign_mapa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign"
    ADD CONSTRAINT "campaign_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidatos_a_retiro"
    ADD CONSTRAINT "candidatos_a_retiro_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capacidades_ejecucion"
    ADD CONSTRAINT "capacidades_ejecucion_pkey" PRIMARY KEY ("plataforma", "verbo");



ALTER TABLE ONLY "public"."change_events"
    ADD CONSTRAINT "change_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cierres_sin_atribucion"
    ADD CONSTRAINT "cierres_sin_atribucion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cifras_publicadas"
    ADD CONSTRAINT "cifras_publicadas_brief_id_etiqueta_key" UNIQUE ("brief_id", "etiqueta");



ALTER TABLE ONLY "public"."cifras_publicadas"
    ADD CONSTRAINT "cifras_publicadas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."config_snapshot"
    ADD CONSTRAINT "config_snapshot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conocimiento_externo"
    ADD CONSTRAINT "conocimiento_externo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conocimiento_externo"
    ADD CONSTRAINT "conocimiento_externo_titulo_key" UNIQUE ("titulo");



ALTER TABLE ONLY "public"."contratos_columna"
    ADD CONSTRAINT "contratos_columna_pkey" PRIMARY KEY ("objeto", "columna");



ALTER TABLE ONLY "public"."controles_de_ticket"
    ADD CONSTRAINT "controles_de_ticket_pkey" PRIMARY KEY ("ticket_id", "relacion_id");



ALTER TABLE ONLY "public"."conversion_actions_daily"
    ADD CONSTRAINT "conversion_actions_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversion_actions"
    ADD CONSTRAINT "conversion_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corridas_verdad"
    ADD CONSTRAINT "corridas_verdad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuarentena"
    ADD CONSTRAINT "cuarentena_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuarentena"
    ADD CONSTRAINT "cuarentena_tabla_registro_id_key" UNIQUE ("tabla", "registro_id");



ALTER TABLE ONLY "public"."cuentas"
    ADD CONSTRAINT "cuentas_pkey" PRIMARY KEY ("account");



ALTER TABLE ONLY "public"."device"
    ADD CONSTRAINT "device_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_maestro_consolidado"
    ADD CONSTRAINT "doc_maestro_consolidado_pkey" PRIMARY KEY ("account");



ALTER TABLE ONLY "public"."doc_maestro_humano"
    ADD CONSTRAINT "doc_maestro_humano_account_seccion_version_key" UNIQUE ("account", "seccion", "version");



ALTER TABLE ONLY "public"."doc_maestro_humano"
    ADD CONSTRAINT "doc_maestro_humano_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drift_exento"
    ADD CONSTRAINT "drift_exento_pkey" PRIMARY KEY ("patron");



ALTER TABLE ONLY "public"."entity_states"
    ADD CONSTRAINT "entity_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escritores"
    ADD CONSTRAINT "escritores_pkey" PRIMARY KEY ("entidad");



ALTER TABLE ONLY "public"."filtro_umbrales"
    ADD CONSTRAINT "filtro_umbrales_pkey" PRIMARY KEY ("clave");



ALTER TABLE ONLY "public"."funnel_events"
    ADD CONSTRAINT "funnel_events_account_external_id_stage_order_key" UNIQUE ("account", "external_id", "stage_order");



ALTER TABLE ONLY "public"."funnel_events"
    ADD CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funnel_stages"
    ADD CONSTRAINT "funnel_stages_account_stage_order_key" UNIQUE ("account", "stage_order");



ALTER TABLE ONLY "public"."funnel_stages"
    ADD CONSTRAINT "funnel_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."geo"
    ADD CONSTRAINT "geo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_live_events"
    ADD CONSTRAINT "google_live_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grupos_reporte"
    ADD CONSTRAINT "grupos_reporte_account_codigo_key" UNIQUE ("account", "codigo");



ALTER TABLE ONLY "public"."grupos_reporte"
    ADD CONSTRAINT "grupos_reporte_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hour_day"
    ADD CONSTRAINT "hour_day_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidentes_atendidos"
    ADD CONSTRAINT "incidentes_atendidos_pkey" PRIMARY KEY ("clave");



ALTER TABLE ONLY "public"."intentos"
    ADD CONSTRAINT "intentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."keywords_daily"
    ADD CONSTRAINT "keywords_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."keywords"
    ADD CONSTRAINT "keywords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_pages"
    ADD CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."latidos"
    ADD CONSTRAINT "latidos_pkey" PRIMARY KEY ("tarea");



ALTER TABLE ONLY "public"."lecciones"
    ADD CONSTRAINT "lecciones_account_leccion_key" UNIQUE ("account", "leccion");



ALTER TABLE ONLY "public"."lecciones"
    ADD CONSTRAINT "lecciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."limites_plataforma"
    ADD CONSTRAINT "limites_plataforma_pkey" PRIMARY KEY ("plataforma", "regla");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_account_codigo_key" UNIQUE ("account", "codigo");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memoria"
    ADD CONSTRAINT "memoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memoria_revisada"
    ADD CONSTRAINT "memoria_revisada_pkey" PRIMARY KEY ("memoria_id");



ALTER TABLE ONLY "public"."memoria"
    ADD CONSTRAINT "memoria_tipo_origen_id_key" UNIQUE ("tipo", "origen_id");



ALTER TABLE ONLY "public"."metricas"
    ADD CONSTRAINT "metricas_pkey" PRIMARY KEY ("nombre");



ALTER TABLE ONLY "public"."negatives"
    ADD CONSTRAINT "negatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas_de_objetos"
    ADD CONSTRAINT "notas_de_objetos_pkey" PRIMARY KEY ("objeto");



ALTER TABLE ONLY "public"."notas_para_agentes"
    ADD CONSTRAINT "notas_para_agentes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notion_espejo_cuentas"
    ADD CONSTRAINT "notion_espejo_cuentas_pkey" PRIMARY KEY ("account");



ALTER TABLE ONLY "public"."novedades"
    ADD CONSTRAINT "novedades_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."novedades"
    ADD CONSTRAINT "novedades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."objetivos_conversion"
    ADD CONSTRAINT "objetivos_conversion_account_objetivo_key" UNIQUE ("account", "objetivo");



ALTER TABLE ONLY "public"."objetivos_conversion"
    ADD CONSTRAINT "objetivos_conversion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_log"
    ADD CONSTRAINT "operator_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patrones_drift"
    ADD CONSTRAINT "patrones_drift_pkey" PRIMARY KEY ("patron");



ALTER TABLE ONLY "public"."pending_mutations"
    ADD CONSTRAINT "pending_mutations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_semanal"
    ADD CONSTRAINT "plan_semanal_account_semana_key" UNIQUE ("account", "semana");



ALTER TABLE ONLY "public"."plan_semanal"
    ADD CONSTRAINT "plan_semanal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planes_tecnicos"
    ADD CONSTRAINT "planes_tecnicos_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."planes_tecnicos"
    ADD CONSTRAINT "planes_tecnicos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."politicas_auto"
    ADD CONSTRAINT "politicas_auto_pkey" PRIMARY KEY ("tipo");



ALTER TABLE ONLY "public"."predicciones"
    ADD CONSTRAINT "predicciones_account_semana_metrica_key" UNIQUE ("account", "semana", "metrica");



ALTER TABLE ONLY "public"."predicciones"
    ADD CONSTRAINT "predicciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."propuestas_estrategicas"
    ADD CONSTRAINT "propuestas_estrategicas_account_titulo_key" UNIQUE ("account", "titulo");



ALTER TABLE ONLY "public"."propuestas_estrategicas"
    ADD CONSTRAINT "propuestas_estrategicas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pulso_diario"
    ADD CONSTRAINT "pulso_diario_account_fecha_key" UNIQUE ("account", "fecha");



ALTER TABLE ONLY "public"."pulso_diario"
    ADD CONSTRAINT "pulso_diario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reconciliaciones"
    ADD CONSTRAINT "reconciliaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reflexiones"
    ADD CONSTRAINT "reflexiones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relaciones_verdad"
    ADD CONSTRAINT "relaciones_verdad_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."relaciones_verdad"
    ADD CONSTRAINT "relaciones_verdad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reportes_cliente"
    ADD CONSTRAINT "reportes_cliente_account_periodo_desde_tipo_key" UNIQUE ("account", "periodo_desde", "tipo");



ALTER TABLE ONLY "public"."reportes_cliente"
    ADD CONSTRAINT "reportes_cliente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reportes_cliente"
    ADD CONSTRAINT "reportes_cliente_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."reportes_versiones"
    ADD CONSTRAINT "reportes_versiones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reportes_versiones"
    ADD CONSTRAINT "reportes_versiones_reporte_id_version_key" UNIQUE ("reporte_id", "version");



ALTER TABLE ONLY "public"."rsa_assets"
    ADD CONSTRAINT "rsa_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."run_log"
    ADD CONSTRAINT "run_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."run_quality"
    ADD CONSTRAINT "run_quality_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_terms_daily"
    ADD CONSTRAINT "search_terms_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_terms"
    ADD CONSTRAINT "search_terms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sesiones"
    ADD CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."simulations"
    ADD CONSTRAINT "simulations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."terminos_protegidos"
    ADD CONSTRAINT "terminos_protegidos_account_termino_key" UNIQUE ("account", "termino");



ALTER TABLE ONLY "public"."terminos_protegidos"
    ADD CONSTRAINT "terminos_protegidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."true_roas_events"
    ADD CONSTRAINT "true_roas_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."umbrales_de_scripts"
    ADD CONSTRAINT "umbrales_de_scripts_pkey" PRIMARY KEY ("account", "script", "umbral");



ALTER TABLE ONLY "public"."umbrales_esperados"
    ADD CONSTRAINT "umbrales_esperados_pkey" PRIMARY KEY ("script", "umbral");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_brief"
    ADD CONSTRAINT "weekly_brief_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_acciones_pend" ON "public"."acciones_aprobadas" USING "btree" ("estado", "account");



CREATE INDEX "idx_account_state_acct" ON "public"."account_state" USING "btree" ("account");



CREATE INDEX "idx_adgroup_acct" ON "public"."adgroup" USING "btree" ("account", "week_start");



CREATE INDEX "idx_adgroup_daily_fecha" ON "public"."adgroup_daily" USING "btree" ("account", "date" DESC);



CREATE INDEX "idx_ads_acct" ON "public"."ads" USING "btree" ("account", "week_start");



CREATE INDEX "idx_alertas_estado" ON "public"."alertas" USING "btree" ("estado", "nivel", "creada" DESC);



CREATE INDEX "idx_alerts_acct" ON "public"."alerts" USING "btree" ("account", "week_start");



CREATE INDEX "idx_annotations_acct" ON "public"."annotations" USING "btree" ("account", "fecha");



CREATE INDEX "idx_audiences_acct" ON "public"."audiences" USING "btree" ("account", "week_start");



CREATE INDEX "idx_bid_targets_acct" ON "public"."bid_targets" USING "btree" ("account", "week_start");



CREATE INDEX "idx_budget_acct" ON "public"."budget" USING "btree" ("account", "week_start");



CREATE INDEX "idx_budget_daily_acct_date" ON "public"."budget_daily" USING "btree" ("account", "date" DESC);



CREATE INDEX "idx_campaign_acct" ON "public"."campaign" USING "btree" ("account", "week_start");



CREATE INDEX "idx_campaign_daily_fecha" ON "public"."campaign_daily" USING "btree" ("account", "date" DESC);



CREATE INDEX "idx_campaign_dim_loc" ON "public"."campaign_dim" USING "btree" ("account", "location");



CREATE INDEX "idx_campaign_dim_obj" ON "public"."campaign_dim" USING "btree" ("account", "objetivo");



CREATE INDEX "idx_change_events_acct" ON "public"."change_events" USING "btree" ("account");



CREATE INDEX "idx_change_events_acct_dt" ON "public"."change_events" USING "btree" ("account", "change_datetime" DESC);



CREATE INDEX "idx_change_events_entity" ON "public"."change_events" USING "btree" ("account", "entity_name");



CREATE INDEX "idx_com_notion" ON "public"."accionable_comentarios" USING "btree" ("notion_id", "creado" DESC);



CREATE INDEX "idx_config_snapshot_date" ON "public"."config_snapshot" USING "btree" ("snapshot_date" DESC);



CREATE INDEX "idx_config_snapshot_lookup" ON "public"."config_snapshot" USING "btree" ("account", "entity_type", "entity_name", "snapshot_date" DESC);



CREATE INDEX "idx_conv_actions_daily_fecha" ON "public"."conversion_actions_daily" USING "btree" ("account", "date" DESC);



CREATE INDEX "idx_conversion_actions_acct" ON "public"."conversion_actions" USING "btree" ("account", "week_start");



CREATE INDEX "idx_device_acct" ON "public"."device" USING "btree" ("account", "week_start");



CREATE INDEX "idx_doc_humano_vigente" ON "public"."doc_maestro_humano" USING "btree" ("account", "vigente", "orden");



CREATE INDEX "idx_esp_acct_estado" ON "public"."accionables_espejo" USING "btree" ("account", "estado");



CREATE INDEX "idx_funnel_events_acct_date" ON "public"."funnel_events" USING "btree" ("account", "reached_at" DESC);



CREATE INDEX "idx_funnel_events_lead" ON "public"."funnel_events" USING "btree" ("account", "external_id");



CREATE INDEX "idx_funnel_events_pending" ON "public"."funnel_events" USING "btree" ("account", "uploaded_to_google") WHERE (NOT "uploaded_to_google");



CREATE INDEX "idx_geo_acct" ON "public"."geo" USING "btree" ("account", "week_start");



CREATE INDEX "idx_hour_day_acct" ON "public"."hour_day" USING "btree" ("account", "week_start");



CREATE INDEX "idx_keywords_acct" ON "public"."keywords" USING "btree" ("account", "week_start");



CREATE INDEX "idx_keywords_daily_fecha" ON "public"."keywords_daily" USING "btree" ("account", "date" DESC);



CREATE INDEX "idx_keywords_daily_kw" ON "public"."keywords_daily" USING "btree" ("account", "keyword");



CREATE INDEX "idx_landing_pages_acct" ON "public"."landing_pages" USING "btree" ("account", "week_start");



CREATE INDEX "idx_live_events_acct_date" ON "public"."google_live_events" USING "btree" ("account", "event_date" DESC);



CREATE INDEX "idx_memoria_acct" ON "public"."memoria" USING "btree" ("account", "fecha" DESC);



CREATE INDEX "idx_negatives_acct" ON "public"."negatives" USING "btree" ("account", "week_start");



CREATE INDEX "idx_nov_noleidas" ON "public"."novedades" USING "btree" ("leida_el") WHERE ("leida_el" IS NULL);



CREATE INDEX "idx_operator_log_acct" ON "public"."operator_log" USING "btree" ("account", "fecha" DESC);



CREATE INDEX "idx_plan_acct_semana" ON "public"."plan_semanal" USING "btree" ("account", "semana" DESC);



CREATE INDEX "idx_pulso_acct_fecha" ON "public"."pulso_diario" USING "btree" ("account", "fecha" DESC);



CREATE INDEX "idx_reflexiones_acct" ON "public"."reflexiones" USING "btree" ("account", "run_date" DESC);



CREATE INDEX "idx_rel_abiertas" ON "public"."accionable_relaciones" USING "btree" ("account", "resuelta") WHERE (NOT "resuelta");



CREATE INDEX "idx_reportes_acct_estado" ON "public"."reportes_cliente" USING "btree" ("account", "estado", "periodo_desde" DESC);



CREATE INDEX "idx_rsa_assets_acct" ON "public"."rsa_assets" USING "btree" ("account", "week_start");



CREATE INDEX "idx_run_log_acct" ON "public"."run_log" USING "btree" ("account", "run_ts" DESC);



CREATE INDEX "idx_run_quality_acct" ON "public"."run_quality" USING "btree" ("account", "run_date" DESC);



CREATE INDEX "idx_search_terms_acct" ON "public"."search_terms" USING "btree" ("account", "week_start");



CREATE INDEX "idx_search_terms_daily_fecha" ON "public"."search_terms_daily" USING "btree" ("account", "date" DESC);



CREATE INDEX "idx_search_terms_daily_term" ON "public"."search_terms_daily" USING "btree" ("account", "search_term");



CREATE INDEX "idx_simulations_acct" ON "public"."simulations" USING "btree" ("account");



CREATE INDEX "idx_tickets_estado" ON "public"."tickets" USING "btree" ("estado", "creado" DESC);



CREATE INDEX "idx_versiones_notion" ON "public"."accionable_versiones" USING "btree" ("notion_id", "version" DESC);



CREATE INDEX "idx_webhook_events_source" ON "public"."webhook_events" USING "btree" ("source", "received_at" DESC);



CREATE INDEX "idx_webhook_events_status" ON "public"."webhook_events" USING "btree" ("status") WHERE ("status" <> 'PROCESSED'::"text");



CREATE INDEX "idx_weekly_brief_acct" ON "public"."weekly_brief" USING "btree" ("account", "week_start");



CREATE INDEX "ix_cambios_sistema_cuando" ON "public"."cambios_de_sistema" USING "btree" ("cuando" DESC);



CREATE INDEX "ix_cifras_sin_verificar" ON "public"."cifras_publicadas" USING "btree" ("publicada_el") WHERE ("veredicto" IS NULL);



CREATE INDEX "ix_corridas_verdad" ON "public"."corridas_verdad" USING "btree" ("relacion_id", "corrida_el" DESC);



CREATE INDEX "ix_intentos_clave" ON "public"."intentos" USING "btree" ("clave", "ruta", "cuando" DESC);



CREATE INDEX "ix_notas_agentes_pendientes" ON "public"."notas_para_agentes" USING "btree" ("account", "para") WHERE ("atendida_el" IS NULL);



CREATE UNIQUE INDEX "uq_adgroup_daily" ON "public"."adgroup_daily" USING "btree" ("account", "date", "campaign", "ad_group");



CREATE UNIQUE INDEX "uq_budget_daily" ON "public"."budget_daily" USING "btree" ("account", "date", "campaign");



CREATE UNIQUE INDEX "uq_campaign_daily" ON "public"."campaign_daily" USING "btree" ("account", "date", "campaign");



CREATE UNIQUE INDEX "uq_change_events" ON "public"."change_events" USING "btree" ("account", "change_datetime", "resource_name", "changed_field");



COMMENT ON INDEX "public"."uq_change_events" IS 'Clave natural para el upsert de change_events. Existe para que el script semanal pueda usar on_conflict + Prefer: resolution=merge-duplicates en vez de borrar por cuenta. NUNCA volver al DELETE por account: la tabla es un registro de eventos, no una foto. Tickets 32 y 42, 8 sep 2026.';



CREATE UNIQUE INDEX "uq_cierres_sin_atrib" ON "public"."cierres_sin_atribucion" USING "btree" ("client", "external_id");



CREATE UNIQUE INDEX "uq_config_snapshot" ON "public"."config_snapshot" USING "btree" ("account", "snapshot_date", "entity_type", "entity_name");



CREATE UNIQUE INDEX "uq_conversion_actions_daily" ON "public"."conversion_actions_daily" USING "btree" ("account", "date", "campaign", "ad_group", "conversion_action", "category");



CREATE UNIQUE INDEX "uq_google_live_events_evento" ON "public"."google_live_events" USING "btree" ("account", "event_type", COALESCE("entity_name", ''::"text"), COALESCE("user_email", ''::"text"), "event_date") WHERE ("event_type" = ANY (ARRAY['USER_CHANGE'::"text", 'AUTO_CHANGE'::"text"]));



CREATE UNIQUE INDEX "uq_keywords_daily" ON "public"."keywords_daily" USING "btree" ("account", "date", "campaign", "ad_group", "keyword", "match_type");



COMMENT ON INDEX "public"."uq_keywords_daily" IS 'Clave natural de keywords_daily. NO agregar keyword_status ni serving_status: son atributos mutables y Google devuelve los dias historicos con el estado actual, asi que al cambiar el estado el upsert inserta en vez de actualizar y el gasto se duplica. Ticket 29, 8 sep 2026.';



CREATE UNIQUE INDEX "uq_reconc_pendiente" ON "public"."reconciliaciones" USING "btree" ("objeto", "accion") WHERE ("aplicada" = false);



CREATE UNIQUE INDEX "uq_search_terms_daily" ON "public"."search_terms_daily" USING "btree" ("account", "date", "campaign", "ad_group", "search_term", "match_type", "triggered_keyword");



CREATE UNIQUE INDEX "uq_true_roas_dedupe" ON "public"."true_roas_events" USING "btree" ("client", "gclid", "external_id");



CREATE UNIQUE INDEX "uq_webhook_events_ext" ON "public"."webhook_events" USING "btree" ("source", "external_id") WHERE ("external_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "tg_accion_encolar_valida" BEFORE INSERT ON "public"."acciones_aprobadas" FOR EACH ROW EXECUTE FUNCTION "public"."accion_encolar_valida"();



CREATE OR REPLACE TRIGGER "tr_pending_mutations_realtime" AFTER INSERT OR UPDATE ON "public"."pending_mutations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_pending_mutations_realtime"();



CREATE OR REPLACE TRIGGER "tr_true_roas_realtime" AFTER INSERT ON "public"."true_roas_events" FOR EACH ROW EXECUTE FUNCTION "public"."handle_true_roas_realtime"();



CREATE OR REPLACE TRIGGER "trg_ejecutabilidad_real" BEFORE INSERT OR UPDATE ON "public"."accionables_espejo" FOR EACH ROW EXECUTE FUNCTION "public"."marcar_ejecutabilidad_real"();



CREATE OR REPLACE TRIGGER "trg_exigir_control_al_cerrar" BEFORE UPDATE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."exigir_control_al_cerrar"();



CREATE OR REPLACE TRIGGER "trg_validar_tipo_de_accion" BEFORE INSERT OR UPDATE OF "tipo" ON "public"."acciones_aprobadas" FOR EACH ROW EXECUTE FUNCTION "public"."validar_tipo_de_accion"();



ALTER TABLE ONLY "public"."controles_de_ticket"
    ADD CONSTRAINT "controles_de_ticket_relacion_id_fkey" FOREIGN KEY ("relacion_id") REFERENCES "public"."relaciones_verdad"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."controles_de_ticket"
    ADD CONSTRAINT "controles_de_ticket_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."corridas_verdad"
    ADD CONSTRAINT "corridas_verdad_relacion_id_fkey" FOREIGN KEY ("relacion_id") REFERENCES "public"."relaciones_verdad"("id");



ALTER TABLE ONLY "public"."patrones_drift"
    ADD CONSTRAINT "patrones_drift_metrica_fkey" FOREIGN KEY ("metrica") REFERENCES "public"."metricas"("nombre");



ALTER TABLE ONLY "public"."pulso_diario"
    ADD CONSTRAINT "pulso_diario_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plan_semanal"("id");



ALTER TABLE ONLY "public"."reportes_cliente"
    ADD CONSTRAINT "reportes_cliente_account_fkey" FOREIGN KEY ("account") REFERENCES "public"."cuentas"("account");



ALTER TABLE ONLY "public"."reportes_versiones"
    ADD CONSTRAINT "reportes_versiones_reporte_id_fkey" FOREIGN KEY ("reporte_id") REFERENCES "public"."reportes_cliente"("id") ON DELETE CASCADE;



ALTER TABLE "public"."accionable_comentarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."accionable_relaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."accionable_versiones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."accionables_ejecutados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."accionables_espejo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."acciones_aprobadas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."account_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."account_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."adgroup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."adgroup_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_max_estado" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ajustes_sistema" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alertas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."annotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audiences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auditoria_objetos_ultima" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."backups_memoria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bid_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budget" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budget_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cambios_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cambios_de_sistema" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_dim" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_fechas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_mapa" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidatos_a_retiro" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."capacidades_ejecucion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."change_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cierres_sin_atribucion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."config_snapshot" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conocimiento_externo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversion_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversion_actions_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cuarentena" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cuentas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."device" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_maestro_consolidado" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_maestro_humano" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entity_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escritores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."filtro_umbrales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."funnel_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."funnel_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."geo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_live_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."grupos_reporte" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hour_day" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."intentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."keywords" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."keywords_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."landing_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."latidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lecciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legacy_actionables_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."limites_plataforma" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memoria" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memoria_revisada" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."negatives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notas_de_objetos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notas_para_agentes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notion_espejo_cuentas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."novedades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."objetivos_conversion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_mutations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_semanal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planes_tecnicos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."politicas_auto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."predicciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."propuestas_estrategicas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pulso_diario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reconciliaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reflexiones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reportes_cliente" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reportes_versiones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rsa_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."run_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."run_quality" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_terms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_terms_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sesiones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."simulations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."terminos_protegidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."true_roas_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."umbrales_de_scripts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."umbrales_esperados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_brief" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."accion_encolar_valida"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."accion_encolar_valida"() TO "service_role";



GRANT ALL ON FUNCTION "public"."accionable_existente"("p_account" "text", "p_entidad" "text", "p_causa" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accionable_existente"("p_account" "text", "p_entidad" "text", "p_causa" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."accionables_vigentes"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accionables_vigentes"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."actor_desde_prefijo"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."actor_desde_prefijo"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."actualizar_eventos_escalera"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_eventos_escalera"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."actualizar_win_rates"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."actualizar_win_rates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."alerta_registrar"("p_account" "text", "p_nivel" "text", "p_tipo" "text", "p_titulo" "text", "p_detalle" "text", "p_accion" "text", "p_origen" "text", "p_entidad" "text", "p_fecha_dato" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."alerta_registrar"("p_account" "text", "p_nivel" "text", "p_tipo" "text", "p_titulo" "text", "p_detalle" "text", "p_accion" "text", "p_origen" "text", "p_entidad" "text", "p_fecha_dato" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."alertas_ejecucion_perdida"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."alertas_ejecucion_perdida"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."alertas_fechas_campana"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."alertas_fechas_campana"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."alertas_integridad"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."alertas_integridad"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."alertas_umbrales_diarios"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."alertas_umbrales_diarios"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atender_nota"("p_id" bigint, "p_por" "text", "p_respuesta" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auditar_integridad"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auditar_integridad"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."auditar_objetos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auditar_objetos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."campaign_dim_refrescar"("p_account" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."campaign_dim_refrescar"("p_account" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."campaign_fechas_sincronizar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."campaign_fechas_sincronizar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."completitud_de_cuenta"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."completitud_de_cuenta"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."correr_relaciones"("p_cuenta" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."correr_relaciones"("p_cuenta" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."corrida_redundante"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."corrida_redundante"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."declarar_umbral"("p_account" "text", "p_script" "text", "p_umbral" "text", "p_valor" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."dejar_nota_para_agente"("p_contenido" "text", "p_account" "text", "p_para" "text", "p_tipo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."detectar_cambios_config"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."detectar_cambios_config"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."detectar_cambios_no_informados"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."detectar_cambios_no_informados"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."detectar_conflictos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."detectar_conflictos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."diccionario_datos"() TO "anon";
GRANT ALL ON FUNCTION "public"."diccionario_datos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."diccionario_datos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."disparar_pulso_respaldo"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."disparar_pulso_respaldo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."doc_cronologia"("p_account" "text", "p_dias" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."doc_cronologia"("p_account" "text", "p_dias" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."doc_estado_conversiones"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."doc_estado_conversiones"("p_account" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."doc_maestro_editar"("p_account" "text", "p_seccion" "text", "p_contenido" "text", "p_editado_por" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."doc_maestro_editar"("p_account" "text", "p_seccion" "text", "p_contenido" "text", "p_editado_por" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."doc_serie_cpa"("p_account" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."doc_serie_cpa"("p_account" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."doc_umbrales"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."doc_umbrales"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."en_cuarentena"("p_tabla" "text", "p_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."en_cuarentena"("p_tabla" "text", "p_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."entidad_especifica"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."entidad_especifica"("t" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."entidad_existe"("p_account" "text", "p_accion" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."entidad_existe"("p_account" "text", "p_accion" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."estado_de_los_flujos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."estado_de_los_flujos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."evaluar_predicciones"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."evaluar_predicciones"() TO "service_role";



GRANT ALL ON FUNCTION "public"."exigir_control_al_cerrar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."exigir_control_al_cerrar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."explicar_accionable"("p_notion_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."explicar_accionable"("p_notion_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."filtrar_hallazgos_a_accionables"("p_account" "text", "p_fecha" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."filtrar_hallazgos_a_accionables"("p_account" "text", "p_fecha" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_briefing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_briefing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_contexto_sistema"("p_cuenta" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_contexto_sistema"("p_cuenta" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cuenta"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cuenta"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_doc_maestro"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_doc_maestro"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_entidades"("p_entidad" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_entidades"("p_entidad" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_entidades"("p_entidad" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_estado_cuenta"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_estado_cuenta"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_estado_cuenta_base"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_estado_cuenta_base"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pulso_input"("p_account" "text", "p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pulso_input"("p_account" "text", "p_fecha" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_reporte_datos"("p_account" "text", "p_desde" "date", "p_hasta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_salud_sistema"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_salud_sistema"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_view_data"("p_view" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_search_col" "text", "p_filters" "jsonb", "p_group_by" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_view_data"("p_view" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_search_col" "text", "p_filters" "jsonb", "p_group_by" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_view_data"("p_view" "text", "p_account" "text", "p_from" "date", "p_to" "date", "p_search" "text", "p_search_col" "text", "p_filters" "jsonb", "p_group_by" "text", "p_order_by" "text", "p_order_dir" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_view_totals"("p_view" "text", "p_account" "text", "p_week" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_view_totals"("p_view" "text", "p_account" "text", "p_week" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_view_totals"("p_view" "text", "p_account" "text", "p_week" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_weekly_package"("p_account" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_weekly_package"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_weekly_package"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_weekly_package_cadena"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_weekly_package_cadena"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_weekly_package_cadena_base"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_weekly_package_cadena_base"("p_account" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_pending_mutations_realtime"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_pending_mutations_realtime"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_true_roas_realtime"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_true_roas_realtime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."latir"("p_tarea" "text", "p_ok" boolean, "p_error" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."limite_de_tasa"("p_clave" "text", "p_ruta" "text", "p_max" integer, "p_ventana" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."limpiar_intentos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."limpiar_pulso_intradia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."limpiar_pulso_intradia"() TO "service_role";



GRANT ALL ON FUNCTION "public"."madurez_dato"("p_fecha" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."madurez_dato"("p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."madurez_dato"("p_fecha" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mantenimiento_semanal"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mantenimiento_semanal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."marcar_ejecutabilidad_real"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."marcar_ejecutabilidad_real"() TO "service_role";



GRANT ALL ON FUNCTION "public"."marcar_grupo_leido"("p_cuenta" "text", "p_tipo" "text", "p_actor" "text", "p_dia" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."marcar_para_retiro"("p_objeto" "text", "p_tipo" "text", "p_por_que" "text", "p_que_se_pierde" "text", "p_como_volver" "text", "p_semanas_de_observacion" integer) TO "service_role";






REVOKE ALL ON FUNCTION "public"."memoria_ingestar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."memoria_ingestar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mensual_puede_correr"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mensual_puede_correr"() TO "service_role";



GRANT ALL ON FUNCTION "public"."metrica_conversiones"("p_account" "text", "p_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."metrica_conversiones"("p_account" "text", "p_tipo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."metrica_cpa"("p_account" "text", "p_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."metrica_cpa"("p_account" "text", "p_tipo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."metrica_gasto"("p_account" "text", "p_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."metrica_gasto"("p_account" "text", "p_tipo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."nav_campanas"("p_account" "text", "p_location" "text", "p_objetivo" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nav_campanas"("p_account" "text", "p_location" "text", "p_objetivo" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nav_contadores"("p_account" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nav_contadores"("p_account" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nav_grupos"("p_account" "text", "p_location" "text", "p_campana" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nav_grupos"("p_account" "text", "p_location" "text", "p_campana" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nav_keywords"("p_account" "text", "p_location" "text", "p_campana" "text", "p_grupo" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nav_keywords"("p_account" "text", "p_location" "text", "p_campana" "text", "p_grupo" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nav_objetivos"("p_account" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nav_objetivos"("p_account" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."nav_terminos"("p_account" "text", "p_location" "text", "p_campana" "text", "p_grupo" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nav_terminos"("p_account" "text", "p_location" "text", "p_campana" "text", "p_grupo" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."negativa_bloquea"("p_negativa" "text", "p_match" "text", "p_keyword" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."negativa_bloquea"("p_negativa" "text", "p_match" "text", "p_keyword" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."nivel_de_vistas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."nivel_de_vistas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalizar_entidad"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalizar_entidad"("t" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."novedades_generar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."novedades_generar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."orden_del_dia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."orden_del_dia"() TO "service_role";






GRANT ALL ON FUNCTION "public"."plan_valido"("p_ind" "jsonb", "p_hip" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_valido"("p_ind" "jsonb", "p_hip" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."politica_aplica"("p_account" "text", "p_tipo" "text", "p_origen" "text", "p_confianza" numeric, "p_entidad" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."politica_aplica"("p_account" "text", "p_tipo" "text", "p_origen" "text", "p_confianza" numeric, "p_entidad" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."poner_en_cuarentena"("p_tabla" "text", "p_id" "text", "p_por_que" "text", "p_cuenta" "text", "p_reemplazado_por" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."por_que_esta_vacio"("p_account" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."por_que_esta_vacio"("p_account" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevuelo"("p_notion_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevuelo"("p_notion_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."probar_funciones_de_cuenta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."probar_funciones_de_cuenta"() TO "service_role";



GRANT ALL ON FUNCTION "public"."probar_mutantes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."probar_mutantes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."probar_todas_las_vistas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."probar_todas_las_vistas"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."propuesta_cambiar_estado"("p_id" bigint, "p_estado" "text", "p_nota" "text", "p_ejecucion_real" "text", "p_por" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."propuesta_cambiar_estado"("p_id" bigint, "p_estado" "text", "p_nota" "text", "p_ejecucion_real" "text", "p_por" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."puede_escribir_en"("p_account" "text", "p_plataforma" "public"."plataforma_pub") TO "authenticated";
GRANT ALL ON FUNCTION "public"."puede_escribir_en"("p_account" "text", "p_plataforma" "public"."plataforma_pub") TO "service_role";



GRANT ALL ON FUNCTION "public"."que_publique_con"("p_objeto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."que_publique_con"("p_objeto" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."raices"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."raices"("t" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reconciliar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reconciliar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_cambio"("p_que" "text", "p_por_que" "text", "p_objetos" "text"[], "p_version" "text", "p_revierte_como" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_intento"("p_clave" "text", "p_ruta" "text", "p_exito" boolean, "p_detalle" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reporte_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reporte_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reporte_token_url"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reporte_token_url"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolver_campana"("p_account" "text", "p_campaign" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolver_campana"("p_account" "text", "p_campaign" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolver_grupo_alertas"("p_account" "text", "p_tipo" "text", "p_dia" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolver_keyword"("p_account" "text", "p_keyword" "text", "p_pista" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolver_keyword"("p_account" "text", "p_keyword" "text", "p_pista" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."respaldar_memoria"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."respaldar_memoria"() TO "service_role";



GRANT ALL ON FUNCTION "public"."simular_negativa"("p_account" "text", "p_negativa" "text", "p_match" "text", "p_nivel" "text", "p_grupo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."simular_negativa"("p_account" "text", "p_negativa" "text", "p_match" "text", "p_nivel" "text", "p_grupo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."terminos_protegidos_actualizar"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."terminos_protegidos_actualizar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."testeabilidad"("p_conv_por_semana" numeric, "p_semanas" integer, "p_split" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."testeabilidad"("p_conv_por_semana" numeric, "p_semanas" integer, "p_split" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."toca_nucleo"("p_account" "text", "p_texto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toca_nucleo"("p_account" "text", "p_texto" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."v_capacidades_coherentes_chk"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_capacidades_coherentes_chk"() TO "service_role";



GRANT ALL ON FUNCTION "public"."v_carteras_puja"("p_account" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_carteras_puja"("p_account" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."v_corporativas"("p_account" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_corporativas"("p_account" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."v_geolift_pares"("p_account" "text", "p_min_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_geolift_pares"("p_account" "text", "p_min_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."v_keywords_entre_locales"("p_account" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_keywords_entre_locales"("p_account" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."v_location_ranking_bayes"("p_account" "text", "p_semanas" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_location_ranking_bayes"("p_account" "text", "p_semanas" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."v_umbrales_alcanzables"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."v_umbrales_alcanzables"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_tipo_de_accion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_tipo_de_accion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ventana_metrica"("p_account" "text", "p_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ventana_metrica"("p_account" "text", "p_tipo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verbo_probable"("p_titulo" "text", "p_por_que" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verbo_probable"("p_titulo" "text", "p_por_que" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_cifras"("p_brief" "text", "p_limite" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_cifras"("p_brief" "text", "p_limite" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."verificar_invariantes"("p_account" "text", "p_accion" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verificar_invariantes"("p_account" "text", "p_accion" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_pulso_del_dia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_pulso_del_dia"() TO "service_role";



GRANT ALL ON FUNCTION "public"."volcar_crons"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."volcar_crons"() TO "service_role";



GRANT ALL ON FUNCTION "public"."volcar_esquema"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."volcar_esquema"() TO "service_role";



GRANT ALL ON FUNCTION "public"."volcar_semillas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."volcar_semillas"() TO "service_role";




































GRANT ALL ON TABLE "public"."accionable_comentarios" TO "service_role";



GRANT ALL ON TABLE "public"."accionable_relaciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."accionable_relaciones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."accionable_relaciones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."accionable_relaciones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."accionable_versiones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."accionable_versiones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."accionable_versiones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."accionable_versiones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."accionables_ejecutados" TO "anon";
GRANT ALL ON TABLE "public"."accionables_ejecutados" TO "authenticated";
GRANT ALL ON TABLE "public"."accionables_ejecutados" TO "service_role";



GRANT ALL ON TABLE "public"."accionables_espejo" TO "service_role";



GRANT ALL ON TABLE "public"."acciones_aprobadas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."acciones_aprobadas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."acciones_aprobadas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."acciones_aprobadas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."account_state" TO "anon";
GRANT ALL ON TABLE "public"."account_state" TO "authenticated";
GRANT ALL ON TABLE "public"."account_state" TO "service_role";



GRANT ALL ON SEQUENCE "public"."account_state_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."account_state_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."account_state_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."account_targets" TO "anon";
GRANT ALL ON TABLE "public"."account_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."account_targets" TO "service_role";



GRANT ALL ON TABLE "public"."adgroup" TO "anon";
GRANT ALL ON TABLE "public"."adgroup" TO "authenticated";
GRANT ALL ON TABLE "public"."adgroup" TO "service_role";



GRANT ALL ON TABLE "public"."adgroup_daily" TO "anon";
GRANT ALL ON TABLE "public"."adgroup_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."adgroup_daily" TO "service_role";



GRANT ALL ON SEQUENCE "public"."adgroup_daily_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."adgroup_daily_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."adgroup_daily_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."adgroup_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."adgroup_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."adgroup_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ads" TO "anon";
GRANT ALL ON TABLE "public"."ads" TO "authenticated";
GRANT ALL ON TABLE "public"."ads" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ads_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ads_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ads_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ai_max_estado" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_max_estado" TO "service_role";



GRANT ALL ON TABLE "public"."ajustes_sistema" TO "service_role";



GRANT ALL ON TABLE "public"."alertas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."alertas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."alertas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."alertas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."alerts" TO "anon";
GRANT ALL ON TABLE "public"."alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."alerts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."alerts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."alerts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."alerts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."annotations" TO "anon";
GRANT ALL ON TABLE "public"."annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."annotations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."annotations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."annotations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."annotations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."audiences" TO "anon";
GRANT ALL ON TABLE "public"."audiences" TO "authenticated";
GRANT ALL ON TABLE "public"."audiences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audiences_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audiences_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audiences_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."auditoria_objetos_ultima" TO "service_role";



GRANT ALL ON TABLE "public"."backups_memoria" TO "service_role";



GRANT ALL ON SEQUENCE "public"."backups_memoria_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."backups_memoria_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."backups_memoria_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bid_targets" TO "anon";
GRANT ALL ON TABLE "public"."bid_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."bid_targets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bid_targets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bid_targets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bid_targets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."budget" TO "anon";
GRANT ALL ON TABLE "public"."budget" TO "authenticated";
GRANT ALL ON TABLE "public"."budget" TO "service_role";



GRANT ALL ON TABLE "public"."budget_daily" TO "anon";
GRANT ALL ON TABLE "public"."budget_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_daily" TO "service_role";



GRANT ALL ON SEQUENCE "public"."budget_daily_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."budget_daily_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."budget_daily_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."budget_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."budget_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."budget_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cambios_config" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cambios_config_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cambios_config_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cambios_config_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cambios_de_sistema" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cambios_de_sistema_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cambios_de_sistema_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cambios_de_sistema_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."campaign" TO "anon";
GRANT ALL ON TABLE "public"."campaign" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_daily" TO "anon";
GRANT ALL ON TABLE "public"."campaign_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_daily" TO "service_role";



GRANT ALL ON SEQUENCE "public"."campaign_daily_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."campaign_daily_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."campaign_daily_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_dim" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_fechas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."campaign_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."campaign_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."campaign_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_mapa" TO "service_role";



GRANT ALL ON SEQUENCE "public"."campaign_mapa_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."campaign_mapa_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."campaign_mapa_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."candidatos_a_retiro" TO "service_role";



GRANT ALL ON SEQUENCE "public"."candidatos_a_retiro_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."candidatos_a_retiro_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."candidatos_a_retiro_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."capacidades_ejecucion" TO "service_role";



GRANT ALL ON TABLE "public"."change_events" TO "anon";
GRANT ALL ON TABLE "public"."change_events" TO "authenticated";
GRANT ALL ON TABLE "public"."change_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."change_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."change_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."change_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cierres_sin_atribucion" TO "anon";
GRANT ALL ON TABLE "public"."cierres_sin_atribucion" TO "authenticated";
GRANT ALL ON TABLE "public"."cierres_sin_atribucion" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cierres_sin_atribucion_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cierres_sin_atribucion_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cierres_sin_atribucion_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cifras_publicadas" TO "authenticated";
GRANT ALL ON TABLE "public"."cifras_publicadas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cifras_publicadas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cifras_publicadas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cifras_publicadas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."config_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."config_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."config_snapshot" TO "service_role";



GRANT ALL ON SEQUENCE "public"."config_snapshot_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."config_snapshot_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."config_snapshot_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."conocimiento_externo" TO "service_role";



GRANT ALL ON SEQUENCE "public"."conocimiento_externo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."conocimiento_externo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."conocimiento_externo_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."contratos_columna" TO "authenticated";
GRANT ALL ON TABLE "public"."contratos_columna" TO "service_role";



GRANT ALL ON TABLE "public"."controles_de_ticket" TO "authenticated";
GRANT ALL ON TABLE "public"."controles_de_ticket" TO "service_role";



GRANT ALL ON TABLE "public"."conversion_actions" TO "anon";
GRANT ALL ON TABLE "public"."conversion_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."conversion_actions" TO "service_role";



GRANT ALL ON TABLE "public"."conversion_actions_daily" TO "anon";
GRANT ALL ON TABLE "public"."conversion_actions_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."conversion_actions_daily" TO "service_role";



GRANT ALL ON SEQUENCE "public"."conversion_actions_daily_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."conversion_actions_daily_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."conversion_actions_daily_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."conversion_actions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."conversion_actions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."conversion_actions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."corridas_verdad" TO "authenticated";
GRANT ALL ON TABLE "public"."corridas_verdad" TO "service_role";



GRANT ALL ON SEQUENCE "public"."corridas_verdad_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."corridas_verdad_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."corridas_verdad_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cuarentena" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cuarentena_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cuarentena_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cuarentena_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas" TO "service_role";



GRANT ALL ON TABLE "public"."device" TO "anon";
GRANT ALL ON TABLE "public"."device" TO "authenticated";
GRANT ALL ON TABLE "public"."device" TO "service_role";



GRANT ALL ON SEQUENCE "public"."device_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."device_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."device_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."doc_maestro_consolidado" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_maestro_consolidado" TO "service_role";



GRANT ALL ON TABLE "public"."doc_maestro_humano" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_maestro_humano" TO "service_role";



GRANT ALL ON SEQUENCE "public"."doc_maestro_humano_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."doc_maestro_humano_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."doc_maestro_humano_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."drift_exento" TO "authenticated";
GRANT ALL ON TABLE "public"."drift_exento" TO "service_role";



GRANT ALL ON TABLE "public"."entity_states" TO "anon";
GRANT ALL ON TABLE "public"."entity_states" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_states" TO "service_role";



GRANT ALL ON SEQUENCE "public"."entity_states_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."entity_states_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."entity_states_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."escritores" TO "service_role";



GRANT ALL ON TABLE "public"."filtro_umbrales" TO "service_role";



GRANT ALL ON TABLE "public"."funnel_events" TO "anon";
GRANT ALL ON TABLE "public"."funnel_events" TO "authenticated";
GRANT ALL ON TABLE "public"."funnel_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."funnel_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."funnel_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."funnel_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."funnel_stages" TO "anon";
GRANT ALL ON TABLE "public"."funnel_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."funnel_stages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."funnel_stages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."funnel_stages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."funnel_stages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."geo" TO "anon";
GRANT ALL ON TABLE "public"."geo" TO "authenticated";
GRANT ALL ON TABLE "public"."geo" TO "service_role";



GRANT ALL ON SEQUENCE "public"."geo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."geo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."geo_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."google_live_events" TO "anon";
GRANT ALL ON TABLE "public"."google_live_events" TO "authenticated";
GRANT ALL ON TABLE "public"."google_live_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."google_live_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."google_live_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."google_live_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."grupos_reporte" TO "service_role";



GRANT ALL ON SEQUENCE "public"."grupos_reporte_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."grupos_reporte_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."grupos_reporte_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."hour_day" TO "anon";
GRANT ALL ON TABLE "public"."hour_day" TO "authenticated";
GRANT ALL ON TABLE "public"."hour_day" TO "service_role";



GRANT ALL ON SEQUENCE "public"."hour_day_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."hour_day_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."hour_day_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."incidentes_atendidos" TO "authenticated";
GRANT ALL ON TABLE "public"."incidentes_atendidos" TO "service_role";



GRANT ALL ON TABLE "public"."intentos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."intentos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."intentos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."intentos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."keywords" TO "anon";
GRANT ALL ON TABLE "public"."keywords" TO "authenticated";
GRANT ALL ON TABLE "public"."keywords" TO "service_role";



GRANT ALL ON TABLE "public"."keywords_daily" TO "anon";
GRANT ALL ON TABLE "public"."keywords_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."keywords_daily" TO "service_role";



GRANT ALL ON SEQUENCE "public"."keywords_daily_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."keywords_daily_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."keywords_daily_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."keywords_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."keywords_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."keywords_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."landing_pages" TO "anon";
GRANT ALL ON TABLE "public"."landing_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_pages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."landing_pages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."landing_pages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."landing_pages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."latidos" TO "service_role";



GRANT ALL ON TABLE "public"."lecciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lecciones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lecciones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lecciones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."legacy_actionables_memory" TO "anon";
GRANT ALL ON TABLE "public"."legacy_actionables_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."legacy_actionables_memory" TO "service_role";



GRANT ALL ON TABLE "public"."limites_plataforma" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."locations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."locations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."locations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."memoria" TO "service_role";



GRANT ALL ON SEQUENCE "public"."memoria_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."memoria_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."memoria_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."memoria_revisada" TO "service_role";



GRANT ALL ON TABLE "public"."metricas" TO "authenticated";
GRANT ALL ON TABLE "public"."metricas" TO "service_role";



GRANT ALL ON TABLE "public"."negatives" TO "anon";
GRANT ALL ON TABLE "public"."negatives" TO "authenticated";
GRANT ALL ON TABLE "public"."negatives" TO "service_role";



GRANT ALL ON SEQUENCE "public"."negatives_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."negatives_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."negatives_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notas_de_objetos" TO "service_role";



GRANT ALL ON TABLE "public"."notas_para_agentes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notas_para_agentes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notas_para_agentes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notas_para_agentes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notion_espejo_cuentas" TO "service_role";



GRANT ALL ON TABLE "public"."novedades" TO "service_role";



GRANT ALL ON SEQUENCE "public"."novedades_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."novedades_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."novedades_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."objetivos_conversion" TO "service_role";



GRANT ALL ON SEQUENCE "public"."objetivos_conversion_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."objetivos_conversion_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."objetivos_conversion_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."operator_log" TO "anon";
GRANT ALL ON TABLE "public"."operator_log" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."operator_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."operator_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."operator_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."patrones_drift" TO "authenticated";
GRANT ALL ON TABLE "public"."patrones_drift" TO "service_role";



GRANT ALL ON TABLE "public"."pending_mutations" TO "anon";
GRANT ALL ON TABLE "public"."pending_mutations" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_mutations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pending_mutations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pending_mutations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pending_mutations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."plan_semanal" TO "service_role";



GRANT ALL ON SEQUENCE "public"."plan_semanal_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."plan_semanal_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."plan_semanal_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."planes_tecnicos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."planes_tecnicos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."planes_tecnicos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."planes_tecnicos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."politicas_auto" TO "service_role";



GRANT ALL ON TABLE "public"."predicciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."predicciones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."predicciones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."predicciones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."propuestas_estrategicas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."propuestas_estrategicas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."propuestas_estrategicas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."propuestas_estrategicas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pulso_diario" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pulso_diario_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pulso_diario_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pulso_diario_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reconciliaciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reconciliaciones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reconciliaciones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reconciliaciones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reflexiones" TO "anon";
GRANT ALL ON TABLE "public"."reflexiones" TO "authenticated";
GRANT ALL ON TABLE "public"."reflexiones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reflexiones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reflexiones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reflexiones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."relaciones_verdad" TO "authenticated";
GRANT ALL ON TABLE "public"."relaciones_verdad" TO "service_role";



GRANT ALL ON SEQUENCE "public"."relaciones_verdad_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."relaciones_verdad_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."relaciones_verdad_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reportes_cliente" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reportes_cliente_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reportes_cliente_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reportes_cliente_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reportes_versiones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reportes_versiones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reportes_versiones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reportes_versiones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."rsa_assets" TO "anon";
GRANT ALL ON TABLE "public"."rsa_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."rsa_assets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rsa_assets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rsa_assets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rsa_assets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."run_log" TO "anon";
GRANT ALL ON TABLE "public"."run_log" TO "authenticated";
GRANT ALL ON TABLE "public"."run_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."run_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."run_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."run_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."run_quality" TO "anon";
GRANT ALL ON TABLE "public"."run_quality" TO "authenticated";
GRANT ALL ON TABLE "public"."run_quality" TO "service_role";



GRANT ALL ON SEQUENCE "public"."run_quality_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."run_quality_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."run_quality_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."search_terms" TO "anon";
GRANT ALL ON TABLE "public"."search_terms" TO "authenticated";
GRANT ALL ON TABLE "public"."search_terms" TO "service_role";



GRANT ALL ON TABLE "public"."search_terms_daily" TO "anon";
GRANT ALL ON TABLE "public"."search_terms_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."search_terms_daily" TO "service_role";



GRANT ALL ON SEQUENCE "public"."search_terms_daily_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."search_terms_daily_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."search_terms_daily_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."search_terms_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."search_terms_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."search_terms_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sesiones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sesiones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sesiones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sesiones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."simulations" TO "anon";
GRANT ALL ON TABLE "public"."simulations" TO "authenticated";
GRANT ALL ON TABLE "public"."simulations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."simulations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."simulations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."simulations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."terminos_protegidos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."terminos_protegidos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."terminos_protegidos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."terminos_protegidos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tickets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."true_roas_events" TO "anon";
GRANT ALL ON TABLE "public"."true_roas_events" TO "authenticated";
GRANT ALL ON TABLE "public"."true_roas_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."true_roas_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."true_roas_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."true_roas_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."umbrales_de_scripts" TO "service_role";



GRANT ALL ON TABLE "public"."umbrales_esperados" TO "authenticated";
GRANT ALL ON TABLE "public"."umbrales_esperados" TO "service_role";



GRANT ALL ON TABLE "public"."v_360_campaign" TO "authenticated";
GRANT ALL ON TABLE "public"."v_360_campaign" TO "service_role";



GRANT ALL ON TABLE "public"."v_accionable_relaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."v_accionable_relaciones" TO "service_role";



GRANT ALL ON TABLE "public"."v_accionables_invalidos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_accionables_invalidos" TO "service_role";



GRANT ALL ON TABLE "public"."v_acciones_pendientes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_acciones_pendientes" TO "service_role";



GRANT ALL ON TABLE "public"."v_serie_diaria" TO "authenticated";
GRANT ALL ON TABLE "public"."v_serie_diaria" TO "service_role";



GRANT ALL ON TABLE "public"."v_impacto_accionables" TO "authenticated";
GRANT ALL ON TABLE "public"."v_impacto_accionables" TO "service_role";



GRANT ALL ON TABLE "public"."v_acierto_por_tipo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_acierto_por_tipo" TO "service_role";



GRANT ALL ON TABLE "public"."v_adgroup_analisis" TO "authenticated";
GRANT ALL ON TABLE "public"."v_adgroup_analisis" TO "service_role";



GRANT ALL ON TABLE "public"."v_adgroup_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."v_adgroup_daily" TO "service_role";



GRANT ALL ON TABLE "public"."v_alertas_abiertas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_alertas_abiertas" TO "service_role";



GRANT ALL ON TABLE "public"."v_alertas_agrupadas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_alertas_agrupadas" TO "service_role";



GRANT ALL ON TABLE "public"."v_anomalias_diarias" TO "authenticated";
GRANT ALL ON TABLE "public"."v_anomalias_diarias" TO "service_role";



GRANT ALL ON TABLE "public"."v_anomalia_explicada" TO "authenticated";
GRANT ALL ON TABLE "public"."v_anomalia_explicada" TO "service_role";



GRANT ALL ON TABLE "public"."v_bhi_campaign" TO "authenticated";
GRANT ALL ON TABLE "public"."v_bhi_campaign" TO "service_role";



GRANT ALL ON TABLE "public"."v_brecha_objetivo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_brecha_objetivo" TO "service_role";



GRANT ALL ON TABLE "public"."v_calibracion" TO "authenticated";
GRANT ALL ON TABLE "public"."v_calibracion" TO "service_role";



GRANT ALL ON TABLE "public"."v_calibracion_global" TO "authenticated";
GRANT ALL ON TABLE "public"."v_calibracion_global" TO "service_role";



GRANT ALL ON TABLE "public"."v_cambios_detectados" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cambios_detectados" TO "service_role";



GRANT ALL ON TABLE "public"."v_cambios_fuera_del_log" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cambios_fuera_del_log" TO "service_role";



GRANT ALL ON TABLE "public"."v_cambios_invisibles_para_google" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cambios_invisibles_para_google" TO "service_role";



GRANT ALL ON TABLE "public"."v_cambios_para_cruce" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cambios_para_cruce" TO "service_role";



GRANT ALL ON TABLE "public"."v_cambios_recientes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cambios_recientes" TO "service_role";



GRANT ALL ON TABLE "public"."v_campaign_analisis" TO "authenticated";
GRANT ALL ON TABLE "public"."v_campaign_analisis" TO "service_role";



GRANT ALL ON TABLE "public"."v_campaign_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."v_campaign_daily" TO "service_role";



GRANT ALL ON TABLE "public"."v_campana_resuelta" TO "authenticated";
GRANT ALL ON TABLE "public"."v_campana_resuelta" TO "service_role";



GRANT ALL ON TABLE "public"."v_campanas_sin_dim" TO "authenticated";
GRANT ALL ON TABLE "public"."v_campanas_sin_dim" TO "service_role";



GRANT ALL ON TABLE "public"."v_candidatos_con_evidencia" TO "authenticated";
GRANT ALL ON TABLE "public"."v_candidatos_con_evidencia" TO "service_role";



GRANT ALL ON TABLE "public"."v_carteras_puja" TO "authenticated";
GRANT ALL ON TABLE "public"."v_carteras_puja" TO "service_role";



GRANT ALL ON TABLE "public"."v_change_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."v_change_annotations" TO "service_role";



GRANT ALL ON TABLE "public"."v_cierres_totales" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cierres_totales" TO "service_role";



GRANT ALL ON TABLE "public"."v_cifras_sospechosas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cifras_sospechosas" TO "service_role";



GRANT ALL ON TABLE "public"."v_conversiones_diarias" TO "authenticated";
GRANT ALL ON TABLE "public"."v_conversiones_diarias" TO "service_role";



GRANT ALL ON TABLE "public"."v_conversiones_por_accion" TO "authenticated";
GRANT ALL ON TABLE "public"."v_conversiones_por_accion" TO "service_role";



GRANT ALL ON TABLE "public"."v_conversiones_por_grupo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_conversiones_por_grupo" TO "service_role";



GRANT ALL ON TABLE "public"."v_corporativas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_corporativas" TO "service_role";



GRANT ALL ON TABLE "public"."v_cpa_marginal" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cpa_marginal" TO "service_role";



GRANT ALL ON TABLE "public"."v_leading_indicators_diarios" TO "authenticated";
GRANT ALL ON TABLE "public"."v_leading_indicators_diarios" TO "service_role";



GRANT ALL ON TABLE "public"."v_correlacion_leading_lagging" TO "authenticated";
GRANT ALL ON TABLE "public"."v_correlacion_leading_lagging" TO "service_role";



GRANT ALL ON TABLE "public"."v_cuarentena_resumen" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cuarentena_resumen" TO "service_role";



GRANT ALL ON TABLE "public"."v_cuentas_incompletas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cuentas_incompletas" TO "service_role";



GRANT ALL ON TABLE "public"."v_data_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_data_health" TO "service_role";



GRANT ALL ON TABLE "public"."v_decision_estructural" TO "authenticated";
GRANT ALL ON TABLE "public"."v_decision_estructural" TO "service_role";



GRANT ALL ON TABLE "public"."v_deuda_de_control" TO "authenticated";
GRANT ALL ON TABLE "public"."v_deuda_de_control" TO "service_role";



GRANT ALL ON TABLE "public"."v_dia_con_cambios" TO "authenticated";
GRANT ALL ON TABLE "public"."v_dia_con_cambios" TO "service_role";



GRANT ALL ON TABLE "public"."v_donde_escribir_anuncio" TO "authenticated";
GRANT ALL ON TABLE "public"."v_donde_escribir_anuncio" TO "service_role";



GRANT ALL ON TABLE "public"."v_drift_semantico" TO "authenticated";
GRANT ALL ON TABLE "public"."v_drift_semantico" TO "service_role";



GRANT ALL ON TABLE "public"."v_ejecucion_perdida" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ejecucion_perdida" TO "service_role";



GRANT ALL ON TABLE "public"."v_escalera_valor" TO "authenticated";
GRANT ALL ON TABLE "public"."v_escalera_valor" TO "service_role";



GRANT ALL ON TABLE "public"."v_espejo_huerfano" TO "authenticated";
GRANT ALL ON TABLE "public"."v_espejo_huerfano" TO "service_role";



GRANT ALL ON TABLE "public"."v_espejo_sin_titulo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_espejo_sin_titulo" TO "service_role";



GRANT ALL ON TABLE "public"."v_fuzzy_negatives" TO "authenticated";
GRANT ALL ON TABLE "public"."v_fuzzy_negatives" TO "service_role";



GRANT ALL ON TABLE "public"."v_grupos_resueltos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_grupos_resueltos" TO "service_role";



GRANT ALL ON TABLE "public"."v_headroom" TO "authenticated";
GRANT ALL ON TABLE "public"."v_headroom" TO "service_role";



GRANT ALL ON TABLE "public"."v_hora_dia" TO "authenticated";
GRANT ALL ON TABLE "public"."v_hora_dia" TO "service_role";



GRANT ALL ON TABLE "public"."v_relaciones_violadas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_relaciones_violadas" TO "service_role";



GRANT ALL ON TABLE "public"."v_incidentes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_incidentes" TO "service_role";



GRANT ALL ON TABLE "public"."v_integridad_conversiones" TO "authenticated";
GRANT ALL ON TABLE "public"."v_integridad_conversiones" TO "service_role";



GRANT ALL ON TABLE "public"."v_integridad_datos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_integridad_datos" TO "service_role";



GRANT ALL ON TABLE "public"."v_integridad_mapeo" TO "authenticated";
GRANT ALL ON TABLE "public"."v_integridad_mapeo" TO "service_role";



GRANT ALL ON TABLE "public"."v_intentos_sospechosos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_intentos_sospechosos" TO "service_role";



GRANT ALL ON TABLE "public"."v_karedo_campaign" TO "authenticated";
GRANT ALL ON TABLE "public"."v_karedo_campaign" TO "service_role";



GRANT ALL ON TABLE "public"."v_keyword_tendencia" TO "authenticated";
GRANT ALL ON TABLE "public"."v_keyword_tendencia" TO "service_role";



GRANT ALL ON TABLE "public"."v_keywords_analisis" TO "authenticated";
GRANT ALL ON TABLE "public"."v_keywords_analisis" TO "service_role";



GRANT ALL ON TABLE "public"."v_keywords_atencion" TO "authenticated";
GRANT ALL ON TABLE "public"."v_keywords_atencion" TO "service_role";



GRANT ALL ON TABLE "public"."v_keywords_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."v_keywords_daily" TO "service_role";



GRANT ALL ON TABLE "public"."v_keywords_entre_locales" TO "authenticated";
GRANT ALL ON TABLE "public"."v_keywords_entre_locales" TO "service_role";



GRANT ALL ON TABLE "public"."v_keywords_resueltas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_keywords_resueltas" TO "service_role";



GRANT ALL ON TABLE "public"."v_lecciones_vigentes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lecciones_vigentes" TO "service_role";



GRANT ALL ON TABLE "public"."v_linaje" TO "authenticated";
GRANT ALL ON TABLE "public"."v_linaje" TO "service_role";



GRANT ALL ON TABLE "public"."v_location_ranking_bayes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_location_ranking_bayes" TO "service_role";



GRANT ALL ON TABLE "public"."v_memoria_pendiente" TO "authenticated";
GRANT ALL ON TABLE "public"."v_memoria_pendiente" TO "service_role";



GRANT ALL ON TABLE "public"."v_memoria_sospechosa" TO "authenticated";
GRANT ALL ON TABLE "public"."v_memoria_sospechosa" TO "service_role";



GRANT ALL ON TABLE "public"."v_memoria_vigente" TO "authenticated";
GRANT ALL ON TABLE "public"."v_memoria_vigente" TO "service_role";



GRANT ALL ON TABLE "public"."v_retencion_tablas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_retencion_tablas" TO "service_role";



GRANT ALL ON TABLE "public"."v_metricas_reescritas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_metricas_reescritas" TO "service_role";



GRANT ALL ON TABLE "public"."v_negativas_que_bloquean" TO "authenticated";
GRANT ALL ON TABLE "public"."v_negativas_que_bloquean" TO "service_role";



GRANT ALL ON TABLE "public"."v_ngrams_sin_conversion" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ngrams_sin_conversion" TO "service_role";



GRANT ALL ON TABLE "public"."v_notas_fantasma" TO "authenticated";
GRANT ALL ON TABLE "public"."v_notas_fantasma" TO "service_role";



GRANT ALL ON TABLE "public"."v_notas_pendientes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_notas_pendientes" TO "service_role";



GRANT ALL ON TABLE "public"."v_notion_vs_supabase" TO "authenticated";
GRANT ALL ON TABLE "public"."v_notion_vs_supabase" TO "service_role";



GRANT ALL ON TABLE "public"."v_novedades" TO "authenticated";
GRANT ALL ON TABLE "public"."v_novedades" TO "service_role";



GRANT ALL ON TABLE "public"."v_novedades_7d" TO "authenticated";
GRANT ALL ON TABLE "public"."v_novedades_7d" TO "service_role";



GRANT ALL ON TABLE "public"."v_novedades_agrupadas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_novedades_agrupadas" TO "service_role";



GRANT ALL ON TABLE "public"."v_objetos_sin_documentar" TO "authenticated";
GRANT ALL ON TABLE "public"."v_objetos_sin_documentar" TO "service_role";



GRANT ALL ON TABLE "public"."v_objetos_tocados_dos_veces" TO "authenticated";
GRANT ALL ON TABLE "public"."v_objetos_tocados_dos_veces" TO "service_role";



GRANT ALL ON TABLE "public"."v_para_actuar" TO "authenticated";
GRANT ALL ON TABLE "public"."v_para_actuar" TO "service_role";



GRANT ALL ON TABLE "public"."v_pendientes_subir_google" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pendientes_subir_google" TO "service_role";



GRANT ALL ON TABLE "public"."v_por_location_semanal" TO "authenticated";
GRANT ALL ON TABLE "public"."v_por_location_semanal" TO "service_role";



GRANT ALL ON TABLE "public"."v_por_objetivo_semanal" TO "authenticated";
GRANT ALL ON TABLE "public"."v_por_objetivo_semanal" TO "service_role";



GRANT ALL ON TABLE "public"."v_por_que_limitada" TO "authenticated";
GRANT ALL ON TABLE "public"."v_por_que_limitada" TO "service_role";



GRANT ALL ON TABLE "public"."v_primaria_recomendada" TO "authenticated";
GRANT ALL ON TABLE "public"."v_primaria_recomendada" TO "service_role";



GRANT ALL ON TABLE "public"."v_primarias_solapadas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_primarias_solapadas" TO "service_role";



GRANT ALL ON TABLE "public"."v_proyeccion_escalamiento" TO "authenticated";
GRANT ALL ON TABLE "public"."v_proyeccion_escalamiento" TO "service_role";



GRANT ALL ON TABLE "public"."v_pulso_hoy" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pulso_hoy" TO "service_role";



GRANT ALL ON TABLE "public"."v_reflexiones_recurrentes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_reflexiones_recurrentes" TO "service_role";



GRANT ALL ON TABLE "public"."v_reflexiones_vigentes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_reflexiones_vigentes" TO "service_role";



GRANT ALL ON TABLE "public"."v_reporte_publico" TO "authenticated";
GRANT ALL ON TABLE "public"."v_reporte_publico" TO "service_role";



GRANT ALL ON TABLE "public"."v_reporte_unidades" TO "authenticated";
GRANT ALL ON TABLE "public"."v_reporte_unidades" TO "service_role";



GRANT ALL ON TABLE "public"."v_reportes_no_entregables" TO "authenticated";
GRANT ALL ON TABLE "public"."v_reportes_no_entregables" TO "service_role";



GRANT ALL ON TABLE "public"."v_respaldos_pg_net" TO "service_role";



GRANT ALL ON TABLE "public"."v_respuestas_de_agentes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_respuestas_de_agentes" TO "service_role";



GRANT ALL ON TABLE "public"."v_run_scorecard" TO "authenticated";
GRANT ALL ON TABLE "public"."v_run_scorecard" TO "service_role";



GRANT ALL ON TABLE "public"."v_run_tendencia" TO "authenticated";
GRANT ALL ON TABLE "public"."v_run_tendencia" TO "service_role";



GRANT ALL ON TABLE "public"."v_salud_calidad" TO "authenticated";
GRANT ALL ON TABLE "public"."v_salud_calidad" TO "service_role";



GRANT ALL ON TABLE "public"."v_tareas_en_silencio" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tareas_en_silencio" TO "service_role";



GRANT ALL ON TABLE "public"."v_umbrales_inconsistentes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_umbrales_inconsistentes" TO "service_role";



GRANT ALL ON TABLE "public"."v_ventana_real" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ventana_real" TO "service_role";



GRANT ALL ON TABLE "public"."v_salud_sistema" TO "authenticated";
GRANT ALL ON TABLE "public"."v_salud_sistema" TO "service_role";



GRANT ALL ON TABLE "public"."v_search_terms_analisis" TO "authenticated";
GRANT ALL ON TABLE "public"."v_search_terms_analisis" TO "service_role";



GRANT ALL ON TABLE "public"."v_search_terms_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."v_search_terms_daily" TO "service_role";



GRANT ALL ON TABLE "public"."v_snapshots_disponibles" TO "authenticated";
GRANT ALL ON TABLE "public"."v_snapshots_disponibles" TO "service_role";



GRANT ALL ON TABLE "public"."v_tasa_acierto" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tasa_acierto" TO "service_role";



GRANT ALL ON TABLE "public"."v_tasa_de_accion" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tasa_de_accion" TO "service_role";



GRANT ALL ON TABLE "public"."v_tasa_de_reapertura" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tasa_de_reapertura" TO "service_role";



GRANT ALL ON TABLE "public"."v_tendencia_semanal" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tendencia_semanal" TO "service_role";



GRANT ALL ON TABLE "public"."v_terminos_nuevos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_terminos_nuevos" TO "service_role";



GRANT ALL ON TABLE "public"."v_terminos_resueltos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_terminos_resueltos" TO "service_role";



GRANT ALL ON TABLE "public"."v_terminos_sin_cobertura" TO "authenticated";
GRANT ALL ON TABLE "public"."v_terminos_sin_cobertura" TO "service_role";



GRANT ALL ON TABLE "public"."v_tickets_sin_control" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tickets_sin_control" TO "service_role";



GRANT ALL ON TABLE "public"."v_todos_los_cambios" TO "authenticated";
GRANT ALL ON TABLE "public"."v_todos_los_cambios" TO "service_role";



GRANT ALL ON TABLE "public"."v_ultima_sesion" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ultima_sesion" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."v_webhook_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_webhook_health" TO "service_role";



GRANT ALL ON TABLE "public"."v_win_rates_reales" TO "authenticated";
GRANT ALL ON TABLE "public"."v_win_rates_reales" TO "service_role";



GRANT ALL ON SEQUENCE "public"."webhook_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."webhook_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."webhook_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_brief" TO "anon";
GRANT ALL ON TABLE "public"."weekly_brief" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_brief" TO "service_role";



GRANT ALL ON SEQUENCE "public"."weekly_brief_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."weekly_brief_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."weekly_brief_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































revoke delete on table "public"."accionable_comentarios" from "anon";

revoke insert on table "public"."accionable_comentarios" from "anon";

revoke references on table "public"."accionable_comentarios" from "anon";

revoke select on table "public"."accionable_comentarios" from "anon";

revoke trigger on table "public"."accionable_comentarios" from "anon";

revoke truncate on table "public"."accionable_comentarios" from "anon";

revoke update on table "public"."accionable_comentarios" from "anon";

revoke delete on table "public"."accionable_comentarios" from "authenticated";

revoke insert on table "public"."accionable_comentarios" from "authenticated";

revoke references on table "public"."accionable_comentarios" from "authenticated";

revoke select on table "public"."accionable_comentarios" from "authenticated";

revoke trigger on table "public"."accionable_comentarios" from "authenticated";

revoke truncate on table "public"."accionable_comentarios" from "authenticated";

revoke update on table "public"."accionable_comentarios" from "authenticated";

revoke delete on table "public"."accionable_relaciones" from "anon";

revoke insert on table "public"."accionable_relaciones" from "anon";

revoke references on table "public"."accionable_relaciones" from "anon";

revoke select on table "public"."accionable_relaciones" from "anon";

revoke trigger on table "public"."accionable_relaciones" from "anon";

revoke truncate on table "public"."accionable_relaciones" from "anon";

revoke update on table "public"."accionable_relaciones" from "anon";

revoke delete on table "public"."accionable_relaciones" from "authenticated";

revoke insert on table "public"."accionable_relaciones" from "authenticated";

revoke references on table "public"."accionable_relaciones" from "authenticated";

revoke select on table "public"."accionable_relaciones" from "authenticated";

revoke trigger on table "public"."accionable_relaciones" from "authenticated";

revoke truncate on table "public"."accionable_relaciones" from "authenticated";

revoke update on table "public"."accionable_relaciones" from "authenticated";

revoke delete on table "public"."accionable_versiones" from "anon";

revoke insert on table "public"."accionable_versiones" from "anon";

revoke references on table "public"."accionable_versiones" from "anon";

revoke select on table "public"."accionable_versiones" from "anon";

revoke trigger on table "public"."accionable_versiones" from "anon";

revoke truncate on table "public"."accionable_versiones" from "anon";

revoke update on table "public"."accionable_versiones" from "anon";

revoke delete on table "public"."accionable_versiones" from "authenticated";

revoke insert on table "public"."accionable_versiones" from "authenticated";

revoke references on table "public"."accionable_versiones" from "authenticated";

revoke select on table "public"."accionable_versiones" from "authenticated";

revoke trigger on table "public"."accionable_versiones" from "authenticated";

revoke truncate on table "public"."accionable_versiones" from "authenticated";

revoke update on table "public"."accionable_versiones" from "authenticated";

revoke delete on table "public"."accionables_espejo" from "anon";

revoke insert on table "public"."accionables_espejo" from "anon";

revoke references on table "public"."accionables_espejo" from "anon";

revoke select on table "public"."accionables_espejo" from "anon";

revoke trigger on table "public"."accionables_espejo" from "anon";

revoke truncate on table "public"."accionables_espejo" from "anon";

revoke update on table "public"."accionables_espejo" from "anon";

revoke delete on table "public"."accionables_espejo" from "authenticated";

revoke insert on table "public"."accionables_espejo" from "authenticated";

revoke references on table "public"."accionables_espejo" from "authenticated";

revoke select on table "public"."accionables_espejo" from "authenticated";

revoke trigger on table "public"."accionables_espejo" from "authenticated";

revoke truncate on table "public"."accionables_espejo" from "authenticated";

revoke update on table "public"."accionables_espejo" from "authenticated";

revoke delete on table "public"."acciones_aprobadas" from "anon";

revoke insert on table "public"."acciones_aprobadas" from "anon";

revoke references on table "public"."acciones_aprobadas" from "anon";

revoke select on table "public"."acciones_aprobadas" from "anon";

revoke trigger on table "public"."acciones_aprobadas" from "anon";

revoke truncate on table "public"."acciones_aprobadas" from "anon";

revoke update on table "public"."acciones_aprobadas" from "anon";

revoke delete on table "public"."acciones_aprobadas" from "authenticated";

revoke insert on table "public"."acciones_aprobadas" from "authenticated";

revoke references on table "public"."acciones_aprobadas" from "authenticated";

revoke select on table "public"."acciones_aprobadas" from "authenticated";

revoke trigger on table "public"."acciones_aprobadas" from "authenticated";

revoke truncate on table "public"."acciones_aprobadas" from "authenticated";

revoke update on table "public"."acciones_aprobadas" from "authenticated";

revoke delete on table "public"."ai_max_estado" from "anon";

revoke insert on table "public"."ai_max_estado" from "anon";

revoke references on table "public"."ai_max_estado" from "anon";

revoke select on table "public"."ai_max_estado" from "anon";

revoke trigger on table "public"."ai_max_estado" from "anon";

revoke truncate on table "public"."ai_max_estado" from "anon";

revoke update on table "public"."ai_max_estado" from "anon";

revoke delete on table "public"."ajustes_sistema" from "anon";

revoke insert on table "public"."ajustes_sistema" from "anon";

revoke references on table "public"."ajustes_sistema" from "anon";

revoke select on table "public"."ajustes_sistema" from "anon";

revoke trigger on table "public"."ajustes_sistema" from "anon";

revoke truncate on table "public"."ajustes_sistema" from "anon";

revoke update on table "public"."ajustes_sistema" from "anon";

revoke delete on table "public"."ajustes_sistema" from "authenticated";

revoke insert on table "public"."ajustes_sistema" from "authenticated";

revoke references on table "public"."ajustes_sistema" from "authenticated";

revoke select on table "public"."ajustes_sistema" from "authenticated";

revoke trigger on table "public"."ajustes_sistema" from "authenticated";

revoke truncate on table "public"."ajustes_sistema" from "authenticated";

revoke update on table "public"."ajustes_sistema" from "authenticated";

revoke delete on table "public"."alertas" from "anon";

revoke insert on table "public"."alertas" from "anon";

revoke references on table "public"."alertas" from "anon";

revoke select on table "public"."alertas" from "anon";

revoke trigger on table "public"."alertas" from "anon";

revoke truncate on table "public"."alertas" from "anon";

revoke update on table "public"."alertas" from "anon";

revoke delete on table "public"."alertas" from "authenticated";

revoke insert on table "public"."alertas" from "authenticated";

revoke references on table "public"."alertas" from "authenticated";

revoke select on table "public"."alertas" from "authenticated";

revoke trigger on table "public"."alertas" from "authenticated";

revoke truncate on table "public"."alertas" from "authenticated";

revoke update on table "public"."alertas" from "authenticated";

revoke delete on table "public"."auditoria_objetos_ultima" from "anon";

revoke insert on table "public"."auditoria_objetos_ultima" from "anon";

revoke references on table "public"."auditoria_objetos_ultima" from "anon";

revoke select on table "public"."auditoria_objetos_ultima" from "anon";

revoke trigger on table "public"."auditoria_objetos_ultima" from "anon";

revoke truncate on table "public"."auditoria_objetos_ultima" from "anon";

revoke update on table "public"."auditoria_objetos_ultima" from "anon";

revoke delete on table "public"."auditoria_objetos_ultima" from "authenticated";

revoke insert on table "public"."auditoria_objetos_ultima" from "authenticated";

revoke references on table "public"."auditoria_objetos_ultima" from "authenticated";

revoke select on table "public"."auditoria_objetos_ultima" from "authenticated";

revoke trigger on table "public"."auditoria_objetos_ultima" from "authenticated";

revoke truncate on table "public"."auditoria_objetos_ultima" from "authenticated";

revoke update on table "public"."auditoria_objetos_ultima" from "authenticated";

revoke delete on table "public"."backups_memoria" from "anon";

revoke insert on table "public"."backups_memoria" from "anon";

revoke references on table "public"."backups_memoria" from "anon";

revoke select on table "public"."backups_memoria" from "anon";

revoke trigger on table "public"."backups_memoria" from "anon";

revoke truncate on table "public"."backups_memoria" from "anon";

revoke update on table "public"."backups_memoria" from "anon";

revoke delete on table "public"."backups_memoria" from "authenticated";

revoke insert on table "public"."backups_memoria" from "authenticated";

revoke references on table "public"."backups_memoria" from "authenticated";

revoke select on table "public"."backups_memoria" from "authenticated";

revoke trigger on table "public"."backups_memoria" from "authenticated";

revoke truncate on table "public"."backups_memoria" from "authenticated";

revoke update on table "public"."backups_memoria" from "authenticated";

revoke delete on table "public"."cambios_config" from "anon";

revoke insert on table "public"."cambios_config" from "anon";

revoke references on table "public"."cambios_config" from "anon";

revoke select on table "public"."cambios_config" from "anon";

revoke trigger on table "public"."cambios_config" from "anon";

revoke truncate on table "public"."cambios_config" from "anon";

revoke update on table "public"."cambios_config" from "anon";

revoke delete on table "public"."cambios_config" from "authenticated";

revoke insert on table "public"."cambios_config" from "authenticated";

revoke references on table "public"."cambios_config" from "authenticated";

revoke select on table "public"."cambios_config" from "authenticated";

revoke trigger on table "public"."cambios_config" from "authenticated";

revoke truncate on table "public"."cambios_config" from "authenticated";

revoke update on table "public"."cambios_config" from "authenticated";

revoke delete on table "public"."cambios_de_sistema" from "anon";

revoke insert on table "public"."cambios_de_sistema" from "anon";

revoke references on table "public"."cambios_de_sistema" from "anon";

revoke select on table "public"."cambios_de_sistema" from "anon";

revoke trigger on table "public"."cambios_de_sistema" from "anon";

revoke truncate on table "public"."cambios_de_sistema" from "anon";

revoke update on table "public"."cambios_de_sistema" from "anon";

revoke delete on table "public"."cambios_de_sistema" from "authenticated";

revoke insert on table "public"."cambios_de_sistema" from "authenticated";

revoke references on table "public"."cambios_de_sistema" from "authenticated";

revoke select on table "public"."cambios_de_sistema" from "authenticated";

revoke trigger on table "public"."cambios_de_sistema" from "authenticated";

revoke truncate on table "public"."cambios_de_sistema" from "authenticated";

revoke update on table "public"."cambios_de_sistema" from "authenticated";

revoke delete on table "public"."campaign_dim" from "anon";

revoke insert on table "public"."campaign_dim" from "anon";

revoke references on table "public"."campaign_dim" from "anon";

revoke select on table "public"."campaign_dim" from "anon";

revoke trigger on table "public"."campaign_dim" from "anon";

revoke truncate on table "public"."campaign_dim" from "anon";

revoke update on table "public"."campaign_dim" from "anon";

revoke delete on table "public"."campaign_dim" from "authenticated";

revoke insert on table "public"."campaign_dim" from "authenticated";

revoke references on table "public"."campaign_dim" from "authenticated";

revoke select on table "public"."campaign_dim" from "authenticated";

revoke trigger on table "public"."campaign_dim" from "authenticated";

revoke truncate on table "public"."campaign_dim" from "authenticated";

revoke update on table "public"."campaign_dim" from "authenticated";

revoke delete on table "public"."campaign_fechas" from "anon";

revoke insert on table "public"."campaign_fechas" from "anon";

revoke references on table "public"."campaign_fechas" from "anon";

revoke select on table "public"."campaign_fechas" from "anon";

revoke trigger on table "public"."campaign_fechas" from "anon";

revoke truncate on table "public"."campaign_fechas" from "anon";

revoke update on table "public"."campaign_fechas" from "anon";

revoke delete on table "public"."campaign_fechas" from "authenticated";

revoke insert on table "public"."campaign_fechas" from "authenticated";

revoke references on table "public"."campaign_fechas" from "authenticated";

revoke select on table "public"."campaign_fechas" from "authenticated";

revoke trigger on table "public"."campaign_fechas" from "authenticated";

revoke truncate on table "public"."campaign_fechas" from "authenticated";

revoke update on table "public"."campaign_fechas" from "authenticated";

revoke delete on table "public"."campaign_mapa" from "anon";

revoke insert on table "public"."campaign_mapa" from "anon";

revoke references on table "public"."campaign_mapa" from "anon";

revoke select on table "public"."campaign_mapa" from "anon";

revoke trigger on table "public"."campaign_mapa" from "anon";

revoke truncate on table "public"."campaign_mapa" from "anon";

revoke update on table "public"."campaign_mapa" from "anon";

revoke delete on table "public"."campaign_mapa" from "authenticated";

revoke insert on table "public"."campaign_mapa" from "authenticated";

revoke references on table "public"."campaign_mapa" from "authenticated";

revoke select on table "public"."campaign_mapa" from "authenticated";

revoke trigger on table "public"."campaign_mapa" from "authenticated";

revoke truncate on table "public"."campaign_mapa" from "authenticated";

revoke update on table "public"."campaign_mapa" from "authenticated";

revoke delete on table "public"."candidatos_a_retiro" from "anon";

revoke insert on table "public"."candidatos_a_retiro" from "anon";

revoke references on table "public"."candidatos_a_retiro" from "anon";

revoke select on table "public"."candidatos_a_retiro" from "anon";

revoke trigger on table "public"."candidatos_a_retiro" from "anon";

revoke truncate on table "public"."candidatos_a_retiro" from "anon";

revoke update on table "public"."candidatos_a_retiro" from "anon";

revoke delete on table "public"."candidatos_a_retiro" from "authenticated";

revoke insert on table "public"."candidatos_a_retiro" from "authenticated";

revoke references on table "public"."candidatos_a_retiro" from "authenticated";

revoke select on table "public"."candidatos_a_retiro" from "authenticated";

revoke trigger on table "public"."candidatos_a_retiro" from "authenticated";

revoke truncate on table "public"."candidatos_a_retiro" from "authenticated";

revoke update on table "public"."candidatos_a_retiro" from "authenticated";

revoke delete on table "public"."capacidades_ejecucion" from "anon";

revoke insert on table "public"."capacidades_ejecucion" from "anon";

revoke references on table "public"."capacidades_ejecucion" from "anon";

revoke select on table "public"."capacidades_ejecucion" from "anon";

revoke trigger on table "public"."capacidades_ejecucion" from "anon";

revoke truncate on table "public"."capacidades_ejecucion" from "anon";

revoke update on table "public"."capacidades_ejecucion" from "anon";

revoke delete on table "public"."capacidades_ejecucion" from "authenticated";

revoke insert on table "public"."capacidades_ejecucion" from "authenticated";

revoke references on table "public"."capacidades_ejecucion" from "authenticated";

revoke select on table "public"."capacidades_ejecucion" from "authenticated";

revoke trigger on table "public"."capacidades_ejecucion" from "authenticated";

revoke truncate on table "public"."capacidades_ejecucion" from "authenticated";

revoke update on table "public"."capacidades_ejecucion" from "authenticated";

revoke delete on table "public"."cifras_publicadas" from "anon";

revoke insert on table "public"."cifras_publicadas" from "anon";

revoke references on table "public"."cifras_publicadas" from "anon";

revoke select on table "public"."cifras_publicadas" from "anon";

revoke trigger on table "public"."cifras_publicadas" from "anon";

revoke truncate on table "public"."cifras_publicadas" from "anon";

revoke update on table "public"."cifras_publicadas" from "anon";

revoke delete on table "public"."conocimiento_externo" from "anon";

revoke insert on table "public"."conocimiento_externo" from "anon";

revoke references on table "public"."conocimiento_externo" from "anon";

revoke select on table "public"."conocimiento_externo" from "anon";

revoke trigger on table "public"."conocimiento_externo" from "anon";

revoke truncate on table "public"."conocimiento_externo" from "anon";

revoke update on table "public"."conocimiento_externo" from "anon";

revoke delete on table "public"."conocimiento_externo" from "authenticated";

revoke insert on table "public"."conocimiento_externo" from "authenticated";

revoke references on table "public"."conocimiento_externo" from "authenticated";

revoke select on table "public"."conocimiento_externo" from "authenticated";

revoke trigger on table "public"."conocimiento_externo" from "authenticated";

revoke truncate on table "public"."conocimiento_externo" from "authenticated";

revoke update on table "public"."conocimiento_externo" from "authenticated";

revoke delete on table "public"."contratos_columna" from "anon";

revoke insert on table "public"."contratos_columna" from "anon";

revoke references on table "public"."contratos_columna" from "anon";

revoke select on table "public"."contratos_columna" from "anon";

revoke trigger on table "public"."contratos_columna" from "anon";

revoke truncate on table "public"."contratos_columna" from "anon";

revoke update on table "public"."contratos_columna" from "anon";

revoke delete on table "public"."controles_de_ticket" from "anon";

revoke insert on table "public"."controles_de_ticket" from "anon";

revoke references on table "public"."controles_de_ticket" from "anon";

revoke select on table "public"."controles_de_ticket" from "anon";

revoke trigger on table "public"."controles_de_ticket" from "anon";

revoke truncate on table "public"."controles_de_ticket" from "anon";

revoke update on table "public"."controles_de_ticket" from "anon";

revoke delete on table "public"."corridas_verdad" from "anon";

revoke insert on table "public"."corridas_verdad" from "anon";

revoke references on table "public"."corridas_verdad" from "anon";

revoke select on table "public"."corridas_verdad" from "anon";

revoke trigger on table "public"."corridas_verdad" from "anon";

revoke truncate on table "public"."corridas_verdad" from "anon";

revoke update on table "public"."corridas_verdad" from "anon";

revoke delete on table "public"."cuarentena" from "anon";

revoke insert on table "public"."cuarentena" from "anon";

revoke references on table "public"."cuarentena" from "anon";

revoke select on table "public"."cuarentena" from "anon";

revoke trigger on table "public"."cuarentena" from "anon";

revoke truncate on table "public"."cuarentena" from "anon";

revoke update on table "public"."cuarentena" from "anon";

revoke delete on table "public"."cuarentena" from "authenticated";

revoke insert on table "public"."cuarentena" from "authenticated";

revoke references on table "public"."cuarentena" from "authenticated";

revoke select on table "public"."cuarentena" from "authenticated";

revoke trigger on table "public"."cuarentena" from "authenticated";

revoke truncate on table "public"."cuarentena" from "authenticated";

revoke update on table "public"."cuarentena" from "authenticated";

revoke delete on table "public"."cuentas" from "anon";

revoke insert on table "public"."cuentas" from "anon";

revoke references on table "public"."cuentas" from "anon";

revoke select on table "public"."cuentas" from "anon";

revoke trigger on table "public"."cuentas" from "anon";

revoke truncate on table "public"."cuentas" from "anon";

revoke update on table "public"."cuentas" from "anon";

revoke delete on table "public"."cuentas" from "authenticated";

revoke insert on table "public"."cuentas" from "authenticated";

revoke references on table "public"."cuentas" from "authenticated";

revoke select on table "public"."cuentas" from "authenticated";

revoke trigger on table "public"."cuentas" from "authenticated";

revoke truncate on table "public"."cuentas" from "authenticated";

revoke update on table "public"."cuentas" from "authenticated";

revoke delete on table "public"."doc_maestro_consolidado" from "anon";

revoke insert on table "public"."doc_maestro_consolidado" from "anon";

revoke references on table "public"."doc_maestro_consolidado" from "anon";

revoke select on table "public"."doc_maestro_consolidado" from "anon";

revoke trigger on table "public"."doc_maestro_consolidado" from "anon";

revoke truncate on table "public"."doc_maestro_consolidado" from "anon";

revoke update on table "public"."doc_maestro_consolidado" from "anon";

revoke delete on table "public"."doc_maestro_humano" from "anon";

revoke insert on table "public"."doc_maestro_humano" from "anon";

revoke references on table "public"."doc_maestro_humano" from "anon";

revoke select on table "public"."doc_maestro_humano" from "anon";

revoke trigger on table "public"."doc_maestro_humano" from "anon";

revoke truncate on table "public"."doc_maestro_humano" from "anon";

revoke update on table "public"."doc_maestro_humano" from "anon";

revoke delete on table "public"."drift_exento" from "anon";

revoke insert on table "public"."drift_exento" from "anon";

revoke references on table "public"."drift_exento" from "anon";

revoke select on table "public"."drift_exento" from "anon";

revoke trigger on table "public"."drift_exento" from "anon";

revoke truncate on table "public"."drift_exento" from "anon";

revoke update on table "public"."drift_exento" from "anon";

revoke delete on table "public"."escritores" from "anon";

revoke insert on table "public"."escritores" from "anon";

revoke references on table "public"."escritores" from "anon";

revoke select on table "public"."escritores" from "anon";

revoke trigger on table "public"."escritores" from "anon";

revoke truncate on table "public"."escritores" from "anon";

revoke update on table "public"."escritores" from "anon";

revoke delete on table "public"."escritores" from "authenticated";

revoke insert on table "public"."escritores" from "authenticated";

revoke references on table "public"."escritores" from "authenticated";

revoke select on table "public"."escritores" from "authenticated";

revoke trigger on table "public"."escritores" from "authenticated";

revoke truncate on table "public"."escritores" from "authenticated";

revoke update on table "public"."escritores" from "authenticated";

revoke delete on table "public"."filtro_umbrales" from "anon";

revoke insert on table "public"."filtro_umbrales" from "anon";

revoke references on table "public"."filtro_umbrales" from "anon";

revoke select on table "public"."filtro_umbrales" from "anon";

revoke trigger on table "public"."filtro_umbrales" from "anon";

revoke truncate on table "public"."filtro_umbrales" from "anon";

revoke update on table "public"."filtro_umbrales" from "anon";

revoke delete on table "public"."filtro_umbrales" from "authenticated";

revoke insert on table "public"."filtro_umbrales" from "authenticated";

revoke references on table "public"."filtro_umbrales" from "authenticated";

revoke select on table "public"."filtro_umbrales" from "authenticated";

revoke trigger on table "public"."filtro_umbrales" from "authenticated";

revoke truncate on table "public"."filtro_umbrales" from "authenticated";

revoke update on table "public"."filtro_umbrales" from "authenticated";

revoke delete on table "public"."grupos_reporte" from "anon";

revoke insert on table "public"."grupos_reporte" from "anon";

revoke references on table "public"."grupos_reporte" from "anon";

revoke select on table "public"."grupos_reporte" from "anon";

revoke trigger on table "public"."grupos_reporte" from "anon";

revoke truncate on table "public"."grupos_reporte" from "anon";

revoke update on table "public"."grupos_reporte" from "anon";

revoke delete on table "public"."grupos_reporte" from "authenticated";

revoke insert on table "public"."grupos_reporte" from "authenticated";

revoke references on table "public"."grupos_reporte" from "authenticated";

revoke select on table "public"."grupos_reporte" from "authenticated";

revoke trigger on table "public"."grupos_reporte" from "authenticated";

revoke truncate on table "public"."grupos_reporte" from "authenticated";

revoke update on table "public"."grupos_reporte" from "authenticated";

revoke delete on table "public"."incidentes_atendidos" from "anon";

revoke insert on table "public"."incidentes_atendidos" from "anon";

revoke references on table "public"."incidentes_atendidos" from "anon";

revoke select on table "public"."incidentes_atendidos" from "anon";

revoke trigger on table "public"."incidentes_atendidos" from "anon";

revoke truncate on table "public"."incidentes_atendidos" from "anon";

revoke update on table "public"."incidentes_atendidos" from "anon";

revoke delete on table "public"."intentos" from "anon";

revoke insert on table "public"."intentos" from "anon";

revoke references on table "public"."intentos" from "anon";

revoke select on table "public"."intentos" from "anon";

revoke trigger on table "public"."intentos" from "anon";

revoke truncate on table "public"."intentos" from "anon";

revoke update on table "public"."intentos" from "anon";

revoke delete on table "public"."intentos" from "authenticated";

revoke insert on table "public"."intentos" from "authenticated";

revoke references on table "public"."intentos" from "authenticated";

revoke select on table "public"."intentos" from "authenticated";

revoke trigger on table "public"."intentos" from "authenticated";

revoke truncate on table "public"."intentos" from "authenticated";

revoke update on table "public"."intentos" from "authenticated";

revoke delete on table "public"."latidos" from "anon";

revoke insert on table "public"."latidos" from "anon";

revoke references on table "public"."latidos" from "anon";

revoke select on table "public"."latidos" from "anon";

revoke trigger on table "public"."latidos" from "anon";

revoke truncate on table "public"."latidos" from "anon";

revoke update on table "public"."latidos" from "anon";

revoke delete on table "public"."latidos" from "authenticated";

revoke insert on table "public"."latidos" from "authenticated";

revoke references on table "public"."latidos" from "authenticated";

revoke select on table "public"."latidos" from "authenticated";

revoke trigger on table "public"."latidos" from "authenticated";

revoke truncate on table "public"."latidos" from "authenticated";

revoke update on table "public"."latidos" from "authenticated";

revoke delete on table "public"."lecciones" from "anon";

revoke insert on table "public"."lecciones" from "anon";

revoke references on table "public"."lecciones" from "anon";

revoke select on table "public"."lecciones" from "anon";

revoke trigger on table "public"."lecciones" from "anon";

revoke truncate on table "public"."lecciones" from "anon";

revoke update on table "public"."lecciones" from "anon";

revoke delete on table "public"."lecciones" from "authenticated";

revoke insert on table "public"."lecciones" from "authenticated";

revoke references on table "public"."lecciones" from "authenticated";

revoke select on table "public"."lecciones" from "authenticated";

revoke trigger on table "public"."lecciones" from "authenticated";

revoke truncate on table "public"."lecciones" from "authenticated";

revoke update on table "public"."lecciones" from "authenticated";

revoke delete on table "public"."limites_plataforma" from "anon";

revoke insert on table "public"."limites_plataforma" from "anon";

revoke references on table "public"."limites_plataforma" from "anon";

revoke select on table "public"."limites_plataforma" from "anon";

revoke trigger on table "public"."limites_plataforma" from "anon";

revoke truncate on table "public"."limites_plataforma" from "anon";

revoke update on table "public"."limites_plataforma" from "anon";

revoke delete on table "public"."limites_plataforma" from "authenticated";

revoke insert on table "public"."limites_plataforma" from "authenticated";

revoke references on table "public"."limites_plataforma" from "authenticated";

revoke select on table "public"."limites_plataforma" from "authenticated";

revoke trigger on table "public"."limites_plataforma" from "authenticated";

revoke truncate on table "public"."limites_plataforma" from "authenticated";

revoke update on table "public"."limites_plataforma" from "authenticated";

revoke delete on table "public"."locations" from "anon";

revoke insert on table "public"."locations" from "anon";

revoke references on table "public"."locations" from "anon";

revoke select on table "public"."locations" from "anon";

revoke trigger on table "public"."locations" from "anon";

revoke truncate on table "public"."locations" from "anon";

revoke update on table "public"."locations" from "anon";

revoke delete on table "public"."locations" from "authenticated";

revoke insert on table "public"."locations" from "authenticated";

revoke references on table "public"."locations" from "authenticated";

revoke select on table "public"."locations" from "authenticated";

revoke trigger on table "public"."locations" from "authenticated";

revoke truncate on table "public"."locations" from "authenticated";

revoke update on table "public"."locations" from "authenticated";

revoke delete on table "public"."memoria" from "anon";

revoke insert on table "public"."memoria" from "anon";

revoke references on table "public"."memoria" from "anon";

revoke select on table "public"."memoria" from "anon";

revoke trigger on table "public"."memoria" from "anon";

revoke truncate on table "public"."memoria" from "anon";

revoke update on table "public"."memoria" from "anon";

revoke delete on table "public"."memoria" from "authenticated";

revoke insert on table "public"."memoria" from "authenticated";

revoke references on table "public"."memoria" from "authenticated";

revoke select on table "public"."memoria" from "authenticated";

revoke trigger on table "public"."memoria" from "authenticated";

revoke truncate on table "public"."memoria" from "authenticated";

revoke update on table "public"."memoria" from "authenticated";

revoke delete on table "public"."memoria_revisada" from "anon";

revoke insert on table "public"."memoria_revisada" from "anon";

revoke references on table "public"."memoria_revisada" from "anon";

revoke select on table "public"."memoria_revisada" from "anon";

revoke trigger on table "public"."memoria_revisada" from "anon";

revoke truncate on table "public"."memoria_revisada" from "anon";

revoke update on table "public"."memoria_revisada" from "anon";

revoke delete on table "public"."memoria_revisada" from "authenticated";

revoke insert on table "public"."memoria_revisada" from "authenticated";

revoke references on table "public"."memoria_revisada" from "authenticated";

revoke select on table "public"."memoria_revisada" from "authenticated";

revoke trigger on table "public"."memoria_revisada" from "authenticated";

revoke truncate on table "public"."memoria_revisada" from "authenticated";

revoke update on table "public"."memoria_revisada" from "authenticated";

revoke delete on table "public"."metricas" from "anon";

revoke insert on table "public"."metricas" from "anon";

revoke references on table "public"."metricas" from "anon";

revoke select on table "public"."metricas" from "anon";

revoke trigger on table "public"."metricas" from "anon";

revoke truncate on table "public"."metricas" from "anon";

revoke update on table "public"."metricas" from "anon";

revoke delete on table "public"."notas_de_objetos" from "anon";

revoke insert on table "public"."notas_de_objetos" from "anon";

revoke references on table "public"."notas_de_objetos" from "anon";

revoke select on table "public"."notas_de_objetos" from "anon";

revoke trigger on table "public"."notas_de_objetos" from "anon";

revoke truncate on table "public"."notas_de_objetos" from "anon";

revoke update on table "public"."notas_de_objetos" from "anon";

revoke delete on table "public"."notas_de_objetos" from "authenticated";

revoke insert on table "public"."notas_de_objetos" from "authenticated";

revoke references on table "public"."notas_de_objetos" from "authenticated";

revoke select on table "public"."notas_de_objetos" from "authenticated";

revoke trigger on table "public"."notas_de_objetos" from "authenticated";

revoke truncate on table "public"."notas_de_objetos" from "authenticated";

revoke update on table "public"."notas_de_objetos" from "authenticated";

revoke delete on table "public"."notas_para_agentes" from "anon";

revoke insert on table "public"."notas_para_agentes" from "anon";

revoke references on table "public"."notas_para_agentes" from "anon";

revoke select on table "public"."notas_para_agentes" from "anon";

revoke trigger on table "public"."notas_para_agentes" from "anon";

revoke truncate on table "public"."notas_para_agentes" from "anon";

revoke update on table "public"."notas_para_agentes" from "anon";

revoke delete on table "public"."notas_para_agentes" from "authenticated";

revoke insert on table "public"."notas_para_agentes" from "authenticated";

revoke references on table "public"."notas_para_agentes" from "authenticated";

revoke select on table "public"."notas_para_agentes" from "authenticated";

revoke trigger on table "public"."notas_para_agentes" from "authenticated";

revoke truncate on table "public"."notas_para_agentes" from "authenticated";

revoke update on table "public"."notas_para_agentes" from "authenticated";

revoke delete on table "public"."notion_espejo_cuentas" from "anon";

revoke insert on table "public"."notion_espejo_cuentas" from "anon";

revoke references on table "public"."notion_espejo_cuentas" from "anon";

revoke select on table "public"."notion_espejo_cuentas" from "anon";

revoke trigger on table "public"."notion_espejo_cuentas" from "anon";

revoke truncate on table "public"."notion_espejo_cuentas" from "anon";

revoke update on table "public"."notion_espejo_cuentas" from "anon";

revoke delete on table "public"."notion_espejo_cuentas" from "authenticated";

revoke insert on table "public"."notion_espejo_cuentas" from "authenticated";

revoke references on table "public"."notion_espejo_cuentas" from "authenticated";

revoke select on table "public"."notion_espejo_cuentas" from "authenticated";

revoke trigger on table "public"."notion_espejo_cuentas" from "authenticated";

revoke truncate on table "public"."notion_espejo_cuentas" from "authenticated";

revoke update on table "public"."notion_espejo_cuentas" from "authenticated";

revoke delete on table "public"."novedades" from "anon";

revoke insert on table "public"."novedades" from "anon";

revoke references on table "public"."novedades" from "anon";

revoke select on table "public"."novedades" from "anon";

revoke trigger on table "public"."novedades" from "anon";

revoke truncate on table "public"."novedades" from "anon";

revoke update on table "public"."novedades" from "anon";

revoke delete on table "public"."novedades" from "authenticated";

revoke insert on table "public"."novedades" from "authenticated";

revoke references on table "public"."novedades" from "authenticated";

revoke select on table "public"."novedades" from "authenticated";

revoke trigger on table "public"."novedades" from "authenticated";

revoke truncate on table "public"."novedades" from "authenticated";

revoke update on table "public"."novedades" from "authenticated";

revoke delete on table "public"."objetivos_conversion" from "anon";

revoke insert on table "public"."objetivos_conversion" from "anon";

revoke references on table "public"."objetivos_conversion" from "anon";

revoke select on table "public"."objetivos_conversion" from "anon";

revoke trigger on table "public"."objetivos_conversion" from "anon";

revoke truncate on table "public"."objetivos_conversion" from "anon";

revoke update on table "public"."objetivos_conversion" from "anon";

revoke delete on table "public"."objetivos_conversion" from "authenticated";

revoke insert on table "public"."objetivos_conversion" from "authenticated";

revoke references on table "public"."objetivos_conversion" from "authenticated";

revoke select on table "public"."objetivos_conversion" from "authenticated";

revoke trigger on table "public"."objetivos_conversion" from "authenticated";

revoke truncate on table "public"."objetivos_conversion" from "authenticated";

revoke update on table "public"."objetivos_conversion" from "authenticated";

revoke delete on table "public"."patrones_drift" from "anon";

revoke insert on table "public"."patrones_drift" from "anon";

revoke references on table "public"."patrones_drift" from "anon";

revoke select on table "public"."patrones_drift" from "anon";

revoke trigger on table "public"."patrones_drift" from "anon";

revoke truncate on table "public"."patrones_drift" from "anon";

revoke update on table "public"."patrones_drift" from "anon";

revoke delete on table "public"."plan_semanal" from "anon";

revoke insert on table "public"."plan_semanal" from "anon";

revoke references on table "public"."plan_semanal" from "anon";

revoke select on table "public"."plan_semanal" from "anon";

revoke trigger on table "public"."plan_semanal" from "anon";

revoke truncate on table "public"."plan_semanal" from "anon";

revoke update on table "public"."plan_semanal" from "anon";

revoke delete on table "public"."plan_semanal" from "authenticated";

revoke insert on table "public"."plan_semanal" from "authenticated";

revoke references on table "public"."plan_semanal" from "authenticated";

revoke select on table "public"."plan_semanal" from "authenticated";

revoke trigger on table "public"."plan_semanal" from "authenticated";

revoke truncate on table "public"."plan_semanal" from "authenticated";

revoke update on table "public"."plan_semanal" from "authenticated";

revoke delete on table "public"."planes_tecnicos" from "anon";

revoke insert on table "public"."planes_tecnicos" from "anon";

revoke references on table "public"."planes_tecnicos" from "anon";

revoke select on table "public"."planes_tecnicos" from "anon";

revoke trigger on table "public"."planes_tecnicos" from "anon";

revoke truncate on table "public"."planes_tecnicos" from "anon";

revoke update on table "public"."planes_tecnicos" from "anon";

revoke delete on table "public"."planes_tecnicos" from "authenticated";

revoke insert on table "public"."planes_tecnicos" from "authenticated";

revoke references on table "public"."planes_tecnicos" from "authenticated";

revoke select on table "public"."planes_tecnicos" from "authenticated";

revoke trigger on table "public"."planes_tecnicos" from "authenticated";

revoke truncate on table "public"."planes_tecnicos" from "authenticated";

revoke update on table "public"."planes_tecnicos" from "authenticated";

revoke delete on table "public"."politicas_auto" from "anon";

revoke insert on table "public"."politicas_auto" from "anon";

revoke references on table "public"."politicas_auto" from "anon";

revoke select on table "public"."politicas_auto" from "anon";

revoke trigger on table "public"."politicas_auto" from "anon";

revoke truncate on table "public"."politicas_auto" from "anon";

revoke update on table "public"."politicas_auto" from "anon";

revoke delete on table "public"."politicas_auto" from "authenticated";

revoke insert on table "public"."politicas_auto" from "authenticated";

revoke references on table "public"."politicas_auto" from "authenticated";

revoke select on table "public"."politicas_auto" from "authenticated";

revoke trigger on table "public"."politicas_auto" from "authenticated";

revoke truncate on table "public"."politicas_auto" from "authenticated";

revoke update on table "public"."politicas_auto" from "authenticated";

revoke delete on table "public"."predicciones" from "anon";

revoke insert on table "public"."predicciones" from "anon";

revoke references on table "public"."predicciones" from "anon";

revoke select on table "public"."predicciones" from "anon";

revoke trigger on table "public"."predicciones" from "anon";

revoke truncate on table "public"."predicciones" from "anon";

revoke update on table "public"."predicciones" from "anon";

revoke delete on table "public"."predicciones" from "authenticated";

revoke insert on table "public"."predicciones" from "authenticated";

revoke references on table "public"."predicciones" from "authenticated";

revoke select on table "public"."predicciones" from "authenticated";

revoke trigger on table "public"."predicciones" from "authenticated";

revoke truncate on table "public"."predicciones" from "authenticated";

revoke update on table "public"."predicciones" from "authenticated";

revoke delete on table "public"."propuestas_estrategicas" from "anon";

revoke insert on table "public"."propuestas_estrategicas" from "anon";

revoke references on table "public"."propuestas_estrategicas" from "anon";

revoke select on table "public"."propuestas_estrategicas" from "anon";

revoke trigger on table "public"."propuestas_estrategicas" from "anon";

revoke truncate on table "public"."propuestas_estrategicas" from "anon";

revoke update on table "public"."propuestas_estrategicas" from "anon";

revoke delete on table "public"."propuestas_estrategicas" from "authenticated";

revoke insert on table "public"."propuestas_estrategicas" from "authenticated";

revoke references on table "public"."propuestas_estrategicas" from "authenticated";

revoke select on table "public"."propuestas_estrategicas" from "authenticated";

revoke trigger on table "public"."propuestas_estrategicas" from "authenticated";

revoke truncate on table "public"."propuestas_estrategicas" from "authenticated";

revoke update on table "public"."propuestas_estrategicas" from "authenticated";

revoke delete on table "public"."pulso_diario" from "anon";

revoke insert on table "public"."pulso_diario" from "anon";

revoke references on table "public"."pulso_diario" from "anon";

revoke select on table "public"."pulso_diario" from "anon";

revoke trigger on table "public"."pulso_diario" from "anon";

revoke truncate on table "public"."pulso_diario" from "anon";

revoke update on table "public"."pulso_diario" from "anon";

revoke delete on table "public"."pulso_diario" from "authenticated";

revoke insert on table "public"."pulso_diario" from "authenticated";

revoke references on table "public"."pulso_diario" from "authenticated";

revoke select on table "public"."pulso_diario" from "authenticated";

revoke trigger on table "public"."pulso_diario" from "authenticated";

revoke truncate on table "public"."pulso_diario" from "authenticated";

revoke update on table "public"."pulso_diario" from "authenticated";

revoke delete on table "public"."reconciliaciones" from "anon";

revoke insert on table "public"."reconciliaciones" from "anon";

revoke references on table "public"."reconciliaciones" from "anon";

revoke select on table "public"."reconciliaciones" from "anon";

revoke trigger on table "public"."reconciliaciones" from "anon";

revoke truncate on table "public"."reconciliaciones" from "anon";

revoke update on table "public"."reconciliaciones" from "anon";

revoke delete on table "public"."reconciliaciones" from "authenticated";

revoke insert on table "public"."reconciliaciones" from "authenticated";

revoke references on table "public"."reconciliaciones" from "authenticated";

revoke select on table "public"."reconciliaciones" from "authenticated";

revoke trigger on table "public"."reconciliaciones" from "authenticated";

revoke truncate on table "public"."reconciliaciones" from "authenticated";

revoke update on table "public"."reconciliaciones" from "authenticated";

revoke delete on table "public"."relaciones_verdad" from "anon";

revoke insert on table "public"."relaciones_verdad" from "anon";

revoke references on table "public"."relaciones_verdad" from "anon";

revoke select on table "public"."relaciones_verdad" from "anon";

revoke trigger on table "public"."relaciones_verdad" from "anon";

revoke truncate on table "public"."relaciones_verdad" from "anon";

revoke update on table "public"."relaciones_verdad" from "anon";

revoke delete on table "public"."reportes_cliente" from "anon";

revoke insert on table "public"."reportes_cliente" from "anon";

revoke references on table "public"."reportes_cliente" from "anon";

revoke select on table "public"."reportes_cliente" from "anon";

revoke trigger on table "public"."reportes_cliente" from "anon";

revoke truncate on table "public"."reportes_cliente" from "anon";

revoke update on table "public"."reportes_cliente" from "anon";

revoke delete on table "public"."reportes_cliente" from "authenticated";

revoke insert on table "public"."reportes_cliente" from "authenticated";

revoke references on table "public"."reportes_cliente" from "authenticated";

revoke select on table "public"."reportes_cliente" from "authenticated";

revoke trigger on table "public"."reportes_cliente" from "authenticated";

revoke truncate on table "public"."reportes_cliente" from "authenticated";

revoke update on table "public"."reportes_cliente" from "authenticated";

revoke delete on table "public"."reportes_versiones" from "anon";

revoke insert on table "public"."reportes_versiones" from "anon";

revoke references on table "public"."reportes_versiones" from "anon";

revoke select on table "public"."reportes_versiones" from "anon";

revoke trigger on table "public"."reportes_versiones" from "anon";

revoke truncate on table "public"."reportes_versiones" from "anon";

revoke update on table "public"."reportes_versiones" from "anon";

revoke delete on table "public"."reportes_versiones" from "authenticated";

revoke insert on table "public"."reportes_versiones" from "authenticated";

revoke references on table "public"."reportes_versiones" from "authenticated";

revoke select on table "public"."reportes_versiones" from "authenticated";

revoke trigger on table "public"."reportes_versiones" from "authenticated";

revoke truncate on table "public"."reportes_versiones" from "authenticated";

revoke update on table "public"."reportes_versiones" from "authenticated";

revoke delete on table "public"."sesiones" from "anon";

revoke insert on table "public"."sesiones" from "anon";

revoke references on table "public"."sesiones" from "anon";

revoke select on table "public"."sesiones" from "anon";

revoke trigger on table "public"."sesiones" from "anon";

revoke truncate on table "public"."sesiones" from "anon";

revoke update on table "public"."sesiones" from "anon";

revoke delete on table "public"."sesiones" from "authenticated";

revoke insert on table "public"."sesiones" from "authenticated";

revoke references on table "public"."sesiones" from "authenticated";

revoke select on table "public"."sesiones" from "authenticated";

revoke trigger on table "public"."sesiones" from "authenticated";

revoke truncate on table "public"."sesiones" from "authenticated";

revoke update on table "public"."sesiones" from "authenticated";

revoke delete on table "public"."terminos_protegidos" from "anon";

revoke insert on table "public"."terminos_protegidos" from "anon";

revoke references on table "public"."terminos_protegidos" from "anon";

revoke select on table "public"."terminos_protegidos" from "anon";

revoke trigger on table "public"."terminos_protegidos" from "anon";

revoke truncate on table "public"."terminos_protegidos" from "anon";

revoke update on table "public"."terminos_protegidos" from "anon";

revoke delete on table "public"."terminos_protegidos" from "authenticated";

revoke insert on table "public"."terminos_protegidos" from "authenticated";

revoke references on table "public"."terminos_protegidos" from "authenticated";

revoke select on table "public"."terminos_protegidos" from "authenticated";

revoke trigger on table "public"."terminos_protegidos" from "authenticated";

revoke truncate on table "public"."terminos_protegidos" from "authenticated";

revoke update on table "public"."terminos_protegidos" from "authenticated";

revoke delete on table "public"."tickets" from "anon";

revoke insert on table "public"."tickets" from "anon";

revoke references on table "public"."tickets" from "anon";

revoke select on table "public"."tickets" from "anon";

revoke trigger on table "public"."tickets" from "anon";

revoke truncate on table "public"."tickets" from "anon";

revoke update on table "public"."tickets" from "anon";

revoke delete on table "public"."tickets" from "authenticated";

revoke insert on table "public"."tickets" from "authenticated";

revoke references on table "public"."tickets" from "authenticated";

revoke select on table "public"."tickets" from "authenticated";

revoke trigger on table "public"."tickets" from "authenticated";

revoke truncate on table "public"."tickets" from "authenticated";

revoke update on table "public"."tickets" from "authenticated";

revoke delete on table "public"."umbrales_de_scripts" from "anon";

revoke insert on table "public"."umbrales_de_scripts" from "anon";

revoke references on table "public"."umbrales_de_scripts" from "anon";

revoke select on table "public"."umbrales_de_scripts" from "anon";

revoke trigger on table "public"."umbrales_de_scripts" from "anon";

revoke truncate on table "public"."umbrales_de_scripts" from "anon";

revoke update on table "public"."umbrales_de_scripts" from "anon";

revoke delete on table "public"."umbrales_de_scripts" from "authenticated";

revoke insert on table "public"."umbrales_de_scripts" from "authenticated";

revoke references on table "public"."umbrales_de_scripts" from "authenticated";

revoke select on table "public"."umbrales_de_scripts" from "authenticated";

revoke trigger on table "public"."umbrales_de_scripts" from "authenticated";

revoke truncate on table "public"."umbrales_de_scripts" from "authenticated";

revoke update on table "public"."umbrales_de_scripts" from "authenticated";

revoke delete on table "public"."umbrales_esperados" from "anon";

revoke insert on table "public"."umbrales_esperados" from "anon";

revoke references on table "public"."umbrales_esperados" from "anon";

revoke select on table "public"."umbrales_esperados" from "anon";

revoke trigger on table "public"."umbrales_esperados" from "anon";

revoke truncate on table "public"."umbrales_esperados" from "anon";

revoke update on table "public"."umbrales_esperados" from "anon";

create or replace view "public"."v_drift_semantico" as  SELECT 'ventana_que_miente'::text AS familia,
    c.objeto,
    c.columna,
    (((('El nombre dice '::text || (regexp_match(c.columna, '([0-9]+)\s*d'::text))[1]) || ' dias y el contrato declara '::text) || c.ventana_dias) || '.'::text) AS detalle,
    'Renombrar la columna o corregir la ventana. Un nombre que miente sobrevive a cualquier auditoria de "esta roto".'::text AS que_hacer
   FROM public.contratos_columna c
  WHERE ((c.columna ~ '[0-9]+d($|_)'::text) AND (c.ventana_dias IS NOT NULL) AND (((regexp_match(c.columna, '([0-9]+)\s*d'::text))[1])::integer <> c.ventana_dias))
UNION ALL
 SELECT 'tipo_que_miente'::text AS familia,
    ic.table_name AS objeto,
    ic.column_name AS columna,
    (('Se llama como una fecha y es '::text || (ic.data_type)::text) || '. Toda comparacion contra un timestamp falla o exige cast.'::text) AS detalle,
    'Cambiar el tipo, o declarar el contrato con nota explicita y castear siempre.'::text AS que_hacer
   FROM information_schema.columns ic
  WHERE (((ic.table_schema)::name = 'public'::name) AND ((ic.data_type)::text = ANY ((ARRAY['text'::character varying, 'character varying'::character varying])::text[])) AND ((ic.column_name)::name ~ '(fecha|datetime|_el$|_at$)'::text) AND (NOT (EXISTS ( SELECT 1
           FROM public.drift_exento e
          WHERE ((ic.column_name)::name ~~ e.patron)))))
UNION ALL
 SELECT 'afirmacion_sin_contrato'::text AS familia,
    ic.table_name AS objeto,
    ic.column_name AS columna,
    'Booleano cuyo nombre afirma una condicion y no tiene contrato que diga que verifica exactamente.'::text AS detalle,
    'Declarar en contratos_columna que condicion afirma. accion_valida decia "el JSON parsea" y la app lo leia como "se puede ejecutar".'::text AS que_hacer
   FROM information_schema.columns ic
  WHERE (((ic.table_schema)::name = 'public'::name) AND ((ic.data_type)::text = 'boolean'::text) AND ((ic.column_name)::name ~ '(valid|ok$|correct|complet|sano|listo|puede|habilit)'::text) AND (NOT (EXISTS ( SELECT 1
           FROM public.contratos_columna c
          WHERE ((c.objeto = (ic.table_name)::name) AND (c.columna = (ic.column_name)::name))))))
UNION ALL
 SELECT 'sin_contrato'::text AS familia,
    t.tabla AS objeto,
    '(toda la tabla)'::text AS columna,
    (((t.sin_contrato || ' de '::text) || t.total) || ' columnas no declaran que prometen.'::text) AS detalle,
    'Sin contrato el drift es invisible. Empezar por las columnas que alguien cita en un brief.'::text AS que_hacer
   FROM ( SELECT ic.table_name AS tabla,
            count(*) AS total,
            count(*) FILTER (WHERE (NOT (EXISTS ( SELECT 1
                   FROM public.contratos_columna c
                  WHERE ((c.objeto = (ic.table_name)::name) AND (c.columna = (ic.column_name)::name)))))) AS sin_contrato
           FROM information_schema.columns ic
          WHERE (((ic.table_schema)::name = 'public'::name) AND ((ic.table_name)::name = ANY (ARRAY['campaign'::name, 'campaign_daily'::name, 'keywords'::name, 'keywords_daily'::name, 'change_events'::name, 'conversion_actions'::name, 'acciones_aprobadas'::name, 'accionables_espejo'::name, 'latidos'::name, 'cuentas'::name])))
          GROUP BY ic.table_name) t
  WHERE (t.sin_contrato = t.total);


create or replace view "public"."v_salud_sistema" as  WITH x AS (
         SELECT 'integridad'::text AS area,
            auditar_integridad.prueba,
            auditar_integridad.cuenta,
            auditar_integridad.estado,
            auditar_integridad.detalle
           FROM public.auditar_integridad() auditar_integridad(prueba, cuenta, estado, detalle)
        UNION ALL
         SELECT 'integridad'::text,
            'primarias_solapadas'::text,
            v.account,
            'FALLA'::text,
            ((((('Doble conteo posible en '::text || v.campanas_afectadas) || ' campana(s), factor hasta '::text) || v.factor_de_inflado) || 'x. NO es el CPA de la cuenta entera: '::text) || "left"(v.lectura, 260))
           FROM public.v_primarias_solapadas v
          WHERE (v.factor_de_inflado > 1.2)
        UNION ALL
         SELECT 'integridad'::text,
            'ventana_truncada'::text,
            v_ventana_real.account,
            'ATENCION'::text,
            v_ventana_real.lectura
           FROM public.v_ventana_real
          WHERE (v_ventana_real.dias_en_30d < 25)
        UNION ALL
         SELECT 'cuentas'::text,
            'negativa_bloquea_conversion'::text,
            n.account,
            'ATENCION'::text,
            (((((((('Negativa de campana "'::text || n.negative_keyword) || '" ('::text) || n.match_type) || ') alcanza '::text) || n.conversiones_de_lo_bloqueado_90d) || ' conversion(es) en '::text) || n.en_grupos) || '. Cruce por ILIKE, verificar en pantalla.'::text)
           FROM public.v_negativas_que_bloquean n
          WHERE (n.conversiones_de_lo_bloqueado_90d >= (1)::numeric)
        UNION ALL
         SELECT 'flujos'::text,
            'estado'::text,
            f.cuentas,
                CASE
                    WHEN (f.estado = ANY (ARRAY['CORTADO'::text, 'NUNCA RECIBIO NADA'::text])) THEN 'FALLA'::text
                    ELSE 'OK'::text
                END AS "case",
            ((((f.flujo || ': '::text) || f.estado) || '. '::text) || f.lectura)
           FROM public.estado_de_los_flujos() f(flujo, cuentas, quien_escribe, estado, ultimo_dato, lectura)
        UNION ALL
         SELECT 'scripts'::text,
            'umbral_inalcanzable'::text,
            u.account,
            'FALLA'::text,
            ((u.umbral || ': '::text) || u.lectura)
           FROM public.v_umbrales_alcanzables() u(account, umbral, valor, referencia, veredicto, lectura)
          WHERE (u.veredicto = ANY (ARRAY['IMPOSIBLE'::text, 'APAGADO'::text]))
        UNION ALL
         SELECT 'scripts'::text,
            'umbral_no_auditable'::text,
            i.account,
                CASE
                    WHEN (i.veredicto = ANY (ARRAY['APAGADO'::text, 'DIVERGE'::text])) THEN 'FALLA'::text
                    ELSE 'ATENCION'::text
                END AS "case",
            ((((((i.script || ' / '::text) || i.umbral) || ' ['::text) || i.veredicto) || ']: '::text) || "left"(i.lectura, 200))
           FROM public.v_umbrales_inconsistentes i
        UNION ALL
         SELECT 'cuenta'::text,
            'completitud'::text,
            c.account,
            'ATENCION'::text,
            ((c.requisito || ': '::text) || c.detalle)
           FROM public.v_cuentas_incompletas c
        UNION ALL
         SELECT 'notion'::text,
            'vs_supabase'::text,
            n.account,
            'FALLA'::text,
            n.lectura
           FROM public.v_notion_vs_supabase n
        UNION ALL
         SELECT 'seguridad'::text,
            'intentos_sospechosos'::text,
            s.clave,
            'ATENCION'::text,
            s.lectura
           FROM public.v_intentos_sospechosos s
        UNION ALL
         SELECT 'tareas'::text,
            'en_silencio'::text,
            t.tarea,
            'FALLA'::text,
            t.lectura
           FROM public.v_tareas_en_silencio t
        UNION ALL
         SELECT 'objetos'::text,
            'vistas_y_funciones'::text,
            '-'::text,
                CASE
                    WHEN ((a.vistas_falla + a.funciones_falla) > 0) THEN 'FALLA'::text
                    WHEN (a.corrida_el < (now() - '36:00:00'::interval)) THEN 'ATENCION'::text
                    ELSE 'OK'::text
                END AS "case",
            (((a.vistas_ok || ' vistas y '::text) || a.funciones_ok) || ' llamadas responden'::text)
           FROM public.auditoria_objetos_ultima a
        UNION ALL
         SELECT 'objetos'::text,
            'documentadas_inexistentes'::text,
            f.objeto,
            'FALLA'::text,
            f.lectura
           FROM public.v_notas_fantasma f
        UNION ALL
         SELECT 'objetos'::text,
            'sin_documentar'::text,
            '-'::text,
                CASE
                    WHEN (count(*) > 10) THEN 'ATENCION'::text
                    ELSE 'OK'::text
                END AS "case",
            ((count(*) || ' sin nota de '::text) || ( SELECT count(*) AS count
                   FROM public.diccionario_datos() d(capa, objeto, usar_para, cuidado)))
           FROM public.v_objetos_sin_documentar
        UNION ALL
         SELECT 'capacidades'::text,
            'registro_coherente'::text,
            c.verbo,
            'FALLA'::text,
            c.problema
           FROM public.v_capacidades_coherentes_chk() c(verbo, problema)
        UNION ALL
         SELECT 'notion'::text,
            'espejo_huerfano'::text,
            e.account,
            'FALLA'::text,
            e.lectura
           FROM public.v_espejo_huerfano e
        UNION ALL
         SELECT 'mapeo'::text,
            'campanas_sin_dim'::text,
            d.account,
            'FALLA'::text,
            ('Campana fuera de campaign_dim: '::text || d.campaign)
           FROM public.v_campanas_sin_dim d
        UNION ALL
         SELECT 'reportes'::text,
            'no_entregables'::text,
            r.account,
            'FALLA'::text,
            r.lectura
           FROM public.v_reportes_no_entregables r
        UNION ALL
         SELECT 'tareas'::text,
            'tickets_abiertos'::text,
            COALESCE(tickets.cuenta, '-'::text) AS "coalesce",
                CASE
                    WHEN (count(*) > 12) THEN 'ATENCION'::text
                    ELSE 'OK'::text
                END AS "case",
            (count(*) || ' ticket(s) abiertos'::text)
           FROM public.tickets
          WHERE (tickets.estado = 'abierto'::text)
          GROUP BY tickets.cuenta
        )
 SELECT area,
    prueba,
    cuenta,
    estado,
    detalle
   FROM x
  ORDER BY
        CASE estado
            WHEN 'FALLA'::text THEN 1
            WHEN 'ATENCION'::text THEN 2
            ELSE 3
        END, area, prueba;



