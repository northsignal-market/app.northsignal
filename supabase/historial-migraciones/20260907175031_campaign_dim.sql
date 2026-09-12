-- ================================================================
-- DIMENSION DE CAMPANA (patron de dimension, el mismo que Search Ads 360 llama
-- "custom dimension"). resolver_campana() cuesta 1,67 ms por llamada; llamarla
-- por fila sobre 35.771 terminos son casi 60 segundos. La resolucion es por
-- campana, no por fila: se calcula una vez y se guarda.
-- ================================================================
create table if not exists campaign_dim (
  account text not null,
  campaign text not null,
  location text,
  objetivo text not null default 'generico',
  tipo_campana text,
  patron text,
  resuelto_el timestamptz default now(),
  primary key (account, campaign)
);
alter table campaign_dim enable row level security; revoke all on campaign_dim from anon, authenticated;
create index if not exists idx_campaign_dim_loc on campaign_dim (account, location);
create index if not exists idx_campaign_dim_obj on campaign_dim (account, objetivo);
comment on table campaign_dim is 'Cada campana resuelta a local, objetivo y tipo. Se recalcula despues de cada extraccion y cuando cambia campaign_mapa o locations. Las vistas hacen JOIN contra esto en vez de llamar resolver_campana por fila.';

create or replace function campaign_dim_refrescar(p_account text default null) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0;
begin
  insert into campaign_dim (account, campaign, location, objetivo, tipo_campana, patron, resuelto_el)
  select c.account, c.campaign, r->>'location', coalesce(r->>'objetivo','generico'), r->>'tipo', r->>'patron', now()
  from (select distinct account, campaign from campaign where p_account is null or account = p_account) c,
       lateral resolver_campana(c.account, c.campaign) r
  on conflict (account, campaign) do update set
    location = excluded.location, objetivo = excluded.objetivo,
    tipo_campana = excluded.tipo_campana, patron = excluded.patron, resuelto_el = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function campaign_dim_refrescar from anon, authenticated, public;
select campaign_dim_refrescar() campanas_resueltas;;
