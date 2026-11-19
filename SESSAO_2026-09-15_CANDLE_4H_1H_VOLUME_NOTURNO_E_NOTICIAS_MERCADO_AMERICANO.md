# Sessão 2026-09-15 — Candle 4H/1H quebrado, gate de volume noturno e notícias de mercado americano

## 1. Formação de candle quebrada no 4H (e depois confirmado também no 1H)

**Relato do Cleber**: candle do BTCUSD no timeframe 4H aparecendo com OHLC
impossível (print mostrando `Low 78,658.00` MAIOR que `High 78,250.46`, e
`Close 77,676.99` abaixo do próprio Low). Depois confirmado que o mesmo
problema acontecia no 1H.

**Causa raiz real** (`src/app/components/ChartView.tsx`, useEffect de
streaming de preço, ~linha 6865): o efeito que funde cada tick de preço
real no último candle (decide "candle virou" comparando
`Date.now() - lastCandle.timestamp >= intervalMs`, onde
`intervalMs = TIMEFRAME_INTERVALS_MS[timeframe]`) só tinha `selectedSymbol`
nas dependências do `useEffect` — **não** reiniciava ao trocar de
timeframe. Trocar de timeframe sem trocar de ativo (ex: 5m → 4H, 5m → 1H)
mantinha vivo o closure antigo com o `intervalMs` do timeframe anterior:
o motor continuava "virando candle" no intervalo curto de antes (ex: a
cada 5min), empurrando candles espúrios (`open=high=low=close=preço do
momento`, timestamp avançando só o intervalo velho, não o novo) pra
dentro da série real do timeframe maior — gerando exatamente o tipo de
OHLC impossível visto no print.

**Fix**: adicionado `timeframe` ao array de dependências do efeito, que
agora reinicia com o `intervalMs` correto sempre que o timeframe muda
(não é bug específico de 4H — acontece em qualquer troca sem troca de
símbolo).

`tsc --noEmit`: 417 erros antes e depois (confirmado via `git stash` +
recontagem), nenhum novo. **Não testado ao vivo** (dev local exige
login) — pendente confirmação visual do Cleber.

## 2. Gate de volume elevado reduzido em 60% das 17h às 23h Brasília (vitalício)

**Pedido do Cleber**: todo dia, das 17h às 23h Brasília (correção de
horário no meio da conversa — pediu 17h-21h, depois corrigiu pra
17h-23h), o gate de "volume elevado" do LLM Brain deveria ficar mais
permissivo, porque a participação real cai nesse horário e o motor
ficava impedido de confirmar entradas contra a tendência.

**Implementação**:
- `llm-active-brain/src/config.ts`: novo campo
  `mt5VolumeElevatedRatioEvening` (env `MT5_VOLUME_ELEVATED_RATIO_EVENING`,
  default **0.63**).
- `llm-active-brain/src/atr.ts`: nova função `isVolumeEveningWindow()`
  (mesmo padrão de horário fixo Brasília UTC-3 já usado em
  `isWeekendNow`/`getNySessionPhase`), usada em `getVolumeConfirmation`
  pra escolher entre `VOLUME_ELEVATED_RATIO` (1.05, normal) e
  `config.mt5VolumeElevatedRatioEvening` (0.63, janela noturna).

**Calibração real, não achismo**: antes de decidir o valor final,
consultei o Supabase (`ai_brain_activity_log`, 113 leituras reais de
`get_mt5_quote` entre 17h e 20h28 Brasília do próprio dia) — média real
de participação (`volume.ratio`) foi **0.549**, variando 0.22 a 1.15.
Com o threshold antigo (1.05), só 1/113 leituras (0.9%) passava. Pedido
inicial do Cleber foi "baixar um pouco", cheguei em 0.85 → ele pediu
"baixe em 50%" (0.525, testado contra o dado real: 56/113 = 49.5%
passariam) → decisão final "deixe em 60%" → **0.63** (threshold acima
da própria média real do dia, mais conservador que 0.525).

**Confirmado explicitamente pelo Cleber: é regra VITALÍCIA, não é
teste temporário.** Registrado em memória
(`project_volume_evening_gate_vitalicio.md`) pra nenhuma sessão futura
tratar isso como pendente de reavaliação sem pedido explícito.

`tsc --noEmit` limpo, `npm run validate` 37/37.

## 3. Notícia do LLM Brain trocada de mercado brasileiro pra americano/global

**Relato do Cleber**: viu a IA "fazendo leitura de notícia de Bovespa" —
mercado regional, irrelevante pra uma IA que opera mercados mundiais
(S&P500, Bitcoin, forex, índices americanos).

**Causa raiz real**: `llm-active-brain/src/news.ts` chamava
`/news/aggregate?lang=pt` — no backend (`supabase/functions/server/
index.ts`), `lang=pt` seleciona `NEWS_FEEDS_PT` (br.investing.com +
Money Times), que é pauta brasileira de verdade (STF, Ibovespa, política
nacional) — confirmado no próprio log de atividade do motor
(`"Sem voto de Dino... STF"`, `"Allos (ALOS3) aprova R$ 438 milhões..."`).

**Fix**: trocado pra `lang=en`, que seleciona `NEWS_FEEDS_EN`
(Investing.com internacional, Cointelegraph global, CNBC) — 3 categorias
já existentes (`crypto`/`forex`/`macro`) cobrem Bitcoin/cripto em geral,
forex e macro americano (S&P500, Fed, juros) sem nada de Bovespa.

**Achado de carona**: o NEXUS (assistente de voz do usuário,
`NexusVoiceAssistant.tsx`) chamava o mesmo endpoint **sem nenhum `lang`**
— caía no default `pt` do servidor, ignorando a localização real do
usuário. O `NewsFeed.tsx` do Dashboard já fazia certo (usa
`navigator.language`) — replicado o mesmo padrão no NEXUS.

**Distinção de escopo, confirmada com o Cleber**: a notícia que a IA usa
pra CONTEXTO DE DECISÃO deve ser sempre mercado americano/global
(`lang=en`, fixo, não depende de quem está vendo); a notícia mostrada
PRO USUÁRIO no Dashboard/NEXUS deve seguir a localização dele
(`navigator.language`) — são coisas diferentes, ambas corrigidas.

`tsc --noEmit` limpo nos 2 arquivos, sem erro novo.

## Commits e restart

Commit `dd218b2da` (já rodado pelo Cleber) engloba os 3 itens acima +
os 2 commits anteriores da sessão (`9f8b95638`/`b54779414`, versões
intermediárias do gate de volume antes do valor final de 60%).

Motor reiniciado 2x nesta sessão (confirmado processo único a cada
vez): primeiro pro gate de volume 60%, depois pro fix de notícia
`lang=en`. PID final confirmado: `99393`.

## Pendente

- Confirmação visual do fix de candle 4H/1H (dev local exige login,
  não testado ao vivo nesta sessão).
- Observar ao vivo (log/Supabase) se o gate de volume 0.63 está de
  fato liberando mais confirmações de entrada contra-tendência sem
  degradar qualidade — sem validação estatística ainda, é o valor que
  o Cleber pediu explicitamente.
- Confirmar que a notícia lida pelo motor (`ai_brain_activity_log`,
  tipo `news`) parou de trazer manchete brasileira depois do restart
  (cache de 3h — só o próximo ciclo de notícia, não o próximo ciclo de
  trading, vai buscar de novo com `lang=en`).
