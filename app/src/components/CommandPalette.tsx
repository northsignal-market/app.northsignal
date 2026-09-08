import React, { useEffect, useState, useRef } from 'react';
import { useCuentas } from '../lib/useCuentas';
import { useAppStore } from '../store/useAppStore';
import { Search, ChevronRight, X } from 'lucide-react';
import type { Actionable } from '../types';

export function CommandPalette({ 
  activeTab, 
  onTabChange,
  onOpenActionable
}: { 
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenActionable?: (action: Actionable) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const setSelectedClient = useAppStore(state => state.setSelectedClient);
  const actionables = useAppStore(state => state.actionables);
  const notionBriefs = useAppStore(state => state.notionBriefs);
  
  // Las cuentas salen de la base. Con la lista fija, Fresh Monkee no aparecía
  // al buscar y no se podía cambiar a ella desde la paleta.
  const { nombres: clients } = useCuentas();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      if (e.key === '/' && !isOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) { setQuery(''); return; }
    // El temporizador se limpia al cerrar: si no, queda pendiente e intenta enfocar
    // un campo que ya no está montado. React avisa por consola y en el peor caso
    // el foco salta a otro lado 50 ms después de cerrar.
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const results: Array<{ type: string; title: string; onSelect: () => void }> = [];
  const q = query.toLowerCase();

  // 1. Views
  const views = [
    { id: 'bandeja', label: 'Bandeja: lo que espera tu criterio' },
    { id: 'cuenta', label: 'Cuenta: semana, diagnóstico, brief, accionables, memoria, reportes' },
    { id: 'semana', label: 'Cuenta › Semana: gráfico, plan, día por día' },
    { id: 'clientes', label: 'Cuenta › Diagnóstico: por qué está donde está' },
    { id: 'briefs', label: 'Cuenta › Brief del lunes' },
    { id: 'accionables', label: 'Cuenta › Todos los accionables' },
    { id: 'datos', label: 'Datos: tablas por campaña, grupo, keyword, término' },
    { id: 'herramientas', label: 'Herramientas: escribir anuncios, guía de operación' },
    { id: 'sistema', label: 'Sistema: salud, aprendizaje, automatización, soporte' },
  ];
  views.forEach(v => {
    if (v.label.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)) {
      results.push({ type: 'Vista', title: v.label, onSelect: () => { onTabChange(v.id); setIsOpen(false); } });
    }
  });

  // Cerrar sesión: en la barra lateral solo aparece en escritorio, porque en móvil
  // la barra es horizontal y el espacio es para navegar. Acá queda siempre accesible.
  if ('cerrar sesion salir logout'.includes(q) && q.length >= 2) {
    results.push({
      type: 'Sesión', title: 'Cerrar sesión',
      onSelect: async () => {
        setIsOpen(false);
        try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); } catch { }
        try { localStorage.removeItem('auth_token'); } catch { }
        window.location.reload();
      }
    });
  }

  // 2. Clients
  clients.forEach(c => {
    if (c.toLowerCase().includes(q)) {
      results.push({ type: 'Cliente', title: `Cambiar a cuenta ${c}`, onSelect: () => { setSelectedClient(c); setIsOpen(false); } });
    }
  });

  // 3. Actionables
  if (q.length > 2) {
    actionables.forEach(a => {
      if (a.title.toLowerCase().includes(q) || (a.why && a.why.toLowerCase().includes(q))) {
        results.push({ 
          type: 'Accionable', 
          title: `[${a.client}] ${a.title}`, 
          onSelect: () => { 
            setSelectedClient(a.client); 
            if (onOpenActionable) {
              onOpenActionable(a);
            } else {
              onTabChange('accionables');
            }
            setIsOpen(false);
          } 
        });
      }
    });
  }

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      style={{ backgroundColor: 'rgba(15, 20, 36, 0.75)' }}
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="glass-dense w-full max-w-xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div 
          className="flex items-center px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
        >
          <Search size={18} className="text-[#0062CC] shrink-0" />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Buscar página, cliente, o accionable..."
            className="w-full bg-transparent border-none text-[#FFFFFF] px-3 focus:outline-none text-sm placeholder-[#F5F7FA]/40"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button 
            onClick={() => setIsOpen(false)} 
            className="text-[#F5F7FA] opacity-60 hover:opacity-100 p-1 rounded"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2 space-y-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#F5F7FA] opacity-50 italic">
              No se encontraron resultados
            </div>
          ) : (
            results.map((r, i) => (
              <button 
                key={i}
                onClick={r.onSelect}
                className="w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-center justify-between group hover:bg-white/5"
                style={{ backgroundColor: 'transparent' }}
              >
                <div className="min-w-0 pr-2">
                  <span className="text-[10px] font-bold text-[#0062CC] uppercase tracking-wider block mb-0.5">
                    {r.type}
                  </span>
                  <span className="text-xs text-[#FFFFFF] font-medium block truncate">
                    {r.title}
                  </span>
                </div>
                <ChevronRight size={14} className="text-[#F5F7FA] opacity-40 group-hover:text-[#FFFFFF] shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
