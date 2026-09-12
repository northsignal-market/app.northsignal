-- BUG DE SINCRONIA: campaign_dim corria a las 9:18 UTC leyendo solo la tabla semanal
-- `campaign`, pero la extraccion semanal corre los lunes a las 10:00 UTC. Una campana
-- nueva no entraba a la dimension hasta el dia siguiente, y la tarea semanal de las
-- 10:45 leia una dimension vieja: la campana aparecia sin local ni objetivo.
-- Arreglo: leer tambien la capa diaria (una campana nueva aparece ahi primero) y
-- refrescar otra vez despues de la extraccion semanal.
create or replace function campaign_dim_refrescar(p_account text default null) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
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
revoke execute on function campaign_dim_refrescar from anon, authenticated, public;

-- Segundo refresco los lunes, entre la extraccion semanal (10:00 UTC) y las tareas (10:45 UTC)
select cron.unschedule(jobid) from cron.job where jobname = 'campaign_dim_post_semanal';
select cron.schedule('campaign_dim_post_semanal', '20 10 * * 1', $$select campaign_dim_refrescar()$$);

-- Guardarrail: una campana con gasto que no esta en la dimension es un hueco silencioso
create or replace view v_campanas_sin_dim with (security_invoker = true) as
select c.account, c.campaign, round(sum(c.cost)::numeric, 2) gasto, max(c.week_start) ultima_semana
from campaign c left join campaign_dim d on d.account = c.account and d.campaign = c.campaign
where d.campaign is null group by 1, 2 having sum(c.cost) > 0;

select campaign_dim_refrescar() refrescadas, (select count(*) from v_campanas_sin_dim) huecos;;
