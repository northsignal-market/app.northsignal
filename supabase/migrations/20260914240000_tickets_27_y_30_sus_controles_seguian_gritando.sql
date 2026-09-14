-- ============================================================================
-- DOS TICKETS "RESUELTOS" CUYO CONTROL SEGUÍA VIOLANDO
--
-- `v_para_actuar` los mostraba diciendo "Sin ticket. Nadie lo está mirando",
-- porque busca tickets ABIERTOS y los dos figuran resueltos. Un control que
-- grita sobre algo ya cerrado es el camino más corto a que nadie mire ninguno.
--
-- Resultaron ser dos cosas OPUESTAS, y por eso se arreglan distinto.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- TICKET 30 · el control era el que estaba mal (falso positivo)
--
-- La relación hace `count(distinct entity_type) = 3`. Medido hoy:
--
--   360, BHI, KAREDO   ad_group, campaign, conversion_action, custom_conversion_goal
--   FRESH_MONKEE       ad_group, campaign, conversion_action
--
-- Los TRES que la relación exige están en las cuatro cuentas: el arreglo del
-- ticket 30 funcionó, `ad_group` está. Lo que pasó es que el 13/9 apareció un
-- CUARTO nivel (`custom_conversion_goal`) y la relación cuenta en vez de
-- verificar. Cualquier nivel nuevo la rompe aunque la cobertura sea perfecta.
--
-- FRESH_MONKEE "cumplía" por casualidad: todavía no tiene el cuarto.
--
-- Es el mismo error que este sistema persigue en otras capas — medir un proxy
-- (cuántos hay) en vez de lo que importa (si están los que tienen que estar).
-- ----------------------------------------------------------------------------

update public.relaciones_verdad
   set sql_izquierda = 'select count(distinct entity_type) from config_snapshot where account = $CUENTA$ and snapshot_date = (select max(snapshot_date) from config_snapshot) and entity_type in (''campaign'',''ad_group'',''conversion_action'')',
       por_que_existe = por_que_existe ||
         E'\n\nACTUALIZADO 14/9/2026: contaba TODOS los entity_type y comparaba contra 3. El 13/9 aparecio un cuarto nivel (custom_conversion_goal) y la relacion empezo a violar en 360, BHI y KAREDO con la cobertura intacta — un falso positivo causado por su propio arreglo. Ahora cuenta solo los tres que exige. Agregar un nivel nuevo ya no la rompe; que falte uno de los tres, si.',
       mutante_probado_el = null,
       mutante_resultado = null
 where nombre = 'config_snapshot_cubre_los_tres_niveles';


-- ----------------------------------------------------------------------------
-- TICKET 27 · el control tenía razón: es una REGRESIÓN de hoy
--
-- La relación viola si una cuenta emite un veredicto de `escalar` con menos de
-- 10 conversiones. Hoy 360 tiene 8 conversiones en 17 dias, una sola campaña, y
-- dice "NO PROPONER · saturada: el siguiente escalón cuesta 2.2× el CPA
-- promedio". Exactamente lo que el ticket 27 prohibió.
--
-- El mutante de la relacion, probado el 12/9, decia: "el sql nuevo da 0 en 360
-- CON LA VISTA ABSTENIENDOSE (verde legitimo)". O sea que estaba verde porque
-- 360 no tenia curva de simulacion, no porque el veredicto estuviera guardado.
-- La migracion 20260914170000 reescribio la vista, aparecio la curva, y el
-- veredicto salio sin ninguna guarda de evidencia.
--
-- Y la prueba de que la guarda faltaba esta en la rama de al lado, en la MISMA
-- vista:
--
--   pausar:  WHEN b.dias_28d < 28 THEN 'NO PROPONER · faltan dias consolidados'
--   escalar: WHEN s.peor_ratio >= 2 THEN 'NO PROPONER · saturada: ...'
--
-- `pausar` aprendio la leccion del ticket 27 y `escalar` no. Decide solo por la
-- curva y nunca mira cuantas conversiones la sostienen.
--
-- Se agrega UNA guarda, la que el ticket y la relacion ya declaran: menos de 10
-- conversiones y se abstiene. No se toca `dias_28d`, aunque las cuatro cuentas
-- tengan 15-17 dias de 28: eso silenciaria tambien a FRESH_MONKEE, que tiene 330
-- conversiones y sí puede sostener un veredicto. El radio del arreglo es el radio
-- de la evidencia.
-- ----------------------------------------------------------------------------

do $$
declare
  def   text;
  ini   int;
  marca text := 'WHEN s.peor_ratio >= 2::numeric THEN';
  guarda text;
begin
  select pg_get_viewdef('public.v_decision_estructural'::regclass, true) into def;
  if def is null then
    raise exception 'No existe v_decision_estructural. No se toca nada.';
  end if;

  if position('conversiones en' in def) > 0 and position('no aguanta un veredicto' in def) > 0 then
    raise notice 'La guarda de escalar ya estaba. No se toca nada.';
    return;
  end if;

  ini := position(marca in def);
  if ini = 0 then
    raise exception 'No encontre la rama de saturacion en escalar. Alguien la cambio: revisar a mano.';
  end if;

  -- Va ANTES de la rama de saturacion, asi corta antes de emitir cualquier
  -- veredicto. Empieza con 'SIN DATOS' a proposito: es el prefijo que la relacion
  -- reconoce como abstencion honesta.
  guarda :=
    'WHEN b.conv_28d < 10::numeric THEN ''SIN DATOS · ''::text || round(b.conv_28d, 0) || '' conversiones en ''::text || b.dias_28d || '' dias: no aguanta un veredicto de escalar.''::text
            ';

  def := overlay(def placing guarda || marca from ini for length(marca));
  execute 'create or replace view public.v_decision_estructural as ' || def;

  -- Verificacion: la guarda quedo, y 360 dejo de emitir un veredicto sobre 8 conv.
  if not exists (select 1 from v_decision_estructural
                  where account = '360' and escalar like 'SIN DATOS%') then
    raise exception 'La guarda se aplico pero 360 sigue emitiendo un veredicto de escalar con % conversiones. Revisar a mano.',
      (select conv_28d from v_decision_estructural where account = '360');
  end if;
  -- Y NO silencio a quien si tiene con que: FRESH_MONKEE tiene 330 conversiones.
  if exists (select 1 from v_decision_estructural
              where account = 'FRESH_MONKEE' and escalar like 'SIN DATOS%') then
    raise exception 'La guarda silencio a FRESH_MONKEE, que tiene volumen de sobra. Es mas ancha de lo que deberia. Revisar a mano.';
  end if;

  raise notice 'escalar ahora se abstiene con menos de 10 conversiones.';
end $$;


-- El ticket 27 vuelve a abrirse: su control tenia razon.
update public.tickets
   set estado = 'abierto'
 where id = 27 and estado = 'resuelto';
