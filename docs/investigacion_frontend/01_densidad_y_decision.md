# 01 · Densidad de información y diseño orientado a decisión

**Investigación frontend · NorthSignal**
Fecha: 12 de septiembre de 2026.
Método: 34 fuentes abiertas y leídas en la web (WebFetch) con contenido sustancial — numeradas 1-34 — más 5 complementarias leídas solo desde resultados de búsqueda con contenido sustantivo (numeradas 35-39 y marcadas como tales). Se priorizó documentación oficial de design systems (Linear, Vercel Geist, Stripe, IBM Carbon, Grafana, Datadog, GitHub), Nielsen Norman Group, y artículos técnicos con autor y fecha. Se descartaron listicles sin sustancia y URLs que no cargaron (Material m2/m3, PDF de Perceptual Edge, Medium con 403, height.app caído, Apple HIG con contenido dudoso).

**El eje:** el dolor declarado del usuario es *"no quiero 8000 displays de data que no influye en mi toma de decisiones; quiero comodidad de decisión"*. Toda la investigación se filtró contra esa vara.

---

## Resumen ejecutivo — las 7 tesis que dejó la investigación

1. **Un dashboard es una pregunta contestada, no un catálogo de datos.** Grafana lo dice literal: "a dashboard should tell a story or answer a question" [5]. Setproduct lo operacionaliza: escribí la pregunta que responde cada vista en menos de 12 palabras antes de diseñarla; una pantalla, una decisión [8].
2. **La jerarquía correcta es la del mantra de Shneiderman (1996), que sigue vigente en 2026:** overview primero, zoom y filtro después, detalle bajo demanda [1][35]. Los productos admirados (Stripe, Linear, Grafana) son implementaciones disciplinadas de ese mantra, no invenciones nuevas.
3. **De Tufte sobrevivió el principio, no la doctrina.** "Si un pixel no informa una decisión, no va en la vista primaria" sigue siendo la vara [36][4]. Pero el data-ink ratio como métrica literal está cuestionado con evidencia: minimizar tinta al extremo produce gráficos ilegibles e inaccesibles [6].
4. **Señal vs ruido es un problema de diseño de alertas, no de cantidad de datos.** La regla de oro compartida por Grafana, Datadog y PagerDuty: si no hay una acción posible, no es una alerta — es contexto, y va en otro lado [9][10][11].
5. **Para números: tabular figures siempre, delta + ventana siempre, redondeo agresivo.** Un número absoluto sin comparación no soporta una decisión [8][13][14][15].
6. **Tablas para comparar y decidir sobre homogéneo; cards solo para heterogéneo explorable; listas para colas.** NN/g es inequívoco: cards para contenido homogéneo destruyen la escaneabilidad [18][19][20][21].
7. **El patrón de inbox ganador (Linear, Superhuman, GitHub) es: cola única, un ítem enfocado a la vez, 3-4 acciones máximas con tecla asignada, y el ítem desaparece al decidirse.** La comodidad de decisión sale de reducir cada ítem a un veredicto binario o ternario, no de mostrar más contexto [24][25][28][29].

---

## Tema 1 · Progressive disclosure y el mantra de Shneiderman en dashboards operativos

### El mantra original y sus 7 tareas

El "Visual Information-Seeking Mantra" viene del paper de Ben Shneiderman *The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations* (IEEE Symposium on Visual Languages, 1996): **"Overview first, zoom and filter, then details-on-demand"** [1]. El paper define 7 tareas: overview, zoom, filter, details-on-demand, relate (ver relaciones), history (deshacer/rehacer pasos) y extract (extraer subconjuntos) [1]. Treinta años después sigue siendo el esqueleto de todo dashboard operativo serio: la implementación moderna son los paradigmas overview+detail, focus+context y drill-down [35].

### Progressive disclosure según NN/g

Jakob Nielsen (2006) define progressive disclosure como diferir lo avanzado o poco usado a una pantalla secundaria [2]. Mejora tres cosas a la vez:

- **Aprendibilidad**: el novato ve solo lo esencial.
- **Eficiencia**: el experto no escanea opciones que no necesita.
- **Tasa de error**: lo confuso queda escondido hasta que se pide.

Distinción importante: **progressive** disclosure es jerárquica (mostrar/ocultar, expandir, drill-down); **staged** disclosure es lineal (wizards paso a paso). Para un operador experto que vuelve todos los días, la jerárquica es la correcta; los wizards castigan al que ya sabe [2].

**Matiz crítico para una app de un solo operador experto:** la literatura de dashboards SaaS genéricos recomienda "5-7 tarjetas de resumen y expandir bajo demanda" porque la memoria de trabajo sostiene 4-7 unidades [36]. Eso aplica a la *capa de decisión*. Pero para el experto que opera la misma pantalla a diario, la densidad alta *dentro de una zona* no es enemiga: Grafana muestra 20+ paneles legibles y Linear mete filas de 36px sin que nadie se pierda [7]. La clave no es "menos datos" sino **menos niveles compitiendo por atención al mismo tiempo**.

### Cómo lo implementa Grafana (documentación oficial)

La guía de best practices de Grafana es la codificación más completa del mantra en un producto real [5]:

- Un dashboard debe **contar una historia o responder una pregunta**; si un panel exige pensar demasiado, está mal diseñado.
- Progresión de lo general a lo específico: dashboards jerárquicos con **drill-down por links dirigidos**, no exploración aleatoria.
- Métodos formales para elegir qué mostrar: **USE** (utilización/saturación/errores, para recursos), **RED** (rate/errors/duration, para servicios) y **Four Golden Signals** (Google SRE). Detalle valioso: RED reporta *síntomas* y no causas, por eso es el preferido para la capa de alertas [5].
- Anti-patrones documentados: sprawl de dashboards, refresh más frecuente que el dato, duplicación, ejes sin normalizar, stacking engañoso.
- Documentación embebida: paneles de texto y descripciones por panel, para que el "por qué existe esto" viva en el dashboard [5].

---

## Tema 2 · Tufte en 2025-2026: qué sobrevivió y qué se descartó

### Lo que sobrevivió

- **La vara decisional**: cada número visible debería informar una decisión o disparar una acción; si una métrica cambia y tu comportamiento no cambia, no pertenece a la vista primaria [36][37]. Esta reformulación moderna del data-ink es exactamente el dolor del usuario de NorthSignal.
- **Depuración de junk**: sacar gridlines pesadas, colores decorativos, 3D, gauges radiales. NN/g coincide desde percepción: pie charts, treemaps, gauges y 3D comprometen la lectura rápida; barras, líneas y scatter la maximizan porque longitud y posición 2D son los atributos preatentivos más precisos [3].
- **Decluttering ≠ simplificar**: Smashing Magazine (Fard, 2021) lo precisa: no es sacar funcionalidad, es mover lo secundario a hovers, paneles y modales, y dejar respirar lo primario con espacio en blanco [4].

### Lo que se descartó

Frank Elavsky (investigador de accesibilidad en data viz, abril 2025) publicó la crítica más citada del bienio: **el data-to-ink ratio como métrica es una heurística imprecisa sin base empírica sólida** [6]. Su demostración satírica ("ink golf": reducir cada dato a un pixel logra ratio casi perfecto y resultado inservible) muestra que optimizar tinta no optimiza comprensión. Además, la investigación en "Just Noticeable Differences" que podría justificar el minimalismo extremo no incluye personas con baja visión: **el minimalismo extremo es un riesgo de accesibilidad, no una virtud** [6]. Su recomendación: diseñar por contexto, audiencia e impacto, no por ratio.

**Síntesis operativa:** usá a Tufte como filtro de entrada ("¿este elemento informa una decisión?") y no como estética de salida. Bordes sutiles, fondos de zona, labels directos y redundancia moderada (color + texto) son "tinta no-dato" que **compra velocidad de decisión y accesibilidad** — se quedan.

---

## Tema 3 · Dashboards de decisión: qué va arriba, qué se entierra, y cómo se evita la alert fatigue

### Qué va arriba: lo accionable; qué se entierra: lo contextual

- **Stripe** es el caso de estudio más limpio: la home del dashboard muestra **5 números** (volumen bruto, volumen neto, clientes nuevos, pagos exitosos, comparación de período), cada uno con sparkline de tendencia. "Muestra exactamente lo que necesitás para actuar, no todo lo que podrían mostrar." Sin grillas personalizables, sin botón "agregar métrica" [13].
- **Setproduct (Kamushken, 2024)** da el framework numérico más concreto encontrado [8]:
  - Una pantalla = una decisión; comprensible en 2 segundos.
  - **Cambio sobre foto**: nunca un absoluto solo; siempre `valor + delta + ventana` ("+8,2% vs últimos 7 días").
  - **Redondeo agresivo**: <1K exacto; 1K-999K un decimal (12,4K); ≥1M un decimal (1,2M); porcentajes máximo un decimal. La precisión de más es ruido decisional.
  - **Densidad sigue al valor**: zonas de alto valor con gutters apretados (8-12px), zonas secundarias con padding generoso (24-32px), apuntando a un contraste de densidad ~3:1 para que el ojo caiga donde está la respuesta.
  - Timestamp "última actualización" siempre visible — crítico cuando el dato madura, como las conversiones de Google Ads.
- **El North Star Framework (Amplitude)** aporta la jerarquía conceptual: una métrica norte arriba y debajo sus *input metrics* — las palancas accionables que la mueven [12]. Traducido a operación de Ads: arriba el resultado que juzga la cuenta (CPA/conversiones según la cuenta), debajo solo los inputs sobre los que el operador puede actuar hoy; todo lo demás es contexto enterrable en drill-down.
- **La crítica "Dashboards are Dead" (Taylor Brownlow / Count.co)** documenta el modo de falla contrario: dashboards de 67 páginas, pedidos infinitos de filtros, gente exportando a Excel porque no confía en el número. Su conclusión a 3 años: el problema no era el dashboard sino el proceso alrededor — quién decide qué merece estar y quién responde cuando el número sorprende [39].

### Alert fatigue: el consenso de tres vendors

Grafana [9], Datadog [10] y PagerDuty [11] convergen en el mismo cuerpo de reglas:

1. **Si no hay acción posible, no es alerta.** Grafana literal: "solo alertá si existe una acción; si no hay nada que hacer, usá dashboards en su lugar" [9].
2. **Pocas alertas de alta calidad > muchas de baja.** Eliminá periódicamente las que no generaron acción; PagerDuty documenta el promedio absurdo de 4.484 alertas diarias en equipos SecOps como caso terminal [11].
3. **Síntomas sobre causas**: alertar por lo que afecta el resultado (CPA disparado, gasto anómalo), no por eventos internos; lo interno es contexto de diagnóstico en canal de baja severidad [9].
4. **Estabilización**: exigir que la condición persista (pending periods, agregaciones tipo `avg_over_time`) antes de disparar; evita reaccionar a picos transitorios — directamente aplicable a los datos direccionales de Google que maduran días [9].
5. **Agrupación**: consolidar alertas relacionadas en una sola notificación cuando un problema causa múltiples síntomas [9][11].
6. **Cada alerta explica por qué existe, qué la disparó y cómo investigar**, con link al detalle (runbook/drill-down) [9].
7. **Severidades por confianza, no por reactividad**: escalar cuando correlacionan varias señales, no ante una aislada [9].
8. **Cuidado con el falso positivo semántico**: una relación que "no aplica" no es una falla — tratarla como falla es como mueren las alertas (esto NorthSignal ya lo tiene aprendido con `no_aplicaba`; la literatura de alerting lo confirma como principio general).

### Contra el sprawl (Datadog)

Convenciones de nombre ("Servicio - Entorno - Propósito"), tags de propiedad, template variables para no duplicar vistas por entidad, módulos curados reutilizables (Powerpacks), y auditorías periódicas que borren lo que nadie mira [10]. Para una app interna: cada vista nueva necesita justificar qué pregunta responde o no se agrega.

---

## Tema 4 · Tipografía y espaciado para leer números; dark UI y WCAG

### Números que se leen rápido

- **Tabular figures (`font-variant-numeric: tabular-nums`) son esenciales en columnas de números y en cualquier valor que cambia en vivo**: con figuras proporcionales el "1" es flaco y el "8" gordo, y el layout salta cuando el número cambia [14][15]. Butterick: tabulares "esenciales" para tablas; proporcionales mejor para prosa; lining figures para contextos con mayúsculas [14]. Tailwind 4 lo expone directo: `tabular-nums`, combinable con `slashed-zero` para desambiguar 0/O en datos financieros [15].
- **Inter** (la fuente de Linear) trae `tnum`, `zero` y `case` de fábrica, con variante **Inter Display** para tamaños grandes — exactamente el par que Linear adoptó en su rediseño: Display para encabezados, regular para todo lo demás [16][22].
- **Jerarquía tipográfica con presupuesto fijo**: NN/g (Gordon, 2021) recomienda máximo 3 tamaños por vista (chico/mediano/grande), máximo 2 elementos grandes, y 2-3 niveles de contraste; el "squint test" (entrecerrar los ojos) valida que la jerarquía sobreviva sin leer [17]. Stripe usa un rango restringido de **6 tamaños/pesos en todo el dashboard** para crear jerarquía sin depender del color [13].
- **La escala visual comunica la importancia decisional**: el número de decisión grande y con delta; el contexto en cuerpo chico y gris. La jerarquía tipográfica ES la jerarquía decisional.

### Dark UI que cumple WCAG

Consenso de las fuentes de dark mode [26][27][34] más los sistemas de Stripe [30], Vercel [31] y Datawrapper [33]:

- **Nada de negro puro de fondo ni blanco puro de texto.** Base gris oscuro (#121212 es la referencia heredada de Material Design, citada por Toptal y Onething [34][26]); texto blanco apagado (#E8E8E8 o rgb(250,250,250)) para evitar el "glow" vibrante [26][27]. El navy #1A1F36 de NorthSignal está en la zona correcta (oscuro, con tinte azul — práctica recomendada explícitamente [34]).
- **Elevación por superficie más clara, no por sombra**: las sombras desaparecen en fondo oscuro; la jerarquía de profundidad se hace con 3-4 niveles de superficies progresivamente más claras y/o bordes sutiles [34][26].
- **Roles de tono fijos (patrón Geist)**: con una paleta de 4 colores, la profundidad exige derivar *tonos* del navy. Geist codifica el método: escala de 10 pasos donde 1-3 son fondos (default/hover/active), 4-6 bordes, 7-8 fondos de alto contraste, 9-10 texto secundario/primario; más dos backgrounds de página para diferenciar lienzo de superficie [31].
- **Contraste**: WCAG AA = 4,5:1 texto normal, 3:1 texto grande y componentes. **El punto ciego documentado: los elementos secundarios** — placeholders, disabled, captions, ejes de gráficos — son los que típicamente caen debajo del mínimo en dark [26].
- **Desaturar el color en dark**: colores saturados "vibran" contra fondo oscuro; acentos más claros y menos saturados que en light, máximo 2-3 acentos [34][26].
- **Método Stripe para acentos accesibles**: trabajar el color en espacio perceptual (CIELAB) en vez de HSL/RGB, para que todos los acentos tengan el mismo peso visual y contraste predecible contra el fondo [30]. Linear llegó a lo mismo con **LCH** en su rediseño 2024, y redujo el sistema a 3 variables (base, acento, contraste) [22].
- **Series de gráficos en dark**: Datawrapper resuelve dark mode con un algoritmo de contraste que re-deriva colores de series, gridlines y anotaciones — la lección para recharts: no reusar los hex de light; definir la paleta de series validada contra el fondo oscuro [33].
- **Micro-tipografía en dark**: levemente más interlineado y evitar pesos ultrafinos, que se "comen" contra fondo oscuro [26].

---

## Tema 5 · Cards vs tablas vs listas: cuándo cada una

La investigación de NN/g da un árbol de decisión claro:

| Estructura | Cuándo | Por qué |
|---|---|---|
| **Tabla** | Comparar atributos entre ítems homogéneos; encontrar registros; actuar en lote | Dos datos adyacentes se comparan sin mover los ojos ni cargar memoria de trabajo [18][19] |
| **Lista** | Colas, triage, contenido homogéneo escaneable, buscar algo específico | Máxima escaneabilidad y densidad vertical; ordenable [20] |
| **Cards** | Contenido heterogéneo, exploración sin objetivo puntual, dashboard de módulos distintos | Agrupación visual fuerte ("regiones comunes"); pero ocupan más espacio y **matan la comparación** [20] |

Hallazgos específicos:

- **Cards para contenido homogéneo es el error #1**: obliga a reorientarse espacialmente en cada card y vuelve la comparación lenta y costosa [18][20]. Una grilla de cards de campañas con métricas es objetivamente peor que una tabla de campañas.
- **NN/g Data Tables (Laubheimer, 2022)** — las 4 tareas de usuario: encontrar registros, comparar, ver/editar uno, actuar sobre varios. Recomendaciones: primera columna = identificador legible por humanos (no IDs); headers congelados; zebra striping y hover row; columnas ocultables/reordenables; **edición en panel lateral no modal** (para no tapar las filas vecinas que sirven de referencia); checkboxes + barra de acciones en lote [19].
- **Comparison tables (Moran & Dykes, 2024)**: máximo 5 ítems comparados (2 en móvil); atributos como filas, ítems como columnas; texto telegráfico, no oraciones [18].
- **IBM Carbon** codifica densidad de tabla como decisión de primer orden: 5 alturas de fila (xs→xl; la xl solo si el contenido ocupa 2 líneas), zebra opcional para escaneo horizontal, **expandable rows** para meter el detalle secundario dentro de la fila (progressive disclosure en tabla), batch action bar que aparece al seleccionar, y overflow menu visible u on-hover para bajar ruido [21]. Los benchmarks 2026 de dashboards convergen en filas de 48-52px estándar o 36-40px densas [7].
- **Card view vs list view (NN/g)**: la lista gana para sorting y espacio; la card para engagement visual y agrupamiento — en una herramienta interna de operación diaria, el engagement visual no es objetivo: **default a listas y tablas; cards solo como contenedores de módulos de distinta naturaleza** [20].

---

## Tema 6 · Patrones de inbox/triage: cómo diseñan colas de decisión los mejores

### Linear (Triage)

- Cola separada del backlog: todo lo que entra desde afuera (integraciones tipo Slack/Sentry, no-miembros) cae en Triage y **no contamina el flujo del equipo hasta ser aceptado** [24].
- **4 acciones exactas, cada una con tecla**: aceptar (`1`), duplicado/merge (`2`), declinar (`3`), posponer/snooze (`H`). Navegación global instantánea (`G+T`) [24].
- Responsable designado con rotación (integra PagerDuty/Opsgenie/Rootly) — la cola siempre tiene dueño [24].
- El principio: revisar-actualizar-priorizar **antes** de que algo entre al workflow; la decisión es barata porque el menú es corto [24].
- El rediseño 2024 (Saarinen) aporta el marco visual: navegación en "L invertida" (chrome global fijo, contenido como lienzo), reducción sistemática de ruido visual en sidebar/tabs/headers (alineación estricta de labels, iconos y botones), énfasis por elevación y contraste, y menos color de chrome para que el color que queda signifique algo [22]. LogRocket documenta la contracara: el estilo "Linear" ya es un género (denso, oscuro, sobrio, alto contraste) y su riesgo es la homogeneidad, no la ilegibilidad [23].

### Superhuman

- **Split inbox**: la bandeja única se divide en 3-7 flujos por naturaleza (Importante / Equipo / Calendario / Noticias / Otros) — cada split es una cola con contexto homogéneo, así cada decisión se toma en modo mental constante [29].
- **Un ítem enfocado a la vez** con acciones a una tecla (E archivar, R responder, J/K navegar; 100+ atajos estilo vim) [29].
- **Optimistic UI + undo (`Z`)**: la acción se refleja al instante y la red de seguridad es deshacer, no confirmar. Confirmar cada acción mata el ritmo de triage [29].
- **Cmd+K como sistema de entrenamiento**: cada uso del command palette muestra el atajo correspondiente, creando aprendizaje pasivo [29].
- Objetivo interno de latencia percibida 50-60ms (públicamente "regla de 100ms"): "speed is the product"; los cinco principios de velocidad percibida son fricción cognitiva mínima (Ley de Hick), consistencia espacial del layout, optimistic UI, tipografía optimizada para escaneo y keyboard-first — **la velocidad es un problema de diseño antes que técnico** [28][29].

### GitHub Notifications

- **Estados explícitos de triage**: unread / read / **saved** (para después, retenido indefinidamente) / **done** (retenido 5 meses, consultable con `is:done`) / unsubscribed. El inbox es una máquina de estados, no una lista de no-leídos [25].
- **Filtros por defecto orientados a "por qué me llegó esto"**: assigned, participating, review requested, mentioned — el motivo de llegada es la primera dimensión de triage; hasta 15 filtros custom con query [25].
- Triage en lote con selección múltiple [25].

### Height (leída vía resultados de búsqueda; el sitio no respondió)

- Team inbox como lista de entrada + movimiento post-triage a lista priorizada; smart lists guardadas de búsquedas con "subsection by" para vistas de pájaro; atributos custom como dimensiones de triage [38].

### El patrón destilado

1. Cola separada de lo ya aceptado; lo nuevo no contamina lo priorizado.
2. Motivo de llegada visible (por qué esto pide tu decisión).
3. Menú de decisión corto y constante (3-5 verbos máximo), con tecla.
4. Snooze/posponer como ciudadano de primera (decidir "ahora no" es una decisión válida).
5. El ítem decidido desaparece de la vista ya.
6. Optimistic UI + deshacer, nunca modal de confirmación para acciones reversibles.
7. Estado "done" consultable (auditoría) pero fuera de la vista.

---

## Tema 7 · Qué hacen los dashboards de operación admirados (2024-2026)

- **Stripe**: jerarquía por *jobs* del usuario (Payments, Payouts, Customers, Disputes...) y no por modelo de datos; 5 KPIs arriba con sparklines; **color reservado exclusivamente a estado** (verde éxito / rojo fallo / amarillo pendiente), todo lo demás monocromo; microcopy que dice qué pasó y qué hacer ("Tu tarjeta fue rechazada. Contactá tu banco o probá otro método"); restraint visual como señal de confianza [13]. Su sistema de color se construyó en espacio perceptual para contraste garantizado [30].
- **Linear**: densidad sin desorden (filas de 36px), L invertida, jerarquía por elevación y contraste en vez de color, LCH con 3 variables base, temas de alto contraste como opción de accesibilidad [22][7].
- **Vercel (Geist)**: sistema de color de alto contraste con **roles numerados fijos** (100 fondo default → 1000 texto primario), dos niveles de background para diferenciar página vs superficie; grid como parte central de la estética; iconografía específica para herramientas de developer [31][32].
- **Grafana**: dashboards como respuestas a preguntas; drill-down dirigido por links; template variables para una vista → N entidades (el patrón exacto para "4 cuentas, una plantilla"); color solo semántico con umbrales; documentación embebida en paneles [5].
- **Datadog**: governance del sprawl — naming conventions, ownership por tags, módulos reutilizables (Powerpacks), auditorías de uso [10].
- **Benchmarks de layout 2026** (síntesis de los cuatro productos anteriores): sidebar 256px colapsable a 64px; franja de 4-6 KPIs sobre el fold; grid de 12 columnas con gutters de 24px; alturas de módulo `minmax(200px, auto)`; items de navegación de 36px [7].
- **La tendencia agregada 2024→2026**: menos color estructural (el chrome pierde el azul: lo hizo Linear en 2024-2025, lo evita Stripe), más jerarquía por peso tipográfico/elevación/espaciado, y el color queda como **canal exclusivo de semántica de estado** [22][23][13]. En paralelo, la crítica anti-dashboard ("Dashboards are Dead") empujó a que el dashboard operativo se piense como *superficie de decisión* con menos vistas exploratorias — la exploración se delega a herramientas de query (en NorthSignal: SQL contra Supabase), no a 40 filtros en la UI [39].

---

## Síntesis aplicada a NorthSignal

Traducción directa de los hallazgos al producto (React 19 + Tailwind 4 + recharts 3, dark UI de 4 colores, un solo operador experto):

1. **Bandeja = el patrón Linear/GitHub/Superhuman completo.** Cola separada, motivo de llegada visible por ítem, 3-4 verbos con tecla (aprobar / rechazar / posponer / abrir detalle), snooze de primera clase, optimistic UI con deshacer, ítem decidido desaparece. `v_para_actuar` vacía = pantalla vacía que lo diga con orgullo ("no hay nada que decidir hoy"), no módulos de relleno.
2. **Arriba de cada vista de Cuenta: la pregunta respondida en ≤5 números**, cada uno con delta y ventana explícita ("CPA €41,20 · +8,2% vs 7d ant."), sparkline opcional, redondeo agresivo. El resto (términos, grupos, historial) vive en drill-down/expandibles. Métrica norte por cuenta arriba (CPA para KAREDO, etc.), inputs accionables debajo, contexto enterrado.
3. **Jerarquía de urgencia tipo alerting**: lo que pide acción (rojo/estado), lo que merece ojo (ámbar, agrupado), lo informativo (sin color, en secciones colapsadas). Nunca elevar a "alerta" algo sin acción posible — la regla Grafana literal. Timestamp de frescura del dato siempre visible, porque las conversiones maduran.
4. **Datos = tablas, no cards.** Filas 36-44px, primera columna identificador legible, tabular-nums alineados a la derecha, headers fijos, zebra opcional, expandable rows para el detalle, panel lateral (no modal) para el ítem, checkboxes + barra batch. Cards solo para módulos heterogéneos del overview.
5. **Tipografía**: Inter o equivalente con `tabular-nums` + `slashed-zero` en todo número; presupuesto de 3 tamaños por vista (~6 en todo el sistema, como Stripe); el número decisional grande, el contexto chico y gris.
6. **Paleta**: derivar del navy #1A1F36 una escala de 8-10 tonos con roles fijos (patrón Geist) para fondos/bordes/texto; elevación por superficie más clara, no sombra; #F5F7FA como texto masivo (blanco apagado, rol correcto); verificar #0062CC como *texto* sobre navy (probable falla AA — reservarlo a fondos de acción y estados, con texto blanco encima); acentos de estado desaturados validados contra dark; paleta de series de recharts re-derivada para dark, no los hex de light.
7. **Template-variable thinking**: una plantilla de vista de cuenta parametrizada por cuenta, no cuatro vistas mantenidas a mano — el patrón Grafana/Datadog contra el sprawl.

---

## Fuentes

Numeradas 1-34: abiertas y leídas con WebFetch el 12/9/2026. Numeradas 35-39: leídas solo desde resultados de búsqueda con contenido sustantivo (el sitio no cargó o devolvió 403). Formato: título — URL — aporte.

1. Visual Information-Seeking Mantra (InfoVis Wiki, sobre Shneiderman 1996) — https://infovis-wiki.net/wiki/Visual_Information-Seeking_Mantra — El mantra original ("overview first, zoom and filter, then details-on-demand"), el paper fuente (*The Eyes Have It*, IEEE 1996) y las 7 tareas.
2. Progressive Disclosure — Jakob Nielsen, NN/g (2006) — https://www.nngroup.com/articles/progressive-disclosure/ — Definición canónica; mejora aprendibilidad, eficiencia y errores; progressive (jerárquico) vs staged (lineal).
3. Dashboards: Making Charts and Graphs Easier to Understand — Page Laubheimer, NN/g (2017) — https://www.nngroup.com/articles/dashboards-preattentive/ — Atributos preatentivos: longitud y posición 2D primero; color solo categórico; qué gráficos evitar (pie, gauges radiales, 3D).
4. From Good To Great In Dashboard Design — Adam Fard, Smashing Magazine (11/11/2021) — https://www.smashingmagazine.com/2021/11/dashboard-design-research-decluttering-data-viz/ — Decluttering ≠ simplificar; hovers/paneles para lo secundario; research con 5 usuarios; proporción de color 6:3:1; elección de gráfico por propósito.
5. Grafana dashboards: Best practices (docs oficiales) — https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/ — "Un dashboard cuenta una historia o responde una pregunta"; USE/RED/Golden Signals; drill-down dirigido; template variables; anti-patrones (sprawl, stacking, refresh innecesario).
6. Minimalism and the absurdity of the data-to-ink-ratio — Frank Elavsky (22/4/2025) — https://www.frank.computer/blog/2025/04/data-to-ink.html — La crítica 2025 al data-ink ratio: heurística sin base empírica; el extremo es ilegible e inaccesible (los modelos JND no cubren baja visión); diseñar por contexto y audiencia.
7. Dashboard Design Patterns for Modern Web Apps — Mira Telos, artofstyleframe (28/3/2026, act. 26/8/2026) — https://artofstyleframe.com/blog/dashboard-design-patterns-web-apps/ — Números de layout 2026: sidebar 256/64px, grid 12 col con gutters 24px, franja de 4-6 KPIs, filas de tabla 48-52px (36-40 densas), nav 36px; Stripe/Linear/Grafana/Vercel como los cuatro modelos.
8. Dashboard design principles: 8 rules that actually work — Roman Kamushken, Setproduct (7/6/2024) — https://www.setproduct.com/blog/effective-dashboard-design-principles — El framework más concreto: pregunta en <12 palabras; una pantalla una decisión (2 segundos); delta+ventana; redondeo agresivo; color solo semántico; densidad 3:1 (gutters 8-12px vs 24-32px); filtros como chips removibles; timestamp de actualización.
9. Grafana Alerting: Best practices (docs oficiales) — https://grafana.com/docs/grafana/latest/alerting/guides/best-practices/ — Si no hay acción no es alerta (usá dashboards); síntomas sobre causas; pending periods y agregación temporal; agrupación; pocas alertas de calidad; cada alerta explica por qué existe y cómo investigar.
10. Manage your dashboards and monitors at scale — Datadog (blog oficial) — https://www.datadoghq.com/blog/dashboards-monitors-at-scale/ — Governance contra el sprawl: naming conventions ("Servicio - Entorno - Propósito"), tags de ownership, template variables, Powerpacks, auditorías que eliminan lo que no dispara acción.
11. Alert Fatigue — PagerDuty — https://www.pagerduty.com/resources/digital-operations/learn/alert-fatigue/ — Definición, causas (4.484 alertas/día promedio en SecOps), consecuencias (desensibilización, burnout), estrategias: eliminar lo no accionable, umbrales, agrupación, severidades por canal, revisiones periódicas.
12. About the North Star Framework — Amplitude — https://amplitude.com/books/north-star/about-the-north-star-framework — Jerarquía de métricas: una métrica norte y debajo los inputs accionables que los equipos pueden mover; criterio de accionabilidad y alineación.
13. Stripe Dashboard Design Breakdown: Trust Through Clarity — Yusuf, 925Studios (11/9/2026) — https://www.925studios.co/blog/stripe-dashboard-design-breakdown — Los 5 KPIs de la home con sparklines; navegación por jobs; color solo para estado; 6 tamaños/pesos tipográficos; microcopy accionable; sin widgets personalizables.
14. Alternate figures — Matthew Butterick, Practical Typography — https://practicaltypography.com/alternate-figures.html — Tabular vs proportional, oldstyle vs lining: tabulares esenciales en columnas de números; lining para mayúsculas; proporcionales para prosa.
15. font-variant-numeric — Tailwind CSS docs — https://tailwindcss.com/docs/font-variant-numeric — Implementación práctica: `tabular-nums`, `slashed-zero`, `lining-nums`, composición de utilidades y uso responsive.
16. Inter typeface family — Rasmus Andersson — https://rsms.me/inter/ — `tnum`/`zero`/`case` de fábrica, variable font, optical size Display para números grandes; diseñada para UIs e instrumentación.
17. Visual Hierarchy in UX — Kelley Gordon, NN/g (17/1/2021) — https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ — Máximo 3 tamaños y 2-3 niveles de contraste por vista; máximo 2 elementos grandes; agrupación por proximidad y contenedores; squint test.
18. Comparison Tables for Products, Services, and Features — Kate Moran & Taylor Dykes, NN/g (9/2/2024) — https://www.nngroup.com/articles/comparison-tables/ — Comparar ≤5 ítems (2 en móvil); atributos como filas; texto telegráfico; para decisiones compensatorias multi-atributo.
19. Data Tables: Four Major User Tasks — Page Laubheimer, NN/g (3/4/2022) — https://www.nngroup.com/articles/data-tables/ — Las 4 tareas (encontrar, comparar, ver/editar uno, actuar en lote) y su diseño: identificador humano primero, headers congelados, zebra/hover, panel no modal, batch con checkboxes.
20. Cards: UI-Component Definition — Page Laubheimer, NN/g (6/11/2016) — https://www.nngroup.com/articles/cards-component/ — Cards para heterogéneo/exploración; listas para homogéneo/búsqueda/comparación; cards ocupan más espacio y degradan el escaneo.
21. Data table usage — IBM Carbon Design System — https://carbondesignsystem.com/components/data-table/usage/ (contenido leído de la fuente MDX oficial del repo carbon-website en GitHub) — 5 alturas de fila (xl solo para contenido de 2 líneas); zebra para escaneo horizontal; expandable rows como progressive disclosure; batch action bar; overflow menu on-hover para bajar ruido.
22. How we redesigned the Linear UI (part II) — Karri Saarinen, Linear (28/3/2024) — https://linear.app/now/how-we-redesigned-the-linear-ui — Navegación en L invertida; reducción de ruido en sidebar/tabs/headers; énfasis por elevación y contraste; LCH con 3 variables base; Inter Display; menos azul de chrome; temas de alto contraste.
23. Linear design: the SaaS design trend — Daniel Schwarz, LogRocket (7/6/2025) — https://blog.logrocket.com/ux-design/linear-design/ — Qué define el género "linear design" (denso, oscuro, sobrio, alto contraste, gradientes puntuales) y su riesgo: homogeneidad entre productos.
24. Triage — Linear Docs — https://linear.app/docs/triage — La cola de triage: qué entra (integraciones, externos); 4 acciones con tecla (aceptar `1`, merge `2`, declinar `3`, snooze `H`); `G+T`; responsable con rotación; revisar antes de que entre al workflow.
25. Managing notifications from your inbox — GitHub Docs — https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox — Estados unread/saved/done/unsubscribed; done retenido 5 meses (`is:done`); filtros por motivo de llegada; hasta 15 filtros custom; triage en lote.
26. Best Practices for Dark Mode UI Design — Onething Design — https://www.onething.design/post/best-practices-for-dark-mode-ui-design — #121212 base, #E8E8E8 texto; el punto ciego del contraste son los elementos secundarios (placeholders, disabled, captions); desaturación; elevación por tono; más interlineado.
27. prefers-color-scheme — Thomas Steiner, web.dev (27/6/2019) — https://web.dev/articles/prefers-color-scheme — Blanco levemente apagado rgb(250,250,250) contra el glow; desaturación de imágenes en dark; filtros para iconos; transiciones entre temas.
28. The Architecture of Velocity: la pantalla de Superhuman — Ciara Hayes (26/7/2026, republicado en daily.dev) — https://daily.dev/posts/the-architecture-of-velocity-breaking-down-the-one-screen-that-makes-superhuman-feel-fast-gka2ow6qt — Los 5 principios de velocidad percibida: fricción cognitiva mínima (Hick), consistencia espacial, optimistic UI, tipografía de escaneo, keyboard-first; "la velocidad es un problema de diseño, no técnico".
29. Superhuman: Speed as the Product — Blake Crosley — https://blakecrosley.com/guides/design/superhuman — Target interno 50-60ms; split inbox de 3-7 flujos; 100+ atajos estilo vim; Cmd+K como entrenamiento pasivo de atajos; optimistic UI con undo (`Z`); onboarding de memoria muscular.
30. Designing accessible color systems — Daryl Koopersmith & Wilson Miner, Stripe (15/10/2019) — https://stripe.com/blog/accessible-color-systems — Construir la paleta en espacio perceptual (CIELAB) para contraste WCAG predecible y peso visual parejo entre acentos.
31. Colors — Vercel Geist Design System — https://vercel.com/geist/colors — Escalas de 10 pasos con roles fijos (1-3 fondos default/hover/active, 4-6 bordes, 7-8 fondos de alto contraste, 9-10 texto); 2 backgrounds de página; el método "tonos con rol" para dark UI.
32. Introduction — Vercel Geist Design System — https://vercel.com/geist/introduction — Principios del sistema: color de alto contraste y accesible, grid como parte central de la estética, iconografía diseñada para herramientas de developer.
33. New: Dark mode for all Datawrapper visualizations — Lisa Charlotte Muth, Datawrapper (26/1/2022) — https://www.datawrapper.de/blog/dark-mode-for-embedded-visualizations — Re-derivar colores de series/gridlines/texto por algoritmo de contraste en dark: la paleta de gráficos de dark no es la de light.
34. The Principles of Dark UI Design — Miklos Philips, Toptal (act. 10/7/2024) — https://www.toptal.com/designers/ui/dark-ui-design — 3-4 niveles de elevación tonal (superficie más clara = más cerca); 2-3 acentos desaturados; gris oscuro #121212 con tinte azul; AA 4,5:1 / AAA 7:1; espacio negativo como herramienta de jerarquía.
35. Zoom, Filter, Demand: entrevista a Ben Shneiderman — TruStory FM (leída vía resultados de búsqueda) — https://trustory.fm/seeingbeyondthedashboard/zoom-filter-demand-the-visualization-revolution-with-dr-ben-shneiderman/ — Vigencia del mantra en dashboards modernos, en palabras del propio autor.
36. Smart SaaS Dashboard Design Guide — F1Studioz (2026, leída vía resultados de búsqueda) — https://f1studioz.com/blog/smart-saas-dashboard-design/ — Reformulación decisional del data-ink ("si una métrica no cambia tu comportamiento, no va en la vista primaria"); 5-7 tarjetas de resumen por límite de memoria de trabajo (4-7 unidades).
37. Designing efficient dashboards with the Tufte way — Fabien Monnery, Medium/Bootcamp (leída vía resultados de búsqueda; Medium devuelve 403 al fetch) — https://medium.com/design-bootcamp/designing-efficient-dashboards-with-the-tufte-way-9209e79f2ffb — Qué partes de Tufte se aplican hoy a dashboards web: depurar gridlines y decoración, datos primero, balance simplicidad/comprensión.
38. Workflows / Features — Height (leída vía resultados de búsqueda; height.app rechazó la conexión) — https://height.app/workflows — Team inbox → lista priorizada post-triage; smart lists guardadas de búsquedas; atributos custom como dimensiones de triage.
39. Dashboards are Dead: 3 years later — Taylor Brownlow, Count.co (leída vía resultados de búsqueda; el post original en Medium devuelve 403) — https://count.co/blog/dashboards-are-dead-3-years-later/ — El modo de falla del dashboard-catálogo (67 páginas, filtros infinitos, export a Excel, desconfianza) y la retractación parcial: el problema es el proceso alrededor del dashboard, no el artefacto.
