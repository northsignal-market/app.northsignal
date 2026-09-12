-- ================================================================
-- 1. GRUPOS DE REPORTE: un local puede reportarse solo o dentro de un consolidado
-- ================================================================
create table if not exists grupos_reporte (
  id bigserial primary key,
  account text not null,
  codigo text not null,                      -- 'CORP_CT'
  nombre text not null,                      -- 'Corporativo Connecticut'
  tipo text not null default 'consolidado' check (tipo in ('consolidado','individual')),
  destinatarios text,
  nota text,
  unique (account, codigo)
);
alter table grupos_reporte enable row level security; revoke all on grupos_reporte from anon, authenticated;
comment on table grupos_reporte is 'Agrupacion para el reporte. Un local con grupo_reporte no recibe reporte individual: entra en el consolidado del grupo. Los que no tienen grupo reportan solos.';

alter table locations add column if not exists grupo_reporte text;
alter table locations add column if not exists paga_publicidad text;   -- 'franquiciado' | 'corporativo' | 'propietario'
alter table locations add column if not exists reporta_individual boolean default true;
comment on column locations.grupo_reporte is 'Codigo de grupos_reporte. Si esta, el local NO recibe reporte individual.';

insert into grupos_reporte (account, codigo, nombre, tipo, nota) values
  ('FRESH_MONKEE', 'CORP_CT', 'Corporativo Connecticut', 'consolidado', 'Southington, Glastonbury, Wethersfield y Berlin. En Meta van consolidados en AO_PC_Corp-CT_OnlineOrders; en Google tienen campanas _OP individuales pero se suman para el reporte corporativo. Nunca reciben correo de franquiciado.'),
  ('FRESH_MONKEE', 'PABLO', 'Locales de Pablo Vidal', 'individual', 'Austin es el local de Pablo. No recibe correo de franquiciado porque el destinatario es el mismo Pablo.')
on conflict (account, codigo) do nothing;

insert into locations (account, codigo, nombre, ciudad, region, grupo_reporte, paga_publicidad, reporta_individual) values
  ('FRESH_MONKEE','Southington','Southington','Southington','CT','CORP_CT','corporativo',false),
  ('FRESH_MONKEE','Glastonbury','Glastonbury','Glastonbury','CT','CORP_CT','corporativo',false),
  ('FRESH_MONKEE','Wethersfield','Wethersfield','Wethersfield','CT','CORP_CT','corporativo',false),
  ('FRESH_MONKEE','Berlin','Berlin','Berlin','CT','CORP_CT','corporativo',false),
  ('FRESH_MONKEE','Austin','Austin','Austin','TX','PABLO','propietario',false)
on conflict (account, codigo) do update set grupo_reporte = excluded.grupo_reporte, paga_publicidad = excluded.paga_publicidad, reporta_individual = excluded.reporta_individual;

-- Como se reporta: por grupo cuando hay grupo, por local cuando no
create or replace view v_reporte_unidades with (security_invoker = true) as
select l.account,
  coalesce(g.codigo, l.codigo) unidad,
  coalesce(g.nombre, l.nombre) nombre,
  case when g.codigo is null then 'local' else g.tipo end nivel,
  coalesce(g.destinatarios, null) destinatarios,
  array_agg(l.codigo order by l.codigo) locales,
  count(*) n_locales
from locations l left join grupos_reporte g on g.account = l.account and g.codigo = l.grupo_reporte
where l.activa group by l.account, coalesce(g.codigo, l.codigo), coalesce(g.nombre, l.nombre), case when g.codigo is null then 'local' else g.tipo end, g.destinatarios;

-- ================================================================
-- 2. FECHAS DE CAMPANA: ENABLED con fecha de fin pasada = FINALIZADA, no rota
-- ================================================================
create table if not exists campaign_fechas (
  account text not null, campaign text not null,
  start_date date, end_date date, estado_google text, estado_real text,
  actualizado timestamptz default now(),
  primary key (account, campaign)
);
alter table campaign_fechas enable row level security; revoke all on campaign_fechas from anon, authenticated;
comment on table campaign_fechas is 'Fechas de inicio y fin por campana. estado_real: FINALIZADA si ENABLED con end_date pasada; PROGRAMADA si start_date futura. Google deja el estado en ENABLED aunque la campana ya no entregue: sin esto, una campana terminada parece rota.';

-- Leer desde account_state (lo que ya escribe el script)
create or replace function campaign_fechas_sincronizar() returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0;
begin
  insert into campaign_fechas (account, campaign, start_date, end_date, estado_google, estado_real, actualizado)
  select a.account, a.item,
    nullif((regexp_match(a.detail, 'desde (\d{4}-\d{2}-\d{2})'))[1], '')::date,
    nullif((regexp_match(a.detail, 'hasta (\d{4}-\d{2}-\d{2})'))[1], '')::date,
    case when a.value in ('FINALIZADA','PROGRAMADA') then 'ENABLED' else a.value end,
    a.value, now()
  from account_state a
  where a.section = 'campanas' and a.run_ts = (select max(run_ts) from account_state a2 where a2.account = a.account)
  on conflict (account, campaign) do update set start_date = excluded.start_date, end_date = excluded.end_date, estado_google = excluded.estado_google, estado_real = excluded.estado_real, actualizado = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function campaign_fechas_sincronizar from anon, authenticated, public;

-- Alerta que SI importa: campana vigente que sigue gastando despues de su fecha de fin,
-- o campana que arranca en menos de 3 dias y no tiene presupuesto.
create or replace function alertas_fechas_campana() returns int language plpgsql security definer set search_path = public, pg_temp as $$
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
revoke execute on function alertas_fechas_campana from anon, authenticated, public;
select cron.unschedule(jobid) from cron.job where jobname = 'fechas_campana';
select cron.schedule('fechas_campana', '28 9 * * *', $$select campaign_fechas_sincronizar(); select alertas_fechas_campana();$$);
select * from v_reporte_unidades where account = 'FRESH_MONKEE';;
