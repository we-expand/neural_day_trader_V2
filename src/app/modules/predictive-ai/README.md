# 🧠 INTELIGÊNCIA DE MERCADO (ex-"IA Preditiva")

Módulo de análise de mercado em tempo real da Neural Day Trader Platform.

> **Nota de disciplina do projeto (2026-09-09):** esta aba já se chamou "IA
> Preditiva" e teve, no passado, um "Detector de Baleias e Liquidez
> Institucional" que gerava alertas como `"VENDA BALEIA: 350 BTC
> transferidos, pressão de baixa detectada"` usando `Math.random()` —
> ou seja, dado 100% fabricado apresentado ao usuário como fato real. Isso
> violava a regra fixa do projeto de nunca fabricar dado (ver
> `CLAUDE.md`). Foi corrigido em 2026-07-28 (removidos os ~17 templates de
> alerta sorteados — baleia, spoofing, iceberg, RSI fabricado, cluster de
> stops fictício, e o teste sempre-verdadeiro disfarçado
> `currentPrice >= whalePrice` onde `whalePrice = Math.floor(currentPrice)`).
> Esta versão do README documenta o comportamento REAL atual do
> componente — não repita a documentação antiga, que descrevia dado
> fabricado como se fosse real.
>
> Decisão de produto vigente (ver `CLAUDE.md`, "Cérebro de decisão da
> IA"): busca sistemática por edge de sinal técnico clássico NÃO encontrou
> edge de DIREÇÃO comprovado (correção estatística DSR, meses de
> investigação). Este módulo nunca prevê direção de preço. Ele mostra
> contexto real (volatilidade, regime de mercado, zonas técnicas
> históricas, horário de mercado) — decisão de entrar/sair continua sendo
> do trader ou do LLM Brain (motor de execução separado).

## 📦 Estrutura do Módulo

```
/src/app/modules/predictive-ai/
├── components/
│   └── LiquidityPredictionView.tsx    # Componente principal (wrapper)
├── index.ts                           # Barrel export
└── README.md                          # Esta documentação
```

O componente real é `src/app/components/innovation/LiquidityPrediction.tsx`.

---

## ✅ O que é real hoje (nada fabricado)

### 1. Alertas de horário de mercado (relógio real)
Abertura NYSE (11:30 BRT), fechamento NYSE (18:00 BRT), abertura mercado
asiático (21:00 BRT), sobreposição Londres-NY (09:00-13:00 BRT) — todos
calculados a partir do horário real do sistema (`Date`), não simulados.
Fins de semana desativam alertas de bolsa automaticamente (crypto 24/7
continua).

### 2. Contagem regressiva real de virada de candle
Baseada no timeframe selecionado e no minuto/segundo real atual — sem
nenhum sorteio, é aritmética de relógio.

### 3. Trade grande real (Binance aggTrades) — só cripto
Reporta um trade agregado real já EXECUTADO na Binance acima de
`BIG_TRADE_USD_THRESHOLD` (hoje US$ 250.000 — limiar arbitrário
documentado, não calibrado estatisticamente, ajustável). É relato de
evento passado, nunca previsão de movimento futuro.

### 4. Pressão de book real (microestrutura) — só cripto
Quando `scoreResult.microstructure` está disponível, descreve pressão de
compra/venda real via `describeMicrostructure`. Não existe pra
forex/índices/commodities via MetaAPI (a corretora CFD não expõe book
L2/L3 real — nunca inventar isso).

### 5. Correlações
Removida a geração de correlação via `Math.random()`. Não há substituto
com dado real implementado ainda — card de correlação fica vazio/oculto
até existir fonte real.

---

## ❌ O que NÃO existe mais (removido em 2026-07-28)

- Detector de "baleias" fabricado (`Math.random()` decidindo se é
  compra/venda e o volume "transferido").
- Templates de alerta sorteados: spoofing, iceberg, acumulação/distribuição
  fabricadas, RSI/divergência inventados, cluster de stop loss fictício,
  front-running fabricado.
- O teste sempre-verdadeiro disfarçado de "baleia cruzando o preço"
  (comparava o preço com ele mesmo arredondado).

Se você (humano ou IA) for mexer neste arquivo de novo: **não reintroduza
nenhum desses padrões**, mesmo que pareça "só uma variação de UX". Qualquer
alerta novo tem que ter fonte de dado real e rastreável até uma API/feed
concreto — sem exceção.

---

## 🔮 Roadmap de evolução (veredito do llm-council, 2026-09-09)

O conselho recomendou renomear a aba pra reduzir o risco de o nome
prometer "prever o futuro" — exatamente a pressão que gerou o Detector de
Baleias fabricado no passado. **Decisão do Cleber (2026-09-09): renomear
pra "Inteligência de Mercado"** (menu lateral, título da página e texto do
tutorial de onboarding atualizados). Nada aqui prevê direção de preço;
tudo é contexto real ou volatilidade.

| # | Função | Status |
|---|---|---|
| 1 | Previsão de Volatilidade (EWMA/GARCH) | ✅ Implementado |
| 2 | Classificador de Regime de Mercado | 🔜 Reaproveita `atr.ts` |
| 3 | Zonas Técnicas de Interesse (ex-"liquidez") | 🔜 Reaproveita S/R do `ChartView.tsx` |
| 4 | Meta-Confiança do LLM Brain | ⏸ Pausado — precedente Jarvis (n=278 insuficiente), reconsiderar com 450-500+ trades |
| 5 | Alerta de Janela de Risco Elevado | 🔜 Composição de vol + regime + notícia real |
| 6 | "Rompimento Falso" / "Exaustão de Tendência" | ❌ Não é feature — é linha de pesquisa formal (walk-forward/holdout), mesmo padrão exigido pra qualquer alegação de edge no projeto |

Toda funcionalidade nova com threshold configurável pelo usuário segue 3
regras (achado do conselho, risco de "p-hacking pelo front-end"):
1. Range do threshold travado dentro de uma faixa validada estatisticamente, nunca livre.
2. Toda mudança de configuração gera log auditável (mesmo padrão do `ai_trades_audit_log`).
3. Liga/desliga por ativo só é permitido para ativos individualmente validados — nunca herdado do ativo-piloto.

---

## 🎯 Glossário

- **EWMA**: Exponentially Weighted Moving Average — média móvel exponencial usada pra estimar variância recente.
- **GARCH**: modelo estatístico de volatilidade condicional (heterocedasticidade condicional autorregressiva generalizada).
- **DSR**: Deflated Sharpe Ratio — correção estatística pra múltiplos testes, usada neste projeto pra evitar falso positivo de "edge".
- **Walk-forward**: validação sem look-ahead, treina num período e testa no período seguinte, nunca no mesmo.

---

**Status:** ✅ Em evolução, disciplina de dado real ativa
**Última Atualização:** 2026-09-09
**Neural Day Trader Platform**
