import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Bug, Play, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface DebugResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  data: any;
  message?: string;
}

export function PriceCalculationDebug() {
  const [results, setResults] = useState<DebugResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState('US2000');

  const runDiagnostic = async () => {
    setLoading(true);
    const diagnosticResults: DebugResult[] = [];

    try {
      // STEP 1: Buscar candles da MetaAPI
      diagnosticResults.push({ 
        step: 'STEP 1: Buscando candles da MetaAPI...', 
        status: 'warning', 
        data: null 
      });
      setResults([...diagnosticResults]);

      const candlesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/market-data/candles?symbol=${symbol}&timeframe=1H&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const candlesData = await candlesResponse.json();

      diagnosticResults[diagnosticResults.length - 1] = {
        step: 'STEP 1: Candles da MetaAPI',
        status: candlesData.success ? 'success' : 'error',
        data: {
          success: candlesData.success,
          source: candlesData.source,
          candleCount: candlesData.candles?.length || 0,
          firstCandle: candlesData.candles?.[0] || null,
          lastCandle: candlesData.candles?.[candlesData.candles?.length - 1] || null,
        },
      };
      setResults([...diagnosticResults]);

      // STEP 2: Analisar preços dos candles
      if (candlesData.candles && candlesData.candles.length > 0) {
        const candles = candlesData.candles;
        const currentPrice = candles[candles.length - 1].close;
        const openPrice = candles[0].open;
        const change = currentPrice - openPrice;
        const changePercent = (change / openPrice) * 100;

        diagnosticResults.push({
          step: 'STEP 2: Cálculo de variação (a partir dos candles)',
          status: Math.abs(changePercent) > 10 ? 'error' : 'success',
          data: {
            openPrice,
            currentPrice,
            change,
            changePercent: changePercent.toFixed(2) + '%',
            pricesLookCorrect: currentPrice > 100, // US2000 deveria estar > 2000
            warning: currentPrice < 100 ? 'PREÇO MUITO BAIXO - POSSÍVEL ERRO!' : null,
          },
        });
        setResults([...diagnosticResults]);
      }

      // STEP 3: Buscar preço direto da API
      diagnosticResults.push({
        step: 'STEP 3: Buscando preço direto da API de prices...',
        status: 'warning',
        data: null,
      });
      setResults([...diagnosticResults]);

      const priceResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/market-data/prices?symbols=${symbol}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const priceData = await priceResponse.json();

      diagnosticResults[diagnosticResults.length - 1] = {
        step: 'STEP 3: Preço direto da API',
        status: priceData.success ? 'success' : 'error',
        data: {
          success: priceData.success,
          prices: priceData.prices || [],
          priceCount: priceData.prices?.length || 0,
        },
      };
      setResults([...diagnosticResults]);

      // STEP 4: Verificar Asset Discovery
      diagnosticResults.push({
        step: 'STEP 4: Verificando se símbolo existe na MetaAPI...',
        status: 'warning',
        data: null,
      });
      setResults([...diagnosticResults]);

      const validateResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1dbacac6/asset-discovery/validate/${symbol}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const validateData = await validateResponse.json();

      diagnosticResults[diagnosticResults.length - 1] = {
        step: 'STEP 4: Validação de símbolo',
        status: validateData.exists ? 'success' : 'error',
        data: {
          symbol,
          exists: validateData.exists,
          info: validateData.info,
          message: validateData.exists ? 
            `✅ ${symbol} existe na MetaAPI` : 
            `❌ ${symbol} NÃO EXISTE na MetaAPI - use outro símbolo!`,
        },
        message: validateData.exists ? null : `O símbolo ${symbol} não está disponível no seu broker MetaTrader 5!`,
      };
      setResults([...diagnosticResults]);

      // STEP 5: Conclusão
      const conclusionStatus = diagnosticResults.some(r => r.status === 'error') ? 'error' : 'success';
      diagnosticResults.push({
        step: 'CONCLUSÃO',
        status: conclusionStatus,
        data: null,
        message: conclusionStatus === 'error' ?
          'Foram encontrados problemas! Revise os dados acima.' :
          'Tudo OK! Os dados estão corretos.',
      });
      setResults([...diagnosticResults]);

    } catch (error: any) {
      diagnosticResults.push({
        step: 'ERRO GERAL',
        status: 'error',
        data: { error: error.message },
        message: error.message,
      });
      setResults([...diagnosticResults]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400 animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <Card className="bg-[#2a2a2a] border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Bug className="w-5 h-5 text-orange-400" />
              Diagnóstico de Preços e Variações
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              Detecta erros nos cálculos de preços e variações diárias
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input do símbolo */}
        <div className="flex gap-2">
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="Ex: US2000, EURUSD, BTCUSD"
            className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button
            onClick={runDiagnostic}
            disabled={loading || !symbol}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Play className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Diagnosticando...' : 'Executar Diagnóstico'}
          </Button>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  result.status === 'error'
                    ? 'bg-red-500/10 border-red-500/30'
                    : result.status === 'warning'
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-green-500/10 border-green-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{result.step}</h4>
                    {result.message && (
                      <p className={`text-sm mt-1 ${
                        result.status === 'error' ? 'text-red-400' : 
                        result.status === 'warning' ? 'text-yellow-400' : 
                        'text-green-400'
                      }`}>
                        {result.message}
                      </p>
                    )}
                    {result.data && (
                      <pre className="mt-2 text-xs text-gray-400 bg-black/30 rounded p-2 overflow-x-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400">
            <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Digite um símbolo e clique em "Executar Diagnóstico"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}