-- Reparacion de un error mio en la migracion anterior: defini la vista seleccionando de
-- si misma, y quedo en recursion infinita. Es exactamente lo que este sistema castiga:
-- reemplace una vista sin haber capturado su definicion original primero.
-- Ahora apunta a cambios_de_sistema, que es la tabla de origen.
create or replace view public.v_cambios_recientes as
select c.cuando,
       c.que,
       c.por_que,
       c.objetos,
       c.version,
       c.revierte_como,
       -- null = cambio global del sistema. La columna existe para que un filtro por cuenta
       -- devuelva vacio en vez de romper la consulta. No inventar una atribucion por cuenta
       -- que estos registros no tienen.
       null::text as account
  from public.cambios_de_sistema c
 where c.cuando >= now() - interval '7 days'
 order by c.cuando desc;

comment on view public.v_cambios_recientes is
  'Cambios de sistema de los ultimos 7 dias, de cambios_de_sistema. account es siempre null: son cambios globales y no pertenecen a una cuenta. La columna existe solo para que .eq(account, cliente) devuelva vacio en vez de reventar la consulta, que era el error mas frecuente de produccion hoy, 19 veces.';;
