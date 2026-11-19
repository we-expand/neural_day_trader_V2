# Sessão 2026-09-02 (tarde/noite) — Monitoramento contínuo de 5 em 5 min do
# LLM Brain: entrada "infantil" investigada, gate de confluência em mercado
# LATERAL, e corte de perda antecipado com invalidação técnica real

## Contexto / motivação

Continuação direta do mandato já registrado em
[[feedback_llm_brain_ownership_otimizacao]]: não só observar o motor, ser
responsável por fazer ele ganhar mais vezes do que perde, ganhar bastante
quando ganha, perder pouco quando perde. Sessão começou lendo o handoff
[SESSAO_2026-09-02_MOTOR_MUDO_MAX_TOKENS_MIGRATION_PENDENTE_E_ALAVANCAGEM.md](SESSAO_2026-09-02_MOTOR_MUDO_MAX_TOKENS_MIGRATION_PENDENTE_E_ALAVANCAGEM.md)
e ativou monitoramento perene de 5 em 5 minutos (via `ScheduleWakeup`,
encerrado ao fim desta sessão a pedido do Cleber).

## Estado inicial (sessão `1d73c50a-...`)

17 trades fechados, 13 vitórias / 4 perdas (76% acerto), líquido +$12,39.
Padrão observado: `avg_win $1,70` vs `avg_loss $2,44` — **inverso** do que o
Cleber quer (ganha muitas vezes, pouco por vez; perde menos vezes, mas mais
por vez). Só 1 dos 17 fechamentos foi TP real — os outros 12 "SL" na
verdade fecharam em lucro pequeno via trailing/breakeven, que já tinha sido
solto nesta mesma sessão anterior (`MT5_BREAKEVEN_TRIGGER_R=0.5`,
`MT5_TRAIL_ATR_MULTIPLIER=1.6`, aplicado ~14:59 local, antes das 3 posições
que estavam abertas no início desta sessão). Efeito desse ajuste **não
avaliado ainda** — as posições que rodaram sob ele não fecharam durante
esta sessão.

## Achado 1: entrada "infantil" em XETUSD — investigada, causa raiz real

Cleber reportou (com razão) que uma entrada LONG em XETUSD pareceu ignorar
sinais de venda. Investigação no log (`llm-brain.log`) confirmou, com dado
real, que **no momento exato da entrada** (19:02:15 UTC) o mercado estava
**LATERAL**, MACD **ALTA** (positivo), sem nenhum padrão de candle
detectado — os sinais de venda (trend BAIXA, MARUBOZU_BAIXA, Estocástico
SOBREVENDIDO) só apareceram **depois** que a posição já estava aberta. A
própria IA admitiu no reasoning: "Entrada moderada por convicção única num
setup não-trend-clear".

**Causa raiz real**: o gate de contra-tendência existente em `open_position`
(`tools.ts`) só roda quando `trend.label !== "LATERAL"` — em mercado
lateral, **não havia nenhuma trava de confluência**, um único indicador
bastava pra abrir.

## Fix 1 (commitado, pendente de o Cleber rodar): gate de confluência mínima em LATERAL

`llm-active-brain/src/tools.ts`, `open_position` — em trend LATERAL, agora
exige **≥2 de 4 fatores reais** alinhados com o lado da entrada (MACD,
Estocástico em extremo, volume elevado, padrão de candle) antes de aceitar
a posição. `tsc --noEmit` limpo. Commit pronto entregue ao Cleber, **ainda
não aplicado** (processo seguia rodando com o código antigo desde 16:06 ao
fim desta sessão).

## Achado 2 / pedido direto do Cleber: "inteligência de operação"

Cleber pediu explicitamente: quando a IA perceber que a operação está indo
mal de verdade (não ruído), ela tem que poder fechar e tomar um prejuízo
**menor que o stop traçado**, em vez de esperar passivamente bater o stop
cheio. Isso tensiona com uma trava já existente (histórico do projeto,
2026-08-30): fechamento manual só era aceito com ≥50% do caminho já
percorrido até o stop/alvo, ou lucro real acima do spread — regra criada
justamente pra evitar fechamento **nervoso** em ruído (2 casos documentados
de preço voltando a favor logo depois).

## Fix 2 (commitado, pendente de o Cleber rodar): corte de perda antecipado com invalidação técnica real

`close_position` (`tools.ts`) ganhou um carve-out simétrico ao já existente
pra lucro (`clearsSpread`): quando **≥2 fatores técnicos reais** (tendência,
MACD, Estocástico, padrão de candle) confirmam inversão **contra** o lado
da posição, o fechamento manual é aceito mesmo antes de 50% do caminho ao
stop — prejuízo menor que o stop cheio. Exige confluência real (não só o
texto do reasoning) pra não reabrir o problema de fechamento nervoso.
`tsc --noEmit` limpo. Commit pronto, **ainda não aplicado**.

## Achado 3: 2 fechamentos observados ao vivo (sob o código ANTIGO, pré-fixes)

Durante o monitoramento, 2 das 3 posições abertas fecharam:

- **BTCUSD SHORT**: fechamento manual (+$1,69) — Estocástico em extremo
  confirmou exaustão, travou lucro antes de reversão. Decisão correta.
- **XETUSD LONG**: fechamento manual (**-$5,52**, pior que a `avg_loss`
  anterior de -$2,44) — a IA identificou a inversão real corretamente (3
  fatores reais alinhados: trend BAIXA + MACD BAIXA + Estocástico
  SOBREVENDIDO), mas **o preço já tinha escorregado além do próprio stop
  (2384,74) por conta do tempo entre a decisão e a execução** — saiu em
  2383,84, pior que o stop mecânico teria dado. Confirmado no log: esse
  fechamento já era aceito pela regra ANTIGA dos 50% (o trade já tinha
  passado ~71% do caminho ao stop quando a decisão começou) — **não é um
  bug introduzido pelos fixes desta sessão** (nenhum dos dois estava
  aplicado ainda), é uma característica conhecida: a checagem de
  stop/decisão roda 1x por ciclo, e o raciocínio do LLM leva tempo, então o
  preço pode escorregar durante esse intervalo.

**Estado final da sessão** (`1d73c50a-...`): 19 fechados / 1 aberto (NAS100
SHORT), 14 vitórias / 5 perdas, `avg_win $1,70` / `avg_loss -$3,05`,
líquido `$8,55`.

## Pendências reais pra próxima sessão

1. **Cleber precisa rodar os 2 commits abaixo e reiniciar o processo** —
   nenhum dos dois fixes está ativo ainda.
2. Observar amostra nova sob os 2 fixes: (a) se o gate de confluência
   LATERAL está de fato bloqueando entradas de convicção única; (b) se o
   corte antecipado de perda está sendo usado com disciplina (invalidação
   real) e não virando desculpa pra sair cedo demais.
3. Investigar (sem pressa, precisa de mais amostra) o padrão de atraso
   decisão-execução no fechamento manual — se repetir, considerar checar
   stop/alvo com mais frequência que 1x por ciclo, ou dar prioridade
   máxima ao fechamento de posições já em invalidação confirmada antes de
   qualquer outra avaliação no mesmo ciclo.
4. Avaliar o efeito do `MT5_BREAKEVEN_TRIGGER_R=0.5`/`MT5_TRAIL_ATR_MULTIPLIER=1.6`
   soltados na sessão anterior — ainda sem trades fechados sob esse ajuste
   até o fim desta sessão.
5. `dailyLossLimit=15%` (Supabase, sessão anterior) segue sem avaliação de
   adequação — precisa de amostra de dias.

## Commits pendentes (nenhum aplicado pelo Cleber ainda)

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader && git add llm-active-brain/src/tools.ts && git commit -m "$(cat <<'EOF'
fix(llm-brain): exige confluencia minima de 2 fatores em mercado LATERAL

Achado ao vivo (Cleber): XETUSD LONG aberto so com MACD positivo, num
mercado LATERAL sem nenhuma segunda confirmacao -- o proprio reasoning
admitiu "conviccao unica". O guard de contra-tendencia existente so
rodava quando trend != LATERAL, deixando mercado lateral sem nenhuma
trava de confluencia. Agora exige >=2 de 4 fatores reais (MACD,
Estocastico extremo, volume elevado, padrao de candle) alinhados com o
lado antes de abrir em trend LATERAL.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader && git add llm-active-brain/src/tools.ts && git commit -m "$(cat <<'EOF'
feat(llm-brain): permite cortar perda antes do stop cheio com invalidacao tecnica real

Pedido direto do Cleber ("inteligencia de operacao" -- perder pouco, nao
esperar bater no stop e perder muito). Antes, fechamento manual de
posicao perdedora exigia >=50% do caminho ate o stop ja percorrido.
Agora, com >=2 fatores tecnicos reais (tendencia, MACD, Estocastico,
padrao de candle) confirmando inversao contra a posicao, o corte
antecipado e permitido -- prejuizo menor que o stop tracado. Exige
confluencia real (nao so o reasoning do modelo) pra nao reabrir o
problema ja documentado de fechamento nervoso por ruido.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Depois de rodar os dois: reiniciar o processo do motor pra pegar o código
novo (mesmo procedimento de sempre).
