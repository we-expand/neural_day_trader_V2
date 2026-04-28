import { useState, useEffect, useRef } from 'react';

// Definição dos Ativos Suportados e seus Horários
const MARKET_ASSETS = [
    { symbol: 'EURUSD', type: 'FOREX', name: 'Euro / US Dollar' },
    { symbol: 'GBPUSD', type: 'FOREX', name: 'British Pound / US Dollar' },
    { symbol: 'USDJPY', type: 'FOREX', name: 'US Dollar / Jap. Yen' },
    { symbol: 'XAUUSD', type: 'COMMODITIES', name: 'Gold / US Dollar' },
    { symbol: 'BTCUSDT', type: 'CRYPTO', name: 'Bitcoin / Tether' },
    { symbol: 'ETHUSDT', type: 'CRYPTO', name: 'Ethereum / Tether' },
    { symbol: 'SOLUSDT', type: 'CRYPTO', name: 'Solana / Tether' },
    { symbol: 'SPX500', type: 'INDICES', name: 'S&P 500' },
    { symbol: 'US30', type: 'INDICES', name: 'Dow Jones 30' }
];

interface ScannerResult {
    bestAsset: string;
    score: number;
    status: 'OPEN' | 'CLOSED';
    insight: string;
    isScanning: boolean;
}

export function useMarketScanner() {
    const [result, setResult] = useState<ScannerResult>({
        bestAsset: 'EURUSD',
        score: 50,
        status: 'OPEN',
        insight: 'Inicializando varredura neural...',
        isScanning: true
    });

    // Simula a varredura real do mercado
    useEffect(() => {
        const scanMarkets = async () => {
            setResult(prev => ({ ...prev, isScanning: true }));
            
            const now = new Date();
            const day = now.getDay(); // 0 = Sun, 6 = Sat
            const isWeekend = day === 0 || day === 6;

            // 1. Filtrar ativos ABERTOS
            const openAssets = MARKET_ASSETS.filter(asset => {
                if (asset.type === 'CRYPTO') return true; // Cripto sempre aberto
                return !isWeekend; // Outros fecham fds
            });

            // Se for fds e não tiver cripto (improvável), fallback
            if (openAssets.length === 0) {
                setResult({
                    bestAsset: 'MARKET_CLOSED',
                    score: 50,
                    status: 'CLOSED',
                    insight: 'Mercados Globais Fechados. Aguardando abertura.',
                    isScanning: false
                });
                return;
            }

            // 2. Simular cálculo de score para cada ativo aberto
            // Na versão real, isso bateria no backend Python para pegar o score real
            await new Promise(r => setTimeout(r, 1500)); // Delay dramático de "scanning"

            let bestCandidate = openAssets[0];
            let highestDeviation = 0;
            let finalScore = 50;

            openAssets.forEach(asset => {
                // Simula um score aleatório para o ativo (50 +/- desvio)
                // Cripto tende a ser mais volátil no fds
                const volatility = asset.type === 'CRYPTO' ? 40 : 20; 
                const randomScore = 50 + (Math.random() * volatility - (volatility/2));
                const deviation = Math.abs(randomScore - 50);

                if (deviation > highestDeviation) {
                    highestDeviation = deviation;
                    bestCandidate = asset;
                    finalScore = randomScore;
                }
            });

            // 3. Definir Insight baseado no Score
            let insight = "";
            if (finalScore > 75) insight = `Fluxo Institucional agressivo detectado em ${bestCandidate.symbol}. Oportunidade de Compra.`;
            else if (finalScore > 60) insight = `Tendência de alta se formando em ${bestCandidate.symbol} com volume crescente.`;
            else if (finalScore < 25) insight = `Despejo Institucional em ${bestCandidate.symbol}. Oportunidade de Venda Forte.`;
            else if (finalScore < 40) insight = `Pressão vendedora detectada em ${bestCandidate.symbol}. Aguardando rompimento.`;
            else insight = `Mercado lateralizado em ${bestCandidate.symbol}. Aguardando definição de fluxo.`;

            setResult({
                bestAsset: bestCandidate.symbol,
                score: Math.round(finalScore),
                status: 'OPEN',
                insight: insight,
                isScanning: false
            });
        };

        // Rodar Scanner na montagem e a cada 30s
        scanMarkets();
        const interval = setInterval(scanMarkets, 30000); 

        return () => clearInterval(interval);
    }, []);

    return result;
}