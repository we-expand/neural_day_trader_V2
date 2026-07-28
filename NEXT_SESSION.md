# Handoff — próxima sessão (escrito em 2026-07-28)

> Arquivo temporário de retomada rápida. Não é memória permanente do projeto —
> isso é o `CLAUDE.md` (carrega automático) e o `AI_BRAIN_SPEC.md` (fonte de
> verdade do motor de decisão). Este arquivo existe só pra você abrir uma
> janela nova e retomar sem reconstruir o raciocínio do zero. Pode apagar
> depois de ler/absorver.

## Onde a conversa chegou

Sessão inteira focada em **revisar a tela "IA Preditiva" (`LiquidityPrediction.tsx`)** — auditoria completa de mock vs. real, correção do timeframe da previsão, unificação do seletor de ativos, controle de voz, e três bugs reais achados no meio do caminho (preço zerado, voz que não desligava, botões duplicados). Ver detalhe por tópico abaixo.

### 1. Auditoria mock vs. real + reescrita da tela "IA Preditiva" (já commitado)

A tela inteira (`src/app/components/innovation/LiquidityPrediction.tsx`) foi auditada e reescrita:

- **Previsão "Próxima Xh"**: era 100% mock hardcoded (68% de confiança fixo, `+0.8%` fixo, sempre "1h" independente do timeframe selecionado). Reescrita pra usar o `MarketScoreEngine` real (mesmo motor do Dashboard) — título, classificação, confiança e níveis agora reagem de verdade ao timeframe escolhido (1m/5m/15m/1h/4h/1d — `'1w'` removido, o motor não suporta).
- **Suporte/Resistência**: era ±0,2% arbitrário sobre o preço. Agora é pivô real (swing high/low de 20 barras) calculado a partir de candles reais (`backtestDataService.fetchHistoricalData`).
- **Mapa de Liquidez**: era `Math.sin()+Math.random()` fabricado. Agora usa order book real da Binance (`GET /api/v3/depth`) para pares cripto resolvíveis; para o resto do catálogo (forex/índices via Infinox) mostra estado "indisponível" honesto — **isso é estrutural, não falta de fonte escolhida**: não existe order book público gratuito pra forex/CFD em nenhuma API de mercado (Alpha Vantage, EODHD, Tiingo etc. também não têm).
- **Feed Neural**: os ~17 templates de alerta fabricados (baleia, spoofing, iceberg, RSI fake) foram removidos. Ficaram só alertas reais: horário de mercado, contagem de candle, trade grande via `aggTrades` da Binance (cripto), pressão de book real via `describeMicrostructure` (agora exportada do `MarketScoreEngine.ts`).
- **Narração por voz** (`hourlyVoiceAnalysis.ts`): RSI e "probabilidade de alta" eram sorteados com `Math.random()` mesmo recebendo dado real de entrada. Corrigido pra vir do `MarketScoreResult` real; frase de probabilidade fabricada foi removida (não existe fonte real calibrada pra ela).
- **Seletor de ativos**: unificado no `InfinoxAssetsBrowser` (o mesmo modal que o Dashboard usa em produção) — ganhou um modo `multi` novo, reaproveitado também pelo `AssetUniverse.tsx` do AI Trader.

### 2. Bug achado e corrigido: narração sempre dizia "uma hora" (já commitado)

`hourlyVoiceAnalysis.ts` tinha o texto "Previsão em uma hora" hardcoded, ignorando o timeframe real selecionado no seletor. Corrigido — `HourlyAnalysisData` ganhou `timeframeLabel`, preenchido com `TIMEFRAME_LABELS[timeframe]` nos dois call-sites da narração.

### 3. Toggle de voz independente + mutex entre telas de voz (já commitado)

A pedido do Cleber: novo botão "Voz ON/OFF" no Feed Neural, separado do "AI ON/OFF" (que continua desligando o feed inteiro) — permite acompanhar só os logs sem narração. Criado `VoiceCoordinatorContext` (novo, `src/app/contexts/`) que arbitra mutex entre a voz da IA Preditiva e a da tela "AI Trader Voice" — ligar uma desliga a outra na hora. No caminho, achado e corrigido um **bug real**: o cleanup do loop de narração do `AITraderVoice.tsx` não fazia nada de fato (só um `console.log`) — trocar de tela com a voz ligada deixava o loop rodando "zumbi" em segundo plano, brigando com a voz da outra tela. Agora cancela `speechSynthesis`, aborta o loop e libera a voz de verdade no unmount.

### 4. Bug achado e corrigido: "Voz OFF" não parava a narração em andamento (já commitado)

Causa raiz: os loops de narração (`for + await speak(...)`) capturavam a função `speak()` da closure vigente no clique do botão — como `speak()` é recriada a cada mudança de `voiceEnabled`, o loop já em andamento continuava vendo o `voiceEnabled` **antigo**. Corrigido com `voiceEnabledRef` (sempre sincronizada via `useEffect`), checada a cada iteração dos dois loops pra cortar de verdade. Layout também corrigido: "Voz ON/OFF" estava espalhado pro extremo direito da tela por causa de um `justify-between` mal escopado — agora fica agrupado ao lado do "AI ON/OFF".

### 5. Bug achado e corrigido + consolidação de botões — **AINDA NÃO COMMITADO**

- **Preço zerado**: `realPrices[selectedAsset]` usava chave errada (`'BTC'` sem sufixo vs. `selectedAsset` guardando o ticker completo `'BTCUSDT'`) — nunca batia, caía sempre em `$0`, que ia parar tanto no card "Preço Atual" quanto na narração ("Preço atual: 0 dólares"). Trocado por `livePrice`, derivado do fechamento real do último candle já buscado pro pivô (cobre qualquer ativo do catálogo, não só os 10 pares cripto do `realPrices` antigo, que foi removido — tinha ficado órfão).
- **3 botões duplicados → 1**: "Escaneamento Profundo" não tinha `onClick` nenhum (não fazia nada) e "Análise Completa por Voz" duplicava exatamente a lógica de "Análise | Próxima Xh". Os dois foram removidos — o único botão "Análise | Próxima Xh" já é profundo (Market Score Engine + pivô real) e já narra por voz por padrão, não mais 3 ações separadas.
- **Retry/backoff no 504 da MetaAPI**: `BacktestDataService.fetchFromMetaApiHistory` agora tenta até 2 vezes a mais (800ms, depois 2s) quando a resposta é 504/502/503/429 — ataca a causa raiz documentada no `CLAUDE.md` (conta MetaAPI compartilhada sob carga), em vez de aceitar "indisponível" na primeira falha transitória. Se todas as tentativas falharem, o erro real ainda propaga — nunca fabrica candle.
- Decisão tomada nesta sessão: **não** integrar Alpha Vantage/EODHD/Tiingo como fallback — cota diária grátis (≈25 req/dia) é baixa demais pro volume real do app, e nenhuma delas resolve o gap de order book de forex/índices de qualquer forma (isso é estrutural).

## Verificação feita

- `npm run validate` (28/28) depois de cada mudança que tocou o motor.
- `npx tsc --noEmit` — 689 erros no total durante toda a sessão (baseline pré-existente, mesmo número antes/depois de cada mudança — **zero erro novo introduzido**, confirmado repetidamente com `git stash`).
- `npm run build` — sempre limpo, sem aviso de chunk circular.
- Verificação visual real no browser (login mock via `sessionStorage`, não credencial real) pra cada mudança: timeframe atualizando a previsão ao vivo, seletor de ativos unificado abrindo o modal certo, voz cortando de verdade no meio da narração (capturado via mock de `speechSynthesis`, array de mensagens faladas parou exatamente no ponto do clique), preço real aparecendo (`$63.748,47` em vez de `$0`), botão único substituindo os 3 antigos.
- **Não testado**: nenhuma ação irreversível/financeira.

## Próximo trabalho concreto sugerido

1. **Commitar e dar push no que está pendente** (item 5 acima — preço, consolidação de botões, retry MetaAPI). Comandos prontos abaixo.
2. Confirmar em produção (pós-deploy) que o preço real aparece corretamente pra ativos forex/índices também (só testei BTCUSDT localmente — o `livePrice` deveria funcionar pra qualquer ativo do catálogo via `backtestDataService`, mas vale conferir visualmente pelo menos 1 ativo não-cripto).
3. Considerar migrar `AssetSelector.tsx`/`AssetSpecsSelector.tsx` (usados na view "Pirâmide") pro mesmo padrão `InfinoxAssetsBrowser` — ficou fora de escopo desta sessão de propósito (evitar aumentar a superfície de regressão numa área não relacionada ao pedido original).
4. Pendência antiga, ainda não retomada: decisão sobre estágio 3 da ponte decisão→execução real (`CLAUDE.md`, seção "Pendências reais em aberto", item 2).
5. `npm run validate` obrigatório antes de qualquer commit que toque o motor.

## Arquivos-chave pra retomar

- [`src/app/components/innovation/LiquidityPrediction.tsx`](src/app/components/innovation/LiquidityPrediction.tsx) — a tela inteira, reescrita nesta sessão. Maior arquivo tocado.
- [`src/app/utils/hourlyVoiceAnalysis.ts`](src/app/utils/hourlyVoiceAnalysis.ts) — narração por voz, RSI/timeframe reais.
- [`src/app/contexts/VoiceCoordinatorContext.tsx`](src/app/contexts/VoiceCoordinatorContext.tsx) — novo, mutex entre telas de voz.
- [`src/app/components/modules/AITraderVoice.tsx`](src/app/components/modules/AITraderVoice.tsx) — fix do cleanup zumbi + integração com o coordenador.
- [`src/app/components/dashboard/InfinoxAssetsBrowser.tsx`](src/app/components/dashboard/InfinoxAssetsBrowser.tsx) — ganhou modo `multi`.
- [`src/app/services/BacktestDataService.ts`](src/app/services/BacktestDataService.ts) — retry/backoff no fetch da MetaAPI (pendente de commit).
- [`src/app/services/MarketScoreEngine.ts`](src/app/services/MarketScoreEngine.ts) — `describeMicrostructure` exportada.

## Regras fixas do projeto (não esquecer ao retomar)

- Claude nunca faz `git commit`/`git push` sozinho — sempre entregar comando pronto pro Cleber rodar (Cleber pediu explicitamente que **o comando de push venha sempre junto** com o de commit a partir desta sessão).
- `npm run validate` obrigatório antes de qualquer commit que toque o motor.
- Nunca fabricar dado — sempre erro/estado "indisponível" explícito quando não há fonte real.
- Comunicação sempre em português, rigor de especialista sênior — nunca inflar resultado, sempre reportar achado negativo por completo.
- Ações irreversíveis/financeiras nunca são executadas por Claude sozinho, mesmo em teste.

## Estado do git

**Pendente de commit** (working tree neste momento):

```
M src/app/components/innovation/LiquidityPrediction.tsx
M src/app/services/BacktestDataService.ts
```

Comandos prontos pra rodar:

```bash
git add src/app/components/innovation/LiquidityPrediction.tsx src/app/services/BacktestDataService.ts
```

```bash
git commit -m "fix: preco zerado na IA Preditiva, consolida botoes de analise, retry no 504 da MetaAPI

- LiquidityPrediction: realPrices[selectedAsset] usava chave errada (base
  cripto sem sufixo vs ticker completo do catalogo Infinox) -- sempre caia
  em 0, aparecia no card Preco Atual e na narracao por voz. Trocado por
  livePrice, derivado do candle real ja buscado pro pivo (cobre qualquer
  ativo, nao so os 10 pares cripto do realPrices antigo, removido por
  ficar orfao).
- LiquidityPrediction: Escaneamento Profundo (sem onClick, nao fazia nada)
  e Analise Completa por Voz (duplicava a logica de Analise | Proxima Xh)
  removidos -- um unico botao, ja profundo e ja narrado por voz por
  padrao, nao mais 3 acoes separadas pra mesma analise.
- BacktestDataService: retry com backoff (2 tentativas, 800ms/2s) em
  fetchFromMetaApiHistory pra 504/502/503/429 -- ataca a causa raiz
  documentada (conta MetaAPI compartilhada sob carga) em vez de mascarar
  com falha imediata; erro real ainda propaga se todas as tentativas
  falharem, nunca fabrica candle."
```

```bash
git push origin main
```

Últimos commits já feitos, mais recente primeiro:

```
15ae00db3 fix: Voz OFF nao parava narracao em andamento + reposiciona botao ao lado do AI ON
75ff47cb8 Reescreve seção de sentimento de mercado com dados reais do crawler RSS
d66d6b835 feat: toggle de voz independente no Feed Neural + mutex entre vozes do app
106e6b331 fix: narracao de voz da IA Preditiva ficava presa em 'uma hora' fixo
5defd71f7 Atualiza preços em reais e dados do rodapé (endereço/contato)
d9cdec709 fix: remove dado fabricado (Math.random) de voz, liquidez e feed neural
```

(Commit `75ff47cb8` e `5defd71f7` foram feitos por fora desta conversa — provavelmente pelo Cleber direto ou outra ferramenta — não fazem parte do trabalho documentado acima, citados só pra contexto do log.)
