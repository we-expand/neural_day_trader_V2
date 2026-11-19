# Sessão 2026-09-04 (tarde/noite) — Monitoramento contínuo do LLM Brain, fix de R:R e log de operações

## Contexto do pedido

Cleber pediu monitoramento contínuo (5 em 5 min) do motor LLM Brain
(`llm-active-brain/`), com objetivo explícito: "quando perder, perde pouco;
quando ganha, ganha muito" — encontrar bugs reais que atrapalhem isso e
corrigir, entregando sempre comando de commit pronto (nunca commit/push
autônomo).

## Achado principal: alvo saindo menor que o stop (bug real)

**Sintoma reportado pelo Cleber ao vivo**: "o alvo tem que ser maior do que
o stop... não pode ser assim" — trade real NAS100 SHORT abriu com
`stop_pct=0.300%` e `take_profit_pct=0.274%` (R:R 0,91:1), mesmo com
`targetPoints="MÉDIO"` pedindo R:R 3:1.

**Causa raiz 1 (bug de código, `llm-active-brain/src/tools.ts:1398`)**: a
referência de risco usada pra calcular o alvo (`targetReferenceStopPct`)
checava `atrPctForStop != null`, mas isso não é a condição certa — o stop
cai pro fallback seguro (`usedFallbackStop=true`) tanto quando o ATR real é
nulo QUANTO quando o ATR real existe mas dá um `dynamicStopPct` fora do
range `[mt5StopMinPct, mt5StopMaxPct]` (ex.: ATR minúsculo). Nesse segundo
caso, `atrPctForStop` continuava não-nulo, então o alvo ficava ancorado no
ATR real minúsculo (`atrPctForStop * mt5TargetReferenceStopAtrMultiplier`)
em vez do fallback seguro e maior que o stop de fato usado — gerando alvo
menor que o stop. **Corrigido**: a condição agora checa `!usedFallbackStop`
(cobre os dois casos).

**Causa raiz 2 (config afrouxada, `.env`)**: `MT5_MIN_RR_AFTER_SR_CAP=0.6`
era um paliativo de 2026-09-02 (documentado no próprio `.env` como
"reavaliar depois") nunca revertido. A trava final incondicional
(`tools.ts`, commit `162db9cd3` de mais cedo hoje, cobre QUALQUER causa de
alvo pequeno, não só cap de S/R) usava esse mesmo valor como piso mínimo de
R:R — com 0,6 ativo, um R:R de 0,91:1 passava sem bloqueio. **Revertido pra
1.0** (default do código).

**Fixes aplicados às 14:50 BRT, processo reiniciado (watchdog religou sem
zumbi), `tsc --noEmit` limpo.**

### Confirmação ao vivo (via log + Supabase)

Depois do restart, 2 trades novos:
- **XETUSD SHORT** (`9c73bda9...`): stop 0,193% / alvo 0,453% → **R:R
  2,35:1** (alvo capado por S/R real, mas ainda acima do piso). Fechou no
  stop mecânico horas depois com perda pequena (-$1,79) — comportamento
  correto e proporcional.
- **SPX500 SHORT**: corretamente **recusado** pelo gate ("R:R mínimo de
  1.0:1"), confirmando que o `.env` revertido pra 1,0 está em vigor.

### Composição real do prejuízo do dia (consulta direta no Supabase, `ai_trades`)

A sessão bateu o limite de perda diária (25% do Setup, prejuízo real
27,29% — conta de $100, ~-$27). Investigado se veio do bug ou de antes:

| Trade | Entrada (UTC) | net_pnl | Antes/depois do fix (17:50 UTC) |
|---|---|---|---|
| NAS100 LONG | 13:37 | +0,02 | antes |
| BTCUSD LONG | 14:02 | **-3,62** | antes |
| XETUSD LONG | 14:02 | **-5,06** | antes |
| UKOUSD SHORT | 14:12 | **-8,00** | antes |
| SPX500 LONG | 16:41 | +0,06 | antes |
| XETUSD LONG | 16:47 | -0,86 | antes |
| XETUSD LONG | 17:12 | -1,67 | antes |
| SPX500 LONG | 17:20 | -0,67 | antes |
| NAS100 SHORT | 17:48 | +0,15 | antes (2min antes do restart) |
| XETUSD SHORT | 17:56 | -1,79 | **depois** (R:R 2,35:1 confirmado) |

**Conclusão**: a maior parte do prejuízo (~-$21,44 de ~9 trades) veio de
**antes** do fix, concentrado numa janela de 18min (14:02-14:20 UTC) com 3
trades ruins seguidos (BTCUSD, XETUSD, UKOUSD). Pós-fix, só 1 trade fechado
até o momento, com comportamento correto (perda pequena, proporcional ao
R:R desenhado) — amostra insuficiente pra validar edge, mas a mecânica de
risco parou de ser autodestrutiva.

## Achados de rotina (não-bugs, guardrails funcionando)

- **Fechamento manual prematuro bloqueado corretamente** 2x (NAS100 e
  XETUSD) pelo guard de "≥50% do caminho até stop/alvo ou 2 fatores
  técnicos reais" — funcionando como projetado.
- **Limite de perda diária (25%) disparou e bloqueou novas entradas**
  corretamente até 00:00 Brasília — guardrail correto, não bug.
- **5 timeouts consecutivos (ciclos 8-12)** na chamada do agente (90s) —
  investigado: causa real foi um blip transitório de DNS
  (`getaddrinfo ENOTFOUND wyvdsxtcmizettljxtbg.supabase.co`), autorresolvido
  minutos depois (`nslookup`/`curl` confirmaram DNS normal). Ollama local
  (`llama-server`, modelo `qwen35-trading`, contexto 24576) nunca ficou
  travado de verdade (`/health` sempre respondeu rápido) — voltou a
  completar ciclos normalmente sozinho, confirmado via CPU ativa (77,7%)
  processando o ciclo 13. Nenhum fix de código necessário, foi mesmo
  transitório.
- **GER40/UK100 com tick obsoleto (>1000s)** durante a tarde — mercado
  europeu fechado nesse horário, comportamento esperado, não bug (a trava
  de cotação obsoleta já existente bloqueou operar nesses ativos
  corretamente).

## Mudança de UI: taxa de acerto por dia no Log de Operações

Cleber pediu pra ver o percentual de acerto ao lado do PnL em dólares na
tela "Logs de Operações — Auditoria" (lista agrupada por dia).

**Implementado** em
[src/app/components/admin/OperationLogs.tsx](src/app/components/admin/OperationLogs.tsx:281):
cada linha de dia agora mostra `XX.X% acerto` (mesma fórmula do card "Taxa
de Acerto" do topo da página: vitórias / fechados do dia × 100) ao lado do
PnL líquido do dia. `tsc --noEmit` sem erro novo. Não testado visualmente
(tela atrás de login admin, sem credenciais nesta sessão) — lógica é a
mesma já usada e validada no card agregado do topo.

## Pendências reais em aberto

1. **Amostra pós-fix ainda pequena** (1 trade fechado) — precisa de mais
   dias rodando com os 2 fixes de R:R aplicados antes de qualquer
   conclusão estatística sobre melhora no líquido.
2. **Motor ficou bloqueado até 00:00 Brasília** por ter batido o limite de
   perda diária — nenhuma ação de código necessária, é reset automático.
3. Commits abaixo ainda não aplicados (comando pronto, aguardando Cleber).

## Comandos de commit pendentes

```bash
git add llm-active-brain/src/tools.ts && git commit -m "$(cat <<'EOF'
fix(llm-brain): alvo usa referencia do fallback de stop, nao ATR real minusculo isolado

Quando o ATR real vinha pequeno demais e o stop caia pro fallback seguro
(MT5_STOP_MIN_PCT), o alvo continuava calculado sobre o ATR real minusculo,
produzindo R:R pior que 1:1 mesmo com targetPoints pedindo 3:1 -- confirmado
ao vivo (NAS100 SHORT, stop 0.300% vs alvo 0.274%). Corrigido checando
usedFallbackStop (cobre ATR nulo E ATR fora do range) em vez de so
atrPctForStop != null.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

```bash
git add src/app/components/admin/OperationLogs.tsx && git commit -m "$(cat <<'EOF'
feat(logs): mostra taxa de acerto do dia ao lado do PnL na lista diaria

Cada linha do agrupamento por dia (Logs de Operacoes -- Auditoria) agora
exibe o percentual de vitorias daquele dia (mesma formula do card "Taxa de
Acerto" do topo), ao lado do PnL liquido em dolares.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Nota: `.env` (`MT5_MIN_RR_AFTER_SR_CAP=0.6→1.0`) não é versionado
(gitignored) — já editado direto no arquivo local, sem commit necessário,
processo já reiniciado com o valor novo.
