# Sessão 2026-08-25 — NVIDIA Financial Services: Trilho 2 reaberto + cuOpt Fase A

## Origem

Cleber pediu pra explorar a página NVIDIA de Financial Services
(https://build.nvidia.com/explore/financial-services) e ver o que era
relevante pro projeto.

## O que a página tinha

Levantamento via browser (`get_page_text`) da página, sem WebFetch (deu
timeout). Itens relevantes encontrados: **Quantitative Signal Discovery
Agent** (NeMo Agent Toolkit + Nemotron, automatiza busca de sinal de
trading), **Quantitative Portfolio Optimization** (cuOpt), **AI Model
Distillation for Financial Data** (destila notícia/texto em sinal via
Nemotron + Data Flywheel Blueprint), **Build Your Own Transaction
Foundation Model** e **Financial Fraud Detection** (GNN — avaliados como
não relevantes, são pra banco processando transação de terceiro, não pro
nosso caso de SaaS de trading), **Enterprise RAG Pipeline Blueprint**
(avaliado como redundante com NEXUS+Jarvis já existentes).

Avaliação inicial (antes da decisão do Cleber): nada mudava a decisão já
tomada de edge ≈ 0 / cérebro de execução, mas cuOpt e o Signal Discovery
Agent eram os dois itens com potencial real. Cleber decidiu reabrir os
dois mesmo assim — ver decisões abaixo.

## Decisões do Cleber

1. Reabrir Trilho 2 (pausado desde 2026-07-26, seção 13 do
   `research/AI_BRAIN_SPEC.md`) usando o Signal Discovery Agent via NIM
   API, buscando **dado novo e antigo** ("por que não").
2. Usar cuOpt.
3. Integrar cuOpt **direto no motor de decisão** (não só protótipo
   isolado) — decisão questionada por mim (contradiz a convenção "nunca
   prometer edge sem validação estatística"), Cleber manteve a decisão de
   objetivo final, mas concordou implicitamente com a sequência Fase A →
   Fase B ao aprovar o plano (ver abaixo).
4. Reabrir também a exclusão de notícia/sentimento NLP do escopo do
   Trilho 2 (estava excluída desde 2026-07-26 por custo — "exigiria fonte
   paga + NLP, custo/complexidade não justificado"). Decisão explícita:
   "Reabra o item".

## Plano executado (aprovado via EnterPlanMode/ExitPlanMode)

Plano salvo em `/Users/clebercouto/.claude/plans/serene-baking-frost.md`.
Pontos-chave do raciocínio: o Signal Discovery Agent não é fonte de dado
nova, é ferramenta de orquestração — ainda precisa de dado real por trás.
O motor hoje (`runTradingCycle.ts`) é estritamente sequencial single-asset
(rankeia a cesta inteira, mas abre no máximo 1 trade por ciclo, `break`
após `tradeOpened`) — não existe alocação conjunta hoje. O único
precedente de portfólio (`2026-08-16-portfolio-amplitude`) testou um
cenário multi-setup **hipotético, nunca implementado**, marcado como não
validado (viés de seleção). Por isso cuOpt entra em duas fases: Fase A
(validação isolada em `research/experiments/`) antes de Fase B
(integração real, atrás de feature flag desligada por padrão, mesmo
padrão de `ASSET_SCORECARD_ACTIVE`).

## O que foi entregue nesta sessão

- [research/NvidiaNimClient.ts](research/NvidiaNimClient.ts) — cliente
  mínimo pra NIM API (`https://integrate.api.nvidia.com/v1/chat/completions`,
  endpoint OpenAI-compatible), exige `NVIDIA_API_KEY` real, sem fallback
  fabricado.
- [research/experiments/2026-08-25-trilho2-nim-signal-discovery/](research/experiments/2026-08-25-trilho2-nim-signal-discovery/)
  — `hypothesis.md` com o escopo completo (4 itens originais da seção
  13.1 + item 5 NLP reaberto) e `scripts/discoverSignals.ts`, que chama o
  Nemotron pra gerar hipóteses de sinal sobre as fontes já disponíveis
  sem custo adicional (correlação cross-asset, calendário-regime + NLP
  sobre o texto do calendário — não um newsfeed pago novo, essa é decisão
  de orçamento separada ainda não tomada).
- [research/experiments/2026-08-25-cuopt-portfolio-optimization/](research/experiments/2026-08-25-cuopt-portfolio-optimization/)
  — `hypothesis.md` com a metodologia da Fase A (baseline sequencial real
  vs. baseline aleatório de controle vs. cuOpt, teste explícito de viés de
  seleção) e `scripts/optimizePortfolio.ts` com os dois baselines locais
  implementados e a chamada real ao cuOpt deixada como **stub explícito**
  — o schema do endpoint cuOpt via NIM não foi confirmado contra
  documentação oficial nesta sessão, decisão de não fabricar formato de
  requisição.
- `CLAUDE.md` atualizado (topo + item 0 de pendências) refletindo a
  reabertura e os dois tracks.

## Incidente: chave NVIDIA apagada por engano

Cleber apagou sem querer a `NVIDIA_API_KEY` que o NEXUS usa em produção
(secret do Supabase, `supabase/functions/nexus-brain/lib/llmClient.ts:136`
— mesma variável de ambiente, só que como secret do Supabase, não export
local). Resolvido: Cleber gerou duas chaves novas em build.nvidia.com —
uma rotulada "AI Trader" (uso local, pesquisa) e outra "Nexus" (pro
secret do Supabase). Ambas as chaves foram coladas no chat (**visíveis no
histórico da conversa** — considerar revogar e gerar outras nesse cenário,
prática mais segura, mesmo já tendo sido usadas). Comando entregue pro
Cleber aplicar o secret do NEXUS (ele confirmou "feito para as 2", mas
**não testei o NEXUS em produção depois disso** — pendente confirmar que
a chave "Nexus" está de fato ativa no secret do Supabase e que o NEXUS
responde):

```bash
supabase secrets set NVIDIA_API_KEY="<chave rotulada Nexus>"
```

## Etapa 0 do Trilho 2 — já rodou, resultado real

`discoverSignals.ts` rodou contra a NIM API de verdade (chave "AI Trader").
Dois bugs de execução corrigidos ao vivo, registrados aqui porque são
armadilhas reais de ambiente, não escolha de design:

1. **Model id errado**: usei `nvidia/nemotron-nano-9b-v2` (nome da página
   de exploração), retornou 404. O id correto, confirmado contra o que já
   roda em produção no NEXUS
   (`supabase/functions/nexus-brain/lib/llmClient.ts:56`), é
   `nvidia/nemotron-3-nano-30b-a3b`. Corrigido no script.
2. **`__dirname` indefinido**: o script é bundlado com esbuild
   `--format=esm` pra `/tmp/discoverSignals.mjs` — em ESM não existe
   `__dirname`, e mesmo com `import.meta.url` o caminho resultante
   apontaria pra `/tmp` (onde o bundle é gerado), não pra pasta original
   do experimento. Corrigido pra usar `process.cwd()` + caminho absoluto
   fixo do repo (assume que o comando roda a partir da raiz do repo,
   como documentado no cabeçalho do script).
3. **Parser de JSON frágil**: adicionado strip de fence de markdown
   (` ```json ... ``` `) antes do `JSON.parse`, e salvamento da resposta
   bruta em `results/hypotheses_raw_error.txt` em caso de falha — pra
   nunca perder o dado bruto quando o parse falhar.

**Resultado**: 5 hipóteses geradas, salvas em
[results/hypotheses.json](research/experiments/2026-08-25-trilho2-nim-signal-discovery/results/hypotheses.json):

1. `CorrCrossRegime_5m_BTC` — correlação BTCUSD↔XBNUSD + vol, BTCUSD 5m.
2. `EconCal_Veto_1h_Spread` — calendário + NLP surpresa, spread
   US30/XAUUSD 1h.
3. `SentimentoNLP_RegimeFilter_15m_SPX` — NLP sentimento do evento,
   SPX500 15m.
4. `CorrCrossRegime_1h_XAGUSD` — correlação XAGUSD↔XAUUSD + vol, XAGUSD
   1h.
5. `EconCal_Veto_Sent_NLP_5m_US30` — calendário + NLP surpresa, US30 5m.

**Nenhuma validada ainda** — são hipóteses mecânicas, prontas pra virar
backtest. Isso fecha a Etapa 0 (geração/triagem via NIM); a Nemotron não
decidiu nem vai decidir se há edge, só acelerou a geração de hipótese —
regra do `hypothesis.md`, sem exceção.

## Estado ao fim desta sessão — nada de produção mudou

`npm run validate` não foi rodado nesta sessão porque nenhum arquivo do
caminho crítico (`tsconfig.engine.json`) foi tocado — só `research/**`
(que já está incluído no tsconfig.engine.json, mas os arquivos novos são
scripts standalone, não mudam comportamento determinístico existente) e
`CLAUDE.md`. Nada commitado (regra fixa do projeto — Claude nunca
commita/faz push sozinho).

## Próximo passo real, na ordem

Ver bloco "▶ TAMBÉM COMECE AQUI" em `NEXT_SESSION.md`, reescrito nesta
sessão com a ordem exata.
