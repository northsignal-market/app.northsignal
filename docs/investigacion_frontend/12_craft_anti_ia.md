# 12 · Craft anti-IA: qué delata una UI generada y cómo se ve la mano humana (2025–2026)

**Fecha de investigación:** 13 de septiembre de 2026
**Pregunta:** ¿qué hace que un dashboard dark con glow y gradientes se lea "hecho por IA", y qué separa
la ejecución fina (Linear, trading UIs serias) del neón genérico? Aplicado a nuestro lenguaje **Pulse**:
negro + dot-grid + auroras, tarjetas con top-highlight azul→cyan, cifras blanco→azul hielo, sparklines
cyan, Inter con tabular-nums, acento #0062CC/#4D9DFF + cyan #22D3EE.

**La conclusión en una línea:** el problema nunca es el glow ni el gradiente ni el dark mode — es la
**falta de dueño**. La IA promedia su corpus (violeta indigo-500, Inter sin ajustar, seis tarjetas
idénticas, brillo en todo); el craft humano se reconoce por **un sistema con reglas numéricas que se
cumplen siempre** y **un protagonista por vista**. Nuestro azul→cyan anclado a marca ya nos saca del
50% del problema; el otro 50% es dosificación y consistencia.

---

## 1 · Los delatores según la comunidad (el consenso 2026)

El fenómeno tiene nombre desde 2025 ("AI slop UI", "purple gradient syndrome") y en 2026 ya hay
datos. Developers Digest auditó **1.590 submissions de Show HN** contra 16 patrones de slop:
**22% con slop pesado (4+ patrones), 32% leve (2–3), 46% limpio (0–1)**. Es decir: más de la mitad
de lo que se lanza hoy tiene tells reconocibles a simple vista.

Los 16 patrones del audit (abril 2026), agrupados:

**Tipografía (3):**
1. Inter en todo, sobre todo en heros centrados — Inter no es el problema, Inter *sin ninguna otra decisión tipográfica* sí
2. Combos repetidos: Space Grotesk, Instrument Serif, Geist
3. Una palabra en serif itálica dentro de un titular Inter

**Color (5):**
4. "VibeCode Purple" — el lavanda específico que se filtró de los prompts de generación de imágenes
5. Dark mode permanente con texto gris medio y labels en ALL-CAPS
6. Contraste del cuerpo apenas pasando WCAG AA
7. Gradientes aplicados a todo el layout
8. **Glows de color grandes y box-shadows de color** ← el que nos toca

**Layout (8):**
9. Hero centrado con sans genérica
10. Badge arriba del H1
11. Bordes de color en tarjetas (arriba o izquierda) ← **nuestro top-highlight ES este patrón**; ver §6 por qué se salva o no
12. Tarjetas de features idénticas con icono arriba
13. Secuencias numeradas "1, 2, 3"
14. Filas de stats banner
15. Sidebar con **emojis como iconos**
16. Headings y labels en ALL-CAPS

A eso la comunidad suma los tells de **copy**: el thread "Tell HN: I'm tired of formulaic 'LLM house
style' submissions" (ago 2025, 62 puntos) los cataloga — bullets forzados donde iba prosa, "It's not
just another X", cierre con "Would love to get your feedback!", emojis como señal más confiable de
texto LLM. En castellano el equivalente es el "Potenciá tus insights" / "Desbloqueá el futuro":
copy que podría estar en cualquier producto porque no sabe nada del dominio.

Y el origen técnico del violeta está documentado y hasta tiene disculpa oficial: **Adam Wathan
(creador de Tailwind) el 7/8/2025**, 684K+ vistas: *"I'd like to formally apologize for making every
button in Tailwind UI `bg-indigo-500` five years ago, leading to every AI generated UI on earth also
being indigo."* El loop: Tailwind UI usó indigo → tutoriales y repos lo copiaron → los modelos
entrenaron con eso → sus outputs se republicaron → la siguiente ronda de training tenía todavía más
indigo. La IA no elige violeta porque sea lindo: es la mediana estadística del corpus.

**La regla que se deduce:** cada uno de estos tells es un default sin decisión. El anti-tell no es
"prohibido el gradiente": es que cada gradiente, glow y radio tenga una razón que alguien pueda
explicar.

## 2 · El delator nuevo que nos toca de cerca: el look "terminal cyan"

Ojo con esto porque es de abril 2026 y es exactamente nuestro barrio. **"Ask HN: What's with the
Wargames-like UX lately?"** (15/4/2026): la comunidad detectó que Claude pasó del violeta al
**retro-terminal — verde/cyan sobre negro puro, monospace, scanlines** — y ya lo lee como el nuevo
tell: *"Claude was doing purple-tinged UIs and now it's making retro-terminal designs."* Un
comentarista de HN (jul 2026): *"The overuse of blue and purple gradient fills on the landing page
is a telltale sign of AI slop."* Otro (jun 2026) ya usa "Claude coded page" como categoría estética.

**Pulse (negro + cyan glow + dot-grid) está a dos decisiones de distancia de ese cliché.** Lo que
nos separa, y hay que protegerlo explícitamente:
- **Inter, no monospace** como voz principal (monospace solo tabular en datos si hiciera falta — ya usamos tabular-nums de Inter, mejor)
- **Azul de marca (#0062CC) como ancla**, cyan solo como remate del gradiente y en sparklines — el terminal-slop es cyan/verde puro sin azul corporativo
- **Negro con temperatura** (no #000 puro; ver §4) y auroras sutiles, no scanlines ni ruido CRT
- **Cero estética hacker**: sin glitch, sin cursor parpadeante, sin ASCII

## 3 · Las marcas del craft humano

Lo que la comunidad identifica como "se nota una persona" es siempre lo mismo: **sistema + excepciones
deliberadas**. Las piezas, con números:

**Espaciado religioso 4/8pt.** Todo padding/margin/gap múltiplo de 4 u 8. El punto no es la magia del
8: es que la *predictibilidad del ritmo* se percibe aunque el usuario no la sepa nombrar — "si el
espaciado se siente raro, el usuario siente que algo anda mal aunque no pueda explicarlo". El slop
tiene 17px acá y 23px allá porque cada componente se generó por separado. La inconsistencia de
spacing entre secciones es de los tells estructurales más citados ("uniform component sizing" e
inconsistencias conviven en el mismo sitio generado).

**Jerarquía tipográfica con ratio deliberado.** Escala modular única: para dashboards, ratio bajo
(**1.25 "major third" con base 12px** es la recomendación estándar para UIs densas; ratios altos son
para editorial). Y **máximo 3–5 niveles de énfasis por vista** — "cuando todo grita, nada se
destaca". Cifra grande / label / metadata: tres voces, no seis. **Tabular figures obligatorias en
toda columna numérica** (ya lo tenemos con tabular-nums: es una marca de craft reconocida — la IA
casi nunca lo pone porque casi nadie lo pone en el corpus).

**UNA familia de iconos, un solo stroke.** "Mezclar strokes de 2px con 1.5px destruye la cohesión al
instante." Regla: una familia por interfaz (Lucide, por ejemplo), un stroke-width global, mismo grid
de dibujo. La única excepción legítima es una categoría distinta de gráfico (logo de marca). Los
emojis como iconos de sidebar son patrón #15 del audit de slop.

**Densidad variable por importancia, no uniforme.** El slop reparte todo en tarjetas del mismo
tamaño con el mismo padding. El craft usa *progressive disclosure*: la fila de KPIs respira (padding
generoso, cifra grande), la tabla de detalle va densa, y la diferencia de densidad ES la jerarquía.
UXPin (jun 2026) y toda la literatura de dashboards lo repiten: énfasis por tamaño/posición/color en
lo primario, y lo secundario se gana el espacio con interacción, no con otra tarjeta idéntica.

**Asimetría intencional.** El grid perfectamente simétrico de N tarjetas iguales "huele a que la
máquina tomó todas las decisiones". Una vista con un protagonista (2/3 del ancho) y acompañantes
(1/3) comunica que alguien decidió qué importa. En Pulse: la cifra-héroe de la cuenta no puede pesar
lo mismo que el CPA de un grupo.

**Microcopy con voz del dominio.** Lo genérico ("Build the future of work", "Unlock insights") es
tell de primera categoría. La voz nuestra ya existe: castellano rioplatense, dominio Google Ads.
"Sin términos nuevos para revisar. El semanal corre el lunes." es imposible de generar sin conocer
el sistema — eso es firma.

**Y el meta-hallazgo de 2026:** la respuesta de la industria al slop fue codificar el gusto en reglas
ejecutables. **Hallmark** (Together AI, jul 2026, de 4.6K a 28K+ stars en semanas) es literalmente
eso: **57 "slop-test gates"** + self-critique antes de emitir, 20 temas curados, modos
Build/Audit/Redesign/Study. Y Linear ya lo había hecho en 2024: su redesign redujo **98 variables de
tema a 3** (base, acento, contraste) y migró de HSL a **LCH** para que la elevación fuera matemática
perceptual, no ojo por componente. La lección para Pulse: nuestras reglas tienen que vivir en tokens
y en un archivo que cualquier sesión (humana o agente) respete, no en la memoria de nadie.

## 4 · Dosificación del glow: cuánto brillo tolera una pantalla seria

Acá está la diferencia entre Hyperliquid/Linear y el neón genérico. Los números que aparecen
consistentemente en las guías dark 2026 y en los sistemas que sirven de referencia:

- **Un (1) acento saturado por sistema.** El patrón dominante en dashboards dark serios: "un color
  brillante y saturado contra una paleta desaturada de grises y casi-negros". Linear reserva su
  #5E6AD2 para **marca, focus ring y CTA primario — nada más**. Trading UIs: "paleta dark contenida
  con un solo acento vivo para acción primaria y movimiento de precio; verde/rojo solo para P&L;
  nada de gradientes ruidosos en zonas densas de datos".
- **Halos a 3–8% de opacidad.** "Mantené la opacidad del halo en unos pocos puntos porcentuales por
  vez — el punto es la contención; este es el patrón cuando 'neón' se vería barato pero la página
  necesita un foco dark." Gridlines de charts: 3–8% de luminancia sobre la base.
- **Elevación por luz, no por sombra:** mínimo **4 tokens de superficie**, cada paso **+3–6% de
  luminancia** (otras guías: 5–8%). Base en gris verdadero **#0E–#1A, nunca #000 puro** (halation y
  fatiga). Nota para Pulse: nuestro fondo "negro" debería ser un near-black con cast azul — Linear
  marketing usa #010102, piso casi negro con temperatura, y su escalera de paneles va #0F1011 →
  #191A1B.
- **Texto cuerpo al 85–92% de blanco**, off-whites #E0E0E0–#F0F0F0; "un overlay blanco al 50% es
  cegador" en dark. Blanco puro solo en la cifra protagonista.
- **Dark-mode-first es requisito de uso, no estética,** en interfaces de monitoreo prolongado
  (trading, ops): reduce glare y fatiga en sesiones largas. Pero verde/rojo semántico **necesita
  indicador secundario** (flecha, forma): 8% de los hombres tiene deficiencia de visión de color.

**La regla de "un protagonista por vista"** sale de la literatura de jerarquía (una acción primaria
por pantalla; énfasis en 3–5 niveles) aplicada al brillo: en una vista dark, el elemento más
luminoso se lee como el más importante. Si brillan seis cosas, la vista no tiene tesis. Traducido a
números para Pulse: **por vista, 1 elemento a intensidad plena** (la cifra-héroe con su gradiente, o
el aurora del fondo en el estado vacío — nunca ambos), **máximo 2 glows secundarios** (sparkline
activa, top-highlight de la tarjeta en foco) **al 3–8% de opacidad**, y todo lo demás sin brillo:
hairlines, gris, tipografía.

El tell inverso también existe: "glowing card borders en TODAS las tarjetas + fondo con accent-glow
animado" es el combo neón que el audit marca como slop (patrón #8 + #11). El glow es sal: se nota
cuando falta y arruina cuando sobra.

## 5 · Gradientes con identidad: por qué violeta = IA y azul→cyan puede no serlo

El violeta-rosa no es feo: es **huérfano**. Es el color de nadie, elegido por frecuencia estadística
(indigo-500 → corpus → modelo → más corpus: el "model collapse" estético donde "las colas de la
distribución desaparecen y la mediana domina"). La prueba de que el problema es la orfandad y no el
tono: **Phantom es violeta** y no se lee IA — porque su violeta viene de un rebrand deliberado
(Bakken & Baeck, tipografía custom de F37, sistema de gradientes multi-tono propio). El color con
dueño, historia y sistema no es slop, es marca.

Cómo se ancla un gradiente a la marca (síntesis de las guías 2026 + práctica de sistemas):
- **Duotono de marca:** dos colores del sistema propio, siempre los mismos dos. Nuestro
  #0062CC→#22D3EE es exactamente eso — azul corporativo → cyan de datos. Un solo par, no una
  familia de gradientes.
- **Un eje consistente:** misma dirección (nuestro top-highlight: horizontal; cifras: vertical
  blanco→azul hielo). El slop cambia el ángulo del gradiente por componente.
- **Gradiente con rol semántico, no decorativo:** en Pulse el gradiente azul→cyan significa "dato
  vivo del sistema" (cifras, sparklines, highlight). Si un día aparece en un botón de borrar, se
  murió la semántica.
- **Construir rampas en OKLCH/LCH** (10–12 pasos, luminosidad perceptual constante) para que hover/
  active/dark no desvíen el tono — es lo que hizo Linear al pasar de HSL a LCH.
- **Dosis:** el gradiente de texto en cifras grandes es patrón de slop *cuando está en todas las
  cifras*. Reservarlo para la cifra-héroe de cada vista; los KPIs secundarios en off-white plano.

## 6 · Radios, bordes y elevación como firma (y el error de mezclar lenguajes)

**Escala única de radios, semántica, corta:** 4/8/12/16 (o la que sea, pero UNA), con nombres
(`radius-s/m/l`) para poder cambiarla sin tocar estructura. El slop mezcla 6, 10, 14 y 24 en la
misma vista porque cada componente vino de un prompt distinto. "Uniform corner radius throughout"
también puede ser tell cuando es un solo radio clavado en todo sin relación con el tamaño del
elemento: la firma es la *escala*, no un número único.

**Regla concéntrica para anidados** (dev.to, jul 2026): **radio interno = radio externo − gap**
(gap = border + padding). Radios iguales adentro y afuera producen ese pellizco en el diagonal que
"se ve mal sin saber por qué" — y es un microdetalle que la IA no aplica casi nunca, o sea, es
firma barata de craft.

**Nuestro top-highlight:** el "colored border top" es patrón #11 del audit de slop, PERO la versión
craft existe y está documentada: **1px inset de luz arriba** (`box-shadow: inset 0 1px 0
rgba(255,255,255,.06)` + borde 8% blanco) simulando luz desde arriba — física de "top lighting",
no decoración. La diferencia entre firma y tell: (a) opacidad 6–8%, no un lightsaber; (b) solo en
tarjetas de primer nivel; (c) el matiz sale del par de marca (blanco-azulado), no de un arcoíris
por categoría.

**Elevación de un solo sistema.** El error letal es mezclar lenguajes de profundidad:
glass (blur+transparencia) + neón (glow) + flat (bordes) en la misma vista = tres teorías de la luz
contradictorias, y eso es lo que produce las "sombras incoherentes" del slop. NN/g sobre
glassmorphism: **acento, no lenguaje completo** — "sparingly", con contraste WCAG verificado, y
está directamente contraindicado en "información profesional de alta densidad". Para Pulse: la
elevación es **luminancia de superficie + hairlines + el inset top-light**. Nada de blur de vidrio,
nada de drop-shadows negras grandes. Un solo modelo de luz: viene de arriba, es azulada, es tenue.

## 7 · Microdetalle: lo que separa premium de template

Los detalles que ningún generador pone por defecto y todo evaluador siente:

- **Focus states diseñados:** `:focus-visible` (no `:focus`), ring 2px del azul de marca con offset
  2px, contraste ≥3:1 (WCAG 2.2 endureció esto: 2.4.11 Focus Not Obscured + 2.4.13), y el outline
  **sigue el border-radius** del elemento. Que el acento de marca sea también el color de foco es
  el patrón Linear: una sola alma para marca/foco/acción.
- **Empty states con voz del dominio:** estructura de Yifrah — qué está vacío, por qué importa, qué
  hacer. En Pulse el vacío es un estado de primera clase ("cero filas ≠ hallazgo"): "v_para_actuar
  está vacía: no hay nada que pida acción hoy" es un empty state que ningún template puede escribir.
  El dot-grid + aurora tenue puede ser el fondo de esos vacíos — ahí sí, porque no compite con datos.
- **Motion con 2–3 easings documentados y basta:** default-ease custom, ease-out para entradas,
  duración escalada por distancia (patrón Carbon/Atlassian), 120–240ms para UI densa. **Cero
  bounce/elastic** — "bounces en cada hover" es tell del audit. Motion tokens
  (duración+curva+propiedad) en CSS variables, una sola fuente de verdad.
- **Números que se comportan:** tabular-nums (ya), CPA que devuelve NULL mostrado como "—" con
  explicación y no como 0 (nuestra regla de dominio hecha UI), deltas con flecha+color.
- **Firma visual propia y única:** una sola marca idiosincrática repetida con disciplina (nuestro
  candidato natural: el top-highlight azul→cyan + el dot-grid). La firma funciona por repetición
  consistente de UNA cosa, no por acumulación de efectos. Zuzai (sep 2026, 38 comentarios en
  lobste.rs) muestra hasta dónde llegó el péndulo: la comunidad inventó una palabra para etiquetar
  "acá no hubo IA" — el craft visible es hoy un diferenciador comercial.

## 8 · Reglas Pulse: checklist "se ve humano" (15) y prohibiciones (5)

### Las 15 reglas con números

1. **Un protagonista luminoso por vista.** 1 elemento a intensidad plena; máximo 2 glows de apoyo
   al 3–8% de opacidad; el resto, sin brillo. Si una vista nueva necesita un tercer glow, uno de los
   dos anteriores baja.
2. **Gradiente = solo el par de marca.** #0062CC→#22D3EE y blanco→azul hielo. Nada de terceros
   colores en gradientes, un eje por uso, jamás en elementos destructivos/neutrales.
3. **Gradiente de texto solo en la cifra-héroe** (1 por vista). KPIs secundarios: off-white plano
   85–92% de blanco.
4. **Fondo near-black con temperatura** (#0A0C10 aprox, cast azul), nunca #000. Escalera de 4
   superficies, +3–6% de luminancia por paso, tokens con nombre.
5. **Top-highlight solo en tarjetas de nivel 1:** inset 1px al 6–8% de opacidad. Tarjetas
   secundarias: hairline 1px blanco 8% sin highlight. Es nuestra firma: se protege no repitiéndola.
6. **Radios: escala única 4/8/12/16** + regla concéntrica en anidados (interno = externo − gap).
7. **Espaciado 4/8pt sin excepciones**, y una sola plantilla de padding por tipo de tarjeta.
8. **Tipografía: 3 niveles de énfasis por vista** (cifra/label/metadata), escala modular ratio 1.25
   base 12–13px, tabular-nums en todo número, tracking apretado solo en display.
9. **Una familia de iconos, un stroke (1.5px), cero emojis** en UI (los emojis quedan para el chat
   con Andrés, no para headers ni sidebar).
10. **Verde/rojo solo para deltas de plata/rendimiento, siempre con flecha o forma** además del
    color. Cyan nunca significa "bien": significa "dato".
11. **Densidad variable:** fila KPI aireada (padding 24), tablas densas (filas 32–36px), y prohibido
    el grid de N tarjetas idénticas icono+título+dos líneas.
12. **Microcopy rioplatense del dominio en todos los estados:** empty/error/loading dicen qué pasa
    en términos del sistema ("El semanal corre el lunes", "Datos de ayer aún madurando"), nunca
    genéricos traducidos.
13. **Motion: 2 easings tokenizados, 120–240ms, cero bounce.** Las transiciones comunican estado
    (aparece dato nuevo, se aprueba acción), no personalidad.
14. **Focus ring 2px azul marca, offset 2px, contraste ≥3:1, sigue el radio.** El azul de marca es
    también foco y CTA — una sola alma, patrón Linear.
15. **Las reglas 1–14 viven en tokens y en un archivo del repo** que toda sesión respeta (nuestro
    equivalente de los 57 gates de Hallmark / las 3 variables de Linear). Una regla que vive en la
    memoria de una sesión no es una regla.

### Los 5 delatores que evitamos desde ya

1. **Violeta/indigo/rosa en cualquier gradiente** — el tell #1 mundial, con disculpa oficial de
   Tailwind incluida.
2. **Glow multiplicado:** bordes luminosos en todas las tarjetas + fondo animado + cifras brillando
   a la vez. Neón genérico instantáneo.
3. **Look terminal-hacker** (el tell Claude de 2026): monospace como voz principal, cyan/verde sobre
   #000 puro, scanlines, glitch. Estamos a dos pasos de ese barrio: Inter + azul de marca + negro
   templado son la frontera.
4. **Grid de tarjetas idénticas** con icono arriba + título + dos líneas, spacing desparejo entre
   secciones, radios distintos por componente.
5. **Copy huérfano y emojis decorativos:** "Potenciá tus insights", 🚀 en un header, labels ALL-CAPS
   en gris medio por todos lados.

---

## Fuentes

### Foros y comunidad (con fecha)

1. **Tell HN: I'm tired of formulaic, "LLM house style" Show HN submissions** — https://news.ycombinator.com/item?id=44780249 — 2025-08-03 (62 pts, 30 comentarios) — catálogo comunitario de tells de copy LLM: bullets forzados, "not just another X", emojis como señal confiable.
2. **X · Adam Wathan (@adamwathan), disculpa por indigo-500** — https://x.com/adamwathan/status/1953510802159219096 — 2025-08-07 (684K+ vistas) — el origen documentado del violeta como default de IA; feedback loop corpus→modelo→corpus.
3. **HN: Show HN Wingspan Games** — https://news.ycombinator.com/item?id=46340877 — 2025-12-20 — dev autoconsciente del "signature claude code purple gradient": el tell ya es lenguaje común entre builders.
4. **Ask HN: What's with the Wargames-like UX lately?** — https://news.ycombinator.com/item?id=47774003 — 2026-04-15 — la comunidad detecta el sucesor del violeta: retro-terminal cyan/verde sobre negro como nuevo tell de Claude. Directamente relevante a Pulse.
5. **HN: Color palette gives away AI slop** — https://news.ycombinator.com/item?id=48269907 — 2026-05-25 — paletas y layouts idénticos en sitios generados con Claude Code, reconocibles a golpe de vista.
6. **X · Khusboo Tayal, "The Anti-Slop Way to Do UI Design With AI in 2026"** — https://x.com/KhusbooT14835/article/2065090391289073847 — 2026-06-11 — artículo comunitario anti-slop en X (paywall; título y fecha verificados).
7. **HN: Show HN Hallmark – Anti-AI-Slop Design Skill** — https://news.ycombinator.com/item?id=49058547 — 2026-07-26 — recepción comunitaria de la herramienta anti-slop más popular del año.
8. **lobste.rs: "Zuzai, a new word, indicates the absence of AI"** — https://lobste.rs/search?q=zuzai (story de zuzai.org) — 2026-09-01 (38 comentarios) — la comunidad acuña vocabulario para etiquetar trabajo sin IA: el craft visible como valor diferencial.
9. **Comentarios HN vía Algolia** — https://hn.algolia.com/?query=%22purple%20gradient%22 — pavlov 2026-07-01 ("overuse of blue and purple gradient fills… telltale sign of AI slop"); wunderlotus 2026-06-04 ("Claude coded page"); kaydub 2026-02-07 — el tell como sentido común de la comunidad durante 2026.

### Artículos y guías 2026

10. **AI Design Slop: 16 Patterns That Out Your App as Vibe-Coded** (Developers Digest) — https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it — 2026-04-22 — la mejor taxonomía: 16 patrones + audit de 1.590 Show HN (22% slop pesado / 32% leve / 46% limpio).
11. **Dark Mode Design Systems: patterns, tokens, hierarchy** (Muzli) — https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/ — 2026-04-12 — 4 niveles de superficie mínimo, pasos de 5–8% de luminancia, acento +10–20% saturación en dark, off-whites #E0E0E0–#F0F0F0, "50% white overlay is blinding".
12. **We Don't Want a Beige Internet** (Wheels Up Collective, Elise Oras) — https://www.wheelsupcollective.com/post/we-dont-want-a-beige-internet — 2026-05-27 — "la IA no diseña: promedia"; hasta con hex correctos, el color sin jerarquía sigue siendo slop; marca primero, prompt después.
13. **Dashboard Design Principles: The Definitive Guide** (UXPin) — https://www.uxpin.com/studio/blog/dashboard-design-principles/ — 2026-06-05 — densidad por progressive disclosure, énfasis único por tamaño/posición/color, agrupación por espacio en blanco.
14. **Trading App Design: UI, UX & System Architecture** (Lollypop) — https://lollypop.design/blog/2026/june/trading-app-design/ — 2026-06-01 (act. 2026-07-13) — dark-first como requisito de uso; verde/rojo solo P&L con indicador secundario (8% daltonismo masculino); calma visual con densidad alta.
15. **Hallmark: the anti-AI-slop design skill** (CoddyKit) — https://www.coddykit.com/pages/blog-detail?id=512918&slug=hallmark-the-anti-ai-slop-design-skill-that-makes-ai-generated-uis-look-human-4- — 2026-07-13 — 57 slop-test gates, 20 temas, self-critique pre-emisión; el gusto codificado en reglas ejecutables.
16. **GitHub · Nutlope/hallmark** — https://github.com/Nutlope/hallmark — 2026 (Show HN jul 2026; 4.6K→28K+ stars) — modos Build/Audit/Redesign/Study; "Study" extrae ADN de diseño (macroestructura, pares tipográficos, anclas de color) de referencias admiradas.
17. **The Slop Report — Weekly Roundup** — http://slopreport.net/2026/07/25/weekly-roundup — 2026-07-25 — el ecosistema anti-slop: ~168 historias/semana; plataformas penalizando lo genérico; landing pages con "fake metrics y estética apurada".
18. **The concentric border-radius rule** (dev.to, Daniel Cheong) — https://dev.to/sgbp/the-concentric-border-radius-rule-why-nested-rounded-corners-look-slightly-wrong-3hog — 2026-07-26 — interno = externo − gap; por qué radios iguales anidados "se ven mal sin saber por qué".
19. **"An Endless Stream of AI Slop"** (Baltes, Cheong, Treude — arXiv 2603.27249) — https://arxiv.org/abs/2603.27249 — v1 2026-03-28, v4 2026-08-28 — análisis académico de 1.154 posts de Reddit+HN sobre slop: fricción de revisión, erosión de confianza, tragedia de los comunes.
20. **AI Slop Web Design: Complete Guide** (925 Studios) — https://www.925studios.co/blog/ai-slop-web-design-guide — 2026-09-11 — tells: Inter sin decisiones, gradiente violeta→azul, headlines vagos, sizing uniforme, micro-interacciones ausentes; fix: voz del founder, motion con propósito.
21. **Dark mode dashboard design patterns 2026** (AYDesign) — https://www.aydesign.ai/blog/dark-mode-dashboard-design-patterns-2026 — 2026-09-11 — los números del glow serio: base #0E–#1A, elevación +3–6%/paso, radius 4–8px, texto 85–92% de blanco, gridlines 3–8%, halos "de a pocos puntos porcentuales", un acento saturado.
22. **The Purple Gradient Problem** (dev.to, James Anderson) — https://dev.to/james_anderson_h/the-purple-gradient-problem-why-ai-ui-all-looks-alike-and-how-to-fix-it-3j65 — 2026-09-13 — lista completa de tells 2026 + fixes: DESIGN.md, color semántico, direcciones divergentes, banned list en review.
23. **10 Techniques to Improve Visual Hierarchy in 2026 UX** (Parallel) — https://www.parallelhq.com/blog/what-can-be-used-to-improve-visual-hierarchy — 2026 — 3–5 niveles de énfasis; "cuando todo grita, nada se destaca"; una acción primaria por pantalla.
24. **Visible Focus Rings: A Practical Guide for 2026** (72Technologies) — https://www.72technologies.com/blog/focus-rings-visible-focus-guide — 2026 — WCAG 2.2 (2.4.11/2.4.13), ring ≥3:1, :focus-visible, outline que respeta border-radius.

### Contexto 2023–2025 y referencias de craft

25. **Why Your AI Keeps Building the Same Purple Gradient Website** (prg.sh) — https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website — 2025-10-26 — mecánica del default estadístico; constraints explícitos, prompting por referencias, prohibiciones.
26. **AI Purple Problem: make your UI unmistakable** (dev.to, Jainil Prajapati) — https://dev.to/jaainil/ai-purple-problem-make-your-ui-unmistakable-3ono — 2025-10-08 — model collapse estético; tokens primero, rampas OKLCH/HCT de 10–12 pasos, 4.5:1 en CI.
27. **How we redesigned the Linear UI, part II** (Linear, Karri Saarinen et al.) — https://linear.app/now/how-we-redesigned-the-linear-ui — 2024-03-28 — 98 variables → 3 (base/acento/contraste), HSL→LCH, elevación por opacidades de blanco/negro, Inter Display solo en headings: el estándar de craft dark.
28. **Glassmorphism: Definition and Best Practices** (NN/g, Megan Brown) — https://www.nngroup.com/articles/glassmorphism/ — 2024-06-07 — "sparingly"; acento y no lenguaje; contraindicado en información densa profesional; contraste WCAG obligatorio.
29. **Introducing Phantom's new brand identity** (Phantom + Bakken & Baeck) — https://phantom.com/learn/blog/introducing-phantom-s-new-brand-identity — 2023-07 — el contraejemplo clave: violeta CON dueño (tipografía F37 custom, sistema de gradientes propio) no es slop. El problema es la orfandad, no el tono.
30. **2025 was the year AI slop went mainstream** (Euronews) — https://www.euronews.com/next/2025/12/28/2025-was-the-year-ai-slop-went-mainstream-is-the-internet-ready-to-grow-up-now — 2025-12-28 — el slop como fenómeno cultural masivo; contexto del péndulo hacia lo artesanal.
31. **The 8pt Grid System** (Rejuvenate Digital) — https://www.rejuvenate.digital/news/designing-rhythm-power-8pt-grid-ui-design — s/f (consultado 2026-09) — el ritmo predecible se percibe sin nombrarse; base de la consistencia de spacing.
32. **Consistent icon system** (Dutchicon) — https://dutchicon.com/consistent-icon-system/ — s/f (consultado 2026-09) — una familia por interfaz; mezclar strokes 2px/1.5px destruye cohesión; la excepción es otra categoría de gráfico.
33. **Motion — Carbon Design System (IBM)** — https://carbondesignsystem.com/elements/motion/overview/ — s/f (oficial, vigente 2026) — duración no lineal escalada por distancia; tokens de motion (duración+curva) como fuente única.
34. **Type Scales / modular scale para UI** (Imperavi + Varsity Tutors dashboard lessons) — https://imperavi.com/books/ui-typography/principles/modular-scale/ — s/f — ratio bajo (1.25) para dashboards, base 12px, tabular figures obligatorias en datos financieros.
35. **OLED True Black Dark Mode Card** (CodeFronts) — https://codefronts.com/design-styles/css-dark-mode-ui/oled-card/ — 2026 — la receta exacta del top-highlight craft: borde 1px blanco 8% + inset 0 1px 0 blanco 6% = "labio físico" con luz desde arriba.

---

*Informe 12 de la serie de investigación frontend. Anterior: 10_contrato_agente_front.md.
Complementa a 02_estetica_y_tokens.md: aquel define los tokens de Pulse; este define las reglas de
dosificación y los delatores que los tokens deben impedir.*
