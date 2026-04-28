import React, { useState } from 'react';
import { ShoppingBag, Star, TrendingUp, Zap, Shield, Crown, Check, Search, Filter, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: 'strategy' | 'indicator' | 'bot' | 'course' | 'signal';
  rating: number;
  reviews: number;
  sales: number;
  icon: any;
  features: string[];
  tag?: string;
  popular?: boolean;
  premium?: boolean;
}

const products: Product[] = [
  {
    id: 'strat-001',
    name: 'Neural Scalper Pro',
    description: 'Estratégia de scalping baseada em IA para forex e cripto. 87% win rate nos últimos 3 meses.',
    price: 299.90,
    originalPrice: 499.90,
    category: 'strategy',
    rating: 4.9,
    reviews: 342,
    sales: 1284,
    icon: Zap,
    features: ['IA Proprietária', 'Backtesting', 'Multi-timeframe', 'Stop Loss Dinâmico'],
    tag: 'MAIS VENDIDO',
    popular: true
  },
  {
    id: 'bot-001',
    name: 'AutoTrader Elite',
    description: 'Robô totalmente automatizado com 3 estratégias integradas. Opere 24/7 sem intervenção.',
    price: 599.90,
    category: 'bot',
    rating: 4.7,
    reviews: 156,
    sales: 892,
    icon: Shield,
    features: ['100% Automático', 'Gestão de Risco', 'Dashboard em Tempo Real', 'Suporte VIP'],
    premium: true
  },
  {
    id: 'ind-001',
    name: 'Liquidity Zones Indicator',
    description: 'Indicador avançado para detectar zonas de liquidez e order blocks institucionais.',
    price: 149.90,
    originalPrice: 249.90,
    category: 'indicator',
    rating: 4.8,
    reviews: 523,
    sales: 2134,
    icon: TrendingUp,
    features: ['Order Flow', 'Smart Money', 'Alertas Customizáveis', 'Multi-ativos'],
    popular: true
  },
  {
    id: 'course-001',
    name: 'Day Trading Masterclass',
    description: 'Curso completo de 12 semanas com traders profissionais. Do zero ao avançado.',
    price: 997.00,
    category: 'course',
    rating: 5.0,
    reviews: 89,
    sales: 421,
    icon: Crown,
    features: ['40+ Horas de Vídeo', 'Certificado', 'Suporte Lifetime', 'Grupo Exclusivo'],
    tag: 'NOVO',
    premium: true
  },
  {
    id: 'signal-001',
    name: 'VIP Signals Monthly',
    description: 'Sinais premium diários com análise completa. Taxa de acerto de 78% comprovada.',
    price: 199.90,
    category: 'signal',
    rating: 4.6,
    reviews: 734,
    sales: 3421,
    icon: Star,
    features: ['10-15 Sinais/dia', 'Análise Técnica', 'Entry/Exit/SL', 'Telegram Premium'],
    popular: true
  },
  {
    id: 'strat-002',
    name: 'Breakout Hunter AI',
    description: 'Detecta rompimentos com precisão cirúrgica usando machine learning e volume profile.',
    price: 399.90,
    category: 'strategy',
    rating: 4.7,
    reviews: 198,
    sales: 567,
    icon: Zap,
    features: ['ML Algorithm', 'Volume Profile', 'Risk/Reward 1:3', 'Backtest Incluído']
  },
  {
    id: 'ind-002',
    name: 'Smart Money Tracker',
    description: 'Rastreie movimentos de grandes players (baleias) em tempo real no mercado cripto.',
    price: 249.90,
    category: 'indicator',
    rating: 4.9,
    reviews: 412,
    sales: 1092,
    icon: Shield,
    features: ['Whale Alerts', 'Flow Analysis', 'Exchange Inflow/Outflow', 'API Premium'],
    premium: true
  },
  {
    id: 'bot-002',
    name: 'Grid Trading Bot',
    description: 'Bot de grid trading otimizado para mercados lateralizados. Lucro consistente em ranges.',
    price: 349.90,
    category: 'bot',
    rating: 4.5,
    reviews: 267,
    sales: 789,
    icon: TrendingUp,
    features: ['Grid Automático', 'DCA Strategy', 'Spot & Futures', 'Risk Manager']
  }
];

const categories = [
  { id: 'all', label: 'Todos', count: products.length },
  { id: 'strategy', label: 'Estratégias', count: products.filter(p => p.category === 'strategy').length },
  { id: 'bot', label: 'Robôs', count: products.filter(p => p.category === 'bot').length },
  { id: 'indicator', label: 'Indicadores', count: products.filter(p => p.category === 'indicator').length },
  { id: 'signal', label: 'Sinais', count: products.filter(p => p.category === 'signal').length },
  { id: 'course', label: 'Cursos', count: products.filter(p => p.category === 'course').length },
];

export function Marketplace() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter(product => {
    const matchCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        product.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handlePurchase = (product: Product) => {
    toast.success(`${product.name} adicionado ao carrinho!`, {
      description: `Preço: R$ ${product.price.toFixed(2)}`,
      duration: 3000
    });
  };

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex-none bg-black/50 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <ShoppingBag className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
                Marketplace Neural
              </h1>
              <p className="text-slate-400 mt-1 tracking-wide font-light">
                Estratégias, Robôs, Indicadores e Cursos Premium
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="px-6 py-4 border-b border-white/10 bg-black/30 backdrop-blur-sm overflow-x-auto">
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat.label}
              <span className="ml-2 text-xs opacity-70">({cat.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`h-full bg-neutral-950/50 border backdrop-blur-sm hover:bg-white/5 transition-all group relative overflow-hidden ${
                product.premium ? 'border-yellow-500/30' : 'border-white/10'
              }`}>
                {/* Tags */}
                {product.tag && (
                  <div className="absolute top-4 left-4 z-10">
                    <Badge className="bg-emerald-600 text-white font-bold uppercase text-[10px] px-2 py-1">
                      {product.tag}
                    </Badge>
                  </div>
                )}
                {product.premium && (
                  <div className="absolute top-4 right-4 z-10">
                    <Crown className="w-5 h-5 text-yellow-500" />
                  </div>
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-3 rounded-lg ${
                      product.premium ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-purple-500/10 border border-purple-500/20'
                    }`}>
                      <product.icon className={`w-6 h-6 ${product.premium ? 'text-yellow-400' : 'text-purple-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base text-white mb-1 line-clamp-1">
                        {product.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                          <span className="text-xs font-bold text-white">{product.rating}</span>
                        </div>
                        <span className="text-xs text-slate-500">({product.reviews})</span>
                        <span className="text-xs text-slate-600">•</span>
                        <span className="text-xs text-slate-500">{product.sales} vendas</span>
                      </div>
                    </div>
                  </div>

                  <CardDescription className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {product.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Features */}
                  <div className="space-y-1.5">
                    {product.features.slice(0, 3).map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="line-clamp-1">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Price & CTA */}
                  <div className="pt-3 border-t border-white/5">
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        {product.originalPrice && (
                          <p className="text-xs text-slate-600 line-through">
                            R$ {product.originalPrice.toFixed(2)}
                          </p>
                        )}
                        <p className="text-2xl font-bold text-white">
                          R$ {product.price.toFixed(2)}
                        </p>
                      </div>
                      {product.originalPrice && (
                        <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
                          -{Math.round((1 - product.price / product.originalPrice) * 100)}%
                        </Badge>
                      )}
                    </div>

                    <Button
                      onClick={() => handlePurchase(product)}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase text-xs tracking-wider transition-all group/btn"
                    >
                      Comprar Agora
                      <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingBag className="w-16 h-16 text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Nenhum produto encontrado</h3>
            <p className="text-slate-400">Tente ajustar os filtros ou buscar por outro termo</p>
          </div>
        )}
      </div>
    </div>
  );
}
