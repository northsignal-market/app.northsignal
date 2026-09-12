-- Las fechas ahora vienen del diario, en config_snapshot. Mas fresco y para todas las cuentas.
create or replace function campaign_fechas_sincronizar() returns int language plpgsql security definer set search_path = public, pg_temp as $$
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
revoke execute on function campaign_fechas_sincronizar from anon, authenticated, public;
select campaign_fechas_sincronizar();;
