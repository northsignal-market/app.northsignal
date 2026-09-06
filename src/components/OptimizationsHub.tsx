import React, { useState } from 'react';
import { Cpu, Database, Code, CheckCircle2, ShieldAlert, Sliders, Copy, Check } from 'lucide-react';

export function OptimizationsHub() {
  const [activeTab, setActiveTab] = useState<'sql' | 'alerts' | 'mutations' | 'prompt'>('sql');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-[#1A1F36] text-[#F5F7FA]">
      <header className="h-16 border-b border-[#0062CC]/20 flex items-center justify-between px-8 bg-[#1A1F36] shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Sliders size={20} className="text-[#0062CC]" />
          <h1 className="text-lg font-medium text-[#FFFFFF] tracking-wide">Playbook de Optimización & Automatizaciones</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'sql' ? 'bg-[#0062CC] text-[#FFFFFF] shadow-sm border border-[#0062CC]' : 'bg-[#0062CC]/10 text-[#F5F7FA]/70 hover:text-[#FFFFFF] hover:bg-[#0062CC]/20'}`}
          >
            1. Vistas SQL (Fuzzy & N-Grams)
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'alerts' ? 'bg-[#0062CC] text-[#FFFFFF] shadow-sm border border-[#0062CC]' : 'bg-[#0062CC]/10 text-[#F5F7FA]/70 hover:text-[#FFFFFF] hover:bg-[#0062CC]/20'}`}
          >
            2. Alerta Diaria G. Ads
          </button>
          <button
            onClick={() => setActiveTab('mutations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'mutations' ? 'bg-[#0062CC] text-[#FFFFFF] shadow-sm border border-[#0062CC]' : 'bg-[#0062CC]/10 text-[#F5F7FA]/70 hover:text-[#FFFFFF] hover:bg-[#0062CC]/20'}`}
          >
            3. Mutaciones Auto (HITL)
          </button>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'prompt' ? 'bg-[#0062CC] text-[#FFFFFF] shadow-sm border border-[#0062CC]' : 'bg-[#0062CC]/10 text-[#F5F7FA]/70 hover:text-[#FFFFFF] hover:bg-[#0062CC]/20'}`}
          >
            4. Claude Prompt v6
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {activeTab === 'sql' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#1A1F36] border border-[#0062CC]/20 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#0062CC]/20 rounded-lg text-[#0062CC] border border-[#0062CC]/30">
                      <Database size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-[#FFFFFF]">1. Vistas SQL en Supabase (Fuzzy Match & N-Grams)</h3>
                      <p className="text-xs text-[#F5F7FA]/60">Validado con estándares PostgreSQL de Levenshtein y análisis de palabras sueltas sin conversión.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(sqlContent, 'sql')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#0062CC]/10 hover:bg-[#0062CC]/20 rounded-lg text-xs font-medium text-[#FFFFFF] transition-colors border border-[#0062CC]/30 shadow-sm"
                  >
                    {copiedId === 'sql' ? <Check size={14} className="text-[#0062CC]" /> : <Copy size={14} />}
                    {copiedId === 'sql' ? 'Copiado' : 'Copiar SQL'}
                  </button>
                </div>
                
                <pre className="bg-[#1A1F36] border border-[#0062CC]/20 p-4 rounded-xl text-xs text-[#F5F7FA]/90 overflow-x-auto tabular">
                  {sqlContent}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#1A1F36] border border-[#0062CC]/20 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#0062CC]/20 rounded-lg text-[#0062CC] border border-[#0062CC]/30">
                      <ShieldAlert size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-[#FFFFFF]">2. Alerta Diaria de Emergencia (Google Ads Script)</h3>
                      <p className="text-xs text-[#F5F7FA]/60">Ejecutar diariamente a las 08:00 AM para detectar picos de gasto y días en cero antes del reporte semanal.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(alertContent, 'alerts')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#0062CC]/10 hover:bg-[#0062CC]/20 rounded-lg text-xs font-medium text-[#FFFFFF] transition-colors border border-[#0062CC]/30 shadow-sm"
                  >
                    {copiedId === 'alerts' ? <Check size={14} className="text-[#0062CC]" /> : <Copy size={14} />}
                    {copiedId === 'alerts' ? 'Copiado' : 'Copiar Script'}
                  </button>
                </div>
                
                <pre className="bg-[#1A1F36] border border-[#0062CC]/20 p-4 rounded-xl text-xs text-[#F5F7FA]/90 overflow-x-auto tabular">
                  {alertContent}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'mutations' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#1A1F36] border border-[#0062CC]/20 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#0062CC]/20 rounded-lg text-[#0062CC] border border-[#0062CC]/30">
                      <Cpu size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-[#FFFFFF]">3. Auto-Ejecución de Accionables (Human-in-the-Loop)</h3>
                      <p className="text-xs text-[#F5F7FA]/60">Script de Google Ads que procesa mutaciones aprobadas en Supabase y reporta el estado.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(mutationsContent, 'mutations')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#0062CC]/10 hover:bg-[#0062CC]/20 rounded-lg text-xs font-medium text-[#FFFFFF] transition-colors border border-[#0062CC]/30 shadow-sm"
                  >
                    {copiedId === 'mutations' ? <Check size={14} className="text-[#0062CC]" /> : <Copy size={14} />}
                    {copiedId === 'mutations' ? 'Copiado' : 'Copiar Script'}
                  </button>
                </div>
                
                <pre className="bg-[#1A1F36] border border-[#0062CC]/20 p-4 rounded-xl text-xs text-[#F5F7FA]/90 overflow-x-auto tabular">
                  {mutationsContent}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#1A1F36] border border-[#0062CC]/20 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#0062CC]/20 rounded-lg text-[#0062CC] border border-[#0062CC]/30">
                      <Code size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-[#FFFFFF]">4. Claude Prompt v6 & Reglas Críticas Karedo</h3>
                      <p className="text-xs text-[#F5F7FA]/60">Directrices estrictas para evitar alucinaciones, prohibir ROAS/valores ficticios y detallar entidades exactas.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(promptContent, 'prompt')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#0062CC]/10 hover:bg-[#0062CC]/20 rounded-lg text-xs font-medium text-[#FFFFFF] transition-colors border border-[#0062CC]/30 shadow-sm"
                  >
                    {copiedId === 'prompt' ? <Check size={14} className="text-[#0062CC]" /> : <Copy size={14} />}
                    {copiedId === 'prompt' ? 'Copiado' : 'Copiar Prompt'}
                  </button>
                </div>
                
                <pre className="bg-[#1A1F36] border border-[#0062CC]/20 p-4 rounded-xl text-xs text-[#F5F7FA]/90 overflow-x-auto tabular whitespace-pre-wrap">
                  {promptContent}
                </pre>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const sqlContent = `-- 1. Habilitar extensión para comparar similitud de textos (Distancia de Levenshtein)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- 2. Vista de Fuzzy Match (Caza-errores ortográficos)
CREATE OR REPLACE VIEW v_alertas_fuzzy_negatives AS
SELECT
    st.account,
    st.week_start,
    st.search_term AS termino_con_gasto,
    n.negative_keyword AS negativa_similar,
    st.cost AS gasto_perdido,
    st.clicks,
    levenshtein(st.search_term, n.negative_keyword) AS letras_de_diferencia
FROM search_terms st
JOIN negatives n ON st.account = n.account
WHERE st.conversions = 0
  AND st.cost > 0
  AND levenshtein(lower(st.search_term), lower(n.negative_keyword)) BETWEEN 1 AND 2;

-- 3. Vista de N-Grams (Palabras sueltas invisibles)
CREATE OR REPLACE VIEW v_search_term_1grams AS
SELECT
    account,
    week_start,
    palabra,
    COUNT(DISTINCT search_term) AS cantidad_terminos_distintos,
    SUM(cost) AS costo_total,
    SUM(clicks) AS clics_totales,
    SUM(conversions) AS conversiones_totales
FROM (
    SELECT
        account,
        week_start,
        search_term,
        cost,
        clicks,
        conversions,
        regexp_split_to_table(lower(search_term), '\\s+') AS palabra
    FROM search_terms
    WHERE cost > 0
) sub
GROUP BY account, week_start, palabra
HAVING SUM(conversions) = 0 AND SUM(cost) > 15
ORDER BY costo_total DESC;`;

const alertContent = `var NOTIFY_EMAIL = 'biggsandres@gmail.com';
var DAILY_BUDGET = 135;

function main() {
  var account = AdsApp.currentAccount();
  var accountName = account.getName();
  
  var stats = account.getStatsFor('YESTERDAY');
  var cost = stats.getCost();
  var conversions = stats.getConversions();
  
  var alerts = [];
  
  if (cost > (DAILY_BUDGET * 1.5)) {
    alerts.push("[ALERTA] Pico de gasto detectado: " + cost.toFixed(2) + " EUR (Límite esperado: " + DAILY_BUDGET + ")");
  }
  
  if (cost > 30 && conversions === 0) {
    alerts.push("[ALERTA] Dia sin conversiones. Se gastaron " + cost.toFixed(2) + " EUR sin resultados.");
  }
  
  if (alerts.length > 0) {
    var subject = "URGENTE: Anomalía en Google Ads - " + accountName;
    var body = "Revisión de ayer en " + accountName + ":\\n\\n" +
               alerts.join('\\n') + "\\n\\n" +
               "Gasto total de ayer: " + cost.toFixed(2) + " EUR\\n" +
               "Conversiones totales: " + conversions + "\\n\\n" +
               "Revisa la cuenta lo antes posible.";
               
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  }
}`;

const mutationsContent = `function main() {
  var props = PropertiesService.getScriptProperties();
  var SUPABASE_URL = props.getProperty('SUPABASE_URL');
  var SUPABASE_KEY = props.getProperty('SUPABASE_KEY');

  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  var pendingMutations = fetchApprovedMutations(SUPABASE_URL, SUPABASE_KEY);
  
  for (var i = 0; i < pendingMutations.length; i++) {
    var task = pendingMutations[i];
    if (task.status !== 'APPROVED') continue;

    try {
      if (task.action_type === 'PAUSE_KEYWORD') {
        pauseKeyword(task.campaign_name, task.adgroup_name, task.keyword_text);
      } else if (task.action_type === 'ADD_NEGATIVE') {
        addNegativeKeyword(task.campaign_name, task.keyword_text, task.match_type);
      }
      markTaskAsStatus(SUPABASE_URL, SUPABASE_KEY, task.id, 'APPLIED');
    } catch (e) {
      markTaskAsStatus(SUPABASE_URL, SUPABASE_KEY, task.id, 'FAILED', e.message);
    }
  }
}`;

const promptContent = `<reglas_criticas>
No se negocian.

1. Las conversiones de esta cuenta son direccionales, no exactas. Enhanced Conversions tiene entre 0 y 15% de coincidencia y la conversión dispara al hacer clic en "Registrieren". Nunca afirmes que los números están subestimados ni sobrestimados.
2. Nunca reportes ROAS ni valores de conversión. El valor está fijado en 20 EUR por registro de forma arbitraria.
3. No propongas cambios de puja salvo que se apoyen en la tabla simulations o en un problema estructural evidente.
4. Si sin conexión (subida) sigue como conversión primaria sin datos, es alerta ALTA todas las semanas.
5. Nunca escribas "y 33 más" ni "varias keywords". Cada entidad va con su nombre exacto y su ubicación.
6. No inventes datos. Si falta algo, decilo.
</reglas_criticas>`;
