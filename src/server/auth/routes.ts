import { Router } from 'express';
import { createSessionToken, verifySessionToken } from './session';
import { ipDe, verificarLimite, registrarIntento } from './limite';
import { comparacionSegura } from '../lib/signatures';

// El límite vive en Postgres, no en memoria: un Map no persiste entre instancias
// de Vercel, así que cada arranque en frío lo reiniciaba y bastaba con caer en
// instancias distintas para nunca acumular intentos.
export function crearAuthRouter(supabase: any) {
  const authRouter = Router();

// Login Endpoint
  authRouter.post('/login', async (req, res) => {
    const { password } = req.body;
    const ip = ipDe(req);

    // Tras 5 fallos la espera crece exponencialmente, hasta una hora.
    const v = await verificarLimite(supabase, ip, '/login', 10, 15);
    if (!v.permitido) {
      return res.status(429).json({
        error: v.motivo === 'demasiados intentos fallidos'
          ? `Demasiados intentos fallidos. Probá de nuevo en ${Math.ceil((v.esperar || 60) / 60)} minuto(s).`
          : `Demasiados intentos. Probá de nuevo en ${Math.ceil((v.esperar || 60) / 60)} minuto(s).`,
        esperar_segundos: v.esperar
      });
    }

    if (!process.env.APP_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'APP_ACCESS_TOKEN no está configurado en el servidor' });
    }

    // En tiempo constante: es la puerta de entrada a todos los datos de los clientes.
    if (comparacionSegura(String(password || ''), process.env.APP_ACCESS_TOKEN)) {
      const sessionToken = createSessionToken();
      await registrarIntento(supabase, ip, '/login', true);

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
    
    await registrarIntento(supabase, ip, '/login', false, 'contraseña incorrecta');
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
      if (process.env.APP_ACCESS_TOKEN && comparacionSegura(headerToken, process.env.APP_ACCESS_TOKEN)) return res.json({ authenticated: true });
      if (verifySessionToken(headerToken)) return res.json({ authenticated: true });
    }
    if (verifySessionToken(req.cookies?.auth_token)) return res.json({ authenticated: true });
    return res.status(401).json({ error: 'Unauthorized' });
  });

  return authRouter;
}
