# Sessão 2026-09-02 — Trailing apertado demais, saldo do Dashboard travado em $100, e alvo capado por suporte/resistência real

## Contexto / motivação

Cleber reportou que a sessão do Cérebro LLM Ativo (LLM Brain, motor único
da plataforma) rodando desde 2026-09-01 não estava "acabando com o
patrimônio", mas também não evoluía: "o que ganha acaba perdendo, não
observa MACD/Estocástico, captura pouco dinheiro por operação". Pediu mais
assertividade e mais captura por trade (referência: o que BTCUSD 0,01
lote costuma render).

## Achado 1 — MACD/Estocástico já são reais, o problema era outro (mecânica de saída)

Confirmado no código (`atr.ts`/`tools.ts`) que MACD e Estocástico Lento
reais já são calculados desde 2026-08-30 em cima do candle oficial e
entregues no `get_mt5_quote` todo ciclo — não é falta de dado.

Consultei a sessão real (`ai_sessions.id = 1d73c50a-cc28-4ab2-a939-a59361a22fda`,
iniciada 2026-09-01 19:42 UTC) via SQL direto no Supabase: 15 trades
fechados, líquido **+$11,99**, 12/15 "ganhos" (80% de acerto aparente) —
mas **só 1 de 15 bateu o alvo real (take-profit)**, os outros 11 "SL" com
lucro pequeno ($0,15-$2,54) eram o **trailing stop protegendo lucro cedo
demais**, não o alvo (4x ATR) sendo alcançado. As 3 perdas (fechamentos
manuais `AI_SIGNAL`) eram maiores que a maioria dos ganhos.

Causa mecânica: `MT5_BREAKEVEN_TRIGGER_R=0.25` (herdado de 2026-08-31) +
`mt5TrailAtrMultiplier` default de 0.8x ATR — muito mais apertado que o
stop de abertura (2x ATR) e o alvo (4x ATR), tirando a posição da mesa no
primeiro solavanco a favor.

**Fix aplicado** (`.env` do `llm-active-brain`, gitignored, nunca commitado
por conter secret): `MT5_BREAKEVEN_TRIGGER_R` 0.25→0.5 (volta ao default do
código) e `MT5_TRAIL_ATR_MULTIPLIER` 0.8→1.6 (novo override). Processo
reiniciado via watchdog (mata o PID certo, sobe de novo, sessão e posição
aberta preservadas — estado vive no Supabase). Sem validação estatística
de melhora no líquido — é correção de mecânica, precisa de amostra nova
(dias, não horas).

## Achado 2 — Dashboard mostrando $100 fixo não era reset, é bug estrutural de exibição

Cleber notou o saldo exibido no Dashboard voltando pra exatamente $100 e
suspeitou de restart/reset. Investigado: **não foi reset nenhum**.

`useApexLogic.ts` (linha ~1322) lê o saldo de `ai_portfolio_snapshots`
(`getEquityCurve`/`getSessionSnapshots`) e, se vier vazio, **pula a
atualização** (`if (snapshots.length===0) return`) — o Dashboard fica preso
no valor inicial hardcoded (`balance: 100`, linha ~307/312 de
`useApexLogic.ts`). Confirmado no Supabase: `ai_portfolio_snapshots` para
esta sessão está **vazia**, zero linhas.

Causa raiz: `saveSnapshot` (`AITradingPersistenceService.ts`) só é chamado
do lado do **navegador** (dentro de `useApexLogic.ts`) — o motor
(`llm-active-brain`, processo Node headless rodando no terminal/servidor)
**nunca grava snapshot nenhum**. Como essa sessão do LLM Brain roda 100%
sem aba do navegador aberta o tempo todo, nunca gerou nenhuma linha em
`ai_portfolio_snapshots`, e o Dashboard nunca soube do saldo real (~$100 +
$11,99 líquido + flutuante da posição aberta ≈ $112 no momento da
checagem).

**NÃO CORRIGIDO — pendência real.** Precisa que o motor
(`neuralBridge.ts`) passe a gravar em `ai_portfolio_snapshots` ele mesmo
(ou que o Dashboard calcule o saldo direto de `ai_trades`/`ai_sessions`
como fallback quando não há snapshot do cliente), já que ele roda
headless. Cleber avisado, decisão de quando implementar fica em aberto.

## Achado 3 — Alvo por ATR era cego à estrutura real do preço (achado mais importante da sessão)

Cleber observou (corretamente, contra minha sugestão inicial de só
afrouxar o trailing) que a posição EURUSD aberta na sessão dificilmente
alcançaria o alvo. Conferido ao vivo: entrada 1,15957, alvo (TP)
1,168267 → **0,71% de distância**, mercado classificado como **LATERAL**,
e a **resistência real mais próxima estava a só 0,08% de distância** —
o alvo pedia pro preço romper a resistência e continuar ~9x essa distância
sem reagir a nenhum nível. Bate com o achado 1 (0 de 15 trades batendo TP,
exceto 1).

Causa: o cálculo do alvo (`entry ± mt5TakeProfitAtrMultiplier × ATR`, em
`tools.ts`/`config.ts`) nunca olhava pro suporte/resistência real — só
multiplicava a volatilidade (ATR), cego a onde o preço historicamente
reage.

**Fix implementado e aplicado (commitado, `llm-active-brain/src/tools.ts` +
`config.ts`)**: `open_position` agora busca `getSupportResistance` (mesmo
candle oficial que MACD/Estocástico já usam) na direção do trade, pra
TODOS os ativos da cesta — não só EURUSD:
- Se o nível real (resistência pra LONG, suporte pra SHORT) estiver mais
  perto do que o alvo por ATR pediria, o alvo é **encolhido** pra mirar
  logo antes do nível (`mt5SrTargetMarginPct = 0.9`, novo em `config.ts`) —
  nunca pede pro preço romper um nível sem necessidade.
- Se mesmo esse espaço reduzido não render um R:R mínimo de 1:1 acima do
  stop (`mt5MinRrAfterSrCap = 1.0`, novo em `config.ts`), a entrada é
  **recusada** — nunca abre com risco/retorno já ruim de partida só porque
  o ATR "mandou entrar".
- Sem candle real suficiente pro cálculo de S/R, mantém o comportamento
  antigo (ATR puro) — nunca fabrica nível.

`tsc --noEmit` limpo (mesma contagem de erros pré-existentes, nenhum novo).
Processo reiniciado, sessão/posição preservadas. Commit já feito por
Cleber (`llm-active-brain/src/config.ts` + `tools.ts`).

**Distinção importante que ficou registrada pro Cleber**: alvo (R:R) e
tamanho de posição (contratos/risco%) são alavancas DIFERENTES — aumentar
o tamanho da posição multiplica proporcionalmente qualquer resultado ($
maior tanto no ganho quanto na perda), mas não muda a chance de o preço
chegar no alvo. Se a intenção for capturar mais $ por trade (pedido
original da sessão, "tem que ganhar o que ganha o BTCUSD com 0,01
contrato"), esse é o próximo passo natural, separado do fix de alvo
realista feito aqui.

## Pendências reais em aberto

1. **Dashboard não reflete saldo real de sessões headless do LLM Brain**
   (Achado 2 acima) — não corrigido, motor precisa gravar snapshot próprio
   ou Dashboard precisa de fallback calculando direto de `ai_trades`.
2. **Nenhuma validação estatística ainda** dos 3 ajustes desta sessão
   (trailing/breakeven mais soltos, alvo capado por S/R) — todos são
   correção de mecânica, não alegação de edge. Precisa de amostra nova
   (dias) rodando com os fixes antes de julgar efeito no líquido.
3. **Aumento de captura por trade via tamanho de posição** (contratos/
   risco%), não via alvo — discutido mas não implementado, decisão de
   número (risco% por trade) fica pro Cleber.
4. `llm-active-brain/Modelfile.deepseek-r1-trading` apareceu como arquivo
   não versionado durante a sessão — não fui eu quem criou, propósito não
   investigado, deixado de fora de qualquer commit até Cleber confirmar o
   que é.
