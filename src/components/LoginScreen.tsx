import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Lock, LogIn } from 'lucide-react';

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
    <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center p-4 relative">
      <div className="max-w-md w-full relative z-10">
        <div className="bg-[var(--surface-1)] border border-[rgba(255,255,255,0.12)] rounded-xl p-8 shadow-xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#1A1F36] border border-[#0062CC]/30 rounded-xl flex items-center justify-center overflow-hidden p-2.5 shadow-sm">
              <img 
                src="https://djbwxgicosargfobsmqd.supabase.co/storage/v1/object/public/logos/ChatGPT%20Image%204%20sept%202026,%2007_31_34%20p.m..png" 
                alt="NorthSignal Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-[#FFFFFF] tracking-tight mb-1.5">
              NorthSignal <span className="text-[#0062CC]">OS</span>
            </h2>
            <p className="text-[#F5F7FA]/60 text-xs font-medium tracking-wider uppercase">
              Control de Rendimiento & Operaciones
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#F5F7FA]/70 uppercase tracking-wider pl-1">
                Clave de Acceso
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1A1F36] border border-[#0062CC]/20 rounded-xl px-4 py-3.5 text-[#FFFFFF] placeholder-[#F5F7FA]/30 focus:outline-none focus:border-[#0062CC]/60 focus:ring-1 focus:ring-[#0062CC]/60 transition-all shadow-inner"
              />
            </div>
            
            {error && (
              <div className="text-[#0062CC] text-sm text-center bg-[#0062CC]/10 border border-[#0062CC]/20 py-2.5 rounded-xl font-medium animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full bg-[#0062CC] text-[#FFFFFF] font-semibold py-3.5 rounded-xl hover:bg-[var(--primary-hover)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_8px_16px_rgba(0,98,204,0.2)] hover:shadow-[0_8px_20px_rgba(0,98,204,0.3)] hover:-translate-y-0.5 active:translate-y-0"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-[#FFFFFF]/20 border-t-[#FFFFFF] rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  Acceder al Sistema
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
