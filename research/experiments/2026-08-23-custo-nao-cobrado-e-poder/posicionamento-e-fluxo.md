# Dado de posicionamento e fluxo (não-preço) — existe edge aplicável ao produto?

Pesquisa: 2026-08-23. Pergunta original: já estabelecido que indicador técnico
clássico sobre preço público não tem edge. Existe análogo de "institutional
ownership / short interest / options flow" (usado em ações) pra uma cesta sem
ações — forex, índices, commodities, ações CFD, cripto — em timeframe
intraday?

## Resumo executivo

**Veredito: não há edge intraday utilizável em nenhuma das 5 fontes
pesquisadas, com uma única exceção parcial e de baixa confiança (funding
rate extremo em cripto, como filtro de "não abrir a favor da massa
alavancada", não como sinal de entrada).** COT Report é semanal e cobre só
futuros CFTC (não cobre CFDs de ações nem a maioria dos índices/commodities
operados via broker de varejo) — é dado de regime, não de timing, e a
evidência de "edge" encontrada na busca é de blog de corretora/backtest sem
holdout nem correção estatística, não paper revisado por pares. Open
interest tem leitura qualitativa consolidada na prática de mercado (preço×OI
como "quem está entrando/saindo"), mas a própria literatura de referência
admite que OI atualiza com atraso e é fraco sem volume — não serve pra
timing intraday sozinho. Liquidação em cascata e fluxo on-chain têm
narrativa de mercado forte e ferramentas comerciais elaboradas (Coinglass,
Nansen, Glassnode), mas nenhuma evidência acadêmica robusta de edge
preditivo de curto prazo veio à tona na busca — o que existe é "correlação
observada, causalidade e horizonte não estabelecidos", e as fontes que mais
falam de "sinal" são as que vendem a ferramenta. Consistente com a decisão
de produto já tomada: motor continua de execução/disciplina, não de alfa;
nenhuma dessas fontes justifica reabrir o Trilho 2 sem validação estatística
própria (amostra mínima, walk-forward, custo descontado, DSR) — o que esta
pesquisa não fez, e que teria efort/custo alto pra viabilidade duvidosa,
dado o padrão dos achados abaixo.

## Tabela comparativa

| Fonte | Grátis? / rate limit | Horizonte real de uso documentado | Nível de evidência | Aplica à cesta do produto? |
|---|---|---|---|---|
| **COT Report (CFTC)** | Sim, 100% grátis, sem limite de request (arquivo público, CSV/API). Publicado toda sexta 15:30 ET, com dado de **terça-feira anterior** (delay estrutural de 3 dias). | Semanal/regime. Não existe uso documentado como timing intraday — o próprio dado só muda 1x/semana. | Prática de mercado consolidada como *contexto* (viés direcional de "quem domina o book"), não como gatilho de entrada. Busca não achou paper acadêmico peer-reviewed com edge líquido de custo comprovado; o "backtest de 30+ estratégias" citado é de blog de corretora (cotbase.com), sem holdout declarado nem correção por múltiplos testes — não atende ao padrão de rigor deste projeto. | Parcial: cobre pares de forex principais e alguns índices/commodities **que têm contrato futuro CFTC correspondente** (ex. EUR, GBP, JPY, ouro, petróleo, S&P 500 e-mini). Não cobre ações CFD individuais nem boa parte dos índices menores/cripto. |
| **Funding rate de perpétuos (cripto)** | Sim, 100% grátis via API pública (Binance `/fapi/v1/fundingRate`: 500 req/5min por IP; Bybit/OKX equivalentes). Atualiza a cada 8h (ou 1h/4h em alguns pares), em tempo real via WebSocket. | Curto prazo (horas a poucos dias) — é o único dos 5 com horizonte plausivelmente compatível com intraday, mas como *filtro de regime* (evitar abrir a favor de posicionamento extremo), não como sinal de entrada isolado. | Mecanismo é bem entendido (funding extremo = custo de carregar a posição majoritária sobe, forçando unwind) e há pesquisa recente tratando funding como regra algorítmica com reversão endógena da base (SSRN/arXiv, 2026) — mas a busca não achou threshold universal validado nem backtest líquido de custo com holdout. É "mecanismo plausível + observação recorrente", não "edge medido e replicado". | Só cripto (BTC/ETH/etc perpétuos). Não existe em forex/índice/commodity/ação CFD — esses não têm funding rate. |
| **Liquidações (cascata)** | Coinglass tem tier grátis com heatmap/dado básico; API completa é paga (a partir de ~US$29/mês). Binance também publica liquidation stream público grátis (WebSocket `forceOrder`). | Muito curto prazo (minutos) quando a cascata já está em curso — é reativo, não preditivo: o sinal aparece **depois** que a liquidação começa. | Majoritariamente narrativa/ferramenta comercial. Busca não achou nenhum paper acadêmico testando liquidação como preditor com significância estatística — o que existe é heurística operacional ("cascata concentrada de um lado = pode estar perto do fim do movimento"), sem validação formal encontrada. | Só cripto. |
| **Open Interest (mudança junto com preço)** | Grátis nos principais (Binance, exchanges de futuro; CFTC também publica OI). Sem rate limit relevante pra uso normal. | A leitura qualitativa (preço↑+OI↑ = tendência nova; preço↑+OI↓ = short covering) é prática de mercado consolidada há décadas em futuros tradicionais — mas a própria literatura consultada (Zerodha Varsity, Bookmap, artigos de mesa) afirma que **OI atualiza com atraso e é fraco pra timing intraday sem volume como confirmação**; e paper recente (arXiv 2605.04004, "Structural Limits of OHLCV-Based Intraday Signals") reforça ceticismo geral sobre sinal intraday derivado só de preço/volume/OI em futuros líquidos (MNQ). | Prática de mercado consolidada como leitura de contexto/regime, não como gatilho isolado. Nenhuma evidência acadêmica de edge líquido de custo em timeframe intraday. | Futuros de índice, commodity, forex e cripto (onde há mercado futuro/perp com OI público). Não aplica a ações CFD individuais (CFD não tem OI centralizado publicável do jeito que futuro tem). |
| **Fluxo on-chain (netflow de exchange, whale watching)** | Nansen/Glassnode/CryptoQuant: tier grátis existe mas é raso (dado atrasado, poucas métricas). API real custa caro — Glassnode Advanced US$49/mês só dá 50 chamadas/dia e 14 dias de profundidade histórica; API completa (Professional) historicamente ~US$999/mês. CryptoQuant API a partir de ~US$99/mês. | Achados citam efeito de contágio de whale **6 a 24 horas após a transferência** — ou seja, horizonte de horas a mais de um dia, não segundos/minutos de trade intraday clássico. | Há pesquisa acadêmica real citada (efeito de contágio de whale mensurado), mas o próprio material de origem admite: "dado probabilístico, não determinístico", uma transferência isolada tem múltiplas explicações possíveis, e o edge real vem de **empilhar vários sinais on-chain simultâneos** (não um único netflow) — receita de mesa institucional, não de sinal simples e replicável a baixo custo. | Só cripto. Custo de acesso de qualidade (API paga) é desproporcional ao tamanho do produto hoje. |

## Aplicação recomendada

**Não recomendado adotar qualquer uma destas fontes como sinal de entrada
intraday no motor hoje.** Motivo consolidado: nenhuma tem horizonte
realmente intraday com evidência de edge líquido de custo e validação
estatística (holdout, correção por múltiplos testes) — o padrão que este
projeto já exige de qualquer sinal técnico clássico, e que reprovou os
indicadores de preço testados anteriormente. Adotar aqui, sem o mesmo rigor,
seria dupla vara de medir.

Se algo desta lista for revisitado no futuro, a ordem de prioridade por
plausibilidade e custo de acesso seria:

1. **Funding rate extremo (cripto) como filtro de regime**, não como
   gatilho — ex: "não abrir LONG novo em BTC/ETH quando funding está no
   percentil 95+ há N horas". É grátis, tempo real, mecanismo plausível. Mas
   precisaria do mesmo backtest com custo real e holdout que reprovou os
   presets técnicos em 2026-08-05 antes de qualquer decisão — sem isso seria
   promessa de edge não validada, o que a convenção do projeto proíbe
   explicitamente.
2. **COT como filtro de regime semanal em pares de forex/índice/commodity
   com contrato CFTC correspondente** — mesma ressalva: dado existente,
   grátis, mas nenhuma evidência com o rigor exigido aqui; seria projeto de
   pesquisa novo, não um fix.
3. Liquidação em cascata, OI isolado e fluxo on-chain: **não recomendado
   nem como próximo passo de pesquisa** no momento — evidência mais fraca
   (narrativa > estudo), custo de API mais alto (on-chain), ou natureza
   reativa/pós-fato (liquidação), e cobertura limitada a cripto sozinho
   (fatia menor da cesta do produto).

Nenhuma destas fontes muda a conclusão de produto já registrada em
`AI_BRAIN_SPEC.md`: cérebro de execução e disciplina, EV por trade ≈
`−custo` com o dado hoje disponível, ML restrito a previsão de
volatilidade.

## Fontes consultadas

- [The CFTC COT Report: Trade FX Futures More Effectively — CME Group](https://www.cmegroup.com/articles/2026/the-cftc-cot-report-trade-fx-futures-more-effectively.html)
- [Commitments of Traders | CFTC](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm)
- [The Effectiveness of Using Commitments of Traders Analysis in Forex Trading — cotbase.com](https://cotbase.com/blog/open/586-the-effectiveness-of-using-commitments-of-traders-analysis-in-forex-trading/)
- [How do futures open interest, funding rates, and liquidation data predict crypto price movements? — Gate.com](https://web3.gate.com/en/crypto-wiki/article/how-do-futures-open-interest-funding-rates-and-liquidation-data-predict-crypto-price-movements-20251226)
- [Designing funding rates for perpetual futures in cryptocurrency markets — ResearchGate](https://www.researchgate.net/publication/392560066_Designing_funding_rates_for_perpetual_futures_in_cryptocurrency_markets)
- [Funding Rate Mechanism in Perpetual Futures — SSRN](https://papers.ssrn.com/sol3/Delivery.cfm/6185958.pdf?abstractid=6185958&mirid=1)
- [Perpetual Futures and Basis Risk: Evidence from Cryptocurrency — AEA](https://www.aeaweb.org/conference/2026/program/paper/ByyFEfr4)
- [Authoritative Guide to Cryptocurrency Data APIs — CoinGlass](https://www.coinglass.com/learn/crypto-data-api-en)
- [How to Interpret Open Interest and Price Data — TradeJini](https://www.tradejini.com/blogs/how-to-interpret-open-interest-and-price-data-a-traders-guide)
- [Interpreting Open Interest in Futures Markets for Better Trades — Bookmap](https://bookmap.com/blog/interpreting-open-interest-in-futures-markets-for-better-trades)
- [What is Open Interest (OI)? OI vs Volume — Zerodha Varsity](https://zerodha.com/varsity/chapter/open-interest/)
- [Structural Limits of OHLCV-Based Intraday Signals in MNQ Futures: A Systematic Falsification Study — arXiv](https://arxiv.org/pdf/2605.04004)
- [5 Proven Strategies for Predicting Whale Movements — Nansen](https://nansen.ai/post/forecasting-crypto-trends-5-proven-strategies-for-predicting-whale-movements)
- [What is on-chain data analysis... — Gate.com](https://web3.gate.com/crypto-wiki/article/what-is-on-chain-data-analysis-and-how-do-active-addresses-transaction-volume-and-whale-movements-predict-crypto-market-trends-20260124)
- [Academic Research — Whale Alert](https://whale-alert.io/academic-research.html)
- [Best Free Crypto API in 2026: Free Tier Comparison — CoinMarketCap Academy](https://coinmarketcap.com/academy/article/best-free-crypto-api-in-2026-free-tier-comparison)
- [Get Funding Rate History — Binance Open Platform](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-History)
- [Request limit of endpoint /fapi/v1/fundingRate — Binance Developer Community](https://dev.binance.vision/t/request-limit-of-endpoint-fapi-v1-fundingrate/21209)
