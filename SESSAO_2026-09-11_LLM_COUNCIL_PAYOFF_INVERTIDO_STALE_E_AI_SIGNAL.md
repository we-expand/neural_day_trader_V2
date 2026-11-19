# Sessão 2026-09-11 — llm-council sobre sessão negativa (payoff invertido, stale, AI_SIGNAL)

## Gatilho

Cleber reportou, depois de ~24h com a IA ligada direto: "Estamos atacando
mal", entradas que capturam centavos, confiança alta (82-92%) tomando os
maiores losses da janela, "erro de ciclo" ocasional, e Matriz de
Correlação do Dashboard sem dado pra 3 símbolos. Pediu explicitamente
"CHAMA O CONSELHO!" — e, em mensagem separada, deu abertura: se operar
menos aumentar assertividade, aceita a IA operar só ~17 vezes/24h (hoje
~35/dia).

## Diagnóstico real (SQL direto, `ai_trades`, Supabase, últimas 30h)

- 44 trades fechados, PnL líquido = **-$32,81**
- Win rate: 43,2%
- Ganho médio quando vence: +$1,45 | Perda média quando perde: -$2,41 →
  **payoff invertido (0,60:1)**
- Confiança média (`ai_confidence`) em VENCEDORES: 85,3% | em
  PERDEDORES: 84,3% — **praticamente idêntica, sem poder preditivo real**
- Por `exit_reason`: SL (19 trades, -$29,75) | **AI_SIGNAL — fechamento
  discricionário da própria IA (19 trades, -$14,79, 42,1% win rate)** |
  TP mecânico (6 trades, +$11,74, **100% de acerto**)
- 8 trades fecharam com PREJUÍZO real mesmo tendo tido MFE (lucro
  flutuante máximo) positivo confirmado — ex: HKG33 LONG chegou a +$3,44
  flutuante e fechou em -$0,19; XETUSD SHORT chegou a +$2,36 e fechou em
  -$4,31

### Casos específicos do Cleber, confirmados reais no banco

1. **LINKUSD SHORT 10:35h** — trades de LNKUSD na janela fecharam com
   `net_pnl` de -$0,13/-$0,09/-$0,13 — captura em centavos, confirmado.
   `quantity` da posição é literalmente o preço do ativo (~11,6 LNKUSD),
   sem piso mínimo de captura por trade (só teto de risco máximo).
2. **UKOUSD LONG 15:42h Brasília (18:42 UTC), confiança 88%** —
   confirmado (trade `50936d10`, entry 108.259, exit SL 107.618,
   `net_pnl` **-$6,40**, a MAIOR perda individual da janela).
3. UKOUSD SHORT confiança **92%** (`c17e2f50`) também fechou perdendo
   -$5,11, com MFE real de só $1,69 (nunca chegou perto do alvo).

### Achado técnico correlato, achado no log ao vivo (`llm-active-brain/llm-brain.log`)

- **223 ocorrências de cotação `"stale":true`** na janela, e **~163
  ocorrências de aviso de rate-limit/endpoint lento da MetaAPI**
  (conta compartilhada da plataforma, risco crônico já catalogado).
- Quando a cotação fica stale, `trend/volume/macd/stochastic/regime`
  viram `null` (correto, não fabrica dado) MAS o aviso injetado no
  prompt dizia literalmente: **"você PODE tentar entrar mesmo assim
  (confie no stop mecânico para proteger)"** — convite a operar às
  cegas.
- Gates de qualidade já existiam e funcionavam bem na maior parte do
  tempo (lateral sem 2 confluências, R:R insuficiente, confiança <80%,
  validador de contradição determinístico) — mas nenhum cobria o caso de
  dado stale/ausente permitindo entrada de qualquer jeito.
- Matriz de Correlação do Dashboard sem dados pra USDJPY/SPX500/UKOUSD é
  o mesmo sintoma de rate-limit — disciplina correta de nunca fabricar
  valor sintético, não é bug de UI novo.

## O conselho (llm-council: 5 advisors + 5 peer reviews + chairman)

Pergunta levada: quais são as 2-4 mudanças de maior alavancagem pra
reverter o payoff invertido e a calibração de confiança quebrada, sem
repetir o erro já catalogado (cortar stop/trailing sem base estatística
já derrubou acerto de 80%→33% em 2026-09-04)?

### Onde o conselho concordou (unânime nas 5 revisões cruzadas)

1. Trava de cotação stale/rate-limit é **bug**, não parâmetro de tuning
   — 223 stale + 163 rate-limit em 30h não é ruído de fundo, é o regime
   dominante da amostra.
2. AI_SIGNAL (fechamento discricionário) está destruindo valor — pior
   que deixar o mecânico decidir.
3. Confiança declarada não deve virar gate agora — n=44 é pequeno demais
   tanto pra declarar "quebrada de vez" quanto pra tentar consertar via
   prompt engineering. Só logar, parar de usar como filtro.
4. Sizing/piso mínimo de captura NÃO é prioridade desta rodada — mexer
   nisso antes de resolver dado corrompido e saída ruim arrisca
   embaralhar causa e efeito de novo (mesmo padrão de 2026-09-04).

### Onde divergiu

Um conselheiro (linha "Expansionist") propôs usar a folga de frequência
(35/dia → 17/dia) pra **aumentar** agressividade — ampliar cesta,
pyramiding, travar lucro com parcial mais agressivo. **Rejeitado pelos
outros 4 e por 5 de 5 revisões cruzadas, sem exceção** — mesma classe de
erro já catalogada em 2026-09-04: mexer em múltiplos mecanismos ao mesmo
tempo sobre amostra não validada.

### Pontos cegos pegos via peer review

1. Ninguém cruzou os 19 fechamentos AI_SIGNAL contra a flag de
   stale/rate-limit — pode ser que boa parte das saídas ruins tenham
   acontecido em ciclos com dado corrompido (mesma causa raiz, duas
   roupas diferentes). Fica como diagnóstico futuro, não bloqueia os
   fixes.
2. Segregar amostra "decisão com dado limpo" vs "decisão com dado
   stale" antes de aceitar qualquer conclusão estatística como fechada.
3. Nenhum protocolo de teste pré-registrado tinha sido proposto — dado o
   histórico do projeto de já ter declarado "resolvido" em cima de 1-2
   trades antes.

## Fixes implementados

**`llm-active-brain/src/config.ts`** — duas flags novas:

- `blockEntryOnStaleIndicators` (default `true`)
- `aiSignalDiscretionaryCloseEnabled` (default **`false`** — suspenso)

**`llm-active-brain/src/tools.ts`**:

1. **Fix 1 (stale)**: o aviso do fallback de `get_mt5_quote` não convida
   mais a "entrar mesmo assim" — avisa que a entrada será recusada.
   `open_position` recusa de fato qualquer entrada no símbolo se o dado
   veio nulo (`staleQuoteToolCycleBySymbol`) nesse mesmo ciclo, mesmo que
   o preço de preenchimento volte a ficar fresco depois na re-cotação
   interna.
2. **Fix 2 (AI_SIGNAL)**: `close_position` recusa avaliação
   discricionária enquanto a flag estiver `false`. A rechecagem mecânica
   de SL/TP no início da função (idempotente) continua intocada — só a
   parte de julgamento livre (regras de ≥50% do caminho, lucro acima do
   spread, 2 fatores de invalidação) fica bloqueada.

`tsc --noEmit` limpo, `npm run validate` 37/37.

## Protocolo de validação (não pular)

**5 dias úteis OU 40 trades fechados** (o que vier depois) sob os 2
fixes ativos, **sem nenhuma outra mudança de mecânica no período**.

Métrica de decisão: payoff ratio e win rate da sessão nova comparados
contra -$32,81 / 43,2% / 0,60:1 desta sessão.

Critério de sucesso: **payoff ratio > 1,0:1 E win rate ≥ 45%**
sustentados → pode reabilitar AI_SIGNAL (`aiSignalDiscretionaryCloseEnabled: true`).
Caso contrário, volta ao conselho com dado novo antes de qualquer novo
ajuste.

## Sobre a oferta do Cleber (17 trades/24h)

Aceita, mas como **piso que a seletividade produz naturalmente**, nunca
como meta a perseguir ou capacidade a "gastar" em mais agressividade. Se
os fixes 1+2 já derrubarem a frequência pra perto de 17/dia como efeito
colateral de bloquear entrada cega e saída ruim, é sinal de que a
seletividade está funcionando — nenhum mecanismo novo foi adicionado pra
forçar ou preencher esse número.

## Pendente

- `git commit` dos 2 arquivos (comando entregue ao Cleber, ele roda) +
  `./restart.sh` (dentro de `llm-active-brain/`).
- Diagnóstico em paralelo, não bloqueante: reprocessar os 44 trades já
  fechados desta sessão segregando por presença de stale/rate-limit no
  momento da decisão de entrada, e cruzar os 19 AI_SIGNAL contra essa
  mesma flag.
- Ao fim do período de teste: reler este arquivo, rodar a métrica de
  decisão, e só então decidir sobre confiança/sizing/reabilitar
  AI_SIGNAL.
