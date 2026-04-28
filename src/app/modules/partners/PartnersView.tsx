/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - PARTNERS MODULE                              ║
 * ║  Main Component                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Database,
  GraduationCap,
  Boxes,
  Award,
  Star,
  ExternalLink,
  CheckCircle2,
  Users,
  Calendar,
  MapPin,
  TrendingUp,
  Filter,
  Search,
  Sparkles,
  Crown,
  Medal,
  Shield,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { Partner, PartnerCategory, PartnerTier } from './types';
import { PARTNERS_DATABASE, getFeaturedPartners } from './partnersData';

export function PartnersView() {
  const [selectedCategory, setSelectedCategory] = useState<PartnerCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  // Filtrar parceiros
  const filteredPartners = useMemo(() => {
    let filtered = PARTNERS_DATABASE;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [selectedCategory, searchQuery]);

  // Stats
  const stats = {
    totalPartners: PARTNERS_DATABASE.length,
    totalUsers: PARTNERS_DATABASE.reduce((sum, p) => sum + p.usersCount, 0),
    averageRating: PARTNERS_DATABASE.reduce((sum, p) => sum + p.rating, 0) / PARTNERS_DATABASE.length,
    verified: PARTNERS_DATABASE.filter(p => p.verified).length,
  };

  console.log('[PARTNERS] Module loaded with', PARTNERS_DATABASE.length, 'partners');

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="border-b border-white/10 bg-gradient-to-br from-blue-950/20 via-black to-purple-950/20">
        <div className="max-w-[1600px] mx-auto px-8 py-16">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-sm text-blue-400 font-semibold mb-6">
              <Award className="w-4 h-4" />
              {stats.verified} Parceiros Verificados
            </div>

            <h1 className="text-6xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Parceiros Estratégicos
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Conecte-se com os melhores brokers, prop firms, provedores de dados e plataformas do mercado.
              Todos verificados e recomendados pela Neural Day Trader.
            </p>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <StatsCard
                icon={Building2}
                value={stats.totalPartners.toString()}
                label="Parceiros"
                color="blue"
              />
              <StatsCard
                icon={Users}
                value={formatNumber(stats.totalUsers)}
                label="Usuários Totais"
                color="purple"
              />
              <StatsCard
                icon={Star}
                value={stats.averageRating.toFixed(1)}
                label="Rating Médio"
                color="yellow"
              />
              <StatsCard
                icon={CheckCircle2}
                value={stats.verified.toString()}
                label="Verificados"
                color="emerald"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex items-center gap-6">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar parceiros..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-500" />
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    selectedCategory === cat.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Partners Grid */}
      <div className="max-w-[1600px] mx-auto px-8 py-12">
        {/* Featured Section */}
        {selectedCategory === 'all' && !searchQuery && (
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <Crown className="w-6 h-6 text-yellow-400" />
              <h2 className="text-3xl font-bold">Parceiros em Destaque</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {getFeaturedPartners().map(partner => (
                <FeaturedPartnerCard
                  key={partner.id}
                  partner={partner}
                  onClick={() => setSelectedPartner(partner)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Partners */}
        <div>
          <h2 className="text-2xl font-bold mb-6">
            {selectedCategory === 'all' ? 'Todos os Parceiros' : CATEGORIES.find(c => c.id === selectedCategory)?.label}
            <span className="text-slate-500 ml-3">({filteredPartners.length})</span>
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPartners.map(partner => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onClick={() => setSelectedPartner(partner)}
              />
            ))}
          </div>

          {filteredPartners.length === 0 && (
            <div className="text-center py-20">
              <Search className="w-20 h-20 text-slate-700 mx-auto mb-4" />
              <p className="text-xl text-slate-500">Nenhum parceiro encontrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Partner Details Modal */}
      {selectedPartner && (
        <PartnerDetailsModal
          partner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// STATS CARD
// ============================================================================

interface StatsCardProps {
  icon: React.ElementType;
  value: string;
  label: string;
  color: string;
}

function StatsCard({ icon: Icon, value, label, color }: StatsCardProps) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <div className={`w-10 h-10 bg-${color}-500/10 border border-${color}-500/30 rounded-lg flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 text-${color}-400`} />
      </div>
      <div className={`text-2xl font-bold text-${color}-400 mb-1`}>{value}</div>
      <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</div>
    </div>
  );
}

// ============================================================================
// FEATURED PARTNER CARD
// ============================================================================

interface FeaturedPartnerCardProps {
  partner: Partner;
  onClick: () => void;
}

function FeaturedPartnerCard({ partner, onClick }: FeaturedPartnerCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-blue-500/50 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:shadow-blue-500/10"
    >
      <div className="absolute top-6 right-6 z-10">
        <TierBadge tier={partner.tier} />
      </div>

      <div className="p-8">
        <div className="flex items-start gap-6 mb-6">
          <div className="w-20 h-20 bg-white rounded-2xl p-3 shadow-xl shrink-0">
            <img src={partner.logo} alt={partner.name} className="w-full h-full object-contain" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold group-hover:text-blue-400 transition-colors truncate">
                {partner.name}
              </h3>
              {partner.verified && (
                <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
              )}
            </div>

            <CategoryBadge category={partner.category} />

            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">{partner.rating}</span>
              </div>
              <div className="text-sm text-slate-400">
                {formatNumber(partner.usersCount)} usuários
              </div>
            </div>
          </div>
        </div>

        <p className="text-slate-300 mb-6 line-clamp-2">{partner.description}</p>

        {partner.specialOffer && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-6">
            <div className="flex items-start gap-3">
              <Tag className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  Oferta Especial
                </div>
                <div className="text-sm text-slate-300">{partner.specialOffer}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Calendar className="w-4 h-4" />
            Desde {partner.established}
          </div>
          <button className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-all flex items-center gap-2">
            Ver Detalhes
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PARTNER CARD
// ============================================================================

interface PartnerCardProps {
  partner: Partner;
  onClick: () => void;
}

function PartnerCard({ partner, onClick }: PartnerCardProps) {
  return (
    <div
      onClick={onClick}
      className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-blue-500/50 transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-blue-500/5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-16 h-16 bg-white rounded-xl p-2 shadow-lg">
          <img src={partner.logo} alt={partner.name} className="w-full h-full object-contain" />
        </div>
        <TierBadge tier={partner.tier} size="sm" />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xl font-bold group-hover:text-blue-400 transition-colors truncate">
          {partner.name}
        </h3>
        {partner.verified && (
          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
        )}
      </div>

      <CategoryBadge category={partner.category} size="sm" />

      <p className="text-sm text-slate-400 mt-3 mb-4 line-clamp-2">
        {partner.description}
      </p>

      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold">{partner.rating}</span>
        </div>
        <div className="text-slate-500">
          {formatNumber(partner.usersCount)} users
        </div>
      </div>

      {partner.discount && (
        <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 font-semibold mb-4">
          🎁 {partner.discount}
        </div>
      )}

      <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 group-hover:border-blue-500/50">
        Ver Mais
        <ExternalLink className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================================================
// PARTNER DETAILS MODAL
// ============================================================================

interface PartnerDetailsModalProps {
  partner: Partner;
  onClose: () => void;
}

function PartnerDetailsModal({ partner, onClose }: PartnerDetailsModalProps) {
  const handleVisit = () => {
    toast.success('Abrindo site do parceiro...', {
      description: partner.name,
    });
    console.log('[PARTNERS] Visiting partner:', partner.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-10 bg-gradient-to-br from-blue-950/30 to-purple-950/30 border-b border-white/10">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ExternalLink className="w-6 h-6 rotate-45" />
          </button>

          <div className="flex items-start gap-6">
            <div className="w-24 h-24 bg-white rounded-2xl p-4 shadow-xl">
              <img src={partner.logo} alt={partner.name} className="w-full h-full object-contain" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-4xl font-bold">{partner.name}</h2>
                {partner.verified && (
                  <CheckCircle2 className="w-6 h-6 text-blue-400" />
                )}
                <TierBadge tier={partner.tier} />
              </div>

              <CategoryBadge category={partner.category} />

              <div className="flex items-center gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-xl font-bold">{partner.rating}</span>
                  <span className="text-slate-400">rating</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="w-5 h-5" />
                  {formatNumber(partner.usersCount)} usuários
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-5 h-5" />
                  Desde {partner.established}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-10 space-y-8">
          {/* Description */}
          <div>
            <h3 className="text-xl font-bold mb-3">Sobre</h3>
            <p className="text-slate-300 leading-relaxed">{partner.description}</p>
          </div>

          {/* Special Offer */}
          {partner.specialOffer && (
            <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-400 mb-2">Oferta Especial para Clientes Neural</h3>
                  <p className="text-slate-300">{partner.specialOffer}</p>
                  {partner.discount && (
                    <div className="mt-3 inline-block px-4 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-sm font-bold text-emerald-400">
                      {partner.discount}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Benefits */}
          <div>
            <h3 className="text-xl font-bold mb-4">Principais Benefícios</h3>
            <div className="grid grid-cols-2 gap-3">
              {partner.benefits.map((benefit, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Locations */}
          <div>
            <h3 className="text-xl font-bold mb-4">Localizações</h3>
            <div className="flex flex-wrap gap-2">
              {partner.locations.map((location, i) => (
                <div key={i} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">{location}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-4 pt-6 border-t border-white/10">
            <button
              onClick={handleVisit}
              className="flex-1 py-4 bg-blue-500 hover:bg-blue-600 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20"
            >
              Visitar Site Oficial
              <ExternalLink className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TIER BADGE
// ============================================================================

interface TierBadgeProps {
  tier: PartnerTier;
  size?: 'sm' | 'md';
}

function TierBadge({ tier, size = 'md' }: TierBadgeProps) {
  const configs = {
    platinum: { icon: Crown, label: 'Platinum', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
    gold: { icon: Medal, label: 'Gold', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
    silver: { icon: Award, label: 'Silver', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
    bronze: { icon: Shield, label: 'Bronze', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  };

  const config = configs[tier];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 ${config.color} border rounded-full ${size === 'sm' ? 'text-xs' : 'text-sm'} font-bold`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {config.label}
    </div>
  );
}

// ============================================================================
// CATEGORY BADGE
// ============================================================================

interface CategoryBadgeProps {
  category: PartnerCategory;
  size?: 'sm' | 'md';
}

function CategoryBadge({ category, size = 'md' }: CategoryBadgeProps) {
  const cat = CATEGORIES.find(c => c.id === category);
  if (!cat) return null;

  const Icon = cat.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg ${size === 'sm' ? 'text-xs' : 'text-sm'} text-slate-400`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {cat.label}
    </div>
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORIES = [
  { id: 'all' as const, label: 'Todos', icon: Building2 },
  { id: 'broker' as const, label: 'Brokers', icon: TrendingUp },
  { id: 'prop-firm' as const, label: 'Prop Firms', icon: Award },
  { id: 'data-provider' as const, label: 'Dados', icon: Database },
  { id: 'exchange' as const, label: 'Exchanges', icon: Boxes },
  { id: 'education' as const, label: 'Educação', icon: GraduationCap },
  { id: 'technology' as const, label: 'Tecnologia', icon: Building2 },
];

// ============================================================================
// UTILS
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
