import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from './session';

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

    // Header: APP_ACCESS_TOKEN o session token
    const headerToken = req.headers.authorization?.split(' ')[1];
    if (headerToken) {
      if (headerToken === process.env.APP_ACCESS_TOKEN) return next();
      if (verifySessionToken(headerToken)) return next();
    }

    if (verifySessionToken(req.cookies?.auth_token)) return next();

    return res.status(401).json({ error: 'Unauthorized' });
  };