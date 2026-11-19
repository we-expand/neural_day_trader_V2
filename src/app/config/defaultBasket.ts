// Cesta padrão de análise da IA — 2026-08-17.
//
// POR QUE existe: até esta data a cesta padrão tinha 2 ativos
// (`['EURUSD', 'XBNUSD']`, useApexLogic.ts) e as sessões reais rodavam com
// 5-6. Com o motor sorteando 3 ativos por tick via `Math.random()`, "escolher
// o melhor ativo do dia" nunca chegou a existir: era loteria sobre uma lista
// curta. O pedido do Cleber, repetido desde o início do projeto, é o oposto —
// varrer uma cesta ampla e operar o que está funcionando HOJE.
//
// CRITÉRIO DE INCLUSÃO (objetivo, não gosto pessoal):
//   1. Liquidez de primeira linha na classe — spread estreito e estável em
//      horário normal de pregão. Exóticos de FX (USDRUB, USDTRY, USDNGN…)
//      ficam FORA de propósito: o spread deles consome o movimento típico
//      intradiário, e o `COST_GATE` os reprovaria em runtime de qualquer
//      forma — incluí-los só gastaria orçamento de chamada de API.
//   2. Cobertura de classe e de FUSO. Cripto (24/7) mantém a IA com universo
//      analisável quando índices e commodities estão fechados — hoje, com
//      cesta pequena e majoritariamente de pregão, há janelas longas do dia
//      em que não existe nada pra analisar.
//   3. Horizonte intradiário viável — ativos cujo ATR típico comporta o custo
//      de round-trip (mesma lógica que o `CostViabilityGate` aplica por
//      ativo, aqui aplicada antes, na composição).
//
// O que este arquivo NÃO é: uma afirmação de que estes 39 ativos têm edge.
// Nenhum tem edge comprovado (ver CLAUDE.md e AI_BRAIN_SPEC.md seções 11-14).
// A cesta ampla existe pra dar ao ranking um universo grande o bastante pra
// ordenar — não pra prometer resultado.
//
// XAGUSD está deliberadamente FORA: foi removido da cesta padrão em
// 2026-08-16 (commit f2ff7ecc2) por resultado negativo medido em capital
// real. Aquela medição rodou com o motor antigo (gatilho binário, long-only),
// então não é conclusão definitiva — mas reverter uma remoção baseada em
// medição exigiria remedir primeiro, não supor.

/** Índices — maior volume intradiário, pregão US/EU/Ásia. */
const INDICES = ['SPX500', 'NAS100', 'US30', 'US2000', 'GER40', 'UK100', 'FRA40', 'JP225'];

/** Cripto majors — cobertura 24/7, inclusive fim de semana. */
const CRYPTO = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'BNBUSD', 'ADAUSD', 'DOGEUSD', 'LTCUSD', 'LINKUSD', 'AVAXUSD'];

/** Metais preciosos (sem XAGUSD — ver cabeçalho). */
const METALS = ['XAUUSD', 'XPTUSD', 'XPDUSD'];

/** Energia. */
const ENERGY = ['USOUSD', 'UKOUSD', 'XNGUSD'];

/** Agrícolas/softs — descorrelacionados de índices e cripto. */
const SOFTS = ['COCUSD', 'COFUSD', 'SUGUSD', 'WHEUSD'];

/** Forex majors. */
const FX_MAJORS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'];

/** Crosses líquidos — movimento próprio sem depender só da perna USD. */
const FX_CROSSES = ['EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY'];

export const DEFAULT_ANALYSIS_BASKET: string[] = [
  ...INDICES,
  ...CRYPTO,
  ...METALS,
  ...ENERGY,
  ...SOFTS,
  ...FX_MAJORS,
  ...FX_CROSSES,
];

/**
 * Teto de ativos que o motor atualiza por tick (round-robin). NÃO é o tamanho
 * da cesta: a cesta inteira continua sendo ranqueada a cada ciclo, sobre o
 * cache de candles. Só o REFRESH é escalonado, porque cada atualização é uma
 * chamada à API da corretora — e a conta MetaAPI é compartilhada entre todos
 * os usuários da plataforma (risco crônico documentado no CLAUDE.md, com
 * HTTP 429 confirmado em produção em 2026-08-17).
 *
 * ⚠️ REDUZIDO de 6 para 3 em 2026-08-17 (mitigação, não solução): medido em
 * produção que `mt5-candles-history` (o motor) fez 5.942 chamadas em 35min,
 * boa parte reprovada por HTTP 429/504 — a cotação do rodapé (`mt5-prices`,
 * endpoint leve, bucket de rate-limit separado) nunca esbarra no mesmo teto,
 * o que confirma que o gargalo é este endpoint pesado especificamente. Reduzir
 * pela metade não elimina o rate-limit (a conta é compartilhada com outros
 * usuários da plataforma, fora do nosso controle) — só reduz a frequência com
 * que ele aparece. A correção real é separar dado de execução (ver
 * NEXT_SESSION.md, seção "Feed de dados").
 *
 * Com 39 ativos e 3 por tick, o ciclo completo de refresh leva ~13 ticks. É
 * por isso que o TTL do cache passou a ser alinhado à barra do timeframe
 * operado (um candle fechado só muda quando a barra vira — reler antes disso
 * é gasto de chamada sem informação nova).
 */
export const ASSETS_REFRESHED_PER_TICK = 3;

/**
 * Cesta padrão de `activeAssets` (ativos ATIVOS, o que o motor efetivamente
 * varre pra abrir posição) — diferente de `DEFAULT_ANALYSIS_BASKET` acima,
 * que é o universo AMPLO de ranking (39 ativos, por design). Adicionada em
 * 2026-08-20: o painel de configuração do AI Trader estava abrindo com os 39
 * ativos da cesta de análise inteira pré-marcados como ativos, sem o usuário
 * ter escolhido isso — Cleber pediu que o default seja enxuto (9), e o
 * usuário amplia a partir daí se quiser. Lista definida pelo Cleber: 1
 * subconjunto diversificado (FX, metal, energia, cripto, índices), sem
 * XAGUSD (removido de propósito da cesta de análise em 2026-08-16 por
 * resultado negativo medido — ver cabeçalho deste arquivo).
 */
export const DEFAULT_ACTIVE_ASSETS: string[] = [
  'EURUSD', 'XAUUSD', 'UKOUSD', 'BTCUSD', 'SOLUSD', 'ETHUSD', 'GER40', 'SPX500', 'NAS100'
];
