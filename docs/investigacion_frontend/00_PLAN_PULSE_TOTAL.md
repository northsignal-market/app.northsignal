# Pulse total — el lenguaje llevado a cada elemento de la app

Síntesis de 229 fuentes (informes 11–15; 83 de 2026, 44 de foros). Tercera tanda de
investigación. Este plan mapea CADA decisión al código completo, incluyendo lo nunca
revisado: drawers, selects, cadenas de decisión, gráficos nuevos, scroll y redundancias.
El backend no se toca: todo es capa de presentación y navegación.

## Reglas duras del lenguaje (informe 12 — "no parecer IA")

El hallazgo crítico: desde abr-2026 la comunidad identifica el look **terminal-hacker**
(cyan/verde sobre negro + monospace + scanlines) como EL nuevo delator de UI generada.
Pulse se salva por tres anclas que son INTOCABLES: **Inter (jamás mono como display)**,
**el azul corporativo #0062CC como dueño del cyan** (el cyan solo existe al lado del
azul de marca), y **negro templado (#16171C), nunca #000**. Sobre eso:

1. **Un protagonista luminoso por vista** (la cifra-héroe o el hero chart), máximo 2
   glows de apoyo al 3–8% de opacidad. El resto, sin brillo.
2. **Gradiente de texto solo en la cifra-héroe** — 1 por vista. KPIs secundarios en
   off-white plano. (Hoy `cifra-luz` está en TODOS los Stats: reducir.)
3. **Top-highlight solo en tarjetas de nivel 1** (una o dos por vista); el resto
   hairline 8% sin highlight. La firma se protege no repitiéndola.
4. Texto cuerpo al 85–92% de blanco; blanco puro solo cifras protagonistas.
5. Verde/rojo solo deltas y SIEMPRE con flecha (daltonismo); cyan = "dato", nunca "bien".
6. Cero emojis en UI, una familia de iconos (lucide) a un solo stroke, radios 4/8/12/16.
7. Densidad variable: KPIs aireados, tablas densas (filas 32–36px); prohibido el grid
   de tarjetas idénticas.

## Superficies y flujos (informe 11)

**Jerarquía fija: inline → peek → drawer → página → modal.** Modal SOLO para frenar
(confirmar ejecución en Ads). Reglas:

- **Un drawer, nunca dos.** Drill-down = reemplazar contenido con miga interna, o
  promover a página. Encima solo el confirm efímero.
- **El drawer vive en la URL** (`?acc=<id>`): abrir = push (back lo cierra), deep-link
  cae con el drawer abierto. "Abrir como página" disponible.
- **Salidas**: Esc, X, clic-afuera solo sin formulario sucio.
- **Confirmación de ejecución**: muestra `valor_actual → nuevo`, entidad exacta y
  cuenta (el old value ya lo exige el backend; exhibirlo es gratis).
- **Feedback pesimista**: botón → "enviando…" → estado nuevo en la fila + banner en el
  drawer. Toast jamás como único canal (GitHub abandonó toasts).
- **Selects**: cortos y fijos (ventana, orden, densidad) → `appearance: base-select`
  estilizado con tokens (Chrome/Edge 135+, app interna = viable). Entidades
  (keyword/campaña/grupo) → **combobox Popover+cmdk con búsqueda y subtítulo de
  contexto por opción** (crítico: 21 campañas homónimas en FM). Virtualizar >100.
- **Split view de triage en ≥1280px** (fase tardía): Bandeja master-detail con ↑/↓,
  estilo Linear peek — elimina la mayoría de aperturas de drawer.

## Cadenas de decisión (informe 15)

- **Queue-advance**: aprobar/simular/descartar en el drawer NO lo cierra — carga el
  siguiente accionable (setting para apagar). Patrón Superhuman/Gmail/Graphite.
- **Lotes homogéneos**: la cola agrupa por tipo+cuenta (todas las negativas juntas).
- **Contexto que viaja**: Bandeja→Datos SIEMPRE por URL
  (`?cuenta=X&search=Y&origen=acc-N`) + banner efímero "← Volver al accionable" que
  restaura el drawer en su estado. Regla dura: estado que cambia lo que se ve, vive en la URL.
- **Evidencia embebida**: la mini-tabla del término va DENTRO del drawer del accionable
  (Datos queda para exploración). Métrica de éxito: mañanas con cero clics de sidebar.
- **Next-best-action**: al aprobar X, ofrecer el eslabón relacionado (mismo grupo/causa
  raíz) con su porqué — respetando radio de evidencia.
- **Hints encadenados, cero tours**: tras 3 aprobaciones con mouse → "con A avanza
  sola"; una vez, descartable.

## Navegación reestructurada (informe 15)

- **Cuenta pasa de 6 tabs a 4**: fusionar **semana+brief+diagnóstico → "Semana"**
  (narrativa temporal: brief del lunes arriba → plan/KPIs → tendencia → diagnóstico
  abajo, con anclas `#brief` `#diagnostico`). Quedan: Semana · Accionables · Memoria ·
  Reportes. (Evidencia: Notion 3.4, OOUX: tres lentes del mismo objeto ≠ tres lugares.)
- **Herramientas sale del sidebar** → ⌘K (y colapsable si se extraña). Sidebar:
  Bandeja · Cuenta · Datos · Sistema.
- **⌥1–4 preserva también filtros** (cuenta como filtro hasta el fondo, Vercel-style).
- **Redirects para toda ruta movida**; anclas de memoria muscular intocadas (⌘K, ⌥1-4).

## Redundancia: canónico + 1 eco (informe 14)

| Dato | Canónico | Eco permitido | Se degrada/elimina |
|---|---|---|---|
| Pendientes | Bandeja | Badge del sidebar (número) | El texto del header pasa a punto+link |
| Salud/datos | Sistema › Salud | Punto tricolor del header | KPI "Datos" de Bandeja linkea, sin cifras |
| Pulso de ayer | Semana | 1 línea en rail de Bandeja | Sin repetir gráfico ni párrafos |

Presupuesto de ecos en el chrome: **1 numérico + 1 binario, fijo.**

## Sistema: TOC lateral, no tabs (informe 14)

Una sola página recorrible + **mini-TOC sticky con scrollspy** (reusar el patrón rail),
`scroll-margin-top` en anclas, headers de grupo sticky con fondo opaco. Paneles en grid
uniforme (bento NO — solo con jerarquía declarable). Diagnóstico reordenado por
pregunta: (1) ¿decido algo? (2) ¿cómo viene? (3) contexto plegado.
Higiene: `color-scheme: dark`, `scrollbar-gutter: stable`, scroll restoration al volver.

## Gráficos: crear solo donde aportan (informe 13)

Test previo: si no podés escribir la oración que el chart demuestra, es decoración.
Presupuesto por vista: 3-4 BANs + 1 hero chart + 2-3 sobrios.

**CREAR:**
1. **Barcode/strip de 46 locales FM** por grupo de pares, local resaltado en cyan —
   responde "¿está fuera de su manada?" y ES la estética de la casa.
2. **Barra apilada 100%** para impression share (ganado/perdido-budget/perdido-rank).
3. **Bullet chart** predicción vs real (barra=real, banda=rango, tick=predicho).
4. **Gauge radial de ticks** — SOLO pacing de presupuesto mensual, 1 por cuenta (el
   único uso honesto del radial: una meta glanceable).
5. **Racha GitHub-style** (grilla de días) para cumplimiento del plan.

**CAMBIAR:** embudo FM trapecio → barras horizontales con % de paso. Composición por
grupo → barras horizontales ordenadas (es ranking, no fracción).
**MANTENER:** heatmap hora×día, pastillas del plan, líneas con huecos para ratios,
"—" para CPA sin conversiones (jamás 0).
Estética de charts: halo con blur DEBAJO + dato nítido encima; barras redondeadas ≤3px;
series desaturadas 20-30%.

## Fases de implementación

- **P1 · Dosificación anti-IA** (rápida): cifra-luz solo en héroe por vista, top-highlight
  solo nivel 1, texto cuerpo a 88%, auditar glows (≤3 por vista).
- **P2 · Drawer pro**: URL-state, confirmación old→new, feedback pesimista, queue-advance,
  evidencia embebida, banner de retorno Datos→accionable.
- **P3 · Nav 4+4**: fusión Semana (brief+plan+diagnóstico), Herramientas a ⌘K, redirects,
  ecos canónicos (header punto+link).
- **P4 · Sistema TOC** + Diagnóstico por pregunta + higiene de scroll.
- **P5 · Charts nuevos**: barcode locales, IS apilado, bullet predicciones, gauge pacing,
  racha del plan; embudo→barras.
- **P6 · Selects**: base-select estilizado + combobox cmdk para entidades.
- **P7 · Split view triage** (si el uso lo pide tras P2).
