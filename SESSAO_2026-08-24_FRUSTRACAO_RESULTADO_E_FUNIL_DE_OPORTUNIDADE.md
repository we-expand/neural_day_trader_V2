# Sessão 2026-08-24 — Frustração com resultado e investigação do funil de oportunidade

## Gatilho

Cleber, depois de ver o robô perdendo desde sexta (21/08) e observando um dia
de volatilidade forte em vários ativos (BTC, SOL, commodities subindo,
petróleo caindo), questionou por que o motor não consegue nem "algumas
situações vencedoras sem perder dinheiro", comparando com indicadores de
influenciador que alegam 75% de acerto.

## 1. Resultado real desde sexta (21/08)

Consulta direta no Supabase, 145 trades fechados entre 21-24/08:

| Dia | Trades | Win rate | PnL bruto |
|---|---|---|---|
| 21/08 (sex) | 48 | 39,6% | +$19,64 |
| 22/08 (sáb) | 30 | 20,0% | −$3,92 |
| 23/08 (dom) | 39 | 28,2% | −$2,46 |
| 24/08 (hoje, parcial) | 28 | 14,3% | −$8,41 |
| **Total** | **145** | **27,6%** | **+$4,85** |

Achado: "só perde desde sexta" não é literal (sexta foi positivo), mas o dia
24/08 é o pior do período. 138/145 trades desse período fecharam com
`commission: 0` — o fix de custo invisível (ver seção "Custo de execução"
no CLAUDE.md) só entrou em vigor às ~12h UTC de hoje, então o "+$4,85"
citado está inflado (sem custo real descontado na maior parte da amostra).
Confirmado que o commit `106b8c83f` já estava commitado e pushado
previamente — não havia nada pendente de deploy, ao contrário do que o
CLAUDE.md registrava (corrigido na mesma sessão).

## 2. Por que BTC e ouro não abriram nenhuma posição hoje

Funil de decisão (`ai_funnel_snapshots`) mostrou BTC e XAUUSD com **zero
entradas o dia inteiro**, bloqueio dominante `MIN_TRADE_SIZE` (não
`COMBINED_CONFIDENCE_LOW` — ou seja, não é "falta de convicção", é
geometria de tamanho).

Causa raiz, com números reais do dia:
- Conta atual: ~US$86.
- BTC: lote mínimo 0,01 (Infinox, confirmado em `assetDatabase.ts` E
  `infinoxContractSpecs.ts`, independente). A ~US$76-79k/BTC hoje, isso é
  ~US$770-800 de nocional mínimo — ~9x o saldo da conta.
- Ouro: lote mínimo 0,01 = 1 onça. A ~US$4.590/onça, isso é ~US$4.590 de
  nocional mínimo — ~53x o saldo da conta.

Cleber perguntou se dava pra usar lote menor (tipo 0,001) — resposta: não,
0,01 é o piso real da Infinox/MT5 padrão (não fabricado, checado contra a
tabela real de specs), e a própria plataforma já teve um bug nesse sentido
em 2026-08-20 (posição real aberta com 0,0021 lote, corrigida — ver
`SESSAO_2026-08-20_LOTE_MINIMO.md`), então o gate atual existe pra IMPEDIR
frações abaixo do mínimo real, não pra criar a limitação.

Segundo ponto levantado por Cleber: com alavancagem 500x, a margem
necessária pra abrir 0,01 lote de ouro é só ~US$9,18 — cabe fácil no saldo.
O motor não recusa por falta de margem, recusa porque o **risco em dólar se
o stop for acionado** nesse tamanho mínimo (~US$45,90, com stop ~1%) seria
>50% da conta numa única perda — desproporcional a qualquer risco% razoável
configurado. Ou seja: cabe na margem, mas não cabe no risco. Ponto de
produto real e não fechado: conta de US$50-100 estruturalmente não consegue
operar BTC/ouro dentro de risco sadio, e isso não está comunicado na UI
hoje (a IA simplesmente "some" desses ativos sem avisar por quê).

## 3. Funil nos demais ativos (EURUSD, índices) — não é teto de posições

Confirmado que `TICK_MAX_POSITIONS` nunca disparou hoje (zero bloqueios) —
havia capital e espaço disponível o dia inteiro, SOL/ETH ocupando posição
não impediu tentativa em outros ativos.

EURUSD, SPX500, GER40 tiveram zero ou quase zero entradas por boa parte do
dia, bloqueio dominante `COMBINED_CONFIDENCE_LOW` (limiar 45%), com scores
travados em 29%/42% por horas seguidas apesar do preço se mover — leitura
técnica (ADX/regime) não concordando com a leitura visual humana de
"tendência óbvia". Isso é consistente com a conclusão já fechada da busca
de edge (seção "Cérebro de decisão da IA" do CLAUDE.md): indicador técnico
clássico, testado exaustivamente, sem edge comprovado.

**Atualização dentro da mesma sessão**: nas 2h seguintes a confiança subiu
em quase todos os ativos citados (BTC 54%, SOL 53%, SPX500 60%, GER40 54%,
ouro 51%, ETH 49%) e entradas reais aconteceram (SOL LONG, ETH SHORT) —
o motor não ficou paralisado o dia todo, só demorou a concordar com o
movimento.

## 4. Teste rápido: "se seguisse tendência ingênua hoje, teria ganhado?"

`asset_prices` (tabela de histórico de preço server-side) está vazia —
não há como fazer backtest intradiário rigoroso sem fabricar dado. Em vez
disso, buscado candle real de 15min via API pública da Binance (BTC e SOL,
único par com fonte gratuita confiável daqui) e simulada a estratégia mais
simples possível: comprar no primeiro candle de alta do dia, segurar até
agora, sobre notional comparável ao que o motor usa (~$130).

- BTC: abertura $77.734 → agora $79.747 (+2,66%). Líquido de custo
  estimado: **+$3,38**.
- SOL: abertura $95,44 → agora $97,10 (+1,63%). Líquido de custo estimado:
  **+$2,04**.

Confirma a intuição do Cleber **para esse dia específico, nesses dois
ativos escolhidos a posteriori**. Ressalvas registradas explicitamente:
(1) é 1 dia, 2 ativos escolhidos com viés de retrospecto — não prova edge
sistemático, é o tipo de achado que a pesquisa com correção estatística
(Šidák/DSR, walk-forward) já filtrou antes; (2) BTC caiu a $76.670 antes de
subir — uma queda de ~2,7% desde a entrada simulada que um stop real
baseado em ATR muito provavelmente teria acionado antes da alta, revertendo
o resultado. Buy-and-hold sem gestão de risco parece ótimo olhando pra
trás; não necessariamente sobrevive a um stop de verdade no caminho.

## Decisão / próximo passo

Cleber optou por não seguir agora com o teste mais rigoroso (regra de
entrada em candle de alta + stop real, rodado contra semanas de histórico)
— fica registrado aqui como opção pronta pra retomar, caso volte à tona.
Nenhuma mudança de código foi feita nesta sessão; foi só investigação +
correção de uma entrada desatualizada no CLAUDE.md (custo de execução já
resolvido, não mais pendente).
