import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search, Layers, Loader2, AlertCircle, FileText } from 'lucide-react';

export function RSAFactory() {
  const { selectedClient } = useAppStore();
  const [searchTerms, setSearchTerms] = useState<any[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
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
        const res = await fetch(`/api/metrics/v_search_terms_analisis?client=${selectedClient}`, { credentials: 'include' });
        if (res.ok) {
           const data = await res.json();
           setSearchTerms(data.data || []);
        }
      } catch(e) {
        console.error(e);
      }
      setLoadingTerms(false);
    }
    fetchTerms();
  }, [selectedClient]);

  const handleGenerate = async () => {
    if (selectedTerms.length === 0 || !selectedClient) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-rsa', { credentials: 'include',
        body: JSON.stringify({ client: selectedClient, searchTerms: selectedTerms })
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
            <Search size={16} className="text-[#0062CC]" /> Términos de Búsqueda Exitosos
          </h3>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {loadingTerms ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="animate-spin text-[#0062CC]" size={24} />
              </div>
            ) : searchTerms.length === 0 ? (
              <p className="text-[#F5F7FA]/50 text-sm text-center py-8">No hay términos disponibles o el endpoint aún no retorna datos.</p>
            ) : (
              searchTerms.slice(0, 50).map((t, idx) => (
                <div 
                  key={idx} 
                  onClick={() => toggleTerm(t.search_term || t.termino)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedTerms.includes(t.search_term || t.termino) ? 'bg-[#0062CC]/20 border-[#0062CC]' : 'bg-[#1A1F36] border-[#0062CC]/20 hover:border-[#0062CC]/50'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#FFFFFF]">{t.search_term || t.termino || 'Desconocido'}</span>
                    <span className="text-xs tabular text-[#0062CC]">{t.conversions || t.conversiones || 0} cv</span>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={selectedTerms.length === 0 || generating}
            className="w-full mt-4 bg-[#0062CC] text-[#FFFFFF] font-semibold py-3 rounded-xl hover:bg-[var(--primary-hover)] transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
          >
            {generating ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
            {generating ? 'Generando Anuncios...' : `Generar RSA (${selectedTerms.length} términos)`}
          </button>
        </div>

        <div className="flex flex-col bg-[#1A1F36] border border-[#0062CC]/20 rounded-xl p-5 shadow-sm overflow-hidden">
          <h3 className="text-sm font-semibold text-[#FFFFFF] mb-4">Anuncio Generado</h3>
          
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
