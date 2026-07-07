import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { RefreshCw, Search, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface AssetInfo {
  symbol: string;
  description?: string;
  category?: string;
  digits?: number;
}

export function AssetDiscoveryPanel() {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Record<string, AssetInfo[]>>({});
  const [summary, setSummary] = useState<Array<{ category: string; count: number }>>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Se forceRefresh, chamar o endpoint de refresh primeiro
      if (forceRefresh) {
        await fetch(`https://${projectId}.supabase.co/functions/v1/server/asset-discovery/refresh`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });
      }

      // Buscar categorias
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/asset-discovery/categories`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setCategories(data.categories);
        setSummary(data.summary);
        setLastUpdate(new Date());
      } else {
        throw new Error(data.error || 'Falha ao buscar ativos');
      }
    } catch (err: any) {
      console.error('[AssetDiscovery] Erro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const filteredCategories = React.useMemo(() => {
    if (!searchTerm) return categories;

    const filtered: Record<string, AssetInfo[]> = {};
    Object.entries(categories).forEach(([category, assets]) => {
      const matchingAssets = assets.filter(
        asset =>
          asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          asset.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (matchingAssets.length > 0) {
        filtered[category] = matchingAssets;
      }
    });
    return filtered;
  }, [categories, searchTerm]);

  const totalAssets = summary.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="bg-[#2a2a2a] border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Asset Discovery System
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              {totalAssets} símbolos descobertos automaticamente
            </p>
          </div>
          <Button
            onClick={() => fetchAssets(true)}
            disabled={loading}
            size="sm"
            variant="outline"
            className="border-gray-600 hover:bg-gray-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Atualizando...' : 'Atualizar Cache'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Erro ao buscar ativos</p>
              <p className="text-red-400/70 text-sm">{error}</p>
            </div>
          </div>
        )}

        {lastUpdate && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-400 font-medium">Cache atualizado</p>
              <p className="text-green-400/70 text-sm">
                {lastUpdate.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar símbolos..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {summary.map(({ category, count }) => (
            <div
              key={category}
              className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-3"
            >
              <p className="text-gray-400 text-xs font-medium uppercase">{category}</p>
              <p className="text-white text-2xl font-bold">{count}</p>
            </div>
          ))}
        </div>

        {/* Assets by Category */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {Object.entries(filteredCategories).map(([category, assets]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-white font-semibold flex items-center gap-2">
                {category}
                <Badge variant="secondary" className="bg-gray-700 text-gray-300">
                  {assets.length}
                </Badge>
              </h3>
              <div className="flex flex-wrap gap-2">
                {assets.map(asset => (
                  <Badge
                    key={asset.symbol}
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer"
                    title={asset.description}
                  >
                    {asset.symbol}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {Object.keys(filteredCategories).length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum símbolo encontrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
