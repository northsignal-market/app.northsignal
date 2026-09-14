-- ============================================================================
-- I4 DICE CUÁNDO NO PUDO MEDIR, EN VEZ DE DESAPARECER
--
-- I4_concordancia_keyword_principal avisa cuando la keyword que se va a cambiar
-- de concordancia es la que trae la mayoría de las conversiones del grupo:
-- "medir 14 días antes de otra cosa acá". Tiene el mismo defecto de ventana que
-- tenía I3, pero con UNA DIFERENCIA QUE NO SE APLANA:
--
--     I3  lleva 'bloquea' TRUE.  Fallar abierto = APROBAR una pausa.
--     I4  lleva 'bloquea' FALSE. Fallar abierto = una advertencia que no sale.
--
-- Por eso van en migraciones separadas y por eso I4 SIGUE SIENDO UN AVISO. No se
-- convierte en bloqueante: eso cambiaría lo que el invariante significa, y esa es
-- una decisión de Andrés, no un efecto colateral de arreglar una ventana.
--
-- LO QUE SÍ CAMBIA. Hoy hace:
--
--   select sum(conversions) into conv90  from keywords_daily ... current_date - 30 ...;
--   select sum(conversions) into topconv from keywords_daily ... and ad_group = grupo;
--   if coalesce(conv90,0) > 0 and coalesce(topconv,0) > 0 and conv90/topconv > 0.4
--
-- Con cero filas —o con `grupo` nulo, que hace `topconv` nulo— las dos guardas
-- son falsas y el aviso NO APARECE. Quien lee la pantalla ve un accionable sin
-- advertencias y entiende "revisé y no hay problema", cuando lo cierto es "no
-- pude mirar". Las dos cosas se ven idénticas: la ausencia de un aviso.
--
-- Ahora:
--   · La historia sale de `keywords` (semanal, 91 días), igual que I3.
--   · Si no hay con qué calcular la proporción, EMITE UN AVISO QUE LO DICE, en
--     vez de callarse. Sigue con 'bloquea' false: informa, no frena.
--   · `grupo` nulo se declara como tal, porque sin grupo no hay denominador y eso
--     es una razón distinta de "no hay datos".
--
-- La técnica es la misma que funcionó con I3: ubicar el bloque por marcas cortas,
-- comprobar que lo agarrado menciona el invariante, reemplazar por posición, y
-- verificar DESPUÉS contando — no preguntando "¿queda alguna?", que fue el error
-- que hizo abortar el primer intento de I3.
-- ============================================================================

do $$
declare
  def    text;
  ini    int;
  pi4    int;
  rel    int;
  viejo  text;
  nuevo  text;
  antes  int;
  marca  text := 'select sum(conversions) into conv90 from keywords_daily';
begin
  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'verificar_invariantes';

  if def is null then
    raise exception 'No existe public.verificar_invariantes. No se toca nada.';
  end if;

  if position('no se pudo medir la proporcion' in def) > 0 then
    raise notice 'I4 ya estaba parcheada. No se toca nada.';
    return;
  end if;

  antes := (length(def) - length(replace(def, 'into conv90 from keywords_daily', '')))
           / length('into conv90 from keywords_daily');
  if antes <> 1 then
    raise exception 'Se esperaba UNA consulta vieja a keywords_daily (la de I4) y hay %. I3 no esta parcheada o alguien mas toco la funcion.', antes;
  end if;

  ini := position(marca in def);
  if ini = 0 then
    raise exception 'No encontre el bloque I4. Revisar a mano.';
  end if;

  -- El bloque abarca las DOS consultas y el if: termina en el primer `end if;`
  -- posterior a donde se nombra el invariante.
  pi4 := position('I4_concordancia_keyword_principal' in substring(def from ini));
  if pi4 = 0 then
    raise exception 'El bloque encontrado no menciona I4_concordancia_keyword_principal: el ancla apunta mal. No se toca nada.';
  end if;
  -- `position` devuelve 1-based DENTRO del substring, asi que la posicion relativa
  -- a `ini` es pi4 + p, no pi4 + p - 1. El -1 de mas dejaba el bloque cortado en
  -- "end if" sin el punto y coma, lo que habria producido una funcion que ni
  -- compila. Lo agarre simulando el calculo con el texto real antes de correrlo.
  rel := pi4 + position('end if;' in substring(def from ini + pi4));
  if rel <= pi4 then
    raise exception 'No encontre el cierre del bloque I4. Revisar a mano.';
  end if;

  viejo := substring(def from ini for rel + 6);
  if position('topconv' in viejo) = 0 then
    raise exception 'El bloque agarrado no incluye la consulta de topconv: estaria quedando a medias. No se toca nada.';
  end if;

  nuevo :=
       'select sum(k2.conversions) into conv90 from keywords k2 where k2.account = p_account and k2.week_start >= current_date - 91 and normalizar_entidad(k2.keyword) = normalizar_entidad(kw);'
    || ' select sum(k3.conversions) into topconv from keywords k3 where k3.account = p_account and k3.week_start >= current_date - 91 and k3.ad_group = grupo;'
    || ' if grupo is null then'
    || ' v := v || jsonb_build_object(''invariante'', ''I4_concordancia_keyword_principal'', ''bloquea'', false, ''detalle'', ''La accion no dice en que grupo esta la keyword, asi que no se pudo medir la proporcion de conversiones que aporta. Ausencia de aviso no es ausencia de riesgo.'');'
    || ' elsif coalesce(topconv, 0) = 0 then'
    || ' v := v || jsonb_build_object(''invariante'', ''I4_concordancia_keyword_principal'', ''bloquea'', false, ''detalle'', ''El grupo "'' || grupo || ''" no registra conversiones en las semanas cerradas de los ultimos 91 dias: no se pudo medir la proporcion que aporta "'' || kw || ''". No es que no aporte.'');'
    || ' elsif coalesce(conv90, 0) / topconv > 0.4 then'
    || ' v := v || jsonb_build_object(''invariante'', ''I4_concordancia_keyword_principal'', ''bloquea'', false, ''detalle'', ''La keyword "'' || kw || ''" trae el '' || round(coalesce(conv90, 0) / topconv * 100) || ''% de las conversiones de '' || grupo || '' en 91 dias. Medir 14 dias antes de otra cosa en el grupo.'');'
    || ' end if;';

  def := overlay(def placing nuevo from ini for length(viejo));
  execute def;

  select pg_get_functiondef(p.oid) into def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'verificar_invariantes';

  if position('no se pudo medir la proporcion' in def) = 0 then
    raise exception 'El parche se ejecuto pero el texto nuevo no quedo. Revisar a mano.';
  end if;
  if (length(def) - length(replace(def, 'into conv90 from keywords_daily', '')))
     / length('into conv90 from keywords_daily') <> 0 then
    raise exception 'Todavia queda una consulta a keywords_daily con into conv90. Revisar a mano.';
  end if;
  if position('into topconv from keywords_daily' in def) > 0 then
    raise exception 'La consulta de topconv sigue apuntando a keywords_daily. Revisar a mano.';
  end if;
  -- I4 tiene que seguir siendo un AVISO. Si quedo bloqueante, se cambio lo que el
  -- invariante significa y eso no es este arreglo.
  if position('''I4_concordancia_keyword_principal'', ''bloquea'', true' in def) > 0 then
    raise exception 'I4 quedo como bloqueante y tiene que seguir siendo un aviso. Revisar a mano.';
  end if;

  raise notice 'I4 parcheado: ventana semanal de 91 dias, y avisa cuando no pudo medir en vez de callarse.';
end $$;
