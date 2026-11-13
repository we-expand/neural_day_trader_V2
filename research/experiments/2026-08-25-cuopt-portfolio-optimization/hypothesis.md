# cuOpt — otimização de portfólio, Fase A (validação isolada, 2026-08-25)

## Origem

Cleber pediu integração do NVIDIA cuOpt (otimização de portfólio
GPU-acelerada, via NIM API) direto no motor de decisão (`runTradingCycle.ts`).
Antes de tocar produção, esta Fase A implementa de verdade — não hipotético
— o cenário que `research/experiments/2026-08-16-portfolio-amplitude/`
só simulou e marcou como **não validado** (viés de seleção, sem
holdout/DSR): alocação conjunta multi-ativo em vez de decisão sequencial
single-asset.

## O que muda vs. o motor atual

`runTradingCycle.ts` hoje rankeia a cesta inteira mas abre no máximo 1
trade por ciclo, parando no primeiro candidato elegível (`break` após
`tradeOpened` — não há alocação conjunta). Esta Fase A testa: dado um
conjunto de candidatos elegíveis num ciclo (todos que passariam os gates
hoje — cost-viability, correlação, tail-risk, etc.), o cuOpt resolve uma
alocação conjunta (quais abrir simultaneamente, com que tamanho,
respeitando `MAX_MARGIN_UTILIZATION_PERCENT` e `MAX_NOTIONAL_LEVERAGE` já
existentes) — comparado contra o baseline real (1 por ciclo, sequencial).

## Metodologia (mesma disciplina de todo experimento do projeto)

- Reusa os dados históricos já existentes (`2026-08-05-taxa-base`, mesmos 9
  símbolos × 3 timeframes, mesmos 5 presets de produção).
- Split treino/holdout com embargo (`DataSplit.ts`) — a config de
  otimização (pesos do solver cuOpt, se houver hiperparâmetro) é escolhida
  no treino e avaliada no holdout, mesma disciplina anti-cherry-pick do
  `2026-08-24-order-block-fade`.
- Custo real via `CostModel.ts` — nunca retorno bruto.
- Deflated Sharpe/Sortino com bootstrap, corrigindo por qualquer variação
  de configuração testada.
- **Teste explícito do viés de seleção** que o experimento de 08-16 já
  tinha sinalizado como risco do cenário multi-setup: comparar resultado
  do cuOpt contra um baseline aleatório de alocação conjunta (mesma
  contagem de posições simultâneas, escolha aleatória em vez de otimizada)
  — se o cuOpt não bater o baseline aleatório por margem estatisticamente
  significativa, o resultado é "amplitude ajuda, otimização não", não
  "cuOpt tem edge".

## Critério de sucesso (igual ao resto do projeto — CRITERIA.md)

Amostra ≥100 sinais, líquido de custo, IC 95%, degradação out-of-sample
≤30% relativo, walk-forward sem look-ahead. Sem isso, resultado é
"achado não validado", nunca promovido.

## Fase B — explicitamente FORA de escopo desta rodada

Integração real em `runTradingCycle.ts`/`TradeSizing.ts` só acontece
**depois** desta Fase A passar no critério acima, atrás de feature flag
desligada por padrão (mesmo padrão `ASSET_SCORECARD_ACTIVE`). Cleber pediu
integração direta no motor, mas fazer isso sem esta validação prévia
contradiz a convenção fixa do projeto ("nunca prometer edge sem validação
estatística", CLAUDE.md) — a Fase A é o caminho mais rápido possível até
lá, não uma etapa burocrática extra.

## Pré-requisito técnico

Requer `NVIDIA_API_KEY` no ambiente (Cleber cria em build.nvidia.com) para
o endpoint cuOpt via NIM. Sem a chave, `scripts/optimizePortfolio.ts` lança
erro explícito e não roda.
