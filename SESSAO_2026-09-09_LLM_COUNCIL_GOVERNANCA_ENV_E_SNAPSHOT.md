# Sessão 2026-09-09 — llm-council sobre o LLM Brain não evoluir o capital + 2 fixes de governança

## Pedido do Cleber

A LM de operação (LLM Brain) ficou ligada o dia inteiro de ontem (08/09) e
não conseguiu fazer o capital da conta real evoluir — ficou rondando
perdas e ganhando "em cima de cem dólares". Meta pedida: ~$10/dia de lucro
sobre uma conta de $100. Pedido explícito: chamar o `llm-council` pra
ajudar a resolver.

## Diagnóstico real (SQL direto no Supabase, sessão `e6ca2cf7...`, 61 trades fechados, 08/09-09/09)

- 47,5% de acerto, profit factor 1,15, net +$6,00 (praticamente zero,
  positivo só por sorte de amostra).
- **81% das entradas nunca chegam a 1R** (34 de 42 trades com plano real
  nunca chegaram no take-profit parcial de 1R).
- R:R planejado médio 3,47:1, mas só 8% das entradas (3 de 37) chegaram
  perto do alvo real — a maioria sai no meio do caminho.
- **86% das entradas classificadas como "contrarian"** (reasoning cita
  "exaustão"/"reversão"/"contra a tendência") perderam -$10,15 líquido,
  39% de acerto — as poucas a favor da tendência (n=6) ganharam +$5,02,
  67% de acerto. Amostra pequena, não é prova de edge.
- Gate de confiança (≥75%) mostrou resultado **invertido**: trades com
  confiança ≥85% tiveram média -$0,47/trade; trades com confiança <85%
  tiveram média +$0,16/trade — o gate de confiança é, na prática,
  decorativo (não calibrado contra resultado real).
- **Achado mais grave, de governança**: o `.env` (não versionado, nunca
  comitado) tinha `MT5_STOP_ATR_MULTIPLIER=1.0` (em vez do valor vigente
  documentado de 2.0x, decidido pelo llm-council de 04-05/09 depois do
  colapso de acerto 80%→33%) e `MT5_MAX_RISK_PCT_PER_TRADE=0.09` (em vez
  dos 3% que o Cleber decidiu reverter em 07/09 à noite). Essas duas
  divergências ficaram ativas por **dias**, sem ninguém notar, incluindo
  durante toda a sessão analisada — ou seja, o diagnóstico acima rodou
  sob um regime de risco diferente do que o projeto pensava estar usando.
- `indicators_snapshot` em `ai_trades` estava **NULL em 100%** dos
  trades — zero forma de auditar retroativamente se o indicador técnico
  real bateu com o que o reasoning da IA alegou.
- Modelo local (Ollama, Qwen3.5 4B) com sinais de limite de capacidade
  (confunde termos, narra decisão sem executar, já catalogado em sessões
  anteriores).
- Pesquisa do projeto (fechada 2026-07/08, ver `AI_BRAIN_SPEC.md`) já
  concluiu que não há edge técnico comprovado — cérebro é de execução/
  disciplina, não de alfa.

## Veredito do `llm-council` (5 conselheiros + revisão cruzada por pares)

**Consenso:**
1. O vazamento do `.env` invalida metodologicamente o diagnóstico dos
   itens 1-4 — não é "mais um achado", é o que torna os outros não
   confiáveis (mistura de 2 regimes de risco tratada como 1 amostra só).
2. Buscar edge técnico novo agora é a opção errada — a pesquisa de
   jul/ago/2026 já fechou essa porta com rigor estatístico adequado.
3. A meta de $10/dia sobre $100 (10%/dia, ~1000%/mês) é matematicamente
   insustentável — unânime entre os 5 conselheiros.

**Divergência real**: um conselheiro (minoria, marcado como ponto cego
pela maioria dos revisores) defendeu inverter a proporção contrarian/
a-favor-da-tendência agora, citando os dados acima. Rejeitado pelo
consenso: n=6 sob parâmetro instável não é sinal, é ruído com sorte —
agir sobre isso seria otimizar em cima do mesmo dado contaminado que o
resto do conselho está dizendo para não confiar ainda.

**Precedente citado pelo conselho** (já documentado neste `CLAUDE.md`):
em 04/09/2026 o mesmo padrão — cortar stop, mudar risco no meio do dia,
sem congelar — derrubou o acerto de 80%→33%. Um `llm-council` anterior já
recomendou congelar mecânica por 5 dias úteis/40+ trades e foi ignorado
no mesmo dia.

**Recomendação final**: parar de tratar qualquer ajuste de seletividade/
edge como decisão até a governança de parâmetros e o snapshot de
indicadores estarem corrigidos — aí sim rodar fixo por 5 dias úteis/40+
trades antes de julgar qualquer filtro novo. Meta de $10/dia deve ser
comunicada ao Cleber como função de capital-base, não de risco por
trade (aumentar risco só acelera zerar a conta).

## Fixes aplicados nesta sessão (ambos já commitados pelo Cleber)

### 1. Governança do `.env` — `bdef0327c`

- `llm-active-brain/.env`: removidas as 5 linhas de override que tinham
  divergido do valor vigente sem registro (`MT5_STOP_ATR_MULTIPLIER`,
  `MT5_STOP_MIN_PCT`, `MT5_STOP_MAX_PCT`, `MT5_STOP_FALLBACK_PCT`,
  `MT5_TAKE_PROFIT_ATR_MULTIPLIER`, `MT5_MAX_RISK_PCT_PER_TRADE`) —
  `config.ts` volta a ser a fonte de verdade (defaults: stop 2.0x ATR,
  alvo 4.0x ATR, risco máximo 3%).
- `llm-active-brain/src/config.ts`: novo aviso automático no boot
  (`GOVERNANCE_CRITICAL_ENV_PARAMS`) que imprime `🔴🔴🔴 AVISO DE
  GOVERNANCA` no log sempre que um desses parâmetros críticos voltar a
  ser sobreposto pelo `.env` sem bater com o valor vigente documentado —
  não bloqueia o boot (pode ser teste deliberado), mas torna a
  divergência impossível de passar em silêncio de novo.
- Processo reiniciado e confirmado ao vivo: nenhum aviso de governança
  disparou no boot (confirma que os valores batem com o documentado).

### 2. `indicators_snapshot` deixa de ser NULL — `c73c6b63e`

- `llm-active-brain/src/tools.ts`: o cache `lastQuoteSnapshotBySymbol`
  (já existia, usado pelo `reasoningValidator.ts`) foi enriquecido com
  campos que já eram calculados em `get_mt5_quote` mas nunca persistidos:
  `trendLongTermLabel`, `priceExtensionPct`, `candlePatternLabels`,
  `movingAveragesExtended`, `spreadPct`, `priceAtQuote` — nada fabricado,
  tudo reaproveitado do mesmo cálculo que o LLM já vê.
- `llm-active-brain/src/neuralBridge.ts`: `openMt5Position` ganhou o
  parâmetro `indicatorsSnapshot`, gravado na coluna `ai_trades.
  indicators_snapshot` (JSON) na abertura de cada posição.
- `tsc --noEmit` limpo nos dois arquivos. Processo reiniciado e
  confirmado ao vivo (boot limpo, sem erro). Confirmação de que a coluna
  está sendo preenchida de verdade depende da próxima posição aberta
  (não forçado nesta sessão).

## Pendente real

1. **Confirmar com a próxima abertura de posição** que `indicators_snapshot`
   chega preenchido (não forçado nesta sessão — só confirmado que o
   código está correto e o processo subiu sem erro).
2. **Deixar rodar fixo por 5 dias úteis/40+ trades**, sem nenhum ajuste
   de mecânica de risco/stop/alvo, antes de julgar qualquer filtro de
   seletividade (ex: a hipótese de inverter contrarian/a-favor-tendência
   levantada pelo conselho e rejeitada por falta de dado limpo). Repetir
   a mesma recomendação que já foi dada e ignorada em 04-05/09 — não
   repetir o padrão.
3. **Meta de $10/dia**: decisão do Cleber sobre se aumenta capital-base
   ou revisa a meta — não é parâmetro de engenharia, não deve ser
   perseguida via corte de seletividade/risco por trade.
