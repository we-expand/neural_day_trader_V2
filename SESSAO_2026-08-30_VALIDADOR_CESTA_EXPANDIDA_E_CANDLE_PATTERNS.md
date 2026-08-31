# Sessão 2026-08-30 (tarde/noite) — Monitoramento do Cérebro LLM Ativo, fix do validador semântico, cesta expandida e 10 padrões de candlestick

> Sessão de monitoramento contínuo (`/loop 5m`) do `llm-active-brain`, sessão
> Supabase `aa279c75-1acd-49aa-9fef-a76e8ddf0b2e` ($50 inicial). Autonomia
> total dada pelo Cleber ("carta branca para deixar esta LLM uma LLM
> rentável e vencedora"). Três mudanças de código reais aplicadas e
> restartadas ao vivo; nenhuma prometida como "edge comprovado" — ver seção
> final de honestidade estatística.

## Estado no início da sessão

Processo já rodando (sessão `aa279c75...`, iniciada 11:36 UTC do mesmo dia,
ver `SESSAO_2026-08-30_REDESENHO_CEREBRO_LLM_ATIVO.md` pro redesenho que a
criou). No primeiro check desta sessão: 18 trades fechados, 2 vitórias / 16
derrotas, **-$15,20** líquido — taxa de acerto de 11%.

## 1. Achado real: BTCUSD SHORT perdeu $5,58 por fato inventado no reasoning

Investigação pedida pelo Cleber sobre uma entrada específica que "perdeu
demais". Rastreado linha a linha no log (`llm-brain.log`), não suposição:

- Trade: BTCUSD SHORT, entrada $78.772 (15:58 UTC), saída $79.050,88 (16:24
  UTC, `AI_SIGNAL`), **-$5,58** (~11% do saldo de $50 numa única operação).
- O `get_mt5_quote("BTCUSD")` chamado NO MESMO CICLO, imediatamente antes do
  `open_position`, devolveu: `trend.label="LATERAL"`, `volume.elevated=false`,
  `macd.label="NEUTRO"`.
- O `reasoning` da entrada afirmou: *"trend currently LOW, volume elevated"*
  — **o oposto do dado que a IA tinha acabado de receber**. Não é
  interpretação ambígua de dado real (o "achado sem fix possível" já
  documentado no projeto) — é invenção direta de fato que contradiz a
  própria ferramenta chamada segundos antes.
- BTCUSD estava em tendência de ALTA persistente havia horas nos ciclos
  vizinhos (MACD histograma +28, volume elevado) — o SHORT foi contra a
  tendência real, justificado com dado fabricado.

**Causa raiz da lacuna**: o validador semântico existente
(`reasoningValidator.ts`, adicionado em sessão anterior) só verifica se o
reasoning se contradiz A SI MESMO (ex: "não deveria abrir" seguido de abrir
mesmo assim) — nunca comparava o texto contra o dado real da última
cotação.

### Fix aplicado

- **`src/tools.ts`**: novo `lastQuoteSnapshotBySymbol` — cache do último
  snapshot real (`trendLabel`, `volumeElevated`, `macdLabel`,
  `stochasticLabel`) por símbolo, atualizado a cada `get_mt5_quote`.
  Conectado em `open_position` e `close_position` como `realSnapshot`
  passado pro validador.
- **`src/reasoningValidator.ts`**: prompt do validador agora recebe o
  snapshot real e passa a reconhecer 2 formas de contradição — FORMA 1
  (autocontradição, já existia) e **FORMA 2 (fato inventado/invertido)**:
  quando o reasoning afirma tendência/volume/MACD/estocástico que
  contradiz diretamente o dado real da última cotação do mesmo ciclo.
- Type-check limpo (`npx tsc --noEmit`). Processo reiniciado (matou
  PID antigo, confirmou 1 só, subiu novo) — posição aberta na hora
  preservada no Supabase, sem perda.
- **Confirmado ao vivo, não só em teoria**: a primeira entrada real depois
  do restart (XETUSD SHORT, tese de exaustão em resistência com stochastic
  sobrecomprado, reasoning batendo com o dado real) passou pelo validador
  sem bloqueio — confirma que o fix não é falso-positivo agressivo.

## 2. "XETUSD explodiu e a LLM ganhou $0" — investigação e explicação

Cleber reportou indignado que o XETUSD subiu forte e a IA "ganhou $0".
Investigação mostrou que não era bem isso:

| Trade | Side | Resultado |
|---|---|---|
| LONG 15:53→16:14 | LONG | **+$13,41** (TP mecânico, capturou parte real da subida) |
| SHORT aberto 16:45 | SHORT | quase zero a zero na hora, depois oscilou |

A IA capturou uma fatia real do movimento (+$13,41), mas **virou vendida
bem no topo mais recente da mesma alta**, com reasoning que ela mesma
chamou de *"paradoxo"* (tendência de alta clara, mas operando SHORT por
tese de exaustão via stochastic). Isso não é bug de código — é o desenho
da estratégia: R:R fixo 1:2, sai no alvo sem deixar vencedor correr, e
ativamente busca mean-reversion quando não acha sinal de continuação
óbvio. Foram oferecidas 3 opções ao Cleber (fechar a posição, deixar
rodar, ou eu implementar trava contra abrir SHORT logo após um LONG
lucrativo no mesmo símbolo/direção) — **nenhuma decisão tomada ainda,
pendência real**.

## 3. Cesta expandida: SOLUSD, ADAUSD, LNKUSD, UNIUSD

A pedido do Cleber. Testados AO VIVO contra `/mt5-prices` antes de entrar
no código (disciplina do projeto — nunca fabricar símbolo):
- `SOLUSD`, `ADAUSD`, `LNKUSD`, `UNIUSD` — todos com bid/ask reais confirmados.
- `LINKUSD` (nome "completo") dá **404** — o nome certo na corretora é
  `LNKUSD`, confirmando o que o Cleber já sabia.

**Atenção documentada no próprio código e no prompt da IA**: SOLUSD tinha
sido removido mais cedo no mesmo dia por ter respondido sozinho por 57% do
prejuízo de uma sessão inteira (13 trades, 0 vitórias, stop batendo em
<1min repetidamente, causa nunca comprovada — suspeita de ATR de candle 5m
não capturar volatilidade de tick real desse símbolo/corretora). Reintroduzido
a pedido explícito, com aviso reforçado no prompt do sistema pra não receber
tratamento especial (nem pra mais nem pra menos rigor).

### Arquivos alterados
- `src/assetBasket.ts`: `MT5_ASSET_BASKET` (6→10 símbolos), `LOT_SIZE`,
  `CORRELATED_GROUPS`.
- `src/agent.ts`: prompt do sistema citava "6 ativos"/"estes 6 símbolos"
  hardcoded — atualizado pra 10, com aviso específico sobre SOLUSD.

Type-check limpo, restart confirmado (1 instância), novos símbolos
confirmados sendo consultados normalmente pela IA nos ciclos seguintes
(sem erro de "símbolo fora da cesta").

## 4. Perguntas do Cleber sobre metodologia (Price Action / candlestick)

Duas perguntas de entendimento, respondidas com investigação real do
código (não opinião):

1. **"A IA aplica Price Action pra decidir?"** — Sim, princípio 1c do
   prompt (`agent.ts`) é dedicado a suporte/resistência + regras de leitura
   (rompimento vs rejeição por confluência com tendência/volume). Mas é
   "apoio ao julgamento, não lei nem bloqueio de código" — a IA pode
   ignorar, e o caso do item 1 acima mostra que às vezes ela nem lê o dado
   real corretamente.
2. **"Ela entende padrões de candle (formato de vela)?"** — Não, na época.
   O sistema busca candle OHLC real (`/mt5-candles`) mas só usa isso pra
   calcular números agregados (tendência, S&R, MACD, estocástico) — a forma
   individual de cada vela (corpo/pavio) nunca era exposta à LLM. Zero
   reconhecimento de padrão de candlestick no código até este ponto.

## 5. Implementação: 10 padrões de candlestick clássicos

A pedido direto do Cleber ("implemente os 10 mais famosos"), e pedido
explícito de **atrelar isso à metodologia de Price Action já existente**
(não deixar como indicador isolado).

**Padrões implementados**: Doji, Martelo, Estrela Cadente, Engolfo de Alta,
Engolfo de Baixa, Harami de Alta, Harami de Baixa, Estrela da Manhã,
Estrela da Noite, Marubozu (Alta/Baixa).

### Implementação (`src/atr.ts`, nova função `getCandlePatterns`)
- Reaproveita `fetchRecentCandles` (mesmo candle OHLC real que MACD/
  Estocástico/S&R já usam) — candle sintético nunca, `null` quando não há
  dado suficiente.
- Detecção geométrica pura: razão corpo/pavio/range de cada vela, com
  contexto de tendência prévia (5 velas antes) pra Martelo/Estrela Cadente
  fazerem sentido clássico (só contam depois de BAIXA/ALTA respectivamente).
- Critérios deliberadamente conservadores — prefere falso negativo (não
  detectar) a falso positivo (inventar padrão que não está lá), mesma
  disciplina do resto do arquivo.
- Retorna `{ detected: string[], bias: "ALTA"|"BAIXA"|null, lookbackMinutes }`.

### Integração
- `src/tools.ts`: novo campo `candlePatterns` no retorno de `get_mt5_quote`
  (ambos os branches, mercado aberto e fechado).
- `src/agent.ts`: **novo princípio 1f no prompt**, inserido logo depois do
  Estocástico (1e) e explicitamente cruzado com o 1c (suporte/resistência)
  — instrução clara de que um padrão de candle sozinho nunca é gatilho
  ("um MARTELO no fundo de um SUPORTE com volume elevado é confluência
  forte; isolado é ruído"), mesmo espírito não-mecânico dos outros
  indicadores.

### Bug de sintaxe encontrado e corrigido no processo
Usei acidentalmente backtick (`` ` ``) dentro do template literal do prompt
em `agent.ts` (que já é uma string delimitada por backtick) — quebrou a
string e gerou erro de compilação (`TS1005`/`TS1443`). Pego imediatamente
pelo `npx tsc --noEmit`, corrigido trocando por aspas duplas simples antes
de qualquer restart.

### Validação
- `npx tsc --noEmit` limpo.
- Smoke-test isolado contra candle real (`node --import tsx/esm`) antes do
  restart — confirmou detecção real (DOJI em XETUSD no primeiro teste, não
  sempre vazio).
- Restart confirmado (1 instância), e **confirmado ao vivo em produção**
  nos ciclos seguintes: `ENGOLFO_ALTA`, `ESTRELA_CADENTE` e `MARUBOZU_ALTA`
  detectados de verdade em ativos diferentes, cada um com o bias correto.

## Estado ao final da sessão

- Sessão `aa279c75...`: 18 trades fechados, 2W/16L, **-$15,20** líquido
  (sem trade fechado novo desde o início desta sessão de monitoramento —
  só aberturas).
- **2 posições abertas**: XETUSD SHORT ($2.524,97) e BTCUSD LONG
  ($79.107,44).
- Processo único, saudável, sem erro/contradição não resolvida nos últimos
  checks.
- **Monitoramento automático (`/loop 5m`, job `d242a094`) foi desarmado a
  pedido do Cleber** — não está mais rodando. Religar com `/loop 5m
  <mesmo prompt>` se quiser retomar (prompt completo fica no histórico
  desta conversa).

## Pendências reais

1. **Decisão do Cleber sobre a posição XETUSD SHORT** (aberta contra uma
   tendência de alta, tese própria chamada de "paradoxo") — fechar agora,
   deixar rodar, ou implementar trava contra abrir SHORT logo após um LONG
   lucrativo no mesmo símbolo/direção sem confirmação forte. Nenhuma opção
   escolhida ainda.
2. **3 commits pendentes, nenhum aplicado**:
   ```bash
   cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader
   git add llm-active-brain/src/tools.ts llm-active-brain/src/reasoningValidator.ts
   git commit -m "fix(llm-active-brain): valida reasoning contra dado real da cotacao, nao so autocontradicao"

   git add llm-active-brain/src/assetBasket.ts llm-active-brain/src/agent.ts
   git commit -m "feat(llm-active-brain): adiciona SOLUSD, ADAUSD, LNKUSD, UNIUSD a cesta"
   ```
   (o commit dos padrões de candle usa os MESMOS arquivos `agent.ts`/
   `tools.ts` já tocados acima — cuidado ao fazer os 2 commits separados,
   pode ser mais simples revisar o diff inteiro e commitar junto; incluir
   também `llm-active-brain/src/atr.ts`.)
3. **SOLUSD reintroduzido sem a causa raiz do problema anterior
   investigada** — monitorar com atenção redobrada as próximas entradas
   nesse símbolo especificamente.
4. **Efeito dos 3 fixes desta sessão (validador semântico, cesta nova,
   candle patterns) ainda não tem amostra suficiente pra avaliar** — só
   algumas horas/poucos trades desde os restarts. Precisa de mais tempo
   rodando antes de qualquer conclusão sobre taxa de acerto.

## 6. "Plataforma travou" / "P&L Flutuante não funciona" — falso alarme + 1 bug real pego antes de causar dano

Cleber reportou (2 mensagens seguidas, tom de urgência) que o P&L
Flutuante não funcionava e que "a plataforma parece ter travado/congelado".
Investigação em duas frentes:

- **Backend (`llm-active-brain`)**: processo vivo (PID 80135), ciclo
  18/8000, log com 19s de idade no momento do check — nada travado.
- **Dashboard web** (`neural-day-trader-v2-git-dev-cleber-coutos-projects.
  vercel.app`, branch `dev`): aberto ao vivo via browser automatizado.
  **Achado importante de metodologia**: a primeira navegação disparou uma
  saraivada de erros 403/CORS no console — MAS isso era a sessão de
  browser do próprio agente, sem login real (sem cookies/JWT do Cleber),
  não um sinal de outage real. Reportado ao Cleber com essa ressalva ANTES
  de qualquer conclusão alarmista. Scroll até o painel do Cérebro LLM
  Ativo confirmou: "atualizado há 1s", conteúdo mudando entre duas
  capturas com 4s de intervalo (painel de Análise Neural e ticker de ações
  diferentes) — página reagindo normalmente, não travada.
- **P&L Flutuante em $0,00 era o valor CORRETO**, não bug: as duas
  posições que estavam abertas mais cedo (XETUSD SHORT, BTCUSD LONG)
  já tinham fechado (XETUSD fechou com **+$13,87**, mais um TP real desde
  o fix do validador semântico) — sem posição aberta, flutuante é
  legitimamente zero.

**Bug real encontrado no processo, e corrigido ANTES de causar dano** (nenhuma
posição chegou a abrir no símbolo afetado ainda): ao expandir a cesta pra
10 símbolos nesta mesma sessão (item 3 acima), esqueci de atualizar o mapa
de tradução de símbolo do `LlmActiveBrainPanel.tsx` — mesmo padrão de bug
já documentado no próprio arquivo pra BTCXBN/DOGUSD. O broker (Infinox) usa
o nome literal `LNKUSD`, mas o catálogo unificado do app (`assetDatabase.
ts`) usa `LINKUSD` — sem o alias, `fetchLivePrices` nunca resolveria preço
pra uma posição aberta em LNKUSD, travando aquela linha específica em "..."
pra sempre. `ADAUSD`/`SOLUSD`/`UNIUSD` já batem exatamente com o símbolo
unificado, não precisam de alias.

### Fix aplicado
- `src/app/components/dashboard/LlmActiveBrainPanel.tsx`:
  `LLM_SYMBOL_TO_UNIFIED['LNKUSD'] = 'LINKUSD'`.
- `npx tsc --noEmit -p tsconfig.engine.json` limpo. Este é um arquivo do
  app principal (frontend), não do `llm-active-brain` — não precisa de
  restart de processo, só do deploy normal via push (Vercel automático).

### Achado colateral, não investigado a fundo (fica pra próxima sessão se for retomar)
Painel mostra **P&L Realizado de -$8,27**, enquanto o cálculo direto contra
`ai_trades.net_pnl` no Supabase (mesma sessão) deu **-$15,20**. O painel
usa o campo `pnl` bruto (`ai_trades.pnl`), o cálculo anterior usou
`net_pnl` (que desconta `commission`). Divergência real, mas não
investigada — não fica claro ainda qual dos dois é o número "certo" pra
mostrar ao usuário, ou se ambos deveriam bater.

## Honestidade estatística (obrigatória por convenção do projeto)

Nenhuma das 3 mudanças desta sessão é uma promessa de edge. O validador
semântico evita um TIPO específico de erro (fato inventado contradizendo
dado real) — não impede erro de leitura/interpretação sutil, que é o
"achado sem fix possível" já documentado (a IA repetidamente lê indicador
real de forma errada). Os padrões de candlestick são mais um fator de
confluência no julgamento discricionário da IA, não uma regra mecânica —
literatura de price action nunca trata padrão de candle isolado como
sinal suficiente, e este sistema segue a mesma disciplina. A pesquisa
anterior do projeto (ver `CLAUDE.md`, seção "Cérebro de decisão da IA")
já não encontrou edge comprovado em sinal técnico clássico sobre preço
público — nada nesta sessão contradiz ou reabre essa conclusão.
