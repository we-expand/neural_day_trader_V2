/**
 * Calculadora de alvo ("agente matemático") -- 100% determinística, SEM LLM, SEM previsão.
 *
 * Estudo offline de 14/10/2026 (research/experiments/2026-10-14-planejador-de-alvo-e-duracao-estocastico):
 * a chance de o alvo vir antes do stop é ≈ stop/(stop+alvo) (BTC 2 anos: 0,499 real vs 0,500 base; nenhuma
 * feature -- faixa do dia, volatilidade, hora, estocástico -- melhorou isso fora da amostra). Então isto NÃO
 * promete edge nem escolhe direção: só faz a conta que a IA erra (espaço até o próximo nível, quanto paga o
 * alvo depois do custo, qual o menor alvo que cumpre o piso e se ele cabe).
 *
 * MODO SOMBRA: só registra (ledger/target_shadow.jsonl). Não altera nenhuma decisão.
 */

export interface TargetBarrierInput {
  nome: string;
  /** Distância do preço até o nível, em % do preço (0,12 = 0,12%). */
  distanciaPct: number | null;
  rompido: boolean;
}

export interface TargetCalcInput {
  side: "LONG" | "SHORT";
  /** Frações do preço (0.0037 = 0,37%). */
  stopPct: number;
  proposedTargetPct: number;
  amountUsd: number;
  /** Custo round-trip estimado em US$ para este tamanho. */
  roundTripCostUsd: number;
  /** Ganho líquido mínimo por entrada em US$ (o piso). */
  minNetRewardUsd: number;
  barriers: TargetBarrierInput[];
  /** Alvos extras a avaliar, em fração do preço. */
  extraTargetsPct?: number[];
  /** Margem antes do nível: o alvo tem de ficar a esta fração da distância até o nível (0,9 = 10% antes). */
  fitFraction?: number;
}

export interface TargetCandidate {
  targetPct: number;
  label: string;
  /** Cabe antes do próximo nível? null = sem dado de nível. */
  fits: boolean | null;
  /** Chance base de o alvo vir antes do stop: stop/(stop+alvo) (passeio aleatório, validado offline). */
  pHit: number;
  grossIfHitUsd: number;
  netIfHitUsd: number;
  netIfStopUsd: number;
  /** pHit×netIfHit + (1−pHit)×netIfStop. Com deriva zero fica ≈ −custo para qualquer alvo. */
  expectedNetUsd: number;
  meetsFloor: boolean;
}

export interface TargetPlan {
  nearestBarrier: { nome: string; distanciaPct: number } | null;
  /** Maior alvo (fração) que cabe antes do próximo nível, já com a margem. null = sem dado. */
  maxFitTargetPct: number | null;
  /** Menor alvo (fração) que paga o piso líquido (com custo). */
  floorTargetPct: number;
  floorTargetFits: boolean | null;
  candidates: TargetCandidate[];
  verdict: "VALE" | "NAO_VALE" | "SEM_DADO";
  summary: string;
}

const pct = (frac: number) => `${(frac * 100).toFixed(3)}%`;

export function computeTargetPlan(input: TargetCalcInput): TargetPlan {
  const { stopPct, proposedTargetPct, amountUsd, roundTripCostUsd, minNetRewardUsd } = input;
  const fitFraction = input.fitFraction ?? 0.9;
  const valid = [stopPct, proposedTargetPct, amountUsd].every((v) => Number.isFinite(v) && v > 0);
  if (!valid) {
    return { nearestBarrier: null, maxFitTargetPct: null, floorTargetPct: NaN, floorTargetFits: null, candidates: [], verdict: "SEM_DADO", summary: "entrada inválida: sem cálculo." };
  }

  const ahead = input.barriers
    .filter((b) => !b.rompido && b.distanciaPct != null && Number.isFinite(b.distanciaPct) && (b.distanciaPct as number) > 0)
    .sort((a, b) => (a.distanciaPct as number) - (b.distanciaPct as number));
  const nearest = ahead.length ? { nome: ahead[0].nome, distanciaPct: ahead[0].distanciaPct as number } : null;
  const hasLevelData = input.barriers.some((b) => b.rompido || (b.distanciaPct != null && Number.isFinite(b.distanciaPct)));
  const maxFit = nearest ? (nearest.distanciaPct / 100) * fitFraction : hasLevelData ? Number.POSITIVE_INFINITY : null;

  const floorTargetPct = (minNetRewardUsd + roundTripCostUsd) / amountUsd;
  const floorFits = maxFit == null ? null : floorTargetPct <= maxFit;

  const make = (targetPct: number, label: string): TargetCandidate => {
    const pHit = stopPct / (stopPct + targetPct);
    const grossIfHit = amountUsd * targetPct;
    const netIfHit = grossIfHit - roundTripCostUsd;
    const netIfStop = -(amountUsd * stopPct) - roundTripCostUsd;
    return {
      targetPct,
      label,
      fits: maxFit == null ? null : targetPct <= maxFit,
      pHit,
      grossIfHitUsd: grossIfHit,
      netIfHitUsd: netIfHit,
      netIfStopUsd: netIfStop,
      expectedNetUsd: pHit * netIfHit + (1 - pHit) * netIfStop,
      meetsFloor: netIfHit >= minNetRewardUsd,
    };
  };

  const raw: Array<[number, string]> = [[proposedTargetPct, "proposto"]];
  if (maxFit != null && Number.isFinite(maxFit) && maxFit > 0) raw.push([maxFit, "maior que cabe"]);
  raw.push([floorTargetPct, "menor que paga o piso"]);
  for (const t of input.extraTargetsPct ?? [0.0015, 0.0025, 0.0035, 0.005]) raw.push([t, "referência"]);
  const seen = new Set<string>();
  const candidates = raw
    .filter(([t]) => Number.isFinite(t) && t > 0)
    .filter(([t]) => (seen.has(t.toFixed(5)) ? false : (seen.add(t.toFixed(5)), true)))
    .sort((a, b) => a[0] - b[0])
    .map(([t, l]) => make(t, l));

  let verdict: TargetPlan["verdict"];
  let summary: string;
  if (maxFit == null) {
    verdict = "SEM_DADO";
    summary = `sem dado de nível no caminho: não dá para dizer se o alvo cabe. Para pagar o piso líquido de $${minNetRewardUsd.toFixed(2)} o alvo teria de ser ≥ ${pct(floorTargetPct)}.`;
  } else if (floorFits) {
    verdict = "VALE";
    summary = `o piso líquido de $${minNetRewardUsd.toFixed(2)} exige alvo ≥ ${pct(floorTargetPct)} e isso CABE${nearest ? ` (o próximo nível, ${nearest.nome}, está a ${nearest.distanciaPct.toFixed(3)}%)` : " (nenhum nível barra)"}.`;
  } else {
    verdict = "NAO_VALE";
    summary = `o piso líquido de $${minNetRewardUsd.toFixed(2)} exige alvo ≥ ${pct(floorTargetPct)}, mas o próximo nível (${nearest!.nome}) está a ${nearest!.distanciaPct.toFixed(3)}%: o alvo que paga o piso NÃO cabe sem romper o nível.`;
  }
  return { nearestBarrier: nearest, maxFitTargetPct: maxFit != null && Number.isFinite(maxFit) ? maxFit : null, floorTargetPct, floorTargetFits: floorFits, candidates, verdict, summary };
}
