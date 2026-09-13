# 04 · Interfaces para sistemas operados junto a agentes de IA (human-in-the-loop)

**Estado del arte 2024-2026 · Investigación web · Septiembre 2026**

Eje: cómo los mejores productos del período presentan acciones propuestas por agentes para que
un humano decida, cómo muestran confianza y evidencia sin ruido, cómo cuentan "qué pasó mientras
no estabas", cómo exponen la salud de los agentes, qué anti-patrones ya están documentados,
cuándo conviene chat y cuándo UI estructurada, y cómo se nombra lo que hace la IA.

Filtro aplicado: todo se leyó con los ojos de NorthSignal — varios agentes automáticos
(semanal, pulso diario, centinela, reconciliador, ejecutor, sesiones de Claude) sobre una misma
base, un solo humano que decide, y la regla de que nada cambia en Google Ads sin su aprobación.

Las citas [n] refieren a la lista numerada de fuentes al final.

---

## 1. Flujos de aprobación: cómo se presenta una acción propuesta

### 1.1 El patrón dominante: propuesta estructurada + cuatro respuestas posibles

La convergencia más clara del período: una acción propuesta por un agente se presenta como
**objeto estructurado** (no como texto libre) y el humano tiene exactamente cuatro respuestas.
El Agent Inbox de LangChain lo formaliza: **Accept** (ejecutar tal cual), **Edit** (modificar
los argumentos antes de ejecutar), **Respond** (contestar en texto libre sin ejecutar) e
**Ignore** (descartar). Cada interrupción declara por configuración cuáles de las cuatro
permite (`allow_accept`, `allow_edit`, `allow_respond`, `allow_ignore`) — no toda acción
merece las cuatro [26]. Esto valida el diseño de NorthSignal (accionable con `Accion JSON`)
y sugiere el faltante: **editar los parámetros de la acción sin rechazarla entera**.

### 1.2 Diff antes de aplicar

GitHub asumió que el agente produce y el humano revisa un **diff**, nunca un resultado ya
aplicado: el coding agent trabaja en una rama, abre un PR y "requests a review from you";
nada llega a main sin revisión humana [16]. Copilot Workspace (2024) fue más lejos:
del issue sale una **especificación editable**, de ahí un **plan editable paso a paso**
(qué archivos toca y qué hace en cada uno), y recién después el código — el humano puede
corregir en la etapa más barata: el plan, no el resultado [15]. El equivalente para Ads:
mostrar siempre `valor actual → valor propuesto` (el diff de presupuesto, de CPC, de estado)
y dejar corregir la propuesta antes de que exista la ejecución.

### 1.3 Simulate / dry-run: el patrón plan → apply

El modelo mental más robusto viene de infraestructura: `terraform plan` genera una vista
previa exacta de lo que va a cambiar sin tocar nada, se puede guardar como archivo y
alimentar a `apply` para garantizar que **lo aprobado es exactamente lo que se ejecuta**,
sin deriva entre preview y ejecución [46]. Trasladado a agentes: la propuesta aprobada se
congela (estructura, no texto) y el ejecutor aplica esa estructura literal — exactamente la
regla de NorthSignal de que "un cambio se aplica desde una estructura". Lo que falta copiar
es la otra mitad: **mostrar el plan calculado** ("esto va a pasar: presupuesto de X a Y,
~Z% del gasto semanal") como parte de la tarjeta de aprobación.

### 1.4 Aprobación selectiva por riesgo, no por categoría

Todos los marcos serios convergen en gatear por **consecuencia y reversibilidad**, no por
tipo de acción. OpenAI: intervención humana para acciones "sensitive, irreversible, or have
high stakes", y escalada automática cuando el agente supera umbrales de reintento [9].
Anthropic: "humans should retain control over how their goals are pursued, particularly
before high-stakes decisions", con permisos de solo-lectura por defecto y aprobación previa
para escribir [8]. Zapier lo hace configurable por herramienta: un toggle **"Require approval
before running"** que pausa al agente antes de usar esa herramienta específica; además pausa
sola si una corrida excede 75 tareas [19][20][21]. Salesforce (Agentforce) configura
aprobaciones y rutas de escalada "based on risk, context, or sensitivity" [22][23].
WorkOS agrega el criterio fino: gatear "on consequence and reversibility, not on a fixed
category like 'write access'" — actualizar un ticket y borrar producción son ambas
escrituras, pero no el mismo riesgo [38].

### 1.5 Batch approval: existe, y es un arma de doble filo

Aprobar en lote aparece en todos los inboxes de agentes (revisar N interrupciones seguidas),
pero la literatura de seguridad 2026 ya cataloga el abuso: "Human Approval Fatigue
Exploitation" — esconder una operación riesgosa dentro de un lote de benignas para que pase
en la aprobación masiva [38]. La mitigación de diseño: lote solo para riesgo bajo y
homogéneo (misma clase de acción, misma cuenta), y **las acciones de riesgo medio/alto se
aprueban de a una**, con su valor previo a la vista. Nunca un "aprobar todo" que mezcle
clases de riesgo.

### 1.6 Undo y reversibilidad como requisito de la aprobación

Apple HIG (Machine Learning · Corrections): dar formas familiares de corregir, mostrar los
pasos que la automatización tomó para que la persona pueda usar los mismos controles para
refinar o **deshacer**, y persistir las correcciones para no pedirlas dos veces [6].
La exigencia de NorthSignal (valor anterior obligatorio en riesgo medio) es exactamente esto;
el estado del arte agrega: el valor anterior no es solo un dato guardado, es **parte visible
de la tarjeta** ("$450 → $520 · revertible") y el botón de revertir vive en el historial de
lo aplicado, no escondido en un ticket.

### 1.7 Co-planificación: aprobar el plan, no solo la acción

Magentic-UI (Microsoft Research, 2025) formaliza seis mecanismos de involucramiento humano
de bajo costo: **co-planning** (el humano edita el plan antes de que el agente ejecute),
**co-tasking**, **action guards** (acciones irreversibles requieren aprobación explícita),
**answer verification**, multitasking y memoria de planes aprobados [34]. Devin 2.1 (Cognition)
agregó la pieza de confianza: el agente **evalúa su propia confianza en el plan** y solo
interrumpe pidiendo aprobación cuando está inseguro; si está confiado, procede y acepta
feedback asíncrono [24]. Es el patrón para el semanal de NorthSignal: los accionables de
confianza alta van directo a la cola de decisión; los de confianza baja deberían llegar
como *pregunta* ("encontré esto, ¿lo convierto en accionable?"), no como propuesta a medias.

---

## 2. Confianza y evidencia sin ruido

### 2.1 Score numérico vs. categorías: la evidencia favorece categorías + número disponible

La investigación clásica de trust calibration (Zhang, Liao & Bellamy, FAT* 2020) mostró que
mostrar confianza **sí calibra** la confianza del usuario (la gente confía más cuando la
confianza declarada es alta y menos cuando es baja), pero **no necesariamente mejora la
decisión conjunta** — calibrar confianza no es lo mismo que calibrar el resultado [35].
Trabajo más reciente sobre LLMs (UMAP 2025) confirma que los ratings de confianza afectan
la confianza del usuario de forma medible [36]. En la práctica de producto 2025-2026 la
convergencia es: **lenguaje cualitativo o visual primero** ("alta/media/baja", color, badge),
**número exacto disponible** al expandir, y número solo protagonista cuando está
genuinamente calibrado (no un 87% decorativo) [37 nota, 39]. Google PAIR lo dijo primero:
los confidence displays ayudan "si es que" se muestran — "Determine how to show model
confidence, **if at all**" es un patrón con nombre propio; la información estadística
confunde a muchos usuarios y hay que testearla [4][5].

Para NorthSignal: el semanal ya emite confianza. La forma de presentarla con menos ruido:
tres niveles visuales (alta/media/baja) en la tarjeta, con el valor numérico y el método
adentro del expandible. Y una regla de honestidad: si la confianza no está calibrada contra
resultados reales todavía, mostrar categorías, no porcentajes.

### 2.2 Procedencia: qué agente, qué datos, qué ventana

Tres marcos convergen en que cada output de IA lleve **atribución de origen**:

- **Microsoft HAX G11** ("Make clear why the system did what it did"): acceso a una
  explicación local de cada output — con la advertencia de que la mera presencia de una
  explicación **infla la confianza** y puede causar sobre-dependencia [1][2][3].
- **IBM Carbon for AI**: el **AI label** — etiqueta consistente en cualquier cosa generada
  por o con IA, que además es la **puerta de entrada a la explicabilidad** (clic en la
  etiqueta → de dónde salió, qué modelo, qué datos) [10].
- **Linear AIG**: identidad inequívoca — un agente jamás puede confundirse con una persona;
  el avatar y el nombre del agente acompañan todo lo que hace [12].

Traducción directa: cada accionable y cada cifra de NorthSignal lleva una línea de
procedencia — **qué agente la produjo, sobre qué ventana de datos, cuándo** ("Semanal ·
17 días al 10/9 · Fresh Monkee/grupo Este"). Esa línea es el equivalente del AI label:
compacta, consistente, expandible.

### 2.3 Evidencia colapsable: progressive disclosure

NN/g (dic. 2025, sobre IA explicable en interfaces de chat): los usuarios **casi nunca
clickean las citas** aunque digan que las valoran; las citas igual cumplen función de
señal de verificabilidad. Lo que funciona: fuentes como **chips clickeables adyacentes a la
afirmación específica** que respaldan (no al final), con etiquetas significativas (no
"Fuente"), y linkeando a la sección relevante para bajar el costo de verificar [30].
PAIR: "Explain for understanding, not completeness" — solo la información que la persona
necesita en ese momento; el resto, en capas [4]. NN/g también documenta que el
razonamiento paso-a-paso mostrado suele ser **racionalización post-hoc**, no el cómputo
real — mostrar "chain of thought" como evidencia es teatro [30].

Patrón resultante, hoy estándar: **tarjeta de una línea → expandible con evidencia → link
al dato crudo**. La evidencia buena no es la transcripción del razonamiento del agente,
sino **los números que cualquiera puede re-verificar**: la consulta, la ventana, los valores.

### 2.4 La explicación correcta depende del receptor

NN/g ("Crafting AI Explanations for Every Role"): la explicación para quien decide no es la
que necesita quien audita [31 índice]. Para un producto de un solo operador experto como
NorthSignal esto simplifica: Andrés no necesita pedagogía de IA — necesita **el veredicto,
el radio de evidencia y el costo de equivocarse**, en ese orden.

---

## 3. "Qué pasó mientras no estabas": feeds de actividad multi-agente

### 3.1 Los cinco patrones de gestión de agentes (y cuál corresponde acá)

LukeW Wroblewski (2025) cataloga cinco patrones de interfaz para gestionar múltiples
agentes: **kanban** (agentes como tarjetas por etapa), **dashboard** (visualizaciones
agregadas), **inbox** (cronológico, requiere acción para procesar), **task list** (unidades
accionables con estados) y **calendario** (agentes mapeados a tiempo) [33]. Su observación
clave: el inbox es familiar pero escala mal con volumen alto; el dashboard es flexible pero
fragmenta. La práctica 2026 (Cursor Agents Window, Devin sessions, Notion agents) combina
dos: **un inbox chico para lo que pide decisión + un log cronológico completo para auditar**.
NorthSignal ya tiene la semilla exacta de esto: `v_para_actuar` es el inbox,
`cambios_recientes` es el log. Lo que falta es la presentación.

### 3.2 Inbox ≠ feed: tres niveles de interacción

LangChain distingue tres niveles que ordenan todo el diseño del feed: **Notify** (enterate,
no hace falta que hagas nada), **Review** (validá esta acción) y **Question** (contestame
para desbloquearme) [26][27]. El error común es mezclarlos en una sola lista: las
notificaciones entierran las decisiones. La separación correcta:

- **Cola de decisión** (Review/Question): pocas entradas, cada una bloquea algo, se vacía.
  Con estado read/unread real y conteo visible.
- **Feed de actividad** (Notify): todo lo que los agentes hicieron, agrupado, nunca exige
  acción. Se lee en 30 segundos o no se lee, y no pasa nada.

### 3.3 Agrupar por actor y por tiempo, con recorte en "desde tu última visita"

Slack Catch Up (2024) valida el modelo "ponete al día": lo no leído presentado como
secuencia procesable de a uno, pensado para el inicio y el fin del día [44]. GitHub
Notifications agrupa por repositorio y separa "requiere tu acción" del resto [45]. El
patrón compuesto para un feed multi-agente: **agrupar por agente** (el pulso diario dice
una cosa por día; no 14 filas), **colapsar corridas sin novedad** ("Centinela: 6 corridas,
sin anomalías" en una sola línea), y **anclar en la última visita** ("desde el martes:
2 propuestas nuevas, 1 reconciliación con diferencias, 43 corridas limpias").
El "overview panel" de los patrones de agentes ambientales resume exactamente eso: estado
actual, misiones recientes, qué necesita atención humana, métricas de output [40].

### 3.4 El activity log como historia de versiones

Los patrones de agent UX 2026 tratan el log de actividad como "version history for agent
behavior": cada acción, cada decisión, cada resultado, encadenados [41][42]. Notion 3.0
lo implementa: el agente muestra qué páginas tocó y qué hizo en cada una al terminar su
corrida de hasta 20 minutos [25]. Para NorthSignal, `registrar_cambio` ya captura el "por
qué" — el feed debería renderizar esa tabla tal cual, con el porqué visible sin clic,
porque es el dato que más sirve a la sesión siguiente (humana o de Claude).

---

## 4. Estado y salud de los agentes en la UI

### 4.1 El vocabulario de estados ya está estandarizado

Atlassian Statuspage fijó el vocabulario que todo el mundo copia: **Operational / Degraded
Performance / Partial Outage / Major Outage / Under Maintenance**, con una regla de
agregación automática: el estado global es el peor de los componentes ("if any component is
Degraded, top-level shows Partially Degraded Service") [28]. Para un panel de agentes:
cinco agentes → una sola línea global calculada igual ("Sistema: 1 tarea en silencio"),
y el detalle por agente atrás.

### 4.2 Silencio es señal: el latido que falta

El caso documentado más ilustrativo del período: siete agentes en cron, dos **nunca
corrieron desde el día uno**, dieciocho días de dashboards verdes — el tracing no lo
detectó, porque un cron que no dispara produce **cero señal**; lo que lo atrapó fue un
heartbeat de última-corrida-exitosa con contrato de exit code [43]. El patrón: cada tarea
escribe su "último éxito" al completar, y un verificador independiente marca cualquier
tarea cuyo último éxito sea más viejo de lo que su cadencia implica. NorthSignal ya lo
tiene (`v_tareas_en_silencio`) — el hallazgo de UI es que ese estado merece **presencia
permanente y pasiva** en la interfaz: una fila por agente con "último latido hace X",
verde/ámbar/rojo por umbral de su propia cadencia, no un query que hay que acordarse de correr.

### 4.3 Qué muestran los orquestadores: la corrida como objeto navegable

Los orquestadores 2025-2026 (Temporal, Inngest, Trigger.dev, n8n, LangSmith) convergen en
la misma anatomía de UI: **lista de corridas** (estado, duración, disparador) → **detalle
de corrida** (traza paso a paso, inputs/outputs de cada paso, errores) → **replay/retry**
desde el paso fallido [27, comparativas]. LangSmith estructura todo como *runs* dentro de
*traces* navegables, con colas de anotación para revisión humana [27]. Linear obliga a los
agentes a emitir su estado interno como parte del protocolo: *thinking / awaiting input /
executing / complete*, con feedback inmediato (menos de 10 segundos) al ser invocados [12][13][14].
Lección directa: cada corrida del semanal, del pulso o del reconciliador es un objeto con
URL propia, estado, duración y pasos — no una fila de log.

### 4.4 Estados de agente para mostrar al operador

Sintetizando Linear AIG + Statuspage + orquestadores, el conjunto mínimo de estados por
agente que un operador necesita ver: **activo** (corriendo ahora), **ok** (último éxito
dentro de cadencia), **en silencio** (se pasó de su cadencia — el estado más peligroso
porque no grita), **degradado** (corre pero con errores parciales o datos incompletos),
**esperándote** (bloqueado en una decisión humana — este es el único que debería notificar),
y **apagado** (deliberadamente inactivo, para que el silencio intencional no se confunda
con el accidental).

---

## 5. Anti-patrones documentados y sus mitigaciones

### 5.1 Automation bias / rubber-stamping

El anti-patrón central de los sistemas de aprobación: el humano que aprueba todo por
reflejo. La investigación 2024-2026 sobre "designed friction" y cognitive forcing functions
muestra que la fluidez extrema **produce** el sesgo: si aprobar cuesta cero, aprobar se
vuelve el default cognitivo [37]. Las mitigaciones documentadas:

- **Fricción selectiva**: costo de interacción proporcional al riesgo. Riesgo bajo: un clic.
  Riesgo medio: expandir para ver el diff antes de que el botón se active. Riesgo alto:
  confirmación con re-tipeo o espera deliberada [37][38].
- **Cognitive forcing**: mostrar el dato que obliga a pensar (el valor previo, el % de
  cambio, el gasto en juego) **antes** del botón, no después [37].
- **Monitorear la fatiga misma**: tiempo-hasta-aprobar cayendo mientras el volumen sube =
  el control se volvió teatro. WorkOS recomienda trackear volumen de aprobaciones,
  time-to-approve y tasa de rechazo como métricas de salud del control [38].
  Un sistema donde el humano rechaza 0% de las propuestas no tiene un humano en el loop —
  tiene un botón lento.

### 5.2 Sobre-notificación

La literatura de SOCs es la advertencia extrema: ~3.000 alertas diarias, 55-63% sin
investigar; el exceso de señal **es** la falla [47]. La mitigación es arquitectural, no
cosmética: contexto adjunto antes de que la alerta llegue a la persona, ruteo por riesgo,
y solo lo irreversible interrumpe [47][38]. Regla práctica para NorthSignal: **un solo
canal interrumpe** (la cola de decisión); todo lo demás espera a que Andrés abra la app.
El pulso diario informa, no notifica.

### 5.3 Falsa autoridad y explicación-como-teatro

Tres hallazgos convergentes: la mera presencia de una explicación aumenta la confianza
aunque la explicación sea mala (HAX G11) [3]; el lenguaje antropomórfico infla la confianza
más allá de lo justificado (NN/g) [30]; los disclaimers vagos escondidos al pie no los lee
nadie — funciona el estilo "Claude can make mistakes. Please double-check responses":
visible y accionable [30]. Y el hallazgo de NN/g sobre sentience: la competencia percibida
(justificar con datos verificables) construye más confianza que la calidez o la
personalidad [32]. Mitigación: voz seca, números re-verificables, cero "creo que" y cero
"¡listo! 🎉".

### 5.4 Radio de acción mayor que el radio de evidencia

GitHub lo documenta como red flags de PRs de agentes: cambios grandes sin scope, y la regla
"any change that weakens CI is a blocker" [18]. El principio general — que NorthSignal ya
tiene como invariante — es que la acción no puede exceder la evidencia. El hallazgo de UI:
**mostrar el radio en la tarjeta** ("evidencia: término X en grupo Y · acción: negativa en
grupo Y" ✓) para que el mismatch sea visible de un vistazo, no un dato que hay que ir a buscar.

### 5.5 El "no aplicaba" tratado como falla

Cómo mueren las alertas: tratando el dominio-no-válido como error (regla ya interna de
NorthSignal, confirmada por la literatura de alert fatigue: cada falso positivo gasta
confianza del operador [47]). En UI: `no_aplicaba` se pinta neutro, nunca rojo.

---

## 6. Chat vs. UI estructurada: cuándo cada una

### 6.1 La evidencia contra el chat-para-todo

La investigación sobre interfaces generativas (ACL 2026 y práctica de producto) es
consistente: para tareas estructuradas, las GUIs superan a la conversación — los usuarios
prefieren interfaces generadas/estructuradas sobre chat en más del 70% de los casos,
porque escanean espacialmente, verifican de forma independiente y se recuperan de errores
con un clic; el chat fuerza lectura lineal y convierte cada corrección en una negociación
multi-turno [41][42]. La síntesis de HatchWorks: "chat-first UX fails" para operar; el
chat es la puerta de entrada, no el panel de control [42].

### 6.2 La partición correcta

De la práctica 2025-2026 (Copilot: chat para pedir, PR para revisar; Notion: prompt para
pedir, página para revisar; Zapier: instrucción en lenguaje natural, aprobación
estructurada) [16][25][20], la división del trabajo quedó nítida:

- **UI estructurada** para: decidir (aprobar/rechazar/editar), comparar (diffs, tablas),
  monitorear (estados, feeds), auditar (historial). Todo lo repetible y comparable.
- **Chat** para: preguntas ad-hoc sobre los datos ("¿por qué subió el CPA de BHI?"),
  investigación exploratoria, y pedidos nuevos que todavía no tienen forma de tarjeta.
- **El puente**: la respuesta del chat que propone algo **materializa una tarjeta
  estructurada** en la cola de decisión — la conversación nunca es el registro de la
  decisión. Linear AIG: el agente habita la plataforma nativamente, usando los mismos
  objetos que los humanos [12][14].

### 6.3 Command-K como interfaz al agente

Raycast y Linear demostraron el patrón teclado-primero: una paleta (⌘K) donde las acciones
de IA son **comandos con nombre** entre los demás comandos — "resumir", "explicar esta
cifra", "crear accionable" — con el Tab que pivotea a chat libre cuando el comando no
existe [29]. Para una app operativa de un solo usuario experto es el mejor costo/beneficio:
cero chrome permanente de chat, IA disponible en todas partes, y cada acción frecuente
termina promovida de prompt a comando con nombre.

---

## 7. Nomenclatura y voz: cómo nombrar lo que hace la IA

### 7.1 Verbos que reparten agencia

Los productos serios separan léxicamente **lo que la IA hace sola** de **lo que requiere
humano**, y la elección de verbo es el contrato:

- GitHub: Copilot **suggests**, **comments**, **opens a PR**; por defecto su review es un
  *Comment*, **no** un *Approve* — aprobar quedó reservado a humanos salvo opt-in explícito
  de la organización [17]. El verbo "aprobar" es del humano.
- Linear: a un agente se le **delega** (delegate), no se le **asigna** (assign) — el issue
  conserva un humano *assignee* accountable; "an agent cannot be held accountable" [13][14].
- Devin/Cognition: el agente **plans** y **waits for approval** cuando duda [24].
- Zapier: los pasos se llaman **Human in the Loop** y el toggle "require approval before
  running" — la aprobación nombrada como objeto de primera clase [19][20].
- Terraform (el préstamo conceptual): **plan** vs **apply** — dos palabras distintas para
  calcular y para tocar el mundo [46].

El vocabulario resultante para un sistema como NorthSignal, en castellano:
**detectar** (centinela), **proponer** (semanal — nunca "recomendar aplicar"), **simular**
(calcular el efecto sin tocar), **aprobar / rechazar / editar** (solo Andrés),
**aplicar** (ejecutor, solo post-aprobación), **verificar / corregir** (reconciliador,
solo hacia la base propia), **revertir** (deshacer con el valor previo). Siete verbos,
siete responsabilidades, sin sinónimos — el mismo verbo significa siempre lo mismo.

### 7.2 Identidad y etiqueta consistentes

IBM Carbon: **toda** instancia de contenido generado por IA lleva la misma etiqueta, y esa
etiqueta es la puerta a la explicación [10]. Linear: identidad de agente inconfundible,
feedback inmediato al invocarlo, y "when asked to disengage, step back immediately" [12].
Shape of AI cataloga esto como *Identifiers* y *Trust Builders*: disclosure, footprints
(rastro de cómo llegó al resultado), caveats [39]. Aplicado: cada agente de NorthSignal
con nombre corto y estable (Semanal, Pulso, Centinela, Reconciliador, Ejecutor), avatar/color
propio, y su firma en cada cosa que produce. Nunca "el sistema dice".

### 7.3 Voz: beneficio, no tecnología; datos, no adjetivos

PAIR: "Explain the benefit, not the technology" [4]. Atlassian (AI interaction guidelines):
formato verbo-objeto, 3-6 palabras por acción, IA que colabora sin fingir persona [11].
NN/g: competencia sobre calidez [32]. La tarjeta modelo que sale de esta literatura:

> **Proponer: bajar CPC objetivo** · Semanal · confianza alta
> `$1.20 → $0.95` · grupo "batidos-centro" · evidencia: 17 días, CPA 2.3× el objetivo
> [Aprobar] [Editar] [Rechazar] · reversible: sí, valor previo guardado

Sin "el modelo considera", sin "se recomienda fuertemente", sin emojis. Verbo + objeto +
diff + procedencia + reversibilidad.

---

## 8. Síntesis para NorthSignal

Lo que este relevamiento confirma del diseño actual: accionable estructurado con confianza
y evidencia, `Accion JSON` como única vía de ejecución, valor previo obligatorio,
reconciliador que nunca escribe en Google, `v_para_actuar` como cola única. Todo eso **es**
el estado del arte 2026 — mejor fundado que muchos productos comerciales.

Lo que falta es la capa de presentación y sintonía entre agentes, y la literatura da el
plano completo: separar cola de decisión de feed de actividad (3.2), tarjeta con diff y
cuatro respuestas incluida *editar* (1.1, 1.2), confianza en categorías con número
expandible (2.1), línea de procedencia uniforme "agente · ventana · fecha" (2.2), panel de
latidos pasivo (4.2), fricción proporcional al riesgo con lote solo para riesgo bajo
homogéneo (5.1, 1.5), siete verbos fijos (7.1), y chat solo como puerta que materializa
tarjetas, con ⌘K para las acciones con nombre (6.2, 6.3).

La métrica de que funciona no es velocidad de aprobación: es que la tasa de rechazo se
mantenga sana (si Andrés nunca rechaza nada, el loop humano dejó de existir) y que
"¿qué pasó mientras no estaba?" se conteste en menos de un minuto sin correr un solo query.

---

## Fuentes

Verificadas entre el 12 y 13 de septiembre de 2026. Formato: título — URL — aporte.

**Guidelines oficiales**

1. Microsoft HAX Toolkit — Guidelines for Human-AI Interaction — https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/ — Las 18 guidelines, organizadas por fase (inicial, durante, cuando falla, en el tiempo).
2. Microsoft HAX Design Library — https://www.microsoft.com/en-us/haxtoolkit/library/ — Lista completa G1-G18 con patrones y ejemplos por guideline.
3. HAX Guideline 11: Make clear why the system did what it did — https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-why-the-system-did-what-it-did/ — Explicación local por output; advertencia de que la mera presencia de explicación infla confianza.
4. Google PAIR — People + AI Guidebook v2, Patterns — https://pair.withgoogle.com/guidebook-v2/patterns — Patrones: confidence "if at all", supervisar automatización, automatizar por fases, devolver control al fallar.
5. Google PAIR — Explainability + Trust — https://pair.withgoogle.com/chapter/explainability-trust/ — Confidence displays, explicaciones parciales, progressive disclosure; testear formatos temprano.
6. Apple HIG — Machine Learning: Corrections — https://developer.apple.com/design/human-interface-guidelines/machine-learning — Correcciones familiares, mostrar los pasos de la automatización para poder deshacerlos, persistir correcciones.
7. Anthropic — Building Effective Agents — https://www.anthropic.com/engineering/building-effective-agents — Checkpoints humanos, ground truth por paso, condiciones de parada, tensión autonomía/supervisión.
8. Anthropic — Our framework for developing safe and trustworthy agents — https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents — Control humano en decisiones de alto riesgo, read-only por defecto, visibilidad del razonamiento.
9. OpenAI — A practical guide to building agents (abril 2025) — https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf — Guardrails, umbrales de escalada, intervención humana para acciones sensibles/irreversibles.
10. IBM Carbon Design System — AI label — https://carbondesignsystem.com/components/ai-label/usage/ — Etiqueta consistente para todo lo generado por IA como puerta a la explicabilidad.
11. Atlassian Design System — AI interaction guidelines — https://atlassian.design/patterns/ai-interaction-guidelines — Comportamiento de IA en UI, formato verbo-objeto para acciones, colaboración sin fingir persona.

**Blogs y docs de producto**

12. Linear — Agent Interaction Guidelines (AIG) — https://linear.app/developers/aig — Identidad de agente inequívoca, feedback inmediato, estados internos visibles, "an agent cannot be held accountable".
13. Linear Changelog — Agent Interaction Guidelines and SDK (jul. 2025) — https://linear.app/changelog/2025-07-30-agent-interaction-guidelines-and-sdk — SDK que estructura cómo los agentes comunican estado y progreso; Linear renderiza la UI.
14. Linear — Our approach to building the Agent Interaction SDK — https://linear.app/now/our-approach-to-building-the-agent-interaction-sdk — Delegar ≠ asignar: el issue conserva humano accountable con agente delegado.
15. GitHub Blog — Copilot Workspace (2024) — https://github.blog/news-insights/product-news/github-copilot-workspace/ — Task → spec editable → plan editable → código: corregir en la etapa más barata.
16. GitHub Docs — About Copilot coding agent — https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent — Agente asíncrono que trabaja en rama y pide review; nada se mergea solo.
17. GitHub Docs — About Copilot code review — https://docs.github.com/en/copilot/concepts/agents/code-review — El review de Copilot es "Comment" por defecto, no "Approve": aprobar es humano salvo opt-in.
18. GitHub Blog — Agent pull requests are everywhere. Here's how to review them — https://github.blog/ai-and-ml/generative-ai/agent-pull-requests-are-everywhere-heres-how-to-review-them/ — Red flags de output de agentes; "any change that weakens CI is a blocker"; proceso de review de 10 minutos.
19. Zapier Help — Human in the Loop — https://help.zapier.com/hc/en-us/articles/38731463206029-Request-approval-to-keep-your-workflow-running-with-Human-in-the-Loop — Paso de aprobación como objeto de primera clase; aprobación por email/Slack/link seguro.
20. Zapier Help — Add approval steps to your agent's instructions — https://help.zapier.com/hc/en-us/articles/41776074420493-Add-approval-steps-to-your-agent-s-instructions — Toggle "require approval before running" por herramienta.
21. Zapier Blog — How to build safe and trustworthy AI agents — https://zapier.com/blog/safe-trustworthy-ai-agents/ — Pausa automática a las 75 tareas por corrida; gates de aprobación en workflows.
22. Salesforce Architects — Agentic Patterns — https://architect.salesforce.com/fundamentals/agentic-patterns — Aprobaciones y escaladas configuradas por riesgo, contexto o sensibilidad.
23. Salesforce Admins — The Importance of Human in the Loop for Agentforce (2026) — https://admin.salesforce.com/blog/2026/the-importance-of-human-in-the-loop-for-agentforce — Checkpoints, sign-offs para pasos críticos, acciones auditables vía Trust Layer.
24. Cognition — Devin 2.1 — https://cognition.com/blog/devin-2-1 — El agente evalúa su propia confianza y solo pide aprobación cuando duda; confidence score por plan.
25. Notion — Introducing Notion 3.0 (sept. 2025) — https://www.notion.com/blog/introducing-notion-3-0 — Agentes autónomos de hasta 20 min que muestran qué páginas tocaron; memoria en páginas visibles.
26. LangChain — Agent Inbox (GitHub) — https://github.com/langchain-ai/agent-inbox — Las cuatro respuestas (accept/edit/respond/ignore) configurables por interrupción; inbox como abstracción HITL.
27. LangSmith Docs — Observability concepts — https://docs.langchain.com/langsmith/observability-concepts — Runs dentro de traces navegables; colas de anotación para revisión humana.
28. Atlassian Statuspage — Top-level status and incident impact calculations — https://support.atlassian.com/statuspage/docs/top-level-status-and-incident-impact-calculations/ — Vocabulario estándar de estados y regla de agregación (el global = el peor componente).
29. Raycast Manual — AI Commands — https://manual.raycast.com/ai/ai-commands — Acciones de IA como comandos con nombre en la paleta; Tab pivotea a chat libre.

**Investigación y análisis**

30. NN/g — Explainable AI in Chat Interfaces (dic. 2025) — https://www.nngroup.com/articles/explainable-ai/ — Los usuarios casi nunca clickean citas; chips adyacentes a la afirmación; el razonamiento mostrado es post-hoc; disclaimers accionables.
31. NN/g — Designing AI Agents: 4 Lessons from China's Qwen Agent (mayo 2026) — https://www.nngroup.com/articles/designing-ai-agents/ — Patrones familiares bajan el costo de aprendizaje; transparencia de costos/datos protege la autonomía del usuario.
32. NN/g — Prioritize Smarts over Sentience to Increase Trust with AI — https://www.nngroup.com/articles/smarts-emotion-trust-ai/ — La competencia (justificar con datos verificables) construye más confianza que la calidez.
33. LukeW — Agent Management Interface Patterns (2025) — https://lukew.com/ff/entry.asp?2106= — Los cinco patrones (kanban, dashboard, inbox, task list, calendario) y sus trade-offs para gestionar múltiples agentes.
34. Magentic-UI: Towards Human-in-the-loop Agentic Systems (Microsoft Research, arXiv 2025) — https://arxiv.org/abs/2507.22358 — Co-planning, co-tasking, action guards para acciones irreversibles, memoria de planes aprobados.
35. Zhang, Liao & Bellamy — Effect of Confidence and Explanation on Accuracy and Trust Calibration in AI-Assisted Decision Making (FAT* 2020) — https://arxiv.org/abs/2001.02114 — Mostrar confianza calibra la confianza del usuario pero no garantiza mejor decisión conjunta.
36. The Impact of Confidence Ratings on User Trust in LLMs (UMAP Adjunct 2025) — https://dl.acm.org/doi/10.1145/3708319.3734178 — Efecto medible de los ratings de confianza sobre la confianza en LLMs.
37. Better AI with Designed Friction: Theories, Applications and Research Agenda (2025) — https://journals.sagepub.com/doi/10.3233/FAIA250680 — Fricción diseñada y cognitive forcing functions contra el automation bias; fluidez total produce aceptación refleja.
38. WorkOS — Approval fatigue is agent governance's next attack surface — https://workos.com/blog/approval-fatigue-agent-governance — Gatear por consecuencia y reversibilidad; rutear por excepción; monitorear time-to-approve y tasa de rechazo como salud del control; abuso del batch approval.
39. The Shape of AI — UX Patterns for AI (Emily Campbell) — https://www.shapeof.ai/ — Taxonomía de patrones: Identifiers, Trust Builders (disclosure, footprints, caveats), Governors, Wayfinders.
40. Benjamin Prigent — 7 UX Patterns for Human Oversight in Ambient AI Agents — https://www.bprigent.com/article/7-ux-patterns-for-human-oversight-in-ambient-ai-agents — Overview panel, oversight flow, activity log, work reports; configuración de cuándo interrumpir al humano.
41. Eleken — 6 Agentic UX Design Patterns With Real-World Examples — https://www.eleken.co/blog-posts/agentic-ux-examples — Activity feed como "version history" del agente; audit logs contra la sensación de vigilancia invertida.
42. HatchWorks — Agent UX Patterns: Chat-First UX Fails — https://hatchworks.com/blog/ai-agents/agent-ux-patterns/ — Por qué el chat falla para operar; GUIs para escanear, verificar y recuperarse de errores.
43. dev.to — I Cron-Scheduled 7 AI Agents. 2 Silently Failed for 18 Days — https://dev.to/kenimo49/i-cron-scheduled-7-ai-agents-2-silently-failed-for-18-days-tracing-wouldnt-have-caught-it-24fa — El cron que no dispara produce cero señal; heartbeat de último-éxito por tarea + verificador independiente.
44. TechRadar — Slack Catch Up — https://www.techradar.com/pro/slacks-new-feature-wants-you-to-swipe-right-on-all-those-unread-alerts — Lo no leído como secuencia procesable para inicio/fin del día.
45. GitHub Docs — Managing notifications from your inbox — https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox — Agrupación por repositorio; separación "requiere tu acción" del resto; triage con read/unread.
46. Spacelift — Terraform Plan Command — https://spacelift.io/blog/terraform-plan — El patrón plan/apply: preview exacto, guardable, que garantiza que lo aprobado es lo que se ejecuta.
47. Tines — Beating alert fatigue in the SOC — https://www.tines.com/blog/beating-alert-fatigue-in-the-soc/ — Escala del problema (miles de alertas/día, mayoría sin investigar); contexto antes de la alerta, ruteo por riesgo, solo lo irreversible interrumpe.
