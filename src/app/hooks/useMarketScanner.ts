import { useEffect, useRef, useState } from 'react';
import { MarketScoreEngine, type MarketScoreResult } from '../services/MarketScoreEngine';

// Cesta cripto (Binance, sem limite de conta MetaAPI compartilhada — risco
// crônico documentado no projeto) — mesmos 7 pares usados na pesquisa quant
// (AI_BRAIN_SPEC.md seção 11.13), 24/7, sem gap de calendário.
const SCAN_BASKET = ['BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD'] as const;
const SCAN_TIMEFRAME = '15m' as const;
// 60s: MarketScoreEngine já cacheia por barra (BacktestDataService), então
// varrer os 7 ativos aqui não gera 7 requisições novas por ciclo dentro da
// mesma barra de 15m — só quando a barra vira.
const SCAN_INTERVAL_MS = 60_000;

export interface ScannedAsset {
    symbol: string;
    score: number;
    classification: MarketScoreResult['classification'];
    confidence: number;
    provenance: MarketScoreResult['provenance'];
    insight: string;
}

interface ScannerResult {
    status: 'OPEN' | 'CLOSED';
    isScanning: boolean;
    assets: ScannedAsset[];
    bestAsset: ScannedAsset | null;
}

/**
 * Varredura real de mercado (cripto, via `MarketScoreEngine` — mesmo motor de
 * fatores ortogonais que o Dashboard usa por ativo). Antes gerava
 * score/insight por `Math.random()` a cada 30s; agora computa o Score real de
 * cada ativo da cesta e expõe a lista rankeada + o melhor ativo real
 * (`provenance: 'real'|'stale'`, nunca `'unavailable'`) — pronto para a IA
 * consumir na escolha de ativo, sem depender de MetaAPI (auditoria 2026-07-29).
 * Sequencial (não `Promise.all`) para não rajar a API pública da Binance.
 */
export function useMarketScanner() {
    const [result, setResult] = useState<ScannerResult>({
        status: 'OPEN',
        isScanning: true,
        assets: [],
        bestAsset: null,
    });
    const isScanningRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        const scan = async () => {
            if (isScanningRef.current) return;
            isScanningRef.current = true;
            setResult((prev) => ({ ...prev, isScanning: true }));

            const assets: ScannedAsset[] = [];
            for (const symbol of SCAN_BASKET) {
                if (cancelled) break;
                try {
                    const r = await MarketScoreEngine.compute(symbol, SCAN_TIMEFRAME);
                    assets.push({
                        symbol,
                        score: r.score,
                        classification: r.classification,
                        confidence: r.confidence,
                        provenance: r.provenance,
                        insight: r.insight,
                    });
                } catch (e: any) {
                    // MarketScoreEngine.compute() já não lança (sempre resolve com
                    // 'unavailable'/'stale') — este catch é só rede de segurança extra.
                    assets.push({
                        symbol,
                        score: 50,
                        classification: 'LATERAL',
                        confidence: 0,
                        provenance: 'unavailable',
                        insight: e?.message || 'Falha ao buscar dado real deste ativo.',
                    });
                }
            }

            if (cancelled) return;

            // Só ativos com dado real (ou stale, última leitura real conhecida)
            // entram no ranking — nunca promove um 'unavailable' a "melhor ativo".
            const withRealData = assets.filter((a) => a.provenance === 'real' || a.provenance === 'stale');
            const ranked = [...withRealData].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));

            setResult({
                status: 'OPEN', // cripto é 24/7 — cesta desta varredura nunca fecha
                isScanning: false,
                assets,
                bestAsset: ranked[0] ?? null,
            });
            isScanningRef.current = false;
        };

        scan();
        const interval = setInterval(scan, SCAN_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    return result;
}
