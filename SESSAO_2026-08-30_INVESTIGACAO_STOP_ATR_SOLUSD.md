# Sessão 2026-08-30 — Investigação: por que SOLUSD (13 trades, 0 vitórias, -$77,67) foi removido, e a causa real encontrada

> **Resumo pra quem só quer o veredito**: a hipótese original ("stop ATR de
> candle 5m apertado demais pro ruído específico de SOLUSD") **NÃO se
> confirmou** com dado real. O padrão de perda rápida (stop em <1min) é
> **compartilhado por DOGUSD/DOTUSD/XRPUSD também** — não é exclusivo de
> SOLUSD. A causa real por trás do "SOLUSD respondeu por 57% do prejuízo" é
> outra, e foi encontrada e confirmada nesta sessão: um teto de segurança
> (`mt5SafetyMaxLots=20`) estrangula o tamanho de posição de qualquer cripto
> barata (DOGE/XRP/DOT) pra uma fração irrisória do alvo pretendido, tornando
> o MESMO padrão de perda financeiramente invisível nelas e financeiramente
> grave em SOLUSD (que, junto com BTCUSD/BTCXBN/XETUSD, é um dos poucos
> símbolos onde o dimensionamento funciona como projetado). **Não recomendo
> reintroduzir SOLUSD agora** — a causa real não foi corrigida, só ficou
> visível.

## Contexto

`assetBasket.ts` remove SOLUSD da cesta em 2026-08-30 com o seguinte
raciocínio registrado no código (não commitado ainda no momento desta
investigação):

> "diagnóstico via SQL direto em `ai_trades` [...] mostrou SOLUSD sozinho
> respondendo por 13/66 trades da sessão, 0 VITÓRIAS, -$77,67 (57% de TODO o
> prejuízo líquido da noite). [...] Isso é consistente com o stop dinâmico
> (calculado por ATR de candle de 5m) sendo SISTEMATICAMENTE apertado demais
> pro ruído de tick-a-tick real de SOLUSD nesta corretora/feed
> especificamente [...] Removido pendente de investigação dedicada".

Esta sessão é essa investigação dedicada, pedida explicitamente por um
handoff registrado em memória (não uma sessão de chat normal — instrução
recebida diretamente com o achado documentado acima e uma lista de
abordagens sugeridas).

## Metodologia — só dado real, nada fabricado

1. **`ai_trades` via Supabase REST** (`session_id =
   e7eef768-389b-4459-8831-40c57a32fb51`, a sessão citada no diagnóstico
   original) — todos os 68 trades da sessão, todos os 8 símbolos, com
   `entry_price`/`exit_price`/`stop_loss`/`quantity` (= notional em USD)/
   `net_pnl`/`entry_time`/`exit_time`/`ai_reasoning`.
2. **Candles reais da MetaAPI** via `/mt5-candles-history` (rota que nunca
   cai em dado simulado — confirmado `source: "metaapi"` em toda chamada,
   nunca `"SIMULATED"`/`"cache"`) — 521 candles de 1 minuto e 112 candles de
   5 minutos por símbolo, cobrindo a janela exata da sessão (02:35–11:15 UTC
   de 2026-08-30), para os 7 símbolos da cesta.
3. **Leitura literal do `ai_reasoning`** dos 13 trades de SOLUSD.
4. **Leitura do código-fonte** (`tools.ts`, `neuralBridge.ts`, `atr.ts`,
   `config.ts`) pra entender exatamente como stop/tamanho de posição são
   calculados, em vez de assumir.

Não havia fonte de bid/ask histórico persistido em lugar nenhum (só o tick
atual, em memória do processo, nunca salvo em disco/banco) — por isso a
hipótese de spread (abordagem 2 sugerida) **não pôde ser testada
retroativamente**, ver seção própria abaixo.

## Achado 1 — Hipótese original (ATR-5m tight demais pro ruído de SOLUSD) NÃO se confirma

Comparação do próprio ATR (fórmula Wilder, período 14, mesma do motor) em
1min vs 5min pros 7 símbolos da cesta, na mesma janela exata da sessão:

| Símbolo | ATR 1min (%) | ATR 5min (%) | Razão 5m/1m |
|---|---|---|---|
| BTCUSD  | 0,0160% | 0,0529% | 3,306x |
| XETUSD  | 0,0228% | 0,0699% | 3,061x |
| **SOLUSD**  | **0,0436%** | **0,1299%** | **2,981x** |
| DOTUSD  | 0,0618% | 0,1766% | 2,859x |
| XRPUSD  | 0,0480% | 0,1355% | 2,824x |
| DOGUSD  | 0,0441% | 0,1237% | 2,807x |
| BTCXBN  | 0,0368% | 0,0986% | 2,679x |

Sob passeio aleatório puro, essa razão seria ~√5 = 2,236x. **Todos os 7
símbolos** ficam acima disso (2,68x–3,31x) — não é uma anomalia de SOLUSD, é
um padrão da cesta inteira (esperado: ranges de candle capturam mais que
pura difusão, mesmo em ativo "normal"). SOLUSD está bem no meio do grupo
(2,981x é a 3ª razão mais BAIXA das 7, ou seja, se algo, o ATR de 5min de
SOLUSD é proporcionalmente **generoso** em relação ao seu próprio ruído de
1min, não apertado). **Não há evidência de que o candle de 5min sub-estime o
ruído de curtíssimo prazo de SOLUSD mais do que sub-estima o de qualquer
outro ativo da cesta.**

## Achado 2 — Hipótese de spread anormal: não testável com o dado disponível

`mt5Broker.ts` calcula `spreadPct` a cada tick, mas **nunca persiste** esse
valor — só existe em memória do processo, e some no próximo tick. `tools.ts`
devolve `spread_pago` pro LLM no momento da abertura, mas essa string também
não é gravada em `ai_trades` (não existe coluna pra isso). Não há como
reconstruir a série histórica de spread de SOLUSD na madrugada em questão
depois do fato — só um snapshot ao vivo, que não vale pra essa janela
passada. **Esta hipótese fica genuinamente não-testada, não descartada nem
confirmada** — se for investigar de verdade, precisa ser feito ao vivo (gravar
spread em toda leitura de cotação, comparar entre símbolos, dali pra frente).

## Achado 3 — O que os 13 `ai_reasoning` de SOLUSD realmente mostram

Lendo o texto literal de cada trade (não resumo, o texto salvo em
`ai_trades.ai_reasoning`):

- **Padrão recorrente: entrada NA direção de um movimento já esticado, bem
  na zona de suporte/resistência** — exatamente onde reversão/rejeição é
  estatisticamente mais provável, não menos. Trade 12: entra LONG com "Price
  exactly at resistance (0% distance)". Trade 13: entra LONG com
  "distanceToResistancePct=0.067" e `nearLevel=RESISTENCIA`. Ambos batem
  stop em ~46s e ~26s. Isso é um problema de **lógica de entrada**, não de
  medição de volatilidade.
- **Bug de leitura de percentual (já catalogado no handoff da sessão
  anterior) confirmado num trade de SOLUSD especificamente**: Trade 6 lê
  `changePct` de 0.191 como "19,1%" (erro de escala de 100x), inflando a
  força percebida da tendência que justificou a entrada.
- **Entrada dupla LONG+SHORT por erro, confirmada**: Trade 8 (LONG,
  07:11:26–07:16:59) e Trade 9 (SHORT, 07:12:02–07:13:19) ficaram abertas
  simultaneamente por ~1min11s — o mesmo bug já citado no handoff anterior,
  aqui com timestamp exato confirmado.
- **Reentrada mesmo após streak de perdas reconhecida**: Trade 9 cita
  literalmente "SHORT 5 seguidas perdas" no texto e abre mesmo assim (o fix
  do cooldown pra fechamento manual só foi commitado depois desta sessão,
  ver `768720d5a`).
- **5 dos 13 fechamentos foram `AI_SIGNAL`** (decisão do LLM, não stop
  mecânico) — ou seja, quase 40% das saídas não foram "o preço bateu o
  stop", foram o próprio modelo decidindo fechar rápido, o que também não é
  compatível com "o stop é mecanicamente apertado demais": em boa parte dos
  casos foi o modelo, não a trava de código, decidindo cortar.

## Achado 4 (NÃO fazia parte da hipótese original, mas é a causa real) — teto de segurança estrangula sizing de cripto barata

Comparando o notional (`quantity`) REAL de cada trade na mesma sessão:

| Símbolo | Notional médio real | Preço médio | Perda média/trade | Duração média | Duração mediana |
|---|---|---|---|---|---|
| BTCUSD  | $1.562,59 | ~77.600 | -$0,99  | 1084,6s | 966,4s |
| BTCXBN  | $1.440,27 | — | -$2,69 | 1335,1s | 1068,3s |
| XETUSD  | $1.319,90 | — | -$1,58 | 1414,0s | 1623,0s |
| **SOLUSD**  | **$1.199,87** | **$104,67** | **-$5,98** | **164,5s** | **46,1s** |
| XRPUSD  | $27,62 | $1,382 | -$0,41 | 52,1s | 49,4s |
| DOTUSD  | $15,87 | $0,800 | -$1,62 | 51,8s | 54,0s |
| DOGUSD  | $1,69 | $0,0843 | -$0,02 | 40,7s | 34,0s |

O alvo de exposição do código é **uniforme**: `mt5TargetNotionalUsd = $1200`
pra qualquer símbolo (`tools.ts:832`, comentário explícito confirma que isso
foi desenhado assim de propósito, justamente pra SOL/XET não ficarem presas
perto do mínimo). Mas o cálculo de lotes tem um teto de segurança
`mt5SafetyMaxLots = 20` (`config.ts:156`, default, sem override no `.env`
deste projeto) que age **antes** do alvo de $1200 quando o preço do ativo é
baixo o suficiente: `lots = min(targetNotional/preço, 20)`. Pra qualquer
ativo com preço abaixo de ~$60, os 20 lotes batem primeiro — e o notional
real vira `20 × preço`, não `$1200`. Confirmado batendo exatamente com o
preço médio real de cada ativo:
- DOGUSD: 20 × $0,0843 = **$1,686** (observado: $1,69)
- DOTUSD: 20 × $0,800 = **$16,00** (observado: $15,87)
- XRPUSD: 20 × $1,382 = **$27,64** (observado: $27,62)
- SOLUSD: 20 × $104,67 = $2.093 (acima do teto de $2200 de segurança
  absoluta só em casos extremos; na prática o alvo de $1200 vence primeiro
  pra SOL — por isso SOL SIM atinge o notional pretendido)

**Consequência**: o mesmo padrão de comportamento (0% de vitórias, fechamento
em segundos, stop dinâmico apertado) está presente em SOLUSD **e** em
DOGUSD/DOTUSD/XRPUSD — as durações médias/medianas dos 4 são todas na mesma
ordem de grandeza (35s–165s), bem diferente do cluster BTCUSD/BTCXBN/XETUSD
(966s–1623s, ~20-30x mais longo). Mas só em SOLUSD (e nos 3 símbolos de
notional "cheio") esse padrão vira dinheiro de verdade — em DOGE/DOT/XRP o
mesmo padrão está acontecendo, só que "grátis" (perdas de centavos) por causa
do teto de 20 lotes atropelando o dimensionamento pretendido. **SOLUSD não é
o ativo com o problema mais grave de comportamento — é o ativo onde um
problema (aparentemente) compartilhado pela cesta inteira ficou visível em
dólar.**

Nota lateral: o cluster BTCUSD/BTCXBN/XETUSD ficar preso 100% no stop
fallback fixo de 0,5% (nunca no stop dinâmico) também bate com o motivo
correto — o ATR% real desses 3 é baixo demais (BTCUSD 0,053% em 5min) pra
passar do piso mínimo do stop dinâmico depois de multiplicado, então SEMPRE
cai no fallback mais largo. Não foi possível reconciliar com 100% de certeza
o valor exato do piso usado nas 4 trades de SOLUSD que pegaram o caminho
dinâmico (ficaram abaixo do piso atual do `config.ts` lido nesta
investigação) — o código e os parâmetros mudaram várias vezes na mesma
madrugada (múltiplos commits), então é plausível que o processo rodando
naquela hora usasse uma versão anterior da constante. Não estou afirmando
saber o mecanismo exato dessa parte — só o padrão empírico (que é robusto,
apoiado em `ai_trades` + candle real, independente de qual constante estava
ativa).

## Conclusão

- Hipótese original (ATR-5m mal calibrado especificamente pra SOLUSD): **não
  confirmada** — dado real de candle mostra SOLUSD dentro do padrão normal
  da cesta.
- Hipótese de spread anormal: **não testável** retroativamente, dado não
  persistido.
- Causa real encontrada (não estava na hipótese original): **teto de
  segurança de 20 lotes (`mt5SafetyMaxLots`) neutraliza o alvo de exposição
  uniforme de $1200 pra qualquer ativo abaixo de ~$60**, fazendo
  DOGUSD/DOTUSD/XRPUSD operarem com notional irrisório (centavos a poucas
  dezenas de dólares) mesmo quando o mesmo padrão de perda rápida de SOLUSD
  está presente neles também. SOLUSD só "aparece" como pior porque é um dos
  poucos símbolos onde o dimensionamento funciona como projetado.
- **Recomendação**: manter SOLUSD fora da cesta por enquanto — a causa real
  (aparentemente compartilhada pela cesta, não específica de SOLUSD) não foi
  corrigida, só ficou invisível nos outros símbolos por um bug de sizing
  separado. Reintroduzir SOLUSD sem mexer em mais nada provavelmente
  reproduziria o mesmo resultado. Dois itens valem decisão do Cleber daqui
  pra frente, sem que eu tenha mudado nada sozinho:
  1. Corrigir o teto de 20 lotes pra ativos de preço baixo (ex: teto em
     notional, não só em lotes) — sem isso, DOGUSD/DOTUSD/XRPUSD nunca vão
     refletir o resultado real da estratégia neles, só um resultado
     artificialmente pequeno.
  2. Investigar por que o caminho de stop DINÂMICO (SOL/DOGE/DOT/XRP, quando
     ativo) fecha em segundos tão consistentemente — os `ai_reasoning`
     revisados aqui sugerem que parte disso é qualidade de entrada (comprar
     força/vender fraqueza bem na zona de suporte/resistência, onde reversão
     é mais provável), não só o tamanho do stop em si.
