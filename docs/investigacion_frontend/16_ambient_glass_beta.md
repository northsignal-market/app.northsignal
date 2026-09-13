# 16 · Ambient glass: las referencias del dueño, desglosadas — y el estado del arte

**Fecha:** 13 de septiembre de 2026
**Disparador:** Andrés trae 4 referencias (3 imágenes + 1 video) y pide aplicar su lenguaje
para salir a beta. Este informe tiene dos partes: (A) el desglose elemento-por-elemento de
las referencias, hecho mirándolas — qué son técnicamente y qué tensión tienen con el
lenguaje Pulse vigente; (B) la investigación profunda con fuentes (jun-sep 2026,
priorizando fuera de las típicas), corrida con verificación adversarial de afirmaciones.

---

## Parte A · Las referencias, elemento por elemento

### A1. Fintech dashboard (imagen 1)

- **Shell flotante**: la app NO pinta el viewport — es una ventana de esquinas muy
  redondeadas (~24-28px) centrada sobre un lienzo más oscuro con líneas orbitales y
  partículas apenas visibles. El lienzo respira alrededor (~40-60px de margen).
- **Jerarquía por profundidad**: tres planos — lienzo, ventana, tarjetas — cada uno un
  paso más claro. Tarjetas con borde blanco ~8-12% y radio ~16-20px.
- **Controles píldora**: la nav son tabs-píldora con icono; los botones (Send, Logout)
  son píldoras; los selects son píldoras con chevron.
- **Acento único violeta** (#7C5CFF aprox) dosificado: el botón primario, un icono, un
  glow puntual. El resto es escala de grises fría.
- **Un objeto luminoso**: el cluster de esferas degradé (rosa/naranja/azul) con halo —
  exactamente UN protagonista brillante, el resto sobrio (coincide con nuestra regla).
- **Charts**: líneas multicolor desaturadas sobre grid tenue, sin relleno.
- **Micro-tipografía**: labels 10-11px en gris medio, cifras grandes tabulares blancas.

### A2-A3. "Zyricon" AI chat (imágenes 2 y 3)

- **Lienzo fotográfico/degradé**: la misma app sobre dos fondos distintos (montañas
  violetas; rayas violetas planas) — el shell es INDEPENDIENTE del lienzo. El panel
  principal es vidrio: se ve el fondo a través, con blur fuerte y tinte oscuro.
- **Sidebar sólida + contenido vítreo**: la sidebar es casi opaca (legibilidad de nav);
  el área de contenido deja pasar el lienzo. El vidrio no es uniforme: cada capa tiene
  su densidad.
- **Orbe 3D como héroe**: esfera violeta con luz interna y sombra propia, flotando sobre
  el título. Es EL foco de la pantalla vacía (empty state como escenario).
- **Chips de sugerencia** (píldoras con icono) sobre el input; input con borde suave y
  botón de enviar circular saturado.
- **Tarjetas de features** abajo: tres, con chip-etiqueta arriba a la derecha.
- **Nota**: esto es una pantalla de BIENVENIDA/vacío — el lenguaje del orbe+vidrio vive
  donde no hay datos que leer. No hay tablas debajo del vidrio.

### A4. Video "wrapped" (10s)

- **Lienzo degradé vivo** (violeta→verde azulado) con grano, tarjetas oscuras flotando.
- **Cortina esmerilada "Tap to Reveal"**: el contenido pendiente está literalmente
  detrás de un vidrio que se descubre al interactuar — el blur como TELÓN, no como
  material permanente. Estados "Pending…" con tres puntos.
- **Momentos de tarjeta sólida saturada**: la cifra celebrada (562k) va sobre menta
  sólido; otra sobre violeta sólido. El color pleno se reserva al momento-premio.
- **Anillos concéntricos** detrás del elemento destacado (radial rings como pedestal).
- **Big numbers** con label chico debajo. Esquinas grandes, sombras suaves.

### A5. El lenguaje común (síntesis de las 4)

1. **Lienzo ambiental** detrás de un **shell flotante** redondeado.
2. **Vidrio en capas de densidad distinta** (sidebar ≠ contenido ≠ tarjeta).
3. **UN objeto luminoso** por pantalla (orbe / cluster / cifra sobre color pleno).
4. **Píldoras** como forma de control dominante; radios grandes y concéntricos.
5. **Acento único** + escala de grises; color pleno solo como premio.
6. **Revelado como deleite**: blur-telón, cifras que aparecen, pedestales radiales.

### A6. Tensiones con el lenguaje Pulse vigente (a resolver con la Parte B)

| Referencia pide | Pulse hoy | Tensión |
|---|---|---|
| Glass con blur real | Liquid Glass RETIRADO el 13/9 (pedido explícito + referencia noir) | ¿Se recupera el vidrio y dónde? El retiro fue del *material en tarjetas de contenido*; las referencias lo usan en shell/telones |
| Acento violeta | Azul #0062CC intocable (dueño del cyan) | Se aplica el LENGUAJE con nuestro azul; el violeta no entra |
| Orbe 3D héroe | "Un protagonista luminoso por vista" ya es regla | Compatible en pantallas SIN datos (login, vacíos); jamás compitiendo con una cifra-héroe |
| Lienzo vivo animado | Fondo fijo con dot-grid + auroras estáticas | ¿Cuánto movimiento tolera una app de decisión? (scrolljacking-doctrina) |
| Reveal/telón frosted | "Los datos que piden acción no se esconden" | El telón solo puede cubrir lo LÚDICO (nunca `v_para_actuar`) |
| Shell flotante | App pegada al viewport | Viable: es chrome, no contenido. Costo: px verticales |

---

## Parte B · Investigación con fuentes (deep-research, verificación adversarial 3 votos)

**Método:** 5 ángulos → 23 fuentes fetcheadas → 113 afirmaciones extraídas → 25 verificadas
adversarialmente con 3 votos independientes cada una → **21 confirmadas, 4 refutadas**.
105 agentes, 602 operaciones. Es una base más angosta que las ~40 fuentes pedidas, pero
cada afirmación citada acá sobrevivió a verificadores instruidos para refutarla —
preferible a 40 citas sin verificar.

### B1. El veredicto sobre el vidrio (la tensión central, resuelta)

1. **El vidrio sobre contenido daña la legibilidad — documentado en producto enviado.**
   NN/g desarmó iOS 26 Liquid Glass con fallas concretas: Mail "text on top of text
   creates an illegible mess", controles de Safari/Maps compitiendo con el contenido.
   [nngroup.com/articles/liquid-glass/ · 3-0] (Nota: es del 10/10/2025 y Apple ya mitigó
   parte; citarlo con esa nota.)
2. **Apple concedió de facto en WWDC 2026 (8/6):** reconstruyó las fundaciones de Liquid
   Glass "to ensure exceptional readability". Sus dos jugadas son EL playbook: (a) el fix
   es **más escarchado, no vidrio más claro** — difundir el contenido complejo detrás del
   panel; (b) **la transparencia es preferencia del usuario** — slider de "ultra clear" a
   "fully tinted". El análogo web: diseñar sólido-primero y degradar con gracia
   (`prefers-reduced-transparency`, Chrome 118+ ✓; Firefox no → progressive enhancement).
   [techcrunch.com 8/6/2026 · 2-1/3-0; corroborado MacRumors/9to5Mac jun-2026] **[2026]**
3. **La regla operativa para una app de DATOS** (setproduct, 9/6/2026 **[2026]**, corroborado
   por la guía primaria de Apple WWDC25): *"Dense data needs solid, high-contrast surfaces.
   Reserve frosted UI for the navigation chrome"*. La razón es física: el contraste de una
   tarjeta translúcida depende de lo que tenga atrás — la misma tarjeta pasa WCAG en un
   estado y falla en otro. **Workflow: diseñar la versión sólida primero, aplicar el vidrio
   encima, honrar reduced-transparency con ese fallback.** [3-0 ×3]
4. **Raycast — el único teardown de producto real que sobrevivió** (CSS vivo verificado
   13/9/2026): dark-only, canvas #07080a, elevación por **hairline + trazos inset** (95 de
   161 box-shadow son inset), NO sombras difusas ni vidrio generalizado; sus 48 reglas de
   backdrop-filter están **confinadas al chrome flotante** (navbar, popovers, buscador).
   [refero.design + raycast.com · 2-1] ⚠ La versión "vidrio en UNA sola superficie" fue
   REFUTADA 0-3: son varias superficies de chrome, no una.

### B2. El costo técnico: lo que NO se sabe

5. **Nadie cuantifica el costo de backdrop-filter.** La doc canónica de Google trae el
   warning ("may harm performance. Test it before deploying.") pero cero números, y es de
   2019. Los dos claims sobre el bug de Firefox fueron REFUTADOS 0-3. **"¿Cuántas capas
   aguantan 60fps?" se responde midiendo en ESTA app, en el Chrome del operador** — no
   citando. [web.dev/articles/backdrop-filter · 3-0]
6. **Presupuesto de moción (Kowalski, verificado contra sus fuentes primarias):** UI
   general **<300ms** (180ms se siente más responsivo que 400ms); solo **transform y
   opacity**; y el matiz clave: animar transform/opacity SOBRE un elemento con
   backdrop-filter re-filtra el fondo en cada frame — el vidrio no se anima. [3-0 ×2]
7. **Refutado que NO debe citarse:** la receta de grainy-gradients de CSS-Tricks (1-2),
   los claims de bugzilla/Firefox, y "Raycast = vidrio en una superficie". El grano, el
   mesh animado, el orbe (CSS vs canvas vs WebGL), scroll-driven y View Transitions
   quedaron SIN base bibliográfica sobreviviente: **se prototipan y se miden acá**.

### B3. El cliché, con números (la mejor noticia del informe)

8. **La demanda 2026 tiene OTRO default:** sobre 210.759 prompts reales a un agente de
   diseño (ene-jun 2026), el "AI aesthetic" estadístico es **"a blue gradient on a dark
   background"** — nuestro territorio. El púrpura es apenas 6º (20.760 menciones vs
   50.165 del azul). Mantener #0062CC esquiva el cliché violeta, **pero nos deja pegados
   al default genérico: la diferenciación viene de textura, densidad, jerarquía y moción
   — no del typeface.** [superdesign.dev · 3-0 ×2] **[2026]** (data first-party de
   marketing; sesgo hacia devs que arman dashboards — paradójicamente MÁS aplicable acá)
9. **El glassmorphism está ascendente, no saturado:** 5,6% de los prompts en enero →
   8,2% en mayo 2026 (+46%). Adoptarlo hoy no es llegar tarde; la ventana de
   diferenciación existe si la ejecución es propia. [superdesign.dev · 3-0] **[2026]**
10. **Del lado ENVIADO, el slop es un COMPUESTO — y nos toca:** el checklist documentado
    es *Inter/Roboto + acentos púrpura/índigo + hero centrado con CTA + tres feature-boxes
    con ícono*. El mecanismo lo confesó Adam Wathan (tweet 7/8/2025, ~1M vistas): el
    `bg-indigo-500` de Tailwind UI saturó la web y los corpora de los LLMs. "It's not that
    Inter is inherently bad" — **es el compuesto lo que señala template**. Como Inter es
    restricción dura nuestra, rompemos el compuesto por las otras tres patas. [prg.sh +
    tweet Wathan + corroboración Phogat ago-2026 · 2-1/3-0] **[2026 parcial]**

### B4. El reveal, acotado

11. **Dos fuentes independientes, misma regla:** la deleite se degrada en distracción con
    la repetición (NN/g: "delight turns into distraction on the tenth, twentieth, or
    hundredth time"), y la intensidad de animación es inversa a la frecuencia (Kowalski:
    flujos diarios → sutil y rápido; acciones de 100+/día y TODO lo iniciado por teclado →
    **"No animation. Ever."**). **Cortinas frosted y anillos-reveal: SOLO superficies de
    frecuencia semanal o menor** (el brief del lunes, un cierre de período). Jamás en el
    triage. [3-0 ×2]
12. **Geist (Vercel, verificado contra el HTML vivo):** estados vacíos POR CAUSA — cinco
    variantes (no-results, blank slate, cleared, permission, error) — y la regla que
    refuerza nuestro invariante: **"Don't put critical persistent warnings here. Empty
    states vanish when the list populates"** → lo que pide acción vive en superficie
    persistente, nunca detrás de un estado efímero ni de una cortina. [vercel.com/geist ·
    3-0 ×2]

### B5. Las reglas accionables (síntesis A+B)

1. **Sólido primero.** Toda superficie se diseña legible en sólido; el vidrio es una capa
   que se agrega encima y se puede quitar (reduced-transparency / @supports) sin perder nada.
2. **El vidrio vive en el chrome:** header, sidebar, paleta, drawer, tooltips, telones.
   **Jamás debajo de datos**: tablas, charts y cifras van sobre superficie sólida.
3. **Escarchado > claro:** blur fuerte + tinte denso (el "fully tinted" de Apple como
   punto de partida, no como degradación).
4. **Elevación dark a la Raycast:** hairline + inset highlight, no sombras difusas — ya es
   nuestro lenguaje (tarjeta-pulse); se formaliza en tokens.
5. **El lienzo ambiental es azul, con textura propia** (dot-grid + grano sutil + auroras),
   estático o casi: nada de mesh animado permanente (moción = distracción diaria + batería).
6. **El orbe existe solo donde no hay datos:** login y estados vacíos de bienvenida. CSS
   puro, UNA instancia, respiración lentísima gated por reduced-motion. Azul, no violeta.
7. **Reveal solo semanal:** el brief del lunes puede ganar su momento "wrapped" (cifra
   sobre color pleno, telón). La Bandeja y el drawer, nunca.
8. **Moción <300ms, transform/opacity, nada animado sobre vidrio.**
9. **Estados vacíos por causa** (Geist): auditar cada `Vacio` y decir cuál de las cinco
   causas es.
10. **El presupuesto de capas de vidrio se mide acá** (Performance en el Chrome real),
    porque nadie lo publica. Si no sostiene 60fps en Datos con scroll, el vidrio de esa
    superficie se vuelve tinte sólido y no se discute.
11. **Anti-compuesto-slop:** azul (no violeta) + densidad de datos + textura propia +
    moción austera. Prohibido: hero centrado con CTA, tres feature-boxes con ícono, orbe
    en pantallas operativas.

### B6. Mapa fase → superficie (plan Beta Ambient)

- **BA1 · Lienzo + shell flotante**: body = lienzo ambiental (gradiente azul profundo +
  dot-grid + grano + auroras); la app entera = ventana redondeada (~22px) con hairline,
  inset highlight y sombra profunda, flotando con margen en ≥lg; full-bleed en móvil.
  Cero cambio en superficies de datos.
- **BA2 · Vidrio en el chrome**: header, sidebar, CommandPalette, Drawer y tooltips
  recuperan blur con tinte denso + fallback sólido automático. Medición empírica de fps
  antes/después en Sistema y Datos (scroll largo).
- **BA3 · Login como escenario**: pantalla de entrada con el orbe azul CSS-only sobre el
  lienzo — la única pantalla sin datos siempre presente. Favicon/meta/OG de beta.
- **BA4 · Vacíos por causa + momento semanal**: auditoría de `Vacio` con las cinco causas
  Geist; el brief del lunes gana su cifra-sobre-color-pleno (el "wrapped" acotado).
- **Queda fuera a propósito**: mesh animado permanente, orbe en vistas operativas,
  telones sobre accionables, violeta.

### B7. La medición que quedó abierta: el intento, y por qué NO se publica

El informe dejó una pregunta empírica ("¿cuántas capas de backdrop-filter sostienen
60fps?") porque nadie la publica. Se intentó responderla el 13/9 con un banco propio:
Chrome real en la Mac de Andrés vía Playwright (`channel: 'chrome'`, headed,
`bringToFront`), contra la **CSS de producción** (`dist/assets/index-*.css`), con
1.440 filas densas, 12 headers pegajosos y scroll dentro del rAF. Cuatro configuraciones:
sólido · beta (la desplegada) · estrés (blur en las 12 tarjetas) · brutal (blur 80px en
las 1.440 filas + capa full-screen).

**Los cuatro modos dieron lo mismo: 120fps, p95 ~9ms, cero frames sobre 20ms.** Los
controles de validez confirmaron que la página era visible y que el blur estaba
efectivamente aplicado en cada modo (computed `backdrop-filter` distinto por config).
Pero el **control negativo** mató el resultado: un layout thrash deliberado —
`getBoundingClientRect()` de 1.440 filas en cada frame— **tampoco movió la aguja**.
Si eso no duele, los timestamps de rAF bajo automatización no reflejan el pacing real:
**el banco no mide, y sus números no se publican.**

Lo que sí queda demostrado: no se puede medir frame pacing desde una pestaña
automatizada (la del MCP está `visibilityState: "hidden"` y ni siquiera dispara rAF;
la de Playwright dispara pero a reloj sintético). La medición válida la corre Andrés
en su ventana, pegando esto en la consola mientras scrollea Sistema a mano:

```js
(() => { const d=[]; let p=null,n=0; const t=(x)=>{ if(p!==null)d.push(x-p); p=x; if(n++<180)requestAnimationFrame(t);
  else { const o=[...d].sort((a,b)=>a-b); console.log('fps',Math.round(d.length/(d.reduce((a,b)=>a+b)/1000)),
  'p95',o[Math.floor(o.length*.95)].toFixed(1)+'ms','lentos',d.filter(x=>x>20).length); } }; requestAnimationFrame(t); })()
```

**Y la conclusión que no depende de la medición:** la razón para no poner vidrio bajo los
datos es la **legibilidad** (NN/g sobre iOS 26 + la reconstrucción de Apple en WWDC26 +
la física del contraste contexto-dependiente), no los fps. Esa regla se sostiene sola.

### Fuentes (23 fetcheadas; las citadas arriba sobrevivieron verificación)

Primarias/altas: nngroup.com/articles/liquid-glass · techcrunch.com (WWDC 8/6/2026) ·
setproduct.com/blog/liquid-glass-vs-glassmorphism (9/6/2026) · raycast.com CSS vivo +
refero.design · web.dev/articles/backdrop-filter · superdesign.dev (210k prompts, jun-2026)
· prg.sh purple-gradient + tweet @adamwathan · vercel.com/geist/empty-state ·
emilkowal.ski (great-animations, you-dont-need-animations). Refutadas y excluidas:
bugzilla 1718471 (×2) · css-tricks.com/grainy-gradients (como canon) · "Raycast una sola
superficie". Abiertas (se responden midiendo): presupuesto de capas 60fps · técnica del
orbe · teardowns Family/Amie/Linear · prioridades de primera impresión en betas.
