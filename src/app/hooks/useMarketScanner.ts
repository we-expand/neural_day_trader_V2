import { useState, useEffect } from 'react';

// Ativos considerados pra decidir se "o mercado" está aberto — cripto é 24/7,
// os demais fecham no fim de semana (calendário real, sem chamada de rede).
const HAS_CRYPTO_COVERAGE = true;

interface ScannerResult {
    status: 'OPEN' | 'CLOSED';
    isScanning: boolean;
}

/**
 * Antes gerava um "score" e um "insight" por ativo via `Math.random()` a cada
 * 30s ("Fluxo Institucional agressivo detectado em X", "Despejo Institucional
 * em Y"...) — nenhum indicador real por trás, e o próprio `MarketScoreBoard`
 * já tinha documentado (2026-07-08) um bug real causado por esse gerador
 * (race condition sobrescrevendo preço real por zero). Nenhuma tela consome
 * `bestAsset`/`score`/`insight` hoje — removidos (auditoria 2026-07-29) em
 * vez de mantidos como fabricação latente. Rodar um scan real de múltiplos
 * ativos a cada 30s bateria na conta MetaAPI compartilhada (risco crônico já
 * documentado no projeto), então isto fica só com o que é real e gratuito:
 * mercado aberto ou fechado, por calendário.
 */
export function useMarketScanner() {
    const [result, setResult] = useState<ScannerResult>({
        status: 'OPEN',
        isScanning: true
    });

    useEffect(() => {
        const checkMarket = () => {
            const day = new Date().getDay(); // 0 = Dom, 6 = Sáb
            const isWeekend = day === 0 || day === 6;
            const isOpen = HAS_CRYPTO_COVERAGE || !isWeekend;
            setResult({ status: isOpen ? 'OPEN' : 'CLOSED', isScanning: false });
        };

        checkMarket();
        const interval = setInterval(checkMarket, 60000);
        return () => clearInterval(interval);
    }, []);

    return result;
}
