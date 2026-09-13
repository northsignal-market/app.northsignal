import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LogIn } from 'lucide-react';

/**
 * LOGIN · el escenario (Beta Ambient, informe 16).
 * La única pantalla sin datos que existe siempre: acá — y solo acá — vive el
 * orbe. Azul de la casa sobre el lienzo del body, tarjeta de vidrio con
 * fallback sólido (la regla sólido-primero la da el CSS de .glass).
 * La lógica de sesión no cambió: password → /api/login → token.
 */
export function LoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setIsAuthenticated, fetchData } = useAppStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
        setIsAuthenticated(true);
        fetchData();
      } else {
        const isJson = res.headers.get('content-type')?.includes('application/json');
        const data = isJson ? await res.json() : {};
        setError(data.error || 'Contraseña incorrecta');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="max-w-sm w-full relative z-10 flex flex-col items-center">
        {/* El orbe con sus anillos-pedestal, dentro de su bloom: ilumina el
            lienzo en vez de flotar pegado. Respira despacio; con
            prefers-reduced-motion queda quieto (regla global). */}
        <div className="orbe-escena mb-11" aria-hidden="true">
          <div className="orbe" />
        </div>

        <div className="text-center mb-7">
          <h1 className="text-[22px] font-semibold text-[#FAFAFA] tracking-tight">
            North Signal
          </h1>
          <p className="text-[11px] mt-1 tracking-wider uppercase" style={{ color: '#ADADAD', letterSpacing: '0.3px' }}>
            Cuatro cuentas, un criterio: el tuyo
          </p>
        </div>

        <form onSubmit={handleLogin} className="w-full glass rounded-2xl p-5 space-y-4" style={{ borderRadius: 16 }}>
          <input
            type="password"
            autoFocus
            aria-label="Clave de acceso"
            placeholder="Clave de acceso"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent rounded-xl px-4 py-3 text-sm text-[#EDEFF3] placeholder-[#F5F7FA]/35 focus:outline-none transition-colors"
            style={{ border: '1px solid var(--border-strong)', backgroundColor: 'color-mix(in srgb, var(--navy) 55%, transparent)', borderRadius: 10 }}
          />

          {error && (
            <div className="text-[#F97066] text-xs text-center bg-[#F97066]/10 border border-[#F97066]/25 py-2 rounded-lg font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-[#0062CC] text-[#EDEFF3] font-semibold py-3 text-sm rounded-xl hover:bg-[var(--primary-hover)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_10px_24px_-8px_rgba(0,98,204,0.55)]"
            style={{ borderRadius: 10 }}
          >
            {isLoading ? (
              <div className="w-4 h-4 rounded-full animate-spin border-2 border-[#FFFFFF]/20 border-t-[#FFFFFF]" />
            ) : (
              <>
                <LogIn size={15} />
                Entrar
              </>
            )}
          </button>
        </form>

        <p className="text-[10px] mt-6 tabular" style={{ color: '#ADADAD', opacity: 0.6 }}>
          beta · nada cambia en Google Ads sin tu aprobación
        </p>
      </div>
    </div>
  );
}
