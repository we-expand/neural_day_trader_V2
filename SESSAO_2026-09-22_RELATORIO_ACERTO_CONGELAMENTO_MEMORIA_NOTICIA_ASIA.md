# Sessão 2026-09-22 (noite) — Relatório de acerto, congelamento de mecânica, investigação de memória/SIGKILL e notícia asiática

## 1. Relatório do dia 22/09

Levantamento real via SQL (`ai_trades`, sessão `159c2368-ec61-4ec7-9abb-0d2dc84ce17b`, todas DEMO):
7 operações fechadas (4 entradas distintas, 2 delas com realização parcial em 2 lotes) — **71,4% de acerto, +$1,70 líquido**.
BTCUSD LONG (+$1,06/+$2,42), XETUSD SHORT 13h21 (-$7,03, maior perda do dia), UKOUSD SHORT
(+$2,64/+$5,47, melhor trade), XETUSD SHORT 17h08 (+$0,71) e XETUSD SHORT 19h32 (-$3,56).

## 2. Meta de acerto — 76% como referência, não trava

Cleber pediu meta de referência (não mecânica) de ~76% de acerto médio. Puxado **14 dias reais** (304
trades fechados): **38,8% de acerto geral, -$236,59 líquido** — o dia 22/09 foi na verdade um dos
melhores do período, não o padrão.

Por ativo (14 dias): **UKOUSD tem payoff invertido** (perda média -$6,25 vs ganho médio +$2,50, 38
trades, pior PnL de todos: -$123,59) — mesmo padrão já catalogado em sessão anterior (09-09). **JPN225
é o oposto**: acerto baixo (45,5%) mas payoff ~6:1 (ganho médio $7,98 vs perda $1,39), único ativo com
lucro relevante (+$31,57). LNKUSD (7,1% em 14 trades) e SOLUSD (0% em 10 trades) têm edge
estruturalmente negativo em amostra grande — candidatos a revisão futura, **não mexidos ainda**.

**Investigação da causa da baixa média**: descartada a hipótese inicial (teste do Kimi K3) — confirmado
via `git log` que o teste desse modelo ficou confinado só ao 22/09, que foi o MELHOR dia do período, não
explica os dias ruins. Causa real encontrada: o motor mudou gate de entrada (Estocástico, volume,
confiança mínima, marketDirection) **quase todo santo dia** entre 09-12 e 09-22 — nenhum dia comparável
ao outro, mesmo padrão de risco que o próprio projeto já tinha identificado em 09-04/09-05
("não mexer em mais de uma coisa por vez").

## 3. Decisão: congelamento de mecânica

**A partir do commit `fec06949a` (22/09 ~22h06), nenhuma mudança de gate/regra de entrada por no mínimo
5 dias úteis ou 40 trades fechados.** Objetivo: medir o acerto real DESSA configuração antes de decidir
se falta mais alavanca ou se já está aceitável. Registrado em memória:
`project_congelamento_mecanica_2026-09-22.md`. Correções de infraestrutura/exibição que não tocam
decisão continuam liberadas (foi assim que justificamos as mudanças das seções 4-6 abaixo).

## 4. Cesta por horário (dia/noite/fim de semana) — não implementado

Cleber queria trocar de cesta automaticamente por horário (dia útil-dia / dia útil-noite-asiática / fim
de semana) pra não ter que ligar/desligar a IA toda hora. **Isso contradiz uma decisão anterior dele
mesmo (09-04): "seleção de ativos é sempre decisão do usuário via Setup, nunca automática" — avisado,
ele preferiu não automatizar por enquanto.**

Achado que resolve o incômodo sem automação: **confirmado no código (`neuralBridge.ts:438`,
`USER_CONFIG_CACHE_MS=60_000`) que o motor relê a cesta do Setup sozinho a cada ciclo, sem restart** —
e o watchdog de stop/alvo (`enforceMt5StopsAndTargets`) protege todas as posições abertas independente
da cesta configurada (`listMt5OpenPositions` não filtra por `activeAssets`). Ou seja, Cleber pode trocar
a cesta no Setup e salvar, sem desligar a IA, sem perder proteção de posição aberta.

## 5. Investigação de memória — SIGKILL recorrente

Pergunta do Cleber: "está havendo interrupções?" — **Sim, achado real e sério.**

- **10 travamentos por SIGKILL (código 137) só no dia 22/09** (11h37, 11h54, 12h14, 12h28, 12h34, 12h52,
  19h50, 20h40, 20h45, 22h07, e mais depois: 22h55→23h03, 23h03→23h38...). O `watchdog.sh` religa
  sozinho em ~5s a cada vez (por isso não vira parada longa), mas cada kill mata o ciclo de raciocínio
  em andamento.
- **Causa raiz**: máquina com só **16GB de RAM**. Ollama (`llama-server`, modelo `qwen3-1.7b-trading`,
  `-c 32768`) sozinho consome **~3,9GB de RSS** — maior processo do sistema, à frente do Chrome (32
  abas, 1,58GB) e Claude Desktop (~430MB). Swap em **93,7%→94,3%** de uso e **subindo** ao longo da
  sessão (era 19,2/20,5GB, terminou a sessão em 22,2/23,5GB) — pressão de memória sustentada, piorando.
- **Gatilho**: `num_ctx` do Ollama foi subido de 24576→32768 na madrugada do mesmo dia (`05e415d71`), e
  a cesta foi ampliada com 11 pares asiáticos à noite (`bc99bd85b`) — measured `prompt_tokens=32.518`,
  **quase no teto absoluto do contexto (32.768)**. Reduzir `num_ctx` diretamente seria perigoso agora
  (cortaria o próprio prompt de entrada, não só a saída — reintroduziria o bug histórico "motor não abre
  posição" documentado em `agent.ts`, 2026-09-02/09-04).

### Otimizações aplicadas (sem mexer em gate/regra de decisão)

1. **`FOMC_BTC_PLAY` (tools.ts, `open_position.setupType`)**: removida data hardcoded stale
   ("hoje 2026-09-16") do texto reenviado toda chamada; valores de stop/alvo/sizing passaram a puxar de
   `config.ts` em vez de hardcoded. Commit `41419660d`. Efeito medido: 32.518→32.368 tokens
   (~150 tokens, real mas pequeno).
2. **`marketDirection.agreement` + `aviso` DIVERGENTE (atr.ts + tools.ts)**: frases redundantes
   encurtadas (ex.: `"3/3 sinal(is) disponivel(is) concordam em ALTA neste ciclo."` →
   `"3/3 concordam ALTA."`) — informação já duplicada nos campos numéricos `votesAlta`/`votesBaixa`.
   Removida duplicação exata da mesma frase dentro do `aviso` quando a direção fica DIVERGENTE (estava
   escrita duas vezes na mesma resposta). Se repete por ativo em cada `get_mt5_quote` — com cesta de 20
   ativos, soma mais que o corte do FOMC. Commit `1d31c0da7`. `tsc --noEmit` limpo nos dois cortes;
   `npm run validate` (raiz) com 91 asserções reais passando 100% — as 3 falhas do validate são bug de
   bundler pré-existente (`Dynamic require of "stream"`, `@supabase/node-fetch`), alheio a estas edições
   (arquivos diferentes, pacote diferente).

**Ainda pendente, maior alavanca identificada mas não tocada**: `GENESIS_PROMPT_MT5` (`agent.ts:108`),
bloco de texto fixo com ~48.000 caracteres (~12-14 mil tokens, todos os princípios 1a-1k+), reenviado
inteiro em toda chamada. Cleber preferiu não mexer nisso ainda (fronteira com "mudar mecânica" — é
literalmente o texto das regras de decisão, risco de cortar um princípio por acidente). Fica pra decisão
futura dele.

**Situação ao fim da sessão**: swap ainda subindo, SIGKILL continuou ocorrendo mesmo depois dos dois
cortes aplicados (o corte foi real mas pequeno demais pra resolver sozinho). Causa raiz de fundo
(RAM insuficiente pra rodar Ollama 32k contexto + Chrome + resto da máquina junto) **não resolvida**,
só mitigada marginalmente.

## 6. Notícia de mercado asiático

Cleber pediu que a IA leia notícia relevante pro horário/ativo operado — esclarecido depois que não é
pra trocar por horário, é pra sempre ter **americano/global + asiático juntos** (a cesta já opera ativos
asiáticos o tempo todo, não só de madrugada).

Achado: só existia feed americano/global (`NEWS_FEEDS_EN`: Investing.com internacional, Cointelegraph,
CNBC) — nenhuma fonte de Ásia. Testadas fontes reais antes de adicionar (nunca fabricar):
Nikkei Asia RSS (404, descontinuado) e SCMP (redirect não devolve RSS válido) **descartados**;
**Channel News Asia** (Singapura) confirmado com RSS real e conteúdo relevante.

Implementado: `NEWS_FEEDS_ASIA` em `supabase/functions/server/index.ts`, novo parâmetro `includeAsia=1`
no `/news/aggregate` (só ativa quando pedido explicitamente — não muda o que Dashboard/usuário comum já
veem); `llm-active-brain/src/news.ts` passou a pedir sempre `lang=en&includeAsia=1`. Commit `f9573f45a`,
**deploy (`supabase functions deploy server`) já rodado e confirmado** — testado ao vivo contra o
endpoint real: 5 itens da Channel News Asia aparecendo no pacote de 15 manchetes. `deno check`: 14 erros,
todos pré-existentes (mesmo baseline já documentado em sessões anteriores), nenhum novo.

## 7. Monitoramento contínuo armado

Cron recorrente (`af489903`, a cada 5min, expira em 7 dias) checando `prompt_tokens` mais recente,
novos SIGKILL/restart no `watchdog.log`, e uso de swap — pedido explícito do Cleber pra acompanhar se
o quadro de memória melhora ou piora. Primeira leitura pós-armado: mais um SIGKILL às 23h38, swap subiu
pra 94,3%.

## Pendente real pra próxima sessão

- Commit/restart dos 2 cortes de texto já rodados pelo Cleber e confirmados — nada pendente de deploy
  aqui.
- **Causa raiz da memória segue ativa** — se o monitoramento de 5min mostrar que os SIGKILL continuam
  frequentes, próximo passo real é decidir entre: comprimir `GENESIS_PROMPT_MT5` (maior alavanca, mas
  toca texto de regra — precisa aval explícito do Cleber), fechar Chrome enquanto o motor roda, ou
  reconsiderar se a máquina de 16GB aguenta rodar Ollama local + cesta de 20 ativos de forma sustentável.
- Congelamento de mecânica de entrada segue valendo até ~27/09 (5 dias úteis) ou 40 trades fechados sob
  a config do commit `fec06949a` — não mexer em gate/regra antes disso.
- UKOUSD (payoff invertido) e LNKUSD/SOLUSD (edge ~0% em amostra grande) seguem como candidatos de
  revisão, fora do escopo desta sessão.
