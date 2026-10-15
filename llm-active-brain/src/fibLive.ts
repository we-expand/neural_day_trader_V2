import { getDeepCandles } from "./atr.js";
import { computeFibCorridor, describeFibCorridor, type FibCorridor } from "./fibCorridor.js";
import { readMaTrigger } from "./maTrigger.js";

export interface FibLive {
  m15: FibCorridor | null;
  h1: FibCorridor | null;
  /** o corredor que manda: 1H quando o 15m esgotou os degraus (ou nao ha 15m) e o 1H esta em expansao; senao o 15m */
  principal: FibCorridor | null;
  texto: string;
  /** leitura das medias como gatilho (15m e 1H), pronta para a mesa */
  maTexto: string;
}

/** Metodo do Cleber: sempre 15m e 1H; se o 15m esgotou o 161,8% (redesenhar), vale o 1H. */
export async function getFibLive(symbol: string): Promise<FibLive | null> {
  const [c15, c1h] = await Promise.all([getDeepCandles(symbol, "15m"), getDeepCandles(symbol, "1H")]);
  if (!c15 && !c1h) return null;
  const m15 = c15 ? computeFibCorridor(c15, { tf: "15m", window: 96 }) : null;
  // 14/10 (Cleber): o 1H precisa enxergar a perna MACRO (o topo de ~uma semana atras), senao, quando o 15m esgota, o 1H
  // tambem vem esgotado ("degraus esgotados: redesenhar em tempo maior") e o modo expansao nunca ativa. Janela de 72 -> 200.
  const h1Window = Math.max(72, Math.floor(Number(process.env.MT5_FIB_1H_WINDOW ?? 200)) || 200);
  const h1 = c1h ? computeFibCorridor(c1h, { tf: "1H", window: h1Window }) : null;
  const principal = (m15 && !m15.redesenhar ? m15 : null) ?? (h1 && h1.emExpansao ? h1 : null) ?? m15 ?? h1;
  const texto = `${describeFibCorridor(m15)} | ${describeFibCorridor(h1)}`;
  const maTexto = [readMaTrigger(c15, "15m"), readMaTrigger(c1h, "1H")].filter((x) => x).map((x) => x!.texto).join("\n");
  return { m15, h1, principal, texto, maTexto };
}
