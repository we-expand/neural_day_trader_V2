# Trilho 2 reaberto com NVIDIA NIM Signal Discovery — hipótese (2026-08-25)

## Origem

Cleber pediu exploração da página NVIDIA Financial Services
(https://build.nvidia.com/explore/financial-services) e decidiu reabrir o
Trilho 2 (pausado desde 2026-07-26, ver `research/AI_BRAIN_SPEC.md` seção
13) usando o **Quantitative Signal Discovery Agent** (NeMo Agent Toolkit +
Nemotron) via NIM API serverless, buscando **dado novo e antigo**.

## O que NÃO muda

- A NVIDIA aqui é uma ferramenta de **geração/triagem de hipótese**, nunca
  de validação. Toda validação estatística continua local e determinística:
  walk-forward com embargo (`DataSplit.ts`), Deflated Sharpe/Sortino
  (`DeflatedSharpe.ts`), custo real (`CostModel.ts`) — mesma metodologia da
  seção 8/13.3 da spec, sem exceção. Um LLM nunca decide se há edge; ele só
  ajuda a gerar a lista de hipóteses testáveis mais rápido.
- Cutoff e critério de sucesso continuam os da seção 13.4: **3-4 semanas de
  orçamento**, aprovação exige Deflated Sortino ≥ piso definido na spec **e**
  bootstrap P(Sortino > 0) ≥ 70%. Sem isso, "achado" fica marcado como não
  validado, nunca reportado como edge.

## O que muda: escopo de dado ampliado

A seção 13.1 já aprovava 4 fontes (nunca testadas por falta de orçamento
comprometido):

1. Order book imbalance/depth (cripto, feed pago — Tardis.dev $50-900/mês
   ou CoinAPI $79+/mês, preço já levantado na spec).
2. Calendário econômico como filtro de regime (não sinal standalone).
3. Correlação cross-asset / regime de volatilidade (BTC→altcoins, DXY→forex
   majors).
4. Volume tick (CFD, proxy fraco, já sinalizado como tal na spec).

**Item novo, fora do escopo original — precisa confirmação explícita do
Cleber antes de comprometer orçamento**: notícia/sentimento via NLP. A
seção 13.1 excluiu isso explicitamente em 2026-07-26 ("exigiria fonte paga
+ NLP, custo/complexidade não justificado"). O blueprint NVIDIA "AI Model
Distillation for Financial Data" é especificamente sobre destilar
notícia/texto não-estruturado em sinal de mercado — ou seja, usar essa
ferramenta pra "dado novo" reabre essa exclusão, não é só trocar de
ferramenta. **Decisão pendente**: manter a exclusão (testar só os 4 itens
já aprovados) ou formalmente reabrir NLP com orçamento de fonte de notícia
paga definido.

## Etapa 0 (gratuita, sem compromisso de orçamento)

Reaproveita o padrão da Etapa 0 original (seção 13.7 — CVD via Binance
aggTrades, Bonferroni-corrected, resultado 0/16 significativo): usar o
Signal Discovery Agent (NIM, tier serverless gratuito) pra gerar uma lista
priorizada de hipóteses testáveis sobre dado **já disponível sem custo
adicional** — cross-asset correlation/regime (item 3, já temos os dados de
preço) e calendário econômico (item 2, fonte já usada no gate de
notícias/VIX do `ai-runner`). Só se alguma hipótese dessa etapa passar
triagem preliminar (efeito bruto visível, antes de custo) é que se justifica
comprometer orçamento nos itens pagos (1: order book) ou reabrir o item
excluído (NLP).

## Cesta e período

Mesma cesta de 9 símbolos × 3 timeframes já usada em todo o resto do
projeto (BTCUSD, XBNUSD, EURUSD, XAUUSD, XAGUSD, US30, NAS100, SPX500,
GER40 × {5m, 15m, 1h}), dado buscado real via Binance/MetaAPI — nunca
fabricado.

## Critério de sucesso desta etapa (Etapa 0)

- **Passa triagem** → hipótese entra na fila pra validação estatística
  completa (Fase seguinte, orçamento a definir com Cleber).
- **Não passa** → documentado em `verdict.md` como achado negativo, mesmo
  padrão de honestidade de todo experimento anterior do projeto.

## Pré-requisito técnico

Requer `NVIDIA_API_KEY` no ambiente (Cleber cria em build.nvidia.com, tier
serverless). Sem a chave, `scripts/discoverSignals.ts` lança erro explícito
e não roda — não há fallback com dado fabricado.
