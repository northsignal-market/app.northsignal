import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useCuentaActiva } from '../lib/useCuentas';
import { Loader2, AlertCircle, FileText, MapPin, Copy, Check, History } from 'lucide-react';
import { fmtMoneda, fmtFechaCorta, useJSON } from './ui';

/**
 * ESCRIBIR ANUNCIOS · rediseñado el 13 de septiembre de 2026
 *
 * Antes: dos columnas y punto. Lo generado vivía solo en la pantalla — al
 * cerrar la pestaña no quedaba rastro de qué escribió el modelo, con qué
 * contexto ni si terminó usándose. Y la lista de oportunidades ignoraba la
 * cuenta del header cuando el store arrancaba vacío: te mostraba grupos de
 * OTRAS cuentas, que en este sistema es el peor error posible.
 *
 * Ahora es un tablero de tres zonas — dónde escribir · el anuncio · lo que ya
 * se escribió — con el alcance siempre explícito y todo lo generado guardado.
 *
 * La unidad sigue siendo el GRUPO DE ANUNCIOS: es contra eso que Google mide
 * la relevancia.
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

const LABEL = { color: '#ADADAD', letterSpacing: '0.3px' } as const;

export function RSAFactory() {
  const { selectedClient } = useAppStore();
  // El alcance es explícito: si el store todavía no eligió cuenta, cae a la
  // primera cuenta real. Nunca se pide "todas" — mezclar cuentas acá es lo que
  // hacía aparecer grupos de Karedo con 360 seleccionado arriba.
  // `useCuentaActiva` resuelve la cuenta CONTRA LAS CUENTAS REALES y devuelve null
  // cuando no puede: mientras cargan, o si no hay ninguna. El `|| selectedClient`
  // que había acá anulaba justo esa validación —caía al valor sin validar
  // precisamente cuando la validación había fallado—. Por ahí entraba 'Unknown',
  // que es el centinela con que el servidor marca un accionable de Notion cuya
  // cuenta NO pudo resolver (server.ts:96): un "no sé" que llegaba a la pantalla
  // convertido en nombre de cuenta, y salía en catorce pedidos como si existiera.
  // Ahora '' significa una sola cosa: todavía no hay cuenta, y no se pregunta.
  const cuenta = useCuentaActiva(selectedClient) ?? '';

  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [elegida, setElegida] = useState<Oportunidad | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generado, setGenerado] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [avisoHistorial, setAvisoHistorial] = useState<string | null>(null);

  const { data: hist, refetch: recargarHistorial } = useJSON<any>(
    cuenta ? `/api/rsa/historial?client=${encodeURIComponent(cuenta)}` : null, null);

  useEffect(() => {
    if (!cuenta) return;
    let vivo = true;
    setCargando(true); setElegida(null); setGenerado(null); setError(null);
    fetch(`/api/rsa/oportunidades?client=${encodeURIComponent(cuenta)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(d => { if (vivo) setOportunidades((d.data || []).filter((o: Oportunidad) => o.account === cuenta)); })
      .catch(e => { if (vivo) setError('No se pudo cargar el diagnóstico: ' + (e?.message || 'error')); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [cuenta]);

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
      if (res.ok && data.success) {
        setGenerado(data.data);
        // El rastro se deja acá, apenas llega: si el guardado falla, se avisa,
        // pero nunca se pierde el anuncio que ya está en pantalla.
        fetch('/api/rsa/historial', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account: elegida.account, campaign: elegida.campaign, ad_group: elegida.ad_group,
            titulos: data.data.headlines || [], descripciones: data.data.descriptions || [],
            diagnostico: data.data.diagnostico || null,
          })
        }).then(r => r.json()).then(r => {
          if (r?.aviso) setAvisoHistorial(r.aviso); else { setAvisoHistorial(null); recargarHistorial(); }
        }).catch(() => setAvisoHistorial('No se pudo guardar en el historial.'));
      }
      else if (res.status === 409 && data.bloqueado) setBloqueo(data.error);
      else {
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

  const copiar = (txt: string, id: string, idHist?: number) => {
    navigator.clipboard?.writeText(txt);
    setCopiado(id); setTimeout(() => setCopiado(null), 1200);
    // Copiar ES la señal de que el anuncio se usó: el historial lo registra sin
    // pedir un clic extra.
    if (idHist) {
      fetch(`/api/rsa/historial/${idHist}/estado`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'copiado' })
      }).then(() => recargarHistorial()).catch(() => {});
    }
  };

  const esLanding = (o: Oportunidad) => o.que_hacer.startsWith('NO ES EL ANUNCIO');
  const plata = (n: number, m: string) => fmtMoneda(Math.round(n), m);
  const ultimoId: number | undefined = hist?.historial?.[0]?.id;

  return (
    <div className="px-5 md:px-7 py-5 max-w-[1560px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

      {/* ZONA 1 · dónde conviene escribir */}
      <section className="lg:col-span-4 min-w-0 tarjeta-pulse p-4 md:p-5 flex flex-col" style={{ borderRadius: 'var(--r-tarjeta)', maxHeight: 'calc(100vh - 190px)' }}>
        <div className="mb-3">
          <h2 className="text-[13px] font-medium text-[#EDEFF3]">Dónde conviene escribir</h2>
          <p className="text-[11px] mt-0.5 leading-snug" style={LABEL}>
            Grupos de <span className="text-[#EDEFF3]">{cuenta || '—'}</span> ordenados por la plata de esta semana que va a keywords que el anuncio no menciona.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar -mr-1 pr-1 space-y-1.5">
          {cargando && (
            <div className="flex items-center gap-2 text-xs py-6 justify-center" style={LABEL}>
              <Loader2 className="animate-spin" size={14} /> Leyendo el diagnóstico…
            </div>
          )}
          {!cargando && !oportunidades.length && (
            <div className="py-10 text-center">
              <p className="text-xs text-[#FAFAFA]">Sin grupos con gasto esta semana en {cuenta}.</p>
              <p className="text-[11px] mt-1" style={LABEL}>No es un error: es que no hay plata en riesgo para reescribir.</p>
            </div>
          )}

          {oportunidades.map((o) => {
            const sel = elegida?.campaign === o.campaign && elegida?.ad_group === o.ad_group;
            const landing = esLanding(o);
            return (
              <button
                key={`${o.campaign}|${o.ad_group}`}
                onClick={() => { setElegida(o); setGenerado(null); setError(null); setBloqueo(null); }}
                className={`w-full text-left p-2.5 rounded-lg transition-colors ${sel ? '' : 'hover:bg-white/[0.04]'} ${landing ? 'opacity-70' : ''}`}
                style={{
                  backgroundColor: sel ? 'var(--primary-faint)' : 'var(--surface-2)',
                  boxShadow: sel ? 'inset 2px 0 0 var(--primary-text)' : undefined,
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] text-[#EDEFF3] truncate">{o.ad_group}</div>
                    <div className="text-[10px] truncate flex items-center gap-1" style={LABEL}>
                      {o.location && <><MapPin size={9} /> {o.location} ·</>} {o.campaign}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] tabular" style={{ color: landing ? '#ADADAD' : 'var(--warn)' }}>
                      {plata(o.plata_en_riesgo, o.moneda)}
                    </div>
                    <div className="text-[9px]" style={LABEL}>en riesgo</div>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px]" style={LABEL}>
                  <span>QS {o.qs_ponderado ?? '—'}</span>
                  <span>{o.pct_gasto_con_relevancia_baja}% relevancia baja</span>
                  <span>{o.anuncios_en_el_grupo} anuncio{o.anuncios_en_el_grupo === 1 ? '' : 's'}</span>
                  <span>{o.keywords} kw</span>
                </div>
                {sel && <div className="mt-1.5 text-[11px] leading-snug" style={{ color: landing ? 'var(--bad)' : '#F5F7FA' }}>{o.que_hacer}</div>}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => generar(false)}
          disabled={!elegida || generating}
          className="mt-3 w-full py-2 rounded-lg text-[12px] text-[#EDEFF3] flex items-center justify-center gap-2 disabled:opacity-40 shrink-0"
          style={{ backgroundColor: 'var(--primary)' }}>
          {generating ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
          {generating ? 'Escribiendo…' : !elegida ? 'Elegí un grupo' : 'Escribir el anuncio'}
        </button>
      </section>

      {/* ZONA 2 · el anuncio */}
      <section className="lg:col-span-5 min-w-0 tarjeta-pulse tarjeta-hero p-4 md:p-5" style={{ borderRadius: 'var(--r-tarjeta)' }}>
        <h2 className="text-[13px] font-medium text-[#EDEFF3] mb-3">
          El anuncio{elegida ? <span className="font-normal" style={LABEL}> · {elegida.ad_group}</span> : ''}
        </h2>

        {error && (
          <div className="py-8 px-2 text-center space-y-2">
            <AlertCircle size={22} style={{ color: 'var(--bad)' }} className="mx-auto" />
            <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--bad)' }}>{error}</p>
            <p className="text-[10px]" style={LABEL}>Si dice que falta ANTHROPIC_API_KEY, se carga en las variables de entorno de Vercel.</p>
          </div>
        )}

        {bloqueo && !error && (
          <div className="py-8 px-2 text-center space-y-3">
            <AlertCircle size={22} style={{ color: 'var(--warn)' }} className="mx-auto" />
            <p className="text-xs" style={{ color: 'var(--warn)' }}>{bloqueo}</p>
            <button onClick={() => generar(true)} className="text-[11px] px-3 py-1.5 rounded-lg text-[#EDEFF3]"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
              Escribirlo igual
            </button>
          </div>
        )}

        {!error && !bloqueo && !generado && (
          <div className="py-10 px-4 text-center">
            <p className="text-xs text-[#FAFAFA]">Elegí un grupo y escribí el anuncio.</p>
            <p className="text-[11px] mt-1.5 leading-relaxed max-w-sm mx-auto" style={LABEL}>
              El contexto lo arma el servidor: keywords del grupo, términos que ya convirtieron ahí,
              el anuncio que ya existe y el idioma de la cuenta.
            </p>
          </div>
        )}

        {generado && (
          <div className="space-y-4">
            {generado.diagnostico && (
              <div className="p-2.5 rounded-lg text-[11px] space-y-1" style={{ backgroundColor: 'var(--surface-2)' }}>
                <div style={{ color: '#F5F7FA' }}>
                  {generado.diagnostico.titulos} títulos · {generado.diagnostico.descripciones} descripciones ·{' '}
                  {generado.diagnostico.titulos_con_keyword} con la keyword y {generado.diagnostico.titulos_sin_keyword} sin ella
                  {generado.diagnostico.titulos_con_la_ciudad != null && ` · ${generado.diagnostico.titulos_con_la_ciudad} nombran la ciudad`}
                </div>
                {(generado.diagnostico.avisos || []).map((a: string, i: number) => (
                  <div key={i} style={{ color: 'var(--warn)' }}>{a}</div>
                ))}
                {(generado.diagnostico.descartados || []).length > 0 && (
                  <div style={LABEL}>
                    {generado.diagnostico.descartados.length} línea(s) descartadas por largo o repetición. No se truncan:
                    un título cortado a mitad de palabra es peor que uno menos.
                  </div>
                )}
                {generado.diagnostico.notas_del_modelo && <div style={LABEL}>{generado.diagnostico.notas_del_modelo}</div>}
              </div>
            )}

            {[
              { titulo: 'Títulos', sub: 'máx 30', items: (generado.headlines || []) as string[], max: 30 },
              { titulo: 'Descripciones', sub: 'máx 90', items: (generado.descriptions || []) as string[], max: 90 }
            ].map(sec => (
              <div key={sec.titulo}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-[11px] text-[#EDEFF3]">{sec.titulo}</span>
                  <span className="text-[10px]" style={LABEL}>{sec.sub}</span>
                </div>
                <div className="space-y-1">
                  {sec.items.map((txt, i) => (
                    <div key={i} className="px-2.5 py-1.5 rounded-lg flex justify-between items-center gap-3 group" style={{ backgroundColor: 'var(--surface-2)' }}>
                      <span className="text-[12px] text-[#EDEFF3] min-w-0 truncate">{txt}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] tabular" style={{ color: txt.length > sec.max * 0.93 ? 'var(--warn)' : '#ADADAD' }}>{txt.length}</span>
                        <button onClick={() => copiar(txt, sec.titulo + i)} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#ADADAD' }}>
                          {copiado === sec.titulo + i ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={() => copiar([...(generado.headlines || []), '', ...(generado.descriptions || [])].join('\n'), 'todo', ultimoId)}
              className="w-full py-2 rounded-lg text-[12px] text-[#EDEFF3]"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
              {copiado === 'todo' ? 'Copiado' : 'Copiar todo para pegar en Google Ads'}
            </button>
            {avisoHistorial && <p className="text-[10px] text-center" style={{ color: 'var(--warn)' }}>{avisoHistorial}</p>}
          </div>
        )}
      </section>

      {/* ZONA 3 · lo que ya se escribió */}
      <section className="lg:col-span-3 min-w-0 tarjeta-pulse p-4 md:p-5" style={{ borderRadius: 'var(--r-tarjeta)' }}>
        <div className="flex items-center gap-1.5 mb-3">
          <History size={12} style={{ color: '#ADADAD' }} />
          <h2 className="text-[13px] font-medium text-[#EDEFF3]">Lo que ya escribiste</h2>
        </div>

        {hist?.disponible === false ? (
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--warn)' }}>
            {hist.aviso} Lo generado sigue funcionando; lo que falta es el rastro.
          </p>
        ) : !hist?.historial?.length ? (
          <p className="text-[11px] leading-relaxed" style={LABEL}>
            Todavía nada para {cuenta}. Cada anuncio que escribas queda acá con su grupo, su fecha y en qué terminó.
          </p>
        ) : (
          <div className="space-y-2.5 overflow-y-auto custom-scrollbar -mr-1 pr-1" style={{ maxHeight: 'calc(100vh - 260px)' }}>
            {hist.historial.map((h: any) => (
              <div key={h.id} className="pb-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-[#EDEFF3] truncate">{h.ad_group}</span>
                  <span className="text-[10px] tabular shrink-0" style={LABEL}>{fmtFechaCorta(h.generado_el)}</span>
                </div>
                <div className="text-[10px] truncate" style={LABEL}>{h.campaign}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-px rounded"
                    style={h.estado === 'publicado' ? { backgroundColor: 'var(--primary-faint)', color: '#4D9DFF' } : { color: '#ADADAD', border: '1px solid var(--border)' }}>
                    {h.estado}
                  </span>
                  <span className="text-[10px] tabular" style={LABEL}>{(h.titulos || []).length} títulos</span>
                  <button
                    onClick={() => copiar([...(h.titulos || []), '', ...(h.descripciones || [])].join('\n'), 'h' + h.id, h.id)}
                    className="ml-auto text-[10px]" style={{ color: '#4D9DFF' }}>
                    {copiado === 'h' + h.id ? 'copiado' : 'copiar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
