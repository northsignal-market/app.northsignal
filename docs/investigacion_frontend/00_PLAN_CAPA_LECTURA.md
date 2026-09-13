# La capa de lectura — sistema de redacción del front

Síntesis de 229 fuentes (informes 06–10 de este directorio; 78 de 2026, ~40 de foros y
comunidad). Resuelve el problema: secciones como **Plan de la semana** muestran texto de
agente crudo — técnico, largo, sin conclusión, sin guía, sin medir transcurso ni restante.

**El principio, validado por toda la investigación:** *los hechos se calculan; el lenguaje
solo los expresa* (Arria jul-2026: "the language layer has no power to alter the findings";
Tableau Pulse; Reiter). La industria volvió de las narrativas LLM a texto determinístico:
las quejas reales de Power BI/Copilot son de control (formato que cambia solo, no exporta,
no editable), y el mejor sistema LLM publicado (KAHAN, EMNLP 2025) miente en 1,8% de las
frases — inaceptable en un sistema cuyo contrato es no inventar números.

## Las reglas duras

1. **Cero LLM en runtime y cero resumen-del-resumen.** La lectura se deriva SOLO de campos
   estructurados. El texto libre del agente jamás se parsea para extraer números, veredictos
   ni sentimiento (Interfaze may-2026: 20–30% de brecha entre "parsea" y "es correcto") —
   eso fabricaría el modo de falla que este sistema combate. Los prompts de Cowork no se tocan.
2. **SQL es dueño del significado; el front, de la forma.** Los agregados de progreso viven
   en una vista (una sola verdad, testeable donde viven los controles). Toda vista nueva:
   `WITH (security_invoker = true)` (advisor 0010 de Supabase).
3. **El texto del agente se pliega íntegro, nunca se pierde**: `<details>` nativo (el buscador
   del navegador ya abre lo plegado — Interop 2025; `beforeprint` lo abre para imprimir),
   rotulado con procedencia y fecha, sanitizado. Dos chips en todo el sistema:
   **"Derivado de los datos"** vs **"Análisis del agente"**.
4. **Sin dato ≠ incumplió.** Los días madurando salen del denominador y se dice
   ("2 de 3 evaluables; hoy aún sin dato"). La racha se PAUSA con hueco; solo la rompe un
   incumplimiento explícito. Los gates se evalúan solo sobre días maduros.
5. **Lenguaje calibrado por tabla cerrada verbo↔hecho**: pasado para lo definitivo, "lleva"
   para lo inmaduro, "si aguanta N días se habilita" (condición explícita), "llegaría a ~X"
   con guardas — jamás "va a". Sin proyección con <7 días de dato: la frase es "faltan días
   de dato para proyectar". "No se puede saber con estos datos" es veredicto de primera
   clase, no error.

## La forma (3 renglones fijos, siempre los mismos)

```
● En camino — 2 de 3 indicadores cumplen hace 2+ días        ← veredicto ≤12 palabras
Si conv. rate aguanta 1 día más, se habilita bajar la puja   ← qué hacer / qué se desbloquea
del grupo Continentes — sería el jueves 18.
van 2 cumplidos · faltan 3 · quedan 4 días                    ← progreso: van / faltan / quedan
▸ Análisis del agente · texto libre · lun 15                  ← plegado, íntegro
```

- **Estado: 4 valores, calculado, nunca elegido**: `en_camino` / `en_riesgo` / `caido` /
  `sin_senal` (gris legítimo). Color + texto, nunca color solo. Fórmula error-budget
  (informe 09): plan "cumplir K de N días" ⇒ presupuesto de fallos `B=N−K`; con `f`
  incumplidos maduros y `e` días evaluables: caído si `f>B`; en riesgo si `f=B` o
  `burn=(f/B)/(e/N)>1`; en camino si no; sin señal si `e<2`.
- Frases ≤25 palabras (GOV.UK), INFLESZ ≥65 en la capa derivada, entidad primero,
  máx 2 niveles de plegado, veredicto un paso tipográfico arriba (~1.2×, semibold).
- Los expertos también prefieren lenguaje claro (NN/g; GOV.UK: 80%, y crece con la
  especialización del lector). Lo técnico NO se pierde: queda para el sistema y plegado.

## Implementación

### R1 · SQL — `v_plan_lectura` (o RPC `plan_lectura(cuenta)`)
Por indicador y por plan: días evaluables (maduros), cumplidos, incumplidos, sin dato,
racha actual (pausada por huecos), estado calculado (fórmula de arriba), próximo
desbloqueo: qué habilita, cuántos días maduros seguidos exige, cuántos van, y la fecha
más próxima de habilitación si todo confirma. El front NO recalcula nada de esto.

### R2 · Front — módulo `lectura.ts` (sentence builders determinísticos)
`derivarHechos(plan) → Hecho[]` (unión discriminada ~8–10 tipos: cumplimiento, racha,
a_un_paso, sin_dato, caido, proyeccion_no_disponible…) → `frase(hecho)` con **switch
exhaustivo sin default** (frase nueva ⇔ hecho nuevo: lo exige el compilador) →
`leerPlan()` elige titular por prioridad fija (sin_senal primero). Frases ENTERAS por
variante — nada de concatenar fragmentos. Catálogo ≤40 frases, revisable en un archivo.
`Intl.PluralRules`/`RelativeTimeFormat` es-AR (Baseline; MF2 no se adopta: marginal).
Fixtures nombrados (todo_cumple, un_null_hoy, racha_rota, serie_corta) como verificación.

### R3 · Semana — el Plan de la semana adopta la capa
Tarjeta del plan: los 3 renglones + la grilla diaria existente con tres estados visuales
(✓ / ✗ / ⏳ gris-reloj para sin-dato, precedente Statuspage) + `contexto` del agente en
`<details>` rotulado. El botón/acción que se desbloquea: visible deshabilitado con el
porqué y la fecha estimada (patrón merge-box de GitHub).

### R4 · Extensión al resto (mismo sistema, cero lógica nueva)
"Ayer en cada cuenta" (pulso), Diagnóstico y Brief: rotular procedencia, veredicto derivado
donde haya estructura, texto del agente plegado íntegro. Regla permanente: si un día falta
estructura, se post-procesa UNA vez en el servidor (columnas `derivado_*` con
`parser_version`), nunca dos parsers para el mismo campo, y el render degrada a "crudo
plegado, nunca romper".

### Vigilancia (la capa de calidad también acá)
Una consulta mide qué % de análisis renderiza en cada peldaño (estructurado pleno →
parcial → crudo plegado). Si "crudo" sube, el agente cambió su formato y se ve en un
número — no en una sospecha (>1% = bandera).

## Lo que se decidió NO hacer
- Resumir el texto del agente con otro LLM (slop², sin respaldo — NN/g sep-2026).
- Extraer cifras o veredictos del texto libre (mentira estructural).
- Porcentaje de confianza crudo en UI (bandas alta/media/baja con porqué plegable).
- Countdown de urgencia (deadline real = información; segundos = presión falsa).
- Racha con fueguito (GitHub la eliminó; HN feb-2026: "mantener la racha es estrés").
- MessageFormat 2 y maquinaria NLG (RosaeNLG deprecado mar-2026): builders TS propios.
