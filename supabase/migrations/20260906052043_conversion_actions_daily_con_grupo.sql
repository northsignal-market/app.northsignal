-- Agregar ad_group a conversion_actions_daily. La clave unica cambia para incluirlo.
alter table conversion_actions_daily add column if not exists ad_group text;

-- Reemplazar la clave unica
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'conversion_actions_daily'::regclass and contype = 'u' loop
    execute 'alter table conversion_actions_daily drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;
drop index if exists uq_conversion_actions_daily;
create unique index uq_conversion_actions_daily on conversion_actions_daily (account, date, campaign, coalesce(ad_group,''), conversion_action, category);

-- Vista de conversiones por grupo y dia: responde "en que grupo cayeron las conversiones"
create or replace view v_conversiones_por_grupo as
select account, date, campaign, ad_group, conversion_action, category, conversions, madurez_dato(date) as madurez
from conversion_actions_daily where ad_group is not null;

comment on view v_conversiones_por_grupo is 'Conversiones diarias por grupo de anuncios y accion. Se llena desde la corrida del script diario v3 en adelante; las filas anteriores no tienen grupo. Responde si un deterioro de conversiones es de un grupo especifico o de toda la cuenta.';

comment on column conversion_actions_daily.ad_group is 'Grupo de anuncios. NULL en filas cargadas antes del 6 sep 2026 (script v2 extraia por campana). Desde v3, siempre presente.';

select 'listo' as ok;;
