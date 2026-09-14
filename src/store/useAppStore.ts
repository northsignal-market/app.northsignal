import { create } from 'zustand';
import type { Actionable, Brief } from '../types';

export interface NotionBrief {
  id: string;
  client: string;
  title: string;
  headline: string;
  status: string;
  spend: number;
  cpa: number;
  conversions: number;
  highAlerts: number;
  url: string;
  created_at?: string;
  semana?: string;
  brief_anterior?: string | null;
  brief_siguiente?: string | null;
  handoff?: string;
  lecciones?: string;
  dias_provisionales?: number;
}

interface AppState {
  supabaseBriefs: Brief[];
  notionBriefs: NotionBrief[];
  actionables: Actionable[];
  selectedClient: string | null;
  selectedAction: Actionable | null;
  dateRange: '4w' | '8w' | 'all';
  status: { supabase: boolean; notion: boolean };
  errors: { supabase?: string; notion?: string };
  loading: boolean;
  isAuthenticated: boolean;
  authChecked: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  setAuthChecked: (checked: boolean) => void;
  error: string | null;
  systemHealth: any;
  analyzingActions: Record<string, boolean>;
  analysisErrors: Record<string, string>;
  clearAnalysisError: (id: string) => void;
  notifications: any[];
  refreshKey: number;
  addNotification: (n: any) => void;
  removeNotification: (id: string) => void;
  incrementRefreshKey: () => void;
  analyzeAction: (action: Actionable, force?: boolean) => Promise<any>;
  clearAnalyzingActions: () => void;

  setSelectedClient: (client: string | null) => void;
  setSelectedAction: (action: Actionable | null) => void;
  setDateRange: (range: '4w' | '8w' | 'all') => void;
  fetchData: () => Promise<void>;
  updateActionableStatus: (id: string, newStatus: string, resolutionNote?: string) => Promise<void>;
}

const getInitialAnalyzing = () => {
  try {
    const savedTime = localStorage.getItem('analyzingActions_time');
    const now = Date.now();
    // If saved more than 2 minutes ago, consider it stale and clear
    if (savedTime && now - Number(savedTime) > 120000) {
      localStorage.removeItem('analyzingActions');
      localStorage.removeItem('analyzingActions_time');
      return {};
    }
    return JSON.parse(localStorage.getItem('analyzingActions') || '{}');
  } catch (e) {
    return {};
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  supabaseBriefs: [],
  notionBriefs: [],
  actionables: [],
  selectedClient: null,
  selectedAction: null,
  dateRange: 'all',
  status: { supabase: false, notion: false },
  errors: {},
  loading: true,
  isAuthenticated: false,
  authChecked: false,
  setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
  setAuthChecked: (checked) => set({ authChecked: checked }),
  error: null, systemHealth: null,
  analyzingActions: getInitialAnalyzing(),
  analysisErrors: {},
  clearAnalysisError: (id) => set((state) => {
    const errs = { ...state.analysisErrors };
    delete errs[id];
    return { analysisErrors: errs };
  }),
  notifications: [],
  refreshKey: 0,
  addNotification: (n) => set((state) => ({ notifications: [...state.notifications, { ...n, id: Date.now().toString() }] })),
  removeNotification: (id) => set((state) => ({ notifications: state.notifications.filter(x => x.id !== id) })),
  incrementRefreshKey: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
  analyzeAction: async (action, force = false) => {
    const { analyzingActions, addNotification } = get();
    if (analyzingActions[action.id]) return;
    
    set((state) => {
      const errs = { ...state.analysisErrors };
      delete errs[action.id];
      return { analysisErrors: errs };
    });
    
    const newAnalyzing = { ...get().analyzingActions, [action.id]: true };
    set({ analyzingActions: newAnalyzing });
    localStorage.setItem('analyzingActions', JSON.stringify(newAnalyzing));
    localStorage.setItem('analyzingActions_time', Date.now().toString());

    try {
      const res = await fetch(`/api/notion/actionables/${action.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, force }),
        credentials: 'include'
      });
      const data = await res.json();
      
      // Si ya existía análisis y requiere confirmación
      if (res.status === 409 && data.requiresConfirmation) {
        return data;
      }

      if (!res.ok) {
        const errorMsg = data.reason || data.error || 'El análisis no se pudo completar';
        set((state) => ({
          analysisErrors: { ...state.analysisErrors, [action.id]: errorMsg }
        }));
        addNotification({
          title: 'Error de Análisis IA',
          message: errorMsg,
          type: 'error'
        });
        return { error: errorMsg };
      } else {
        addNotification({
          title: 'Análisis Finalizado',
          message: 'El proceso de análisis de segunda opinión ha finalizado exitosamente.',
          type: 'success'
        });
        get().incrementRefreshKey();
        return { success: true, data };
      }
    } catch (e: any) {
      const errorMsg = e.message || String(e);
      set((state) => ({
        analysisErrors: { ...state.analysisErrors, [action.id]: errorMsg }
      }));
      addNotification({
        title: 'Error de Análisis',
        message: errorMsg,
        type: 'error'
      });
      return { error: errorMsg };
    } finally {
      const fallbackAnalyzing = { ...get().analyzingActions };
      delete fallbackAnalyzing[action.id];
      set({ analyzingActions: fallbackAnalyzing });
      localStorage.setItem('analyzingActions', JSON.stringify(fallbackAnalyzing));
    }
  },

  clearAnalyzingActions: () => {
    set({ analyzingActions: {} });
    localStorage.removeItem('analyzingActions');
    localStorage.removeItem('analyzingActions_time');
    
  },
  
  // Acá vivía subscribeRealtime(): un canal de Supabase sobre pending_mutations que
  // refrescaba el store cuando cambiaba una mutación. Nunca corrió en producción, porque
  // pedía VITE_SUPABASE_ANON_KEY y esa variable no está cargada en Vercel.
  //
  // Se borra en vez de arreglarse, y el motivo importa más que el borrado:
  //
  // 1. Cargar la variable no lo arreglaría. `pending_mutations` tiene RLS activo y el
  //    esquema public no tiene ni una policy: con RLS prendido y sin policy, anon no lee
  //    ninguna fila. El canal se suscribiría bien y no llegaría nunca un evento. Sería
  //    código que parece vivo, que es peor que código que se ve muerto.
  //
  // 2. Vite hace inline de todo lo que empieza con VITE_ en el bundle. Cargarla sería
  //    publicar una credencial del proyecto en el JS que baja cada navegador, para una
  //    arquitectura donde el browser deliberadamente no habla con Supabase: la única mano
  //    que toca la base es el servidor Express con SUPABASE_SERVICE_ROLE_KEY
  //    (src/server/lib/supabase.ts), que es también donde viven la sesión y el límite de
  //    tasa. Un canal directo desde el browser sería la primera puerta que los saltea.
  //
  // Nada se pierde: analyzeAction espera el POST y llama a incrementRefreshKey(), así que
  // el refresco ya estaba cubierto por el camino que sí corre. Si algún día hace falta
  // push de verdad, la forma que encaja con esta arquitectura es SSE o websocket desde el
  // servidor, no un cliente de Supabase en el browser.

  setSelectedClient: (client) => set({ selectedClient: client }),
  setSelectedAction: (action) => set({ selectedAction: action }),
  setDateRange: (range) => set({ dateRange: range }),
  
  
  updateActionableStatus: async (id: string, newStatus: string) => {
    // Optimistic update
    const previousActionables = get().actionables;
    set({
      actionables: previousActionables.map(a => 
        a.id === id ? { ...a, status: newStatus } : a
      )
    });

    try {
      const res = await fetch(`/api/notion/actionables/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status in Notion');
    } catch (e) {
      console.error(e);
      // Revert on error
      set({ actionables: previousActionables });
    }
  },
  
  fetchData: async () => {

    // Prevent refetching if already loading, unless it's initial
    set({ loading: true, error: null });
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [dataRes, notionBriefsRes] = await Promise.all([
        fetch('/api/data', { credentials: 'include', headers }),
        fetch('/api/notion/briefs', { credentials: 'include', headers })
      ]);
      
      if (dataRes.status === 401 || notionBriefsRes.status === 401) {
        get().setIsAuthenticated(false);
        throw new Error('Unauthorized');
      }

      if (!dataRes.ok) throw new Error('Failed to fetch unified data');
      if (!notionBriefsRes.ok) throw new Error('Failed to fetch Notion briefs');

      const isDataJson = dataRes.headers.get('content-type')?.includes('application/json');
      const isBriefsJson = notionBriefsRes.headers.get('content-type')?.includes('application/json');
      
      const data = isDataJson ? await dataRes.json() : {};
      const notionBriefsData = isBriefsJson ? await notionBriefsRes.json() : { data: [] };
      
      const supabaseBriefs = data.briefs || [];
      const actionables = data.actionables || [];
      const notionBriefs = notionBriefsData.data || [];
      
      try {
        const healthRes = await fetch('/api/health/system', { credentials: 'include', headers });
        if (healthRes.ok && healthRes.headers.get('content-type')?.includes('application/json')) {
          const healthData = await healthRes.json();
          set({ systemHealth: healthData });
        }
      } catch(e) {}

      const currentClient = get().selectedClient;
      let newSelectedClient = currentClient;
      
      if (!newSelectedClient && supabaseBriefs.length > 0) {
        newSelectedClient = supabaseBriefs[0].account;
      }
      
      // Fallback to Notion briefs for clients if needed
      if (!newSelectedClient && notionBriefs.length > 0) {
        newSelectedClient = notionBriefs[0].client;
      }

      set({
        supabaseBriefs,
        actionables,
        notionBriefs,
        status: data.status || { supabase: false, notion: false },
        errors: data.errors || {},
        selectedClient: newSelectedClient,
        loading: false,
      });

    } catch (err: any) {
      set({ error: err.message || 'An error occurred while fetching data', loading: false });
    }
  }
}));

// Se expone para que avisar() del helper pueda empujar notificaciones sin crear
// un ciclo de imports entre el store y los componentes.
if (typeof window !== 'undefined') { (window as any).__northsignalStore = useAppStore; }
