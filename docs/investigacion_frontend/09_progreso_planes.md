# 09 · Cómo comunicar el progreso de un plan: transcurso, restante, salud y desbloqueo

**Investigación frontend · NorthSignal**
Fecha: 13 de septiembre de 2026.
Método: 55 fuentes reales verificadas en la web. Las marcadas **(fetch)** se abrieron y leyeron completas (WebFetch); las marcadas **(exa)** se leyeron con extractos sustanciales vía búsqueda semántica; las marcadas **(búsqueda)** se leyeron desde resultados de búsqueda con contenido sustantivo. 15 fuentes son de 2026 (9 de junio-septiembre) y 10 son de foros/comunidad (Asana Forum, HN ×2, Blind, PM StackExchange, projectmanagement.com, issues de GitHub ×3, espejo de Reddit).

**El eje:** cada lunes un agente define el plan de la semana — indicadores con umbral y dirección, medidos a diario (cumple / no cumple / sin dato), donde cumplir N días seguidos **habilita** una acción. Hoy la UI muestra cuadraditos y texto técnico, sin decir cuántos días van, cuántos faltan, si el plan viene bien o mal, ni qué se desbloquea y cuándo. La pregunta investigada: cómo comunican eso las mejores herramientas, con la restricción propia de esta casa — los días recientes pueden no tener dato aún, y "sin dato" ≠ "incumplió".

---

## Resumen ejecutivo — las 8 tesis que dejó la investigación

1. **La convención de salud es universal y tiene 4 estados, no 3:** On track / At risk / Off track **más un gris de "sin dato / update vencido"** que casi nadie nombra pero todos implementan (Linear, Perdoo, Atlassian, Statuspage) [1][5][8][30]. La salud siempre viaja con una frase corta que explica el porqué.
2. **La tendencia 2025-2026 es que el estado lo calcule el sistema y el humano solo anote.** Viva Goals, Perdoo y monday derivan el estado de una fórmula (gap contra progreso esperado, % de tareas trabadas); la literatura anti-watermelon de 2026 es explícita: "RAG calculado por el sistema, no elegido de un dropdown" [6][7][8][51][53].
3. **La fórmula de salud más citada es esperado-menos-real:** progreso esperado lineal entre inicio y fin; si `esperado − real > 25%` → At Risk; si `0 < gap ≤ 25%` → Behind; si `gap ≤ 0` → On Track (Viva Goals, con umbrales editables) [7]. Su versión de ingeniería es el **error budget + burn rate** del SRE Workbook: mirá cuánto margen de fallo consumiste contra cuánto período transcurrió [15][16][17].
4. **El progreso honesto se muestra como acumulado contra línea de requisito (burn-up), no como cuenta regresiva de lo que falta (burndown)**, porque el burn-up separa avance de cambios de alcance y no castiga visualmente lo que no depende del ejecutor [13][14].
5. **Las rachas funcionan pero queman.** GitHub eliminó su contador de rachas en 2016 por presión sobre los usuarios [18][19][20]; en HN (feb 2026) el patrón se repite: "mantener la racha es estrés y perderla desmotiva" [21]. La alternativa seria: **grilla de días + "X de Y"**, sin fuego ni celebración — y con evidencia empírica de 2026: tras 1 día fallado retoma el 80,9%, tras 2 el 71,1% — la señal útil es "no falles dos seguidos", no "no rompas la cadena" [23].
6. **"Sin dato" es un estado de primera clase en todo tracker serio de 2026:** tres estados mínimo (hecho / no hecho / sin dato), el "sin dato" **sale del denominador** y **no rompe rachas** — solo las rompe un "no cumplió" explícito (whph PR #193, DropDrop, Statuspage: gris = sin datos ≠ rojo = caída) [30][31][32][33].
7. **El tiempo restante se dice con número relativo + ancla absoluta** ("quedan 3 días · termina el domingo 21"): relativo para ≤7 días, absoluto siempre visible como ancla. Un deadline real informa; solo el falso presiona — la línea entre urgencia honesta y dark pattern es si el plazo existe de verdad [25][26][27][28][29].
8. **El desbloqueo se comunica como el merge box de GitHub:** requisito explícito, estado actual por requisito (pasó / falló / pendiente), y frase de bloqueo con el faltante ("Merging is blocked — 1 approving review required"). Trasladado: "Bajar puja se habilita con 2 días seguidos cumpliendo · va 1 de 2 · si hoy cumple cuando madure, queda habilitada el jueves" [42][43][44].

---

## Tema 1 · La semántica de salud: 3 estados + el gris que nadie nombra

### Linear: el modelo de referencia

Linear define la salud de un proyecto con exactamente tres valores — **On track (verde), At risk (amarillo), Off track (rojo)** — que el lead elige al publicar un *project update*: salud + texto corto sobre "status, challenges, and next steps" [1]. Tres detalles de diseño importan más que los tres colores:

- **La salud caduca.** Si el último update fue "On Track" y pasó un ciclo de recordatorio + 3 días, el proyecto muestra **"Update Missing"**; el ícono de salud primero toma borde punteado (levemente vencido) y después **se pone gris** (inactividad extendida) [1]. Una salud vieja deja de ser salud: el sistema la degrada solo, sin esperar a que alguien sospeche.
- **Umbral anti-ruido:** el update automático incluye detalle de progreso solo si el progreso total cambió más de 2% [1]. Menos que eso no es noticia.
- **Desde junio 2026, el borrador lo escribe un agente:** "Write with Agent" revisa los cambios desde el último update y los mensajes del canal de Slack vinculado, redacta, y el humano refina y publica [2]. La dirección es idéntica a la de NorthSignal: el sistema junta la evidencia, la persona decide el mensaje.

### El resto del mercado: la misma tríada, con matices útiles

- **Asana** usa la tríada para proyectos y goals, y su API revela la taxonomía completa de cierre: `on_track, at_risk, off_track` durante el período y `achieved, partial, missed, dropped` al cerrar [3]. Cerrar un plan también necesita vocabulario: no todo termina en "cumplido/incumplido"; existe "parcial" y "abandonado".
- **Atlassian (Atlas/Home)** pide updates semanales para proyectos y mensuales para goals, y su guía es explícita sobre la frase corta: al cambiar el estado, "describí por qué lo cambiaste y qué acciones necesitás" [5]. Estado + porqué + pedido: ese es el formato.
- **monday.com** deriva la salud con reglas configurables: "si más del 50% de las tareas están trabadas, la salud del proyecto pasa sola a At Risk" [6].
- **Perdoo** agrega el quinto estado que nos importa: **"No status (gris): todavía no hay datos o el goal no arrancó"** [8]. El gris como estado legítimo, no como error.
- **Height** (2024-2025) llevó el updates automático al extremo — standups y reportes de progreso generados solos — antes de cerrar en septiembre 2025 [11]. La automatización del reporte quedó validada como dirección; el negocio no.
- **Basecamp** aporta el contrapunto: el hill chart es deliberadamente **humano**, no calculado — "un punto que no se mueve es una mano levantada" [12]. Vale para trabajo con incógnitas no medibles. El plan semanal de NorthSignal es medible por diseño (umbral, dirección, veredicto diario), así que acá gana el cálculo; el rol humano del hill chart lo cumple la nota del agente.

### Lo que el gris resuelve

La tríada sola tiene un modo de falla conocido: el estado viejo que sigue verde. Linear lo resuelve degradando la salud a gris cuando el update vence [1]; Perdoo arranca en gris hasta que haya datos [8]. **Para el plan semanal: la salud de hoy calculada con datos de anteayer se muestra, pero fechada; y si el sistema no pudo re-evaluar, gris con "sin evaluar desde el martes", nunca el último color congelado.**

---

## Tema 2 · Estado calculado vs declarado: la lección watermelon

La literatura de gestión 2024-2026 converge en un diagnóstico: cuando el estado lo declara una persona, el verde miente. El nombre del fenómeno es *watermelon* — verde afuera, rojo adentro — y las fuentes de este año son inusualmente concretas:

- **El estado tiene que salir de un campo calculado.** "Necesitás un sistema donde el RAG lo calcule el sistema, no se elija de un dropdown. Si la varianza excede 5%, Amber; si excede 10%, Red. Ningún optimismo puede pisar un campo calculado" (feb 2026) [51]. Y la consecuencia asumida: "vas a ver más rojo y ámbar del que estás acostumbrado. Pero es rojo bueno, rojo accionable" [51].
- **La forma de la serie delata la mentira.** "La forma clásica — verde, verde, ámbar, ámbar, ámbar, rojo — es en sí misma la delación. Un estado que degrada suave por ámbar y salta a rojo es sospechoso, porque los proyectos reales rara vez fallan de forma discontinua" (jun 2026) [52]. Una meseta larga en ámbar casi siempre esconde rojo.
- **El estado cambia cuando el dato se mueve, no cuando llega la reunión.** "En el momento en que la fecha comprometida cae debajo de su línea de 85% de confianza, el estado vira a ámbar — cuando el dato se mueve, no en la reunión posterior al desvío" (jul 2026) [53]. Y la recomendación de abrir el reporte "con un número, no con un color" [53].
- **El rojo tiene que ser barato de decir.** El análisis más citado del fenómeno: la gente no esconde la verdad por gusto, la esconde porque "la honestidad se volvió personalmente cara". El giro que funcionó: "Red dejó de significar 'fallaste' y empezó a significar 'sabemos dónde está el problema; ¿cómo ayudamos?'" [50]. La versión gerencial: "un estado watermelon es peor que un estado rojo" [55]; ámbar = "necesito ayuda de governance", rojo = "hay que re-decidir (más plata, más tiempo o menos alcance)" [54].

**Para NorthSignal esto es casi gratis:** acá no hay un PM con incentivos para pintar verde — hay un agente. Pero el equivalente exacto del watermelon existe: un agente que declara "el plan viene bien" en texto libre, sin fórmula. La regla que sale de esta literatura: **el estado del plan lo computa una función sobre los veredictos diarios; el agente solo escribe el porqué.** Y si el estado empeora un martes a las 11:00 cuando madura el dato, empeora un martes a las 11:00 — no el lunes siguiente cuando se re-planifica.

---

## Tema 3 · Cuánto va, cuánto falta: esperado vs real, burn-up y error budget

### La fórmula esperado-menos-real (Viva Goals)

El estándar de facto en OKR tools es comparar el progreso real contra un **progreso esperado lineal en el tiempo**: "el primer día del período el esperado es 0%; el último día, 100%" — una línea gris vertical sobre la barra de progreso [7]. El estado se deriva del gap, con umbrales publicados y editables [7]:

```
gap = progreso_esperado − progreso_real
gap > 25%        → At Risk
0 < gap ≤ 25%    → Behind
gap ≤ 0          → On Track
```

Viva agrega un detalle fino: **"Needs attention" si a los 7 días del inicio el objetivo no arrancó** [7] — el silencio temprano es su propia alerta (la misma idea que `v_tareas_en_silencio`). Perdoo automatiza igual ("estado calculado por progreso vs progreso esperado", con override humano permitido) [8], y Tability aporta la distinción conceptual: **progreso ≠ confianza** — el % numérico solo no dice nada "sin considerar cuánto tiempo te queda" [9]. PeopleForce muestra el contraejemplo: promediar progreso de KRs sin línea de esperado — un número que no sabe qué día es [10].

### Burn-up, no burndown

Para expresar "vas acá, falta esto", la evidencia favorece el **burn-up** (acumulado de trabajo hecho contra línea de objetivo) sobre el burndown (lo que falta): el burndown "confunde cambio de alcance con falta de progreso", mientras el burn-up mantiene el avance real separado del objetivo, y la distancia entre ambas líneas *es* el faltante [13][14]. Traducido al plan semanal: **una línea/serie de días cumplidos acumulados contra la línea horizontal del requisito (K días)**. Se lee de un golpe: dónde estoy, cuánto falta, cuántos días quedan para lograrlo.

### Error budget y burn rate: la semántica de ingeniería para "viene mal"

El marco más honesto encontrado para "¿el plan viene bien o mal?" no viene de PM sino de SRE. Un SLO de 30 días define un **presupuesto de error** (los fallos que podés tolerar y aún cumplir); la salud no es "cuántos fallos hubo" sino **a qué velocidad los consumís**: `burn rate = fracción del budget consumida / fracción del período transcurrida`. Burn 1 = exactamente al límite; burn >1 = camino a agotarlo antes de fin de período. El SRE Workbook formaliza umbrales (14,4× en ventana de 1 hora = pagína ya; 6× = investigá) y recomienda multi-ventana para no alarmar por ruido de ventanas cortas [15][16][17].

**El plan semanal de NorthSignal es literalmente un SLO de 7 días.** "Cumplir K de N días" define un budget de fallos `B = N − K`. Cada "no cumplió" consume budget. "Quedan 2 fallos permitidos y quedan 4 días" es una frase más honesta y más accionable que "va 3 de 7", porque incorpora la dirección del tiempo. Y la advertencia multi-ventana del Workbook se traduce en la regla de no proyectar con 1-2 días de dato (abajo, Tema 5).

---

## Tema 4 · Rachas y cumplimiento por días, sin fuego ni confeti

### La evidencia en contra del contador de racha

- **GitHub tuvo rachas y las eliminó** (mayo 2016). El issue que precipitó el cambio documenta el porqué: el gráfico "premia hacer contribuciones la mayor cantidad de días posible, varios días seguidos sin descanso… un streak de 416 días significa que no se tomó un solo día libre en más de un año" [19]. El rediseño oficial "se enfoca en el trabajo que hacés, no en la duración de la actividad" [18]. Hubo usuarios que pidieron el streak de vuelta [20]: la señal es divisiva — motiva a unos, quema a otros.
- **En HN (feb 2026), sobre mecánicas de retención:** "mantener la racha es estrés para mí y fallarla tiene un impacto negativo grande en mi motivación"; otro usuario describe "abandonar las rachas de Duolingo en mis propios términos" como alivio [21]. La racha con identidad emocional (fuego, número gigante) convierte el fallo en evento traumático — exactamente lo contrario de lo que necesita una herramienta operativa donde el fallo es información.
- **La evidencia empírica de 2026** (2.066 hábitos, 1.006 usuarios, snapshot ago-2026): tras 1 día fallado retoma el 80,9%; tras 2 seguidos, 71,1%; tras 7, 42,2%. La caída más filosa está entre el día 1 y el 2 — de ahí que la regla útil sea "nunca dos seguidos", no "nunca". Y la recomendación de diseño explícita: **grilla antes que contador** — "el contador resetea a cero y genera pensamiento todo-o-nada; la grilla muestra el día fallado como un hueco proporcional en un patrón más grande" [23].
- Duolingo es el caso de éxito del contador — y su blog documenta que el diseño se sostiene con amortiguadores (freezes, recordatorios) [24]; sin ese aparato, el contador pelado es frágil. En HN (sep 2026), sobre un tracker nuevo, la discusión madura llegó a la misma síntesis: **binario "¿lo hiciste?" separado de la medida "¿cuánto?"**, porque el tracking fino alimenta el razonamiento "no llego al target, entonces ya fue" [22].

### La forma seria de "2 de 7"

El patrón que sobrevive en herramientas serias es la **grilla de días** — el contribution graph de GitHub, la barra de uptime de 90 días de los status pages [30][31] — acompañada de un conteo plano: "2 de 7 días". Sin llama, sin animación, sin reset dramático. Para el gate de días consecutivos (que sí exige racha por contrato), la comunicación honesta es mostrar el estado de la racha como dato ("va 1 de 2 seguidos · un incumplido la reinicia"), no como logro emocional. El "mejor registro" (personal best) puede existir como referencia discreta [34], nunca como presión.

---

## Tema 5 · "Sin dato" ≠ "incumplió": el estado que este producto necesita bien resuelto

Este es el tema donde la investigación encontró más novedad 2026, y donde el caso NorthSignal (conversiones que maduran días después del clic) tiene resonancia directa.

### Los trackers serios ya son de 3+ estados

- **whph PR #193 (ene 2026)** implementa exactamente la lógica que necesitamos: estados `Complete / Not Done / Unknown`, donde "los días Unknown **se excluyen del denominador** en el cálculo de score, y las rachas **solo se rompen con un Not Done explícito**, no con días salteados" [32].
- **DropDrop (jul 2026)** publica la taxonomía completa — cinco estados: descanso planificado / completado / versión mínima / **skip intencional** / **missed** — con la regla de que el skip "protege el puente de la racha activa sin sumar día completado" y "se remueve del denominador de la tasa efectiva, mientras el objetivo crudo sigue disponible para revisión: **el registro no se vuelve ficción**" [33].
- **ViviDiary (ago 2026)** lo formula como principio: "días fallados como dato, no como falla"; sin "fallaste 3 veces esta semana" [34]. **smarter.day** usa el vocabulario mínimo: hecho / fallado / salteado a propósito / pospuesto — "un hábito fallado y un salto planificado no son lo mismo" [35]. Un tracker self-hosted publicado en Reddit (feb 2026) trae los mismos tres estados Done/Skipped/Missed de fábrica [36].
- El costo de resolverlo mal está medido: en 18.464 reviews de 6 apps de hábitos, **el reclamo más votado de toda la categoría es no poder corregir ayer** — "me perdí un tap a las 23:58 y mi registro queda mal para siempre" (sep 2026) [37].

### El precedente visual: gris = sin dato, rojo = falló

Los status pages son la referencia de producto serio: la barra de 90 días usa **gris para "sin datos del período"** y rojo (gradual por severidad) para caída [30][31]. Nadie confunde un gris con un rojo. La misma convención aparece en Linear (salud griseada cuando falta update [1]) y Perdoo ("No status", gris, "no hay datos todavía" [8]).

### La maduración: qué hacen los que miden publicidad

- Google documenta el problema y la herramienta: el reporte **Time lag** (Atribución → Path metrics) dice qué % de conversiones llega el día 0, 1, 2… [38]. GA4 declara la frescura por diseño: intraday parcial, "el día de ayer se completa durante la mañana" [41].
- La práctica recomendada por los especialistas: **excluir los últimos 3-7 días de cualquier análisis de performance** — "cuando mires 'últimos 7 días', mirá en realidad los días 8-14" [40].
- La formulación más precisa (jun 2026): **lookback buffers** — "tratá los datos más jóvenes que el umbral como **direccionales, no finales**", con el buffer calibrado al ciclo real de conversión; y compará cohortes a igual madurez, no un día de 2 días de madurez contra uno de 30 [39].

### Síntesis para el plan semanal

Cuatro estados visuales por día, con semántica dura:

| Estado del día | Visual | ¿Cuenta en el denominador? | ¿Afecta la racha? |
|---|---|---|---|
| Cumplió | lleno, positivo | sí | suma |
| No cumplió | marcado, negativo | sí | **la reinicia** |
| Madurando (sin dato aún, dentro de la ventana de lag) | gris con reloj | **no** | **la pausa** (ni suma ni rompe) |
| Sin dato definitivo (hueco confirmado) | gris vacío | no | la pausa, y se dice |

Con dos reglas de honestidad: (a) el veredicto de un día "madurando" **puede cambiar** cuando llega el dato — y si cambia un estado o resetea una racha, se anota el recálculo (la lección del reclamo #1: el sistema corrige ayer solo y lo cuenta [37]); (b) los gates que habilitan acciones **se evalúan solo sobre días maduros** — la versión NorthSignal del "excluí los últimos N días para decidir" [39][40], coherente con la regla de la casa: el gasto de ayer es definitivo, las conversiones no.

---

## Tema 6 · Tiempo restante: relativo para vivir, absoluto para anclar

- La regla operativa mejor documentada: **relativo hasta 7 días, absoluto después** — "3 hours ago"/"quedan 3 días" para lo cercano; fecha completa para lo lejano, porque el relativo viejo obliga a hacer cuentas ("¿hace 420 días?") [25]. Para deadlines, el absoluto baja carga cognitiva y es más accesible; el ideal es el par: **"quedan 3 días · termina el domingo 21"** [27]. La implementación es nativa: `Intl.RelativeTimeFormat` produce "en 3 días" localizado sin librerías [26].
- Sobre urgencia: el corpus de dark patterns (11K sitios crawleados) define el anti-patrón — countdowns que resetean, urgencia manufacturada [28] — y la literatura 2026 traza la línea con precisión: "un deadline real **informa** al usuario; un deadline falso lo **manipula**" [29]. El plan semanal tiene un deadline real (el domingo existe), así que el contador de días restantes es información, no presión. Lo que sería presión falsa: countdown con horas y segundos, colores de alarma sin cambio de estado, o urgencia visual sobre una acción que no vence.

**Para el plan:** "quedan N días" en texto plano al lado del estado, con el ancla absoluta. Y para los gates: la **fecha más próxima de habilitación** ("si hoy y mañana cumplen, se habilita el jueves") — que es un dato calculable y honesto, no una promesa.

---

## Tema 7 · Desbloqueo: el merge box de GitHub como patrón

El mejor precedente de "cumplí X para desbloquear Y" en producto serio no está en gamificación sino en el **pull request bloqueado**:

- GitHub muestra por cada requisito su estado individual (pasó / falló / pendiente — "Waiting for status to be reported"), y una frase de bloqueo que nombra el faltante exacto: "Merging is blocked — 1 approving review required". El botón existe pero está deshabilitado, con el porqué al lado [42][43].
- La literatura de *progressive unlock* agrega la regla del trigger: "¿qué evento prueba que está listo? **Ese evento es el disparador, no un timer**" [44]; Canva gatea features "por competencia demostrada, no por cantidad de sesiones" [45]. El desbloqueo como consecuencia visible de un logro concreto — y comunicado antes de lograrlo, para que se sepa qué falta [46].

**Trasladado al plan:** cada acción habilitante es una tarjeta-requisito estilo check de PR:

```
Bajar puja de [grupo X]                          🔒 bloqueada
Requisito: conv_rate ≥ 2% — 2 días seguidos (maduros)
[✓ mié] [⏳ jue madurando] [· vie] → va 1 de 2 · falta 1
Si el jueves confirma cuando madure, queda habilitada el viernes.
Un día incumplido reinicia el conteo.
```

Cinco piezas, siempre las cinco: requisito completo, estado por día, conteo "va X de Y", fecha más próxima de habilitación, y qué lo reinicia. Nada de barra de XP ni candados dorados: es un contrato, se muestra como contrato.

---

## Tema 8 · Lo que dicen los foros: ámbar-refugio, rojo-pedido-de-ayuda, y editar ayer

- **El ámbar como zona de confort es la queja #1** (projectmanagement.com, nov 2025): "algunas empresas están eliminando el amber: se usa como término medio 'seguro' — no tan verde, pero sin admitir el rojo — y demora la escalada". La defensa del ámbar solo vale "si está claramente definido y no se usa como zona de confort: 'riesgo emergente bajo control', no 'no queremos decir rojo todavía'". Y la variante que varios reportan como funcional: **verde/rojo binario + comentario**, o semáforo + nota de próximos pasos obligatoria [47].
- **Los umbrales son negociables, la existencia del umbral no** (PM StackExchange): "para algunos clientes 10% de desvío es Amber, para otros es Red" — depende de la tolerancia al riesgo — pero sin umbral pactado terminás en "¿es ámbar o rojo? ¿podemos decir naranja?" [49]. En Blind, la única receta concreta que se salvó de la antipatía general a los RAG semanales: **umbral duro** ("Red = 4+ semanas de atraso") + blockers con propuesta de solución [48].
- **La comunidad Asana lleva años pidiendo definiciones que la herramienta no impone:** "cada uno juzga cualitativamente distinto… es un nivel de confianza personal, PERO a mí me gustan los números". Los criterios observables que proponen: movimiento visible cada 2-3 días, blockers nombrados a tiempo [4].
- **El rojo tiene que comprar ayuda, no culpa** — el hilo conductor de toda la literatura watermelon [50][54][55] (Tema 2).
- **Y del lado hábitos, el hallazgo más votado en reviews reales:** poder corregir el pasado [37]. En un producto donde el pasado se corrige solo (la reconciliación por API ya corrige con el dato de Google), lo que falta es **contarlo**: "el miércoles pasó de 'madurando' a 'cumplió' hoy a las 10:50".

---

## Síntesis para NorthSignal · El contrato de progreso del plan semanal

Todo lo anterior, condensado en fórmulas y frases listas para el front. Notación: plan de `N` días evaluables (típicamente 7), requisito "cumplir `K` días" o "X días seguidos"; cada día con veredicto `cumplió / no_cumplió / madurando / sin_dato`.

**1. El estado del plan se calcula; el agente escribe el porqué.** [6][7][51][53]

```
e  = días transcurridos con veredicto definitivo (excluye madurando/sin_dato)
f  = días con no_cumplió
B  = N − K                      (presupuesto de fallos)
burn = (f/B) / (e/N)            (si B>0 y e>0)

f > B                 → CAÍDO        "ya no llega a K de N esta semana"
f = B  o  burn > 1    → EN RIESGO    "sin margen: un fallo más lo cae" / "consume margen más rápido que la semana"
f < B  y  burn ≤ 1    → EN CAMINO    "va f fallos de B permitidos, con e de N días evaluados"
e < 2                 → SIN SEÑAL    "muy temprano para evaluar: 1 día con dato"
```

Es el error budget del SRE Workbook en días [15][16], equivalente al gap esperado-real de Viva [7]. Con `B = 0` (exigencia perfecta), el plan está EN RIESGO por diseño desde el día 1 y la UI lo dice ("este plan no tolera ningún fallo").

**2. Cuatro estados por día, nunca tres.** Cumplió / no cumplió / **madurando** (gris con reloj) / sin dato definitivo (gris vacío). El gris no entra al denominador, no rompe rachas — las pausa — y solo un "no cumplió" explícito reinicia un conteo [30][32][33]. Leyenda fija bajo la grilla: "gris = aún sin dato (las conversiones tardan hasta N días en atribuirse); no es incumplimiento".

**3. Los gates se evalúan sobre días maduros.** La ventana de maduración por indicador sale del time-lag real de la cuenta [38][39][40]; gasto madura en 1 día (regla de la casa), conversiones en lo que diga el reporte. Un gate nunca se habilita con días "madurando"; si el dato posterior cambia un veredicto, el estado se recalcula y **el recálculo se anota visiblemente** [37][53].

**4. Progreso como burn-up discreto:** acumulado de días cumplidos contra la línea del requisito K, con los días restantes a la derecha [13][14]. Tres números siempre juntos: **van / faltan / quedan** — "van 2 cumplidos · faltan 3 · quedan 4 días".

**5. Racha sin fuego:** "va 2 de 3 seguidos", grilla plana, mejor-registro discreto opcional [23][34]. Sin animación de pérdida: si se reinicia, la frase es información — "el jueves incumplió: el conteo vuelve a 0 de 3" [21][23].

**6. Tiempo restante = relativo + ancla:** "quedan 3 días · termina el domingo 21" [25][26][27]. Para gates: **fecha más próxima de habilitación** calculada ("si hoy y mañana cumplen, se habilita el jueves 18"). Nunca countdown de horas: el deadline es real y diario, la precisión de segundos sería urgencia falsa [28][29].

**7. Tarjeta de desbloqueo = merge box:** requisito completo + estado por día + "va X de Y" + fecha más próxima + qué lo reinicia [42][43][44]. La acción bloqueada se ve (botón deshabilitado con porqué), no se esconde.

**8. La salud caduca:** si el plan no se re-evaluó en su cadencia (diaria), la salud se grisea con "sin evaluar desde el martes" — nunca queda el último color congelado [1][8].

**9. Frase corta obligatoria con el estado**, formato Atlas: qué estado + por qué + qué sigue ("En riesgo: 2 fallos de 2 permitidos consumidos en 3 días; si mañana cumple, sigue vivo hasta el viernes") [5][47]. El estado sin porqué es un color; con porqué es un reporte.

**10. Al cierre de semana, vocabulario de cierre:** cumplido / **parcial** / incumplido / abandonado (replan) — la taxonomía de Asana goals [3] — con el dato de cuántos días quedaron "sin dato definitivo", porque un plan "cumplido 4 de 5 evaluables sobre 7" es distinto de "cumplido 4 de 7" [33].

---

## Fuentes

Formato: título — URL — fecha — aporte. **(fetch)** = abierta y leída completa; **(exa)** = extractos sustanciales vía búsqueda semántica; **(búsqueda)** = leída desde resultados de búsqueda con contenido sustantivo.

### Salud de proyectos y goals

1. Initiative and Project updates — Linear Docs — https://linear.app/docs/initiative-and-project-updates — s/f, leída 13/9/2026 **(fetch)** — Los 3 estados; update = salud + texto; "Update Missing" tras un ciclo de recordatorio + 3 días; ícono gris por inactividad extendida y borde punteado por vencimiento leve; detalle de progreso solo si cambió >2%; "Write with Agent".
2. Agent-assisted project updates — Linear Changelog — https://linear.app/changelog/2026-06-18-agent-assisted-project-updates — 18/6/2026 **(fetch)** — El agente revisa cambios desde el último update + Slack vinculado, redacta el borrador y el humano lo refina y publica.
3. Status updates — Asana Developers — https://developers.asana.com/reference/status-updates — s/f **(búsqueda)** — Taxonomía completa por API: `on_track, at_risk, off_track` en período y `achieved, partial, missed, dropped` al cierre.
4. Best-Practice for Defining Status ("on track, concerned, off track") — Asana Forum — https://forum.asana.com/t/best-practice-for-defining-status-on-track-concerned-off-track/34629 — hilo iniciado 2018 **(fetch)** — La comunidad sin umbrales: "es un nivel de confianza personal, PERO me gustan los números"; criterios observables (movimiento cada 2-3 días, blockers a tiempo).
5. Use goal status to track objectives and key results — Atlassian Support — https://support.atlassian.com/platform-experiences/docs/use-goal-status-to-track-objectives-and-key-results/ — s/f **(búsqueda)** — On track/At risk/Off track + Pending/Paused/Completed; goals mensual, proyectos semanal; al cambiar estado "describí por qué y qué acciones necesitás".
6. Project boards on monday.com — monday.com Support — https://support.monday.com/hc/en-us/articles/22598441769746-Project-boards-on-monday-com — s/f **(búsqueda)** — Salud automática por regla: ">50% de tareas stuck → At Risk"; override manual posible.
7. Track OKR progress status — Microsoft Learn (Viva Goals) — https://learn.microsoft.com/en-us/viva/goals/track-okr-progress-status — actualizada 21/8/2025 **(fetch)** — La fórmula completa: esperado lineal 0→100% entre fechas; gap >25% → At Risk, 0-25% → Behind, ≤0 → On Track (umbrales editables); "Needs Attention" si a 7 días del inicio no arrancó; override manual documentado.
8. Goal statuses — Perdoo Support — https://support.perdoo.com/en/articles/4640875-goal-statuses — s/f **(fetch)** — 5 estados incluyendo "No status (gris): no hay datos todavía o no arrancó"; estado automático por progreso vs esperado con override; "Accomplished" siempre manual.
9. OKR scoring: don't do it like Google — Tability — https://www.tability.io/okrs/how-to-score-your-okrs — s/f **(fetch)** — Progreso ≠ confianza; check-ins semanales; el % "sin considerar cuánto tiempo queda" no alcanza; umbrales de cierre 0-60/60-80/80-100.
10. OKR progress calculation — PeopleForce Help — https://help.peopleforce.io/en/articles/8498885-okr-progress-calculation — s/f **(fetch)** — El contraejemplo: promedio de KRs sin línea de esperado ni umbral de estado.
11. Height.app Unveils First-Ever Autonomous Project Collaboration Tool — Businesswire — https://www.businesswire.com/news/home/20241008197812/en/ — 8/10/2024 **(búsqueda)** — Standups async y reportes de progreso generados automáticamente; Height cerró el 24/9/2025.
12. Show Progress — Shape Up cap. 13 (Basecamp) — https://basecamp.com/shapeup/3.4-chapter-13 — 2019, vigente **(búsqueda)** — El to-do no muestra lo desconocido; hill chart: subida = resolver incógnitas, bajada = ejecutar; "un punto que no se mueve es una mano levantada"; estado humano, no calculado.

### Progreso cuantitativo, pace y error budget

13. Burn up chart — Atlassian Agile Coach — https://www.atlassian.com/agile/project-management/burn-up-chart — s/f **(búsqueda)** — El burn-up separa trabajo hecho de alcance; el burndown "confunde cambio de alcance con falta de progreso".
14. Burndown and burnup: two charts every engineering dashboard needs — SquaredUp — https://squaredup.com/blog/burndown-and-burnup-two-charts-every-engineering-dashboard-needs/ — s/f **(búsqueda)** — La línea de total diagnostica: ¿falta velocidad o crece el alcance?
15. Alerting on SLOs — Google SRE Workbook — https://sre.google/workbook/alerting-on-slos/ — 2018, canónico **(búsqueda)** — Burn rate como velocidad de consumo del error budget; 14,4× en 1h = pagína (budget de 30 días en ~50h); 6× = investigá; multiwindow multi-burn-rate contra falsas alarmas.
16. Alerting on your burn rate — Google Cloud (SLO monitoring) — https://docs.cloud.google.com/stackdriver/docs/solutions/slo-monitoring/alerting-on-budget-burn-rate — s/f **(búsqueda)** — Fast burn (ventana corta, agotamiento inminente) vs slow burn (agota el budget antes del fin del período).
17. How to create an SLO status dashboard with error budget burn rate — OneUptime — https://oneuptime.com/blog/post/2026-02-06-slo-error-budget-burn-rate-grafana/view — 6/2/2026 **(búsqueda)** — Implementación 2026 del patrón: budget restante + burn rate como los dos números de salud.

### Rachas y cumplimiento por días

18. Don't break the chain: why we'll miss GitHub streaks — freeCodeCamp — https://www.freecodecamp.org/news/dont-break-the-chain-why-github-s-streaks-will-be-sorely-missed-by-many-4fff90bc2a38/ — 2016 **(búsqueda)** — GitHub eliminó el contador de rachas; el rediseño "se enfoca en el trabajo, no en la duración de la actividad".
19. Contribution graph can be harmful to contributors — issue isaacs/github #627 — https://github.com/isaacs/github/issues/627 — 2016, comunidad **(búsqueda)** — El argumento que precipitó el cambio: el gráfico premia no descansar; "un streak de 416 días = más de un año sin un día libre"; a los 2 meses GitHub quitó los streaks.
20. Why was the Contribution Streak removed?! — issue dear-github #163 — https://github.com/dear-github/dear-github/issues/163 — comunidad **(búsqueda)** — El reverso: usuarios pidiendo el streak de vuelta; la señal es divisiva.
21. Hilo sobre mecánicas de retención de Duolingo — Hacker News — https://news.ycombinator.com/item?id=46912793 — feb 2026, comunidad **(fetch)** — "Mantener la racha es estrés y fallarla impacta fuerte la motivación"; abandonar "en mis propios términos" como alivio; las rachas retienen a unos y expulsan a otros.
22. Show HN: Kadō — open-source habit tracker with non-binary habit score — Hacker News — https://news.ycombinator.com/item?id=49586902 — 6/9/2026, comunidad **(exa)** — La síntesis madura: binario "¿lo hiciste?" separado de la medida "¿cuánto?"; el tracking fino alimenta el "no llego al target, entonces ya fue".
23. Never Miss Twice: what 2,066 habits say about the second day — dev.to (loggd.life) — https://dev.to/beusebiu/never-miss-twice-what-2066-habits-say-about-the-second-day-bo7 — sep 2026 (snapshot de producción del 5/8/2026; 2.066 hábitos, 1.006 usuarios) **(fetch)** — Recuperación: 80,9% tras 1 fallo, 71,1% tras 2, 42,2% tras 7; el punto de decisión es el segundo día; grilla > contador ("el contador resetea a cero y genera all-or-nothing").
24. Which generation has the longest Duolingo streaks — Duolingo Blog — https://blog.duolingo.com/boomers-vs-gen-z-duolingo-streaks/ — 19/1/2023 **(fetch)** — El contador de racha se sostiene con amortiguadores (recordatorios, freezes); datos de rachas por generación.

### Tiempo restante y urgencia honesta

25. Absolute vs. relative timestamps: when to use which — UX Movement — https://uxmovement.com/content/absolute-vs-relative-timestamps-when-to-use-which/ — s/f **(búsqueda)** — La regla: relativo ≤7 días, absoluto después; el relativo viejo obliga a hacer cuentas.
26. Intl.RelativeTimeFormat — MDN — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat — s/f **(búsqueda)** — API nativa para "en 3 días"/"hace 2 días" localizado, sin librerías.
27. Relative vs absolute time — Mikael Cedergren — https://mikaelcedergren.substack.com/p/relative-vs-absolute-time — s/f **(búsqueda)** — El costo cognitivo y de accesibilidad del relativo; el absoluto como ancla inclusiva.
28. Dark Patterns at Scale: findings from a crawl of 11K shopping websites — Mathur et al., arXiv — https://arxiv.org/pdf/1907.07032 — 2019, canónico **(búsqueda)** — El anti-patrón documentado: countdowns que resetean al recargar, urgencia manufacturada.
29. Scarcity marketing: 11 examples & tactics — scandiweb — https://scandiweb.com/blog/scarcity-marketing-examples-tactics/ — 2026 **(búsqueda)** — "Un deadline real informa; un deadline falso manipula"; la línea legal se endureció (DSA/FTC); señales de cantidad superan a las de tiempo.

### Dato faltante, maduración y estados por día

30. Display historical uptime of components — Atlassian Statuspage — https://support.atlassian.com/statuspage/docs/display-historical-uptime-of-components/ — s/f **(búsqueda)** — La barra de 90 días, un segmento por día: el precedente serio de grilla diaria de estado.
31. Status page examples and best practices — PingPing — https://pingping.io/guides/status-page-examples — s/f **(búsqueda)** — La convención de color: gris = sin datos del período, distinto de rojo = caída; 90 días escaneables de un golpe.
32. feat(habits): three-state tracking — PR #193 de ahmet-cetinkaya/whph — https://github.com/ahmet-cetinkaya/whph/pull/193 — 11/1/2026, comunidad **(exa)** — La lógica exacta: `Complete / Not Done / Unknown`; los Unknown salen del denominador del score; la racha solo se rompe con Not Done explícito.
33. Habit tracker with rest days: skip without losing the pattern — DropDrop — https://www.dropdrophabit.com/blog/habit-tracker-with-rest-days — 28/7/2026 **(exa)** — Taxonomía de 5 estados (descanso planificado / completado / versión mínima / skip intencional / missed); el skip protege el puente de la racha y sale del denominador efectivo; "el registro no se vuelve ficción".
34. Missed days as data, not failure — ViviDiary Blog — https://blog.vividiary.live/inside/missed-days-as-data-not-failure-ux — 16/8/2026 **(exa)** — El principio como filosofía de producto: el fallo es dato observacional; sin "fallaste 3 veces esta semana"; personal-best discreto en vez de racha punitiva.
35. How to track missed habits without quitting — Smarter.Day — https://smarter.day/en/blog/how-to-track-missed-habits — s/f **(exa)** — Vocabulario mínimo: hecho / fallado / salteado a propósito / pospuesto; completar ≠ consistencia.
36. Habit Tracker v0.1.4 (post de Reddit, espejo) — https://reddit.sentinel-team.org/posts/1r4pm3n/snapshots/2026-02-21T03%3A43%3A24.736776Z — feb 2026, comunidad **(exa)** — Tracker self-hosted publicado en Reddit con "Three-State Logic: Done / Skipped / Missed" de fábrica: el estándar emergente llegó al hobbyista.
37. I read 18,464 reviews of 6 habit tracker apps — dev.to (eltacrew) — https://dev.to/eltacrew/i-read-18464-reviews-of-6-habit-tracker-apps-the-1-upvoted-complaint-is-something-none-of-them-go9 — 12/9/2026 **(exa)** — El reclamo más votado de la categoría: no poder corregir ayer ("me perdí un tap a las 23:58 y mi registro queda mal para siempre"); mostrar límites el día 1; el check no puede esperar a la red.
38. Find your conversion lag reporting data — Google Ads Help — https://support.google.com/google-ads/answer/9347065 — s/f **(búsqueda)** — El reporte oficial Time lag (Atribución → Path metrics): % de conversiones en día 0, 1, 2…; la ventana de maduración se mide, no se supone.
39. Conversion lag reporting issues — Cometly — https://www.cometly.com/post/conversion-lag-reporting-issues — 2/6/2026 **(fetch)** — "Lookback buffers": datos más jóvenes que el umbral se tratan como direccionales, no finales; comparar cohortes a igual madurez; el sesgo de recencia hace ver débil lo nuevo.
40. Understanding conversion lag in Google Ads Shopping campaigns — SKU Analyzer — https://skuanalyzer.com/guides/conversion-tracking/conversion-lag/ — s/f **(búsqueda)** — La práctica: excluir los últimos 3-7 días; "última semana" real = días 8-14; calibrar con el time-lag propio (~95% de completitud).
41. Data freshness — Google Analytics Help (GA4) — https://support.google.com/analytics/answer/11198161 — s/f **(búsqueda)** — Frescura declarada por diseño: intraday parcial; ayer se completa durante la mañana; eventos aceptados hasta 2 días tarde.

### Desbloqueo y gating

42. About status checks — GitHub Docs — https://docs.github.com/articles/about-status-checks — s/f **(búsqueda)** — El patrón: estado individual por requisito (pasó / falló / pendiente — "Waiting for status to be reported").
43. About protected branches — GitHub Docs — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches — s/f **(búsqueda)** — Merge bloqueado hasta cumplir requisitos; el botón deshabilitado nombra el faltante exacto.
44. Progressive Feature Unlock — AI UX Playground — https://aiuxplayground.com/pattern/progressive-feature-unlock/ — s/f **(búsqueda)** — La regla del trigger: "¿qué evento prueba que está listo? Ese evento dispara el unlock, no un timer".
45. What is progressive disclosure? — UXPin — https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/ — 2026 **(búsqueda)** — Canva gatea features "por competencia demostrada, no por cantidad de sesiones"; gating de capacidades riesgosas hasta que haya confianza.
46. Unlock features: reward users with new capabilities — Learning Loop — https://learningloop.io/plays/psychology/unlock-features — s/f **(búsqueda)** — El requisito se comunica antes de cumplirse; el unlock como consecuencia visible de un logro concreto.

### Foros, watermelon y estado honesto

47. Should we keep using amber in project RAG status reporting? — projectmanagement.com (discusión) — https://www.projectmanagement.com/discussion-topic/230099/should-we-keep-using-amber-in-project-rag-status-reporting--or-move-to-a-simpler-binary-system---just-green-or-red- — 2/11/2025, comunidad **(exa)** — El ámbar como "safe middle ground" que demora la escalada; vale solo si significa "riesgo emergente bajo control"; alternativa: binario + comentario con próximos pasos.
48. What's a better way than red/amber/green weekly status reports — Blind — https://www.teamblind.com/post/whats-a-better-way-of-doing-things-than-redambergreen-weekly-status-reports-car8xw7n — 27/10/2021, comunidad **(fetch)** — RAG semanal impopular; lo único rescatado: umbrales duros ("Red = 4+ semanas de atraso") y blockers con propuesta de solución.
49. Applying an overall project RAG status — PM StackExchange — https://pm.stackexchange.com/questions/5752/applying-an-overall-project-rag-red-amber-green-status — 2012, comunidad **(exa)** — Los umbrales dependen de la tolerancia del cliente (10% de desvío es Amber para unos, Red para otros); sin umbral pactado: "¿es ámbar o rojo? ¿podemos decir naranja?".
50. Watermelon reporting: when project status hides the truth — Cultivated Management — https://www.cultivatedmanagement.com/watermelon-reporting/ — 19/6/2024 **(exa)** — La verdad se esconde cuando es personalmente cara; "Red dejó de significar 'fallaste' y empezó a significar 'sabemos dónde está el problema; ¿cómo ayudamos?'"; los problemas tempranos son problemas baratos.
51. Stop painting watermelons: why green RAG statuses hide red rot — ContinuumPSA — https://www.continuumpsa.io/single-post/stop-painting-watermelons-why-green-rag-statuses-hide-red-rot — 11/2/2026 **(exa)** — "RAG calculado por el sistema, no elegido de dropdown: varianza >5% → Amber, >10% → Red; ningún optimismo pisa un campo calculado"; "rojo bueno, rojo accionable".
52. What is a watermelon project? — RoadmapOne — https://roadmap.one/blog/posts/blog53-watermelon-project/ — 22/6/2026 **(exa)** — "La forma verde, verde, ámbar, ámbar, ámbar, rojo es en sí misma la delación"; un rojo súbito = el ámbar escondía rojo; la meseta ámbar larga pide auditoría.
53. Watermelon reporting: when a green release is really red — Divim — https://www.divim.io/watermelon-reporting-jira/ — 22/7/2026 **(exa)** — El watermelon "crece en el gap entre chequeos"; el estado vira a ámbar "cuando el dato se mueve, no en la reunión posterior"; abrir el reporte con un número, no con un color ("la fecha aguanta con 85% de confianza").
54. Watermelon projects: green on the outside, red on the inside — Impactful PM — https://www.impactfulpm.com/post/watermelon-projects-green-on-the-outside-red-on-the-inside — 14/9/2025 **(exa)** — Definiciones operativas: Red = re-decidir (plata/tiempo/alcance), Amber = necesito ayuda de governance, Green = bajo control del equipo; la causa #1: stakeholders que no quieren escuchar.
55. A watermelon status is worse than a red status — Projilent — https://www.projilent.com/a-watermelon-status-is-worse-than-a-red-status/ — s/f **(exa)** — La fábula gerencial: reportar rojo temprano compra ayuda; ocultarlo garantiza que el problema crezca; el rojo como herramienta, no como confesión.
