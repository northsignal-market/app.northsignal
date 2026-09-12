-- v_umbrales_inconsistentes devolvia cero filas y el tablero decia "0 umbrales apagados",
-- mientras northsignal_semanal tenia FRESH_MONKEE con kwSpendNoConv en 0, usado en las
-- lineas 619 y 708 para alertar. Dos motivos, los dos estructurales:
--   a) declararUmbrales() manda p_script='centinela' cableado y solo lo llama el centinela.
--      El semanal y el diario nunca declararon nada, asi que sus umbrales son invisibles.
--   b) La vista solo tenia columna de referencia para 3 de los 6 umbrales declarados;
--      los otros 3 caian en ELSE NULL y no se comparaban nunca.
-- Un chequeo que no puede fallar se ve igual que uno que pasa. Ahora la AUSENCIA de
-- declaracion es un hallazgo.
-- No se fuerza un valor unico por umbral en cuentas: el kwSpendNoConv del semanal es
-- semanal y el del centinela es diario, son legitimamente distintos. Se audita que cada
-- script declare, que ninguno este en cero, y que los tres canonicos coincidan.

create table if not exists public.umbrales_esperados (
  script text not null,
  umbral text not null,
  ventana text not null,
  canonico_en_cuentas text,
  primary key (script, umbral)
);

comment on table public.umbrales_esperados is
  'Que umbral tiene que declarar cada script. Si un script no declara, v_umbrales_inconsistentes lo reporta. Sin esto, los umbrales cableados de un script que no llama a declarar_umbral son invisibles para la auditoria, que es como FRESH_MONKEE siguio con ceros en el semanal despues de que fix-v82 los corrigiera solo en el centinela.';

insert into public.umbrales_esperados (script, umbral, ventana, canonico_en_cuentas) values
  ('centinela','dailyBudget','dia','presupuesto_diario'),
  ('centinela','spendSpikeFactor','dia','pico_gasto_factor'),
  ('centinela','noConvMinSpend','dia','sin_conv_min_gasto'),
  ('centinela','cpaMax','dia',null),
  ('centinela','convMin','dia',null),
  ('centinela','kwSpendNoConv','dia',null),
  ('semanal','cpaMax','semana',null),
  ('semanal','convMin','semana',null),
  ('semanal','kwSpendNoConv','semana',null),
  ('semanal','spendDeviation','semana',null)
on conflict (script, umbral) do nothing;

create or replace view public.v_umbrales_inconsistentes as
with activos as (select account from cuentas where activa),
esperado as (
  select a.account, e.script, e.umbral, e.canonico_en_cuentas
    from activos a cross join umbrales_esperados e
),
declarado as (select account, script, umbral, valor, declarado_el from umbrales_de_scripts),
j as (
  select e.account, e.script, e.umbral, e.canonico_en_cuentas,
         d.valor, d.declarado_el,
         d.umbral is null as sin_declarar,
         case e.canonico_en_cuentas
           when 'presupuesto_diario'  then c.presupuesto_diario
           when 'pico_gasto_factor'   then c.pico_gasto_factor
           when 'sin_conv_min_gasto'  then c.sin_conv_min_gasto
           else null end as canonico
    from esperado e
    join cuentas c on c.account = e.account
    left join declarado d on d.account = e.account and d.script = e.script and d.umbral = e.umbral
)
select j.account,
       j.script,
       j.umbral,
       j.valor as valor_en_script,
       j.canonico as valor_en_supabase,
       case
         when j.sin_declarar then
           'El script ' || j.script || ' nunca declaro el umbral ' || j.umbral || ' de ' || j.account ||
           '. Sus valores cableados son invisibles para esta auditoria: no se puede saber si estan en cero. Agregar declararUmbrales() con p_script=''' || j.script || '''.'
         when coalesce(j.valor, 0) = 0 then
           'Umbral en CERO en ' || j.script || ': la alerta esta apagada y se ve igual que una que nunca dispara. Cargarle un valor con sentido o sacar la comparacion.'
         when j.canonico is not null and j.valor is distinct from j.canonico then
           'El script dice ' || j.valor || ' y Supabase dice ' || coalesce(j.canonico::text,'nada') ||
           '. El que manda es Supabase: corregir el script.'
         when j.declarado_el < now() - interval '8 days' then
           'Declarado por ultima vez el ' || j.declarado_el::date || '. Si el script dejo de correr, el umbral que se audita no es el que esta vigente.'
         else 'Coherente.' end as lectura,
       case
         when j.sin_declarar then 'NO DECLARA'
         when coalesce(j.valor, 0) = 0 then 'APAGADO'
         when j.canonico is not null and j.valor is distinct from j.canonico then 'DIVERGE'
         when j.declarado_el < now() - interval '8 days' then 'VIEJO'
         else 'OK' end as veredicto
  from j
 where j.sin_declarar
    or coalesce(j.valor, 0) = 0
    or (j.canonico is not null and j.valor is distinct from j.canonico)
    or j.declarado_el < now() - interval '8 days';

comment on view public.v_umbrales_inconsistentes is
  'Umbrales de los scripts que no cierran: no declarados, en cero, divergentes del canonico de cuentas, o declarados hace mas de 8 dias. La fila NO DECLARA es la importante: sin ella, un script que no llama a declarar_umbral pasa la auditoria por ausencia.';;
