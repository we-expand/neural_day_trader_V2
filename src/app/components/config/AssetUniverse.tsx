import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe,
  Coins,
  BarChart,
  Building2,
  Gem,
  Flame,
  Wheat,
  Landmark,
  Search,
  Check,
  Filter,
  Layers,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react';
import { getInfinoxAssetsByCategory } from '@/config/infinoxAssets';
import { ALL_ASSETS, type Asset, type AssetSubCategory } from '@/app/config/assetDatabase';

// ✅ 2026-07-28: esta lista ANTES era um catálogo digitado à mão, nunca
// validado contra a API real da Infinox (mesmo problema já corrigido em
// `infinoxAssets.ts`/`brokerRegistry.ts` em 2026-07-08 — ver comentário lá).
// Continha símbolos inexistentes (ex: 'TOTUSD'/"Tottenham" como cripto,
// 'JSON'/"JSON Token", 'USDIGN'/"Ignition", variantes 'dft'/'R' sem
// confirmação). Agora deriva 100% do catálogo canônico auditado
// (`assetDatabase.ts` filtrado por `brokerRegistry.isAvailableOnBroker`,
// via `getInfinoxAssetsByCategory()`) — a MESMA fonte que o seletor de
// ativos do Dashboard usa. Zero lista duplicada.

// --- THEME ---

const THEME_COLORS = {
  purple: {
    text: 'text-purple-400', textDark: 'text-purple-300', bgLight: 'bg-purple-500/10',
    bgDark: 'bg-purple-500/5', bgHighlight: 'bg-purple-500/20', bgFull: 'bg-purple-500',
    border: 'border-purple-500/50', borderFull: 'border-purple-500', icon: 'text-purple-400'
  },
  emerald: {
    text: 'text-emerald-400', textDark: 'text-emerald-300', bgLight: 'bg-emerald-500/10',
    bgDark: 'bg-emerald-500/5', bgHighlight: 'bg-emerald-500/20', bgFull: 'bg-emerald-500',
    border: 'border-emerald-500/50', borderFull: 'border-emerald-500', icon: 'text-emerald-400'
  },
  blue: {
    text: 'text-blue-400', textDark: 'text-blue-300', bgLight: 'bg-blue-500/10',
    bgDark: 'bg-blue-500/5', bgHighlight: 'bg-blue-500/20', bgFull: 'bg-blue-500',
    border: 'border-blue-500/50', borderFull: 'border-blue-500', icon: 'text-blue-400'
  },
  amber: {
    text: 'text-amber-400', textDark: 'text-amber-300', bgLight: 'bg-amber-500/10',
    bgDark: 'bg-amber-500/5', bgHighlight: 'bg-amber-500/20', bgFull: 'bg-amber-500',
    border: 'border-amber-500/50', borderFull: 'border-amber-500', icon: 'text-amber-400'
  },
  red: {
    text: 'text-red-400', textDark: 'text-red-300', bgLight: 'bg-red-500/10',
    bgDark: 'bg-red-500/5', bgHighlight: 'bg-red-500/20', bgFull: 'bg-red-500',
    border: 'border-red-500/50', borderFull: 'border-red-500', icon: 'text-red-400'
  },
  cyan: {
    text: 'text-cyan-400', textDark: 'text-cyan-300', bgLight: 'bg-cyan-500/10',
    bgDark: 'bg-cyan-500/5', bgHighlight: 'bg-cyan-500/20', bgFull: 'bg-cyan-500',
    border: 'border-cyan-500/50', borderFull: 'border-cyan-500', icon: 'text-cyan-400'
  }
};

type ThemeColorKey = keyof typeof THEME_COLORS;

// Chaves idênticas às retornadas por getInfinoxAssetsByCategory()
type DisplayCategory =
  | 'CRYPTO' | 'FOREX' | 'METALS' | 'ENERGY' | 'COMMODITIES'
  | 'INDICES' | 'STOCKS_UK' | 'STOCKS_EU' | 'BONDS';

const CATEGORY_META: Record<DisplayCategory, { label: string; icon: React.ReactNode; color: ThemeColorKey }> = {
  CRYPTO: { label: 'Criptoativos (24/7)', icon: <Coins className="w-4 h-4" />, color: 'purple' },
  FOREX: { label: 'Forex & Moedas', icon: <Globe className="w-4 h-4" />, color: 'emerald' },
  METALS: { label: 'Metais Preciosos', icon: <Gem className="w-4 h-4" />, color: 'amber' },
  ENERGY: { label: 'Energia', icon: <Flame className="w-4 h-4" />, color: 'red' },
  COMMODITIES: { label: 'Commodities Agrícolas', icon: <Wheat className="w-4 h-4" />, color: 'amber' },
  INDICES: { label: 'Índices Globais', icon: <BarChart className="w-4 h-4" />, color: 'blue' },
  STOCKS_UK: { label: 'Ações Reino Unido', icon: <Building2 className="w-4 h-4" />, color: 'amber' },
  STOCKS_EU: { label: 'Ações Europa Continental', icon: <Building2 className="w-4 h-4" />, color: 'amber' },
  BONDS: { label: 'Títulos (Bonds)', icon: <Landmark className="w-4 h-4" />, color: 'cyan' }
};

const CATEGORY_ORDER: DisplayCategory[] = [
  'CRYPTO', 'FOREX', 'METALS', 'ENERGY', 'COMMODITIES', 'INDICES', 'STOCKS_UK', 'STOCKS_EU', 'BONDS'
];

// Heurística de volatilidade por subcategoria — o catálogo canônico não traz
// esse dado, então aproximamos por classe de ativo (mesmo critério usado na
// versão anterior deste componente).
const VOLATILITY_BY_SUBCATEGORY: Partial<Record<AssetSubCategory, 'Low' | 'Medium' | 'High' | 'Extreme'>> = {
  'Major Pairs': 'Low',
  'Minor Pairs': 'Medium',
  'Exotic Pairs': 'High',
  'Bitcoin': 'High',
  'Altcoins': 'High',
  'DeFi': 'Extreme',
  'Meme Coins': 'Extreme',
  'US Indices': 'Medium',
  'European Indices': 'Medium',
  'Asian Indices': 'High',
  'LatAm Indices': 'High',
  'Precious Metals': 'Medium',
  'Energy': 'High',
  'Agriculture': 'Extreme',
  'UK Stocks': 'Medium',
  'French Stocks': 'Medium',
  'German Stocks': 'Medium',
  'Spanish Stocks': 'Medium',
  'Portuguese Stocks': 'Medium',
  'Dutch Stocks': 'Medium',
  'Scandinavian Stocks': 'Medium',
  'US Stocks': 'Medium',
  'European Bonds': 'Low',
  'US Bonds': 'Low'
};

// 🆕 FUNÇÃO QUE DETECTA SE O MERCADO ESTÁ ABERTO (aproximação por classe de
// ativo — não substitui calendário de feriado por bolsa, só fim de
// semana/janela padrão UTC).
function isMarketOpen(asset: Asset): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Domingo, 6 = Sábado

  if (asset.category === 'CRYPTO') return true;

  // Forex, Bonds e Metais Preciosos seguem o horário padrão de câmbio
  if (asset.category === 'FOREX' || asset.category === 'BONDS' || asset.subCategory === 'Precious Metals') {
    if (dayOfWeek === 0) return false; // Domingo
    if (dayOfWeek === 6) return false; // Sábado
    if (dayOfWeek === 5 && utcHour >= 22) return false; // Sexta fecha 22:00 UTC
    return true;
  }

  // Energia/Agricultura: horário de futuro (Dom 23:00 UTC - Sex 22:00 UTC)
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
      // Ibovespa: 10h-17h BRT (UTC-3) ≈ 13h-20h UTC
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      return utcHour >= 13 && utcHour < 20;
    }
    return true;
  }

  if (asset.category === 'STOCKS') {
    // Bolsas europeias, aproximação única (08:00-16:30 UTC)
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    return utcHour >= 8 && utcHour < 17;
  }

  return true;
}

interface AssetGroup {
  name: string;
  items: Asset[];
}

interface AssetUniverseProps {
  selectedAssets: string[];
  onToggle: (asset: string) => void;
}

export function AssetUniverse({ selectedAssets, onToggle }: AssetUniverseProps) {
  const [activeTab, setActiveTab] = useState<DisplayCategory>('CRYPTO');
  const [searchTerm, setSearchTerm] = useState('');

  const bySymbol = useMemo(() => {
    const map = new Map<string, Asset>();
    for (const asset of ALL_ASSETS) map.set(asset.symbol, asset);
    return map;
  }, []);

  // Catálogo real, auditado contra a API da Infinox (mesma fonte do Dashboard)
  const realCatalog = useMemo(() => getInfinoxAssetsByCategory(), []);

  const categoriesWithAssets = useMemo(() => {
    const result: Record<DisplayCategory, AssetGroup[]> = {} as Record<DisplayCategory, AssetGroup[]>;

    for (const catId of CATEGORY_ORDER) {
      const symbols = realCatalog[catId] || [];
      const groupsBySubCategory = new Map<string, Asset[]>();

      for (const symbol of symbols) {
        const asset = bySymbol.get(symbol);
        if (!asset) continue; // não deveria acontecer — catálogo real deriva do mesmo assetDatabase
        const groupKey = asset.subCategory;
        if (!groupsBySubCategory.has(groupKey)) groupsBySubCategory.set(groupKey, []);
        groupsBySubCategory.get(groupKey)!.push(asset);
      }

      result[catId] = Array.from(groupsBySubCategory.entries())
        .map(([name, items]) => ({ name, items: items.sort((a, b) => a.symbol.localeCompare(b.symbol)) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [realCatalog, bySymbol]);

  const meta = CATEGORY_META[activeTab];
  const theme = THEME_COLORS[meta.color];

  const filteredGroups = categoriesWithAssets[activeTab]
    ?.map(group => ({
      ...group,
      items: group.items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }))
    .filter(group => group.items.length > 0);

  return (
    <div className="w-full bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative group">
      {/* Ambient Background Glow */}
      <div className={`absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-50 transition-colors duration-700 pointer-events-none ${theme.bgDark}`}></div>

      {/* Header */}
      <div className="p-6 border-b border-white/5 relative z-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
              <Sparkles className={`w-5 h-5 ${theme.icon}`} />
              Universo de Ativos - Infinox
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Ativos confirmados via auditoria real da API Infinox/MetaTrader 5 (mesmo catálogo do Dashboard). Conecte outras corretoras para expandir.
            </p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar símbolo ou nome..."
              className="bg-black border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white w-56 focus:border-white/30 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto scrollbar-none border-b border-white/5 bg-black/20 px-2">
        {CATEGORY_ORDER.map(catId => {
          const catMeta = CATEGORY_META[catId];
          const catTheme = THEME_COLORS[catMeta.color];
          const isActive = activeTab === catId;
          const count = realCatalog[catId]?.length || 0;
          return (
            <button
              key={catId}
              onClick={() => setActiveTab(catId)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? `${catTheme.borderFull} text-white bg-white/[0.02]`
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.01]'
              }`}
            >
              <span className={isActive ? catTheme.text : ''}>{catMeta.icon}</span>
              {catMeta.label}
              <span className="text-[9px] text-slate-600 font-mono normal-case">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid Content */}
      <div className="p-6 min-h-[400px] relative z-10 bg-black/20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + searchTerm}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {!filteredGroups || filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                <Filter className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">Nenhum ativo encontrado nesta categoria.</p>
              </div>
            ) : (
              filteredGroups.map((group, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2">
                    <Layers className="w-3 h-3" />
                    {group.name}
                  </h3>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {group.items.map((asset) => {
                      const isSelected = selectedAssets.includes(asset.symbol);
                      const isOpen = isMarketOpen(asset);
                      const volatility = VOLATILITY_BY_SUBCATEGORY[asset.subCategory] || 'Medium';
                      return (
                        <button
                          key={asset.symbol}
                          onClick={() => onToggle(asset.symbol)}
                          className={`relative z-20 cursor-pointer group/card flex flex-col p-3 rounded-xl border transition-all duration-300 text-left hover:-translate-y-1 ${
                            isSelected
                              ? `${theme.bgLight} ${theme.border} shadow-[0_0_20px_rgba(0,0,0,0.3)]`
                              : 'bg-neutral-900 border-white/5 hover:border-white/20 hover:bg-neutral-800'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-xs font-black font-mono px-1.5 py-0.5 rounded ${
                              isSelected
                                ? `${theme.bgHighlight} ${theme.textDark}`
                                : 'bg-white/5 text-slate-400'
                            }`}>
                              {asset.symbol}
                            </span>

                            <div className="flex flex-col items-end gap-1">
                              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase ${
                                isOpen
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                              }`}>
                                <div className={`w-1 h-1 rounded-full ${
                                  isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                                }`} />
                                {isOpen ? 'ABERTO' : 'FECHADO'}
                              </div>

                              {isSelected && (
                                <div className={`w-4 h-4 rounded-full ${theme.bgFull || 'bg-white'} flex items-center justify-center shadow-lg`}>
                                  <Check className="w-2.5 h-2.5 text-black font-bold" />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-auto">
                            <p className={`text-[10px] font-medium leading-tight mb-1 truncate ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                              {asset.name}
                            </p>
                            <div className="flex items-center gap-1">
                              {volatility === 'Extreme' && <Zap className="w-3 h-3 text-red-500" />}
                              {volatility === 'High' && <TrendingUp className="w-3 h-3 text-amber-500" />}
                              <span className={`text-[9px] uppercase ${
                                volatility === 'Extreme' ? 'text-red-500 font-bold' :
                                volatility === 'High' ? 'text-amber-500' :
                                volatility === 'Low' ? 'text-emerald-500' :
                                'text-blue-500'
                              }`}>
                                {volatility} VOL
                              </span>
                            </div>
                          </div>

                          {/* Selection Ring Animation */}
                          {isSelected && (
                            <motion.div
                              layoutId={`ring-${asset.symbol}`}
                              className={`absolute inset-0 border-2 ${theme.borderFull} rounded-xl pointer-events-none`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="bg-black/40 p-3 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500 px-6">
        <span>{selectedAssets.length} ativos monitorados</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-red-500" /> Alta Volatilidade</span>
          <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-emerald-500" /> Forex 24h</span>
        </div>
      </div>
    </div>
  );
}
