/**
 * 📊 DATA SOURCE INDICATOR
 *
 * Indicador discreto confirmando que o feed de mercado é real:
 * cripto via Binance, forex/índices/commodities via conta MetaAPI de
 * plataforma (não depende de o usuário conectar a própria conta MT5).
 */

import { Wifi } from 'lucide-react';

export function DataSourceIndicator() {
  return (
    <div className="fixed top-20 right-4 z-40">
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-wide">
            Dados Reais
          </span>
        </div>
      </div>
    </div>
  );
}
