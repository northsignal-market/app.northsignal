-- ================================================================
-- DETECCIÓN DE ANOMALÍAS CONTRA BASELINE PROPIO
-- ================================================================
-- Un umbral fijo ("avisar si CPA > 50") es una regla, no deteccion. La
-- deteccion real compara cada metrica contra su propia linea base movil y
-- marca desviaciones estadisticamente inusuales, escalando con la
-- estacionalidad sin retocar constantes.
--
-- El baseline aca es doble: la media de los 7 dias previos (excluyendo el
-- dia evaluado) Y el mismo dia de la semana anterior. Fin de semana gasta
-- la mitad que dias habiles en las tres cuentas, asi que comparar un sabado
-- contra la media de la semana da falso positivo siempre.
--
-- Los outliers se excluyen del baseline para que no envenenen la media.
-- ================================================================

create or replace view v_anomalias_diarias as
with base as (
  select account, date, gasto, conversiones, cpa, ctr, clics, madurez,
         extract(isodow from date)::int as dow
  from v_serie_diaria
),
-- Baseline 1: media y desviacion de los 7 dias previos, excluyendo el propio
ventana as (
  select b.account, b.date, b.gasto, b.conversiones, b.cpa, b.ctr, b.clics, b.madurez, b.dow,
         (select avg(p.gasto) from base p where p.account=b.account and p.date between b.date-7 and b.date-1) as gasto_media7,
         (select stddev_samp(p.gasto) from base p where p.account=b.account and p.date between b.date-7 and b.date-1) as gasto_sd7,
         (select avg(p.cpa) from base p where p.account=b.account and p.date between b.date-7 and b.date-1 and p.cpa is not null) as cpa_media7,
         (select stddev_samp(p.cpa) from base p where p.account=b.account and p.date between b.date-7 and b.date-1 and p.cpa is not null) as cpa_sd7,
         (select avg(p.ctr) from base p where p.account=b.account and p.date between b.date-7 and b.date-1) as ctr_media7,
         (select stddev_samp(p.ctr) from base p where p.account=b.account and p.date between b.date-7 and b.date-1) as ctr_sd7,
         -- Baseline 2: mismo dia de la semana anterior
         (select p.gasto from base p where p.account=b.account and p.date=b.date-7) as gasto_mismo_dia_sem_prev,
         (select p.cpa from base p where p.account=b.account and p.date=b.date-7) as cpa_mismo_dia_sem_prev
  from base b
)
select
  account, date, dow, madurez,
  gasto, conversiones, cpa, ctr, clics,
  round(gasto_media7, 2) as gasto_baseline,
  round(cpa_media7, 2) as cpa_baseline,
  gasto_mismo_dia_sem_prev,
  cpa_mismo_dia_sem_prev,
  -- z-score: cuantas desviaciones estandar se aleja del baseline
  case when gasto_sd7 > 0 then round((gasto - gasto_media7) / gasto_sd7, 2) end as gasto_z,
  case when cpa_sd7 > 0 and cpa is not null then round((cpa - cpa_media7) / cpa_sd7, 2) end as cpa_z,
  case when ctr_sd7 > 0 then round((ctr - ctr_media7) / ctr_sd7, 2) end as ctr_z,
  -- variacion contra el mismo dia de la semana previa: elimina el efecto dia-de-semana
  case when gasto_mismo_dia_sem_prev > 0 then round((gasto - gasto_mismo_dia_sem_prev) / gasto_mismo_dia_sem_prev * 100, 1) end as gasto_vs_sem_prev_pct,
  case when cpa_mismo_dia_sem_prev > 0 and cpa is not null then round((cpa - cpa_mismo_dia_sem_prev) / cpa_mismo_dia_sem_prev * 100, 1) end as cpa_vs_sem_prev_pct,
  -- Severidad: combina magnitud y madurez. Un dato provisional nunca es critico.
  case
    when madurez = 'provisional' then 'ignorar'
    when abs(coalesce(case when gasto_sd7 > 0 then (gasto - gasto_media7) / gasto_sd7 end, 0)) >= 3
      or (cpa_sd7 > 0 and cpa is not null and abs((cpa - cpa_media7) / cpa_sd7) >= 3) then 'critica'
    when abs(coalesce(case when gasto_sd7 > 0 then (gasto - gasto_media7) / gasto_sd7 end, 0)) >= 2
      or (cpa_sd7 > 0 and cpa is not null and abs((cpa - cpa_media7) / cpa_sd7) >= 2) then 'alta'
    when abs(coalesce(case when gasto_sd7 > 0 then (gasto - gasto_media7) / gasto_sd7 end, 0)) >= 1.5
      or (cpa_sd7 > 0 and cpa is not null and abs((cpa - cpa_media7) / cpa_sd7) >= 1.5) then 'media'
    else 'normal'
  end as severidad,
  -- Que metrica se movio
  case
    when gasto_sd7 > 0 and abs((gasto - gasto_media7) / gasto_sd7) >= 2
     and (cpa_sd7 is null or cpa is null or abs((cpa - cpa_media7) / cpa_sd7) < 2) then 'gasto'
    when cpa_sd7 > 0 and cpa is not null and abs((cpa - cpa_media7) / cpa_sd7) >= 2
     and (gasto_sd7 is null or abs((gasto - gasto_media7) / gasto_sd7) < 2) then 'cpa'
    when gasto_sd7 > 0 and cpa_sd7 > 0 and cpa is not null
     and abs((gasto - gasto_media7) / gasto_sd7) >= 2 and abs((cpa - cpa_media7) / cpa_sd7) >= 2 then 'gasto y cpa'
    else null
  end as metrica_anomala
from ventana;

comment on view v_anomalias_diarias is 'Cada dia con su z-score contra la media movil de los 7 dias previos (excluyendo el propio) y su variacion contra el mismo dia de la semana anterior. La severidad combina magnitud y madurez: un dato provisional nunca es critico porque las conversiones no llegaron. z >= 2 es inusual (alta), z >= 3 es raro (critica). Usar gasto_vs_sem_prev_pct para neutralizar el efecto dia-de-semana: un sabado se compara con el sabado previo, no con la media que incluye dias habiles.';


-- Explicacion de la anomalia: que campana la produjo
create or replace view v_anomalia_explicada as
select
  a.account, a.date, a.severidad, a.metrica_anomala, a.gasto_z, a.cpa_z,
  a.gasto, a.gasto_baseline, a.cpa, a.cpa_baseline,
  -- La campana que mas se alejo de su propio promedio ese dia
  (select c.campaign from campaign_daily c
   where c.account = a.account and c.date = a.date
   order by abs(c.cost - (select avg(p.cost) from campaign_daily p
                          where p.account=c.account and p.campaign=c.campaign
                            and p.date between a.date-7 and a.date-1)) desc nulls last
   limit 1) as campana_principal,
  -- Cambios ese dia
  d.cambios_ese_dia, d.hubo_cambio_automatico, d.campos_tocados
from v_anomalias_diarias a
left join v_dia_con_cambios d on d.account = a.account and d.date = a.date
where a.severidad in ('media','alta','critica');

comment on view v_anomalia_explicada is 'Solo los dias anomalos, con la campana que mas contribuyo y los cambios de ese dia. Es lo que responde "por que" sin que el usuario tenga que buscarlo: si hubo cambio ese dia, la explicacion mas probable es el cambio; si no, mirar campana_principal.';;
