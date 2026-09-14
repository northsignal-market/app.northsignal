-- ============================================================================
-- I3 TIENE QUE FALLAR CERRADO: un guardarraíl que no puede medir no aprueba
-- ----------------------------------------------------------------------------
-- Es el único hallazgo de la auditoría del 14/9 que termina en un cambio real
-- en una cuenta de Google Ads.
--
-- I3 es el invariante que impide pausar una keyword que convierte. Tenía tres
-- defectos que se componen:
--
--   1. `current_date - 30` escrito a mano, que la doctrina prohíbe.
--   2. Le pedía 30 días a `keywords_daily`, que hoy tiene 22 (del 22/8 al 12/9)
--      porque el script la reextrae con LOOKBACK_DAYS = 14.
--   3. Y lo grave: `coalesce(conv90, 0) > 0`. Con CERO filas el guardarraíl
--      **calla**, y callar acá significa aprobar.
--
-- El síntoma completo: una keyword que convirtió hace veinte días no tiene
-- filas en la ventana, I3 no bloquea, el accionable queda `accion_valida`, y al
-- apretar "Aprobar y que se haga" el ejecutor pausa una keyword que convierte.
-- El guardarraíl no falla ruidosamente — aprueba.
--
-- La variable se llama `conv90`, la ventana dice 30 y el mensaje dice "30 dias":
-- tres números para una sola cantidad, que es la señal de que nadie los miró
-- juntos.
--
-- CÓMO SE ARREGLA:
--   · La historia de conversiones sale de `keywords` (semanal, 91 días), que es
--     lo que el propio esquema ya hace bien en `terminos_protegidos_actualizar`.
--   · Si no hay NINGUNA fila con la que decidir, BLOQUEA y lo dice. Un control
--     que no puede medir no está autorizado a dejar pasar; "no se puede saber
--     con estos datos" es una respuesta válida y acá la respuesta segura.
--
-- POR QUÉ ESTA MIGRACIÓN SE PARCHEA A SÍ MISMA: `verificar_invariantes` tiene
-- 8.420 caracteres. Retipearla entera para cambiar dos líneas es exactamente
-- cómo se rompe un guardarraíl — un error de transcripción en el archivo que
-- protege la cuenta. El DO de abajo lee la definición viva, reemplaza el
-- fragmento exacto y la vuelve a crear. Si el fragmento no está —porque alguien
-- ya la tocó— aborta sin hacer nada en vez de dejarla a medias.
-- ============================================================================

do $$
declare
  def   text;
  viejo text;
  nuevo text;
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'verificar_invariantes';

  if def is null then
    raise exception 'No existe public.verificar_invariantes. No se toca nada.';
  end if;

  viejo := 'select sum(conversions) into conv90 from keywords_daily where account = p_account and date >= current_date - 30 and normalizar_entidad(regexp_replace(keyword, ''^[\[\"]+|[\]\"]+$'', '''', ''g'')) = normalizar_entidad(k);
      if coalesce(conv90, 0) > 0 then v := v || jsonb_build_object(''invariante'', ''I3_pausar_convierte'', ''bloquea'', true, ''detalle'', ''La keyword "'' || k || ''" convirtio '' || conv90 || '' veces en 30 dias. No se pausa.''); end if;';

  nuevo := '-- La historia sale de la capa SEMANAL: keywords_daily se reextrae con 14 dias
      -- de lookback y hoy tiene 22, asi que preguntarle por 90 devuelve una ventana
      -- que no es la que se declara. keywords guarda 13 semanas.
      select sum(k2.conversions), count(*) into conv90, filas90
        from keywords k2
       where k2.account = p_account
         and k2.week_start >= current_date - 91
         and normalizar_entidad(regexp_replace(k2.keyword, ''^[\[\"]+|[\]\"]+$'', '''', ''g'')) = normalizar_entidad(k);
      if coalesce(filas90, 0) = 0 then
        -- SIN DATOS NO SE APRUEBA. Antes, cero filas hacia que el invariante
        -- callara, y callar acá es dejar pasar la pausa de una keyword que
        -- podria estar convirtiendo. Un guardarrail que no puede medir bloquea
        -- y explica por que; desbloquear es una decision de Andres, no del hueco.
        v := v || jsonb_build_object(''invariante'', ''I3_pausar_convierte'', ''bloquea'', true, ''detalle'', ''No hay historia semanal de "'' || k || ''" en 90 dias: no se puede saber si convierte. No se pausa a ciegas.'');
      elsif coalesce(conv90, 0) > 0 then
        v := v || jsonb_build_object(''invariante'', ''I3_pausar_convierte'', ''bloquea'', true, ''detalle'', ''La keyword "'' || k || ''" convirtio '' || conv90 || '' veces en 90 dias. No se pausa.'');
      end if;';

  if position(viejo in def) = 0 then
    raise exception 'El fragmento de I3 no esta como se esperaba: alguien ya toco la funcion. Revisar a mano antes de parchear.';
  end if;

  -- `filas90` es nueva y hay que declararla junto a las demas.
  def := replace(def, 'sim jsonb; conv90 numeric;', 'sim jsonb; conv90 numeric; filas90 bigint;');
  if position('filas90 bigint' in def) = 0 then
    raise exception 'No se pudo declarar filas90: cambio el bloque declare.';
  end if;

  def := replace(def, viejo, nuevo);
  execute def;
  raise notice 'I3 parcheado: ventana semanal de 90 dias y bloqueo ante ausencia de datos.';
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- EL MUTANTE. Un control no cuenta hasta que probó que puede fallar, y este
-- cambió de comportamiento en los dos sentidos, así que hay que probar los dos.
-- Correr a mano y leer las dos filas:
--
--   -- 1. Una keyword que NO existe: antes callaba (aprobaba), ahora bloquea.
--   select * from jsonb_array_elements(
--     verificar_invariantes('BHI', '{"verbo":"pausar_keyword","objeto":{"keyword":"esta-keyword-no-existe-en-ningun-lado"}}'::jsonb)
--   ) where value->>'invariante' = 'I3_pausar_convierte';
--   -- Esperado: una fila con bloquea=true y "no se puede saber si convierte".
--
--   -- 2. Una keyword real que convirtió: tiene que seguir bloqueando, con el
--   --    conteo de 90 días en vez del de 30.
--   select k.keyword, sum(k.conversions) conv
--     from keywords k where k.account='BHI' and k.week_start >= current_date - 91
--    group by 1 having sum(k.conversions) > 0 order by 2 desc limit 3;
--   -- Tomar una de esas y repetir la llamada de arriba con su texto exacto.
-- ────────────────────────────────────────────────────────────────────────────
