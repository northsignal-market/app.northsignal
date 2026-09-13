# 14 · Scroll, agrupación de bloques y redundancia visual (sin tocar el backend)

**Fecha de investigación:** 13 de septiembre de 2026
**Eje:** optimización de scroll, agrupación lógica de bloques y eliminación de redundancia VISUAL en apps densas (2025–2026, prioridad últimos 3 meses). Aplica a: Sistema como apilado largo de paneles heterogéneos, Cuenta›Diagnóstico como apilado de 6 bloques, y la misma info repetida en 2+ lugares (pendientes, salud, pulso).
**Restricción del dueño:** *evitar display de info redundante SIN eliminarla del backend; el sistema por abajo opera igual.* Todo lo de acá es capa de presentación.
**Método:** búsqueda web + lectura directa (fetch) de las fuentes clave. Cada afirmación lleva `[n]` contra la lista final. Las fuentes que solo pude verificar por resumen de buscador están marcadas con ⚠ en la lista; los números de vendors sin estudio público se señalan como tales.
**Balance:** 56 fuentes (15 publicadas en 2026, de las cuales 6 son de jun–sep 2026; 9 de foros/comunidad).

---

## 1. Redundancia intencional vs. ruido: el patrón "lugar canónico + referencias"

**La evidencia clásica es inequívoca: duplicar display cuesta.** NN/g estudió links duplicados en la misma página y la respuesta general es *no*: cada aparición extra sube el costo de interacción ("each additional link increases the interaction cost… because it rises the number of choices people must process"), compite por atención finita, tensa la memoria (¿esto es lo mismo que vi arriba?) y hace perder tiempo a quien clickea ambos esperando destinos distintos [1]. Nielsen ya lo había formulado en 2002 como principio de diseño: **si algo pasa desapercibido, movelo o hacelo más prominente en su lugar; no lo dupliques** ("If users overlook a link, you can move it or make it more prominent rather than duplicate it") [2].

**Pero la redundancia tiene dominios de validez.** Los mismos estudios listan cuándo repetir SÍ es correcto [1][2]:
- cuando las dos apariciones **no son visibles a la vez** (una arriba y otra al fondo de una página larga sirven a momentos distintos del usuario);
- cuando la segunda aparición **agrega contexto** que la primera no puede dar (link en prosa con mejor explicación que el ítem de menú);
- **cross-references limitadas** para usuarios que categorizan distinto — pocas y deliberadas;
- imagen + etiqueta clickeables juntas: se perciben como UN link, no como duplicado.

**La glanceability justifica ecos, no copias.** La investigación de displays periféricos define glanceable como "entender con mínimo esfuerzo cognitivo en el instante de la mirada" [3]; un eco glanceable (un punto, un contador) en el chrome persistente cumple esa función sin duplicar el display completo. La distinción operativa que sale de cruzar [1][2][3]: **un dato puede aparecer en varios lugares solo si cada aparición tiene una función distinta y una fidelidad distinta** — detalle completo en un lugar (canónico), resumen de una línea en el lugar de tránsito, señal de un bit en el chrome. Dos displays con la misma fidelidad del mismo dato = deuda.

**El modelo backend de esto ya existe y tiene nombre: COPE** (Create Once, Publish Everywhere, NPR): el contenido vive en UNA fuente estructurada y cada superficie lo *representa* con la forma que su contexto pide — no se reescribe, se re-renderiza [4]. Es exactamente la restricción del dueño: la vista SQL sigue siendo una; lo que cambia es cuántos píxeles recibe en cada superficie.

**Síntesis del patrón "canónico + referencias":**
1. Cada dato tiene UN lugar canónico: donde se muestra completo, con contexto y acciones.
2. Toda otra aparición es una **referencia degradada**: resumen (1 línea) → señal (badge/punto) → nada. Siempre linkea al canónico.
3. Presupuesto: canónico + 1 eco persistente. Una tercera aparición se vuelve link puro o desaparece.
4. La referencia nunca muestra más precisión que la que su función necesita (el header no necesita saber *cuáles* pendientes, solo *cuántos*).

## 2. Páginas largas heterogéneas: TOC lateral / jump links vs. partir en tabs

**Cuándo tabs, cuándo una página con anclas.** NN/g: tabs sirven cuando el contenido tiene agrupaciones claras, etiquetas cortas, y — la condición crítica — **el usuario no necesita ver dos secciones a la vez**; comparar entre tabs castiga la memoria de corto plazo y sube el costo de interacción [5]. Accordions convienen para muchas secciones cortas; tabs para pocas secciones largas [6]. Y para contenido que se lee o escanea en secuencia, una página que scrollea le gana a paginar: la gente scrollea cuando el contenido es relevante, está bien organizado y formateado para escaneo [7]. Corolario: **partir en tabs es correcto solo si las secciones son consultas independientes; si se leen juntas o se comparan, misma página + navegación interna.**

**Jump links / anclas: útiles con matices conocidos.** NN/g re-evaluó los in-page links: rompen parcialmente el modelo mental del link (que "va a otra página"), y los usuarios los saltean en la exploración inicial — pero **los usan cuando llegan con una necesidad concreta**, y les permiten saltear pantallas enteras de contenido irrelevante [8][9]. Para una app interna de un solo operador experto que llega SIEMPRE con necesidad concreta, el matiz juega a favor del patrón.

**El mini-TOC lateral sticky es la convención 2025–2026 para páginas largas heterogéneas.** Es el patrón "On this page" de todos los docs sites (Stripe, MDN, design systems) y de las settings pages largas: navegación lateral fija con estados activos por scrollspy, `position: sticky`, y — si la lista de anclas es larga — su propio `overflow-y: auto` con `max-height` [10][11][12]. La implementación canónica está documentada en CSS-Tricks (sticky TOC con active states) [11] y la pieza técnica que evita el bug clásico (el ancla queda tapada por el header pegajoso) es una línea: `scroll-margin-top` en cada sección destino [13]. En 2026 se suma `scroll-state(stuck)` (container query, Chrome 133+) para restylear el elemento cuando efectivamente se pegó — sombra, fondo opaco — sin JavaScript [14][15].

**Los límites del sticky, medidos.** Smashing/Smart Interface Design Patterns: los menús pegajosos ayudan en páginas largas y tareas con navegación frecuente, pero roban viewport; la guía 2026 de Parallel pone números: la satisfacción cae cuando el chrome pegajoso ocupa más del 20–30% de la pantalla (peor con zoom, donde puede llegar al 30%+), así que header y rails delgados, con solo lo esencial [10][16]. Un vendor de Webflow (jun-2026) reporta umbrales de cuándo el side-nav pegajoso paga: páginas largas de referencia sí, páginas cortas o de lectura lineal no, y en mobile reemplazarlo por una tira de anclas inferior — sus números (31% conversión, "39% de abandono según NN/g") son claims comerciales no verificables en fuente primaria, pero la estructura de la recomendación coincide con NN/g [17]⚠.

**Foros:** en HN la fricción real con TOCs es de tooling (mantener anclas estables y TOC generado, no manual — subthread de "The Curse of Markdown", dic-2024) [18]; en comunidades de builders (Shopify, WeWeb) el patrón sticky-TOC + `scroll-margin-top` aparece como pregunta recurrente de implementación, señal de que es el patrón por defecto que todos intentan construir [19][20].

## 3. Scroll UX 2026: animaciones con moderación, sticky headers de sección, restauración, overscroll, scrollbars

**Scroll-driven animations CSS: ya son estándar, y el consenso 2026 es funcional-sí, decorativo-no.** La spec corre en el compositor (transform/opacity sin main thread) y tiene soporte cross-browser amplio (~85%, Firefox detrás de flag) [21][22]. Los usos legítimos en una app de trabajo: **barra de progreso de lectura, reveal sutil, sombra/estado al pegarse un header** — y SIEMPRE gated por `@media (prefers-reduced-motion: reduce)`, que debe resetear `animation`, `animation-timeline` y `animation-range` [21][23]. Comeau (abr-2026, act. jun-2026) marca el parallax como el caso que exige más cautela (trastornos vestibulares) [22]. La regla de reparto: CSS cuando el scroll controla una propiedad visual; JavaScript cuando el scroll debe causar trabajo de aplicación (cargar datos, URL, analytics) [23]. Y el techo duro lo puso el estudio de scrolljacking de NN/g: secuestrar velocidad/dirección del scroll desorienta a la mayoría, enfurece a los usuarios orientados a tarea, y lo peor es texto animado durante el scroll — en una app de decisión, nada de scrolljacking, nunca [24]. El sentimiento de foros es unánime y visceral ("Tell HN: In my entire life, I have never enjoyed a scrolljacking website") [25]. Creative Boom (abr-2026) lista "motion for its own sake" entre las tendencias de las que los creativos ya están hartos [26].

**Sticky section headers en listas/apilados largos:** el patrón iOS-contactos — el header del grupo queda pegado mientras su grupo cruza el viewport y el siguiente lo empuja — da contexto persistente en scroll largo; exige fondo opaco (pinnea SOBRE filas) y beneficia del sombreado vía `scroll-state(stuck)` [12][14]. Es el complemento natural de grupos plegables: el título del grupo abierto te acompaña.

**Restauración de posición de scroll:** en SPAs el browser no restaura solo (el routing por pushState saltea la lógica nativa); perder la posición al volver de un detalle rompe el flujo de "revisar lista, entrar, volver, seguir". El patrón: `history.scrollRestoration = 'manual'` + guardar posición por entrada de historial y restaurarla en `popstate`/navegación de vuelta (los routers lo exponen: `scrollPositionRestoration` en Angular, ScrollRestoration en React Router/Next) [27][28]. Regla adicional: expandir/colapsar un bloque no debe mover el viewport del usuario (anclar el scroll al bloque interactuado).

**Overscroll y scrollbars en dark:** `overscroll-behavior: contain` en paneles con scroll propio (rail, modales, TOC) corta el scroll chaining — que al llegar al fondo del panel no arrastre la página [29]. Para dark: `color-scheme: dark` ya oscurece los scrollbars nativos; `scrollbar-color: thumb track` los afina; `scrollbar-width: thin` en rails; y `scrollbar-gutter: stable` reserva el canal para que abrir/cerrar grupos plegables no produzca layout shift horizontal [30][31].

## 4. Agrupación por relación lógica: agrupar por la pregunta que responde, no por el origen del dato

**El método existe y es medible.** Card sorting alinea la estructura con el modelo mental del usuario [32]; la variante 2023+ **Task-Based Open Card Sorting** va más lejos: valida las agrupaciones midiendo first-click success sobre tareas reales — la IA ganadora es la que más aciertos de primer click produce, no la más "prolija" [33]. Con UN usuario, el equivalente barato: listar las preguntas reales que Andrés trae a cada vista ("¿hay algo para decidir?", "¿cómo viene contra objetivos?", "¿el sistema está sano?") y agrupar bloques por pregunta. Agrupar por origen técnico (qué tabla/agente lo produce) es el organigrama disfrazado: la investigación de IA de NN/g sobre estructuras por tarea vs. por origen ya mostró que las task-based envejecen mejor (ver informe 05 §1).

**Las reorganizaciones 2026 documentadas van todas en la misma dirección** — menos duplicación, navegación consistente, contexto que persiste:
- **Vercel** (ene-2026 opt-in, default 25–26/feb-2026): tabs horizontales → **sidebar redimensionable y ocultable**, links unificados entre nivel equipo y nivel proyecto, y "projects as filters": la misma página cambia de alcance con un click **en vez de existir dos veces** — de-duplicación de vistas por diseño [34][35]. En mayo-2026 densificaron la lista de deployments (más filas por pantalla, estado agrupado con entorno) [36].
- **Linear**: UI refresh (12/mar-2026) con headers y navegación consistentes entre workflows y sidebars *atenuados* para que el contenido mande [37]; tabs de escritorio con historial propio y pinned tabs persistentes (18/jun-2026) [38]; **sidebar de issue rediseñada integrando propiedades con el contenido** (23/jul-2026) y **Priority Inbox** separando lo que exige atención inmediata de lo que puede esperar (3/sep-2026) [38] — este último es literalmente "canónico + referencia" aplicado a notificaciones.
- El estudio académico de referencia (Bach et al., IEEE VIS 2022, 144 dashboards) cataloga los patrones de estructura exactamente como opciones complementarias: *screenfit* (todo visible, cero interacción) vs. *overflow* (scroll) vs. *detail-on-demand* vs. *multipágina*, más *grouped layout* (agrupar widgets relacionados con whitespace/divisores para leer más fácil) [39].

## 5. Ecos del estado global: cuántas repeticiones tolera un sistema sin ansiedad

**Cada badge es un impuesto de atención comprobado.** El experimento de PLOS One (1.095 participantes): la sola presencia de un badge captura sistemáticamente el primer click, vía sesgo de saliencia + sesgo de urgencia — funciona *aunque el usuario no quiera* [40]. La literatura de producto describe el costo acumulado: badges por todos lados = ansiedad de bajo grado y, peor, **tolerancia**: el usuario aprende a ignorarlos y el canal muere [41][42]. Es el mismo mecanismo del alert fatigue en monitoreo: miles de señales de bajo valor entrenan al operador a no mirar; el patrón probado es **dos niveles** (warning → digest diario; critical → interrupción inmediata) y correlación de señales relacionadas en UNA [43][44].

**Cuántos ecos:** la investigación no da un número universal, pero converge en esto: los indicadores simultáneos procesables son pocos (la banda 5–9 de carga cognitiva se cita como techo; los dashboards de monitoreo serios muestran 3–5 métricas North-Star y el resto a un click) [43], y **un estado global merece a lo sumo UN eco persistente en el chrome, con fidelidad de un bit o un entero** — el detalle vive en su panel [1][2][40]. Smashing (sep-2025, dashboards en tiempo real): limitar los elementos visibles críticos a ~cinco, jerarquía arriba-izquierda, y calma como criterio de diseño ("balance speed with calmness"; el dashboard es asistente de decisión, no display pasivo) [45]. La regla badge-solo-decisiones que ya tiene la app es exactamente esto; la extensión con evidencia: **presupuesto fijo de ecos en el chrome** (uno numérico + uno binario), y todo eco nuevo desplaza a uno viejo — no se suma.

## 6. Bloques con lógica: bento 2026, tamaño por importancia real, orden de lectura

**Bento: la moda ya está en fase de resaca, pero el principio de tamaño sobrevive.** Creative Boom (abr-2026) lo lista entre las tendencias que cansaron ("bento boxes… but can't stop using them") [26]. La guía práctica de SaaSFrame (2026) lo restringe a feature showcases, overviews y heroes, y advierte contra forzarlo [46]. Para apps de datos, la guía técnica 2026 de layouts es más cruda: **bento para marketing; dashboards de datos → grid uniforme**; con más de 12–15 bloques visibles el bento pierde su ventaja organizativa, y mobile es su punto débil crónico [47]. La posición pro-bento más seria (Orbix, 21/jul-2026) lo admite solo bajo tres condiciones: producto denso en datos, usuarios recurrentes y **jerarquía de información no-negociable** — "earns its complexity cost when the product is data-dense, the users are recurring, and the hierarchy of information is non-negotiable" [48]. Traducción: si no podés declarar qué bloque es 4× más importante que otro, no tenés bento, tenés cajas decorativas.
**Lo que sí queda del bento:** tamaño = importancia real (los usuarios fijan la vista ~2,6× más en los ítems grandes según el eye-tracking citado por [46]), compartimentación estricta y gutters uniformes.

**Asignación de espacio por valor, no por llenado.** El marco conceptual es el ensayo de Ström (may-2024; 767 puntos y 387 comentarios en HN): **"UI density is the value a user gets from the interface divided by the time and space the interface occupies"** — densidad no es apretar píxeles sino maximizar valor por área y por segundo; a veces la versión "más densa en valor" ocupa MÁS espacio (formulario que previene errores) [49][50].

**Orden de lectura:** F-pattern para contenido denso en texto (el ojo pesa la franja superior y la columna izquierda — ahí van veredictos y nombres de entidad, no adornos); Z/layout-pattern para vistas ralas de bloques (el buen layout *impone* el orden y anula la F, que es el comportamiento por defecto cuando el diseño no guía) [51][52]. Para apilados de paneles: primera fila = lo que decide, columna izquierda de cada panel = la conclusión.

## 7. Foros últimos meses: qué duele en la práctica

- **"Ask HN: What are good high-information density UIs?"** (may-2025; 530 puntos, 372 comentarios): hambre explícita de densidad bien hecha y queja de que los artículos de dashboard se repiten entre sí; el ensayo de Ström citado como la excepción valiosa [53].
- **HN sobre el ensayo de Ström** (may-2024, 767/387) y **el experimento de grilla densa en Svelte** (jul-2024, 882/256): las dos discusiones de diseño más votadas del período confirman el giro pro-densidad-con-jerarquía en la audiencia técnica [50][54].
- **Scrolljacking:** rechazo unánime y sostenido ("Tell HN…", 2023; "Ask HN: Good Uses of Scrolljacking?", feb-2025, casi sin defensores) [25][55].
- **TOC/anclas:** la fricción es de mantenimiento (anclas estables, TOC generado) más que de deseo — el patrón se da por sentado [18][19][20].
- Señal de mercado jun-2026: aparecen kits UI específicamente "for editors, dashboards, and dense app UIs" (Cladd, Show HN may-2026) — la densidad como categoría de producto [56].

---

## Síntesis aplicada a NorthSignal

### El mapa de redundancias → lugar canónico (sin tocar el backend)

| Dato | Hoy aparece en | Canónico | Los demás quedan como |
|---|---|---|---|
| Pendientes de decisión | Header (badge) + Bandeja + por cuenta | **Bandeja** (es "lo único que pide acción hoy" = `v_para_actuar`) | Header: badge numérico solo-decisiones (ya es regla) que linkea a Bandeja — un entero, cero detalle. Cuenta›Diagnóstico: solo los de ESA cuenta, como lista mínima (título + verbo) con "ver en Bandeja"; si son 0, una línea "sin pendientes" |
| Salud del sistema | Header (punto) + Sistema | **Sistema › Integridad** | Header: punto tricolor de un bit que linkea; sin cifras, sin texto. Ningún tercer lugar |
| Pulso | Bandeja + Semana | **Semana** (es la vista temporal; ahí tiene contexto y comparación) | Bandeja: una línea de resumen (dirección + delta) + link "ver semana". No repetir el gráfico |

Regla de oro derivada de [1][2][4][40]: **canónico + 1 eco degradado, máximo.** El eco muestra un orden de magnitud menos de información que el canónico y siempre es link. Nada de esto toca vistas SQL: es elegir cuántos píxeles recibe la misma consulta en cada superficie (COPE de presentación).

### Sistema (apilado largo de 4 grupos heterogéneos): TOC lateral SÍ

- **No partir en tabs**: los 4 grupos se recorren en una misma pasada de mantenimiento ("¿está todo sano?") y las tabs romperían el overview y el Ctrl+F [5][7]. Mantener una página.
- **Sí agregar mini-TOC lateral sticky** (grupos y, anidados, sus paneles), con scrollspy de sección activa, `position: sticky` + `overflow-y: auto` propio, `scroll-margin-top` ≥ alto del header en cada destino [8][11][13]. Saltar a un panel dentro de un grupo plegado lo expande primero. Es el mismo rail que Bandeja ya tiene, reutilizado como navegación en vez de contenido: un solo patrón nuevo, no dos.
- **Header de grupo sticky** mientras su grupo cruza el viewport (patrón iOS-contactos), fondo opaco, sombra vía `scroll-state(stuck)` con fallback sin efecto [12][14][15].
- **Grid uniforme para los paneles, no bento** [47]: son paneles técnicos que se escanean parejo; no hay jerarquía no-negociable entre ellos [48].

### Cuenta › Diagnóstico (ficha + objetivos + propuestas + decisiones + escalera + doc)

- Reordenar por pregunta, no por origen [32][33]: (1) ¿hay algo para decidir? → propuestas + decisiones pendientes; (2) ¿cómo viene? → objetivos + escalera; (3) contexto estable → ficha + doc, colapsados por defecto (cambian poco; son consulta, no lectura diaria).
- Propuestas y objetivos se leen JUNTOS para decidir → misma página, nunca tabs separadas [5]. Cada bloque con su resumen de una línea siempre visible (el patrón resumen-detalle ya aplicado) y mini-TOC de anclas si el apilado supera ~3 pantallas.
- Restaurar scroll al volver de un detalle a la lista [27][28].

---

## Las 12 reglas accionables

1. **Un dato, un canónico.** Toda aparición no-canónica es referencia degradada (resumen → señal → nada) y linkea al canónico. Tope: canónico + 1 eco persistente [1][2][4].
2. **Aplicar el mapa:** pendientes→Bandeja, salud→Sistema›Integridad, pulso→Semana; header solo badge entero + punto tricolor (ver tabla) [1][40].
3. **Presupuesto de ecos en el chrome: 1 numérico + 1 binario.** Un eco nuevo desplaza a uno viejo; no se suman. Señales de nivel warning van a digest (Bandeja), no al header [43][44].
4. **Sistema: una página + mini-TOC lateral sticky con scrollspy; no tabs.** Saltos abren el grupo plegado; `scroll-margin-top` en cada sección [5][8][11][13].
5. **Headers de grupo sticky** con fondo opaco y sombra al pegarse (`scroll-state(stuck)` + fallback) [12][14].
6. **Paneles de Sistema en grid uniforme; bento prohibido salvo jerarquía real declarable** (¿este bloque vale 4× aquel? si no, no) y nunca con >12 bloques visibles [46][47][48].
7. **Espacio por valor, no por llenado:** tamaño de bloque proporcional a la importancia de la decisión que alimenta; conclusión arriba-izquierda de cada bloque (F-pattern) [49][51].
8. **Diagnóstico: orden decidir → evaluar → contexto;** ficha y doc colapsados por defecto; propuestas+objetivos siempre en la misma vista [5][32][33].
9. **Scroll restoration manual por ruta:** volver de detalle a lista restaura posición; expandir/colapsar no mueve el viewport [27][28].
10. **Motion solo funcional:** progreso de lectura y estados de stuck sí; reveals decorativos y todo scrolljacking, no; todo gated por `prefers-reduced-motion` [21][22][23][24][26].
11. **Higiene de scroll en dark:** `color-scheme: dark` + `scrollbar-color`, `scrollbar-width: thin` en rails, `scrollbar-gutter: stable` (los plegables no producen layout shift), `overscroll-behavior: contain` en todo panel con scroll propio [29][30][31].
12. **Chrome pegajoso ≤ ~20% del viewport** (header + TOC sumados); el rail/TOC no supera ~240px de ancho y scrollea solo [10][16].

---

## Fuentes

Formato: título — URL — fecha — aporte. ⚠ = verificada solo por resumen de buscador (no fetch directo). Los claims comerciales sin estudio público se señalan en el texto.

**Redundancia y lugar canónico**
1. The Same Link Twice on the Same Page: Do Duplicates Help or Hurt? (NN/g, H. Loranger) — https://www.nngroup.com/articles/duplicate-links/ — 13-mar-2016 — duplicados suben costo de interacción y confunden; 4 excepciones válidas.
2. Reduce Redundancy: Decrease Duplicated Design Decisions (NN/g, J. Nielsen) — https://www.nngroup.com/articles/reduce-redundancydecrease-duplicated-design-decisions/ — 8-jun-2002 — "move it or make it more prominent rather than duplicate it"; cross-links limitados como única redundancia buena.
3. Glanceable UX: turning information into instant understanding (UX Collective, T. Sydorenko) — https://uxdesign.cc/glanceable-ux-turning-information-into-instant-understanding-bc2317283ef4 — s/f (2023) ⚠ — glanceability = comprensión con mínimo esfuerzo; base de los "ecos" de un bit.
4. Understanding Create Once, Publish Everywhere (Lullabot) — https://www.lullabot.com/articles/understanding-create-once-publish-everywhere-cope — s/f (modelo NPR) ⚠ — una fuente estructurada, muchas representaciones; el modelo backend del patrón canónico+referencias.

**Página larga vs. tabs, TOC, anclas**
5. Tabs, Used Right (NN/g) — https://www.nngroup.com/articles/tabs-used-right/ — 2016 ⚠ — tabs solo si no hace falta ver dos secciones a la vez; comparar entre tabs castiga memoria.
6. Tabs vs. Accordions: When to Use Each (NN/g, video) — https://www.nngroup.com/videos/tabs-vs-accordions/ — s/f ⚠ — tabs: pocas secciones largas; accordions: muchas cortas.
7. Scrolling and Attention (NN/g) — https://www.nngroup.com/articles/scrolling-and-attention-original-research/ — 2018 ⚠ — la gente scrollea si el contenido es relevante y escaneable; largo > paginado para contenido continuo.
8. Anchors OK? Re-Assessing In-Page Links (NN/g) — https://www.nngroup.com/articles/in-page-links/ — s/f ⚠ — jump links rompen parcialmente el modelo mental pero funcionan con necesidad concreta.
9. In-Page Links for Content Navigation (NN/g) — https://www.nngroup.com/articles/in-page-links-content-navigation/ — s/f ⚠ — permiten saltear pantallas de contenido irrelevante.
10. Designing Sticky Menus: UX Guidelines (Smashing Magazine, V. Friedman) — https://www.smashingmagazine.com/2023/05/sticky-menus-ux-guidelines/ — may-2023 ⚠ — cuándo sticky ayuda/estorba; costo de viewport.
11. Sticky Table of Contents with Scrolling Active States (CSS-Tricks) — https://css-tricks.com/sticky-table-of-contents-with-scrolling-active-states/ — 2020 ⚠ — implementación canónica del mini-TOC con scrollspy.
12. Choosing the Right Header Style for Lists in iOS (Medium, D. Ritchie) — https://medium.com/@deannaritchie/choosing-the-right-header-style-for-lists-in-ios-63f96c33c079 — s/f ⚠ — patrón iOS-contactos: header de grupo pinneado que el siguiente empuja.
13. How to prevent anchor links from scrolling behind a sticky header with one line of CSS (Go Make Things, C. Ferdinandi) — https://gomakethings.com/how-to-prevent-anchor-links-from-scrolling-behind-a-sticky-header-with-one-line-of-css/ — 2020 ⚠ — `scroll-margin-top` como fix de una línea.
14. CSS scroll-state() (Chrome for Developers) — https://developer.chrome.com/blog/css-scroll-state-queries — 2025 ⚠ — container queries stuck/snapped/scrollable; Chrome 133+.
15. Scroll State Container Queries (nerdy.dev, A. Argyle) — https://nerdy.dev/scroll-state-container-queries — 15-ene-2025 ⚠ — restylear al pegarse sin JS; el contenedor no puede estilarse a sí mismo.
16. What Is a Sticky Header? 2026 UX Guide & CSS Examples (Parallel) — https://www.parallelhq.com/blog/what-sticky-header — 15-may-2026 — satisfacción cae con >20–30% de viewport ocupado; slim headers; shrink-on-scroll.
17. Why I Use Sticky Side Navigation on Long Webflow Service Pages in 2026 (P. Kumar) — https://www.pravinkumar.co/blog/sticky-side-navigation-long-webflow-service-pages-2026 — 28-jun-2026 — umbrales de cuándo el side-nav paga; en mobile, tira de anclas inferior. Sus cifras (31% conversión, "NN/g 39% abandono") son claims de vendor no verificables en fuente primaria.

**Scroll UX 2026**
18. Hilo TOC en "The Curse of Markdown" (Hacker News) — https://news.ycombinator.com/item?id=42309969 — 3-dic-2024 — [foro] la fricción con TOCs es de tooling: anclas estables y generación automática, no deseo del patrón.
19. Adding a table of contents sticky section (Shopify Community) — https://community.shopify.com/t/adding-a-table-of-contents-sticky-section/219349 — s/f ⚠ — [foro] demanda del patrón sticky-TOC entre builders.
20. How to use scroll-margin-top for anchor links (WeWeb Community) — https://community.weweb.io/t/how-to-use-scroll-margin-top-for-anchor-links/3325 — s/f ⚠ — [foro] el fix de anclas bajo header fijo como pregunta recurrente.
21. CSS scroll-driven animations (MDN) — https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations — vigente 2026 ⚠ — spec, `scroll()`/`view()`, reset bajo prefers-reduced-motion.
22. Scroll-Driven Animations (J. Comeau) — https://www.joshwcomeau.com/animation/scroll-driven-animations/ — 28-abr-2026, act. 19-jun-2026 — gatear animaciones tras `prefers-reduced-motion: no-preference`; parallax con máxima cautela; ~85% soporte.
23. Scroll-Driven CSS in 2026 (SitePoint) — https://www.sitepoint.com/scrolldriven-css-in-2026-building-carousels-without-javascript/ — 2026 ⚠ — CSS si el scroll controla una propiedad visual; JS si causa trabajo de aplicación; corre en compositor.
24. Scrolljacking 101 (NN/g, S. Paul) — https://www.nngroup.com/articles/scrolljacking-101/ — 6-ago-2023 — estudio: desorientación mayoritaria, usuarios de tarea se van; si se usa: corto, sin texto, nunca mobile.
25. Tell HN: In my entire life, I have never enjoyed a scrolljacking website (Hacker News) — https://news.ycombinator.com/item?id=36542038 — 30-jun-2023 — [foro] rechazo unánime al scroll secuestrado.
26. 10 trends that creatives are so over in 2026 (Creative Boom) — https://www.creativeboom.com/insight/10-trends-creatives-are-so-over-in-2026/ — 21-abr-2026 — bento-fatigue y "motion for its own sake" entre lo agotado.
27. SPA Feel – Pattern #1 – Restore Scroll Position (picostitch) — https://picostitch.com/blog/2025/03/spa-feel1-restore-scroll/ — mar-2025 ⚠ — restaurar posición al volver como patrón #1 de sensación nativa.
28. Scroll restoration in SPAs (D. Tran) — https://www.davidtran.dev/blogs/scroll-restoration-in-spas — s/f ⚠ — `history.scrollRestoration='manual'` + posición por entrada de historial.
29. overscroll-behavior (MDN) — https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior — vigente 2026 ⚠ — `contain` corta scroll chaining en paneles anidados.
30. Dark-mode aware scrollbars using CSS (A. Merchant) — https://www.amitmerchant.com/darkmode-aware-scrollbars-using-css/ — s/f ⚠ — `color-scheme: dark` oscurece scrollbars nativos.
31. scrollbar-color (MDN/CSS-Tricks) — https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color — vigente 2026 ⚠ — thumb/track custom; con `scrollbar-gutter: stable` evita layout shift.

**Agrupación, reorganizaciones documentadas, ecos y bloques**
32. Card Sorting: Uncover Users' Mental Models (NN/g) — https://www.nngroup.com/articles/card-sorting-definition/ — s/f ⚠ — agrupar según el modelo mental del usuario, no la estructura interna.
33. Task-Based Open Card Sorting (Katsanos et al., ResearchGate) — https://www.researchgate.net/publication/372226519_Task-Based_Open_Card_Sorting_Towards_a_New_Method_to_Produce_Usable_Information_Architectures — 2023 ⚠ — validar la IA por first-click success sobre tareas, no por prolijidad.
34. New dashboard redesign is now the default (Vercel changelog) — https://vercel.com/changelog/dashboard-navigation-redesign-rollout — 26-feb-2026 — tabs→sidebar; links unificados equipo/proyecto; "projects as filters" = de-duplicación de vistas.
35. New dashboard navigation available (Vercel changelog) — https://vercel.com/changelog/new-dashboard-navigation-available — ene-2026 ⚠ — la misma reorganización como opt-in previo.
36. Redesigned Deployments List (Vercel changelog) — https://vercel.com/changelog/redesigned-deployments-list — may-2026 ⚠ — densificación deliberada: más filas, estado agrupado con entorno.
37. UI refresh (Linear changelog) — https://linear.app/changelog/2026-03-12-ui-refresh — 12-mar-2026 — headers/nav consistentes entre workflows; sidebars atenuados para que el contenido mande.
38. Changelog Linear jun–sep 2026 — https://linear.app/changelog — 18-jun-2026 (tabs con historial propio y pinned tabs), 23-jul-2026 (sidebar de issue integra propiedades al contenido), 3-sep-2026 (Priority Inbox: separar lo urgente de lo que espera).
39. Dashboard Design Patterns (Bach, Freeman, Abdul-Rahman, Turkay, Khan, Fan, Chen; IEEE VIS 2022 / TVCG 2023) — https://arxiv.org/abs/2205.00757 y https://dashboarddesignpatterns.github.io/patterns.html — 2022 — screenfit vs overflow vs detail-on-demand vs multipágina; grouped layout con whitespace/divisores; 144 dashboards.
40. Driven by notifications – exploring the effects of badge notifications on user experience (Bartoli & Benedetto, PLOS ONE) — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0270888 — 2022 — n=1.095: el badge captura sistemáticamente el primer click vía saliencia+urgencia.
41. Badge notifications: why everyone wants to get rid of them (UX Collective, S. Eikelboom) — https://uxdesign.cc/badge-notifications-why-everyone-wants-to-get-rid-of-them-decedb28b46d — s/f ⚠ — el costo emocional del badge ubicuo.
42. When and How to Use Badges in UI Design (Povio) — https://povio.com/blog/product-design-badges — s/f ⚠ — dosificación: agrupar, capear, dejar elegir.
43. Smart Infrastructure Monitoring Dashboard: What Good Looks Like (iFactory) — https://ifactoryapp.com/industries/infrastructure-management/smart-infrastructure-monitoring-dashboard-good-looks — s/f ⚠ — 3–5 métricas North-Star + 8–12 a un click; two-tier: warning→digest, critical→interrupción; 50–100 métricas en home = el operador las apaga mentalmente.
44. Alert fatigue and dashboard overload: why cybersecurity needs better UX (Medium/Bootcamp, N. Naidu) — https://medium.com/design-bootcamp/alert-fatigue-and-dashboard-overload-why-cybersecurity-needs-better-ux-1f3bd32ad81c — ene-2026 ⚠ — miles de alertas/día de bajo valor entrenan a ignorar; priorización > volumen.
45. From Data To Decisions: UX Strategies For Real-Time Dashboards (Smashing Magazine, K. Rawal) — https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/ — 12-sep-2025 — ~5 elementos críticos visibles; arriba-izquierda; timestamps de frescura; "calmness" como criterio.
46. Designing Bento Grids That Actually Work: A 2026 Practical Guide (SaaSFrame) — https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide — 2026 — el contenido MÁS importante recibe la caja MÁS grande; fijación ~2,6× en ítems grandes; no forzarlo.
47. CSS Layout Patterns in 2026: Grid, Flexbox, or Bento? (Art of Styleframe) — https://artofstyleframe.com/blog/css-layout-patterns-grid-flexbox-2026/ — 2026 — bento para marketing, dashboards de datos → grid uniforme; >12–15 bloques visibles pierde la ventaja; mobile es su talón.
48. Bento Grid Dashboard Design (Orbix Studio) — https://www.orbix.studio/blogs/bento-grid-dashboard-design-aesthetics — 21-jul-2026 — la posición pro-bento seria: solo con producto denso, usuarios recurrentes y jerarquía no-negociable.
49. UI Density (M. Ström) — https://mattstromawn.com/writing/ui-density/ — may-2024 — "value a user gets… divided by the time and space the interface occupies"; densidad visual/de información/de diseño/temporal.
50. What UI density means and how to design for it (Hacker News) — https://news.ycombinator.com/item?id=40428386 — 21-may-2024 — [foro] 767 puntos / 387 comentarios: la audiencia técnica pide densidad con jerarquía.
51. F-Shaped Pattern of Reading: Misunderstood, But Still Relevant (NN/g) — https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/ — 2017 ⚠ — la F es el default sin guía; el buen layout la anula.
52. Understanding the F-Shaped and Z-shaped Reading Patterns for Optimal Usability in Complex Systems (Medium/UxD Critical Software, P. Duarte) — https://medium.com/uxd-critical-software/understanding-the-f-shaped-and-z-shaped-reading-patterns-for-optimal-usability-in-complex-systems-e96668839abd — s/f ⚠ — F para denso en texto, Z para vistas ralas de bloques.
53. Ask HN: What are good high-information density UIs? (Hacker News) — https://news.ycombinator.com/item?id=43925732 — 8-may-2025 — [foro] 530 puntos / 372 comentarios: hambre de densidad bien hecha; queja de artículos-eco.
54. An experiment in UI density created with Svelte (Hacker News) — https://news.ycombinator.com/item?id=41088013 — 27-jul-2024 — [foro] 882 puntos / 256 comentarios sobre una grilla ultra-densa.
55. Ask HN: Good Uses of Scrolljacking? (Hacker News) — https://news.ycombinator.com/item?id=43021954 — 12-feb-2025 — [foro] casi nadie encuentra un buen uso.
56. Show HN: Cladd – React UI kit for editors, dashboards, and dense app UIs (Hacker News) — https://news.ycombinator.com/item?id=48196556 — 19-may-2026 — [foro] la densidad como categoría de producto en 2026.
