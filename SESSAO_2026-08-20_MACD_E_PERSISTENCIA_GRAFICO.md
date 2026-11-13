# Sessão 2026-08-20 — MACD cosmético e persistência do gráfico

Duas investigações separadas, ambas fechadas com fix aplicado (commit pendente
do Cleber rodar).

## 1. "Dois stops infantis" (BTC/SOL) — MACD do snapshot era cosmético

**Relato inicial**: Cleber (graficista) reportou dois stops em SOL e BTC
"infantis" — a IA comprou exatamente quando o MACD estava enfraquecendo rumo
à reversão, algo que "qualquer MACD sabia".

**Investigação 1 (dado real, `ai_trades`)**: os dois trades (SOL LONG 17:50,
BTC LONG 17:43, ambos 2026-08-20) tinham `indicators_snapshot.macd:
"BULLISH"` no momento da entrada — aparentava confirmação técnica válida.

**Investigação 2 (código, achado real)**: `runTradingCycle.ts:1278` mostrou
que esse campo **nunca foi um cálculo real de MACD** — era
`side === 'LONG' ? 'BULLISH' : 'BEARISH'`, um espelho cosmético do lado da
entrada já decidida, gravado como se fosse leitura do indicador. O MACD de
verdade (`TechnicalIndicators.calculateMACD`) existe e alimenta o score via
`MarketScoreEngine.momentumFactor()`, mas usa **só o valor instantâneo do
histograma no último candle** — sem nenhuma lógica de inclinação/enfraquecimento
ao longo dos candles anteriores (o padrão visual que motivou a reclamação:
barras do histograma encolhendo antes da virada).

**Conclusão**: o diagnóstico do Cleber estava tecnicamente correto — a IA não
tem "perspicácia" de enxergar momentum minguando porque essa dimensão não
existe no cálculo de score hoje, e o rótulo do banco que parecia confirmar
isso era decorativo.

**Fix aplicado** (`runTradingCycle.ts:1276-1291`, commit
`ef9fd9b3c`): `indicators.macd` agora deriva de
`calculateMACD(candles)` real (linha MACD vs linha de sinal do último
candle), em vez de espelhar o lado da entrada. Escopo: só telemetria/auditoria
— não muda nenhuma regra de decisão, por isso não precisou de backtest, só do
gate (`npm run validate`, 37/37 verde).

**Não resolvido, pendente de decisão**: adicionar um fator de inclinação do
histograma MACD ao `momentumFactor` (penalizar entrada quando o histograma
está encolhendo mesmo do lado "certo"). Isso SIM é mudança de lógica de
decisão — precisa entrar com o mesmo rigor estatístico do resto do motor
(backtest antes de produção), não foi feito nesta sessão. Fica como próximo
passo, se o Cleber quiser levar adiante.

## 2. Gráfico perdia indicadores e timeframe ao trocar de seção do app

**Relato inicial**: Cleber reportou que salvar um Template do gráfico não
persistia os indicadores de painel (ex: MACD) — pareciam sumir ao recarregar.

**Investigação 1 (dado real, `chart_templates`)**: o template salvo por ele
("couto", 2026-08-20 13:04) tinha o MACD corretamente serializado:
`indicatorIds: ["ma","ema","macd","stoch_slow"]`,
`indicatorPlacement: {macd: "pane", ...}`. O salvamento e o schema já
distinguiam indicador de painel (`pane`) de overlay corretamente — não era
bug de serialização.

**Reprodução real (2 prints do Cleber)**: às 15:41, gráfico com MA/EMA
overlay + MACD + Estocástico Lento, timeframe 5m. Ao trocar de seção (sair de
"Gráfico" e voltar), às 15:42: **zero indicadores**, timeframe de volta pro
padrão 1H. Confirmou que o bug não era específico do MACD nem do botão
"Carregar" — era o estado inteiro do gráfico se perdendo ao navegar.

**Causa raiz**: `ChartView` é desmontado/remontado a cada troca de seção
(SPA). Na remontagem, o `useEffect` de init só restaurava o **setup
favorito** (`useFavoriteChartSetup`, ação manual "Salvar como favorita",
persistido no Supabase) — nunca um Template nomeado recém-carregado nem
qualquer indicador adicionado na sessão corrente. `timeframe` nascia sempre
do cache do setup favorito (`readCachedFavoriteChartSetup`), nunca do que
estava na tela segundos antes.

**Fix aplicado** (commit pendente): novo hook
[`useChartSessionState.ts`](src/app/hooks/useChartSessionState.ts) — cache em
`sessionStorage` (não `localStorage` nem Supabase, deliberadamente: sobrevive
a trocar de seção dentro da mesma aba, mas some sozinho ao fechar a
aba/navegador — exatamente o "persistir até fechar a plataforma" pedido pelo
Cleber, sem precisar de lógica de expiração manual).

- `ChartView.tsx`: `timeframe` inicial agora prioriza o cache de sessão sobre
  o do favorito; no `useEffect` de init, se existir estado de sessão salvo,
  ele é aplicado em vez do favorito (sessão vence por ser mais recente); novo
  `useEffect` de autosave (debounce 300ms) grava `captureCurrentChartConfig()`
  em `sessionStorage` a cada mudança de indicador/timeframe/grade/S-R.
- Named Templates e "setup favorito" continuam funcionando exatamente como
  antes (ações manuais, intocadas) — o novo cache é uma camada adicional,
  só para o caso de navegação dentro da mesma sessão de navegador.

**Verificação**: `npm run validate` (37/37) e `tsc` sem erro novo (mesma
contagem de 586 erros pré-existentes no `tsconfig.json` completo, não
relacionados — o gate real do projeto é `tsconfig.engine.json`, que passou
limpo). Servidor de dev sobe sem erro de build. **Não testado end-to-end no
navegador com login real** — exige a conta do Cleber, não haveria como
verificar sem digitar a senha dele. Pendente de confirmação visual dele:
aplicar o Template "couto", trocar de seção, voltar pro Gráfico, e checar se
MACD/Estocástico/timeframe continuam lá.

## Commits pendentes (Cleber rodar)

```bash
git add src/app/services/strategy/runTradingCycle.ts
git commit -m "fix: registra MACD real (linha vs sinal) no snapshot de indicadores, em vez de espelhar o lado da entrada"

git add src/app/hooks/useChartSessionState.ts src/app/components/ChartView.tsx
git commit -m "fix: gráfico perdia todos os indicadores e timeframe ao trocar de seção do app (novo cache de sessionStorage, sobrevive a navegar mas some ao fechar a aba)"

git push origin dev
```
