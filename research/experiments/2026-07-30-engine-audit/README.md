# Auditoria do motor de decisão — 2026-07-30

Scripts e outputs salvos que sustentam a Fase 1 do `MASTER_PLAN.md` (correção
do motor de backtest). Cumprindo a regra de governança do §3.6 do plano
mestre: nenhum número aqui existe só em prosa, todo output está neste
diretório, reproduzível rodando o script correspondente.

## `adx-audit.ts` / `adx-audit-output.txt`

**Antes da correção** (medido na sessão original, não reproduzido aqui):
erro médio de 4,77 pontos entre `calculateADX` (SMA do DX) e a fórmula
correta de Wilder (RMA do DX), com 5,7-10,7% de divergência no gate de
regime.

**Depois da correção** (output salvo neste arquivo, gerado após o fix em
`TechnicalIndicators.ts`): erro **0,000** — o `calculateADX` do projeto
agora bate exatamente com a reimplementação de referência de Wilder.
Confirma que a correção da Fase 1 (item 1) funcionou.

## `dsr-audit.mjs` / `dsr-audit-output.txt`

Compara a simplificação gaussiana do DSR (`γ3=0, γ4=3`, usada em
`DeflatedSharpe.ts`) contra a fórmula completa de Bailey & López de Prado
com assimetria/curtose típicas de trend-following. Achado: no regime de
Sharpe baixo observado neste projeto, a simplificação foi **conservadora**
(subestimou o DSR), não liberal como o comentário do código afirma — o
comentário está com o sentido do viés invertido (correção de documentação
pendente, não urgente).

## `lcg-test.mjs` / `lcg-test-output.txt`

Testa o gerador de números pseudo-aleatórios usado em
`bootstrapSortinoSignificance` (`DeflatedSharpe.ts:130-134`). Achado:
período de ciclo de **10.466** — com 2000 iterações × ~92 retornos por
chamada (uso real na seção 11.9 do `AI_BRAIN_SPEC.md`), a sequência se
repete ~17,6 vezes inteiras, invalidando a premissa de amostragem
independente do bootstrap. **Correção ainda pendente** (parte da Tarefa 5
da Fase 1).

## `measure-atr-falling.ts` / `atr-falling-output.txt`

Mede a frequência de disparo do exitBlock `ATR FALLING` (removido do preset
4 nesta sessão) sobre série sintética de 2000 candles: dispara em 44,3% das
barras, holding period esperado ≈2,26 barras — confirma que a regra saía
cedo demais pra um rompimento de tendência se desenvolver. Motivou a
remoção do exitBlock (ver `presetStrategies.ts`, preset 4).
