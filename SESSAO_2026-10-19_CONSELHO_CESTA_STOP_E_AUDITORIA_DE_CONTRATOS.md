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

---

# PARTE 2 — madrugada de 20/10: "ainda nenhuma entrada" (US2000, spread medido e custo de índice)

## Pedido do Cleber
Depois do reinício de 19/10 (~20:05Z) a LLM ainda não tinha feito nenhuma entrada. Ele achou "esquisito": acreditava que com a cesta só de cripto ela teria operado "tranquilamente". Também disse que o US2000 (Russell 2000) é um ativo barato e muito volátil, e questionou como poderia custar mais que o S&P.

## Funil medido (≈20:05Z a 01:04Z, 17h–22h BRT)
- **9 tentativas de `open_position`, 0 aberturas.**
- 5–6 rejeitadas pela **Mesa/Master**: SHORTs "colados na mínima do dia" cujo alvo não cabe sem romper suporte (UK100, FRA40, SPX500, XETUSD) — recusa coerente com o método do Cleber.
- 2 barradas pelo **piso de valor** por causa do custo estimado: US2000 (bruto US$7,00, custo US$7,20) e FRA40 (bruto US$4,56, custo US$3,90).
- 1 por **Master indisponível** (BTCUSD: 302 s, 22 chamadas, tempo da mesa esgotado).
- **NVIDIA instável de novo**: 57×429, 42×502, 46×503, 34×504, 49 timeouts desde o reinício — o modelo 3.5-super-vl não resolveu à noite.
- **MetaAPI**: "account not connected to broker" na consulta direta; `spreadCollector` com timeouts na amostragem (50 falhas, 0 sucessos desde o restart).
- Sobre a hipótese "só cripto teria operado": **não dá para provar**. Ontem (19/10) foram ~850 ciclos só com cripto e 1 entrada, barradas pelos mesmos filtros. A cesta nova gerou *mais tentativas* (9 em 5 h vs 4 no dia), que morrem nos mesmos filtros.

## Bug 1 — spread medido nunca recarregava (corrigido, commit `c88e60fe9`)
`spreadCollector.tick()` fazia `await sample(); await reload()` no mesmo `try`. Quando a amostragem (MetaAPI) dava timeout, o `reload()` (só Supabase) era pulado e o motor ficava com a **tabela estática de custo** após cada restart. Agora `sample`, `reload` e `cleanup` são independentes e o reload inicial loga a falha.
Efeito do spread medido sobre o custo por US$2.000 (antes → depois): US2000 6,60→3,88; SPX500 2,34→1,41; FRA40 2,30→3,55 (spread real 0,114%); BTCUSD 0,58→1,62; XETUSD 0,58→2,43. (Cripto sobe: é o custo real, a tabela antiga subestimava.)

## Bug 2 — custo de índice calibrado em pontos fixos (corrigido, commit `e3707de8f`)
A fórmula de índice usava calibração do US30 (~44.000 pts): 1,5 pt de slippage/perna e comissão "US$2 por lote = 1 contrato" — em **pontos fixos, não % do preço**. No US2000 (~2.700) isso dava ~0,19% de custo. Corrigido em `commissionModel.ts` (só para classe INDEX com spread medido):
`custo RT % = spread medido + (US$1,00 / (LOT_SIZE × preço)) × 100 + 2 × 0,0034%`.
- **Comissão real medida** nos negócios da conta (`history-deals`): índices = **US$0,50 por lote por negócio** (US$1,00 ida e volta); o lote de SPX500 = 10 contratos, o do US2000 = 1.
- Slippage mantido na proporção da calibração original (1,5/44000 = 0,0034% por perna), agora em % do preço.
- Custo por US$2.000 depois: US2000 **1,09** (era 6,60); SPX500 **0,28** (2,34); UK100 0,71 (1,68); GER40 0,39 (0,71); FRA40 2,64 (2,30).

## US2000 x SPX500 (a dúvida do Cleber)
- Em **dólares no lote mínimo (0,01)** o US2000 é bem mais barato (posição de ~US$27 contra ~US$770 do SPX500).
- Em **% da posição** o SPX500 é mais barato (~0,014% contra ~0,054% ida e volta).
- **Volatilidade** (ATR 15m medido na madrugada): US2000 0,106% ≈ SPX500 0,098%. Custo ÷ ATR15m: NAS100 0,06; SPX500 0,14; GER40 0,21; BTCUSD/XETUSD 0,34; UK100 0,41; **US2000 0,51**; EURUSD 0,71; **FRA40 1,52** (custo maior que uma vela inteira — recomendado tirar do Setup). Medida de uma noite só, sem dado por horário.

## Achados que ficaram SEM mudança (decisão do Cleber)
- **ETH (XETUSD) e BTC pagam comissão real de US$1,50 por lote por negócio** (medido em 82 e 156 negócios) e o modelo assume "cripto sem comissão". No ETH (lote 1 ETH ≈ US$2.400) são ~0,125% de ida e volta, quase o spread dele. Só BTC/ETH foram medidos; não aplicado — tornaria as entradas em cripto mais difíceis.
- A fórmula do custo medido soma a comissão publicada e multiplica por 2 (ida e volta) — pode haver dupla contagem em outras classes; calibração do Cleber de 23/09, não mexida.
- Ouro/prata: não cabem no teto de risco (US$10 com 10% × US$100); prata ≈ US$14,30 de risco no lote mínimo. Decisão do Cleber: ouro fora; XAGUSD pode ficar sem efeito.
- Mais de uma mudança de mecânica após o início do teste (restarts às ~20:05Z, ~20:55Z e ~01:25Z de 20/10; custo de índice corrigido). **A contagem das 20 entradas do critério de aborto passa a valer a partir do último reinício (≈01:25Z de 20/10, custo de índice corrigido).**

## Commits desta sessão
`4c2a7cf4b` contratos/US2000/Setup · `b319dc730` docs · `c88e60fe9` spread recarrega · `e3707de8f` custo de índice. Motor reiniciado após o último (1 instância).

## Pendências abertas
- Tirar FRA40 do Setup (custo > ATR) — decisão do Cleber.
- Decidir comissão de BTC/ETH no modelo de custo (US$1,50/lote/negócio medido).
- NVIDIA: 429/50x frequentes à noite; Master indisponível custa entradas. Considerar timeout/fallback do Master ou enxugar a Mesa (~20–36 chamadas por entrada).
- MetaAPI desconectada no fim da noite (timeouts no `spreadCollector` e na consulta direta) — acompanhar.
- Medir MFE/MAE das últimas entradas (0 alvos cheios) e as recusas da Mesa que "expiram".
