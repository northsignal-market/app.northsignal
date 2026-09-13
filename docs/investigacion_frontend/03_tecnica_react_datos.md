# Investigación 03 — Técnica front-end 2024-2026 para apps de datos

**Eje:** React 19, Tailwind 4, visualización con recharts y alternativas, performance y arquitectura de componentes.
**Para:** la SPA de NorthSignal (Vite + React 19 + Tailwind 4 + recharts 3 + zustand + lucide-react, deploy en Vercel, API propia en `/api/*`). Un solo operador. Series diarias de 17 días y semanales de 91, 4 monedas, datos que maduran (últimos 3 días provisionales, hoy con banda `ReferenceArea`), tablas de hasta 10.000 filas exportables.
**Fecha:** 12 de septiembre de 2026. **Método:** búsqueda web + verificación contra docs oficiales, blogs con autor y fecha, e issues de GitHub. Toda afirmación con fuente numerada de la lista final.

---

## 1. React 19 en producción: qué aplica a un dashboard

### useTransition y useDeferredValue: la pareja que resuelve filtros y búsquedas

Las dos herramientas no aceleran nada: le permiten a React marcar un update como no urgente para que el hilo principal quede libre para pintar la tecla o el clic. La regla de reparto es simple: **`useTransition` cuando sos dueño del `setState`** (un cambio de pestaña, un cambio de ventana 17d/91d), **`useDeferredValue` cuando el valor te llega y no podés envolver el setter** (una prop, un valor de un store como zustand) [1][2].

Detalles verificados en la doc oficial que importan acá:

- **`useDeferredValue` exige `memo` en el hijo pesado.** Cita textual: "This optimization requires `SlowList` to be wrapped in `memo`. (...) Without memo, it would have to re-render anyway, defeating the point of the optimization" [1]. Es el error más común: se difiere el valor pero la tabla no está memoizada, y no se difiere nada.
- **El render diferido es interrumpible y sin delay fijo**: "Unlike debouncing or throttling, it doesn't require choosing any fixed delay" [1]. En máquina rápida ni se nota; en máquina lenta la lista "queda atrás" proporcionalmente.
- **No reemplaza el debounce de red**: "useDeferredValue does not by itself prevent extra network requests" [1]. Para el buscador sobre la tabla de 10k filas (filtrado en memoria) es ideal; para un input que dispara requests, debounce aparte.
- **Un input controlado nunca va adentro de una transition**: "Transition updates can't be used to control text inputs" [2]. El estado del input se setea urgente; lo que se difiere es el filtrado.
- **React 19 Actions**: `startTransition` ahora acepta funciones async, y los errores tirados adentro los agarra el error boundary más cercano [2]. Ojo con el caveat: un `setState` después de un `await` necesita otro `startTransition` anidado para seguir siendo transition [2].

### Suspense: para qué sirve sin framework de servidor

Todo lo que cuelga de un boundary se revela junto ("the whole tree inside Suspense is treated as a single unit") y se pueden anidar boundaries para secuencias de carga [4]. Dos datos clave para una SPA como esta:

1. **Suspense no detecta fetch en `useEffect` ni en handlers** — solo lo activan `lazy()`, promesas leídas con `use()`, o librerías integradas [4]. O sea: sin TanStack Query (`useSuspenseQuery`) o `use()`, Suspense en esta app solo sirve para code-splitting con `React.lazy`, que ya es un uso legítimo y suficiente.
2. **La transición evita el fallback**: "Both deferred values and Transitions let you avoid showing Suspense fallback in favor of inline indicators" [4]. Cambiar de cuenta o de ventana no debería desmontar el gráfico y mostrar un spinner: se marca como transition y el gráfico viejo queda visible, atenuado, hasta que llega el nuevo.

### useOptimistic: existe, pero acá casi no aplica

`useOptimistic` muestra un estado temporal mientras corre una Action y **revierte solo si falla** ("a failure means value hasn't changed, so the UI shows what it showed before") [3]. Para NorthSignal el caso de uso natural sería "aprobar acción", y justo ahí es donde **no conviene**: la regla del sistema es que nada cambia en Google Ads sin confirmación real. Mostrar una aprobación como hecha antes de que el servidor la confirme es mentirle al operador sobre el estado de un sistema con efectos reales. Estados pendientes honestos (`isPending` de `useTransition`) le ganan al optimismo acá.

### memo / useMemo / useCallback: cuándo ya no hacen falta

React Compiler 1.0 salió estable el 7 de octubre de 2025 (React Conf) y hace memoización automática en build time; en Meta ya corría en producción con "initial loads and cross-page navigations improved by up to 12%" y "certain interactions more than 2.5× faster" [5]. La guía oficial sobre el código existente es conservadora y conviene citarla textual: "We recommend either leaving existing memoization in place (removing it can change compilation output) or carefully testing before removing the memoization" [5]. Soporta React 17+ (con `react-compiler-runtime` para <19), el lint (`eslint-plugin-react-hooks@latest`) trae las reglas del compilador sin necesidad de instalarlo, y para Vite hay plugin vía Babel; el soporte oxc/rolldown está pendiente [5][6].

Mientras tanto, el modelo mental clásico sigue vigente: un componente re-renderiza porque su padre re-renderizó, no porque "cambió una prop"; `memo` corta esa cascada y el contexto la atraviesa [7]. Y la advertencia de Josh Comeau sobre memoización manual: tiene costo de mantenimiento y se rompe silenciosamente con una prop nueva no estable [8]. Nota de campo (LogRocket) al dejarle todo al compilador: lo que se rompe suele ser código que ya violaba las Rules of React — mutaciones durante render, refs leídas en render — y el compilador simplemente lo saltea o lo expone [9].

**Errores comunes de React 19 en dashboards** (síntesis de [1][2][7][8]): (a) diferir sin memoizar; (b) meter el input en la transition; (c) usar `useTransition` para datos que vienen de un store en vez de `useDeferredValue`; (d) esperar que Suspense funcione con fetch en effects; (e) borrar memoización a mano "porque está el compilador" sin pasar el linter.

---

## 2. Data fetching sin framework de servidor

### El problema real: fetch manual tiene cinco bugs de serie

TkDodo (mantenedor de TanStack Query) enumera los bugs que trae el patrón `useEffect + fetch + setState` aun bien escrito: **race conditions** (respuestas fuera de orden pisan datos nuevos), **sin loading state honesto**, **estado vacío indistinguible de "cargando"**, **data/error viejos que persisten cuando cambia el parámetro**, y **doble fetch en StrictMode** [10]. Su frase resume el tema: "Data Fetching is simple. Async State Management is not." [10]

### Qué hace TanStack Query que zustand no

TanStack Query no es una librería de fetching, es un **async state manager** con modelo stale-while-revalidate: "React Query will cache data for you and give it to you when you need it, even if that data might not be up-to-date (stale) anymore" [11]. Defaults verificados [12]:

- Cache considerado stale al instante (`staleTime: 0`) y refetch automático al montar, al volver el foco a la ventana y al reconectar.
- Queries inactivas se limpian a los 5 minutos (`gcTime`).
- Fallos se reintentan **3 veces con backoff exponencial** en silencio.
- Los resultados se comparan estructuralmente: si el JSON no cambió, la referencia no cambia → no re-renderiza.

Para esta app, `staleTime` es la perilla: los datos de Supabase se actualizan por cron, no cada segundo. Un `staleTime` de minutos por query (más corto para `v_para_actuar`, más largo para series semanales) elimina refetches inútiles sin perder el "siempre fresco al volver a la pestaña" — que es exactamente el comportamiento "ultra inteligente, sin desincronización" pedido.

### ¿Y con un solo usuario no alcanza fetch + zustand?

Los cinco bugs de [10] no dependen del número de usuarios: dependen de que haya requests concurrentes y navegación. La comparativa 2025/2026 [13][14]: SWR pesa ~4.2 KB gzip contra ~13.4 KB de TanStack Query, pero Query trae devtools, invalidación, mutaciones, dedupe y cancelación de serie. Para una SPA interna donde el costo de bundle es irrelevante frente al costo de un número desincronizado, **TanStack Query es la opción con mejor relación costo/beneficio**; SWR es razonable si se quiere lo mínimo.

La arquitectura que recomienda el propio TkDodo para convivir con zustand: **no copiar datos del server a zustand** — "most of the state in apps is either server or url state" [15]. Zustand queda para estado de UI puro (pestaña activa, ventana elegida, moneda visible, filtros), con sus buenas prácticas: selectores atómicos ("Selectors have to return stable results"), acciones separadas del estado, stores chicos y hooks custom en vez de exponer el store crudo [15]. Y la regla de Kent C. Dodds que ata todo: **no sincronices estado, derivalo** — cada valor que se pueda calcular desde la fuente (query cache + estado de UI) se calcula en render, no se copia con un effect [16]. Copiar con effects es la fábrica de "números que no coinciden entre el gráfico y la tabla".

### Estados de carga honestos

- **Primera carga:** skeleton con la forma del contenido. La investigación de percepción: pantallas skeleton se perciben 20-30% más rápidas que spinners a igual tiempo real, porque el cerebro pre-procesa el layout [17].
- **Recarga con datos visibles (stale-while-revalidate):** nunca reemplazar datos visibles por un spinner. Patrón: mostrar lo cacheado + indicador discreto "Actualizando…" + "Actualizado hace X min" [11][18]. TanStack Query lo da gratis con `isFetching && !isPending`.
- **Vacío legítimo vs. cargando:** son tres estados distintos (pending / error / success-vacío) y la unión discriminada de Query los separa por tipo [10]. Regla de la casa que acá se vuelve código: cero filas se muestra como "sin datos en esta ventana", jamás como tabla en blanco.

---

## 3. recharts 3: técnicas validadas, límites y alternativas

### Qué cambió en la v3 (23 de junio de 2025)

Reescritura completa del state management interno (~3500 tests nuevos), y de ahí los breaking changes: desapareció `CategoricalChartState`, `Customized` ya no recibe estado interno, y se eliminaron las dependencias `recharts-scale` y `react-smooth` (animaciones ahora internas) [19][20]. Novedades útiles para esta app: `accessibilityLayer` activo por defecto en todos los charts, **Tooltip y Legend con portales** (se pueden sacar del contenedor del gráfico — resuelve tooltips cortados por `overflow`), `YAxis width="auto"`, y componentes React arbitrarios dentro del árbol del chart [19].

### Técnicas avanzadas verificadas

- **Bandas y anotaciones:** `ReferenceArea` (rectángulo x1/x2/y1/y2 con `fillOpacity` y `label`) y `ReferenceLine` (umbral horizontal/vertical) son la herramienta oficial para marcar rangos y objetivos [21]. Lo que ya hace la app con la banda de maduración es el patrón correcto; ver §4 para reforzarlo.
- **Tooltips sincronizados entre gráficos:** `syncId` compartido sincroniza Tooltip y Brush entre charts; `syncMethod` acepta `"index"` (default, asume series del mismo largo), `"value"` (sincroniza por valor del eje categórico — lo correcto si una serie tiene huecos) o una función custom [22]. Para gasto arriba y conversiones abajo compartiendo fecha, es una línea de código.
- **Performance, guía oficial** [23]: aislar los componentes que cambian seguido para que el resto del chart no re-renderice; **referencias estables en props** — textual: "Change in dataKey means that recharts has to recalculate all the points for that component" (dataKey como string ya es estable); reducir puntos con agregación si sobran; throttle en handlers de mouse (<100 ms); `React.memo` en charts estáticos; medir con el profiler antes de optimizar.
- **Animaciones:** issues históricos documentan que la animación inicial retrasa el render de puntos y que `react-smooth` causaba renders incompletos; `isAnimationActive={false}` es el workaround estándar [24]. Para un dashboard operativo que se refresca, animar no aporta y cuesta.
- **Responsividad:** `ResponsiveContainer` sigue siendo el mecanismo; con v3, ancho de eje Y automático (`width="auto"`) elimina el clásico corte de labels de moneda larga (CLP con miles) [19].
- **Formateo de ejes:** `tickFormatter` con formatters de `Intl` cacheados (§7) — nunca formatear inline creando un `Intl.NumberFormat` nuevo por tick.

### Límites conocidos

Recharts es SVG: cada punto es un nodo del DOM. Los issues de referencia: lentitud con datasets grandes [25], un `XAxis` con `interval` default sobre ~10.000 items tarda segundos [26], y hay pedido abierto de downsampling LTTB [27]. El consenso de las comparativas 2025-2026: SVG declarativo rinde bien hasta el orden de los cientos/miles de puntos; de ahí en más, canvas [28][29].

**Para NorthSignal esto es teórico:** 17 y 91 puntos por serie están tres órdenes de magnitud abajo del límite. No hay razón de performance para migrar.

### Comparativa breve: ¿cuándo valdría migrar?

| Librería | Qué es | Cuándo la elegirías |
|---|---|---|
| **recharts 3** | SVG declarativo, componentes React | Dashboards estándar, <1-2k puntos por chart. **Quedarse** [28][29] |
| **visx** (Airbnb) | Primitivas D3+React de bajo nivel | Visualización a medida que recharts no puede expresar; pagás construyendo todo vos [28] |
| **Observable Plot** | Gramática de gráficos concisa, del equipo de D3 | Exploración rápida/notebooks; en React se integra por ref imperativo, menos natural [30] |
| **uPlot** | Canvas, ~50 KB min, "166,650 data points in 25ms" | Series masivas o streaming en vivo; sin wrapper React oficial, API imperativa [31] |
| **Tremor** | Kit de componentes de dashboard (usa recharts por debajo) | Adquirida por Vercel en enero 2025; todo pasó a MIT y sus fundadores trabajan en el dashboard de Vercel/v0. Vivo como copy-paste kit, pero no es una migración con sentido para una UI ya construida [32] |

Veredicto: migrar solo si apareciera un requisito de densidad real (p. ej. series por hora de 46 locales de Fresh Monkee superpuestas → uPlot). Con las ventanas actuales, no.

---

## 4. Visualización de incertidumbre y datos provisionales

Cómo lo marcan los productos serios:

- **PostHog** (trends): la porción del período en curso se dibuja con línea punteada. Textual de su doc: "A dotted line indicated the data for that period is still being collected." [33]
- **Google Ads** documenta la inmadurez como propiedad del dato, no del gráfico: clics/costo con SLO de frescura de 1 hora, pero conversiones según modelo de atribución tardan hasta 15 horas en procesarse, y "some conversions may occur several days after the initial ad interaction" — además de ajustes retroactivos por tráfico inválido [34]. Su reporte de *conversion lag* muestra cómo cambiarían CPA/ROAS ajustados por lag y anota los rangos de fechas afectados [35][36].
- **Mixpanel/Amplitude** incluyen el período parcial en curso y lo distinguen visualmente; el patrón general de la industria para "período incompleto o pronóstico" es cortar la línea sólida en el último período completo y seguir con trazo punteado y marcador sin relleno [37][38].
- **Datawrapper** (guía práctica para datos con huecos): dos series superpuestas — la sólida hasta donde el dato es firme, la punteada desde ahí, con un punto de solape para que conecten [38].
- **Azure Monitor** usa trazo punteado entre puntos conocidos cuando falta un valor intermedio [39]; Grafana por defecto corta la línea y su comunidad discute cómo marcar intervalos parciales — no tiene un patrón nativo de "período inmaduro", lo que confirma que la banda/punteado hay que construirlo [40].

**Patrones concretos aplicables acá, en orden de fuerza:**

1. **Banda (`ReferenceArea`) sobre los últimos 3 días** — ya está. Es el patrón "zona provisional" y de paso cubre a las barras si las hubiera.
2. **Sumarle el trazo punteado a la serie misma** (patrón PostHog/Datawrapper): partir cada serie en dos `<Line>` del mismo color — sólida hasta D-3, `strokeDasharray="4 4"` con puntos huecos desde D-3, compartiendo el punto de empalme [33][38]. La banda dice "acá hay una zona"; el punteado dice "este número específico va a cambiar". Juntos no dejan lugar a la mala lectura.
3. **Label explícito** en la banda ("provisional" / "madurando") y nota al pie con la regla: el gasto de ayer es definitivo; las conversiones, no.
4. **La misma marca en la tabla y el CSV**: si el gráfico marca provisional, la tabla debe marcar esas filas (columna `provisional: true` en el export). La incertidumbre que solo vive en el gráfico se pierde en el Excel del cliente.
5. Para visitas a tienda (modeladas, Fresh Monkee): el patrón correcto no es punteado sino **ausencia distinguida de cero** — celda "—" con tooltip "modelado por Google; sin dato no significa cero", coherente con la regla del sistema [34].

---

## 5. Tablas de datos modernas

### TanStack Table vs. tabla artesanal

TanStack Table es **headless**: "data-processing, state-management, and business logic" sin markup ni estilos; vos ponés el HTML y Tailwind [41]. Su propia doc dice cuándo no usarla: si querés una tabla lista y no te importan diseño ni bundle, una component library conviene [41]. La línea de corte práctica para esta app: con **una** tabla grande y sorting simple, una artesanal bien hecha (sort por columna + `useMemo` del array ordenado) alcanza; en cuanto aparecen sorting multi-columna, filtros por columna, column visibility o agrupación, TanStack Table paga su curva porque ese estado es exactamente lo difícil de mantener sincronizado a mano.

### Virtualización: cuándo hace falta de verdad

Con 10.000 filas × ~10 columnas son ~100.000 celdas en el DOM: eso viola directo la guía de INP de reducir el tamaño del DOM (§8) y se siente al ordenar o filtrar. Opciones honestas:

1. **Paginación** (más simple, y el export sigue siendo del dataset completo, no de la página).
2. **TanStack Virtual**: renderiza solo lo visible + overscan; es headless, "you own every element", y se integra con TanStack Table con ejemplos oficiales de filas virtualizadas [42][43]. Regla: virtualizá cuando renderizás **todas** las filas de un dataset de miles y el scroll/orden se degrada; no antes, porque complica sticky headers, alto variable y accesibilidad.
3. Si la tabla hoy pagina o corta a unas cientos de filas visibles, no virtualizar: complejidad sin retorno.

### Sticky headers y columnas responsivas

`position: sticky` en `th` funciona nativo (cuidado clásico: `overflow` en ancestros crea un nuevo contenedor de scroll y el sticky queda relativo a él — el header se pega al contenedor de la tabla, no al viewport). Con container queries de Tailwind 4 (§6), las columnas secundarias se ocultan según el ancho del **panel** que contiene la tabla, no del viewport: `@container` en el wrapper y `hidden @4xl:table-cell` en la celda [44].

### Export CSV correcto

Reglas verificadas:

- **RFC 4180**: campo con coma, comilla o salto de línea va entre comillas dobles; la comilla literal se duplica (`""`). No existe escape con backslash en CSV [45].
- **BOM UTF-8** (`﻿` al inicio): sin él, Excel interpreta mal los acentos — con nombres de campañas en castellano y alemán (KAREDO), obligatorio [46].
- **CSV injection (OWASP)**: celdas que empiezan con `=`, `+`, `-`, `@`, tab o CR se ejecutan como fórmula al abrir en Excel. Mitigación: anteponer `'` o tab dentro de comillas a esas celdas. Las librerías que cumplen RFC 4180 **no** te protegen de esto por defecto [47]. Con nombres de keywords/términos de búsqueda que vienen del mundo exterior (¡un término de búsqueda puede empezar con `=`!), esto no es paranoia: es input no confiable directo al Excel del operador.
- Números: exportar sin formato de moneda (punto decimal, sin separador de miles) y con columna de moneda aparte; el formato es de la vista, no del dato.

---

## 6. Tailwind 4: técnica

### Lo estructural (v4.0, 22 de enero de 2025)

Configuración CSS-first: los tokens viven en `@theme` dentro del CSS y **todos se emiten como CSS variables** usables en runtime ("takes all of your design tokens and makes them available as CSS variables by default") [44]. Motor nuevo (builds incrementales hasta 182× más rápidas), detección automática de contenido, cascade layers nativas (`theme`, `base`, `components`, `utilities` — se acabaron las guerras de especificidad), `@property`, `color-mix()`, paleta OKLCH [44]. Requiere navegadores modernos (Safari 16.4+, Chrome 111+, Firefox 128+), irrelevante para una app interna de un operador con Chrome al día [44].

Aplicación directa acá: **tokens semánticos por cuenta y por estado del dato** en `@theme` — `--color-cuenta-bhi`, `--color-provisional`, `--color-definitivo` — y como son CSS variables, recharts los lee con `var(--color-provisional)` en `stroke`/`fill`. Un solo lugar define el color de "provisional" para banda, línea punteada y badge de tabla: eso es des-desincronizar el diseño.

### Container queries: la herramienta correcta para dashboards

En core, sin plugin: `@container` en el padre, variantes `@sm:`/`@lg:` (+ `@min-*`/`@max-*`) en los hijos [44][48]. Para una grilla de cards de KPIs, la card debe responder al ancho de **su celda** (que depende de cuántas cards haya al lado), no al viewport — es el caso de manual de container queries y elimina la clase de bugs "queda bien en desktop pero roto cuando el panel se angosta".

### Dark mode

Default por `prefers-color-scheme`; para toggle manual se redefine la variante: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` y el three-way (claro/oscuro/sistema) se resuelve con `localStorage` + `matchMedia`, patrón documentado oficial [49]. Si se adopta, los colores de los charts tienen que salir de los mismos tokens `@theme` re-declarados bajo `[data-theme=dark]` — si el chart tiene colores hardcodeados, el dark mode nace desincronizado.

### ¿Componentes propios o shadcn/radix?

shadcn/ui está actualizado a Tailwind v4 + React 19 desde febrero 2025 (sin forwardRef, `data-slot`, OKLCH, `@theme inline`) [50]; el modelo es copy-paste con ownership del código, sobre primitivas Radix [51]. Costo/beneficio para una app **ya construida** con componentes propios: adoptarlo entero implica re-estilar todo para ganar consistencia que ya tenés. Lo racional es quirúrgico: traer **Radix primitives sueltas** (dialog, dropdown, tooltip) donde la accesibilidad/focus-trap es difícil de hacer bien a mano, estilarlas con los tokens existentes, y no adoptar el kit completo [51].

---

## 7. Resiliencia de front

### Error boundaries con reintento

`react-error-boundary` (Brian Vaughn) es el estándar: `FallbackComponent`, `resetErrorBoundary` para el botón "Reintentar", `resetKeys` para auto-reset cuando cambia el contexto (cuenta, ventana), `onError` para loggear [52]. Patrón para dashboard: **un boundary por sección** (cada card/chart/tabla), no uno global — que un gráfico roto no tire abajo la página de decisión. En React 19, los errores lanzados dentro de `startTransition` también los agarra el boundary [2].

### Retry con backoff

La referencia canónica es Marc Brooker (AWS, 2015): backoff exponencial con tope **más jitter**, porque sin aleatoriedad los reintentos se sincronizan en oleadas; "full jitter" es la variante recomendada y en su simulación redujo llamadas a menos de la mitad [53]. En la práctica: TanStack Query ya trae 3 reintentos con backoff exponencial por default [12]; si se hace a mano, `delay = random(0, min(cap, base * 2^intento))`. Reintentar solo errores transitorios (red, 5xx, 429) — jamás un 4xx de validación.

### Sesión vencida

Patrón verificado para SPAs: interceptor/wrapper único de fetch que ante 401 **no redirige a ciegas** — primero intenta refresh de sesión y reintenta el request; si no hay refresh posible, guarda la ruta actual y recién ahí manda al login, para volver donde estaba [54]. El anti-patrón documentado es el redirect inmediato que pierde el trabajo del usuario [54]. Para esta app: un solo `apiFetch()` central (nunca `fetch` suelto por componente) que detecte 401 y muestre un banner "sesión vencida — volver a entrar" sin descartar la vista; con datos de solo lectura en pantalla, no hay razón para borrarlos.

### Fechas y husos horarios: la trampa exacta, verificada en MDN

La regla de ECMAScript es traicionera: **un string solo-fecha se interpreta UTC; un string fecha-y-hora sin offset se interpreta hora local** [55]. Consecuencia real para Buenos Aires (UTC-3): `new Date("2026-09-12")` es el 12 a las 00:00 **UTC**, que en Argentina es el **11** a las 21:00 — el gráfico rotula todo un día corrido. Y el espejo: `date.toISOString()` convierte a UTC, así que serializar una fecha local de noche también cruza de día. Prácticas correctas:

- Fechas de calendario (las claves de las series diarias) viajan como **string `YYYY-MM-DD` de punta a punta** y no pasan por `Date` para mostrar; si hace falta un `Date` para formatear, `new Date(y, m-1, d)` (constructor local) o `new Date(s + "T00:00:00")` (sin Z → local) [55][56].
- `Intl.DateTimeFormat` con `timeZone` explícita cuando se formatea un instante real.
- **Temporal** (`Temporal.PlainDate` es exactamente "fecha de calendario sin huso") llegó a Stage 4 en marzo de 2026 y ya está en Firefox 139+ y Chrome 144+, pero Safari todavía no lo tiene estable: para producción hoy, todavía no; para tener en el radar, sí [57].

### Multi-moneda con Intl.NumberFormat

`style: "currency"` + código ISO 4217 resuelve símbolo, posición y decimales por moneda (JPY sin decimales; CLP también) [58]. Técnica: **una `Map` a nivel módulo de formatters cacheados por `locale|currency`** — crear `Intl.NumberFormat` es caro y un `tickFormatter` lo llamaría por cada tick de cada render [58]. Para ejes comprimidos, `notation: "compact"`. Decisión de producto coherente con el sistema: locale de despliegue según la ficha de la cuenta (de-DE para KAREDO → `1.234,56 €`), interno es-AR/es-CL. `formatToParts()` si hace falta separar símbolo de cifra en el layout [58].

---

## 8. Bundle y performance en Vite

### Code-splitting que rinde acá

- **Por ruta/tab con `React.lazy` + Suspense**: cada pestaña pesada es su propio chunk; el fallback solo aparece en la primera visita [4][59].
- **`manualChunks` (Rollup) para vendors estables**: separar `react`+`react-dom`, `recharts` (+d3), y utilidades — un vendor chunk estable sobrevive deploys en el cache del navegador [59][60]. Advertencia oficial de Rollup: chunks manuales pueden cambiar el comportamiento si disparan side effects antes de tiempo — preferir la forma función y no sobre-fragmentar [60]. Nota 2026: Vite nuevo (rolldown) renombra la config a `build.rolldownOptions.output.codeSplitting`; con Vite/Rollup clásico sigue siendo `build.rollupOptions.output.manualChunks` [61].
- **Lazy de librerías pesadas por interacción**: un generador de PDF se importa con `await import("...")` adentro del handler del botón — nunca en el bundle inicial. recharts, en cambio, es above-the-fold en un dashboard: va en vendor chunk, no lazy.
- **lucide-react**: tree-shakeable con imports nombrados en build de producción; en dev, Vite no tree-shakea y puede cargar el barril entero — si el dev server pesa, existen los imports directos por ícono y el truco del alias [62].
- **Barrel files propios: evitarlos.** Doc oficial de Vite: "When you only import an individual API (...) all the files in that barrel file need to be fetched and transformed" [63]. Un `components/index.ts` que re-exporta todo es un impuesto silencioso en dev y en prod.

### Métricas objetivo 2026

**INP** (Core Web Vital que reemplazó a FID): bueno ≤ **200 ms** en p75, pobre > 500 ms; mide todas las interacciones (click, tap, tecla), no solo la primera [64]. Las palancas según web.dev [65]: romper tareas largas cediendo el main thread, evitar layout thrashing (leer y escribir estilos en la misma tarea), y **reducir el tamaño del DOM** — el argumento de performance para paginar/virtualizar la tabla de 10k (§5). En React, las dos palancas de mayor apalancamiento son precisamente `startTransition`/`useDeferredValue` (§1). Para una app de un solo operador no tiene sentido montar RUM: React DevTools Profiler + panel Performance con throttling alcanzan; el número 200 ms queda como presupuesto de cada interacción (ordenar la tabla, cambiar ventana, filtrar).

---

## Síntesis para NorthSignal

La app está parada sobre el stack correcto para su escala; ninguna migración de librería de charts ni de UI kit tiene retorno. El valor está en seis movimientos quirúrgicos: (1) TanStack Query como única fuente de estado de servidor con `staleTime` por tipo de dato, zustand solo UI, derivar en vez de copiar; (2) `useDeferredValue` + `memo` en tabla y buscador; (3) transitions para que el cambio de cuenta/ventana nunca desmonte lo visible; (4) el punteado de maduración sobre la serie además de la banda, con la misma marca en tabla y CSV; (5) export CSV con RFC 4180 + BOM + guardia anti-inyección; (6) fechas como strings `YYYY-MM-DD` sin pasar por `new Date(str)`, y formatters `Intl` cacheados por moneda. Todo lo demás — compiler, Radix puntual, container queries, virtualización — entra por oportunidad, no por urgencia.

---

## Fuentes

1. useDeferredValue – React (docs oficiales) — https://react.dev/reference/react/useDeferredValue — requisito de `memo`, render diferido interrumpible, integración con Suspense, no evita requests extra.
2. useTransition – React (docs oficiales) — https://react.dev/reference/react/useTransition — Actions async en React 19, prohibición de inputs controlados, errores capturados por boundaries, caveat del `await`.
3. useOptimistic – React (docs oficiales) — https://react.dev/reference/react/useOptimistic — estado optimista que converge/revierte solo; base para descartarlo en flujos de aprobación.
4. Suspense – React (docs oficiales) — https://react.dev/reference/react/Suspense — revelado en bloque, boundaries anidados, qué activa Suspense (no los effects), transitions evitan el fallback.
5. React Compiler v1.0 – React Blog (7/10/2025, Lauren Tan, Joe Savona, Mofei Zhang) — https://react.dev/blog/2025/10/07/react-compiler-1 — estable, números de Meta (+12%, 2.5×), guía sobre memoización existente, React 17+, lint consolidado.
6. React Compiler – react.dev/learn — https://react.dev/learn/react-compiler — instalación, adopción incremental, configuración.
7. Why React Re-Renders – Josh Comeau — https://www.joshwcomeau.com/react/why-react-re-renders/ — modelo mental de re-renders, `memo`, contexto.
8. Understanding useMemo and useCallback – Josh Comeau — https://www.joshwcomeau.com/react/usememo-and-usecallback/ — costo/beneficio de la memoización manual.
9. I let React Compiler handle memoization: here's what actually broke – LogRocket — https://blog.logrocket.com/react-compiler-memoization-what-actually-broke/ — notas de campo de adopción del compilador.
10. Why You Want React Query – TkDodo (7/11/2023) — https://tkdodo.eu/blog/why-you-want-react-query — los 5 bugs del fetch manual en useEffect; "Data Fetching is simple. Async State Management is not."
11. React Query as a State Manager – TkDodo (20/8/2021) — https://tkdodo.eu/blog/react-query-as-a-state-manager — async state manager, `staleTime` como perilla, no copiar a otros stores.
12. Important Defaults – TanStack Query docs — https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults — stale inmediato, gcTime 5 min, retry 3× con backoff, structural sharing.
13. TanStack Query vs SWR – PkgPulse (2026) — https://www.pkgpulse.com/guides/tanstack-query-vs-swr-2026 — tamaños (4.2 vs 13.4 KB), downloads, feature set.
14. React Query vs TanStack Query vs SWR: a 2025 comparison – Refine — https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/ — comparativa de capacidades.
15. Working with Zustand – TkDodo (20/11/2022) — https://tkdodo.eu/blog/working-with-zustand — selectores atómicos, acciones separadas, stores chicos, combinar con server state.
16. Don't Sync State. Derive It! – Kent C. Dodds (30/9/2019) — https://kentcdodds.com/blog/dont-sync-state-derive-it — derivar del origen en vez de sincronizar copias.
17. The effect of skeleton screens: users' perception of speed and ease of navigation (estudio, 2018) — https://www.researchgate.net/publication/326858669_The_effect_of_skeleton_screens_Users'_perception_of_speed_and_ease_of_navigation — skeletons percibidos más rápidos que spinners.
18. Stale-While-Revalidate UI Patterns – Michael Samuel Naeem — https://blog.michaelsam94.com/web-performance-stale-ui-patterns/ — "Updating…" + "Last updated Xm ago", nunca reemplazar números visibles en silencio.
19. Release v3.0.0 – recharts (GitHub, 23/6/2025) — https://github.com/recharts/recharts/releases/tag/v3.0.0 — reescritura de estado, accessibilityLayer default, portales de Tooltip/Legend, YAxis auto.
20. 3.0 migration guide – recharts wiki — https://github.com/recharts/recharts/wiki/3.0-migration-guide — breaking changes: CategoricalChartState, Customized, deps eliminadas.
21. ReferenceArea – recharts API — https://recharts.github.io/en-US/api/ReferenceArea/ — bandas x1/x2/y1/y2 para anotar rangos.
22. Synchronized Line Chart – recharts examples — https://recharts.github.io/en-US/examples/SynchronizedLineChart/ — `syncId` y `syncMethod` (index/value/función).
23. Performance Optimization – recharts guide — https://recharts.github.io/en-US/guide/performance/ — refs estables, dataKey, aislar componentes, throttle de mouse, memo, medir.
24. Point animation duration and first render delay even if isAnimationActive=false – recharts #945 — https://github.com/recharts/recharts/issues/945 — animación inicial retrasa puntos; workaround estándar.
25. Recharts is slow with large data – recharts #1146 — https://github.com/recharts/recharts/issues/1146 — degradación con datasets grandes.
26. CartesianAxis on charts with large datasets – recharts #1465 — https://github.com/recharts/recharts/issues/1465 — XAxis con interval default sobre ~10k items tarda segundos.
27. downsample large data set / LTTB – recharts #1356 — https://github.com/recharts/recharts/issues/1356 — downsampling pendiente; hacerlo en usuario.
28. Best React chart libraries in 2026 – LogRocket — https://blog.logrocket.com/best-react-chart-libraries-2026/ — SVG vs canvas, techo de recharts, cuándo visx/ECharts.
29. Recharts vs Chart.js vs Nivo 2026 – PkgPulse — https://www.pkgpulse.com/guides/recharts-vs-chartjs-vs-nivo-vs-visx-react-charting-2026 — recharts para dashboards estándar; canvas para volumen.
30. Observable Plot — a charting library for React developers – Cube — https://awesome.cube.dev/tools/observable-plot/react — integración por ref imperativo; buena para exploración.
31. uPlot – GitHub (leeoniya) — https://github.com/leeoniya/uPlot — "~50 KB min", "166,650 data points in 25ms", canvas, sin wrapper React oficial.
32. Vercel acquires Tremor – Vercel Blog (enero 2025) — https://vercel.com/blog/vercel-acquires-tremor — todo MIT/open source; equipo absorbido por Vercel.
33. Trends: charts – PostHog docs — https://posthog.com/docs/product-analytics/trends — "A dotted line indicated the data for that period is still being collected."
34. About data freshness – Google Ads Help — https://support.google.com/google-ads/answer/2544985 — SLO 1 h para clics/costo; conversiones hasta 15 h según atribución; ajustes retroactivos.
35. About conversion lag reporting – Google Ads Help — https://support.google.com/google-ads/answer/9347141 — CPA/ROAS ajustados por lag.
36. Find your conversion lag reporting data – Google Ads Help — https://support.google.com/google-ads/answer/9347065 — anotaciones cuando el rango elegido está afectado por lag.
37. visualizing uncertainty – storytelling with data (2018) — https://www.storytellingwithdata.com/blog/2018/6/27/visualizing-uncertainty — punteado + marcadores sin relleno para lo incierto.
38. How to deal with missing data in line charts – Datawrapper Academy — https://www.datawrapper.de/academy/patchy-data — serie sólida + serie punteada con punto de empalme.
39. Dashed line in Azure monitoring dashboard – Microsoft Learn — https://learn.microsoft.com/en-us/answers/questions/1152894/dashed-line-in-the-azure-monitoring-dashoard — punteado = valor faltante entre puntos conocidos.
40. Drawing line for full interval based on data before/after – Grafana Community — https://community.grafana.com/t/drawing-line-for-full-interval-based-on-data-before-and-after-the-interval/37058 — Grafana no trae patrón nativo de intervalo parcial.
41. Introduction – TanStack Table docs — https://tanstack.com/table/v8/docs/introduction — headless: lógica sin markup; cuándo conviene una component library.
42. TanStack Virtual – docs — https://tanstack.com/virtual/latest — virtualización headless, solo lo visible + overscan.
43. Virtualization Guide – TanStack Table docs — https://tanstack.com/table/v8/docs/guide/virtualization — integración Table+Virtual con ejemplos oficiales.
44. Tailwind CSS v4.0 – Tailwind Blog (22/1/2025) — https://tailwindcss.com/blog/tailwindcss-v4 — @theme, tokens como CSS variables, container queries en core, cascade layers, motor nuevo.
45. Handling special characters in CSV files (RFC 4180) – InventiveHQ — https://inventivehq.com/blog/handling-special-characters-in-csv-files — reglas de quoting/escape de RFC 4180.
46. CSV Encoding & Excel – ConvertMyStuff — https://www.convertmystuff.com/resources/developer-tools/csv-encoding-and-excel/ — BOM UTF-8 (EF BB BF) para que Excel detecte la codificación.
47. CSV Injection – OWASP — https://owasp.org/www-community/attacks/CSV_Injection — caracteres gatillo (=, +, -, @, tab, CR), mitigaciones y caveats de Excel.
48. Tailwind CSS v4 Container Queries – SitePoint — https://www.sitepoint.com/tailwind-css-v4-container-queries-modern-layouts/ — @container, @min-*/@max-*, contenedores nombrados.
49. Dark mode – Tailwind docs — https://tailwindcss.com/docs/dark-mode — @custom-variant dark con clase o data-attribute; three-way con localStorage + matchMedia.
50. Tailwind v4 – shadcn/ui docs (febrero 2025) — https://ui.shadcn.com/docs/tailwind-v4 — componentes actualizados a v4 + React 19; no rompe apps v3.
51. Shadcn UI adoption guide – LogRocket — https://blog.logrocket.com/shadcn-ui-adoption-guide/ — modelo copy-paste/ownership, trade-offs de adopción.
52. react-error-boundary – GitHub (bvaughn) — https://github.com/bvaughn/react-error-boundary — FallbackComponent, resetErrorBoundary, resetKeys, onError.
53. Exponential Backoff And Jitter – Marc Brooker, AWS Architecture Blog (4/3/2015) — https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ — full jitter contra reintentos sincronizados.
54. Please stop redirecting to login on 401 errors – dev.to — https://dev.to/aragossa/please-stop-redirecting-to-login-on-401-errors-3c0l — refresh + retry antes de redirigir; preservar la ruta.
55. Date.parse() – MDN — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse — solo-fecha = UTC; fecha-hora sin offset = local (con ejemplos).
56. A Complete Guide to JavaScript Dates (and why your date is off by 1 day) – Zach Gollwitzer, dev.to — https://dev.to/zachgoll/a-complete-guide-to-javascript-dates-and-why-your-date-is-off-by-1-day-fi1 — el bug del día corrido explicado de punta a punta.
57. TC39 advances Temporal to Stage 4 – Socket (2026) — https://socket.dev/blog/tc39-advances-temporal-to-stage-4 — Stage 4 marzo 2026; Firefox 139+, Chrome 144+; Safari pendiente (ver también https://caniuse.com/temporal).
58. Intl.NumberFormat – MDN — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat — style currency, códigos ISO 4217, formatToParts, reuso de instancias.
59. Route-level code-splitting with React.lazy, Suspense and Vite manualChunks – Mykola Aleksandrov (10/2025) — https://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/ — chunk por ruta + vendor chunks estables.
60. output.manualChunks – Rollup docs — https://rollupjs.org/configuration-options/#output-manualchunks — forma función, advertencia sobre side effects.
61. Building for Production – Vite docs — https://vite.dev/guide/build — targets Baseline Widely Available; en Vite/rolldown la config pasa a `rolldownOptions.output.codeSplitting`.
62. Lucide React – lucide.dev — https://lucide.dev/guide/packages/lucide-react — tree-shaking con imports nombrados; comportamiento distinto del dev server de Vite.
63. Performance – Vite docs — https://vite.dev/guide/performance — evitar barrel files, warmup, auditar plugins.
64. Interaction to Next Paint (INP) – web.dev — https://web.dev/articles/inp — Core Web Vital; bueno ≤200 ms p75, pobre >500 ms; mide todas las interacciones.
65. Optimize INP – web.dev — https://web.dev/articles/optimize-inp — tres fases de la interacción, ceder el main thread, layout thrashing, reducir DOM.
