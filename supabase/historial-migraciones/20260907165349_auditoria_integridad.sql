-- ================================================================
-- AUDITORIA DE INTEGRIDAD: las verificaciones que se hicieron a mano, automatizadas.
-- Corre cada manana. Si algo falla, es una alerta, no un descubrimiento de meses despues.
-- ================================================================
create or replace function auditar_integridad() returns table (prueba text, cuenta text, estado text, detalle text)
language sql stable security invoker set search_path = public, pg_temp as $$
  -- 1. Contagio entre cuentas: la misma entidad bajo dos cuentas
  select 'contagio_entidades', coalesce(cuentas, '-'), 'FALLA',
         'La campana "' || entidad || '" aparece en: ' || cuentas
  from (select campaign entidad, string_agg(distinct account, ', ') cuentas from campaign group by 1 having count(distinct account) > 1) x
  union all
  select 'contagio_keywords', cuentas, 'FALLA', 'La keyword "' || entidad || '" aparece en: ' || cuentas
  from (select campaign || ' > ' || keyword entidad, string_agg(distinct account, ', ') cuentas from keywords group by 1 having count(distinct account) > 1) x

  -- 2. Semanal vs diario: las dos capas tienen que cuadrar en semanas completas
  union all
  select 'semanal_vs_diario', w.account,
         case when abs(w.g - d.g) < greatest(1, w.g * 0.01) then 'OK' else 'FALLA' end,
         'Semana ' || w.week_start || ': semanal ' || round(w.g, 2) || ' vs diario ' || round(d.g, 2) || ' (dif ' || round(abs(w.g - d.g), 2) || ')'
  from (select account, week_start, sum(cost)::numeric g from campaign group by 1,2) w
  join (select account, (date - ((extract(dow from date)::int + 6) % 7))::date ws, count(distinct date) dias, sum(cost)::numeric g from campaign_daily group by 1,2) d
    on d.account = w.account and d.ws = w.week_start and d.dias = 7

  -- 3. Jerarquia: los grupos no pueden gastar mas que su campana
  union all
  select 'jerarquia_grupos', c.account, case when g.g <= c.g * 1.01 then 'OK' else 'FALLA' end,
         'Ultima semana: campanas ' || round(c.g, 2) || ' vs grupos ' || round(g.g, 2)
  from (select c.account, sum(c.cost)::numeric g from campaign c where c.week_start = (select max(week_start) from campaign c2 where c2.account = c.account) group by 1) c
  join (select a.account, sum(a.cost)::numeric g from adgroup a where a.week_start = (select max(week_start) from adgroup a2 where a2.account = a.account) group by 1) g on g.account = c.account

  -- 4. Mapeo de cadena: la suma por objetivo tiene que igualar el total
  union all
  select 'mapeo_objetivos', c.account, case when abs(c.g - o.g) < 0.02 then 'OK' else 'FALLA' end,
         'Total ' || round(c.g, 2) || ' vs suma por objetivo ' || round(o.g, 2)
  from (select c.account, sum(c.cost)::numeric g from campaign c where c.week_start = (select max(week_start) from campaign c2 where c2.account = c.account) group by 1) c
  join (select v.account, sum(v.gasto)::numeric g from v_por_objetivo_semanal v where v.week_start = (select max(week_start) from campaign c2 where c2.account = v.account) group by 1) o on o.account = c.account
  where c.account in (select account from cuentas where perfil_analisis = 'cadena')

  -- 5. Objetivos usados en el mapa que no tienen definicion
  union all
  select 'definicion_objetivos', account, 'FALLA', lectura from v_integridad_mapeo where not tiene_definicion and objetivo <> 'generico'

  -- 6. Frescura: la extraccion diaria no puede tener mas de 2 dias de atraso
  union all
  select 'frescura_diaria', account, case when current_date - max(date) <= 2 then 'OK' else 'FALLA' end,
         'Ultimo dia: ' || max(date) || ' (' || (current_date - max(date)) || ' dias de atraso)'
  from campaign_daily group by account

  -- 7. Pulso: no puede estar mas de 2 dias sin correr
  union all
  select 'pulso_al_dia', c.account,
         case when p.ultimo is null then 'FALLA' when current_date - p.ultimo <= 2 then 'OK' else 'FALLA' end,
         coalesce('Ultimo pulso: ' || p.ultimo, 'Nunca corrio')
  from cuentas c left join (select account, max(fecha) ultimo from pulso_diario group by 1) p on p.account = c.account
  where c.activa;
$$;
comment on function auditar_integridad is 'Las verificaciones de integridad hechas a mano el 7 de septiembre, automatizadas. Contagio entre cuentas, cuadre semanal contra diario, jerarquia de gasto, mapeo de objetivos, frescura y pulso al dia.';

create or replace function alertas_integridad() returns int language plpgsql security definer set search_path = public, pg_temp as $$
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
revoke execute on function alertas_integridad from anon, authenticated, public;
select cron.unschedule(jobid) from cron.job where jobname = 'auditoria_integridad';
select cron.schedule('auditoria_integridad', '32 9 * * *', $$select alertas_integridad()$$);
select prueba, cuenta, estado, detalle from auditar_integridad() order by estado, prueba, cuenta;;
