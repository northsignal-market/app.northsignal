/**
 * REPORTE AL CLIENTE · PDF
 * ----------------------------------------------------------------------------
 * Un documento, no un dashboard. Estética del export original de la app:
 * horizontal, Helvetica, logo + título + línea de subtítulo, una línea de
 * totales, texto a todo el ancho de arriba a abajo, tablas a todo el ancho
 * al final con encabezado azul recto y filas alternas, pie de una línea.
 *
 * Sin grilla de columnas, sin gráficos dibujados, sin tarjetas, sin
 * mayúsculas espaciadas, sin tres secciones balanceadas. Las secciones son
 * las del doc maestro de la cuenta: contexto, observaciones, cambios
 * aplicados, puntos de atención, próximos pasos. Etiqueta en negrita y
 * texto o viñetas debajo, con el largo que cada una necesite.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image, renderToBuffer } from '@react-pdf/renderer';

Font.registerHyphenationCallback((w) => [w]);

const AZUL = '#0062CC', NAVY = '#1A1F36', GRIS_FILA = '#F5F7FA', TEXTO = '#323232', SUAVE = '#646464', PIE = '#969696';
export const LOGO_URL = 'https://djbwxgicosargfobsmqd.supabase.co/storage/v1/object/public/logos/ChatGPT%20Image%204%20sept%202026,%2007_31_34%20p.m..png';

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: TEXTO, paddingTop: 36, paddingBottom: 42, paddingHorizontal: 42 },
  cab: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  logo: { width: 40, height: 40, marginRight: 14 },
  titulo: { fontSize: 20, color: NAVY, marginTop: 2, lineHeight: 1.15 },
  sub: { fontSize: 10, color: SUAVE, marginTop: 5, lineHeight: 1.3 },
  totales: { fontSize: 10, color: TEXTO, marginBottom: 16, lineHeight: 1.45 },
  bloque: { marginBottom: 10 },
  etiqueta: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: NAVY, marginBottom: 3 },
  p: { fontSize: 10, marginBottom: 4, lineHeight: 1.45 },
  vineta: { flexDirection: 'row', marginBottom: 3, paddingLeft: 4 },
  guion: { width: 12, fontSize: 10 },
  vinetaTxt: { flex: 1, fontSize: 10, lineHeight: 1.45 },
  tablaTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: NAVY, marginTop: 14, marginBottom: 5 },
  th: { flexDirection: 'row', backgroundColor: AZUL, paddingVertical: 5, paddingHorizontal: 8 },
  thT: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tr: { flexDirection: 'row', paddingVertical: 4.5, paddingHorizontal: 8 },
  trAlt: { backgroundColor: GRIS_FILA },
  td: { fontSize: 8.5, color: TEXTO },
  n: { textAlign: 'right' },
  cNombre: { flex: 4 }, cNum: { flex: 1 },
  nota: { fontSize: 8, color: SUAVE, marginTop: 6 },
  pie: { position: 'absolute', bottom: 18, left: 42, fontSize: 8, color: PIE },
});

export interface Bloque { etiqueta: string; texto?: string; vinetas?: string[] }
export interface ReporteInput {
  account: string; nombre_cliente: string; idioma: 'es' | 'en'; moneda: string; locale: string;
  titulo?: string; periodo_desde: string; periodo_hasta: string; tipo: 'semanal' | 'mensual';
  bloques: Bloque[];
  metricas: Record<string, { actual: number | null; anterior: number | null }>;
  periodo_anterior_completo: boolean;
  campanas: { nombre: string; gasto: number; conv: number; cpa: number | null; ctr: number | null }[];
  grupos: { nombre: string; campana: string; gasto: number; conv: number; cpa: number | null }[];
  logo?: Buffer | null;
}

const T = {
  es: { titulo: 'Reporte de Rendimiento', cliente: 'Cliente', periodo: 'Período', fecha: 'Fecha', inv: 'Inversión', clics: 'Clics', impr: 'Impr', conv: 'Conv', cpa: 'CPA', ctr: 'CTR', campanas: 'Campañas', grupos: 'Grupos de anuncios', campana: 'Campaña', grupo: 'Grupo', costo: 'Costo', conversiones: 'Conversiones', pag: 'Página', de: 'de', vs: 'vs período anterior', nota: 'Solo se muestran campañas y grupos con inversión en el período.' },
  en: { titulo: 'Performance Report', cliente: 'Client', periodo: 'Period', fecha: 'Date', inv: 'Spend', clics: 'Clicks', impr: 'Impr', conv: 'Conv', cpa: 'CPA', ctr: 'CTR', campanas: 'Campaigns', grupos: 'Ad groups', campana: 'Campaign', grupo: 'Ad group', costo: 'Cost', conversiones: 'Conversions', pag: 'Page', de: 'of', vs: 'vs previous period', nota: 'Only campaigns and ad groups with spend in the period are shown.' },
};

const money = (v: number | null | undefined, m: string, l: string) => v == null ? '-' : new Intl.NumberFormat(l, { style: 'currency', currency: m, maximumFractionDigits: m === 'CLP' ? 0 : 2 }).format(v);
const num = (v: number | null | undefined, l: string, d = 1) => v == null ? '-' : new Intl.NumberFormat(l, { maximumFractionDigits: d }).format(v);
const fecha = (iso: string, idioma: 'es' | 'en') => new Date(iso + 'T12:00:00').toLocaleDateString(idioma === 'en' ? 'en-GB' : 'es-CL');
const delta = (a: number | null, b: number | null) => (a == null || b == null || b === 0) ? '' : `${a - b >= 0 ? '+' : ''}${(((a - b) / b) * 100).toFixed(1)}%`;

function Reporte({ r }: { r: ReporteInput }) {
  const t = T[r.idioma];
  const m = r.metricas;
  const kpi = (k: string) => k === 'cost' || k === 'cpa' ? money(m[k]?.actual, r.moneda, r.locale) : k === 'ctr' ? (m[k]?.actual == null ? '-' : `${num(m[k].actual, r.locale, 2)}%`) : num(m[k]?.actual, r.locale, k === 'conversions' ? 2 : 0);
  const lbl: Record<string, string> = { cost: t.inv, clicks: t.clics, impressions: t.impr, conversions: t.conv, cpa: t.cpa, ctr: t.ctr };
  const orden = ['cost', 'clicks', 'impressions', 'conversions', 'cpa', 'ctr'].filter(k => m[k]?.actual != null);
  const totales = orden.map(k => `${lbl[k]}: ${kpi(k)}`).join('  |  ');
  const deltas = r.periodo_anterior_completo ? ['cost', 'conversions', 'cpa'].map(k => { const d = delta(m[k]?.actual ?? null, m[k]?.anterior ?? null); return d ? `${lbl[k]} ${d}` : ''; }).filter(Boolean).join('  |  ') : '';
  const hoy = fecha(new Date().toISOString().slice(0, 10), r.idioma);
  const Pie = () => <Text style={s.pie} fixed render={({ pageNumber, totalPages }) => `${t.pag} ${pageNumber} ${t.de} ${totalPages} - NorthSignal`} />;
  return (
    <Document title={`${r.titulo || t.titulo} - ${r.nombre_cliente}`} author="NorthSignal">
      <Page size="A4" orientation="landscape" style={s.page} wrap>
        <Pie />
        <View style={s.cab}>
          {r.logo ? <Image src={{ data: r.logo, format: 'png' }} style={s.logo} /> : null}
          <View>
            <Text style={s.titulo}>{r.titulo || t.titulo} - NorthSignal</Text>
            <Text style={s.sub}>{t.cliente}: {r.nombre_cliente} | {t.periodo}: {fecha(r.periodo_desde, r.idioma)} - {fecha(r.periodo_hasta, r.idioma)} | {t.fecha}: {hoy}</Text>
          </View>
        </View>
        <Text style={s.totales}>{totales}{deltas ? `\n${deltas} ${t.vs}` : ''}</Text>

        {r.bloques.map((b, i) => (
          <View key={i} style={s.bloque} wrap={false}>
            <Text style={s.etiqueta}>{b.etiqueta}</Text>
            {b.texto ? b.texto.split(/\n\s*\n/).map((p, j) => <Text key={j} style={s.p}>{p.trim()}</Text>) : null}
            {(b.vinetas || []).map((v, j) => (
              <View key={j} style={s.vineta}><Text style={s.guion}>-</Text><Text style={s.vinetaTxt}>{v}</Text></View>
            ))}
          </View>
        ))}

        {r.campanas.length > 0 && (
          <View>
            <View wrap={false}>
              <Text style={s.tablaTitulo}>{t.campanas}</Text>
              <View style={s.th}><Text style={[s.thT, s.cNombre]}>{t.campana}</Text><Text style={[s.thT, s.cNum, s.n]}>{t.costo}</Text><Text style={[s.thT, s.cNum, s.n]}>{t.conversiones}</Text><Text style={[s.thT, s.cNum, s.n]}>{t.cpa}</Text><Text style={[s.thT, s.cNum, s.n]}>{t.ctr}</Text></View>
              {r.campanas.slice(0, 1).map((c, i) => (
                <View key={i} style={[s.tr]}><Text style={[s.td, s.cNombre]}>{c.nombre}</Text><Text style={[s.td, s.cNum, s.n]}>{money(c.gasto, r.moneda, r.locale)}</Text><Text style={[s.td, s.cNum, s.n]}>{num(c.conv, r.locale, 2)}</Text><Text style={[s.td, s.cNum, s.n]}>{money(c.cpa, r.moneda, r.locale)}</Text><Text style={[s.td, s.cNum, s.n]}>{c.ctr == null ? '-' : `${num(c.ctr, r.locale, 2)}%`}</Text></View>
              ))}
            </View>
            {r.campanas.slice(1).map((c, i) => (
              <View key={i} style={[s.tr, i % 2 === 0 ? s.trAlt : {}]} wrap={false}><Text style={[s.td, s.cNombre]}>{c.nombre}</Text><Text style={[s.td, s.cNum, s.n]}>{money(c.gasto, r.moneda, r.locale)}</Text><Text style={[s.td, s.cNum, s.n]}>{num(c.conv, r.locale, 2)}</Text><Text style={[s.td, s.cNum, s.n]}>{money(c.cpa, r.moneda, r.locale)}</Text><Text style={[s.td, s.cNum, s.n]}>{c.ctr == null ? '-' : `${num(c.ctr, r.locale, 2)}%`}</Text></View>
            ))}
          </View>
        )}
        {r.grupos.length > 1 && (
          <View>
            <View wrap={false}>
              <Text style={s.tablaTitulo}>{t.grupos}</Text>
              <View style={s.th}><Text style={[s.thT, s.cNombre]}>{t.grupo}</Text><Text style={[s.thT, s.cNum, s.n]}>{t.costo}</Text><Text style={[s.thT, s.cNum, s.n]}>{t.conversiones}</Text><Text style={[s.thT, s.cNum, s.n]}>{t.cpa}</Text></View>
              {r.grupos.slice(0, 1).map((g, i) => (
                <View key={i} style={[s.tr]}><Text style={[s.td, s.cNombre]}>{g.nombre}</Text><Text style={[s.td, s.cNum, s.n]}>{money(g.gasto, r.moneda, r.locale)}</Text><Text style={[s.td, s.cNum, s.n]}>{num(g.conv, r.locale, 2)}</Text><Text style={[s.td, s.cNum, s.n]}>{money(g.cpa, r.moneda, r.locale)}</Text></View>
              ))}
            </View>
            {r.grupos.slice(1).map((g, i) => (
              <View key={i} style={[s.tr, i % 2 === 0 ? s.trAlt : {}]} wrap={false}><Text style={[s.td, s.cNombre]}>{g.nombre}</Text><Text style={[s.td, s.cNum, s.n]}>{money(g.gasto, r.moneda, r.locale)}</Text><Text style={[s.td, s.cNum, s.n]}>{num(g.conv, r.locale, 2)}</Text><Text style={[s.td, s.cNum, s.n]}>{money(g.cpa, r.moneda, r.locale)}</Text></View>
            ))}
            <Text style={s.nota}>{t.nota}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/**
 * Parsea el texto de la sección de reporte del brief en bloques.
 * Formato esperado: líneas "Etiqueta:" seguidas de texto o viñetas "- ".
 * Etiquetas reconocidas en es/en; cualquier otra "Xxx:" al inicio de línea también.
 */
export function parsearBloques(texto: string): Bloque[] {
  const lineas = texto.split('\n');
  const bloques: Bloque[] = [];
  let actual: Bloque | null = null;
  const esEtiqueta = (l: string) => /^[A-ZÁÉÍÓÚÑ][^:\n]{2,40}:\s*$/.test(l.trim()) || /^(Contexto|Métricas|Metricas|Observaciones|Cambios aplicados|Cambios|Puntos de atención|Puntos de atencion|Próximos pasos|Proximos pasos|Context|Metrics|Observations|Changes applied|Changes|Points of attention|Attention|Next steps):/i.test(l.trim());
  for (const raw of lineas) {
    const l = raw.trim();
    if (!l) continue;
    if (esEtiqueta(l)) {
      const [etq, ...resto] = l.split(':');
      actual = { etiqueta: etq.trim(), texto: resto.join(':').trim() || undefined, vinetas: [] };
      bloques.push(actual);
      continue;
    }
    if (!actual) { actual = { etiqueta: '', texto: '', vinetas: [] }; bloques.push(actual); }
    if (/^[-•*]\s+/.test(l)) actual.vinetas!.push(l.replace(/^[-•*]\s+/, ''));
    else actual.texto = (actual.texto ? actual.texto + '\n\n' : '') + l;
  }
  return bloques.map(b => ({ ...b, vinetas: b.vinetas?.length ? b.vinetas : undefined })).filter(b => b.etiqueta || b.texto || b.vinetas);
}

let logoCache: Buffer | null = null;
export async function descargarLogo(): Promise<Buffer | null> {
  if (logoCache) return logoCache;
  try { const res = await fetch(LOGO_URL); if (!res.ok) return null; logoCache = Buffer.from(await res.arrayBuffer()); return logoCache; } catch { return null; }
}
export async function generarReportePDF(r: ReporteInput): Promise<Buffer> { return renderToBuffer(<Reporte r={r} />); }
