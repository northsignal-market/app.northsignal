-- ============================================================
-- TICKET 41 · PRIMARIAS SOLAPADAS
-- ============================================================
-- v_integridad_conversiones detecta doble conteo entre TABLAS y devuelve cero
-- correctamente. Nadie detecta el doble conteo entre ACCIONES, que es el que
-- rompe la lectura de una cuenta entera.
--
-- BHI: tres acciones marcadas primarias que son tres momentos del MISMO recorrido
-- de la MISMA persona. Envio de formulario dispara online; Asesoria Realizada y
-- Cliente Activo entran por subida offline sobre el mismo clic. Las 27 conversiones
-- del mes son 13 solicitudes: CPA real 42.359 CLP contra los 20.395 que publicaba
-- el sistema. Un factor de 2, en la cifra que decide si la cuenta va bien.
--
-- Y funnel_stages declara UNA primaria por cuenta mientras Google tiene tres
-- activas: la desincronizacion entre lo declarado y lo real es el sintoma raiz.
-- ============================================================
create or replace view v_primarias_solapadas with (security_invoker = true) as
with reales as (
  -- Lo que Google realmente cuenta: acciones con conversiones en 90 dias
  select ca.account, ca.conversion_action, ca.category,
    round(sum(ca.conversions)::numeric, 1) conv_90d,
    count(distinct ca.campaign) campanas
  from conversion_actions ca
  where ca.week_start > current_date - 90 and ca.conversions > 0
  group by 1, 2, 3),
declaradas as (
  select account, count(*) filter (where google_status = 'primaria') primarias_declaradas,
    string_agg(stage_name, ', ') filter (where google_status = 'primaria') cuales_declaradas
  from funnel_stages group by 1),
por_cuenta as (
  select r.account, count(*) acciones_con_conversiones,
    round(sum(r.conv_90d), 1) conv_total,
    string_agg(r.conversion_action || ' (' || r.conv_90d || ')', ', ' order by r.conv_90d desc) detalle,
    -- La accion con mas conversiones suele ser la de arriba del embudo: la que
    -- de verdad mide la solicitud. Las demas son etapas posteriores del mismo clic.
    max(r.conv_90d) conv_de_la_mayor,
    (array_agg(r.conversion_action order by r.conv_90d desc))[1] la_mayor
  from reales r group by 1)
select p.account,
  p.acciones_con_conversiones,
  coalesce(d.primarias_declaradas, 0) primarias_declaradas,
  d.cuales_declaradas,
  p.conv_total,
  p.la_mayor accion_principal,
  p.conv_de_la_mayor conv_de_la_principal,
  round(p.conv_total - p.conv_de_la_mayor, 1) conv_que_podrian_ser_la_misma,
  round((p.conv_total / nullif(p.conv_de_la_mayor, 0))::numeric, 2) factor_de_inflado,
  p.detalle,
  case
    when p.acciones_con_conversiones = 1 then 'OK: una sola accion cuenta conversiones.'
    when p.acciones_con_conversiones > coalesce(d.primarias_declaradas, 0) then
      'REVISAR: Google cuenta ' || p.acciones_con_conversiones || ' acciones y funnel_stages declara ' ||
      coalesce(d.primarias_declaradas, 0) || ' primaria(s). Si son etapas del mismo recorrido sobre el mismo clic, ' ||
      'el total esta inflado hasta ' || round((p.conv_total / nullif(p.conv_de_la_mayor,0))::numeric, 2) ||
      'x y el CPA publicado es esa fraccion del real. Verificar en Google Ads cuales estan como primarias.'
    else 'Multiples acciones declaradas: verificar que midan hechos distintos y no etapas del mismo clic.'
  end lectura
from por_cuenta p left join declaradas d on d.account = p.account
where p.acciones_con_conversiones > 1;
comment on view v_primarias_solapadas is 'Ticket 41. Detecta cuando varias acciones de conversion cuentan etapas del MISMO recorrido sobre el mismo clic. v_integridad_conversiones cubre el doble conteo entre tablas; este cubre el que hay entre acciones, que infla el CPA de una cuenta entera por un factor de 2 sin que nada avise.';

select account, acciones_con_conversiones, primarias_declaradas, conv_total,
  conv_de_la_principal, factor_de_inflado, left(lectura, 100) lectura
from v_primarias_solapadas order by factor_de_inflado desc;;
