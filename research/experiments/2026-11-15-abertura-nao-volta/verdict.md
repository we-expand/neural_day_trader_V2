# Teoria: "na abertura o preço dificilmente volta ao preço de abertura" (2026-11-15)

Entrada a ±0,01% da abertura, a favor do movimento. Aberturas de 12 em 12 h (00/12 UTC e 17/05 NY), diária (00 UTC),
NY 09:30 e, no S&P/índices, reabertura 18:00 NY (20:00 Brasília). Controle: todas as meias-horas do dia.
Dados: Binance 1m, 1 ano (BTC, ETH, SOL, BNB, XRP, DOGE); Yahoo 5m, 60 dias (EURUSD, GBPUSD, USDJPY, AUDUSD, ES/NQ/YM/RTY).

## Veredito: NÃO confirmada
- Preço NÃO volta à abertura em 12 h: só 2-4% (cripto), 5-10% (forex), 8-33% (índices). Igual ao controle (BTC 3,8% vs 3,7%).
- Stop na linha de abertura: acerto 2-8%; bruto +0,04 a +0,08%/op, igual ao controle (BTC +0,045%) = seguir movimento, não efeito de abertura.
- Custo de ida e volta 0,04-0,10% > ganho bruto; stop de 0,01% não é executável (spread BTC ~0,07%).
- Segurar sem stop: +0,1 a +0,2% bruto, margem de erro do mesmo tamanho.
- Índices/forex: amostra pequena (12-18 ops por ativo), inconclusivo.

## Limites
- 30-40% das aberturas de cripto tocam +0,01% e -0,01% na mesma vela de 1 min (lado desconhecido): excluídas.
- Não separado por volume. Ano com viés de alta em cripto. Yahoo tem barras vazias (preenchidas com o último preço).
- Resultado bruto; stop assumido a -0,01% exato (otimista).

Reprodução: `python3 fetch.py && python3 analise.py && python3 sp.py` (ajustar caminho `d/`).
