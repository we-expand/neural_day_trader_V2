/**
 * Leitura das MEDIAS como gatilho de entrada (gatilho D do metodo do Cleber, 14/10) -- funcao PURA, sem rede.
 * "As medias sao o ponto onde compradores e vendedores se encontram": numa tendencia o preco volta a elas e o que faz
 * ali decide o lado. BATE E VOLTA = a tendencia continua (reentrada a favor); ROMPE a 9 = nao e so repique (alerta);
 * ROMPE a 20 = saiu da tendencia. E uma COMBINACAO: a media diz o lugar, o estocastico (nova cruza a favor) confirma
 * a hora -- este modulo nao olha o estocastico, a mesa cruza as duas leituras.
 */
import type { FibCandle } from "./fibCorridor.js";

export type EstadoMedia = "REJEICAO_NA_9" | "REJEICAO_NA_20" | "ROMPEU_9" | "ROMPEU_20" | "SEM_TOQUE" | "SEM_TENDENCIA";
export interface MaTrigger {
  tf: string;
  tendencia: "BAIXA" | "ALTA" | "NEUTRA";
  estado: EstadoMedia;
  /** lado que a leitura favorece como REENTRADA a favor da tendencia (null = nenhum) */
  ladoFavorecido: "LONG" | "SHORT" | null;
  ema9: number | null;
  sma20: number | null;
  texto: string;
}

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}
export function sma(values: number[], period: number): Array<number | null> {
  return values.map((_, i) => (i + 1 < period ? null : values.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0) / period));
}

/** Olha as ultimas `janela` velas (a ultima e a atual). */
export function readMaTrigger(candles: FibCandle[] | null | undefined, tf: string, janela = 3): MaTrigger | null {
  if (!candles || candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const e9 = ema(closes, 9), s20 = sma(closes, 20);
  const n = candles.length - 1;
  const last = candles[n], E = e9[n], S = s20[n];
  if (S == null) return null;
  const base = { tf, ema9: E, sma20: S };
  // ATR simples das ultimas 14 velas: a tendencia exige a 9 separada da 20 por pelo menos 0,25 ATR (sem isso e lateral)
  const trs = candles.slice(-14).map((c, k, arr) => (k === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - arr[k - 1].close), Math.abs(c.low - arr[k - 1].close))));
  const atr = trs.reduce((a, b) => a + b, 0) / trs.length;
  const separada = Math.abs(E - S) >= 0.25 * atr;
  const tendencia: "BAIXA" | "ALTA" | "NEUTRA" = separada && E < S && last.close < S ? "BAIXA" : separada && E > S && last.close > S ? "ALTA" : "NEUTRA";
  if (tendencia === "NEUTRA") {
    return { ...base, tendencia, estado: "SEM_TENDENCIA", ladoFavorecido: null, texto: `${tf}: médias sem tendência clara (9 ${E.toFixed(2)}, 20 ${S.toFixed(2)}): não há reentrada em média para ler` };
  }
  const baixa = tendencia === "BAIXA";
  const recentes = candles.slice(-janela).map((c, k) => ({ c, e: e9[n - janela + 1 + k], s: s20[n - janela + 1 + k] }));
  const tocou9 = recentes.some(({ c, e }) => (baixa ? c.high >= e : c.low <= e));
  const tocou20 = recentes.some(({ c, s }) => s != null && (baixa ? c.high >= s : c.low <= s));
  const alem9 = baixa ? last.close > E : last.close < E;
  const alem20 = baixa ? last.close > S : last.close < S;
  const lado: "LONG" | "SHORT" = baixa ? "SHORT" : "LONG";
  const nome = baixa ? "baixa" : "alta";
  if (alem20) {
    return { ...base, tendencia, estado: "ROMPEU_20", ladoFavorecido: null, texto: `${tf}: tendência de ${nome}, mas o preço ROMPEU a média de 20 (${S.toFixed(2)}): saiu da tendência, sem reentrada a favor` };
  }
  if (alem9) {
    return { ...base, tendencia, estado: "ROMPEU_9", ladoFavorecido: null, texto: `${tf}: tendência de ${nome}; o preço ROMPEU a média de 9 (${E.toFixed(2)}) para o outro lado: ALERTA, não é só ${baixa ? "repique" : "recuo"}; a reentrada ${baixa ? "de venda" : "de compra"} NÃO vale agora` };
  }
  if (tocou20) {
    return { ...base, tendencia, estado: "REJEICAO_NA_20", ladoFavorecido: lado, texto: `${tf}: tendência de ${nome}; o preço bateu na média de 20 (${S.toFixed(2)}) e voltou: rejeição, gatilho D de ${baixa ? "VENDA" : "COMPRA"} (confirmar com nova cruza do estocástico a favor)` };
  }
  if (tocou9) {
    return { ...base, tendencia, estado: "REJEICAO_NA_9", ladoFavorecido: lado, texto: `${tf}: tendência de ${nome}; o preço bateu na média de 9 (${E.toFixed(2)}) e voltou: rejeição, gatilho D de ${baixa ? "VENDA" : "COMPRA"} (confirmar com nova cruza do estocástico a favor)` };
  }
  const dist = (Math.abs(last.close - E) / last.close) * 100;
  return { ...base, tendencia, estado: "SEM_TOQUE", ladoFavorecido: null, texto: `${tf}: tendência de ${nome}; o preço está a ${dist.toFixed(2)}% da média de 9 (${E.toFixed(2)}) sem tocá-la nas últimas ${janela} velas: espere a volta à média para a reentrada` };
}
