import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Layers, Loader2, AlertCircle, FileText, MapPin, Copy, Check } from 'lucide-react';

/**
 * RSA FACTORY · rediseñado el 8 de septiembre de 2026
 *
 * Antes: el operador elegía términos sueltos de la cuenta entera y el modelo escribía.
 * Eso es una herramienta de redacción, no de optimización. No sabía en qué grupo iba el
 * anuncio, ni qué le pasaba a la cuenta, ni qué anuncio ya existía ahí.
 *
 * Ahora arranca por el DIAGNÓSTICO. v_donde_escribir_anuncio ordena los grupos por plata
 * en riesgo (el gasto de la semana en keywords cuya relevancia está bajo el promedio) y
 * dice qué acción corresponde. Elegís una fila y el servidor arma el contexto solo:
 * keywords del grupo, términos que ya convirtieron ahí, texto del anuncio vigente,
 * idioma de la cuenta y, si es cadena, el local.
 *
 * La unidad es el GRUPO DE ANUNCIOS porque es contra eso que Google mide la relevancia.
 */

type Oportunidad = {
  account: string; location: string | null; objetivo: string | null;
  campaign: string; ad_group: string;
  gasto_semana: number; plata_en_riesgo: number;
  pct_gasto_con_relevancia_baja: number; pct_gasto_con_landing_baja: number;
  qs_ponderado: number; keywords: number;
  anuncios_en_el_grupo: number; fuerza_del_anuncio: string | null;
  terminos_que_convierten_30d: number; keywords_del_grupo: string | null;
  que_hacer: string; prioridad: number;
  idioma_anuncio: string; moneda: string; es_cadena: boolean;
};

export function RSAFactory() {
  const { selectedClient } = useAppStore();
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [elegida, setElegida] = useState<Oportunidad | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generado, setGenerado] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true); setElegida(null); setGenerado(null); setError(null);
    fetch(`/api/rsa/oportunidades?client=${encodeURIComponent(selectedClient || '')}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(d => { if (vivo) setOportunidades(d.data || []); })
      .catch(e => { if (vivo) setError('No se pudo cargar el diagnóstico: ' + (e?.message || 'error')); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [selectedClient]);

  const generar = async (forzar = false) => {
    if (!elegida) return;
    setGenerating(true); setError(null); setBloqueo(null); setGenerado(null);
    try {
      const res = await fetch('/api/generate-rsa', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: elegida.account, campaign: elegida.campaign, adGroup: elegida.ad_group, forzar })
      });
      const data = await res.json();
      if (res.ok && data.success) setGenerado(data.data);
      else if (res.status === 409 && data.bloqueado) setBloqueo(data.error);
      // Sin esta rama el botón no hacía nada y no decía por qué. Fallar en silencio es peor.
      else {
        // El detalle del 502 (stop_reason y lo que devolvio el modelo) viaja en la
        // respuesta y antes no se mostraba: el error decia poco y no se podia diagnosticar.
        const extra = [data?.stop_reason ? `stop_reason: ${data.stop_reason}` : null,
                       data?.crudo ? `Devolvió: ${String(data.crudo).slice(0, 220)}…` : null]
                      .filter(Boolean).join(' · ');
        setError((data?.error || `El generador respondió ${res.status} sin detalle.`) + (extra ? `\n\n${extra}` : ''));
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo contactar al generador.');
    }
    setGenerating(false);
  };

  const copiar = (txt: string, id: string) => {
    navigator.clipboard?.writeText(txt);
    setCopiado(id); setTimeout(() => setCopiado(null), 1200);
  };

  const esLanding = (o: Oportunidad) => o.que_hacer.startsWith('NO ES EL ANUNCIO');
  const plata = (n: number, m: string) => `${Math.round(n).toLocaleString('es-CL')} ${m}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">

      <div className="flex flex-col bg-[#1A1F36] border border-[#0062CC]/20 rounded-xl p-5 shadow-sm overflow-hidden">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-[#FFFFFF]">Dónde conviene escribir</h3>
          <p className="text-[11px] text-[#F5F7FA]/50 mt-1">
            Grupos ordenados por la plata de esta semana que va a keywords que el anuncio no menciona.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
          {cargando && (
            <div className="flex items-center gap-2 text-[#F5F7FA]/40 text-sm py-6 justify-center">
              <Loader2 className="animate-spin" size={16} /> Leyendo el diagnóstico…
            </div>
          )}

          {!cargando && !oportunidades.length && (
            <div className="flex flex-col items-center justify-center h-full text-[#F5F7FA]/40 space-y-2 py-10">
              <Layers size={28} className="text-[#0062CC]/40" />
              <p className="text-sm text-center">Sin grupos con gasto esta semana en esta cuenta.</p>
            </div>
          )}

          {oportunidades.map((o) => {
            const sel = elegida?.campaign === o.campaign && elegida?.ad_group === o.ad_group;
            const landing = esLanding(o);
            return (
              <button
                key={`${o.campaign}|${o.ad_group}`}
                onClick={() => { setElegida(o); setGenerado(null); setError(null); setBloqueo(null); }}
                className="w-full text-left p-3 rounded-lg transition-colors"
                style={{
                  backgroundColor: sel ? 'rgba(0,98,204,0.12)' : 'var(--surface-2, #131728)',
                  border: `1px solid ${sel ? 'rgba(0,98,204,0.6)' : 'rgba(0,98,204,0.15)'}`,
                  opacity: landing ? 0.75 : 1
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] text-[#FFFFFF] truncate">{o.ad_group}</div>
                    <div className="text-[11px] text-[#F5F7FA]/50 truncate flex items-center gap-1">
                      {o.location && <><MapPin size={10} /> {o.location} ·</>} {o.campaign}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] tabular" style={{ color: landing ? '#F5F7FA99' : '#F79009' }}>
                      {plata(o.plata_en_riesgo, o.moneda)}
                    </div>
                    <div className="text-[10px] text-[#F5F7FA]/40">en riesgo</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#F5F7FA]/50">
                  <span>QS {o.qs_ponderado ?? '—'}</span>
                  <span>{o.pct_gasto_con_relevancia_baja}% relevancia baja</span>
                  {o.pct_gasto_con_landing_baja > 0 && <span>{o.pct_gasto_con_landing_baja}% landing baja</span>}
                  <span>{o.anuncios_en_el_grupo} anuncio{o.anuncios_en_el_grupo === 1 ? '' : 's'}</span>
                  <span>{o.keywords} keywords</span>
                </div>
                <div className="mt-2 text-[11px]" style={{ color: landing ? '#F97066' : '#F5F7FA99' }}>
                  {o.que_hacer}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => generar(false)}
          disabled={!elegida || generating}
          className="mt-4 w-full py-2.5 rounded-lg text-[13px] text-[#FFFFFF] flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ backgroundColor: '#0062CC' }}>
          {generating ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
          {generating ? 'Escribiendo el anuncio…'
            : !elegida ? 'Elegí un grupo de la lista'
            : `Escribir para ${elegida.ad_group}${elegida.location ? ` · ${elegida.location}` : ''}`}
        </button>
      </div>

      <div className="flex flex-col bg-[#1A1F36] border border-[#0062CC]/20 rounded-xl p-5 shadow-sm overflow-hidden">
        <h3 className="text-sm font-semibold text-[#FFFFFF] mb-4">Anuncio propuesto</h3>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {error && (
            <div className="flex flex-col items-center justify-center h-full space-y-3 px-4">
              <AlertCircle size={30} style={{ color: '#F97066' }} />
              <p className="text-sm text-center whitespace-pre-wrap" style={{ color: '#F97066' }}>{error}</p>
              <p className="text-xs text-center text-[#F5F7FA]/40">
                Si dice que falta ANTHROPIC_API_KEY, se carga en las variables de entorno de Vercel.
              </p>
            </div>
          )}

          {bloqueo && !error && (
            <div className="flex flex-col items-center justify-center h-full space-y-3 px-4">
              <AlertCircle size={30} style={{ color: '#F79009' }} />
              <p className="text-sm text-center" style={{ color: '#F79009' }}>{bloqueo}</p>
              <button onClick={() => generar(true)}
                className="text-xs px-3 py-1.5 rounded-lg text-[#FFFFFF]"
                style={{ backgroundColor: 'var(--surface-2, #131728)', border: '1px solid rgba(0,98,204,0.3)' }}>
                Escribirlo igual
              </button>
            </div>
          )}

          {!error && !bloqueo && !generado && (
            <div className="flex flex-col items-center justify-center h-full text-[#F5F7FA]/40 space-y-3">
              <FileText size={30} className="text-[#0062CC]/40" />
              <p className="text-sm text-center px-6">
                Elegí un grupo de la izquierda. El contexto lo arma el servidor: keywords del grupo,
                términos que ya convirtieron ahí, el anuncio que ya existe y el idioma de la cuenta.
              </p>
            </div>
          )}

          {generado && (
            <div className="space-y-5">
              {generado.diagnostico && (
                <div className="p-3 rounded-lg text-[11px] space-y-1"
                     style={{ backgroundColor: 'var(--surface-2, #131728)', border: '1px solid rgba(0,98,204,0.2)' }}>
                  <div className="text-[#F5F7FA]/70">
                    {generado.diagnostico.titulos} títulos · {generado.diagnostico.descripciones} descripciones ·{' '}
                    {generado.diagnostico.cobertura_de_keyword_pct}% menciona una keyword del grupo
                    {generado.diagnostico.titulos_con_la_ciudad != null &&
                      ` · ${generado.diagnostico.titulos_con_la_ciudad} nombran la ciudad`}
                  </div>
                  {(generado.diagnostico.avisos || []).map((a: string, i: number) => (
                    <div key={i} style={{ color: '#F79009' }}>{a}</div>
                  ))}
                  {(generado.diagnostico.descartados || []).length > 0 && (
                    <div className="text-[#F5F7FA]/40">
                      {generado.diagnostico.descartados.length} línea(s) descartadas por largo o repetición.
                      No se truncan: un título cortado a mitad de palabra es peor que uno menos.
                    </div>
                  )}
                  {generado.diagnostico.notas_del_modelo && (
                    <div className="text-[#F5F7FA]/50">{generado.diagnostico.notas_del_modelo}</div>
                  )}
                </div>
              )}

              {[
                { titulo: 'Títulos · máx 30', items: (generado.headlines || []) as string[], max: 30 },
                { titulo: 'Descripciones · máx 90', items: (generado.descriptions || []) as string[], max: 90 }
              ].map(sec => (
                <div key={sec.titulo}>
                  <h4 className="text-xs font-semibold text-[#F5F7FA]/70 uppercase tracking-wider mb-2">{sec.titulo}</h4>
                  <div className="space-y-1.5">
                    {sec.items.map((txt, i) => (
                      <div key={i}
                        className="p-2.5 rounded-lg flex justify-between items-center gap-3 group"
                        style={{ backgroundColor: 'var(--surface-2, #131728)', border: '1px solid rgba(0,98,204,0.15)' }}>
                        <span className="text-[13px] text-[#FFFFFF] min-w-0 truncate">{txt}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] tabular"
                                style={{ color: txt.length > sec.max * 0.93 ? '#F79009' : '#F5F7FA66' }}>
                            {txt.length}
                          </span>
                          <button onClick={() => copiar(txt, sec.titulo + i)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#F5F7FA]/60">
                            {copiado === sec.titulo + i ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={() => copiar([...(generado.headlines || []), '', ...(generado.descriptions || [])].join('\n'), 'todo')}
                className="w-full py-2 rounded-lg text-[12px] text-[#FFFFFF]"
                style={{ backgroundColor: 'var(--surface-2, #131728)', border: '1px solid rgba(0,98,204,0.3)' }}>
                {copiado === 'todo' ? 'Copiado' : 'Copiar todo para pegar en Google Ads'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
