# 10 · El contrato entre el agente y el front

**Eje:** cómo separar la "inteligencia técnica" (lo que los agentes escriben en Supabase) de la
"presentación legible" (lo que la SPA muestra), **sin tocar los prompts**. Contratos de datos,
parsing robusto de salida de LLM, capas de presentación, versionado y procedencia.

**Investigación web, 2024–2026, con foco en junio–septiembre 2026 donde existe material.**
Fecha del informe: 13 de septiembre de 2026. Fuentes verificadas al final (32 listadas;
7 de foros/comunidad; 13 de 2026, 6 de ellas de junio–septiembre).

**Restricción de diseño que gobierna todo el documento:** los prompts de los agentes de Cowork
no se tocan. El texto que hoy llega a `contexto`, `hallazgo_principal` y `resumen` va a seguir
llegando igual. Todo lo que sigue parte de esa premisa.

---

## 1. El principio: el backend es dueño del significado, el front es dueño de la forma

La idea no es nueva ni de la era LLM: es *separation of content and presentation*, el mismo
principio que separó HTML de CSS y que la industria del contenido llama hoy *structured
content* o *headless content*. La formulación moderna más citada es la de los CMS headless:
el contenido se modela como **componentes tipados con significado**, y la presentación es una
función que cualquier canal aplica después. Contentful lo resume así: el contenido estructurado
"separa significado de presentación usando campos tipados, relaciones y metadatos", y esa
separación es precisamente lo que lo hace apto para pipelines de IA y para múltiples frontends
([Contentful](https://www.contentful.com/blog/structured-content-ai/)).

El ejemplo más maduro de este principio aplicado a **texto** es Portable Text de Sanity: el
texto rico no se guarda como HTML ni como Markdown sino como un array JSON de bloques tipados,
y "el punto de tener el contenido en Portable Text es tener control total sobre la
presentación" — el mismo JSON se renderiza como HTML, React, texto plano o lo que venga
([Sanity, Introduction to Portable Text](https://www.sanity.io/guides/introduction-to-portable-text)).
La lección para NorthSignal no es adoptar Portable Text: es la dirección de la dependencia.
**El almacenamiento nunca guarda decisiones de presentación; la presentación nunca guarda
significado.**

Traducido a este sistema:

- Los **campos estructurados** (indicadores con series y umbrales, JSON de métricas) son el
  contenido con significado. De ahí sale la lectura clara.
- Los **campos de texto libre** (`contexto`, `hallazgo_principal`, `resumen`) son contenido
  *opaco*: valioso, pero sin contrato interno garantizado. El front puede tipografiarlos,
  plegarlos y partirlos por estructura visible (encabezados, párrafos), pero no puede
  atribuirles significado que no está declarado.
- La frase legible que el usuario ve arriba de todo **se deriva de lo estructurado**, no del
  texto. El texto técnico queda a un clic, plegado.

Esto tiene un precedente directo en BI: Evidence.dev construye productos de datos enteros con
la misma separación — SQL para la verdad, Markdown + componentes para la forma — y su revisión
2026 lo describe como la opción para equipos donde "los analytics engineers ya son dueños de la
capa semántica y de presentación" ([Evidence](https://evidence.dev/),
[Modern DataTools, 2026](https://www.modern-datatools.com/tools/evidence)). Y el semantic layer
de dbt existe por la misma razón: cuando la lógica de una métrica vive en varios lugares
(dashboards, front, SQL suelto), aparece *metric drift* — "el mismo KPI computado ligeramente
distinto" ([dbt Semantic Layer](https://www.getdbt.com/product/semantic-layer)). NorthSignal ya
tiene ese principio en la base (`metrica_*`, `ventana_metrica()`): la conclusión de esta
investigación es extenderlo hacia arriba, hasta la frase que ve el usuario.

---

## 2. Contratos de datos para narrativas: cómo lo hacen los productos de analítica

### 2.1 Tableau Pulse: hechos deterministas primero, lenguaje después

La arquitectura de referencia para "insight legible sobre datos" es Tableau Pulse, y su
documentación es explícita sobre el orden de las capas: el *Insights Platform* "usa modelos
estadísticos determinísticos y estandarizados para detectar hechos sobre métricas", esos hechos
"actúan como verdad base", y recién entonces la IA "contextualiza la generación de lenguaje"
([Tableau, Insights Platform and Insight Types](https://help.tableau.com/current/online/en-us/pulse_insights_platform_insight_types.htm)).
El LLM redacta; **no decide**. Pulse define un catálogo cerrado de tipos de insight — 14 hoy:
Period Over Period Change, Correlated Metrics, Record-level Outliers, Forecast, Current Trend,
Trend Change Alert, Unexpected Values, Goal and Threshold Breakdown, Pace to Goal, Top
Drivers, Top Detractors, Concentrated Contribution Alert, Top Contributors, Bottom
Contributors — y cada tipo tiene una estructura fija (valor, dirección, dimensión, ventana).

Power BI hace lo mismo con Smart Narrative: la narrativa es una plantilla con **valores
dinámicos** que se recalculan del modelo semántico en cada refresh; el texto nunca guarda el
número, guarda la referencia
([Microsoft Learn](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-smart-narrative)).

**Aplicación directa:** el "insight" de NorthSignal ya tiene la mitad del contrato (indicador,
serie, umbral). Lo que falta no se le pide al agente: se computa. Un catálogo chico de
veredictos categóricos derivables por SQL (`en_rango`, `fuera_de_rango`, `sin_datos_suficientes`,
`madurando`) + la evidencia numérica que ya existe + el texto del agente como capa narrativa
plegada replica la arquitectura Pulse sin tocar un prompt.

### 2.2 El contrato de tres canales de MCP: datos para el modelo ≠ datos para la UI

El estándar emergente más relevante de 2026 es la separación de canales en los resultados de
tools MCP (la base del Apps SDK de OpenAI): `content` (fallback portable, lo ven modelo,
usuario y clientes de texto), `structuredContent` (JSON tipado que "debe coincidir" con un
`outputSchema` declarado; lo leen la vista de la app y el modelo) y `_meta` (datos de runtime
solo para el widget: cursores, IDs, versiones de caché — nunca entran al contexto del modelo)
([sunpeak, 6 sep 2026](https://sunpeak.ai/blogs/mcp-app-tool-results-content-structuredcontent-meta/),
[OpenAI Apps SDK](https://developers.openai.com/apps-sdk/plan/components)). Es la misma
separación significado/forma, institucionalizada en un protocolo: **el schema tipado es el
contrato, el texto es el fallback portable, y lo que es puro andamiaje de UI viaja aparte.**

La advertencia que dejó la comunidad este año: en marzo de 2026 el bridge de ChatGPT empezó a
descartar los `_meta` custom de los tool results, rompiendo widgets que dependían de ese canal;
la mitigación oficial mientras duró fue mover claves opacas chicas a `structuredContent`
([OpenAI Developer Community, mar–may 2026](https://community.openai.com/t/chatgpt-mcp-apps-bridge-drops-custom-meta-from-tool-results-in-ui-notifications-tool-result/1378047)).
Lección general: **no construir sobre canales que el contrato no garantiza** — que en el caso
de NorthSignal significa no construir sobre regularidades casuales del texto del agente, porque
nadie las garantiza.

### 2.3 Data contracts formales para pipelines de agentes

La disciplina de data engineering ya tiene nombre para esto: un data contract es "propiedad,
estructura, semántica, calidad y términos de uso de los datos intercambiados entre un productor
y sus consumidores — una API, pero para datos". En pipelines de agentes, cada handoff
(modelo→tool, tool→warehouse, warehouse→front) es una frontera productor/consumidor. Dos
recomendaciones concretas de la guía de referencia: contratar el schema "el día que otro equipo
empieza a consumirlo" (no antes: contratar prematuro complica la evolución), y tratar como
eventos distintos con remediación distinta los rechazos de seguridad, los errores de tool, las
fallas de validación y el drift de schema
([Digital Applied, Data Contracts for AI Agent Pipelines](https://www.digitalapplied.com/blog/data-contracts-for-ai-agent-pipelines)).

Para NorthSignal el contrato relevante hoy no es agente↔base (eso está congelado por decisión
del dueño): es **base↔front**. Y ese contrato conviene formalizarlo como una vista SQL con
columnas estables — ver §4.

---

## 3. Parsear y normalizar la salida del LLM sin tocar el prompt

### 3.1 El patrón validado en 2026: cadena de prioridad con degradación

El artículo más directamente aplicable al caso encontrado en esta investigación —
"Frontend: Rich Cards and Streaming Responses"
([Nitin Kumar Singh, abr 2026, actualizado 2 sep 2026](https://nitinksingh.com/posts/frontend-rich-cards-and-streaming-responses/)) —
resuelve exactamente este problema y lo dice en la introducción: convertir respuestas crudas de
agentes en componentes ricos, "**sin modificar los agentes backend**". Su `parseContent()` es
una cadena de prioridad con *early returns*:

1. Estructura explícita si existe (bloques cercados) — lo más confiable.
2. Patrones detectables en texto plano — fallback heurístico.
3. Markdown por defecto — nadie se queda sin render.

Y la regla de oro: cada intento va en `try/catch`; si el parseo falla, **se muestra el texto
crudo en lugar de crashear**. "Los LLM no siempre siguen instrucciones de formato" es la
premisa de diseño, no un caso borde.

El mismo patrón, del lado de contrato duro, es el *component registry* de NextWave Agentic
([jun 2026](https://nextwaveagentic.com/blog/rendering-rich-react-cards-from-ai-agent-tool-calls)):
los tools del backend son *presentation-agnostic* y el front tiene un registry central que
mapea `datatype + intent → componente React`, con fallback a `null` o a una card de error
"evitando estados rotos en el chat". Un dato → una card; sin match → crudo. La visualización de
sesiones de agentes de Claude documentada en julio 2026 usa la misma idea a nivel bloque:
`ContentBlock[]` tipados, razonamiento colapsable, y `react-markdown` + resaltado como piso
([DeepWiki, agent-insight-board, jul 2026](https://deepwiki.com/kittsai/agent-insight-board/3.2-tool-rendering-and-content-blocks)).

**Para NorthSignal:** el registry es el mapa `tipo de análisis → layout de tarjeta`, y la
cadena de prioridad es: (1) campos estructurados + agregados SQL → tarjeta legible; (2) texto
libre partido por estructura visible → secciones plegadas; (3) texto libre sin estructura →
un solo bloque plegado. Ningún camino rompe.

### 3.2 Qué extraer del texto libre: heurísticas seguras

**Partir por encabezados y listas de Markdown.** Si el agente escribió `##`, `**...**` como
título de sección, o bullets, esa estructura es *declarada por el autor* — usarla no inventa
nada. Es el mismo argumento por el que los pipelines RAG conservan Markdown: "cada elemento
estructural se vuelve sintaxis que cualquier herramienta puede parsear"
([Contextractor](https://www.contextractor.com/formats/)). Regla práctica: parsear con un
parser real (`react-markdown`/`marked`), no con regex sobre líneas.

**Primera oración como lead.** Es la heurística de resumen más defendible que existe: la
pirámide invertida pone "la información más importante (o directamente la conclusión) primero"
([NN/g, Inverted Pyramid](https://www.nngroup.com/articles/inverted-pyramid/)), y en
summarization la baseline *Lead-3* (primeras tres oraciones) le gana a muchos modelos
entrenados en corpus de noticias precisamente porque los textos expositivos concentran lo
esencial al principio ([arXiv 1912.11602](https://arxiv.org/pdf/1912.11602)). Un
`hallazgo_principal` escrito por un agente analista suele tener esa forma. Condiciones para que
sea seguro: la oración se toma **completa** (nunca truncado por caracteres), con longitud
plausible (p. ej. 30–220 caracteres; fuera de eso, mostrar el campo entero), y el texto
completo queda siempre a un clic.

**Segmentar oraciones con `Intl.Segmenter`, no con `split('.')`.**
`new Intl.Segmenter('es', { granularity: 'sentence' })` es Baseline (los tres motores) desde el
16 de abril de 2024 — Chrome/Edge 87+, Safari 14.1+, Firefox 125+ — así que en 2026 se usa sin
polyfill en una SPA interna ([web.dev](https://web.dev/blog/intl-segmenter),
[MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)).
Reconoce `¿…?` y `¡…!` y las reglas de ICU/UAX #29 para español. Límite conocido de toda
segmentación por reglas: las abreviaturas con punto ("Sr.", "aprox.", "p. ej.") pueden cortar
de más — es el problema clásico de *sentence boundary detection*, "resuelto" solo en apariencia
([Read et al., COLING 2012](https://aclanthology.org/C12-2096.pdf)). Mitigación suficiente
para un lead: si el primer segmento queda por debajo del mínimo de longitud, concatenar con el
siguiente; jamás intentar un diccionario propio de abreviaturas.

**Resaltar números que ya existen en los campos estructurados.** Marcar en negrita o con chip
un número del texto **solo si matchea por igualdad (con tolerancia de formato) un valor que ya
está en la base**. Eso no crea información: la referencia cruzada es contra la verdad canónica.

**Sanitizar siempre.** La salida de un LLM se trata como contenido no confiable: render de
Markdown con sanitización (DOMPurify o `sanitize-html`) antes de tocar el DOM — la guía de
Chrome lo pone como regla de producción, junto con no re-parsear Markdown a medio llegar
([Chrome Developers, ene 2025](https://developer.chrome.com/docs/ai/render-llm-responses);
[Frontend Patterns, jun 2026](https://frontendpatterns.dev/streaming-response)). En esta app no
hay streaming, pero la parte de sanitización y de "renderizar solo lo estable" aplica igual.

### 3.3 Heurísticas peligrosas: qué NO extraer para no mentir

Este sistema declara su modo de falla: *números verosímiles y equivocados*. Las heurísticas
siguientes fabrican exactamente eso, y la evidencia 2026 es abundante:

1. **No inferir veredictos del texto.** Clasificar sentimiento o "positivo/negativo" desde
   `resumen` con keywords es inventar un dato con autoridad visual. El veredicto categórico
   sale de umbrales en SQL o no existe (y "no se puede saber" ya es respuesta válida acá).
2. **No extraer números del texto libre para mostrarlos como métricas.** El agente pudo
   redondear, cambiar de ventana o equivocarse; el número canónico vive en la base. Un regex
   que promueve "creció 34%" a KPI de tarjeta crea una segunda fuente de verdad — la
   definición exacta del *semantic drift* que la capa de calidad de NorthSignal existe para
   atrapar. El benchmark de Interfaze (Show HN, may 2026) midió 20–30 puntos de brecha entre
   "JSON válido" y "valores correctos": la validez formal no protege el contenido
   ([HN, may 2026](https://news.ycombinator.com/item?id=47950283)); con regex sobre prosa es
   peor todavía.
3. **No resumir por truncado.** `substring(0, 140) + '…'` corta a mitad de afirmación y puede
   invertir el sentido ("no se detectó caída" → "no se detectó"). Truncar solo por límites de
   oración (Intl.Segmenter) o no truncar.
4. **No parafrasear ni "traducir a simple" automáticamente.** Reescribir el hallazgo con
   reglas o con otro LLM en el cliente agrega un autor nuevo sin aprobación. Si algún día se
   quiere una capa de reescritura, es un post-proceso en backend, versionado, con procedencia
   marcada y revisable — no una transformación silenciosa en render (ver §4 y §6).
5. **No ocultar el original.** Plegado ≠ eliminado. La degradación correcta cuando nada
   parsea es texto crudo plegado con el campo `resumen` entero como encabezado.
6. **No depender de regularidades no prometidas.** Si los últimos 40 análisis empezaron con
   "Hallazgo:", eso no es un contrato; el día que el modelo del agente cambie, se cae (§5).

La discusión técnica de 2026 respalda la postura conservadora incluso para el JSON "garantizado":
el post de BoundaryML que llegó a portada de HN en enero mostró que forzar schema puede producir
estructura válida con valores equivocados (el famoso `0.4` bananas — el peso, no la cantidad), y
el consenso del thread fue que la salida estructurada no exime de validar semántica
([HN, ene 2026](https://news.ycombinator.com/item?id=46345333)).

---

## 4. Post-procesar en el backend: la alternativa preferida cuando falte estructura

La regla del dueño — antes de tocar prompts, post-procesar en SQL/servidor — coincide con lo
que la comunidad convergió a llamar "two-step": dejar al modelo escribir libre y estructurar
después, del lado del que consume. En el thread del handbook de structured outputs (feb 2026,
377 puntos) la advertencia repetida fue que la restricción en generación "puede degradar la
distribución de salida" en razonamiento complejo, y que estructurar después es muchas veces
superior ([HN, feb 2026](https://news.ycombinator.com/item?id=46635309)) — o sea: no tocar el
prompt no es solo una restricción de gestión, es defendible técnicamente.

### 4.1 Qué computar en SQL (y por qué ahí)

**Los agregados de progreso que hoy el usuario tiene que deducir del texto** — días cumplidos,
días faltantes, próximo desbloqueo, estado vs umbral, madurez de la ventana — son funciones
puras de datos que ya están en la base. Computarlos en una vista tiene tres ventajas sobre
computarlos en React:

1. **Una sola verdad.** Es el argumento del semantic layer de dbt aplicado en miniatura: si el
   front calcula "faltan N días" con su propia aritmética de fechas, hay dos implementaciones
   de la misma métrica y van a divergir ([dbt](https://www.getdbt.com/product/semantic-layer)).
   En NorthSignal además ya existe la infraestructura conceptual: `ventana_metrica()` existe
   exactamente porque escribir `current_date - N` a mano en dos lugares terminó mal.
2. **Testeable y auditable donde viven los controles.** La capa de calidad
   (`v_relaciones_violadas`, invariantes con trigger) está en Postgres; un agregado en SQL
   puede tener su relación de control. Un `useMemo` en React, no.
3. **Cliente delgado.** Es la arquitectura que el propio equipo de Supabase valida para
   producción: views/functions para la lógica, PostgREST como transporte, "clientes lo más
   simples posible" ([discusión oficial de Supabase](https://github.com/orgs/supabase/discussions/8452)).

**Dónde ponerlo en el stack Supabase + SPA:**

- **Vista SQL** (`v_analisis_para_front` o columnas nuevas en la vista que la SPA ya lee) para
  todo lo derivable por fila: veredicto categórico desde umbrales, agregados de progreso,
  flags de calidad. Contrato explícito: columnas estables, tipadas, en castellano, documentadas
  en `diccionario_datos()`.
- **Ojo con el gotcha de seguridad:** las vistas creadas por el owner son `SECURITY DEFINER`
  por defecto y **saltean RLS** al exponerse por la API; toda vista para el front se crea
  `WITH (security_invoker = true)` (Postgres 15+), y el advisor `0010_security_definer_view`
  de Supabase lo lintea
  ([Supabase Advisors](https://supabase.com/docs/guides/database/database-advisors?lint=0010_security_definer_view),
  [dev.to/datadeer](https://dev.to/datadeer/postgres-views-the-hidden-security-gotcha-in-supabase-ckd)).
- **Función RPC** si el cálculo necesita parámetros del usuario; **materialized view** solo si
  el costo de cómputo lo pide (acá, con estos volúmenes, casi seguro no).
- **Job/función de post-proceso** (cron ya existente en el stack) para lo que sea *extracción
  del texto* que se quiera persistir: si mañana hace falta que "la primera oración del
  hallazgo" quede consultable, se extrae **una vez en el servidor**, se guarda en una columna
  `derivado_*` con `parser_version` y `fuente = 'sistema'`, y el front la lee como cualquier
  otra columna. Nunca dos parsers (uno en front, otro en SQL) para el mismo campo.

### 4.2 Qué queda en el front

Solo forma: jerarquía visual (estructurado arriba, técnico plegado — *progressive disclosure*,
el patrón de Nielsen de 1995 que sigue siendo la respuesta estándar para "mostrar lo esencial y
esconder lo avanzado" ([NN/g vía IxDF](https://ixdf.org/literature/topics/progressive-disclosure),
[LogRocket](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/))),
render sanitizado de Markdown, lead por `Intl.Segmenter` **como mejora visual no persistida**,
formateo de números/fechas con `Intl.NumberFormat`/`Intl.DateTimeFormat` según la ficha del
cliente, y el registry tarjeta↔tipo. La investigación de NN/g sobre GenAI embebida en producto
da la línea editorial de esa capa: respuestas primero, concisión brutal, formato escaneable —
los usuarios elogian exactamente "que te den la respuesta de una y después la expliquen"
([NN/g, abr 2025](https://www.nngroup.com/articles/genai-write-for-the-web/)).

---

## 5. Versionado del contrato y drift de formato: nunca romper

El texto del agente va a cambiar — cambia el modelo de Cowork, cambia el estilo, cambia el
orden de las secciones — y los prompts no se pueden ajustar para compensar. El diseño correcto
asume el cambio:

**Degradación en escalera, nunca pantalla rota.** La escalera de §3.1: estructurado → secciones
→ crudo plegado. Cada nivel es un `try/catch` del siguiente. Es el patrón unánime en las guías
de parsing 2025–2026: "fallback strategies aseguran degradación elegante cuando la salida
estructurada falla" ([Tetrate](https://tetrate.io/learn/ai/llm-output-parsing-structured-generation)).
En Reddit, el hilo de producción sobre JSON malformado documenta la misma escalera del lado
backend — tier 1 limpieza con regex (fences, comas colgantes), tier 2 parcheo estructural
guiado por la excepción del parser, tier 3 reparación con LLM — con la nota de que *siempre*
hay una capa de validación downstream aunque uses structured outputs
([Reddit, nov 2025](https://www.reddit.com/comments/1shf5ed/)).

**Detección de drift de formato = medir la tasa de acierto del parser.** El patrón de
producción documentado: rastrear *parse compliance rate* y distribución de valores por campo en
ventana deslizante, y alertar por Z-score cuando la distribución se corre — así se cazan las
"regresiones silenciosas por upgrade de modelo"
([dev.to/velsof](https://dev.to/velsof/bulletproofing-llm-structured-output-in-python-healing-retries-cost-caps-and-drift-detection-c89);
[Leanware](https://leanware.co/insights/llm-monitoring-drift-detection-guide)). Los umbrales de
referencia que circulan: tasa de fallo de formato > 1% = bandera
([eastondev, may 2026](https://eastondev.com/blog/en/posts/ai/20260506-llm-structured-output/)).
En NorthSignal esto es una vista más de la capa de calidad: qué % de los últimos N análisis
matcheó cada nivel de la escalera. Si "crudo plegado" crece, el formato del agente cambió — y
eso se **ve en una consulta**, no se descubre porque un usuario encontró una tarjeta vacía. Es
el mismo músculo de `v_relaciones_violadas`, apuntado al formato.

**Versionar el parser, no el prompt.** `parser_version` acompaña a todo valor derivado
persistido (§4.1). El estándar de contratos de datos (ODCS 3.1) pide versionado y dueño
explícito para cualquier contrato que otro consuma
([Digital Applied](https://www.digitalapplied.com/blog/data-contracts-for-ai-agent-pipelines));
acá el "productor" es el parser del sistema, y si el parser v3 leyó mal una sección, se sabe
qué filas re-procesar.

**El drift también viene de la plataforma.** El caso del bridge de ChatGPT descartando `_meta`
(§2.2) lo muestra: hasta los canales documentados cambian bajo tus pies. La única defensa es
que cada dependencia tenga fallback y que el fallback se ejercite.

---

## 6. Procedencia: qué frase es del agente y qué frase es del sistema

Si el front deriva frases ("Cumplidos 12 de 17 días · faltan 5") y además muestra texto del
agente, el usuario tiene que poder distinguirlas. Convenciones 2026:

- **IBM Carbon for AI** es el sistema de diseño de referencia: un **AI label** como indicador
  primario de presencia de IA, con *explainability popover* — el principio rector es que "el
  usuario siempre sepa cuándo está interactuando con algo generado por IA"
  ([Carbon Design System](https://carbondesignsystem.com/guidelines/carbon-for-ai/),
  [Servaas, Medium/_carbondesign](https://medium.com/carbondesign/carbon-for-ai-scaling-new-ways-of-working-fc6913624667)).
- **Shape of AI** cataloga los patrones sueltos: *Disclosure* (marcar contenido guiado por IA:
  "AI-generated", "Summarized with AI"), *Footprints* (poder rastrear los pasos que llevaron
  al resultado), *Caveat* (avisar límites)
  ([Shape of AI, Disclosure](https://www.shapeof.ai/patterns/disclosure)).
- **Marco regulatorio como señal de dirección:** desde el 2 de agosto de 2026 el Artículo 50
  del AI Act europeo exige marcar contenido generado por IA (capa visible + capa de metadatos
  C2PA). No aplica a una app interna de gestión en Argentina/Chile, pero fija la convención de
  la industria: la procedencia se declara, no se asume
  ([AI Act Blog, 2026](https://www.aiactblog.nl/en/posts/article-50-practical-labeling-detection)).

**Regla concreta para la SPA (dos etiquetas, siempre):**

1. Frase compuesta por el front/SQL desde campos estructurados → chip **"Derivado de los
   datos"** (u equivalente visual sobrio). Su "explainability" es mostrar de qué campos salió.
2. Texto de `contexto` / `hallazgo_principal` / `resumen` → encabezado **"Análisis del
   agente"** + fecha de la corrida. Se muestra tal cual (sanitizado), sin edición.
3. Nada sin etiqueta: una frase que no se sabe de quién es hereda la peor interpretación de
   ambos mundos. Y si algún día se persisten extracciones (`derivado_*`, §4.1), la columna
   `fuente` viaja hasta el chip.

---

## 7. Qué está asentando la comunidad (últimos meses) y qué está fallando

Lo que se consolidó en 2026, de los threads y posts revisados:

- **Tool calls / structured outputs como contrato UI, no texto parseado.** El patrón dominante
  para producto nuevo: el dato viaja tipado y el front resuelve la card por registry
  ([NextWave, jun 2026](https://nextwaveagentic.com/blog/rendering-rich-react-cards-from-ai-agent-tool-calls));
  pydantic-ai formaliza lo mismo en el borde servidor↔cliente — la respuesta final es un
  objeto validado (`TextAnswer` con `follow_ups` que la UI renderiza como chips), no prosa con
  convenciones ([HackerNoon, 7 sep 2026](https://hackernoon.com/streaming-agents-with-pydantic-ai-over-typed-websockets-tools-approvals-and-a-generated-client)).
  Anthropic cerró la brecha de proveedor en noviembre 2025 con structured outputs nativos
  ([tessl.io](https://tessl.io/blog/anthropic-brings-structured-outputs-to-claude-developer-platform-making-api-responses-more-reliable)).
  *Para NorthSignal esto es dirección de futuro para nuevas piezas (p. ej. si un día el
  ejecutor devuelve resultados al front), no para los agentes existentes.*
- **"JSON válido" dejó de aceptarse como sinónimo de "correcto".** Dos frentes en HN lo
  machacaron: la crítica de BoundaryML (ene 2026) y el benchmark de Interfaze (may 2026) con
  su brecha del 20–30% entre validez y veracidad. La respuesta asentada: validación semántica
  post-schema ("validation sandwich" con Pydantic/Zod más chequeos de negocio)
  ([dev.to/pockit, feb 2026](https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk)).
- **UI generada por el agente: escepticismo ganado.** El thread de A2UI (protocolo de Google
  para que agentes emitan UI como JSON) juntó 75 comentarios mayormente escépticos: latencia,
  estado frágil, inyección, y la observación de que "los agentes no van a lograr de repente lo
  que los desarrolladores no lograron en décadas: UI independiente de plataforma". La
  alternativa preferida del thread: componentes propios + datos tipados
  ([HN, dic 2025](https://news.ycombinator.com/item?id=46286407)). Coincide con la decisión de
  NorthSignal: la tarjeta la diseña el sistema, el agente aporta datos y prosa.
- **Todo texto de LLM en producción tiene capa de limpieza aunque "no debería hacer falta".**
  El hilo de Reddit de producción (§5) y su escalera de 3 tiers es la práctica real; nadie
  reporta confiar en el formato a secas.
- **Lo que falla:** depender de canales/formatos no garantizados (caso `_meta`, §2.2);
  regex-como-parser sin fallback; schemas gigantes de 50 campos que degradan la calidad de
  generación (la recomendación es partir en llamadas chicas —
  [techsy](https://techsy.io/en/blog/llm-structured-outputs-guide)); y truncados/resúmenes
  agresivos que le mienten al usuario con confianza tipográfica.

---

## 8. Recomendación integrada para NorthSignal

| Capa | Qué hace | Qué NO hace |
|---|---|---|
| **SQL (Supabase)** | Veredictos categóricos desde umbrales; agregados de progreso (días cumplidos/faltantes, próximo desbloqueo, madurez de ventana); flags de calidad de formato; vistas `security_invoker` con columnas estables documentadas en `diccionario_datos()`; extracciones persistidas (`derivado_*` + `parser_version` + `fuente`) si algún día hacen falta | No reescribe el texto del agente; no adivina significado; no expone vistas `SECURITY DEFINER` |
| **Front (React SPA)** | Tarjeta con lo estructurado arriba; texto técnico plegado (progressive disclosure); Markdown sanitizado (DOMPurify); lead = primera oración vía `Intl.Segmenter('es')` como mejora visual con guardas de longitud; registry tipo→componente con fallback a crudo plegado; chips de procedencia ("Derivado de los datos" / "Análisis del agente"); formateo `Intl.*` por locale de la cuenta | No extrae números del texto como métricas; no infiere veredictos; no trunca por caracteres; no parafrasea; no oculta el original; no persiste nada |
| **Prompts de agentes** | — (congelados) | — |

**La escalera de render (invariante):** estructurado completo → estructurado parcial + secciones
del texto → crudo plegado con lead. Cada peldaño con `try/catch`. La tasa de cada peldaño se
mide en una vista de la capa de calidad; si "crudo" sube, hubo drift de formato y se ve en una
consulta antes de que nadie sospeche.

---

## Fuentes

Verificadas durante la investigación (12–13 sep 2026). **F** = foro/comunidad. Las fechas de
threads se estimaron desde el "hace N meses" del sitio a la fecha de consulta.

### 2026, junio–septiembre

1. **MCP App Tool Results: content, structuredContent, and _meta** — https://sunpeak.ai/blogs/mcp-app-tool-results-content-structuredcontent-meta/ — 6 sep 2026 — El contrato de tres canales: datos para el modelo vs datos para la UI vs runtime; tabla de consumidores por canal.
2. **Streaming Agents with Pydantic AI over Typed WebSockets** (HackerNoon) — https://hackernoon.com/streaming-agents-with-pydantic-ai-over-typed-websockets-tools-approvals-and-a-generated-client — 7 sep 2026 — La respuesta final como objeto validado (`TextAnswer` + `follow_ups` → chips en la UI): structured output como contrato de presentación.
3. **Tool Rendering & Content Blocks — agent-insight-board** (DeepWiki) — https://deepwiki.com/kittsai/agent-insight-board/3.2-tool-rendering-and-content-blocks — 29 jul 2026 — Render por bloques tipados de sesiones de agentes Claude: dispatcher por tipo, razonamiento colapsable, estados de error diferenciados.
4. **Streaming Response — Frontend Patterns** (Den Odell) — https://frontendpatterns.dev/streaming-response — 28 jun 2026 — Render de Markdown de LLM: solo pintar el prefijo estable, manejo de fences a medio cerrar; higiene de render aplicable sin streaming.
5. **Beyond Plain Text: Rich React Cards from AI Agent Tool Calls** (Next Wave Agentic) — https://nextwaveagentic.com/blog/rendering-rich-react-cards-from-ai-agent-tool-calls — 16 jun 2026 — Tools presentation-agnostic + registry front `datatype+intent → card`, fallback sin estados rotos.
6. **Frontend: Rich Cards and Streaming Responses** (Nitin Kumar Singh) — https://nitinksingh.com/posts/frontend-rich-cards-and-streaming-responses/ — 12 abr 2026, actualizado 2 sep 2026 — La pieza más aplicable: cards desde respuestas crudas "sin modificar los agentes backend"; `parseContent()` en cadena de prioridad con early returns y crudo como piso.

### 2026, enero–mayo

7. **F · Show HN: A new benchmark for testing LLMs for deterministic outputs** — https://news.ycombinator.com/item?id=47950283 — may 2026 (60 pts, 30 com.) — Brecha 20–30% entre JSON schema-válido y valores correctos; "valid but incorrect data is what actually reaches production".
8. **LLM Structured Outputs: JSON Schema Enforcement and Tool Calling Reliability** (eastondev) — https://eastondev.com/blog/en/posts/ai/20260506-llm-structured-output/ — 6 may 2026 — Métricas de operación: fallo de formato >1% = alerta; qué errores reintentar y cuáles no; arquitectura validación+retry+constrained decoding.
9. **F · ChatGPT MCP Apps bridge drops custom _meta from tool results** (OpenAI Developer Community) — https://community.openai.com/t/chatgpt-mcp-apps-bridge-drops-custom-meta-from-tool-results-in-ui-notifications-tool-result/1378047 — mar–may 2026 — Drift de contrato del lado de la plataforma: canal documentado que desaparece; mitigación con claves opacas en `structuredContent`.
10. **F · LLM Structured Outputs Handbook** (HN sobre Nanonets) — https://news.ycombinator.com/item?id=46635309 — feb 2026 (377 pts, 64 com.) — Constrained decoding vs "generar libre y estructurar después"; la restricción puede degradar razonamiento; retry simple suele alcanzar.
11. **LLM Structured Output in 2026: Stop Parsing JSON with Regex** (DEV, HK Lee) — https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk — 12 feb 2026 — Tres niveles de confiabilidad; "validation sandwich" (schema + reglas de negocio); seis modos de falla del parseo manual.
12. **F · Structured outputs create false confidence** (HN sobre BoundaryML) — https://news.ycombinator.com/item?id=46345333 — ene 2026 (155 pts, 66 com.) — JSON válido con valores equivocados (0.4 bananas); consenso: validación semántica aparte del schema; enfoque dos pasos.
13. **AI content labeling rules: Article 50 AI Act** — https://www.aiactblog.nl/en/posts/article-50-practical-labeling-detection — 2026 — Desde el 2 ago 2026 la UE exige marcar contenido generado por IA (visible + C2PA): la convención de procedencia declarada.
14. **Evidence Review (2026): Code-Based BI With SQL** (Modern DataTools) — https://www.modern-datatools.com/tools/evidence — 2026 — BI-as-code: SQL = verdad, Markdown+componentes = forma; para equipos que ya poseen la capa semántica.

### 2024–2025

15. **F · A2UI: A Protocol for Agent-Driven Interfaces** (HN) — https://news.ycombinator.com/item?id=46286407 — dic 2025 (164 pts, 75 com.) — Escepticismo fundado sobre UI emitida por agentes (latencia, estado, inyección); preferencia por componentes propios + datos tipados.
16. **F · How are you handling malformed JSON / structured outputs from LLMs in production?** (Reddit) — https://www.reddit.com/comments/1shf5ed/ — nov 2025 (snapshot verificado abr 2026) — Práctica real de producción: escalera de reparación en 3 tiers (regex/fences → parcheo estructural → reparación con LLM) detrás de cualquier structured output.
17. **Anthropic boosts Claude API with Structured Outputs** (tessl.io) — https://tessl.io/blog/anthropic-brings-structured-outputs-to-claude-developer-platform-making-api-responses-more-reliable — nov 2025 — Cierre de la brecha de proveedor: salida tipada nativa en Claude (public beta).
18. **LLM Output Drift: Cross-Provider Validation & Mitigation for Financial Workflows** — https://arxiv.org/html/2511.07585v1 — nov 2025 — Drift de salida entre versiones/proveedores medido en flujos regulados; por qué el monitoreo continuo es parte del contrato.
19. **What I learned building a real-time streaming interface with structured output** (Level Up Coding) — https://levelup.gitconnected.com/what-i-learned-building-a-real-time-streaming-interface-with-structured-output-69f674052fa6 — 18 dic 2025 — `responseSchema` + parser parcial en el front: la UI mapea objetos, no parsea prosa.
20. **Product-Specific GenAI Needs to Write for the Web** (NN/g, Taylor Dykes) — https://www.nngroup.com/articles/genai-write-for-the-web/ — 4 abr 2025 — Evidencia de usuarios: respuesta primero y explicación después; concisión y formato escaneable para salida de IA embebida en producto.
21. **Best practices to render streamed LLM responses** (Chrome Developers) — https://developer.chrome.com/docs/ai/render-llm-responses — 21 ene 2025 — Tratar salida de LLM como contenido no confiable: DOMPurify/sanitize-html + parser de Markdown apropiado.
22. **Bulletproofing LLM Structured Output in Python** (DEV, N. Srivastava) — https://dev.to/velsof/bulletproofing-llm-structured-output-in-python-healing-retries-cost-caps-and-drift-detection-c89 — 2025 — Drift detector concreto: parse compliance + Z-score sobre distribución de campos en ventana deslizante; healing retries con el error de validación en contexto.
23. **The Intl.Segmenter object is now part of Baseline** (web.dev, Rachel Andrew) — https://web.dev/blog/intl-segmenter — 16 abr 2024 — Segmentación por oración con reglas de locale en los tres motores (Chrome/Edge 87+, Safari 14.1+, Firefox 125+): sin polyfill en 2026.
24. **Intl.Segmenter** (MDN) — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter — vivo (consultado sep 2026) — Referencia de granularidades y soporte; base del lead extraction seguro en español.
25. **Data Contracts for AI Agent Pipelines: A Field Guide** (Digital Applied) — https://www.digitalapplied.com/blog/data-contracts-for-ai-agent-pipelines — 2025 — Contratos en cada handoff; ODCS 3.1 (versionado + dueño); cuándo contratar un schema y cuándo es prematuro.
26. **The Insights Platform and Insight Types in Tableau Pulse** — https://help.tableau.com/current/online/en-us/pulse_insights_platform_insight_types.htm — vivo (consultado sep 2026) — Catálogo cerrado de 14 insight types; hechos estadísticos deterministas como verdad base, LLM solo redacta.
27. **Create Smart Narrative Summaries** (Microsoft Learn) — https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-smart-narrative — vivo — Narrativa como plantilla con valores dinámicos que se recalculan del modelo semántico: el texto referencia, no guarda, el número.
28. **Introduction to Portable Text** (Sanity) — https://www.sanity.io/guides/introduction-to-portable-text — vivo — Texto rico como JSON tipado agnóstico de presentación: el patrón headless para narrativas.
29. **Structured content for AI: Why content architecture is the foundation** (Contentful) — https://www.contentful.com/blog/structured-content-ai/ — 2025 — Campos tipados + metadatos separan significado de presentación; un modelo, múltiples salidas.
30. **F · Using Views, Triggers & Functions Instead of Complex Client Code** (Supabase, discusión oficial) — https://github.com/orgs/supabase/discussions/8452 — ago 2022 — Validación del equipo Supabase del patrón "cliente delgado": lógica en la base, cliente simple.
31. **Database Advisors: security_definer_view** (Supabase Docs) — https://supabase.com/docs/guides/database/database-advisors?lint=0010_security_definer_view — vivo — El gotcha de las vistas para el front: crear `WITH (security_invoker = true)` o la vista saltea RLS.
32. **Inverted Pyramid: Writing for Comprehension** (NN/g, Amy Schade) — https://www.nngroup.com/articles/inverted-pyramid/ — 11 feb 2018 — La base editorial del lead: la conclusión primero; por eso la primera oración es un resumen legítimo.

**Complementarias citadas en el cuerpo:** [Read et al., *Sentence Boundary Detection: A Long
Solved Problem?* (COLING 2012)](https://aclanthology.org/C12-2096.pdf) — límites de la
segmentación por reglas (abreviaturas); [arXiv 1912.11602](https://arxiv.org/pdf/1912.11602) —
fuerza de la baseline lead por sesgo de pirámide invertida;
[Tetrate, *LLM Output Parsing Guide*](https://tetrate.io/learn/ai/llm-output-parsing-structured-generation) —
degradación elegante como estrategia; [dbt Semantic Layer](https://www.getdbt.com/product/semantic-layer) —
métrica definida una vez; [Shape of AI, *Disclosure*](https://www.shapeof.ai/patterns/disclosure)
y [Carbon for AI](https://carbondesignsystem.com/guidelines/carbon-for-ai/) — patrones de
procedencia; [techsy.io](https://techsy.io/en/blog/llm-structured-outputs-guide) — schemas
chicos; [LogRocket](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/)
e [IxDF](https://ixdf.org/literature/topics/progressive-disclosure) — progressive disclosure;
[dev.to/datadeer](https://dev.to/datadeer/postgres-views-the-hidden-security-gotcha-in-supabase-ckd) —
security_invoker; [Evidence.dev](https://evidence.dev/) — BI as code;
[Leanware](https://leanware.co/insights/llm-monitoring-drift-detection-guide) — monitoreo de drift.
