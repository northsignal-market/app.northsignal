-- La vista comparaba "cuantas acciones cuentan conversiones" contra "cuantas primarias
-- declara funnel_stages", a nivel CUENTA. Dos defectos:
--
-- 1. Un clic pertenece a UNA campana. Dos acciones que nunca aparecen en la misma
--    campana no pueden contar dos veces el mismo clic. En FRESH_MONKEE, "Segment:
--    Order Completed" vive en 25 campanas y no comparte ninguna con las otras cuatro:
--    las campanas de compra online estan limpias. La vista igual publicaba 2,17x sobre
--    toda la cuenta, y el guardarrail manda mirarla antes de citar un CPA: el proximo
--    agente iba a desinflar 2,17x un CPA que no estaba inflado.
-- 2. Cero primarias declaradas se leia como "cero primarias", cuando significa
--    "esta cuenta no tiene funnel_stages cargado". FRESH_MONKEE no tiene ni una fila.
--
-- Ahora el solapamiento se mide DENTRO de cada campana y se agrega solo sobre las
-- campanas con mas de una accion. Se mantiene el orden de las 11 columnas originales
-- porque v_salud_sistema las consume; las tres nuevas van al final.

create or replace view public.v_primarias_solapadas as
with reales as (
  select ca.account, ca.campaign, ca.conversion_action,
         round(sum(ca.conversions), 1) as conv_90d
    from conversion_actions ca
   where ca.week_start > current_date - 90 and ca.conversions > 0
   group by 1, 2, 3
),
por_campana as (
  select account, campaign, count(*) as acciones,
         round(sum(conv_90d), 1) as conv_camp,
         max(conv_90d) as conv_mayor_camp
    from reales group by 1, 2
),
afectadas as (select * from por_campana where acciones > 1),
limpias as (
  select account, round(sum(conv_camp), 1) as conv_limpias
    from por_campana where acciones = 1 group by 1
),
acc as (
  select a.account,
         count(distinct r.conversion_action) as acciones_con_conversiones,
         count(distinct a.campaign)          as campanas_afectadas,
         round(sum(distinct_camp.conv_camp), 1)       as conv_total,
         round(sum(distinct_camp.conv_mayor_camp), 1) as conv_de_la_principal,
         string_agg(distinct r.conversion_action, ', ' order by r.conversion_action) as acciones_en_juego
    from afectadas a
    join reales r on r.account = a.account and r.campaign = a.campaign
    join lateral (select a.conv_camp, a.conv_mayor_camp) distinct_camp on true
   group by a.account
),
totales as (   -- suma por campana sin inflar por el join con reales
  select account,
         round(sum(conv_camp), 1) as conv_total,
         round(sum(conv_mayor_camp), 1) as conv_mayor
    from afectadas group by 1
),
mayor as (
  select distinct on (account) account, conversion_action
    from (select account, conversion_action, sum(conv_90d) c from reales group by 1, 2) z
   order by account, c desc
),
declaradas as (
  select account,
         count(*) filter (where google_status = 'primaria') as primarias_declaradas,
         string_agg(stage_name, ', ') filter (where google_status = 'primaria') as cuales_declaradas,
         count(*) as filas_funnel
    from funnel_stages group by account
),
det as (
  select account, string_agg(x, ' | ' order by x) as detalle
    from (select a.account,
                 a.campaign || ': ' || string_agg(r.conversion_action || ' (' || r.conv_90d || ')', ' + ' order by r.conv_90d desc) as x
            from afectadas a
            join reales r on r.account = a.account and r.campaign = a.campaign
           group by a.account, a.campaign) z
   group by account
)
select acc.account,
       acc.acciones_con_conversiones,
       coalesce(d.primarias_declaradas, 0) as primarias_declaradas,
       d.cuales_declaradas,
       t.conv_total,
       m.conversion_action as accion_principal,
       t.conv_mayor as conv_de_la_principal,
       round(t.conv_total - t.conv_mayor, 1) as conv_que_podrian_ser_la_misma,
       round(t.conv_total / nullif(t.conv_mayor, 0), 2) as factor_de_inflado,
       det.detalle,
       case
         when coalesce(d.filas_funnel, 0) = 0 then
           'SIN DECLARAR: esta cuenta no tiene ninguna fila en funnel_stages, asi que no se puede saber cuales acciones son etapas del mismo recorrido. Lo que SI se sabe: en ' ||
           acc.campanas_afectadas || ' campana(s) conviven ' || acc.acciones_con_conversiones ||
           ' acciones que cuentan conversiones (' || acc.acciones_en_juego || '), y ahi el total puede estar inflado hasta ' ||
           round(t.conv_total / nullif(t.conv_mayor, 0), 2) || 'x. Las otras ' ||
           coalesce(l.conv_limpias, 0) || ' conversiones estan en campanas con una sola accion y NO estan en riesgo. ' ||
           'No desinflar el CPA de la cuenta entera con este factor: aplica solo a las campanas de detalle.'
         when acc.acciones_con_conversiones > coalesce(d.primarias_declaradas, 0) then
           'REVISAR: en ' || acc.campanas_afectadas || ' campana(s) conviven ' || acc.acciones_con_conversiones ||
           ' acciones que cuentan conversiones y funnel_stages declara ' || coalesce(d.primarias_declaradas, 0) ||
           ' primaria(s). Si son etapas del mismo recorrido sobre el mismo clic, el total de esas campanas esta inflado hasta ' ||
           round(t.conv_total / nullif(t.conv_mayor, 0), 2) ||
           'x y el CPA publicado es esa fraccion del real. Otras ' || coalesce(l.conv_limpias, 0) ||
           ' conversiones estan en campanas de una sola accion y no estan afectadas. Verificar en Google Ads cuales estan como primarias.'
         else
           'Multiples acciones declaradas conviviendo en la misma campana: verificar que midan hechos distintos y no etapas del mismo clic.'
       end as lectura,
       acc.campanas_afectadas,
       coalesce(l.conv_limpias, 0) as conv_en_campanas_limpias,
       case when coalesce(d.filas_funnel, 0) = 0 then 'SIN DECLARAR'
            when acc.acciones_con_conversiones > coalesce(d.primarias_declaradas, 0) then 'REVISAR'
            else 'DECLARADO' end as veredicto
  from acc
  join totales t on t.account = acc.account
  left join declaradas d on d.account = acc.account
  left join limpias    l on l.account = acc.account
  left join mayor      m on m.account = acc.account
  left join det        on det.account = acc.account;

comment on view public.v_primarias_solapadas is
  'Doble conteo entre acciones de conversion, medido POR CAMPANA y no por cuenta: un clic pertenece a una campana, asi que dos acciones que no comparten campana no pueden contar el mismo clic. factor_de_inflado aplica SOLO a las campanas de detalle, nunca al CPA de la cuenta entera. veredicto SIN DECLARAR significa que la cuenta no tiene funnel_stages cargado, no que tenga cero primarias.';;
