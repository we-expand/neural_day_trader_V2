// 2026-11-18 (pedido do Cleber, NAS100 LONG de 18/11): "a analise de grafico e um passeio por todos os tempos graficos.
// Nao pode confiar so no estocastico do 15m. O MACD ja tinha comecado a baixar." A LLM entrou LONG com o estocastico da 1H
// SOBRECOMPRADO e o histograma do MACD virando para baixo, justificando por escrito ("contradicao... mas o volume..."): o
// aviso estava no texto da cotacao, nao em trava de codigo (o veto de estocastico extremo foi desligado em 11/11 na replica
// de 02/09). Esta trava e MECANICA e le 15m + 1H + 4H (estocastico 5,3,3 e MACD) antes de qualquer entrada.
//
// Funcao pura (sem I/O) de proposito: testavel com leituras fabricadas. Quem busca os dados e tools.ts.
import type { MacdResult, SlowStochasticResult } from "./atr.js";

export type MtfSide = "LONG" | "SHORT";
export type MtfTimeframe = "15m" | "1H" | "4H";

export interface MtfReadings {
  stoch: Record<MtfTimeframe, SlowStochasticResult | null>;
  macd: Record<MtfTimeframe, MacdResult | null>;
}

export interface MtfVerdict {
  blocked: boolean;
  /** Frase pronta pro erro devolvido a LLM (vazia quando liberado). */
  reason: string;
  /** Cada leitura contraria encontrada, ex: "1H estocastico SOBRECOMPRADO (k=82.1)". */
  opposing: string[];
  /** Resumo de todas as leituras, sempre preenchido (vai pro log mesmo quando libera). */
  summary: string;
}

const fmt = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(1) : "?");

function stochOpposes(s: SlowStochasticResult, side: MtfSide): string | null {
  const contraZone = side === "LONG" ? "SOBRECOMPRADO" : "SOBREVENDIDO";
  const contraCross = side === "LONG" ? "CRUZOU_PARA_BAIXO" : "CRUZOU_PARA_CIMA";
  if (s.label === contraZone) return `estocastico ${contraZone} (k=${fmt(s.k)})`;
  if (s.crossing === contraCross) return `estocastico ${contraCross.replace(/_/g, " ").toLowerCase()} (k=${fmt(s.k)}, d=${fmt(s.d)})`;
  return null;
}

/**
 * Momento do MACD contra o lado: histograma caindo/subindo 3 velas seguidas ou cruzando a linha de sinal contra.
 * O RUMO da linha MACD (label) NAO entra aqui: e ele quem define o lado da 1H (atr.ts), e uma REVERSAO e contra a 1H por definicao.
 */
function macdMomentumOpposes(m: MacdResult, side: MtfSide): string | null {
  const contraTurn = side === "LONG" ? "VIRANDO_PARA_BAIXO" : "VIRANDO_PARA_CIMA";
  const contraCross = side === "LONG" ? "CRUZOU_PARA_BAIXO" : "CRUZOU_PARA_CIMA";
  if (m.crossing === contraCross) return `MACD ${contraCross.replace(/_/g, " ").toLowerCase()} a linha de sinal`;
  if (m.turning === contraTurn) return `histograma do MACD ${contraTurn.replace(/_/g, " ").toLowerCase()} (3 velas seguidas)`;
  return null;
}

/**
 * Regras (o tempo maior manda, METODO_OPERACIONAL secao 2):
 *  1. Estocastico da 1H ou da 4H em zona/cruzamento contra o lado  -> BLOQUEIA (qualquer setup, inclusive REVERSAO:
 *     reversao de LONG so vale depois de SOBREVENDIDO, nunca com a 1H ja SOBRECOMPRADA).
 *  2. Momento do MACD da 1H contra o lado -> BLOQUEIA (exceto REVERSAO, que e contra a 1H por definicao).
 *  3. Sem leitura da 1H (estocastico ou MACD) -> BLOQUEIA: nao se opera "no escuro" sobre o tempo que decide o lado.
 *  4. Senao, conta os avisos do 15m (estocastico e MACD) e do MACD da 4H: 2 ou mais contra o lado -> BLOQUEIA.
 *     1 aviso isolado nao bloqueia (e o "aviso, nao ordem" do 15m no metodo), mas fica registrado no summary.
 */
export function evaluateMtfConfluence(side: MtfSide, readings: MtfReadings, opts: { isReversal: boolean }): MtfVerdict {
  const { stoch, macd } = readings;
  const tfs: MtfTimeframe[] = ["15m", "1H", "4H"];
  const summary = tfs
    .map((tf) => {
      const s = stoch[tf];
      const m = macd[tf];
      const st = s ? `est ${fmt(s.k)}/${fmt(s.d)} ${s.label}${s.crossing ? " " + s.crossing : ""}` : "est n/d";
      const mc = m ? `MACD ${m.label}${m.turning ? " " + m.turning : ""}${m.crossing ? " " + m.crossing : ""}` : "MACD n/d";
      return `${tf}: ${st}; ${mc}`;
    })
    .join(" | ");

  const opposing: string[] = [];
  const hard: string[] = [];

  // Regra 3: 1H sem leitura
  if (!stoch["1H"] || !macd["1H"]) {
    const faltou = [!stoch["1H"] ? "estocastico" : null, !macd["1H"] ? "MACD" : null].filter(Boolean).join(" e ");
    return {
      blocked: true,
      opposing: [`sem leitura de ${faltou} na 1H`],
      summary,
      reason: `sem leitura de ${faltou} da 1H (o tempo que decide o lado) -- nao opero no escuro. Tente de novo no proximo ciclo.`,
    };
  }

  // Regra 1: estocastico 1H / 4H
  for (const tf of ["1H", "4H"] as const) {
    const s = stoch[tf];
    const o = s ? stochOpposes(s, side) : null;
    if (o) {
      hard.push(`${tf} ${o}`);
      opposing.push(`${tf} ${o}`);
    }
  }
  // Regra 2: momento MACD 1H (nao vale pra REVERSAO)
  if (!opts.isReversal) {
    const o = macdMomentumOpposes(macd["1H"], side);
    if (o) {
      hard.push(`1H ${o}`);
      opposing.push(`1H ${o}`);
    }
  }
  // Regra 4: avisos do 15m e MACD 4H
  const soft: string[] = [];
  const s15 = stoch["15m"] ? stochOpposes(stoch["15m"], side) : null;
  if (s15) soft.push(`15m ${s15}`);
  if (!opts.isReversal) {
    const m15 = macd["15m"] ? macdMomentumOpposes(macd["15m"], side) : null;
    if (m15) soft.push(`15m ${m15}`);
    const m4 = macd["4H"] ? macdMomentumOpposes(macd["4H"], side) : null;
    if (m4) soft.push(`4H ${m4}`);
  }
  opposing.push(...soft);

  if (hard.length > 0) {
    return {
      blocked: true,
      opposing,
      summary,
      reason: `tempo maior contra ${side}: ${hard.join("; ")}.`,
    };
  }
  if (soft.length >= 2) {
    return {
      blocked: true,
      opposing,
      summary,
      reason: `${soft.length} avisos de tempos menores/4H contra ${side} sem nenhum a favor que compense: ${soft.join("; ")}.`,
    };
  }
  return { blocked: false, opposing, summary, reason: "" };
}
