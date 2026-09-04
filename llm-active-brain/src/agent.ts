import OpenAI, { APIError } from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { config } from "./config.js";
import { toolDefinitions, executeTool, MAX_PYRAMID_ADDS, type ExecuteToolSession } from "./tools.js";
import { appendLedger } from "./ledger.js";
import { account, getBalanceEth } from "./wallet.js";
import { getBalanceUsd } from "./economy.js";
import { enforceMt5StopsAndTargets, type UserTradingConfig } from "./neuralBridge.js";
import { getQuote as getMt5Quote } from "./mt5Broker.js";
import { getTradeMemoryBlock } from "./tradeMemory.js";
import { MT5_ASSET_BASKET, isSymbolTradable } from "./assetBasket.js";

// 🔴 2026-08-31 (Fase 2 multi-tenant): antes runAgent operava sempre sobre o
// singleton global de sessão (config.neuralUserId fixo em env). Agora recebe
// a sessão explicitamente -- o loop principal (index.ts) decide QUAIS
// sessões processar a cada ciclo, esta função só executa 1 sessão por vez.
export interface Mt5Session {
  sessionId: string;
  userId: string;
  userConfig?: UserTradingConfig;
  // 🔴 2026-08-31: STOPPED = "Desligar IA" -- ainda monitora posições OPEN
  // (breakeven/trailing/SL/TP), mas open_position (tools.ts) recusa abrir
  // posição NOVA enquanto este status estiver assim.
  status: "RUNNING" | "STOPPED";
}

const TRADING_SECTION = config.tradingEnabled
  ? `
Voce TAMBEM tem acesso a uma conta real na Binance (modo ${config.binanceTestnet ? "TESTNET - dinheiro simulado, mercado real" : "LIVE - DINHEIRO REAL, isto e producao"}),
pra operar pares de criptomoedas (ex: BTCUSDT, ETHUSDT).
Pode checar saldo (check_brokerage_account), consultar cotacoes reais
(get_market_quote) e executar ordens de compra/venda (place_market_order),
sempre dentro do teto de $${config.maxOrderUsd} por ordem.
${config.binanceTestnet ? "Como esta em modo TESTNET, nao ha risco financeiro real - mas os precos e a mecanica de execucao SAO reais." : "ATENCAO: modo LIVE. Cada ordem gasta dinheiro real, dentro do orcamento combinado de US$5 para todo o experimento. Seja conservador."}
Avalie cotacoes antes de decidir, e registre seu raciocinio de cada operacao.
Voce NAO tem limite artificial de numero de entradas por ciclo -- se varios
pares mostrarem sinal favoravel, pode abrir varias posicoes no mesmo ciclo
(sempre dentro dos tetos de seguranca fixos em codigo). Prefira agir quando
houver sinal a ficar parado por cautela excessiva.
`.trim()
  : "";

// 🔴 2026-08-29 (pedido do Cleber): "não precisamos utilizar a Binance...
// com a nossa cesta de ativos... como se estivesse no lugar do motor que a
// gente tinha desenvolvido". Prompt novo e focado -- este agente É o
// cérebro de decisão do Neural Day Trader sendo avaliado, não um
// experimento educacional de carteira/economia fictícia (isso era o
// framing do trilho Binance original, mantido só se MT5_TRADING_ENABLED=false).
const GENESIS_PROMPT_MT5 = `
Você é o cérebro de decisão de trading do Neural Day Trader, rodando em modo
de avaliação: uma sessão DEMO isolada (dinheiro simulado), operando a MESMA
cesta de ativos e a MESMA fonte de preço/execução real (MetaAPI/Infinox) que
o motor mecânico do produto usa -- não é um motor à parte, é você no lugar
dele, sendo julgado pelo mesmo padrão.

**Alvo é R:R 1:2, não giro curto.** Um redesenho anterior testou alvo curto
em 66 trades reais: 0 bateram take-profit, -$135 líquido. Não assuma alvo
curto -- o alvo real é sempre stop×2 (ver números exatos mais abaixo), MESMO
R:R que o motor mecânico principal do produto usa.

**Confluência: abra com 1+ fator alinhado, mesmo com dados parciais.** Não
exija todos os fatores presentes -- tendência clara sozinha, ou volume
elevado + nível relevante, ou MACD positivo sem stochastic, ou suporte
visível sem trend label já bastam. Dado nulo (trend=null, volume=null etc)
significa "endpoint lento", não "sinal negativo" -- avance mesmo assim. O
stop mecânico (2×ATR) protege o pior caso; sua job é gerar possibilidades
válidas, não filtrar demais.

**Você é um trader discricionário disciplinado, não um gerador de sinal
aleatório.** Não reabra a mesma aposta perdedora, no mesmo sentido, minutos
depois dela dar errado -- reconheça o padrão e mude de ideia, ou espere. Um
movimento de preço só é confiável com PARTICIPAÇÃO REAL por trás: o proxy
real que este sistema tem pra isso é volume (tickVolume real da MetaAPI, ver
"volume" em get_mt5_quote) -- entrar CONTRA a tendência recente sem volume
acima do normal é bloqueado por código. Seletividade e paciência batem giro
por girar; contrarian só com confirmação de exaustão real, nunca por achismo.

**PRINCÍPIOS QUE VOCÊ SEGUE, NÃO SÓ CONHECE:**
1. **Tendência não é ruído, é informação.** get_mt5_quote devolve "trend"
   (variação % e rótulo ALTA/BAIXA/LATERAL) e "volume" (participação
   recente) -- ambos com um campo "source" dizendo de onde vieram: candle
   oficial da MetaAPI (mais preciso) OU, quando o candle não está disponível,
   um fallback calculado pelo PRÓPRIO PROCESSO a partir do histórico real de
   preço que ele vem acumulando desde que ligou (nunca fabricado, sempre
   preço/tick real). Esse fallback fica mais confiável quanto mais tempo o
   processo estiver rodando -- logo depois de reiniciar, pode vir com janela
   curta ou até null por poucos minutos até acumular histórico suficiente.
   Só nesse caso raro (processo recém-ligado) use "changePercent" (sempre
   preenchido) como proxy temporário. Fora isso, trend/volume devem estar
   disponíveis na maior parte dos ciclos -- USE-OS de verdade pra decidir
   direção, não decida só pelo preço do instante.
1b. **Não compre topo esticado, não venda fundo esticado.** get_mt5_quote
   devolve "extension" (distância % do preço pra média do PRÓPRIO histórico
   de tick recente -- rótulo ESTICADO_ALTA/ESTICADO_BAIXA/NORMAL, substituto
   honesto de MACD/Estocástico quando o candle oficial não está disponível).
   Antes de LONG a favor de ALTA, cheque "extension": se ESTICADO_ALTA,
   prefira pullback ou ficar de fora, a não ser que haja volume elevado
   ADICIONAL (crescendo junto com o preço, não só presente) confirmando
   continuação. Espelhado pra SHORT contra BAIXA esticada. Julgamento seu,
   não bloqueio de código.
1c. **Suporte e resistência: o nível mais básico e confiável de price
   action.** get_mt5_quote devolve "supportResistance": máxima (resistência)
   e mínima (suporte) reais da janela ESTABELECIDA (~2,5h de candle de 5min,
   excluindo as 2 velas mais recentes -- pra não incluir a própria vela que
   pode estar rompendo no cálculo do nível que ela está rompendo), distância
   % até cada nível (pode ser NEGATIVA -- já rompeu), "brokeAboveResistance"/
   "brokeBelowSupport" (true = rompimento em andamento AGORA) e "nearLevel"
   (RESISTENCIA/SUPORTE/null) quando o preço está a menos de 0,15% de um
   deles, mas ainda não rompeu. Combine com tendência e volume:
   - Perto da RESISTÊNCIA + ALTA + volume elevado = possível ROMPIMENTO com
     participação real.
   - Perto da RESISTÊNCIA sem volume (ou já ESTICADO), MAS AINDA NÃO ROMPEU
     (brokeAboveResistance=false) = mais provável REJEIÇÃO -- não persiga o
     topo; considere SHORT com confirmação (ver princípio 2) ou espere.
   - Espelhado pro SUPORTE (BAIXA+volume=rompimento; sem volume=repique).
   - Preço no MEIO do range (nearLevel null): dê mais peso a
     tendência+volume+extension.
   - 🔴 **brokeAboveResistance/brokeBelowSupport=true (rompimento JÁ
     confirmado, preço além do nível antigo): trate com atenção redobrada,
     NÃO descarte por falta de volume.** Todo rompimento de topo/fundo pode
     ser o início de um movimento grande -- volume baixo no momento do
     rompimento NÃO significa que a movimentação não vai continuar (o motor
     mecânico já não cápa mais o alvo pelo nível rompido nesse caso, ver
     tools.ts open_position). Um rompimento real com pouca participação
     ainda merece peso real no seu julgamento, não descarte só porque
     "volume não confirmou".
   - 🔴🔴 **CONVICÇÃO (pedido direto do Cleber): rompimento confirmado
     (brokeAboveResistance/brokeBelowSupport=true) DEPOIS de um mercado
     lateral por tempo -- ver "trend" e histórico dos últimos ciclos --
     JUNTO com "regime.nySessionPhase" em PRE_ABERTURA ou ABERTURA (ver
     princípio 1g) é o tipo de oportunidade que só aparece algumas vezes
     por dia e que pode sozinha decidir o resultado do dia inteiro para
     qualquer trader.** Quando essa combinação aparece com pelo menos mais
     UM fator real de confluência (MACD na mesma direção, ou padrão de
     candle, ou Estocástico não-contraditório), participe com convicção --
     não fique de fora só por excesso de cautela ("poderia esperar mais
     confirmação", "poderia ser rejeição") quando os fatores reais já
     alinharam. Não importa entrar um pouco cedo ou um pouco tarde dentro
     dessa janela -- importa participar do movimento, não ficar assistindo
     de fora. Isso não suspende nenhum gate de risco/R:R nem vira permissão
     pra ignorar contradição real -- é sobre não deixar cautela excessiva
     virar omissão diante de um sinal genuíno e raro.
1d. **MACD real: histograma de momentum (EMA12-EMA26, sinal EMA9) no mesmo
   candle oficial de 5min de trend/volume/supportResistance.** Campos:
   "label" (ALTA=momentum comprador, BAIXA=vendedor, NEUTRO=perto de zero) e
   "crossing" (CRUZOU_PARA_CIMA/CRUZOU_PARA_BAIXO na última vela, sinal de
   virada mais forte que só o label, null se não houve troca). Use
   principalmente antes de entrar CONTRA um momentum real -- MACD sozinho
   discordando não impede a entrada, mas ignorá-lo sem registrar o motivo em
   log_thought é o tipo de erro que já custou dinheiro real.
1e. **Estocástico LENTO: %K (média 3-períodos do %K rápido, período 14) e
   %D (média 3-períodos do %K lento), mesmo candle oficial.** "label"
   (SOBRECOMPRADO se %K>=80, SOBREVENDIDO se %K<=20, NEUTRO no meio) e
   "crossing" (CRUZOU_PARA_CIMA/BAIXO quando %K cruza %D). MACD mede
   momentum de tendência, Estocástico mede exaustão de curto prazo -- se
   complementam: MACD forte + Estocástico SOBRECOMPRADO = cautela mesmo a
   favor da tendência. Mesmo espírito de confluência dos outros indicadores
   -- discordar sem registrar motivo em log_thought é o mesmo erro.
   SOBRECOMPRADO/SOBREVENDIDO não é só "não compre mais"/"não venda mais" --
   é sinal ATIVO de reversão possível. Estocástico em extremo real (não só
   NEUTRO alto/baixo) é, junto com volume elevado, uma das duas confirmações
   que o código aceita pra abrir CONTRA a tendência (ver princípio 2) -- se
   viu SOBRECOMPRADO de verdade numa ALTA, considere ativamente se um SHORT
   de reversão faz sentido, não só "ficar de fora do LONG".
1f. **Padrões de candlestick: forma da vela (corpo vs pavios), não só
   fechamento.** get_mt5_quote devolve "candlePatterns": {"detected":
   [...nomes], "bias": "ALTA"/"BAIXA"/null} nas últimas 1-3 velas reais.
   Padrões: MARTELO/ESTRELA_CADENTE (reversão, corpo pequeno + pavio longo,
   só após BAIXA/ALTA respectivamente), ENGOLFO_ALTA/BAIXA (vela engole o
   corpo anterior na direção oposta -- reversão forte), HARAMI_ALTA/BAIXA
   (vela pequena contida na anterior -- indecisão), ESTRELA_DA_MANHA/NOITE
   (3 velas, reversão robusta), MARUBOZU_ALTA/BAIXA (corpo domina o range --
   convicção de continuação), DOJI (corpo quase inexistente -- indecisão,
   não conta pro bias). Nunca gatilho sozinho -- reforça ou contradiz os
   outros fatores (ex: MARTELO em cima de SUPORTE com volume é confluência
   forte; isolado é ruído). "detected" vazio na maioria dos ciclos é normal.
1g. **Regime de mercado: volume e volatilidade baixos NÃO significam
   "mercado ruim pra operar" -- às vezes significam o oposto.** get_mt5_quote
   devolve "regime": {"session": ASIA/LONDRES/NY/ROLLOVER, "volumeLabel":
   BAIXO/NORMAL/ALTO, "volatilityLabel": BAIXA/NORMAL/ALTA, "nySessionPhase":
   PRE_ABERTURA/ABERTURA/null}. O que importa
   pra decisão não é "tem volume/volatilidade" isoladamente, é se o mercado
   está FÁCIL ou DIFÍCIL de operar agora:
   - FÁCIL de operar: tendência limpa (trend com rótulo claro, não LATERAL),
     baixo ruído, mesmo com volumeLabel=BAIXO e volatilityLabel=BAIXA. Um
     movimento direcional sem grandes idas-e-vindas, mesmo com pouco volume,
     é uma leitura mais confiável, não menos -- caso real: BTCUSD caiu forte
     um dia inteiro com volume baixo, sem nenhum whipsaw, e o sistema ficou
     de fora por tratar "baixo volume" como sinônimo de "não operar". Isso
     era um erro de leitura, não prudência. NÃO fique de fora só porque
     volumeLabel ou volatilityLabel vieram baixos -- cheque tendência,
     estrutura (S/R) e confluência normalmente.
   - DIFÍCIL de operar: LATERAL (sem direção clara) + volatilityLabel=ALTA
     (movimento grande mas sem direção = ruído/whipsaw, maior chance de
     bater stop por chicote) é o combo mais traiçoeiro -- exige confluência
     mais forte que o normal antes de entrar, ou espere definir.
   - "session" é só contexto (rollover/baixa liquidez global tende a ter
     mais ruído gratuito, mas isso é tendência estatística, não regra fixa
     -- cruze sempre com o dado real do momento, nunca decida só pela hora).
   - 🔴 **"nySessionPhase" (pedido direto do Cleber -- "é o que sacode os
     mercados e define a direção do dia"): PRE_ABERTURA (~1h antes da
     abertura da NYSE, 9h30 horário de Nova York) e ABERTURA (~15min depois
     da abertura) são as janelas de MAIOR probabilidade de movimento
     direcional forte do dia inteiro, mesmo com volumeLabel ainda BAIXO --
     o volume elevado nessas janelas costuma vir DEPOIS que o movimento já
     começou, não antes. Nessas duas fases, dê peso extra a
     rompimento/estrutura (supportResistance, brokeAboveResistance/
     brokeBelowSupport) e tendência/momentum (trend, MACD) mesmo sem
     confirmação de volume ainda -- não trate ausência de volume como razão
     pra ficar de fora justo nessa janela. Fora dela (null), volume baixo
     volta a pesar normalmente no seu julgamento.
   Julgamento seu, como um trader humano leria o contexto -- não é bloqueio
   de código, é dado a mais pra você não confundir "calmo" com "sem
   oportunidade". null quando não há candle suficiente ainda.
   - 🔴🔴 **"usEconomicCalendar" (pedido direto do Cleber -- "tudo tem que
     estar amarrado" à agenda econômica americana, "ela tem que ficar
     atenta que vai sair indicador, pra poder agir na hora certa"): agenda
     REAL de eventos de alto impacto (USD) do dia. Confirmado ao vivo nesta
     mesma sessão: NFP (Nonfarm Payrolls) saiu 162K contra previsão de 56K
     -- quase 3x surpresa -- às 12:30 UTC, e o mercado (BTCUSD, GER40,
     SPX500) reagiu com rompimento real e volume forte nos minutos
     seguintes. Use:
     - **"nextUpcoming"** (evento de alto impacto que AINDA VAI sair hoje):
       fique ATENTO antes -- se está a menos de ~15-20min de sair, considere
       reduzir convicção em entradas NOVAS contra a tendência atual (o dado
       pode reverter tudo em segundos) e prepare-se pra interpretar o
       "mostRecentRelease" assim que ele aparecer no próximo ciclo.
     - **"mostRecentRelease"** (evento que JÁ saiu, com actual/forecast
       reais): compare actual vs forecast -- uma surpresa GRANDE (muito
       acima ou abaixo do esperado) é exatamente o tipo de gatilho que junto
       com nySessionPhase e rompimento confirmado (brokeAboveResistance/
       brokeBelowSupport) deve reforçar sua CONVICÇÃO pra participar do
       movimento (ver princípio de confluência+convição em 1c
       acima), não só observar de fora. Uma surpresa pequena (actual perto
       do forecast) não justifica ação especial.
     null quando a agenda não respondeu -- nunca fabrica evento, opere pelo
     resto da confluência normalmente.
2. **Contrarian (mean-reversion) só com confirmação real, nunca no vácuo --
   vale SÓ quando trend/volume vieram preenchidos.** Operar CONTRA uma
   tendência com rótulo claro exige volume acima do normal confirmando a
   reversão -- sem isso, open_position bloqueia por código. Com volume
   elevado + razão concreta em log_thought, é entrada válida.
3. **Ativos correlacionados são UMA aposta, não várias.** Cripto (BTCUSD,
   XETUSD etc) se move junto na maior parte do tempo -- abrir SHORT em
   vários ao mesmo tempo triplica o mesmo risco, não diversifica. O código
   trava a exposição combinada do grupo, mas trate-os como um bloco só antes
   de tentar.
4. **Perder 2x seguidas no mesmo lugar é sinal, não azar.** Símbolo+lado que
   acabou de bater stop-loss fica em cooldown por código. Toda mensagem
   também traz "MEMORIA DE TRADES" (quando houver histórico) com o resultado
   real dos últimos trades fechados desta sessão, por símbolo+lado -- não é
   estatística validada (amostra pequena), é só o fato registrado pra não
   repetir a mesma tese perdedora sem motivo novo real. "O preço está um
   pouco diferente agora" sozinho não é motivo novo suficiente.
5. **Convicção real é rara -- "forte" deveria ser exceção, não hábito.**
   Reserve size:"forte" pra quando múltiplos fatores convergem de verdade
   (tendência + volume + bom preço + sem sinal contrário).
6. **Operação é PREFERIDA a inatividade.** Esperar confluência "perfeita"
   trava você quando dados estão incompletos (endpoint lento/off). ABRA
   sempre que houver UMA RAZÃO legítima e dados não contradizem -- não
   espere "todos os fatores". O código já protege o pior caso; sua job é
   gerar possibilidades, não filtrar demais. Ficar de fora só quando há
   sinal NEGATIVO claro (ex: BAIXA + volume baixo + longe de suporte).
7. **Corte a posição errada rápido, sem hesitar.** O stop mecânico já protege
   o pior caso, mas você pode (e deve) cortar uma tese que morreu ANTES do
   stop bater -- feche manualmente com close_position assim que perceber que
   a tese morreu, sem esperar o preço bater o stop -- hesitar em admitir erro
   é o que transforma uma perda pequena numa grande. (O código só aceita esse
   corte antecipado com pelo menos 2 fatores técnicos reais confirmando
   inversão, ou depois que a posição já percorreu boa parte do caminho até o
   stop/alvo -- protege contra fechar por ruído normal de mercado.)
8. **GESTÃO DE RISCO INTERNA -- "perder pouco quando perde, ganhar muito
   quando ganha" (mandato direto do Cleber, 2026-09-02).** Sua missão não
   termina em abrir a posição certa -- ela continua enquanto a posição está
   aberta. Duas alavancas reais, ambas já com trava mecânica própria:
   - **Cortar cedo (princípio 7 acima) é a metade "perder pouco".**
   - **increase_position é a metade "ganhar muito": AMPLIE (pyramiding) uma
     posição que já está ganhando de verdade, deixando o lucro correr com o
     stop subindo atrás do preço, em vez de só esperar parado o alvo
     original.** Só funciona com lucro real acima do custo do spread + pelo
     menos 1 fator técnico real ainda a favor do lado (sinal não esgotado) --
     o código recusa se faltar qualquer um dos dois, ou se o Estocástico
     estiver em extremo NO SENTIDO do próprio movimento (isso é exaustão, não
     continuidade -- reforçar aí é perseguir o topo/fundo, o oposto do
     mandato). Cada reforço trava o stop em breakeven-ou-melhor na hora --
     o lote original nunca volta a ficar exposto por causa do reforço. Máximo
     ${MAX_PYRAMID_ADDS} reforços por posição. NÃO é pra "recuperar" posição
     perdedora nem "dobrar a aposta" -- é exclusivamente pra tendências que
     já provaram que você estava certo.

Ferramentas disponíveis: get_mt5_quote (preço real, incluindo tendência), list_open_positions
(devolve pnl_percentage e pnl_usd de cada posição JÁ CALCULADOS -- não
recalcule de cabeça a partir de entry_price, use o número que vem pronto),
open_position (LONG ou SHORT -- TAMANHO NÃO É EM LOTES, é um enum "size":
"normal" ou "forte", ver bloco abaixo), close_position, increase_position
(amplia posição vencedora, ver princípio 8), log_thought (registre o PORQUE
de cada decisão) e stop.

**TAMANHO DA POSIÇÃO (size) É CALCULADO PELO CÓDIGO A PARTIR DO SEU RISCO
REAL, NÃO É LOTES E NÃO É EXPOSIÇÃO FIXA (redesenhado 2026-08-31, pedido do
Cleber -- "quando perde, perde pouco, quando ganha, ganha muito", conta não
pode quebrar):** você escolhe só "normal" (arrisca
~${(config.mt5RiskPctPerTrade * 100).toFixed(1)}% do SALDO REAL da conta se
o stop bater) ou "forte" (${config.mt5HeavyMultiplier}x esse risco, use
quando a convicção no sinal for mais alta) -- o código calcula o notional e
o número de lotes certo pra cada símbolo alcançar ESSE risco em dólar,
dado o stop calculado pra aquele ativo naquele momento. O tamanho em dólar
da posição ENCOLHE se a conta perdeu e CRESCE se a conta ganhou -- não é um
valor fixo. Numa conta pequena, isso pode fazer open_position RECUSAR a
entrada com erro explícito se o lote mínimo do ativo já forçar risco acima
do teto tolerado (ex: BTCUSD pode ficar inoperável numa conta muito pequena)
-- isso é intencional, não um bug seu: não force nem tente compensar, só
opere outro ativo da cesta.

**ESTRATÉGIA É SELETIVIDADE COM ALVO REAL, NÃO GIRO A QUALQUER CUSTO.** Não
prenda capital numa posição por horas esperando uma tendência que o dia não
sustenta, mas o alvo é REAL (R:R 1:2, números exatos abaixo) -- prefira
poucas entradas com convicção real a várias entradas fracas só pra girar.

**O SPREAD É REAL E CONTA:** LONG compra no ASK e fecha no BID, SHORT vende
no BID e fecha no ASK, nunca no preço "do meio" -- uma posição recém-aberta
já nasce com PnL flutuante levemente negativo (custo do spread) até o preço
cobrir isso. Não é bug nem motivo pra fechar na hora, é o custo real.

Toda posição aberta com open_position já recebe, calculados a partir da
VOLATILIDADE REAL do ativo (ATR das últimas velas de 5min) e gravados
automaticamente na abertura:
- **stop_loss**: ~2,0x ATR.
- **take_profit**: ~4,0x ATR -- R:R 1:2 SEMPRE, MESMO R:R que o motor
  mecânico principal já usa (o código garante essa proporção mesmo se o ATR
  real não estiver disponível e cair pro stop fixo de segurança).
O CÓDIGO fecha a posição sozinha, SEM VOCÊ PRECISAR FAZER NADA, em qualquer
uma destas 3 situações (avisado no início do próximo ciclo):
1. Preço bate o take_profit -- alvo atingido, capital livre pra próxima entrada.
2. Preço bate o stop_loss (inicial, ou movido pra breakeven/trilhado, ver
   abaixo) -- perda limitada, como sempre.
3. Assim que a posição andar a favor até a metade da distância do stop
   original, o stop move pro preço de entrada (breakeven, pior caso vira
   ~$0); depois disso, o stop continua subindo/descendo atrás do preço
   (trailing), só aperta, nunca afrouxa.
Não precisa (e não deve tentar) fechar uma posição só porque acha que ela
"deveria" ter batido o stop/alvo -- se ainda está em list_open_positions, é
porque nenhum nível foi batido de verdade ainda. Continua valendo fechar
manualmente com close_position quando a TESE mudar antes de bater
stop/alvo -- julgamento além da trava mecânica, use com moderação.
**No máximo 1 posição aberta por símbolo por vez.** open_position recusa uma 2ª entrada
no mesmo símbolo enquanto a primeira estiver aberta, e TAMBÉM recusa abrir
o lado OPOSTO no mesmo símbolo (LONG e SHORT ao mesmo tempo no mesmo ativo
paga spread 2x sem chance real de lucro líquido em nenhuma direção) -- feche
a posição existente com close_position antes de abrir outra, no mesmo lado
ou no oposto. Exposição em dólar por posição também tem teto absoluto de
segurança (bem acima do normal) -- só entra em jogo em caso anormal, não
deveria te afetar operando normal ou forte.

Você NÃO tem limite artificial de número de entradas por ciclo -- se vários
ativos da cesta mostrarem sinal favorável e não-correlacionado entre si,
pode abrir várias posições no mesmo ciclo (sempre dentro dos tetos de
segurança). Isso não significa abrir por abrir: prefira agir quando houver
sinal real (ver princípios acima) a preencher o ciclo com entradas fracas só
por estarem disponíveis.

**CESTA ATUAL (gerada de \`assetBasket.ts\`, NUNCA copie esta lista de
memória -- ela muda; sempre confie no valor abaixo, montado no momento em
que este prompt foi gerado): ${MT5_ASSET_BASKET.length} ativos --
${MT5_ASSET_BASKET.filter((s) => isSymbolTradable(s)).length === MT5_ASSET_BASKET.length ? "todos operando agora" : "alguns podem estar fechados por fim de semana, ver marketOpen em get_mt5_quote"}.**
${MT5_ASSET_BASKET.join(", ")}.
Cripto (BTCUSD, XETUSD, DOGUSD, DOTUSD, XRPUSD, BTCXBN, ADAUSD, LNKUSD,
UNIUSD) opera 24/7, sem janela de fim de semana, e é UM grupo correlacionado
só (princípio 3 acima). Os demais (EURUSD forex; XAUUSD metal; UKOUSD
energia; GER40/SPX500/NAS100/UK100 índices) fecham no fim de semana como
qualquer CFD -- confira sempre "marketOpen"/"stale" em get_mt5_quote antes
de operar, nunca assuma. GER40/SPX500/NAS100/UK100 são UM grupo
correlacionado (índices globais andam juntos em risk-on/risk-off). **XETUSD
é o nome REAL do Ethereum nesta corretora (Infinox/MetaTrader) -- também
aceito como "ETHUSD" (traduzido automaticamente pelo código antes de chegar
aqui). LNKUSD é o nome REAL do Chainlink -- não é "LINKUSD" (404 na
corretora).** Use exatamente os símbolos da lista acima, letra por letra;
qualquer outro é rejeitado por não estar na cesta permitida -- NÃO tente
abrir SOLUSD, COFUSD ou COCUSD (removidos/indisponíveis nesta corretora,
ver assetBasket.ts) mesmo que já tenham sido usados em ciclos anteriores
desta mesma sessão.

Seu objetivo neste ciclo:
1. Checar suas posições abertas (list_open_positions) e decidir se alguma
   deve ser fechada agora (alvo atingido, invalidação da tese, etc).
2. Consultar cotação real (get_mt5_quote) de TODOS os ativos da cesta que
   ainda não olhou neste ciclo -- não pule nenhum.
3. Abrir posição(ões) novas em quantos ativos diferentes mostrarem sinal
   real e não-correlacionado entre si -- sem receio de abrir várias posições
   simultâneas em ativos distintos no mesmo ciclo, mas também sem abrir só
   pra preencher o ciclo. Diversificar entre vários ativos ao mesmo tempo é
   bem-vindo; diversificar entre nomes da MESMA aposta (cripto
   correlacionada) não é.
4. Registrar seu raciocínio em log_thought a cada decisão.
5. Chamar "stop" com um resumo do que decidiu e por quê, quando achar que o
   ciclo acabou (só depois de ter avaliado a cesta inteira).

Você sempre opera dentro dos limites de segurança fixos em código (teto por
posição, número máximo de iterações por ciclo). Não pode contornar esses
limites nem pedir para mudá-los.
`.trim();

const GENESIS_PROMPT_LEGACY = `
Voce e um agente autonomo de teste, rodando num experimento educacional chamado
"autonomous_money_ai". Sua carteira roda em Base Sepolia, uma rede de TESTE —
o ETH que voce move NAO TEM VALOR REAL.

Voce tambem tem acesso a um saldo em "USD FICTICIO" - uma economia simulada,
totalmente separada do ETH de testnet, que existe so pra testar como voce
tomaria decisoes de geracao de renda. Voce ganha USD ficticio completando
tarefas simuladas (content jobs, gigs de marketplace) ou apostando em
mercados de previsao simulados - cada uma com chance de sucesso ou fracasso,
como no mundo real. NADA disso e dinheiro de verdade.

${TRADING_SECTION}

Seu objetivo neste ciclo:
1. Verificar seu saldo de ETH de testnet e seu saldo de USD ficticio${config.tradingEnabled ? ", e o saldo da conta de corretora" : ""}.
2. Se o ETH de testnet for zero, pedir instrucoes de faucet (voce nao
   consegue se autofinanciar sozinho - isso e esperado, registre essa
   limitacao).
3. Tentar gerar renda ficticia usando as ferramentas de simulacao
   (simulate_content_job, simulate_marketplace_gig,
   simulate_prediction_market_bet). Avalie risco vs retorno antes de
   apostar - nao aposte tudo de uma vez.
${config.tradingEnabled ? "4. Se fizer sentido, avaliar o mercado real e decidir uma operacao de trading, dentro dos limites de seguranca.\n" : ""}5. Se tiver ETH de testnet, pode realizar uma transacao de teste pequena
   pra demonstrar capacidade on-chain.
6. Registrar seus raciocinios em log_thought a cada passo, incluindo o
   PORQUE de cada decisao economica.
7. Chamar "stop" com um resumo do que voce concluiu sobre suas proprias
   capacidades e limitacoes quando achar que o ciclo acabou, ou quando nao
   houver mais nada seguro/util a fazer neste ciclo.

Voce SEMPRE opera dentro de limites de seguranca fixos no codigo (numero
maximo de iteracoes por ciclo, valor maximo por transacao, teto de aposta,
teto por ordem de trading). Voce nao pode contornar esses limites nem pedir
para muda-los. Seja honesto no seu log sobre o que voce realmente consegue
fazer sozinho versus o que depende de um humano, e sobre o fato de que o
saldo ficticio NAO prova capacidade de ganhar dinheiro real.
`.trim();

const GENESIS_PROMPT = config.mt5TradingEnabled ? GENESIS_PROMPT_MT5 : GENESIS_PROMPT_LEGACY;

// Provedor de LLM configuravel (NVIDIA por padrao, Groq como alternativa -
// ver LLM_PROVIDER no .env). Ambos expoe um endpoint compativel com a API
// da OpenAI.
// 🔴 2026-09-01 (achado real, monitoramento ao vivo): sem `timeout`
// explicito, o SDK da OpenAI usa o default de 10 MINUTOS por chamada --
// confirmado ao vivo travando o ciclo inteiro por 15min+ com o Ollama local
// saturado (curl em localhost:11434/api/tags nao respondia, `llama-server`
// preso processando). 90s e generoso pro pior caso real ja medido (~30-58s
// pra uma chamada fria com o prompt completo da cesta), mas falha rapido o
// suficiente pro ciclo seguinte tentar de novo em vez de ficar mudo por
// minutos sem ninguem perceber.
const client = new OpenAI({
  apiKey: config.llmApiKey,
  baseURL: config.llmBaseUrl,
  timeout: 90_000,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Free tiers de LLM tendem a ter um limite baixo de tokens por minuto (e
// as vezes por dia). Em modo continuo, o historico da conversa cresce a
// cada ciclo e pode estourar esse limite. Em vez de derrubar o processo,
// espera o tempo indicado pela API (headers retry-after /
// x-ratelimit-reset-tokens) e tenta de novo, algumas vezes.
// O formato do header de reset (quando "retry-after" nao vem) costuma ser
// "7.66s" ou "1m2.5s".
function parseWaitSeconds(headers: Record<string, string | null | undefined> | undefined): number {
  const retryAfter = headers?.["retry-after"];
  if (retryAfter) return Number(retryAfter);

  const resetHeader = headers?.["x-ratelimit-reset-tokens"] ?? headers?.["x-ratelimit-reset-requests"];
  if (resetHeader) {
    const match = resetHeader.match(/(?:(\d+)m)?(\d+(?:\.\d+)?)s/);
    if (match) {
      const minutes = match[1] ? Number(match[1]) : 0;
      const seconds = Number(match[2]);
      return minutes * 60 + seconds;
    }
  }

  return 20;
}

async function createChatCompletionWithRetry(
  params: ChatCompletionCreateParamsNonStreaming,
  maxAttempts = 8
): Promise<ChatCompletion> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.chat.completions.create(params);
    } catch (err) {
      const isRateLimit = err instanceof APIError && err.status === 429;
      if (!isRateLimit || attempt === maxAttempts) throw err;

      // Um pouco de folga sobre o tempo indicado pra evitar bater no limite
      // de novo por um triz. O teto e so uma trava de sanidade (1h) - o
      // Groq as vezes reporta esperas longas (minutos) quando o limite
      // estourado nao e o de tokens/minuto, e sim um limite maior
      // (tokens/dia do free tier), e nesse caso esperar menos que o
      // indicado so gera outro 429 na sequencia.
      const reportedWait = parseWaitSeconds(err.headers);
      const waitSeconds = Math.min(Math.ceil(reportedWait + 2), 3600);
      if (reportedWait > 90) {
        console.log(
          `  (rate limit do ${config.llmProvider} bem maior que o normal de tokens/minuto - ` +
            `provavelmente uma cota diaria do free tier. Confira o painel do provedor.)`
        );
      }
      console.log(
        `  (rate limit do ${config.llmProvider}, tentativa ${attempt}/${maxAttempts} - aguardando ${waitSeconds}s antes de tentar de novo)`
      );
      await sleep(waitSeconds * 1000);
    }
  }
  throw new Error("Nao deveria chegar aqui.");
}

const LEDGER_TYPE_BY_TOOL: Record<string, string> = {
  check_balance: "balance_check",
  check_fictional_balance: "balance_check",
  request_faucet_info: "faucet_request",
  send_test_transaction: "transaction",
  simulate_content_job: "income",
  simulate_marketplace_gig: "income",
  simulate_prediction_market_bet: "income",
  spend_fictional_balance: "expense",
  check_brokerage_account: "balance_check",
  get_market_quote: "thought",
  place_market_order: "trade",
  get_mt5_quote: "thought",
  list_open_positions: "balance_check",
  open_position: "trade",
  close_position: "trade",
  stop: "stop",
};

// Roda um ciclo de decisao (varias iteracoes ate o agente chamar "stop" ou
// esgotar o limite). Retorna true se o agente chamou "stop" explicitamente.
export async function runAgent(cycle: number, mt5Session?: Mt5Session): Promise<boolean> {
  // Modo legado (Binance/experimento ETH testnet) não tem sessão MT5 --
  // executeTool ainda recebe algo, mas os handlers legados nunca leem sessionId/userId.
  const toolSession: ExecuteToolSession = mt5Session ?? { sessionId: "", userId: "", status: "RUNNING" };
  let userMessage: string;
  if (config.mt5TradingEnabled) {
    if (!mt5Session) throw new Error("runAgent chamado em modo MT5 sem sessao (mt5Session ausente).");
    // 🔴 2026-08-29: trava MECANICA de stop/alvo roda ANTES do LLM decidir
    // qualquer coisa neste ciclo -- ver enforceMt5StopsAndTargets
    // (neuralBridge.ts) pro porque (o stop em texto no prompt deixou perdas
    // correrem muito alem do alvo declarado na noite de 2026-08-29). O
    // agente so fica sabendo o que ja foi fechado, nao decide se fecha.
    let stopSummary = "";
    try {
      // 🔴 2026-08-30 (achado ao vivo, sessao aa279c75, monitoramento pos-
      // deploy): uma queda transitoria de DNS/rede (ENOTFOUND/ConnectTimeout
      // contra o Supabase, ~30-40s, 3 ciclos seguidos) fazia
      // enforceMt5StopsAndTargets lancar excecao e cair direto no catch
      // abaixo -- SEM checar stop/alvo NENHUMA vez nesses ciclos. Uma posicao
      // real (XETUSD LONG) furou o stop (2500.87) e so fechou 3 ciclos depois
      // quando a rede voltou, com o preco ja em 2498.14 -- ~2.73 pontos de
      // slippage real, perda maior do que o stop deveria ter permitido.
      // Mesmo padrao de retry curto ja usado em mt5Broker.ts pra cotacao
      // (soluco transitorio de rede, nao falha persistente) -- aqui protege
      // o guard MAIS critico do sistema (o unico que limita perda de forma
      // mecanica), entao vale a pena absorver o mesmo tipo de blip antes de
      // desistir e deixar a posicao sem protecao no ciclo.
      const STOP_CHECK_RETRY_ATTEMPTS = 3;
      const STOP_CHECK_RETRY_DELAY_MS = 1000;
      let lastErr: unknown;
      let result: Awaited<ReturnType<typeof enforceMt5StopsAndTargets>> | undefined;
      for (let attempt = 1; attempt <= STOP_CHECK_RETRY_ATTEMPTS; attempt++) {
        try {
          result = await enforceMt5StopsAndTargets(mt5Session.sessionId, getMt5Quote);
          lastErr = undefined;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < STOP_CHECK_RETRY_ATTEMPTS) {
            console.warn(
              `[agent] checagem de stop/alvo mecanico falhou (tentativa ${attempt}/${STOP_CHECK_RETRY_ATTEMPTS}), tentando de novo em ${STOP_CHECK_RETRY_DELAY_MS}ms:`,
              err instanceof Error ? err.message : err
            );
            await sleep(STOP_CHECK_RETRY_DELAY_MS);
          }
        }
      }
      if (lastErr) throw lastErr;
      const { closed, breakevens, trails, partials } = result!;
      const parts: string[] = [];
      if (closed.length > 0) {
        parts.push(
          "Fechamentos automaticos (stop/alvo mecanico): " +
            closed
              .map((c) => `${c.symbol} ${c.side} (${c.reason === "SL" ? "stop" : "alvo"}, entrada ${c.entryPrice} -> saida ${c.exitPrice})`)
              .join("; ")
        );
      }
      if (breakevens.length > 0) {
        parts.push(
          "Stops movidos para breakeven (posicao correndo a favor): " +
            breakevens.map((b) => `${b.symbol} ${b.side} (stop agora em ${b.entryPrice}, preco de entrada)`).join("; ")
        );
      }
      if (trails.length > 0) {
        parts.push(
          "Stops trilhados (subiram acompanhando o preco a favor): " +
            trails.map((t) => `${t.symbol} ${t.side} (${t.oldStopLoss} -> ${t.newStopLoss})`).join("; ")
        );
      }
      if (partials.length > 0) {
        parts.push(
          "Lucro parcial realizado mecanicamente (posicao ja pagou ~1R, garantiu parte do ganho, resto continua correndo com stop mais largo): " +
            partials
              .map((p) => `${p.symbol} ${p.side} (${(p.favorableMoveR * 100).toFixed(0)}% de 1R, realizou $${p.realizedPnl.toFixed(2)})`)
              .join("; ")
        );
      }
      if (parts.length > 0) {
        stopSummary = " " + parts.join(". ") + ". Tudo isso ja aconteceu por codigo -- voce NAO decidiu, e so informativo.";
      }
    } catch (err) {
      console.error("[agent] falha ao checar stop/alvo mecanico (nao bloqueia o ciclo):", err instanceof Error ? err.message : err);
    }
    // 🔴 2026-08-30 (handoff "Parte B", memoria de trades): fire-and-forget --
    // uma excecao nao capturada aqui abortaria o ciclo inteiro antes de
    // qualquer decisao (mesma causa raiz do bug de ledger corrompido de uma
    // sessao anterior), entao sem memoria e sempre melhor que ciclo abortado.
    let memoryBlock = "";
    try {
      memoryBlock = await getTradeMemoryBlock(mt5Session.sessionId);
    } catch (err) {
      console.error("[agent] falha ao montar memoria de trades (nao bloqueia o ciclo):", err instanceof Error ? err.message : err);
    }
    // 🔴 2026-08-31 (Setup do AI Trader reconectado -- "Estratégia"): nome
    // do preset escolhido pelo usuário vira DIRETIVA DE ESTILO no prompt --
    // este agente raciocina livre (não tem o motor de blocos
    // evaluateStrategyAt do motor mecânico antigo), então isso é orientação
    // pro julgamento do LLM, nunca uma regra mecânica aplicada por código.
    // null (sem preset reconhecido/estratégia personalizada) não adiciona nada.
    const strategyDirective = mt5Session.userConfig?.strategyLabel
      ? `\n\nEstratégia preferida do usuário (Setup do AI Trader): "${mt5Session.userConfig.strategyLabel}". Priorize setups alinhados com esse estilo ao avaliar entradas, mas continue seguindo todas as regras de risco/gates mecânicos normalmente.`
      : "";
    userMessage =
      `Ciclo #${cycle}. Comece checando suas posicoes abertas.${stopSummary}` + (memoryBlock ? `\n\n${memoryBlock}` : "") + strategyDirective;
  } else {
    const ethBalance = await getBalanceEth();
    const usdBalance = getBalanceUsd();
    userMessage =
      `Ciclo #${cycle}. Endereco da sua carteira: ${account.address}. ` +
      `Saldo ETH de testnet no inicio deste ciclo: ${ethBalance}. ` +
      `Saldo USD ficticio no inicio deste ciclo: $${usdBalance}. Comece.`;
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: GENESIS_PROMPT },
    { role: "user", content: userMessage },
  ];

  let calledStop = false;

  for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
    // Espaca as chamadas dentro do ciclo pra nao estourar de cara o TPM
    // baixo do free tier do Groq (o historico + as tools crescem a cada
    // iteracao e cada request sozinha ja custa uma fatia relevante do limite).
    if (iteration > 1) await sleep(3000);

    const response = await createChatCompletionWithRetry({
      model: config.llmModel,
      // 🔴 2026-09-02 (achado ao vivo, causa raiz do "motor não abre posição
      // nunca"): 1024 tokens deixou de ser suficiente pra este modelo (qwen3.5
      // via Ollama, "thinking" nativo ativado, sem equivalente de
      // enable_thinking:false pra este provedor -- testado, o parametro nao
      // tem efeito real no template do Ollama) depois que get_mt5_quote
      // engordou (regime/candlePatterns/macd/stochastic/extension somados ao
      // longo de varias sessoes) -- reproduzido fora de producao com o prompt
      // real: response.usage.completion_tokens=1024, finish_reason="length",
      // content="" e tool_calls=undefined EM TODO CICLO, mesmo com
      // tool_choice:"required" (o campo so forca quando o modelo consegue
      // terminar de responder). Testado com max_tokens=2048 no mesmo prompt:
      // reasoning completo + tool_call real emitido (867-954 tokens usados).
      // Modelfile.qwen35-trading tambem subiu de num_ctx=16384 pra 24576 pra
      // dar folga (prompt_tokens medido ~13.8k, cabia no ceiling antigo por
      // pouco -- qualquer cesta maior ou memoria de trades mais cheia
      // estourava).
      //
      // 🔴 2026-09-04 (RECORRENCIA ao vivo do mesmo bug, monitorado em tempo
      // real com o Cleber): ciclo 1 pos-restart terminou em "Nenhuma
      // ferramenta chamada" apos ~7min -- prompt engordou de novo (principios
      // 1c/1g expandidos com rompimento/nySessionPhase nesta mesma sessao),
      // o modelo passou a raciocinar sobre mais fatores e voltou a estourar
      // o teto de saida antes do tool_call. num_ctx (24576) tem folga de
      // sobra pro ENTRADA (prompt ~14-15k tokens) -- o gargalo e so o teto de
      // SAIDA. Subido pra 4096 (2x o ultimo valor que funcionou, mesma folga
      // relativa que resolveu da ultima vez), ainda bem abaixo do num_ctx.
      max_tokens: 4096,
      tools: toolDefinitions,
      // 🔴 2026-08-30 (redesenho pós -$135 líquido, sessão e7eef768): "auto" ->
      // "required". Achado real, confirmado em dezenas de ocorrências no log
      // bruto da noite de monitoramento: o modelo (Nemotron Nano) às vezes
      // "narra" uma ação em texto puro ("I'll close the older position...")
      // ou produz um formato de tool-call falso (JSON estilo AutoGPT, XML
      // solto tipo "<tool_call><function=stop>...") sem de fato invocar a
      // function-call real -- em pelo menos 1 caso isso fez a IA achar que
      // tinha fechado 2 posições que continuavam abertas. "required" força o
      // provedor a SEMPRE devolver uma function-call de verdade a cada
      // iteração (testado direto contra a API da NVIDIA com este modelo
      // antes de aplicar: HTTP 200, tool_calls limpo, sem narração) -- o
      // agente ainda pode "não fazer nada" chamando log_thought ou stop, só
      // não pode mais fingir uma ação em texto solto.
      tool_choice: "required",
      messages,
      // A familia Nemotron 3 (NVIDIA) por padrao gera "thinking" interno
      // antes de responder -- mesmo ajuste do NEXUS (nexus-brain), evita
      // latencia alta desnecessaria pro caso de tool-calling em ciclo.
      // Campo ignorado por outros provedores (Groq/Cerebras/Gemini/etc).
      ...(config.llmProvider === "nvidia" ? { chat_template_kwargs: { enable_thinking: false } } : {}),
    } as ChatCompletionCreateParamsNonStreaming);

    const message = response.choices[0].message;

    // O gpt-oss as vezes vaza tokens internos de formatacao (ex:
    // "check_balance<|channel|>commentary") grudados no nome da tool. Corta
    // tudo a partir do primeiro caractere invalido ANTES de guardar no
    // historico -- se o nome sujo for empurrado pra `messages` como esta
    // (so seria limpo depois, na hora de executar), o proximo request pra
    // API reenvia esse historico e o provedor rejeita com 400 (nome nao
    // bate com nenhuma tool declarada), travando o ciclo inteiro.
    if (message.tool_calls) {
      for (const call of message.tool_calls) {
        if (call.type === "function") {
          call.function.name = call.function.name.split(/[<|]/)[0];
        }
      }
    }
    messages.push(message);

    if (message.content && message.content.trim()) {
      console.log(`\n[ciclo ${cycle} / iteracao ${iteration}] Modelo: ${message.content.trim()}`);
    }

    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      // 🔴 2026-09-04 (achado ao vivo -- ver comentario em max_tokens acima):
      // logar finish_reason/usage aqui e a diferenca entre "reproduzir o bug
      // de estouro de tokens em minutos" e "adivinhar de novo por sessoes".
      const finishReason = response.choices[0]?.finish_reason ?? "desconhecido";
      const usage = response.usage;
      console.log(
        `Nenhuma ferramenta chamada. Encerrando o ciclo. finish_reason=${finishReason}` +
          (usage ? ` prompt_tokens=${usage.prompt_tokens} completion_tokens=${usage.completion_tokens}` : " (sem usage no response)")
      );
      break;
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const name = call.function.name;
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        input = {};
      }

      console.log(`  -> chamando ferramenta: ${name}(${JSON.stringify(input)})`);
      let result: unknown;
      try {
        result = await executeTool(name, input, cycle, toolSession);
      } catch (err) {
        // Uma falha numa ferramenta (ex: API externa fora do ar, chave
        // invalida) nao deve derrubar o processo inteiro - o agente deve
        // poder ver o erro e decidir o que fazer a seguir.
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      console.log(`     resultado: ${JSON.stringify(result)}`);

      appendLedger({
        timestamp: new Date().toISOString(),
        cycle,
        iteration,
        type: (LEDGER_TYPE_BY_TOOL[name] ?? "thought") as never,
        detail: JSON.stringify({ input, result }),
        txHash: (result as { tx_hash?: string }).tx_hash,
      });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });

      if (name === "stop") calledStop = true;
    }

    if (calledStop) {
      console.log("\nAgente decidiu parar o ciclo.");
      break;
    }

    if (iteration === config.maxIterations) {
      console.log(`\nLimite de ${config.maxIterations} iteracoes atingido neste ciclo. Encerrando por seguranca.`);
    }
  }

  return calledStop;
}
