# Método do Cleber traduzido em regra — veredito (2026-09-23)

Dados: Binance (klines públicos), BTCUSDT/ETHUSDT. Custo de round-trip descontado:
BTC 0,08%, ETH 0,11% (spread real medido). Scripts nesta pasta, rodam com `node <arquivo> BTCUSDT 0.0008`.
Regras fixadas ANTES de rodar cada teste. Empate na mesma vela = stop (conservador).

## O que passou
**Veto de SHORT depois de dia caído** (`02-exaustao-1obs-por-dia.mjs`, 1 observação por dia às 17h BRT, stop=alvo=1×ATR 1H, 4h):
dia ≤ -2% → SHORT acerta 39% (BTC, n=176) / 43% (ETH, n=248), E[R] -0,18 / -0,08 antes de custo.
Implementado como veto em `llm-active-brain/src/tools.ts` (`EXHAUSTION_VETO_SYMBOLS`), 17h-20h BRT.

## O que NÃO passou (todos com t negativo, todos os anos)
| Teste | Acerto | E[R] líquido |
|---|---|---|
| LONG contrário depois de dia ≤ -2% (02) | 57-60% | ~0, e 2026 ≈ 0 (ETH 49%) |
| Cruzamento estocástico 5m (03) | 36% | -0,36 a -0,46 |
| + MACD 5m + estocástico 1H alinhado (03) | 35% | -0,38 a -0,47 |
| Cruzamento em zona extrema (04) | 36% | -0,36 a -0,45 |
| Scalp, alvo curto (0,5-0,75 ATR) (04) | 65% | -0,4 a -0,75 (spread come o ganho) |
| Rompimento Fibonacci 1H, 1/3 em 61,8/100/161,8% (05) | T1 45%, stop-antes 52% | -0,02 (BTC) / -0,06 (ETH) |
| Fibo + confirmação: margem 0,25 ATR / 2 velas / volume 1,5× | T1 49-56% | -0,07 a 0,00 |
| Fibo + esperar reteste | T1 40-43% | -0,11 / -0,13 |

## Lições de método
- O 1º teste (`01`, por hora) contava 3-4 velas do mesmo dia como amostras independentes: t=3,8 inflado; refeito com 1 obs/dia o efeito de LONG cai a t≈1,3-2,8 e some em 2026.
- Testar por caminho (stop/alvo reais), nunca só "subiu em 2h".
- Acerto alto não é lucro: scalp 65% de acerto perde -0,4 a -0,75 R/trade.
- BTC e ETH têm correlação ~0,8 — são quase uma evidência só.
- Sem correção por múltiplos testes (~25 variantes nesta pasta); nenhum resultado positivo aqui deve ser tratado como edge sem out-of-sample.

## Conclusão
Nenhuma peça do método, escrita como regra mecânica, tem vantagem líquida em BTC/ETH. O que resiste é só o veto. A parte que faz o
Cleber ganhar (escolher quando entrar/ficar de fora, ler o gráfico inteiro, tamanho) é julgamento não capturado nos testes.
Plano: Cleber envia entradas em que ganhou (horário + motivo) → agrupar o que têm em comum → só o que passar no teste vira fato pronto pra IA.
Pendente não testado: médias 9/20/200 como zona de compradores/vendedores; altcoins/índices (só BTC/ETH testados).
