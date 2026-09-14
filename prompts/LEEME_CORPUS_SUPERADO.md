# ⚠️ Este corpus está SUPERADO. No lo uses.

**La fuente de los prompts de Cowork es `docs/prompts/out/`**, que se genera con
`node docs/prompts/armar.mjs` desde una sola fuente. Estos cuatro archivos son las
copias manuales anteriores, que el commit `e45bc61` reemplazó justamente porque
compartían el 85% del texto por copia y **ya habían divergido**.

`docs/PENDIENTE_VERACIDAD.md` §9 lo marcó como pendiente: *"hay dos corpus de
prompts con cifras contradictorias, sin que nada declare cuál carga Cowork.
Decidí cuál es la fuente y borrá el otro."* Esto lo declara. Borrarlo es un
`git rm -r prompts/` cuando quieras; queda en el historial igual.

## Por qué éste no, con evidencia

Verificado el 14/9/2026 contra el árbol:

| | `prompts/` (éste) | `docs/prompts/out/` |
|---|---|---|
| Objetos de `diccionario_datos()` | dice **119** | corregido (el real es 172) |
| Columna de reglas | manda a **`cuentas.reglas_propias`** | dice que esa columna **no existe**; es `reglas_dominio` |
| Locales de Fresh Monkee | dice **71** | 46 |
| Cómo se mantiene | copia manual, 4 archivos | generado de una sola fuente |
| ¿Lo carga algo en runtime? | no | no (los dos se pegan a mano en Cowork) |

Lo de `reglas_propias` es lo más grave: `TAREA_FRESH_MONKEE_v2.md:162` manda al
agente a una columna que **no existe** y encima dice *"si alguna vez difieren,
manda la base"*. Un desempate contra una tabla vacía.

## Lo único que se les arregló

El 14/9 se les aplicó la regla de la tilde a **los dos** corpus —los valores de
`Naturaleza` van `Observacion`, `Inferencia`, `Hipotesis`, sin tilde, porque
`v_tasa_acierto` compara por igualdad exacta— para que ninguno de los dos pudiera
hacer daño mientras se decidía. Lo cuida `src/server/domain/vocabulario.test.ts`.
