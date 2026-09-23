# Sessão 2026-09-09 — Aba "IA Preditiva" reconstruída + motor SMC no LLM Brain

## Pedido original do Cleber

A aba "IA Preditiva" estava "muito pobre" — pediu pra convocar o conselho
(llm-council) e evoluir a página com funcionalidades preditivas reais,
codáveis (Python/estatística/ML), pra uso diário do day trader.

## Achado inicial (antes do conselho)

`LiquidityPredictionView`/`LiquidityPrediction.tsx` (o componente real por
trás da aba) tinha um histórico grave: um "Detector de Baleias e Liquidez
Institucional" que usava `Math.random()` pra fabricar alertas tipo "VENDA
BALEIA: 350 BTC transferidos, pressão de baixa detectada" e apresentava
como fato real ao usuário. Parcialmente corrigido em 2026-07-28 (~17
templates de alerta fabricados removidos), mas o README do módulo ainda
descrevia esse comportamento como atual — risco real de a mesma aba
reincidir no mesmo padrão se não corrigido antes de qualquer feature nova.

## Conselho (llm-council) — veredito completo

5 conselheiros (Contrarian, First Principles, Expansionist, Outsider,
Executor) + 2 rodadas de peer review + síntese do chairman. Resumo:

**Onde concordaram:**
- O nome "IA Preditiva" era o problema estrutural, não as features em si —
  cria pressão de produto pra "parecer que prevê o futuro", exatamente a
  pressão que gerou o Detector de Baleias fabricado.
- Volatilidade é a única frente com ML já aprovado pelo projeto
  (`AI_BRAIN_SPEC.md`/histórico: busca por edge de direção técnica não deu
  resultado, ML só entra em previsão de volatilidade).
- "Probabilidade de rompimento falso" e "exaustão de tendência" são sinal
  direcional disfarçado de estatística — mesma categoria já reprovada pelo
  DSR (Deflated Sharpe Ratio) em meses de investigação anterior do projeto.
  Não viram feature sem validação formal nova (walk-forward/holdout).
- Não existe order book real nesta corretora (CFD via MetaAPI, sem L2/L3)
  — qualquer "zona de liquidez" tem que ser honesta sobre ser S/R técnico,
  nunca fluxo real de ordens institucional.
- README do Detector de Baleias fake ainda ativo como documentação era
  bloqueador imediato, antes de qualquer feature nova.

**Pontos cegos capturados na revisão:**
- Meta-modelo de confiança do LLM Brain (ideia do Expansionist) já foi
  tentado como meta-label do `confidence_score` do Jarvis e bloqueado por
  amostra insuficiente (n=278) — não é ganho fácil, é ideia cedo demais.
- Configuração pelo usuário é superfície de risco, não só UX: threshold
  editável por leigo em produção é recalibração sem holdout — p-hacking
  pelo front-end. Regra adotada: range travado por validação prévia
  (nunca livre), log auditável de toda mudança, liga/desliga só por ativo
  individualmente validado.

**As 6 funcionalidades recalibradas:**

| # | Função | Status decidido |
|---|---|---|
| 1 | Previsão de Volatilidade (EWMA) | ✅ Implementada nesta sessão |
| 2 | Classificador de Regime de Mercado | ✅ Implementada nesta sessão |
| 3 | Zonas Técnicas de Interesse (ex-"liquidez") | ✅ Implementada nesta sessão |
| 4 | Meta-Confiança do LLM Brain | ⏸ Pausada — reconsiderar com 450-500+ trades fechados |
| 5 | Alerta de Janela de Risco Elevado | 🔜 Não implementada ainda (combina #1+#2+notícia real) |
| 6 | Rompimento Falso / Exaustão de Tendência | ❌ Não é feature — vira projeto de pesquisa formal (walk-forward/holdout) se algum dia retomado |

## Implementação — frontend (aba "Inteligência de Mercado")

Nome público da aba trocado (decisão final do Cleber, depois de cogitar
manter "IA Preditiva") — **"IA Preditiva" → "Inteligência de Mercado"** em
3 lugares: `Sidebar.tsx` (menu lateral), título da página em
`LiquidityPrediction.tsx`, texto do tutorial de onboarding
(`Tutorial.tsx`).

README do módulo (`src/app/modules/predictive-ai/README.md`) reescrito:
documenta o comportamento REAL atual (horário de mercado real, contagem de
candle real, trade grande real via Binance, microestrutura real só cripto)
e deixa explícito o que foi removido e por quê — instrução pra nunca
reintroduzir o padrão de dado fabricado.

**#1 — Previsão de Volatilidade (EWMA)**
[`src/app/utils/volatilityForecast.ts`](src/app/utils/volatilityForecast.ts):
EWMA de variância (λ=0.94, padrão RiskMetrics J.P. Morgan) sobre retornos
log de candle real, classifica regime BAIXA/NORMAL/ALTA/EXTREMA por
percentil da própria distribuição histórica do ativo (nunca threshold
universal fixo). Lança erro explícito se amostra < 60 candles — nunca
fabrica.
[`src/app/components/innovation/VolatilityForecastCard.tsx`](src/app/components/innovation/VolatilityForecastCard.tsx):
card com gráfico real, alerta por voz opcional em vol. alta/extrema,
painel de config (liga/desliga, sensibilidade travada 70º-95º percentil,
toggle de voz) com log auditável em `localStorage`.

**#2 — Regime de Mercado**
[`src/app/components/innovation/MarketRegimeCard.tsx`](src/app/components/innovation/MarketRegimeCard.tsx):
reaproveita `scoreResult` (ADX + largura de Bollinger, já calculado pelo
`MarketScoreEngine` que a página já usava) — classifica TENDÊNCIA/LATERAL/
INDEFINIDO, mostra ADX e volume relativo reais, narra por voz 1x por
mudança de regime. Config: só liga/desliga (é descritivo, sem threshold —
não é alarme).

**#3 — Zonas Técnicas de Interesse**
[`src/app/components/innovation/TechnicalZonesCard.tsx`](src/app/components/innovation/TechnicalZonesCard.tsx):
reaproveita o motor SMC já existente e em produção
(`src/app/services/smc/`, o mesmo que desenha zonas no `ChartView.tsx`) —
Order Blocks, Fair Value Gaps, Liquidity Pools sobre candle real. Rótulos
da UI deliberadamente evitam "liquidez real"/"order book" (nomeado "Zona
Técnica de Compra/Venda", "Vazio de Preço", "Pool de Equalização") — texto
explícito no card avisando que não é book real. Config: liga/desliga,
mostrar zonas mitigadas, quantidade exibida (travada 3-8).

Todos os 3 cards integrados em `LiquidityPrediction.tsx`, no lugar do
painel morto "Força Relativa (7D) — Indisponível" (que continua ali,
intocado, mais abaixo).

`tsc --noEmit`: zero erros novos em todos os arquivos tocados (confirmado
via grep isolado contra os 570 erros totais pré-existentes do projeto).

## Integração no motor real (llm-active-brain)

Depois dos cards prontos, o Cleber pediu explicitamente: **"Nosso motor
utilizará essas tecnologias pra ajudar na tomada de decisões"** — ou seja,
não só exibir na tela, alimentar o `llm-active-brain` (processo Node que
abre/fecha posição de verdade).

Antes de implementar, investigado o estado real do motor — achado
importante: **#2 (Regime) e uma versão simples de #3 (S/R) já alimentavam
o motor havia semanas** (`getMarketRegime`/`getSupportResistance` em
`atr.ts`, já injetados em `get_mt5_quote` e usados no cap de R:R de
`open_position`). Não eram gaps novos. Perguntado ao Cleber o que fazer
com a duplicação — decisão dele:
- **Volatilidade**: manter só o ATR ratio que já existe no motor (já
  validado há semanas) — EWMA fica só como visualização complementar na
  tela, não entra no motor.
- **Zonas SMC completas**: sim, adicionar como contexto adicional — o S/R
  simples que já existe continua sendo o que cápa R:R mecanicamente, SMC é
  só mais confluência pro julgamento do LLM.

Implementado:
- [`llm-active-brain/src/smc.ts`](llm-active-brain/src/smc.ts) (novo) —
  motor SMC portado do frontend (`src/app/services/smc/`), consolidado num
  arquivo só (Node não compartilha bundler com o Vite do frontend). Lógica
  idêntica ao original — qualquer fix de bug deveria ser replicado nos dois
  lados até existir um pacote compartilhado real (anotado no cabeçalho do
  arquivo).
- [`llm-active-brain/src/atr.ts`](llm-active-brain/src/atr.ts) — nova
  função `getSmcZonesSummary(symbol, timeframe)`: reaproveita
  `fetchRecentCandles` (mesmo cache/fila de 2 concorrentes da MetaAPI que
  os outros indicadores já usam), roda `analyzeSmc`, devolve as 4 zonas
  não-mitigadas mais próximas do preço + último evento de estrutura
  (BOS/CHoCH).
- [`llm-active-brain/src/tools.ts`](llm-active-brain/src/tools.ts) —
  `get_mt5_quote` agora devolve `smcZones` (mesmo padrão de
  trend/volume/MACD/regime/candlePatterns).
- [`llm-active-brain/src/agent.ts`](llm-active-brain/src/agent.ts) — novo
  princípio **1i** no prompt: instrui o LLM a usar `smcZones` como camada
  extra de confluência sobre o `supportResistance` já existente, deixa
  explícito que NUNCA é order book real (corretora CFD sem L2/L3) e NUNCA
  vira gatilho mecânico novo — o cap de R:R em `open_position` continua
  usando só o S/R simples, intocado.

`tsc --noEmit` limpo no `llm-active-brain`. `npm run validate` (raiz):
37/37 OK.

## Pendente

- **Commits** (2 prontos, comandos entregues ao Cleber — regra fixa do
  projeto, Claude nunca commita sozinho):
  1. README + renomeação + cards #1/#2/#3 no frontend.
  2. Motor SMC no `llm-active-brain` (`smc.ts`/`atr.ts`/`tools.ts`/`agent.ts`).
- **`./restart.sh`** (dentro de `llm-active-brain/`) depois do commit 2,
  pra carregar o princípio novo e o campo `smcZones` no processo ao vivo.
- **Não testado ao vivo** nem no frontend (dev local exige login) nem no
  motor real — sem validação estatística ainda, é mecânica nova de
  contexto, precisa de dias/trades rodando antes de avaliar se o LLM está
  usando `smcZones` de forma coerente (mesma disciplina de toda mudança de
  contexto já aplicada antes no projeto).
- **#5 (Alerta de Janela de Risco Elevado)** do roadmap do conselho ainda
  não foi implementada — combinaria #1+#2+notícia real (já existe
  `news.ts` no motor). Não foi pedida ainda nesta sessão.
- **#4 (Meta-Confiança)** continua pausada — só reconsiderar com 450-500+
  trades fechados (precedente Jarvis, n=278 insuficiente).
- **#6 (Rompimento Falso/Exaustão)** explicitamente não é feature — só
  vira produto se algum dia um projeto de pesquisa formal (walk-forward/
  holdout, mesmo padrão do resto do projeto) comprovar edge.

## Arquivos tocados nesta sessão

Frontend:
- `src/app/modules/predictive-ai/README.md` (reescrito)
- `src/app/utils/volatilityForecast.ts` (novo)
- `src/app/components/innovation/VolatilityForecastCard.tsx` (novo)
- `src/app/components/innovation/MarketRegimeCard.tsx` (novo)
- `src/app/components/innovation/TechnicalZonesCard.tsx` (novo)
- `src/app/components/innovation/LiquidityPrediction.tsx` (integra os 3 cards + título)
- `src/app/components/Sidebar.tsx` (rótulo do menu)
- `src/app/components/onboarding/Tutorial.tsx` (texto do tutorial)

Motor (`llm-active-brain/`):
- `src/smc.ts` (novo — motor SMC portado)
- `src/atr.ts` (nova função `getSmcZonesSummary`)
- `src/tools.ts` (`get_mt5_quote` expõe `smcZones`)
- `src/agent.ts` (novo princípio 1i no prompt)
