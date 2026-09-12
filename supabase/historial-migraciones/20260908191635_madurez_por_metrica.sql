-- ============================================================
-- TICKETS 34 y 36 · UN SOLO BUG CON DOS CARAS
-- ============================================================
-- El CASE evaluaba madurez = 'provisional' ANTES que las ramas de z y devolvia
-- 'ignorar'. Como la capa diaria siempre tiene los dos ultimos dias provisionales,
-- los dos unicos dias en los que todavia se puede ACTUAR eran invisibles.
--
-- BHI, 7 de septiembre: gasto 39.824 CLP contra un presupuesto de 20.000 (199%),
-- gasto_z = 3,65 que por los propios umbrales es critica, y devolvia 'ignorar'.
-- Cinco clics, cero solicitudes, ningun detector aviso.
--
-- Y la cara opuesta en Fresh Monkee: el cron alertaba un CPA de un dia que todavia
-- madura, porque divide un gasto completo por conversiones incompletas.
--
-- La causa comun: la misma regla de madurez para gasto y conversiones. EL GASTO DE
-- AYER YA ES DEFINITIVO; las conversiones no. Ahora la regla se separa por metrica:
-- el gasto se juzga siempre, el CPA solo cuando el dia consolido.
-- ============================================================
create or replace view v_anomalias_diarias with (security_invoker = true) as
with base as (
  select account, date, gasto, conversiones, cpa, ctr, clics, madurez,
    extract(isodow from date)::int dow
  from v_serie_diaria),
ventana as (
  select b.*,
    (select count(*) from base p where p.account = b.account and p.date >= b.date - 7 and p.date <= b.date - 1) n_base,
    (select avg(p.gasto) from base p where p.account = b.account and p.date >= b.date - 7 and p.date <= b.date - 1) gasto_media7,
    (select stddev_samp(p.gasto) from base p where p.account = b.account and p.date >= b.date - 7 and p.date <= b.date - 1) gasto_sd7_raw,
    (select count(*) from base p where p.account = b.account and p.date >= b.date - 7 and p.date <= b.date - 1 and p.cpa is not null) n_cpa,
    (select avg(p.cpa) from base p where p.account = b.account and p.date >= b.date - 7 and p.date <= b.date - 1 and p.cpa is not null) cpa_media7,
    (select stddev_samp(p.cpa) from base p where p.account = b.account and p.date >= b.date - 7 and p.date <= b.date - 1 and p.cpa is not null) cpa_sd7_raw,
    (select p.gasto from base p where p.account = b.account and p.date = b.date - 7) gasto_mismo_dia_sem_prev,
    (select p.cpa from base p where p.account = b.account and p.date = b.date - 7) cpa_mismo_dia_sem_prev
  from base b),
calc as (
  select v.*,
    case when v.n_base >= 4 and v.gasto_media7 > 0
      then (v.gasto - v.gasto_media7) / greatest(coalesce(v.gasto_sd7_raw, 0), v.gasto_media7 * 0.15) end gz,
    case when v.n_cpa >= 4 and v.cpa is not null and v.cpa_media7 > 0
      then (v.cpa - v.cpa_media7) / greatest(coalesce(v.cpa_sd7_raw, 0), v.cpa_media7 * 0.15) end cz
  from ventana v)
select account, date, dow, madurez, n_base dias_en_baseline,
  gasto, conversiones, cpa, ctr, clics,
  round(gasto_media7, 2) gasto_baseline, round(cpa_media7, 2) cpa_baseline,
  gasto_mismo_dia_sem_prev, cpa_mismo_dia_sem_prev,
  round(gz, 2) gasto_z, round(cz, 2) cpa_z,
  case when gasto_mismo_dia_sem_prev > 0 then round((gasto - gasto_mismo_dia_sem_prev) / gasto_mismo_dia_sem_prev * 100, 1) end gasto_vs_sem_prev_pct,
  case when cpa_mismo_dia_sem_prev > 0 and cpa is not null then round((cpa - cpa_mismo_dia_sem_prev) / cpa_mismo_dia_sem_prev * 100, 1) end cpa_vs_sem_prev_pct,
  -- El gasto se juzga SIEMPRE, incluso en dias provisionales: ya es definitivo.
  -- El CPA solo cuando el dia consolido: dividir gasto completo por conversiones
  -- incompletas produce una alerta falsa garantizada.
  case
    when n_base < 4 then 'sin baseline'
    when abs(coalesce(gz, 0)) >= 3 then 'critica'
    when madurez <> 'provisional' and abs(coalesce(cz, 0)) >= 3 then 'critica'
    when abs(coalesce(gz, 0)) >= 2 then 'alta'
    when madurez <> 'provisional' and abs(coalesce(cz, 0)) >= 2 then 'alta'
    when abs(coalesce(gz, 0)) >= 1.5 then 'media'
    when madurez <> 'provisional' and abs(coalesce(cz, 0)) >= 1.5 then 'media'
    else 'normal'
  end severidad,
  case
    when abs(coalesce(gz,0)) >= 2 and madurez <> 'provisional' and abs(coalesce(cz,0)) >= 2 then 'gasto y cpa'
    when abs(coalesce(gz,0)) >= 2 then 'gasto'
    when madurez <> 'provisional' and abs(coalesce(cz,0)) >= 2 then 'cpa'
  end metrica_anomala,
  case when gz > 0 then 'sube' when gz < 0 then 'baja' end gasto_direccion,
  case when cz > 0 then 'sube' when cz < 0 then 'baja' end cpa_direccion,
  case when madurez = 'provisional' and abs(coalesce(cz,0)) >= 2
    then 'El CPA de este dia parece anomalo pero el dia todavia madura: las conversiones siguen entrando y el gasto ya es final. NO abrir accionable por CPA hasta que consolide.'
    when madurez = 'provisional' and abs(coalesce(gz,0)) >= 2
    then 'Dia provisional, PERO el gasto ya es definitivo y esta fuera de rango: esto SI merece mirarse hoy, que es cuando todavia se puede actuar.'
  end lectura_de_madurez
from calc;
comment on view v_anomalias_diarias is 'Tickets 34 y 36. La regla de madurez se aplica POR METRICA: el gasto de ayer ya es definitivo y se juzga siempre; el CPA solo cuando el dia consolido, porque antes divide gasto completo por conversiones incompletas. Antes un CASE evaluaba provisional primero y los dos unicos dias en los que se puede actuar eran invisibles.';

select account, date, madurez, gasto, round(gasto_z,2) gz, severidad, left(lectura_de_madurez, 80) lectura
from v_anomalias_diarias
where account='BHI' and date >= current_date - 3 order by date desc;;
