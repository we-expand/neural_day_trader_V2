# Sessão 2026-09-11 — Classificador de Regime de Mercado (HMM): fix de rotulagem

## Contexto

Pedido do Cleber (sessão anterior, 2026-09-09): desenvolver um Classificador
de Regime de Mercado via Hidden Markov Model como trava/contexto de
segurança do Motor de Decisão do LLM Brain — a premissa é que a maior causa
de perda é aplicar lógica de TENDÊNCIA (rompimento, cruzamento de médias)
num mercado CONSOLIDADO, ou o oposto.

Cleber pediu explicitamente pra **não precisar ser em Python** ("pode
adequar a tecnologia") — decisão tomada: TypeScript nativo, sem processo
externo, integrado direto no motor único (`llm-active-brain`). Evita repetir
a dor de gestão de processo separado já documentada pro `streaming-relay`
neste projeto (loop de reconexão, `launchd`, etc).

A integração no motor (`atr.ts`, `tools.ts`, `config.ts`, `agent.ts`) já
tinha sido commitada e está em produção desde 2026-09-09/10 (inclusive um
fix de outra sessão cortando texto didático repetido por ativo em
`get_mt5_quote`, que estava estourando o contexto do modelo local). O que
faltava, e foi fechado nesta sessão, era a **matemática do próprio
classificador** (`hmmRegime.ts`) — que tinha bugs reais de rotulagem nunca
detectados porque nunca tinha sido testada com dado controlado antes de
aceitar como pronta.

## Achado real: 3 bugs de rotulagem, encontrados testando com dado sintético

Antes de aceitar o módulo como pronto, testei com 7 cenários sintéticos
controlados (tendência de alta clara, tendência de baixa clara, consolidação
pura, choque de volatilidade simétrico, candles insuficientes, e as duas
transições realistas consolidação→choque e consolidação→tendência). O
resultado inicial: a maioria dos cenários saía com o rótulo ERRADO, com
confiança > 99% (falsa certeza).

**Bug 1 — retorno instantâneo era ruído demais.** Cada candle isolado tem
retorno muito ruidoso; mesmo dentro de uma tendência homogênea, metade dos
candles fica um pouco acima da média e metade um pouco abaixo por puro
acaso, e o EM (Baum-Welch) encontrava 2 clusters nesse ruído e rotulava um
deles como "consolidação" por engano. Fix: trocado retorno instantâneo por
**média móvel do retorno** na mesma janela da volatilidade (10 candles) —
suaviza o ruído candle-a-candle, preserva o sinal de direção persistente.

**Bug 2 — rotulagem por ranking puramente relativo.** A lógica original
sempre escolhia "o estado com maior |retorno médio| dos 3" como TENDÊNCIA e
"o de maior volatilidade" como CHOQUE, mesmo quando NENHUM dos 3 realmente
correspondia a esse comportamento (ex: numa janela 100% consolidada, o
"menos perto de zero dos 3" ainda vencia o ranking e virava "tendência"
por engano). Fix: limiares ABSOLUTOS — um estado só vira TENDENCIA_CLARA se
a razão retorno/volatilidade (sinal/ruído) passar de 1,2; só vira
CHOQUE_DE_VOLATILIDADE se sua volatilidade for pelo menos 1,6x a mediana dos
outros candidatos. Quando nenhum passa, o padrão é CONSOLIDACAO_BAIXA_VOL —
e está OK mais de um dos 3 estados ocultos compartilhar esse rótulo (não há
por que forçar 3 rótulos distintos quando só existem 2 regimes reais na
amostra).

**Bug 3 — ordem de avaliação errada.** Choque era decidido ANTES de
tendência. Isso confundia uma tendência real (que naturalmente tem
volatilidade maior que a consolidação anterior na mesma janela — movimento
genuíno desloca preço mais que ruído parado) com "choque", só por ter
volatilidade relativa maior. Fix: tendência agora é avaliada PRIMEIRO (sobre
os 3 estados, via razão sinal/ruído); choque só é avaliado DEPOIS, e só
entre os estados que a tendência já descartou.

## Resultado dos testes depois dos 3 fixes

6 de 7 cenários corretos:
- Tendência de alta clara → TENDENCIA_CLARA, direção ALTA ✅
- Tendência de baixa clara → TENDENCIA_CLARA, direção BAIXA ✅
- Consolidação pura → CONSOLIDACAO_BAIXA_VOL ✅
- Candles insuficientes → `null` (nunca fabrica) ✅
- Transição consolidação→choque → CHOQUE_DE_VOLATILIDADE ✅
- Transição consolidação→tendência → TENDENCIA_CLARA, direção ALTA ✅
- Choque de volatilidade **perfeitamente simétrico** (sem nenhum trecho
  calmo na mesma janela pra servir de referência) → cai em
  CONSOLIDACAO_BAIXA_VOL em vez de CHOQUE_DE_VOLATILIDADE ⚠️

O caso que ainda falha é documentado como limitação conhecida no cabeçalho
de `hmmRegime.ts`, não escondida: sem um trecho mais calmo do MESMO símbolo
na mesma janela pra contrastar, o modelo não tem como saber que "isto é
incomum". Na prática real isso deve ser raro (choques de mercado de verdade
quase sempre têm viés direcional real — não são simétricos — e a janela
buscada normalmente mistura momentos mais calmos).

## Estado do código

- `llm-active-brain/src/hmmRegime.ts` — único arquivo com mudança pendente
  desta sessão (o resto da integração já estava commitado). `tsc --noEmit`
  limpo, `npm run validate` 37/37 limpo.
- **Pendente**: `git commit` (comando entregue ao Cleber, nunca rodado por
  mim) + `./restart.sh` (dentro de `llm-active-brain/`) pra carregar a
  correção — sem isso, o motor continua rodando com a versão com os 3 bugs
  de rotulagem.
- Bloqueio mecânico opcional (`HMM_REGIME_GATE_ACTIVE`, recusa
  ROMPIMENTO/CRUZAMENTO_MEDIAS durante CONSOLIDACAO_BAIXA_VOL) segue
  **desligado por padrão** — sem amostra real ainda validando que a
  classificação corrigida bate com o que se observa no gráfico ao vivo.
  Mesma disciplina de `ASSET_SCORECARD_ACTIVE` já usada neste projeto:
  infraestrutura pronta, efeito desligado até o dado justificar ligar.

## Pendente real pra próxima sessão

1. Cleber rodar o commit + restart.
2. Observar alguns ciclos reais em produção e conferir se a classificação
   (`hmmRegime` em `get_mt5_quote`, ou o aviso "REGIME HMM: ..." no log)
   bate com o que se vê no gráfico de verdade — mínimo alguns dias/amostra
   antes de cogitar ligar `HMM_REGIME_GATE_ACTIVE`.
3. Se quiser, os 3 roteiros de "voz humanizada" consultiva (NEXUS/TTS)
   verbalizando o bloqueio/contexto do regime — não escritos ainda, ficam
   pra quando pedir.
