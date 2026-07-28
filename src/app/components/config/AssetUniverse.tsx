import React, { useMemo, useState } from 'react';
import {
  Globe,
  Coins,
  BarChart,
  Building2,
  Gem,
  Flame,
  Wheat,
  Landmark,
  Sparkles,
  X,
  ChevronDown,
  ListChecks,
  Trash2
} from 'lucide-react';
import { getInfinoxAssetsByCategory } from '@/config/infinoxAssets';
import { ALL_ASSETS, type Asset } from '@/app/config/assetDatabase';
import { InfinoxAssetsBrowser } from '@/app/components/dashboard/InfinoxAssetsBrowser';

// ✅ 2026-07-28: catálogo real (ver histórico de comentário anterior neste
// arquivo — a lista hardcoded/não auditada foi removida, deriva de
// `getInfinoxAssetsByCategory()`, mesma fonte do Dashboard).
//
// ✅ 2026-07-28 (redesign de UI): o grid de cards grandes (1 card por ativo,
// ~90px de altura cada) ocupava uma área de tela enorme com só ~350 ativos
// reais disponíveis — inviável de navegar sem rolar bastante. Substituído
// por um combobox de busca compacto (padrão "command palette", já usado em
// `MarketScore.tsx` neste mesmo projeto via `cmdk`/`ui/command.tsx`):
// um único botão-gatilho abre um popover com busca + lista agrupada por
// categoria, seleção múltipla sem fechar o popover, e os ativos escolhidos
// aparecem como chips compactos removíveis. Mesma funcionalidade (buscar,
// ver categoria, ver aberto/fechado, selecionar/remover), fração do espaço.

// --- THEME ---

const THEME_COLORS = {
  purple: { text: 'text-purple-400', dot: 'bg-purple-500', border: 'border-purple-500/40', bgLight: 'bg-purple-500/10' },
  emerald: { text: 'text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-500/40', bgLight: 'bg-emerald-500/10' },
  blue: { text: 'text-blue-400', dot: 'bg-blue-500', border: 'border-blue-500/40', bgLight: 'bg-blue-500/10' },
  amber: { text: 'text-amber-400', dot: 'bg-amber-500', border: 'border-amber-500/40', bgLight: 'bg-amber-500/10' },
  red: { text: 'text-red-400', dot: 'bg-red-500', border: 'border-red-500/40', bgLight: 'bg-red-500/10' },
  cyan: { text: 'text-cyan-400', dot: 'bg-cyan-500', border: 'border-cyan-500/40', bgLight: 'bg-cyan-500/10' }
};

type ThemeColorKey = keyof typeof THEME_COLORS;

// Chaves idênticas às retornadas por getInfinoxAssetsByCategory()
type DisplayCategory =
  | 'CRYPTO' | 'FOREX' | 'METALS' | 'ENERGY' | 'COMMODITIES'
  | 'INDICES' | 'STOCKS_UK' | 'STOCKS_EU' | 'BONDS';

const CATEGORY_META: Record<DisplayCategory, { label: string; icon: React.ReactNode; color: ThemeColorKey }> = {
  CRYPTO: { label: 'Cripto', icon: <Coins className="w-3.5 h-3.5" />, color: 'purple' },
  FOREX: { label: 'Forex', icon: <Globe className="w-3.5 h-3.5" />, color: 'emerald' },
  METALS: { label: 'Metais', icon: <Gem className="w-3.5 h-3.5" />, color: 'amber' },
  ENERGY: { label: 'Energia', icon: <Flame className="w-3.5 h-3.5" />, color: 'red' },
  COMMODITIES: { label: 'Agrícolas', icon: <Wheat className="w-3.5 h-3.5" />, color: 'amber' },
  INDICES: { label: 'Índices', icon: <BarChart className="w-3.5 h-3.5" />, color: 'blue' },
  STOCKS_UK: { label: 'Ações UK', icon: <Building2 className="w-3.5 h-3.5" />, color: 'amber' },
  STOCKS_EU: { label: 'Ações Europa', icon: <Building2 className="w-3.5 h-3.5" />, color: 'amber' },
  BONDS: { label: 'Bonds', icon: <Landmark className="w-3.5 h-3.5" />, color: 'cyan' }
};

const CATEGORY_ORDER: DisplayCategory[] = [
  'CRYPTO', 'FOREX', 'METALS', 'ENERGY', 'COMMODITIES', 'INDICES', 'STOCKS_UK', 'STOCKS_EU', 'BONDS'
];

// Curadoria fixa de atalhos "1 clique" — só entra aqui um símbolo se
// realmente existir no catálogo auditado (checado em runtime abaixo).
const QUICK_PICK_SYMBOLS = ['BTCUSD', 'XAUUSD', 'EURUSD', 'US30', 'NAS100', 'SPX500', 'GER40', 'XAGUSD'];

// Aproximação por classe de ativo — não substitui calendário de feriado por
// bolsa, só fim de semana/janela padrão UTC.
function isMarketOpen(asset: Asset): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Domingo, 6 = Sábado

  if (asset.category === 'CRYPTO') return true;

  if (asset.category === 'FOREX' || asset.category === 'BONDS' || asset.subCategory === 'Precious Metals') {
    if (dayOfWeek === 0) return false;
    if (dayOfWeek === 6) return false;
    if (dayOfWeek === 5 && utcHour >= 22) return false;
    return true;
  }

  if (asset.subCategory === 'Energy' || asset.subCategory === 'Agriculture') {
    if (dayOfWeek === 0 && utcHour >= 23) return true;
    if (dayOfWeek >= 1 && dayOfWeek <= 4) return true;
    if (dayOfWeek === 5 && utcHour < 22) return true;
    return false;
  }

  if (asset.category === 'INDICES') {
    if (asset.subCategory === 'US Indices') {
      if (dayOfWeek === 0 && utcHour >= 23) return true;
      if (dayOfWeek >= 1 && dayOfWeek <= 4) return true;
      if (dayOfWeek === 5 && utcHour < 22) return true;
      return false;
    }
    if (asset.subCategory === 'European Indices') {
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      return utcHour >= 8 && utcHour < 22;
    }
    if (asset.subCategory === 'Asian Indices') {
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      return utcHour >= 0 && utcHour < 8;
    }
    if (asset.subCategory === 'LatAm Indices') {
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      return utcHour >= 13 && utcHour < 20;
    }
    return true;
  }

  if (asset.category === 'STOCKS') {
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    return utcHour >= 8 && utcHour < 17;
  }

  return true;
}

interface AssetUniverseProps {
  selectedAssets: string[];
  onToggle: (asset: string) => void;
}

export function AssetUniverse({ selectedAssets, onToggle }: AssetUniverseProps) {
  const [isOpen, setIsOpen] = useState(false);

  const bySymbol = useMemo(() => {
    const map = new Map<string, Asset>();
    for (const asset of ALL_ASSETS) map.set(asset.symbol, asset);
    return map;
  }, []);

  // Catálogo real, auditado contra a API da Infinox (mesma fonte do Dashboard)
  const realCatalog = useMemo(() => getInfinoxAssetsByCategory(), []);

  const assetsByCategory = useMemo(() => {
    const result: Record<DisplayCategory, Asset[]> = {} as Record<DisplayCategory, Asset[]>;
    for (const catId of CATEGORY_ORDER) {
      const symbols = realCatalog[catId] || [];
      result[catId] = symbols
        .map(s => bySymbol.get(s))
        .filter((a): a is Asset => !!a)
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
    }
    return result;
  }, [realCatalog, bySymbol]);

  const totalAvailable = useMemo(
    () => CATEGORY_ORDER.reduce((sum, catId) => sum + (realCatalog[catId]?.length || 0), 0),
    [realCatalog]
  );

  const quickPicks = useMemo(
    () => QUICK_PICK_SYMBOLS.filter(s => bySymbol.has(s)),
    [bySymbol]
  );

  const clearAll = () => {
    for (const symbol of [...selectedAssets]) onToggle(symbol);
  };

  const selectedSorted = [...selectedAssets].sort((a, b) => a.localeCompare(b));

  return (
    <div className="w-full bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 shadow-xl">
      {/* Header + Trigger */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white tracking-tight leading-none">Universo de Ativos - Infinox</h2>
            <p className="text-[10px] text-slate-500 mt-1 truncate">
              Catálogo auditado contra a API real ({totalAvailable} ativos disponíveis)
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-[#111] hover:bg-[#161616] border border-white/10 hover:border-purple-500/40 px-3 py-2 rounded-lg text-xs font-bold text-slate-200 transition-all shrink-0"
        >
          <ListChecks className="w-3.5 h-3.5 text-purple-400" />
          {selectedAssets.length} selecionado{selectedAssets.length !== 1 ? 's' : ''}
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {/* ✅ 2026-07-28: reaproveita o mesmo navegador de ativos do Dashboard
            (InfinoxAssetsBrowser, catálogo `getInfinoxAssetsByCategory()`
            idêntico ao usado aqui) em modo multi-seleção, em vez de manter
            uma segunda implementação de busca+grid redundante via cmdk. */}
        <InfinoxAssetsBrowser
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          mode="multi"
          selectedAssets={selectedAssets}
          onToggleAsset={onToggle}
        />
      </div>

      {/* Quick picks — só mostra os que ainda não estão selecionados */}
      {quickPicks.some(s => !selectedAssets.includes(s)) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wide mr-1">Populares:</span>
          {quickPicks.filter(s => !selectedAssets.includes(s)).map(symbol => (
            <button
              key={symbol}
              onClick={() => onToggle(symbol)}
              className="text-[10px] font-mono font-bold px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 hover:border-white/20 transition-colors"
            >
              + {symbol}
            </button>
          ))}
        </div>
      )}

      {/* Selected chips */}
      {selectedSorted.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-600 border border-dashed border-white/10 rounded-lg">
          Nenhum ativo selecionado — use o buscador acima.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {selectedSorted.map(symbol => {
            const asset = bySymbol.get(symbol);
            const catId = asset ? (Object.entries(realCatalog).find(([, syms]) => syms.includes(symbol))?.[0] as DisplayCategory | undefined) : undefined;
            const theme = catId ? THEME_COLORS[CATEGORY_META[catId].color] : THEME_COLORS.purple;
            const isOpenNow = asset ? isMarketOpen(asset) : true;
            return (
              <span
                key={symbol}
                className={`group flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-[10px] font-bold font-mono border ${theme.bgLight} ${theme.border} text-slate-200`}
                title={asset?.name}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOpenNow ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                {symbol}
                <button
                  onClick={() => onToggle(symbol)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                  aria-label={`Remover ${symbol}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Limpar
          </button>
        </div>
      )}
    </div>
  );
}
