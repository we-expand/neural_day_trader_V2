import { getDeepCandles } from "./atr.js";
import { computeFibCorridor, computeFibRetracement, describeFibCorridor, type FibCorridor } from "./fibCorridor.js";
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

/** Estado do Fibonacci pra LLM ler SEMPRE (get_mt5_quote): EXPANSAO (a favor da perna rompida), RETRACAO (devolvendo a perna) ou SEM_ESTRUTURA. */
export async function getFibState(symbol: string): Promise<Record<string, unknown>> {
  const fib = await getFibLive(symbol);
  if (!fib) return { estado: "SEM_DADO", leitura: "sem candles reais para desenhar o Fibonacci agora" };
  const p = fib.principal;
  if (p && p.emExpansao) {
    const baixa = p.direcao === "BAIXA";
    return {
      estado: baixa ? "EXPANSAO_DE_BAIXA" : "EXPANSAO_DE_ALTA",
      tf: p.tf,
      ladoAFavor: baixa ? "SHORT" : "LONG",
      zeroDoCorredor: p.pontoB,
      invalidacao: `preco voltar a tocar ${p.pontoB.toFixed(2)} (o 0 do corredor)`,
      proximoDegrau: p.proximoDegrau ? { ratio: p.proximoDegrau.ratio, price: p.proximoDegrau.price, distanciaPct: Number(p.distanciaProximoPct!.toFixed(3)) } : null,
      degraus: p.degraus.map((d) => ({ ratio: d.ratio, price: d.price, rompido: d.rompido })),
      redesenhar: p.redesenhar,
      leitura:
        `EXPANSAO DE ${p.direcao} no ${p.tf}. Aqui o Estocastico fica colado no extremo e o MACD nao da cruzamento limpo: NAO espere cruzamento nem MACD pra entrar a favor (${baixa ? "SHORT" : "LONG"}). ` +
        `A entrada a favor E o sinal; o alvo vai no proximo degrau e a invalidacao e o preco voltar ao 0. ${describeFibCorridor(p)}`,
    };
  }
  for (const [tf, candles] of [["15m", await getDeepCandles(symbol, "15m")], ["1H", await getDeepCandles(symbol, "1H")]] as const) {
    if (!candles) continue;
    const r = computeFibRetracement(candles, { tf, window: tf === "15m" ? 96 : 200 });
    if (r) {
      const repique = r.pernaDirecao === "BAIXA";
      return {
        estado: repique ? "RETRACAO_DE_BAIXA_REPIQUE" : "RETRACAO_DE_ALTA_RECUO",
        tf,
        pernaDirecao: r.pernaDirecao,
        retraidoPct: Number((r.retraidoPct * 100).toFixed(1)),
        niveis: r.niveis.map((n) => ({ ratio: n.ratio, price: Number(n.price.toFixed(4)), alcancado: n.alcancado })),
        leitura:
          `RETRACAO no ${tf}: o preco devolveu ${(r.retraidoPct * 100).toFixed(0)}% da perna de ${r.pernaDirecao} (${r.pontoA.toFixed(2)} -> ${r.pontoB.toFixed(2)}). ` +
          `NAO e expansao: aqui valem os criterios normais (estocastico, MACD, candle). O repique/recuo so vira entrada contra a perna com confirmacao; ` +
          `entrada a favor da perna fica pra quando a retracao parar em 50-61,8% ou o 0 for rompido de novo.`,
      };
    }
  }
  return { estado: "SEM_ESTRUTURA", leitura: "sem perna clara de Fibonacci nos tempos de 15m/1H: tratar como mercado tradicional (criterios normais)." };
}
