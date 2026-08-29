# Sessão 2026-08-29: Análise do teste noturno do Cérebro LLM Ativo + stop dinâmico/breakeven/trailing/sizing

## Estado exato de onde continuar

- **Branch**: `dev`.
- **Commits já feitos e pushados nesta sessão** (pelo Cleber, pelos comandos
  que entreguei):
  - `e48076b6f` — `fix(llm-brain): stop/alvo mecanico + teto de exposicao por simbolo`
  - `9e40999be` — `feat(llm-brain): stop dinamico por ATR + breakeven + trailing mecanicos`
- **Mudanças NÃO commitadas ainda** (última leva desta sessão, código pronto
  em disco, comando de commit entregue mas ainda não rodado):
  `llm-active-brain/src/agent.ts`, `config.ts`, `mt5Broker.ts`, `tools.ts`.
  Cobrem: PnL pré-calculado em `list_open_positions`, trava de entrada
  duplicada no mesmo preço exato, aviso de feed travado, e o redesenho de
  sizing por exposição-alvo em dólar (`size: "normal"|"forte"` substituindo
  lotes livres). Comando de commit pronto na seção "Commits" abaixo.
- **Backup do código original** (antes de qualquer fix desta sessão) salvo
  em `llm-active-brain/_backup_pre_stop_fix_2026-08-29/` (não versionado de
  propósito, é só referência local) + link permanente do GitHub pro commit
  anterior a tudo isso:
  `https://github.com/we-expand/neural_day_trader_V2/tree/1e0591124/llm-active-brain/src`
- **Processo do agente**: reiniciado às 08:09 com o código até `9e40999be`
  (PID `81216`/`81234`/`81237`, log em
  `llm-active-brain/logs/restart_20260829_0809.log`). **Ainda não pegou** a
  última leva (PnL pré-calculado, trava de duplicata, sizing por exposição)
  — precisa reiniciar de novo depois do commit pendente.
- **Próximo passo real**: commitar+pushar a leva pendente, reiniciar o
  processo, e decidir se reseta a sessão de teste no Supabase (PnL
  acumulado real na sessão isolada: -$8,40 até 07:22, -$11,20 até 10:28,
  todos ANTES de qualquer um dos fixes desta sessão valerem de verdade).

## O que foi feito (em ordem cronológica)

### 1. Análise profunda do teste noturno (trade a trade, via Supabase)

Pedido do Cleber: entender por que a sessão de teste do Cérebro LLM Ativo
(isolada do motor mecânico, `ai_sessions.strategy_name='LLM_ACTIVE_BRAIN_MT5'`,
id `6220f3b4-d700-4052-bfea-348cea1accf4`) começou dando lucro e amanheceu no
prejuízo. Reconstruí o PnL acumulado real (não só os checkpoints de 20/20min
do handoff anterior) puxando os 128 trades fechados direto do `ai_trades`.

**Achados principais**:
- **100% do prejuízo real está concentrado em BTCUSD**: -$10,86 de -$11,20
  total (leitura final, 10:28). XETUSD -$0,36, SOLUSD +$0,02 — os outros
  dois são ruído estatístico (dezenas de trades, resultado líquido ≈$0).
- **Pico real da noite**: +$12,35 às 06:24. A partir daí, uma sequência de
  6 perdas em BTCUSD entre 06:26 e 07:47 devorou o lucro inteiro e virou
  negativo.
- **Causa raiz nº1 — stop discricionário, não mecânico**: o "stop" só
  existia como texto no prompt (LLM decidia a cada ciclo se fechava). Duas
  posições rodaram MUITO além do alvo declarado (0,5%) antes do agente
  agir: uma BTCUSD LONG chegou a -3,5%/-$5,96 (sozinha quase o prejuízo
  líquido da noite inteira), outra a -3,5%/-$3,50. Confirmado no
  `ai_reasoning` de cada trade ("Fechar com loss de ~3.5% que supera stop
  alvo de -0.5%").
- **Causa raiz nº2 — sizing não normalizado por risco**: `LOT_SIZE=1` pros
  3 criptos em `assetBasket.ts` faz a exposição em dólar escalar direto com
  o preço do ativo — BTCUSD (~$77.600) gerava 30-750x mais exposição que
  SOL/XET pro MESMO número de lotes. Por isso praticamente todo o risco (e
  o prejuízo real) morava no BTC, mesmo o agente tratando os 3 símbolos
  como "equivalentes" no teto de posições.
- **Achado de qualidade do modelo (Nemotron Nano)**: pelo menos 2 trades
  com raciocínio contraditório confirmado no `ai_reasoning` — um fechamento
  registrado como "prejuizo? nao, lucro!" quando o resultado real foi
  -$2,49, e outro como "Lucratividade alcançada: prejuízo de ~1,125%"
  (contradição na mesma frase), perda de -$1,17. Não corrompeu o banco (o
  `net_pnl` calculado pelo motor está sempre certo), mas mostra o modelo
  fazendo aritmética errada em texto livre.
- **Achado novo — 7 entradas BTCUSD no MESMO preço exato** ($77.658,82) ao
  longo de 12 minutos (03:00-03:12) — estatisticamente improvável pra um
  ativo que nunca fica parado, indício de cotação obsoleta vinda da própria
  MetaAPI (o feed já teve quedas confirmadas na mesma madrugada, ~02:00 e
  ~04:20, mas essa aparenta ser um terceiro episódio não pego pela trava
  existente, que só bloqueia preço `SIMULATED`, não preço real porém
  velho).
- **Comparativo por símbolo** (win rate): BTCUSD 41,0%, XETUSD 40,0%,
  SOLUSD 49,0% — a taxa de acerto do BTC não é pior que a dos outros. O
  problema nunca foi "o modelo lê o BTC pior", foi tamanho do erro quando
  erra (stop mole) e tamanho da posição (sizing).
- **Sobre volume/lateralização** (pergunta do Cleber): confirmado com dado
  real que SOLUSD/XETUSD ficaram numa faixa lateral apertada a noite
  inteira (~1% e ~0,4% respectivamente) — isso explica o resultado ≈$0
  desses dois (ruído de range, não erro). Mas NÃO explica as perdas
  grandes do BTC — aquele movimento (77.650→77.354, ~0,4%) foi real e
  direcional, o problema foi a falta de reação a tempo, não ausência de
  movimento. Não foi possível confirmar volume real (não há dado de tick
  volume persistido pra essa madrugada) — sinalizado como hipótese não
  verificada, não fato.
- **Comparação Cérebro LLM Ativo vs motor mecânico**: no único ponto
  comparável de verdade (disciplina de risco), o LLM foi PIOR — o motor
  mecânico tem stop real (ordem no broker), o LLM tinha só uma sugestão em
  texto. Sobre "ler mercado melhor" (edge de sinal), não há dado suficiente
  pra afirmar nada ainda (1 noite, sem holdout).

### 2. Fix 1 — Stop/alvo mecânico + teto de exposição inicial (commit `e48076b6f`)

- `tools.ts`/`neuralBridge.ts`: `open_position` passou a calcular e GRAVAR
  `stop_loss`/`take_profit` (colunas que já existiam no banco, nunca
  usadas) na abertura. Nova função `enforceMt5StopsAndTargets()` roda a
  cada ciclo, ANTES do LLM decidir qualquer coisa, e fecha por código
  qualquer posição que bateu o nível — não depende mais do modelo perceber
  ou lembrar.
- Teto de exposição em dólar (`mt5MaxNotionalUsd`) adicionado nessa
  primeira leva com valor de **$60** — valor que se mostrou ERRADO logo
  depois (ver Fix 3).
- `agent.ts`: prompt reescrito avisando que o stop virou mecânico.

### 3. Fix 2 — Stop dinâmico por ATR + breakeven + trailing (commit `9e40999be`)

A pedido do Cleber, em 3 pedidos sucessivos na mesma sessão:

1. **"Insira para que ele trabalhe com um stop dinâmico"** — novo arquivo
   `atr.ts`: calcula ATR real (mesma fórmula Wilder/período 14 do motor
   mecânico, `TechnicalIndicators.ts`) a partir de candles reais
   (`/mt5-candles`, mesma fonte MetaAPI, mesma trava contra `SIMULATED`
   que já existia pra cotação). Stop = 1,5×ATR, alvo = 3×ATR (R:R 1:2),
   com clamps de segurança e fallback pro % fixo se o ATR não vier de dado
   real.
2. **"Não esqueça de trazer o stop para o preço de entrada assim que as
   operações começarem a correr"** — breakeven mecânico: ao atingir 50% da
   distância do stop original a favor, o código move o stop pro preço de
   entrada (`mt5BreakevenTriggerR=0.5`). Pior caso vira ~$0.
3. **"Com o estoque [stop] dinâmico, faça com que esse stop vá subindo e
   protegendo a operação... se estiver correndo a favor"** — trailing
   contínuo: depois do breakeven, o stop segue o preço a uma distância ATR
   recalculada a cada ciclo, sempre só apertando (nunca afrouxa).

Tudo implementado em `enforceMt5StopsAndTargets()` (`neuralBridge.ts`),
que agora retorna `{closed, breakevens, trails}` — o LLM é avisado no
início de cada ciclo do que já aconteceu por código, não decide nada
disso.

### 4. Fix 3 — PnL pré-calculado, trava de entrada duplicada, sizing por exposição-alvo (NÃO COMMITADO AINDA)

Disparado por duas perguntas/pedidos do Cleber na sequência:

**a) "Esses achados errados... isso é erro da IA? Como corrigir?"** — resposta
dividida em 2 categorias com causas diferentes:
- Raciocínio contraditório (categoria 1) = erro genuíno do LLM (aritmética
  em texto livre). Correção: `list_open_positions` agora devolve
  `pnl_percentage`/`pnl_usd` JÁ CALCULADOS por código — o modelo só lê o
  número, não calcula mais de cabeça.
- Entradas duplicadas no mesmo preço (categoria 2) = provavelmente NÃO é
  erro da IA, é sintoma de infraestrutura (cotação obsoleta). Correções:
  `open_position` bloqueia abrir posição no mesmo símbolo+lado+preço exato
  de uma já aberta; `mt5Broker.ts` loga aviso quando o mesmo símbolo
  devolve preço idêntico 3x+ seguidas (diagnóstico, não bloqueia).

**b) "SOL e Ethereum [XETUSD] capturam muito pouco... entrar com a mão mais
pesada seria a solução"** — redesenho do sizing:
- **Achado corrigido no processo**: o teto de $60 do Fix 1 estava ERRADO —
  BTCUSD no lote mínimo (0,01) já produz ~$775-780 de exposição, então
  aquele teto teria deixado o BTC incapaz de abrir QUALQUER posição.
  Corrigido pra `mt5MaxNotionalUsd=1500` (teto absoluto de segurança, só
  deveria disparar em caso anormal).
- **Sizing por exposição-alvo**: `open_position` não recebe mais `lots`
  livre do LLM — recebe `size: "normal"|"forte"`. O código calcula os
  lotes automaticamente a partir de `mt5TargetNotionalUsd` (padrão $800,
  calibrado pra ficar logo acima do mínimo real do BTC) × multiplicador
  (`mt5HeavyMultiplier=1.5` se "forte"). Isso faz SOL/XET abrirem MUITO
  mais lotes que antes pra alcançar a MESMA exposição em dólar que o BTC —
  resolve "captura pouco $" na raiz (exposição, não só pontos de saída).

## Achados que ficaram em aberto (não corrigidos ainda)

1. **Feed de preço possivelmente travando sem sinalizar** (as 7 entradas
   BTCUSD no mesmo preço) — só tem diagnóstico (log de aviso) implementado,
   não uma correção de causa raiz na origem do dado (isso estaria no
   `/mt5-prices` do `supabase/functions/server/index.ts`, fora do escopo
   do `llm-active-brain`).
2. **Sem validação estatística de nada disso ainda** — 1 noite, ~128
   trades, sem holdout, sem correção por múltiplos testes. Os fixes
   corrigem mecanismos de falha confirmados, não provam que a arquitetura
   LLM tem edge.

## Commits desta sessão

Já feitos e pushados:
```
9e40999be feat(llm-brain): stop dinamico por ATR + breakeven + trailing mecanicos
e48076b6f fix(llm-brain): stop/alvo mecanico + teto de exposicao por simbolo
```

**Pendente** (código pronto em disco, comando ainda não rodado):
```bash
git add llm-active-brain/src/agent.ts llm-active-brain/src/mt5Broker.ts llm-active-brain/src/tools.ts llm-active-brain/src/config.ts
git commit -m "fix(llm-brain): pnl pre-calculado + trava de duplicata + sizing por exposicao-alvo

list_open_positions devolve pnl_percentage/pnl_usd ja calculados (LLM
confundiu lucro/prejuizo 2x fazendo essa conta de cabeca). open_position
recusa abrir no mesmo simbolo+lado+preco exato de uma ja aberta (achado:
7 entradas BTCUSD no mesmo preco em 12min, indicio de feed travado).
mt5Broker.ts loga aviso de preco repetido 3x+. Redesenho de sizing: lots
livre vira size:'normal'|'forte', codigo calcula lotes por
exposicao-alvo em dolar uniforme entre simbolos (corrige SOL/XET
capturando exposicao irrelevante comparado ao BTC, e corrige teto de
$60 do commit anterior que deixaria BTC incapaz de abrir posicao)."
git push
```

Depois disso, reiniciar o processo do agente pra pegar o código novo
(matar PID atual, `npm run start` de novo com log em arquivo — mesmo
padrão das vezes anteriores).

## Pendências reais pra próxima sessão

1. Commitar+pushar a leva pendente (comando acima) e reiniciar o processo.
2. Decidir se reseta a sessão de teste isolada (`ai_sessions` id
   `6220f3b4-...`) pra $50 zerada de novo, ou deixa acumular em cima do
   saldo atual (-$11,20) já testando os fixes novos.
3. Investigar a causa raiz do feed de preço possivelmente travando
   (achado nº1 em aberto acima) — hoje só tem log de aviso, não conserto.
4. Acumular amostra nova (pós todos os fixes desta sessão) antes de tirar
   qualquer conclusão sobre desempenho — nada aqui corrige "falta de edge",
   corrige mecanismos de execução que estavam sabidamente quebrados.
