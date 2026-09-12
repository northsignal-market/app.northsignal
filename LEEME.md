# Cómo darle esto a Claude Code

## Paso 1 · Clonar el repo en tu máquina (una sola vez)

Abrí la terminal y pegá:

```bash
git clone https://github.com/northsignal-market/app.northsignal.git
cd app.northsignal
```

Te crea una carpeta `app.northsignal` con todo el repo adentro.

## Paso 2 · Copiar el contenido de este zip adentro de esa carpeta

Descomprimí el zip. Adentro hay: `CLAUDE.md`, `PRIMERA_SESION.md`, `.mcp.json`, una carpeta
`.claude`, una carpeta `docs` y una carpeta `_entrega`.

**Todo eso va adentro de `app.northsignal`, al mismo nivel que `server.ts`.**

Ojo con `.mcp.json` y `.claude`: empiezan con punto y el Finder los esconde. En el Finder
apretá `Cmd + Shift + .` para verlos, y arrastralos igual que el resto.

## Paso 3 · Abrir Claude Code ahí

```bash
cd app.northsignal
claude
```

## Paso 4 · El primer mensaje

Pegá exactamente esto:

> Leé CLAUDE.md y PRIMERA_SESION.md. Ejecutá las tareas en orden. Antes de cada commit,
> mostrame qué vas a commitear y esperá mi ok. Si algo falla, parás y me decís.

Y listo. Va a limpiar el repo, colocar los archivos, compilar, commitear, bajar las
migraciones desde la base viva, y contarte qué encontró.

## Lo que Claude Code NO puede hacer y queda para vos

Pegar los cuatro prompts en las tareas de Cowork. Los de Cowork hoy tienen el latido pero no
el registro de cifras ni la regla STOP. Cowork no lee del repo: hay que pegarlos a mano.
Sin eso, el lunes los agentes corren sin nada de la capa de calidad.
