import React, { useState, useEffect } from 'react';
import { TerminoProvider } from './components/Termino';
import { Ayuda } from './components/Ayuda';
import { Bandeja } from './components/Bandeja';
import { Cuenta, type SegmentoCuenta } from './components/Cuenta';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { Inicio } from './components/Inicio';
import { Hoy } from './components/Hoy';
import { Accionables } from './components/Accionables';
import { Semana } from './components/Semana';
import { Briefs } from './components/Briefs';
import { Datos } from './components/Datos';
import { Clientes } from './components/Clientes';
import { Herramientas } from './components/Herramientas';
import { Sistema } from './components/Sistema';
import { CommandPalette } from './components/CommandPalette';
import { Drawer } from './components/Drawer';
import { ActionableDrawerContent } from './components/ActionableDrawerContent';
import { useAppStore } from './store/useAppStore';
import type { Actionable } from './types';

const CLIENT_CURRENCIES: Record<string, string> = {
  'KAREDO': 'EUR',
  'BHI': 'CLP',
  '360': 'CLP'
};

// Rutas viejas -> nuevas. Las viejas siguen funcionando (links guardados, mails).
const RUTA_VIEJA: Record<string, { tab: string; seg?: string }> = {
  inicio: { tab: 'bandeja' }, hoy: { tab: 'bandeja' }, accionables: { tab: 'cuenta', seg: 'accionables' }, semana: { tab: 'cuenta', seg: 'semana' },
  briefs: { tab: 'cuenta', seg: 'brief' }, clientes: { tab: 'cuenta', seg: 'diagnostico' },
};
function getInitialPage() {
  const params = new URLSearchParams(window.location.search);
  const p = params.get('page') || '';
  const valid = ['bandeja', 'cuenta', 'datos', 'herramientas', 'sistema'];
  if (valid.includes(p)) return p;
  if (RUTA_VIEJA[p]) return RUTA_VIEJA[p].tab;
  return 'bandeja';
}
function getInitialSegmento(): any {
  const params = new URLSearchParams(window.location.search);
  const s = params.get('seg'); const p = params.get('page') || '';
  if (s) return s;
  if (RUTA_VIEJA[p]?.seg) return RUTA_VIEJA[p].seg;
  return 'semana';
}

function App() {
  const [activeTab, setActiveTab] = useState<string>(getInitialPage);
  const [segmento, setSegmento] = useState<SegmentoCuenta>(getInitialSegmento);
  const irA = (tab: string, client?: string, seg?: string) => {
    if (client) setSelectedClient(client);
    const m = RUTA_VIEJA[tab];
    if (m) { if (m.seg) setSegmento(m.seg as SegmentoCuenta); setActiveTab(m.tab); return; }
    if (seg) setSegmento(seg as SegmentoCuenta);
    setActiveTab(tab);
  };
  const [datosInicial, setDatosInicial] = useState<{ search?: string; view?: string }>({});
  const [salud, setSalud] = useState<{ ok: boolean; texto: string } | null>(null);
  useEffect(() => {
    const cargar = () => fetch('/api/briefing', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then((b: any) => {
      if (!b) return;
      const pend = (b.accionables_listos?.length || 0) + (b.accionables_por_confirmar || 0) + (b.reportes_por_aprobar?.length || 0) + (b.alertas_hoy?.length || 0);
      setSalud({ ok: b.datos_al_dia !== false, texto: b.datos_al_dia === false ? 'Datos con problema' : pend === 0 ? 'Datos al día · nada pendiente' : `Datos al día · ${pend} pendiente${pend !== 1 ? 's' : ''}` });
    }).catch(() => {});
    cargar(); const t = setInterval(cargar, 5 * 60 * 1000); return () => clearInterval(t);
  }, []);
  const [urlBriefId, setUrlBriefId] = useState<string | undefined>(undefined);
  
  const { 
    fetchData, isAuthenticated, authChecked, 
    setAuthChecked, setIsAuthenticated, 
    selectedClient, setSelectedClient, actionables,
    selectedAction, setSelectedAction
  } = useAppStore();

  const clients = ['360', 'BHI', 'KAREDO'];

  // Check authentication
  useEffect(() => {
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = {};
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }

    fetch('/api/me', { credentials: 'include', headers })
      .then(res => {
        if (res.ok) setIsAuthenticated(true);
        else {
          if (savedToken) localStorage.removeItem('auth_token');
          setIsAuthenticated(false);
        }
        setAuthChecked(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setAuthChecked(true);
      });
  }, [setIsAuthenticated, setAuthChecked]);

  // Fetch initial data
  useEffect(() => {
    if (authChecked && isAuthenticated) {
      fetchData();
    }
  }, [fetchData, isAuthenticated, authChecked]);

  // Tras iniciar sesión, siempre Inicio: es la antesala. La URL con ?page=
  // se respeta solo al recargar con sesión ya activa.
  const wasAuth = React.useRef(false);
  useEffect(() => {
    if (isAuthenticated && !wasAuth.current && authChecked) {
      const params = new URLSearchParams(window.location.search);
      if (!params.get('page')) setActiveTab('bandeja');
    }
    wasAuth.current = isAuthenticated;
  }, [isAuthenticated, authChecked]);

  // Sync active page & client with URL
  useEffect(() => {
    if (!isAuthenticated) return;
    const url = new URL(window.location.href);
    url.searchParams.set('page', activeTab);
    if (activeTab === 'cuenta') url.searchParams.set('seg', segmento); else url.searchParams.delete('seg');
    if (selectedClient) {
      url.searchParams.set('cliente', selectedClient);
    }
    window.history.replaceState({}, '', url.toString());
  }, [activeTab, segmento, selectedClient, isAuthenticated]);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--surface-0)' }}>
        <div className="w-8 h-8 rounded-full animate-spin border-2 border-transparent border-t-[#0062CC]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <TerminoProvider>
    <div className="flex min-h-screen overflow-hidden select-none">
      <Sidebar activeTab={activeTab} onTabChange={(t) => irA(t)} />
      
      <div className="ml-16 flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300">
        
        {/* Global Persistent Header */}
        <header 
          className="glass-dense h-16 flex items-center justify-between px-6 shrink-0 z-10"
          style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}
        >
          {/* Active Client Selector with Currency Badges */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#F5F7FA] opacity-60 uppercase tracking-wider hidden sm:inline">
              Cuenta:
            </span>
            <div className="flex p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
              {salud && <span className="text-[10px] mr-3 tabular" style={{ color: salud.ok ? 'rgba(245,247,250,0.5)' : '#0062CC' }} title="Estado de los datos y lo que espera tu criterio">{salud.texto}</span>}
              {clients.map(client => {
                const isSelected = (selectedClient || '360').toUpperCase() === client;
                return (
                  <button
                    key={client}
                    onClick={() => setSelectedClient(client)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-[#0062CC] text-[#FFFFFF] shadow-sm' 
                        : 'text-[#F5F7FA] opacity-70 hover:opacity-100 hover:bg-white/5'
                    }`}
                  >
                    <span>{client}</span>
                    <span 
                      className="px-1.5 py-0.2 rounded text-[10px] font-bold"
                      style={{
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'var(--surface-2)',
                        color: isSelected ? '#FFFFFF' : 'var(--gray)'
                      }}
                    >
                      {CLIENT_CURRENCIES[client] || 'CLP'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Right Header: Cmd+K and User Profile */}
          <div className="flex items-center gap-4">
            <span className="hidden md:inline-flex items-center text-xs text-[#F5F7FA] opacity-70">
              <span 
                className="px-2 py-0.5 rounded text-[11px] font-bold mr-1.5 tabular"
                style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: '#FFFFFF' }}
              >
                Cmd+K
              </span>
              <span>comandos</span>
            </span>

            {/* Operator Profile */}
            <div className="flex items-center gap-2.5 pl-3" style={{ borderLeft: '1px solid var(--border)' }}>
              <div className="text-right hidden sm:block">
                <span className="text-xs font-bold text-[#FFFFFF] block leading-tight">
                  Andrés
                </span>
                <span className="text-[10px] text-[#F5F7FA] opacity-60 block">
                  Operador Principal
                </span>
              </div>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#FFFFFF] shadow-sm"
                style={{ backgroundColor: '#0062CC' }}
              >
                AB
              </div>
            </div>
          </div>
        </header>

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto relative custom-scrollbar">
          {activeTab === 'bandeja' && (
            <Bandeja onOpenActionable={(act) => setSelectedAction(act)} onGoTo={irA} />
          )}

          {activeTab === 'cuenta' && (
            <Cuenta segmento={segmento} onSegmento={setSegmento} onOpenActionable={(act) => setSelectedAction(act)} briefId={urlBriefId} onNavigateToBrief={(id) => { setUrlBriefId(id); setSegmento('brief'); }} />
          )}

          {activeTab === 'datos' && (
            <Datos initialSearch={datosInicial.search} initialView={datosInicial.view} />
          )}

          {activeTab === 'herramientas' && (
            <Herramientas />
          )}

          {activeTab === 'sistema' && (
            <Sistema />
          )}
        </main>
      </div>

      {/* Ayuda flotante: preguntar y reportar */}
      <Ayuda pagina={activeTab} />

      {/* Global Command Palette */}
      <CommandPalette 
        activeTab={activeTab} 
        onTabChange={(t) => irA(t)}
        onOpenActionable={(a) => setSelectedAction(a)}
      />

      {/* Reusable Actionable Drawer (Replaces modal) */}
      <Drawer
        isOpen={Boolean(selectedAction)}
        onClose={() => setSelectedAction(null)}
        title={selectedAction ? selectedAction.title : 'Detalle de Accionable'}
        subtitle={selectedAction ? `Cliente: ${selectedAction.client} · Prioridad: ${selectedAction.priority}` : ''}
      >
        {selectedAction && (
          <ActionableDrawerContent
            action={selectedAction}
            onActionChange={(updated) => setSelectedAction(updated)}
            onNavigateToActionable={(nextId) => {
              const next = actionables.find(a => a.id === nextId);
              if (next) setSelectedAction(next);
            }}
            onNavigateToBrief={(briefId) => {
              setSelectedAction(null);
              setUrlBriefId(briefId);
              setSegmento('brief');
              setActiveTab('cuenta');
            }}
            onNavigateToKeyword={(kw) => {
              setSelectedAction(null);
              setDatosInicial({ search: kw, view: 'v_keywords_analisis' });
              setActiveTab('datos');
            }}
          />
        )}
      </Drawer>
    </div>
    </TerminoProvider>
  );
}

export default App;
