# Sessão 2026-09-16 — Jogada especial "FOMC_BTC_PLAY" (BTCUSD pós-discurso do Fed)

## Pedido do Cleber

Depois do discurso do Fed de hoje ("Super Quarta"), o Cleber pediu que a
nossa IA (LLM Brain) prepare/dispare uma operação especial em BTCUSD:

- Objetivo: capturar **1.500 pontos**.
- Stop também em **1.500 pontos** (R:R 1:1, explicitamente pedido assim).
- Tamanho: inicialmente cogitou "3 contratos de Bitcoin" **ou** "10% do
  patrimônio" — escolheu **10% do patrimônio (dinâmico)**.
- Operação prevista para acontecer por volta das **16h** (horário de
  Brasília), assim que o discurso do Fed **terminar**.
- Repetição: pediu que isso valha **toda vez que houver um discurso do
  Fed**, não só hoje.

## Perguntas feitas antes de implementar (e respostas do Cleber)

1. **Gatilho incondicional ou IA ainda valida confluência técnica antes de
   abrir?** → **IA ainda valida** (recomendado). Não é ordem cega — só abre
   se MACD/Estocástico/volume/tendência realmente apoiarem a direção.
2. **Sizing: 3 contratos fixos ou 10% do patrimônio calculado na hora?** →
   **10% do patrimônio (dinâmico)**.
3. **Vale para execução real (LIVE) ou só simulação?** → **Só modo DEMO**.

## Conflitos levantados antes de codar (e como foram resolvidos)

- **Risco de 10% num trade só estoura o teto vigente do motor**
  (`mt5MaxRiskPctPerTrade` = 6%, `config.ts`). Resolvido: essa jogada
  específica (`setupType="FOMC_BTC_PLAY"`) pula esse teto de propósito,
  só para ela — decisão consciente do Cleber, documentada no código.
- **Gatilho incondicional contradiria o fix de hoje mesmo** (gate que
  passou a exigir ≥2 fatores técnicos reais antes de entrada
  contra-tendência, ver topo do `CLAUDE.md`). Resolvido: a IA continua
  validando confluência real antes de abrir — a janela pós-Fed só
  **destrava** o símbolo/alvo/sizing especiais, nunca abre sozinha sem
  base técnica.

## O que foi implementado

Arquivos alterados (todos em `llm-active-brain/`):

- **`src/config.ts`** — bloco novo `fomcBtcPlay*`:
  - `fomcBtcPlayEnabled` (default `true`)
  - `fomcBtcPlaySymbol` (default `"BTCUSD"`)
  - `fomcBtcPlayTargetPoints` (default `1500`)
  - `fomcBtcPlayStopPoints` (default `1500`)
  - `fomcBtcPlayExposurePct` (default `0.10`, 10%)

- **`src/tools.ts`** (`open_position`):
  - Novo valor de `setupType`: `"FOMC_BTC_PLAY"`.
  - Guard de elegibilidade: só `BTCUSD`, só quando a janela do evento de
    alto impacto (mesmo `highImpactNewsGate` do Fed) **já fechou**, e só
    se **não** houver execução real (LIVE) ativa na sessão do usuário.
  - Override de stop/alvo: em vez do cálculo dinâmico por ATR/suporte-
    resistência, usa os 1500 pontos fixos (convertidos pra % a partir do
    preço de preenchimento real).
  - Override de sizing: em vez do cálculo por retorno-alvo em dólar,
    calcula lotes para expor exatamente 10% do patrimônio (saldo/capital
    alocado) em notional — pula de propósito o recap normal por
    %-de-risco (`mt5MaxRiskPctPerTrade`), mas continua respeitando os
    tetos absolutos de segurança (`mt5SafetyMaxLots`,
    `mt5MaxNotionalUsd`) como última rede de proteção.
  - Mensagem de retorno explica claramente quando essa jogada especial foi
    usada (pontos, R:R, % de exposição, teto de risco pulado).

- **`src/agent.ts`** — bloco de agenda econômica (mesmo lugar do reforço de
  FOMC de hoje cedo): quando a janela do evento fechar, instrui a IA a
  avaliar `BTCUSD` para essa jogada específica, usando
  `setupType="FOMC_BTC_PLAY"` — deixando claro que **não é ordem
  incondicional**, só abre com confluência técnica real, sem prazo fixo
  (pode levar mais que alguns minutos até a tese ficar clara).

## Validação

- `npx tsc --noEmit` em `llm-active-brain/`: **limpo, zero erro novo**.
- `npm run validate` (raiz do projeto): 37 asserções OK, 0 falharam — as 3
  etapas que aparecem como "falharam" são o mesmo problema pré-existente de
  bundler/Deno ("Dynamic require of stream") em `src/app/services/risk` e
  `src/app/services/analysis`, sem relação com esta mudança (esses arquivos
  não foram tocados).

## Commit e restart

- Commit **não foi feito automaticamente** (regra fixa do projeto — Claude
  nunca faz `git commit`/`push` sozinho). Comando entregue ao Cleber:

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
git add llm-active-brain/src/config.ts llm-active-brain/src/tools.ts llm-active-brain/src/agent.ts
git commit -m "feat(fomc): jogada especial BTCUSD pós-Fed (1500pts, 10% patrimônio, DEMO)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- **Restart**: o Cleber pediu explicitamente ("Restart LLM você mesmo") —
  rodado ao vivo com `./restart.sh` dentro de `llm-active-brain/`.
  Confirmado só **1 processo** rodando depois (`tsx src/index.ts`, PID
  28298), sessão elegível reconhecida, ciclo 1 iniciado normalmente. Como
  o motor roda via `tsx` (TypeScript direto, sem build), o restart já
  aplicou o código novo mesmo sem commit ainda.

## Pendente real

- `git commit` do diff acima (comando pronto, aguardando o Cleber rodar).
- Confirmar ao vivo, perto de 16h/16h30 Brasília, se a janela do Fed fecha
  como esperado e se a IA avalia/abre (ou conscientemente não abre, por
  falta de confluência) a jogada `FOMC_BTC_PLAY` em BTCUSD.
- Sem validação estatística nenhuma sobre essa jogada — é uma tese
  discricionária do Cleber para o evento de hoje (e para futuros discursos
  do Fed), não edge comprovado. R:R 1:1 e 10% de exposição em um trade só
  são bem mais agressivos que os parâmetros normais do motor.
