-- Mapa de calor hora x dia de la semana, de la ultima semana cerrada.
-- Responde: a que hora y que dia convierte la cuenta, y a que hora gasta sin convertir.
create or replace view v_hora_dia as
with ultima as (
  select account, max(week_start) as week_start from hour_day group by account
)
select h.account, h.week_start,
       h.day_of_week,
       case h.day_of_week
         when 'MONDAY' then 1 when 'TUESDAY' then 2 when 'WEDNESDAY' then 3 when 'THURSDAY' then 4
         when 'FRIDAY' then 5 when 'SATURDAY' then 6 when 'SUNDAY' then 7 end as dow_num,
       case h.day_of_week
         when 'MONDAY' then 'Lun' when 'TUESDAY' then 'Mar' when 'WEDNESDAY' then 'Mié' when 'THURSDAY' then 'Jue'
         when 'FRIDAY' then 'Vie' when 'SATURDAY' then 'Sáb' when 'SUNDAY' then 'Dom' end as dia,
       h.hour,
       sum(h.impressions) as impresiones, sum(h.clicks) as clics,
       round(sum(h.cost), 2) as gasto, round(sum(h.conversions), 1) as conversiones,
       case when sum(h.conversions) > 0 then round(sum(h.cost) / sum(h.conversions), 2) end as cpa,
       case when sum(h.impressions) > 0 then round(sum(h.clicks)::numeric / sum(h.impressions) * 100, 2) end as ctr
from hour_day h join ultima u on u.account = h.account and u.week_start = h.week_start
group by h.account, h.week_start, h.day_of_week, h.hour;

comment on view v_hora_dia is 'Rendimiento por hora y dia de la semana, de la ultima semana cerrada, agregando todas las campanas. Para el mapa de calor: dow_num 1-7 en filas, hour 0-23 en columnas. Las celdas con gasto y sin conversion son candidatas a ajuste de programacion de anuncios.';

select account, count(*) celdas, sum(gasto) gasto, sum(conversiones) conv from v_hora_dia group by account;;
