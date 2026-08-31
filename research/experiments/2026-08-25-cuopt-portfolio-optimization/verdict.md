# cuOpt Fase A — veredito (2026-08-25)

## Resumo

cuOpt real da NVIDIA confirmado **não executável** no ambiente atual (ver
[CUOPT_API_SCHEMA.md](CUOPT_API_SCHEMA.md) — o próprio blueprint oficial
da NVIDIA pra este caso de uso só roda cuOpt como pacote Python local com
GPU CUDA, nunca via API hospedada). Decisão: testar a mesma pergunta de
pesquisa (alocação conjunta vs. sequencial, com teste de viés de seleção)
usando um solver de MILP real em CPU (`javascript-lp-solver`,
`scripts/optimizePortfolio.ts`), sem depender da NVIDIA.

## Resultado (dado real, 9 símbolos × 1h, presets 2/4/5, split com embargo)

| Estratégia | Trades | Posições/ciclo (média) | %líq total | %líq médio/trade | Sharpe | DSR |
|---|---:|---:|---:|---:|---:|---:|
| sequencial (baseline real do motor hoje) | 174 | 1,00 | -18,98% | -0,1091% | -0,093 | 1,0% |
| aleatório (controle de viés de seleção) | 346 | 1,98 | -35,59% | -0,1028% | -0,078 | 0,1% |
| MILP (alocação conjunta ótima) | 412 | 2,36 | -32,85% | -0,0797% | -0,063 | 0,1% |

## Interpretação

**Nenhuma das 3 estratégias de alocação é lucrativa líquida de custo.**
Todas as três fecham no vermelho — consistente com o achado estrutural já
registrado no projeto (CLAUDE.md, "Cérebro de decisão da IA"): sem edge de
sinal comprovado, mais amplitude (mais posições simultâneas) só multiplica
a mesma perda esperada por trade, não a transforma em ganho.

**Teste de viés de seleção (MILP vs. aleatório, mesma contagem de posições
simultâneas)**: MILP tem retorno médio por trade ligeiramente menos
negativo (-0,0797% vs. -0,1028%), mas **DSR de ambos é ~0,1%** — a
diferença não é estatisticamente distinguível de ruído com a amostra
atual (346-412 trades). Não dá pra afirmar "MILP tem edge sobre alocação
aleatória" com confiança — a leitura honesta é "otimizar QUAIS candidatos
abrir dentro do teto de margem ajuda pouco ou nada, quando os candidatos
de base já não têm edge individual".

**Comparação com o baseline sequencial (o que o motor faz hoje)**: o
sequencial tem o pior %líq total (-18,98%) só porque abre muito menos
trades (174 vs. 346-412) — mas o %líq médio por trade e o DSR (1,0%, o
melhor dos três) mostram que ele não é "pior estratégia", é só a estratégia
com menos amostra. Nenhum dos três tem DSR perto do piso de aprovação da
metodologia do projeto (research/CRITERIA.md).

## Conclusão

**A pergunta de pesquisa original do cuOpt — "alocação conjunta otimizada
bate alocação sequencial?" — tem resposta negativa nesta rodada**: nem
alocação conjunta aleatória nem otimizada (MILP) mostram edge sobre o
baseline sequencial, e nenhuma das três é lucrativa líquida de custo. O
resultado é consistente com a decisão de produto já registrada no projeto:
sem edge de sinal individual comprovado (AI_BRAIN_SPEC.md), nenhum
mecanismo de alocação — sequencial, aleatório ou otimizado — cria retorno
onde não existe base de retorno positivo pra otimizar.

**Isto NÃO é reprovação do cuOpt/MILP como ferramenta** — é reprovação da
premissa "otimizar alocação compensa falta de edge de sinal". Se um dia o
projeto encontrar um conjunto de sinais com edge individual comprovado
(nenhum encontrado até hoje, ver AI_BRAIN_SPEC.md seção 8), aí sim vale
reabrir a pergunta de alocação conjunta vs. sequencial sobre esse sinal
novo — não antes.

Fase B (integração em `runTradingCycle.ts`) permanece fora de escopo,
igual já estava definido no `hypothesis.md` original — o critério de
aprovação da Fase A não foi atingido.
