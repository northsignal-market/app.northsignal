# NorthSignal · Cómo trabajar en este sistema

Este es el único documento estático del proyecto. Todo lo demás se consulta.

**Por qué así.** Un documento que describe el estado del sistema envejece en días. Hoy mismo pasaron tres casos: las cuentas estaban cableadas en seis lugares distintos, el título de los accionables nunca se leía, y una fecha de espera escrita en prosa no retenía nada. Y un documento autogenerado grande tampoco sirve: un estudio de ETH Zurich midió que **bajan la tasa de éxito en 5 de 8 escenarios**, porque una referencia estructural vieja engaña más de lo que un vacío confunde.

Así que este archivo solo tiene lo que **no cambia**. El estado se pregunta.

---

## Lo primero que hacés en cualquier chat

```
Supabase MCP · proyecto djbwxgicosargfobsmqd

select get_contexto_sistema();
```

Devuelve, al momento: **la última sesión de construcción** —con qué empezó, qué se construyó, qué se aprendió y qué quedó—, la salud del sistema, las cuatro cuentas con su perfil y sus reglas, los ocho flujos de datos, qué puede ejecutar un script y qué no, los guardarraíles, las lecciones de mayor confianza y los tickets abiertos. Son unos 44 KB.

Si vas a trabajar sobre una cuenta puntual:

```sql
select get_contexto_sistema('FRESH_MONKEE');
```

Agrega el estado de esa cuenta, su completitud y su doc maestro.

**No copies eso a un archivo.** El día que lo hagas, empieza a envejecer.

Adentro viene `cambios_recientes`: qué tocó cada chat en los últimos siete días, con la razón. **Miralo antes de cambiar algo.** El riesgo de tener varios chats sobre el mismo sistema no es que uno no sepa: es que deshaga lo que otro acaba de hacer.

Y si algo aparece en `objetos_tocados_dos_veces`, dos chats ya lo tocaron en 48 horas. Entendé qué hizo el primero antes de tocarlo vos.

---

## Qué es este sistema

Andrés Biggs opera cuentas de Google Ads desde Buenos Aires. El sistema analiza, propone y ejecuta cambios con su aprobación.

Cinco piezas: **scripts en Google Ads** que extraen y ejecutan, **Supabase** que guarda todo y corre 18 tareas, **agentes en Cowork** que analizan y proponen, **Notion** donde viven los accionables, y **una app en Vercel** donde Andrés decide.

**La regla que las une: nada cambia en Google Ads sin que Andrés lo decida.**

---

## Las reglas que no cambian

**Nunca adivines el nombre de una entidad.** Ni una keyword, ni una campaña, ni un grupo. Se resuelven contra la base. El mismo nombre de grupo existe en 21 campañas de Fresh Monkee: una fila sin su contexto miente.

**Sin Accion JSON válido no hay ejecución.** No es que no aparece el botón: el servidor también la rechaza. Un cambio se aplica desde una estructura, nunca desde un texto.

**Los cambios de riesgo medio exigen el valor anterior.** Presupuesto, objetivo de puja, CPC. Sin él no se puede revertir, y el sistema no lo deja pasar.

**Una condición de secuencia va en el JSON, no en la prosa.** `parametros.no_ejecutar_antes_de`, formato AAAA-MM-DD. Un accionable que decía en su texto "esperar al 21 de septiembre" se ejecutó ese mismo día.

**Antes de analizar, preguntá si tiene sentido.** `corrida_redundante(cuenta)`. Y al terminar, copiá `marcadores_para_la_proxima` en `run_quality`: sin eso la próxima corrida cree que todo es nuevo.

**Los datos de Google son direccionales, no cerrados.** El historial de cambios tiene huecos. Las visitas a tienda son modeladas, no contadas: si no aparecen, no es cero. Google deja campañas en "habilitada" aunque ya hayan terminado.

**Los días recientes maduran.** Una conversión puede tardar días en atribuirse. Un CPA de ayer no es comparable con uno de hace dos semanas, y decirlo importa más que el número.

**Todo lo interno va en castellano rioplatense.** Los reportes al cliente, en el idioma de su ficha. **El reporte no sale solo al cliente**: llega a Andrés con el texto listo para reenviar, y él decide cuándo.

**La ventana que decís tiene que ser la que sumaste.** La capa diaria tiene entre 15 y 17 días, no 30. Cualquier vista que diga "30 días" está sumando sobre esa ventana más corta. Para retrospectiva, la tabla semanal, que sí tiene 13 semanas.

**El gasto de ayer ya es definitivo; las conversiones no.** Una anomalía de gasto en un día provisional merece mirarse hoy; una de CPA no, porque divide gasto completo por conversiones incompletas.

**Antes de citar un CPA, verificá que no haya primarias solapadas.** Varias acciones que miden etapas del mismo recorrido sobre el mismo clic inflan el total. En BHI el factor es 2,4.

---

## Lo que cada cuenta tiene de propio

**KAREDO** — software B2B en el mercado alemán, euros. **Sin ROAS**: no hay valor de conversión real, así que se juzga por CPA.

**BHI** — seguros de salud en Chile, pesos. **Regulación CMF**: nada de copy generado automáticamente, porque puede usar vocabulario de venta que la regulación prohíbe.

**360** — eventos corporativos en Chile, pesos. Los cierres llegan por CRM: el valor real nunca está en Google.

**FRESH_MONKEE** — cadena de batidos en Estados Unidos, dólares. **Perfil cadena**, 46 locales. Tres reglas propias: el ROAS se calcula solo sobre las campañas de compra online; **el presupuesto de un local no se mueve a otro** porque cada franquiciado paga el suyo; y los locales se comparan **dentro de su grupo de pares**, no contra toda la cuenta.

El detalle completo y actualizado sale de `get_contexto_sistema('LA_CUENTA')`.

---

## La capa de calidad, agregada el 9 de septiembre

Este sistema falla de una sola manera: **produce números verosímiles y equivocados**. No por
manipulación, sino porque una vista suma sobre una ventana que no tiene, o una columna se
llama distinto de lo que contiene. El nombre de eso es semantic drift, y los cinco pilares
clásicos de observabilidad no lo detectan: los pasa todos y está mal igual.

**La puerta de entrada es una sola:**

```sql
select * from v_para_actuar;
```

Si está vacía, hoy no hay nada que hacer con la calidad de datos. Lo demás vive en
`v_incidentes` y se mira cuando uno quiere, no cuando el sistema grita. Un incidente es una
**causa**, no un evento: una violación cuyo ticket ya está abierto no es una alerta, es un
estado.

**Para calcular, se llaman las canónicas.** `metrica_conversiones`, `metrica_gasto`,
`metrica_cpa` y `ventana_metrica`. Nunca `current_date - N` a mano ni un CPA inline: aparece
en `v_metricas_reescritas`. El CPA canónico devuelve NULL con cero conversiones a propósito.

**Antes de citar una cifra, `v_relaciones_violadas`.** Si una relación que la toca está
violada, esa cifra es sospechosa antes de mirarla. Ojo con el veredicto `no_aplicaba`: no es
una falla, es la relación diciendo que su dominio de validez no se cumple ahí. Tratarla como
falla es cómo mueren las alertas.

**Toda cifra que sale a un brief se registra** en `cifras_publicadas` con el SQL exacto que
la produjo, y `verificar_cifras()` la recalcula sin ver el brief. Si no se puede escribir esa
consulta, ese número no está listo para publicarse.

### Las reglas nuevas que no cambian

**El radio de la acción tiene que ser el radio de la evidencia.** Un veredicto calculado
sobre un término dentro de un grupo no autoriza una acción a nivel campaña.

**Un ticket de bug no cierra sin un control que atrape su regreso**, y ese control no cuenta
hasta que probó que puede fallar. Lo impide un trigger, no una convención.

**Un chequeo que ya está en rojo se prueba al revés**: arreglando el dato y viendo si se pone
en verde. Una relación trabada en "viola" está tan rota como una trabada en "cumple".

**Ad Strength no es Quality Score.** La relevancia del anuncio entra en la subasta; Ad
Strength es un diagnóstico de la interfaz. Repetir la keyword en diez de quince títulos
pierde variedad sin ganar relevancia.

**Lo que existe se documenta en `notas_de_objetos`, no en el prompt.** Un conjunto de
herramientas inflado es el modo de falla más común de un sistema de agentes, y a más tokens
peor recuerda el modelo lo que tiene adelante. El catálogo se consulta con
`diccionario_datos()`.

---

## Cuando algo falla

Está en `docs/MANUAL_DE_OPERACION.md` del repo, con los diez fallos que ya pasaron y su arreglo. El atajo:

```sql
select get_salud_sistema();
```

Da un veredicto en castellano y, si hay algo roto, la lista con la cuenta y el detalle.

---

## Lo último que hacés en cualquier chat

Si tocaste el sistema, dejalo escrito:

```sql
select registrar_cambio(
  'qué cambiaste, en una línea',
  'por qué: esto es lo que se pierde entre chats y lo que más sirve al siguiente',
  array['funcion_o_vista_1', 'tabla_2'],
  'fix-vNN o script vN',
  'cómo revertirlo si hace falta'
);
```

El "por qué" es lo importante. El qué se puede deducir mirando el código; la razón no.

---

## Cómo escribir acá

Castellano rioplatense, directo, sin adornos. Un número siempre con su unidad y su ventana. Si algo no se sabe, se dice: **"no se puede saber con estos datos" es una respuesta válida y preferible a un número inventado.**

Cuando corrijas algo, dejá la razón escrita donde se va a leer: un comentario en la función, una lección en `lecciones`, o el "por qué" del accionable. El sistema aprende de eso.

---

## Los tres documentos del repo

- `docs/MANUAL_DE_OPERACION.md` — qué hacer cuando algo falla
- `docs/MAPA_DEL_SISTEMA.md` — qué escribe cada cosa y qué lee, el día hora por hora
- `docs/DECISIONES.md` — las nueve decisiones que costaron caro y qué haría falta para cambiarlas
