# 15 · Navegación en cadena: reestructurar, agrupar y que cada decisión abra la siguiente

**Investigación web — 13 de septiembre de 2026**
**Eje:** reestructuración de navegación en apps operativas: qué agrupar, qué encadenar, aprendizaje-en-cadena del usuario, y cómo los mejores productos rediseñaron su arquitectura de información en 2025-2026.
**Para:** app NorthSignal (un operador, 4 cuentas de Google Ads, decisión humana obligatoria).

---

## 0. Resumen ejecutivo

Tres rediseños de navegación de primera línea se documentaron completos en la ventana 2025-2026 — Vercel (enero-febrero 2026), Notion (febrero-marzo 2026), Linear (octubre 2025 - julio 2026) — y los tres convergen en las mismas cinco jugadas:

1. **Menos lugares, más filtros.** Vercel convirtió el proyecto en un *filtro* sobre la misma página en vez de un lugar aparte. NorthSignal ya lo hace con ⌥1-4; hay que llevarlo hasta el fondo.
2. **Agrupar por objeto, ordenar por frecuencia de workflow.** Vercel reordenó "los workflows más comunes primero"; Stripe agrupó por objeto (transacciones, productos, clientes) más atajos de recencia (pinned + recientes).
3. **La cola es el producto.** Superhuman, Linear Triage, Graphite y hasta Gmail resuelven el trabajo diario con el mismo patrón: actuar sobre un ítem avanza automáticamente al siguiente. La navegación desaparece dentro de la cola.
4. **El contexto viaja en la URL, y la vuelta es un back-link explícito.** La literatura 2025-2026 sobre URL-as-state es unánime; GOV.UK documenta el patrón de retorno "al estado en que lo dejaste".
5. **Los rediseños se sueltan opt-in y se defienden de la memoria muscular.** Vercel: beta enero → default febrero, con feedback público. Linear: flag interno → beta privada → porcentaje. Notion: opt-in con cada sección apagable. Las quejas de foros son siempre las mismas tres: velocidad percibida, cosas movidas sin aviso, módulos que no se pueden apagar.

**Veredicto sobre los 6 tabs de Cuenta:** mal agrupados por mezcla de ejes. `semana`, `brief` y `diagnóstico` son tres lentes del mismo objeto temporal (la semana de la cuenta) y deberían fundirse en una narrativa única. `accionables` es una cola (eje tarea), `memoria` y `reportes` son archivos (eje objeto). Cuenta queda mejor con 4 tabs: **Semana** (narrativa: brief → plan → diagnóstico), **Accionables**, **Memoria**, **Reportes**. El detalle en §5.

**Corpus:** 40 fuentes reales verificadas — 19 de 2026 (3 de junio-agosto 2026), 9 de foros/comunidad. Tabla completa en §10.

---

## 1. Metodología

Búsqueda y lectura directa (WebSearch/WebFetch + Exa) sobre: changelogs y blogs oficiales de Vercel, Linear, Notion, Stripe, Superhuman, Graphite, Front, Gmail, Google Ads y Pega; documentación de patrones (GOV.UK Design System, NN/g, OOUX); y foros (Hacker News vía Algolia API, Vercel Community, X/Twitter, LinkedIn, GitHub issues). Se priorizó la ventana junio-septiembre 2026 y se descartó todo lo no verificable. Donde una fuente no confirma un detalle (ej.: si Linear Triage auto-avanza tras accionar), se dice explícitamente.

Dos fetches devolvieron versiones viejas de URLs canónicas (el blog `vercel.com/blog/dashboard-redesign` es de 2019; `notion.com/blog/new-sidebar-design` es de 2022): los rediseños 2026 viven en los changelogs, no en los blogs. Se citan los changelogs.

---

## 2. Los rediseños reales, documentados

### 2.1 Vercel — enero-febrero 2026: la IA repensada de un dashboard que nunca se había rediseñado

Cronología verificada:

- **22 ene 2026** — changelog "New dashboard navigation available": opt-in. Los tabs horizontales pasan a un **sidebar redimensionable y ocultable**; ítems reordenados "para priorizar los workflows de desarrollo más comunes"; **tabs consistentes entre nivel equipo y nivel proyecto**; y la jugada clave: *"switch between team and project versions of the same page in one click"* — el proyecto deja de ser un lugar y pasa a ser un **filtro** sobre la misma página. En móvil, bottom bar flotante para uso con una mano.
- **23-24 ene 2026** — Guillermo Rauch publica "New Vercel dashboard who dis" y ofrece swag por feedback; Christopher Skillicorn (design) enmarca: *"we've never redesigned our dashboard. It's been a constant stream of incremental changes. Today you can opt in to our biggest evolution yet, rethinking the IA and navigation."*
- **26 feb 2026** — changelog "New dashboard redesign is now the default": rollout completo "con varias mejoras hechas en base al feedback" de la beta.
- **27 may 2026** — changelog "Redesigned Deployments List": layout más denso ("ver más deployments a la vez"), **environments agrupados con sus estados**, mejor escaneo de branches/commits, móvil mejorado. El rediseño de IA siguió con ajustes de densidad meses después del rollout.

Qué enseña el feedback público (hilo de Rauch, ene 2026): la primera fricción es **memoria muscular, no UX** (*"the first 5–10 minutes feel a tiny bit disorienting (mostly muscle memory, not actual UX issues). But after that, it's objectively better"*); segundo, **secciones que quedan vacías** en el sidebar se sienten rotas (*"if you have few integrations or flags enabled, the list can look empty"*); tercero, se pierden **indicadores ambientales** (el usuario que extrañaba las "wavy lines" de builds corriendo). Y la crítica de identidad: *"this sidebar-tab design makes an infra company look like a SaaS"*.

Feedback individual detallado (Suryansh Singh, LinkedIn, 24 ene 2026): el botón de notificaciones movido de lugar costó "minutos de búsqueda activa" — mover un ancla sin señalizar es la falla más cara de un rediseño; y *"some sub options might work better inside the main content area instead of being nested in the sidebar"* — no todo lo navegable merece sidebar.

### 2.2 Linear — octubre 2025 a julio 2026: la navegación como motivo real del rediseño

- **16 oct 2025** — changelog "Mobile app redesign": navegación reconstruida con **bottom toolbar para los core workflows** y botón "Create Issue" en todas las pantallas.
- **21 oct 2025** — post "A Linear spin on Liquid Glass": la confesión de diseño más útil del período. La app original *"was built with a narrow use case foremost in mind: individual contributors engaging with issues"*, pero al crecer la base *"executives and managers want an overview... and the existing structure, optimized for a single workflow, couldn't easily support that"*. Rechazaron las APIs de Apple porque *"wouldn't give us the control we needed to build the customizable navigation that was **the real purpose for our redesign**"*. La estética fue vehículo; el objetivo era **navegación adaptable por rol**.
- **22 ene 2026** — changelog "Customize your navigation in Linear Mobile": reordenar la toolbar, **pinear proyectos/iniciativas/documentos** como ítems de navegación de primer nivel.
- **18 jun 2026** — changelog "Desktop navigation history and pinned tabs": *"Each desktop tab now has its own history stack, so moving backwards won't navigate you to another tab. Pinned tabs are now a reliable home for important work"* — persisten al reiniciar y no son reemplazados por contenido nuevo. **El back respeta el hilo de trabajo, no la cronología global.**
- **23 jul 2026** — changelog "Refreshed issue sidebar": las propiedades del issue se integran al contenido y **Diffs queda pineado arriba** *"so you can access the issue's pull requests from anywhere on the page"* — traer el objeto relacionado adentro, en vez de hacer navegar hacia él.

Método de rollout (post "How we redesigned the Linear UI, part II", mar 2024, aún canónico): flag interno con toggle en la toolbar de desarrollo → dogfooding de todos los equipos (cada equipo usa partes distintas de la app: producto mira roadmaps, CX vive en Triage) → beta privada → rollout porcentual. Y la regla de Karri Saarinen: *"A redesign should not completely disassemble the product to its atomic parts."*

### 2.3 Notion — febrero-marzo 2026: partir el sidebar en cuatro y dejar apagar todo

- **feb 2026** — Cole Bemis (diseñador de Notion) anuncia en X el sidebar nuevo; según el hilo, el proyecto interno se llamó "Slippery Slope" y el equipo subraya lo delicado de tocar navegación que usan millones. Las respuestas del hilo son el focus group gratis: "can you turn off Meetings? feels kinda bloated here" y pedidos de organizar chats con la misma estructura que las páginas.
- **26 mar 2026** — release "Notion 3.4, part 1": *"The sidebar was getting far too crowded"* → reorganizado en **4 tabs: pages, agent chats, meetings, notifications**, opt-in, con **cada sección toggleable on/off**. Además: **dashboard view** (charts/KPIs en una página, "removing the need for multiple linked views"), **tabs block** (secciones clickeables dentro de una página, *"without the maze of subpages"*) y **archivado de páginas** (sacar del camino sin borrar, mejora búsqueda y navegación).

Lectura: Notion no agregó jerarquía — **partió por tipo de objeto** (documentos / conversaciones / reuniones / avisos) y compensó el riesgo de bloat con customización total. El tabs block es la misma idea a escala de página: agrupar en secciones planas antes que anidar.

### 2.4 Stripe — la referencia estable: objeto + recencia, y separar al operador del desarrollador

- **may 2024** — "Dashboard update": navegación reagrupada alrededor de los objetos de trabajo (transacciones, productos, clientes), sección de productos Stripe activos, y **shortcuts a páginas pineadas y visitadas recientemente**. Es el patrón híbrido: estructura por objeto + capa personal por recencia/pin.
- **Workbench** (docs vigentes): reemplazó al "Developers Dashboard" — la superficie de debugging/API se separó de la superficie de operación del negocio. Dos roles, dos superficies, cero mezcla.
- El proyecto del Merchant Dashboard (Matt Ström-Awn, lead 2022→): la mejora se midió en *"reduced support volume, higher task success, and longer session lengths"* — las métricas correctas para juzgar una reestructuración de navegación.

---

## 3. Encadenamiento decisión → siguiente decisión

### 3.1 Queue-advance: el patrón más probado del triage

Evidencia de producto, de más viejo a más nuevo:

| Producto | Mecánica documentada |
|---|---|
| **Gmail** (setting "Auto-advance") | *"When you're done with an email, choose to advance to older messages, newer messages, or the conversation list"* — nació en Labs (2010) porque por defecto volvías al inbox y "many of you have asked for the ability to instead go to the next conversation". |
| **Superhuman** | J/H/E: al accionar (posponer/archivar) **avanzás inmediatamente a la siguiente conversación**; el inbox es la to-do list; el Split Inbox agrupa por tipo para procesar *"emails of the same type, at the same time"* — homogeneidad de lote reduce el costo de cambio de contexto. |
| **Front** | Preferencia personal: al desaparecer la conversación actual, elegís ver la de arriba, la de abajo o **"Smart"** (según la dirección en la que venías navegando). |
| **Linear Triage** | Cola de entrada con veredictos de una tecla: **1 accept / 2 merge / 3 decline / H snooze**, cada uno con comentario opcional. La doc no especifica auto-avance tras accionar (dato honesto), pero el Inbox de Linear navega con J/K y snoozea con H — la gramática de cola está en toda la app. |
| **Graphite** | El PR inbox es *"an email client for your PRs"* con secciones (Needs your review / Returned to you / ...); al enviar review, el PR **se mueve solo de sección**; en stacks: *"add your comments, choose your review outcome, and move on to the next PR"* con atajo S para saltar dentro del stack. |
| **Mailspring** (GitHub #1719) | Feature request comunitario de años pidiendo exactamente auto-advance — la demanda del patrón es orgánica, no inventada por diseñadores. |

Síntesis operable: **el costo de decidir N ítems no es N × costo del ítem; es N × (decisión + navegación + recarga de contexto)**. Queue-advance elimina los dos últimos términos. Y el agrupado homogéneo (split) elimina además el cambio de "tipo de decisión" — la razón por la que Superhuman insiste en procesar lotes del mismo tipo.

### 3.2 Next-best-action: cuando el sistema propone el siguiente eslabón

- **Google Ads — el mismo dominio de NorthSignal.** El Help oficial de recomendaciones: *"Applying one recommendation may unlock new opportunities for your campaign"* — Google modela explícitamente que una acción aplicada **genera** las siguientes. La API expone la maquinaria: `optimization_score_uplift` (cuánto sube el score si aplicás), `optimization_score_url` (**deep links** a las recomendaciones relacionadas) y un campo `impact` con estimaciones base vs. potencial. Además Google incrustó el "Results tab" (seguimiento del efecto de lo aplicado) **dentro del flujo de recomendaciones**, no como reporte aparte.
- **Pega Customer Decision Hub** (docs 2025) — el framework enterprise de next-best-action más maduro: las acciones elegibles pasan por **arbitraje** con cuatro factores numéricos — *Propensity, Context weighting, Business value, Business levers* — y una fórmula de prioridad elige la próxima acción. Trasladado: la cola de accionables no se ordena por cronología sino por valor arbitrado.
- La advertencia del foro: en el thread de HN sobre Notion 3.0 (sept 2025, 66 comentarios), la objeción central a los agentes que actúan fue de auditabilidad: *"how do I even know if it has hallucinated if it can do anything anywhere in the workspace?"*. Un sistema que propone el siguiente paso necesita mostrar **por qué** lo propone (en NorthSignal: el radio de evidencia del veredicto) o erosiona la confianza que lo sostiene.

### 3.3 La cadena como estructura de pantalla

Linear (jul 2026) pineando Diffs arriba del sidebar del issue es encadenamiento espacial: el siguiente objeto probable de la tarea (el PR) se trae adentro de la superficie actual. Notion con el tabs block: los pasos hermanos conviven en una página en vez de repartirse en subpáginas. La regla que emerge: **si B es el paso siguiente de A en más de la mitad de los casos, B se embebe o se ofrece; no se hace navegar.**

---

## 4. Contexto que viaja en la cadena

### 4.1 La URL como fuente de verdad del estado de vista

Consenso técnico 2025-2026, con tres fuentes independientes recientes:

- *The Frontend Casebook* (31 may 2026): filtros/orden/paginación/búsqueda son *"UI state that users expect to be bookmarkable and shareable"*; guardarlos en estado de componente "es una falla de UX". Caso: `/customers?status=active&region=apac&plan=pro&joined=30d` — compartís la URL y el colega ve exactamente los mismos 47 registros. Red flag explícito: meter estado de filtros en Redux/Zustand cuando el store correcto es la URL.
- *DEV Community* (4 may 2026): regla de equipo: *"If a piece of state changes what data is displayed on the screen, it must live in the URL"*; el estado local queda para lo transitorio (un modal abierto, un input a medio tipear).
- *Loren Stewart* (29 jul 2025): la URL *"is not just an address: it's a complete state representation that users can bookmark, share, or refresh without losing context"* — y el botón atrás del navegador vuelve gratis al estado de filtros anterior.

Para NorthSignal, esto es lo que hace posible el salto Bandeja→Datos sin perder el hilo: el drawer arma `/datos?cuenta=BHI&termino=...&ventana=...&origen=accionable-123` y todo el contexto viaja en el link.

### 4.2 La vuelta: back-link con estado, nunca dos migas a la vez

GOV.UK Design System, componente **Back link** (el patrón institucional mejor documentado):

- El link vuelve *"to the previous page they were on, **in the state they last saw it**"* — volver no es recargar: es restaurar.
- Existe porque los usuarios evitan el back del navegador *"for fear of losing progress"* en transacciones multi-paso.
- *"Never use the back link component together with the Breadcrumbs component"* — un solo mecanismo de retorno por pantalla.
- Para journeys complejos, el texto descriptivo: **"Go back to [page name]"** — en NorthSignal: "Volver al accionable #123 (BHI)".

El complemento de Linear (jun 2026): cada tab de escritorio con **su propio history stack** — el atrás nunca te saca de tu hilo hacia otro contexto. Es la versión de escritorio del mismo principio: la historia de navegación pertenece a la cadena, no a la app entera.

### 4.3 El breadcrumb efímero

Ningún vendor lo llama así, pero el patrón compuesto queda definido por las piezas verificadas: **param `origen` en la URL** (§4.1) + **banner de retorno con estado** (§4.2) + **expiración natural** (el banner vive mientras exista la sesión de la cadena; si entraste a Datos directo, no hay banner). Es un breadcrumb de UNA miga que existe solo cuando venís encadenado.

---

## 5. Agrupar por objeto, por tarea o por tiempo — y el veredicto sobre los 6 tabs de Cuenta

### 5.1 La evidencia

- **OOUX** (Sophia Prater): *"objects first, actions second"*. Partir el sistema por verbos/features produce *"cobbled-together, disjointed user experiences"*; partir por sustantivos produce navegación *"circular y contextual"* por asociaciones entre objetos (UXtweak 101). El proceso ORCA: Objects, Relationships, Calls-to-action, Attributes.
- **Los rediseños 2026 son híbridos, no puristas.** Notion partió el sidebar **por tipo de objeto** (páginas/chats/reuniones/avisos). Stripe agrupa **por objeto** (transacciones/productos/clientes) pero le superpone una capa **personal-temporal** (pinned + recientes). Vercel ordena una estructura de objetos **por frecuencia de tarea** ("most common developer workflows first"). Linear estructura por objetos (issues/proyectos/documentos) pero el trabajo diario entra **por colas de tarea** (Inbox, Triage) y deja pinear objetos como navegación personal.
- **La capa temporal-narrativa gana para reportar estado.** La corriente "beyond dashboards" (KDnuggets; Gartner vía su Critical Capabilities 2025 puso data storytelling como prioridad de plataformas BI) converge en que para *decidir* — no explorar — una narrativa con contexto supera a la grilla de widgets. Con matiz de la misma literatura: no reemplaza al dashboard, lo envuelve.

La regla de decisión que sale del corpus: **estructura por objeto** (URLs estables, mapa mental), **entrada por tarea** (colas), **lectura por tiempo** (narrativa). Los tres ejes conviven; el error es mezclarlos en el mismo nivel de un menú.

### 5.2 Veredicto: los 6 tabs de Cuenta mezclan los tres ejes en un solo nivel

Hoy: `semana · diagnóstico · brief · accionables · memoria · reportes`.

- `semana` (tiempo), `brief` (documento semanal), `diagnóstico` (veredicto del período) son **tres lentes del mismo objeto temporal**: la semana de la cuenta. El flujo real del lunes lo confirma: brief → plan de semana → decidir accionables es UNA lectura encadenada que hoy exige tres clicks de tab y tres recargas de contexto. Exactamente lo que Notion resolvió con el dashboard view ("removing the need for multiple linked views") y el tabs block (secciones dentro de una superficie, no subpáginas hermanas).
- `accionables` es una **cola** (eje tarea) — es la sucursal de la Bandeja filtrada por cuenta, y debería comportarse como tal (mismo drawer, mismo queue-advance).
- `memoria` y `reportes` son **archivos** (eje objeto) — consulta esporádica, retención correcta como tabs.

**Propuesta: Cuenta pasa de 6 a 4 tabs.**

| Tab nuevo | Absorbe | Forma |
|---|---|---|
| **Semana** | semana + brief + diagnóstico | Narrativa temporal única: arriba el brief (la edición del lunes), al medio el plan/estado de la semana, abajo el diagnóstico con su radio de evidencia. Secciones ancladas (deep links `#brief`, `#diagnostico`) para no perder direccionabilidad. |
| **Accionables** | accionables | La misma cola de Bandeja filtrada por la cuenta, con el mismo drawer y el mismo avance. |
| **Memoria** | memoria | Igual. |
| **Reportes** | reportes | Igual. |

Riesgo a mitigar (lección Vercel §2.1): fusionar tabs mueve anclas de memoria muscular. Mitigación: los tres nombres viejos siguen resolviendo — `cuenta/BHI/brief` redirige a `cuenta/BHI/semana#brief` — y ⌘K conserva las tres entradas como sinónimos.

### 5.3 Sistema y Herramientas

`Sistema [salud · aprendizaje · automatización · soporte]` está bien agrupado: es la superficie de auditoría (flujo c), separada del trabajo diario igual que Stripe separó Workbench del dashboard de operación. Dos ajustes: (1) `aprendizaje` (lecciones) es también **insumo de decisión** — cuando una lección aplica al accionable en foco, se trae al drawer como link contextual, no se espera que el operador la recuerde; (2) `Herramientas`, si su uso real es esporádico, es candidata a vivir en ⌘K y no gastar un slot permanente del sidebar (feedback Vercel: "some sub options might work better inside the main content area"; Notion: toda sección se puede apagar).

---

## 6. El home como router: cuánta navegación no debería existir

La evidencia inbox-first es consistente entre productos que viven del triage:

- **Superhuman**: el inbox ES la to-do list (*"archive emails when done, and treat your inbox as a to-do list"*); la navegación a carpetas es residual. El split trae el lote a la vista; no vas a buscarlo.
- **Graphite**: el PR inbox como "email client for your PRs" — el reviewer no navega el repo: la cola le acerca lo que necesita su atención, ordenado por secciones de estado.
- **Linear**: Inbox (G+I) concentra "work that needs attention" con J/K/H; Triage es el buzón de entrada del equipo. El resto de la navegación (proyectos, vistas) es para planificar, no para operar.
- **Vercel** (may 2026): densificó la lista de deployments para "ver más de una vez" — menos drill-down para el monitoreo diario.
- **Linear móvil** (oct 2025): la reestructuración entera partió de reconocer que la estructura "optimized for a single workflow" no servía a quien necesita *overview* — el home debe absorber el workflow dominante de cada rol.

Traducción a NorthSignal, donde `v_para_actuar` ya define qué pide acción hoy: **la mañana entera (flujo a) debería cerrarse sin tocar el sidebar.** Bandeja trae la cola arbitrada (§3.2), el drawer trae la evidencia mínima del término embebida (§3.3, patrón Linear-Diffs), el queue-advance encadena las decisiones (§3.1), y el salto a Datos queda como excepción con contexto en la URL y banner de vuelta (§4). El sidebar existe para los flujos b (lunes) y c (auditoría), y para romper la cadena cuando el operador quiere explorar. La métrica de éxito es la de Stripe: menos pasos de soporte propio, más task success — o en términos locales: **cuántas mañanas terminan con cero clicks de sidebar.**

Un límite documentado: cuando el router esconde demasiado, aparecen los tickets "¿dónde está X?" (Vercel Community, mar 2026: *"the vertical icon tray is no longer showing... It was there one minute, and gone the next"* — respuesta del staff: "se movió a un modal"). El home puede absorber navegación solo si lo que absorbe sigue siendo encontrable por ⌘K y por URL directa.

---

## 7. Aprendizaje-en-cadena para un power user, sin tours

- **NN/g, "Onboarding Tutorials vs. Contextual Help"**: los tours (push) *"interrupt users, don't improve task performance, and are quickly forgotten"*; la ayuda contextual (pull) gana porque aparece cuando el usuario señala que la necesita y no exige memorización. Regla derivada: **cero tours en NorthSignal; todo hint es post-acción y descartable-recuperable.**
- **NN/g, "Progressive Disclosure"**: revelar capacidad gradualmente mejora learnability, eficiencia y tasa de error — el mecanismo formal detrás de "el uso enseña el siguiente paso".
- **Superhuman** (guías Blake Crosley / teardowns): el menú/⌘K *"exposes all relevant actions as well as the associated keyboard shortcut, which both exposes functionality and teaches users how to access it more quickly"* — el command palette es el manual: cada uso enseña el atajo que lo reemplaza. El onboarding humano de 30 min de Superhuman no es replicable ni necesario acá; su mecánica in-product sí: **drill de memoria muscular en contexto, no explicación de features**.
- **Patrón concreto para NorthSignal** (síntesis de los tres): (1) tras aprobar con mouse 3 veces seguidas, hint de una línea en el drawer: "también: tecla A — y avanza sola al siguiente"; (2) tras el primer salto manual a Datos desde un accionable, hint: "⏎ abre el término con la búsqueda ya cargada"; (3) tras cerrar la última decisión del lunes, hint: "la semana que viene: ⌘K → 'plan'". Cada hint aparece una vez, se descarta con Esc, y queda recuperable en ⌘K → "atajos". La cadena de hints replica la cadena de decisiones: cada eslabón enseña el atajo del eslabón siguiente.

---

## 8. Lo que los foros gritan (2025-2026)

1. **La velocidad percibida manda.** *"The new Vercel dashboard UI looks good, but I miss the speed of the old UI"* (X, ene 2026). Un rediseño que agrega 100 ms por transición pierde aunque agrupe mejor.
2. **La memoria muscular es un costo real pero corto — si no movés anclas.** Hilo de Rauch: 5-10 minutos de desorientación, después "objectively better". Pero el botón de notificaciones movido costó minutos de búsqueda activa (LinkedIn, ene 2026). Mover contenedores, sí; mover anclas (notificaciones, switcher, ⌘K), no.
3. **Todo módulo no usado tiene que poder apagarse.** La primera respuesta al sidebar de Notion: "can you turn off Meetings?... feels kinda bloated" (X, feb 2026). Notion respondió con toggles por sección; Linear con toolbar customizable (ene 2026).
4. **Mover sin avisar genera tickets.** Vercel Community (mar 2026): usuario perdido buscando el icon tray que pasó a modal. Cada cosa movida necesita redirect + respuesta en ⌘K.
5. **La familiaridad gana en herramientas serias.** Ask HN (dic 2025, "Why does every B2B SaaS have to look like Linear/Stripe?"): consenso en que la convención reduce fricción cognitiva y da confianza — *"if you stray too far from the group, procurement folks get jittery"*. Para una app de un solo operador el argumento social pesa menos, pero el de fricción cognitiva pesa igual: sidebar izquierdo, ⌘K, drawer derecho son convenciones correctas; la innovación va en la cadena, no en la geografía.
6. **La automatización sin auditoría asusta a los usuarios técnicos.** HN sobre Notion 3.0 (sept 2025): la objeción no fue a la IA sino a no poder verificarla. El "siguiente sugerido" de NorthSignal siempre muestra su porqué (veredicto + radio de evidencia) — que ya es la regla de la casa.

---

## 9. Doce decisiones para NorthSignal

1. **Fusionar `semana + brief + diagnóstico` en un tab "Semana"** con narrativa temporal (brief arriba, plan al medio, diagnóstico abajo), anclas `#brief`/`#diagnostico`, redirects desde las rutas viejas y sinónimos en ⌘K. Cuenta queda con 4 tabs. [Notion 3.4; KDnuggets/Gartner; OOUX]
2. **Queue-advance en el drawer de accionable**: aprobar/rechazar/simular avanza automático al siguiente de la cola, con setting para apagarlo y dirección "Smart" (según de dónde venías). El drawer se re-llena; no se cierra. [Superhuman; Gmail; Front; Linear Triage]
3. **Lotes homogéneos en la Bandeja**: agrupar accionables por tipo (negativas juntas, presupuestos juntos) y por cuenta, para procesar "same type, at the same time". El orden dentro del lote no es cronológico: es arbitrado por valor × contexto × urgencia. [Superhuman split; Pega arbitration]
4. **Next-best-action post-aprobación**: al aprobar X, ofrecer el eslabón relacionado ("aprobaste la negativa del término T → ver el término hermano en el mismo grupo", "subiste presupuesto → revisar objetivo de puja"), siempre con el porqué visible y respetando el radio de evidencia. Google ya modela que aplicar desbloquea lo siguiente. [Google Ads recommendations; Pega; HN Notion 3.0 como advertencia]
5. **Contexto que viaja en la URL**: el salto Bandeja→Datos arma `/datos?cuenta=…&termino=…&ventana=…&origen=accionable-N`. Regla dura: todo estado que cambia lo que se ve, vive en la URL. [Frontend Casebook 2026; DEV 2026; Stewart 2025]
6. **Banner de retorno efímero estilo GOV.UK**: en Datos, si hay `origen`, banner "Volver al accionable #N (BHI)" que restaura el drawer **en el estado en que quedó** (Esc también vuelve). Nunca banner + breadcrumb a la vez; sin `origen`, sin banner. [GOV.UK back-link; Linear history-per-tab]
7. **Evidencia embebida en el drawer**: la mini-tabla del término (la consulta que hoy motiva el salto a Datos) se trae al drawer; Datos queda para la excepción exploratoria. Métrica: mañanas con cero clicks de sidebar. [Linear jul 2026 (Diffs pineado); Graphite; Stripe (task success)]
8. **Reordenar el sidebar por frecuencia real**: Bandeja, Cuenta, Datos, Sistema; `Herramientas` pasa a ⌘K (o a sección colapsable) salvo que el uso demuestre lo contrario. Secciones ocultables como en Notion. [Vercel ene 2026; Notion 3.4; feedback Suryansh]
9. **Cuenta como filtro hasta el fondo**: ⌥1-4 ya preserva vista — extenderlo a TODA superficie (incluida Semana y Datos con filtros activos: el switch re-filtra, no resetea) y agregar el estado "las 4 cuentas" para Bandeja y Salud. [Vercel "projects as filters"]
10. **Pins personales de navegación**: permitir pinear una vista frecuente (un término vigilado, un reporte) como ítem persistente — "a reliable home for important work" que sobrevive reinicios. [Linear jun 2026; Stripe pinned/recientes]
11. **Hints encadenados post-acción, cero tours**: cada hint enseña el atajo del eslabón siguiente de la cadena real (aprobar → tecla A; saltar a Datos → ⏎; cerrar lunes → ⌘K 'plan'). Una vez, descartable, recuperable en ⌘K. [NN/g contextual help; NN/g progressive disclosure; Superhuman]
12. **Rollout del rediseño como Vercel/Linear**: toggle "navegación nueva" conviviendo con la vieja al menos una semana, anclas intocadas (⌘K, ⌥1-4, drawer a la derecha), redirects para toda ruta movida, y revisión de fricciones antes de hacerla default. No desarmar el producto hasta los átomos. [Vercel ene→feb 2026; Linear part II]

---

## 10. Fuentes

**Formato: título — URL — fecha — aporte.** 40 fuentes; 19 de 2026 (marcadas ★; las de jun-ago 2026, ★★); foros/comunidad marcadas [F] (9).

### Rediseños oficiales 2025-2026

1. ★ New dashboard navigation available — https://vercel.com/changelog/new-dashboard-navigation-available — 22 ene 2026 — Sidebar reemplaza tabs horizontales; orden por workflows comunes; opt-in.
2. ★ New dashboard redesign is now the default — https://vercel.com/changelog/dashboard-navigation-redesign-rollout — 26 feb 2026 — Rollout tras beta; tabs consistentes team/proyecto; "projects as filters"; bottom bar móvil.
3. ★★ Redesigned Deployments List — https://vercel.com/changelog/redesigned-deployments-list — 27 may 2026 — Densidad ("ver más a la vez"), environments agrupados con estados; la IA se siguió ajustando post-rollout.
4. ★ [F] "At Vercel we default to working iteratively…" (Christopher Skillicorn, LinkedIn) — https://www.linkedin.com/posts/skllcrn_at-vercel-we-default-to-working-iteratively-activity-7420827923344945153--biS — 24 ene 2026 — "Never redesigned… biggest evolution yet, rethinking the IA and navigation".
5. ★ [F] "New Vercel dashboard who dis" (Guillermo Rauch, LinkedIn, con respuestas) — https://www.linkedin.com/posts/rauchg_new-vercel-dashboard-who-dis-%E2%91%A0-go-to-vercelfyi-activity-7420567510279827457-ZCjv — 23 ene 2026 — Feedback por swag; muscle memory 5-10 min; secciones vacías; "makes an infra company look like a SaaS".
6. Mobile app redesign — Linear Changelog — https://linear.app/changelog/2025-10-16-mobile-app-redesign — 16 oct 2025 — Bottom toolbar para core workflows; Create Issue en toda pantalla.
7. A Linear spin on Liquid Glass — https://linear.app/now/linear-liquid-glass — 21 oct 2025 — La navegación customizable por rol como "the real purpose for our redesign"; tab bar propia expandible.
8. ★ Customize your navigation in Linear Mobile — https://linear.app/changelog/2026-01-22-customize-your-navigation-in-linear-mobile — 22 ene 2026 — Toolbar reordenable; pinear proyectos/iniciativas/documentos.
9. ★★ Desktop navigation history and pinned tabs — https://linear.app/changelog/2026-06-18-agent-assisted-project-updates — 18 jun 2026 — History stack por tab; pinned tabs como "reliable home" persistente.
10. ★★ Refreshed issue sidebar — https://linear.app/changelog/2026-07-23-agent-assisted-editing — 23 jul 2026 — Propiedades integradas al contenido; Diffs pineado: el objeto siguiente se trae adentro.
11. How we redesigned the Linear UI (part II) — https://linear.app/now/how-we-redesigned-the-linear-ui — 28 mar 2024 — Método de rollout (flag → dogfood → beta → %); "a redesign should not completely disassemble the product".
12. ★ Notion 3.4, part 1 — Releases — https://www.notion.com/releases/2026-03-26 — 26 mar 2026 — "Sidebar was getting far too crowded" → 4 tabs toggleables; dashboard view; tabs block; archivado.
13. ★ [F] "Notion is getting a new sidebar" (Cole Bemis, X, con respuestas) — https://x.com/colebemis/status/2021766002917376058 — feb 2026 — Anuncio del diseñador; proyecto "Slippery Slope"; reacciones: "can you turn off Meetings? feels kinda bloated".
14. ★ Notion 3.4 adds dashboard, sidebar revamp… — AlternativeTo News — https://alternativeto.net/news/2026/3/notion-3-4-adds-dashboard-sidebar-revamp-tabs-block-page-archiving-and-presentation-mode — 30 mar 2026 — Cobertura independiente del 3.4.
15. ★ Notion 3.4 adds dashboards, presentation mode, and a redesigned sidebar — Efficienist — https://efficienist.com/notion-3-4-adds-dashboards-presentation-mode-and-a-redesigned-sidebar/ — 26 mar 2026 — Release partido en varios anuncios; tabs block era interno hace años.
16. Dashboard update: May 2024 — Stripe Support — https://support.stripe.com/questions/dashboard-update-may-2024 — may 2024 — Reagrupado por objetos de trabajo + pinned y visitados recientes.
17. How Workbench works — Stripe Docs — https://docs.stripe.com/workbench/overview — s/f (vigente sep 2026) — Workbench reemplaza el Developers Dashboard: rol desarrollador separado del operador.
18. Stripe Merchant Dashboard — Matt Ström-Awn — https://mattstromawn.com/projects/stripe-dashboard/ — 2022-2025 — 1.4M usuarios; éxito medido en menos soporte, más task success, sesiones más largas.

### Encadenamiento y colas

19. Getting started and hitting Inbox Zero — Superhuman Blog — https://blog.superhuman.com/inbox-zero-in-7-steps/ — s/f (vigente sep 2026) — J/H/E con avance inmediato al siguiente; inbox como to-do list.
20. Create Your Own Split Inbox — Superhuman Help — https://help.superhuman.com/hc/en-us/articles/45275075302931-Create-Your-Own-Split-Inbox — s/f (vigente sep 2026) — Procesar "emails of the same type, at the same time".
21. Triage — Linear Docs — https://linear.app/docs/triage — s/f (vigente sep 2026) — Cola de entrada; veredictos de una tecla (1/2/3/H); responsable rotativo.
22. Inbox — Linear Docs — https://linear.app/docs/inbox — s/f (vigente sep 2026) — J/K para recorrer, H snooze, tab de prioridad.
23. Review pull requests — Graphite Docs — https://graphite.com/docs/review-pull-requests — s/f (vigente sep 2026) — PR inbox como "email client"; el PR se mueve de sección al accionar; "move on to the next PR" en stacks.
24. Change your Gmail settings (Auto-advance) — Google Help — https://support.google.com/mail/answer/6562 — s/f (vigente sep 2026) — "When you're done with an email, choose to advance to older, newer, or the conversation list".
25. Your settings and personal preferences — Front Help — https://help.frontapp.com/t/802v8d/your-settings-and-individual-preferences — s/f (vigente sep 2026) — Próxima conversación tras accionar: arriba/abajo/"Smart" según dirección de navegación.
26. [F] Feature request: auto-advance upon archive/delete — Mailspring GitHub #1719 — https://github.com/Foundry376/Mailspring/issues/1719 — abierto desde 2019 — Demanda comunitaria orgánica del patrón.
27. Optimization score and recommendations in campaign construction — Google Ads Help — https://support.google.com/google-ads/answer/12994751 — s/f (vigente sep 2026) — "Applying one recommendation may unlock new opportunities".
28. Recommendations — Google Ads API Docs — https://developers.google.com/google-ads/api/docs/recommendations — s/f (vigente sep 2026) — `optimization_score_uplift`, deep links a recomendaciones, campo `impact` base vs. potencial.
29. Next-Best-Action Designer — Pega Docs — https://docs.pega.com/bundle/customer-decision-hub/page/customer-decision-hub/hub/next-best-action-designer.html — 19 sep 2025 — Arbitraje: Propensity × Context × Business value × Levers deciden la próxima acción.

### Contexto que viaja

30. Back link — GOV.UK Design System — https://design-system.service.gov.uk/components/back-link/ — s/f (vigente sep 2026) — Volver "in the state they last saw it"; nunca junto a breadcrumbs; "Go back to [page name]".
31. ★★ URL as Source of Truth for Filters — The Frontend Casebook — https://anmshpndy.com/cases/url-as-source-of-truth/ — 31 may 2026 — Filtros/orden/búsqueda en querystring; red flag: ese estado en Redux/Zustand.
32. ★ Stop Trapping React State: Sync Your Filters to the URL — DEV Community — https://dev.to/iprajapatiparesh/stop-trapping-react-state-sync-your-filters-to-the-url-32bb — 4 may 2026 — Regla: si cambia lo que se muestra, vive en la URL.
33. Bookmarkable by Design: URL-Driven State in HTMX — Loren Stewart — https://www.lorenstew.art/blog/bookmarkable-by-design-url-state-htmx/ — 29 jul 2025 — La URL como representación completa del estado; back gratis.

### Agrupamiento y arquitectura

34. What is OOUX — ooux.com — https://ooux.com/what-is-ooux — s/f (vigente sep 2026) — "Objects first, actions second"; ORCA; contra la fragmentación por verbos.
35. Object-Oriented UX (OOUX): Practical 101 — UXtweak — https://blog.uxtweak.com/object-oriented-ux/ — s/f (vigente sep 2026) — Navegación "circular y contextual" por asociaciones entre objetos.
36. The Future of Data Storytelling Formats: Beyond Dashboards — KDnuggets — https://www.kdnuggets.com/the-future-of-data-storytelling-formats-beyond-dashboards — 2025 — Narrativa con contexto supera a la grilla para decidir; cita Gartner Critical Capabilities 2025.

### Onboarding sin tours

37. Onboarding Tutorials vs. Contextual Help — NN/g — https://www.nngroup.com/articles/onboarding-tutorials/ — 12 feb 2023 — Tours no mejoran performance y se olvidan; ayuda pull en contexto gana.
38. Progressive Disclosure — NN/g — https://www.nngroup.com/articles/progressive-disclosure/ — clásico, vigente — Revelar gradualmente mejora learnability, eficiencia y errores.

### Foros y comunidad (además de 4, 5, 13, 26)

39. ★ [F] Vercel dashboard vertical navigation sidebar missing in project view — Vercel Community — https://community.vercel.com/t/vercel-dashboard-vertical-navigation-sidebar-missing-in-project-view/35340 — 3 mar 2026 — Costo de mover cosas sin aviso: "It was there one minute, and gone the next".
40. ★ [F] "I spent some time with the new Vercel sidebar…" (Suryansh Singh, LinkedIn) — https://www.linkedin.com/posts/suryanshsingh2001_i-spent-some-time-with-the-new-vercel-sidebar-activity-7420895307485581312--tQu — 24 ene 2026 — Notificaciones ilocalizables; jerarquía confusa; sub-opciones mejor en el contenido que en el sidebar.
41. [F] Ask HN: Why does every B2B SaaS have to look like Linear/Stripe? — https://news.ycombinator.com/item?id=46179202 — 7 dic 2025 — Familiaridad y pattern-matching ganan a la distintividad en herramientas serias.
42. [F] Notion 3.0 — Hacker News (66 comentarios) — https://news.ycombinator.com/item?id=45304816 — 19 sep 2025 — Bloat y auditabilidad de agentes: "how do I even know if it has hallucinated…".
43. ★ [F] Reacción al dashboard de Vercel (Ranjith @MakeDesignPop, X) — https://x.com/MakeDesignPop/status/2014588064958677420 — ene 2026 — "Miss the speed of the old UI… sidebar feels like the Supabase main sidebar".
44. ★ [F] "Notion just shipped a wave of small, but impactful design updates" (Kumaraditya Dash, LinkedIn) — https://www.linkedin.com/posts/kdash1994_productdesign-uxdesign-notion-activity-7443148110509314048-LKbo — 27 mar 2026 — "The sidebar was getting out of hand"; tratar cada fricción como no resuelta aun a escala.

*Notas de verificación: los fetches de `vercel.com/blog/dashboard-redesign` (2019) y `notion.com/blog/new-sidebar-design` (2022) devuelven posts viejos homónimos — los rediseños 2026 están en los changelogs citados. La doc de Linear Triage no confirma auto-avance tras accionar; el patrón queue-advance se sostiene en Superhuman, Gmail, Front y Graphite. Búsquedas de threads en r/SaaS y HN específicos sobre el rollout de Vercel 2026 no arrojaron hilos dedicados (la conversación ocurrió en LinkedIn/X y el foro propio de Vercel, que es donde Rauch la convocó); se citan esas superficies.*
