-- CAPA DE METRICAS. Tres piezas: catalogo que documenta, funcion canonica que calcula,
-- y linter que detecta a quien la reescribe. La tercera es la que hace que se cumpla:
-- sin ella la canonica existe y nadie la usa, porque es mas rapido escribir la suma.
--
-- Motivo medido el 9 sep 2026: la ventana de 30 dias estaba escrita inline en cuatro
-- vistas y la de 90 en dos. conv_30d daba bien en v_decision_estructural y mal en
-- v_headroom porque cada una invento su propia ventana.

create table if not exists public.metricas (
  nombre       text primary key,
  que_mide     text not null,
  funcion      text not null,
  ventana      text not null,
  fuente       text not null,
  unidad       text not null,
  cuidado      text,
  revisada_el  date not null default current_date,
  vigente      boolean not null default true
);

comment on table public.metricas is
  'Definicion unica de cada metrica. revisada_el existe porque una definicion sin revisar tambien envejece: es frescura semantica, no estructural. Si una vista calcula una de estas inline en vez de llamar a la funcion, aparece en v_metricas_reescritas.';

-- ---------------------------------------------------------------
-- LA VENTANA es la que mas drifteo, asi que es la primera canonica.
-- Devuelve la ventana REAL, no la pedida: esa diferencia es el ticket 37.
create or replace function public.ventana_metrica(p_account text, p_tipo text default 'semanal_4')
returns table (desde date, hasta date, dias int, semanas int, fuente text, honesta boolean)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select * from (
    -- 4 semanas COMPLETAS de la tabla semanal. Es la fuente para volumen y retrospectiva:
    -- la capa diaria tiene 15 a 17 dias y devolver eso etiquetado "30d" fue el ticket 37.
    select min(c.week_start) as desde,
           max(c.week_start) + 6 as hasta,
           (count(distinct c.week_start) * 7)::int as dias,
           count(distinct c.week_start)::int as semanas,
           'campaign (semanal)'::text as fuente,
           count(distinct c.week_start) >= 3 as honesta
      from campaign c
     where p_tipo = 'semanal_4'
       and c.account = p_account
       and c.week_start > (select max(week_start) from campaign c2 where c2.account = p_account) - 28
    union all
    -- La capa diaria, con los dias que REALMENTE tiene. Nunca asumir 30.
    select min(d.date), max(d.date), count(distinct d.date)::int,
           (count(distinct d.date) / 7)::int, 'campaign_daily (diaria)'::text,
           count(distinct d.date) >= 14
      from campaign_daily d
     where p_tipo = 'diaria_real' and d.account = p_account
    union all
    select min(c.week_start), max(c.week_start) + 6,
           (count(distinct c.week_start) * 7)::int, count(distinct c.week_start)::int,
           'campaign (semanal, 13 semanas)'::text, count(distinct c.week_start) >= 8
      from campaign c
     where p_tipo = 'trimestre' and c.account = p_account
       and c.week_start > current_date - 91
  ) q
  where q.desde is not null;
$$;

comment on function public.ventana_metrica(text, text) is
  'Ventana REAL de una cuenta, no la pedida. honesta=false significa que no hay historia suficiente para sostener un veredicto sobre esa ventana. Toda vista que necesite una ventana llama a esto en vez de escribir current_date - N.';

-- ---------------------------------------------------------------
-- CONVERSIONES: la fuente es campaign, nunca la suma de acciones, porque el doble conteo
-- entre acciones es real (BHI 2,4x) y campaign.conversions ya es la columna que Google
-- usa para la subasta. Verificado el 8 sep: coinciden exactamente en las cuatro cuentas.
create or replace function public.metrica_conversiones(p_account text, p_tipo text default 'semanal_4')
returns numeric language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select round(coalesce(sum(c.conversions), 0)::numeric, 1)
    from campaign c, ventana_metrica(p_account, p_tipo) v
   where c.account = p_account and c.week_start between v.desde and v.hasta;
$$;

create or replace function public.metrica_gasto(p_account text, p_tipo text default 'semanal_4')
returns numeric language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select round(coalesce(sum(c.cost), 0)::numeric, 2)
    from campaign c, ventana_metrica(p_account, p_tipo) v
   where c.account = p_account and c.week_start between v.desde and v.hasta;
$$;

-- CPA: null cuando no hay conversiones. Un CPA sobre cero conversiones no es infinito,
-- es desconocido, y devolver un numero ahi es exactamente el tipo de mentira verosimil
-- que este sistema tiene que dejar de producir.
create or replace function public.metrica_cpa(p_account text, p_tipo text default 'semanal_4')
returns numeric language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select round(metrica_gasto(p_account, p_tipo) / nullif(metrica_conversiones(p_account, p_tipo), 0), 2);
$$;

insert into public.metricas (nombre, que_mide, funcion, ventana, fuente, unidad, cuidado) values
('ventana', 'La ventana real de datos de una cuenta, no la pedida',
 'ventana_metrica(cuenta, tipo)', 'segun tipo', 'campaign o campaign_daily', 'dias',
 'honesta=false significa que no alcanza la historia para un veredicto. La capa diaria tiene 15 a 17 dias: cualquier vista que diga "30 dias" sobre ella miente.'),
('conversiones', 'Conversiones de la columna Conversiones de Google',
 'metrica_conversiones(cuenta, tipo)', '4 semanas completas por defecto', 'campaign', 'conversiones',
 'NO sumar conversion_actions: en BHI hay doble conteo entre acciones (factor 2,4). campaign.conversions ya es lo que Google usa. Verificado 8 sep 2026: coinciden en las cuatro cuentas.'),
('gasto', 'Gasto en la moneda de la cuenta', 'metrica_gasto(cuenta, tipo)',
 '4 semanas completas por defecto', 'campaign', 'moneda de la cuenta',
 'El gasto de ayer ya es definitivo; las conversiones no. No comparar un CPA de ayer con uno de hace dos semanas.'),
('cpa', 'Costo por conversion', 'metrica_cpa(cuenta, tipo)',
 '4 semanas completas por defecto', 'campaign', 'moneda de la cuenta',
 'Devuelve NULL con cero conversiones, a proposito. En FRESH_MONKEE el CPA de cuenta no significa nada porque mezcla objetivos: usar por campana.')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------
-- EL LINTER. Es la pieza que hace cumplir todo lo anterior.
create table if not exists public.patrones_drift (
  patron    text primary key,
  metrica   text not null references public.metricas(nombre),
  por_que   text not null,
  exentos   text[] not null default '{}'
);

insert into public.patrones_drift (patron, metrica, por_que, exentos) values
('%current_date - 30%', 'ventana',
 'Ventana de 30 dias escrita a mano. La capa diaria tiene 15 a 17 dias: sumar sobre ella y llamarlo 30d es el ticket 37. Llamar a ventana_metrica().',
 array['v_ventana_real']),
('%current_date - 90%', 'ventana',
 'Ventana de 90 dias escrita a mano. Usar ventana_metrica(cuenta, ''trimestre'').',
 array['v_ventana_real']),
('%sum(cost)%/%nullif(sum(conversions)%', 'cpa',
 'CPA calculado inline. Llamar a metrica_cpa(), que devuelve NULL con cero conversiones en vez de un numero inventado.',
 '{}'),
('%sum(ca.conversions)%', 'conversiones',
 'Conversiones sumadas desde conversion_actions. En BHI eso da 2,4x por doble conteo entre acciones. La fuente es campaign.',
 array['v_primarias_solapadas'])
on conflict (patron) do nothing;

create or replace view public.v_metricas_reescritas as
select c.relname as objeto,
       p.metrica,
       p.por_que,
       m.funcion as usar_en_su_lugar,
       case c.relkind when 'v' then 'vista' when 'm' then 'materializada' else 'funcion' end as tipo
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join patrones_drift p
  join metricas m on m.nombre = p.metrica
 where n.nspname = 'public'
   and c.relkind in ('v', 'm')
   and c.relname <> all (p.exentos)
   and c.relname not like 'v_metricas%'
   and lower(pg_get_viewdef(c.oid)) like lower(p.patron);

comment on view public.v_metricas_reescritas is
  'Vistas que calculan una metrica inline en vez de llamar a su funcion canonica. Es el linter de semantic drift: sin el, la metrica canonica existe y nadie la usa, porque siempre es mas rapido escribir la suma. exentos en patrones_drift es para los objetos cuyo trabajo ES medir la ventana cruda.';;
