/**
 * Entrada para Vercel. Exporta la app Express como handler serverless.
 * Vercel enruta /api/* y todo lo demás acá (vercel.json), y la app sirve
 * el frontend desde dist/ en producción.
 */
import express from 'express';
import path from 'path';
import { createApp } from '../server';

const app = createApp();

// Estáticos del frontend compilado
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

export default app;
