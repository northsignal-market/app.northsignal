-- ============================================================================
-- I3 TIENE QUE FALLAR CERRADO · segundo intento, contra el texto de HOY
--
-- La migración 20260914030000 iba a arreglar esto y ABORTÓ con su propia guarda:
-- "el fragmento de I3 no esta como se esperaba". Tenía razón. Entre que se
-- escribió y que se intentó aplicar, la 20260914150000 —que sí está aplicada—
-- reescribió el MENSAJE de I3 para que declarara la ventana real. El ancla se
-- movió y el parche no pudo agarrar.
--
-- Esa guarda hizo lo que tenía que hacer: abortó en vez de dejar la función a
-- medias. Pero el efecto neto es que EL BUG SIGUE VIVO EN PRODUCCIÓN, y hoy se
-- verificó contra la base:
--
--   ya_parcheada        0
--   usa_capa_semanal    0
--   tiene_el_bug_viejo  1
--
-- QUÉ ES EL BUG. I3 es el invariante que impide pausar una keyword que
-- convierte. Hoy hace:
--
--   select sum(conversions) into conv90 from keywords_daily
--    where ... and date >= current_date - 30 ...;
--   if coalesce(conv90, 0) > 0 then <bloquear> end if;
--
-- Tres cosas encadenadas:
--   1. `current_date - 30` escrito a mano, que la doctrina prohíbe.
--   2. Le pide 30 días a `keywords_daily`, que se reextrae con 14 de lookback y
--      tiene ~22. La ventana que declara no es la que suma.
--   3. Y lo grave: con CERO filas, `coalesce(conv90,0) > 0` es falso y el
--      invariante NO DICE NADA. Callar acá es aprobar.
--
-- El síntoma completo: una keyword que convirtió hace veinte días no tiene filas
-- en la ventana, I3 no bloquea, el accionable queda válido, y al apretar
-- "Aprobar y que se haga" el ejecutor pausa una keyword que convierte. El
-- guardarraíl no falla ruidosamente: aprueba.
--
-- CÓMO SE ARREGLA. La historia sale de `keywords` (semanal, 91 días), que es lo
-- que el propio esquema ya hace bien en `terminos_protegidos_actualizar`. Y si
-- no hay NINGUNA fila con la que decidir, BLOQUEA y lo dice: un control que no
-- puede medir no está autorizado a dejar pasar.
--
-- POR QUÉ NO SE RETIPEA LA FUNCIÓN. `verificar_invariantes` pasa los 8.000
-- caracteres. Copiarla entera para cambiar cuatro líneas es exactamente cómo se
-- rompe un guardarraíl: un error de transcripción en el archivo que protege la
-- cuenta. Y TAMPOCO se retipea el fragmento viejo — ese fue el error de la
-- primera versión, que dependía de que un literal de 600 caracteres con regex
-- escapado coincidiera al byte. Acá el bloque se ubica por dos marcas cortas y
-- estables, y se reemplaza por posición.
-- ============================================================================

do $$
declare
  def    text;
  ini    int;
  rel    int;
  viejo  text;
  nuevo  text;
  marca  text := 'select sum(conversions) into conv90 from keywords_daily';
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'verificar_invariantes';

  if def is null then
    raise exception 'No existe public.verificar_invariantes. No se toca nada.';
  end if;

  -- Si ya está arreglada, no hay nada que hacer. Idempotente a propósito: esta
  -- migración puede reintentarse sin miedo.
  if position('No hay historia semanal de' in def) > 0 then
    raise notice 'I3 ya estaba parcheada. No se toca nada.';
    return;
  end if;

  ini := position(marca in def);
  if ini = 0 then
    raise exception 'No encontre el bloque I3 (la consulta a keywords_daily). Alguien lo cambio: revisar a mano.';
  end if;

  -- El bloque va desde la consulta hasta el primer `end if;` posterior, que es
  -- el que cierra el `if coalesce(conv90, 0) > 0`.
  rel := position('end if;' in substring(def from ini));
  if rel = 0 then
    raise exception 'No encontre el cierre del bloque I3. Revisar a mano.';
  end if;

  viejo := substring(def from ini for rel + 6);

  -- Comprobacion de que se agarro lo que se cree: el bloque TIENE que nombrar el
  -- invariante. Sin esto, un `position` que apunte mal reemplazaria otra cosa.
  if position('I3_pausar_convierte' in viejo) = 0 then
    raise exception 'El bloque encontrado no menciona I3_pausar_convierte: el ancla apunta mal. No se toca nada.';
  end if;

  -- Sin variables nuevas: no hace falta tocar el bloque declare, que es otro
  -- lugar donde una migracion se rompe sola.
  nuevo :=
    'if not exists (select 1 from keywords k2 where k2.account = p_account and k2.week_start >= current_date - 91 and normalizar_entidad(k2.keyword) = normalizar_entidad(k)) then'
    || ' v := v || jsonb_build_object(''invariante'', ''I3_pausar_convierte'', ''bloquea'', true, ''detalle'', ''No hay historia semanal de "'' || k || ''" en 91 dias: no se puede saber si convierte, asi que no se pausa a ciegas. Si igual hay que pausarla, es una decision explicita de Andres, no un hueco.'');'
    || ' else'
    || ' select sum(k2.conversions) into conv90 from keywords k2 where k2.account = p_account and k2.week_start >= current_date - 91 and normalizar_entidad(k2.keyword) = normalizar_entidad(k);'
    || ' if coalesce(conv90, 0) > 0 then v := v || jsonb_build_object(''invariante'', ''I3_pausar_convierte'', ''bloquea'', true, ''detalle'', ''La keyword "'' || k || ''" convirtio '' || conv90 || '' veces en las semanas cerradas de los ultimos 91 dias. No se pausa.''); end if;'
    || ' end if;';

  def := overlay(def placing nuevo from ini for length(viejo));
  execute def;

  -- Verificacion despues de aplicar: que el arreglo este y que el bug no.
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'verificar_invariantes';
  if position('No hay historia semanal de' in def) = 0 then
    raise exception 'El parche se ejecuto pero el texto nuevo no quedo. Revisar a mano.';
  end if;
  if position('into conv90 from keywords_daily' in def) > 0 then
    raise exception 'El parche se ejecuto pero la consulta vieja a keywords_daily sigue ahi. Revisar a mano.';
  end if;

  raise notice 'I3 parcheado: historia semanal de 91 dias, y bloquea cuando no hay con que decidir.';
end $$;
