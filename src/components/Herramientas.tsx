import React, { useState } from 'react';
import { Sparkles, Sliders } from 'lucide-react';
import { RSAFactory } from './RSAFactory';
import { OptimizationsHub } from './OptimizationsHub';

export function Herramientas() {
  const [activeTool, setActiveTool] = useState<'rsa' | 'playbook'>('rsa');

  return (
    <div className="h-full flex flex-col">
      {/* Una sola fila de chrome: dos pestañas, sin título que repita lo que ya
          dice el menú. El contenido manda desde el primer píxel. */}
      <div className="px-5 md:px-7 shrink-0 flex gap-0.5 -mb-px" style={{ borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'rsa' as const, label: 'Escribir anuncios', icono: <Sparkles size={12} /> },
          { id: 'playbook' as const, label: 'Guía de operación', icono: <Sliders size={12} /> },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)}
            className={`px-3.5 py-2.5 text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTool === t.id ? 'text-[#EDEFF3] font-medium' : 'text-[#F5F7FA] opacity-60 hover:opacity-100'}`}
            style={{ borderBottom: activeTool === t.id ? '2px solid var(--primary)' : '2px solid transparent' }}>
            {t.icono}{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {activeTool === 'rsa' ? <RSAFactory /> : <OptimizationsHub />}
      </div>
    </div>
  );
}
