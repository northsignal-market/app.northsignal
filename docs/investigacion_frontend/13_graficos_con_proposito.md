# 13 · Gráficos con propósito

**Eje:** qué visualización corresponde a cada tipo de dato/pregunta en el dashboard de operación de NorthSignal — y cuándo NO poner gráfico.
**Fecha de investigación:** 13/9/2026. Prioridad a fuentes 2025-2026, con clásicos donde la evidencia no envejeció.
**Contexto fijo (no investigado, filtro):** app de UN operador, dark futurista (glow cyan), datos: series 17d/91d, composición por grupo, heatmap hora×día (existe), pastillas de señales (existen), embudo FM 4 etapas, 46 locales FM en grupos de pares, % IS perdido budget/rank, predicciones con rango, salud de agentes. La referencia estética del dueño trae: gauge radial de ticks, barcode-chart, barras redondeadas con peak, área con línea blanca. Pedido explícito: *"crear gráfico adonde aporte"*.

**Nota de método:** reddit está bloqueado para fetch desde este entorno (old.reddit y www.reddit rechazan, pullpush.io devolvió 429 en 3 intentos). La cuota de foros se cubrió con Hacker News (4 hilos, 2 de 2026), Observable Forum, GitHub Discussions de Observable Plot, Grafana Community y Microsoft Fabric Community. El paper de Hill 2025 (SAGE) devolvió 403; se citó por su abstract público y el resumen de iMotions.

---

## 1. El marco: primero la pregunta, después la forma

Los tres marcos serios convergen en lo mismo y ninguno arranca por el chart:

- **FT Visual Vocabulary** [1]: 9 relaciones de datos → formas. Las que aplican a NorthSignal: *cambio en el tiempo* (línea, área, columnas, fan chart, calendar heatmap), *magnitud* (barras), *ranking* (barras ordenadas, dot strip), *distribución* (barcode/strip, dot plot), *parte-todo* (stacked, waffle), *desviación* (diverging bar — para "vs plan"). No es un wizard: es un vocabulario para nombrar qué relación querés mostrar **antes** de dibujar.
- **Datawrapper** [2]: "la afirmación principal es la brújula". Si tu oración es "el CPA bajó desde el martes" → línea. Si es "el grupo X se come el 60% del gasto" → parte-todo. Si no podés escribir la oración, no sabés qué chart va — y probablemente no vaya ninguno.
- **Datawrapper (Tanikawa)** [3] y **Nightingale (Gunn)** [4]: pocas formas conocidas bien usadas le ganan al catálogo exótico. Gunn agrega la distinción clave para nosotros: explorar ≠ comunicar. El dashboard de Andrés es *comunicación operativa*: formas familiares, una comparación por panel.

### El anti-chart: cuándo un número o una frase gana

Evidencia acumulada y consistente:

- **Texto simple para 1-2 números** (Knaflic [5], 2011, sigue siendo el consenso): un gráfico de dos barras para "gasto ayer vs anteayer" es ruido; el número con delta gana.
- **BANs (Big-Ass Numbers)** [6]: el número grande se procesa preatentivamente, antes que cualquier chart. Regla: máximo 3-4 por vista, nunca pelado — siempre con delta vs período, umbral o sparkline. Un número solo no significa nada [6][7].
- **Tablas cuando la tarea es lookup** [5]: unidades mixtas (gasto en $, CTR en %, conv en unidades) y "buscá tu fila" → tabla, no gráfico. Exactamente el caso de una tabla de campañas.
- **Improvado 2026** [7]: cada métrica debe pasar el *test de decisión* — "¿qué acción dispara si cambia?". Si nadie sabe responder, no va en el dashboard (ni como número ni como chart). Más de ~9-12 bloques por pantalla degrada el uso.
- **Los foros lo confirman desde la trinchera**: en "Ask HN: how can I make a dashboard that doesn't suck?" [40] el consejo top fue "si no grita *acción*, es un reporte, no un dashboard". En "Whither Dashboard Design?" [39] (dic 2024): los dashboards son "queries guardadas que envejecen"; deben evolucionar con el negocio o mueren. Aplica directo a NorthSignal: `v_para_actuar` es el dashboard; los charts son contexto de esa decisión.

**Regla de oro destilada:** el gráfico entra cuando la respuesta está en la **forma** de los datos (tendencia, distribución, outlier, estacionalidad). Cuando la respuesta es **un valor** (cuánto, cuál, sí/no), gana el número, la pastilla o la frase.

---

## 2. Los cuatro charts de la referencia estética, auditados

El dueño adora una referencia con cuatro formas. Veredicto una por una:

### 2a. Gauge radial de ticks — honesto para UNA meta, deshonesto como decoración repetida

- La evidencia clásica contra el gauge sigue en pie: consume mucho espacio para un solo dato y no permite comparar entre sí [11][13]. Un estudio de eye-tracking (AHFE 2018) midió que el bullet se lee más eficiente que el gauge [12].
- Pero hay un caso donde el radial es legítimo y hasta superior en motivación: **progreso 0-100% hacia una meta única, glanceable** — es el diseño de los Activity Rings de Apple [14]: una persona, una meta, un vistazo. El "cerrar el anillo" explota el efecto goal-gradient.
- La industria 2026 está partida: DashTemplate [8] dice "número grande + flecha antes que gauge"; 5of10 [10] lo acepta para "performance dentro de rangos". La síntesis práctica: **máximo 1-2 gauges por vista, nunca en filas repetidas**. Los hilos de Fabric Community [43] son la prueba por el absurdo: cada vez que alguien pide "un gauge por fila de la tabla", la respuesta de la comunidad termina degradando a barras o KPI — el gauge no escala en filas.
- **Para NorthSignal:** el gauge radial de ticks va para **pacing de presupuesto mensual por cuenta** (consumido vs esperado a la fecha, 0-100%, meta única) — ahí el radial de la referencia es honesto y luce. Para todo lo demás que sea "real vs objetivo", bullet lineal.

### 2b. Barcode / strip plot — la forma correcta para los 46 locales

- El barcode muestra la distribución de muchos ítems individuales en una dimensión: cada raya un ítem, se ven clusters, gaps y outliers [16][17]. Funciona mientras las rayas se distingan: bien hasta decenas de ítems, se degrada pasando ~100 observaciones por fila [17]; el beeswarm aguanta hasta ~500 pero necesita más alto [18].
- 46 locales divididos en grupos de pares = 5-15 rayas por fila. **Zona ideal del barcode.** Y estéticamente ya es el chart de la referencia.
- **Para NorthSignal:** una fila barcode por grupo de pares (eje = CPA o conv/local), el local en foco resaltado en cyan, sus pares en gris. La pregunta que responde: "¿este local está fuera de su manada?" — que es exactamente la regla de la cuenta (los locales se comparan dentro de su grupo de pares, el presupuesto no se mueve entre locales).

### 2c. Bullet chart — la forma para predicción vs real

- Spec de Few [11]: barra = valor real, tick = objetivo/predicho, bandas de fondo = rangos cualitativos. Nació exactamente para "medida vs referencia vs rango" en poco alto, apilable en filas — todo lo que el gauge no puede [12].
- **Para NorthSignal:** "semana en curso vs predicción": barra = real acumulado, banda = rango predicho, tick = punto central. Una fila por métrica o por cuenta. Es el chart nuevo con mejor relación aporte/costo de todo este informe.
- Para la predicción como serie temporal: línea real + **banda sombreada etiquetada** ("rango 80%"), con separador visual histórico/predicción [28][29]. La advertencia de 2026 [9]: el lector clava el ojo en la línea central y la trata como profecía; etiquetar el borde de la banda hace más que ensancharla. Y los huecos de datos se muestran como huecos: "una línea limpia se lee como hecho medido, tenga o no sustento" [9] — que es literalmente la doctrina NorthSignal de conversiones inmaduras.

### 2d. Área con línea blanca + barras redondeadas con peak

- **Área con gradiente que se desvanece:** honesta si (a) la línea superior —que es la que codifica el valor— mantiene contraste alto, (b) el degradé es vertical, monocromo y hacia transparente (no codifica nada, es luz), (c) el baseline está en cero. La crítica real a los gradientes es cuando interfieren la comparación de longitudes en barras [9]; en un área bajo línea, el valor lo lleva la posición de la línea, no el relleno. FlowingData (abr 2025) muestra neón decorativo sobre línea legible como práctica aceptable: decoración señalizada como decoración [35].
- **Barras redondeadas:** el redondeo esconde dónde termina la barra — la crítica es unánime [15]. Pero la misma fuente da la salida: pocos píxeles de radio están bien, y en barras de *progreso* (aproximación, no lectura fina) el redondeo es aceptable. El **peak destacado** es pop-out preatentivo legítimo si el pico ES el mensaje. Radio ≤ 2-3px en barras de datos; redondeo pleno solo en pastillas/progreso.

---

## 3. Comparar 46 locales: qué escala y cuándo

| Forma | Escala bien hasta | Cuándo para FM | Contra |
|---|---|---|---|
| **Barcode/strip por grupo de pares** | ~100 rayas/fila [17] | **Default**: posición del local en su manada, hoy | No muestra tendencia temporal |
| **Tabla + sparkline por fila** | decenas de filas | Detalle: valor exacto + tendencia 17d por local | Pide scroll; sparklines necesitan misma escala por grupo [7] |
| **Small multiples** | ~9-12 paneles legibles [19][20] | Comparar **trayectorias** de los 5-8 locales de UN grupo de pares | Con 46 paneles muere; orden y escala compartida obligatorios [19] |
| **Beeswarm** | ~500 puntos [18] | Vista "las 46 de una vez" coloreadas por grupo — opcional | Más alto de pantalla; el barcode por grupo responde mejor la pregunta operativa |
| **Dot plot simple** | n≈20 ya solapa [21] | No | Con 46 tergiversa |

La decisión no es solo n: es la pregunta. "¿Quién está fuera de su grupo?" → barcode por grupo. "¿Cómo viene cada uno?" → tabla con sparklines. "¿Se están separando dos locales del grupo X?" → small multiples de ese grupo, escala compartida, orden documentado [19].

---

## 4. Composición y share: IS perdido (budget/rank) sin donut

La evidencia parte-todo, actualizada:

- Kosara/Skau 2016 [22]: el pie no se lee por ángulo (área y arco pesan igual o más); el donut **no** es peor que el pie.
- Hill 2025 [23] (pupilometría): para *fracción del total*, pie/donut y barras empatan en precisión; para **ranking de partes**, las barras ganan. Desbarats [24] lo resume: pie = "qué porción del total", barras = "comparar partes entre sí", ≤6-7 categorías.
- O sea: el anti-donut dogmático está matizado en 2025-2026, pero **nuestro caso cae del lado de las barras**: IS ganado + perdido-budget + perdido-rank suma 100% y la pregunta operativa es comparativa y temporal ("¿está creciendo lo perdido por budget?", "¿cómo está esta campaña vs la otra?").
- La práctica PPC ya lo resolvió así: **barra apilada 100%** por campaña/semana con las 3 franjas, y línea de click share encima si hace falta [25]. Para la evolución 91d: columnas apiladas 100% semanales (el área apilada suaviza de más y esconde la semana puntual; con 13 semanas las columnas mantienen lectura discreta).
- Composición por grupo de anuncios (gasto): **barras horizontales ordenadas** — la pregunta real es ranking/magnitud, no fracción [1][23]. Donut solo si algún día la pregunta sea genuinamente "¿qué fracción del total?" con ≤5 grupos [24].

**Embudo FM (4 etapas):** el funnel-trapecio distorsiona — el valor está en el ancho pero el ojo lee el bloque entero que nunca deja de afinarse [26]. Con 4 etapas: **barras horizontales ordenadas con % de paso entre etapas anotado** [26][27]. Conserva la metáfora (decrece hacia abajo) sin mentir la proporción.

---

## 5. Progreso y cumplimiento: pastillas vs barra segmentada

- **Pastillas discretas (lo que ya hay):** correcto y respaldado. Para procesos de pasos finitos y contables (n señales del plan por día), la representación discreta es la que corresponde; 3-7 unidades es la zona de confort cognitivo [44]. Cada pastilla es una señal con identidad — eso una barra continua lo pierde.
- **Barra segmentada 50/25/25 de la referencia:** solo es honesta si existen de verdad 3 componentes ponderados que suman 100% (p.ej. un score compuesto de cumplimiento). Si las señales pesan igual, la barra segmentada inventa jerarquía. No convertir pastillas en barra por estética: son datos distintos.
- **Racha:** número ("12 días") + tira de días estilo grilla GitHub — la grilla de momentum es el patrón dominante en trackers de hábitos y es un calendar-heatmap honesto [1]. El goal-gradient [14] justifica mostrar "te faltan 2 señales para el día perfecto".
- **Salud de agentes (latidos vs cadencia):** NO es un chart. Es estado: **dot de status + texto "hace X min" + severidad**, patrón Carbon/Mobbin [45][46] — dot para binario, texto/badge cuando hace falta contexto, alerta si urgente. Solo si se investiga una degradación sirve una tira temporal de latidos (barcode sobre eje de tiempo [16], que es la segunda función canónica del barcode).
- **Heatmap hora×día (ya existe):** mantener; es la forma canónica para 2 dimensiones categóricas + medida [47][48]. Dos ajustes de honestidad: escala de color **fija** entre refrescos para que la comparación no se mueva sola [48], y celdas sin datos visualmente distintas de cero [47] — en este sistema "sin datos ≠ cero" es doctrina.

---

## 6. Glow y gradientes sin mentir (dark, cyan)

Reglas concretas, todas con fuente:

1. **Fondo:** gris oscuro #1E1E1E–#2D2D2D, nunca negro puro; texto off-white #E0E0E0, nunca blanco puro [30].
2. **Series sobre dark: desaturar 20-30% y subir lightness** — el color de marca calibrado para blanco "sangra" en dark (bleeding neón) [30]. Ember (HN, ago 2026) validó en comunidad que las paletas funcionales para condiciones adversas usan saturación deliberadamente baja [38].
3. **Glow = capa debajo, dato encima nítido.** La técnica canónica (Bremer, feGaussianBlur sutil como halo, el trazo real intacto arriba) [36]; FlowingData la muestra como acento decorativo aceptable [35]. El glow nunca reemplaza contraste: si al quitar el glow la línea no se lee, el problema es el color, no falta más glow.
4. **Un hero chart con neón por vista; el resto sobrio** [37]. Seis series brillando a la vez es ruido ilegible [37]. En NorthSignal: el glow cyan es del dato protagonista (la serie en foco, el peak, el local resaltado); las series de contexto van en grises.
5. **Gradientes:** verticales, monocromos, hacia transparente, solo bajo líneas/áreas — jamás a lo largo de barras donde interfieren la comparación de longitud [9].
6. **Gridlines más oscuras que el texto** (#3A3A4A aprox): que no compitan con el dato [30].
7. **Dark mode por algoritmo de contraste equivalente, no por inversión ingenua** — Datawrapper conserva la semántica invirtiendo luminosidad con contraste igualado [31]; Observable Plot lo resuelve con `currentColor` + CSS vars y recortando extremos de escalas continuas ([0.1, 0.9]) para que nada muera contra el fondo [32][33][34].

---

## 7. EL MAPA: dato de NorthSignal → forma

| Dato | Forma recomendada | Estado | Por qué (una línea) |
|---|---|---|---|
| Gasto/conv de ayer, por cuenta | **BAN** (número grande + delta + mini-sparkline) | no-chart | 1-2 números se procesan preatentivamente; un chart acá es ruido [5][6][8] |
| Serie diaria 17d — gasto | **Área con línea blanca** (gradiente vertical a transparente, baseline 0) | mantener/pulir | Magnitud en el tiempo; la línea codifica, el relleno decora sin mentir [1][9][35] |
| Series diarias 17d — CPA/CTR/CPC | **Línea** (sin relleno; huecos visibles; últimos 3 días atenuados "madurando") | mantener/pulir | Ratios no se acumulan → sin área; el gap honesto es doctrina del sistema [2][9] |
| Semanal 91d | **Línea** con banda de contexto, o columnas si <15 puntos | mantener | Continuo → línea; pocos puntos → columnas [2] |
| Composición por grupo de anuncios | **Barras horizontales ordenadas** | reemplazo de donut | La pregunta es ranking/magnitud, no fracción [1][23][24] |
| Heatmap hora×día | **Heatmap** (escala fija; "sin datos" ≠ 0) | mantener | Forma canónica para 2 dims categóricas + medida [47][48] |
| Señales del plan (cumplimiento diario) | **Pastillas discretas** | mantener | Pasos finitos con identidad → discreto; barra continua las borra [44] |
| Racha de cumplimiento | **Número + grilla de días (GitHub-style)** | crear (barato) | Calendar heatmap honesto + goal-gradient motivacional [1][14] |
| Barra segmentada 50/25/25 (referencia) | Solo si nace un **score compuesto ponderado** | condicional | Sin ponderación real, los segmentos inventan jerarquía |
| Embudo FM 4 etapas | **Barras horizontales + % de paso anotado** | reemplazo del trapecio | El trapecio distorsiona la lectura del ancho [26][27] |
| 46 locales FM (grupos de pares) | **Barcode/strip por grupo, local resaltado** | **CREAR — el gauge estrella del informe** | 5-15 rayas por grupo = zona ideal; responde "¿está fuera de su manada?" [16][17] |
| Detalle por local | **Tabla + sparkline por fila** (escala compartida por grupo) | crear | Lookup multi-unidad = tabla [5]; sparkline da tendencia sin panel [7][8] |
| Trayectorias dentro de UN grupo | **Small multiples** (≤9 paneles, escala compartida) | crear si se pide | Líneas superpuestas de 8 locales se enredan [19][20] |
| % IS ganado/perdido-budget/perdido-rank | **Barra apilada 100%** por campaña; columnas apiladas semanales para evolución | **CREAR** | Suma 100% con 3 partes y pregunta comparativa → stacked, no donut [23][25] |
| Predicción vs real (semana en curso) | **Bullet chart** (barra=real, banda=rango, tick=predicho) | **CREAR** | Medida vs referencia vs rango en poco alto, apilable [11][12] |
| Predicción como serie | **Línea + banda etiquetada ("rango 80%")** + separador histórico/futuro | crear | La banda sin etiqueta se ignora; la línea central se lee como profecía [9][28][29] |
| Pacing presupuesto mensual por cuenta | **Gauge radial de ticks** (máx 1 por cuenta, 0-100%, meta única) | **CREAR — aquí el radial de la referencia es honesto** | Progreso a meta única glanceable; el caso Activity Rings [13][14] |
| Real vs objetivo en filas/tablas | **Bullet lineal**, nunca gauge por fila | regla | El gauge no escala en filas; la comunidad siempre termina degradándolo [12][43] |
| Salud de agentes (latidos) | **Status dot + "hace X min"** + severidad | no-chart | Estado binario/ternario → dot+texto, no visualización [45][46] |
| Cambios recientes / acciones | **Lista/tabla cronológica** | no-chart | Es lectura secuencial, no forma de datos [5] |
| CPA con 0 conversiones | **"—" (NULL visible)**, jamás 0 ni línea continua | no-chart / regla | El CPA canónico devuelve NULL a propósito; graficarlo como 0 es el semantic drift que este sistema caza |

**Presupuesto de tinta por vista** (síntesis [6][7][8]): 3-4 BANs arriba, 1 hero chart con glow, 2-3 charts de contexto sobrios, el resto pastillas/dots/tablas. Si una vista pide más, la vista está mal recortada.

---

## 8. Anti-patrones específicos para NorthSignal

1. **Donut para IS o para composición de grupos** — la pregunta es comparativa; stacked/barras [23][25].
2. **Gauge por fila** (locales, campañas) — no escala; bullet [12][43].
3. **Línea de conversiones continua hasta hoy** — los últimos días maduran; atenuarlos o marcarlos es la versión visual de "el gasto es definitivo, las conversiones no" [9].
4. **Sparklines con escalas distintas en la misma tabla sin avisar** — comparación injusta [7][19].
5. **Glow en 6 series a la vez** — ilegible; un protagonista [37].
6. **Beeswarm/violines para 46 puntos** — sobreingeniería; el barcode alcanza y es la estética de la casa [17][18].
7. **Funnel-trapecio** — distorsión conocida [26].
8. **Leyenda/escala de color del heatmap que se recalcula sola en cada refresh** — comparación temporal rota [48].
9. **Chart nuevo sin oración** — si no podés escribir la afirmación que el chart demuestra, es decoración [2]. El pedido del dueño ("crear gráfico adonde aporte") tiene test operativo: ¿qué decisión de `v_para_actuar` acelera este gráfico?

---

## Fuentes

Formato: título — URL — fecha — aporte. **[FORO]** = foro/comunidad. **[2026]** = publicado/actualizado en 2026.

### Marcos y anti-chart
1. FT Visual Vocabulary (Financial Times) — https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary (interactivo: https://ft-interactive.github.io/visual-vocabulary/) — 2016, mantenido — taxonomía pregunta→forma en 9 relaciones; el punto de partida del mapa.
2. A friendly guide to choosing a chart type — Datawrapper Blog (L. C. Muth) — https://www.datawrapper.de/blog/chart-types-guide — 16/6/2025 — "la afirmación principal es la brújula"; familiar > exótico para audiencias que deciden.
3. Your favorite chart type is more flexible than you think — Datawrapper (A. Tanikawa) — https://www.datawrapper.de/blog/favorite-popular-chart-types — 7/10/2021 — pocas formas bien usadas cubren casi todo; catálogo limitado a propósito.
4. Step 9 in the Data Exploration Journey: Chart Choices — Nightingale (E. Gunn) — https://nightingaledvs.com/step-9-in-the-data-exploration-journey-chart-choices/ — 24/7/2024 — explorar ≠ comunicar; al publicar, eliminar comparaciones múltiples y elegir forma familiar.
5. Visual battle: table vs graph — storytelling with data (C. Nussbaumer Knaflic) — https://www.storytellingwithdata.com/blog/2011/11/visual-battle-table-vs-graph — nov/2011 — tabla para lookup y unidades mixtas; gráfico cuando el punto está en la forma; texto simple para 1-2 números.
6. Big-Ass Numbers (BANs): Why They Belong on Every Dashboard — VizMasters (T. Davuluru) — https://vizmasters.substack.com/p/big-ass-numbers-bans-why-they-belong — 13/6/2025 — el número grande gana por procesamiento preatentivo; máx 3-4; nunca sin contexto.
7. Dashboard Design: Best Practices & How-Tos 2026 — Improvado (H. Friedman) — https://improvado.io/blog/dashboard-design-guide — actualizado 30/8/2026 **[2026]** — árbol dato→chart; test de decisión por métrica; 5-9 métricas; regla 40/30/20/10; sparklines con escala consistente.
8. 10 Dashboard Design Best Practices in 2026 — DashTemplate — https://dashtemplate.com/blog/dashboard-best-practices-2026/ — 20/3/2026 **[2026]** — "número grande + flecha de tendencia en vez de gauge"; barras para categorías, líneas para tiempo; pie >3-4 segmentos no.
9. Data Visualization Best Practices 2026 — FuseLab Creative — https://fuselabcreative.com/data-visualization-best-practices/ — 10/9/2026 **[2026]** — bandas de incertidumbre etiquetadas o se ignoran; gradientes/sombras interfieren la comparación de longitud; huecos visibles = honestidad; cita NNG (área no preatentiva).
10. Dashboard Design Best Practices: The Complete 2026 Guide — 5of10 — https://5of10.com/articles/dashboard-design-best-practices/ — 2026 **[2026]** — contrapunto: gauges para rangos y donuts ≤5 categorías; muestra que la industria 2026 no es monolítica anti-gauge.

### Gauge, bullet, barcode, barras de la referencia
11. Bullet Graph Design Specification — S. Few, Perceptual Edge — https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf — 2013 — la spec: medida + comparativa + rangos cualitativos; nació para reemplazar gauges en dashboards.
12. Bullet Graph Versus Gauges Graph: Evaluation… Based on Eye-Tracking — Springer (AHFE) — https://link.springer.com/chapter/10.1007/978-3-319-94947-5_74 — 2018 — evidencia experimental: lectura más eficiente en bullet que en gauge.
13. Our fascination with all things circular — S. Few — http://www.perceptualedge.com/articles/visual_business_intelligence/our_fascination_with_all_things_circular.pdf — 2010 — por qué lo circular seduce y rinde menos; el marco del "radial solo si aporta".
14. Activity rings — Apple Human Interface Guidelines — https://developer.apple.com/design/human-interface-guidelines/activity-rings — vigente 2026 — el caso legítimo del radial: UNA meta, 0-100%, glanceable; goal-gradient.
15. Rule 22: No rounded, pointed or decorated bars — AddTwo — https://www.addtwodigital.com/add-two-blog/2021/8/2/rule-22-no-rounded-pointed-or-decorated-bars — 2/8/2021 — el redondeo esconde el fin de la barra; pocos px OK; en barras de progreso aceptable.
16. Chart Snapshot: Barcode Plots — DataViz Catalogue Blog — https://datavizcatalogue.com/blog/chart-snapshot-barcode-plot/ — 28/3/2024 — barcode: distribución de ítems individuales o eventos en el tiempo; opacidad contra overplotting.
17. Strip Plot: Definition, Examples, and When to Use It — Domo — https://www.domo.com/learn/charts/strip-plot — s/f — cuándo strip: n manejable, outliers, ver datos crudos; se degrada >~100 obs por categoría.
18. Beeswarm Plot: What It Is, When To Use It — Visualizing.org — https://www.visualizing.org/beeswarm-plot — s/f — el beeswarm evita solape hasta ~500 puntos; después, blob.

### Muchos ítems similares (46 locales)
19. What to consider when creating small multiple line charts — Datawrapper (L. C. Muth) — https://www.datawrapper.de/blog/what-to-consider-when-creating-small-multiple-line-charts — 7/2/2024 — escalas compartidas, orden documentado, pocos paneles, no tercerizar el hallazgo al lector.
20. How to create a multiple columns chart — Datawrapper Academy — https://www.datawrapper.de/academy/how-to-create-a-multiple-columns-chart — s/f — small multiples para "demasiadas categorías para un grouped chart".
21. Visualizing Multiple Data Distributions — A. Gude — https://alexgude.com/blog/distribution-plots/ — s/f — dot plot: n=20 ya solapa, n=50 tergiversa; cuándo saltar a strip/beeswarm/density.

### Parte-todo, donut, IS
22. An illustrated tour of the pie chart study results — eagereyes (R. Kosara, D. Skau) — https://eagereyes.org/blog/2016/an-illustrated-tour-of-the-pie-chart-study-results — 2016 — el pie no se lee por ángulo; el donut no es peor que el pie.
23. Are pie charts evil? An assessment… — A. Hill, Information Visualization (SAGE) — https://journals.sagepub.com/doi/10.1177/14738716241259432 — 2025 (resumen accesible: https://imotions.com/blog/publications/are-pie-charts-evil-an-assessment-of-the-value-of-pie-and-donut-charts-compared-to-bar-charts/) — con pupilometría: pie/donut igual de precisos para parte-todo; barras mejores para ranking.
24. Have I Resolved the Pie Chart Debate? — Nightingale (N. Desbarats) — https://nightingaledvs.com/have-i-resolved-the-pie-chart-debate/ — 6/12/2023 — pie = fracción del total (≤6-7 cat.); barras = comparar partes entre sí.
25. How to graph the new impression & click share metrics — Adalysis — https://adalysis.com/blog/how-to-graph-the-new-impression-and-click-share-metrics-to-find-data-insights-in-your-google-ads-account/ — 9/4/2019 — IS suma 100% → stacked bars + línea de click share; pares diagnósticos budget/rank.

### Embudo
26. Funnel Chart Alternatives: When to Use Bars — Graphtelling — https://graphtelling.com/blog/funnel-chart-alternatives/ — s/f (~2025) — el valor está en el ancho pero el ojo lee el bloque que nunca deja de afinarse; barras para valores exactos.
27. Do This, Not That: Funnel Charts — Infogram — https://infogram.com/blog/do-this-not-that-funnel-charts/ — s/f — funnel solo si las etapas decrecen con proporciones que importan; si son parejas, rectángulo sin valor.

### Incertidumbre y predicción
28. Fan Chart (Forecast Uncertainty) — MetricGate — https://metricgate.com/docs/fan-chart-uncertainty/ — s/f — intervalos anidados 50/80/95 fuerzan a pensar en rangos, no en puntos.
29. Predictive analytics visualization — Highcharts — https://www.highcharts.com/blog/use-cases/predictive-analytics-visualization/ — s/f — banda sombreada + separador histórico/predicción + tooltips con rango.

### Dark, glow, gradientes, paletas
30. Dark Mode Charts: Colors & Contrast That Actually Look Good — CleanChart — https://www.cleanchart.app/blog/dark-mode-charts — 3/2/2026 **[2026]** — #1E1E1E–#2D2D2D, desaturar 20-30%, gridlines #3A3A4A, texto #E0E0E0; anti-bleeding neón.
31. New: Dark mode for all Datawrapper visualizations — Datawrapper (L. C. Muth) — https://www.datawrapper.de/blog/dark-mode-for-embedded-visualizations — 26/1/2022 — dark mode por algoritmo de contraste equivalente, no inversión ingenua.
32. Crafting an effective data visualization color palette (Observable 10) — Observable Blog — https://observablehq.com/blog/crafting-data-colors — 2023 — paleta categórica probada contra decenas de charts en fondo claro Y oscuro; ajustes por vibración.
33. dark mode — GitHub Discussions, observablehq/plot #1461 — https://github.com/observablehq/plot/discussions/1461 — abr/2023 **[FORO]** — lecciones de charts dark: currentColor, variable para blanco, isolation:isolate con blend modes.
34. Is it possible to set global theme dark/light mode? — Observable Forum — https://talk.observablehq.com/t/is-it-possible-to-set-global-theme-dark-light-mode/8871 — feb-mar/2024 **[FORO]** — CSS vars para theming; recortar extremos de escalas continuas ([0.1, 0.9]) para que nada muera contra el fondo.
35. Line Chart with Decorative Neon Accents — FlowingData (N. Yau) — https://flowingdata.com/2025/04/15/line-chart-with-decorative-neon-accents/ — 15/4/2025 — el neón como acento decorativo señalizado sobre una línea legible.
36. Adding a subtle touch of glow to your d3.js visualizations — Visual Cinnamon (N. Bremer) — https://www.visualcinnamon.com/2016/06/glow-filter-d3-visualization/ — jun/2016 — la técnica canónica: halo con blur debajo, dato nítido encima.
37. Cyberpunk Data Visualization: Neon UI Charts — Chartissimo — https://chartissimo.com/blog/cyberpunk-data-visualization — s/f (~2026) — un solo hero chart neón por vista; cap de series brillantes; cuándo el neón es apropiado y cuándo lee como no-profesional.
38. Show HN: Ember – Redshift safe color palettes — Hacker News — https://news.ycombinator.com/item?id=49232870 — 9/8/2026 **[2026] [FORO]** — paletas de baja saturación distinguibles en condiciones adversas; la comunidad valida función sobre moda ("actually functional themes").

### Foros de operación y dashboards
39. Whither Dashboard Design? — Hacker News — https://news.ycombinator.com/item?id=42489353 — dic/2024 **[FORO]** — "un dashboard es un montón de queries guardadas con ayuda visual… la mitad vencidas"; deben evolucionar o mueren.
40. Ask HN: How can I make a dashboard that doesn't suck? — Hacker News — https://news.ycombinator.com/item?id=20418466 — jul/2019 **[FORO]** — accionabilidad como criterio: si no dispara decisión, es un reporte.
41. Show HN: Microsoft releases Flint, a visualization language for AI agents — Hacker News — https://news.ycombinator.com/item?id=48834924 — 8/7/2026 **[2026] [FORO]** — practicantes (NicuCalcea, lmeyerov) debaten defaults seguros de chart-choice y grammar of graphics en la era de agentes; segundo hilo 1/8/2026 (id 49130604).
42. Heatmap by days and hours (not date) — Grafana Community — https://community.grafana.com/t/heatmap-by-days-and-hours-not-date/100509 — ago/2023 **[FORO]** — la demanda real del heatmap hora×día en operación y el workaround con tabla estilizada.
43. Add a Gauge chart to each row of a table — Microsoft Fabric Community — https://community.fabric.microsoft.com/t5/Desktop/Add-a-Gauge-chart-to-each-row-of-a-table/td-p/3446825 — 2023 **[FORO]** — cada pedido de "gauge por fila" termina degradado a barras/KPI: el gauge no escala en filas.

### Status, progreso, heatmap
44. Progress Tracker Design: UX Best Practices (2026) — UXPin — https://www.uxpin.com/studio/blog/design-progress-trackers/ — 4/5/2026 **[2026]** — 3-7 pasos discretos; trackers para procesos finitos; más de 7 sube la carga cognitiva.
45. Status indicators — Carbon Design System (IBM) — https://carbondesignsystem.com/patterns/status-indicator-pattern/ — s/f — jerarquía de severidad; dot+texto; texto simple cuando el estado no amerita destacar.
46. Status Dot UI Design — Mobbin Glossary — https://mobbin.com/glossary/status-dot — s/f — dot para binario; badge/texto para contexto; alerta para urgencia.
47. Heatmap chart: A Complete Guide — Domo — https://www.domo.com/learn/charts/heatmap-chart — s/f — 2 dims categóricas + medida; decidir manejo de celdas vacías.
48. Heatmap Visualization Guide 2025 — ChartGen — https://chartgen.ai/resources/blog/heatmap-data-visualization-complete-guide-examples — 2025 — staffing por hora×día; leyenda de rango fijo para que el refresh no engañe.

**Conteo:** 48 fuentes; 9 marcadas [2026] (4 de jun-sep 2026: Improvado 30/8, FuseLab 10/9, HN Ember 9/8, HN Flint 8/7); 8 marcadas [FORO] (HN ×4, Observable Forum, GitHub Discussions, Grafana Community, Fabric Community). Reddit inaccesible desde este entorno (bloqueo de fetch + rate-limit de mirrors); se registra como limitación.
