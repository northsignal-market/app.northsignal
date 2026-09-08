import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search, Layers, Loader2, AlertCircle, FileText } from 'lucide-react';

export function RSAFactory() {
  const { selectedClient } = useAppStore();
  const [searchTerms, setSearchTerms] = useState<any[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState<'conversions' | 'clicks' | 'cost' | 'ctr'>('conversions');
  const [filtro, setFiltro] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [soloConConv, setSoloConConv] = useState(true);
  const [topAssets, setTopAssets] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedRSA, setGeneratedRSA] = useState<{headlines: string[], descriptions: string[]} | null>(null);

  useEffect(() => {
    async function fetchTerms() {
      if (!selectedClient) {
        setSearchTerms([]);
        setLoadingTerms(false);
        return;
      }
      setLoadingTerms(true);
      try {
        // 200 términos ordenados en el servidor, no 25 sin orden
        const res = await fetch(`/api/metrics/v_search_terms_analisis?client=${selectedClient}&orderBy=${orderBy}&orderDir=desc&limit=200`, { credentials: 'include' });
        if (res.ok) {
           const data = await res.json();
           setSearchTerms(data.data || []);
        }
        // Assets que ya funcionan: contexto para no repetir lo que Google ya califica BEST
        const ra = await fetch(`/api/rsa-assets?client=${selectedClient}`, { credentials: 'include' });
        if (ra.ok) setTopAssets(await ra.json());
      } catch(e) {
        console.error(e);
      }
      setLoadingTerms(false);
    }
    fetchTerms();
  }, [selectedClient, orderBy]);

  const handleGenerate = async () => {
    if (selectedTerms.length === 0 || !selectedClient) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-rsa', { credentials: 'include',
        body: JSON.stringify({
          client: selectedClient,
          searchTerms: selectedTerms,
          // Métricas de los términos elegidos y assets con mejor rendimiento
          termMetrics: searchTerms.filter(t => selectedTerms.includes(t.search_term)).map(t => ({ term: t.search_term, conv: t.conversions, clicks: t.clicks, cost: t.cost })),
          topAssets: topAssets.slice(0, 12).map(a => ({ tipo: a.field_type, texto: a.asset_text, label: a.performance_label }))
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedRSA(data.data);
      }
    } catch(e) {
      console.error(e);
    }
    setGenerating(false);
  };

  const toggleTerm = (term: string) => {
    if (selectedTerms.includes(term)) {
      setSelectedTerms(selectedTerms.filter(t => t !== term));
    } else {
      setSelectedTerms([...selectedTerms, term]);
    }
  };

  if (!selectedClient) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1A1F36] p-8">
        <p className="text-[#F5F7FA]/50 text-sm">Selecciona un cliente para utilizar el RSA Factory.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1A1F36] text-[#F5F7FA] p-6 overflow-y-auto custom-scrollbar animate-in fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-medium text-[#FFFFFF] flex items-center gap-2.5">
          <Layers className="text-[#0062CC]" size={20} />
          RSA Factory • Generador de Anuncios
        </h2>
      </div>

      {selectedClient === 'BHI' && (
        <div className="mb-6 p-4 rounded-xl bg-[#0062CC]/10 border border-[#0062CC]/30 flex items-start gap-3 shadow-sm">
          <AlertCircle className="text-[#0062CC] shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium text-[#FFFFFF]">Compliance Activo: El sistema bloqueará automáticamente términos regulados (póliza, seguro, vender, contratar) en la redacción de BHI.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="flex flex-col bg-[#1A1F36] border border-[#0062CC]/20 rounded-xl p-5 shadow-sm overflow-hidden">
          <h3 className="text-sm font-semibold text-[#FFFFFF] mb-4 flex items-center gap-2">
            <Search size={16} className="text-[#0062CC]" /> Elegí los términos que quieras en el anuncio
          </h3>
          <p className="text-[11px] text-[#F5F7FA] opacity-60 -mt-3 mb-3">Los que convirtieron en los últimos 30 días, ordenados por lo que elijas. Seleccioná entre 3 y 8 y generá: el anuncio usa las palabras que la gente ya escribe.</p>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            <div className="flex gap-2 mb-2">
              <input aria-label="Filtro" value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar términos…"
                className="flex-1 bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-3 py-1.5 text-xs text-[#FFFFFF] focus:outline-none focus:border-[#0062CC]" />
              <label className="flex items-center gap-1.5 text-[11px] text-[#F5F7FA] opacity-80 whitespace-nowrap cursor-pointer">
                <input type="checkbox" checked={soloConConv} onChange={e => setSoloConConv(e.target.checked)} className="accent-[#0062CC]" /> solo con conversiones
              </label>
              <select aria-label="Order By" value={orderBy} onChange={e => setOrderBy(e.target.value as any)}
                className="bg-[#1A1F36] border border-[#0062CC]/30 rounded-lg px-2 py-1.5 text-xs text-[#FFFFFF] focus:outline-none">
                <option value="conversions">Por conversiones</option>
                <option value="clicks">Por clics</option>
                <option value="cost">Por gasto</option>
                <option value="ctr">Por CTR</option>
              </select>
            </div>
            {loadingTerms ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="animate-spin text-[#0062CC]" size={24} />
              </div>
            ) : searchTerms.length === 0 ? (
              <p className="text-[#F5F7FA]/50 text-sm text-center py-8">Sin términos para esta cuenta en el período. Los trae la extracción semanal.</p>
            ) : (
              (() => {
                const activos = searchTerms.filter(t => Number(t.clicks || 0) > 0 && (!soloConConv || Number(t.conversions || 0) > 0));
                const filtrados = activos.filter(t => !filtro || String(t.search_term || '').toLowerCase().includes(filtro.toLowerCase()));
                const lista = verTodos ? filtrados : filtrados.slice(0, 20);
                return (<>
                {filtrados.length === 0 && <p className="text-[#F5F7FA]/50 text-xs text-center py-6">{soloConConv ? 'Ningún término convirtió en el período. Destildá "solo con conversiones" para ver los que tuvieron clics.' : 'Ningún término con clics en el período.'}</p>}
                {lista.map((t, idx) => {
                const sel = selectedTerms.includes(t.search_term);
                const cpa = Number(t.conversions) > 0 ? Number(t.cost) / Number(t.conversions) : null;
                return (
                <div 
                  key={idx} 
                  onClick={() => toggleTerm(t.search_term)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${sel ? 'bg-[#0062CC]/20 border-[#0062CC]' : 'bg-[#1A1F36] border-[#0062CC]/20 hover:border-[#0062CC]/50'}`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm text-[#FFFFFF] truncate">{t.search_term || 'Desconocido'}</span>
                    <span className="text-[11px] tabular text-[#F5F7FA] opacity-70 shrink-0 flex gap-2">
                      <span className="text-[#0062CC] font-semibold">{Number(t.conversions || 0)} cv</span>
                      <span>{Number(t.clicks || 0)} clics</span>
                      {cpa != null && <span>CPA {selectedClient === 'KAREDO' ? cpa.toFixed(0) + '€' : '$' + Math.round(cpa).toLocaleString('es-CL')}</span>}
                    </span>
                  </div>
                </div>
                );
              })}
                {!verTodos && filtrados.length > 20 && (
                  <button onClick={() => setVerTodos(true)} className="w-full py-2 text-xs text-[#F5F7FA] opacity-60 hover:opacity-100">Ver los {filtrados.length - 20} restantes</button>
                )}
                </>);
              })()
            )}
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={selectedTerms.length === 0 || generating}
            className="w-full mt-4 bg-[#0062CC] text-[#FFFFFF] font-semibold py-3 rounded-xl hover:bg-[var(--primary-hover)] transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
          >
            {generating ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
            {generating ? 'Escribiendo el anuncio…' : selectedTerms.length === 0 ? 'Seleccioná al menos un término' : `Generar anuncio con ${selectedTerms.length} término${selectedTerms.length > 1 ? 's' : ''}`}
          </button>
        </div>

        <div className="flex flex-col bg-[#1A1F36] border border-[#0062CC]/20 rounded-xl p-5 shadow-sm overflow-hidden">
          <h3 className="text-sm font-semibold text-[#FFFFFF] mb-4">Anuncio propuesto</h3>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            {!generatedRSA ? (
              <div className="flex flex-col items-center justify-center h-full text-[#F5F7FA]/40 space-y-3">
                <FileText size={32} className="text-[#0062CC]/40" />
                <p className="text-sm text-center">Selecciona términos y presiona generar para ver propuestas de RSA.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-semibold text-[#F5F7FA]/70 uppercase tracking-wider mb-3">Títulos (Max 30)</h4>
                  <div className="space-y-2">
                    {generatedRSA.headlines.map((hl, i) => (
                      <div key={i} className="p-3 bg-[#1A1F36] border border-[#0062CC]/20 rounded-lg flex justify-between items-center group hover:border-[#0062CC]/50 transition-colors">
                        <span className="text-sm text-[#FFFFFF]">{hl}</span>
                        <span className={`text-xs tabular ${hl.length > 30 ? 'text-[#0062CC]' : 'text-[#F5F7FA]/50'}`}>{hl.length}/30</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-xs font-semibold text-[#F5F7FA]/70 uppercase tracking-wider mb-3">Descripciones (Max 90)</h4>
                  <div className="space-y-2">
                    {generatedRSA.descriptions.map((desc, i) => (
                      <div key={i} className="p-3 bg-[#1A1F36] border border-[#0062CC]/20 rounded-lg flex justify-between items-start gap-4 group hover:border-[#0062CC]/50 transition-colors">
                        <span className="text-sm text-[#FFFFFF] leading-relaxed">{desc}</span>
                        <span className={`text-xs tabular mt-1 shrink-0 ${desc.length > 90 ? 'text-[#0062CC]' : 'text-[#F5F7FA]/50'}`}>{desc.length}/90</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
