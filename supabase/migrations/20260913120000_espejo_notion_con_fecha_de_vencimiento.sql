-- ============================================================================
-- EL ESPEJO DE NOTION TIENE QUE TENER FECHA DE VENCIMIENTO
-- ----------------------------------------------------------------------------
-- v_notion_vs_supabase devuelve una fila por campo que no coincide. Cero filas
-- significa "Notion y Supabase coinciden"... y significa exactamente lo mismo
-- cuando el espejo quedó congelado. El mismo vacío para "todo bien" y para
-- "hace seis días que no miro".
--
-- Y quedó congelado: notion_espejo_cuentas se llenó el 8/9/2026 y ninguna tarea
-- lo vuelve a tocar. O sea que la comparación viene informando coincidencia con
-- un Notion que envejece solo, y nadie se entera, porque envejecer no genera
-- ninguna fila.
--
-- Esto es el modo de falla que el sistema declara como propio: una cifra
-- verosímil y equivocada, producida sin que nadie mienta. Se arregla con el
-- mecanismo que ya existe para eso —una relación de verdad— y no con una vista
-- nueva: así entra sola a v_relaciones_violadas › v_incidentes › v_para_actuar
-- y aparece en Sistema › Integridad sin plomería adicional.
--
-- Hoy la relación PASA (el espejo tiene ~5 días). Empieza a fallar a los 8, que
-- es cuando el dato deja de poder sostener la afirmación. Eso es lo que se
-- quiere: que el silencio tenga vencimiento.
--
-- PENDIENTE, y es de Andrés: falta la tarea que refresque el espejo. No se
-- escribió en esta sesión a propósito — requiere los nombres exactos de las
-- propiedades de la ficha de cliente en Notion (CID, moneda, presupuesto
-- diario, canales, facturación) y acá no se pueden leer. Adivinarlos rompe la
-- regla de no inventar nombres de entidades. Con esos nombres, el sync entra en
-- el cron semanal de aprendizaje, que ya consulta esa misma base de Notion.
-- ============================================================================

insert into relaciones_verdad
  (familia, nombre, que_afirma, sql_izquierda, sql_derecha, dominio_valido,
   tolerancia_rel, por_que_existe, activa, creada_el, ambito, mutante_sql,
   mutante_resultado)
values (
  -- La familia sale del CHECK de la tabla, que admite cuatro y ninguna se llama
  -- "frescura": conservacion, monotonia, equivalencia, invariante_dominio. Y ya
  -- hay precedente exacto — api_reconcilia_a_diario afirma "cada cuenta
  -- reconcilio en las ultimas 26 horas" contando filas frescas contra el total
  -- esperado, que es la misma forma que esta, y vive en invariante_dominio.
  -- Agrandar el CHECK para una sola fila fragmentaria la taxonomia con la que
  -- v_incidentes agrupa por clase.
  'invariante_dominio',
  'espejo_notion_al_dia',
  'Todas las filas del espejo de Notion se refrescaron hace menos de 8 dias. Si alguna quedo vieja, la comparacion Notion vs Supabase no esta comparando el Notion de hoy.',
  $i$select count(*)::numeric from notion_espejo_cuentas where sincronizado > now() - interval '8 days'$i$,
  $d$select count(*)::numeric from notion_espejo_cuentas$d$,
  $v$select exists (select 1 from notion_espejo_cuentas)$v$,
  0,   -- Como api_reconcilia_a_diario: se cuentan filas, no se miden magnitudes.
  'Cero filas en v_notion_vs_supabase significa "coinciden" y significa tambien "el espejo esta congelado": el mismo vacio para dos estados opuestos. El espejo se lleno el 8/9/2026 y ninguna tarea lo vuelve a tocar, asi que la comparacion informa coincidencia con datos que envejecen solos. Esta relacion le pone vencimiento a ese silencio: pasados los 8 dias la izquierda deja de igualar a la derecha y el incidente aparece en v_para_actuar con nombre propio, en vez de seguir leyendose como salud.',
  true,
  current_date,
  'global',
  -- DOS trampas que este mutante tuvo que aprender a esquivar, y las dos hacian
  -- que el control PARECIERA no funcionar:
  --  1. correr_relaciones() es imprescindible. v_relaciones_violadas lee de
  --     corridas_verdad, no evalua nada: sin una corrida nueva muestra el
  --     estado viejo.
  --  2. Hay que ordenar por id y NO por corrida_el. Dentro de una transaccion
  --     now() queda congelado, las dos corridas escriben el mismo timestamp y
  --     "la ultima" se vuelve ambigua — devuelve la de antes de mutar y el
  --     mutante parece sobrevivir.
  $m$begin;
  update notion_espejo_cuentas set sincronizado = now() - interval '30 days' where account = '360';
  select * from correr_relaciones();
  select * from corridas_verdad c join relaciones_verdad r on r.id = c.relacion_id
   where r.nombre = 'espejo_notion_al_dia' order by c.id desc limit 1;
rollback;$m$,
  -- Corrido el 13/9/2026 dentro de un DO que termina en RAISE, para que el
  -- rollback lo garantice el motor y no el modo de commit del cliente:
  -- cumple (izq 4) -> viola (izq 3, der 4, desvio 25%). El control atrapa.
  'mato_al_mutante'
)
on conflict (nombre) do nothing;
