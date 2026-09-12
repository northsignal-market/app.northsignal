-- ================================================================
-- APRENDER AFUERA, APRENDER DE LO HECHO, AMBICION CON LOGICA
-- ================================================================

-- ---- 1. CONOCIMIENTO EXTERNO: lo que el sistema aprendio afuera, con fuente y fecha ----
create table if not exists conocimiento_externo (
  id bigserial primary key,
  fecha date not null default current_date,
  tema text not null,                       -- 'plataforma' | 'benchmark' | 'sector' | 'metodo' | 'regulacion'
  titulo text not null,
  resumen text not null,                    -- que dice, en 2-4 oraciones
  fuente text not null,                     -- URL o nombre
  fuente_tipo text not null check (fuente_tipo in ('google_oficial','agencia_con_datos','paper','foro_con_staff','medio_especializado','otro')),
  vigente_hasta date,                       -- si es un cambio con fecha, hasta cuando aplica
  aplica_a text[] default '{}',             -- cuentas afectadas: KAREDO, BHI, 360, TODAS
  accion_derivada text,                     -- que hay que hacer con esto, si algo
  registrado_por text default 'opus-5-semanal',
  verificado boolean default false,         -- Andres o Claude lo confirmo
  unique (titulo)
);
alter table conocimiento_externo enable row level security; revoke all on conocimiento_externo from anon, authenticated;
comment on table conocimiento_externo is 'Lo que el sistema aprendio fuera de los datos de la cuenta: cambios de Google Ads, benchmarks, metodos, regulacion. Con fuente, fecha y a que cuentas aplica. El semanal busca cuando los datos no alcanzan; el mensual actualiza. Nunca cambia una regla de la cuenta por algo leido: lo propone con fuente.';

insert into conocimiento_externo (fecha, tema, titulo, resumen, fuente, fuente_tipo, vigente_hasta, aplica_a, accion_derivada, registrado_por, verificado) values
('2026-09-06', 'plataforma', 'AI Max: migracion automatica de broad match a nivel de campana y ACA, 1 al 30 de septiembre 2026',
 'Google migra en el mes toda campana de Search que use el ajuste de broad match a nivel de campana o recursos creados automaticamente (ACA) a AI Max, sin opt-out real. AI Max amplia la concordancia mas alla de broad, genera titulares y descripciones, y expande URLs finales. Campanas con keywords a nivel de grupo y RSA normales no se migran. Desde el 3 de agosto no se pueden crear nuevas con esos ajustes.',
 'https://blog.google/products/ads-commerce/dsa-upgrade-to-ai-max-2026/ y searchengineland.com/google-sets-ai-max-migration-timeline-for-search-campaigns-485006', 'google_oficial', '2026-09-30', '{TODAS}',
 'Verificar en cada cuenta si la campana de Search tiene broad match a nivel de campana o ACA activados. Para BHI es riesgo regulatorio CMF: si migra, AI Max genera copy que puede usar vocabulario de venta. Revisar terminos de busqueda semanalmente los primeros 30-60 dias tras cualquier migracion.', 'claude', true),
('2026-09-06', 'plataforma', 'Google elimina la segmentacion por idioma a nivel de campana en Search y AI Max, fin de septiembre 2026',
 'Aplica a todos los anunciantes. En vez de elegir idiomas, Google empareja anuncios con usuarios segun el idioma del copy y la landing mas lo que sabe del usuario. Performance Max en Search sigue lo nuevo; YouTube, Display, Discover y Gmail respetan la seleccion.',
 'https://knewchoice.com/google-ads-ai-max-upgrade/', 'medio_especializado', null, '{KAREDO}',
 'Karedo (DACH, aleman): vigilar en octubre si aparecen terminos de busqueda en otros idiomas o impresiones fuera de patron. Copy y landing en aleman deberian bastar, pero hay que verlo.', 'claude', true),
('2026-09-06', 'plataforma', 'Dynamic Search Ads migran a AI Max en febrero 2027; Display standalone a Demand Gen en enero 2027',
 'DSA: avisos desde septiembre 2026, recordatorio 15 enero 2027, migracion automatica 1-28 febrero 2027 y fin de creacion de grupos DSA. Display fuera de Demand Gen deja de existir en enero 2027.',
 'https://searchengineland.com/google-sets-ai-max-migration-timeline-for-search-campaigns-485006', 'medio_especializado', '2027-02-28', '{KAREDO,360}',
 'Karedo y 360 tienen campanas de Display pausadas: si se reactivan, sera como Demand Gen. Ninguna usa DSA hoy.', 'claude', true),
('2026-09-06', 'plataforma', 'AI Max fuera de beta desde abril 2026 y default al crear Search; controles disponibles',
 'AI Max es el default al crear una campana de Search nueva. Controles: restricciones de marca, inclusion y exclusion de URLs, insights de terminos de busqueda, remover assets generados. Los anunciantes con mejores resultados ponen guardrails estrictos, revisan terminos agresivamente y cargan negativas. Estudios independientes muestran rendimiento menos consistente que las cifras de Google.',
 'https://www.mbadv.agency/google-ads/campaign-types y groas.com/post/google-ads-updates-2026', 'agencia_con_datos', null, '{TODAS}',
 'Si el sistema propone una campana nueva de Search, nace en AI Max salvo que se desactive. Proponer siempre con: restriccion de marca, exclusion de URLs que no venden, revision de terminos diaria la primera semana.', 'claude', true),
('2026-09-06', 'benchmark', 'Tasa de conversion promedio por tipo de campana, todas las industrias',
 'Search 7,52% promedio (WordStream 2025, 16.000+ campanas US); ecommerce Search 2,81%. Es el tipo con mayor tasa de conversion medible.',
 'https://www.mbadv.agency/google-ads/campaign-types', 'agencia_con_datos', null, '{TODAS}',
 'Referencia gruesa. Karedo esta en 3-5% en no-marca (B2B software, Alemania): razonable. BHI y 360 con volumen bajo no se comparan bien.', 'claude', true)
on conflict (titulo) do nothing;

-- ---- 2. LECCIONES: condicion -> decision -> resultado -> leccion, con confianza ----
create table if not exists lecciones (
  id bigserial primary key,
  account text,                             -- null = general
  fecha date not null default current_date,
  contexto text not null,                   -- en que situacion
  decision text not null,                   -- que se hizo (o no se hizo)
  resultado text not null,                  -- que paso, con numeros
  leccion text not null,                    -- la regla que se deriva, en una oracion
  tipo text not null check (tipo in ('acierto','error','omision','neutro')),
  confianza numeric not null default 0.5 check (confianza between 0 and 1),
  veces_confirmada int default 1,
  origen_id text,                           -- accionable, reflexion, corrida
  escrita_por text default 'opus-5-semanal',
  unique (account, leccion)
);
alter table lecciones enable row level security; revoke all on lecciones from anon, authenticated;
comment on table lecciones is 'Aprendizaje retroactivo estructurado: en que contexto, que se decidio, que paso, que regla queda. tipo=error es lo mas valioso. veces_confirmada sube cuando otra corrida ve lo mismo. El pulso y el semanal leen las de confianza alta en la foto unica.';

-- Tasa de acierto por tipo de accion: que funciona en cada cuenta
create or replace view v_acierto_por_tipo as
with t as (
  select account, ejecutado_el, veredicto, variacion_pct,
    case when titulo ~* 'negativ' then 'negativa' when titulo ~* 'pausar' then 'pausa' when titulo ~* 'puja|tcpa|cpa objetivo|maximizar' then 'puja'
         when titulo ~* 'presupuesto' then 'presupuesto' when titulo ~* 'concordancia|frase|exacta' then 'concordancia' when titulo ~* 'anuncio|rsa|titular' then 'anuncio'
         when titulo ~* 'conversi' then 'conversiones' when titulo ~* 'landing|url' then 'landing' else 'otro' end as tipo
  from v_impacto_accionables where veredicto is not null
)
select account, tipo, count(*) n, sum(case when veredicto ~* '^MEJOR' then 1 else 0 end) mejoraron, sum(case when veredicto ~* '^PEOR' then 1 else 0 end) empeoraron,
       round(avg(variacion_pct), 1) variacion_promedio_pct,
       case when count(*) < 3 then 'pocas para juzgar' when sum(case when veredicto ~* '^MEJOR' then 1 else 0 end)::numeric / count(*) >= 0.66 then 'funciona en esta cuenta' when sum(case when veredicto ~* '^PEOR' then 1 else 0 end)::numeric / count(*) >= 0.5 then 'suele empeorar: revisar antes de repetir' else 'mixto' end veredicto
from t group by account, tipo order by account, n desc;

-- ---- 3. PROPUESTAS ESTRATEGICAS: las apuestas grandes, con hipotesis, numero esperado y como matarla ----
create table if not exists propuestas_estrategicas (
  id bigserial primary key,
  account text not null,
  fecha date not null default current_date,
  tipo text not null check (tipo in ('campana_nueva','cambio_tipo_campana','nuevo_embudo','test_estructurado','cambio_puja_estructural','nuevo_canal','landing','otro')),
  titulo text not null,
  hipotesis text not null,                  -- "si hacemos X, esperamos Y porque Z"
  resultado_esperado text not null,         -- con numero y plazo: "+8 conv/mes en 60 dias"
  costo_estimado text,                      -- presupuesto y tiempo
  riesgo text,                              -- que puede salir mal y cuanto
  como_probar_barato text,                  -- el test minimo que responde
  que_la_mata text not null,                -- la evidencia que la descarta
  fundamento_datos text,                    -- que dato de la cuenta la motiva
  fundamento_externo text,                  -- que conocimiento externo la apoya (id o fuente)
  estado text not null default 'propuesta' check (estado in ('propuesta','aprobada','en_test','adoptada','descartada','pausada')),
  decision_andres text, decidida_el date,
  resultado_real text, evaluada_el date,
  escrita_por text default 'opus-5-semanal',
  unique (account, titulo)
);
alter table propuestas_estrategicas enable row level security; revoke all on propuestas_estrategicas from anon, authenticated;
comment on table propuestas_estrategicas is 'Las apuestas grandes que el semanal propone con ambicion y logica: campana nueva, cambio de tipo, embudo, test. Cada una con hipotesis falsable, numero esperado, costo, riesgo, test minimo y que la mata. Andres aprueba; es una decision mayor que un accionable. Una por cuenta por semana como maximo; el mensual las revisa todas.';

-- ---- 4. OBJETIVO AMBICIOSO: no solo el CPA maximo, sino a donde queremos llegar en 90 dias ----
alter table account_targets add column if not exists conv_mes_objetivo_90d numeric;
alter table account_targets add column if not exists objetivo_90d_desde date;
alter table account_targets add column if not exists objetivo_90d_nota text;
comment on column account_targets.conv_mes_objetivo_90d is 'A cuantas conversiones/mes queremos llegar en 90 dias. Es la ambicion; el semanal mide la brecha y propone que la cierra.';

create or replace view v_brecha_objetivo as
with actual as (
  select account, sum(conversiones) conv_28d, sum(gasto) gasto_28d, sum(gasto) / nullif(sum(conversiones), 0) cpa_28d
  from v_serie_diaria where date >= current_date - 28 and madurez <> 'provisional' group by account
)
select t.account, t.conversiones_mes_objetivo conv_mes_objetivo, t.conv_mes_objetivo_90d, t.objetivo_90d_desde, t.cpa_maximo,
  round(a.conv_28d * 30.0 / 28, 1) conv_mes_actual, round(a.cpa_28d, 2) cpa_actual,
  round(coalesce(t.conv_mes_objetivo_90d, t.conversiones_mes_objetivo) - a.conv_28d * 30.0 / 28, 1) brecha_conv_mes,
  case when t.objetivo_90d_desde is not null then t.objetivo_90d_desde + 90 - current_date end dias_restantes,
  case when a.conv_28d * 30.0 / 28 >= coalesce(t.conv_mes_objetivo_90d, t.conversiones_mes_objetivo) then 'Objetivo alcanzado: subir la ambicion'
       when a.cpa_28d > t.cpa_maximo then 'CPA sobre el maximo: primero bajar costo, despues volumen'
       when coalesce(t.conv_mes_objetivo_90d, t.conversiones_mes_objetivo) - a.conv_28d * 30.0 / 28 > a.conv_28d * 30.0 / 28 * 0.5 then 'Brecha grande (>50%): no se cierra optimizando; hace falta algo estructural (campana, canal, embudo)'
       else 'Brecha cerrable con optimizacion: escalar lo que funciona' end lectura
from account_targets t left join actual a on a.account = t.account;
comment on view v_brecha_objetivo is 'Donde esta la cuenta contra a donde queremos llegar. Si la brecha supera 50%, optimizar no alcanza y el semanal tiene que proponer algo estructural.';

-- Semilla de objetivos ambiciosos (Andres los corrige)
update account_targets set conv_mes_objetivo_90d = 130, objetivo_90d_desde = '2026-09-07', objetivo_90d_nota = 'Semilla: +30% sobre el ritmo actual (~100/mes). Andres ajusta.' where account = 'KAREDO' and conv_mes_objetivo_90d is null;
update account_targets set conv_mes_objetivo_90d = 40, objetivo_90d_desde = '2026-09-07', objetivo_90d_nota = 'Semilla: 40 solicitudes/mes. El limite es el filtro del formulario y la landing, no el trafico.' where account = 'BHI' and conv_mes_objetivo_90d is null;
update account_targets set conv_mes_objetivo_90d = 25, objetivo_90d_desde = '2026-09-07', objetivo_90d_nota = 'Semilla: 25 formularios/mes; 15 En contacto en 30 dias habilita primaria.' where account = '360' and conv_mes_objetivo_90d is null;

-- ---- 5. Foto unica: lecciones, conocimiento vigente, brecha, propuestas ----
create or replace function get_estado_cuenta(p_account text) returns jsonb language sql stable security invoker set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object(
    'cuenta', p_account, 'foto_tomada', now(),
    'ultima_extraccion', (select jsonb_build_object('diaria', max(date), 'semanal', (select max(week_start) from campaign where account = p_account)) from campaign_daily where account = p_account),
    'plan_vigente', (select jsonb_build_object('id', id, 'semana', semana, 'contexto', contexto, 'indicadores', indicadores, 'hipotesis', hipotesis, 'condiciones_escalamiento', condiciones_escalamiento, 'escrito_el', escrito_el) from plan_semanal where account = p_account and semana <= current_date order by semana desc limit 1),
    'accionables_abiertos', accionables_vigentes(p_account),
    'accionables_hechos_14d', (select coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'ejecutado_el', ejecutado_el, 'entidad', entidad)), '[]') from accionables_espejo where account = p_account and estado = 'Hecho' and ejecutado_el >= current_date - 14),
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
  );
$$;

select 'ok', (select count(*) from conocimiento_externo) conocimiento, (select lectura from v_brecha_objetivo where account='KAREDO') brecha_karedo;;
