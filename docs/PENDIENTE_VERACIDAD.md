# Lo que todavía miente en pantalla

**Auditoría del 14 de septiembre de 2026.** Cada hallazgo de acá fue verificado
contra el árbol y, donde se pudo, contra la base viva. Lo no verificado está
marcado como tal y separado al final.

Este documento está escrito para que lo ejecute una sesión nueva que no tiene
nada de contexto. Leelo entero antes de tocar la primera línea: la sección de
doctrina no es relleno, es lo que evita reintroducir los bugs que se acaban de
sacar.

---

## 0 · Cómo trabajar acá

### La doctrina, en cinco reglas que ya se rompieron

**1. Nunca inventes un nombre.** Ni de tabla, ni de columna, ni de función, ni
un valor de enum. Se resuelven contra la base antes de escribirlos:

```sql
select column_name, data_type from information_schema.columns where table_name = 'X';
select proname, pg_get_function_identity_arguments(oid) from pg_proc p
  join pg_namespace n on n.oid = pronamespace where nspname = 'public' and proname = 'Y';
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'T'::regclass;
```

El 13/9 se inventó `registrar_latido` (la función es `latir`), `familia =
'frescura'` y `tipo = 'config'`. Los tres fallaron al ejecutar. **La mayoría de
los hallazgos de este documento son exactamente eso: código que lee un nombre
que nunca existió.**

**2. Un vacío tiene tres causas y hay que decir cuál.** "No pasó nada", "el dato
nunca se capturó" y "falló la consulta" se ven idénticos y llevan a conclusiones
opuestas. Un `|| 0` o un `|| 'texto'` sobre un valor ausente convierte un hueco
en algo que parece medido.

**3. La ventana que declarás tiene que ser la que sumaste.** Nunca
`current_date - N` a mano. Las capas reales, verificadas el 14/9:

| Capa | Retención real |
|---|---|
| `campaign_daily`, `keywords_daily`, `search_terms_daily` | acumulan desde el 22/8, pero **solo los últimos 14 días se corrigen** (`LOOKBACK_DAYS` en los scripts) |
| `campaign`, `keywords`, `adgroup` (semanales) | 13 semanas = 91 días |

Ese matiz importa: la capa diaria hoy tiene 22 días distintos, pero los
anteriores a los últimos 14 quedaron congelados con el valor que tenían.
Ninguna de las cifras que circulan en el repo (14, 15-17, 17, 30) expresa eso.

**4. Un guardarraíl que no puede medir no aprueba.** Si falta el dato para
decidir, bloquea y explicá por qué. Se acaba de arreglar `I3` por esto.

**5. Corré `npm run verificar` antes de decir que terminaste.** Encadena tipos,
control de cascada, 22 tests y build. El 14/9 cuatro agentes dijeron "listo" con
el archivo roto porque ninguno corrió `tsc`.

### Dos trampas de sintaxis que ya costaron una hora

**Un comentario JSX solo vale donde se aceptan hijos.** Esto rompe el archivo
entero, porque en posición de expresión se parsea como objeto literal:

```jsx
{lista.map(x => (
  {/* comentario */}      ← ROMPE
  <div>…</div>
))}
{cond && (
  {/* comentario */}      ← ROMPE también
  <p>…</p>
)}
```
El comentario va **arriba** del `.map(` o del `{cond &&`.

**Nunca escribas la secuencia de cierre de comentario dentro de un comentario
JSX.** Lo cierra antes de tiempo. (Sí: pasó escribiendo el comentario que
explicaba esto.)

### Por qué el typecheck no atrapa nada de esto

**`@types/react` no está instalado** — no figura en `dependencies` ni en
`devDependencies`. Sin él, todo objeto sostenido por un `useState` es `any`, así
que leer `row.columna_que_no_existe` da verde.

**Esa es la tarea 0 de este documento.** Instalarlo va a encender decenas de
errores de tipo reales; conviene hacerlo primero y usar la lista de errores como
guía, porque va a encontrar cosas que esta auditoría no vio.

```
npm i -D @types/react @types/react-dom
npx tsc --noEmit          # esperá una lista larga: es el punto
```

### Lo que NO hay que rehacer

Ya está arreglado y desplegado (commits `7d70078`, `fc93d08`, `83ab298`,
`1cc7f6d`, más la migración `20260914030000`):

- `aplicarPoliticaAuto` ya exige `Accion JSON` válido y saca verbo, keyword y
  concordancia del JSON.
- `refrescarEspejo` ya no pisa `accion_valida` / `accion_error`.
- `I3` ya usa la capa semanal y bloquea ante ausencia de datos.
- `pedirJSON` / `motivoFallo` en `src/lib/red.ts`; `useJSON` expone `error` y
  `cargando`. Bandeja, App, Datos, DatosCadena, ActionableDrawerContent y
  useCuentas ya distinguen "no hay nada" de "falló".
- La cascada: clases propias en `@layer components`, keyframe en `transform: none`.
- Cuatro anidamientos de opacidad ilegibles.

---

## 1 · Componentes que leen columnas inexistentes

Todos verificados el 14/9: el nombre que lee la UI **no existe** en la vista.
Este es el patrón que produjo el bug del panel Integridad (commit `1622a56`), y
sobrevive en al menos ocho lugares más.

**Antes de arreglar cada uno, traé la forma real:**
```sql
select * from <la_vista> limit 1;
```

### 1.1 · Toda corrida semanal muestra `15 / 15 pts`
`src/components/Sistema.tsx:925`
```tsx
{run.score || run.puntuacion || 15} / 15 pts
```
`v_run_scorecard` devuelve **`puntos`** y **`puntos_posibles`**. Doble falla:
los dos nombres son inventados, y aunque existieran `0 || 15` daría 15.

**Síntoma:** cada tarjeta de "Calidad de cada análisis semanal" muestra la
pastilla `15 / 15 pts`, siempre, en todas las cuentas y fechas. La métrica que
mide si el análisis se degrada está clavada en el máximo.

**Arreglo:** leer `puntos` / `puntos_posibles`, y si alguno viene null mostrar
`—`, no un número.

### 1.2 · Toda cuenta dice "Sincronización al día"
`src/components/Sistema.tsx:506`
```tsx
{row.motivo || row.detalle || 'Sincronización al día'}
```
`v_data_health` devuelve **`mensaje`**, `semana_datos`, `ultimo_run`, `estado`.
Y `mensaje` es justamente la columna que dice *"El script no corre hace mas de 8
dias. Los datos mostrados son viejos."*

**Síntoma:** la columna **Detalle** afirma "Sincronización al día" incluso en la
fila cuyo `estado` es `ERROR`. Dos columnas más del mismo panel leen
`ultimo_dia_datos` / `ultima_sincronizacion` (reales: `semana_datos` /
`ultimo_run`), así que **"Último día con datos" y "Última extracción" muestran
`—` siempre**.

### 1.3 · Todo webhook dice "Último disparo: reciente"
`src/components/Sistema.tsx:526`
```tsx
Último disparo: {w.ultimo_disparo || 'reciente'}
{w.servicio || w.endpoint || 'Webhook Ingest'}
```
`v_webhook_health` devuelve `estado`, `ultimo_evento`, `horas_sin_eventos`,
`eventos_7d`, `en_cuarentena`, `fallidos`. **Ninguno de los tres nombres que lee
la UI existe.**

**Síntoma:** cada fila dice `Webhook Ingest / Último disparo: reciente` y afirma
frescura que nadie midió. Contexto que lo empeora: los webhooks de cierres
**nunca recibieron un evento** (ticket 60, 503 por secretos faltantes en Vercel).
El panel dice "reciente" sobre un flujo que jamás funcionó.

### 1.4 · "Cambios de configuración detectados" no muestra ningún cambio
`src/components/Sistema.tsx:1093`
```tsx
{ch.tipo_cambio || 'Ajuste de configuración'} · {ch.campo}: {ch.valor_anterior} → {ch.valor_nuevo}
```
`v_cambios_detectados` devuelve `account`, `entity_type`, `entity_name`,
`detectado_entre`, `detectado_hasta`, `campos_cambiados`. De los siete campos
que lee la UI **solo `account` existe**.

**Síntoma:** cada fila sale `Reciente  BHI` seguido de `Ajuste de configuración
· :  → `. El dato real vive en `campos_cambiados` (jsonb) y no se lee nunca.

### 1.5 · "Tamaño y crecimiento" está cableado a la vista equivocada
`src/components/Sistema.tsx:129, 655`. El fetch va a `/api/salud-sistema` →
`server.ts:4448` → `v_salud_sistema`, que devuelve `area, prueba, cuenta,
estado, detalle` — el UNION ALL de las verificaciones de salud, otro dominio.
La UI lee `t.tabla`, `t.filas`, `t.tamano`, `t.filas_por_dia`,
`t.filas_en_un_ano`; los dos últimos no existen en **ninguna** vista del repo.

**Síntoma:** `Number(t.filas).toLocaleString('es-CL')` sobre undefined →
**la columna Filas renderiza `NaN`** en cada fila.

**Arreglo:** o se apunta a la vista correcta (buscar cuál tiene tamaños de
tabla) o se saca el panel. `fmtNum` de `ui.tsx` ya devuelve `—` para ausente:
esta línea lo esquiva llamando a `Number()` primero.

### 1.6 · El botón "Resuelta" no resuelve nada, en dos pantallas
`server.ts:2993` consulta `v_alertas_agrupadas`, que devuelve
`id_representante` e `ids` — **no `id`**, ni `origen`, ni `accion`.
`src/components/Sistema.tsx:989` y `src/components/Bandeja.tsx` hacen
`accionAlerta(a.id, 'resolver')` → `POST /api/alertas/undefined/resolver` →
`.eq('id','undefined')` contra un `bigint` → 500. **Ninguno de los dos call
sites chequea `res.ok`.**

**Síntoma:** Andrés aprieta "Resuelta", la lista parpadea, la alerta sigue ahí,
nada avisa. "Silenciar 7d" pide el motivo por `prompt()`, lo tipea, y se
descarta.

**El endpoint correcto ya existe y no lo llama nadie:** `server.ts:3525`,
`/api/alertas/grupo/resolver`.

**Colateral:** `a.origen` y `a.accion` no existen, así que la línea **"Qué
hacer:"** no se renderiza nunca — en un panel cuya descripción dice *"Una alerta
existe solo si hay algo concreto que hacer"*.

### 1.7 · La actividad de los agentes, muda
`server.ts:3805` sin `?todas` consulta `v_novedades_agrupadas`, que devuelve
**`cuenta`** (no `account`) y no tiene `id` ni `ref_tipo`.

- `Bandeja.tsx:84` filtra por `n.account || ''` → **al elegir cualquier cuenta
  la sección se vacía entera**.
- `Bandeja.tsx:87-88` no matchea ninguna rama de `ref_tipo` → el clic no navega,
  el POST viaja con `undefined`, y **la novedad nunca se marca leída**.
- `Accionables.tsx:36` filtra por `ref_tipo === 'accionable'` → el punto azul
  "un agente lo tocó y no lo viste" es código muerto.

### 1.8 · El aviso de madurez borrado por un `|| 0`
`src/components/Briefs.tsx:66`
```tsx
const provisionalDays = selectedBrief?.provisional_days || 0;
```
El servidor emite **`dias_provisionales`** (`server.ts:980`). `provisional_days`
aparece una sola vez en todo el repo: esa línea.

**Síntoma:** el badge *"N días provisionales (atribución pendiente)"* **no
aparece nunca**. Es el bug del panel Integridad aplicado justo al aviso de que
las conversiones todavía no maduraron.

### 1.9 · La comparación contra el período anterior está apagada desde siempre
`server.ts:2790`
```js
const { data: anteriorCount } = await supabase...select('date', { count: 'exact', head: true })
```
Con `head: true`, supabase-js devuelve el número en **`count`**; `data` es
`null`. El propio archivo lo hace bien 130 líneas antes (`server.ts:2660`:
`const { count: nDias } = ...`).

**Síntoma:** `server.ts:2799` → `periodo_anterior_completo` es **siempre false**
→ `reporte-pdf.tsx:92` deja `deltas` vacío. El renglón *"Inversión +12,3% |
Conversiones −4,1% vs período anterior"* no aparece en ningún reporte, nunca.
Falla del lado seguro, pero la comparación que el cliente más mira está muerta y
nada lo dice.

### 1.10 · "Guardar Trazabilidad" borra datos en Notion
`useAppStore.ts` puebla `actionables` desde `/api/data`, que **no incluye**
`naturaleza`, `que_lo_confirmaria`, `causa_raiz`, `origen`, `vence`, `brief_id`.
El endpoint que sí las devuelve (`server.ts:993-1023`) no lo llama nadie en
`src/`. `ActionableDrawerContent.tsx:279-285` los manda **siempre** y
`server.ts:1362-1378` escribe incondicionalmente.

**Síntoma:** apretar "Guardar Trazabilidad" para anotar un resultado observado
**vacía `Que lo confirmaria` y `Causa raiz` en Notion y reescribe `Naturaleza` a
`'Dato'`**.

**Y `'Dato'` es el peor valor posible:** `v_tasa_acierto` buckea por
`'Observacion'` y por `IN ('Inferencia','Hipotesis')`. **`'Dato'` no cae en
ninguno: el accionable desaparece de las dos tasas de acierto, sin error y sin
fila.**

### 1.11 · `a.detected` / `a.weeks_pending`
`server.ts:1036-1037` usa esos dos nombres cuando el objeto define `detectado`
(:1007) y `semanas_pendiente` (:1019). Cada corrida de
`/api/notion/actionables` **pisa con NULL** las dos columnas que
`refrescarEspejo` había llenado bien. Hoy no corrompe porque no se encontró
ningún caller en `src/`, pero podría llamarlo un agente de Cowork.

### 1.12 · Advertencias estructuralmente inalcanzables
`src/components/Datos.tsx:1215, 1227` — la Advertencia de Frescura y la de
Pérdida de Integridad leen `dataHealth` / `dataIntegrity`, que `get_view_data`
no emite. Están escritas y nunca se pueden mostrar.

Ídem `Datos.tsx:1292`: el aviso `totals?.limited` no lo emite ningún endpoint
(`grep -n "limited" server.ts` → nada). Ver 2.4.

---

## 2 · Ceros fabricados

### 2.1 · La reconciliación con la API escribe CERO donde va NULL
`server.ts:4226, 4273-4275`
```js
cost_per_conv: v.conv > 0 ? +(v.cost / v.conv).toFixed(2) : 0,
conv_rate:     clicks > 0 ? +((cv / clicks) * 100).toFixed(2) : 0,
roas:          cost > 0 ? +(val / cost).toFixed(2) : 0,
```
El CPA canónico devuelve NULL con cero conversiones **a propósito**, y el SQL
del propio repo lo hace bien (`get_reporte_datos`: `round(a.cost /
nullif(a.conversions, 0), 2)`). Este cron **escribe** y lo deshace todas las
mañanas: `cost_per_conv = 0` se lee "conversiones gratis".

**Arreglo:** `null` en los tres, no `0`.

### 2.2 · Eliminar una campaña reescribe su pasado a cero
`server.ts:4258` trae solo campañas vivas (`AND campaign.status IN
('ENABLED','PAUSED')`), y `:4265-4269` interpreta lo que no vino como cero:
```js
// la API ya no reporta el par: sus métricas reales hoy son cero
await supabase.from('conversion_actions').update({ conversions: 0, all_conversions: 0, conv_value: 0, all_conv_value: 0 })
```
Una campaña **REMOVED** queda fuera del `IN`, así que ninguna fila suya aparece
y se le escriben ceros a cuatro semanas de historia.

**La otra mitad del mismo cron hace lo contrario y lo explica**
(`server.ts:4178`): `if (!v) continue;   // la campaña no vino en la API: sin
más señal, no se toca`. Dos criterios opuestos para la misma ausencia, en el
mismo handler.

### 2.3 · El drawer del día pinta un hueco como cero
`src/components/Semana.tsx:104` construye a propósito las filas ausentes con
`sin_datos: true` y todo en `null`. Y `:816, 820, 828` las pinta:
```tsx
{fmtMoneda(selectedDay.gasto ?? selectedDay.cost ?? 0, M)}
{selectedDay.conversiones ?? selectedDay.conversions ?? 0}
```
**Síntoma:** clic en un día que la extracción no trajo → el drawer afirma
*"Gasto $0 · Conversiones 0 · Clics 0"* en negrita. El flag `sin_datos` existe y
el drawer lo ignora. El CPA de la misma grilla sí respeta la ausencia con `'—'`:
**las dos mitades del mismo cuadro se contradicen.**

### 2.4 · Los KPIs de "Por día" dicen CPA $0,00 y suman solo la página
`server.ts:813` emite `cost_per_conv`; `Datos.tsx:956` lee `totals.cpa || 0`.
`formatValue` ya devuelve `'-'` para null y el `|| 0` lo intercepta. Además
`Math.round` borra los centavos.

Y `server.ts:801-806` suma sobre `rows` —la página paginada— mientras `total:
count` es exacto sobre todo el filtro: **el pie dice "3.482 filas" y el mosaico
suma 100.**

### 2.5 · Las barras de impression share renormalizan los nulls a 100%
`src/components/Clientes.tsx:565-567` → `{ valor: Number(c.lost_is_budget) || 0
}`, y `graficos-pulse.tsx:26-33` normaliza el ancho contra la suma de las
partes. `lost_is_budget` / `lost_is_rank` son `numeric` **nullable**: Google no
reporta IS con poco volumen.

**Síntoma:** una campaña con `impr_share=62` y los dos perdidos en null dibuja
una barra **100% azul "ganado"** bajo el título *"De cada 100 impresiones
posibles, cuántas ganó cada campaña"*, con el tooltip diciendo *"perdido por
ranking null%"*.

### 2.6 · Veredictos de causa fabricados desde un hueco
`src/components/Clientes.tsx:539`
```tsx
Perdido por {headroom.lost_is_rank_pct > headroom.lost_is_budget_pct ? 'ranking' : 'presupuesto'} … {Math.max(headroom.lost_is_budget_pct || 0, headroom.lost_is_rank_pct || 0)}%
```
Con ambos null: `null > null` es `false` → se planta en **"presupuesto"** sin
evidencia, y `Math.max(0,0)` imprime **0%**. Los dos vecinos de la misma grilla
(`:537-538`) sí usan `?? '—'`.

**El mismo patrón en SQL:** `remote_schema.sql:1762`
```sql
case when sum(coalesce(lost_is_budget,0)) > sum(coalesce(lost_is_rank,0)) then 'presupuesto' else 'ranking' end
```
Con cero filas cae al ELSE → `'ranking'`. Nunca devuelve NULL, así que la rama
`'sin dato en la ventana'` de la UI (`Datos.tsx:958`) es inalcanzable.

**Síntoma:** una tabla vacía muestra *"Restricción principal: ranking · más
plata NO trae volumen"* justo encima del cartel *"No es cero: es que el filtro
no encontró nada."*

### 2.7 · Otros `|| 0` sobre porcentajes nulos
- `Clientes.tsx:745` — `{v ?? 0}%` sobre porcentajes que `v_por_que_limitada`
  devuelve NULL por `NULLIF(sum(cost), 0)`. *"0% del gasto bajo el promedio"* se
  lee como "no hay problema".
- `Semana.tsx:401` — `Number(prediccionesSemana[0].probabilidad || 0.8)`: si la
  predicción no declaró probabilidad, la pantalla le atribuye al agente un
  **"80%" que nunca dijo**.
- `Bandeja.tsx:381` — "Cambios con resultado a 14 días" usa
  `{ciclo.impactos?.length || 0}`: está topeado en 10 por el servidor, incluye
  filas `PENDIENTE`, y el `|| 0` convierte un fallo en "0 cambios con resultado".

### 2.8 · El presupuesto del Burn Rate es casi siempre inventado
`src/components/Datos.tsx:181`
```js
const presupuestoDe = (acc) => cuentasApi.find(c => c.account === acc)?.presupuesto_diario ?? (acc === 'KAREDO' ? 135 : 20000);
```
Dos caminos al fallback: el `useEffect` que lo llama (`:282`) depende solo de
`[selectedClient]` y captura el `cuentasApi` del montaje, que es `[]`; y el
camino de respaldo de `cuentasActivas()` (`server.ts:63-64`) selecciona
`account, nombre_cliente, moneda, cid, perfil_analisis` — **sin
`presupuesto_diario`**.

**Síntoma:** "Presupuesto Límite" usa 20.000 × días para todas las cuentas salvo
KAREDO. En FRESH_MONKEE eso son **USD 600.000/mes**, y el semáforo over/under se
decide contra ese número.

---

## 3 · Ventanas que no son las que se declaran

### 3.1 · El KPI de Semana suma menos días de los que dice
`src/components/Semana.tsx:142-145`. El comentario dice literalmente *"La
ventana que se declara es la que se suma — la nota lo dice"* y el código hace:
```ts
const en = displayedDaily.filter((d) => !d.sin_datos);
const dias = Math.round((hasta - desde) / 864e5) + 1;   // solo calendario
```
`dias` sale del calendario; las sumas corren sobre `en`. Con 10 de 14 días en la
tabla, la pantalla dice *"Gasto US$X · 14 días"* habiendo sumado 10.
**`en.length` existe y no se usa.**

### 3.2 · `v_headroom` divide 13 días por 14
`remote_schema.sql:9580, 9660` — el CTE `ultimos14` filtra `date >= CD-14 AND
date < CD-1` = **13 días**, y el SELECT divide por **14**. Subestima 7,1%. Y
`conv_14d` **no filtra madurez**, a diferencia de `dias_dentro_cpa`, que sí.
Sale a pantalla en `Clientes.tsx:537` como *"Del objetivo: X%"*.

### 3.3 · `v_decision_estructural` pide 28 días a una capa de 17
Pide `conv_28d` a `v_serie_diaria` y después hace `testeabilidad(conv_28d / 4.0,
4)`. `Clientes.tsx:385` dice honestamente *"42 conv en 13 días consolidados"* y
`:399`, renderizado verbatim desde la vista, dice *"con 42 conv en 28d… Mínimo
100/mes"*. **La misma tarjeta se contradice y el umbral es inalcanzable por
construcción.**

### 3.4 · El modelo razona sobre 14 días creyendo que son 30
`remote_schema.sql:1632` — la `serie` del reporte es siempre `p_hasta - 13 ..
p_hasta`, sin importar el período pedido. Se le manda al modelo como `SERIE:`
con el prompt diciendo `período ${desde} a ${hasta}`.

### 3.5 · `.limit()` de filas presentado como días
- `asistente.ts:133, 138` — `.limit(14)` de **filas**, no de días, presentado
  como "últimos 7 y 14 días". Y el `select` trae `madurez` pero el objeto que va
  al modelo no la incluye.
- `server.ts:4451-4457` — `costo_ultimos_30d_usd` se calcula sobre `.limit(days
  * 3)` = 21 filas. Sistemáticamente subestimado. Ese `* 3` asume 3 cuentas y
  **hay 4** — el mismo bug que `useCuentas.ts:4-7` documenta como la causa de
  que Fresh Monkee desapareciera de varias pantallas.
- `server.ts:3553` — se pueden pedir 26 semanas a una capa que retiene 13.

### 3.6 · Pausar una campaña borra su gasto histórico del reporte al cliente
Tres piezas verificadas por separado que se encadenan:

1. `scripts_MCC/northsignal_diario.js:269, 285` — el GAQL trae
   `campaign.status`, que **no está segmentado por fecha**: es el estado de hoy,
   estampado en la fila de cada día.
2. `LOOKBACK_DAYS: 14` con upsert: cada corrida reescribe 14 días.
3. `remote_schema.sql:7742` — `v_serie_diaria ... WHERE ("status" = 'ENABLED')`.

El repo ya documenta el mecanismo (ticket 29, `northsignal_diario.js:206-212`:
*"Google devuelve los dias historicos con el estado ACTUAL"*). Se arregló la
duplicación; la consecuencia para las vistas que filtran `ENABLED` quedó
abierta.

**Y `v_serie_diaria` es la base de `get_reporte_datos`**, o sea de la Inversión,
Conversiones, CPA, CTR y Clics **del PDF que se le manda al cliente**. Mientras
tanto `/api/pacing` (`server.ts:3648`) lee `campaign_daily` sin filtro de
status: los dos números del mismo mes no coinciden por construcción.

> **Ojo con el arreglo.** No alcanza con sacar el `WHERE status = 'ENABLED'`:
> hay que decidir qué significa el status en una fila diaria. Lo correcto es que
> la capa diaria no filtre por un estado que corresponde a hoy. Verificá el
> impacto antes: `select count(*), sum(cost) from campaign_daily where status <> 'ENABLED';`

---

## 4 · Guardarraíles y métricas muertas

### 4.1 · "Este tipo de cambio suele empeorar" no puede dispararse nunca
`remote_schema.sql:7885, 7890` — `v_acierto_por_tipo` cuenta con `veredicto ~*
'^MEJOR'` y `~* '^PEOR'`. Su fuente `v_impacto_accionables` **solo emite**
(`:7825-7847`): `'PENDIENTE: …'`, `'SIN METRICA: …'`, `'FUNCIONO: …'`,
`'NEUTRO: …'`, `'EMPEORO: …'`. **Ninguno empieza con `MEJOR` ni con `PEOR`.**

Cadena completa: `mejoraron` y `empeoraron` son **siempre 0**; con numerador 0
ni `>= 0.66` ni `>= 0.5` se dan, así que `'funciona en esta cuenta'` y `'suele
empeorar: revisar antes de repetir'` son **inalcanzables**; todo cae en `'pocas
para juzgar'` o `'mixto'`. `Sistema.tsx:732` muestra `{t.mejoraron}/{t.n}
mejoraron` → **"0/N mejoraron"** bajo el título *"Qué tipo de cambio funciona en
cada cuenta"*.

**El literal correcto está a 200 líneas:** `remote_schema.sql:11688` usa
`FILTER (WHERE veredicto ~~ 'EMPEORO%')`.

### 4.2 · "NEUTRO: menos de 10% de cambio" sobre un cálculo imposible, escrito en Notion
`remote_schema.sql:7846`
```sql
WHEN abs(COALESCE(CASE … END, 0)) < 0.1 THEN 'NEUTRO: menos de 10% de cambio'
```
Con `conv_antes = 0` los `NULLIF` hacen la expresión NULL, el `COALESCE` la
vuelve 0, y `0 < 0.1` da NEUTRO.

**Y se publica:** `server.ts:2433` arma el texto y el filtro solo excluye
`PENDIENTE%`. En "Resultado observado" del accionable queda escrito, textual:
`NEUTRO: menos de 10% de cambio. cpa: null → null (?%)`. El veredicto afirma
"menos de 10%" en la misma oración donde el número es `?`. Eso alimenta
`v_tasa_acierto`, la métrica con la que el sistema se califica a sí mismo.

### 4.3 · `no_aplicaba` tratado como falla
`v_accionables_invalidos` (`remote_schema.sql:7649-7690`) **no filtra por
`clasificacion`**: emite también `'ok'` (*"Listo para ejecutar."*) y
`'sin_json_correcto'` (*"CORRECTO: no lleva Accion JSON porque su verbo no es
ejecutable por script. **No es un error y no hay nada que arreglar.**"*).

`server.ts:3723` hace `.select('*').limit(30)` sin filtro y `Sistema.tsx:684-698`
los lista bajo **"Accionables que no cumplen el estándar"**, mostrando
`a.accion_error` — que para esas filas es NULL → celda vacía. La columna
`lectura`, la única que explica que no es un error, no se lee nunca.

Es exactamente lo que `CLAUDE.md` advierte: *"Tratarla como falla es cómo mueren
las alertas."*

### 4.4 · Un hueco que habilita una ejecución que el pre-vuelo bloqueó
`src/components/Bandeja.tsx:64`
```tsx
const esUnClic = (a) => !esPregunta(a) && !bloqueados[a.id] && …
```
`/api/relaciones-abiertas` (`server.ts:3367-3372`) descarta el `error` y devuelve
`{}` con status 200. Si falla, **todo accionable con conflicto abierto pasa a
"De un clic · el ejecutor las aplica al aprobar"** y el aviso `conflicto
abierto` desaparece.

Es el caso más caro de esta familia: **el hueco no baja un número, habilita una
acción.**

### 4.5 · El KPI "Datos" es verde por defecto por tres caminos
`src/components/Bandeja.tsx:197` — solo el literal `false` advierte.
(1) `briefing` es `null` mientras carga o si falla; (2) `server.ts` descarta el
error del RPC → 200 con cuerpo `null`; (3) `get_briefing`
(`remote_schema.sql:1280`) usa `bool_and(...)` sobre `v_data_health`, que
**devuelve NULL sobre cero filas**. No ser medido cuenta como estar bien.

> Parte de esto se arregló el 14/9 con el estado de tres valores. **Verificá el
> estado actual antes de tocar** y revisá el camino (3), que es del lado SQL.

### 4.6 · El titular de Sistema afirma salud sin haber preguntado
`src/components/Sistema.tsx:329-350`. Si `/api/latidos` falla → `latidos = []` →
`callados.length === 0` → el héroe pinta verde **"El sistema está sano."** sin
haber sabido si alguna tarea dejó de correr. El comentario tres líneas arriba
dice: *"una tarea que dejó de correr no grita, y por eso es el estado más caro
de no ver."* Si falla `/api/salud` → ámbar *"Hay cosas para mirar, nada roto"* —
afirma "nada roto" sin haber consultado.

**Relacionado:** `/api/health/system` (`server.ts:234-241`) destructura el
`error` de **1 de 7** consultas. Mismo descarte en `/api/briefing`,
`/api/ciclo`, `/api/relaciones-abiertas`, `/api/evidencia-termino`.

### 4.7 · Toda anotación del drawer se pierde en silencio
`src/components/Semana.tsx:224` manda `{ client, date, text }`; `server.ts`
espera `{ account, fecha, titulo, tipo, detalle }` y el DDL tiene `account`,
`fecha`, `titulo` **NOT NULL**. Los tres llegan `undefined` → 500 → el `if
(d.success)` nunca corre. El botón vuelve a "Guardar anotación", sin check y sin
error.

**Agravante:** `Semana.tsx:832` lee `selectedDay.annotation` y `v_serie_diaria`
no tiene esa columna — aunque el POST funcionara, la anotación jamás se vería.

### 4.8 · Los botones de "segunda opinión" están muertos
`server.ts:1073-1074` exige `req.body.action` y responde 400 sin él.
`Accionables.tsx:114` y `ActionableDrawerContent.tsx:242-247` hacen el POST
**sin body**; el primero no mira `res.ok`, el segundo se traga el 400. El ícono
gira, vuelve, no pasa nada. **`useAppStore.analyzeAction` sí manda el body
correcto — la llamada buena existe y nadie la usa.**

### 4.9 · "Se aplica" cuando encoló una simulación
`server.ts:3296-3306` degrada (`const modoReal = afuera.permitido ? modo :
'simular'`) y devuelve el modo real. La UI hace `setEjecutado(modo)` con el modo
**pedido**. Fuera de producción la pantalla dice *"Aprobado. El script lo aplica
en Google Ads dentro de la próxima hora"* y no se aplica nada. Mismo defecto en
el rastro de auditoría: `server.ts:3255, 3310` escriben en Notion `(real)` con
el modo pedido.

### 4.10 · Dos endpoints caen a la cuenta `'360'` cableada
`server.ts:284` y `:372` → `const client = (req.query.client as string) ||
'360';`. `Semana.tsx:33` devuelve `''` mientras `/api/cuentas` carga, por diseño
explícito de `useCuentas.ts:92`.

**Síntoma:** en el primer render, y de forma permanente si `/api/cuentas` falla,
el gráfico de tendencia, los 5 KPIs y "Búsquedas nuevas" muestran **datos de 360
bajo el nombre de otra cuenta en el header**. Todos los demás endpoints
devuelven 400 ante cliente vacío: alinealos.

### 4.11 · `/api/daily/overview` pide los 28 días más viejos
`server.ts:293-298` → `.order('date', { ascending: true }).limit(28)`.
`mantenimiento_semanal()` declara que la capa diaria *"NUNCA se borra (archivo
permanente)"*. En cuanto `campaign_daily` pase de 28 fechas distintas (hoy 22,
crece 1/día) esto devuelve los 28 primeros días históricos y **ninguno** del
rango elegido.

**Falta `{ ascending: false }`.** Es una bomba de tiempo con fecha aproximada:
seis días.

### 4.12 · Un `current_date - 30` que quedó
La migración del 14/9 arregló `I3`, pero `verificar_invariantes` todavía tiene
un `current_date - 30` en el bloque **I0** (el chequeo de impresiones del
núcleo). Mismo problema de ventana: se le piden 30 días a `keywords_daily`.
Menos grave que I3 porque ahí la ausencia hace `continue` (no bloquea una pausa
del núcleo, que es el lado conservador), pero conviene alinearlo.

---

## 5 · Enums y vocabularios inventados

- **`Accionables.tsx:164`** — el filtro ofrece `'Validado'`, que **no existe**
  en el enum real (`notionSchema.ts:23-29`: `Sin revisar | Analizado por Gemini
  | Coinciden | En disputa | Resuelto`). Devuelve siempre cero filas, y los tres
  valores que el analizador sí escribe no son alcanzables desde el filtro.
  `Clientes.tsx:230` ya tiene el comentario: *"'Validado': conocimiento
  fabricado disfrazado de medido, el peor bug posible"*.
- **`server.ts:578, 998`** — `props.Prioridad?.select?.name || 'Medium'`
  (inglés) contra `PESO_PRIORIDAD = { Urgente, Alta, Media, Baja }`. Un
  accionable sin prioridad queda ordenado **por debajo de Baja**.
- **Tres vocabularios de "naturaleza" conviviendo:** `v_tasa_acierto` y
  `humano.ts` usan `Observacion | Inferencia | Hipotesis`; el select del drawer
  ofrece `Dato | Inferencia | Hipotesis`; el filtro de la lista usa el primero.
  Ver 1.10, que es la consecuencia.
- **`Sistema.tsx:603`** — `reconciliaciones_api.veredicto` tiene CHECK
  `('limpio','corregido','excedio_tope','sin_base','error')`. La UI solo
  distingue los dos primeros: `excedio_tope` (*"divergencia masiva, se freno"*) y
  `error` caen en el mismo azul, y `corregido` se pinta **más brillante** que
  ambos. Jerarquía invertida.

---

## 6 · Promedios de promedios

`remote_schema.sql:11746-11749` (`v_tendencia_semanal`) y `:7737-7738`
(`v_serie_diaria`):
```sql
round(avg(ctr), 2) AS ctr_promedio,  round(avg(impr_share), 2) AS impr_share_promedio,
round(avg(lost_is_budget), 2) AS perdido_presupuesto,  round(avg(lost_is_rank), 2) AS perdido_ranking,
```
Medias sin ponderar entre campañas, **teniendo `sum(clicks)` y
`sum(impressions)` en el mismo SELECT**. Una campaña de 20 impresiones pesa
igual que una de 200.000. `Clientes.tsx:578-586` las fuerza a sumar 100.

**El contraste está en el propio esquema:** `v_leading_indicators_diarios` y
`get_reporte_datos:1621` ponderan bien (`sum(impr_share * impressions) /
nullif(sum(impressions), 0)`), y `src/lib/glosario.ts:7` dice *"Se recalcula
sobre sumas, nunca se promedia."*

**Cadena completa:** `v_serie_diaria.perdido_presupuesto = avg(...)` →
`v_headroom.lost_is_budget_pct = avg(perdido_presupuesto)` = promedio de
promedios de promedios, y esa cifra es la de 2.6.

Lo mismo en `:7779, 7791` — `ctr_antes` / `ctr_despues` con `avg()` mientras
gasto y conversiones usan `sum()`, decidiendo el veredicto que se escribe en
Notion.

---

## 7 · El reporte al cliente

### 7.1 · El mensaje lee claves que no existen
`server.ts:2853`
```js
`Inversión ${m.gasto?.actual ?? '-'} · Conversiones ${m.conversiones?.actual ?? '-'} · CPA ${m.cpa?.actual ?? '-'}`
```
`get_reporte_datos` (`remote_schema.sql:1624-1631`) construye **`cost`,
`conversions`, `cpa`, `ctr`, `clicks`, `impr_share`**.

**Síntoma:** al cliente le llega literal `Inversión - · Conversiones - · CPA
23100`. Las dos primeras siempre en guion; el CPA sí resuelve y sale **crudo,
sin símbolo de moneda** — el mismo `23100` significa pesos chilenos en BHI y
dólares en Fresh Monkee. Es el único número del mensaje y no dice de qué.

### 7.2 · La columna "Impr" del PDF está muerta
`reporte-pdf.tsx:90` — `['cost','clicks','impressions','conversions','cpa','ctr']`:
`get_reporte_datos` produce `impr_share`, nunca `impressions`. La columna sale
vacía y el `impr_share` (que sí está bien ponderado) no se muestra nunca.

La nota al pie dice *"Solo se muestran campañas y grupos con inversión"* cuando
el SQL aplica además `limit 12`.

### 7.3 · KAREDO no puede recibir su reporte en alemán
`server.ts:2626, 2894` y `reporte-pdf.tsx:64` — el idioma es binario
`'es' | 'en'`. KAREDO es mercado alemán con `locale de-DE` y **no hay camino a
alemán**. Además `reporte-pdf.tsx:81` fija las fechas en `es-CL` ignorando
`r.locale`, aunque los importes sí lo usan.

> Verificá primero qué dice `cuentas.idioma_reporte` para KAREDO. Al 13/9 decía
> `en`, que puede ser deliberado (anuncios en alemán, reporte al cliente en
> inglés). Si es deliberado, esto no es un bug: es una limitación a documentar.

---

## 8 · Menores, pero reales

- `Datos.tsx:1337` — *"los 14 días de la capa diaria"*; `CLAUDE.md` dice 17.
  Ver la tabla de retención en §0: ninguna de las cifras del repo expresa lo que
  realmente pasa.
- `Bandeja.tsx:80` — el KPI total omite `preguntas` y `aMano`. Con 5 accionables
  "a mano" y nada más, la pantalla muestra **`0` · "Esperan tu criterio"** con el
  check verde, y los 5 ítems no se dibujan.
- `asistente.ts:146` — `.order('prioridad', { ascending: true }).limit(30)`:
  alfabéticamente **Urgente queda último**. Con más de 30 abiertos, los urgentes
  son los primeros en caerse de la respuesta a "¿qué hay pendiente?".
- `asistente.ts:202` — `consultar_datos` hace `.limit(30)` **sin `ORDER BY`**:
  sobre una serie temporal el modelo recibe una muestra arbitraria y la reporta
  como "los datos".
- `server.ts:4212` — `cta.currency` es **siempre** `undefined` (`cuentasActivas`
  selecciona `moneda`), así que la reconciliación inserta `currency: null`
  teniendo la moneda real a un campo de distancia.
- `Datos.tsx:192` — `isoDaysAgo` usa `toISOString()`: después de las 21:00 de
  Buenos Aires, "Últimos 7 días" pierde el día más viejo e **incluye hoy**. El
  mismo archivo ya evitó ese riesgo en `corteMadurando` con un comentario
  explícito; la corrección no llegó acá.
- `DatosCadena.tsx:47, 173` — conversiones y ROAS redondeados a entero: un ROAS
  de 2,4 sale **"2x"** y uno de 0,4 sale **"0x"**. Y `:89` ordena
  `Number(null) === 0`, así que las filas con CPA NULL **encabezan el ranking de
  "más barato"**.
- `Clientes.tsx:166, 170` — `filter(l => Number(l.cpa_ajustado) > 0)` descarta
  los locales sin dato junto con los de gasto cero (el comentario solo justifica
  el cero), y el grupo se rotula con el largo ya filtrado: un grupo de 8 con 3
  sin dato se muestra como "5 locales". La "mediana" con n par toma el valor
  superior del par central, y es el umbral del `× 1.5` que decide quién se salió
  de la manada.
- `CLAUDE.md:159` dice que la reconciliación por API queda en `reconciliaciones`;
  el código escribe en `reconciliaciones_api`.

---

## 9 · Presupuestos cableados que entran al prompt de los agentes

`src/server/domain/clientRules.ts` entra al system prompt del pulso por
`server.ts:4371` (`cta?.reglas_dominio || getClientContext(cuenta) || ''`) y
aterriza en `pulso.ts` bajo `REGLAS DE LA CUENTA (no negociables):`.

Cableado: `:3` `dailyBudget: 135` · `:24` `dailyBudget: 20000` · `:46`
`dailyBudget: 21000`. `cuentas.presupuesto_diario` existe y se lee en
`server.ts:57`. El `||` (no `??`) hace que un `reglas_dominio` vacío también
caiga al archivo.

**Lo peor: `CLIENT_RULES` tiene solo `KAREDO`, `BHI` y `'360'`.**
`FRESH_MONKEE` no está. `getClientContext('FRESH_MONKEE')` devuelve *"Sin
contexto específico de negocio."* (`:66`). Si su `reglas_dominio` está vacío, el
pulso de la cuenta de 46 locales corre con las reglas no negociables **en
blanco** — incluida la única que no se puede violar ahí, que el presupuesto de
un local no se mueve a otro.

**Verificá primero:**
```sql
select account, length(reglas_dominio::text) from cuentas where activa;
```
Si `reglas_dominio` está poblado en las cuatro, esto no se dispara hoy — pero el
respaldo sigue cableado y desactualizado.

**Y hay dos corpus de prompts en el repo** (`prompts/` y `docs/prompts/out/`)
con cifras contradictorias, sin que nada declare cuál carga Cowork. Los de
`docs/prompts/out/` son los del 14/9 y están verificados contra la base; los de
`prompts/` tienen números viejos (por ejemplo *"Con 71 locales"* cuando son 46).
**Decidí cuál es la fuente y borrá el otro.**

---

## 9.bis · `PropertiesService` en Google Ads Scripts: verificar antes de creerle a nadie

`scripts_MCC/northsignal_semanal_v11.js:2017` usa
`PropertiesService.getScriptProperties()` dentro de `getBriefSpreadsheet`.

**La evidencia pública dice que esa API no existe en Google Ads Scripts:**
respuesta del equipo de Google Ads Scripts en el foro oficial (3/9/2019) —
*"PropertiesService is currently not supported in Google Ads Scripts"*—, la URL
de referencia da 404, y la página oficial de *External Data Integration* lista
Spreadsheet, Drive, Charts, Mail, UrlFetch y JDBC, sin Properties.

**Si eso es cierto, `getBriefSpreadsheet` viene fallando en silencio**, porque
la llamada está adentro de un `try/catch` que degrada devolviendo `'ERROR
abriendo Sheets: ' + e.message`. Un `ReferenceError: PropertiesService is not
defined` se lee ahí como un problema de Sheets y la corrida sigue.

**La prueba son dos minutos**, en cualquiera de los cinco scripts dentro de
Google Ads:
```js
function main(){ Logger.log(typeof PropertiesService); }
```
Si loguea `undefined`, hay dos consecuencias: el brief de Sheets nunca funcionó
por ese camino, y **cualquier plan de mover las claves a propiedades del script
hay que rehacerlo** contra un Sheet, Drive o JDBC.

> Contexto de por qué esto está acá: el 14/9 se preparó un cambio que movía las
> claves de los cinco scripts a `PropertiesService`. **Andrés decidió no tocar
> los scripts y el cambio se descartó.** Después, el revisor adversarial
> encontró esta evidencia y probó además, corriendo los archivos en un `vm`, que
> el arranque tenía un deadlock: `var CONFIG = {...propiedadObligatoria(...)}`
> se evalúa en el scope global, antes de cualquier función, así que la función
> que cargaba las claves era inalcanzable y los cinco scripts abortaban en
> instalación limpia. Si se hubiera aplicado, era un outage total del pipeline.
> **La decisión de no tocarlos resultó correcta por razones que no se conocían
> al tomarla.**

---

## 10 · Sospechas: verificá antes de tocar

1. **`v_mercado_vs_nosotros`, `v_presion_competitiva` y `latidos_estado` no
   tienen DDL en ninguna migración del repo.** Aparecen solo en `server.ts` y en
   el bundle. Si la base viva divergió de los archivos, confirmá 1.1 a 1.5 con
   `select * from <vista> limit 1` antes de tocar código.
2. **`/api/presion-competitiva` hace `res.status(500)`** cuando la vista no
   existe, mientras `/api/mercado` degrada bien con un aviso. La tarjeta
   desaparece sin decir nada. La asimetría es un defecto real.
3. **`max-rows` de PostgREST:** `/api/pacing` y `/api/metrics/weeks` no ponen
   `.limit()`. Con el default de 1000, Fresh Monkee truncaría sin aviso.
4. **`v_terminos_nuevos` y el arranque en frío:** "primera aparición" es
   `min(date)` sobre `search_terms_daily`. Si la tabla arranca el 22/8, todo
   término con esa fecha mínima figura como nuevo. A 23 días probablemente ya se
   lavó, pero conviene mirarlo.
5. **Si `verificar_cifras` valida la `unidad`** o solo el valor. Si solo el
   valor, la plantilla de `cifras_publicadas` con `'EUR'` literal queda
   certificada como verificada en cuentas que operan en CLP.
6. **Si `/api/notion/actionables` tiene algún caller.** No lo hay en `src/`;
   podría llamarlo un agente de Cowork. De eso depende la gravedad de 1.11.
7. **La magnitud de 3.6** depende de con qué frecuencia se pausan campañas. El
   mecanismo está probado; cuánto gasto histórico está hoy invisible sale de
   `select count(*), sum(cost) from campaign_daily where status <> 'ENABLED';`

---

## 11 · Orden sugerido

1. **`@types/react`** (§0). Todo lo demás se encuentra mejor con el typecheck vivo.
2. **§1 entero** — ocho paneles que afirman cosas que nadie midió. Es mecánico:
   traer la forma real con `select * from <vista> limit 1` y alinear.
3. **4.4** — el único de los que quedan que **habilita una acción** desde un hueco.
4. **§2** — los ceros fabricados, empezando por 2.1 y 2.2 que **escriben** en la base.
5. **4.11** — la bomba de tiempo de seis días.
6. **§7** — lo que ve el cliente.
7. **§3 y §6** — ventanas y promedios: son los que hacen que un número sea
   plausible y equivocado, que es el modo de falla declarado del sistema.
8. El resto.

**Al terminar cada bloque:** `npm run verificar`, commit con el porqué, y
`registrar_cambio(...)` en Supabase.
