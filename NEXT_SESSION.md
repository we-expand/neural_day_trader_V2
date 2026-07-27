# Handoff — próxima sessão (escrito em 2026-07-26)

> Arquivo temporário de retomada rápida. Não é memória permanente do projeto —
> isso é o `CLAUDE.md` (carrega automático) e o `AI_BRAIN_SPEC.md` (fonte de
> verdade do motor de decisão). Este arquivo existe só pra você abrir uma
> janela nova e retomar sem reconstruir o raciocínio do zero. Pode apagar
> depois de ler/absorver, ou eu absorvo o essencial de volta no `CLAUDE.md` e
> apago este arquivo na próxima sessão — sua escolha.

## Onde a conversa chegou

Depois de 15 sub-investigações (`AI_BRAIN_SPEC.md` seções 11.5→11.15) testando
5 presets de estratégia técnica clássica (Donchian, EMA+ADX, Reversão à Média,
Rompimento Confirmado, Scalp) em 2 cestas (forex major, cripto), múltiplos
timeframes e 2 métricas (Sharpe, Sortino), **nenhum passou o piso de edge
estatístico comprovado (DSR ≥95%)**. O teste mais rigoroso (Sortino + bootstrap,
seção 11.15) deu resultado negativo, não apenas inconclusivo, no melhor
candidato encontrado (Donchian cripto 4h).

**Decisão tomada com Cleber em 2026-07-26**: parar de girar essa busca (era
diminishing returns claro) e dividir o produto em 2 pilares:

- **Pilar (a) — disciplina/execução/risco.** Vendável hoje, não depende de
  achar edge de sinal. Value prop: a IA nunca erra o stop, nunca opera onde o
  custo mata o alvo (gate de viabilidade já existe), nunca dobra aposta por
  emoção. Fase Real (dinheiro de usuário) pode avançar só com este pilar.
- **Pilar (b) — busca de edge com dado estruturalmente diferente.** Não mais
  indicador técnico sobre o mesmo candle público (isso já foi refutado com
  rigor). Escopado como **"Trilho 2"** — ver `AI_BRAIN_SPEC.md` seção 13,
  íntegra, recém-escrita. Ainda **não executado**, é proposta aguardando início.

### Por que pilar (b) tem chance de ser diferente (não é "mais do mesmo")

Preço OHLCV público é informação que o mercado já processou — indicador
técnico sobre ele não tem razão teórica pra ter edge, e os dados confirmaram
isso. Order book, calendário econômico como filtro de regime, e estrutura
cross-asset são tipos de dado diferentes, com justificativa teórica distinta
(informação de curtíssimo prazo que não está no candle). Ainda não foram
refutados por nenhum dos 15 testes já feitos.

## Escopo do Trilho 2 (resumo — detalhe completo na seção 13 do AI_BRAIN_SPEC.md)

- **Ativos**: só cripto — BTC/ETH/BNB/SOL (onde existe order book real via
  Binance; forex/CFD não tem book público, é limitação declarada — L1 seção 10).
- **Timeframe**: minutos (1m-15m), não 4h/1d — desequilíbrio de book é sinal de
  curtíssimo prazo por natureza.
- **Fontes de dado**: (1) desequilíbrio/profundidade de order book, (2)
  calendário econômico usado como **filtro de regime** (evitar operar perto de
  evento de alto impacto), não como sinal isolado, (3) features cross-asset
  (ex: BTC como líder de altcoins).
- **Fora de escopo deste trilho**: notícia em texto/NLP (não existe pipeline,
  custo não justificado ainda), dado pago de terceiros, forex/índice, ensemble
  com os arquétipos já refutados.
- **Modelo**: regressão logística ou gradient boosting raso — não rede neural
  profunda (pouco dado de book em alta frequência overfita rápido, e perde
  auditabilidade, que é requisito do resto da spec).
- **Validação**: mesma disciplina de sempre — walk-forward com purge/embargo,
  custo real (`CostModel.ts`), Deflated Sharpe **e** Sortino com bootstrap
  (lição da 11.15: Sharpe sozinho não é confiável), amostra mínima mais alta
  (timeframe de minutos gera mais trades, então o piso de leitura confiável
  sobe também).
- **Orçamento**: prazo-teto de **3-4 semanas**, com critério de corte escrito
  ANTES de começar — se nada passar Deflated Sortino ≥ piso + bootstrap
  P(Sortino real>0) claramente >50% (ideal ≥70%), a conclusão registrada é
  **"edge de sinal não é viável com os dados hoje disponíveis"**, sem eufemismo,
  e o pilar (b) pausa (documentado o que mudaria isso: dado pago, corretora com
  book real em forex, etc). Pilar (a) segue de qualquer forma.

## Próximo passo técnico concreto (ainda não iniciado)

Antes de testar qualquer feature de order book, falta um **bloqueio técnico
óbvio**: hoje o motor só consome book em tempo real (Binance), não existe
dataset histórico de order book salvo em lugar nenhum do projeto pra rodar
backtest/walk-forward. Primeira tarefa real do Trilho 2, quando começar, é
resolver isso — decidir fonte (Binance histórico de book tem custo/limitação
de retenção; considerar reconstruir a partir de trades históricos como proxy,
ou aceitar janela mais curta de dado real coletado daqui pra frente).

## Arquivos-chave pra retomar

- [`CLAUDE.md`](CLAUDE.md) — estado geral do projeto, carrega automático em
  toda sessão nova, mantido enxuto por regra.
- [`research/AI_BRAIN_SPEC.md`](research/AI_BRAIN_SPEC.md) — fonte de verdade
  do motor de decisão. Seção 13 = escopo completo do Trilho 2. Seções
  11.5→11.15 = histórico completo da busca refutada (não repetir).
- [`research/CostModel.ts`](research/CostModel.ts) — modelo de custo
  calibrado (teve bug real de cripto sub-US$1 corrigido em 11.13).
- `research/experiments/` — scripts reproduzíveis de cada rodada testada.

## Regras fixas do projeto (não esquecer ao retomar)

- Claude nunca faz `git commit`/`git push` sozinho — sempre entregar comando
  pronto pro Cleber rodar.
- `npm run validate` obrigatório antes de qualquer commit que toque o motor.
- Comunicação sempre em português, sempre com rigor de especialista sênior
  quant — nunca inflar resultado, sempre reportar achado negativo por completo
  (isto é método, não tom — ver final do `CLAUDE.md`).
