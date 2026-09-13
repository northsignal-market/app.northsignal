# 17 · Arquitectura de paneles: la investigación que refutó casi todo

**Fecha:** 13 de septiembre de 2026
**Disparador:** el feedback de Andrés sobre el rediseño — "todo está horizontal, falta
apilar bloques y armar dashboard, redimensionar secciones"; "el header se repite"; "el menú
contraído se sigue viendo"; "la bandeja se ve incómoda".
**Método:** 5 ángulos → 111 agentes → 1.294 búsquedas y fetches → 27 afirmaciones puestas a
verificación adversarial de 3 votos.

## El resultado, sin maquillar: sobrevivieron 3 de 27

**Este informe es principalmente un HALLAZGO NEGATIVO, y por eso vale.** De las cinco
preguntas, cuatro quedaron sin una sola afirmación verificada. Lo que se creía "estado del
arte citable" resultó no serlo.

### Lo que SÍ sobrevivió (3 afirmaciones)

1. **El diagnóstico de Grafana sobre por qué fracasan los dashboards densos** (2-1): el
   problema es de **relevancia y layout**, no de estética — en un tablero grande solo un
   subconjunto le sirve al que mira, y algunos layouts no son responsive. *Pero su remedio
   embarcado —ocultar paneles sin datos— es ILEGAL acá*: choca de frente con "los datos que
   piden acción no se esconden". Y su premisa es multi-audiencia (ingenieros/ejecutivos);
   NorthSignal tiene UN operador, así que el argumento de subconjunto-por-rol no aplica.
   **Se toma el diagnóstico, se descarta la cura.**
2. **El drag-resize NO viola el presupuesto de dependencias** (3-0): `react-resizable-panels`
   v4.12.4 tiene cero dependencias de producción y pesa ~11 kB gzip (los 554 KB del paquete
   son 76% sourcemaps). **Esto resuelve el COSTO, no el VALOR**: si sirve en una app de un
   solo operador sigue siendo pregunta abierta.
3. **La persistencia de layout tiene una regla operativa precisa** (3-0): guardar en el
   COMMIT, no en cada movimiento del puntero — `onLayoutChanged` (dispara al soltar), nunca
   `onLayoutChange` (dispara por frame durante el arrastre).

### Lo que NO sobrevivió (24 afirmaciones, todas las reglas concretas)

- **Cayeron 0-3 las tres reglas de Datadog**: grilla de 12 columnas como unidad de span,
  "High Density Mode" en pantallas anchas, y los pisos mínimos por tipo de widget
  (timeseries 4/12, listas 6/12).
- **Cayó el corpus académico entero**: el eye-tracking de TVCG sobre layouts, el corpus de
  144 dashboards (49% stratified vs 19% table), la ley de compensación de cuatro parámetros,
  DMiner sobre tamaño no uniforme, el survey de arXiv.
- **Cayeron cuatro afirmaciones sobre el auto-layout de Grafana** degradando el drag-resize.
- **Preguntas 2 a 5: cero afirmaciones sobrevivientes.** Nada verificable sobre jerarquía
  app-header/page-header, sobre rail vs oculto vs overlay, sobre si el hover-expand es un
  antipatrón medido, sobre altura de fila o sticky group headers, ni sobre UX de generadores
  con IA, widgets de ayuda o vistas de reportes.

## La consecuencia, que es incómoda y limpia

**"12 vs 6 columnas", "2/3 vs 1/3", row-span, cuál bloque es grande y cuándo el bento está
justificado NO tienen autoridad externa verificada.** Las decisiones estructurales que se
tomaron el 13/9 (propuestas 7 / pendientes 5, objetivos 5 / escalera 7, plan 7 /
predicción 5, tendencia a 12) son **convenciones declaradas de NorthSignal con fundamento
interno**, no citas. El fundamento interno que las sostiene, y que sí es propio:

- Los bloques que se **leen juntos para decidir** comparten fila (propuestas con pendientes;
  objetivos con escalera; plan con predicción). El criterio no es el tamaño: es la pregunta.
- El que necesita **ancho por su forma** lo toma entero (la tendencia: 14 días y dos ejes).
- Lo que es **consulta y no lectura diaria** se pliega (contexto de la cuenta).

Eso se sostiene solo, y hay que decir que se sostiene solo — no fingir que lo dice una
autoridad.

## Un hallazgo que salió de leer NUESTRO código, no la web

Un verificador fue al repo y encontró algo que la queja no decía: **el sidebar contraído ya
es ancho cero**; lo que vive como estado "abierto" es un **rail de 64px con hover-expand a
240px**. O sea que la queja "el menú cuando se contrae todavía se ve" puede ser anterior al
ocultamiento total… **o estar apuntando a otra cosa: que el estado abierto nunca se ve
abierto.** Un rail de iconos que solo muestra los nombres cuando pasás el mouse no se siente
"abierto" — se siente permanentemente contraído.

**Acción tomada (14/9):** el sidebar pasa a dos estados honestos — **abierta de verdad**
(208px con iconos y nombres, sin depender del hover) y **oculta** (0px), con ⌘B y
preferencia persistida. El hover-expand se retira: era la razón de que "abierta" no se
viera abierta.

## Lo que queda abierto y hay que decidir mirando, no citando

1. **¿Drag-resize?** El costo está resuelto (11 kB, cero deps). El valor, no. Es decisión de
   Andrés: en una app de un operador con preferencia estable, se configura una vez y no se
   toca más — lo que puede ser un argumento a favor (queda a su gusto) o en contra (no paga
   la complejidad). Si se hace, la regla es persistir en `onLayoutChanged`.
2. **Las reglas de densidad y ritmo de fila** se calibran mirando la app con datos reales, no
   buscando un paper: ninguno sobrevivió.
