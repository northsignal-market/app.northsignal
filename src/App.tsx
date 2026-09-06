import React, { useState, useEffect } from 'react';
import { TerminoProvider } from './components/Termino';
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

function getInitialPage() {
  const params = new URLSearchParams(window.location.search);
  const p = params.get('page');
  const valid = ['inicio', 'hoy', 'accionables', 'semana', 'briefs', 'datos', 'clientes', 'herramientas', 'sistema'];
  return p && valid.includes(p) ? p : 'inicio';
}

function App() {
  const [activeTab, setActiveTab] = useState<string>(getInitialPage);
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
      if (!params.get('page')) setActiveTab('inicio');
    }
    wasAuth.current = isAuthenticated;
  }, [isAuthenticated, authChecked]);

  // Sync active page & client with URL
  useEffect(() => {
    if (!isAuthenticated) return;
    const url = new URL(window.location.href);
    url.searchParams.set('page', activeTab);
    if (selectedClient) {
      url.searchParams.set('cliente', selectedClient);
    }
    window.history.replaceState({}, '', url.toString());
  }, [activeTab, selectedClient, isAuthenticated]);

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
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
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
          {activeTab === 'inicio' && (
            <Inicio 
              onNavigate={(page, client) => {
                if (client) setSelectedClient(client);
                setActiveTab(page);
              }} 
            />
          )}

          {activeTab === 'hoy' && (
            <Hoy 
              onOpenActionable={(a) => setSelectedAction(a)}
              onNavigate={(p, params) => {
                if (params?.briefId) setUrlBriefId(params.briefId);
                setActiveTab(p);
              }}
            />
          )}

          {activeTab === 'accionables' && (
            <Accionables 
              onOpenActionable={(a) => setSelectedAction(a)}
              initialClient={selectedClient || 'all'}
            />
          )}

          {activeTab === 'semana' && (
            <Semana 
              onOpenActionable={(id) => {
                const found = actionables.find(a => a.id === id);
                if (found) setSelectedAction(found);
              }}
            />
          )}

          {activeTab === 'briefs' && (
            <Briefs 
              onOpenActionable={(id) => {
                const found = actionables.find(a => a.id === id);
                if (found) setSelectedAction(found);
              }}
              initialBriefId={urlBriefId}
            />
          )}

          {activeTab === 'datos' && (
            <Datos 
              onOpenActionable={(id) => {
                const found = actionables.find(a => a.id === id);
                if (found) setSelectedAction(found);
              }}
            />
          )}

          {activeTab === 'clientes' && (
            <Clientes 
              onOpenActionable={(a) => setSelectedAction(a)}
              onNavigateToBrief={(briefId) => {
                setUrlBriefId(briefId);
                setActiveTab('briefs');
              }}
            />
          )}

          {activeTab === 'herramientas' && (
            <Herramientas />
          )}

          {activeTab === 'sistema' && (
            <Sistema />
          )}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
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
              setActiveTab('briefs');
            }}
            onNavigateToKeyword={(kw) => {
              setSelectedAction(null);
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
