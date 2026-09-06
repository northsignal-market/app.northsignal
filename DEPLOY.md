# NorthSignal OS — Deploy en Vercel

## 1. Subir a GitHub
```
git init && git add . && git commit -m "NorthSignal OS v23"
git remote add origin <tu-repo> && git push -u origin main
```

## 2. En Vercel
Importar el repo. Framework: **Other**. Vercel lee `vercel.json` y sabe qué hacer.

## 3. Variables de entorno (Settings › Environment Variables)
Copiar de `.env.example`. Obligatorias:

| Variable | Dónde se obtiene |
|---|---|
| `SUPABASE_URL` | `https://djbwxgicosargfobsmqd.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase › Settings › API › service_role |
| `NOTION_API_KEY` | Integración interna de Notion (compartir la página North Signal con ella) |
| `GEMINI_API_KEY` | Google AI Studio |
| `APP_ACCESS_TOKEN` | La contraseña de la app. Elegila vos |
| `SESSION_SECRET` | Cualquier string largo aleatorio. Firma las sesiones |
| `CRON_SECRET` | Otro string aleatorio. Protege `/api/cron/anomalias` |
| `NODE_ENV` | `production` |

Opcionales hasta que se activen los webhooks: `ASANA_WEBHOOK_SECRET`, `ASANA_PAT`, `GHL_WEBHOOK_SECRET`.

## 4. Deploy
Vercel compila el frontend con `vite build` y sirve la API desde `api/index.ts`.
El cron de anomalías corre cada 4 horas según `vercel.json`.

## 5. Verificar
- `https://<tu-app>.vercel.app/api/health` → `{"status":"ok"}`
- Iniciar sesión con `APP_ACCESS_TOKEN`
- Inicio → Hoy → Clientes: objetivos y escalera cargan

## Cambios de esta versión respecto de la v22
- `Datos` reconstruido desde `MetricsDashboard`: recupera rango de fechas, orden en servidor, filtros, agrupación, columnas, comparación. Más 3 pestañas diarias y drawer de keyword.
- 4 archivos muertos borrados (2.900 líneas).
- Branding estricto: Inter en todo, cero `font-mono`, cero colores fuera de la paleta.
- Liquid Glass real: tokens derivados por `color-mix`, `backdrop-filter`, filtro SVG de refracción.
- 10 endpoints nuevos: anomalías, objetivos (con edición), escalera de valor, cambios, cierres, scorecard, operator-log.
- Semana: gráfico con baseline, zonas de anomalía, CPA cortado en días provisionales, título como hallazgo.
- Clientes: objetivos editables con origen, veredicto de headroom, escalera de valor.
- Hoy: veredictos de escalamiento cuando alguna cuenta pide decisión.
- Sesiones sin estado (HMAC): funcionan en serverless.
- `dotenv` cargado antes que los módulos que lo necesitan.
- Cron convertido en endpoint para Vercel Cron.
- Catch-all `/api/*` movido al final: antes bloqueaba endpoints definidos después.
