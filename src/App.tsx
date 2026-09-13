import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useJSON } from './components/ui';
import { LimiteDeError } from './components/LimiteDeError';
import { GlobalToast } from './components/GlobalToast';
import { TerminoProvider } from './components/Termino';
import { Ayuda } from './components/Ayuda';
import { Bandeja } from './components/Bandeja';
import { type SegmentoCuenta } from './components/Cuenta';
import { Campana, type Novedad } from './components/Campana';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { CommandPalette } from './components/CommandPalette';

// Los tabs pesados cargan al entrar por primera vez: la Bandeja (el home) llega
// antes. El chunk queda cacheado, así que el costo se paga una sola vez.
const Cuenta = React.lazy(() => import('./components/Cuenta').then(m => ({ default: m.Cuenta })));
const Datos = React.lazy(() => import('./components/Datos').then(m => ({ default: m.Datos })));
const Herramientas = React.lazy(() => import('./components/Herramientas').then(m => ({ default: m.Herramientas })));
const Sistema = React.lazy(() => import('./components/Sistema').then(m => ({ default: m.Sistema })));
import { Drawer } from './components/Drawer';
import { ActionableDrawerContent } from './components/ActionableDrawerContent';
import { useAppStore } from './store/useAppStore';
import type { Actionable } from './types';

// La moneda sale de la cuenta, no de un mapa cableado. Este mapa tenía tres
// entradas y Fresh Monkee caía al 'CLP' por defecto: la app mostraba dólares
// como si fueran pesos chilenos, que es un error de lectura, no de estilo.

// Rutas viejas -> nuevas. Las viejas siguen funcionando (links guardados, mails).
const RUTA_VIEJA: Record<string, { tab: string; seg?: string }> = {
  inicio: { tab: 'bandeja' }, hoy: { tab: 'bandeja' }, accionables: { tab: 'cuenta', seg: 'accionables' }, semana: { tab: 'cuenta', seg: 'semana' },
  briefs: { tab: 'cuenta', seg: 'brief' }, clientes: { tab: 'cuenta', seg: 'diagnostico' },
  memoria: { tab: 'cuenta', seg: 'memoria' }, reportes: { tab: 'cuenta', seg: 'reportes' },
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
  const [datosInicial, setDatosInicial] = useState<{ search?: string; view?: string; origen?: string }>({});
  // Estado de servidor por TanStack Query: el briefing revalida al volver a la
  // pestaña y cada 5 min de fondo; la salud del header se DERIVA, no se copia.
  const qc = useQueryClient();
  const { data: briefingApp } = useJSON<any>('/api/briefing', null, { refetchMs: 300_000 });
  const salud = React.useMemo(() => {
    const b = briefingApp;
    if (!b) return null;
    const pend = (b.accionables_listos?.length || 0) + (b.accionables_por_confirmar || 0) + (b.reportes_por_aprobar?.length || 0) + (b.alertas_hoy?.length || 0);
    return { ok: b.datos_al_dia !== false, pend, texto: b.datos_al_dia === false ? 'Datos con problema' : pend > 0 ? `${pend} pendiente${pend !== 1 ? 's' : ''}` : 'Datos al día · nada pendiente' };
  }, [briefingApp]);
  const [urlBriefId, setUrlBriefId] = useState<string | undefined>(undefined);
  // Banda de aviso cuando NO estás en producción. Sin esto es imposible saber a
  // simple vista si lo que estás mirando escribe en la cuenta real o no.
  const { data: entornoData } = useJSON<any>('/api/entorno', null);
  const bandaEntorno: { color: string; texto: string } | null = entornoData?.banda || null;
  
  const { 
    fetchData, isAuthenticated, authChecked, 
    setAuthChecked, setIsAuthenticated, 
    selectedClient, setSelectedClient, actionables,
    selectedAction, setSelectedAction
  } = useAppStore();

  // Cuentas desde la base, no cableadas: sumar un cliente es una fila en `cuentas`.
  // Sin respaldo cableado. Si el endpoint falla, la lista queda VACÍA y se avisa,
  // en vez de mostrar tres cuentas de las cuatro: una lista incompleta que se ve
  // completa es peor que una vacía, porque nadie sospecha que falta algo.
  const { data: cuentasRaw } = useJSON<any[]>('/api/cuentas', []);
  const cuentas = Array.isArray(cuentasRaw) ? cuentasRaw : [];
  const clients = cuentas.map(c => c.account);
  const monedaDe = (acc: string) => cuentas.find(c => c.account === acc)?.moneda
    || (acc === 'KAREDO' ? 'EUR' : acc === 'FRESH_MONKEE' ? 'USD' : 'CLP');

  // ⌥1–⌥4 cambia de cuenta manteniendo la pantalla (misma vista, otro alcance).
  // Option y no Cmd: el navegador reserva ⌘1-9 para sus pestañas y no se puede
  // cancelar. e.code y no e.key: con Option apretada, e.key da el carácter muerto.
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const m = /^Digit([1-4])$/.exec(e.code);
      if (!m) return;
      const cuenta = clients[Number(m[1]) - 1];
      if (cuenta) { e.preventDefault(); setSelectedClient(cuenta); }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, [clients, setSelectedClient]);

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
      // Las queries disparadas antes del login devolvieron el fallback (401):
      // al entrar, todo se revalida. Antes el header podía quedar vacío hasta
      // el próximo intervalo de 5 minutos.
      qc.invalidateQueries();
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

  // La URL refleja donde estas. Con pushState y no replaceState: con replaceState
  // el boton atras del navegador no volvia a la pantalla anterior sino que SALIA
  // de la app, porque no habia historial que recorrer.
  const ultimaUrl = React.useRef<string>('');
  useEffect(() => {
    if (!isAuthenticated) return;
    const url = new URL(window.location.href);
    url.searchParams.set('page', activeTab);
    if (activeTab === 'cuenta') url.searchParams.set('seg', segmento); else url.searchParams.delete('seg');
    if (selectedClient) url.searchParams.set('cliente', selectedClient);
    // El drawer vive en la URL: back lo cierra, un deep-link lo abre.
    if (selectedAction) url.searchParams.set('acc', selectedAction.id); else url.searchParams.delete('acc');
    const nueva = url.toString();
    if (nueva === ultimaUrl.current) return;
    // La primera vez reemplaza; los cambios de pantalla apilan.
    if (ultimaUrl.current) window.history.pushState({ page: activeTab }, '', nueva);
    else window.history.replaceState({ page: activeTab }, '', nueva);
    ultimaUrl.current = nueva;
  }, [activeTab, segmento, selectedClient, selectedAction, isAuthenticated]);

  // El boton atras vuelve a la pantalla anterior en vez de salir de la app.
  useEffect(() => {
    const alVolver = () => {
      const p = new URLSearchParams(window.location.search);
      const page = p.get('page'); const seg = p.get('seg'); const cli = p.get('cliente'); const acc = p.get('acc');
      ultimaUrl.current = window.location.href;
      if (page) setActiveTab(page as any);
      if (seg) setSegmento(seg as any);
      if (cli) setSelectedClient(cli);
      const st = useAppStore.getState();
      if (acc) { const f = st.actionables.find(a => a.id === acc); if (f) st.setSelectedAction(f); }
      else if (st.selectedAction) st.setSelectedAction(null);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  // Deep-link con ?acc=: abre el drawer apenas los accionables cargan.
  const accInicial = React.useRef<string | null>(new URLSearchParams(window.location.search).get('acc'));
  useEffect(() => {
    if (!accInicial.current || !actionables.length) return;
    const f = actionables.find(a => a.id === accInicial.current);
    accInicial.current = null;
    if (f) { setSelectedClient(f.client); setSelectedAction(f); }
  }, [actionables]);

  // Queue-advance: los pendientes de decisión en el orden de la Bandeja
  // (urgencia primero). El drawer avanza por acá sin volver a la lista.
  const colaPendientes = React.useMemo(() => {
    const orden = (p?: string) => p === 'Urgente' ? 0 : p === 'Alta' ? 1 : p === 'Media' ? 2 : 3;
    return actionables
      .filter(a => (a.status === 'Propuesto' || a.status === 'Bloqueado') && !a.reemplazado_por)
      .sort((a, b) => orden(a.priority) - orden(b.priority));
  }, [actionables]);
  const siguientePendiente = () => {
    if (!selectedAction) return;
    const resto = colaPendientes.filter(a => a.id !== selectedAction.id);
    const mismaCuenta = resto.filter(a => a.client === selectedAction.client);
    const sig = mismaCuenta[0] || resto[0];
    if (sig) { setSelectedClient(sig.client); setSelectedAction(sig); }
    else setSelectedAction(null);
  };

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
    <GlobalToast />
    {bandaEntorno && (
      <div style={{ backgroundColor: bandaEntorno.color }}
        className="fixed top-0 left-0 right-0 z-[300] text-white text-[11px] font-medium text-center py-1 tracking-wide">
        {bandaEntorno.texto}
      </div>
    )}
    <div className={`flex min-h-screen overflow-hidden select-none ${bandaEntorno ? 'pt-6' : ''}`}>
      <Sidebar activeTab={activeTab} onTabChange={(t) => irA(t)} pendientes={salud?.pend ?? 0} sistemaOk={salud?.ok ?? true} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 pb-14 sm:pb-0 sm:ml-16">
        
        {/* Header: una fila, cinco cosas con función — cuentas, estado, novedades, ⌘K.
            Sin etiquetas ni perfil: en una app de un solo operador, "Andrés · Operador
            Principal" era decoración ocupando el lugar de la información. */}
        <header
          className="glass-dense h-14 flex items-center justify-between gap-3 px-4 md:px-6 shrink-0 z-10"
          style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}
        >
          {/* Switcher de cuenta: ⌥1–4, misma vista con otro alcance */}
          <div className="flex items-center p-1 rounded-lg min-w-0 overflow-x-auto" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border)' }}>
            {clients.length === 0 && (
              <span className="px-3 py-1 text-xs text-[#E2B453]" title="El endpoint /api/cuentas no devolvió nada. Mirá Sistema › Salud.">
                No se pudieron cargar las cuentas
              </span>
            )}
            {clients.map((client, i) => {
              const isSelected = (selectedClient || clients[0] || '').toUpperCase() === client;
              return (
                <button
                  key={client}
                  onClick={() => setSelectedClient(client)}
                  title={`Cambiar a ${client} (⌥${i + 1})`}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-[#0062CC] text-[#EDEFF3] shadow-sm'
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
                    {monedaDe(client)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Estado del sistema: un punto. El texto solo cuando dice algo (problema
                o pendientes); "todo bien" no necesita ocupar lugar permanente. */}
            {salud && (
              <span className="flex items-center gap-1.5 text-[11px] tabular" title={salud.texto + ' · Detalle en Sistema › Salud'}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: salud.ok ? '#4ADE80' : 'var(--warn)', boxShadow: salud.ok ? 'none' : '0 0 6px var(--warn)' }} />
                {(!salud.ok || salud.pend > 0) && (
                  <span style={{ color: salud.ok ? 'var(--text-secondary)' : 'var(--warn)' }} className="hidden sm:inline whitespace-nowrap">{salud.texto}</span>
                )}
              </span>
            )}

            <Campana onAbrir={(n: Novedad) => {
              if (n.ref_tipo === 'accionable') { const f = actionables.find(x => x.id === n.ref_id); if (f) { setSelectedClient(f.client); setSelectedAction(f); } else irA('cuenta', n.account || undefined, 'accionables'); }
              else if (n.ref_tipo === 'propuesta') irA('cuenta', n.account || undefined, 'diagnostico');
              else if (n.ref_tipo === 'alerta') irA('bandeja');
              else irA('sistema');
            }} />

            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tabular text-[#EDEFF3] hover:bg-white/10 transition-colors"
              style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}
              title="Buscar e ir a cualquier lado"
            >
              ⌘K
            </button>
          </div>
        </header>

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto relative custom-scrollbar">
          <React.Suspense fallback={<div className="p-8 text-xs text-[#F5F7FA] opacity-40">Cargando…</div>}>
          {/* Cada pantalla con su propio límite: si una falla, las demás siguen. */}
          {activeTab === 'bandeja' && (
            <LimiteDeError nombre="Bandeja">
              <Bandeja onOpenActionable={(act) => setSelectedAction(act)} onGoTo={irA} />
            </LimiteDeError>
          )}

          {activeTab === 'cuenta' && (
            <LimiteDeError nombre="Cuenta">
              <Cuenta segmento={segmento} onSegmento={setSegmento} onOpenActionable={(act) => setSelectedAction(act)} briefId={urlBriefId} onNavigateToBrief={(id) => { setUrlBriefId(id); setSegmento('brief'); }} />
            </LimiteDeError>
          )}

          {activeTab === 'datos' && (
            <LimiteDeError nombre="Datos">
              <Datos initialSearch={datosInicial.search} initialView={datosInicial.view}
                volverA={datosInicial.origen ? {
                  etiqueta: 'Volver al accionable',
                  onVolver: () => {
                    const f = actionables.find(a => a.id === datosInicial.origen);
                    setDatosInicial(d => ({ ...d, origen: undefined }));
                    if (f) { setActiveTab('bandeja'); setSelectedClient(f.client); setSelectedAction(f); }
                  },
                } : undefined} />
            </LimiteDeError>
          )}

          {activeTab === 'herramientas' && (
            <LimiteDeError nombre="Herramientas"><Herramientas /></LimiteDeError>
          )}

          {activeTab === 'sistema' && (
            <LimiteDeError nombre="Sistema"><Sistema /></LimiteDeError>
          )}
          </React.Suspense>
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
            onSiguiente={siguientePendiente}
            quedan={colaPendientes.filter(a => a.id !== selectedAction.id).length}
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
              // El contexto viaja: Datos sabe de qué accionable venís y ofrece volver.
              setDatosInicial({ search: kw, view: 'v_keywords_analisis', origen: selectedAction.id });
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
