# Sessão 2026-08-16 (cont.) — Redesenho do cérebro + redesenho do setup de IA do usuário

> Continuação da investigação de "IA rodando 1 semana sem trade" — ver
> `SESSAO_2026-08-16_CALIBRACAO_RUNNER_1M.md` e
> `research/experiments/2026-08-16-scalp-cost-gate-calibration/` (medição real
> que mostrou que scalp de 1m é economicamente inviável na cesta atual, não
> um bug de calibração).

## Decisão de produto do Cleber

Redesenhar o cérebro pra operar com frequência real (~10 trades/dia), sem
abrir mão de proteção de capital, e sem inflar promessa de retorno. Consultoria
dada nesta sessão (resumo, ver transcript pra versão completa): frequência
alta + segurança alta + retorno exponencial garantido não coexistem sem edge —
isso já foi medido (`CLAUDE.md`, busca de edge fechada em 30/07). O caminho
honesto: separar a decisão de ENTRAR (frequência = amplitude de setups/ativos,
não afrouxar critério) da decisão de QUANTO apostar (segurança = sizing por
expectativa medida), e reabrir a busca de edge em dado estruturalmente
diferente (Trilho 2, pausado desde 02/08 sem justificativa nova).

## Achado que muda a sequência do plano: Bloco C já existe, mas está cego

`src/app/services/risk/ExpectancyEngine.ts` — expectativa em R-multiples,
risco de ruína via Monte Carlo, **Kelly honesto** (`computeHonestKelly`) — foi
implementado e validado em 2026-07-31 (`AI_COGNITIVE_SPEC.md`, Bloco C), mas
**nunca foi importado em `runTradingCycle.ts`**. Blocos D (revenge trading,
`RevengeTradingDetector.ts`) e E (tail risk, `TailRiskGuard.ts`) estão ligados
em produção; C não está.

Motivo pra não ligar às pressas nesta sessão: `MIN_SAMPLE_EXPECTANCY = 30`, e
o sistema inteiro tem **3 trades fechados reais no total** (`ai_trades`,
medido nesta sessão). Com amostra assim, `computeHonestKelly` devolve
`reliable: false` pra qualquer símbolo/estratégia — ligá-lo agora não muda
comportamento nenhum, só telemetria. A sequência correta é: primeiro resolver
o problema de frequência (itens 1-2 abaixo), deixar trade real acumular, e só
então o Kelly começa a ter dado pra realmente dimensionar posição. Ligar cedo
demais seria eu mesmo pulando a disciplina de amostra que o módulo foi
desenhado pra impor.

## Plano — 5 frentes, nesta ordem de dependência

### 1. Ampliar amplitude (motor de sinal contínuo, multi-setup, cesta maior)
Substituir a lógica de portão E/OU (preset único, condições simultâneas
raras) por um score contínuo de confiança agregando múltiplos fatores fracos,
rodando sobre vários setups (mean-reversion, breakout, momentum) × cesta maior
de ativos não-correlacionados, em timeframe onde custo já é sustentável
(15m/1h — não 1m, ver medição). É a frente que mais rápido tira o volume do
zero, sem violar nenhum gate de risco existente.

### 2. Migrar timeframe operacional de produção pra 15m/1h
1m fica só como modo de teste de infraestrutura, rotulado como tal (já é o
caso do preset 5, "não habilitar como padrão de produção" está documentado
nele desde 30/07 — só nunca foi reforçado na config real).

### 3. Ligar Bloco C (Kelly honesto) como CAP, nunca como alavanca
Quando `reliable: true`, `effectiveRiskPercent = min(riskPerTrade configurado,
kellyFractionApplied)` — só pode reduzir risco abaixo do que o usuário
configurou, nunca aumentar. Antes de n=30, comportamento idêntico ao atual
(fixed-fractional por `riskProfile`). Bloqueado até (1)-(2) gerarem volume
suficiente pra ter amostra.

### 4. Reabrir Trilho 2 (busca de edge em dado estruturalmente diferente)
Sugestão de primeiro alvo: funding rate + order flow de cripto — mais barato
de obter, historicamente mais promissor que preço público puro. Mesma
disciplina estatística que fechou o Trilho 1 (walk-forward, DSR, custo real).

### 5. Redesenho do setup de IA do usuário (ver seção dedicada abaixo)

## Redesenho do setup de IA — proposta

O painel de configuração atual (`AITrader.tsx`) expõe: 1 dropdown de preset
único, 1 seletor de timeframe, cesta de ativos por checkbox, slider de
cooldown. Isso não sobrevive ao redesenho do motor (item 1) — não dá pra
expor "score contínuo multi-setup" como um dropdown de estratégia única. Três
mudanças de superfície, propostas:

1. **Trocar "escolher 1 preset" por "perfil de risco"** (Conservador /
   Moderado / Agressivo). Cada perfil mapeia internamente para: quantos
   setups ficam ativos simultaneamente, teto do multiplicador de Kelly
   (item 3 do plano), amplitude da cesta de ativos permitida, e teto de
   drawdown diário. O usuário não edita blocos de indicador — isso continua
   existindo como "modo avançado" pra quem quiser, mas não é mais o caminho
   padrão.
2. **Indicador de "atividade esperada" ao vivo, não promessa fixa.** Em vez
   de silêncio total até o primeiro trade, mostrar no painel: "com este
   perfil, nos últimos N dias o sistema teria gerado ~X trades/dia" — número
   calculado do funil real (`ai_funnel_snapshots`), nunca um número
   fabricado de marketing. Resolve o "fica parecendo travado" sem prometer
   volume que a matemática não sustenta.
3. **Substituir o dropdown de timeframe único por "horizonte operacional"**
   (Curto/Médio/Longo, mapeando pra 15m/1h/4h) — remove 1m do caminho padrão
   do usuário (fica só em modo avançado/teste, com o aviso que já existe no
   preset 5).

Este redesenho de UI depende do motor (item 1) estar pronto o bastante pra
alimentar o "perfil de risco" — não faz sentido construir a tela antes do
motor que ela controla existir.

## Especificação técnica do item 1 (pra próxima sessão começar direto no código)

### Onde mexer, exatamente

`evaluateStrategyAt()` em
[StrategyEvaluator.ts:187-245](src/app/services/strategy/StrategyEvaluator.ts:187)
é o portão E/OU hoje: `entryHits === activeEntry.length` (linha 211) exige
TODOS os blocos de entrada baterem no mesmo candle — é isso que torna o sinal
raro por desenho. A confiança (linha 242) já é calculada depois do gate
binário, não antes — hoje ela só varia a MAGNITUDE de um sinal que já passou
no tudo-ou-nada, não decide se passa.

### O que muda

Não é reescrever do zero — é inverter a ordem: calcular o score ANTES do
gate, e trocar o gate binário por um piso de score mínimo, configurável por
`perfil de risco` (item 5).

1. Cada bloco de entrada passa a contribuir um score parcial (0-100) em vez
   de um booleano puro — ex.: `RSI entre 50-70` já é booleano por natureza,
   mas `MACD cruza acima de zero` pode virar "há quantos candles cruzou" (mais
   recente = score mais alto, decai com o tempo) em vez de só o candle exato.
   Não inventar fórmula nova sem medir — cada bloco precisa de um `scoreFn`
   explícito, documentado, testável isoladamente (mesmo padrão dos
   `__validate__*.ts` já existentes).
2. Agregação: `score = Σ(scoreFn_i × peso_i) / Σ(peso_i)`, pesos vindos da
   definição do bloco na estratégia (não fabricados — hoje todo bloco pesa
   igual, é a única suposição nova, e deve ficar marcada como escolha de
   design, não medição).
3. `filterBlocks` continuam sendo gate binário rígido (ADX>18 etc.) — filtros
   são "não opere neste regime", não "opere um pouco menos neste regime". Não
   misturar as duas semânticas.
4. Piso de score mínimo pra gerar sinal: parametrizado por perfil de risco
   (Conservador=piso alto, Agressivo=piso mais baixo, nunca abaixo de um
   mínimo absoluto ainda a definir com dado real — não chutar esse número,
   medir com backtest walk-forward antes de shippar).
5. **Multi-setup**: `evaluateStrategyAt` hoje recebe 1 `Strategy`. Pra rodar
   vários setups em paralelo por ativo, o chamador (`runTradingCycle.ts`,
   trecho perto da linha 480 onde `NO_SIGNAL` é registrado) precisa iterar
   uma lista de estratégias candidatas e agregar/escolher a de maior score —
   política de desempate (maior score? primeira que bater piso? correlação
   entre setups pra não abrir 2 posições redundantes?) é decisão de produto
   a confirmar com o Cleber antes de codar, não assumir.

### Ordem de implementação sugerida (dentro do item 1)

1. Adicionar `scoreFn` por tipo de bloco em `StrategyEvaluator.ts`, cobrir com
   `__validate__.ts` novo (casos determinísticos, mesmo padrão do resto do
   projeto) — sem tocar `runTradingCycle.ts` ainda.
2. Rodar via `research/experiments/` um backtest comparando score contínuo vs.
   gate binário atual, nos MESMOS dados reais já em cache
   (`research/experiments/2026-08-05-taxa-base/data/`, 15m/1h) — medir se
   frequência sobe e se `netResultPercent` não piora. **Não promover pra
   produção sem essa medição** — é a mesma disciplina que fechou o Trilho 1,
   aplicada ao redesenho, não uma exceção pra ele.
3. Só depois de (1)-(2) validados, ligar em `runTradingCycle.ts` e no runner
   Deno (`supabase/functions/ai-runner/`).

### Perguntas em aberto — respondidas pelo Cleber em 2026-08-16

- **Piso de score mínimo por perfil de risco**: confirmado — não chutar, o
  número sai só depois do backtest do item 2 (score contínuo vs. gate atual,
  dados reais em cache 15m/1h). Nenhuma intenção de produto adicional dada
  ainda (ex. "Conservador X% menos sinais que Agressivo") — decidir isso
  também só com o dado da medição na mão.
- **Política de desempate multi-setup**: **maior score vence** — quando 2+
  estratégias batem o piso no mesmo candle/ativo, entra a de score mais alto
  no momento. Implementar essa regra no ponto de agregação em
  `runTradingCycle.ts` (item 5 da spec técnica acima).
- **Pesos por bloco**: **peso igual no início** — escolha de design
  explícita, não medição. O backtest do item 2 pode revelar depois se algum
  bloco (tendência/momentum/volume) merece peso maior; não antecipar isso na
  primeira versão.

## Estado real ao fim desta sessão

Nada dos itens 1-5 foi implementado ainda — esta sessão produziu o
diagnóstico (medição real do gate de custo em 1m,
`research/experiments/2026-08-16-scalp-cost-gate-calibration/`), o plano de 5
frentes, e a especificação técnica do item 1 acima — o bastante pra abrir uma
sessão nova e começar direto no passo 1 da "ordem de implementação sugerida",
sem precisar re-explorar o código primeiro.
