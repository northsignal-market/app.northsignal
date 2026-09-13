# 07 · Data-to-text: la lectura del plan de la semana, generada sin LLM en el cliente

**Investigación frontend · NorthSignal**
Fecha: 13 de septiembre de 2026.
Método: 37 fuentes abiertas leídas en la web con contenido sustancial (WebFetch/Exa) — numeradas 1–37 — más 11 complementarias leídas solo desde resultados de búsqueda con contenido sustantivo (38–48, marcadas como tales). 18 fuentes son de 2026 y 8 caen en la ventana junio–septiembre de 2026. Ocho vienen de foros o comunidad: Microsoft Fabric Community (×3), Hacker News, GitHub Discussions, dev.to, y dos piezas de práctica en Medium/LinkedIn. Nota honesta de método: Reddit bloquea el fetch anónimo desde este entorno (old.reddit y www.reddit devuelven error); la cuota de foros se cubrió con los foros donde efectivamente viven las quejas de estos productos — Fabric Community es *el* foro de Power BI — y con HN vía la API de Algolia. Ninguna fuente citada es inventada; las que no se pudieron leer completas están marcadas.

**El eje:** el back manda el plan de la semana como estructura — indicadores con serie diaria de `cumple: true/false/null`, umbral, dirección, qué habilita cada uno; hipótesis con movimientos que confirman o descartan; un campo `contexto` de texto libre escrito por el agente. El front tiene que producir la lectura ("2 de 3 indicadores cumplen hace ≥2 días; si X aguanta 1 día más se habilita Y; quedan 4 días") **determinísticamente**, sin LLM en el cliente y sin tocar los prompts del agente. La pregunta investigada: qué dice la literatura y qué hacen los productos de analítica en 2024–2026, y cómo se implementa eso bien en React/TS.

---

## Resumen ejecutivo — las 8 tesis que dejó la investigación

1. **El consenso 2024–2026 es una arquitectura de dos capas con una frontera nítida: los hechos se calculan, el lenguaje solo los expresa.** Arria lo dice literal en julio de 2026: *"deterministically calculates the truth first and then communicates that truth in language"*; *"the language layer has no power to alter the findings: it can only express them"* [8]. Tableau Pulse tiene la misma frontera: un servicio estadístico genera hechos, y el LLM solo redacta *sobre* esos hechos anclados [9]. Para el caso NorthSignal, donde las frases son cortas y el dominio cerrado, la segunda capa tampoco necesita LLM: alcanza con plantillas tipadas.
2. **La literatura es unánime: para cifras, plantillas.** Reiter (la referencia canónica del campo): los LLM sirven para redactar, no para analizar; en producción las empresas de data-to-text **volvieron** a métodos establecidos por confiabilidad [1][3]. El survey académico de 2025: los enfoques de reglas/plantillas *"siguen siendo la solución más confiable... porque no sufren alucinación"* [45]. Hasta el mejor sistema híbrido publicado (KAHAN, EMNLP 2025) reporta 98,2% de factualidad [6] — un 1,8% de frases equivocadas que en este sistema sería inaceptable: acá el modo de falla que mata es el número verosímil y equivocado.
3. **Las quejas reales de usuarios de narrativas LLM no son de fluidez: son de control.** El formato cambia solo cuando Microsoft actualiza el modelo y el autor no puede fijarlo [38]; la narrativa Copilot no aparece en PDF ni en suscripciones de mail (*"it kind of defeats the purpose"*) [20]; la calidad depende de metadata del modelo semántico (*"poor metadata = generic or inaccurate output"*) [19]; no se puede editar el cuerpo generado [17]. Un texto de plantilla renderizado en el cliente no tiene **ninguno** de esos problemas.
4. **El patrón dominante de presentación es titular-veredicto + evidencia debajo.** "Tu audiencia nunca debería tener que adivinar el mensaje": el takeaway va en palabras, como título activo, y los números que lo sostienen van abajo [37][44]. Pulse lo implementa como tarjeta de insight (frase arriba, chart y hechos abajo) [9][11]; Power BI como resumen ejecutivo arriba del dashboard [24].
5. **El lenguaje calibrado se resuelve con una tabla cerrada verbo↔tipo-de-hecho, no con matices redactados.** La tradición de *words of estimative probability* (Kent, CIA) muestra que las palabras de probabilidad se malinterpretan si no están calibradas [42][43], y un paper de febrero de 2026 muestra que los LLM las interpretan *peor* que los humanos, sobre todo fuera del inglés [7] — una razón más para que el veredicto lo elija código y no un modelo. Regla operativa: "cumple" (hecho), "viene cumpliendo" (racha en curso), "si aguanta 1 día más" (condicional explícito), "llegaría a ~X" (proyección, siempre en condicional), nunca "va a cumplir".
6. **Proyectar solo run-rate simple y con guardas; si las guardas no pasan, decir que no se proyecta.** Amplitude verbaliza sus forecasts con ventana + confianza + rango, nunca punto seco: *"Based on the trend from the last 120 days... we're 95% confident that this metric is between [alto] and [bajo] on [fecha]"* [26]. Mixpanel valida la anomalía con z-score y estacionalidad **antes** de escribir una palabra [27]. Y la crítica más fresca a Pulse (agosto 2026) es exactamente por comparar períodos que no corresponden: agosto contra julio en un negocio estacional — *"previous-period comparisons are misleading"* [14]. La salida "no se puede proyectar todavía" es una frase de primera clase del catálogo.
7. **Para es-AR alcanza la plataforma: `Intl.PluralRules`, `Intl.RelativeTimeFormat`, `Intl.NumberFormat`.** MessageFormat 2.0 quedó estable en CLDR 47 (marzo 2025) [33] pero su adopción en mayo de 2026 sigue siendo marginal (~10 descargas semanales del plugin de i18next contra 300.000 del de MF1) y la recomendación explícita es no migrar todavía [34]. RosaeNLG — la única librería NLG seria del ecosistema JS, con español completo — fue **deprecada en marzo de 2026** por falta de comunidad [36]: la práctica viable en 2026 es escribir sentence builders TS propios sobre `Intl`, no adoptar maquinaria NLG genérica.
8. **El catálogo de frases chico, con funciones tipadas y snapshot tests, es el control de calidad — y hay hasta un patrón para autoría asistida.** Lango & Dušek (diciembre 2025) demuestran que agentes LLM pueden *escribir* un generador determinístico de reglas en build-time, que corre instantáneo en CPU y reduce alucinación [5]: el LLM ayuda a redactar el builder **offline**, el runtime queda 100% determinístico y auditable. Los snapshots de frases funcionan como catálogo revisable en cada PR [31][46][47].

---

## Tema 1 · Plantillas vs LLM: lo que dice la literatura (y el mercado)

### La posición de Reiter, que sigue siendo el mapa del territorio

Ehud Reiter (Aberdeen, cofundador de Arria, autor del pipeline clásico de NLG) mantiene el blog canónico del campo. Tres posts arman el argumento completo:

- **"LLMs and Data-to-text" (jun 2023)** [1]: los LLM rinden bien en *microplanning* y *surface realization* — elegir palabras y armar la oración — en tareas cortas. Donde fallan: **analítica e insight extraction** (eso debe hacerlo un sistema aparte que alimente hechos estructurados), textos largos (más alucinaciones y omisiones), y control. Caveats de producción que enumera: costo/latencia, controlabilidad de marca vía prompt "no siempre directa", y **errores en idiomas no ingleses incluso de alto recurso — cita puntualmente errores de puntuación en español**. Para NorthSignal, que escribe en castellano rioplatense, ese último punto no es teórico.
- **"The latest/trendiest tech isn't always appropriate" (ago 2024)** [3]: la historia se repitió tres veces (LSTM, transformers, LLMs) y en todas el enfoque híbrido simbólico superó al neuronal puro para data-to-text. El dato de mercado: *"commercial companies abandoned LLM approaches for data-to-text entirely, reverting to established methods"* por requisitos de confiabilidad con base de usuarios amplia.
- **"Maintaining NLG Systems" (oct 2024)** [2]: el costo dominante de un sistema NLG en producción es el mantenimiento — adaptarse a datos nuevos, casos nuevos, pedidos de clientes. Mantener un sistema de reglas es *"conceptualmente similar a mantener cualquier otro software"*; mantener un sistema LLM agrega problemas propios: no se puede testear un black-box estocástico con la misma disciplina, y el modelo cerrado **evoluciona por debajo tuyo** sin aviso. (Esto se materializa tal cual en las quejas de Power BI del Tema 7: el formato de la narrativa cambia cuando Microsoft actualiza el modelo, sin que el autor haya tocado nada [38].)

El survey académico de NLG de marzo de 2025 lo condensa en una frase que sirve de vara: los enfoques clásicos de reglas y plantillas *"siguen siendo la solución más confiable para generación de texto standalone, porque no sufren alucinación"*; los neuronales producen texto fluido pero no siempre fáctico [45 — complementaria]. Y sobre la definición misma de alucinación, Reiter advierte en septiembre de 2025 que ni siquiera es un concepto simple de medir [4] — otra razón para no meterse en el problema cuando se puede no tenerlo.

### El dato de 2026: los vendors de NLG determinística se reposicionaron, no se rindieron

Arria NLG — el producto comercial de referencia del data-to-text determinístico — lanzó en **julio de 2026** su plataforma "Arria Intelligence" apuntando explícitamente a la *"fatal flaw (unreliability) preventing enterprise adoption of agentic AI language automation"* [8]. La arquitectura que venden es exactamente la frontera de la tesis 1: motor determinístico calcula, capa de lenguaje expresa, y si se quiere un LLM se lo pone **después**, gobernado, para parafrasear texto ya fáctico. Las citas clave del anuncio:

> *"If you want to say something true about data, you must first compute the truth and then express it in language."*
> *"100% factually accurate, 100% of the time: the same data always producing consistent facts, with every sentence traceable to source."*

El caso de uso que esgrimen es finanzas regulada: un comentario de fondo que le erra a un retorno por décimas puede ser una infracción regulatoria. La analogía con BHI (regulación CMF, nada de copy generado automáticamente) es directa.

Del lado académico reciente, dos papers marcan el estado del arte:

- **KAHAN (EMNLP 2025)** [6]: narración financiera jerárquica (entidad → pares → grupo → sistema) usando LLMs como "expertos de dominio" sobre análisis estructurado. Gana 20% en calidad narrativa y reporta **98,2% de factualidad**. Leído al revés: el mejor sistema publicado con LLM en el loop escribe ~1 frase equivocada cada 55. Para un producto donde Andrés reenvía reportes a clientes, ese error rate define la decisión: el LLM no toca cifras.
- **Lango & Dušek (dic 2025)** [5]: agentes LLM que **escriben código Python de generación basado en reglas** — sin training, interpretable, corre "casi instantáneo en una sola CPU" y *reduce alucinación* con penalidad mínima de fluidez. Es el patrón exacto que le sirve a NorthSignal: usar el LLM en build-time como asistente para redactar/extender el catálogo de builders, y que el runtime del front quede determinístico, testeado y auditable.

**Y la contra-señal honesta:** RosaeNLG, la librería NLG open-source del ecosistema JS (plantillas Pug, español con concordancia y género completos, render en browser), fue **archivada/deprecada en marzo de 2026** — comunidad quieta, sin soporte corporativo, y competencia de los LLM "que requieren menos configuración" [36]. Lectura correcta de las dos señales juntas: los LLM se comieron la categoría "librería NLG genérica para developers", pero los **productos** que reportan cifras a usuarios finales (Arria, Pulse, los modos determinísticos de Power BI) mantuvieron o reforzaron la capa determinística. Para un dominio cerrado como el plan de la semana, la maquinaria lingüística genérica de RosaeNLG (género, concordancia, sinónimos) no hace falta: las frases se escriben enteras por variante.

---

## Tema 2 · Cómo lo hacen los productos hoy (2024 → septiembre 2026)

### Power BI: dos modos que son exactamente las dos filosofías

El visual de narrativa de Power BI tiene hoy dos modos, documentados en abril de 2026 [16]:

- **Modo custom (el smart narrative "viejo", determinístico):** el autor escribe las frases a mano con **valores dinámicos** atados a medidas y campos, y **texto condicional** — literalmente `"If [Growth] > 0 then 'increased' else 'decreased'"` [24]. Genera hasta 4 resúmenes por visual y 16 por página con heurísticas fijas [16]. Es un sentence builder de producto masivo, y es la razón por la que el patrón que este informe recomienda no es exótico: Power BI lo vende hace años.
- **Modo Copilot (LLM):** resume el reporte con prompts (límite 10.000 caracteres desde abril 2026); requiere licencia Copilot; por defecto para quien la tiene [16].

Las limitaciones documentadas del modo Copilot, de la propia doc de Microsoft [17]: **no se puede editar el cuerpo generado** (solo re-promptear, o copiar y pegar el texto al modo custom para editarlo — o sea: el escape hatch oficial es volver al determinístico); hay que **refrescar manualmente** el resumen cuando cambia un filtro; solo considera lo que la selección de visuales permite. A eso se suman las fallas reportadas en foros (Tema 7): no renderiza en PDF/mail/embed público [20], el formato de salida cambia solo cuando Microsoft actualiza el servicio [38], y depende de que el modelo semántico tenga descripciones en medidas y columnas [19].

Movimiento de fondo: Microsoft **deprecó Q&A** — su NLQ legacy con schema lingüístico configurable — anunciado el 1/12/2025, retiro total en diciembre de 2026, consolidando todo lo conversacional en Copilot [18]. La dirección del vendor es más LLM, no menos; y las quejas de la base de usuarios son de pérdida de control. Las dos cosas a la vez.

### Tableau Pulse: la arquitectura insight → NL más instructiva del mercado

Pulse es el mejor caso de estudio porque su arquitectura está documentada con la frontera explícita [9]:

1. **Metrics layer**: definición gobernada de la métrica (con ventana, comparación, dimensiones).
2. **Insights platform**: un **servicio estadístico determinístico** corre el análisis y genera *hechos* sobre la métrica. Hay **13 tipos de insight cerrados**: period-over-period change, correlated metrics, record-level outliers, forecast, current trend, trend change alert, unexpected values, goal & threshold breakdown, **pace to goal**, top drivers, top detractors, concentrated contribution alert, top/bottom contributors [9].
3. **Capa de lenguaje**: los hechos más relevantes se pasan como *ground truths* al LLM, que solo redacta el resumen [9].

Lo relevante para NorthSignal no es el LLM final (que Pulse necesita porque su dominio es abierto — cualquier métrica de cualquier cliente); es que **el catálogo de tipos de insight es cerrado y chico**. Trece tipos. Cada tarjeta es un tipo de hecho con su plantilla de presentación. Un dominio cerrado como el plan de la semana puede saltarse el LLM y quedarse con la parte buena: catálogo cerrado de hechos → catálogo cerrado de frases.

**Pace to Goal (enero 2026) es exactamente el "plan de la semana" de Tableau:** para métricas con objetivo, Pulse dice si la métrica *"is expected to meet its goal by the end of the current period"*, con estado **on track / off track escrito**, y la línea de forecast en verde o rojo (requiere Tableau+) [10][13]. La evolución 2026 siguió: digests por Microsoft Teams y tags (agosto 2026), agente con GPT-5.2 (julio 2026) [10]. Un practicante lo resume: *"la feature que va a sacar a los ejecutivos de los hilos de mail preguntando '¿vamos bien?'"*, con la advertencia de que las iniciativas Pulse mueren cuando la capa de métricas no está acordada — *"governance before glamour"* [13].

**Las críticas frescas (agosto 2026) le pegan al motor de hechos, no a la redacción** [14][15]: un análisis detallado de una empresa con calendario fiscal custom encontró que Pulse comparaba el mes actual contra *el mes completado más cercano* (agosto vs julio) en vez del mismo mes del año anterior — crecimiento sospechosamente fuerte, en un negocio estacional; el agente ignoraba el calendario fiscal; conclusión de la autora: *"the AI experience becomes unreliable in the exact scenario where business users need it to be clear"* [14]. Y los analistas de industria (TechTarget, ago 2026) posicionan a Pulse como necesario pero no diferencial: *"keeping pace with its competitors rather than pacing the market"* [15]. Un comparador de junio 2026 lo formula útil: Pulse es *"a strong notification layer, not a complete AI analytics operating layer"*, y las empresas que lo abandonan piden **profundidad de auditoría** — ver la cadena de ejecución, no solo el resultado [12]. Moraleja doble para NorthSignal: (a) el valor está en la capa de notificación/lectura — que es exactamente lo que se está construyendo; (b) la credibilidad muere por comparaciones temporales mal elegidas, no por la prosa.

### Amplitude y Mixpanel: los que escriben con guardas estadísticas

- **Amplitude — Anomaly + Forecast** (la base determinística) [26]: detección con Prophet, banda de confianza visible, tres modos (Agile 95%/120 días, Robust 1 año para estacionalidad, Custom). Lo más citable es el **fraseo**: *"Based on 120 days of training data, this data point represents an unexpected change with 95% confidence"*; y para forecast: *"Based on the trend from the last 120 days of data, we're 95% confident that this metric is between [alto] and [bajo] on [fecha]"*. Ventana + confianza + **rango** (nunca punto). La doc admite el supuesto: Prophet asume que el tamaño y frecuencia de los cambios pasados se mantienen — si el patrón no persiste, el forecast no vale [26].
- **Amplitude — Automated Insights** (dic 2025, la capa agéntica) [25][41]: un agente que investiga anomalías encadenando tool calls (mira el chart, busca experimentos y releases del período, junta anotaciones) y escribe hallazgos **citando fuentes** para que el usuario verifique. Notable: ni el blog de lanzamiento detalla mecanismos anti-alucinación [25] — la verificabilidad descansa en las citas.
- **Mixpanel — Root Cause Analysis** [27]: pipeline de 4 pasos con la validación **antes** que la prosa: (1) valida que la anomalía sea real con z-score y chequeos de estacionalidad, (2) elige propiedades a analizar, (3) corre los breakdowns, (4) escribe interpretación con **nivel de confianza explícito (High/Medium/Low)** y contribución porcentual por segmento. El LLM elige breakdowns y redacta, pero no puede declarar anomalía: eso lo decide la estadística. Límites operativos claros (runs/día por plan; el agente V0 no ve anotaciones ni experimentos) [27].

### Metabase y Grafana: los que eligieron no narrar

- **Metabase — X-rays**: exploración automática que genera **solo charts**, cero texto narrativo [29]. La IA (Metabot) es un asistente aparte, opt-in. Elección de producto legítima: si no podés garantizar el texto, no lo generes.
- **Grafana** (GrafanaCON, abril 2026) [28]: todo el empuje 2026 es el **Assistant** conversacional (investigar incidentes, armar dashboards por prompt, ahora también self-hosted) y observabilidad *de* sistemas de IA (AI Observability, benchmark o11y-bench). No hay narrativa automática de dashboards como feature central: el texto aparece en el chat, bajo demanda. La cita de su directora de producto aplica al problema general: *"AI systems are starting to look a lot like distributed systems did a decade ago: powerful, but difficult to reason about and even harder to operate"* [28].

**Síntesis del panorama de productos:** nadie serio deja que un modelo calcule; los que narran con LLM lo hacen sobre hechos pre-calculados y aún así acumulan quejas de control y confianza; los modos determinísticos (custom mode de Power BI, tarjetas de insight tipadas de Pulse, el fraseo con guardas de Amplitude) son la parte que los usuarios citan como confiable. El front de NorthSignal puede tomar la arquitectura de Pulse (hechos tipados → frases) sin su capa LLM, porque su dominio es cerrado y su catálogo cabe en un archivo.

---

## Tema 3 · El patrón "headline + evidencia" y el lenguaje calibrado

### El titular es un veredicto calculado, no una descripción

La regla de storytelling with data (2017, todavía canónica): *"Your audience should never have to guess what message you want them to know"* — título activo con el takeaway, el punto en palabras, y la evidencia debajo guiando del texto al dato [37]. La progresión de Depict Data Studio: de "Q3 Revenue by Region" a "Western Region Grew 40% — Double the Company Average" [44]. Pulse renderiza exactamente eso: frase-veredicto arriba, chart y hechos abajo, con preguntas de profundización [9][11]. Y la evidencia de práctica en Power BI: el resumen ejecutivo textual arriba del dashboard es el uso #1 del smart narrative — *"they'll use written text before they'll interpret a chart"* [24].

Para el plan de la semana esto se traduce en una estructura fija de tres niveles:

1. **Titular** (1 frase, elegida por prioridad determinística): el estado del plan hoy.
2. **Soportes** (1–3 frases cortas): los números que sostienen el titular — cada uno trazable a un campo de la estructura.
3. **Detalle plegado**: la serie diaria, las hipótesis, y el `contexto` libre del agente **rotulado como tal** ("Nota del agente · texto libre · [fecha]") — el front lo muestra, no lo respalda.

La regla de la casa ("el radio de la acción tiene que ser el radio de la evidencia") tiene acá su versión de redacción: **el titular no puede afirmar más que lo que los soportes muestran.** Si 2 de 3 indicadores cumplen, el titular dice eso — no "la semana viene bien", que es un juicio de nivel semana sobre evidencia de nivel indicador.

### Lenguaje calibrado: la tabla cerrada le gana al matiz redactado

La tradición de *words of estimative probability* (Sherman Kent, CIA) existe porque las palabras de probabilidad sin calibrar se malinterpretan: "probable" significa cosas distintas para cada lector, y por eso inteligencia, medicina y clima usan escalas fijas palabra↔rango numérico [42][43]. Dos hallazgos recientes cierran el argumento para este producto:

- Un estudio en *npj Complexity* (feb 2026) midió cómo los LLM interpretan esas palabras: **divergen de las estimaciones humanas** salvo en algunos casos en inglés, y más en contextos con género y en chino; GPT-4 falla mapeando expresiones estadísticas a la palabra adecuada [7]. Es decir: ni siquiera delegando la elección del matiz a un LLM se obtiene calibración — la elección del verbo es una decisión de diseño, y se fija en una tabla.
- La comunidad de práctica de Power BI llegó sola a la misma conclusión por el camino del dolor: cuando el texto lo escribe el modelo, el tono y la asertividad flotan con cada release del servicio [38].

**La tabla de verbos para el plan de la semana** (cerrada, en el código, con test):

| Tipo de hecho | Verbo/forma permitida | Prohibido |
|---|---|---|
| Hecho consumado (día cerrado, gasto) | "cumplió", "quedó fuera" | — |
| Estado presente con datos completos | "cumple", "viene cumpliendo hace N días" | "está ganando" |
| Dato inmaduro (conversiones recientes; atribución al día del clic) | "lleva N hasta ahora (el dato aún madura)" | cualquier veredicto |
| Condición futura definida por regla | "si mañana también cumple, se habilita Y" | "va a habilitar" |
| Proyección run-rate (solo si pasan las guardas del Tema 4) | "al ritmo de los últimos N días llegaría a ~X" | "va a llegar", "alcanzará" |
| Sin dato (`cumple: null`) | "sin dato desde el [día] — no es cero" | tratarlo como false o como 0 |
| Sin base para afirmar | "con estos datos no se puede saber" | rellenar |

El condicional castellano ("llegaría", "quedaría") es la herramienta de calibración natural del rioplatense y cuesta cero: es morfología, no cualificadores pegados. "Va camino a cumplir" solo se usa cuando existe una proyección válida **y** el margen sobre el umbral supera una banda mínima; si la proyección cruza el umbral por menos de esa banda, la frase es "al límite: la proyección queda pegada al umbral" — el empate se declara, no se redondea para el lado optimista.

---

## Tema 4 · Deltas, rachas y proyecciones: reglas de redacción

Síntesis de las prácticas observadas (fraseo de Amplitude [26], pace-to-goal de Pulse [10][13], mecánica run-rate discutida en los foros de Fabric [—ver 48 en fuentes], crítica de estacionalidad [14]) más las reglas propias del dominio NorthSignal (datos direccionales, conversiones que maduran, atribución al día del clic):

**Cumplimiento "X de N":**
- El denominador siempre explícito: "2 de 3 indicadores", nunca "la mayoría". El lector de este producto decide plata con esa frase.
- Los `null` se descuentan del denominador del día y se dicen: "2 de 3 (el tercero sin dato hoy)". Un `null` contado como incumplimiento fabrica una crisis; contado como cumplimiento fabrica una señal. Las dos son el modo de falla que este sistema no se permite.
- El agregado de la semana se ancla en días, no en promedios: "cumplió 4 de los últimos 5 días" es verificable contra la serie a ojo; "80% de cumplimiento" no dice ni ventana ni cuenta.

**Rachas:**
- Racha se dice solo desde 2 días: "cumple hace 3 días". Un día no es racha, es un dato.
- Siempre con ancla doble: conteo + día de arranque cuando el espacio lo permite — "cumple desde el martes (3 días)". El conteo solo obliga al lector a hacer la cuenta; la fecha sola lo obliga a la inversa.
- Si el último día con dato no es hoy, la racha se ancla al último dato: "venía cumpliendo hace 3 días hasta el jueves; viernes sin dato". Nunca se extiende una racha por encima de un `null`.
- `Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' })` da gratis "ayer"/"anteayer"/"hace 3 días" bien formados [32 — y ver Tema 5].

**Proyecciones (run-rate) — cuándo sí:**
Solo si pasan **todas** las guardas, evaluadas en código:
1. Ventana con ≥7 días con dato (por debajo, el run-rate es ruido — y la ventana se pide con `ventana_metrica()`, nunca aritmética a mano: regla de la casa).
2. Sin `null` en los últimos 2 días de la serie usada.
3. La métrica no es de conversiones inmaduras (los días recientes maduran; Google atribuye al día del clic — proyectar sobre eso es proyectar sobre un número que va a cambiar).
4. Sin estacionalidad semanal fuerte sin corregir; si el negocio la tiene, se compara mismo-día-de-semana — la falla exacta que hizo poco confiable a Pulse en agosto de 2026 [14].

Cuando pasa: "al ritmo de los últimos 7 días llegaría a ~X el viernes" — condicional, ventana dicha, valor redondeado con `~`. Cuando no pasa: **"faltan días de dato para proyectar"** como frase del catálogo, no como ausencia silenciosa. Amplitude marca el estándar de honestidad del fraseo (ventana + confianza + rango) [26]; Mixpanel el de secuencia (validar antes de escribir) [27].

**Deltas:**
- Delta sin ventana no existe: "+18% vs los 7 días previos", nunca "+18%".
- Signo y dirección semántica separados: en un indicador donde bajar es bueno (CPA), "bajó 12% ✓" — el verbo lleva el número, el símbolo lleva el juicio. (El informe 01 ya fijó valor + delta + ventana y procedencia uniforme; este catálogo lo hereda.)
- El "gasto de ayer ya es definitivo; las conversiones no" se refleja en el verbo: gasto en pasado simple, conversiones con "lleva".

---

## Tema 5 · Internacionalización del catálogo: qué usar en 2026

El catálogo de NorthSignal es interno y monolocale (es-AR), con reportes al cliente en el idioma de su ficha (de-DE para KAREDO). Eso simplifica, pero las reglas de la plataforma conviene seguirlas igual, porque son las que evitan el `if (n === 1)` hardcodeado:

- **`Intl.PluralRules`** [32]: seis categorías CLDR (zero/one/two/few/many/other); el español usa `one`/`other` para lo cotidiano — y ojo: los charts de CLDR 48 le suman `many` al español para el caso de millones ("1 millón de..." / "2 millones de...") [39][40 — complementarias; la guía de locize de julio 2026 todavía lista es con one/other [35]]. La lección práctica no es memorizar la regla: es **preguntarle a la API** (`new Intl.PluralRules('es-AR').select(n)`) y tener las variantes `one`/`many`/`other` en el catálogo donde haya cifras grandes de plata. La regla de oro de la guía 2026: *"no podés expresar esto con `if (count === 1)`; las reglas son por idioma, no obvias, y las definen lingüistas"* [35].
- **`Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' })`**: "ayer", "hace 2 días", "dentro de 3 días" correctos y gratis. Con `numeric: 'always'` fuerza "hace 1 día" — para el plan conviene `auto` (dice "ayer").
- **`Intl.NumberFormat('es-AR')`** para separadores (12.400) y monedas por cuenta (CLP/EUR/USD) — ya adoptado por el informe 01 (redondeo agresivo, `tabular-nums`).
- **MessageFormat 2.0**: quedó **estable** en CLDR 47 (13/3/2025) con matching gramatical de plural y género, y funciones de formato integradas [33]. Pero el estado de adopción a mayo de 2026 es elocuente: el plugin MF2 de i18next tiene ~10 descargas semanales contra ~300.000 del de MF1; `Intl.MessageFormat` (TC39) sigue en Stage 2, trabado hasta que haya ~12 organizaciones usando MF2 en producción; la recomendación explícita del ecosistema es **quedarse en ICU MF1 o esperar** [34]. Para NorthSignal: no adoptar MF2; si algún día el catálogo se traduce, ICU MessageFormat clásico (formatjs/i18next) alcanza.
- **RosaeNLG**, la opción "NLG real en JS" (concordancia, género, español completo, render en browser), está **deprecada desde marzo de 2026** (archivada en LF AI tras validación de enero 2026; última versión 4.4.0 de dic 2024) [36]. No arrancar nada nuevo sobre ella.
- Principio de i18n que aplica aunque haya una sola locale: **frases enteras por variante, nunca cirugía de strings**. Concatenar fragmentos ("cumple" + " hace " + n + " días") rompe en cuanto una variante necesita otro orden, y produce catálogos inauditables. Cada variante es una frase completa en el código — que es también lo que hace legible el snapshot test [35][46].

Para los reportes en alemán de KAREDO, el mismo diseño escala: el catálogo es una función de `locale`, y `Intl.PluralRules('de-DE')` + frases de/DE por variante cubren el caso sin maquinaria nueva. Lo que no se hace es traducir con LLM en el cliente.

---

## Tema 6 · Implementación en React/TS: sentence builders tipados

### El patrón

Tres capas puras, testeables por separado, sin estado:

```ts
// 1 · HECHOS — derivación pura desde el contrato del back (sin formateo)
//     plan-lectura/hechos.ts
export type HechoPlan =
  | { tipo: 'cumplimiento_hoy'; cumplen: number; conDato: number; total: number }
  | { tipo: 'racha'; indicador: string; dias: number; desdeISO: string; vigente: boolean }
  | { tipo: 'a_un_paso'; indicador: string; diasQueFaltan: 1; habilita: string }
  | { tipo: 'desbloqueado'; indicador: string; habilita: string }
  | { tipo: 'sin_dato'; indicador: string; desdeISO: string }
  | { tipo: 'ventana'; diasRestantes: number }
  | { tipo: 'proyeccion'; indicador: string; valorProyectado: number; al: string;
      ventanaDias: number; margen: 'holgado' | 'al_limite' }
  | { tipo: 'sin_proyeccion'; indicador: string; motivo: 'serie_corta' | 'dato_inmaduro' | 'hueco_reciente' };

export function derivarHechos(plan: PlanSemana, hoy: string): HechoPlan[] { /* puro */ }
```

```ts
// 2 · FRASES — un builder por tipo de hecho; discriminated union agota el catálogo
//     plan-lectura/frases.ts
const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });
const pr  = new Intl.PluralRules('es-AR');

const dias = (n: number) =>
  pr.select(n) === 'one' ? `${n} día` : `${n} días`;

export function frase(h: HechoPlan): string {
  switch (h.tipo) {
    case 'cumplimiento_hoy': {
      const base = `${h.cumplen} de ${h.conDato} indicadores cumplen hoy`;
      return h.conDato < h.total
        ? `${base} (${h.total - h.conDato} sin dato — no es cero)`
        : base;
    }
    case 'racha':
      return h.vigente
        ? `${h.indicador} cumple hace ${dias(h.dias)}`
        : `${h.indicador} venía cumpliendo (${dias(h.dias)}) hasta ${diaCorto(h.desdeISO)}`;
    case 'a_un_paso':
      return `Si ${h.indicador} aguanta 1 día más, se habilita: ${h.habilita}`;
    case 'proyeccion':
      return h.margen === 'al_limite'
        ? `Al ritmo de los últimos ${dias(h.ventanaDias)}, ${h.indicador} quedaría al límite del umbral`
        : `Al ritmo de los últimos ${dias(h.ventanaDias)}, ${h.indicador} llegaría a ~${fmt(h.valorProyectado)} el ${diaCorto(h.al)}`;
    case 'sin_proyeccion':
      return MOTIVOS_SIN_PROYECCION[h.motivo](h.indicador); // frases fijas, no texto libre
    case 'ventana':
      return `Quedan ${dias(h.diasRestantes)} de la ventana`;
    // ... el switch sin default: si aparece un tipo nuevo, no compila hasta tener frase
  }
}
```

```ts
// 3 · LECTURA — titular por prioridad fija + soportes; ninguna frase se inventa acá
//     plan-lectura/leer.ts
export interface Lectura { titular: string; soportes: string[]; }

const PRIORIDAD: HechoPlan['tipo'][] = [
  'sin_dato',        // la lectura parcial se declara primero
  'desbloqueado',
  'a_un_paso',
  'cumplimiento_hoy',
  'ventana',
];

export function leerPlan(plan: PlanSemana, hoy: string): Lectura { /* ordena, arma, corta a 3 soportes */ }
```

Decisiones de diseño que la investigación respalda:

1. **El `switch` exhaustivo sobre discriminated union es el catálogo.** No hay tabla de strings suelta ni motor de plantillas: un tipo de hecho nuevo no compila hasta que tiene frase, y una frase no existe sin hecho que la respalde. Es la versión front del *"every sentence traceable to source"* de Arria [8].
2. **El titular se elige por prioridad determinística, no por "interés".** Los productos que puntúan interés (smart narrative elige "las cosas más interesantes" con heurísticas opacas [16]) generan la pregunta "¿por qué me muestra esto?". Una lista de prioridad fija en el código es explicable en una línea.
3. **El texto libre del agente (`contexto`) se pliega como detalle, rotulado.** El front no lo parsea, no lo resume, no lo mezcla con las frases calculadas: lo muestra como "Nota del agente · [fecha]" en el nivel 3. Así el determinismo del titular no queda contaminado y los prompts del agente no se tocan. Es la separación *presentación ≠ procedencia* que también recomienda la práctica evidence-governed [23].
4. **Las hipótesis se verbalizan sin veredicto propio.** "El movimiento de ayer es consistente con H1" solo si el back marcó esa relación; el front jamás infiere confirma/descarta desde las series — radio de evidencia otra vez. Si el estado no viene, la frase es "H1 sigue abierta; la confirma [movimiento] / la descarta [movimiento]".
5. **Autoría asistida, runtime determinístico.** Para extender el catálogo (frases nuevas, más variantes), el patrón Lango & Dušek [5]: pedirle a un LLM borradores del builder **en desarrollo**, revisarlos como cualquier PR, y que a producción llegue solo código TS testeado. El LLM nunca corre en el cliente.

### Tests: el snapshot es el catálogo auditable

```ts
// plan-lectura/leer.test.ts — matriz de fixtures con nombre; el snapshot ES la revisión de copy
const casos: Record<string, PlanSemana> = {
  todo_cumple_racha_3:      f({ cumplen: [1,1,1], rachas: [3,3,3] }),
  dos_de_tres_uno_null_hoy: f({ hoy: [true, true, null] }),
  a_un_dia_del_desbloqueo:  f({ indicadorX: { racha: 2, habilitaEn: 1 } }),
  nada_cumple_quedan_4:     f({ hoy: [false, false, false], diasRestantes: 4 }),
  serie_corta_sin_proyeccion: f({ diasConDato: 3 }),
  cero_indicadores:         f({ indicadores: [] }),
  racha_rota_por_hueco:     f({ serie: [true, true, null, true] }),
};
for (const [nombre, plan] of Object.entries(casos))
  test(nombre, () => expect(leerPlan(plan, HOY)).toMatchSnapshot());
```

- Práctica estándar del ecosistema i18n: snapshot para detectar cambios no intencionales de copy, y tests de paridad de claves entre locales si algún día hay más de una [31][46].
- Regla `no-large-snapshots` de eslint-plugin-jest: snapshots cortos y legibles, porque *"a stored snapshot is only as good as its review"* [47]. Un snapshot de `Lectura` (1 titular + ≤3 soportes) se lee entero en el diff del PR: **el review de copy y el review de código son el mismo acto.**
- Los casos borde obligatorios salen de las reglas de la casa: `null` ≠ 0, racha no salta huecos, denominador explícito, 0 indicadores no crashea, serie corta no proyecta. Cada bug de redacción que se encuentre suma su fixture — el equivalente front del "un ticket no cierra sin un control que atrape su regreso".

Presupuesto de catálogo: el plan completo se cubre con **~25–40 variantes de frase**. Si crece más que eso, es señal de que se está redactando lo que habría que calcular, o calculando lo que no se puede saber.

---

## Tema 7 · Qué dice la comunidad (con foco en los últimos meses)

**Las quejas, en orden de frecuencia y con fecha:**

1. **"No aparece donde lo necesito."** El hilo más ilustrativo de Fabric Community (ene 2025, con respuestas hasta marzo 2026): la narrativa Copilot no renderiza en PDF, suscripciones de mail ni web pública — *"it kind of defeats the purpose of having a copilot smart narrative option if no one can see it"*; el caso de uso muerto es exactamente el de NorthSignal invertido: gerencia que solo lee el PDF del mail [20]. El workaround aceptado por la comunidad: **volver a cajas de texto con medidas DAX** — o sea, al determinístico [20].
2. **"Cambia solo y no lo controlo."** El formato de salida de la narrativa Copilot varía aunque el prompt pida bullets; cuando Microsoft actualiza el servicio o el routing de modelos, el comportamiento cambia sin que el autor toque nada; el estilo lo controla el servicio hosteado, no el autor [38 — complementaria]. Es la queja de mantenimiento que Reiter predijo en octubre de 2024 [2].
3. **"Depende de metadata y licencias."** El hilo de mayo 2026 que evalúa si el visual Copilot "vale la pena": sí para dashboards de cliente, **pero** la calidad depende de descripciones en medidas/tablas/columnas (*"poor metadata = generic or inaccurate output"*), requiere capacidad F2 (~USD 262/mes), y con Q&A retirándose en diciembre 2026 "Copilot es obligatorio pronto" [19][18].
4. **Escepticismo de fondo sobre dashboards que nadie usa.** HN (feb 2024, 146 puntos, 121 comentarios): *"I can remember ONE decision that was sorta-adopted based on a dataviz"* tras años de inversión en Tableau [30]. La lectura para este producto: el texto-veredicto existe precisamente porque el chart solo no produce decisión — pero solo si el texto es confiable.
5. **La experiencia matizada de practicantes (ago–sep 2026):** un desarrollador BI documenta que la IA en Power BI brilla replicando patrones existentes (medidas en masa, formato condicional) y falla en lo creativo y en vibe-debugging — *"si la tarea es compleja pero hay un patrón que replicar, es el target perfecto para la IA"* [22]. Y una arquitectura evidence-governed para operar Power BI con agentes (dev.to, ago 2026) llega a los principios de la casa por otro camino: *"uncertainty deserves an explicit representation"*, y un sistema que puede decir *"I cannot establish this from the available evidence"* es más útil que uno que siempre contesta [23].

**Lo que la comunidad valora, en espejo:**
- El resumen textual arriba del dashboard como primera lectura ejecutiva — *"they'll use written text before they'll interpret a chart"* [24].
- Que el texto llegue al canal (digest por mail/Slack/Teams: Pulse lo expandió en agosto 2026 [10]; la falla de Power BI en ese mismo punto es la queja #1 [20]).
- El estado on-track/off-track **escrito** contra el objetivo (Pace to Goal, ene 2026): la feature señalada como la que responde "¿vamos bien?" sin abrir nada [13].
- Gobernanza de la métrica antes que la prosa: *"governance before glamour"* [13]; las iniciativas mueren por la capa de métricas, no por el texto.

---

## Tema 8 · El diseño recomendado para NorthSignal (síntesis operativa)

**Módulo `plan-lectura/` (front, puro, sin red):**

```
plan-lectura/
  hechos.ts     · derivarHechos(plan, hoy)   — HechoPlan[] (unión discriminada, 8-10 tipos)
  frases.ts     · frase(hecho)               — switch exhaustivo; ~25-40 variantes; Intl es-AR
  leer.ts       · leerPlan(plan, hoy)        — { titular, soportes[≤3] } por prioridad fija
  verbos.ts     · tabla verbo↔tipo-de-hecho  — la única fuente de asertividad
  guardas.ts    · puedeProyectar(serie)      — ≥7 días de dato, sin null reciente, no inmaduro
  leer.test.ts  · matriz de fixtures nombrados → snapshots cortos (el catálogo auditable)
```

**Las diez reglas del catálogo** (cada una con su fuente):

1. Hechos calculados, lenguaje que solo expresa — el LLM no corre en el cliente [8][9][1].
2. Titular-veredicto + ≤3 soportes trazables + detalle plegado [37][44][9].
3. Denominador siempre explícito; `null` se descuenta y se dice ("no es cero") [regla de la casa; 27].
4. Racha desde 2 días, con ancla temporal, nunca por encima de un hueco [26][32].
5. Verbos por tabla cerrada: pasado para lo definitivo, "lleva" para lo inmaduro, condicional para toda proyección [7][42][26].
6. Proyección solo con guardas; sin guardas, la frase es "faltan días de dato para proyectar" [26][27][14].
7. "Si X aguanta 1 día más, se habilita Y": condicional explícito con la condición dicha, jamás futuro asertivo [10][13].
8. Frases enteras por variante — nada de concatenar fragmentos [35][36].
9. `switch` exhaustivo sobre unión discriminada: frase nueva ⇔ hecho nuevo ⇔ el compilador lo exige [5][8].
10. Snapshot corto por fixture nombrado: el diff del PR es la revisión de copy [31][46][47].

**Salida ejemplo para el caso del brief** (2 de 3 cumplen hace ≥2 días, X a un día de habilitar Y, 4 días de ventana):

> **2 de 3 indicadores cumplen hace 2 días o más.**
> · Si CPA de Búsqueda aguanta 1 día más, se habilita: subir presupuesto del grupo ganador.
> · CTR cumple hace 4 días; impresiones, hace 2.
> · Quedan 4 días de la ventana.
> ▸ Nota del agente (texto libre · 12/9): "El lunes feriado en Chile puede pisar el volumen…"

Todo lo de arriba de la ▸ sale de la estructura, determinístico, testeado por snapshot. Lo de abajo es el `contexto` del agente, plegado y rotulado. Nada cambió en los prompts. Nada corre en un modelo. Y si mañana una frase miente, el bug se reproduce con un fixture y queda atrapado para siempre.

---

## Fuentes

**Leídas con contenido sustancial (1–37):**

1. LLMs and Data-to-text — Ehud Reiter — https://ehudreiter.com/2023/06/29/llms-and-data-to-text/ — 29/6/2023 — El mapa canónico: LLM para redactar, no para analizar; caveats de producción; errores en español.
2. Maintaining NLG Systems — Ehud Reiter — https://ehudreiter.com/2024/10/21/maintaining-nlg-systems/ — 21/10/2024 — Mantener reglas ≈ mantener software; mantener LLM agrega black-box estocástico y modelo que cambia por debajo.
3. The latest/trendiest tech isn't always appropriate — Ehud Reiter — https://ehudreiter.com/2024/08/26/the-latest-trendiest-tech-isnt-always-appropriate/ — 26/8/2024 — Tres olas (LSTM/transformers/LLM), mismo resultado: híbrido simbólico gana en data-to-text; empresas volvieron a métodos establecidos.
4. Blog Index — Ehud Reiter — https://ehudreiter.com/blog-index/ — consultado 13/9/2026 — Índice fechado; incluye "Defining hallucination is not straightforward" (10/9/2025).
5. LLM Agents Implement an NLG System from Scratch: Building Interpretable Rule-Based RDF-to-Text Generators — Lango & Dušek — https://arxiv.org/abs/2512.18360 — 20/12/2025 — Agentes LLM escriben generadores de reglas interpretables; runtime instantáneo en CPU; menos alucinación. El patrón "autoría asistida, runtime determinístico".
6. KAHAN: Knowledge-Augmented Hierarchical Analysis and Narration for Financial Data Narration — Yang, Deng & Kan — https://arxiv.org/abs/2509.17037 — sep 2025 (EMNLP) — Estado del arte híbrido: 98,2% de factualidad — es decir, 1,8% de error, inaceptable para cifras reenviables.
7. An evaluation of estimative uncertainty in large language models — npj Complexity — https://www.nature.com/articles/s44260-026-00070-6 — 2/2/2026 — Los LLM interpretan las palabras de probabilidad distinto que los humanos, peor fuera del inglés; el matiz del veredicto debe elegirlo código.
8. Arria Intelligence Addresses the Fatal Flaw (Unreliability)… — Arria NLG — https://www.arria.com/blog/arria-intelligence-addresses-the-fatal-flaw-unreliability-preventing-enterprise-adoption-of-agentic-ai-language-automation/ — 23/7/2026 — "Compute the truth first"; "the language layer has no power to alter the findings"; caso finanzas regulada.
9. The Insights Platform and Insight Types in Tableau Pulse — Tableau Help — https://help.tableau.com/current/online/en-us/pulse_insights_platform_insight_types.htm — consultado 13/9/2026 — La arquitectura de dos capas y los 13 tipos cerrados de insight (incl. Pace to Goal).
10. Tableau Pulse — release notes — https://help.tableau.com/current/online/en-us/pulse_intro.htm — consultado 13/9/2026 — Pace to Goal 8/1/2026 (on/off track escrito); Teams y tags 26/8/2026; agente GPT-5.2 2/7/2026.
11. Tableau Pulse: Let the Data Come to You — SVA Consulting — https://consulting.sva.com/insights/tableau-pulse-let-the-data-come-to-you — 14/4/2026 — El motor examina dimensiones, corre modelos y entrega frases en lenguaje natural a los canales; "what changed and should I care".
12. Best AI Data Visualization Tools: Tableau Pulse alternatives — InfiniSynapse — https://infinisynapse.com/en/blog/tableau-pulse-alternatives — 9/6/2026 — "Strong notification layer, not a complete AI analytics operating layer"; demanda de auditabilidad de la cadena.
13. Tableau just raised the bar for analytics teams — datacognify (LinkedIn) — https://www.linkedin.com/posts/datacognify_tableau-tableaupulse-snowflake-activity-7437257031520071680-2pmV — 10/3/2026 — Pace to Goal en la release de enero 2026; "governance before glamour".
14. Tableau Pulse: When Your Business Doesn't Fit the Metric — Kateryna (Medium) — https://drogaieva.medium.com/tableau-pulse-when-your-business-doesnt-fit-the-metric-2e878048842a — 29/8/2026 — Comparaciones de período engañosas (agosto vs julio), calendarios fiscales ignorados: la credibilidad muere en el motor de hechos.
15. As AI evolves, Tableau talks direction ahead of Dreamforce — TechTarget — https://www.techtarget.com/data-technologies/news/366649895/As-AI-evolves-Tableau-talks-direction-ahead-of-Dreamforce — 31/8/2026 — Analistas: Pulse mantiene el paso, no marca el ritmo; falta inteligencia de decisión.
16. Create Smart Narrative Summaries — Microsoft Learn — https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-smart-narrative — actualizado 22/4/2026 — Los dos modos (Copilot/custom), valores dinámicos, límites (16 resúmenes/página), Copilot por defecto con licencia.
17. Create a narrative visual with Copilot — Microsoft Docs — https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-create-narrative — consultado 13/9/2026 — Limitaciones: cuerpo no editable, refresh manual tras filtrar, escape hatch = pegar al modo custom.
18. Deprecating Power BI Q&A — Power BI Blog (M. Calleja Luque) — https://powerbi.microsoft.com/en-us/blog/deprecating-power-bi-qa/ — 1/12/2025 — Q&A (NLQ legacy configurable) se retira en dic 2026; consolidación en Copilot.
19. Integrate AI with Copilot — Microsoft Fabric Community (foro) — https://community.fabric.microsoft.com/t5/Service/Integrate-AI-with-Copilot/m-p/5178061 — 5/5/2026 — "¿Vale la pena el visual Copilot?": sí con caveats — metadata pobre = salida genérica o inexacta; costos F2; Copilot "obligatorio" con Q&A retirándose.
20. Smart Narrative with Copilot and PDF Export and Email Subscription Not Working — Fabric Community (foro) — https://community.fabric.microsoft.com/t5/Service/Smart-Narrative-with-Copilot-and-PDF-Export-and-Email/m-p/4385560 — 28/1/2025 (respuestas hasta 20/3/2026) — "Defeats the purpose"; workaround comunitario: volver a cajas de texto con DAX (determinístico).
21. Myths, Magic, and Copilot for Power BI — Kurt Buhler (Data Goblins) — https://data-goblins.com/power-bi/copilot-in-power-bi — 5/9/2024 — La crítica de referencia: errores numéricos en narrativas, "mistakes are possible" como descargo estructural, alternativas determinísticas más confiables.
22. High and Low: My Experience of Using AI in Power BI — Martynas Jočys (Medium) — https://martynas-mjdc.medium.com/high-and-low-my-experience-of-using-ai-in-power-bi-b535487031b7 — 4/9/2026 — Práctica fresca: la IA rinde replicando patrones, falla en creatividad y debugging; úsese como herramienta.
23. Building an Evidence-Governed AI Operator for Power BI Engineering — dev.to — https://dev.to/oscargutierrez527/building-an-evidence-governed-ai-operator-for-power-bi-engineering-4gp8 — 31/8/2026 — "Uncertainty deserves an explicit representation"; poder decir "no puedo establecerlo con esta evidencia" vale más que contestar siempre.
24. Smart Narrative: Let AI Tell Your Data Story — Abinash Sahu (LinkedIn) — https://www.linkedin.com/posts/learn-with-abinash_ai-smartnarrative-powerbi-activity-7437693869196005376-17Tu — 12/3/2026 — El sentence builder determinístico en la práctica masiva: texto condicional con medidas, resumen ejecutivo arriba, "leen texto antes que gráfico".
25. Introducing the Next Frontier of Analytics: Automated Insights — Amplitude (J. Vivrekar) — https://amplitude.com/blog/introducing-automated-insights — 10/12/2025 — Agente analista con tool calls encadenadas que cita fuentes; sin mecanismo anti-alucinación explícito.
26. Anomaly + Forecast — Amplitude Docs — https://amplitude.com/docs/analytics/anomaly-forecast — consultado 13/9/2026 — Prophet + banda de confianza; el fraseo modelo: ventana + confianza + rango, nunca punto seco; supuesto de persistencia admitido.
27. Root Cause Analysis — Mixpanel Docs — https://docs.mixpanel.com/docs/root-cause-analysis — consultado 13/9/2026 — Validar (z-score, estacionalidad) antes de escribir; confianza High/Medium/Low explícita; límites del agente declarados.
28. Grafana Labs Targets the "AI Blind Spot"… GrafanaCON 2026 — Grafana Press — https://grafana.com/press/2026/04/21/grafana-labs-targets-the-ai-blind-spot-with-new-observability-tools-announced-at-grafanacon-2026/ — 21/4/2026 — Assistant conversacional y observabilidad de IA; sin narrativa automática de dashboards como feature central.
29. X-rays — Metabase Docs — https://www.metabase.com/docs/latest/exploration-and-organization/x-rays — consultado 13/9/2026 — Exploración automática que genera solo charts: la opción legítima de no narrar.
30. Is Tableau Dead? — Hacker News (foro) — https://news.ycombinator.com/item?id=39519145 — 27/2/2024 — 146 puntos, 121 comentarios; "I can remember ONE decision that was sorta-adopted based on a dataviz".
31. How to test with jest that a specific language is fully covered — GitHub Discussions i18next #1848 (foro) — https://github.com/i18next/i18next/discussions/1848 — oct 2022–jun 2023 — Paridad de claves entre locales como test automatizado.
32. Intl.PluralRules — MDN — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules — consultado 13/9/2026 — Las 6 categorías CLDR, `select()`, y el porqué de no hardcodear condicionales de plural.
33. Unicode CLDR 47 Release: MessageFormat 2.0 Stable — Unicode Blog — https://blog.unicode.org/2025/03/unicode-cldr-47-release-messageformat-2.html — 13/3/2025 — MF2 estable: matching de plural/género, funciones de formato, APIs finalizables.
34. MessageFormat 2 in i18next: state of the migration — Locize Blog — https://www.locize.com/blog/messageformat-2-i18next/ — 11/5/2026 — Adopción marginal (~10 vs ~300.000 descargas semanales); TC39 Stage 2 trabado; recomendación: quedarse en MF1.
35. i18n Pluralization: CLDR Plural Rules, i18next & ICU (2026 Guide) — Locize Blog — https://www.locize.com/blog/i18n-pluralization — 5/7/2026 — "No podés expresar esto con if (count === 1)"; usar Intl.PluralRules; estado MF2.
36. RosaeNLG — GitHub — https://github.com/RosaeNLG/rosaenlg — deprecado marzo 2026 (última versión 4.4.0, 27/12/2024) — La librería NLG JS con español completo, archivada: señal de que el camino 2026 es builders propios sobre Intl.
37. so what? — storytelling with data (C. Nussbaumer Knaflic) — https://www.storytellingwithdata.com/blog/2017/3/22/so-what — 22/3/2017 — El patrón titular-takeaway + evidencia; "your audience should never have to guess".

**Complementarias — leídas solo desde resultados de búsqueda con contenido sustantivo (38–48):**

38. Copilot Narrative Visual in PowerBI — Fabric Community (foro) — https://community.fabric.microsoft.com/t5/Desktop/Copilot-Narrative-Visual-in-PowerBI/td-p/5009974 — 2026 — Formato de salida que varía aunque el prompt pida estructura; el estilo lo controla el servicio hosteado; cambia con updates del modelo.
39. Language Plural Rules (CLDR 48) — Unicode — https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html — 2026 — El chart oficial de categorías por idioma (es con `many` para millones en CLDR 48).
40. Unicode CLDR Plural Rules 2026: Categories, Examples & ICU — intlpull — https://intlpull.com/blog/cldr-plural-rules-complete-guide-2026 — 2026 — Español entre los idiomas que suman `many` en CLDR 48 respecto de versiones legacy.
41. Amplitude launches Automated Insights… — SiliconANGLE — https://siliconangle.com/2025/12/10/amplitude-launches-automated-insights-bring-ai-driven-analyst-workflows-product-teams/ — 10/12/2025 — Cobertura del lanzamiento: explora factores correlacionados y explica qué pasó y qué considerar.
42. Words of estimative probability — Wikipedia — https://en.wikipedia.org/wiki/Words_of_estimative_probability — consultado 13/9/2026 — La tradición Kent/CIA de calibrar palabras de probabilidad.
43. Words of Estimative Probability, Analytic Confidences… — CIS Security — https://www.cisecurity.org/ms-isac/services/words-of-estimative-probability-analytic-confidences-and-structured-analytic-techniques — consultado 13/9/2026 — Escalas fijas palabra↔confianza en análisis operativo.
44. How to Tell a Story with Data: Titles, Subtitles, Annotations… — Depict Data Studio — https://depictdatastudio.com/how-to-tell-a-story-with-data-titles-subtitles-annotations-dark-light-contrast-and-selective-labeling/ — consultado 13/9/2026 — La progresión de título descriptivo a título-veredicto con evidencia anotada.
45. Natural Language Generation (survey/chapter) — arXiv — https://arxiv.org/abs/2503.16728 — mar 2025 — "Los enfoques de reglas/plantillas siguen siendo la solución más confiable… no sufren alucinación."
46. Testing — react-i18next docs — https://react.i18next.com/misc/testing — consultado 13/9/2026 — Estrategias de test de mensajes y catálogos en el ecosistema React.
47. no-large-snapshots — eslint-plugin-jest — https://github.com/jest-community/eslint-plugin-jest/blob/master/docs/rules/no-large-snapshots.md — consultado 13/9/2026 — "A stored snapshot is only as good as its review": snapshots cortos y legibles.
48. Daily Sales Run Rate/Projection Measure — Fabric Community (foro) — https://community.fabric.microsoft.com/t5/Desktop/Daily-Sales-Run-Rate-Projection-Measure/td-p/1118606 — 2020s, activo — La mecánica run-rate (cerrado/días transcurridos × días del período) como práctica establecida, con días hábiles y no calendario.
