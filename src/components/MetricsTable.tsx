import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface HistoryRecord {
  week_start: string;
  spend: number;
  cpa: number;
  conversions: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
}

export function MetricsTable({ data, client }: { data: HistoryRecord[], client?: string | null }) {
  if (!data || data.length === 0) return null;

  // Sort by date descending for the table
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());
  }, [data]);

  const totals = useMemo(() => {
    const totalSpend = data.reduce((sum, row) => sum + row.spend, 0);
    const totalConversions = data.reduce((sum, row) => sum + row.conversions, 0);
    const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
    const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
    
    const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    
    return {
      spend: totalSpend,
      conversions: totalConversions,
      cpa: avgCpa,
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: avgCtr
    };
  }, [data]);

  const formatDiff = (diff: number, isGoodWhenUp: boolean, type: 'currency' | 'number' | 'percent' = 'number') => {
    if (diff === 0 || isNaN(diff)) return <span className="text-[#F5F7FA] opacity-60 text-[10px] ml-2 w-12 text-right inline-block"><Minus size={10} className="inline" /></span>;
    const isGood = isGoodWhenUp ? diff > 0 : diff < 0;
    const color = isGood ? "text-[#FFFFFF]" : "text-[#0062CC]";
    const Icon = diff > 0 ? TrendingUp : TrendingDown;
    const prefix = diff > 0 ? "+" : "";
    
    let formattedVal = "";
    if (type === 'currency') {
      formattedVal = `$${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    } else if (type === 'percent') {
      formattedVal = `${Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
    } else {
      formattedVal = Math.abs(diff).toLocaleString(undefined, { maximumFractionDigits: 1 });
    }

    return (
      <span className={`text-[10px] ml-1 ${color} flex items-center justify-end gap-0.5 w-12 inline-flex font-medium`}>
        <Icon size={10} /> {prefix}{formattedVal}
      </span>
    );
  };

  return (
    <div className="bg-[#1A1F36] border border-[#0062CC]/20 rounded-2xl p-6 mt-6 overflow-hidden flex flex-col shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-[#FFFFFF] flex items-center gap-2">
          <Activity className="text-[#0062CC]" size={18} />
          Métricas de Campaña (Google Ads View)
        </h2>
      </div>
      
      <div className="overflow-x-auto custom-scrollbar flex-1 pb-2">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#0062CC]/30 text-[11px] uppercase tracking-wider text-[#F5F7FA]/70 bg-[#1A1F36]">
              <th className="py-3 px-4 font-semibold rounded-tl-lg sticky left-0 bg-[#1A1F36] z-10">Semana</th>
              <th className="py-3 px-4 font-semibold text-right">Impresiones</th>
              <th className="py-3 px-4 font-semibold text-right">Clics</th>
              <th className="py-3 px-4 font-semibold text-right">CTR</th>
              <th className="py-3 px-4 font-semibold text-right">Inversión</th>
              <th className="py-3 px-4 font-semibold text-right">CPA</th>
              <th className="py-3 px-4 font-semibold text-right rounded-tr-lg">{client === 'BHI' ? 'Convs. (Plataforma)' : client === 'KAREDO' ? 'Convs. (Direccionales)' : 'Conversiones'}</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {sortedData.map((row, i) => {
              const prevRow = sortedData[i + 1];
              
              const impDiff = prevRow ? (row.impressions || 0) - (prevRow.impressions || 0) : 0;
              const clkDiff = prevRow ? (row.clicks || 0) - (prevRow.clicks || 0) : 0;
              const ctrDiff = prevRow ? (row.ctr || 0) - (prevRow.ctr || 0) : 0;
              const spendDiff = prevRow ? row.spend - prevRow.spend : 0;
              const cpaDiff = prevRow ? row.cpa - prevRow.cpa : 0;
              const convDiff = prevRow ? row.conversions - prevRow.conversions : 0;
              
              return (
                <tr key={row.week_start} className="border-b border-[#0062CC]/20 hover:bg-[#0062CC]/10 transition-colors group">
                  <td className="py-3 px-4 text-[#FFFFFF] font-medium sticky left-0 bg-[#1A1F36] group-hover:bg-[#1A1F36] transition-colors z-10 border-b border-[#0062CC]/20">
                    {new Date(row.week_start).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="py-3 px-4 text-[#F5F7FA] text-right">
                    <div className="flex items-center justify-end">
                      <span className="tabular text-[13px]">{(row.impressions || 0).toLocaleString()}</span>
                      {formatDiff(impDiff, true, 'number')}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#F5F7FA] text-right">
                    <div className="flex items-center justify-end">
                      <span className="tabular text-[13px]">{(row.clicks || 0).toLocaleString()}</span>
                      {formatDiff(clkDiff, true, 'number')}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#F5F7FA] text-right">
                    <div className="flex items-center justify-end">
                      <span className="tabular text-[13px]">{(row.ctr || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span>
                      {formatDiff(ctrDiff, true, 'percent')}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#F5F7FA] text-right">
                    <div className="flex items-center justify-end">
                      <span className="tabular text-[13px]">${row.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      {formatDiff(spendDiff, false, 'currency')}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#F5F7FA] text-right">
                    <div className="flex items-center justify-end">
                      <span className="tabular text-[13px]">${row.cpa.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                      {formatDiff(cpaDiff, false, 'currency')}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#F5F7FA] text-right">
                    <div className="flex items-center justify-end">
                      <span className="tabular text-[13px]">{row.conversions.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                      {formatDiff(convDiff, true, 'number')}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-white/[0.02]">
            <tr className="border-t-2 border-white/10 font-medium text-sm">
              <td className="py-4 px-4 text-[#F5F7FA] opacity-80 rounded-bl-lg sticky left-0 bg-[var(--surface-0)] z-10 border-t border-white/10">
                Total / Promedio
              </td>
              <td className="py-4 px-4 text-[#F5F7FA] text-right tabular text-[13px]">
                {totals.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className="py-4 px-4 text-[#F5F7FA] text-right tabular text-[13px]">
                {totals.clicks.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className="py-4 px-4 text-[#F5F7FA] text-right tabular text-[13px]">
                {totals.ctr.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
              </td>
              <td className="py-4 px-4 text-[#F5F7FA] text-right tabular text-[13px]">
                ${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
              <td className="py-4 px-4 text-[#F5F7FA] text-right tabular text-[13px]">
                ${totals.cpa.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </td>
              <td className="py-4 px-4 text-[#F5F7FA] text-right tabular text-[13px] rounded-br-lg">
                {totals.conversions.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
