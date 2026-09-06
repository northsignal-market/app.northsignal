/**
 * Memoria semántica: embeddings con Gemini (text-embedding-004, 768 dims), búsqueda con pgvector.
 * Convierte "conecta_con" de una corazonada del modelo en retrieval real.
 */
import { ai } from './gemini';

export async function embed(textos: string[]): Promise<number[][] | null> {
  if (!ai || !textos.length) return null;
  try {
    const out: number[][] = [];
    for (const t of textos) {
      const r: any = await ai.models.embedContent({ model: 'text-embedding-004', contents: t.slice(0, 2000) });
      const v = r?.embeddings?.[0]?.values || r?.embedding?.values;
      if (!v) return null;
      out.push(v);
    }
    return out;
  } catch (e: any) { console.error('[embed] ' + e.message); return null; }
}

/** Embebe lo pendiente en memoria (hasta 50 por llamada). */
export async function embeberPendientes(supabase: any): Promise<number> {
  const { data: pend } = await supabase.from('v_memoria_pendiente').select('*');
  if (!pend?.length) return 0;
  const vecs = await embed(pend.map((p: any) => `${p.tipo}: ${p.texto}`));
  if (!vecs) return 0;
  let n = 0;
  for (let i = 0; i < pend.length; i++) {
    const { error } = await supabase.from('memoria').update({ embedding: JSON.stringify(vecs[i]) }).eq('id', pend[i].id);
    if (!error) n++;
  }
  return n;
}

/** Los k episodios más parecidos a un texto, opcionalmente de una cuenta y anteriores a una fecha. */
export async function parecidoA(supabase: any, texto: string, account: string | null, k = 5, excluirDesde: string | null = null): Promise<any[]> {
  const v = await embed([texto]);
  if (!v) return [];
  const { data, error } = await supabase.rpc('parecido_a', { p_embedding: JSON.stringify(v[0]), p_account: account, p_k: k, p_excluir_desde: excluirDesde });
  if (error) { console.error('[parecido_a] ' + error.message); return []; }
  return data || [];
}
