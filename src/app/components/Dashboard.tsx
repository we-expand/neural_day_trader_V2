import React, { useEffect, useRef, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { MarketScoreBoard } from './dashboard/MarketScoreBoard';
import { NewsAndAgenda } from './dashboard/NewsAndAgenda';
import { VIXWidgetEnhanced } from './tools/VIXWidgetEnhanced';
import { RiskThermometer } from './dashboard/RiskThermometer';
import { CorrelationMatrix } from './dashboard/CorrelationMatrix';
import { LiquidityDetectorCard } from './dashboard/LiquidityDetectorCard';

// ✅ 2026-07-23: CorrelationMatrix (candles de ~16 ativos) e LiquidityDetectorCard
// (candles 1H + até 5 anos de 1D) são os consumidores mais pesados de candle da
// conta MetaAPI compartilhada em todo o Dashboard — um atraso fixo de tempo não
// basta (5 minutos de espera reportados pelo Cleber mesmo com o atraso de 2.5s,
// porque esses 2 widgets continuam disparando a busca pesada de qualquer forma,
// só mais tarde). Fix real: só montam (e só então buscam candle) quando o
// usuário rola a tela até eles — a maioria dos usuários nem chega a ver essas
// duas seções na maior parte do tempo que passa no Dashboard olhando o preço.
function LazyMount({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    if (shouldMount || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // começa a carregar um pouco antes de entrar na tela
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [shouldMount]);

  return <div ref={containerRef}>{shouldMount ? children : null}</div>;
}

export function Dashboard({ onNavigate }: { onNavigate?: (view: string) => void } = {}) {
  // ✅ 2026-07-23: causa raiz real de "preço zerado no Dashboard, mas normal
  // no Gráfico" — o Gráfico monta UM widget (busca só o ativo selecionado);
  // o Dashboard monta 6 widgets pesados ao mesmo tempo (MarketScoreBoard,
  // NewsAndAgenda, VIXWidgetEnhanced, RiskThermometer, CorrelationMatrix —
  // candles de ~16 ativos — e LiquidityDetectorCard — candles 1H+1D), todos
  // batendo na mesma conta MetaAPI compartilhada no exato instante em que a
  // página abre, somado ao rodapé (MarketTicker, ~47 ativos). O preço do
  // ativo selecionado (MarketScoreBoard) é só 1 chamada, mas entra na fila
  // atrás de dezenas de outras — explicando "zera por minutos e corrige
  // sozinho" quando o resto termina de responder. Fix: escalona a montagem —
  // MarketScoreBoard (o mais crítico, sempre visível primeiro) monta na
  // hora; os outros 5 widgets (mais abaixo na tela, fora do topo da
  // viewport na maioria dos monitores) só montam ~2.5s depois, dando tempo
  // da busca de preço vencer a corrida antes de qualquer outro widget
  // disparar sua própria leva de requisições pra conta compartilhada.
  const [showHeavyWidgets, setShowHeavyWidgets] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowHeavyWidgets(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full h-full p-4 overflow-y-auto bg-black custom-scrollbar">
      {/* Header — sem logo duplicado */}
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <LayoutDashboard className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase">
            Dashboard Principal
          </h1>
          <p className="text-slate-400 mt-1 tracking-wide font-light">
            Visão Geral, Métricas e Performance em Tempo Real
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 pb-20">
        <div className="col-span-1 xl:col-span-12 h-auto">
          <div className="bg-zinc-950 rounded-xl overflow-hidden shadow-lg">
            <MarketScoreBoard onNavigate={onNavigate} />
          </div>
        </div>

        {showHeavyWidgets && (
          <>
            <div className="col-span-1 xl:col-span-6 h-[490px]">
              <NewsAndAgenda />
            </div>

            <div className="col-span-1 xl:col-span-3 h-[490px]">
              <VIXWidgetEnhanced />
            </div>

            <div className="col-span-1 xl:col-span-3 h-[490px]">
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full shadow-lg">
                <div className="h-full p-2">
                  <RiskThermometer />
                </div>
              </div>
            </div>

            <div className="col-span-1 xl:col-span-12">
              <LazyMount>
                <CorrelationMatrix />
              </LazyMount>
            </div>

            <div className="col-span-1 xl:col-span-12 min-h-[420px]">
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden h-full shadow-lg">
                <div className="h-full p-2 overflow-y-auto custom-scrollbar">
                  <LazyMount>
                    <LiquidityDetectorCard />
                  </LazyMount>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;