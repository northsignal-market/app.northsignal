-- ================================================================
-- VERSIONES: cada cambio en un accionable crea una version con diff. Nada se sobreescribe.
-- El agente edita la entidad; el sistema escribe el historial; el agente no puede tocarlo.
-- ================================================================
create table if not exists accionable_versiones (
  id bigserial primary key,
  notion_id text not null,
  version int not null,
  fecha timestamptz default now(),
  autor text,                                -- quien lo edito: opus-5-semanal, pulso, andres, reconciliador, app
  diff jsonb not null,                       -- {campo: {antes, despues}}
  motivo text,                               -- el comentario [vN] que dejo el agente, si lo dejo
  hash text not null,
  unique (notion_id, version)
);
create index if not exists idx_versiones_notion on accionable_versiones (notion_id, version desc);
alter table accionable_versiones enable row level security; revoke all on accionable_versiones from anon, authenticated;
comment on table accionable_versiones is 'Historial de cada accionable: version, fecha, autor, diff por campo, motivo. Lo escribe el server al sincronizar (hash de titulo+por_que+accion+como_hacerlo+entidad+prioridad). El agente edita en Notion; esto lo registra. Append-only.';
alter table accionables_espejo add column if not exists hash text;
alter table accionables_espejo add column if not exists version int default 1;

-- ================================================================
-- RELACIONES ENTRE ACCIONABLES: conflictos, dependencias, causa compartida
-- ================================================================
create table if not exists accionable_relaciones (
  id bigserial primary key,
  account text not null,
  a text not null, b text not null,           -- notion_ids; a -> b
  tipo text not null check (tipo in ('conflicta_con','depende_de','comparte_causa','reemplaza','bloquea_keyword')),
  regla text not null,                        -- que regla lo detecto
  motivo text not null,                       -- legible para Andres
  severidad text not null default 'bloquea' check (severidad in ('bloquea','avisa')),
  detectada timestamptz default now(),
  resuelta boolean default false, resuelta_el timestamptz, resuelta_por text,
  unique (a, b, tipo, regla)
);
create index if not exists idx_rel_abiertas on accionable_relaciones (account, resuelta) where not resuelta;
alter table accionable_relaciones enable row level security; revoke all on accionable_relaciones from anon, authenticated;
comment on table accionable_relaciones is 'Grafo entre accionables. bloquea = no se ejecuta uno mientras el otro este abierto; avisa = se muestra. Lo escribe detectar_conflictos() cada manana y antes de cada ejecucion (pre-vuelo).';

-- Reglas literales de Google para negativas: EXACT identico; PHRASE secuencia ordenada dentro; BROAD todas las palabras en cualquier orden
create or replace function negativa_bloquea(p_negativa text, p_match text, p_keyword text) returns boolean language sql immutable as $$
  select case
    when p_match = 'EXACT' then normalizar_entidad(p_negativa) = normalizar_entidad(p_keyword)
    when p_match = 'PHRASE' then position(' ' || normalizar_entidad(p_negativa) || ' ' in ' ' || normalizar_entidad(p_keyword) || ' ') > 0
    else not exists (select 1 from unnest(string_to_array(normalizar_entidad(p_negativa), ' ')) w where position(' ' || w || ' ' in ' ' || normalizar_entidad(p_keyword) || ' ') = 0)
  end;
$$;

create or replace function detectar_conflictos() returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
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
end $$;
revoke execute on function detectar_conflictos from anon, authenticated, public;

-- Pre-vuelo: puede ejecutarse este accionable ahora? Devuelve null si si, o el motivo si no.
create or replace function prevuelo(p_notion_id text) returns text language sql stable security invoker set search_path = public, pg_temp as $$
  select string_agg(motivo, ' | ') from accionable_relaciones
  where not resuelta and severidad = 'bloquea' and (a = p_notion_id or b = p_notion_id);
$$;

-- Vista para la app: relaciones de un accionable con titulos
create or replace view v_accionable_relaciones as
select r.*, ea.titulo titulo_a, coalesce(eb.titulo, replace(r.b, 'keyword:', 'keyword activa: ')) titulo_b
from accionable_relaciones r left join accionables_espejo ea on ea.notion_id = r.a left join accionables_espejo eb on eb.notion_id = r.b;

select cron.unschedule(jobid) from cron.job where jobname = 'detectar_conflictos';
select cron.schedule('detectar_conflictos', '37 9 * * *', $$select detectar_conflictos()$$);
select detectar_conflictos();;
