# Handoff — próxima sessão (atualizado em 2026-07-31, fim de sessão)

> **Estado**: branch `dev`, `origin/dev` **em dia** com tudo desta sessão até
> o commit `da72c4b54` (push já confirmado pelo Cleber). Working tree tem
> **1 mudança nova ainda não commitada** (campo `entrySignal` no construtor
> de estratégia — ver seção "O que está no working tree agora").
>
> **Leitura obrigatória antes de tocar no motor**: `CLAUDE.md` pendência #5
> (estado dos componentes do cérebro) + `research/AI_BRAIN_SPEC.md` seção 14
> (encerramento formal da busca por edge de sinal — decide o que é e não é
> viável pedir do cérebro).

## Resumo pra abrir a nova janela

1. Ler este arquivo inteiro.
2. Rodar `git status` — deve mostrar só `StrategyBuilderPro.tsx` modificado
   (mais este próprio arquivo, se ainda não foi commitado). Se houver mais
   coisa, alguém mexeu depois desta sessão.
3. Ler `CLAUDE.md` pendência #5 antes de tocar no motor de novo.

**Estado em uma frase**: o cérebro está sendo evoluído de "motor de risco
parcial" pra "motor de execução autônomo, sem previsão de direção"; nesta
sessão o foco foi **acurácia do backtest** (rodava com custo zero —
corrigido), **configurabilidade** (capital inicial, contratos fracionários)
e **usabilidade do construtor de estratégia** (exposto de volta na UI de IA,
direção de sinal agora explícita em vez de inferida por heurística).

---

## O que foi feito nesta sessão (ordem cronológica, tudo commitado exceto o último item)

1. **Fix: contratos fracionários no backtest** (`b77fc63ae`) — campo
   "Contratos" na config de backtest não aceitava `0.01` (estava com
   `parseInt`/`step=1`). Trocado pra `parseFloat`/`step=0.01`/`min=0.01`.

2. **Fix: backtest rodava com custo ZERO** (`2599939e8`) — achado central da
   sessão, em resposta à pergunta do Cleber "qual a acurácia do backtest?".
   `useBacktestLiveProgress.ts` chamava `runBacktest()` sem passar
   `roundTripCostPercent`, então todo resultado de backtest na UI era
   **bruto**, não líquido — sistematicamente mais otimista que qualquer
   execução real. Corrigido: agora calcula classe de ativo via
   `SymbolMappingService`, preço de referência (último candle) e ponto/valor
   via `TradeSizing`, e passa pelo `CostModel.ts` (`estimateCostPercent`,
   ida e volta) — mesma convenção usada em `useApexLogic.ts` e nos scripts de
   pesquisa. `BacktestResultsModal.tsx` ganhou aviso explícito: "Resultado
   líquido — já descontado o custo estimado de execução".
   - **Limitação conhecida, não resolvida**: forex sempre cai em
     `FOREX_MAJOR` por falta de granularidade minor/exotic no
     `SymbolMappingService` — pode subestimar custo nesses casos. Mesma
     aproximação já documentada em outras partes do código (ver pendência
     #5 do `CLAUDE.md`).

3. **Capital inicial do backtest, configurável** (`5fc4885e8`) — o
   `$10,000.00` que aparecia nos resultados era hardcoded e sem explicação
   na tela (Cleber perguntou "o que é isso, aonde entrega o resultado").
   Substituído o bloco "Quantidade" (Contratos/Máximo) por um campo único
   "Capital Inicial do Teste" em `BacktestConfigModal.tsx`, com texto
   explicativo deixando claro que é capital **fictício da simulação**,
   independente do capital real configurado na IA. Fluxo completo:
   `BacktestConfigModal` → `ChartView.tsx` → `useBacktestLiveProgress.ts` →
   `BacktestEngine.ts`.

4. **Fix: painel de progresso do backtest não estava centralizado**
   (`5d60423d4`) — ajuste de UI, sem impacto no motor.

5. **Fix: renomear "Comparar com" → "Cruzar com"** (`dccc7969e`) — campo do
   construtor de estratégia tinha nome confuso pro tipo de condição que
   representa (cruzamento de indicador, não comparação estática).

6. **Reabrir acesso ao construtor de estratégia personalizada**
   (`4f710a354`, consolidado no squash final `da72c4b54`) — Cleber pediu "só
   insira um personalizado" depois de perceber que não dava mais pra criar
   estratégia customizada a partir das configurações de IA (`AITrader.tsx`).
   O `StrategyBuilderPro.tsx` já existia, completo e funcional — só estava
   sem rota de acesso. Adicionado botão "Criar personalizada" em
   `AITrader.tsx` que navega pra `ChartView.tsx` com o builder já aberto
   (bridge de navegação nova em `App.tsx`: `chartInitialAction` +
   `handleCreateCustomStrategy`).

7. **Componente 4 do cérebro de execução, fix de segurança** (pronto de
   sessão anterior, commitado nesta: `768356c93`) — Kill-Switch e Health
   Check só impediam abrir trade **novo**, nenhum dos dois fechava posição
   LIVE já aberta na corretora quando o limite disparava. Novo módulo
   `LiveEmergencyClose.ts` (`forceCloseAllLivePositions()`, retry
   exponencial 5x + confirmação via `getPositions()`, nunca assume sucesso
   só pela resposta da API) ligado em `useApexLogic.ts` nos dois pontos de
   gatilho (kill-switch síncrono e transição pra safe-mode), só em modo
   `LIVE`.

**`npm run validate` rodou tudo verde** (14+13 casos, Componentes 1 e 5) após
todas as mudanças acima, incluindo o item 8 abaixo (ainda não commitado).

---

## O que está no working tree agora (não commitado)

- **`src/app/components/backtest/StrategyBuilderPro.tsx`** — campo
  `entrySignal?: 'BUY' | 'SELL'` adicionado ao tipo `Strategy` e à UI (aba
  Entrada), agora **obrigatório** pra salvar uma estratégia customizada nova.
  Motivo: `StrategyEvaluator.ts` tinha um fallback de inferência de direção
  por contagem de operador (`CROSS_BELOW`/`BELOW`/`FALLING` → "bearish" →
  SELL) que é correto pra breakout/trend-following mas **errado** pra
  reversão à média (ex: "Estocástico cruza abaixo de 20" é sinal de
  **compra** — sobrevenda — não de venda; já inverteu um preset em produção
  antes, ver `presetStrategies.ts` comentário na linha ~159). Agora o
  usuário escolhe explicitamente Compra/Venda na UI, sem depender do
  fallback heurístico.
  - **Já wired de ponta a ponta**: tipo em `types/strategy.ts`, consumido em
    `StrategyEvaluator.ts:226` (`if (strategy.entrySignal) signal =
    strategy.entrySignal`), presets em `presetStrategies.ts` todos com
    `entrySignal: 'BUY'` (são todos long-only por implementação, então o
    fallback nunca os afetou), passado por `ChartView.tsx:6330`.
  - **`npm run validate` já rodou verde depois desta mudança também.**
  - **Ainda não commitado** — comandos prontos abaixo pro Cleber rodar.

```bash
git add src/app/components/backtest/StrategyBuilderPro.tsx NEXT_SESSION.md
git commit -m "feat: campo obrigatório de direção (Compra/Venda) no construtor de estratégia personalizada"
git push
```

- **`research/experiments/2026-07-30-fase2-remediation/`** (untracked,
  órfã, herdada de sessão anterior, trabalho incompleto) — decisão do Cleber
  ainda não tomada, considerar descartar se ele não quiser retomar.

---

## Próximo passo (ordem acordada com o Cleber em sessão anterior, não iniciado)

Decisão de arquitetura fechada em sessão anterior (não repetir a discussão —
ver `CLAUDE.md` pendência #5 e `AI_BRAIN_SPEC.md` seção 14 pro histórico
completo): "operar sempre que possível" = frequência é resultado do gate de
custo/risco, nunca meta em si; "decidir qual ativo vai render mais" =
ranking mecânico por facilidade de execução (ATR/preço, custo/spread),
nunca previsão de retorno (reabriria o Trilho 2, pausado); agenda econômica
= só feed ao vivo, filtro de "evitar operar", nunca sinal de direção.

Faltam 2 blocos, nesta ordem sugerida (podem ser feitos em paralelo entre
si, mas só depois do Componente 4, que já está pronto e commitado):

1. **Ranking mecânico de ativos elegíveis** — novo módulo (ex:
   `AssetRankingService.ts`). Para cada ativo selecionado pelo usuário:
   calcula ATR/preço (volatilidade relativa) e custo/spread estimado, passa
   pelo `CostViabilityGate` (já existe, `src/app/services/risk/
   CostViabilityGate.ts`), e rankeia os que passam por "melhor relação
   movimento esperado / custo" — **nunca por previsão de retorno**. Ativos
   que falham no gate ficam de fora, com motivo registrado (auditável, mesmo
   padrão de nunca fabricar dado). Zero linha escrita ainda.
2. **Autonomia de entrada/saída automática** (Estágio 3 da spec, seção
   9.1) — liga `useApexLogic.ts` a `BrokerClient.ts` pra abrir/fechar posição
   automaticamente conforme o setup configurado pelo usuário (modo alvo,
   regras técnicas já existentes). Zero linha escrita ainda.
3. **Agenda econômica como filtro "evitar operar"** — novo módulo (ex:
   `EconomicCalendarGuard.ts`). Precisa escolher fonte de feed ao vivo grátis
   (pesquisa não feita ainda) antes de implementar. Bloqueia novas entradas N
   minutos antes/depois de evento de alto impacto no ativo em questão.
   Marcado explicitamente como "não validado estatisticamente" na UI/logs —
   é proteção, não sinal.

Nenhum dos 3 tem decisão de qual começar primeiro entre (1) e (3) — só a
ordem "ambos depois do Componente 4" foi fechada.

---

## Pendências reais herdadas (sem mudança nesta sessão)

Ver `CLAUDE.md` seção "Pendências reais em aberto" pra lista completa. As que
seguem relevantes pro trabalho no cérebro:
- **`Marketplace.tsx:30`** — "87% win rate" hardcoded, arquétipo scalping (o
  pior já medido). Ainda mais urgente sob a decisão (B) de produto (produto
  sem edge não pode exibir acurácia). Cleber informado, não decidiu.
- **Correlação de portfólio calculada ao vivo** (só existe heurística
  estática por grupo hoje) — TODO citado no `RISK_MODULE_SPEC.md` seção 3.5,
  não é bloqueante pro trabalho atual mas fica em aberto.

---

## Lembretes fixos

- **Comunicação sempre em português do Brasil**
- **Nunca `git commit`/`git push` sozinho** — entregar comandos prontos pro Cleber
- **Nunca fabricar dado** — erro explícito quando não há fonte real
- **`npm run validate` obrigatório** antes de qualquer commit que toque o motor
- **Todo experimento salva output em arquivo**, nunca só em prosa
- **Ler `CLAUDE.md` inteiro antes de tocar no motor de decisão**;
  `AI_BRAIN_SPEC.md` é o histórico de pesquisa detalhado
- **Rigor de especialista + honestidade radical, permanente** — nunca inflar
  número, nunca esconder achado negativo, sempre reportar o dado que sustenta
  (ou a ausência dele, declarada)
- **Cérebro é motor de execução/disciplina, não de alfa** (decisão (B),
  30/07) — qualquer proposta de "prever qual ativo/direção vai render mais"
  precisa ser sinalizada como reabertura do Trilho 2, não feature comum
