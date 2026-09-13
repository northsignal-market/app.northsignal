# 08 · Capas de lectura sobre contenido técnico: resumen arriba, detalle plegado

**Investigación web · septiembre 2026.** Eje: patrones probados 2024-2026 para mostrar análisis
largos de agentes LLM en capas — conclusión en 2 segundos arriba, texto técnico completo plegado
pero nunca perdido. Para la app de NorthSignal: plan semanal, diagnóstico, pulso diario. Sin tocar
los prompts de los agentes.

---

## TL;DR del informe (aplicando el propio patrón)

**Veredicto: el patrón está maduro y hay convención asentada.** Todos los productos serios de
2025-2026 convergen en la misma estructura de tres capas: **estado categórico + una frase**
(visible siempre) → **puntos clave con anclas al origen** (visibles o a un clic) → **texto
completo plegado por defecto, pero encontrable**. Los números que importan:

- **Máximo 2 niveles de plegado** (NN/g: con 3+ los usuarios se pierden).
- **Veredicto: 3-4 estados categóricos + 1 frase.** Linear lo define como "casi como un tweet";
  Asana pide 2-3 oraciones. Techo práctico: **~140-200 caracteres** la frase del veredicto.
- **Bullets del resumen: 2-4, de ≤125 caracteres** cada uno (el formato del PR summary de
  Copilot), cada uno linkeado a la sección del detalle que lo respalda.
- **Cuerpo de lectura a 50-75 caracteres por línea** (ideal 60-70; con >80 CPL el texto se
  saltea un 41% más — Baymard).
- **Lo generado se marca como generado.** El label baja un poco la "accuracy" percibida
  (arXiv 2025), pero ocultarlo y que se note el origen destruye la confianza entera. El formato
  ganador (arXiv ene-2026): **una línea de disclosure + detalle a demanda** — dos tercios de los
  lectores quieren poder ver el detalle de procedencia.
- **El plegado ya no rompe la búsqueda del navegador:** `<details>` se auto-expande con
  Ctrl+F desde Interop 2025, y `hidden=until-found` cubre el resto. La impresión sí requiere
  JS (`beforeprint` que abra todo).
- **El backlash 2026 no es contra el plegado: es contra el resumen que reemplaza al texto.**
  GitHub tuvo que recular en marzo 2026 por meter texto generado con autoría humana; los
  threads de HN queman a los productos que resumen todo sin pedirlo. El resumen debe ser
  **adición navegable, nunca sustituto ni suplantación de autoría**.

El detalle de cada punto, abajo.

---

## 1. Progressive disclosure aplicado a texto: qué está probado

### 1.1 El principio y su límite duro

NN/g definió el patrón en 2006 y la guía sigue vigente: diferir lo secundario a una segunda
vista mejora **aprendizaje, eficiencia y tasa de error** — 3 de los 5 componentes clásicos de
usabilidad. Las dos condiciones para que funcione:

1. **El corte primario/secundario tiene que ser correcto.** Lo inicial es lo que se necesita
   con frecuencia; nada esencial puede quedar del lado plegado.
2. **La progresión tiene que ser obvia**: mecánica y etiquetado del "ver más" sin ambigüedad.

El límite que casi nadie respeta: **más de 2 niveles de disclosure = usabilidad baja, los
usuarios se pierden**. Si el diseño pide 3 niveles, la respuesta es simplificar o agrupar, no
anidar. Para NorthSignal esto fija la arquitectura: veredicto → detalle, y adentro del detalle
como mucho secciones colapsables. Nunca un plegado adentro de un plegado adentro de un plegado.

### 1.2 Acordeones: cuándo ayudan y cuándo esconden de más

Del estudio de NN/g sobre acordeones en contenido complejo (2014, confirmado por la guía de
escenarios a evitar):

**Ayudan cuando:**
- El usuario necesita **solo algunas piezas** del contenido, no la mayoría.
- Los encabezados funcionan como **mini-arquitectura de información**: mirar la lista de
  títulos cerrados ya cuenta la historia de la página.
- El espacio es chico (mobile): colapsar mitiga el scroll eterno y da mapa.

**Esconden de más cuando:**
- El usuario necesita **la mayoría del contenido**: forzar clic por clic es más caro que
  scrollear. La gente scrollea sin problema si el contenido es relevante y escaneable —
  el mito de "que no haya scroll" está refutado por eyetracking (hay ~20% de atención
  below the fold, y sube cuando el contenido vale).
- Hay que **comparar valores entre secciones plegadas** (abrir-cerrar-abrir para comparar
  es el peor caso).
- El flujo es de **lectura continua**: interrumpe.
- El contenido plegado tiene **menor visibilidad y descubrimiento**: lo que está cerrado se
  lee menos, siempre. "Readers treat clicks like currency": el clic se paga solo si el
  título promete valor.

La traducción operativa de GOV.UK Design System (el sistema con la guía más explícita del
mundo sobre esto) es una regla de una línea: **"Do not use the details component to hide
information that most of your users will need"**. El componente `details` es para lo que
*algunos* usuarios necesitan *a veces*: ayuda contextual, definiciones, el "por qué" de una
pregunta. Y una regla de composición: **una sección plegable = `details`; varias = accordion**;
nunca varios `details` sueltos apilados.

### 1.3 La consecuencia para análisis de agentes

El análisis técnico completo de un agente es, en términos de GOV.UK, contenido que *algunos*
lectores (o el mismo Andrés en modo auditoría, o el propio sistema) necesitan *a veces*.
El veredicto y las acciones son lo que se necesita *siempre*. O sea: **el patrón aplica
limpio** — con la condición NN/g de que nada accionable quede del lado plegado. Si el análisis
dice "hay que subir el presupuesto de X", eso no puede vivir solo adentro del plegado: es
capa 1 (accionable), y el plegado guarda la evidencia y el razonamiento.

---

## 2. Cómo muestran los productos 2025-2026 el output largo de agentes

### 2.1 Thinking UIs: la convención que se asentó

La comparación sistemática de digestibleux (mar-2025) sobre ChatGPT, Claude, DeepSeek, Grok y
Gemini encontró que casi todos convergieron en lo mismo:

| Producto | Durante | Al terminar |
|---|---|---|
| ChatGPT (o-series) | razonamiento breve visible | **se colapsa solo**; expandir manual |
| Claude | mínimo por defecto | expandible a demanda |
| Grok | snippets scrolleando + contador | **se colapsa**, con guía clara para expandir |
| DeepSeek R1 | todo el chain-of-thought | queda visible (el outlier) |
| Gemini | generación continua | scroll controlado por el usuario |

Tres conclusiones de diseño del estudio, citables tal cual:

1. **"More transparency ≠ Better UX"** — el detalle excesivo abruma en vez de construir
   confianza.
2. Los indicadores de progreso bien diseñados reducen la espera percibida.
3. **Los usuarios buscan la respuesta**; sobre-enfatizar el razonamiento distrae del objetivo.
   El principio: *"AI transparency isn't about revealing everything — it's about showing the
   right reasoning at the right time"*.

Dos datos que confirman la dirección: Anthropic documenta que el thinking que se muestra es
un **resumen del razonamiento, no el raw** (docs de Platform, modo "summarized"), y en
Claude Code hay un issue abierto (anthropics/claude-code#36006) pidiendo exactamente
"thinking colapsado por defecto con toggle" — la demanda de los usuarios técnicos es el
colapso, no la exposición. Del otro lado, cuando OpenAI escondió la fase de thinking *del
todo* en ChatGPT, el thread de r/OpenAI reclamó su vuelta: **ocultar sin dejar rastro también
falla**. El equilibrio asentado: **visible que existe, colapsado por defecto, expandible
siempre**.

### 2.2 El patrón de capas en interfaces de agentes (2026)

El paper de patrones de Zylos Research (may-2026) lo formaliza para agentes con tool calls:
panel de actividad colapsado que muestra **progreso a nivel de paso ("3 of 7 steps
complete")**; expandir un paso revela los tool calls; expandir un tool call revela el
request/response crudo. Y nombra la tensión central con precisión:

> "Presenting every tool call and token stream by default produces interface overload;
> hiding all detail by default produces distrust."

Es la misma arquitectura de 3 capas: progreso medido → pasos → crudo. Gartner (citado ahí)
proyecta 40% de apps enterprise con agentes integrados a fin de 2026 — este patrón es la
convención de facto de la ola.

### 2.3 GitHub Copilot PR summaries: el formato y el escarmiento

El formato del summary de Copilot es de lo más copiable que hay: **un párrafo de prosa +
lista de bullets, cada bullet linkeado a las líneas de código que lo respaldan, con ítems
de hasta 125 caracteres**. La procedencia por link (bullet → diff) es la parte valiosa:
cada afirmación del resumen es auditable a un clic.

Las críticas recientes marcan los bordes del patrón:

- GitHub mismo advierte: los summaries son para **"supplement — not replace"** el contexto
  del autor. El summary que reemplaza la descripción humana es el anti-patrón.
- Feedback inconsistente y hallazgos que no llegan al comentario final (GitHub Community
  discussion #121150; análisis de devactivity): la falla de confiabilidad se paga en
  confianza.
- El dato duro de fricción: LinearB (2026, 8.1M PRs) midió que los PRs agénticos esperan
  **5.25× más** para que alguien los agarre; CodeRabbit (dic-2025) encontró ~1.7× más
  issues en PRs co-escritos por AI. El texto generado en masa genera **desconfianza por
  defecto** en el lector técnico.
- Y el incidente que define 2026: en marzo, Copilot empezó a inyectar "tips" (publicidad de
  herramientas de terceros) **dentro de PRs con autoría del humano** — más de 11.400 PRs
  afectados. Backlash inmediato (The Register, 30-mar-2026; Windows Forum), GitHub deshabilitó
  la feature y su PM admitió en HN que fue "the wrong judgement call". La lección de fondo
  para cualquier capa de resumen: **jamás mezclar texto generado con autoría humana sin
  frontera visible**. El resumen vive en su propio bloque, con su propia marca.

### 2.4 Notion, Slack, Linear: resumen con anclas

- **Notion AI Meeting Notes** (release 2.51, may-2025): el resumen se genera en un **bloque
  propio** (frontera clara) y — la parte importante — **cada takeaway linkea al momento exacto
  del transcript**. Procedencia por ancla, igual que Copilot con el diff.
- **Slack** (jul-2025, TechCrunch): recaps de canales y threads a un clic, notas de huddles.
  La crítica de 2026 (reviews de Fastio y eesel) es de pricing y de límites, no del patrón:
  el resumen-a-demanda con el thread intacto abajo no genera rechazo; el rechazo aparece
  cuando se cobra por resúmenes que nadie pidió.
- **Linear Agent** (changelog 24-mar-2026): sintetiza contexto del workspace y lo entrega
  **en conversación o como acción concreta** (issue creado, spec inicial), no como muro de
  texto. Prioriza síntesis ejecutable sobre exhaustividad. En jun-2026 (changelog "Coding
  sessions", 11-jun) los agentes de código corren dentro del issue y reportan en el mismo
  formato de actividad colapsable.

### 2.5 El backlash: AI summary fatigue (threads recientes)

- **HN feb-2026, "AI fatigue is real and nobody talks about it" (471 puntos, 320
  comentarios):** el hilo más citado del año sobre el tema. Dos quejas centrales aplican
  directo: (a) la fatiga de **evaluar output generado todo el tiempo** ("constant
  vigilance", decision fatigue del revisor); (b) la ironía de que el texto generado infla —
  *"things that can cleanly be expressed in 1-2 sentences are whole paragraphs"*. El lector
  técnico de 2026 castiga el relleno.
- **HN Trends sep-2026** (blog.mean.ceo): el sentimiento migró de wow-factor a
  **control, confianza y flujo de trabajo**. Threads tipo "I'm drowning in AI features I
  never asked for" (300+ puntos) contra features de AI no pedidas.
- **ResetEra, "I hate AI summaries"** (thread largo, 2025-2026): la queja del lado lector —
  el resumen automático como "nutritional facts" del artículo, pérdida de matiz, y la
  sensación de que te decidieron qué importa.
- La síntesis del ensayo "Why I don't read AI-generated summaries" (Substack de Zara Zhang):
  el resumen no es neutral — **qué importa depende de quién lee**, y un resumen genérico
  optimiza para nadie.

**Qué significa el backlash para el diseño:** el rechazo es a (1) resúmenes no pedidos y
omnipresentes, (2) resúmenes que reemplazan el original, (3) resúmenes verbosos, (4) texto
generado disfrazado de humano. Ninguna de las cuatro cosas es "resumen arriba, detalle
plegado" bien hecho. En NorthSignal el resumen es la interfaz de un documento que el operador
*sí o sí* tiene que triajar cada día — el caso de uso exacto donde la evidencia dice que el
resumen paga.

---

## 3. Layered explanation en documentación de referencia + pirámide invertida

### 3.1 Stripe: dosis de detalle por audiencia

Los teardowns de las docs de Stripe (Mintlify, Apidog, WriteChoice) coinciden en el mecanismo:
**progressive disclosure editorial**. El principiante completa la primera integración sin
tocar configuración avanzada; el senior encuentra el detalle exhaustivo sin que se lo
escondan — está una capa más abajo, no en otra página perdida. La estructura tipo: qué hace
esto y el happy path arriba; parámetros opcionales, edge cases y configuración avanzada en
secciones expandibles o en columnas de referencia al costado. La regla de oro es idéntica a
la de GOV.UK: la capa 1 alcanza para actuar; la capa 2 alcanza para auditar.

### 3.2 Pirámide invertida: la mecánica editorial de la capa 1

NN/g (Amy Schade, 2018) trae del periodismo la estructura para la web: **la conclusión
primero**, después el soporte ordenado de lo más amplio a lo más nicho. Funciona porque el
lector web escanea y **abandona en cualquier punto** — la estructura garantiza que en
cualquier punto de abandono ya se llevó lo esencial. Aplicado a un análisis de agente: el
párrafo 1 del resumen tiene que sobrevivir solo. Las recomendaciones concretas: lead con el
hecho más crítico, párrafos cortos, bullets, y "summary o key-points list" adicional cuando
el texto es largo.

El equivalente militar, **BLUF (bottom line up front)**, suma el checklist de contenido de la
primera línea: **quién, qué, cuándo, dónde, por qué** — más simple y más corto que un
executive summary, casi una thesis statement. Para el pulso diario de una cuenta: "BHI:
gasto normal, conversiones madurando, nada que decidir hoy" es un BLUF completo en 70
caracteres.

### 3.3 Formato del bloque resumen (evidencia NN/g)

Del estudio de usabilidad de contenido >1000 palabras (NN/g, nov-2023):

- **El resumen va al inicio** y cumple dos funciones: decidir si sigo leyendo + entender lo
  esencial sin leer el resto. Da "mapa mental" del documento.
- **Conciso y directo; si hay varias conclusiones, bullets** — no párrafo corrido.
- **Tratamiento visual distintivo**: borde, fondo, callout. Los participantes notaron mucho
  más el texto con peso visual diferenciado.
- Encabezado explícito ("Resumen", "Conclusiones clave") — no hacer adivinar qué es.
- Bold en el cuerpo: **selectivo, techo ~30% del texto** o deja de significar.

---

## 4. TL;DR generado vs escrito: confianza y procedencia

### 4.1 La evidencia sobre el label

- **El label "AI-generated" baja la accuracy percibida del contenido idéntico** (arXiv
  2506.16202, 2025) — es un costo real, pero acotado ("limited broader effects").
- **El costo de NO marcar es mucho mayor**: la literatura de branding y el estudio PMC 2025
  sobre confianza coinciden en que el daño grande llega cuando el lector detecta el origen
  generado por su cuenta ("el problema no es que usaste AI: es que lo hiciste pasar por otra
  cosa"). El incidente Copilot de marzo 2026 es el caso límite de esto.
- **El nivel de detalle del disclosure importa** (arXiv 2601.09620, ene-2026, el estudio más
  fino a la fecha): con disclosure de una línea la confianza **no** bajó; bajó con el
  disclosure detallado. Pero ~dos tercios de los participantes *prefirieron* el detallado, y
  los que preferían una línea pidieron **"detail on demand"**. El patrón ganador es
  literalmente el de este informe: **una línea siempre visible + detalle de procedencia
  expandible**.
- La paradoja de Frontiers (2026): labels demasiado prominentes/dramáticos producen
  **information avoidance** — el lector esquiva el contenido entero. El label óptimo es
  factual y chico, no una advertencia roja.

### 4.2 Cómo marcan procedencia los productos (convenciones copiables)

| Producto | Marca | Mecanismo de procedencia |
|---|---|---|
| Amazon review highlights | *"AI-generated from the text of customer reviews"* debajo del bloque | tags clickeables que filtran las reviews fuente |
| GitHub Copilot PR summary | bloque generado a demanda, autoría Copilot | **cada bullet linkea a las líneas del diff** |
| Notion AI Meeting Notes | bloque propio de tipo "AI meeting notes" | **cada takeaway linkea al momento del transcript** |
| NN/g AI reviews (recomendación) | label "Customers say" + disclaimer visible | counts y citas linkeadas a reviews reales |
| Anthropic thinking | bloque "thinking" plegado, marcado como resumen del razonamiento | expandible |

La regla común: **frontera de bloque + label factual corto + cada afirmación del resumen
ancla a su evidencia**. Y del estudio NN/g de AI reviews (jun-2025), tres requisitos de
confianza del lector que aplican uno a uno a un resumen de análisis:

1. **Temas específicos, no genéricos** ("CPA de BHI subió 18% por el grupo X", no "el
   rendimiento tuvo variaciones").
2. **Lo negativo visible**: un resumen que solo dice lo bueno huele a filtro y mata la
   confianza. "No se puede saber con estos datos" en el resumen *suma* credibilidad.
3. **El original siempre accesible**: los usuarios quieren llegar al texto fuente aun
   habiendo leído el resumen. El resumen que bloquea el original fracasó en el estudio.

### 4.3 Para NorthSignal: qué es derivado y qué es del autor

En esta app hay dos orígenes de texto y conviene marcarlos distinto:

- **Texto del agente (el análisis completo):** es el documento fuente. Va plegado pero
  íntegro, con su fecha y su agente firmante. No se reescribe.
- **Capa derivada (veredicto + bullets):** si la extrae otro proceso (o un modelo), lleva
  el label corto tipo "Resumen generado del análisis del {fecha}" + link ancla. Si el
  veredicto viene **estructurado desde el propio flujo** (campos que el agente ya emite:
  estado, acción propuesta, métricas), no es "resumen generado": es **dato**, y es la opción
  más robusta — cero re-summarización, cero segundo layer de alucinación. La recomendación
  técnica: derivar la capa 1 de estructura (JSON/campos) siempre que exista, y reservar la
  summarización LLM para el texto libre legado.

---

## 5. Tipografía y layout: jerarquía del veredicto, longitud del resumen, línea

### 5.1 Longitudes con evidencia o convención fuerte

| Elemento | Número | Fuente |
|---|---|---|
| Frase de veredicto | **1 oración, ~140 chars, techo 200** | Linear: "brief… almost like a tweet"; BLUF |
| Resumen de estado completo | **2-3 oraciones** | Asana (guía oficial de status updates) |
| Bullet de resumen | **≤125 caracteres**, uno por hallazgo | formato GitHub Copilot PR summary |
| Cantidad de bullets | **2-4** (si hay más, el corte primario está mal hecho) | NN/g long-form + regla de split |
| Update semanal humano | **5 oraciones**: estado, avance, bloqueos, foco próximo, cambios de alcance | convención Linear/PM |
| Línea de lectura del cuerpo | **50-75 CPL, ideal 60-70** (`max-width: ~65ch`) | Baymard; literatura tipográfica (Bringhurst 45-75; Ruder 50-60; Dyson & Haselgrove ~55) |
| Penalidad por línea larga | **>80 CPL → 41% más skip** del bloque | Baymard |
| Bold en el cuerpo | **≤30% del texto** | NN/g long-form |
| Niveles de plegado | **≤2** | NN/g progressive disclosure |

### 5.2 Jerarquía visual del veredicto

Síntesis de las prácticas convergentes (Linear, Asana, NN/g callouts, thinking UIs):

- **El estado categórico es lo más pesado de la card**: chip/badge con color semántico
  **+ texto** (nunca color solo — accesibilidad y ambigüedad). Verde/amarillo/rojo es la
  convención universal (Linear y Asana idénticos: on track / at risk / off track; Asana
  suma azul = en pausa).
- **La frase de veredicto en un paso tipográfico arriba del cuerpo** (si el cuerpo es 15-16px,
  el veredicto 18-20px semibold; escala 1.2-1.25). Es título de card, no heading de página.
- **El bloque resumen con tratamiento de callout**: fondo sutil o borde izquierdo, separado
  del detalle. Es lo que NN/g midió que la gente *nota*.
- **El detalle plegado en tipografía de cuerpo normal**, sin competir. El summary del
  `<details>` ("Ver análisis completo · 1.800 palabras · agente semanal · 12/9") en peso
  medio con affordance clara de expansión (chevron). NN/g: la mecánica de progresión tiene
  que ser obvia.
- **Progreso medido como elemento propio**, no enterrado en prosa: "3/7 acciones aplicadas"
  o barra fina — el patrón "3 of 7 steps" de las interfaces de agentes 2026.

---

## 6. Accesibilidad del plegado

### 6.1 Semántica

- **Primera opción: `<details>`/`<summary>` nativo.** Cero ARIA, cero JS, teclado y screen
  reader resueltos (web.dev, Deque). La guía del gobierno de NZ y el principio APG lo dicen
  igual: *"No ARIA is better than Bad ARIA"*.
- **Si es widget custom** (animación, control fino): patrón Disclosure de W3C APG —
  `<button>` real, **`aria-expanded`** sincronizado en cada toggle, `aria-controls` al panel.
  Para acordeón multi-sección: cada botón **envuelto en un heading** del nivel correcto (la
  lista de summaries cerrados es la tabla de contenidos del documento — eso es lo que navega
  un usuario de screen reader). `role="region"` + `aria-labelledby` en los paneles solo
  hasta ~**6 paneles**; más que eso prolifera landmarks y APG recomienda omitirlo.

### 6.2 Búsqueda del navegador: el problema histórico está resuelto

El argumento clásico contra el plegado — "Ctrl+F no encuentra lo plegado" — caducó:

- **`<details>` auto-expande con find-in-page**: parte de **Interop 2025** (issue
  web-platform-tests/interop#491). Chrome lo tenía, Firefox lo sumó (v139), Safari entró vía
  Interop 2025 (en Technology Preview a fines de 2025). El navegador busca dentro del
  contenido cerrado, y al matchear **abre el `<details>` y salta al match**.
- **`hidden=until-found`** para plegados que no son `<details>`: el contenido queda con
  `content-visibility: hidden` (encontrable por find-in-page y por fragment navigation), y
  el evento **`beforematch`** permite expandir el widget custom cuando el navegador lo
  encuentra (CSS-Tricks, ago-2025; MDN). Sin polyfill CSS puro — en navegadores viejos
  degrada a visible, que es la degradación correcta.

Implicancia de producto: el "lo técnico no se pierde" es literal — un término plegado en el
análisis de hace tres semanas aparece con Ctrl+F. Requisito: plegar con `<details>` o
`hidden=until-found`, **no** con `display:none` condicional de React (lo desmontado no
existe para la búsqueda). Para contenido largo, renderizarlo en el DOM plegado, no lazy al
expandir — o aceptar explícitamente que lo lazy no es buscable.

### 6.3 Impresión

CSS no puede abrir un `<details>` (issue w3c/csswg-drafts#2084, abierto desde 2018): un
`@media print` no alcanza. El patrón estándar: listener de **`beforeprint`** que setea
`open` en todos los `<details>` (y `afterprint` que restaura). Para el reporte que Andrés
reenvía al cliente esto es requisito, no detalle: **impreso/PDF sale todo abierto**.

---

## 7. Estado + narrativa: la convención del veredicto categórico + una frase

La convención está tan asentada que tres productos independientes la implementaron casi
idéntica:

- **Linear Project Updates** (post de diseño, ago-2022; docs vigentes): **health indicator
  categórico** (On track / At risk / Off track — verde/amarillo/rojo) **+ rich text corto**.
  Dos decisiones del post que valen oro acá: (1) el progreso **no se puede predecir solo con
  datos cuantitativos** — hace falta el juicio cualitativo del equipo (en NorthSignal: del
  agente); (2) el update debe ser *"brief and to the point. Almost like a tweet"*. Y de las
  docs: **el health status es juicio humano explícito, no un cálculo** — un proyecto puede
  estar 80% completo y At Risk porque el 20% restante tiene las dependencias más duras. El
  estado y el progreso son **señales distintas y se muestran las dos**.
- **Asana status updates** (help center + guía): mismos tres estados + color, más azul
  (en pausa). Guía de escritura oficial: **resumen de 2-3 oraciones**, primero el estado,
  después logros clave y próximos hitos. Detalle interesante: recomienda **acordar en equipo
  qué significa "At risk" vs "Off track"** — el vocabulario del veredicto se define una vez,
  no por update (en NorthSignal: definición fija de qué es "atención" vs "riesgo" para las
  4 cuentas, documentada donde el agente y el operador la compartan).
- **Basecamp automatic check-ins / Heartbeats**: la pregunta automática ("What did you work
  on today?" a las 17:00) genera la narrativa corta; los **Heartbeats** son el resumen de
  ciclo escrito por el lead. Sin estado categórico — Basecamp es el contraejemplo
  deliberado: pura narrativa, cero semáforo. Funciona para cultura de empresa; para triaje
  operativo diario, la evidencia de Linear/Asana (y todo el capítulo 2) dice que el
  categórico escaneable es lo que da los "2 segundos".

**La convención completa, en una línea:** `[estado categórico de vocabulario fijo] +
[una frase de juicio cualitativo] + [progreso medido como señal separada] + [narrativa
completa una capa abajo]`.

---

## 8. Traducción a NorthSignal: la spec que sale de la evidencia

Para plan semanal, diagnóstico y pulso diario — sin tocar los prompts de los agentes:

### Capa 1 — Veredicto (siempre visible, 2 segundos)
- Chip de estado: vocabulario fijo de 3-4 valores (p.ej. `en orden / atención / riesgo /
  sin datos suficientes`), color + texto, definición única compartida.
- Una frase de veredicto ≤140-200 chars, pirámide invertida/BLUF: cuenta + qué + por qué
  ahora. Extraída de campos estructurados si existen; si no, derivada y marcada.
- Progreso medido como elemento separado: "3/7 acciones aplicadas", "semana 2/4 del plan".
- Si pide acción: la acción es visible acá (consistente con `v_para_actuar`: lo accionable
  nunca se pliega).

### Capa 2 — Puntos clave (visibles bajo el veredicto o a un clic)
- 2-4 bullets ≤125 chars, específicos y con números, **incluyendo lo negativo y los "no se
  puede saber"**.
- Cada bullet con ancla a la sección del análisis completo que lo respalda (patrón
  Copilot/Notion).

### Capa 3 — Análisis completo (plegado, nunca perdido)
- `<details>`/`<summary>` nativo (o custom con `aria-expanded` + `hidden=until-found`).
- Summary informativo: "Análisis completo · pulso diario BHI · 12/9 · 1.400 palabras".
- Texto íntegro del agente, sin reescritura, autoría y fecha visibles.
- Cuerpo a `max-width` ~65ch; bold ≤30%; headings reales adentro (navegables).
- `beforeprint` abre todo; find-in-page encuentra lo plegado (Interop 2025).
- Máximo un nivel más de plegado adentro (secciones), y nada más profundo.

### Procedencia
- Label factual corto en la capa derivada ("Resumen del análisis del 12/9") — una línea,
  con el detalle de cómo se generó a demanda (patrón arXiv ene-2026).
- Frontera de bloque dura entre texto de agente y texto derivado. Nunca texto generado bajo
  autoría de otro (lección Copilot mar-2026).

### Anti-patrones a evitar (del backlash 2026)
- Resumir el resumen (capas de resúmenes = fatiga y desconfianza).
- Resumen genérico sin números ("el rendimiento tuvo variaciones").
- Plegar el accionable o el dato de riesgo (GOV.UK: nunca esconder lo que la mayoría
  necesita; CLAUDE.md: el radio de la acción = radio de la evidencia, y la acción se decide
  mirando la capa 1).
- Semáforo solo-color sin texto.
- Auto-abrir el análisis completo por defecto "para que se vea el trabajo": la convención
  2026 es colapsado con presencia visible.

---

## Fuentes

Las marcadas **[F]** son de foros/comunidad; **[2026]** son de 2026. Las fechas son de
publicación del contenido citado.

**Progressive disclosure y acordeones**
1. Progressive Disclosure — NN/g — https://www.nngroup.com/articles/progressive-disclosure/ — 2006 (vigente) — regla de ≤2 niveles de disclosure; condiciones del split primario/secundario; mejora learnability/eficiencia/errores.
2. Accordions for Complex Website Content on Desktops — NN/g — https://www.nngroup.com/articles/accordions-complex-content/ — 2014 — cuándo el plegado esconde de más; "clicks like currency"; ~20% de atención below the fold; menor descubrimiento de lo plegado.
3. Accordions on Desktop: When and How to Use — NN/g — https://www.nngroup.com/articles/accordions-on-desktop/ — s/f (serie vigente) — escenarios a evitar: necesidad de la mayoría del contenido, comparación entre secciones, lectura continua.
4. Details component — GOV.UK Design System — https://design-system.service.gov.uk/components/details/ — vigente 2025 — "no esconder lo que la mayoría necesita"; details para una sección, accordion para varias.
5. Accordion component — GOV.UK Design System — https://design-system.service.gov.uk/components/accordion/ — vigente 2025 — guía de composición de secciones plegables múltiples.
6. **[F]** Details (Hidden text) — alphagov/govuk-design-system-backlog#44 — https://github.com/alphagov/govuk-design-system-backlog/issues/44 — hilo histórico — evidencia y debate detrás de la guía del componente details.
7. What Is Progressive Disclosure? — UXPin — https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/ — 2026 **[2026]** — actualización del canon: no plegar precio/consentimiento/riesgo bajo disclosure de aspecto opcional.

**Output de agentes LLM 2025-2026**
8. How AI models show their reasoning process in real-time — Digestible UX (Kim & Jang) — https://www.digestibleux.com/p/how-ai-models-show-their-reasoning — 06-mar-2025 — comparación ChatGPT/Claude/Grok/DeepSeek/Gemini; convención "colapsado al terminar"; "more transparency ≠ better UX".
9. Thinking — Claude Platform Docs — https://platform.claude.com/docs/en/build-with-claude/thinking — vigente 2025-2026 — el thinking mostrado es resumen del razonamiento, no raw.
10. **[F]** Show extended thinking collapsed by default — anthropics/claude-code#36006 — https://github.com/anthropics/claude-code/issues/36006 — 2025-2026 — usuarios técnicos piden colapso por defecto con toggle.
11. Chain of Thought UI — assistant-ui docs — https://www.assistant-ui.com/docs/guides/chain-of-thought — vigente 2025-2026 — patrón de acordeón único para agrupar razonamiento en UIs de chat.
12. Agentic UX: Frontend Design Patterns for AI Agents in 2026 — Zylos Research — https://zylos.ai/research/2026-05-28-agentic-ux-frontend-design-patterns-ai-agents/ — 28-may-2026 **[2026]** — capas paso→tool call→raw; "todo visible = overload, todo oculto = distrust"; progreso "3 of 7 steps".
13. ChatGPT users report the thinking phase has disappeared (sobre thread de r/OpenAI) — Startup Fortune — https://startupfortune.com/chatgpt-users-report-the-thinking-phase-has-disappeared-by-default-and-founders-building-on-openais-apis-should-understand-exactly-what-changed-and-why/ — 2025 — **[F]** (reporte de foro) — ocultar del todo el razonamiento también genera reclamo: el equilibrio es colapsado-pero-presente.
14. Creating a pull request summary with GitHub Copilot — GitHub Docs — https://docs.github.com/en/copilot/responsible-use/pull-request-summaries — vigente 2025-2026 — formato párrafo+bullets ≤125 chars linkeados al diff; "supplement — not replace".
15. **[F]** Copilot won't summarize a pull request — GitHub Community discussion #121150 — https://github.com/orgs/community/discussions/121150 — 2024-2025 — inconsistencia del summary y erosión de confianza.
16. GitHub backs down, kills Copilot PR 'tips' after backlash — The Register — https://www.theregister.com/2026/03/30/github_copilot_ads_pull_requests/ — 30-mar-2026 **[2026]** — 11.400+ PRs con texto generado bajo autoría humana; GitHub recula; "wrong judgement call".
17. **[F]** GitHub Copilot PR "tips" backlash — Windows Forum — https://windowsforum.com/threads/github-copilot-pr-tips-backlash-trust-monetization-and-hidden-guidance.408539/ — 2026 **[2026]** — reacción de comunidad: frontera de autoría y confianza.
18. Introducing Linear Agent — Linear Changelog — https://linear.app/changelog/2026-03-24-introducing-linear-agent — 24-mar-2026 **[2026]** — síntesis ejecutable sobre exhaustividad; resúmenes contextuales en chat/acciones.
19. Coding sessions in Linear — Linear Changelog — https://linear.app/changelog/2026-06-11-coding-sessions — 11-jun-2026 **[2026]** — agentes reportando en formato de actividad dentro del issue; fix de Pulse (resúmenes diarios).
20. Notion 2.51: AI Meeting Notes, Enterprise Search — Notion Releases — https://www.notion.com/releases/2025-05-13 — 13-may-2025 — resumen como bloque propio; takeaways linkeados al momento del transcript (procedencia por ancla).
21. Slack bolsters search with AI, adds transcriptions and summaries — TechCrunch — https://techcrunch.com/2025/07/17/slack-bolsters-search-with-ai-adds-transcriptions-and-summaries-for-huddles — 17-jul-2025 — recaps a demanda con el thread original intacto.
22. Slack AI Review 2026 — Fastio — https://fast.io/resources/slack-ai-review-2026/ — 2026 **[2026]** — crítica 2026: pricing y límites, no el patrón resumen-a-demanda.
23. **[F]** AI fatigue is real and nobody talks about it — Hacker News (item 46934404) — https://news.ycombinator.com/item?id=46934404 — feb-2026 **[2026]** — 471 puntos, 320 comentarios; fatiga de evaluar output generado; castigo al texto inflado ("1-2 sentences → whole paragraphs").
24. Hacker News Trends, September 2026 — blog.mean.ceo — https://blog.mean.ceo/hacker-news-trends-september-2026/ — sep-2026 **[2026]** — sentimiento HN: de hype a control/confianza; backlash a features AI no pedidas.
25. **[F]** I hate AI summaries — ResetEra — https://www.resetera.com/threads/i-hate-ai-summaries.1358371/ — 2025-2026 — la queja del lector: pérdida de matiz, resumen como "nutritional facts" del texto.
26. Why I don't read AI-generated summaries — Zara Zhang (Substack) — https://zarazhang.substack.com/p/why-i-dont-read-ai-generated-summaries — 2025 — el resumen no es neutral: qué importa depende del lector.

**Docs técnicas y editorial**
27. How Stripe creates the best documentation in the industry — Mintlify — https://www.mintlify.com/blog/stripe-docs — 2024-2025 — progressive disclosure editorial: el junior integra sin ver lo avanzado, el senior lo encuentra una capa abajo.
28. Why Stripe's API Docs Are the Benchmark — Apidog — https://apidog.com/blog/stripe-docs/ — 2025 — dosis de detalle por audiencia como principio de estructura.
29. Inverted Pyramid: Writing for Comprehension — NN/g (Amy Schade) — https://www.nngroup.com/articles/inverted-pyramid/ — 11-feb-2018 — conclusión primero; el lector abandona en cualquier punto llevándose lo esencial.
30. BLUF (communication) — Wikipedia — https://en.wikipedia.org/wiki/BLUF_(communication) — vigente — estándar militar: 5W en la primera línea, más corto que un executive summary.
31. 5 Formatting Techniques for Long-Form Content — NN/g — https://www.nngroup.com/articles/formatting-long-form-content/ — 17-nov-2023 — resumen al inicio con tratamiento visual de callout; bullets para múltiples conclusiones; bold ≤30%.

**TL;DR generado vs escrito, confianza y procedencia**
32. Full Disclosure, Less Trust? How the Level of Detail about AI Use in News Writing Affects Readers' Trust — arXiv 2601.09620 (Prajod et al.) — https://arxiv.org/abs/2601.09620 — 14-ene-2026 **[2026]** — one-line no baja confianza, detallado sí; ~2/3 prefieren detallado; pedido de "detail on demand".
33. AI labeling reduces the perceived accuracy of online content but has limited broader effects — arXiv 2506.16202 — https://arxiv.org/pdf/2506.16202 — 2025 — el label tiene costo perceptual acotado.
34. How AI-Generated Content Shapes User Trust — PMC — https://pmc.ncbi.nlm.nih.gov/articles/PMC13295875/ — 2025 — labels de transparencia y riesgo percibido; disclosure como señal de apertura.
35. The paradox of AI content labeling — Frontiers in Psychology — https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1751670/full — 2026 **[2026]** — labels demasiado prominentes producen information avoidance: label factual y chico.
36. Labeling AI-generated media online — Berinsky et al. (MIT) — https://berinsky.mit.edu/files/2026/01/labelingaigenerated_2025.pdf — ene-2026 **[2026]** — dos estrategias de label: por proceso (cómo se hizo) vs por daño (si engaña).
37. AI Summaries of Reviews — NN/g (Dykes & Sherwin) — https://www.nngroup.com/articles/ai-reviews/ — 13-jun-2025 — requisitos de confianza: temas específicos, negativos visibles, counts/citas linkeadas, original siempre accesible, disclaimer visible.
38. How Amazon continues to improve the customer reviews experience with generative AI — About Amazon — https://www.aboutamazon.com/news/amazon-ai/amazon-improves-customer-reviews-with-generative-ai — 2023-2025 — el label de referencia: "AI-generated from the text of customer reviews" + tags que filtran las fuentes.

**Tipografía y layout**
39. Readability: The Optimal Line Length — Baymard Institute — https://baymard.com/blog/line-length-readability — vigente — 50-75 CPL; >80 CPL → 41% más skip del bloque.
40. Optimal Line Length for Readability — UXPin — https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/ — 2026 **[2026]** — consolidación 2026 del rango 50-75/66 CPL (Bringhurst, Ruder 50-60, Dyson & Haselgrove ~55).

**Accesibilidad del plegado**
41. Accordion Pattern — W3C ARIA Authoring Practices Guide — https://www.w3.org/WAI/ARIA/apg/patterns/accordion/examples/accordion/ — vigente — button + aria-expanded + aria-controls; headings; límite de ~6 paneles con role=region.
42. Disclosures and accordions — NZ Government Web A11y Guidance — https://govtnz.github.io/web-a11y-guidance/wct/disclosures-and-accordions/ — vigente — details/summary nativo primero; "No ARIA is better than Bad ARIA".
43. Covering hidden=until-found — CSS-Tricks (Geoff Graham) — https://css-tricks.com/covering-hiddenuntil-found/ — 15-ago-2025 — content-visibility:hidden + beforematch; soporte Chrome 102+/Firefox 139/Safari TP 125; sin polyfill CSS.
44. **[F]** hidden=until-found and auto-expanding details — web-platform-tests/interop#491 — https://github.com/web-platform-tests/interop/issues/491 — 2024-2025 — la inclusión en Interop 2025: details se auto-expande con find-in-page en los tres motores.
45. **[F]** Ability to style details/summary to be open (e.g. for print styles) — w3c/csswg-drafts#2084 — https://github.com/w3c/csswg-drafts/issues/2084 — abierto desde 2018 — CSS no puede abrir details: impresión requiere JS en beforeprint.
46. hidden global attribute — MDN — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden — vigente — semántica del estado hidden-until-found y fragment navigation.

**Estado + narrativa**
47. How we built Project Updates — Linear — https://linear.app/now/how-we-built-project-updates — 10-ago-2022 — health categórico + texto "almost like a tweet"; el progreso necesita juicio cualitativo, no solo datos.
48. Initiative and Project updates — Linear Docs — https://linear.app/docs/initiative-and-project-updates — vigente 2025-2026 — On track/At risk/Off track como juicio explícito; estado y progreso como señales separadas.
49. Project status updates and reporting — Asana Help Center — https://help.asana.com/hc/en-us/articles/14246229345947-Project-status-updates-and-reporting — vigente — 4 estados + color; resumen de 2-3 oraciones; acordar el significado de cada estado en equipo.
50. **[F]** Project Icon Colors Based on Project Status — Asana Forum — https://forum.asana.com/t/project-icon-colors-based-on-project-status/161400 — 2021-2024 — demanda de usuarios: el estado categórico visible desde la lista, sin abrir el proyecto.
51. How do you know what people have been working on? — DHH (HEY World) — https://world.hey.com/dhh/how-do-you-know-what-people-have-been-working-on-48b8986d — 2023 — check-ins escritos y Heartbeats como narrativa de ciclo; el contraejemplo sin semáforo.
52. Status meetings are the scourge — Jason Fried — https://www.linkedin.com/pulse/status-meetings-scourge-heres-what-we-do-instead-jason-fried — 2015-2016 — pregunta automática + respuesta corta escrita como reemplazo del reporte oral.

**Conteo:** 52 fuentes listadas; 13 de 2026 (4 de jun-sep-2026); 10 de foros/comunidad.
Verificadas por lectura directa (fetch): 1, 2, 8, 14, 16, 18, 23, 29, 31, 32, 37, 43, 47.
El resto, verificadas por metadata de resultados de búsqueda (título/URL/fecha reales).
