# 06 · Escritura clara (plain language) para interfaces de operación y decisión

**Investigación frontend · NorthSignal**
Fecha: 13 de septiembre de 2026.
Método: 42 fuentes anotadas, de las cuales 36 fueron abiertas y leídas en la web (WebFetch) con contenido sustancial, y 3 se citan como complementarias porque solo rindieron snippet sustantivo de búsqueda (están marcadas). Al menos 15 tienen fecha 2026 y 12 caen en la ventana pedida junio-septiembre 2026. De comunidad/practitioners con fecha hay 11 (4 hilos de foros — 3 de Hacker News, 1 PR pública de Discourse — y 7 blogs de practitioners). URLs que no cargaron no se cuentan (legible.es con conexión rechazada, reddit.com y old.reddit bloqueados, ux.stackexchange bloqueado, api.stackexchange bloqueado, arstechnica bloqueado, rae.es con 403, bushe.co con 403): donde un bloqueo dejó un hueco lo digo explícitamente en el tema correspondiente.

**El eje:** hoy el front muestra el análisis semanal del agente CRUDO — largo, técnico, sin conclusión, sin próximo paso, sin medir cuánto va. El objetivo es una capa de redacción EN EL FRONT que derive *veredicto → qué hacer → progreso* desde los datos estructurados, con lo técnico plegado. Los prompts de los agentes no se tocan. Idioma: castellano rioplatense.

---

## Resumen ejecutivo — las 8 tesis que dejó la investigación

1. **Los expertos también quieren lenguaje claro; está medido, no es opinión.** El estudio de NN/g con expertos de dominio (ciencia, tecnología, medicina) encontró que los lectores más formados prefieren texto conciso y escaneable igual que todos; GOV.UK cita que el 80% de la gente prefiere la frase en lenguaje claro, y que la preferencia *crece* con la complejidad del contenido y con la especialización del lector [5][1]. Escribir "para un operador experto" no autoriza párrafos densos: los castiga más.
2. **Números duros de forma: frases de hasta 25 palabras (ideal 15-20), párrafos de hasta 5 frases, microcopy de menos de 3 frases.** GOV.UK: partir toda frase de más de 25 palabras; NN/g para expertos: 15-20 palabras por frase; NN/g define microcopy como menos de 3 oraciones y short-form como 2-3 párrafos con UNA idea [1][5][7].
3. **La respuesta va primero, siempre: pirámide invertida / BLUF.** La gente lee en patrón F y solo procesa el 20-28% del texto de una página; el que deja de leer en cualquier punto tiene que irse igual con la conclusión. Frontload en cada capa: título, primer renglón, primera palabra [2][6][15]. La corrección de Minto vía Dykes: answer-first funciona cuando el lector ya confía en quien firma; si el hallazgo es contraintuitivo, la conclusión sola no persuade — por eso el veredicto necesita el "ver evidencia" plegado a un clic, no eliminado [16].
4. **Para el castellano hay fórmulas validadas y umbral concreto: Szigriszt-Pazos/INFLESZ ≥ 65 ("bastante fácil") para la capa de lectura rápida.** La escala INFLESZ (validada en 2008 sobre 630 fragmentos de texto real): <40 muy difícil, 40-55 algo difícil, 55-65 normal, 65-80 bastante fácil, >80 muy fácil. Para público que lee apurado se recomienda superar 65; hay herramienta open source en Python (GPL-3) que calcula Fernández-Huerta, Szigriszt e INFLESZ y se puede correr en CI [17][18][20].
5. **El imperativo se gana con confianza; si el sistema no está seguro, cambia el modo verbal.** Google PAIR: la meta es confianza *calibrada*, no confianza a secas — el usuario tiene que saber cuándo fiarse y cuándo aplicar su propio juicio; mostrar bandas categóricas (alta/media/baja) antes que porcentajes crudos, y cuando falta dato, decirlo y devolver el juicio al usuario [22]. El patrón 2026 de confidence indicators: nada de "97% de confianza" decorativo que nunca cambia; hedging solo donde la evidencia es parcial, y con el "por qué" plegable [23].
6. **La voz de un sistema que reporta estado es sobria, directa y sin chistes en el error.** Microsoft (guía actualizada julio 2026): "get to the point fast", empezar con verbo, podar cada palabra sobrante; Material: el tono jocoso en un error mina la confianza; Atlassian: "el mal mensaje puede ser la razón por la que se van"; Shopify: nivel de lectura de séptimo grado y UN término por concepto, sin sinónimos [25][26][27][28].
7. **El progreso se muestra en capas y con colchón, no con logs.** NN/g: todo lo que tarda más de ~1 segundo lleva indicador, más de ~10 segundos lleva porcentaje + texto de qué está pasando ("Actualizando dirección 3 de 50"), y la estimación se da con margen ("unos 3 minutos") porque quedarse corto destruye credibilidad. Nielsen para IA lenta: porcentaje global, cuello de botella actual y ETA del paso, más "breadcrumbs conceptuales" — síntesis de lo que se encontró, no "descargué el archivo 245" [9][35].
8. **2026 es el año de la fatiga con el slop: el resumen generado verboso es un anti-patrón documentado.** NN/g lo declara ("lazy AI features and AI slop are now ubiquitous"); el paper de arXiv sobre 1.154 posts de Reddit y HN define las tres propiedades del slop (competencia superficial, asimetría de esfuerzo, producibilidad masiva: el que genera ahorra tiempo, el que lee lo paga); Apple tuvo que pausar sus resúmenes de notificaciones tras inventar una noticia y ahora los marca en cursiva y deja apagarlos por app; Tripadvisor fue caso de tapa en julio 2026 por resúmenes que doraban hoteles peligrosos [10][33][34][31]. La lección de diseño no es "no resumas": es *resumí desde datos verificables, marcá lo generado, hacelo plegable y apagable, y no muestres la caja si no hay nada que decir* [37][38].

---

## Tema 1 · GOV.UK content design: el estándar de oro, renovado en junio 2026

### Qué dice hoy la guía (y qué cambió)

GDS relanzó TODA su guía de contenido el **8 de junio de 2026**: consolidó 4 manuales en un solo sitio (`guidance.publishing.service.gov.uk`), reescribió más de 130 páginas y armó taxonomía de dos niveles con búsqueda única, para ~3.000 publishers de gobierno [4]. La sección de escritura ("Writing to GOV.UK standards") quedó organizada en 8 guías: necesidades de usuario, estructura clara, lenguaje claro, tono, links, títulos, resúmenes y change notes [3]. Es la versión vigente del canon que venía de `gov.uk/guidance/content-design` (esa URL hoy redirige al sitio nuevo).

### Las reglas aplicables a UI de producto

De **Use clear language** [1]:

- **Partí toda frase de más de 25 palabras.** No es estilo: es el límite operativo que usan.
- **Párrafos de máximo 5 frases.**
- **El 80% de la gente prefiere la frase escrita en lenguaje claro**, y la preferencia aumenta cuanto más complejo es el contenido — y los lectores más formados y especialistas también la prefieren, por eficiencia. Contexto de alfabetización: ~1 de cada 5-6 adultos del Reino Unido tiene dificultades de lectura.
- Palabra corta antes que larga ("comprar", no "adquirir"); podar terminaciones en "-ción"/"-miento" encadenadas; voz activa; se pueden usar términos de especialista **pero se explican la primera vez**.

De **Create a clear structure** [2]:

- **"Poné la información más importante primero. Cuanto más rápido llegás al punto, más chance de que el usuario vea lo que querés que vea."** Textual.
- La gente escanea en patrón F y lee **solo el 20-28%** del texto de una página web.
- Encabezados H2-H4 **frontloaded** (lo importante en las primeras palabras), descriptivos (nada de "Introducción"), idealmente arrancando con verbo ("Solicitá...", "Revisá..."), nunca en forma de pregunta.
- No repetir el resumen en el primer párrafo; nada de footnotes: lo importante va integrado al cuerpo.
- Bullets y pasos numerados para reducir duplicación y dar escaneabilidad.

**Traducción a NorthSignal:** el "plan de la semana" crudo viola todas estas reglas a la vez (frases largas, sin frontload, sin encabezados con verbo, conclusión al final si la hay). La capa de redacción tiene acá su tabla de límites: ≤25 palabras por frase, ≤5 frases por bloque, encabezado = verbo + objeto, lo accionable arriba.

---

## Tema 2 · NN/g: plain language para expertos, capas y "answer first"

### El estudio de expertos (la cita que cierra discusiones)

"Plain Language Is for Everyone, Even Experts" (Hoa Loranger, NN/g, 2017) [5] estudió con usability testing a expertos de dominio — científicos, técnicos, médicos — leyendo contenido de su propio campo:

- Los lectores altamente formados **quieren exactamente lo mismo que el resto**: información sucinta, escaneable, sin jerga innecesaria.
- Quotes del estudio: un gerente de IT elogiando un resumen "esto es corto, fácil de digerir... te da la información en diez segundos"; una profesora universitaria buscando grants sobre el sitio del NIH: "esto es densísimo... ¿por qué no lo llaman de una forma más simple?"; una enfermera con doctorado prefiriendo la versión reescrita: "veo rápido cuáles son los problemas".
- Recomendaciones numéricas: **frases de 15-20 palabras máximo**; elegir el término que la audiencia usa, no el técnicamente exquisito; y **layering**: la explicación para audiencias secundarias va en otra capa (link/expandible), no inflando el texto primario.

### Pirámide invertida y tamaños de copy

- **Inverted Pyramid** (Amy Schade, NN/g, 2018) [6]: la conclusión primero, los detalles después, en CADA capa del contenido (titular, párrafo, frase). Mejora comprensión, baja el costo de interacción y banca al que escanea: "el usuario puede dejar de leer en cualquier punto y llevarse igual el punto principal". Los 5 pasos: identificar el mensaje clave → ordenar lo secundario por relevancia → escribir conciso → frontload en cada nivel → considerar un bloque de highlights.
- **UX Copy Sizes** (Taylor Dykes, NN/g, mayo 2025) [7]: microcopy = **menos de 3 oraciones** (botones, errores, tooltips); short-form = 2-3 párrafos con **una** idea central (resúmenes de producto); long-form = 3+ párrafos para lo que de verdad exige detalle (documentación, políticas).
- **The 3 I's of Microcopy** (Dykes, Moran y Kaley, NN/g, agosto 2025) [8]: cada pieza de microcopy se clasifica por su objetivo primario — **informar, influir o interactuar** — y se escribe para UN objetivo por vez; el mismo componente (un banner, un label) cambia de redacción según el objetivo.
- **We Still Need Long-Form Copy** (NN/g, 31 de agosto de 2026; verificada vía el listado oficial de artículos [13][14]): el largo no murió — se justifica cuando hay complejidad real y confianza que construir. El punto para nosotros: el análisis técnico completo del agente tiene derecho a existir *como capa plegada*, no como pantalla de entrada.

**Traducción a NorthSignal:** la jerarquía exacta que pide el objetivo del rediseño ya está codificada por NN/g: veredicto (microcopy, <3 frases) → qué hacer (short-form, una idea) → análisis del agente (long-form, plegado). Y la evidencia de que el operador experto la va a preferir así es empírica, no estética.

---

## Tema 3 · BLUF y pirámide de Minto aplicados a producto y dashboards

### BLUF: la disciplina militar del primer renglón

El estándar militar "bottom line up front" (Animalz, 2019, actualizado el 3 de febrero de 2026) [15]: la mayoría de los textos "carraspean" — contexto, historia, backstory — antes de llegar al punto. Técnica de revisión: buscá tu conclusión al final del borrador (ahí suele estar) y subila al primer renglón; en mensajes operativos: qué necesito, por qué y para cuándo, en una sola pieza. El primer renglón de una card de análisis en NorthSignal es exactamente eso: el "so what" de la semana.

### La corrección importante: cuándo answer-first NO alcanza

Brent Dykes ("Why the Pyramid Principle Is Not a Data Storytelling Framework", **22 de julio de 2026**) [16] recuerda que Minto diseñó la pirámide para consultores que ya tenían la confianza del ejecutivo, y que la propia Minto marcó dos excepciones: cuando la audiencia va a estar en fuerte desacuerdo con la conclusión, y cuando no puede entender la acción sin explicación previa. En esos casos hay que *preparar* al lector con la evidencia. Su distinción: la pirámide hace explícita la respuesta y deja implícito el insight; el data storytelling hace lo inverso.

**Traducción a NorthSignal:** Andrés confía en el sistema pero aprueba cambios con plata real; el patrón correcto es el híbrido: **veredicto primero (pirámide) + evidencia a un clic (storytelling)**. Nunca veredicto sin camino a la evidencia — que además es la regla de la casa: el radio de la acción es el radio de la evidencia.

---

## Tema 4 · Legibilidad en español: fórmulas, umbrales y herramientas

### Las tres fórmulas que existen para castellano

- **Fernández-Huerta (1959)**: la primera adaptación del Flesch Reading Ease al español. L = 206,84 − 0,60·P − 1,02·F (P = sílabas por cada 100 palabras; F = palabras por frase), con escala de 7 niveles asociados a nivel académico [19][41].
- **Szigriszt-Pazos (1993)**, el "Índice de Perspicuidad" IFSZ = 206,835 − 62,3·(sílabas/palabra) − (palabras/frase); asoció cada nivel a un tipo de publicación [19][17].
- **INFLESZ (Barrio-Cantalejo et al., 2008)** [17]: revalidó la escala de Szigriszt contra hábitos lectores reales en España — 210 publicaciones, 630 fragmentos de 500 palabras (prensa de kiosco, textos escolares, revistas científicas) — y corrigió los cortes: Szigriszt ponía "normal" desde 50 (muy exigente) y Flesch desde 60 (muy permisivo); INFLESZ fijó **normal = 55-65**.

### La escala INFLESZ (la que hay que usar) y el umbral para operación

| Puntaje | Nivel | Quién lo lee cómodo |
|---|---|---|
| >80 | Muy fácil | Público general, primaria |
| 65-80 | **Bastante fácil** | Adolescente promedio; **lectura rápida** |
| 55-65 | Normal | Adulto estándar |
| 40-55 | Algo difícil | Audiencia especializada |
| <40 | Muy difícil | Universitario/experto con esfuerzo |

Para contenido de público amplio se recomienda **superar 65** [18]; para SEO/web el valor "ideal" citado ronda 73-74 ("bastante fácil") [19]. Ojo con la trampa de leer esta tabla como "el operador es experto, entonces 40-55 está bien": el Tema 2 mostró que el experto *prefiere* el texto fácil; la dificultad se reserva para la capa técnica plegada, no para la capa de decisión.

**Umbral propuesto para NorthSignal:** capa derivada (veredicto/qué hacer/progreso) con **INFLESZ ≥ 65**; cuerpo técnico plegado tolerado en 55-65; por debajo de 55, la capa de redacción falló. Como las fórmulas premian frase corta y palabra corta, cumplir "≤25 palabras por frase" ya te deja cerca.

### Herramientas

- **`alejandromunozes/legibilidad`** (GitHub, Python, GPL-3) [20]: calcula Fernández-Huerta, Gutiérrez de Polini, Crawford, Szigriszt-Pazos, escala INFLESZ y legibilidad µ. Es el motor detrás de legible.es (el sitio no cargó durante esta investigación; el repo sí). Portable a un check de CI o a un endpoint interno que mida cada texto derivado antes de mostrarlo.
- **RAE/ASALE, "Guía panhispánica de lenguaje claro y accesible"** (Espasa, 2024) [21]: el respaldo normativo panhispánico del movimiento "derecho a comprender". Ataca exactamente los vicios del texto de agente: subordinación compleja, gerundios, pasivas, párrafos largos, enumeraciones interminables, redundancias y eufemismos. Útil como autoridad si algún día hay que justificar la capa de redacción ante un cliente.
- Complementaria [41]: la revisión académica de escalas aplicadas a informes médicos (CLAC, UCM) confirma el punto medio 60 como "normal" transversal a los índices.

---

## Tema 5 · Microcopy de acción y "next best action" honesto

### El trabajo del microcopy es sacar incertidumbre, no decorar

Userpilot ("Microcopy UX in 2026", 26 de agosto de 2026) [24]: la gente no duda porque el texto sea feo, duda porque **no puede predecir la consecuencia** del clic. Los 4 trabajos del microcopy: prevenir errores, explicar consecuencias (sobre todo antes de lo irreversible), construir confianza confirmando que vas bien, y ayudar a recuperarse con el próximo paso concreto. Reglas de forma: hablarle al usuario, **verbo adelante** ("Pausá la campaña", no "Pausado de campaña"), y **el detalle crítico al inicio de la frase**, no al final. Dato de contexto: tras 1.818 instancias de dark patterns documentadas (Mathur, 11.000 sitios), el usuario lee el copy de interfaz con desconfianza — el imperativo tramposo sale caro. Y una debilidad medida de los LLM: sus mensajes de error tienden al hedging vacío ("parece que pudo haber un problema").

### Confianza calibrada: el modo verbal sigue a la banda de confianza

- **Google PAIR (Explainability + Trust)** [22]: el objetivo NO es que el usuario confíe más, es que confíe **cuando corresponde**: "el usuario no debería confiar ciegamente; debería saber cuándo fiarse de la predicción y cuándo aplicar su propio juicio". Cuatro formas de mostrar confianza: bandas categóricas (alta/media/baja — menos carga cognitiva), N-best (mostrar alternativas cuando el sistema duda), porcentaje numérico (solo para audiencia estadísticamente alfabetizada y con contexto), y visualizaciones de error (para expertos de dominio). Antes de mostrar confianza, validar que mejora la decisión: la diferencia entre 85,8% y 87% no le dice a nadie qué hacer. Y honestidad estructural: cuando falta dato, decir que falta y que el usuario va a tener que usar su juicio.
- **Confidence Indicators** (AI UX Playground, actualizado 10 de julio de 2026) [23]: bandas en lenguaje llano antes que números; badges a nivel de afirmación solo en las partes riesgosas; "por qué" expandible con los drivers de la duda (evidencia fina, ambigüedad, falta de confirmación). Anti-patrón explícito: "decorar cada respuesta con un 97% que nunca cambia" — teatro de precisión. Ejemplo de copy honesto: "Confirmalo con un micólogo antes de actuar" junto a "confianza mixta".

**Traducción a NorthSignal — la gramática del "qué hacer ahora":**

| Estado real del sistema | Modo verbal | Ejemplo |
|---|---|---|
| Acción propuesta con evidencia suficiente y `Accion JSON` válida | Imperativo directo | "Aprobá la baja de CPC en 'seguro salud' (evidencia: 3 semanas, CPA +32%)" |
| Evidencia parcial / ventana inmadura | Imperativo de revisión, no de ejecución | "Mirá el término X: 2 semanas de deterioro. Todavía no alcanza para actuar" |
| Sin datos suficientes | Declarativo honesto | "No se puede saber con estos datos. Vuelve a correr el lunes" |

El imperativo falso ("Optimizá ahora") cuando el sistema no está seguro es un dark pattern y el operador lo detecta a la segunda vez.

---

## Tema 6 · Voz y tono para sistemas que reportan estado

### Microsoft (Style Guide, top 10, actualizado 2 de julio de 2026) [25]

La guía de voz más operativa que existe, con ejemplos antes/después:

- **"Get to the point fast"**: lo más importante primero, keywords frontloaded para el escaneo, próximos pasos obvios.
- **"Bigger ideas, fewer words"**: "¿Listo para comprar? Contactanos" en vez del párrafo institucional.
- **Empezar cada oración con verbo** la mayoría de las veces; podar "podés", "hay", "existe".
- **Write like you speak** (leelo en voz alta); error message con formato de solución: no "ID inválido" sino "Necesitás un ID con esta forma: alguien@ejemplo.com".
- Sentence case en títulos y botones; sin punto final en headings.

### Material Design (communication principles / codelab) [26][40]

- Texto escaneable, en segmentos cortos, pocas ideas por segmento; siempre preguntarse si hay una forma más simple de decirlo.
- **Tone map**: mapear tipos de mensaje (onboarding, error, confirmación) en ejes "serio ↔ juguetón" y "conciso ↔ detallado". Un error va serio y detallado; una confirmación, concisa.
- **"El tono comunica emoción, quieras o no"**: el chiste en el mensaje de error mina la confianza.
- Prioridad por componente: dialog (bloquea, solo crítico) > banner (persiste hasta que se atiende) > snackbar (efímero). El texto hereda la urgencia del contenedor: no va la misma redacción en un banner que en un snackbar.
- Complementaria [40]: sentence case en todo (títulos, labels, botones).

### Atlassian (designing messages) [27]

- "El buen mensaje no es la razón por la que la gente se queda, pero el malo puede ser la razón por la que se va."
- 5 tipos con semántica de color fija: información (azul), éxito (verde), advertencia (amarillo), error (rojo), descubrimiento (violeta). El tipo elige el componente (inline, banner, flag, modal) según urgencia.
- En warnings: la gente escanea — **que cada palabra cuente**, sin detalle irrelevante. El error dice qué pasó Y qué hacer después.

### Apple HIG (Writing) [29]

- Claridad ante todo; **lo importante primero**; hablarle al usuario de vos; el tono se adapta al contexto (alerta ≠ confirmación); en botones, casi siempre un verbo; "Enviar pago" mejor que "Enviar" — el label carga el contexto para que la memoria del usuario no tenga que hacerlo.

### Shopify (contenido para apps del admin) [28]

- **Nivel de lectura objetivo: séptimo grado.** Para merchants de todo el mundo, con alfabetizaciones dispares y sin inglés nativo — el paralelo exacto de escribir para un operador apurado a las 7 AM.
- **Un solo término por concepto**: nada de alternar "campaña"/"iniciativa"/"programa". (En NorthSignal: los nombres de entidad se resuelven contra la base y no se adivinan; la capa de redacción tampoco los "embellece".)
- CTA con verbo fuerte en voz activa; dividir tareas complejas en pasos; sin bloques largos de texto; dar la información suficiente para decidir de forma autónoma.

### El progreso: NN/g clásico + Nielsen 2025 para IA lenta

- **Progress Indicators** (NN/g) [9]: >1 segundo → algún indicador siempre; 2-10 segundos → spinner; **>10 segundos → percent-done + texto de qué está pasando** ("Actualizando dirección 3 de 50"). Estimaciones con colchón ("unos 3 minutos"): cumplir o sobrar genera satisfacción; quedarse corto destruye credibilidad.
- **Slow AI** (Jakob Nielsen, Substack, 13 de octubre de 2025) [35] — el más aplicable a tareas de agente que corren minutos u horas: progreso en 3 capas (porcentaje global por tiempo estimado, no por cantidad de pasos; qué tarea es el cuello de botella; ETA del paso actual); **breadcrumbs conceptuales** — en los hitos, una síntesis de lo que el agente encontró ("identificó 3 argumentos contra la hipótesis inicial"), no el log ("descargó el paper 245"); resultados parciales visibles y rotulados como incompletos; el "cono de incertidumbre" del forecast se angosta a medida que avanza — sin precisión falsa; y al volver el usuario, un **resumption summary**: intención original, decisiones tomadas, estado actual, costo consumido.
- Complementaria de contexto [36]: las heurísticas clásicas (visibilidad del estado del sistema, densidad de información) aplican intactas a productos con IA.

**Traducción a NorthSignal:** "cuánto va y cuánto falta" del plan de la semana = X de Y acciones decididas + qué bloquea + cuándo vuelve a correr la tarea. En texto: "3 de 5 decididas. Faltan 2 de BHI. El análisis corre de nuevo el lunes 10:50". Nada de barra sin número ni número sin texto.

---

## Tema 7 · El anti-patrón "AI slop": la fatiga 2025-2026 con resúmenes generados

### La evidencia de que la fatiga es real y medida

- **NN/g, State of UX 2026** (enero 2026) [10]: 2026 es "el año de la fatiga de IA"; "las features de IA perezosas y el AI slop ya son ubicuos y el brillo se apaga rápido"; cuando todo producto agrega "chispitas de IA", eso pasa a ser ruido de fondo. La diferenciación viene de juicio y contexto, no de más generación.
- **"An Endless Stream of AI Slop"** (Baltes, Cheong y Treude, arXiv, 13 de junio de 2026) [33]: análisis de 1.154 posts de Reddit (r/programming, r/learnprogramming, r/ExperiencedDevs) y Hacker News. Tres propiedades definitorias del slop: **competencia superficial** (parece pulido, no tiene sustancia), **asimetría de esfuerzo** (generar es barato, leer y revisar es caro — "el tiempo de desarrollo se acortó pero el equipo ahora gasta más tiempo revisando") y **producibilidad masiva**. El revisor que se siente "el primer humano que puso los ojos en esto" es el operador de NorthSignal frente al análisis crudo.
- **HN, "AI slop is killing online communities"** (~mayo 2026) [30]: moderadores baneando ~600 cuentas IA por mes; el contenido generado como "calorías vacías"; efecto "market for lemons" — lo genuino se va cuando lo generado inunda.
- **HN, hilo del paper "AI Slop" (SSRN)** (septiembre 2026) [32]: la definición formal que quedó: "output de un sistema automatizado probabilístico, producido con poco esfuerzo, que **carga asimétricamente al receptor** y tiende a degradar su dominio".

### Los casos de producto: cuándo el resumen generado estorba

- **Apple Intelligence** (TechCrunch, enero 2025) [34]: pausó los resúmenes de notificaciones de noticias tras el caso BBC (el resumen inventó que Luigi Mangione se había disparado). Las tres mitigaciones que quedaron son doctrina de diseño: **el texto generado se distingue visualmente** (cursiva), **se declara beta/falible** ("puede contener errores") y **se apaga por sección** (por app, desde la lock screen).
- **Tripadvisor** (HN, 5 de julio de 2026) [31]: resúmenes IA que doraban hoteles peligrosos — el sesgo positivo del resumen enterró las señales de seguridad bajo cientos de reseñas amables. Comentarios del hilo: "¿es un resumen o le pidieron al modelo un elogio?"; "dejá de meter resúmenes de IA en todos lados"; la propuesta: exponer la incertidumbre y dejar el camino a la fuente.
- **El listado de fallas 2025-2026** (vía API de HN Algolia, leído el 13/9/2026) [39]: YouTube agregando resúmenes IA engañosos (dic 2025), Wikipedia pausando sus resúmenes tras la revuelta de editores — "yuck" — (jun 2025), Google sacando AI Overviews de salud por riesgo (ene 2026), caída "devastadora" de audiencia de noticias por resúmenes (jul 2025). El patrón: el resumen generado falla en público cuando (a) no es verificable contra la fuente, (b) suaviza o dora señales de riesgo, (c) no se puede apagar. Complementaria [42]: el backlash de Gmail en mayo 2026 ("Turn it off") suma la variante privacidad.
- **Discourse, PR #28025** (julio 2024) [38]: detalle chico y elocuente de comunidad OSS: **si no hay resumen, la caja del resumen no se muestra**. El contenedor de IA vacío o sin valor es deuda visual.

### Cuándo el resumen SÍ ayuda: la checklist del lado del lector

"How to Review AI-Generated Dashboard Summaries" (Mortana's Academy, mayo 2026, rev. julio 2026) [37] da la vara desde el lado del que lee: el buen resumen **reduce el esfuerzo de lectura sin cortar el camino a la evidencia** — deja transparentes definiciones, filtros y frescura del dato, **separa observación (dato) de interpretación (generado)** y no convierte fluctuaciones chicas en narrativa confiada. Su hábito de verificación: reproducir al menos un cálculo crítico desde la fuente. Y la síntesis editorial de NN/g (11 de septiembre de 2026) [12]: la IA puede aportar palabras e ideas, pero **alguien tiene que poder respaldar lo publicado** — la responsabilidad no se delega en el modelo. En NorthSignal, "poder respaldar" tiene una implementación directa: derivar cada afirmación de la capa de lectura desde los datos estructurados y las funciones canónicas (`metrica_*`, `ventana_metrica`), no desde una paráfrasis del texto libre del agente.

El cierre lo pone **The Custodial Era of UX** (NN/g, 28 de agosto de 2026) [11]: el trabajo de esta época es exactamente este proyecto — decidir qué del output de la IA se queda, qué se pliega y qué se corta; "shipear rápido no es lo mismo que crear algo útil"; y la estrategia número tres es la clave arquitectónica: **incrustar los estándares de contenido en el sistema para que guíen la generación y la presentación desde el inicio**, en vez de limpiar a mano cada semana.

---

## Implicaciones concretas para NorthSignal — la receta

**Principio rector: la capa de redacción es una FUNCIÓN de los datos estructurados, no un resumen del texto del agente.** Resumir texto generado con más generación duplica el slop y hereda sus errores sin poder respaldarlos [12][33][37]. El texto crudo del agente queda íntegro, plegado, como evidencia.

1. **Esquema fijo de tres renglones por análisis semanal**, en este orden [6][15][5]:
   - **Veredicto** (≤12 palabras, entidad primero, con verbo): "BHI: CPA +32% en 3 semanas — hay 2 acciones para decidir".
   - **Qué hacer** (1 frase por acción, modo verbal según confianza — tabla del Tema 5): "Aprobá la negativa 'gratis' en Búsqueda-Salud (evidencia a un clic)".
   - **Progreso** (n de m + bloqueo + próxima corrida): "1 de 3 decididas. El semanal vuelve a correr el lunes 10:50".
2. **Límites duros de forma en todo texto derivado**: frase ≤25 palabras (apuntando a 15-20), bloque ≤5 frases, microcopy <3 oraciones, encabezado con verbo y sentence case [1][5][7][25][40].
3. **Umbral de legibilidad medible en CI**: Szigriszt/INFLESZ ≥65 para la capa derivada, 55-65 tolerado solo en lo plegado; usar o portar `alejandromunozes/legibilidad` (GPL-3) como check automático [17][18][20].
4. **Confianza en bandas, no en números**: alta/media/baja con "por qué" plegable (ventana, n, madurez del dato); prohibido el porcentaje decorativo; con banda baja el CTA cambia de "Aprobá" a "Mirá y decidí"; "No se puede saber con estos datos" se renderiza como veredicto de primera clase, no como error [22][23].
5. **Lo generado se marca y se puede plegar/apagar por sección**; si para una cuenta no hay nada que decir, la sección no aparece (nada de cajas vacías ni "todo estable" de relleno) [34][38].
6. **Errores y estados con la gramática qué-pasó + qué-hacer**, tono directo, cero humor en el error; el "parar, no improvisar" de la casa se refleja en el front: "No se pudo leer la ventana de BHI. Esta cifra no es confiable hasta que se resuelva (ticket #N)" [25][26][27].
7. **Separación visual y semántica de dato vs interpretación**: los números salen de las funciones canónicas y se muestran como dato; la lectura del agente se rotula como interpretación [37].
8. **El progreso de tareas largas de agente** sigue el patrón Slow AI: qué % va (por tiempo), qué bloquea, breadcrumbs conceptuales de hallazgos, y resumption summary al volver a la app [9][35].

---

## Fuentes

Las 39 numeradas a continuación fueron abiertas y leídas (WebFetch) salvo las tres marcadas como **complementarias** (solo snippet sustancial de búsqueda). Fechas según constan en cada página.

**GOV.UK y gobierno**

1. **Use clear language — GOV.UK content and publishing guidance** — https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/ — vigente 2026 — Frases ≤25 palabras, párrafos ≤5 frases, 80% prefiere lenguaje claro (los especialistas también), términos técnicos explicados la primera vez.
2. **Create a clear structure — GOV.UK content and publishing guidance** — https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-structure/ — vigente 2026 — Frontloading textual, patrón F (se lee 20-28%), encabezados con verbo y sin preguntas.
3. **Writing to GOV.UK standards (índice, Beta)** — https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/ — 2026 — Las 8 guías de escritura del estándar vigente.
4. **Launching GOV.UK's new content and publishing guidance — Inside GOV.UK** — https://insidegovuk.blog.gov.uk/2026/06/08/launching-gov-uks-new-content-and-publishing-guidance/ — 8 jun 2026 — La actualización reciente: 4 manuales → 1 sitio, 130+ páginas reescritas, para ~3.000 publishers.

**Nielsen Norman Group**

5. **Plain Language Is for Everyone, Even Experts** (Hoa Loranger) — https://www.nngroup.com/articles/plain-language-experts/ — 8 oct 2017 — El estudio pedido: expertos prefieren claro; 15-20 palabras/frase; layering para audiencias secundarias.
6. **Inverted Pyramid: Writing for Comprehension** (Amy Schade) — https://www.nngroup.com/articles/inverted-pyramid/ — 11 feb 2018 — Conclusión primero en cada capa; baja costo de interacción; banca el skimming.
7. **UX Copy Sizes: Long, Short, and Micro** (Taylor Dykes) — https://www.nngroup.com/articles/ux-copy-sizes/ — 16 may 2025 — Micro <3 oraciones; short 2-3 párrafos/una idea; long para complejidad real.
8. **The 3 I's of Microcopy** (Dykes, Moran, Kaley) — https://www.nngroup.com/articles/3-is-of-microcopy/ — 1 ago 2025 — Clasificar microcopy por objetivo (informar/influir/interactuar), uno por pieza.
9. **Progress Indicators Make a Slow System Less Insufferable** (Katie Sherwin) — https://www.nngroup.com/articles/progress-indicators/ — 26 oct 2014 — Umbrales 1s/10s; percent-done + texto; estimaciones con colchón.
10. **State of UX 2026** (Moran, Budiu, Gibbons et al.) — https://www.nngroup.com/articles/state-of-ux-2026/ — 16 ene 2026 — "Año de la fatiga de IA"; slop ubicuo; diferenciarse por juicio.
11. **The Custodial Era of UX: Cleaning Up After AI** (Kaley, Budiu) — https://www.nngroup.com/articles/ai-ux-debt/ — 28 ago 2026 — Deuda UX de la generación rápida; incrustar estándares de contenido para guiar la generación.
12. **AI Can Help Write an Article, but It Can't Stand Behind It** (Raluca Budiu) — https://www.nngroup.com/articles/ai-editorial-process/ — 11 sep 2026 — La responsabilidad por el texto es humana/del sistema; base del "derivar, no parafrasear".
13. **We Still Need Long-Form Copy** — NN/g — 31 ago 2026 — El largo se justifica con complejidad y confianza; verificada vía [14] (el artículo directo no resolvió por URL).
14. **NN/g Articles (listado oficial)** — https://www.nngroup.com/articles/ — leído 13 sep 2026 — Confirma títulos y fechas de las piezas jun-sep 2026 usadas.

**BLUF y pirámide**

15. **BLUF: The Military Standard That Can Make Your Writing More Powerful** (Animalz) — https://www.animalz.co/blog/bottom-line-up-front — 9 sep 2019, actualizado 3 feb 2026 — El "so what" primero; la conclusión suele estar al final del borrador: subirla.
16. **Why The Pyramid Principle Is Not A Data Storytelling Framework** (Brent Dykes) — https://www.effectivedatastorytelling.com/post/why-the-pyramid-principle-is-not-a-data-storytelling-framework — 22 jul 2026 — Los límites del answer-first: sin confianza previa o con hallazgo contraintuitivo, hay que preparar con evidencia.

**Legibilidad en español**

17. **Validación de la Escala INFLESZ** (Barrio-Cantalejo et al., Anales Sis San Navarra) — https://scielo.isciii.es/scielo.php?script=sci_arttext&pid=S1137-66272008000300004 — 2008 — Los cortes: <40/40-55/55-65/65-80/>80; por qué "normal" es 55-65.
18. **Índice Inflesz: qué es, cómo se calcula y para qué sirve** (Tu Web Accesible) — https://www.tuwebaccesible.es/indice-inflesz-que-es-y-para-que-sirve/ — 9 jul 2024 — Fórmula y recomendación >65 para público amplio.
19. **SEO y la prueba de legibilidad Fernández-Huerta / Flesch-Szigriszt** (SEOQuito) — https://seoquito.com/seo-legibilidad-flesch-szigriszt-fernandez-huerta/ — 24 sep 2016 — Las dos fórmulas con coeficientes; 73-74 como ideal web citando Searchmetrics.
20. **alejandromunozes/legibilidad** (GitHub) — https://github.com/alejandromunozes/legibilidad — activo — Herramienta Python GPL-3: Fernández-Huerta, Szigriszt, INFLESZ, µ, Crawford; motor de legible.es; portable a CI.
21. **Guía panhispánica de lenguaje claro y accesible** (RAE/ASALE, Espasa 2024; reseña del programa Lenguaje Claro del Poder Judicial CABA) — https://lenguajeclaro.jusbaires.gob.ar/publicacion-guia-panhispanica-de-lenguaje-claro-y-accesible/ — 31 oct 2024 — El respaldo normativo en español: contra subordinación, gerundios, pasivas y párrafos largos; "derecho a comprender".

**Microcopy de acción y confianza**

22. **People + AI Guidebook: Explainability + Trust** (Google PAIR) — https://pair.withgoogle.com/chapter/explainability-trust/ — vigente — Confianza calibrada; bandas vs %; N-best; decir cuándo falta dato y devolver el juicio al usuario.
23. **Confidence Indicators — Trust AI UX Pattern** (AI UX Playground) — https://aiuxplayground.com/pattern/confidence-indicators/ — actualizado 10 jul 2026 — Bandas en lenguaje llano, "por qué" plegable, anti-patrón del 97% decorativo.
24. **Microcopy UX in 2026: Why Clear Words Still Don't Stop User Hesitation** (Userpilot) — https://userpilot.com/blog/microcopy-ux/ — 26 ago 2026 — Los 4 trabajos del microcopy; verbo adelante; detalle crítico al inicio; el hedging de los LLM en errores.

**Design systems y voz de sistema**

25. **Top 10 tips for Microsoft style and voice** (Microsoft Style Guide) — https://learn.microsoft.com/en-us/style-guide/top-10-tips-style-voice — actualizado 2 jul 2026 — "Get to the point fast", "bigger ideas fewer words", empezar con verbo, ejemplos antes/después.
26. **Material's Communication Principles: Intro to UX Writing** (Google Codelabs) — https://codelabs.developers.google.com/codelabs/material-communication-guidance — vigente — Tone map; prioridad dialog/banner/snackbar; el humor en el error mina confianza.
27. **Designing messages** (Atlassian Design System) — https://atlassian.design/foundations/content/designing-messages — vigente — 5 tipos de mensaje con semántica de color; "el mal mensaje puede ser la razón por la que se van".
28. **Content — App design** (Shopify) — https://shopify.dev/docs/apps/design/content — vigente — Séptimo grado como nivel de lectura objetivo; un término por concepto; CTA con verbo fuerte.
29. **Writing** (Apple Human Interface Guidelines) — https://developer.apple.com/design/human-interface-guidelines/writing — vigente — Claridad, lo importante primero, tono por contexto, verbo en botones. (Página renderizada por JS: la lectura fue parcial; se citan solo los principios generales.)

**AI slop, foros y casos**

30. **AI slop is killing online communities** (Hacker News, hilo) — https://news.ycombinator.com/item?id=48053203 — ~may 2026 — Moderación baneando ~600 cuentas IA/mes; "calorías vacías"; market for lemons.
31. **Tripadvisor AI summaries give glowing reviews to dangerous hotels** (Hacker News, hilo) — https://news.ycombinator.com/item?id=48797529 — 5 jul 2026 — Sesgo positivo del resumen; "dejá de meter resúmenes IA en todos lados"; pedir camino a la fuente.
32. **AI Slop (paper SSRN)** (Hacker News, hilo) — https://news.ycombinator.com/item?id=49586011 — sep 2026 — La definición: output probabilístico de bajo esfuerzo que carga asimétricamente al receptor.
33. **"An Endless Stream of AI Slop": How Developers Discuss the Burden of AI-Assisted Software Development** (Baltes, Cheong, Treude; arXiv) — https://arxiv.org/html/2603.27249v3 — 13 jun 2026 — 1.154 posts de Reddit+HN; competencia superficial, asimetría de esfuerzo, producibilidad masiva.
34. **Apple pauses AI notification summaries for news after generating false alerts** (TechCrunch) — https://techcrunch.com/2025/01/16/apple-pauses-ai-notification-summaries-for-news-after-generating-false-alerts — 16 ene 2025 — Caso BBC; cursiva para lo generado, aviso de falibilidad, apagado por app.
35. **Slow AI: Designing User Control for Long Tasks** (Jakob Nielsen, Substack) — https://jakobnielsenphd.substack.com/p/slow-ai — 13 oct 2025 — Progreso en 3 capas, breadcrumbs conceptuales, resumption summary, cono de incertidumbre.
36. **Classic Usability Important for AI** (Jakob Nielsen, Substack) — https://jakobnielsenphd.substack.com/p/classic-usability-ai — 1 sep 2023 — Las heurísticas clásicas (estado del sistema, densidad) aplican intactas a productos IA.
37. **How to Review AI-Generated Dashboard Summaries** (Mortana's Academy) — https://www.mortanasacademy.com/articles/questions-to-ask-before-trusting-an-ai-dashboard-summary — 15 may 2026, rev. 29 jul 2026 — 8 chequeos; separar observación de interpretación; conservar el camino a la evidencia.
38. **UX: Hide AI summary box if no summary or summarize button** (Discourse, PR #28025) — https://github.com/discourse/discourse/pull/28025 — jul 2024 — La discusión de comunidad OSS: la caja de IA vacía no se muestra.
39. **HN Algolia API — búsqueda "AI summaries" (stories 2025-2026)** — https://hn.algolia.com/api/v1/search?query=%22AI%20summaries%22&tags=story — leído 13 sep 2026 — El corpus de fallas con fecha: YouTube (dic 2025), Wikipedia "yuck" (jun 2025), Google salud (ene 2026), audiencias de noticias (jul 2025).

**Complementarias (solo snippet sustancial de búsqueda; no abiertas)**

40. **Style guide — UX writing best practices** (Material Design 3) — https://m3.material.io/foundations/content-design/style-guide/ux-writing-best-practices — vigente — Sentence case universal; segmentos cortos y escaneables. (La página es SPA y no rindió texto al fetch.)
41. **Escalas de legibilidad aplicadas a informes médicos** (CLAC, Universidad Complutense) — https://revistas.ucm.es/index.php/CLAC/article/download/70574/4564456556008/ — 2020 — Fernández-Huerta 1959 con 7 niveles; punto medio 60 como "normal" transversal. (PDF descargado; texto no parseado por el fetcher.)
42. **"Turn It Off" — Google starts scanning your Gmail** (Forbes) — https://www.forbes.com/sites/zakdoffman/2026/05/07/turn-it-off-google-update-starts-scanning-your-gmail/ — 7 may 2026 — El backlash de Gmail 2026: features de IA activadas por defecto y usuarios buscando apagarlas.
