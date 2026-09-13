# Estética de interfaces modernas 2024–2026: minimalismo funcional, dark UI, design tokens y sistemas de diseño

**Investigación web · 12 de septiembre de 2026**
Eje 2 de la investigación de frontend para la app NorthSignal (`app-northsignal.vercel.app`).

**Método.** Búsqueda web + verificación de cada fuente por fetch directo. Se citan 36 fuentes que
cargaron y de las que se extrajo contenido real (documentación oficial, artículos de diseñadores
reconocidos, NN/g, W3C). Las citas `[N]` remiten a la lista numerada del final. Donde las páginas
oficiales eran SPA sin render server-side (m3.material.io, HIG web), se usaron espejos oficiales
del mismo dueño (API docs de Flutter para tokens Material 3, página de sesión WWDC25 para
Liquid Glass).

**Contexto que filtra todo lo que sigue.** La app es una herramienta operativa interna, dark,
con 4 colores (#0062CC azul, #1A1F36 navy, #FFFFFF, #F5F7FA), Liquid Glass vía backdrop-blur,
radios concéntricos con CSS vars y Tailwind 4. El usuario pide un salto notorio en estética,
sentimiento y funcionamiento. Lo que se investigó acá es **cómo lo hacen los productos que se
sienten premium**, con números.

---

## 1. Dark themes bien hechos (2025)

### 1.1 La elevación en dark se hace con superficies más claras, no con sombras

El consenso es total y viene de tres tradiciones distintas:

- **Atlassian** define cuatro niveles (`sunken`, `default`, `raised`, `overlay`) y lo dice
  explícito: "las sombras son más difíciles de ver en dark mode, así que las elevaciones en dark
  también dependen de colores de superficie distintos". Las superficies se aclaran a medida que
  suben; las sombras quedan como refuerzo secundario en `raised` y `overlay`, no como señal
  primaria [25].
- La guía de sistemas dark de Muzli formaliza el mínimo funcional: **cuatro niveles de
  superficie** — base (lo más oscuro), superficie elevada primaria (tarjetas, paneles, sidebar),
  superficie elevada secundaria (tarjetas anidadas, hover, estados activos) y overlay (modales,
  tooltips, dropdowns) — con **+5–8 % de luminancia por paso**. "Las sombras no se leen sobre
  fondos oscuros" [26].
- **Linear**, al rediseñar su UI, construyó exactamente esa escalera: background, paneles,
  diálogos y modales como niveles de superficie diferenciados, generados por fórmula en LCH [10].

Regla derivada para NorthSignal: el navy #1A1F36 es la base; tarjeta, tarjeta anidada y
overlay necesitan cada uno su token de superficie ~5–8 % más claro que el anterior. Hoy una
sola superficie hace todo el trabajo, y eso achata la jerarquía.

### 1.2 Bordes vs sombras en dark: borde 1 px sutil primero, sombra después

- Atlassian usa **bordes como default** para indicar contenido que scrollea fuera del área, y
  reserva sombras para donde el borde se perdería (tablas con celdas, UI chica) [25].
- Radix asigna pasos específicos de su escala a bordes: **paso 6** para bordes no interactivos
  (separadores, sidebars), **7** para bordes de componentes interactivos, **8** para bordes
  fuertes y focus rings [8].
- Si igual se usan sombras en dark, web.dev documenta que necesitan **mucha más opacidad que en
  light** (su ejemplo: fuerza de sombra 0.8 en dark contra 0.02 en light), porque "es difícil
  oscurecer algo que ya es oscuro" [20]. Y Josh Comeau agrega la técnica de calidad: una sola
  fuente de luz global (mismo ratio de offsets en toda la página), sombras **en capas** (1 capa
  para elevación chica, 3 media, 5 grande) y color de sombra con el matiz del fondo, nunca negro
  puro que desatura [9].

### 1.3 Ni negro puro ni blanco puro

- Muzli: base recomendada entre **#0A0A0A y #161616** (el navy #1A1F36 de la app está en la
  zona correcta: oscuro sin ser negro), y texto primario **off-white #E0E0E0–#F0F0F0**; el blanco
  puro sobre fondo oscuro produce fatiga y halación [26].
- NN/g matiza el entusiasmo por el dark: en visión normal, light mode rinde mejor para lectura
  "de un vistazo"; dark ayuda a usuarios con medios oculares nublados (cataratas). Recomiendan
  ofrecer la elección. Para una app operativa que ya es dark por identidad, la lección es otra:
  **el dark exige más disciplina de contraste que el light**, no menos [7].
- web.dev: en dark, el color de marca va **desaturado** (su receta: saturación a la mitad,
  lightness reducida ~50 % relativo) para que no vibre sobre fondo oscuro; el texto claro va en
  L 65–85 %, manteniendo ~40–50 % de "aire" de luminancia contra la superficie [20].
- Muzli, para acentos: conservar el matiz y **subir luminancia** al pasar a dark — su ejemplo es
  literal para esta app: `#0070F3` (light) → `#4A9EFF` (dark) [26]. El #0062CC actual es un azul
  de light mode: sobre navy, como color de texto o ícono no llega al contraste necesario; como
  fondo de botón sí funciona, pero conviene un twin más claro para texto/íconos/links.

### 1.4 Glassmorphism con moderación: la regla Apple 2025

Apple presentó Liquid Glass en WWDC25 como material de sistema (iOS 26, macOS Tahoe 26, etc.):
translúcido, refracta lo que tiene detrás, se adapta solo entre light y dark [23]. Lo relevante
para cualquier app que use backdrop-blur está en las reglas de uso de la sesión oficial
"Meet Liquid Glass" [24]:

- El vidrio vive en la **capa de navegación que flota sobre el contenido** (navbars, tab bars,
  sidebars, menús). **Nunca en la capa de contenido**: una tabla o tarjeta de datos de vidrio
  "compite con los demás elementos y enturbia la jerarquía".
- **Nunca vidrio sobre vidrio**: para overlays sobre un elemento de vidrio se usan fills,
  transparencia y vibrancy, no otro blur.
- Dos variantes: *regular* (la de uso general, con comportamientos adaptativos de legibilidad) y
  *clear* (más transparente, solo sobre contenido rico en media y con capa de dimming). No se
  mezclan en la misma interfaz.
- El tinte de color sobre vidrio se usa **selectivamente para la acción primaria**, no para todo.
- Accesibilidad integrada: con Reduced Transparency el vidrio se vuelve más esmerilado; con
  Increased Contrast, gana bordes de contraste [23][24].

Traducción directa: el efecto Liquid Glass de la app queda bien en header pegajoso, sidebar y
modales/popovers. Si hoy hay tarjetas de métricas con blur, eso es exactamente lo que Apple
recomienda no hacer: las tarjetas de datos van opacas, sobre su token de superficie.

---

## 2. Design tokens y theming con CSS variables + Tailwind 4

### 2.1 `@theme`: los tokens viven en CSS y generan utilities

Tailwind 4 invirtió el modelo: los tokens se declaran en CSS con `@theme` y cada namespace
genera a la vez utilities y variables CSS disponibles en runtime [1]:

- `--color-*` → `bg-…`, `text-…`, `border-…`; `--spacing-*` → paddings/margins/sizes;
  `--radius-*` → `rounded-…`; `--shadow-*`, `--text-*`, `--font-*`, `--breakpoint-*`.
- **La escala de espaciado entera deriva de una sola variable**: `--spacing: 0.25rem` (4 px).
  `p-1` = 4 px, `p-4` = 16 px. Es la grilla de 4 pt canónica, gratis; la disciplina consiste en
  no salirse con valores arbitrarios [1].
- Se puede resetear un namespace completo (`--color-*: initial`) para que **solo existan los
  colores del sistema propio** — la forma más barata de impedir que un `bg-blue-500` suelto
  contamine la paleta de 4 colores [1].
- `@theme inline` cuando un token referencia otro token; keyframes se declaran dentro de
  `@theme` junto a su `--animate-*` [1].
- Dark mode: por defecto la variante `dark` sigue `prefers-color-scheme`; para toggle manual se
  redefine con `@custom-variant dark (&:where(.dark, .dark *))` o con
  `[data-theme=dark]`, más el script anti-FOUC en `<head>` con `localStorage` [2].

### 2.2 Naming semántico: el patrón shadcn/Radix/Geist

Tres sistemas de referencia convergen en la misma arquitectura de dos capas — primitivas
(escala) + tokens semánticos (rol) — y difieren solo en el detalle:

- **shadcn/ui**: pares `X` / `X-foreground` (`background/foreground`, `card`, `popover`,
  `primary`, `secondary`, `muted`, `accent`, `destructive`, más `border`, `input`, `ring`,
  `chart-1..5` y familia `sidebar-*`). Valores en **OKLCH**; dark mode = re-declarar los mismos
  tokens bajo `.dark`; y un solo `--radius` base del que deriva toda la escala con `calc()` [3].
- **Radix Colors**: escala de 12 pasos con semántica fija — 1–2 fondos de app y componentes
  sutiles; 3–5 fondos de componente (normal / hover / seleccionado); 6–8 bordes (sutil /
  interactivo / fuerte+focus); 9–10 sólidos; 11 texto de bajo contraste; 12 texto de alto
  contraste, con **Lc 90 APCA garantizado sobre el paso 2** [8]. Es el mapa más útil que existe
  para derivar hover/active/borde sin inventar valores.
- **Vercel Geist**: escalas de 10 pasos (100–1000): 100–300 fondos de componente (default /
  hover / active), 400–600 bordes, 700–800 fondos de alto contraste, 900–1000 texto secundario
  y primario; dos fondos base (`background 100/200`) [13].

**OKLCH como espacio de trabajo**: uniformidad perceptual (L 0.8 se ve igual de claro en
cualquier matiz), lo que permite generar paletas cambiando el matiz con L y C constantes y
mantener el contraste; soporte universal en browsers desde fines de 2025; acceso al gamut P3
(~30 % más colores en pantallas modernas) [21]. Linear llegó a lo mismo por su lado: pasó de
**98 variables de tema a 3** (color base, acento, contraste) generando todo el tema en LCH,
incluidos temas de altísimo contraste para accesibilidad [10].

### 2.3 Radios concéntricos: fórmula y automatización

La fórmula está formalizada: **radio exterior = radio interior + padding** (equivalente:
`interior = exterior − gap`), derivada de geometría de círculos concéntricos [4]. Implementación
con custom properties, que la app ya insinúa con `--r-tarjeta`:

```css
.padre {
  --r-hijo: calc(var(--r-tarjeta) - var(--pad));
}
```

- Tailwind 4 lo soporta inline: `rounded-[calc(var(--radius-xl)-1px)]` para bordes concéntricos
  de 1 px [1].
- El truco nuevo (soporte parcial aún): `overflow: clip` + `overflow-clip-margin: content-box`
  en el padre recorta a los hijos dentro del padding sin darles radio propio [5].
- Caveat compartido por las dos fuentes: la fórmula es el punto de partida, el ojo ajusta el
  resultado final [4][5].

### 2.4 Z-layers con nombre

Atlassian publica la única escala numérica citable: **modal 510, flag/toast 600, spotlight 700,
tooltip 800** [25]. El número exacto importa menos que el patrón: pocos niveles, con nombre
(`--z-modal`, `--z-toast`, `--z-tooltip`), en tokens — nunca `z-index: 9999` inline.

---

## 3. Tipografía de interfaces 2025–2026

### 3.1 Las fuentes del momento son las que ya usa este ecosistema

- **Inter** (SIL OFL): diseñada para UI, x-height alta para legibilidad en cuerpos chicos,
  variable 100–900, >2000 glifos, y lo decisivo para una app de cifras: **tabular numbers,
  slashed zero, contextual alternates y case-sensitive forms** como features OpenType [17].
  Linear usa **Inter Display** (el corte óptico para tamaños grandes) en títulos e Inter en
  cuerpo [10] — patrón copiable tal cual.
- **Geist Sans / Geist Mono** (OFL, Vercel): suiza, minimalista, nacida del mono para código;
  variable, con stylistic sets. Geist Mono es la elección natural para IDs de campañas,
  presupuestos en tablas y todo lo que deba alinear carácter a carácter [14][22].

### 3.2 Números y datos

- `font-variant-numeric: tabular-nums` (o la feature `tnum`) en **toda** columna de cifras: los
  dígitos ocupan el mismo ancho y las columnas quedan alineadas. La app ya lo hace; el upgrade
  es sistematizarlo (clase utilitaria o token tipográfico "cifra") y sumar **slashed zero**
  (`zero`) donde convivan 0 y O, típico en IDs de Google Ads [17].
- Monospace para identificadores: distingue de un golpe de vista "dato citable" (ID, código,
  query) de prosa [14].

### 3.3 Tamaños, line-height y ancho de línea

- WCAG define "texto grande" en **18 pt (24 px) o 14 pt bold (~18.7 px)**; por debajo de eso el
  contraste exigido es 4.5:1, no 3:1 [6].
- En móviles, **inputs con font-size ≥ 16 px** o iOS hace zoom automático al enfocar [12].
- Ancho de línea para lectura: **50–75 caracteres** (WCAG 1.4.8 pone techo en 80);
  implementación recomendada `max-width: ~70ch` en bloques de texto [18]. Las tablas de datos
  quedan exentas: van fluidas.
- Densidad: Matthew Ström da el criterio maestro para una herramienta profesional — "la densidad
  de una UI es el valor que entrega dividido por el tiempo y el espacio que ocupa". Tufte
  (data-ink ratio): cada píxel de tinta debería presentar información nueva; lo decorativo que
  no comunica, afuera. Y la densidad temporal: <100 ms se percibe instantáneo; esperas de 1–10 s
  requieren feedback visual [16].

---

## 4. Color semántico con paleta mínima

### 4.1 El diagnóstico: un acento no puede significar todo

El minimalismo funcional real usa paleta limitada — NN/g midió 95 % de paletas restringidas en
sitios minimalistas, y de esos casi la mitad monocromáticos con **1–2 acentos estratégicos** —
pero advierte que "el minimalismo por el minimalismo mismo no ayuda a nadie": recortar señales
que el usuario necesita es el modo de falla [15]. Estado del sistema (ok / atención / error) es
una de esas señales.

Los productos serios con estética mínima **no** usan un solo color: reservan el acento de marca
para acción/foco y mantienen un set de estado chico y desaturado:

- **Geist (Vercel)**: gris para casi todo + `blue` (acción), `red` (error), `amber` (warning),
  `green` (éxito), cada uno con su escala de 10 pasos y los mismos roles por paso (fondos 100–300,
  bordes 400–600, texto 900–1000) [13].
- **shadcn**: un solo token de estado destructivo (`destructive`) además de `primary` — el
  mínimo viable: acento + rojo [3].
- **Radix**: cualquier matiz de estado se usa por pasos — fondo del badge en pasos 1–3, borde en
  6–7, texto en 11 — lo que produce ese look "tinte sutil + texto del color" de Linear y Vercel,
  en vez de chips saturados [8].
- **Linear** fue más allá: quitó azul del *chrome* (bordes, íconos, controles neutrales) para
  lograr una apariencia "más neutral y atemporal": el acento solo aparece donde significa algo
  [10].

**Dosificación en dark**: el color de estado casi nunca va como fondo sólido; va como texto o
ícono sobre un fondo del mismo matiz al 10–15 % (pasos 1–3 de Radix), y desaturado respecto a su
versión light [8][20][26].

Para NorthSignal: mantener el azul #0062CC como único acento de acción, y agregar **dos tonos de
estado** — un ámbar de atención y un rojo de error/destrucción — usados solo en texto, ícono,
borde y fondo sutil. Con `v_para_actuar`, guardarraíles y tickets, "atención" y "error" son
semántica de primera clase del dominio; hoy el azul las está tapando.

### 4.2 Accesibilidad WCAG 2.2 en dark

- Texto normal **4.5:1**; texto grande (≥24 px / ≥18.7 px bold) **3:1**; componentes de UI y
  gráficos informativos **3:1** contra colores adyacentes, incluidos estados hover/focus
  (SC 1.4.11); AAA: 7:1 [6].
- Focus: WCAG 2.2 (SC 2.4.13, AAA como norte) pide indicador con área **≥ perímetro de 2 px CSS**
  del componente y **3:1 de contraste entre estado enfocado y no enfocado**; el outline sólido de
  2 px es la vía simple de cumplimiento [19].
- En dark, el riesgo específico es doble: texto secundario que cae bajo 4.5:1 sobre superficies
  elevadas (cada nivel de superficie más claro come contraste), y blanco puro que sobra
  (halación). El off-white #F5F7FA de la app como texto primario y un gris azulado más apagado
  como secundario, verificados contra **cada** nivel de superficie, no solo contra la base
  [6][26].

---

## 5. Microinteracciones y motion

### 5.1 Los números

- **Material 3** (tokens oficiales, vía Flutter): duraciones `short1–4` = 50/100/150/200 ms
  (micro-interacciones), `medium1–4` = 250/300/350/400 ms (transiciones contenidas),
  `long1–4` = 450/500/550/600 ms (transiciones grandes/de pantalla), `extralong1–4` =
  700–1000 ms (casos excepcionales) [27]. Familias de easing: `standard` (y sus variantes
  accelerate/decelerate) para lo funcional, `emphasized` para momentos expresivos [28]. M3
  Expressive (mayo 2025) sumó un sistema de física de springs por encima de easing+duración,
  con springs espaciales (con overshoot) y de efecto (sin overshoot, para color/opacidad) [29].
- **Emil Kowalski**: animaciones de UI **< 300 ms**; `ease-out` para todo lo que entra o sale
  (arranca rápido → se siente responsivo); nunca los easings default del browser sin más, mejor
  curvas custom; animar **solo `transform` y `opacity`** (60 fps, solo composite); animaciones
  **interrumpibles**; `transform-origin` desde el trigger (popovers que crecen desde donde se
  abrieron); `scale(0.97)` en `:active` de botones; nunca animar desde `scale(0)`; tooltips: delay
  el primero, sin delay ni animación los siguientes del grupo; `filter: blur(2px)` como puente
  cuando una transición "no cierra" [11][30].
- **Rauno Freiberg** (guidelines): "la duración de animación no debería superar **200 ms** para
  que una interacción se sienta inmediata"; escalas proporcionales (~0.96, no 0.8); hover solo
  bajo `@media (hover: hover)` [12].

### 5.2 Qué NO animar en una app de datos

Acá los dos autores coinciden en la regla más citada de 2024–2025: **la frecuencia de uso manda**.
Acciones de alta frecuencia (abrir el command menu, cambiar de tab, acciones por teclado) se
sienten lentas con animación — el feedback instantáneo le gana al motion [11][31]. Emil: "si el
usuario lo va a ver docenas de veces por día, la animación pasa de deleite a molestia" [30].
Para NorthSignal: transiciones de página y overlays sí (200–300 ms ease-out); filas de tabla,
tabs, cifras que refrescan y todo el camino crítico de decidir/aprobar, instantáneos o con un
fade de opacidad de ~120 ms como máximo.

### 5.3 Reduced motion

`prefers-reduced-motion: reduce` es media query con soporte universal desde 2020. El patrón
recomendado por MDN no es apagar todo sino **degradar**: reemplazar scale/translate/parallax
(disparadores vestibulares) por fades discretos [32]. Emil lo lista como requisito de una
animación "great", no como extra [11].

---

## 6. Percepción de calidad: qué hace que Linear/Vercel/Raycast se sientan pulidas

Los detalles documentados, no el aura:

1. **Sistema de color generado, no pintado a mano.** Linear: 3 variables → tema completo en LCH,
   consistente en todas las elevaciones; texto e íconos neutrales oscurecidos en light y
   aclarados en dark; azul retirado del chrome [10].
2. **Alineación óptica obsesiva.** En el redesign, Linear alineó labels, íconos y botones
   vertical y horizontalmente a través de sidebar, tabs, headers y paneles "para reducir ruido
   visual y aumentar jerarquía" [10]. Rauno documenta lo mismo como práctica: alineación óptica
   por sobre la matemática, targets según Fitts (esquinas = targets infinitos) [31].
3. **Focus rings de verdad.** Ring que respeta el radio del componente (box-shadow, o outline
   moderno que ya lo respeta), 2 px, con 3:1 de cambio de contraste [12][19]. shadcn lo tokeniza
   (`--ring`) para que sea consistente en todo control [3].
4. **Estados vacíos que trabajan.** "Un empty state debe explicar por qué está vacío y empujar a
   crear el siguiente ítem, con templates opcionales" [12]; NN/g: decir el porqué ("no hay
   registros para el rango elegido"), dar el próximo paso y un CTA directo [33]. En esta app,
   `v_para_actuar` vacía es una noticia buena — el empty state debería decir exactamente eso.
5. **Skeletons con criterio.** < 1 s: ningún indicador (el flash molesta); 1–10 s: skeleton
   (página completa) o spinner (módulo suelto); > 10 s: barra de progreso con estimación.
   Shimmer de izquierda a derecha; jamás "frame vacío" con header y nada adentro [34].
6. **Hover states disciplinados.** Cambio de fondo un paso en la escala (Radix 3→4, Geist
   100→200), 150 ms, y solo en dispositivos con hover real [8][12][13].
7. **Iconografía de un solo sistema.** Lucide: canvas 24×24, stroke 2 px centrado, caps y joins
   redondos, radios 2 px (1 px en formas < 8 px), ≥1 px de padding, densidad baja — la
   consistencia del set entero es lo que se percibe como calidad, no el ícono individual [35].
   Regla: un set, un stroke, un tamaño; nada de mezclar libremente.
8. **Esquinas coherentes.** Un `--radius` base del que todo deriva (shadcn genera `radius-sm`
   a `radius-4xl` por `calc()`), más la fórmula concéntrica para anidados [3][4].
9. **Sombras físicas.** Una fuente de luz, capas, color con matiz del fondo [9] — y en dark,
   subordinadas a la escala de superficies [25][26].
10. **Densidad al servicio del valor.** Tufte/Ström: sacar tinta que no informa; una tabla más
    espaciosa que reduce errores es más densa (en valor) que una apretada que los causa [16].

El patrón de fondo, formulado por Rauno: la calidad percibida es la suma de **detalles
invisibles** — interrupciones permitidas, metáforas físicas coherentes, feedback según contexto
de input (teclado = instantáneo, touch = acompañado) [31]. No hay un truco; hay cien decisiones
chicas con el mismo criterio.

---

## 7. Layout shells modernos

### 7.1 Sidebar

- El patrón de referencia (shadcn, usado por medio ecosistema): **16 rem (256 px) de ancho** en
  desktop, **18 rem en móvil como sheet/drawer**, tres modos de colapso (`offcanvas`, `icon`,
  `none`), atajo **⌘B / Ctrl+B**, y familia de tokens propia (`--sidebar-background`,
  `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring`…) para poder tematizarla distinto del
  contenido [36].
- En modo colapsado a íconos, cada ítem muestra tooltip con el label; el estado colapsado se
  persiste entre sesiones (el patrón de la industria; shadcn lo deja al `SidebarProvider`) [36].
- Bajo ~768 px la sidebar desaparece como columna y pasa a drawer [36].

### 7.2 Header pegajoso con contexto

El movimiento 2025 va a headers que **condensan** al scrollear en vez de desaparecer: los tab
bars de iOS 26 se encogen al scrollear para dar protagonismo al contenido, y las sidebars
refractan el contenido detrás para mantener contexto [23]. El "scroll edge effect" — disolver el
contenido contra el borde superior — reemplaza a la línea dura de sombra para mantener
legibilidad bajo el header translúcido [24]. Con Liquid Glass ya en la app: header sticky con
blur + borde inferior de 1 px sutil (o scroll-edge gradient), y el título de la vista puede
absorber el contexto (cuenta activa, ventana temporal) al condensarse.

### 7.3 Anchos de contenido

- Texto corrido (fichas, lecciones, reportes): **max-width ~70ch** (50–75 caracteres por línea;
  techo WCAG 80) [18].
- Tablas y grillas de métricas: fluidas, sin máximo — el límite lo pone la legibilidad de cada
  columna, no el contenedor. La página puede ser ancha con las columnas de texto acotadas
  adentro [16][18].
- El modelo de scroll de app-shell: el marco (header + sidebar) fijo, el scroll vive en los
  paneles de contenido, con section headers pegajosos dentro de cada panel — no un scroll global
  de documento [36][23].

### 7.4 Responsive operativo

Desktop-first en uso real no exime del móvil: los criterios duros ya citados — inputs ≥16 px,
targets táctiles generosos, hover condicionado a `(hover: hover)`, sidebar → drawer < 768 px —
son el piso [12][36].

---

## 8. Síntesis aplicada a NorthSignal

La app tiene una base correcta (dark navy, un acento, blur, radios con vars, Tailwind 4,
tabular-nums). El salto perceptible sale de sistematizar, no de redecorar:

1. **Escala de superficies**: 4 tokens (`--color-surface-0..3`) desde #1A1F36, +5–8 % L por
   paso, en OKLCH. Elevación = superficie + borde 1 px sutil; sombra solo en overlays.
2. **Blur solo en el shell**: header, sidebar, modales. Tarjetas y tablas de datos, opacas.
   Nunca blur sobre blur. `Reduced Transparency` → fallback esmerilado/opaco.
3. **Texto en dos niveles reales**: primario off-white (no #FFFFFF puro salvo cifras
   protagonistas), secundario tipo paso 11 de Radix, ambos verificados 4.5:1 contra cada
   superficie.
4. **Acento + 2 estados**: azul (acción) aclarado para texto/íconos en dark, ámbar (atención),
   rojo (error/destructivo). Siempre como texto/borde/fondo sutil, nunca bloques saturados.
5. **Tokens en `@theme`** con namespaces limpios y `--color-*: initial` para clausurar la
   paleta; dark con `@custom-variant`; radios con la fórmula concéntrica en `calc()`;
   `--spacing` 4 px como única grilla; z-layers con nombre.
6. **Motion presupuestado**: 120–200 ms ease-out micro, 250–300 ms paneles/overlays, nada en
   acciones frecuentes ni en refresco de cifras, `prefers-reduced-motion` degradando a fades.
7. **Detalles que se notan**: focus ring 2 px tokenizado, hover de un paso de escala, empty
   states con mensaje del dominio ("no hay nada que pida acción hoy"), skeletons solo en cargas
   de 1–10 s, íconos de un solo set (Lucide) a 24/2 px, Inter/Geist con `tnum` + `zero` y Geist
   Mono para IDs.

---

## Fuentes

Todas verificadas por fetch directo el 12/09/2026. Formato: título — URL — aporte.

1. **Tailwind CSS Docs — Theme variables** — https://tailwindcss.com/docs/theme — Cómo `@theme` convierte tokens en utilities + CSS vars; namespaces; `--spacing: 0.25rem` como base de la grilla de 4 pt; reset de namespaces con `initial`; `@theme inline`; `rounded-[calc(var(--radius-xl)-1px)]`.
2. **Tailwind CSS Docs — Dark mode** — https://tailwindcss.com/docs/dark-mode — Variante `dark` por `prefers-color-scheme`; override con `@custom-variant dark (&:where(.dark, .dark *))` o `data-theme`; toggle de tres estados con `localStorage` sin FOUC.
3. **shadcn/ui — Theming** — https://ui.shadcn.com/docs/theming — Convención `X`/`X-foreground`; set completo de tokens semánticos (card, popover, muted, accent, destructive, border, input, ring, chart-1..5, sidebar-*); OKLCH; `--radius` base con escala derivada; dark = mismos tokens bajo `.dark`.
4. **Cloud Four — The Math Behind Nesting Rounded Corners** — https://cloudfour.com/thinks/the-math-behind-nesting-rounded-corners/ — Derivación geométrica de `outer − gap = inner`; implementación con custom properties y `calc()`.
5. **Frontend Masters Blog — The Classic Border Radius Advice, Plus an Unusual Trick** — https://blog.master.dev/the-classic-border-radius-advice-plus-an-unusual-trick/ — Fórmula clásica exterior = interior + padding; variable `--nested-radius`; truco `overflow: clip` + `overflow-clip-margin: content-box`; ajustar a ojo.
6. **WebAIM — Contrast and Color Accessibility** — https://webaim.org/articles/contrast/ — 4.5:1 texto normal; 3:1 texto grande (18 pt / 14 pt bold) y componentes de UI (1.4.11) incluidos estados; AAA 7:1.
7. **NN/g — Dark Mode vs. Light Mode** — https://www.nngroup.com/articles/dark-mode/ — Evidencia: light rinde mejor en lectura glanceable con visión normal; dark ayuda con medios oculares nublados; ofrecer elección.
8. **Radix Colors — Understanding the scale** — https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale — Semántica de los 12 pasos (fondos 1–2, componentes 3–5, bordes 6–8, sólidos 9–10, texto 11–12); paso 12 con Lc 90 APCA sobre paso 2.
9. **Josh Comeau — Designing Beautiful Shadows in CSS** — https://www.joshwcomeau.com/css/designing-shadows/ — Fuente de luz global única (ratio de offsets constante); sombras en capas (1/3/5); color de sombra con matiz del fondo; rampa de elevación.
10. **Linear — How we redesigned the Linear UI** — https://linear.app/blog/how-we-redesigned-the-linear-ui — De 98 variables de tema a 3 (base, acento, contraste); LCH por uniformidad perceptual; niveles background/panels/dialogs/modals; alineación de labels/íconos; Inter Display en títulos; menos azul en el chrome.
11. **Emil Kowalski — Great Animations** — https://emilkowal.ski/ui/great-animations — <300 ms; ease-out en enter/exit; solo transform/opacity (60 fps); interrumpibles; no animar acciones frecuentes/teclado; `prefers-reduced-motion` como requisito.
12. **Rauno Freiberg — Web Interface Guidelines** — https://interfaces.rauno.me/ — ≤200 ms para inmediatez; focus ring que respeta el radio; `@media (hover: hover)`; inputs ≥16 px; scale ~0.96; empty states con CTA; navegación por flechas en listas.
13. **Vercel Geist — Colors** — https://vercel.com/geist/colors — Escalas de 10 pasos y roles por paso (100–300 fondos, 400–600 bordes, 700–800 alto contraste, 900–1000 texto); backgrounds 100/200; set gris + blue/red/amber/green; P3.
14. **Vercel — Geist font** — https://vercel.com/font — Geist Sans/Mono/Pixel; diseño suizo minimalista para developers; variable; OFL; el mono nació primero, para código y datos alineados.
15. **NN/g — The Characteristics of Minimalism in Web Design** — https://www.nngroup.com/articles/characteristics-minimalism/ — Datos: 95 % paletas limitadas, ~46 % con 1–2 acentos, 84 % espacio negativo, 75 % tipografía dramática; advertencia contra el minimalismo que quita señales necesarias.
16. **Matthew Ström — UI Density** — https://mattstromawn.com/writing/ui-density/ — Densidad visual/informacional/de diseño/temporal; data-ink ratio de Tufte; densidad = valor ÷ (tiempo × espacio); <100 ms instantáneo.
17. **Inter typeface (Rasmus Andersson)** — https://rsms.me/inter/ — x-height alta para UI; variable 100–900; tabular numbers, slashed zero, alternates contextuales; cortes text/display; OFL.
18. **Baymard Institute — Readability: The Optimal Line Length** — https://baymard.com/blog/line-length-readability — 50–75 caracteres por línea; techo WCAG 80; `max-width` ~70ch; consecuencias de líneas largas/cortas.
19. **W3C — Understanding SC 2.4.13: Focus Appearance (WCAG 2.2)** — https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html — Indicador ≥ perímetro de 2 px CSS; 3:1 entre estados enfocado/no enfocado; outline sólido de 2 px como cumplimiento simple.
20. **web.dev — Building a color scheme (Adam Argyle)** — https://web.dev/articles/building/a-color-scheme — Marca desaturada en dark (saturación ÷2, lightness −50 % rel.); 4 surface colors; texto claro L 65–85 %; sombras dark con opacidad 0.8 vs 0.02 light; variante "dim".
21. **Evil Martians — OKLCH in CSS: why we moved from RGB and HSL** — https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl — Uniformidad perceptual vs HSL; generación de paletas con L/C constantes; P3; soporte universal.
22. **Lexington Themes — Geist Font: OpenType Features** — https://lexingtonthemes.com/blog/geist-opentype-features — Geist Mono para tablas de precios y datos tabulares; features OpenType de Geist en CSS/Tailwind.
23. **Apple Newsroom — Apple introduces a delightful and elegant new software design** — https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/ — Qué es Liquid Glass; dónde aplica (controles, tab bars, sidebars); tab bars que se encogen al scrollear; plataformas 26.
24. **Apple WWDC25 — Meet Liquid Glass (sesión 219)** — https://developer.apple.com/videos/play/wwdc2025/219/ — Reglas de uso: solo capa de navegación flotante, nunca capa de contenido, nunca vidrio sobre vidrio; variantes regular/clear; tinte solo en acción primaria; adaptaciones de legibilidad y accesibilidad.
25. **Atlassian Design System — Elevation** — https://atlassian.design/foundations/elevation — Niveles sunken/default/raised/overlay; en dark la elevación depende de colores de superficie (más claros al subir); bordes como default para overflow; z-index: modal 510, flag 600, spotlight 700, tooltip 800.
26. **Muzli — Dark Mode Design Systems: Patterns, Tokens, and Hierarchy** — https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/ — 4 niveles de superficie obligatorios; +5–8 % luminancia por paso; base #0A0A0A–#161616; texto #E0E0E0–#F0F0F0; acentos con luminancia subida (#0070F3→#4A9EFF); naming semántico.
27. **Flutter API (Google) — Durations class (Material 3)** — https://api.flutter.dev/flutter/material/Durations-class.html — Tokens oficiales M3: short 50–200 ms, medium 250–400 ms, long 450–600 ms, extralong 700–1000 ms.
28. **Flutter API (Google) — Easing class (Material 3)** — https://api.flutter.dev/flutter/material/Easing-class.html — Familias de easing M3: standard / standardAccelerate / standardDecelerate, emphasizedAccelerate/Decelerate, legacy, linear.
29. **Supercharge Design — Material 3 Expressive** — https://supercharge.design/blog/material-3-expressive — M3 Expressive (2025): sistema de física de motion (springs) que reemplaza easing+duración como modelo; shape morphing en la Shapes Library.
30. **Emil Kowalski — 7 Practical Animation Tips** — https://emilkowal.ski/ui/7-practical-animation-tips — `scale(0.97)` en active; no arrancar de scale(0); tooltips subsecuentes sin delay; curvas custom; transform-origin desde el trigger; <300 ms; blur(2px) puente.
31. **Rauno Freiberg — Invisible Details of Interaction Design** — https://rauno.me/craft/interaction-design — Metáforas físicas; frecuencia de uso vs animación (command menus sin motion); interrupciones; gestos destructivos vs livianos; Fitts y targets infinitos; contexto de input.
32. **MDN — prefers-reduced-motion** — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion — Valores; patrón de degradar (reemplazar motion vestibular por fades) en vez de eliminar; soporte universal desde 2020; contexto de trastornos vestibulares.
33. **NN/g — Designing Empty States in Complex Applications** — https://www.nngroup.com/articles/empty-state-interface-design/ — Explicar por qué está vacío; próximos pasos y CTA directo; el empty state como momento de enseñanza.
34. **NN/g — Skeleton Screens 101** — https://www.nngroup.com/articles/skeleton-screens/ — <1 s sin indicador; 1–10 s skeleton/spinner; >10 s barra con estimación; shimmer izquierda→derecha; nunca frame vacío.
35. **Lucide — Icon Design Guide** — https://lucide.dev/contribute/icon-design-guide — Canvas 24×24; stroke 2 px centrado; caps/joins redondos; radios 2 px (1 px en formas <8 px); ≥1 px padding; consistencia del set como valor.
36. **shadcn/ui — Sidebar** — https://ui.shadcn.com/docs/components/sidebar — Anchos 16 rem desktop / 18 rem móvil; modos offcanvas/icon/none; atajo ⌘B/Ctrl+B; tokens `--sidebar-*` propios.
