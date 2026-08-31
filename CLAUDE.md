# Neural Day Trader — Estado do Projeto

> **Este arquivo foi reescrito em 2026-07-24, aparado em 2026-08-04 e
> aparado de novo em 2026-08-25** pra ficar enxuto. O histórico completo de
> sessões (dezenas de investigações, bugs corrigidos, decisões antigas,
> incluindo os handoffs completos de itens já resolvidos entre 07-24 e
> 08-24) está preservado em [CLAUDE_HISTORY.md](CLAUDE_HISTORY.md) — não é
> carregado automaticamente, consulte só se precisar do detalhe de algo
> específico do passado. Este arquivo carrega em toda sessão nova:
> **mantenha enxuto**. Regra de manutenção: quando um item de "pendente"
> for resolvido, resuma pra 1-2 linhas (link pro histórico ou pro .md de
> sessão se precisar do detalhe) — nunca deixe handoff completo de sessão
> se acumular aqui de novo (aconteceu duas vezes já, 07-24→08-04 e
> 08-04→08-25).

## ▶ COMECE AQUI

**[RESOLVIDO 2026-08-31, fim do dia] Setup do AI Trader — Capital da IA,
Ativos Simultâneos e Cadência de Entrada (novo) reconectados ao LLM
Brain.** Cleber reportou que boa parte do Setup "AVANÇADO" não era
obedecida pela IA. `direction`/`activeAssets`/`dailyLossLimit`/
`riskPerTrade` já eram lidos de verdade; `allocatedCapital` (Capital da
IA) e `maxAssets` (Ativos Simultâneos) eram salvos mas nunca consumidos
pelo motor — corrigido (`tools.ts`: sizing usa capital alocado como teto,
`open_position` bloqueia símbolo novo acima do teto de simultâneos).
Campo novo **Cadência de Entrada** (CONSERVADORA/NORMAL/AGRESSIVA)
adicionado — como o loop de ciclos é global (multi-tenant, serial), ela
não pausa o processo: restringe só a avaliação de ENTRADA NOVA a 1 a cada
N ciclos (1/2/4), nunca o monitoramento de stop/breakeven/trailing de
posições já abertas (roda todo ciclo, sempre). `npm run validate` 37/37,
`tsc --noEmit` limpo nos dois lados. **Achado de processo, não de
código**: as mudanças em `llm-active-brain/` acabaram commitadas/pushadas
sem revisão por causa de outra sessão do Claude Code rodando em paralelo
na mesma pasta (commit `64397d751`, mensagem sobre outro fix) — evitar
sessões paralelas no mesmo working directory. **Pendente**: reiniciar o
processo `llm-active-brain` pra aplicar; commit do frontend (`AITrader.tsx`
etc.) ainda não feito, comando pronto no handoff. Detalhe completo:
[SESSAO_2026-08-31_SETUP_IA_CAPITAL_ATIVOS_CADENCIA.md](SESSAO_2026-08-31_SETUP_IA_CAPITAL_ATIVOS_CADENCIA.md).

**[RESOLVIDO 2026-08-31, fim do dia] Linha de posição piscando no gráfico +
gatilho de breakeven do LLM Brain nunca disparava — 2 achados, commitados
(`3a0d9efd9`).** Cleber reportou linhas de entrada/stop/alvo "piscando" no
gráfico e stop não acompanhando o preço a favor (posições do Cérebro LLM
Ativo em modo DEMO). Achado 1 (bug real): a reconciliação de overlays em
`ChartView.tsx` (fix de 2026-08-28/29 que eliminou o piscar de posição
aberta) usava uma regex que não reconhecia o prefixo `pending_` das ordens
pendentes — toda linha de ordem pendente era removida+recriada a cada tick
de P&L (~1s), causando o piscar; corrigido (ids `pending_*` ignorados na
checagem + bloco de criação tornado idempotente). Achado 2 (não é bug, é
threshold): o breakeven+trailing do Cérebro LLM Ativo (`neuralBridge.ts`)
roda de verdade a cada ciclo, mas nunca disparou em nenhum trade do log
(`llm-brain.log`, zero ocorrências de "Stops trilhados"/"movidos para
breakeven") — gatilho de 0,5R exigia mais lucro flutuante do que a
excursão favorável mediana histórica (~$0,55) costuma entregar antes do
trade reverter/bater stop/alvo. Baixado pra 0,25R via
`llm-active-brain/.env` (`MT5_BREAKEVEN_TRIGGER_R`), a pedido do Cleber —
sem validação estatística de melhora no líquido, é correção de mecânica de
proteção. **Pendente**: observar próximos trades pra confirmar que o
mecanismo passa a disparar de verdade com o threshold novo. Handoff
completo:
[SESSAO_2026-08-31_PISCAR_LINHA_E_BREAKEVEN_LLM_BRAIN.md](SESSAO_2026-08-31_PISCAR_LINHA_E_BREAKEVEN_LLM_BRAIN.md).

**[RESOLVIDO 2026-08-31] Preço/variação de BTCUSD "errados" contra a
Binance — 3 causas reais corrigidas, depois confirmado OK.** Cleber
reportou repetidamente preço/% de BTCUSD divergindo da Binance (chegou a
inverter sinal). Achados reais, em ordem: (1) referência de 24h em
`/mt5-prices` usava vela de 1h, depois 5min, depois **1min ancorada no
alvo** — reduz ruído de janela discreta; (2) causa raiz maior: BTCUSD
sempre cotou pelo TICK do broker (Infinox/MetaAPI), nunca pela Binance —
venues diferentes nunca são idênticos por definição; resolvido roteando
BTCUSD **direto pra API pública da Binance** em `/mt5-prices`
(`BINANCE_DIRECT_SYMBOL_MAP`), sem CORS (chamada servidor-servidor) —
resolve a decisão de produto "roteamento de cripto" que estava pendente há
dias, só pro BTCUSD; (3) polling do Gráfico pra BTCUSD reduzido de 2s pra
1,5s (sem risco, não bate mais na conta MetaAPI compartilhada). Efeito
colateral avisado: `/mt5-prices` é a mesma rota que o LLM Brain usa pra
cotar BTCUSD — motor passa a decidir/calcular P&L de BTCUSD contra Binance,
não broker (dado real, não fabricado). **Fechamento real**: depois do
deploy, Cleber ainda via diferença — investigado com print lado a lado e
achado que ele comparava com o par **BTC/BRL** da Binance (variação própria,
embute câmbio USD/BRL, nunca bate com BTCUSD por definição), não BTC/USDT —
confirmado que bate exatamente contra o par certo. Não é bug, resolvido.
De carona, confirmado que `streaming-relay/` está DESLIGADO desde
2026-07-23 (não tentar `fly deploy`, não existe app no Fly.io). Commits:
`a885bc82f`, `34cae231c`, `b0ef7f2e8` (já commitados e deployados). Handoff
completo:
[SESSAO_2026-08-31_VARIACAO_PCT_CRIPTO_24H.md](SESSAO_2026-08-31_VARIACAO_PCT_CRIPTO_24H.md).

**[RESOLVIDO 2026-08-31, fim do dia] Cérebro LLM Ativo é agora o motor único
da plataforma, execução real (não só rótulo) — motor mecânico DESLIGADO
DEFINITIVAMENTE.** Cron `ai-runner-tick` desativado no Supabase (decisão
explícita e definitiva do Cleber). Sessões do LLM Brain agora nascem
`status=RUNNING` (era `PAUSED`, hack só necessário enquanto o motor
mecânico ainda rodava) — toda a UI existente (Dashboard/AI Trader/Gráfico/
Header) passou a exibir o motor novo automaticamente via
`getActiveSession()`, sem componente novo. Achado crítico corrigido: bug
real em `restart.sh` causava múltiplos processos do LLM Brain em paralelo
(PID errado sobrescrevia o lock). Setup do AI Trader reconectado de
verdade (risco/trade, direção, cesta de ativos, limite de perda diária) —
~18 campos sem equivalente no motor novo removidos da UX (decisão
explícita do Cleber). Valor único de capital da plataforma: $100 (sessão
de teste de $50 encerrada). ATR Trailing Stop do motor mecânico deletado
(LLM Brain já tem o próprio). **Pendente**: commit (comando pronto),
qualidade do modelo LLM (texto corrompido observado ao vivo, não é bug de
código). Handoff completo:
[SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_UNICO.md](SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_UNICO.md),
próximos passos em [NEXT_SESSION.md](NEXT_SESSION.md). Levantamento
original (Fase 1, contrato do motor mecânico, inventário de guardrails):
[SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_PRINCIPAL.md](SESSAO_2026-08-31_RELIGAMENTO_LLM_BRAIN_MOTOR_PRINCIPAL.md).

**2026-08-30 (noite, ~19h-01h UTC): monitoramento contínuo de 5 em 5 min do
Cérebro LLM Ativo (sessão `aa279c75...`, ~66 checagens) — 1 bug real
corrigido NO CÓDIGO, NÃO COMMITADO, NÃO APLICADO (processo não foi
reiniciado).** Teto de exposição do grupo correlacionado (`$2.700`) estava
furável por uma única entrada grande: a checagem só somava o que já estava
aberto, nunca a entrada sendo aberta — confirmado ao vivo (SOLUSD SHORT
"forte" levou exposição real a $3.012, 12% acima do teto, antes de qualquer
bloqueio). Fix em `llm-active-brain/src/tools.ts` (segunda checagem após
calcular `amountUsd` real da nova entrada), `tsc --noEmit` limpo. Sessão
fechou com 32 trades, 6 vitórias (18,75%), -$56,46 líquido — amostra
pequena, sem validade estatística. **Pendências reais**: (1) restart pra
aplicar este fix + o fix de retry de conexão da sessão anterior (comando
pronto no handoff); (2) commit do diff em `tools.ts`. Handoff completo,
incluindo catálogo de achados de qualidade do modelo (validador em
fail-open recorrente, "decisão narrada sem executar", tamanho "forte" em
apostas de convicção fraca) e defesas confirmadas funcionando (trava de
≥50% do caminho, cotação fresca, teto de 1 posição/símbolo, trailing
stop):
[SESSAO_2026-08-30_MONITORAMENTO_NOTURNO_TETO_GRUPO_E_ACHADOS.md](SESSAO_2026-08-30_MONITORAMENTO_NOTURNO_TETO_GRUPO_E_ACHADOS.md).

**2026-08-30 (fim de tarde): monitoramento contínuo de 5 em 5 min do
Cérebro LLM Ativo (sessão `aa279c75...`) — 3 bugs reais corrigidos,
COMMITADOS E JÁ APLICADOS AO VIVO (processo reiniciado).** Achados via log
ciclo a ciclo + Supabase, não suposição: (1) `reasoningValidator.ts` estava
em fail-open sistemático — 100% das chamadas cortavam no meio do
raciocínio do modelo (max_tokens=150 curto demais pra um modelo que pensa
em texto livre antes do JSON), deixando passar reasoning autocontraditório
de verdade (ex: abriu SHORT em BTCUSD com o próprio texto dizendo
"confluência insuficiente para abrir SHORT aqui"); subido pra 600
(`8d4ad62f8`). (2) Cooldown de perda em sequência (`mt5LossStreakThreshold=2`/
`30min`) travava a cesta inteira por 30min de cada vez — afrouxado pra 3
perdas/20min, a pedido do Cleber (`ef55e3516`). (3) **O mais importante**:
trailing stop pós-breakeven usava a MESMA distância do stop de abertura
(2,0x ATR), criando uma faixa morta onde o preço corria a favor sem o stop
subir nada — confirmado no trade real que chegou a +$3 e fechou em -$0,19;
multiplicador dedicado mais apertado (`mt5TrailAtrMultiplier=0,8x`) agora
protege lucro progressivamente (`fd258d63b`). Processo reiniciado ao vivo
a pedido explícito do Cleber ("reinicie você mesmo") — confirmado único
(sem duplicata), sem perda de posição (XETUSD LONG que já estava aberta
foi reconhecida corretamente pelo novo processo). **Nenhum dos 3 fixes
promete edge** — são correção de mecânica (contradição bloqueada de
verdade, cesta menos travada, lucro protegido de verdade), não alegação de
melhora no líquido; precisa de amostra nova (dias, não horas) rodando com
o código atualizado antes de avaliar efeito real. PnL da sessão no momento
do restart: -$8,46, 21 trades, 3 vitórias (14,3%), amostra pequena sem
validade estatística. Monitoramento desarmado a pedido do Cleber ao fim.
Handoff completo:
[SESSAO_2026-08-30_MONITORAMENTO_5MIN_VALIDADOR_COOLDOWN_TRAILING.md](SESSAO_2026-08-30_MONITORAMENTO_5MIN_VALIDADOR_COOLDOWN_TRAILING.md).

**2026-08-30 (tarde/noite): monitoramento ao vivo do Cérebro LLM Ativo,
sessão `aa279c75...` — validador semântico agora pega fato inventado (não
só autocontradição), cesta expandida pra 10 ativos (+SOLUSD/ADAUSD/LNKUSD/
UNIUSD), 10 padrões de candlestick implementados e atrelados ao Price
Action existente, + 1 bug de alias de símbolo pego antes de causar dano
(4 commits prontos, NENHUM aplicado ainda).** Achado real via log: BTCUSD
SHORT perdeu $5,58 porque o reasoning afirmou "trend LOW, volume elevated"
contradizendo o `get_mt5_quote` do MESMO ciclo (trend LATERAL, volume NÃO
elevado) — fato inventado, não erro de leitura; `reasoningValidator.ts`
agora recebe o snapshot real da cotação e bloqueia esse tipo específico de
contradição. SOLUSD (removido antes por 57% do prejuízo de uma sessão,
causa nunca comprovada) foi reintroduzido a pedido do Cleber — monitorar
de perto. Padrões de candle (Doji/Martelo/Estrela Cadente/Engolfo/Harami/
Estrela Manhã-Noite/Marubozu) calculados em cima do candle OHLC real,
nunca mecânicos — mais um fator de confluência, testados ao vivo (DOJI/
ENGOLFO_ALTA/ESTRELA_CADENTE/MARUBOZU_ALTA já detectados de verdade em
produção). De carona: Cleber reportou "plataforma travada"/"P&L flutuante
não funciona" — falso alarme (processo vivo, dashboard atualizando ao
vivo, $0,00 era o valor correto por não ter posição aberta no momento),
mas a investigação achou e corrigiu de verdade o mesmo bug de alias de
símbolo já documentado pra BTCXBN/DOGUSD, agora pra LNKUSD (broker usa
`LNKUSD`, catálogo unificado usa `LINKUSD`) em `LlmActiveBrainPanel.tsx`
— pego ANTES de qualquer posição real abrir nesse símbolo. **Achado
colateral não investigado**: painel mostra P&L Realizado (-$8,27) via
campo `pnl` bruto, divergente do cálculo direto via `net_pnl` (-$15,20)
no Supabase — não investigado qual é o número certo. Handoff completo:
[SESSAO_2026-08-30_VALIDADOR_CESTA_EXPANDIDA_E_CANDLE_PATTERNS.md](SESSAO_2026-08-30_VALIDADOR_CESTA_EXPANDIDA_E_CANDLE_PATTERNS.md).

**2026-08-30 (tarde): monitoramento ao vivo do Cérebro LLM Ativo — 6 bugs
estruturais reais corrigidos + MACD/Estocástico Lento implementados
(commits prontos, NENHUM aplicado ainda).** Rastreando o log ciclo a ciclo
(não suposição), achados e corrigidos: stop podendo ficar menor que o
spread (perda garantida, já commitado em `b94239f75`); `close_position` e
depois `open_position` decidindo sem consultar cotação fresca do símbolo
certo (um caso real: fechou um BTCUSD lucrativo citando dado do XETUSD);
fechamento manual prematuro (posições fechadas perto do zero a zero cujo
preço confirmadamente voltou a favor minutos depois — trava generalizada
pra exigir ≥50% do caminho até stop/alvo antes de aceitar fechamento
discricionário); guarda de contradição reforçada + validador semântico novo
(`reasoningValidator.ts`, fail-open sempre). MACD e Estocástico Lento reais
implementados por 2 subagentes em paralelo (revisados linha a linha antes
de aplicar) — nunca fabricam indicador, só dado pro julgamento do LLM, sem
trava mecânica nova. **Achado sem fix possível**: mesmo com dado real e
fresco, a IA repetidamente leu o indicador de forma errada (MACD subindo
interpretado como "esgotando", o oposto) — consistente com a pesquisa já
documentada abaixo ("busca por edge de sinal técnico", sem resultado
comprovado); os fixes desta sessão levantam o piso (evitam perda por erro
estrutural), não prometem levantar o teto (acerto direcional). **Primeiro
sinal (amostra de 1, não é prova) de que o fix funciona**: depois da trava
de fechamento prematuro no ar, uma posição XETUSD LONG sobreviveu a 5-6
tentativas de fechamento manual bloqueadas e bateu take-profit de verdade
(+$13,41) — primeiro TP real confirmado da sessão. Sessão fechou (monitoramento
desarmado a pedido do Cleber) em 17 trades, 2 vitórias, -$9,62 líquido,
amostra mista (trades de antes e depois de cada fix, não comparável entre
si). **Pendência real**: 6 commits prontos esperando Cleber rodar
manualmente. Detalhe completo:
[SESSAO_2026-08-30_MONITORAMENTO_LLM_BRAIN_TARDE_E_HARDENING.md](SESSAO_2026-08-30_MONITORAMENTO_LLM_BRAIN_TARDE_E_HARDENING.md).

**2026-08-30: `/code-review ultra` no diff local (working tree) + 3 bugs reais
corrigidos e commitados (`45d26c24b`).** Revisão multi-ângulo (xhigh effort,
finders em agentes + verificação) sobre `OrderTicket.tsx`, `AITrader.tsx` e
`discoverSignals.ts` (o diff não-commitado no momento da revisão) achou 5
problemas, todos corrigidos no mesmo commit: (1) `discoverSignals.ts`
montava o caminho de saída com `process.cwd()`, que quebra exatamente do
jeito que o próprio cabeçalho do script manda rodar (cwd = pasta do
experimento, não raiz do repo) — resultado seria gravado num caminho
duplicado sem nenhum erro visível; corrigido com
`fileURLToPath(import.meta.url)`, agora independente de cwd, e caminho
extraído pra uma constante única (`RESULTS_DIR`, era repetido 4x); (2) o
fix do bug de PnL 20x do NAS100 (27/08, `OrderTicket.tsx`) tinha introduzido
uma regressão nova sem ninguém notar: a guarda `!asset` adicionada zerava a
prévia de risco/retorno também em **LIVE**, que nunca precisou de `asset`
(só de `contractSpec`, que sempre tem fallback) — símbolos que existem em
`contractSpecs` mas não em `assetDatabase` (ex: BTCUSDT, caso já documentado
no próprio arquivo) perdiam a prévia inteira; corrigido movendo a guarda pro
branch DEMO só; (3-4) a fórmula de PnL de DEMO estava duplicada dentro do
próprio `OrderTicket.tsx` (`riskUsd`/`rewardUsd`, cópia idêntica) — extraída
pra `computePriceMagnitudePnl`, exportada de `useApexLogic.ts` como fonte
única, ao lado de `calculateEngineConsistentPnL` (mesma disciplina, mesmo
motivo: essa exata duplicação de fórmula foi a causa raiz do bug do NAS100
original). `AITrader.tsx` (slider novo de `signalScoreFloor`, campo que já
existia no motor desde antes) foi revisado e não tinha bug. `npx tsc
--noEmit` limpo nos 3 arquivos tocados pelo fix, comportamento preservado
exatamente (refactor + fix pontual, não mudança de resultado).

**2026-08-30 (manhã): redesenho do Cérebro LLM Ativo depois do "desesperador"
1,7% de acerto/-$124 da noite anterior — autonomia total dada pelo Cleber.**
Diagnóstico via SQL direto (não suposição) achou 2 causas concretas, não
"falta de edge" genérica: (1) SOLUSD sozinho respondeu por 57% de todo o
prejuízo (13 trades, 0 vitórias, quase todos stopados em <1min, ambas
direções — removido da cesta, pendente investigação de causa); (2) ZERO das
66 posições bateram take-profit (alvo "giro rápido" de 2026-08-29 nunca era
alcançável). Corrigido: R:R 1:2 (era ~1:1,13, mesmo R:R do motor mecânico
principal), teto de 1 posição/símbolo (era 3) + guard novo contra posição
OPOSTA simultânea no mesmo símbolo (confirmado que aconteceu de verdade),
guard novo de contradição reasoning↔ação em `open_position`, `tool_choice:
"auto"→"required"` (testado direto contra a API antes de aplicar — elimina
as 3 variantes de falha de formato de tool-call da noite anterior,
confirmado limpo ao vivo depois do restart). **Bug real encontrado E
corrigido AO VIVO, no primeiro trade sob o R:R novo**: fallback de stop sem
ATR real colapsava o alvo pra R:R 1:1 (ou pior) ignorando o multiplicador —
sem dano (a IA fechou manualmente, -$0,24). **Depois do redesenho já
validado ao vivo, Cleber pediu reset do dashboard pra $50 limpos** pra
testar o modelo novo sem a bagagem da sessão antiga — sessão nova criada
(`ai_sessions.id = aa279c75-1acd-49aa-9fef-a76e8ddf0b2e`, $50, zero
trades), processo reiniciado uma 3ª vez pra migrar pra ela. As 2 posições
que ficaram órfãs na sessão antiga (XETUSD SHORT e BTCXBN SHORT, essa
última aberta no ÚLTIMO ciclo do processo antigo, minutos antes da
migração) foram fechadas manualmente a preço real (rota `/mt5-prices`,
nunca fabricado), `exit_reason='MANUAL'`, motivo registrado em
`ai_reasoning` (nunca `UPDATE` silencioso) — -$0,41 e -$2,33
respectivamente. **A amostra pra julgar o redesenho é a partir de agora,
sessão `aa279c75...`** — a antiga (`e7eef768...`, -$135/1,7% de acerto)
fica congelada como histórico do R:R velho, não comparável. **Sem promessa
de edge** — pode só reduzir o ritmo da perda (bug fixes) sem criar lucro
real; precisa de amostra nova antes de julgar (ver query pronta no
handoff). Achado de metodologia à parte: restart **não** cria sessão nova
sozinho no Supabase (reusa a mais recente por `strategy_name` — só criei
uma nova explicitamente por pedido do Cleber) — corrige suposição errada
do handoff anterior. Handoff completo, com o diagnóstico detalhado, lista
de arquivos mudados e pendências:
[SESSAO_2026-08-30_REDESENHO_CEREBRO_LLM_ATIVO.md](SESSAO_2026-08-30_REDESENHO_CEREBRO_LLM_ATIVO.md).

**2026-08-30 (noite anterior): monitoramento contínuo do Cérebro LLM Ativo
terminou em 1,7% de acerto, -$124 líquido — motivou o redesenho acima.** 2
bugs de auditoria corrigidos e commitados (`75fffa6c4`, `8a3bcde6a`,
`768720d5a`: cooldown ignorava fechamento manual negativo; `open_position`
aceitava `reasoning` vazio). Achados de degradação do modelo sem fix de
código possível (erro de leitura de percentual, alucinação de contagem,
corrupção de texto) catalogados no handoff — a maior parte das falhas de
formato de tool-call foi endereçada no redesenho acima via `tool_choice:
"required"`. Detalhe completo:
[SESSAO_2026-08-30_MONITORAMENTO_NOTURNO_LLM_BRAIN_E_ACHADOS_CRITICOS.md](SESSAO_2026-08-30_MONITORAMENTO_NOTURNO_LLM_BRAIN_E_ACHADOS_CRITICOS.md).

**2026-08-30 (madrugada): sessão de manutenção do LLM Brain — 3 fixes implementados,
TODOS commitados, código ao vivo. Nenhuma ação de código pendente.**
Commits: `e043e0308` (remove XPTUSD da cesta, fica com 7 ativos — mercado
de platina ficava fechado com tick morto ~30h todo fim de semana),
`8236d5774` (reasoning apagado: `closeMt5Position`/`neuralBridge.ts`
sobrescrevia `ai_reasoning` da entrada com o da saída — agora concatena
`entrada || SAIDA: saida` — + `tradeMemory.ts` novo, injeta no `userMessage`
de cada ciclo um resumo dos últimos ~30 trades fechados por símbolo+lado,
cache 60s, teto 1600 caracteres — NÃO é ML/fine-tuning, é injeção de
contexto factual, **efeito ainda não validado**, validar exigiria comparar
taxa de reentrada em símbolo+lado perdedor com/sem o bloco ao longo de
dias, amostra que não existe ainda), `81c995bf4` (feed travado + spread
anormal: XPTUSD tinha tick de ~30h tratado como vivo, poluindo o histórico
de tendência/volatilidade — corrigido com trava de cotação obsoleta
>120s; DOTUSD com spread de ~10% é dado REAL da corretora fim de semana,
não bug — trava de spread em 2,0% implementada em `mt5Broker.ts`/
`tools.ts`; detalhe completo em
[SESSAO_2026-08-30_FEED_TRAVADO_E_SPREAD_ANORMAL.md](SESSAO_2026-08-30_FEED_TRAVADO_E_SPREAD_ANORMAL.md)).
Processo reiniciado depois de cada fix (procedimento padrão: matar o
antigo, confirmar 1 só rodando, subir de novo — posições abertas nunca se
perdem, continuam no Supabase). **Pendências reais**: (1) remedir o teto
de 2,0% de spread em dia útil (calibrado com amostra de fim de semana,
pode estar folgado demais no pregão normal); (2) Parte A do handoff
anterior (ML de volatilidade via EWMA→GARCH→HAR-RV) segue sem
implementar, falta histórico de candle real (~7-35 dias mínimo) — handoff
completo em
[SESSAO_2026-08-29_CANDLE_REAL_E_PRICE_ACTION.md](SESSAO_2026-08-29_CANDLE_REAL_E_PRICE_ACTION.md)
seção "HANDOFF PRA PRÓXIMA SESSÃO", Parte A, se for retomar; (3) observar
1-2h de log/Supabase confirmando que o bloco de memória de trades está de
fato chegando no modelo e o reasoning composto está gravando certo (não
confirmado visualmente ainda — o log do processo não imprime o
`userMessage` inteiro, só resposta do modelo e chamadas de ferramenta).

**Achado de metodologia pro monitoramento (vale pra qualquer sessão
futura que for calcular PnL)**: `ledger/actions.json`
(`llm-active-brain/`) é um arquivo local que NUNCA reseta entre
restarts/dias — qualquer PnL agregado calculado a partir dele mistura
várias sessões, NÃO é "PnL da sessão atual". Fonte certa: tabela
`ai_trades` no Supabase, filtrada por `session_id`
(`getClosedTradesForMemory` em `neuralBridge.ts` já faz isso certo).
Sessão que estava rodando quando isto foi escrito (iniciada ~02:02 UTC de
2026-08-30, sobreviveu a 2 restarts) tinha, na última checagem (~03:19
UTC), **9 trades fechados, 0 vitórias — 0% de acerto, -$17,98**. Amostra
pequena, sem validade estatística — só um retrato do momento, não
conclusão. Monitoramento automático (cron a cada 6min, checava
processo/ledger/PnL/anomalias) foi armado e depois **desarmado a pedido
do Cleber** — não está mais rodando; religar com `/loop 6m <prompt>` se
quiser retomar (prompt completo do que checar a cada ciclo fica no
histórico desta conversa, não reproduzido aqui pra não inchar este
arquivo — pedir pro Cleber colar de novo se precisar, ou reconstruir a
partir da lista de 6 itens: processo único, aberturas/fechamentos novos
com racional, PnL agregado via `ai_trades`, anomalias, avaliação de
receita líquida, e proposta de fix sem restart/commit automático).

**2026-08-29: LLM Brain — 3ª ocorrência de ledger corrompido por processo
duplicado (raiz real do "não abre posição"), retry de cotação MT5, e proxy
honesto de exaustão ("extension") depois de entrada ruim em XETUSD.**
Achado principal: `ledger/actions.json` corrompido (dois arrays JSON
colados) fazia `appendLedger` quebrar todo ciclo, abortando antes de
qualquer decisão — trava de instância única (`llm-brain.pid`) e reparo do
arquivo aplicados. De carona: `open_position` falhava em soluço transitório
de rede sem retry (agora tenta 3x) — confirmado resolvendo 5/5 entradas
seguidas com sucesso depois do fix. Terceiro achado, a pedido do Cleber
(apontou LONG em XETUSD comprado "esticado", Estocástico/MACD em exaustão):
confirmado que `/mt5-candles` (candle OHLC oficial) devolve dado
**fabricado** (`SIMULATED`) em produção pra esta cesta — MACD/Estocástico
reais são impossíveis de implementar com integridade até esse endpoint ser
corrigido (fora do escopo do `llm-active-brain`, mexe na Edge Function
principal compartilhada). Entregue no lugar: `extension` (distância % do
preço pra média do próprio histórico real de tick), dado 100% real embora
mais fraco que uma média móvel de candle de verdade — agente instruído a
usar como fator de cautela, não bloqueio mecânico. Discussão de risco (stop
de ~$3-5 por trade nos $1.200 de exposição atuais) resolvida com a
matemática explicada ao Cleber — ele decidiu manter o tamanho como está por
enquanto. **Pendências**: investigar por que `/mt5-candles` cai em
SIMULATED; `XPTUSD` com feed travado (24+ ciclos no mesmo preço,
candidato a sair da cesta); commit de `agent.ts`/`tickHistory.ts`/`tools.ts`
ainda não feito. Detalhe completo:
[SESSAO_2026-08-29_LLM_BRAIN_RETRY_EXTENSAO_E_LEDGER_CORROMPIDO.md](SESSAO_2026-08-29_LLM_BRAIN_RETRY_EXTENSAO_E_LEDGER_CORROMPIDO.md).

**2026-08-29: Otimizações de captura do LLM Active Brain (sizing $800→$1200,
remove teto de take-profit mecânico, ciclo 30s→10s) + fix de bug real no
Dashboard + 2ª ocorrência de processo duplicado no mesmo dia.** Achado
principal: take-profit fixo em 2R fechava todo trade vencedor antes do
trailing stop (que só começa a proteger a partir do breakeven) ter chance
de deixar tendências maiores correrem — corrigido, agora só o stop
(inicial→breakeven→trailing) decide a saída de lucro, take-profit vira só
referência/exibição. De carona no Dashboard: bug real corrigido
(`LlmActiveBrainPanel.tsx` congelava "atualizado há Ns" quando não havia
posição aberta) + achado de que 3s de polling de preço é mais rápido que a
latência real documentada da MetaAPI compartilhada (3-8s) — revertido pra
5s, só o poll de trades (Supabase puro) ficou em 3s. Mesmo padrão de
processo duplicado do item anterior se repetiu (2 pares rodando em
paralelo, log entrelaçado) — resolvido do mesmo jeito. Nenhuma pendência de
código; vale observar amostra de trades vencedores maiores nas próximas
sessões. Detalhe completo:
[SESSAO_2026-08-29_OTIMIZACOES_CAPTURA_E_DASHBOARD_LLM_BRAIN.md](SESSAO_2026-08-29_OTIMIZACOES_CAPTURA_E_DASHBOARD_LLM_BRAIN.md).

**2026-08-29: Falso alarme de "motor travado" — era processo duplicado do
LLM Brain rodando em paralelo, nenhum bug de código.** Ao reiniciar o
`llm-active-brain` via terminal, o `kill` do processo antigo não rodou
antes do novo `nohup npm run start` subir — chegaram a existir 2 processos
vivos ao mesmo tempo contra a mesma conta (risco real de ordens
duplicadas). Resolvido matando o antigo, só 1 processo confirmado no fim.
Log seguia avançando ciclo a ciclo o tempo todo — a sensação de
"congelado" vinha de `tail -f` (trava a saída de propósito) e do feed
MetaAPI intermitente de fim de semana, ambos comportamento esperado, não
falha. Detalhe e comandos de referência:
[SESSAO_2026-08-29_PROCESSO_DUPLICADO_LLM_BRAIN.md](SESSAO_2026-08-29_PROCESSO_DUPLICADO_LLM_BRAIN.md).

**2026-08-29 (madrugada): Auditoria completa do Cérebro LLM Ativo +
monitoramento noturno (11 checagdas, 01:02-07:22) — 2 achados corrigidos,
nenhuma pendência de código.** Confirmado ao vivo (terminal + Dashboard +
Supabase) que o fix de saída da sessão anterior funciona de verdade
(`close_position` sendo chamado, PnL real) e que o preço é real (MetaAPI,
nunca simulado — trava confirmada no código). 2 achados novos corrigidos:
processo zumbi rodando com modelo velho (morto) e furo no teto de posição
por símbolo (`listMt5OpenPositions` engolia erro de rede e devolvia `[]`,
deixando passar 6 posições em SOLUSD com teto de 3 — mesmo padrão de bug
já visto no motor mecânico em 08-28). **Ambos os commits pendentes da
sessão anterior + o fix novo já estão commitados e pushados** (`70ca87f00`,
`1e0591124`) — nenhuma ação de código pendente. PnL da sessão terminou
negativo (-$8,40, sem validação estatística, é só 1 noite de amostra).
Detalhe completo, trajetória de PnL noite inteira e achados de qualidade
do modelo (confundiu direção lucro/prejuízo 1x, confirmado no banco):
[SESSAO_2026-08-29_AUDITORIA_LLM_BRAIN_E_MONITORAMENTO_NOTURNO.md](SESSAO_2026-08-29_AUDITORIA_LLM_BRAIN_E_MONITORAMENTO_NOTURNO.md).

**[RESOLVIDO 2026-08-29] LLM Brain — provedor NVIDIA + bug de nunca fechar
posição.** Causa raiz do provedor: não era a API da NVIDIA fora do ar, era
o modelo `openai/gpt-oss-120b` especificamente travando o endpoint deles —
trocado pro mesmo modelo do NEXUS (`nvidia/nemotron-3-nano-30b-a3b`).
Causa raiz do fechamento: sem alvo de saída concreto no prompt, o agente
só empilhava posições quase-duplicadas (26 até o ciclo 14, P&L sempre
$0.00) — corrigido com teto de 3 posições/símbolo + regra de saída
obrigatória. Detalhe:
[SESSAO_2026-08-29_LLM_BRAIN_PROVEDOR_NVIDIA_E_COMPORTAMENTO_DE_SAIDA.md](SESSAO_2026-08-29_LLM_BRAIN_PROVEDOR_NVIDIA_E_COMPORTAMENTO_DE_SAIDA.md).

**2026-08-28: 2 bugs corrigidos (linha de posição sumindo do gráfico/Dash)
após alarme do Cleber (Solana some do gráfico) + Cérebro Sombra
verificado, sem risco.** Bug 1: fix de "elimina piscar" mais cedo no dia
(`156b751b6`) passou a atualizar overlay existente em vez de recriar, mas
não limpava o rastreamento de ids quando o chart é destruído/recriado
(`dispose()+init()` na troca de símbolo/timeframe) — linha de entrada/SL/TP
some pra sempre depois disso, corrigido resetando o ref logo após o
`init()` (`ChartView.tsx`). Bug 2, mais grave (explicava o "aparece e some
a cada ~30s" no Dashboard): `getSessionTrades` engolia erro de rede do
Supabase e devolvia `[]` — indistinguível de "sem trade aberto" — fazendo
o `reconcile()` de `useApexLogic.ts` (poll 30s) apagar a posição real da
tela numa falha transitória, até o próximo poll repopular. Corrigido
consultando o Supabase direto dentro do `reconcile()`, deixando erro
propagar pro catch que já mantém o estado anterior. `npm run validate`
100%, commits prontos pro Cleber. De carona: confirmado (rastreado
`runTradingCycle.ts`→`decisionBrain.ts`→`ai-runner/index.ts`) que o
Cérebro Analítico em Modo Sombra **não tem nenhum poder de execução** —
só loga "o que teria feito" numa tabela separada, fire-and-forget, sem
influenciar a decisão mecânica real. Detalhe completo:
[SESSAO_2026-08-28_BUG_LINHA_POSICAO_SOME_E_CEREBRO_SOMBRA_VERIFICADO.md](SESSAO_2026-08-28_BUG_LINHA_POSICAO_SOME_E_CEREBRO_SOMBRA_VERIFICADO.md).

**2026-08-28: gerenciamento de saída reforçado (TP parcial + breakeven
0,5R + linha de stop unificada + janela cega fechada) e Fase 0 do
redesenho do cérebro de decisão AO VIVO em modo sombra.** Achado de MFE
real (candle 5m, sem look-ahead): 89,2% dos trades perdedores tiveram
lucro flutuante real antes de reverter (mediana $0,55) — TP parcial 50%
implementado, depois o gatilho de breakeven+parcial apertado de 1R pra
0,5R (sweep de contenção, sinal monotônico limpo). De carona: linha de
stop exibida ao cliente divergia da que o servidor executava (achado
grave, classificado pelo Cleber como risco jurídico/credibilidade) —
corrigido, cliente em DEMO nunca mais recalcula, só reflete o servidor;
e janela cega de detecção de stop (servidor só checava preço pontual, não
faixa) fechada com checagem de high/low por invocação. Testado e
**rejeitado** com dado real: inverter direção por RSI/estocástico em
exaustão (pioraria líquido e taxa de acerto, 33 trades reais) — mesma
disciplina que já rejeitou "stop-and-reverse" e "Order Block Fade".
**Maior item da sessão**: Cleber pediu redesenho do cérebro de decisão pra
julgamento analítico contextual (persona "operador gênio" — princípios de
Soros/Simons/Livermore/PTJ/Druckenmiller) dentro de uma jaula de risco
mecânica intocável. Achado que definiu a validação: este projeto já tinha
rejeitado arquitetura LLM-de-decisão antes por risco de vazamento
temporal em backtest — só pode ser validado **pra frente**. Fase 0 (modo
sombra, nunca decide de verdade) implementada e **confirmada ao vivo**
(`ai_decision_brain_shadow` recebendo linhas reais desde hoje). Pedido do
Cleber: o cérebro precisa "entender o que fez de errado pra não repetir" —
memória de decisões passadas no prompt (não é fine-tuning — é o cérebro
ver o próprio histórico com resultado real antes de decidir de novo).
**Passo 1 dessa cadeia (cálculo de resultado hipotético por decisão
logada, candle real sem look-ahead) já implementado, deployado, migration
aplicada e cron agendado — confirmado ao vivo** (`entry_price_snapshot`/
`atr_snapshot` gravando desde 13:23 UTC de hoje). **[FECHADO 2026-08-28
13:30 UTC] Job `decision-brain-outcome-30min` disparou pela primeira vez
com sucesso, `hypothetical_outcome` confirmado gravando de verdade**
(50/65 linhas com snapshot já preenchidas). **[IMPLEMENTADO 2026-08-28,
aguardando deploy] Passo 2** (módulo de recuperação de histórico + injeção
no prompt) pronto — `decisionBrainHistory.ts` novo, `decisionBrainPrompt.ts`/
`decisionBrain.ts` atualizados, `npm run validate` + `deno check` limpos.
**Pendente**: `supabase functions deploy ai-runner --no-verify-jwt` e
commit — os 3 itens da cadeia de memória do cérebro (resultado
hipotético, recuperação de histórico, injeção no prompt) estão todos
implementados; falta só deploy e acumular amostra (mínimo 20 decisões
avaliadas) pra a seção de histórico sair do fallback "amostra
insuficiente" em produção. Handoff completo com o passo a passo exato:
[SESSAO_2026-08-28_GERENCIAMENTO_DE_SAIDA_E_CEREBRO_ANALITICO.md](SESSAO_2026-08-28_GERENCIAMENTO_DE_SAIDA_E_CEREBRO_ANALITICO.md).

**2026-08-27: 3 bugs corrigidos após alarme do Cleber (NAS100 mostrando
-$16,30 de PnL, quase 10% da conta).** Investigado ponta a ponta: o risco
real era só ~$1 (posição de 0,01 lote), o número exibido vinha de
`calculatePnLWithLeverage` usando especificação de **contrato futuro E-mini
da CME** (NAS100 $20/ponto) em vez do modelo de $1/ponto que o motor de
sizing e o fechamento real no servidor sempre assumiram — inflava PnL
exibido (e o **realizado**, se fechado manualmente) em ~20x. Corrigido com
`calculateEngineConsistentPnL()`, que espelha a fórmula do servidor. De
carona: histórico de trades sumindo do Dashboard quando o servidor fecha
posição em sessão ativa (`reconcile()` nunca escrevia em `orderHistory`,
só hidratava uma vez no mount) e cronômetro de candle saltando minutos
(confirmado em vídeo — duas fontes de timestamp conflitantes, corrigido
pra usar só a âncora do fetch real, trava em 00:00 em vez de adivinhar).
`npm run validate` 100%, commit pronto pro Cleber. **Pendente**: auditar se
o mesmo bug de contractSpecs.ts afeta outros símbolos INDICES (US30,
US2000, GER40, UK100...) além de NAS100. Detalhe completo:
[SESSAO_2026-08-27_BUG_PNL_INDICES_E_HISTORICO.md](SESSAO_2026-08-27_BUG_PNL_INDICES_E_HISTORICO.md).

**2026-08-27: Dropdown "Poucos/Médio/Muitos pontos" (alvo de lucro)
reconectado — ficava salvo sem efeito real no motor ao vivo desde
2026-08-17.** O alvo era sempre stop×3 fixo, não importava a escolha da
UI. Agora cada opção escala o R:R real (`RISK_REWARD_BY_TARGET_POINTS` em
`runTradingCycle.ts`: POUCOS=1,5×, CURTO=2×, MÉDIO=3× sem mudança,
LONGO=4×, MUITOS=5×), stop continua sempre 2×ATR. Deploy e commit já
feitos. **Pendente**: nenhum dado ainda sobre qual nível performa melhor
líquido. Detalhe: seção final de
[SESSAO_2026-08-27_PERSISTENCIA_CONFIG_E_DIAGNOSTICOS.md](SESSAO_2026-08-27_PERSISTENCIA_CONFIG_E_DIAGNOSTICOS.md).

**2026-08-27: Persistência de configuração da IA implementada (pedido
antigo do Cleber, nunca feito de verdade) + 4 diagnósticos do dia.**
Config da IA (`stopLossMode` etc) até então só existia em `localStorage`
por navegador — voltava pro default hardcoded em outro dispositivo/aba
anônima. Agora persiste em `ai_user_config` (Supabase, por `user_id`),
migration e commit já aplicados pelo Cleber, validado ponta a ponta em
produção. De carona: bug de exibição corrigido (`InfinoxAssetsBrowser`
mostrava "$0,00" em vez de "Sem dados"); confirmado que "82% sem preço
real" e "só opera SOL/ETH" não são bugs (infra MetaAPI e dinâmica de
mercado, respectivamente); achado que os 7 trades automáticos fechados
desde a mudança de risco/TP de 26/08 ainda estão negativos (-$1,88), a
melhora aparente vinha só de 3 fechamentos manuais. **Pendente**: decidir
se `DINAMICO` vira default de `stopLossMode` pra sessões novas (hoje é
opcional, pode ficar em `FIXO` sem o usuário notar). Detalhe completo:
[SESSAO_2026-08-27_PERSISTENCIA_CONFIG_E_DIAGNOSTICOS.md](SESSAO_2026-08-27_PERSISTENCIA_CONFIG_E_DIAGNOSTICOS.md).

**2026-08-25: Trilho 2 reaberto (NVIDIA NIM Signal Discovery, incl. NLP)
+ cuOpt em Fase A (não integrado ainda).** Etapa 0 já rodou de verdade
contra a NIM API — 5 hipóteses geradas (correlação cross-asset,
calendário-regime, NLP sobre texto de evento), nenhuma validada ainda.
Nada de produção mudou. **Pendente, em ordem**: confirmar que o secret
`NVIDIA_API_KEY` do NEXUS no Supabase (rotacionado nesta sessão após
apagar por engano) está de fato ativo — não testado ainda; decidir
orçamento de newsfeed pago pro NLP; escrever backtest real das 5
hipóteses; confirmar schema do endpoint cuOpt antes da Fase A rodar de
verdade. Detalhe completo:
[SESSAO_2026-08-25_NVIDIA_TRILHO2_CUOPT.md](SESSAO_2026-08-25_NVIDIA_TRILHO2_CUOPT.md),
ordem exata em [NEXT_SESSION.md](NEXT_SESSION.md).

**2026-08-25: NEXUS trocado de Groq pra NVIDIA Nemotron 3 (Nano).**
Testado ao vivo em produção. Primeira tentativa (Ultra, 550B/55B ativos)
mediu ~28s de resposta — inviável pra chat; trocado pra Nano (30B/3B
ativos, feita pra chat/tool-calling interativo). **Pendente**: redeploy
(`supabase functions deploy nexus-brain --no-verify-jwt`) e reteste de
latência com o modelo novo. Detalhe:
[SESSAO_2026-08-25_NEXUS_TROCA_LLM_NEMOTRON.md](SESSAO_2026-08-25_NEXUS_TROCA_LLM_NEMOTRON.md).

**2026-08-24: Order Block Fade testado — sem edge.** Fade contra zona de
order block (SMC) testado como estratégia a pedido do Cleber — 1 de 21
séries fechou positiva líquida (taxa de acerto média 32,3%), mesmo padrão
da busca de julho. Achado de processo: bug de look-ahead no backtest
inflava o resultado inicial, corrigido. `detectStructureEvents`
(`marketStructure.ts`) documentado com viés de look-ahead ~2 candles, não
corrigido (não afeta exibição visual, afetaria decisão de trade). Detalhe:
[research/experiments/2026-08-24-order-block-fade/verdict.md](research/experiments/2026-08-24-order-block-fade/verdict.md).

**2026-08-24: Jarvis (segundo cérebro do motor) em produção.** 6 tabelas
`jarvis_*`, Edge Function deployada e testada com dado real (7 trades/6h,
guardrails funcionando ponta a ponta), cron `jarvis-analysis-6h` ativo.
Próximo marco real: esperar 1-2 semanas de `jarvis_health_snapshots`
acumular e revisar quais decisões `PENDING` fazem sentido aprovar. Detalhe
no histórico ou em
[SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md](SESSAO_2026-08-23_CUSTO_INVISIVEL_PESQUISA_EDGE_E_JARVIS.md).

**[RESOLVIDO 2026-08-24] Custo de execução não cobrado.** 135/135 trades
fechavam com `commission: 0`; fix confirmado em produção (v48 do
`ai-runner`). Efeito líquido no resultado ainda não avaliado (amostra
pequena pós-fix). Detalhe no [CLAUDE_HISTORY.md](CLAUDE_HISTORY.md).

**Fase de pesquisa fechada em 2026-08-23, reaberta em 2026-08-25 (ver item
do topo)**: calendário/macro sem efeito direcional utilizável (só redução
de custo por janela de risco); posicionamento/fluxo e TradingAgents/ML sem
edge intraday comprovado. Relatórios em
`research/experiments/2026-08-23-custo-nao-cobrado-e-poder/`.

Itens de 2026-08-21 (todos resolvidos, detalhe no histórico se precisar):
log de PnL em $ + fix de import map quebrado; gate de notícias/VIX do
`ai-runner` (era stub morto, corrigido — **migration
`20260821_add_news_gate_veto_stage.sql` ainda pendente de aplicar**);
"Parar IA" não fecha mais posições à força, só impede abertura de novas.

**Scorecard de performance por ativo** (infraestrutura no ar desde
2026-08-21, efeito desligado): `ASSET_SCORECARD_ACTIVE = false` em
`runTradingCycle.ts` — job só acumula histórico
(`asset_performance_scorecard`, a cada 30min). Proxy-backtest inicial deu
Δ≈-$0,02 (ruído, dado insuficiente). Próximo passo real: esperar 1-2
semanas de dado e repetir o proxy-backtest antes de cogitar ligar o
switch.

Redesenho do cérebro de decisão (aberto 2026-08-04) — ver item 0 de
"Pendências reais em aberto" abaixo, é o mesmo item.

## O que é

SaaS de trading quantitativo (React 18 + TS + Vite + Supabase + MetaAPI/MT5).
Produção: `https://www.neuraldaytrader.com` (Vercel) + Supabase próprio
(projeto "Neural DayTrader", id `wyvdsxtcmizettljxtbg`, org "We Expand").

> ⚠️ **PRODUÇÃO ESTÁ FORA DO AR DE PROPÓSITO.** `www.neuraldaytrader.com`
> serve uma página estática "Em construção" (o `index.html` da branch `main`
> é a página de manutenção, commit `d053074a3`), **não o app**. Todo
> desenvolvimento e teste acontece na branch `dev` — ver "Ambientes e
> branches" abaixo. Não tirar da manutenção sem decisão explícita do Cleber.

**Modelo de negócio**: Fase Demo (dados reais, execução virtual persistida,
sem corretora própria do usuário) → Fase Real (usuário conecta corretora via
MetaAPI, comissão por lote). Aporte mínimo travado em **US$50**. Corretora de
referência: Infinox (custo calibrado "igual ou um pouco abaixo" da
concorrência — ver `research/CostModel.ts`).

## Ambientes e branches — LER ANTES DE TESTAR OU FALAR DE DEPLOY

**Trabalhamos na branch `dev`. Produção (`main`) está em manutenção.**

| Ambiente | Branch | URL | Serve o app? |
|---|---|---|---|
| **Trabalho/teste** | `dev` | `neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app` | ✅ Sim |
| Produção | `main` | `www.neuraldaytrader.com` | ❌ Não — página "Em construção" |

- **Nunca testar em URL de deployment com hash** (`...-bwip109bq-...`). Essas
  URLs são **imutáveis**: ficam congeladas no código daquele build e nunca
  atualizam, por mais pushes que se faça. Já custou uma investigação inteira
  ("o push não foi pra Vercel", quando tinha ido). Usar o alias de branch.
- **Mergear `dev`→`main` não tira o produto da manutenção** — o `index.html`
  de manutenção é do `main` e sobrevive ao merge.
- **Edge Functions não sobem com `git push`** — precisam de
  `supabase functions deploy <nome>`. O `ai-runner` exige **`--no-verify-jwt`**
  (tem auth própria via `x-runner-secret`); sem a flag, todo tick do cron toma
  `401 UNAUTHORIZED_NO_AUTH_HEADER` e a IA para por completo.
- **O motor que opera de verdade é o `ai-runner` no servidor** (`pg_cron`,
  1×/min), não a aba do navegador. Fechar a aba não para a IA; fix só no
  cliente não muda o comportamento real de trading, e vice-versa.
- **Secrets do Supabase sobrepõem o default do código.** Se uma secret já
  foi setada explicitamente numa sessão anterior (ex: `LLM_PROVIDER`), ela
  continua valendo mesmo depois de mudar o default no código-fonte — só
  redeploy não basta, é preciso `supabase secrets set` explícito pra
  atualizar o valor em produção.

## Regra fixa de workflow

**Claude nunca faz `git commit`/`git push` sozinho neste projeto.** Sempre
entregar código pronto + comandos de commit prontos pro Cleber rodar. Deploy
na Vercel dispara automaticamente a partir do push. Migrations do Supabase
também nunca são aplicadas por Claude — só o SQL pronto pro Cleber rodar no
SQL Editor. (Motivo: já rodei `git commit` sozinho uma vez, ver
[CLAUDE_HISTORY.md](CLAUDE_HISTORY.md) se quiser o incidente completo — não
repetir.)

**Antes de criar qualquer arquivo novo com `Write`, sempre checar primeiro**
(`ls`/`git status`) **se já existe algo com aquele nome exato**, mesmo
quando a intenção é "criar do zero" — já apaguei um arquivo não versionado
sem recuperação possível por pular esse passo (detalhe no histórico).

## Arquitetura — estado real (não confiar sem checar o código se for crítico)

- **Segurança (Fase 1)**: RLS habilitado em todas as tabelas, token MetaAPI
  nunca fica no client (criptografado em `broker_credentials`, só a Edge
  Function acessa). `mockLogin` do `AuthContext` não é mais acionado no fluxo
  de login de produção (era chamado depois do login real e sobrescrevia o
  `user.id` — corrigido em 2026-07-29, detalhe no histórico).
- **Persistência (Fase 2)**: sessões/trades/portfolio da IA em modo DEMO
  persistem no Supabase (`ai_sessions`/`ai_trades`/`ai_portfolio_snapshots`).
- **Execução real (Fase 3)**: `/broker/execute` existe e funciona. Ponte
  decisão→execução com 4 estágios opt-in implementada (alerta → confirmação
  manual → execução automática → tamanho real), todos desligados por padrão
  — ver `AI_BRAIN_SPEC.md` seção 9.1 e histórico (2026-07-31) pro detalhe dos
  módulos.
- **Pipeline de preço**: consolidado em `RealMarketDataService.ts` (única
  fonte real hoje). Vários serviços concorrentes antigos ainda existem no
  repo como código morto — não usados pelo caminho crítico, não removidos.
  Ganhou guarda de desvio máximo de preço + TTL de cache em 2026-08-21 (ver
  item 9 do histórico se precisar do detalhe).
- **Risco crônico conhecido**: a conta MetaAPI de plataforma é
  **compartilhada** entre todos os usuários — sujeita a rate-limit (HTTP
  429/504) sob carga. Sempre espaçar chamadas, nunca testar em paralelo
  contra ela.
- **NEXUS** (`supabase/functions/nexus-brain/`): assistente conversacional
  do produto, LLM real com tool-calling (não mock). Provedor trocável via
  secret `LLM_PROVIDER` (`nvidia` default, `groq`/`anthropic` disponíveis)
  sem redeploy — mas **secret sobrepõe default do código**, ver nota em
  "Ambientes e branches" acima.

## Cérebro de decisão da IA

**Fonte de verdade única, sempre ler antes de mexer no motor de decisão**:
[research/AI_BRAIN_SPEC.md](research/AI_BRAIN_SPEC.md).

**Status (fechado em 2026-07-30, revisado em 2026-08-02)**: busca sistemática
por edge de sinal técnico (5 presets × múltiplas cestas de ativos ×
timeframes, dezenas de sub-investigações com correção estatística DSR) **não
encontrou edge comprovado** — resultado consistente com mercado eficiente
pra indicador técnico clássico sobre preço público, não falta de tentativa.
**Decisão de produto do Cleber**: o produto segue intraday, cérebro
assumidamente de **execução e disciplina, não de alfa** — com edge ≈ 0, EV
por trade é ≈ `−custo`, logo o cérebro mais eficiente é o que opera menos.
ML entra só em previsão de volatilidade, nunca de direção. Trilho 2 (busca
de edge com dado estruturalmente diferente) fica pausado sem justificativa
nova. Rastro completo da investigação (seções 11-14 da spec, o que foi
testado e o resultado real de cada rodada): ver **seção "Cérebro de decisão
da IA — busca por edge de sinal" no [CLAUDE_HISTORY.md](CLAUDE_HISTORY.md)**.

**Gate obrigatório antes de qualquer commit que toque o motor**:
```bash
npm run validate
```
Roda type-check estrito do caminho crítico (`tsconfig.engine.json`) + ~40
asserções determinísticas (indicadores técnicos + motor SMC + gates de
risco). Mantido em ZERO erros de propósito — é o que torna esse gate
confiável em vez de ignorado.

## Pendências reais em aberto

Itens resolvidos entre 07-26 e 08-24 (Fase 0, decisão de escopo do Trilho
2, Estágios 1-4 de execução, componentes de risco, Marketplace, boleta de
ordem manual, Jarvis, custo de execução, gate de notícias, guarda de
desvio de preço, curva de equity, Parceiros IB B1-B3, Safe Mode em DEMO)
foram movidos pro histórico — ver
[CLAUDE_HISTORY.md](CLAUDE_HISTORY.md).

O que ainda está genuinamente em aberto:

0. **[ATIVO] Redesenho do cérebro de decisão.** Meta original de ~10
   trades/dia (fixada em 2026-08-04 sem medição por trás) foi testada por 3
   frentes de mais edge (TA clássico julho, score contínuo, arbitragem
   estatística — todas negativas) e por amplitude pura (multi-setup
   hipotético somando toda a cesta) — **nenhum cenário chega perto de
   10/dia com líquido positivo, teto real medido é ~2-6/dia**. Ver
   `research/experiments/2026-08-16-portfolio-amplitude/results/README.md`.
   Decisão de número final da meta revisada pendente do Cleber — ver
   `NEXT_SESSION.md`. Runner Deno (`supabase/functions/ai-runner/`) já
   rodando em produção desde então (superou o "ainda não rodou contra o
   Supabase de verdade" que era a pendência real até 2026-08-05/17).
   **[2026-08-25] Reaberto via NVIDIA NIM Signal Discovery + cuOpt Fase A**
   — ver item do topo deste arquivo, detalhe em
   `research/experiments/2026-08-25-trilho2-nim-signal-discovery/hypothesis.md`
   e `research/experiments/2026-08-25-cuopt-portfolio-optimization/hypothesis.md`.
1. Limpeza de pipelines de preço mortos (código morto, não bloqueante).
2. **Decisão pendente do Cleber (roteamento de cripto)**: manter Binance
   direto pra cripto (exceto BTCUSD, que já vai por MetaAPI) ou reverter tudo
   pra MetaAPI — nenhuma mudança de código feita, aguardando resposta.
3. Vários produtos do catálogo do Marketplace ainda têm
   rating/reviews/vendas fabricados (só o item mais grave, 'strat-001', foi
   removido).
4. **[2026-08-10] Modelo financeiro reconstruído, commit pendente.**
   `projecao-financeira-5anos.xlsx` — 3 cenários mês a mês, preços reais da
   landing, comissão em todos os tiers, pacote de 6 alavancas pra lucro no
   Ano 1. CAC/conversão/rebate ainda são meta, não medição. Detalhe:
   `SESSAO_2026-08-10_MODELO_FINANCEIRO.md`.
5. **[2026-08-17] Ideia registrada, não iniciada: probabilidade de acerto
   calibrada por entrada.** Hoje o `confidence` exibido é heurística não
   calibrada (documentado no código), nunca medida contra resultado real.
   Se retomado: projeto de pesquisa novo (dado, validação out-of-sample,
   calibration curve/Brier score), mesmo escopo do Trilho 2 (hoje pausado).
   Sem próximo passo definido.
6. **[2026-08-18] Programa de Parceiros IB — falta aplicar B4.** B1/B2/B3
   completos (ledger, captura de `?ref=`, marcos do funil). B4 (job de
   apuração periódica) escrito e deployado, mas migration
   `20260818_schedule_partner_commission_accrual.sql` **não aplicada**
   (falta Cleber trocar secret real no SQL Editor). Falta também
   `subscribed_at` (precisa sistema de pagamento). Detalhe:
   `SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md`.
7. **[2026-08-18] Risco estrutural: cliente e servidor decidem fechar
   posição em paralelo, com lógicas independentes.** Safe Mode em DEMO já
   foi neutralizado (não protegia nada de verdade, matava só a UX — ver
   histórico), mas a decisão maior — se o cliente deve perder autoridade de
   fechar trade em LIVE — **ainda não foi tomada**. Detalhe:
   `SESSAO_2026-08-17_BUGS_EXECUCAO_REAL_24_7.md`.

## Convenções do projeto

- Nunca fabricar dado (preço, indicador, resultado de backtest) — sempre erro
  explícito quando não há fonte real. Disciplina histórica do projeto, várias
  sessões passadas encontraram e removeram mock disfarçado de real.
- **Corrigir registro financeiro corrompido nunca é um `UPDATE` silencioso.**
  Motivo (2026-08-18): um trade fechado a preço 0 por bug de feed foi
  corrigido via `UPDATE` direto em `ai_trades` sem nenhum rastro no banco —
  grave porque os trades vão ser mostrados a investidor, e um `UPDATE` sem
  rastro em dado financeiro é indistinguível de manipulação pra esconder
  prejuízo, mesmo feito com boa intenção. Fix estrutural: `ai_trades_audit_log`
  (trigger `AFTER UPDATE`, grava a linha inteira antes/depois de qualquer
  edição) + colunas `corrected_at`/`correction_reason`/`original_values` em
  `ai_trades` — ver `supabase/migrations/20260818_add_ai_trades_audit_trail.sql`.
  Regra daqui pra frente: sempre que possível, corrigir um bug de motor que
  corrompeu dado fechando/anulando com um **registro novo** (ex: trade de
  ajuste explícito), não reescrevendo o original. Quando editar o original
  for mesmo necessário, sempre preencher `correction_reason`/`original_values`
  na mesma operação, nunca depois. Limite conhecido: o log de auditoria vive
  no mesmo Postgres de produção, não é imutável contra quem tem acesso de
  `service_role` — pra "à prova de investidor" de verdade falta exportar
  snapshots periódicos pra um destino write-once fora do Supabase (não
  implementado).
- Nunca prometer edge sem validação estatística (amostra mínima, walk-forward
  sem look-ahead, custo real descontado, correção por múltiplos testes). Ver
  `AI_BRAIN_SPEC.md` seção 8.
- Comunicação sempre em português do Brasil.
- **Padrão de rigor exigido pelo Cleber**: operar neste projeto como
  especialista sênior em mercado financeiro quantitativo, ciência da
  computação, matemática e estatística — e reportar resultado real sempre,
  mesmo quando ruim ou constrangedor. Nunca inflar número, nunca esconder
  achado negativo, nunca apresentar "melhora" sem holdout/correção
  estatística por trás. Isto não é tom, é método: toda alegação de edge
  precisa vir com o dado que a sustenta (ou a ausência dele, declarada).
