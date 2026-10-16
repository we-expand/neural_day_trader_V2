# Sessão 2026-10-15 — Estudo do dia 14/10, conselho, mesa dissolvida (modo `veto`), Fase 0 de medição e escalonador automático de risco

> Handoff completo desta sessão. Idioma: PT-BR. Nada foi commitado nem pushado
> por mim (regra fixa do projeto). O escalonador de risco foi **ligado ao vivo**
> (edição de `.env` + `./restart.sh`) a pedido explícito do Cleber ("pode já
> ligar"). Os 3 commits abaixo seguem **pendentes** — o motor roda do disco, então
> o que está ligado já vale, mas nada está versionado.

---

## 1. Pedido do Cleber e linha do tempo da sessão

1. "Faça um estudo profundo do dia anterior (14/10) e monte os ajustes necessários na LLM."
2. "Chame o conselho." → `llm-council` (5 conselheiros + 3 revisões cruzadas).
3. "Precisamos fazer mudanças robustas no motor. Ele precisa ganhar dinheiro. Preciso de um plano efetivo."
4. "Comece pela Fase 0: feche o buraco de medição + decomposição de P&L." → **feito**.
5. "A mesa de 14 agentes não carrega informação — dissolver como decisora. Precisamos fazer isso acontecer!" → **feito** (modo `veto`).
6. "O achado da MM9 (69-73%) usar como hipótese a validar ao vivo, tamanho mínimo, mas alavanca o que puder." → virou o **escalonador de risco**.
7. "Implemente o escalonador automático de risco. Me mostre os limiares antes de ligar." → **feito** (ship OFF), limiares aprovados.
8. "Pode já ligar." → **escalonador ligado ao vivo**.

---

## 2. Estudo do dia 14/10 (dados reais, SQL + relatórios + log + mesa)

Fontes: `llm-active-brain/reports/{pacote,erros,desk}-2026-10-14.md`, `ai_trades`,
`desk_decisions`, `llm-brain.log`.

### Trades (12 no dia, DEMO)
- Ganho devolvido grande: JPN225 SHORT chegou a MFE **$6,27** e saiu **+$2,46** por stop;
  outro JPN225 MFE $2,44 virou **−$0,34**; EURUSD MFE $1,49 saiu +$0,17.
- Dois rompimentos tardios de suporte (UKOUSD SHORT 22:59, SOLUSD SHORT 23:28) stopados
  em 5-6 min com **MFE zero** (caçando rompimento já esticado).
- Uma compra manual do LLM em JPN225 contra tendência curta: **−$2,93**.

### Acumulado (desde 22/09, 142 entradas)
- Acerto 35%, **E[R] líquido −0,33R/entrada** (IC95 −0,48 a −0,18), **−$139,77**.
- Saídas: SL 98 entradas −$202; TP 20 entradas +$69,55 (+1,05R cada).
- Setup REVERSAO n=43 E[R] −0,39 (IC inteiro negativo); ROMPIMENTO n=18 22% −$57.
- "A favor da tendência 1H" n=88 **−0,40R** (pior que contra). ETH ±$60 em 30; petróleo LONG −$27 em 8.

### Mesa de operações (14 agentes + Master), 14/10
- 211 deliberações, **23 aprovadas (11%)**, 188 rejeitadas.
- Das rejeitadas medidas: **30 dariam alvo, 30 dariam stop** → veto = cara ou coroa.
- Veto bom: "tempo maior contra" barrou 14 stops × 4 alvos. Veto ruim: "MACD 5m perdendo força" barrou 9 alvos × 3 stops.
- Convicção do Master ≥80 acertou **33%**; Analistas 15m/1H 31-33% (abaixo do acaso).
- **44% das deliberações sem desfecho medível** (sem velas 1m de índices) — buraco de medição.
- Das 23 aprovadas, só 10 viraram ordem (13 morreram em piso de valor / exposição duplicada).

### Decomposição de P&L (seção nova do error-report, Fase 0) — achado forte
- **Custo de execução consumiu 95% do P&L bruto** (−$70,54 de custo sobre −$73,89 bruto).
- **DIREÇÃO (entrada morta, MFE < 0,2R): −$158,90 em 51 entradas (35%)** — maior sangria.
- SAÍDA (ganho devolvido, ≥0,5R e terminou ≤0): −$19,06 em 14, com **$53,61 de pico não realizado** deixado na mesa.
- **NÚCLEO (o resto, inclui vencedores): +$33,52.** O setup não é o problema dominante — entrada morta e custo são.

---

## 3. Veredito do conselho (`llm-council`, unânime nas revisões cruzadas)

- **Não há edge comprovado**; a mesa de 14 agentes é ruído caro e lento → dissolver como decisora.
- Cortar o que os dados condenam (REVERSAO, ROMPIMENTO tardio, ETH, petróleo LONG); manter só o veto "tempo maior contra"; remover "MACD 5m perdendo força".
- A MM9-em-expansão (69-73%) é **backtest com look-ahead** — confirmado em 15/10 (ver CLAUDE.md topo): refeito com custo e índices = **sem vantagem**. Nunca dimensionar por Kelly sobre número não validado.
- **"Exponencial" com E[R] negativo é exponencial para baixo.** Alavancagem multiplica E[R]; hoje é negativo. Crescimento real = aporte + validar edge, não apostar mais.
- Ponto cego pego na revisão: os 142 trades misturam regimes não-estacionários (stop mudou várias vezes) → cortar por IC herda viés; e ninguém tinha decomposto os −$140 em direção × saída × custo (Fase 0 fez isso).

---

## 4. O que foi implementado (tudo no disco, tsc limpo, `npm run validate` 37/37)

### Fase 0 — medição (commit pendente)
Arquivos: `llm-active-brain/src/atr.ts`, `llm-active-brain/scripts/error-report.ts`.
- **NO_DATA de 44% corrigido**: o job de desfecho da mesa (`deskStore.ts` →
  `getRecentOneMinuteCandles`) buscava só **60 velas de 1m** (60 min), mas o horizonte
  é 60 min e o job só resolve a decisão minutos/horas depois → perdia o começo da janela.
  Agora busca **400 velas** (`getDeepCandles(symbol,"1m",400)` ~6,6h) com fallback pro
  fetch raso. Mercado de fato fechado continua NO_DATA honesto.
- **Seção "Decomposição do resultado líquido"** no error-report: separa o líquido em
  custo × entrada morta (direção) × ganho devolvido (saída), baldes disjuntos que somam o total.

### Modo `veto` — mesa dissolvida (commit pendente)
Arquivos: `llm-active-brain/src/config.ts`, `llm-active-brain/src/desk.ts`, `llm-active-brain/src/tools.ts`.
- Novo valor `MT5_DESK_MODE=veto`: **1 LLM propõe, os vetos de código (`computeHardVetoes`)
  decidem**, sem nenhuma chamada de LLM de júri. `deliberateCodeOnly()` em `desk.ts` roda só
  os vetos; a linha em `desk_decisions` continua gravada = mesa vira log paralelo.
- Em `veto` as travas de JULGAMENTO de `open_position` também saem (igual ao teste só-LLM):
  o gate passa a ser só os vetos de código. `llmOnlyTest` agora é true em `veto` (tools.ts).
- Gate de rejeição e checagem de drift agora valem para `enforce` **ou** `veto`.
- Rollback: `MT5_DESK_MODE=enforce`.
- **NÃO foi ligado** — a mesa segue em `enforce`. Para dissolver: trocar `.env` e reiniciar.

### Escalonador automático de risco — `riskScaler.ts` (commit pendente, **LIGADO ao vivo**)
Arquivos: `llm-active-brain/src/riskScaler.ts` (novo), `config.ts`, `tools.ts`.
- Multiplica o **alvo de exposição** (`mt5TargetRewardUsd` no open_position; risco% no
  pyramiding) a partir do tamanho de hoje. **Nunca afrouxa** o teto duro `mt5MaxRiskPctPerTrade`.
- Decisão stateless pela janela das **últimas 150 entradas fechadas** (consolidadas por entrada,
  custo descontado), E[R] com IC95. Escada:

  | Degrau | Escala | Exige |
  |---|---:|---|
  | Piso | 0,25× | padrão / não provado / perdendo |
  | 1 | 0,50× | n ≥ 40 e IC95 inferior de E[R] > 0,00 |
  | 2 | 0,75× | n ≥ 80 e IC95 inferior > +0,05 |
  | 3 | 1,00× | n ≥ 150 e IC95 inferior > +0,10 |

  Freio de ruína: IC95 **superior** < 0 → cai direto pro piso. Amostra < 20 → piso.
- `MT5_RISK_SCALER=true` adicionado ao `.env`; motor reiniciado (PID 26140, instância única,
  sem watchdog concorrente). Log `[RISK-SCALER]` aparece no 1º dimensionamento de entrada.
- **Com E[R] atual negativo, o escalonador opera no piso 0,25× (≈0,5% de risco), ou seja,
  ligar REDUZIU o tamanho.** Ele só sobe quando o E[R] se provar positivo.
- Rollback: `MT5_RISK_SCALER=false` + restart.

---

## 5. Pendências reais

- **Rodar os 3 commits** (comandos entregues no chat): Fase 0, modo `veto`, escalonador.
  Nada versionado ainda; o escalonador já está ativo só porque o motor roda do disco.
- Decidir se dissolve a mesa de verdade (`MT5_DESK_MODE=veto`) — hoje segue `enforce`.
- Observar o 1º `[RISK-SCALER]` no log e as próximas entradas sob o piso 0,25×.
- Cleber mencionou "a gente vai fazer ajustes na LLM" — aguardando o que ele tem em mente.
- Aviso recorrente no boot: Setup tem `XPDUSD` que não existe em `assetBasket.ts` (ignorado em silêncio) — adicionar se for símbolo real.

---

## 6. Números de referência (para a próxima sessão não recalcular do zero)

- IA desde 01/09: 572 entradas, −$374, todas as semanas negativas (CLAUDE.md topo, 15/10).
- Acumulado 22/09: 142 entradas, 35%, E[R] −0,33R, −$139,77.
- Decomposição: custo 95% do bruto; entrada morta −$158,90 (35%); núcleo +$33,52; pico devolvido $53,61.
- Mesa 14/10: 211 deliberações, veto = cara ou coroa (30/30), convicção ≥80 → 33%.
