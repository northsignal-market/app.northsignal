# Primera sesión de Claude Code · escrito el 12 de septiembre de 2026

Andrés: pegá esto como primer mensaje y nada más:

> Leé CLAUDE.md y PRIMERA_SESION.md. Ejecutá las tareas en orden. Antes de cada commit,
> mostrame qué vas a commitear y esperá mi ok. Si algo falla, parás y me decís.

Claude Code: lo que sigue es para vos. Cada tarea tiene una verificación. **No pases a la
siguiente sin que la verificación dé lo esperado.**

---

## Estado real al 12 de septiembre, para que no chases problemas resueltos

- **`change_events` volvió a entrar** el 9 de septiembre (544, 586, 207 y 140 filas por
  cuenta). El semanal corregido YA ESTÁ en Google Ads. Lo que está viejo es la copia del
  repo.
- **El pulso volvió**: escribió el 9, 10 y 11. El 10 y el 11 solo 3 de 4 cuentas: mirá cuál
  falta y por qué, pero no es urgente.
- **Los cuatro agentes semanales corrieron el 9 y latieron.** Los prompts de Cowork tienen
  el latido pero NO el registro de cifras ni la regla STOP: `cifras_publicadas` está en 0.
- `server.ts` en el repo YA está al día (234.366 bytes).
- Un solo incidente pide acción: el tipo de `change_events.change_datetime`, ticket 54.

## Tarea 1 · Confirmar el entorno

```bash
git status
node --version && npm --version
supabase --version || echo "FALTA supabase CLI: npm i -g supabase"
```

Verificación: `git status` limpio, node 20 o más. Si falta el CLI de Supabase, instalalo
antes de seguir.

## Tarea 2 · Borrar la carpeta `app/` duplicada

Es una copia vieja de toda la aplicación (su `server.ts` tiene 225.745 bytes contra 234.366
del real). Vercel construye desde la raíz: `package.json` corre `tsx server.ts` y
`esbuild api/_entry.ts`, los dos relativos a la raíz. Confirmalo vos:

```bash
cat vercel.json
grep -n '"dev"\|"build"' package.json
```

Verificación: nada en `vercel.json` ni en los scripts apunta a `app/`. Entonces:

```bash
git rm -r app/
```

## Tarea 3 · Colocar los archivos de `_entrega/`

```bash
cp _entrega/scripts_MCC/northsignal_semanal_v11.js     scripts_MCC/
cp _entrega/scripts_FRESH_MONKEE/FM_1_semanal.js       scripts_FRESH_MONKEE/
cp _entrega/prompts/*.md                                prompts/
cp _entrega/src/components/RSAFactory.tsx               src/components/
rm -rf _entrega
```

Verificación de tamaños, que es cómo se detectó la divergencia:

```bash
wc -c scripts_MCC/northsignal_semanal_v11.js   # 92029
wc -c scripts_FRESH_MONKEE/FM_1_semanal.js     # 91980
wc -c src/components/RSAFactory.tsx            # 14682
wc -c prompts/TAREA_KAREDO_v13.md              # 72167
grep -c 'change_date_time <=' scripts_MCC/northsignal_semanal_v11.js   # 2
```

## Tarea 4 · Que compile antes de subir nada

```bash
npm install
npm run typecheck
npm run build
```

Verificación: cero errores. Si hay avisos de `Circular chunk`, **leelos**: uno de esos dejó
la app en pantalla de carga infinita el 8 de septiembre y se compilaba "sin errores".

## Tarea 5 · Primer commit

Mostrale a Andrés el `git diff --stat` y esperá su ok.

```bash
git add -A
git commit -m "Sincronizar repo con lo desplegado: semanal v11 con rango cerrado, prompts con STOP y cifras, RSAFactory con Ad Strength, sin app/ duplicada"
git push
```

## Tarea 6 · Las migraciones al repo, por fin

Esto es lo único que hace recuperable un desastre y nunca existió. **No se bajan de la app:
se generan desde la base viva con el CLI.**

```bash
supabase login
supabase link --project-ref djbwxgicosargfobsmqd
supabase db pull
```

`db pull` lee el esquema de producción y genera `supabase/migrations/<timestamp>_remote_schema.sql`.

Verificación:

```bash
ls -la supabase/migrations/
grep -c 'create or replace function' supabase/migrations/*.sql   # bastante más de 100
grep -l 'exigir_control_al_cerrar' supabase/migrations/*.sql     # tiene que aparecer
```

Si `exigir_control_al_cerrar` no aparece, el pull no trajo todo y hay que averiguar por qué
antes de commitear.

Después, commit aparte:

```bash
git add supabase/
git commit -m "Migraciones desde la base viva: primera copia recuperable del esquema"
git push
```

## Tarea 7 · Confirmar que llegás a Supabase por MCP

Corré las dos consultas de arranque de `CLAUDE.md`. Si el MCP no responde, el `.mcp.json`
puede necesitar ajuste: probá `claude mcp add --scope project --transport http supabase
https://mcp.supabase.com/mcp` y volvé a intentar.

Verificación: `get_contexto_sistema()` devuelve un JSON de unos 44 KB con `sesion_ultima`
titulada "De integridad a significado".

## Tarea 8 · Informar

Decile a Andrés, en este orden y en castellano rioplatense:

1. Qué commiteaste y qué no.
2. Si las migraciones llegaron completas.
3. Qué dice `v_para_actuar` hoy.
4. Cuál de las cuatro cuentas se quedó sin pulso el 10 y el 11.

Y una cosa que NO podés hacer vos y él tiene que saber: **los prompts de Cowork siguen en
la versión intermedia.** El repo ahora tiene la buena, pero Cowork no la lee del repo.
Andrés tiene que pegar los cuatro prompts de `prompts/` en las tareas de Cowork a mano, o
el lunes los agentes vuelven a correr sin registrar cifras.

---

## Después de esta sesión

Lo que sigue está en `tickets` y en `v_para_actuar`, no acá. Empezaría por el 54 (cambio de
tipo de `change_datetime`), porque ahora con Supabase local se puede ensayar:

```bash
supabase start          # levanta una copia local
supabase db reset       # aplica las migraciones a la copia
# probar el ALTER TYPE ahí, romper lo que haya que romper, arreglarlo, y recién después producción
```

Ese fue el motivo por el que no se hizo el 9: seis vistas y cinco funciones colgando y
ningún lugar donde ensayar. Ahora lo hay.
