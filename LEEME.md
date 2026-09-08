# NorthSignal · paquete completo para beta

Generado el 8 de septiembre de 2026. Reemplaza al `update.zip` anterior.

Acá está todo: la app, los diez scripts de Google Ads y los cinco prompts, con los
arreglos de la revisión aplicados. La base ya está corregida en Supabase; lo de acá es
lo que hay que desplegar a mano.

---

## Qué hay adentro

```
app/                      código completo de la app, con tres archivos corregidos
scripts_MCC/              los cinco scripts del MCC 641-902-5021
scripts_FRESH_MONKEE/     las cinco copias que corren adentro de Fresh Monkee
prompts/                  los cinco prompts de las tareas de Cowork
supabase/migrations/      vacío a propósito. Ver "Lo que falta", punto 2
```

`app/api/index.js` no está: era la salida de build, se regenera sola y tenerla vieja
adentro del paquete solo confunde sobre cuál es el código de verdad.

---

## Sobre las claves

Decidiste no rotar nada, así que **los scripts de este paquete traen las claves adentro,
igual que antes**. No hay ningún paso previo: los pegás y funcionan.

Si alguna vez cambiás de opinión, el cambio es chico y ya está probado: `PropertiesService`
funciona en Google Ads Scripts, de hecho tu semanal ya lo usa para guardar el ID del Sheet
de briefs. Se cargan por código, no por interfaz, y son por script.

Un dato que salió de revisar esto y conviene tener a mano: de las 94 tablas de `public`,
93 tienen RLS activo y hay **cero políticas**, o sea que con la clave `anon` no se lee nada.
La `anon` es pública por diseño. La que importa es `service_role`, que saltea RLS.

## Orden de despliegue

**1. Los scripts, en el MCC.** Pegá el contenido de cada archivo sobre el script existente.

| Archivo | Reemplaza a | Qué cambia |
|---|---|---|
| `northsignal_semanal_v11.js` | v10 | `change_events` pasa a upsert con ventana de 30 días y deja de borrar; umbrales reales de Fresh Monkee; declara sus umbrales a la base; corta la corrida si una tabla no declara su política de escritura |
| `northsignal_diario_v5.js` | v4 | `keyword_status` fuera de la clave del upsert; `config_snapshot` ahora cubre grupos de anuncios |
| `ejecutor_v7.js` | v6 | tope de 12 acciones por corrida con pausa entre cada una; resuelve campañas Performance Max |
| `centinela_v13.js` | v12 | solo claves fuera del archivo |
| `briefing_v8.js` | v7 | solo claves fuera del archivo |

**2. Los cuatro de Fresh Monkee**, adentro de la cuenta 497-723-1137. Son idénticos a los
del MCC salvo la cabecera de instalación. El `etiquetador_v1.js` también cambió: tenía la
clave adentro.

**3. Los prompts, en Cowork.** 360 v10, BHI v10, Karedo v13, Fresh Monkee v2. El mensual
queda igual.

**4. La app.** Tres archivos cambiados: `src/server/routes/webhooks.ts`,
`src/components/Sistema.tsx` y `server.ts`. Ver abajo.

---

## Qué cambió en la app

**`src/server/routes/webhooks.ts`, reescrito.** Tres cosas:

Ninguno de los dos handlers escribía en `funnel_events`, y esa es justo la tabla que mira
`estado_de_los_flujos()` para decidir si el flujo de cierres está vivo. Con Asana
funcionando perfecto, el flujo iba a seguir en rojo para siempre: el indicador vigilaba una
tabla que nadie escribía.

El handler de GoHighLevel no escribía nada y marcaba PROCESSED. Decía *"Future: process GHL
payload"*. Conectar el webhook de BHI habría puesto el flujo en verde con `v_cierres_totales`
vacía, que es peor que el rojo de hoy: hoy el sistema sabe que no sabe. Ahora, si el evento
no se puede mapear a una etapa declarada, queda en `SIN_MAPEO` con el motivo y los nombres
que llegaron, y nunca en PROCESSED.

Los dos respondían 200 antes de trabajar. En Vercel la función puede congelarse apenas se
manda la respuesta, así que el trabajo posterior no está garantizado. Ahora se escribe
primero y se responde después, con timeout en la llamada a Asana, que es la única parte
lenta. Y la sección de una tarea se buscaba en `memberships[0]`: una tarea en dos proyectos
devolvía la sección equivocada.

**`src/components/Sistema.tsx`.** El bloque de respaldo del esquema estaba envuelto en
`{respaldo && (...)}`. Si el fetch fallaba, el estado quedaba en null y la sección **no se
renderizaba**. No es que el botón no funcionara: no existía en pantalla, sin ningún mensaje.
Ahora el bloque se muestra siempre, el error se ve, y la descarga va por fetch y blob en vez
de un link plano, así usa las mismas credenciales que el resto de la app.

**`server.ts`.** `/api/respaldo` devolvía 500 para los tres archivos si uno solo fallaba, y
eso era lo que dejaba a la interfaz sin renderizar la sección. Ahora la lista sale igual y
cada archivo reporta lo suyo.

---

## Lo que ya está aplicado en Supabase

No hay que hacer nada con esto, ya funciona. Es para que sepas qué cambió debajo.

**Lo más importante, y es lo que hacía que la interfaz no sirviera.** `accion_valida` solo
decía "el JSON parsea". Una pregunta a Andrés tiene JSON perfectamente válido, así que la
app mostraba 17 accionables como listos para ejecutar y 14 devolvían error al apretar el
botón: ocho preguntas a vos, cuatro al cliente y dos `crear_anuncio`, que Google no deja
crear por script. Ahora un trigger pone `accion_valida` en `false` cuando el verbo no es
ejecutable y escribe el motivo en `accion_error`. **Hoy la interfaz muestra tres botones y
los tres funcionan**: quitar una negativa en BHI y pausar keywords en dos grupos de Karedo.
Los otros 22 muestran el motivo en vez de un botón que falla.

Esto ya había pasado: `fix-v83` lo corrigió en la Bandeja y en el correo, pero la columna
siguió mintiendo, así que cualquier pantalla nueva que la leyera volvía a caer. Por eso el
arreglo va en la base y no en la app.

Doce migraciones. Las que importan: `keywords_daily` perdió `keyword_status` de su clave
única y se deduplicó (Karedo pasó de 2.449,42 a 2.113,50 EUR, un 13,7% de gasto que estaba
duplicado); `change_events` tiene índice único para poder acumular; `acciones_aprobadas`
tiene columna `no_ejecutar_antes_de` y `v_acciones_pendientes` la filtra, así que la fecha
de espera dejó de depender de que alguien pase por `prevuelo`; `v_primarias_solapadas` mide
por campaña y no por cuenta; `v_umbrales_inconsistentes` puede fallar y está enchufada a la
salud; `get_weekly_package_cadena` tiene los tres guardarraíles que solo tenía el paquete de
cuenta única; y `v_headroom` mide volumen sobre la tabla semanal y distingue puja de calidad.

---

## Lo que falta, y no lo puedo hacer yo

**1. Rotar las tres claves.** Arriba está el detalle.

**2. Los tres archivos de respaldo en `supabase/migrations/`.** La carpeta está creada y
vacía a propósito. Bajalos desde Sistema › Salud con la app ya desplegada, que es lo que
arregla el punto de arriba, y ponelos ahí:

```
00000000000001_linea_base.sql          ~456 KB
00000000000002_datos_semilla.sql       ~254 KB
00000000000003_tareas_programadas.sql    ~7 KB
```

Verifiqué que la línea base es idempotente: 167 `if not exists`, 220 `create or replace`,
cero `create table` pelados. Se puede aplicar sobre la base viva sin efecto, así que
habilitar la integración de GitHub en Supabase después de commitearlos no rompe nada.

Ojo con una cosa: son una foto, no el historial. Reconstruyen la base entera desde cero,
que es lo que querías, pero no guardan las 136 migraciones una por una. Si cambia el esquema
y no los regenerás, el repo queda viejo sin avisar.

**3. Sobre la pantalla de GitHub en Supabase.** Apagá *Automatic branching*: el compute de
branching queda fuera del Spend Cap y cada PR te levanta una base de preview real. El resto
está bien como está. Y no le des Enable hasta tener los tres archivos commiteados: la
integración va del repo hacia la base, no al revés, así que hasta que no estén no respalda
nada y la pantalla se ve configurada igual.

---

## Una aclaración sobre `app/`

El `app/` de este paquete es **el mismo árbol que vos me mandaste en `update.zip`**, con mis
tres archivos corregidos encima. No es un clon del repo: comparándolo contra
`northsignal-market/app.northsignal` faltan cosas que sí están en GitHub y no venían en tu
zip, y que por lo tanto no puedo darte actualizadas porque nunca las vi:

`tsconfig.json`, `README.md`, `DEPLOY.md`, `metadata.json` y la carpeta
`karedo_optimizaciones/`.

Lo digo en vez de armar una carpeta que parezca completa: es exactamente el error que
encontramos hoy tres veces, el respaldo cableado que se ve entero. Si querés el paquete
completo de verdad, pasame esos archivos o dale permiso de escritura al conector de GitHub y
subo los cambios directo al repo, que es mejor que mover zips.

Por eso tampoco pude correr `tsc` sobre el proyecto entero. Los tres archivos que toqué sí
los verifiqué: parsean limpio con esbuild, y los diez scripts pasan `node --check`.

---

## RSA Factory: rediseñado, no solo migrado

El botón no hacía nada porque el endpoint devolvía 500 por falta de `GEMINI_API_KEY` y el
frontend no tenía rama de error. Pero cambiar el modelo era lo de menos.

**Antes:** elegías términos sueltos de la cuenta entera y el modelo escribía. No sabía en
qué grupo iba el anuncio, ni qué le pasaba a la cuenta, ni qué anuncio ya existía ahí.

**Ahora:** la pantalla arranca por el diagnóstico. `v_donde_escribir_anuncio` ordena los
grupos por plata en riesgo (el gasto de la semana en keywords cuya relevancia está bajo el
promedio) y dice qué acción corresponde: reescribir, sumar un segundo anuncio, crear el
primero, o **no es el anuncio, es la landing**. Ese último caso devuelve 409 y no escribe,
porque un RSA nuevo no mueve el Quality Score cuando el problema es la landing. Protege los
67.532 CLP de BHI y 360, que es donde está la plata grande.

Elegís una fila y el servidor arma el contexto solo: keywords del grupo, términos que
convirtieron ahí, texto del anuncio vigente para variar y no repetir, idioma de la cuenta y,
si es cadena, el local.

Tres adaptaciones por cuenta, todas desde la base:
- **Idioma.** Karedo es `de-DE` y sus anuncios están en alemán. El generador viejo no
  declaraba idioma: con un prompt en castellano le habría escrito copy en español.
- **Multi-local.** Solo Fresh Monkee. Si el grupo tiene local, el prompt exige que cuatro de
  los quince títulos nombren esa ciudad y prohíbe nombrar otra. Hoy solo 44 de 664 títulos
  nombran su propia ciudad.
- **Reglas** desde `cuentas.reglas_dominio`, no de la copia cableada que tenía cuatro de las
  siete palabras prohibidas de BHI.

Además: 15 títulos y 4 descripciones en vez de 3-5 y 2-4, y nada se trunca. Antes hacía
`substring(0,30)`, que corta a mitad de palabra.

---

## Cuándo crear un grupo nuevo, y las negativas, como accionables

`v_terminos_sin_cobertura` detecta términos cuyo tema ninguna keyword del grupo cubre, y
decide comparando el CPA del término contra el del grupo, sin umbrales inventados:
convierte mejor y nadie lo cubre, merece keyword propia; no convierte y gasta, es negativa.

Dos endpoints nuevos lo convierten en accionables de Notion con `Accion JSON` válido, que es
lo único que la app ejecuta de un clic. Los guardarraíles se aplican **antes** de crear:
`simular_negativa` para que la negativa no bloquee tráfico que convierte ni un término
protegido, y `verificar_invariantes` sobre el JSON final. Nada se ejecuta solo: el
accionable nace en Propuesto.

Lo que encontró al correrlo:

| Cuenta | Crear keyword | Negativa |
|---|---|---|
| BHI | 2 términos | 11 términos, **81.807 CLP sin una conversión** |
| 360 | — | 16 términos, 18.015 CLP |
| Fresh Monkee | 123 términos, 272 conv | 462 términos, 573 USD |
| Karedo | 3 términos | 31 términos, 191 EUR |

En BHI seis de esas negativas son **un solo clic cada una**, de 6.586 a 14.667 CLP. Con
20.000 de presupuesto diario, un clic se come el día. Son todos competidores entrando por
concordancia amplia: iclick travel, vumi chile, intermundial total travel, img patriot plus,
assistcard chile.

**Y el hallazgo de arquitectura de Fresh Monkee: no hay grupo de marca.** 297 términos de
marca, 1.850 USD, el 64% del gasto, servidos desde "Protein Shake - Traffic" en 16 campañas
por keywords como "smoothie" y "whey protein". Donde la marca sí tiene keyword propia
(BOGO50_Corporate) el CPA es 2,64; por genéricas, 6,15. La misma marca, 2,3 veces más cara.
Eso es una propuesta con número para llevarle a Pablo, no una pregunta.

---

## Nueve tickets abiertos

Cuatro son de extracción y su arreglo está en los scripts de este paquete: **29, 30, 32 y
42** se cierran solos cuando despliegues el semanal v11 y el diario v5.

Dos son de Fresh Monkee y necesitan tu ojo en pantalla, no SQL: **44**, declarar
`funnel_stages`, que hoy está vacío mientras la cuenta tiene 22 acciones marcadas como
primarias con un flag deprecado, entre ellas tres de page_view y una de session_start; y
**45**, decidir si `Store visits` y `Local actions - Directions` miden dos hechos distintos o
el mismo clic en seis campañas locales.

**12** y **16** son datos que Google no entrega a nivel grupo.

**27** sigue vivo: `v_decision_estructural` declara saturación citando un escalón quince
veces el presupuesto, sobre cinco conversiones en once días consolidados de veintiocho. Es
de la misma familia que los dos que se cerraron hoy: la vista expone `dias_28d` y el
veredicto no lo usa.
