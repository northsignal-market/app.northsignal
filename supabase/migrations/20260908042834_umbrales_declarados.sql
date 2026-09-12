-- ============================================================
-- UMBRALES DECLARADOS POR LOS SCRIPTS
-- ============================================================
-- Los scripts de Google Ads tienen sus umbrales cableados y nadie los contrasta
-- contra Supabase. Fresh Monkee tenia TODOS en cero desde su alta: el centinela
-- corria cada 4 horas y no podia alertar nada salvo un pico de gasto.
--
-- Cada script declara sus umbrales al latir. Si se separan de la base, se ve.
-- ============================================================
create table if not exists umbrales_de_scripts (
  account text not null,
  script text not null,
  umbral text not null,
  valor numeric,
  declarado_el timestamptz default now(),
  primary key (account, script, umbral)
);
alter table umbrales_de_scripts enable row level security; revoke all on umbrales_de_scripts from anon, authenticated;
comment on table umbrales_de_scripts is 'Umbrales que cada script tiene cableados. Los declara al correr. Existe para contrastar contra cuentas: un umbral en cero es un centinela que no alerta, y hasta hoy no habia forma de verlo.';

create or replace function declarar_umbral(p_account text, p_script text, p_umbral text, p_valor numeric)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into umbrales_de_scripts (account, script, umbral, valor, declarado_el)
  values (p_account, p_script, p_umbral, p_valor, now())
  on conflict (account, script, umbral) do update set valor = excluded.valor, declarado_el = now();
$$;
revoke execute on function declarar_umbral from anon, authenticated;

create or replace view v_umbrales_inconsistentes with (security_invoker = true) as
select u.account, u.script, u.umbral, u.valor valor_en_script,
  case u.umbral
    when 'dailyBudget' then c.presupuesto_diario
    when 'spendSpikeFactor' then c.pico_gasto_factor
    when 'noConvMinSpend' then c.sin_conv_min_gasto
  end valor_en_supabase,
  case
    when coalesce(u.valor, 0) = 0 then 'Umbral en CERO: el script no puede alertar por este motivo. Cargarle un valor con sentido o sacarlo.'
    else 'El script dice ' || u.valor || ' y Supabase dice ' ||
      coalesce((case u.umbral when 'dailyBudget' then c.presupuesto_diario when 'spendSpikeFactor' then c.pico_gasto_factor when 'noConvMinSpend' then c.sin_conv_min_gasto end)::text, 'nada') ||
      '. El que manda es Supabase: corregir el script.' end lectura
from umbrales_de_scripts u join cuentas c on c.account = u.account
where c.activa and (
  coalesce(u.valor, 0) = 0
  or (u.umbral = 'dailyBudget' and u.valor is distinct from c.presupuesto_diario)
  or (u.umbral = 'spendSpikeFactor' and u.valor is distinct from c.pico_gasto_factor)
  or (u.umbral = 'noConvMinSpend' and u.valor is distinct from c.sin_conv_min_gasto));

select 1;;
