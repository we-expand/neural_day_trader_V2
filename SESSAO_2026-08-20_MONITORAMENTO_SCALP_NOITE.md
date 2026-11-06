# Sessão 2026-08-20/21 — Investigação "sem entrada" + monitoramento noturno do modo Scalp

## Contexto

Cleber reportou a IA ativa em modo **Scalp** sem conseguir nenhuma entrada, e
suspeitou que o fix recente de MACD (commit `ef9fd9b3c`, sessão anterior —
ver `SESSAO_2026-08-20_MACD_E_PERSISTENCIA_GRAFICO.md`) estivesse atrapalhando
as entradas, já que a IA tinha operado normalmente mais cedo no dia com a
mesma configuração.

## Investigação 1 — o fix de MACD não é a causa

Reexaminado o commit `ef9fd9b3c` (`runTradingCycle.ts:1284`): ele só reescreve
o campo `indicators.macd` gravado no **snapshot do trade já decidido** — roda
depois que `side` já foi escolhido por outra lógica, é telemetria/auditoria
pura. Não participa de nenhum gate/veto nem do cálculo de score. Confirmado
lendo o diff e a lista de `vetoStage` em `runTradingCycle.ts` — nenhum é
relacionado a esse campo.

## Investigação 2 — causa real, achada com dado de produção (`ai_funnel_snapshots`)

Toda janela da sessão mostrava `stage_counts: {"NO_SIGNAL": N}`, com
`samples: "melhor score 50 < piso 60"` — a estratégia nem chegava a gerar
candidato acima do piso de score (`signalScoreFloor = 60`), etapa **anterior**
a qualquer veto de custo/regime/risco.

Causa: o preset "Momentum de Curto Prazo (Scalp)"
([presetStrategies.ts:295-298](src/app/data/presetStrategies.ts:295)) tem 2
blocos de entrada com peso igual (média simples,
[StrategyEvaluator.ts:327](src/app/services/strategy/StrategyEvaluator.ts:327)):
- MACD CROSS_ABOVE 0 — pontua por recência de cruzamento (100 no candle exato,
  decai 10pp/candle, 0 se não cruzou nos últimos 10 candles);
- RSI entre 50-70 — booleano, 100 ou 0.

Com RSI na banda (100) e sem cruzamento de MACD recente (0), a média trava em
exatamente **50**, abaixo do piso 60 — daí o "sem entrada". Esse mecanismo de
score contínuo está em produção desde **2026-08-17**, anterior ao fix de MACD
de 08-20 — **não é regressão do fix**, é o comportamento estrutural do preset
(exige cruzamento de MACD dentro de ~8 candles simultâneo com RSI em banda).
Conclusão passada pro Cleber: aguardar e monitorar, já que é comportamento
esperado num momento sem rajada de momentum na cesta, não travamento.

## Bug real e não relacionado, achado e corrigido nesta sessão

Cleber reportou separadamente: aplicar um Template do gráfico e depois trocar
de **ativo** fazia os indicadores (ex: MACD) sumirem — diferente do bug já
corrigido de troca de **seção** do app.

**Causa**: `ChartView.tsx` faz `dispose()+init()` do gráfico inteiro a cada
troca de ativo/timeframe (comportamento documentado no próprio código,
[ChartView.tsx:5433](src/app/components/ChartView.tsx:5433)) — um chart novo
nasce sem nenhum indicador. As guardas `sessionStateAppliedRef`/
`favoriteSetupAppliedRef` ([ChartView.tsx:1488-1493](src/app/components/ChartView.tsx:1488)),
que controlam "reaplicar o template salvo", eram `useRef(false)` setadas
`true` na primeira aplicação e **nunca resetadas** — então na 1ª troca de
ativo dentro da sessão, o bloco de restauração via a guarda já `true` e
pulava a reaplicação, definitivamente (nem trocando de novo voltava).

**Fix aplicado** ([ChartView.tsx:4558](src/app/components/ChartView.tsx:4558)):
reset de `sessionStateAppliedRef.current`/`favoriteSetupAppliedRef.current`
pra `false` no mesmo ponto que já reseta `isInitialLoadRef` por um bug irmão
idêntico (mesma causa raiz, achada em sessão anterior). `npm run validate`
passou 37/37.

**Commit pendente do Cleber rodar:**
```bash
git add src/app/components/ChartView.tsx
git commit -m "fix: template/indicadores do gráfico somiam ao trocar de ativo (guarda de reaplicação nunca resetava no dispose+init do chart)"
git push origin dev
```

Não testado end-to-end no navegador (exige login real, sem como verificar sem
a senha do Cleber). Pendente de confirmação visual dele: aplicar um Template
com indicador, trocar de ativo, checar se persiste.

## Monitoramento noturno (20/08 ~19h UTC → 21/08 ~12h UTC)

Sessão acompanhada: `e2a3a5a0-bf37-455c-80aa-1029f0664214` (mesma sessão do
início ao fim, sem restart).

Linha do tempo resumida dos checks feitos a cada ~10min:
- **19h-20h UTC**: score travado em 50 (sem cruzamento de MACD), depois
  avançou pra candidatos reais bloqueados por `COST_GATE` (GER40 LONG,
  custo ~28% do alvo) e `CONTEXT_GATE` (estrutura de mercado contrária).
- **19:23 UTC**: 1º trade da sessão — ETHUSD LONG @2328,50.
- **20:17 UTC**: ETHUSD fecha em SL, PnL −0,64.
- **20:53 UTC**: 2º trade — BTCUSD SHORT @72572,88.
- **21:15-21:28 UTC**: mais um ciclo ETHUSD LONG, fecha em SL, PnL −0,53.
- **21:16 UTC**: BTCUSD fecha em SL, PnL −0,49.
- Nesse ponto (3 trades, todos SL) saldo da sessão estava **−1,67** —
  sinalizado ao Cleber como sequência de perdas a observar, mas dentro do
  range estatisticamente esperado pro win rate historicamente baixo do
  preset (não seria motivo de alarme sozinho).
- **21:57 UTC → falha de monitoramento**: 3 timeouts seguidos do MCP do
  Supabase (`execute_sql`) impediram os checks agendados de ~22h em diante.
  Sem indício de problema no motor em si — foi falha de conectividade da
  ferramenta de consulta, não do `ai-runner`. Cleber pediu retry mais tarde.
- **21/08, retry às ~11:54 UTC**: consulta finalmente respondeu, revelando
  que a sessão continuou operando normalmente a noite inteira sem
  supervisão — 41 trades fechados no intervalo não monitorado (22h-11h54
  UTC), a maioria em XAUUSD/ETHUSD/BTCUSD/SOLUSD, alguns UKOUSD/SPX500/GER40.

## Resultado final da sessão (até 21/08 11:55 UTC)

- **42 trades fechados** no total da sessão (contando os 3 do início da
  noite): 8 fecharam em TP, 34 em SL (vários SL com lucro pequeno pelo
  trailing stop antes de reverter).
- **Saldo líquido acumulado: +16,86** (recalculado após o fechamento do
  UKOUSD SHORT que ainda estava aberto no momento do último report ao
  Cleber — fechou em −5,15 logo em seguida).
- **1 posição ainda aberta**: XAUUSD LONG @4597,23 (entrada 11:53:43 UTC).
- Maiores ganhos: XAUUSD +12,73 (TP), XAUUSD +12,55 (TP), XAUUSD +5,84 (SL
  com lucro via trailing).
- Maiores perdas: UKOUSD −5,95 (SL), XAUUSD −5,20 (SL), XAUUSD −5,16 (SL),
  UKOUSD −5,15 (SL).

**Conclusão**: a preocupação original ("zero entradas", suspeita do fix de
MACD) não se confirmou como problema — era só o motor esperando condição de
entrada num momento sem rajada de momentum. Depois disso a IA operou de
forma ativa e consistente a noite inteira, terminando positiva. Nenhum
comportamento anômalo identificado nos ciclos monitorados (gates de custo e
contexto funcionando como esperado, sem trava real).

## Pendências pra próxima sessão

1. **Commit do fix de persistência de indicador ao trocar de ativo** (acima)
   — ainda não rodado nem verificado visualmente pelo Cleber.
2. **`DATA_NOT_REAL` intermitente** (fonte=generated) apareceu esporadicamente
   várias vezes entre 20:45-21:05 UTC, sempre em baixo volume (1-2
   ocorrências por janela) e sem nunca virar padrão dominante — não
   investigado a fundo qual símbolo especificamente cai pra dado gerado.
   Relacionado ao risco estrutural já registrado no item 8 do `CLAUDE.md`
   (cache sem TTL / dado desatualizado sob rate-limit da MetaAPI
   compartilhada). Se reaparecer de forma mais persistente, vale investigar
   qual ativo da cesta está caindo pro fallback.
3. **Posição XAUUSD LONG @4597,23 ainda aberta** no momento em que este
   arquivo foi escrito — conferir resultado na próxima sessão.
4. **3 timeouts seguidos do MCP do Supabase** (`execute_sql`) por volta de
   21:57-22h UTC de 20/08 — sem investigação de causa (pode ter sido
   instabilidade pontual da ferramenta/rede, não necessariamente do banco).
   Se voltar a acontecer, vale registrar horário e frequência.
5. **Sequência de perdas pequenas seguidas** (3 SL consecutivos entre 19h-21h
   UTC) foi sinalizada mas não gerou nenhuma ação — o padrão se resolveu
   sozinho com trades vencedores depois. Sem gatilho automático de pausa por
   sequência de perdas no motor hoje (existe cooldown/revenge-pattern
   genérico, mas não foi acionado neste caso) — não investigado se deveria.
