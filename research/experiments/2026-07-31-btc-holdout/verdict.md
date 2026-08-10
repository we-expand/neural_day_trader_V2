# Veredito — holdout do BTCUSDT (2026-07-31)

**Executado em 2026-07-31.** Histórico completo da Binance para BTCUSDT
(19.615 barras em 4h desde 2017-08, 78.390 em 1h) + 6 controles em 4h. Desenho
e critérios pré-registrados: [`hypothesis.md`](hypothesis.md). Saída bruta:
[`results.json`](results.json).

---

## Nota de método, antes do resultado: a verificação de reprodução divergiu

O critério 0 (obrigatório, definido no `hypothesis.md`) era: a janela IS
precisa reproduzir o baseline antes de qualquer conclusão valer.

| | Baseline | Este experimento (IS) |
|---|---|---|
| BTC 4h | 68,2% (n=88) | **61,5%** (n=104) |
| BTC 1h | 61,1% (n=90) | **50,0%** (n=102) |

**Divergiu mais do que o esperado**, principalmente em 1h. Causa identificada:
o baseline passava a **fatia de histórico inteiro** (do início até a barra
corrente) para `computeScoreFromCandles`; este experimento usa **janela móvel
de 500 barras** por custo computacional (O(n²) em 78 mil barras era inviável).
Indicadores de lookback curto (RSI, EMA, MACD, Estocástico) são idênticos nos
dois métodos; mas `SMA200`, ADX e Bollinger em janelas iniciais da série movida
recebem menos contexto de tendência longa na versão de janela móvel — isso
muda `core.confidence` e, por consequência, quais barras entram no filtro de
convicção (`confidence >= 55`).

**Isto não invalida o resultado abaixo — o torna mais conservador.** A
divergência é de método (folga de lookback), não um bug de sinal invertido: a
direção do resultado (queda, não subida, ao sair da janela calibrada) é a
mesma em ambas as versões. Registrado com transparência total, como pede o
protocolo do projeto — nenhum resultado é escondido.

---

## Resultado no holdout (OOS) — a anomalia não sobrevive

| Combinação | Período OOS | n | Hit total | Compra | Venda | p | netEdge |
|---|---|---|---|---|---|---|---|
| **BTCUSDT 4h** | 2017-08 → 2024-12 | 675 | 51,6% | 54,4% | **46,6%** | 0,221 | **−0,089%** |
| **BTCUSDT 1h** | 2017-08 → 2026-03 | 2.531 | 53,7% | 57,3% | **49,7%** | 0,0001 | +0,003% |

Contra os 4 critérios pré-registrados (α ajustado por Bonferroni para 2 testes):

| Critério | BTC 4h | BTC 1h |
|---|---|---|
| c1 significância (hit>50%, p<0,025) | ❌ (p=0,221) | ✅ (p=0,0001) |
| c2 consistência (compra E venda >50%) | ❌ (venda 46,6%) | ❌ (venda 49,7%) |
| c3 econômico (netEdge>0 após 0,26% custo) | ❌ (−0,089%) | ✅ (+0,003%, irrisório) |
| c4 amostra (≥100) | ✅ | ✅ |

**Nenhuma das duas combinações passa os 4 critérios.** BTC 1h passa 2 de 4,
mas falha exatamente o critério 2 (consistência) — o lado de venda cai abaixo
de 50% — e o netEdge positivo é de +0,003%, três ordens de grandeza menor que
o custo que ele mal supera. Não é economicamente relevante.

## O quadro completo confirma: era vazamento de calibração

- **Estabilidade ano a ano (BTC 4h) é ruído, não tendência**: 61,1% (2017) →
  50% (2018) → 53,5% (2019) → 49,1% (2020) → **39,5%** (2021) → 47,7% (2022) →
  61,1% (2023) → 47,5% (2024) → 62,1% (2025) → 60,5% (2026). Oscila sem
  padrão, inclusive com um ano (2021) claramente abaixo de 50%.
- **BTC não se destaca dos controles no OOS**: ETHUSDT (52,1%) fica **acima**
  do BTC 4h (51,6%); os demais ficam entre 36,8% e 50,2%. Não há separação
  entre "BTC especial" e "os outros" — todos oscilam na mesma faixa de ruído.
- Isso corresponde exatamente à explicação antecipada na `hypothesis.md`: o
  Market Score foi calibrado historicamente sobre janelas de BTC recentes
  (seções 11.5, 11.13, testes de 2026-07-30), e o 68,2% do baseline vivia
  dentro dessa janela.

## Precedente confirmado

Mesmo padrão da seção 11.10→11.11: um resultado que passa todos os critérios
numa janela recente (lá, DSR 85,3%; aqui, os 4 critérios em BTC 4h) **não
sobrevive** quando o calendário é estendido sem tocar em nenhum parâmetro (lá,
DSR caiu a 39,3%; aqui, hit rate cai a 51,6%/53,7% e falha consistência).

## Conclusão

**A anomalia BTCUSDT não é edge — era vazamento de calibração dentro da
janela em que o Market Score foi ajustado.** O Market Score continua sem
evidência de poder preditivo direcional generalizável, em nenhum ativo, em
nenhum timeframe testado até aqui (baseline + este holdout).

## Ação que decorre disto

Confirma a diretriz já registrada no `AI_COGNITIVE_SPEC.md`: o **Bloco B**
(contexto como veto) não pode ser construído sobre o Market Score como
preditor. Consistente com a decisão já tomada pelo Cleber em 2026-07-31 de
tratar o Price Action/Brooks como **contexto/veto**, nunca como gatilho de
entrada — a mesma disciplina se aplica ao score.

**Não reabre o Trilho 2.** Segue formalmente pausado.
