import React, { useEffect, useRef, useState } from 'react';
import { Brain } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getBatchedMT5Data } from '@/app/services/RealMarketDataService';

/**
 * Painel de acompanhamento do "cérebro LLM ativo" (llm-active-brain/,
 * agente full tool-calling rodando via terminal, ver README daquela pasta) —
 * pedido do Cleber, 2026-08-28: ele reportou (via vídeo) que os números da
 * posição ficavam "parados como um JPEG". Causa raiz: o loop ao vivo do
 * Dashboard (`reconcile()`/PNL loop em useApexLogic.ts) só acompanha a
 * sessão do MOTOR MECÂNICO do próprio navegador (`persistenceRef.current.
 * getSessionId()`), nunca uma sessão isolada de outro processo — a sessão do
 * cérebro LLM nunca entrava nesse loop, então a tela só mostrava o snapshot
 * do carregamento inicial da página, sem nunca atualizar.
 *
 * Este painel é standalone (não reusa o hook do motor mecânico — reusar
 * exigiria repontar `useApexLogic` inteiro pra outra sessão, que não é o
 * design dele). Faz seu próprio poll de baixo custo (10s: 1 select em
 * ai_trades + preço via `getBatchedMT5Data` — MESMO serviço/fonte que o
 * motor mecânico usa, MT5/Infinox pra forex/índices).
 *
 * 2026-08-29: trilho trocado de Binance/cripto pra cesta/preço/execução do
 * próprio motor mecânico (`llm-active-brain/src/mt5Broker.ts`), a pedido do
 * Cleber — "não precisamos utilizar a Binance... como se estivesse no lugar
 * do motor que a gente tinha desenvolvido".
 */

// 🔴 2026-08-29: trilho Binance/cripto substituído -- Cleber pediu pra
// dispensar Binance e operar a MESMA cesta/preço/execução do motor
// mecânico (ver llm-active-brain/src/mt5Broker.ts + assetBasket.ts).
const STRATEGY_NAME = 'LLM_ACTIVE_BRAIN_MT5';
// 🔴 2026-08-29: primeira tentativa foi buscar preço a cada 1s, mas
// `getBatchedMT5Data` bate na CONTA METAAPI COMPARTILHADA (mesma conta de
// TODO o app -- ver aviso em CLAUDE.md: "sujeita a rate-limit sob carga,
// sempre espaçar chamadas, nunca testar em paralelo contra ela"). A 1s,
// "atualizado há Ns" ficava oscilando (0s, 7s, 8s...) em vez de andar liso
// -- sinal de requisições brigando/falhando, não de sucesso a cada 1s.
// Preço real fica no MESMO ritmo que o motor mecânico já usa com sucesso
// (5s, useApexLogic.ts tradingInterval) -- a sensação "segundo a segundo"
// vem do TICK_MS abaixo (sem rede, só força re-render do relógio/labels).
const PRICE_POLL_MS = 5_000;
const TRADES_POLL_MS = 5_000;
const TICK_MS = 1_000;

interface BrainTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number | null;
  quantity: number; // exposição em USD (ver neuralBridge.ts)
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  pnl: number | null;
  entry_time: string;
  exit_time: string | null;
  ai_reasoning: string | null;
}

function calcPnl(entryPrice: number, currentPrice: number, side: 'LONG' | 'SHORT', amountUsd: number): number {
  if (!(entryPrice > 0)) return 0;
  return side === 'LONG'
    ? (currentPrice - entryPrice) * (amountUsd / entryPrice)
    : (entryPrice - currentPrice) * (amountUsd / entryPrice);
}

async function fetchLivePrices(symbols: string[]): Promise<Record<string, number>> {
  // Mesmo `getBatchedMT5Data` que `useApexLogic.ts` usa pro loop de PnL do
  // motor mecânico — MT5/Infinox pra forex/índices, Binance direto (com
  // proxy CORS) pra cripto sem CFD confirmado. Cache/mutex compartilhado
  // com o resto do app, não gera requisição duplicada.
  const result: Record<string, number> = {};
  try {
    const batch = await getBatchedMT5Data(symbols);
    for (const s of symbols) {
      const data = batch[s];
      if (data && Number.isFinite(data.price) && data.price > 0) result[s] = data.price;
    }
  } catch {
    // mantém o que já tinha
  }
  return result;
}

export function LlmActiveBrainPanel() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [trades, setTrades] = useState<BrainTrade[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [, setTick] = useState(0); // força re-render a cada 1s (sem rede) pro "atualizado há Ns" andar liso
  const cancelledRef = useRef(false);
  // Ref (não state) pra o loop de preço de 1s ler sempre a lista mais
  // recente de posições abertas sem precisar recriar o interval a cada
  // atualização de `trades` (mesmo padrão de `activeOrdersRef` em
  // useApexLogic.ts).
  const openSymbolsRef = useRef<string[]>([]);

  useEffect(() => {
    cancelledRef.current = false;

    const pollTrades = async () => {
      try {
        const { data: session } = await supabase
          .from('ai_sessions')
          .select('id, initial_balance')
          .eq('strategy_name', STRATEGY_NAME)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelledRef.current) return;
        if (!session) {
          setSessionId(null);
          return;
        }
        setSessionId(session.id);
        setInitialBalance(Number(session.initial_balance) || 0);

        const { data: tradesData } = await supabase
          .from('ai_trades')
          .select('id, symbol, side, entry_price, exit_price, quantity, status, pnl, entry_time, exit_time, ai_reasoning')
          .eq('session_id', session.id)
          .order('entry_time', { ascending: false })
          .limit(50);
        if (cancelledRef.current) return;
        const rows = (tradesData || []) as BrainTrade[];
        setTrades(rows);
        openSymbolsRef.current = Array.from(new Set(rows.filter(t => t.status === 'OPEN').map(t => t.symbol)));
      } catch {
        // Falha de rede/Supabase: mantém o último estado conhecido na tela
        // (mesma disciplina do reconcile() principal) em vez de zerar.
      }
    };

    const pollPrice = async () => {
      if (openSymbolsRef.current.length === 0) return;
      const prices = await fetchLivePrices(openSymbolsRef.current);
      if (cancelledRef.current) return;
      setLivePrices(prev => ({ ...prev, ...prices }));
      setLastUpdate(Date.now());
    };

    pollTrades().then(pollPrice);
    const tradesInterval = setInterval(pollTrades, TRADES_POLL_MS);
    const priceInterval = setInterval(pollPrice, PRICE_POLL_MS);
    const tickInterval = setInterval(() => setTick(t => t + 1), TICK_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(tradesInterval);
      clearInterval(priceInterval);
      clearInterval(tickInterval);
    };
  }, []);

  if (!sessionId) return null;

  const openTrades = trades.filter(t => t.status === 'OPEN');
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const realizedPnl = closedTrades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
  const unrealizedPnl = openTrades.reduce((acc, t) => {
    const live = livePrices[t.symbol];
    if (!live) return acc;
    return acc + calcPnl(t.entry_price, live, t.side, t.quantity);
  }, 0);
  const equity = initialBalance + realizedPnl + unrealizedPnl;
  const secondsAgo = lastUpdate ? Math.round((Date.now() - lastUpdate) / 1000) : null;

  return (
    <div className="bg-zinc-950 border border-purple-900/40 rounded-xl overflow-hidden shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-purple-300">
            Cérebro LLM Ativo (teste, cesta do motor) — isolado do motor mecânico
          </h2>
        </div>
        <span className="text-[10px] text-neutral-500 font-mono">
          {secondsAgo != null ? `atualizado há ${secondsAgo}s` : 'carregando...'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-[10px] text-neutral-500 uppercase font-bold">Patrimônio</div>
          <div className="text-lg font-mono font-bold text-white">${equity.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-neutral-500 uppercase font-bold">P&L Realizado</div>
          <div className={`text-lg font-mono font-bold ${realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-neutral-500 uppercase font-bold">P&L Flutuante</div>
          <div className={`text-lg font-mono font-bold ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {openTrades.length > 0 && (
        <div className="space-y-1 mb-3">
          <div className="text-[10px] text-neutral-500 uppercase font-bold">Posições abertas ({openTrades.length})</div>
          {openTrades.map((t) => {
            const live = livePrices[t.symbol];
            const pnl = live != null ? calcPnl(t.entry_price, live, t.side, t.quantity) : null;
            const pct = live != null ? ((live - t.entry_price) / t.entry_price) * 100 * (t.side === 'LONG' ? 1 : -1) : null;
            return (
              <div key={t.id} className="flex items-center justify-between text-xs font-mono bg-zinc-900/60 rounded px-2 py-1">
                <span className="text-neutral-300">{t.symbol} <span className="text-emerald-400">{t.side}</span></span>
                <span className="text-neutral-500">${t.entry_price.toFixed(2)} → {live ? `$${live.toFixed(2)}` : '...'}</span>
                <span className={pnl != null && pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {pnl != null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pct!.toFixed(2)}%)` : '...'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {closedTrades.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-neutral-500 uppercase font-bold">Últimos fechamentos</div>
          {closedTrades.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs font-mono bg-zinc-900/40 rounded px-2 py-1">
              <span className="text-neutral-400">{t.symbol}</span>
              <span className="text-neutral-500">${t.entry_price.toFixed(2)} → ${(t.exit_price ?? t.entry_price).toFixed(2)}</span>
              <span className={(t.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {(t.pnl ?? 0) >= 0 ? '+' : ''}${(t.pnl ?? 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {openTrades.length === 0 && closedTrades.length === 0 && (
        <div className="text-xs text-neutral-500">Nenhuma operação registrada ainda nesta sessão.</div>
      )}
    </div>
  );
}
