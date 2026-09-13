# NorthSignal

Andrés Biggs opera cuatro cuentas de Google Ads desde Buenos Aires. Este sistema analiza,
propone y ejecuta cambios **con su aprobación**. Cinco piezas: scripts en Google Ads que
extraen y ejecutan, Supabase que guarda todo y corre las tareas, agentes en Cowork que
analizan, Notion donde viven los accionables, y una app en Vercel donde Andrés decide.

**La regla que las une: nada cambia en Google Ads sin que Andrés lo decida.**

## Lo primero, en cualquier sesión

```sql
-- Supabase, proyecto djbwxgicosargfobsmqd
select get_contexto_sistema();   -- ~44 KB: última sesión, salud, las 4 cuentas y sus reglas,
                                 -- flujos, guardarraíles, lecciones y tickets abiertos
select * from v_para_actuar;     -- lo único que pide acción hoy. Si está vacía, no hay nada.
```

Se genera al momento, así que nunca queda viejo. **No lo copies a un archivo**: el día que lo
hagas empieza a envejecer, y un documento de contexto autogenerado engaña más de lo que un
vacío confunde.

Para una cuenta puntual: `select get_contexto_sistema('BHI')`.

Antes de cambiar algo, mirá `cambios_recientes` adentro de ese contexto: qué tocó cada sesión
en los últimos siete días y por qué. El riesgo de varias sesiones sobre el mismo sistema no es
que una no sepa, es que deshaga lo que otra acaba de hacer.

## Las reglas que no cambian

**Nunca adivines el nombre de una entidad.** Ni keyword, ni campaña, ni grupo. Se resuelven
contra la base. El mismo nombre de grupo existe en 21 campañas de Fresh Monkee.

**Sin `Accion JSON` válido no hay ejecución.** El servidor también la rechaza. Un cambio se
aplica desde una estructura, nunca desde un texto.

**Los cambios de riesgo medio exigen el valor anterior.** Presupuesto, objetivo de puja, CPC.
Sin él no se puede revertir.

**El radio de la acción tiene que ser el radio de la evidencia.** Un veredicto calculado sobre
un término dentro de un grupo no autoriza una acción a nivel campaña. Vale para negativas,
invariantes y guardarraíles.

**Los datos de Google son direccionales, no cerrados.** El historial tiene huecos. Las visitas
a tienda son modeladas: si no aparecen, no es cero. Los días recientes maduran: una conversión
puede tardar días en atribuirse, y Google la atribuye al día del **clic**, no al de la conversión.

**El gasto de ayer ya es definitivo; las conversiones no.**

**La ventana que decís tiene que ser la que sumaste.** Las tablas diarias tienen 17 días, las
semanales 91. Nunca escribas `current_date - N` a mano: llamá a `ventana_metrica()`.

**Todo lo interno va en castellano rioplatense.** Los reportes al cliente, en el idioma de su
ficha. El reporte no sale solo al cliente: llega a Andrés listo para reenviar.

**"No se puede saber con estos datos" es una respuesta válida y preferible a un número inventado.**

## La capa de calidad

Este sistema falla de una sola manera: **produce números verosímiles y equivocados**. No por
manipulación, sino porque una vista suma sobre una ventana que no tiene o una columna se llama
distinto de lo que contiene. Eso es *semantic drift*, y los cinco pilares clásicos de
observabilidad no lo detectan.

```sql
select * from v_relaciones_violadas;  -- si toca una cifra tuya, esa cifra es sospechosa
select * from v_metricas_reescritas;  -- vistas que piden más ventana de la que su tabla tiene
select * from v_drift_semantico;      -- nombres que mienten
```

Para calcular: `metrica_conversiones`, `metrica_gasto`, `metrica_cpa`, `ventana_metrica`. El
CPA canónico devuelve NULL con cero conversiones **a propósito**.

Ojo con el veredicto `no_aplicaba` de una relación: **no es una falla**, es la relación diciendo
que su dominio de validez no se cumple ahí. Tratarla como falla es cómo mueren las alertas.

**Un ticket de bug no cierra sin un control que atrape su regreso**, y ese control no cuenta
hasta que probó que puede fallar. Lo impide un trigger, no una convención.

## Cuando algo falla: parar, no improvisar

Si una consulta falla, devuelve vacío inesperado, o una relación está violada: **pará y decilo.**
No sigas. Un agente que no puede leer algo y sigue adelante completa el hueco con lo más
plausible, y lo plausible es exactamente el modo de falla que este sistema no detecta.

Si una vista devuelve cero filas, verificá si es vacío legítimo **antes** de llamarlo hallazgo.

## Lo que cada cuenta tiene de propio

- **KAREDO** — software B2B, mercado alemán, euros, `locale de-DE`. **Los anuncios van en
  alemán.** Sin ROAS: se juzga por CPA.
- **BHI** — seguros de salud en Chile, pesos. **Regulación CMF**: nada de copy generado
  automáticamente. Palabras prohibidas en `cuentas.reglas_dominio`.
- **360** — eventos corporativos en Chile, pesos. Los cierres llegan por CRM.
- **FRESH_MONKEE** — cadena de batidos en EE.UU., dólares, 46 locales. El presupuesto de un
  local **no se mueve a otro**. Los locales se comparan dentro de su grupo de pares.

El detalle actualizado sale de `get_contexto_sistema('LA_CUENTA')`.

## Al terminar, si tocaste el sistema

```sql
select registrar_cambio(
  'qué cambiaste, en una línea',
  'por qué: esto es lo que se pierde entre sesiones y lo que más sirve a la próxima',
  array['objeto_1','objeto_2'],
  'fix-vNN',
  'cómo revertirlo'
);
```

El "por qué" es lo importante. El qué se deduce mirando el código; la razón no.

## Dónde está cada cosa

- **Supabase** `djbwxgicosargfobsmqd` — el estado vivo y el catálogo: `diccionario_datos()`
- **Este repo** — el código. `docs/` tiene la historia de cómo se llegó acá.
- **Notion** — fichas de cliente, accionables y briefs
- **Google Ads MCC** 641-902-5021 — los scripts, para las 4 cuentas. (Fresh Monkee
  está vinculada al MCC desde el 12/9/2026; antes corría su propia copia del semanal.)
- **Google Ads API (GAQL)** — el árbitro. Los scripts extraen y ejecutan; la API
  reconcilia, backfillea maduración y diagnostica, y **nunca escribe**: la única mano
  que escribe en Google Ads es el ejecutor con acciones aprobadas. Cuando el dato del
  script y la sospecha difieren, la API decide. Cliente en `src/server/lib/gads.ts`,
  credenciales solo por variables de entorno. (Lección #109.)
- **La app** `app-northsignal.vercel.app`

## Lo urgente

No está escrito acá a propósito. Este archivo del 10 de septiembre decía "el semanal está
roto" y el 12 ya no era cierto. **Lo urgente se pregunta, no se lee:**

```sql
select * from v_para_actuar;                      -- calidad de datos
select id, cuenta, titulo from tickets where estado = 'abierto' order by id;
select * from v_tareas_en_silencio;               -- tareas que dejaron de correr
```

Y `PRIMERA_SESION.md` tiene la lista de la primera sesión, con fecha. Si ya pasó esa
sesión, ignoralo.
