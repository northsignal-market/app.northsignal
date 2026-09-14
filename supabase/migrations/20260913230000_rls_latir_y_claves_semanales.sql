-- Tres arreglos verificados contra la base el 13/9/2026, en orden de riesgo.
-- Nada de esto se adivino: cada tabla, columna, funcion y conteo salio de pg_class,
-- pg_proc, pg_roles, cron.job e information_schema antes de escribirse.


-- ---------------------------------------------------------------------------
-- 1. RLS en las 11 tablas que quedaron afuera
-- ---------------------------------------------------------------------------
-- Son las unicas 11 tablas de `public` con relrowsecurity = false. Las otras 96 ya
-- tienen RLS prendido y CERO politicas, que es justamente el patron de esta casa:
-- deny-all para anon y authenticated, y el servidor entra con la service_role key,
-- que tiene rolbypassrls = true y no ve la barrera. Prueba de que no rompe nada:
-- `keywords` ya esta asi desde siempre y la app la lee sin problema.
--
-- Por eso NO se agregan politicas. Una politica aca seria abrir la puerta que
-- estamos cerrando.
--
-- Por que importa y no es higiene de advisor: `authenticated` tiene hoy
-- INSERT, UPDATE y DELETE sobre las 11 (grants verificados en
-- information_schema.role_table_grants; anon no tiene ninguno). Y `relaciones_verdad`
-- no guarda datos: guarda SQL. correr_relaciones() lee sql_izquierda, sql_derecha y
-- dominio_valido de esa tabla, les interpola la cuenta y los corre con EXECUTE. Esa
-- funcion es SECURITY INVOKER (prosecdef = false), y quien la invoca es el cron 42
-- —todos los dias a las 11:10 UTC— con username `postgres`, que tiene
-- rolbypassrls = true.
--
-- El camino completo, entonces: cualquiera con un JWT valido de este proyecto
-- inserta una fila activa en relaciones_verdad, y dentro de las 24 h el cron se la
-- ejecuta como postgres. No hace falta que tenga permiso sobre correr_relaciones():
-- el cron se la corre solo. Prender RLS corta eso de raiz.
alter table public.cifras_publicadas     enable row level security;
alter table public.contratos_columna     enable row level security;
alter table public.controles_de_ticket   enable row level security;
alter table public.corridas_verdad       enable row level security;
alter table public.demanda_mercado       enable row level security;
alter table public.drift_exento          enable row level security;
alter table public.incidentes_atendidos  enable row level security;
alter table public.metricas              enable row level security;
alter table public.patrones_drift        enable row level security;
alter table public.reconciliaciones_api  enable row level security;
alter table public.relaciones_verdad     enable row level security;

-- Ojo, precondicion operativa: esto es inocuo SOLO mientras el servidor entre con
-- service_role. src/server/lib/supabase.ts:4 cae a VITE_SUPABASE_ANON_KEY si falta
-- SUPABASE_SERVICE_ROLE_KEY, y con anon estas 11 tablas pasarian a devolver cero
-- filas en silencio, que es exactamente el modo de falla que este sistema caza.
-- No se toca esa linea aca porque es codigo y credenciales, no esquema.


-- ---------------------------------------------------------------------------
-- 2. latir() dejaba afuera de vigilancia a quien nunca tuvo exito
-- ---------------------------------------------------------------------------
-- En el INSERT ponia `en_vigilancia = p_ok`. Una tarea cuyo PRIMER latido es falla
-- nacia con en_vigilancia = false, y como el UPDATE hace `en_vigilancia or p_ok`,
-- false or false se queda en false para siempre: no vuelve a entrar sola.
-- v_tareas_en_silencio filtra por `where en_vigilancia`, asi que la tarea que mas
-- necesitamos ver —la que nunca funciono— es justo la que no se ve.
--
-- Hoy le pasa a revision_mensual (0 ok, 1 falla). Y le iba a pasar a demanda_mercado
-- el 3 de octubre: server.ts manda p_ok: ok > 0 y, sin Basic access al Keyword
-- Planner, ok es 0.
--
-- Cambia una sola cosa: `p_ok` por `true` en el INSERT. El resto queda igual.
create or replace function public.latir(p_tarea text, p_ok boolean default true, p_error text default null::text)
 returns void
 language sql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  insert into latidos (tarea, ultimo_ok, ultimo_intento, ultimo_error, corridas_ok, corridas_falla, en_vigilancia)
  values (p_tarea, case when p_ok then now() end, now(), case when not p_ok then p_error end,
          case when p_ok then 1 else 0 end, case when p_ok then 0 else 1 end, true)
  on conflict (tarea) do update set
    ultimo_ok = case when p_ok then now() else latidos.ultimo_ok end,
    ultimo_intento = now(), ultimo_error = case when p_ok then null else p_error end,
    corridas_ok = latidos.corridas_ok + case when p_ok then 1 else 0 end,
    corridas_falla = latidos.corridas_falla + case when p_ok then 0 else 1 end,
    en_vigilancia = latidos.en_vigilancia or p_ok;
$function$;

-- CREATE OR REPLACE conserva los permisos, pero se reafirman para que el archivo se
-- sostenga solo: si alguien lo corre contra una base limpia, latir() no puede quedar
-- ejecutable por PUBLIC. Es la misma decision del 12/9 (migracion revocar_execute_anon).
revoke execute on function public.latir(text, boolean, text) from public, anon, authenticated;
grant  execute on function public.latir(text, boolean, text) to service_role;

-- Rescate de las que ya quedaron escondidas por el bug: solo las que NUNCA tuvieron
-- una corrida buena. El filtro es fino a proposito. `etiquetador` tambien esta en
-- false, pero con 4 corridas ok y ultimo_ok cargado: a esa la silenciaron a mano, y
-- volver a prenderla seria pisarle la decision a alguien.
-- Hoy esto alcanza a una sola fila, revision_mensual, y la hace aparecer YA en
-- v_tareas_en_silencio como "nunca corrio" (la vista no espera la tolerancia cuando
-- ultimo_ok es null). Eso es lo que se pidio: que se vea. Si se prefiere no verla
-- hasta octubre, esta linea es la que hay que sacar.
-- Para revertir: update latidos set en_vigilancia = false where tarea = 'revision_mensual';
update latidos
   set en_vigilancia = true
 where ultimo_ok is null
   and corridas_ok = 0
   and not en_vigilancia;


-- ---------------------------------------------------------------------------
-- 3. Claves naturales de la capa semanal: tres se pueden, tres no
-- ---------------------------------------------------------------------------
-- Las diarias tienen unique (uq_campaign_daily, uq_keywords_daily, etc.) y las
-- semanales no. Se reviso duplicado por duplicado antes de agregar nada, y la
-- conclusion no es pareja: en tres tablas no hay duplicados y el indice entra; en
-- las otras tres los duplicados NO son basura repetida, son filas distintas que la
-- clave no alcanza a distinguir. Ahi el problema no es el dato: es la clave.
--
-- Se usa NULLS NOT DISTINCT (hay PostgreSQL 17.6) porque todas estas columnas son
-- nullable. Con la semantica por defecto, dos NULL cuentan como distintos y el
-- indice dejaria pasar el duplicado sin decir nada. negatives lo necesita de verdad:
-- 818 de sus 1066 filas tienen ad_group en NULL porque son negativas de cuenta o de
-- campana.

-- campaign — 1144 filas, 0 duplicados.
-- Lleva plataforma, a diferencia de uq_campaign_daily, que no la incluye. Es una
-- divergencia deliberada: plataforma es NOT NULL y su enum ya tiene 'google' y
-- 'meta'. El mismo nombre de campana en dos plataformas es legitimo; sin plataforma
-- en la clave, el dia que entre Meta el indice lo rechaza como si fuera un error.
create unique index if not exists uq_campaign_semanal
  on public.campaign (account, week_start, campaign, plataforma) nulls not distinct;

-- keywords — 15288 filas, 0 duplicados. Espeja uq_keywords_daily cambiando date por
-- week_start. Se descarto criterion_id: da 1521 claves repetidas, o sea que no
-- identifica la fila.
create unique index if not exists uq_keywords_semanal
  on public.keywords (account, week_start, campaign, ad_group, keyword, match_type) nulls not distinct;

-- negatives — 1066 filas, 0 duplicados. No tiene par diario; la clave sale de sus
-- columnas: el nivel importa porque la misma negativa puede existir en cuenta y en
-- campana a la vez y son dos cosas distintas.
create unique index if not exists uq_negatives_semanal
  on public.negatives (account, week_start, level, campaign, ad_group, negative_keyword, match_type) nulls not distinct;

-- NO se agregan los tres que faltan, y el motivo de cada uno es distinto:
--
-- adgroup — 13 claves duplicadas con (account, week_start, campaign, ad_group).
--   Las dos filas de cada par salen de la misma corrida y traen las mismas metricas,
--   pero difieren en ad_group_status (una ENABLED, otra PAUSED). No es doble insert:
--   son dos grupos distintos de Google con el mismo nombre adentro de la misma
--   campana. El nombre de grupo no es unico en Google Ads, el id si, y esta tabla no
--   guarda ad_group_id. Con las columnas que hay no se puede escribir la clave.
--
-- search_terms — 8 claves duplicadas con (account, week_start, campaign, ad_group,
--   search_term, match_type, triggered_keyword). Aca es peor: las filas traen
--   metricas completamente distintas. En KAREDO, semana del 8/6, el par es
--   2 impresiones / 0,01 EUR contra 620 impresiones / 100,49 EUR / 16,24
--   conversiones. Google las separa por algo que esta tabla no guarda. Deduplicar
--   seria tirar 100 EUR de gasto y 16 conversiones reales.
--
-- weekly_brief — 44 claves duplicadas con (account, week_start, section, item), y
--   no es un bug: no es una tabla con clave, es una lista. FRESH_MONKEE, semana del
--   31/8, section 'alertas_alta', item 'Conversiones bajo umbral' son 21 filas con
--   21 detalles distintos, o sea 21 alertas. Cualquier unique aca borraria alertas.
--
-- Lo que cambia para el script semanal: hoy hace DELETE por semana + INSERT plano
-- (solo CHANGE_EVENTS declara UPSERT_KEYS en northsignal_semanal_v11.js). Con estos
-- tres indices, el dia que Google devuelva dos filas que colapsen en la misma clave,
-- la corrida corta con 409 en vez de duplicar callada. Es lo que se busca, pero
-- conviene declarar estas claves en UPSERT_KEYS para que mergee en lugar de abortar.
