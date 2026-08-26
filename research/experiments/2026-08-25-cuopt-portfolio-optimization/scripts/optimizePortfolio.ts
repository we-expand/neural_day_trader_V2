/**
 * Fase A do cuOpt: resolve alocação conjunta sobre candidatos elegíveis de
 * um ciclo (mesmos gates do motor de produção) e compara contra o baseline
 * sequencial real (1 por ciclo) e contra alocação conjunta ALEATÓRIA (teste
 * de viés de seleção — ver hypothesis.md). Nenhum resultado aqui é
 * promovido sem passar por DataSplit + DeflatedSharpe + CostModel.
 *
 * ⚠️ PENDENTE: o schema exato do endpoint cuOpt via NIM API (build.nvidia.com)
 * não foi confirmado contra a documentação oficial nesta sessão — a função
 * `solveCuOptAllocation` abaixo está deixada como stub explícito
 * (lança erro) até isso ser verificado, em vez de fabricar um formato de
 * requisição que pode estar errado. Baseline sequencial e aleatório abaixo
 * já são reais e rodam sem a NVIDIA.
 *
 * Rodar: npx esbuild scripts/optimizePortfolio.ts --bundle --platform=node \
 *   --format=esm --outfile=/tmp/optimizePortfolio.mjs && node /tmp/optimizePortfolio.mjs
 */

interface Candidate {
  symbol: string;
  expectedReturnPercent: number;
  marginRequiredPercent: number;
}

interface AllocationResult {
  chosen: Candidate[];
  totalExpectedReturnPercent: number;
  totalMarginPercent: number;
}

const MAX_MARGIN_UTILIZATION_PERCENT = 0.3; // mesma constante de TradeSizing.ts, não duplicar lógica de produção

/** Baseline real do motor hoje: primeiro candidato elegível, um por ciclo. */
function sequentialBaseline(candidates: Candidate[]): AllocationResult {
  const chosen = candidates.slice(0, 1);
  return summarize(chosen);
}

/** Baseline de controle pro teste de viés de seleção (ver hypothesis.md). */
function randomJointAllocation(candidates: Candidate[], count: number): AllocationResult {
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return summarize(clampToMargin(shuffled.slice(0, count)));
}

function clampToMargin(candidates: Candidate[]): Candidate[] {
  const chosen: Candidate[] = [];
  let usedMargin = 0;
  for (const c of candidates) {
    if (usedMargin + c.marginRequiredPercent > MAX_MARGIN_UTILIZATION_PERCENT) continue;
    chosen.push(c);
    usedMargin += c.marginRequiredPercent;
  }
  return chosen;
}

function summarize(chosen: Candidate[]): AllocationResult {
  return {
    chosen,
    totalExpectedReturnPercent: chosen.reduce((sum, c) => sum + c.expectedReturnPercent, 0),
    totalMarginPercent: chosen.reduce((sum, c) => sum + c.marginRequiredPercent, 0),
  };
}

/**
 * cuOpt resolveria isto como problema de otimização combinatória
 * (maximizar retorno esperado sujeito a margem/leverage) em vez do greedy
 * guloso implícito na ordem de ranking do motor atual.
 */
async function solveCuOptAllocation(_candidates: Candidate[]): Promise<AllocationResult> {
  throw new Error(
    'solveCuOptAllocation não implementado: schema do endpoint cuOpt via NIM API ' +
      '(build.nvidia.com) precisa ser confirmado contra a documentação oficial antes ' +
      'de codar a chamada real — não fabricar formato de requisição. Ver hypothesis.md.',
  );
}

async function main() {
  // Placeholder de candidatos pra exercitar os baselines locais — a versão
  // real desta função lê o resultado de `analyzeAsset` gravado pelo motor
  // (mesmo dado usado em 2026-08-05-taxa-base) em vez de dado inventado.
  throw new Error(
    'Este script precisa dos candidatos reais de um ciclo (saída de analyzeAsset ' +
      'sobre o dado histórico de 2026-08-05-taxa-base) antes de rodar — placeholder ' +
      'de dado fabricado removido de propósito. Ver hypothesis.md, seção Metodologia.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
