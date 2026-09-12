-- BUG: v_relaciones_violadas tomaba la ultima corrida POR relacion Y CUENTA. Cuando una
-- relacion cambia de ambito (de cuenta a global), o se desactiva una cuenta, o se deja de
-- correr una combinacion, esa fila vieja nunca vuelve a tener una mas nueva con la que
-- competir: queda viva para siempre.
-- Se vio al pasar columnas_de_fecha_son_de_tipo_fecha a global: la violacion vieja con
-- cuenta=360 seguia apareciendo aunque la relacion ya no corre por cuenta.
--
-- Cada corrida de una relacion produce el conjunto COMPLETO de filas de su alcance, asi que
-- lo unico que importa es la ultima corrida de esa relacion. No la ultima por combinacion.
create or replace view public.v_relaciones_violadas as
with ultima as (
  select relacion_id, max(corrida_el) as cuando
    from corridas_verdad group by relacion_id
)
select r.familia, r.nombre, r.que_afirma, c.cuenta, c.valor_izq, c.valor_der,
       round(c.diferencia_rel * 100, 2) as diferencia_pct, c.detalle, c.corrida_el, r.por_que_existe
  from corridas_verdad c
  join ultima u on u.relacion_id = c.relacion_id and u.cuando = c.corrida_el
  join relaciones_verdad r on r.id = c.relacion_id
 where c.veredicto = 'viola' and r.activa
 order by r.familia, r.nombre, c.cuenta;

comment on view public.v_relaciones_violadas is
  'Violaciones de la ULTIMA corrida de cada relacion. Antes tomaba la ultima por relacion y cuenta, y eso hacia inmortal a cualquier violacion de una combinacion que dejara de correrse: al pasar una relacion de ambito cuenta a global, la fila vieja con cuenta cargada no volvia a tener competencia y seguia mostrandose para siempre.';;
