import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from './session';
import { comparacionSegura } from '../lib/signatures';

export // Auth Middleware
  const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Rutas públicas: sesión y healthcheck
    if (['/health', '/login', '/logout', '/me'].includes(req.path)) return next();

    // Webhooks entrantes: se autentican con la firma del proveedor
    // dentro de cada handler, no con la sesión de la app.
    if (req.path.startsWith('/webhooks/')) return next();

    if (!process.env.APP_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'APP_ACCESS_TOKEN no está configurado en el servidor' });
    }

    // Header: APP_ACCESS_TOKEN, session token, o CRON_SECRET para /cron/*
    const headerToken = req.headers.authorization?.split(' ')[1];
    if (headerToken) {
      // Comparacion en tiempo constante: un === revela por su duracion cuantos
      // caracteres acerto quien prueba, y el token se adivina de a uno.
      if (comparacionSegura(headerToken, process.env.APP_ACCESS_TOKEN || '')) return next();
      if (verifySessionToken(headerToken)) return next();
      // Vercel Cron y pg_net llaman con Bearer CRON_SECRET. Solo vale para rutas de cron.
      if (req.path.startsWith('/cron/') && process.env.CRON_SECRET && comparacionSegura(headerToken, process.env.CRON_SECRET)) return next();
    }

    if (verifySessionToken(req.cookies?.auth_token)) return next();

    return res.status(401).json({ error: 'Unauthorized' });
  };