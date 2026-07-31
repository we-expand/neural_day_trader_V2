# Handoff — próxima sessão (escrito em 2026-07-30, ~23h)

> **Estado**: branch `dev`, commit `08eb78078`. A busca por edge de sinal foi
> **formalmente encerrada** nesta sessão, com razão matemática registrada, e o
> Cleber tomou uma **decisão de produto (opção B)** que muda a função objetivo
> do cérebro. `npm run validate` ✅ (motor não foi tocado — só documentação e
> scripts de pesquisa novos).
>
> **Leitura obrigatória antes de qualquer trabalho no motor**:
> `research/AI_BRAIN_SPEC.md` **seção 14** (nova) + o bloco de encerramento no
> `CLAUDE.md`. Existem para evitar que esta sessão seja refeita do zero.

---

## O que aconteceu nesta sessão

O Cleber partiu de uma observação correta sobre os testes anteriores: **quando
ganhava, ganhava pouco; quando perdia, perdia quase o mesmo** — e propôs
desenhar o cérebro em torno de payoff assimétrico ("ganha muito, perde pouco"),
usando sinais que prevejam **magnitude** do movimento (rompimento de topo,
pressão compradora/vendedora), não só direção.

A hipótese foi testada em 3 etapas, da mais barata para a mais cara.

### Etapa 1 — Correção de premissa (antes de testar)

O Cleber mencionou "uma das estratégias que entregou 87% de assertividade".
**Esse número nunca existiu em nenhum teste deste projeto.** A origem provável
é `src/app/components/Marketplace.tsx:30` — card de produto hardcoded ("Neural
Scalper Pro — 87% win rate nos últimos 3 meses"). Corrigido antes de virar
premissa de design.

### Etapa 2 — Diagnóstico barato de MFE/MAE (sem custo, sem TP/SL)

`research/experiments/2026-07-30-breakout-mfe-mae-diagnostic/`

Pergunta única: dado que o preço rompeu (Donchian 20, saída Donchian 10), a
excursão favorável supera a adversa? Rodada 1 (BTC solo, 6 meses) deu n=35 em
1h — descartada por poder estatístico. Rodada estendida: 7 criptos, 24 meses,
**n=4.058 (15m) e n=973 (1h)**.

**A assimetria EXISTE**: payoff ratio real **1,79x (15m)** e **1,88x (1h)**,
consistente através dos 7 instrumentos. **Mas** o win rate ficou em 35,4% e
34,1%, e o breakeven para esses payoffs é 35,8% e 34,7%. EV bruto, antes de
qualquer custo: **-0,011% e -0,033%** ≈ zero.

### Etapa 3 — Teste executável, custo real, contrato 0,01 BTC

`research/experiments/2026-07-30-breakout-donchian-executable/`

| Timeframe | n | Win rate | Resultado líquido | DSR |
|---|---|---|---|---|
| 15m pooled | 615 | 25,5% | **-US$1.447,73** | 0,0% ❌ |
| 1h pooled | 133 | 35,3% | **-US$73,55** | 35,9% ❌ |
| 1h SHORT isolado | 70 | 35,7% | +US$186,65 | 72,4% ❌ |

O único subgrupo positivo (SHORT 1h) está **abaixo do piso de 95% do
`CRITERIA.md` e abaixo do piso de 100 sinais** — não promovido, e reportá-lo
isolado seria cherry-picking (o LONG do mesmo desenho perdeu US$260).

---

## Os 3 achados que ficam (valem mais que os testes)

### 1. Teorema da parada opcional — razão MATEMÁTICA do encerramento

Três desenhos de saída completamente diferentes (ATR 1,5×/3×; pontos fixos
100/400 e 30/200; Donchian trailing) deram EV bruto ≈ 0 em todos os casos. Não
é má parametrização — é o teorema: se o preço é aproximadamente martingale,
então para **qualquer** regra de parada limitada, `E[P_τ] = P_0`.

> **Stop e alvo escolhem a FORMA da distribuição de payoff — nunca a MÉDIA.**
> A assimetria é *paga* com win rate, não *criada*.

**Consequência normativa**: qualquer proposta futura do tipo "vamos testar stop
X com alvo Y" está **refutada a priori**, salvo se vier com evidência de que o
sinal prevê magnitude condicional. Não é preciso rodar o backtest para saber.

### 2. Gate de viabilidade por custo, quantificado

| Timeframe | Movimento típico (MFE médio) | Custo (0,26%) como % do movimento | Viável? |
|---|---|---|---|
| 15m | 1,05% | 25% | ❌ |
| 1h | 2,52% | 10% | ⚠️ fronteira |
| 4h | ~5% (extrapolado √t) | ~5% | ✓ |
| Diário | ~12% (extrapolado √t) | ~2% | ✓✓ |

**Todo teste desta sessão rodou abaixo ou na fronteira do piso** — o resultado
estava determinado pela aritmética antes de olhar o sinal. As linhas 4h/diário
são extrapolação declarada (escala √t), não medição.

### 3. Erro metodológico nomeado (atravessa as seções 11.10-11.13)

A cesta de 7 criptos tem correlação típica 0,7-0,9 entre pares — é **~1,5
apostas independentes, não 7**. O pooling cross-sectional aumentou o `n` da
mesma aposta, **nunca a diversificação real**. Isso enfraquece a leitura de "7
instrumentos pooled" como evidência robusta nas seções anteriores.

---

## DECISÃO DE PRODUTO: opção (B) — tomada pelo Cleber

Apresentadas duas saídas mutuamente exclusivas:

- **(A)** perseguir o perfil convexo onde ele comprovadamente vive —
  trend-following diário/swing, cesta multi-classe descorrelacionada, 10-20
  anos (é o perfil "ganha muito/perde pouco" da literatura AQR) — mas exigiria
  **reposicionar o produto para fora de day trading**;
- **(B)** manter o produto intraday e assumir que o cérebro é de **execução e
  disciplina, não de alfa**.

### Cleber escolheu (B). Implicações:

1. **Função objetivo nova**: minimizar perda por causa evitável, com burn rate
   mínimo e comportamento auditável. Com edge ≈ 0, EV por trade ≈ `−custo`,
   logo **o cérebro mais eficiente é o que opera menos** (matemática, não
   conservadorismo).
2. **Só metade da hipótese original é construível**: "perde pouco" é garantível
   mecanicamente (hard stop, sizing inverso à vol, daily limit, cooldown);
   "ganha muito" só condicionalmente. Assimetria **por trade** é impossível;
   assimetria **de exposição ao longo do tempo** é real e implementável.
3. **ML entra apenas em previsão de volatilidade** (autocorrelacionada,
   tratável — base da família GARCH), **nunca de direção**.
4. **Destrava a Fase 3 / Estágio 3**: a questão "vale avançar sem edge
   comprovado?" tem resposta — sob (B), a ponte de execução **é** o produto.

---

## Próximo passo — Componente 1 implementado E LIGADO no motor

**Achado importante desta 2ª sessão**: `RISK_MODULE_SPEC.md` estava
desatualizado. Ele descreve o gate de risco como "proposto, não
implementado", mas `useApexLogic.ts` já tinha, mesmo antes de qualquer
trabalho de hoje, um `RiskManager` real (daily loss/drawdown/kill-switch
síncrono), sizing por ATR e um guard de correlação por grupo estático —
Componentes 2 e 3 da lista de prioridade já existiam, parcialmente. Detalhe
completo na pendência #5 do `CLAUDE.md`. Lição: checar o código antes de
confiar numa spec/handoff antigo.

**Componente 1 (gate de viabilidade por custo)**:
`src/app/services/risk/CostViabilityGate.ts` — função pura
`evaluateCostViability(costPercent, typicalMovementPercent)`, limiares 7%
(VIAVEL)/12% (FRONTEIRA, reprovado por padrão)/acima (INVIAVEL), calibrados
pra reproduzir a coluna "Viável?" da tabela 14.3 (15m/1h/4h/1d BTCUSDT).
`__validate__.ts` com 14 asserções na suíte do `npm run validate`.

**Agora LIGADO no motor real** (`useApexLogic.ts`, logo após o filtro de
direção, antes do `RiskManager`): usa ATR(14) do candle buffer como proxy de
movimento típico por ativo (a tabela medida da spec 14.3 é só de BTCUSDT via
MFE, não extrapolável pra outro ativo — ATR é uma proxy diferente, mais
disponível em tempo real, aplicada aos mesmos limiares 7%/12% calibrados
contra MFE, então é aproximação declarada, não a mesma métrica). Classe de
custo por ativo usa `SymbolMappingService.findMapping().type` — forex sempre
cai em FOREX_MAJOR (mais barato) por falta de granularidade minor/exotic,
pode subestimar custo real em pares forex minor/exotic. `npm run validate`
rodou 33/33 ✅, type-check do motor limpo.

**O que ainda falta**: observar em produção/DEMO se o gate está de fato
recusando setups no log (`[CUSTO] 🚫`/`✅`) com frequência plausível — nunca
foi testado contra fluxo real, só validação determinística sintética. Se
ATR indisponível, o gate recusa por padrão (conservador, mas nunca testado
esse caminho em produção real).

Ordem completa dos 5 componentes em `CLAUDE.md` (pendência #5): (1) gate de
custo [pronto e ligado] → (2) sizing condicional à vol [já existia] →
(3) detector de correlação real de portfólio [versão heurística já existia,
falta correlação de retornos ao vivo] → (4) hard stop + daily loss limit
não-burláveis [já existe via RiskManager, falta auditar se é burlável] →
(5) diagnóstico de eficiência de saída (MFE/MAE dos trades do próprio
usuário) [não implementado].

---

## Sessões anteriores do mesmo dia (já commitadas, contexto condensado)

- **16h30** — Fases 0/1/2 completas + Fase 3 Estágios 1 e 2.
- **19h40** (`ff437d3cb`) — auditoria de máximo rigor do motor: **9 bugs reais
  corrigidos** (ADX com SMA em vez de RMA de Wilder; direção de sinal inferida
  causando inversão real no preset 3; exitBlock ruidoso no preset 4; trailing
  com look-ahead leve; empate TP/SL a favor do TP; sizing sem distância de
  stop; LCG do bootstrap com período curto; zero output salvo em arquivo).
  Criados `MASTER_PLAN.md`, `research/DataSplit.ts` (embargo real),
  `research/experiments/2026-07-30-engine-audit/`. Detalhe completo no
  `MASTER_PLAN.md` e no histórico do git.

---

## Pendências reais em aberto

1. **Working tree suja — falta commitar**: este `NEXT_SESSION.md`,
   `research/experiments/2026-07-30-breakout-donchian-executable/RESULTADOS.md`,
   `research/experiments/2026-07-30-custom-sma-pullback/` (pasta inteira,
   untracked), `research/experiments/2026-07-30-fase2-remediation/`, e
   modificações em `src/app/services/strategy/BacktestEngine.ts` +
   `__validate__.ts` — **essas duas últimas não são desta sessão, verificar
   origem antes de commitar**.
2. **`Marketplace.tsx:30`** — "Neural Scalper Pro, 87% win rate nos últimos 3
   meses" (R$299,90), rating 4.9 / 342 reviews / 1.284 vendas, tudo hardcoded.
   Tela viva (`App.tsx:273`, item na Sidebar). Dois problemas: número de
   performance fabricado **e** o arquétipo anunciado (scalping) é o que a
   pesquisa deste projeto mediu como **o pior de toda a investigação** (Sharpe
   pooled -3,36 em cripto, seções 11.12/11.13). Cleber informado, **não decidiu
   o tratamento**. Sob (B) isso fica urgente: produto sem edge não pode exibir
   acurácia.
3. **Força Relativa cross-sectional como 6º arquétipo** — proposto em sessão
   anterior, não decidido. **Atenção: é essencialmente a opção (A)** (momentum
   cross-sectional Jegadeesh-Titman, rebalanceamento mensal). Está em conflito
   direto com a decisão (B) — retomar só se o Cleber quiser reabrir o
   posicionamento do produto.
4. **3 roadmaps antigos não deletados** —
   `ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md`, `ROADMAP_SIMULADOR.md`,
   `ROADMAP_AI_TRADING_DEMO.md`, substituídos em conteúdo pelo `MASTER_PLAN.md`.
5. **`LiquidityPrediction.tsx`** ainda não religado ao `backtestDataService`
   real — painéis corretamente vazios, poderiam mostrar dado real (o serviço já
   existe e já é usado pelo `CorrelationMatrix.tsx`).
6. **Perna short dos arquétipos 1, 2, 4** — adiada por decisão explícita
   (exigiria `exitBlocks` conscientes do lado da posição). Revisitar depois.

---

## O que faria a decisão (B) mudar (registrado para ser revisável com critério)

- Evidência de sinal que preveja **magnitude condicional** — única coisa que
  reabre a discussão de stop/alvo.
- Teste de trend-following nas condições da literatura (diário, multi-classe
  genuinamente descorrelacionada, 10-20 anos, vol targeting). **Nunca foi feito
  aqui** — sua ausência não é evidência de fracasso.
- Queda estrutural do custo de transação, que moveria o piso de viabilidade.

---

## Lembretes fixos

- **Comunicação sempre em português do Brasil**
- **Nunca `git commit`/`git push` sozinho** — entregar comandos prontos pro Cleber
- **Nunca fabricar dado** — erro explícito quando não há fonte real
- **`npm run validate` obrigatório** antes de qualquer commit que toque o motor
- **Todo experimento salva output em arquivo**, nunca só em prosa
- **Ler `MASTER_PLAN.md` inteiro antes de tocar no motor de decisão**;
  `AI_BRAIN_SPEC.md` é o histórico de pesquisa detalhado (agora com seção 14)
- **Rigor de especialista + honestidade radical, permanente** — nunca inflar
  número, nunca esconder achado negativo, sempre reportar o dado que sustenta
  (ou a ausência dele, declarada)
