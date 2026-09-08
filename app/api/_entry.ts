/**
 * Fuente de la función serverless. El build la bundlea con esbuild a
 * api/index.js: un solo archivo sin imports relativos, que es lo que
 * Vercel puede ejecutar sin rastrear dependencias fuera de api/.
 * El guión bajo evita que Vercel la trate como endpoint.
 */
import { createApp } from '../server';
const app = createApp();
export default app;
