# Plan de rediseño del front — septiembre 2026

Síntesis de 228 fuentes verificadas (informes 01–05 de este directorio). Cada decisión de acá
abajo está respaldada por al menos dos informes independientes; donde hay número, viene de
documentación oficial o investigación citada en los informes.

**El principio rector, en una frase del pedido de Andrés:** *comodidad de decisión, no 8000
displays de data que no influye.* Traducción operativa: cada vista responde UNA pregunta en
menos de 12 palabras; lo que no contesta esa pregunta se pliega o se va.

## Las siete decisiones transversales

1. **Tokens de superficie, no sombras.** Escala `surface-0..3` derivada de #1A1F36 (+5–8% de
   luminancia por paso), borde 1px sutil, sombra solo en overlays. El glass queda SOLO en el
   shell (header, sidebar, modales) — nunca en tarjetas de datos.
2. **Texto: se retira el blanco puro como color corriente.** Primario off-white (#EDEFF3),
   secundario apagado; #FFFFFF reservado a cifras protagonistas. El azul #0062CC **no pasa
   AA como texto sobre navy**: para texto/íconos se usa una variante clara (mismo matiz,
   ~#4D9DFF); el #0062CC queda para fondos de botón y marca.
3. **Color = estado, chrome monocromo.** Se suman dos tonos desaturados para dark: ámbar
   (atención) y rojo (error/empeora), dosificados como texto/borde/fondo sutil, nunca bloques.
   `no_aplicaba` se pinta neutro, jamás rojo.
4. **Procedencia uniforme en todo lo que afirma algo:** `agente · ventana · fecha`
   ("Semanal · 17 días al 10/9"). Cada cifra lleva valor + delta + ventana; redondeo agresivo
   (12,4K); `tabular-nums` en todo número.
5. **Decisión separada de actividad** (patrón LangChain/Linear): tres niveles — decidir
   (Bandeja), enterarse (feed colapsado por agente), consultar (vistas). Un ítem decidido
   desaparece; bandeja vacía es el estado feliz y se dice ("nada pide tu decisión hoy").
6. **Fricción proporcional al riesgo:** riesgo bajo un clic + deshacer; riesgo medio de a uno
   con el valor previo visible antes del botón; lote solo homogéneo de riesgo bajo. Editar
   parámetros sin rechazar es una respuesta de primera clase.
7. **Teclado primero:** verbos con tecla en la Bandeja (aprobar `1`, declinar `3`, posponer
   `H`, abrir `Enter`, deshacer `Z`), `⌘1–4` cambia de cuenta preservando la sección, `⌘K`
   registra todo y muestra el atajo al lado (el palette es el manual).

## Fases de implementación (cada una compila, deploya y no rompe nada)

### F1 · Fundación de tokens — index.css + ui.tsx
- `@theme`: `--surface-0..3`, texto 3 niveles, `--primary` (fondos) + `--primary-text`
  (#4D9DFF aprox, verificado 4.5:1 contra cada surface), `--warn` ámbar y `--bad` rojo
  desaturados, focus ring 2px tokenizado, z-layers con nombre, motion (`--t-micro: 150ms`,
  `--t-panel: 280ms`, solo transform/opacity, reduced-motion degrada a fades).
- Radios concéntricos automáticos: `--r-hijo: calc(var(--r-tarjeta) - var(--pad))`.
- Riesgo: bajo (variables); efecto: toda la app a la vez.

### F2 · Shell — header, sidebar, Cmd+K
- Header sticky de UNA fila, ≤5 elementos: switcher de cuenta (⌘1–4, badge = solo decisiones
  pendientes) · "Cuenta / Sección" · ⌘K · punto de estado del sistema (= peor componente) ·
  Ayuda (migra del botón flotante).
- Sidebar: iconos+texto, Bandeja primera, badge numérico solo en Bandeja, punto binario en
  Sistema; colapsable a iconos con ⌘B como opción.
- Al cambiar de cuenta se preserva la sección (same page, different scope).

### F3 · Bandeja como triage puro
- Solo entra lo que pide decisión (semántica `v_para_actuar`). Verbos con tecla, motivo de
  llegada visible (qué regla/relación lo generó), procedencia por ítem, diff
  `actual → propuesto` en la tarjeta, optimistic UI con `Z` para deshacer (nada de modales
  para lo reversible).
- La actividad ("desde tu última visita") va aparte, agrupada por agente, corridas sin
  novedad colapsadas en una línea ("Centinela: 6 corridas, sin anomalías").

### F4 · Cuenta/Semana con presupuesto de atención
- Arriba: máximo 5 números con sparkline, valor+delta+ventana (patrón Stripe). Métrica norte
  primero. Todo lo demás colapsado por defecto.
- Provisional doble: banda + trazo punteado en los últimos 3 días (patrón PostHog), y la
  marca "madurando" también en tablas y CSV.
- 3 tamaños tipográficos por vista, máximo 2 elementos grandes por pantalla.

### F5 · Datos
- `useDeferredValue` + `memo` en búsqueda/filtro; `startTransition` al cambiar cuenta/rango
  (gráfico viejo atenuado, no spinner).
- CSV blindado: RFC 4180 + BOM UTF-8 + guardia anti formula-injection (`= + - @`).
- Filas 36–44px, headers fijos, números a la derecha, identificador legible primera columna.

### F6 · Sistema
- Latidos como panel pasivo: fila por agente, "último éxito hace X" contra SU cadencia,
  global = peor componente. "En silencio" es el estado más peligroso: se destaca.
- Salud del propio control: si la tasa de rechazo es 0% o el time-to-approve cae con volumen
  subiendo, el panel lo dice (anti rubber-stamping).

### F7 · Capa de datos (interna, al final para no mezclar con lo visual)
- TanStack Query para TODO estado de servidor (staleTime por tipo de dato, refetch al foco,
  dedupe) — elimina la clase entera de desincronización; zustand queda solo para UI.
- Error boundary por sección; `apiFetch()` único con manejo de 401; retry solo en Query.
- Lazy por tab + manualChunks (recharts, pdf); presupuesto INP ≤200ms.

## Lo que se decidió NO hacer (con fundamento)
- **No migrar de recharts** (series de 17–91 puntos; el techo de SVG está 100× arriba).
- **No adoptar shadcn/ui completo** en una app ya construida; primitivas Radix sueltas solo
  donde la accesibilidad es difícil.
- **No `useOptimistic` en aprobaciones**: sería mentirle al operador sobre un cambio no
  confirmado en Google Ads.
- **No virtualizar tablas** mientras haya paginación.
- **No data-ink ratio literal de Tufte** (desacreditado 2025): queda el filtro "¿este pixel
  informa una decisión?", no la doctrina.

## Vocabulario fijo del sistema (para UI y agentes)
Siete verbos que reparten agencia: **detectar, proponer, simular, aprobar/rechazar/editar,
aplicar, verificar, revertir.** Cada agente firma con nombre estable. "Aprobar" es solo de
Andrés. Voz seca: verbo + objeto + diff + procedencia + reversibilidad.
