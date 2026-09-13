-- ============================================================================
-- LOS TRES LUGARES DONDE EL CIRCUITO ESTÁ CORTADO, con nombre y con trámite
-- ----------------------------------------------------------------------------
-- Los tres se verificaron contra los servicios reales el 13/9/2026, no se
-- dedujeron leyendo código. Ninguno es un bug del sistema: los tres son
-- configuración que falta afuera. Por eso van como tickets y no como fixes:
-- lo que hay que hacer no se puede hacer desde acá.
--
-- El patrón que comparten es el caro: los tres se ven, desde adentro, igual que
-- "no pasó nada". Un vacío producido por una llave que falta es indistinguible
-- de un vacío legítimo, y el sistema entero está construido sobre la idea de
-- que esa confusión es el modo de falla a evitar.
--
-- Sobre los `tipo`: el CHECK de la tabla admite cuatro — bug, mejora, pregunta,
-- dato_incorrecto — y no hay ninguno para "trámite externo", que es lo que en
-- rigor son dos de estos tres. Se usa el más cercano y cada descripción dice
-- explícitamente por qué le tocó ese, para que nadie lea "mejora" como capricho
-- ni "bug" como código roto donde no lo hay.
-- ============================================================================

insert into tickets (tipo, titulo, descripcion, pagina, cuenta, estado, creado_por) values

-- tipo 'mejora' y no 'bug': no hay nada roto en nuestro código. El cliente, la
-- tabla, el cron y las vistas funcionan; falta un permiso del lado de Google.
('mejora',
 'Keyword Planner: el token necesita acceso Basic',
 E'VERIFICADO contra la API real el 13/9/2026 llamando a /api/cron/demanda-mercado?client=KAREDO en produccion. Google responde:\n\n  403: "This method is not allowed for use with explorer access. Please apply for basic or standard access."\n\nLa documentacion de Google no lo menciona: detalla que generateKeywordHistoricalMetrics no consume la cuota de operaciones, y calla que exige nivel de acceso superior al de explorador.\n\nTIPO: va como "mejora" y no como "bug" porque no hay nada roto de nuestro lado. El cliente en gads.ts, la tabla, el cron y las vistas estan escritos y probados. Falta un permiso del lado de Google, y el CHECK de tickets no tiene un tipo para "tramite externo".\n\nQUE HACER: pedir Basic access para el developer token en el Centro de API de Google Ads (Herramientas > Configuracion > Centro de API). Es gratis y lo aprueban por formulario.\n\nQUE SE DESBLOQUEA: la tabla demanda_mercado, el cron mensual (dia 3), v_demanda_mensual, v_mercado_vs_nosotros y el bloque "El mercado, y vos dentro de el" en Semana. Todo eso se puebla solo en cuanto el permiso exista.\n\nPOR QUE IMPORTA: sin esta capa el sistema no puede separar una caida propia de una caida del mercado. Las dos se ven identicas en la tendencia diaria, y atribuirle a la gestion lo que es estacionalidad es el error mas caro que puede cometer un analisis.',
 'Semana', null, 'abierto', 'claude'),

-- tipo 'bug': acá sí hay algo roto en el circuito. Los endpoints están
-- desplegados y rechazan TODA entrega, y las reglas de dos cuentas declaran esa
-- fuente como la verdad. cuenta = null porque afecta a BHI y a 360 por igual.
('bug',
 'Los webhooks de cierres nunca pudieron entrar: faltan los secretos en Vercel',
 E'VERIFICADO en produccion el 13/9/2026 con un POST a cada endpoint. Los dos responden 503 "Webhook no configurado":\n\n  POST https://app-northsignal.vercel.app/api/webhooks/asana        -> 503\n  POST https://app-northsignal.vercel.app/api/webhooks/gohighlevel  -> 503\n\nCAUSA EXACTA: los handlers son fail-closed a proposito. Si ASANA_WEBHOOK_SECRET o GHL_WEBHOOK_SECRET no estan en las variables de entorno, rechazan la entrega antes de mirar el cuerpo (src/server/routes/webhooks.ts, lineas 173 y 297). Ninguna de las dos variables esta cargada en Vercel, asi que toda entrega venia siendo rechazada aunque Asana o GoHighLevel estuvieran configurados del otro lado.\n\nEsto explica lo que get_salud_sistema() viene diciendo: "Cierres reales del negocio: NUNCA RECIBIO NADA". Las reglas de 360 mandan usar v_cierres_totales y las de BHI declaran que la verdad esta en GoHighLevel. El agente va a buscar ahi, no encuentra nada, y tiene que saber que el flujo no esta conectado — no que no hubo cierres. Cero cierres y cero conexion se leen igual, y significan cosas opuestas.\n\nQUE HACER, en orden:\n 1. Generar los dos secretos y cargarlos en Vercel (Settings > Environment Variables): ASANA_WEBHOOK_SECRET y GHL_WEBHOOK_SECRET. Redeploy.\n 2. Registrar el webhook en Asana apuntando a /api/webhooks/asana. El handler ya contesta el handshake X-Hook-Secret.\n 3. En GoHighLevel, configurar el webhook con header Authorization: Bearer <GHL_WEBHOOK_SECRET>.\n 4. Confirmar que llego algo: select count(*) from webhook_events;  -- tiene que dejar de ser 0.\n\nLo hace Andres: son credenciales y configuracion en servicios de terceros.',
 'Sistema', null, 'abierto', 'claude'),

-- tipo 'bug': una comparacion que informa salud con datos congelados es una
-- falla de lectura, no una mejora pendiente.
('bug',
 'El espejo de Notion no lo refresca nadie',
 E'notion_espejo_cuentas se lleno el 8/9/2026 y ninguna tarea lo vuelve a tocar. No tiene latido, asi que tampoco aparece en v_tareas_en_silencio.\n\nEL PROBLEMA NO ES EL DATO VIEJO, ES COMO SE LEE: v_notion_vs_supabase devuelve una fila por campo que no coincide. Cero filas significa "Notion y Supabase coinciden" y significa exactamente lo mismo cuando el espejo esta congelado. El mismo vacio para dos estados opuestos, y el que envejece no genera ninguna fila que lo delate.\n\nYA HECHO: la relacion de verdad espejo_notion_al_dia (migracion 20260913120000) le pone vencimiento al silencio. Hoy pasa — el espejo tiene ~5 dias — y empieza a fallar a los 8, apareciendo en v_para_actuar con nombre propio en vez de seguir leyendose como salud. Su mutante esta escrito pero sin correr: figura como sin_probar, y hasta que no mate al mutante el control no cuenta.\n\nFALTA: la tarea que lo refresque. No se escribio en la sesion del 13/9 a proposito, y el motivo es la regla de no adivinar nombres de entidades: hace falta saber como se llaman exactamente las propiedades de la ficha de cliente en Notion (base e5f736fe-b4e5-4e3c-b827-fabc5db8a0c8) que corresponden a customer_id, moneda, presupuesto_diario, canales y facturacion. El codigo de server.ts ya lee de esa base pero solo toca Cliente, "Aprendizajes consolidados" e "Hipotesis abiertas".\n\nCON ESOS NOMBRES el sync entra derecho en el cron semanal de aprendizaje, que ya consulta esa misma base, mas un registro en latidos con tolerancia de 8 dias para que el dia que deje de correr se note.',
 'Sistema', null, 'abierto', 'claude');
