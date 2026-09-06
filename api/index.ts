/**
 * Entrada para Vercel. Solo la API: los estáticos de dist/ los sirve Vercel
 * directamente (outputDirectory en vercel.json), y las rutas del frontend
 * caen en index.html por el rewrite del SPA.
 */
import { createApp } from '../server';

const app = createApp();
export default app;
