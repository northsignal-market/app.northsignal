# 11 · Flujos encadenados y superficies secundarias

**Eje:** drawer vs modal vs panel vs navegación; drill-down sin perder contexto; encadenamiento de decisiones; selects modernos; deep-links y back en SPAs.
**Ventana:** estado del arte 2025–2026, con prioridad jun–sep 2026.
**Fecha de investigación:** 13/9/2026.
**Método:** búsqueda web + verificación de cada fuente por fetch directo cuando la afirmación es estructural (fechas, citas, reglas). 46 fuentes: 18 de 2026 (8 de jun–sep 2026), 12 de foros/comunidad (HN, UX StackExchange, GitHub, comunidad Sigma).

**Para quién:** la app interna de un operador único de Google Ads (React SPA, dark futurista con glow/hairlines). Las cadenas de hoy: Bandeja → accionable → drawer (detalle + aprobar/simular) → a veces Datos con búsqueda precargada o Brief; Semana → día → drawer de día → anotar; Sistema → alerta → resolver. El pedido del dueño: "decisión lleva a otra, abre panel, opción, dropdown… reestructuración de redirecciones, info agrupada con mayor lógica".

---

## TL;DR — la jerarquía que ordena todo

La literatura 2026 converge en una escalera de superficies, de menor a mayor compromiso:

```
inline  →  peek  →  drawer  →  página  →  modal
(editar     (mirar sin   (decidir sobre   (trabajar, comparar,  (interrumpir:
 en el       abrir)       UNA cosa con     compartir URL)        confirmar algo
 lugar)                   la lista visible)                       irreversible)
```

El modal quedó **último**, no primero: es la superficie más cara en atención y la única que bloquea. La frase que resume el consenso es de Friedman en Smashing (mar. 2026): *"page being the default, and modals reserved for interruption and focus"* [1]. Y la regla de profundidad que emerge de design systems y foros: **una sola superficie secundaria a la vez**. Un drawer nunca abre otro drawer; si la tarea pide un segundo nivel, el segundo nivel era una página.

---

## Tema 1 · Cuándo drawer, cuándo modal, cuándo página, cuándo inline

### El framework de decisión (síntesis de Smashing 2026 + design systems)

Smashing (mar. 2026) formaliza un árbol de 4 pasos, atribuido a Ryan Neufeld [1]:

1. **¿El usuario necesita conservar el contexto de la pantalla de abajo?** Si no → página.
2. **¿La tarea es corta y autocontenida, o un flujo largo?** Flujo largo → página.
3. **¿Necesita consultar datos de fondo (copiar, comparar, mirar la fila)?** Sí → overlay no bloqueante (drawer).
4. **Si va overlay: ¿modal o no-modal?** Modal solo si de verdad querés frenar al usuario.

GitLab Pajamas lo baja a componentes con una precisión que ningún artículo iguala, porque distingue **cuatro** superficies, no dos [6]:

- **Drawer** cuando "la tarea primaria del usuario sigue en la página actual y el drawer aporta contexto de apoyo" — vista rápida, edición rápida, referencia suplementaria.
- **Modal** cuando solo hace falta *mantener* el contexto de fondo sin interactuar con él (confirmaciones).
- **Panel** (región fija, no overlay) cuando "la región lateral es parte del workspace central, coexiste con el contenido principal o sostiene un flujo persistente y largo".
- **Página nueva** (o accordion inline) cuando el contenido suplementario no entra en un área chica o es parte de un flujo.

The Hangline (17/8/2026) aporta la tabla de criterios más citada del período [2]:

| Criterio | Modal | Drawer / slide-out |
|---|---|---|
| Nivel de atención | Alto, interruptivo | Medio, contextual |
| Mejor para | Confirmaciones cortas, alertas | Detalle de registro, tareas multi-paso, filtros |
| Retención de contexto | Baja (tapa el fondo) | Alta (el fondo queda visible) |
| Capacidad de contenido | Limitada, evitar scroll | Grande, scrollea cómodo |
| Riesgo de pérdida de datos | Alto si clic-afuera cierra | Similar, mitigable |

Su conclusión operativa: *"if your product involves detail views, editing, filtering, or repeated actions across lists, default to slide-out panels. Reserve modals for the moments when you truly need to stop the user in their tracks"* [2]. Layout Scene (abr. 2026) suma el tercer escalón: **inline** cuando el cambio es menor, frecuente y de bajo riesgo — editar un valor en la celda, anotar — porque cualquier superficie nueva agrega fricción a una tarea repetida [3]. Y el framing conductual de JobPrep Arena para apps densas de trabajo: *"Modal demands full attention. Side-sheet augments attention. The choice is not aesthetic. It is behavioral"* [4].

**Dónde NO va un modal** (Smashing, verbatim): *"Avoid modals for error messages. Avoid modals for feature notifications. Avoid modals for onboarding experience"* [1]. NN/g ya lo había medido en su clásico sobre overlays: sirven para confirmar consecuencias serias o pedir info esencial iniciada por el usuario; dañan cuando exigen scroll extenso, cuando no los inició el usuario o cuando el form no tiene escape visible [5].

### Profundidad de apilado: el consenso es "no apiles"

- **NewsKit** (design system de News UK) es explícito: *"Avoid nesting tiered drawers as this can cause usability issues — consider an alternative component (e.g. accordion) or rethink the page structure"* [7].
- **UX StackExchange**: "hot modal on modal action is not a good thing"; un side panel es "modal but more scalable… but it does have the same issue of being bad form to open a modal ON TOP of an already modal experience — **too Inception**" [34].
- **HN**: proyectos con "modals inside modals and popups as a third layer" aparecen como el ejemplo canónico de app quemada [31].
- **Técnicamente se puede** (Vaul/shadcn tienen nested drawers con `--nested-drawers` para estilar la pila), pero el caso de uso documentado es mobile y formularios por capas, no apps de operación desktop [36].

Cómo lo resuelven los productos que mejor lo hacen, **sin apilar**:

- **Linear**: un solo peek a la vez; navegás entre issues con ↑/↓ *dentro* del mismo peek en vez de abrir uno sobre otro [8].
- **Notion**: side peek único por vista; si necesitás más, el peek se **promueve a página completa** (flechas diagonales), no se apila un segundo peek [9].
- **Attio** (may. 2026): el detalle de registro directamente **es una página**, y lo que serían sub-superficies (comentarios) van a un sidebar *interno de esa página*; en menús, reemplazaron drill-down in-place por **fly-out** (el submenú sale al costado, el padre queda visible) [10][11].
- **Airtable**: record detail como sidesheet o full-screen según configuración; el drill-down por linked records **reemplaza el contenido del panel** con navegación para volver, no abre un segundo panel [12].

**Regla de profundidad destilada: máximo 2 capas visuales en pantalla (base + 1 overlay).** Si desde el overlay hace falta un tercer nivel, las opciones válidas son: (a) reemplazar el contenido del overlay con breadcrumb interno, (b) promover a página, (c) fly-out efímero (menú). Nunca un segundo overlay persistente.

---

## Tema 2 · Drill-down sin perder contexto

### El peek: la superficie que se agregó a la escalera

El patrón con más tracción 2024–2026 es el **peek**: previsualizar sin comprometerse a abrir.

- **Linear** lo tiene canonizado: `Space` togglea el peek sobre el item seleccionado; *mantener* `Space` apretado lo muestra solo mientras dure la tecla (peek transitorio); `↑`/`↓` navegan entre issues adyacentes actualizando el preview; `Esc` cierra. Muestra descripción, assignee, estado, prioridad, cycle, labels, estimate, fechas. Y se auto-activa dentro del command menu: navegás resultados y ves el preview al lado [8].
- **Notion** ofrece la escalera completa configurable por vista: **side peek** (default en table/board/timeline/list), **center peek** (default en calendar/gallery) y **full page**, con el dropdown "Open pages as" y expansión de peek a página con un clic [9].
- **Attio** tomó la decisión opuesta y es igual de instructiva: en mayo 2026 rediseñó el record page como **página completa** — "your most-used screen, rebuilt for speed" — con detalle a la izquierda, acciones arriba, secciones redimensionables y comentarios en sidebar [10]. Lección: cuando el detalle es donde se **trabaja** (no donde se espía), merece página con URL, no overlay.
- **Stripe** usa el híbrido: en su Dashboard cada pago tiene URL propia (página, compartible, con breadcrumb de vuelta a la lista); en los componentes embebidos para plataformas, `payment-details` se renderiza como **overlay que aparece al clickear la fila** de la lista [13]. Overlay para inspección rápida en contexto ajeno; página cuando el objeto es tuyo y se trabaja sobre él.
- **Airtable** agregó al expanded record una **action bar persistente**: los controles de "registro siguiente/anterior" quedan fijos mientras scrolleás el detalle — la misma idea del ↑/↓ de Linear: iterar registros sin volver a la lista [12].

### La advertencia de Baymard: el peek no arregla una lista pobre

La investigación a gran escala de Baymard sobre "Quick Views" (el peek del e-commerce) es la única con datos de testing masivo, y su matiz importa [14][15]:

- Los quick views ayudan con productos **visuales** (la decisión se toma mirando) y estorban con productos **spec-driven** (la decisión se toma comparando atributos): ahí "agregan una capa de fricción sin beneficio sustancial".
- El hallazgo estructural: *"Quick Views are often a substitute for a poor-performing product list"* — la mayoría de las veces conviene **enriquecer la fila de la lista** antes que agregar una superficie de preview [14].

Traducción directa: los accionables de la Bandeja son spec-driven (números, deltas, evidencia). Antes de agregar hover-peeks, la carta del accionable tiene que contener lo suficiente para decidir *si vale la pena abrir*. El drawer se gana su lugar cuando la fila ya dio todo lo que podía.

### El principio de fondo: cambiar estado de paneles, no de ruta

El artículo más reciente del corpus (DEV, 8/9/2026) lo formula para apps data-heavy exactamente como la nuestra: el costo no es la cantidad de información sino las **transiciones que destruyen contexto** — filtros, selección, scroll, zoom, tab activa, valores sin guardar. La receta: un *workspace persistente* donde "el usuario abre o cierra un panel secundario sin destruir el estado analítico", y las acciones contextuales se montan como paneles laterales atados a la selección actual **en vez de forzar un cambio de ruta** [16]. Aplica literal: en un admin panel, "keep the current record visible while exposing contextual actions".

### Master-detail / split view: la alternativa subusada

Para triage repetitivo (aprobar 8 accionables seguidos), los foros vienen recomendando desde siempre el layout de cliente de mail: lista angosta a la izquierda, detalle fijo a la derecha, sin overlay ninguno [33][35]. Es un drawer que no se cierra nunca: cero costo de apertura por item, navegación con ↑/↓, y el detalle puede ser tan rico como una página. En UX SE, la "tercera opción inspirada en Asana" (lista compactada + panel al lado) aparece una y otra vez como la salida al dilema modal-vs-página [32]. Requiere ancho (funciona de ~1280px para arriba); abajo de eso degenera en drawer.

---

## Tema 3 · Dropdowns y selects modernos (y en dark)

### El diagnóstico

NN/g: los dropdowns esconden las opciones y exigen interacción fina; con listas largas el scroll dentro del dropdown es penoso y el usuario pierde la noción de qué hay [17]. La comunidad de Radix lo dice más crudo — un maintainer, ante quejas de performance con ~90+ items: *"if you have that many items, a select probably is the wrong UI/UX anyway… A combobox in these cases would make more sense, or some filtering mechanism"* [19].

### La tabla de decisión que usa la industria en 2026

| Opciones | Patrón | Implementación de referencia |
|---|---|---|
| 2–5, fijas | Segmented control / radio inline (ni dropdown) | — |
| ≤ ~10, fijas | Select nativo estilizado o Radix Select | `appearance: base-select` [22][23] |
| 10–50 | **Combobox con búsqueda** | Popover + Command (cmdk) [18] |
| 50+ o entidades de la base | Combobox con búsqueda **asíncrona** + virtualización | cmdk + TanStack Virtual [20] |
| Multi-selección larga | Listbox con checkboxes visibles | NN/g [17] |
| "Saltar a cualquier cosa" | Command palette global ⌘K | cmdk [24][25][26] |

Dos datos de estado del arte:

1. **Radix todavía no publicó su Combobox** (el issue #1342 se cerró pero a feb. 2026 la comunidad seguía preguntando dónde está [21]). Por eso el patrón de facto es el de shadcn/ui: **Popover + Command (cmdk)** — un popover con input de filtro y lista navegable por teclado, ARIA combobox correcto vía `aria-activedescendant` [18][26]. Es exactamente lo que conviene para keyword/campaña/grupo: en Fresh Monkee el mismo nombre de grupo existe en 21 campañas, así que el select de entidades **necesita** búsqueda con contexto (mostrar campaña como subtítulo de cada opción), no un `<select>`.
2. **El select nativo por fin se puede estilar**: `appearance: base-select` (Chrome/Edge 135+, 2025) habilita CSS completo sobre el botón, el `::picker(select)` y las opciones, con `<selectedcontent>` para reflejar la opción elegida — manteniendo teclado y semántica nativos. A sep. 2026: estable en Chromium, Safari en Technology Preview, Firefox en Nightly; degrada a select nativo normal donde no hay soporte [22][23]. Para una app interna de un solo usuario en Chrome, es viable **hoy** para los selects cortos (ventana 7/14/28, orden, estado) — hairline, glow y dark sin sacrificar el picker nativo.

### Microdecisiones de calidad (lo que puliò Attio en mayo 2026)

El changelog de Attio del 28/5/2026 es una lista de fixes de dropdown que vale como checklist [11]:

- **Fly-out en vez de drill-down in-place**: los submenús salen al costado, no reemplazan al padre (no perdés dónde estabas).
- **Dropdowns de filtro modales**: *"no se cierran con un clic afuera accidental"* — con estado a medio armar, el clic afuera destructivo es el bug número uno que la gente reporta en foros de modals [31].
- **Reabrir en el último nivel seleccionado**: un dropdown de filtros jerárquico vuelve a abrirse donde lo dejaste.

### Command palette: el techo del patrón

La ola de artículos jun–ago 2026 sobre ⌘K deja reglas nítidas [24][25][26][27]:

- El palette **unifica sustantivos y verbos**: buscar entidades y ejecutar acciones en la misma caja; recents primero en query vacía ("an empty palette is a blank stare" [26]).
- Contrato de teclado no negociable: ⌘K abre desde cualquier lado; Esc cierra **y devuelve el foco a donde estaba** (perderlo "es invisible en testing casual y devastador para navegación por teclado" [25]); flechas mueven highlight sin sacar el foco del input (`aria-activedescendant`); Enter ejecuta; hint visible "⌘K" en el header porque así se descubre [26].
- Es **acelerador, nunca el único camino**: "hide your only path to a feature inside it and casual users will never find the feature at all" [27]. El test de app operativa real: tipear el id de una entidad vista hace un rato y caer directo en ella [24].

---

## Tema 4 · Encadenar decisiones: aprobar → confirmar → resultado

### Wizard vs compromiso progresivo

El consenso 2026: wizard solo cuando los pasos son **condicionales o conceptualmente distintos** y hay revisión final; si los campos son independientes y pocos, una superficie única con disclosure progresivo gana [37]. El anti-patrón documentado es el **modal-wizard anidado**: un flujo de 4 pasos dentro de un modal generó errores medibles porque los usuarios "se sentían apurados y no veían el alcance completo de la operación"; moverlo a página bajó la tasa de error [38]. Aprobar un accionable no es un wizard: es **una decisión + una confirmación**, con el detalle (evidencia, simulación) disponible por disclosure, no por pasos.

### La confirmación que sirve

NN/g: las confirmaciones previenen errores solo si son **específicas** — decir exactamente qué va a pasar — y pierden todo poder si se usan para todo ("no abusar es la consideración de usabilidad más importante") [39]. Para acciones reversibles y frecuentes la alternativa es ejecutar + **undo** [39][30]; pero escribir en Google Ads no es trivialmente reversible → acá va confirmación explícita, y la confirmación tiene que mostrar **valor anterior → valor nuevo** y el radio de la acción (qué entidad, qué cuenta). Eso ya es regla del sistema (riesgo medio exige old value); la UI tiene que exhibirla, no solo guardarla.

### Optimista vs explícito después del clic

La línea 2025–2026 sobre optimistic UI es consistente [40]:

- **Optimista** para operaciones de alta tasa de éxito y rollback trivial (likes, toggles, anotar un día).
- **Nunca optimista** para "payment processing, permanent deletions, operations with complex validation that might fail" [40] — y aprobar un cambio que el servidor valida contra `Accion JSON` y después ejecuta en Google Ads cae de lleno ahí.
- Si algo falla, **no rollback silencioso**: error explícito donde ocurrió la acción, con reintento.

El patrón correcto para nuestra cadena es **pesimista con estados visibles**: botón → `enviando…` (spinner en el botón, drawer bloqueado suave) → éxito: la **fila** de la Bandeja cambia de estado (aprobado/encolado/ejecutado) + banner inline en el drawer → el drawer queda abierto mostrando el resultado, con salida clara.

### Toasts: el debate que definió el período

GitHub/Primer **dejó de usar toasts**: documentan violaciones a 7 criterios WCAG (timing, secuencia, teclado, status messages) más problemas de usabilidad para todos — invisibles en pantallas grandes, se auto-descartan antes de leerse, no queda registro. Su reemplazo: *"banners para feedback persistente, dialogs para interrupciones deliberadas, inline validation, y direct UI updates (éxito auto-evidente)"* — feedback **donde ocurrió la acción** [28]. El thread de HN (dic. 2025, 400+ comentarios) mostró el contrapunto — "no todos somos GitHub, un toast redundante no daña" — pero nadie defendió el toast como **único** canal del resultado [29].

**Regla destilada:** el registro primario del resultado es el **cambio de estado visible en la fila/objeto**; el banner inline lo explica; el toast, si existe, es un eco prescindible. Nunca información que solo vive 4 segundos en una esquina.

---

## Tema 5 · Deep-links y back en SPAs con drawers

### Qué merece URL

La regla que emerge de toda la literatura de URL-state 2025–2026: **si muestra una entidad con identidad, tiene URL; si es estado transitorio de un control, no** [41][42].

- Con URL: accionable abierto en drawer (`/bandeja?acc=123` o `/bandeja/acc/123`), día de Semana (`/semana?dia=2026-09-10`), búsqueda precargada en Datos (`/datos?q=...&cuenta=BHI`), tab activa de Sistema.
- Sin URL: dropdown abierto, tooltip, peek de hover transitorio, paso interno de una confirmación.

El beneficio no es purismo: es **teletransporte** (mandarle un link a tu yo de mañana o pegarlo en Notion y caer exactamente en ese accionable) y **time travel** (back/forward reconstruyen estados) [43]. Para una app operada por una sola persona con sesiones de Claude que generan links, el deep-link al accionable es directamente infraestructura.

### Historial: push vs replace

El detalle técnico que separa una SPA que respeta el back de una que lo rompe [41][42][43]:

- **`history.push` al abrir el drawer** → el primer back **cierra el drawer** y te deja en la lista (la expectativa universal de los usuarios; violarla es la queja #1 en foros de modals [31][32]).
- **`history.replace` para cambios internos** del drawer o de filtros de alta frecuencia → no llenás el historial con 15 entradas de un solo drawer. `nuqs` batchea múltiples params en una sola navegación (`useQueryStates`) exactamente para esto [42].
- François Best (autor de nuqs): el time-travel por historial es un poder, pero "just be aware that you may break the back button" — cada estado que empujás al historial es un back que el usuario va a tener que gastar [43].
- El deep-link externo que llega con `?acc=123` cae en **la página con el drawer ya abierto** (o en la vista página del accionable), renderizable server-side sin flash [41].

### Stacked drawers + router: el caso perdido

La discusión de react-router sobre drawers apilados con rutas es la evidencia técnica de por qué no apilar: los callbacks entre drawers no son serializables en `history.state`, y "no hay forma limpia de distinguir un back del navegador de un back de la UI" [44]. La técnica existe para UN nivel (el `ModalLink` que guarda la ubicación de fondo en el state [45]); para dos niveles, el estado del historial se vuelve ingobernable. La arquitectura correcta: **el drawer es una dimensión de la URL, no una pila** — un solo param (`acc=123`), y el drill-down interno cambia *ese* param, no agrega capas.

---

## Tema 6 · Lo que dicen los foros (2020 → sep. 2026)

Las quejas reales, en orden de frecuencia:

1. **"El modal me tapa lo que necesito para decidir."** HN dic. 2025: *"Modals are, IMO, the literal worst UX element you can hate your users with"* — con la defensa matizada de que un modal correcto (a11y, foco, escape) para volver fácil al contexto es legítimo [29][30]. HN may. 2023: el modal de edición "te impide ver el resto de la app" y hace imposible editar/mirar dos cosas a la vez; el título del subthread es literal: *"Don't open the details in a modal window, have it be a separate page"* [46].
2. **"Perdí lo que había escrito."** Clic afuera o back destruyen el form del modal — la queja recurrente del thread "We use too many damn modals" (2020) [31]. Mitigación estándar 2026: overlay no cierra con clic afuera si hay input sucio (lo que Attio implementó en sus dropdowns [11]).
3. **"Modal sobre modal."** "Too Inception" [34]; "modals inside modals and popups as a third layer" [31].
4. **"El modal parece la página final."** UX SE citando a Baymard: los usuarios perciben el modal como todo lo que hay, y no descubren que existe una página con más info; además rompe el back button. La salida propuesta en ese mismo thread: lista + panel lateral estilo Asana [32].
5. **La demanda del patrón sigue viva en 2026:** en la comunidad de Sigma (BI), un usuario pide en jun. 2026 un "native Side Panel / Drawer" para inspeccionar el detalle de una fila "sin tapar toda la página como hace un Modal… en cualquier dashboard con una tabla de registros"; el vendor lo tenía en beta para sep. 2026 [35]. Es exactamente nuestra Bandeja.
6. **Selects largos:** la comunidad de Radix/shadcn convergió en "select largo = UI equivocada, usá combobox con filtro, y virtualizá arriba de ~100 items" [19][20].

---

## Tema 7 · Traducción a NorthSignal

### El mapa de superficies para esta app

| Necesidad de hoy | Superficie correcta | Por qué |
|---|---|---|
| Anotar un día, editar un valor chico | **Inline** en el drawer/fila | Cambio menor y frecuente; una superficie nueva es fricción pura [3] |
| Espiar un accionable antes de abrirlo | **Fila más rica** primero; peek después si hace falta | Baymard: el quick view suele ser parche de una lista pobre [14] |
| Decidir sobre UN accionable (detalle + evidencia + aprobar/simular) | **Drawer** con URL, o **split view** en desktop ancho | Contexto de la Bandeja visible; triage repetido sin costo de apertura [2][6][16] |
| "Ver en Datos" / "ir al Brief" desde el drawer | **Navegación real** (página) con query precargada en la URL + retorno explícito | Es otro workspace, no un sub-detalle; página = comparar + compartir [1][6] |
| Confirmar ejecución de un cambio en Google Ads | **Modal chico** sobre el drawer (única excepción de apilado: confirm efímero) o paso inline en el drawer, mostrando `old → new` + radio | Interrupción deliberada, corta, específica [39]; muestra lo que el guardarraíl ya exige |
| Resultado de la acción | **Estado en la fila + banner inline en el drawer**; toast solo como eco | Primer/GitHub: feedback donde ocurrió la acción, persistente [28] |
| Alertas de Sistema → resolver | Drawer de alerta con acción inline; si resolver implica editar algo grande → página | Mismo framework |
| Brief, investigación, comparaciones largas | **Página** con URL | Trabajo sostenido = página (la lección de Attio [10]) |

### Las reglas (12)

1. **Un drawer, nunca dos.** El drawer no abre drawers. Drill-down interno = reemplazar contenido con breadcrumb interno arriba del drawer (`Accionable · Evidencia`), o promover a página. Confirmación efímera es la única capa permitida encima [7][34][44].
2. **Todo drawer tiene cuatro salidas:** `Esc`, X, clic afuera **solo si no hay input sucio**, y "abrir como página" (icono expandir, estilo Notion) que lleva a la misma entidad con URL plena [9][11][31].
3. **El drawer vive en la URL** (`?acc=123`): push al abrir (back lo cierra), replace para sus cambios internos, params tipados con nuqs o equivalente [41][42][43].
4. **"Ver en Datos" es navegación, no superficie:** URL con búsqueda precargada (`/datos?q=…&cuenta=…`) + botón de retorno al accionable (el link de vuelta también es URL, no estado en memoria) [16][41].
5. **Split view para el triage:** en ≥1280px, Bandeja como master-detail (lista izquierda + detalle derecha) con ↑/↓ para pasar de accionable, elimina el 80% de aperturas de drawer [8][16][33].
6. **Modal solo para frenar:** confirmación de ejecución y errores bloqueantes. Nunca para detalle, nunca para forms largos, nunca para avisos [1][2][5].
7. **La confirmación muestra `old → new`, la entidad exacta y la cuenta.** Específica o no sirve [39]. El valor anterior ya es requisito del backend para riesgo medio; exhibirlo en el confirm es gratis.
8. **Feedback pesimista con estados:** `enviando…` → estado nuevo en la fila + banner inline. Optimista solo para anotar/toggles locales. Toast jamás como único canal [28][40].
9. **Matar los `<select>` nativos feos con dos patrones, no uno:** cortos y fijos (ventana, orden, estado) → `appearance: base-select` estilado con los tokens dark; entidades y listas largas (keyword, campaña, grupo, término) → combobox Popover+cmdk con búsqueda, subtítulo de contexto por opción (campaña/cuenta) y virtualización arriba de ~100 [18][19][20][22][23].
10. **⌘K global** que mezcle sustantivos y verbos: saltar a cuenta/sección/accionable + acciones ("simular", "ir a Datos con esta keyword"), recents primero, hint visible, foco devuelto al cerrar. Acelerador, nunca único camino [24][25][26][27].
11. **Peek barato antes que apertura cara, pero primero la fila:** enriquecer la carta del accionable (veredicto, delta, ventana) para que decidir *si abrir* no requiera abrir [14]; peek con `Space`/hover recién si las cartas ya saturaron.
12. **Cambiar estado de paneles, no de ruta, dentro de un workspace:** filtros, selección, scroll y tab de la Bandeja sobreviven a abrir/cerrar cualquier drawer; si una interacción destruye ese estado, está mal cableada [16].

### Anti-patrones a desterrar de la app actual

- Drawer que al navegar a Datos pierde el accionable sin camino de vuelta (violación de regla 4).
- `<select>` nativo sin búsqueda para entidades resueltas contra la base (violación de regla 9 — y riesgo real con 21 campañas homónimas).
- Resultado de aprobar visible solo como toast o solo dentro del drawer, sin cambio de estado en la fila de la Bandeja (regla 8).
- Cualquier flujo que hoy encadene drawer → drawer (regla 1).

---

## Fuentes

Formato: título — URL — fecha — aporte. **[F]** = foro/comunidad.

1. Modal vs. Separate Page: UX Decision Tree — Smashing Magazine (Vitaly Friedman) — https://www.smashingmagazine.com/2026/03/modal-separate-page-ux-decision-tree/ — 19/3/2026 — Árbol de decisión de 4 pasos; "page being the default"; dónde nunca va un modal. Verificado por fetch.
2. Modal vs Slide-Out Panel: Which Is Better for Displaying Secondary Content? — The Hangline — https://www.thehangline.com/modal-vs-slide-out-panel-which-is-better-for-displaying-secondary-content/ — 17/8/2026 — Tabla de criterios (atención, capacidad, retención de contexto, riesgo de pérdida de datos); "default to slide-out panels".
3. Modal vs. Drawer vs. Inline Editing: A Comprehensive Decision Framework — Layout Scene — https://www.layoutscene.com/modal-vs-drawer-vs-inline-editing/ — 30/4/2026 — Agrega el escalón inline: cambio menor y frecuente no merece superficie nueva.
4. Designing Contextual Side-Sheets (Drawers) vs. Modals in Highly Dense Workspace Applications — JobPrep Arena — https://www.jobpreparena.com/blog/designing-contextual-side-sheets-drawers-vs-modals-in-highly-dense-workspace-applications — s/f (2025–2026) — Framing conductual: "modal demands attention, side-sheet augments attention; not aesthetic, behavioral".
5. Overuse of Overlays: How to Avoid Misusing Lightboxes — NN/g (Kathryn Whitenton) — https://www.nngroup.com/articles/overuse-of-overlays/ — 25/5/2015 — Cuándo un overlay es legítimo y cuándo daña; base empírica del "modal solo para frenar". Fecha verificada por fetch.
6. Drawer — GitLab Pajamas design system — https://design.gitlab.com/components/drawer — s/f, consultado 9/2026 — La distinción de 4 superficies (drawer/modal/panel/página), 400px, Esc, "nunca sorprender", foco y trap. Verificado por fetch.
7. Drawer — NewsKit design system — https://www.newskit.co.uk/components/drawer/ — s/f — "Avoid nesting tiered drawers"; alternativa: accordion o repensar la estructura.
8. Peek preview — Linear Docs — https://linear.app/docs/peek — s/f, consultado 9/2026 — Space toggle/hold, ↑/↓ entre items sin cerrar, Esc; peek dentro del command menu. Verificado por fetch.
9. Faster mobile apps, database side peek & more — Notion Releases — https://www.notion.com/releases/2022-07-20 — 20/7/2022 — Side peek / center peek / full page configurables por vista; expandir peek a página completa.
10. Record page redesign — Attio Changelog — https://attio.com/changelog/2026/record-page-redesign — 28/5/2026 — El detalle donde se trabaja es página, no overlay: detalle a la izquierda, comentarios en sidebar, secciones redimensionables.
11. Changelog (May 28, 2026) — Attio — https://attio.com/changelog/2026/changelog-may-28-2026 — 28/5/2026 — Checklist de dropdowns: fly-out en vez de drill-down in-place, dropdowns modales (no cierran con clic afuera accidental), reabrir en el último nivel.
12. Airtable interface layout: Record detail — Airtable Support — https://support.airtable.com/articles/5805061650-airtable-interface-layout-record-detail — s/f — Record detail como sidesheet/full-screen; action bar persistente para iterar registros; drill-down por linked records dentro del panel.
13. Payment details (embedded component) — Stripe Docs — https://docs.stripe.com/connect/supported-embedded-components/payment-details — s/f — Stripe renderiza el detalle de pago como overlay sobre la lista en embebidos; en su Dashboard el pago es página con URL propia.
14. Avoid "Quick Views" for Spec-Driven Product Types — Baymard Institute — https://baymard.com/blog/ecommerce-quick-views — 1/8/2023 — Testing a gran escala: el quick view agrega fricción en contenido spec-driven; suele ser parche de una lista pobre.
15. 2024 Product Finding Research Update — Baymard Institute — https://baymard.com/blog/product-finding-2024-launch — 17/9/2024 — Revisión de la recomendación: quick views útiles solo para lo visual; prioridad a enriquecer la lista.
16. Reducing Context Switching in Data-Heavy Web Applications — DEV Community (sindreaasenweb) — https://dev.to/sindreaasenweb/reducing-context-switching-in-data-heavy-web-applications-45b0 — 8/9/2026 — Workspace persistente: paneles secundarios que cambian sin cambiar de ruta; lista de estado a preservar (filtros, selección, scroll, zoom, tab).
17. Listboxes vs. Dropdown Lists — NN/g (Anna Kaley) — https://www.nngroup.com/articles/listbox-dropdown/ — 2020 — Dropdowns esconden opciones; listbox para multi-selección; límites de tamaño de lista.
18. Combobox — shadcn/ui docs — https://ui.shadcn.com/docs/components/radix/combobox — s/f — El patrón de facto: Popover + Command (cmdk), ARIA combobox, teclado completo.
19. **[F]** Select component blocking/slowing renders — radix-ui/primitives issue #2602 — https://github.com/radix-ui/primitives/issues/2602 — 19/12/2023 — Maintainer: con ~90+ items "a select probably is the wrong UI/UX anyway… a combobox would make more sense".
20. **[F]** 'Select' with virtualization? — shadcn-ui/ui issue #543 — https://github.com/shadcn-ui/ui/issues/543 — 5/6/2023 — Virtualización de combobox largos con TanStack Virtual / virtua; recetas de la comunidad.
21. **[F]** Has the Combobox primitive been added to the library? — radix-ui/primitives discussion #3369 — https://github.com/radix-ui/primitives/discussions/3369 — feb. 2025, último comentario 12/2/2026 — A feb. 2026 Radix seguía sin Combobox publicado: el Popover+cmdk sigue siendo el camino.
22. The `<select>` element can now be customized with CSS — Chrome for Developers — https://developer.chrome.com/blog/a-customizable-select — 2025 — `appearance: base-select`, `::picker(select)`, `<selectedcontent>`: select nativo totalmente estilable desde Chrome/Edge 135.
23. CSS appearance: base-select Styled Dropdowns Guide — BuildMVPFast — https://www.buildmvpfast.com/blog/css-appearance-base-select-style-native-dropdowns-2026 — 2026 — Estado de soporte a sep. 2026 (Chromium estable, Safari TP, Firefox Nightly) y degradación elegante como progressive enhancement.
24. SaaS Search & Command Palette UX: Real Examples & Patterns — SaaSUI — https://www.saasui.design/blog/saas-search-command-palette-ux-patterns — 15/6/2026 — El palette unifica búsqueda y acciones; criterios de calidad: velocidad, ranking, estados vacíos.
25. How to Design a Command Palette Users Will Reach For — 137Foundry (Dennis Traina) — https://137foundry.com/articles/command-palette-interface-users-actually-reach-for — 11/8/2026 — Foco: al cerrar, devolver el foco a donde estaba; no robar ⌘K dentro de inputs; shippearlo como adición, no reemplazo.
26. Command Palettes and Search: Cmd-K, Recents and Actions — 21st.dev — https://21st.dev/blog/react-command-palette-components — 20/8/2026 — Contrato completo: `aria-activedescendant`, recents en query vacía, hint "⌘K" visible, dialog con foco atrapado.
27. Command palette — UX by Example (Chris Daniels) — https://uxbyexample.co.uk/entries/command-palette/ — 17/8/2026 — "Acelerador sobre una UI descubrible — nunca el único camino"; matching por intención y sinónimos.
28. Accessible notifications and messages (Toasts) — GitHub Primer — https://primer.style/accessibility/toasts/ — s/f, consultado 9/2026 — Por qué GitHub abandonó los toasts (7 criterios WCAG + usabilidad) y los reemplazos: banners persistentes, inline validation, direct UI updates. Verificado por fetch.
29. **[F]** GitHub no longer uses Toasts — Hacker News — https://news.ycombinator.com/item?id=46196831 — dic. 2025 — El debate: nadie defiende el toast como único canal; subthread https://news.ycombinator.com/item?id=46198165: "modals are the literal worst UX element…" con su contrapunto.
30. What is the advantage of a modal dialog vs a new page here — UX StackExchange — https://ux.stackexchange.com/questions/89322/what-is-the-advantage-of-a-modal-dialog-vs-a-new-page-here — ene. 2016 — Respuesta aceptada: para acciones frecuentes reversibles, ejecutar + undo le gana a confirmar; confirmación solo si es destructivo e irrecuperable. **[F]**
31. **[F]** We use too many damn modals — Hacker News — https://news.ycombinator.com/item?id=23645447 — jun. 2020 — Quejas canónicas: forms que se pierden con clic afuera/back; modals dentro de modals; estado local que se desincroniza.
32. **[F]** Modal or new page when switching from list to detailed view? (issue tracking) — UX StackExchange — https://ux.stackexchange.com/questions/114383/modal-or-new-page-when-switching-from-list-to-detailed-view-in-an-issue-tracki — 18/12/2017 — Cita a Baymard: el modal se percibe como página final; riesgo de back; tercera vía tipo Asana (lista + panel).
33. **[F]** Alternative design to master-detail grid rows / Is Master/Detail the best approach? — UX StackExchange — https://ux.stackexchange.com/questions/45461/is-master-detail-design-the-best-approach-for-our-application — s/f (~2013) — El pedido de usuarios reales: "lista visible mientras veo un registro"; layout de cliente de mail; "stacking popups is usually a bad idea".
34. **[F]** Expandable rows, quick view or modal to show details for a row? — UX StackExchange — https://ux.stackexchange.com/questions/123618/expandable-rows-quick-view-or-modal-to-show-a-big-section-with-details-for-a-ro — 7/2/2019 — "Modal on modal… too Inception"; side panel como "modal but more scalable"; expandir fila para comparar.
35. **[F]** Feature Request: Native Side Panel / Drawer for Record Detail Views — Sigma Community — https://community.sigmacomputing.com/t/feature-request-native-side-panel-drawer-for-record-detail-views/6997 — 22/6/2026 (respuesta del equipo 1/9/2026) — Demanda viva del patrón en 2026: inspeccionar la fila "sin tapar toda la página como un Modal"; el vendor lo shippea en beta.
36. Nested Bottom Drawers — shadcn.io examples (Vaul) — https://www.shadcn.io/examples/drawer-nested-bottom-drawers — s/f — Los drawers anidados existen como técnica (`--nested-drawers`), documentados para mobile/forms por capas — no para apps de operación desktop.
37. Best Practices for High-Conversion Wizard UI Design — Lollypop Design — https://lollypop.design/blog/2026/january/wizard-ui-design/ — ene. 2026 — Wizard solo para procesos multi-paso condicionales con revisión final; si los campos son independientes, pantalla única.
38. How to Choose Between Modals and Separate Pages in UX Design — Software Curated — https://softwarecurated.com/software-development/how-to-choose-between-modals-and-separate-pages-in-ux-design/ — 20/3/2026 — Caso medido: wizard de 4 pasos anidado en modal generaba errores; moverlo a página los bajó; "modal-light future".
39. Confirmation Dialogs Can Prevent User Errors — NN/g — https://www.nngroup.com/articles/confirmation-dialog/ — s/f — Confirmar solo lo serio, y ser específico sobre qué se está aceptando; el abuso mata el patrón.
40. Optimistic UI Updates: Making Apps Feel Instant Without Breaking Things — murtazaweb — https://murtazaweb.com/blog/2026-03-22-optimistic-ui-updates-patterns/ — 22/3/2026 — Optimista solo con alta tasa de éxito y rollback trivial; nunca para pagos/destructivo/validación server compleja; error explícito, no rollback silencioso. Verificado por fetch.
41. Type-Safe URL State Management in Next.js with nuqs — Noqta — https://noqta.tn/en/tutorials/nuqs-type-safe-url-state-nextjs-2026 — 3/6/2026 — La URL como contenedor de estado compartible: filtros, paginación, links que reconstruyen la vista exacta.
42. URL as State — modernreactspa.com — https://modernreactspa.com/learn/url-as-state — 23/5/2026 — Qué estado va a la URL; `push` para cambios significativos, `replace` para alta frecuencia; batcheo de params para no inflar el historial.
43. Type-Safe URL State Management in React With nuqs (charla de François Best) — GitNation — https://gitnation.com/contents/type-safe-url-state-management-in-react-with-nuqs — 28/11/2025 — "Teleportation" (deep-link) y "time travel" (historial), con la advertencia literal: "you may break the back button".
44. **[F]** How to properly integrate stacked drawers with react-router — remix-run/react-router discussion #10563 — https://github.com/remix-run/react-router/discussions/10563 — jun. 2023 — Por qué drawers apilados + router no cierra: callbacks no serializables en history.state, back de UI indistinguible del back del navegador.
45. Navigable Modals With the History API: Adventures in Web Modals — Pairs Engineering (Medium) — https://medium.com/eureka-engineering/navigable-modals-with-the-history-api-adventures-in-web-modals-27d94ae2014 — s/f — El patrón `ModalLink`: overlay con URL propia y página padre correcta debajo, para UN nivel de overlay.
46. **[F]** "How about the fact that modal windows suck…" — Hacker News — https://news.ycombinator.com/item?id=36056972 — may. 2023 (verificado 24–26/5/2023) — Quejas de operación real: el modal de edición impide ver el resto de la app y editar dos cosas a la vez; "don't open the details in a modal window, have it be a separate page".
