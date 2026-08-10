# Sessão 2026-08-05 (manhã) — A IA não ficou ligada, e o runner 24/7 vira requisito

> Continuação direta de `SESSAO_2026-08-04_FASE1_LEITURA_FUNIL.md`.
> **Sessão de diagnóstico e decisão de escopo. Nenhuma linha de código foi
> escrita, nenhuma medição foi executada.** O que existe aqui é dado lido do
> banco, um achado de arquitetura e duas decisões do Cleber.

## Contexto

Cleber cumpriu o passo 2 do handoff anterior ("manter a aba em primeiro plano")
da forma que fazia sentido pra ele: deixou a IA ligada da noite de 04/08 até a
manhã de 05/08. Reportou: nenhuma entrada, e **"não é isso que estou esperando.
A AI tem que operar!"**.

## Achado 1 — a IA não estava ligada; estava congelada

Sessão `f6785c05-eac4-49d6-990a-1a5de9ec8d30` (a mesma de ontem, ainda
`RUNNING`), 04/08 19:33 → 05/08 09:52 = **14h20 de relógio**.

| Métrica | Real | Esperado (loop de 5s) | Perda |
|---|---|---|---|
| Janelas de 1 min gravadas | **53** | 860 | 93,8% |
| Ticks | **131** | ~10.320 | **98,7%** |
| Avaliações | **393** | ~30.960 | 98,7% |
| Trades | **0** | — | — |

**Não é o throttle suave de ontem (12 → 1 tick/min). É suspensão.** A linha do
tempo das janelas mostra o padrão sem ambiguidade:

| Faixa | Janelas | Observação |
|---|---|---|
| 19:33 → 20:13 | 41 contínuas | fase já medida ontem |
| **20:13 → 09:46** | **6 janelas em 13h33** | gaps de 154,7 / 104,4 / 80,6 / 141,3 / 115,9 / 134,1 min |
| 09:46 → 09:51 | 6 contínuas | Cleber voltou à máquina |

Durante a noite a IA avaliou o mercado **~6 vezes em 13 horas**. Nenhuma
estratégia abre posição vendo preço 6 vezes em 13 horas. A pergunta "por que
não entrou?" não tem resposta de gate — ela não estava olhando.

## Achado 2 — nos minutos em que rodou, também não entraria

`stage_counts` agregado das 393 avaliações:

| Estágio | N | % |
|---|---|---|
| `NO_SIGNAL` | 372 | **94,7%** |
| `CANDLES_FETCH_FAILED` | 11 | 2,8% |
| `DATA_NOT_REAL` | 7 | 1,8% |

Zero chegou a gate de risco, notícia ou execução. Consistente com ontem: o
preset ativo (`"2"` — Cruzamento de Médias com Filtro de Regime) exige
simultaneamente cruzamento EMA20/EMA50 (**evento pontual**), EMA50 subindo,
ADX>20, e é long-only. Raro por construção.

`CANDLES_FETCH_FAILED` (2,8%) é **estágio novo** — não aparecia no funil de
ontem. Baixo volume, não investigado. Anotar, não priorizar ainda.

## Achado 3 (o que muda o tamanho do trabalho) — o ciclo não é importável

A Fatia 1 provou que os **módulos** do motor (indicadores, `StrategyEvaluator`,
`MarketScoreEngine`) rodam sob Deno. Isso continua verdade e continua valioso.

**Mas o ciclo de decisão em si não é uma função.** Ele é um `setInterval` de
~1.100 linhas escrito *dentro* de um `useEffect` do React
([useApexLogic.ts:1260-2370](src/app/hooks/useApexLogic.ts:1260)), lendo do
fecho: `activeOrders`, `aiConfig`, `lastTradeTimestampRef`,
`cachedNewsEventsRef`, `cachedVIXRef` — e chamando `setState` pra registrar
trades.

**Consequência: "Fatia 2" como estava escrita no handoff anterior ("rota
agendada que lê sessões RUNNING, roda o motor e grava snapshots") está
subdimensionada.** Não dá pra chamar o ciclo do servidor porque ele só existe
acoplado ao React.

## Decisão 1 do Cleber — runner 24/7 operando de verdade é requisito de produto

Palavras dele: *"A AI tem que continuar rodando mesmo se o computador for
desligado ou o browser fechado. Isso é uma conta de usuário e a menos que o
usuário desligue a AI ela tem que continuar rodando. (…) O recurso tem que
existir. Ela não pode 'desligar' deliberadamente."*

Escopo escolhido, com o detalhe que ele acrescentou:

- **Operar de verdade em DEMO** — abrir, gerir (stop/take/trailing) e fechar
  posição sem browser aberto, gravando em `ai_trades`.
- **24/7, não 24/5.** Cripto (BTCUSD, XBNUSD) opera fim de semana. Portanto: o
  agendamento **não pode ter trava de dia útil**, e o gate de mercado aberto
  tem que ser **por símbolo**, nunca global. (Bate com o que já está registrado
  sobre horário de CFD.)
- Execução em conta REAL fica fora desta entrega.

## Decisão 2 do Cleber — o critério de sucesso é financeiro, não de contagem

*"Não irá ajudar em nada, ela fazer poucas entradas e quando fizer ainda vir
com trocados, se não, não irá compensar financeiramente. Temos que encontrar o
ponto de equilíbrio."*

Critério correto e aceito: `frequência × pontos por trade − custo`. **Hoje
nenhum dos três está medido neste motor.**

## Por que a IA foi desligada em vez de ficar ligada pro teste da abertura

Cleber perguntou se valia deixar ligada pra abertura americana (10:30). Resposta
dada, e a razão importa mais que a resposta: a pergunta que ele quer responder
("quantas entradas/dia e quantos pontos") **não precisa da IA ligada** — e a IA
ligada é a pior forma de respondê-la. Uma manhã de mercado é amostra N≈1; o
mesmo motor sobre histórico real dos 9 ativos dá meses de amostra em minutos,
sem ninguém vigiando aba.

**IA desligada. Isso é decisão tomada, não pendência.**

## O que NÃO foi feito nesta sessão — leia antes de assumir qualquer coisa

- ❌ **A medição de taxa base NÃO foi iniciada.** Foi planejada e acordada, nada
  mais. Nenhum script existe, nenhum número foi produzido.
- ❌ **Nenhuma linha de código escrita.** Nenhum arquivo modificado.
- ❌ **Nenhum preset trocado, nenhum limiar afrouxado.** Segue valendo a regra:
  mexer em limiar antes de ter a taxa base é chute.
- ❌ `CANDLES_FETCH_FAILED` não investigado.
- ❌ `CLAUDE.md` e `NEXT_SESSION.md` **continuam afirmando que a Fatia 1 está
  "não commitada", o que é falso** desde ontem (commits `81c1237da`,
  `52f0f6ea0` na branch `dev`). A correção foi registrada no doc de ontem mas
  nunca aplicada nos dois arquivos.

## Próximos passos, em ordem

### 1. Medir a taxa base — PRIMEIRO, e não depende de deploy nem de aba aberta

Sobre histórico real, para os 5 presets × os 9 ativos × timeframes, com custo
real descontado (`research/CostModel.ts`). Saída pretendida: tabela de
**entradas/dia × pontos médios por trade × resultado líquido** por
configuração.

É o número que decide qual config a IA deve rodar quando o runner existir — e é
a resposta direta ao "ponto de equilíbrio" do Cleber.

**Ressalva de método, combinada com ele e não negociável:** isto mede
**viabilidade operacional** (com que frequência cada config dispara e quanto
movimento captura). **Não prova edge.** A investigação de julho concluiu que
edge de sinal técnico não foi encontrado neste projeto, e nada aqui reverte
isso — ver `CLAUDE.md`, seção "Cérebro de decisão da IA".

### 2. Extrair o ciclo de trading do `useEffect`

Alvo: `runTradingCycle(estado, deps) → { decisões, efeitos }` — módulo puro,
sem React, sem `setState`, recebendo por parâmetro o que hoje lê do fecho e
**devolvendo efeitos em vez de aplicá-los**.

Rede de proteção disponível (usar as duas):
- `npm run validate` — gate obrigatório do projeto.
- **A telemetria de funil é o teste de equivalência**: mesma entrada tem que
  produzir o mesmo `stage_counts` antes e depois da extração. É o que prova que
  o comportamento não mudou.

### 3. Runner Deno sobre o ciclo extraído

Lê `ai_sessions` RUNNING → monta o estado a partir do banco → chama a **mesma**
função → aplica efeitos → grava `ai_trades` e `ai_funnel_snapshots`. Cron do
Supabase, **sem trava de dia útil**, com lock pra não rodar duas instâncias na
mesma sessão. Gate de mercado aberto **por símbolo**.

Princípio que não muda: **um motor, dois drivers.** O runner importa o motor do
browser, nunca copia.

### 4. Fase 2 — o `k(t)`, inalterada.

## Consultas usadas (reprodutíveis)

Projeto Supabase `wyvdsxtcmizettljxtbg`. As 4 consultas do doc de ontem seguem
válidas. A que produziu o achado 1 desta sessão:

```sql
-- gaps entre janelas: expõe suspensão de aba (vs. throttle)
select to_char(window_start at time zone 'America/Sao_Paulo','DD/MM HH24:MI') as janela_brt,
       ticks, evaluations,
       round(extract(epoch from (window_start - lag(window_start) over (order by window_start)))/60.0,1) as gap_min
from ai_funnel_snapshots
order by window_start;
```
