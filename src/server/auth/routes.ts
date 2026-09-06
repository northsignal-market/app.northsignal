import { Router } from 'express';
import { createSessionToken, verifySessionToken } from './session';

export const authRouter = Router();

const loginAttempts = new Map<string, { count: number, resetAt: number }>();

// Login Endpoint
  authRouter.post('/login', (req, res) => {
    const { password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    const now = Date.now();
    const attempt = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
    if (now > attempt.resetAt) {
      attempt.count = 0;
      attempt.resetAt = now + 15 * 60 * 1000;
    }
    
    if (attempt.count >= 5) {
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Intente de nuevo en 15 minutos.' });
    }

    if (!process.env.APP_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'APP_ACCESS_TOKEN no está configurado en el servidor' });
    }

    if (password === process.env.APP_ACCESS_TOKEN) {
      const sessionToken = createSessionToken();
      loginAttempts.delete(ip);

      const isProd = process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIE === 'true';
      res.cookie('auth_token', sessionToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
      return res.json({ success: true, token: sessionToken });
    }
    
    attempt.count++;
    loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  });

  // Logout Endpoint
  authRouter.post('/logout', (_req, res) => {
    // Sin estado: el token expira solo. Basta con borrar la cookie.
    const isProd = process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIE === 'true';
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/'
    });
    res.json({ success: true });
  });

  // Me Endpoint (Checks if current session is valid)
  authRouter.get('/me', (req, res) => {
    const headerToken = req.headers.authorization?.split(' ')[1];
    if (headerToken) {
      if (process.env.APP_ACCESS_TOKEN && headerToken === process.env.APP_ACCESS_TOKEN) return res.json({ authenticated: true });
      if (verifySessionToken(headerToken)) return res.json({ authenticated: true });
    }
    if (verifySessionToken(req.cookies?.auth_token)) return res.json({ authenticated: true });
    return res.status(401).json({ error: 'Unauthorized' });
  });