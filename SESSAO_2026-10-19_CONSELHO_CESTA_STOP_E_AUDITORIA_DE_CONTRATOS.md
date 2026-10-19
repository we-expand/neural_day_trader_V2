# Sessão 2026-10-19 — "A LLM não opera": conselho, cesta, stop curto e auditoria de contratos

## Pedido do Cleber
Desgostoso: a LLM fez **uma única operação** na segunda (19/10), perdeu, e entrou com 80% de confiança. Ontem também só uma. Meta dele: ~10 entradas de dia e 4–10 à noite; "o mercado está quente". Pediu o conselho (llm-council) e ajustes sérios.

## Diagnóstico (log do motor + Supabase, dados reais)
- **Cesta esquecida**: o Setup ainda tinha a cesta de fim de semana (7 criptos), trocada sexta 22:15. Na segunda o motor ficou ~850 ciclos olhando só BTC/ETH/BNB/SOL/ADA/DOGE/LINK; índices, ouro e forex nem entravam.
- **Alvo POUCOS + cripto**: o alvo (~1 vela de 15m) não paga o spread. 14 recusas no piso de valor (ex.: BNB bruto US$1,64, custo US$0,79; LINK líquido negativo).
- **A perda de hoje foi defeito, não azar**: BTCUSD LONG 08:42Z, confiança 80, −US$4,45 em 6 min. O "agente de alvo" encurtou o alvo 0,27%→0,187% **e o stop 0,5%→0,187%** (R:R 1, = 1 vela de 15m, dentro do ruído) e **dobrou o lote** (0,01→0,02) para manter o ganho em dólar.
- **Confiança não prediz nada** (já medido: 85,3% nas vencedoras vs 84,3% nas perdedoras).
- **Mesa não custou dinheiro hoje**: 10 recusas (7 "comprando colado na máxima do dia"); desfecho contrafactual: 1 alvo, 1 stop, 8 expiraram. Mais 2 recusas por erro 500 do Master (NVIDIA).
- Histórico: desde 01/09, 572 entradas, −US$374, todas as semanas negativas; custo ~0,24R/trade; teto realista medido 2–6 entradas/dia com líquido ≥ 0.

## Conselho (5 conselheiros + 5 revisões cruzadas)
- **Unânime**: voltar a cesta multi-ativo (decisão do Cleber no Setup); desligar stop curto + dobra de lote; **não** afrouxar piso de valor nem Mesa.
- **Divergência**: trocar POUCOS→MÉDIO agora (2 a favor) ou depois (3 contra, por mexer em variáveis demais). O Cleber acabou usando MÉDIO junto com a cesta.
- **Recado duro**: com E[R] < 0, ir de 1 para 14 entradas/dia multiplica a perda; "mercado quente" não é vantagem do motor. Nenhum critério de 10–20 entradas distingue −0,24R de 0R (poder estatístico baixo) — detectam desastre, não melhora.
- Pontos que o conselho levantou e **não foram feitos**: medir MFE/MAE das 12 últimas entradas (0 alvos cheios → problema na saída?); investigar por que 8/10 recusas "expiram"; risco de ruína (US$100 de conta).

## Mudanças feitas (commit `4c2a7cf4b`, em `origin/dev`)
1. `.env` (não vai no git): `MT5_SCALP_STOP_FOLLOWS_TARGET=false`. Rollback: `true`.
2. `llm-active-brain/src/tools.ts`: o lote só sobe (`stopFollowedTarget`) quando o stop encurtou junto. Antes dobrava mesmo com stop cheio.
3. **US2000** (Russell 2000) cadastrado no motor (`assetBasket.ts`, comissão, ledger, spread collector). Spec real: contractSize 1, USD, minVolume 0,01.
4. **Setup só oferece ativos que a IA opera**: `src/app/config/llmBrainBasket.ts` (espelho de `MT5_ASSET_BASKET`), filtro em `AssetUniverse.tsx` e `InfinoxAssetsBrowser.tsx` (prop `allowedSymbols`); ativo selecionado fora da lista aparece riscado em vermelho com aviso. Ao cadastrar ativo novo no motor, adicionar também no espelho.
5. **Auditoria de LOT_SIZE contra a corretora** (spec MetaAPI `contractSize × câmbio` + `history-deals` reais). Achado: ~20 ativos com valor por lote errado. Corrigidos: SPX500 1→10, UKOUSD 1000→100, AUS200 7,2→0,698, JPN225 0,033→0,631, HKG33, CHINA50 1→1, GER40/FRA40/UK100 × câmbio EUR/GBP, e **13 criptos alternativas** de 1 para o contractSize real (DOGE 10000, TRX 100000, SOL 100, BNB 10…), cruzados JPY/CNH/SGD/TWD/NZD recalculados. **BTCXBN saiu** da cesta (profitCurrency "XBN", sem conversão confiável). Reauditoria: 41 ativos, todos com erro < 1%. Câmbio é estático (19/10 20:08Z) — revisitar se as moedas andarem.
6. Memórias: `project_teste_conselho_2026-10-19.md`, `reference_auditoria_lot_size_metaapi.md`.

Cesta final do Setup (Cleber): BTCUSD, EURUSD, XETUSD, GER40, FRA40, SPX500, UK100, XAGUSD, US2000; alvo MÉDIO. Motor reiniciado ~20:05Z de 19/10 com tudo isso (1 instância).

## Ouro e prata ficam de fora na prática
Lote mínimo (0,01) de XAUUSD = 1 oz ≈ US$4.140; com stop 0,5% arrisca ≈ US$20,70 e o teto é 10% × US$100 = US$10. Com 15% de teto ainda não cabe (ATR do ouro hoje: 5m 0,047%, 15m 0,106% → o stop cai no piso de 0,5%). Precisaria ~21% de teto. **Decisão do Cleber: ouro fora, seguir o teste.** XAGUSD (prata) tem o mesmo problema (≈ US$14,30 de risco no lote mínimo) e deve ser recusado pelo teto; pode ficar na cesta sem efeito.

## Critério do teste (definido antes)
Congelar a mecânica nesta versão (sem outras mudanças):
- **Aborto**: E[R] líquido médio das primeiras **20** entradas < −0,3R, ou conta cair **15%**.
- **Veredito**: **40** entradas; se o IC95 do E[R] não excluir zero pelo lado positivo, a conclusão honesta é "sem alfa" — decisão de negócio, não de parâmetro.
- **Frequência**: < 3 entradas/dia útil com a cesta cheia ⇒ o gargalo é o método, não a configuração.
- Meta de 10/dia **não foi validada como possível**; este pacote sobe a frequência, não cria vantagem.

## Pendências / ideias abertas
- **SPX500 e outros índices**: o motor agora usa US$10/ponto/lote (real); lote mínimo ≈ US$770 de nocional, risco ≈ US$3,85 com stop 0,5%.
- Medir MFE/MAE das últimas 12 entradas (0 alvos cheios → investigar saída).
- Investigar as recusas da Mesa que "expiram" (latência? ~36 chamadas por entrada) e o erro 500 do Master.
- Botão "Preset Dia Útil / Fim de Semana" no Setup (ideia do Expansionista; não automatizar a troca — decisão do Cleber) ou aviso no boot quando a cesta tem ativos fechados.
- Rodar `npx tsx` de auditoria de novo se mudar a cesta/câmbio: script em `/private/tmp/.../audit/audit.mts` (efêmero; reconstruível pela receita acima).
- Conferir daqui a 1–2 dias: `npx tsx scripts/error-report.ts --since=2026-10-19T20:05:00Z`.
