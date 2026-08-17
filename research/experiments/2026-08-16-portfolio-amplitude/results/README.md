# Item (c) do redesenho do cérebro — a meta de ~10 trades/dia é realista? (2026-08-16)

## O que foi medido

Não é busca de edge nova. Reusa só o dado já medido em
`2026-08-05-taxa-base/results/taxa_base.json` (mesmo motor de produção
`runBacktest`, mesmos 5 presets de produção sem alteração, custo real via
`CostModel.ts`, 9 símbolos × 3 timeframes = 135 combos). Pergunta: mesmo sem
nenhuma das 3 tentativas de "mais edge" (TA clássico de julho, score
contínuo, arbitragem estatística — todas negativas), quanta frequência a
**amplitude** (mais ativos, mais setups simultâneos, item 1 do plano de 5
frentes) sozinha entregaria, sem afrouxar nenhum critério de entrada?

Script: `scripts/aggregate.ts`. Tabela completa: `portfolio_amplitude.md`.

## Resultado

**Em nenhum cenário testado a frequência chega perto de 10 trades/dia com
resultado líquido positivo.**

| Cenário | Melhor frequência | Líquido |
|---|---|---|
| 1 preset por vez (o que o produto permite hoje), cesta completa de 9 ativos | 13,66/dia (Rompimento Volume, 15m) | -71,8% |
| 1 preset por vez, cesta completa, 1h (único TF com líquido positivo por preset) | 2,28/dia (Rompimento Volume) | +4,3% |
| 5 presets simultâneos (multi-setup — não implementado, hipotético) | 5,22/dia (1h) | +39% mas 22/45 combos perdedores |
| Teto otimista: só combos historicamente positivos, sem holdout (viés de seleção — não é portfólio validado) | 5,68/dia (15m) | +17,4% |

Padrão consistente com achados anteriores desta sessão: em todo timeframe
onde a frequência sobe (5m, 15m), o resultado líquido despenca (-46% a
-204% somado) — custo por trade consome o volume mais rápido do que ele
gera resultado. No único timeframe com líquido positivo por preset (1h), a
frequência trava entre ~1-5/dia mesmo somando toda a cesta disponível.

**O teto real — com o que já está validado, sem inventar critério novo — fica
em torno de 2 a 6 trades/dia, não 10.** O cenário C (5,68/dia, 15m) é o
número mais otimista que existe no dado, e mesmo ele tem viés explícito de
seleção pós-hoc (escolhido depois de ver o resultado, sem holdout, sem DSR)
— não deve ser tratado como portfólio recomendado, só como limite superior
do que "amplitude irrestrita" permitiria.

## Decisão

Isto fecha a pergunta que ficou em aberto: com TA clássico, score contínuo
(pesos iguais e não-uniformes) e arbitragem estatística todos negativos, e
agora amplitude sozinha também não sustentando 10/dia líquido de custo, **a
meta de ~10 trades/dia (fixada em 2026-08-04 sem medição por trás) não é
compatível com a disciplina anti-fabricação de edge do projeto** (ver
`CLAUDE.md`, "Convenções do projeto"). Recomendação: adotar meta ancorada em
dado real (2-5 trades/dia, dependendo do perfil de risco), e comunicar isso
ao usuário como "atividade esperada" honesta (item 2 da proposta de
redesenho de painel em
`SESSAO_2026-08-16_REDESENHO_CEREBRO_E_SETUP.md`), não como bug a esconder.

## Estado ao fim desta medição

Decisão de produto pendente do Cleber: aceitar a meta revisada (2-5/dia) e
seguir pro redesenho de painel (item 5 do plano), ou definir outro número
específico. Nenhum código de produção alterado nesta medição.
