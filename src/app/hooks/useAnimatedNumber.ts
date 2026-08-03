import { useEffect, useRef, useState } from 'react';

/**
 * Interpola suavemente um número exibido em direção a `target` via
 * requestAnimationFrame, em vez de saltar direto pro novo valor a cada
 * atualização. Mesmo padrão já usado pro preço principal do header em
 * ChartView.tsx ("SMOOTH ANIMATION") -- generalizado aqui pra qualquer
 * número que atualiza em ciclos discretos (ex: P&L de posição, atualizado a
 * cada 1s pelo loop de useApexLogic.ts) e precisa parecer contínuo/"vivo",
 * como no TradingView, em vez de "duro"/em degraus.
 */
export function useAnimatedNumber(target: number, durationMs = 500): number {
  const [displayed, setDisplayed] = useState(target);
  const prevTargetRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === prevTargetRef.current) return;
    const startValue = displayed;
    const startTime = Date.now();
    prevTargetRef.current = target;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out quadrático: começa mais rápido e desacelera perto do alvo --
      // sensação de "puxão" suave em vez de interpolação linear robótica.
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayed(startValue + (target - startValue) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- displayed intencionalmente fora: só queremos reagir a mudança de target
  }, [target, durationMs]);

  return displayed;
}
