# Resumo da sessão 2026-07-25/26 — busca por edge sistemático (seções 11.12→11.15)

> Handoff pra continuar em outra janela. Este arquivo é um resumo pontual desta
> sessão — a fonte de verdade contínua continua sendo [CLAUDE.md](CLAUDE.md)
> (carrega automático em toda sessão) e [research/AI_BRAIN_SPEC.md](research/AI_BRAIN_SPEC.md)
> (seções 11.5→11.15, histórico completo com métodos/scripts/números). Pode
> apagar este arquivo depois de ler — não é destinado a virar documentação
> permanente do projeto.

## Onde a sessão começou

Pendência #1 do CLAUDE.md: 5 presets de estratégia (`presetStrategies.ts`)
tinham sido testados em forex major (11.5→11.11) sem nenhum passar o piso de
edge comprovado (DSR≥95%). Cleber escolheu, em sequência, testar cada uma das
opções que restavam:

## O que foi feito, em ordem

**1. (a) Testar os arquétipos restantes (11.12)** — Reversão à Média,
Rompimento Confirmado e Scalp (os 3 presets que só tinham passado por grid
search, nunca por pooling cross-sectional) rodados na cesta forex major (7
pares, MetaAPI real, 10 anos). **Todos os 3 deram DSR 0,0%.** Fecha os 5
presets × forex major sem candidato.

**2. (b) Ampliar cesta de instrumentos pra cripto (11.13)** — os 5 presets
testados numa cesta de 7 pares cripto (BTC/ETH/BNB/SOL/XRP/ADA/DOGE via
Binance público). **Achado no meio do caminho**: bug real em
`research/CostModel.ts` — a fórmula de custo pra CRYPTO usava
`pontos÷preço`, calibrada implicitamente pra escala BTC/ETH, e explodia pra
moedas sub-US$1 (DOGE a US$0,073 chegava a 136,7% de custo round-trip por
trade). **Corrigido** (CRYPTO agora trata custo como % direto do preço, como
o comentário da tabela sempre disse que deveria ser — `estimateCostPercent()`
em `research/CostModel.ts`). `npm run validate` verde depois da correção.
Resultado real depois de corrigir: ainda nenhum arquétipo passa o piso, mas
**Donchian em cripto 4h é o melhor sinal de toda a investigação** — DSR
52,0%, Sharpe pooled ~0,003 (quase zero, não negativo), 4 de 7 pares
positivos, n=329 (amostra válida).

**3. (c) Revisar timeframe do Donchian (11.14)** — testado em 1d e 1w, mesma
cesta cripto, zero ajuste de parâmetro. 1d deu DSR 78,7% mas com **n=48,
abaixo do piso mínimo de 100 sinais da seção 8 — inconclusivo por desenho**,
mesmo padrão de amostra pequena inflando o número que já tinha enganado antes
(seção 11.10→11.11: DSR 85,3% com n=92 reverteu pra 39,3% com mais dado). 1w
é inutilizável (n=1, histórico de cripto curto demais).

**4. Reformular a função objetivo: Sharpe → Sortino (11.15)** — a seção 1 da
spec já declarava o objetivo formal como "Sharpe/Sortino", mas Sortino nunca
tinha sido medido. Implementado `sortinoRatio`, `deflatedSortinoRatio` e
`bootstrapSortinoSignificance` em `research/DeflatedSharpe.ts` (o bootstrap é
o teste mais confiável, não assume forma de distribuição). Testado o mesmo
Donchian nos 3 timeframes. **Na única amostra válida (4h, n=323), o
bootstrap deu 44,8% de chance do Sortino real ser positivo — abaixo de 50%.**
Ou seja: é mais provável que o Sortino real seja NEGATIVO do que positivo.
Isso é o resultado mais conclusivo (e mais negativo) de toda a linha
11.5→11.15 — fecha a hipótese de que Sharpe estava escondendo edge
assimétrico do trend-following.

## Estado real, sem inflar

Depois de 11 sub-seções de investigação (11.5→11.15), cobrindo:
- 5 arquétipos de estratégia
- 2 cestas de instrumentos (forex major, cripto)
- 3 timeframes no melhor candidato (4h, 1d, 1w)
- 2 métricas de sucesso (Sharpe, Sortino)
- 2 testes de significância (Deflated Ratio analítico, bootstrap empírico)

**Nenhum candidato passou o piso de edge comprovado (DSR≥95% ou bootstrap
consistente).** O melhor resultado (Donchian cripto 4h) tem Sharpe/Sortino
pooled essencialmente zero — não é "quase edge", é ruído em torno de zero, e
o teste mais rigoroso já aplicado a ele (bootstrap) aponta pro lado negativo.

## Bugs reais encontrados e corrigidos nesta sessão (não é só resultado negativo)

1. **`research/CostModel.ts`** — custo de CRYPTO quebrado pra moedas
   sub-US$1 (corrigido, seção 11.13).
2. **`research/DeflatedSharpe.ts`** — adicionadas `sortinoRatio`,
   `deflatedSortinoRatio`, `bootstrapSortinoSignificance` (novidade, não bug,
   seção 11.15).

`npm run validate` (gate obrigatório do projeto) passou 28/28 depois de cada
mudança.

## Decisão que fica pro Cleber na próxima sessão

Opções que restam, sem nenhuma sendo "óbvia":

- **Ampliar mais a cesta cripto** (mais pares além dos 7 já testados) —
  ainda não esgotado, mas cada rodada nova tem retorno marginal decrescente.
- **Testar Donchian 1d/1w em forex major** — histórico bem mais longo que
  cripto (a limitação de amostra que travou 11.14 em cripto não existiria
  lá), mas nunca testado nesse timeframe em forex.
- **Reformular a métrica pra expectância monetária** (US$/trade com teste-t,
  alinhado ao requisito R2 da spec — "rende mais em dinheiro", não Sharpe
  percentual) — opção de reformulação de objetivo ainda não tentada.
- **(d) Pausar a busca sistemática por edge** e focar noutra frente do
  produto por um tempo — depois de 11 sub-seções sem um único candidato
  validado, essa opção merece mais peso agora do que quando foi proposta pela
  primeira vez (seção 11.11).

## Arquivos criados/modificados nesta sessão

- `research/AI_BRAIN_SPEC.md` — seções 11.12 a 11.15 (novo conteúdo)
- `CLAUDE.md` — pendência #1 atualizada a cada rodada
- `research/CostModel.ts` — bugfix custo CRYPTO
- `research/DeflatedSharpe.ts` — Sortino + bootstrap
- `research/experiments/2026-07-25-pooled-crosssectional/pooled-validate-345.ts`
- `research/experiments/2026-07-25-crypto-basket/pooled-validate-crypto.ts`
- `research/experiments/2026-07-25-crypto-basket/diagnose-sizing-bug.ts`
- `research/experiments/2026-07-26-donchian-timeframe/donchian-daily-weekly.ts`
- `research/experiments/2026-07-26-sortino-objective/donchian-sortino.ts`

**Nada foi commitado por mim** (regra fixa do projeto — Claude nunca faz
`git commit`/`git push` sozinho). Comandos de commit prontos foram entregues
ao Cleber ao longo da sessão, um por rodada; still pendente rodar se ele não
tiver rodado ainda. Verificar `git status` no início da próxima sessão.
