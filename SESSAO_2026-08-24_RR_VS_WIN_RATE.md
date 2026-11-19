# Sessão 2026-08-24 — R:R (pontos de captura) vs. win rate real

## Pergunta do Cleber

Mexer no número de pontos capturados pelo motor (TP/SL) consegue gerar
vantagem de acerto nas operações?

## Contexto técnico

A tabela `TARGET_POINTS_TABLE` (`TradeSizing.ts:26-32`) define presets
nominais de alvo/stop em pontos brutos (POUCOS 150/50, MÉDIO 400/120,
MUITOS 1500/300, CURTO 80/35, LONGO 800/200) — mas é caminho
legado/auxiliar (`calculateTpSl`), não o motor principal em produção.
O motor real (`runTradingCycle.ts`, 5 presets ativos) calcula TP/SL
dinamicamente por ATR × multiplicador (ex.: preset 5/Scalp = ATR×1 stop /
ATR×1,5 alvo, com teto 80/35 pontos em regime `SCALP`).

## Hipótese testada

R:R e TP/SL só redistribuem onde o resultado aparece (mais trades
pequenos e frequentes vs. menos trades e maiores) — não criam taxa de
acerto nova. Sem edge direcional (conclusão já fechada em 2026-07-30/
08-02, ver `AI_BRAIN_SPEC.md` e `CLAUDE_HISTORY.md`), qualquer R:R deveria
oscilar perto do breakeven teórico `1/(1+RR)`.

## Método

Query direta no Supabase de produção (`ai_trades`, `status = 'CLOSED'`),
R:R derivado por trade a partir de `entry_price`/`stop_loss`/
`take_profit`/`side` (não havia coluna de preset gravada). Win rate e
PnL líquido (`net_pnl` com fallback `pnl`) agrupados por R:R arredondado
em 1 casa decimal.

## Resultado

Só 3 grupos têm amostra que importa (resto tem n≤8, ruído):

| R:R | n | Win rate real | Breakeven teórico | PnL líquido total |
|---|---|---|---|---|
| 1,0 | 32 | 28,1% | 50,0% | **−US$686,65** |
| 2,5 | 73 | 9,6% | 28,6% | −US$82,89 |
| 3,0 | 54 | 55,6% | 25,0% | +US$0,48 (≈ zero) |

Nota: o bucket R:R=3,3 (n=8) foi descartado da leitura — carrega o
trade contaminado do SPX500 já documentado (entry 6010,13→exit 7536,86,
bug de preço/PnL, não operação real), −US$3.810,39 sozinho, que
distorceria qualquer conclusão daquele grupo.

## Conclusão

Confirma a hipótese: **não há R:R "vencedor" de forma consistente**. Se
existisse vantagem real de acerto embutida em algum ponto de captura, o
grupo com melhor folga sobre o breakeven (R:R=3,0) deveria sobrar
dinheiro de forma clara — está com PnL médio de US$0,01/trade,
essencialmente zero. O grupo R:R=1,0, teoricamente o "mais fácil de
acertar" (só precisa 50% pra empatar), ficou muito abaixo disso (28,1%)
e foi o maior gerador de prejuízo absoluto da amostra.

**Recomendação**: não perseguir "ponto ideal de captura" como caminho de
vantagem de acerto — consistente com o cérebro de decisão já ser
assumidamente de execução/disciplina, não de alfa (ver seção "Cérebro de
decisão da IA" no `CLAUDE.md`). O gargalo continua sendo falta de edge
direcional, não calibração de alvo/stop.

## Limitações

- Amostra pequena e concentrada em poucos R:R nominais — não é grade
  systematic de R:R testado deliberadamente, é o que o motor já gerou em
  produção.
- Sem correção por múltiplos testes (só 3 grupos comparados, risco baixo
  mas não nulo).
- Não segrega por ativo/regime — R:R=3,0 pode estar carregando um ativo
  específico que só por acaso ficou perto do breakeven.
