import React, { useState } from 'react';
import { Sparkles, Sliders, Cpu } from 'lucide-react';
import { RSAFactory } from './RSAFactory';
import { OptimizationsHub } from './OptimizationsHub';

export function Herramientas() {
  const [activeTool, setActiveTool] = useState<'rsa' | 'playbook'>('rsa');

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">
            Herramientas & Automatizaciones
          </h1>
          <p className="text-xs text-[#F5F7FA] opacity-70 mt-0.5">
            Escribir anuncios desde lo que la gente busca, y la guía de cómo operar el sistema
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTool('rsa')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'rsa' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'
            }`}
          >
            <Sparkles size={13} />
            <span>RSA Factory</span>
          </button>
          <button
            onClick={() => setActiveTool('playbook')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTool === 'playbook' ? 'bg-[#0062CC] text-[#FFFFFF]' : 'text-[#F5F7FA] opacity-70 hover:opacity-100'
            }`}
          >
            <Sliders size={13} />
            <span>Guía de operación</span>
          </button>
        </div>
      </div>

      {/* Tool Content */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface-0)' }}>
        {activeTool === 'rsa' ? <RSAFactory /> : <OptimizationsHub />}
      </div>

    </div>
  );
}
