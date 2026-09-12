drop view if exists v_anomalia_explicada;
drop view if exists v_anomalias_diarias;

create view v_anomalias_diarias as
with base as (
  select account, date, gasto, conversiones, cpa, ctr, clics, madurez,
         extract(isodow from date)::int as dow
  from v_serie_diaria
),
ventana as (
  select b.*,
         (select count(*) from base p where p.account=b.account and p.date between b.date-7 and b.date-1) as n_base,
         (select avg(p.gasto) from base p where p.account=b.account and p.date between b.date-7 and b.date-1) as gasto_media7,
         (select stddev_samp(p.gasto) from base p where p.account=b.account and p.date between b.date-7 and b.date-1) as gasto_sd7_raw,
         (select avg(p.cpa) from base p where p.account=b.account and p.date between b.date-7 and b.date-1 and p.cpa is not null) as cpa_media7,
         (select stddev_samp(p.cpa) from base p where p.account=b.account and p.date between b.date-7 and b.date-1 and p.cpa is not null) as cpa_sd7_raw,
         (select count(*) from base p where p.account=b.account and p.date between b.date-7 and b.date-1 and p.cpa is not null) as n_cpa,
         (select p.gasto from base p where p.account=b.account and p.date=b.date-7) as gasto_mismo_dia_sem_prev,
         (select p.cpa from base p where p.account=b.account and p.date=b.date-7) as cpa_mismo_dia_sem_prev
  from base b
),
calc as (
  select *,
         case when n_base >= 4 and gasto_media7 > 0
              then (gasto - gasto_media7) / greatest(coalesce(gasto_sd7_raw,0), gasto_media7*0.15) end as gz,
         case when n_cpa >= 4 and cpa is not null and cpa_media7 > 0
              then (cpa - cpa_media7) / greatest(coalesce(cpa_sd7_raw,0), cpa_media7*0.15) end as cz
  from ventana
)
select
  account, date, dow, madurez, n_base as dias_en_baseline,
  gasto, conversiones, cpa, ctr, clics,
  round(gasto_media7, 2) as gasto_baseline,
  round(cpa_media7, 2) as cpa_baseline,
  gasto_mismo_dia_sem_prev, cpa_mismo_dia_sem_prev,
  round(gz, 2) as gasto_z, round(cz, 2) as cpa_z,
  case when gasto_mismo_dia_sem_prev > 0 then round((gasto - gasto_mismo_dia_sem_prev) / gasto_mismo_dia_sem_prev * 100, 1) end as gasto_vs_sem_prev_pct,
  case when cpa_mismo_dia_sem_prev > 0 and cpa is not null then round((cpa - cpa_mismo_dia_sem_prev) / cpa_mismo_dia_sem_prev * 100, 1) end as cpa_vs_sem_prev_pct,
  case
    when madurez = 'provisional' then 'ignorar'
    when n_base < 4 then 'sin baseline'
    when abs(coalesce(gz,0)) >= 3 or abs(coalesce(cz,0)) >= 3 then 'critica'
    when abs(coalesce(gz,0)) >= 2 or abs(coalesce(cz,0)) >= 2 then 'alta'
    when abs(coalesce(gz,0)) >= 1.5 or abs(coalesce(cz,0)) >= 1.5 then 'media'
    else 'normal'
  end as severidad,
  case
    when abs(coalesce(gz,0)) >= 2 and abs(coalesce(cz,0)) >= 2 then 'gasto y cpa'
    when abs(coalesce(gz,0)) >= 2 then 'gasto'
    when abs(coalesce(cz,0)) >= 2 then 'cpa'
  end as metrica_anomala,
  case when gz > 0 then 'sube' when gz < 0 then 'baja' end as gasto_direccion,
  case when cz > 0 then 'sube' when cz < 0 then 'baja' end as cpa_direccion
from calc;

comment on view v_anomalias_diarias is 'Z-score de gasto y CPA contra la media movil de 7 dias previos, con piso de desviacion en 15% de la media y baseline minimo de 4 dias. Severidad: critica z>=3, alta z>=2, media z>=1.5. Provisionales se marcan ignorar. gasto_vs_sem_prev_pct compara contra el mismo dia de la semana anterior, neutralizando el efecto fin de semana.';

create view v_anomalia_explicada as
select
  a.account, a.date, a.severidad, a.metrica_anomala, a.gasto_direccion, a.cpa_direccion,
  a.gasto_z, a.cpa_z, a.gasto, a.gasto_baseline, a.cpa, a.cpa_baseline,
  a.gasto_vs_sem_prev_pct, a.cpa_vs_sem_prev_pct,
  (select c.campaign from campaign_daily c
   where c.account = a.account and c.date = a.date
   order by abs(c.cost - (select avg(p.cost) from campaign_daily p
                          where p.account=c.account and p.campaign=c.campaign and p.date between a.date-7 and a.date-1)) desc nulls last
   limit 1) as campana_principal,
  d.cambios_ese_dia, d.hubo_cambio_automatico, d.campos_tocados,
  case
    when d.cambios_ese_dia > 0 and d.hubo_cambio_automatico then 'Cambio automatico de Google ese dia'
    when d.cambios_ese_dia > 0 then 'Hubo ' || d.cambios_ese_dia || ' cambio(s) propio(s) ese dia'
    when a.gasto_vs_sem_prev_pct is not null and abs(a.gasto_vs_sem_prev_pct) < 25 then 'Similar al mismo dia de la semana previa: patron semanal, no anomalia'
    else 'Sin cambios registrados: mercado, competencia o tracking'
  end as explicacion
from v_anomalias_diarias a
left join v_dia_con_cambios d on d.account = a.account and d.date = a.date
where a.severidad in ('media','alta','critica');

comment on view v_anomalia_explicada is 'Dias anomalos con explicacion en una linea. Si hubo cambio ese dia, es la causa mas probable. Si el mismo dia de la semana previa se comporto igual, es patron. Si nada, es externo.';;
