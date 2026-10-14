/**
 * Plano do MODO EXPANSAO (metodo do Cleber, 14/10) -- funcao PURA, sem rede e sem efeito em ordem.
 *
 * Em dia de rompimento forte de fundo/topo, o alvo vai em cima do proximo degrau de Fibonacci (nao no scalp curto),
 * a posicao pode ser REFORCADA a cada X pontos a favor (corredor entre degraus), PROTEGIDA (stop no preco de entrada)
 * e REDUZIDA perto do fim do degrau. A invalidacao e estrutural: o preco voltar a tocar o 0 do corredor.
 *
 * MODO SOMBRA: so registra em ledger/expansion_shadow.jsonl. O backtest de 14/10 (BTC/ETH/SOL, 1H) nao achou vantagem
 * estatistica relevante sobre o passeio aleatorio, entao NADA aqui deve operar de verdade antes de o relatorio
 * (scripts/expansion-shadow-report.ts) acumular dias de dado a favor.
 */
import type { FibCorridor } from "./fibCorridor.js";

export interface ExpansionPlan {
  ativo: boolean;
  motivo: string;
  tf?: string;
  direcao?: "BAIXA" | "ALTA";
  entrada?: number;
  alvo?: { ratio: number; price: number; distPct: number };
  invalidacao?: { price: number; distPct: number };
  /** retorno/risco do plano (distancia ao alvo / distancia a invalidacao) */
  rr?: number;
  /** precos onde reforcar (a cada `espacamentoPct` a favor), ate `maxReentradas` */
  reentradas?: number[];
  /** apos a primeira reentrada, o stop sobe para o preco de entrada */
  protecao?: { gatilhoPrice: number; stopPrice: number };
  /** perto do fim do degrau: tirar `fracao` dos contratos */
  reducao?: { price: number; fracao: number };
}

export interface ExpansionInput {
  side: "LONG" | "SHORT";
  entryPrice: number;
  corridor: FibCorridor | null;
}

const num = (v: string | undefined, d: number) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

export function planExpansion(inp: ExpansionInput): ExpansionPlan {
  const c = inp.corridor;
  if (!c) return { ativo: false, motivo: "sem corredor de Fibonacci (nenhum rompimento de fundo/topo recente)" };
  if (!c.emExpansao) return { ativo: false, motivo: "preço ainda não rompeu o 0 do corredor" };
  if (c.redesenhar || !c.proximoDegrau) return { ativo: false, motivo: "degraus esgotados: redesenhar em tempo maior" };
  const aFavor = (c.direcao === "BAIXA" && inp.side === "SHORT") || (c.direcao === "ALTA" && inp.side === "LONG");
  if (!aFavor) return { ativo: false, motivo: `entrada ${inp.side} contra a expansão de ${c.direcao}` };

  const e = inp.entryPrice;
  const alvoPrice = c.proximoDegrau.price;
  const long = inp.side === "LONG";
  const naDirecao = long ? alvoPrice > e : alvoPrice < e;
  if (!naDirecao) return { ativo: false, motivo: "o próximo degrau já ficou para trás do preço de entrada" };

  const distAlvo = Math.abs(alvoPrice - e);
  const distInval = Math.abs(c.pontoB - e);
  if (!(distInval > 0)) return { ativo: false, motivo: "entrada colada na invalidação" };

  const espacamento = num(process.env.MT5_EXPANSION_SPACING_PCT, 0.15) / 100; // 0,15% do preco (~100 pts no JPN225)
  const maxReentradas = Math.max(0, Math.floor(num(process.env.MT5_EXPANSION_MAX_REENTRIES, 3)));
  const reduzirEm = num(process.env.MT5_EXPANSION_REDUCE_AT, 0.9); // 90% do caminho ate o degrau
  const fracaoReducao = num(process.env.MT5_EXPANSION_REDUCE_FRACTION, 0.5);

  const precoReducao = long ? e + reduzirEm * distAlvo : e - reduzirEm * distAlvo;
  const reentradas: number[] = [];
  for (let i = 1; i <= maxReentradas; i++) {
    const p = long ? e * (1 + espacamento * i) : e * (1 - espacamento * i);
    if (long ? p >= precoReducao : p <= precoReducao) break; // nao reforca dentro da zona de reducao
    reentradas.push(Number(p.toFixed(4)));
  }
  return {
    ativo: true,
    motivo: `entrada a favor da expansão de ${c.direcao} (${c.tf}): alvo no degrau ${(c.proximoDegrau.ratio * 100).toFixed(1)}%`,
    tf: c.tf,
    direcao: c.direcao,
    entrada: e,
    alvo: { ratio: c.proximoDegrau.ratio, price: alvoPrice, distPct: (distAlvo / e) * 100 },
    invalidacao: { price: c.pontoB, distPct: (distInval / e) * 100 },
    rr: distAlvo / distInval,
    reentradas,
    protecao: reentradas.length ? { gatilhoPrice: reentradas[0], stopPrice: e } : undefined,
    reducao: { price: Number(precoReducao.toFixed(4)), fracao: fracaoReducao },
  };
}
