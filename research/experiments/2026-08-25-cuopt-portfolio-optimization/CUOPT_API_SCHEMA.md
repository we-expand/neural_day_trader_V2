# cuOpt via NIM API — schema confirmado contra doc oficial (2026-08-25)

> Item 4 do handoff (NEXT_SESSION.md). Pesquisa feita contra
> `docs.nvidia.com/cuopt`, `docs.api.nvidia.com/nim/reference/nvidia-cuopt`
> e páginas oficiais de exemplo LP/MILP — não fabricado, mas com uma lacuna
> real declarada abaixo (não dá pra fingir 100% confirmado).

## Confirmado com confiança alta (docs oficiais têm exemplo literal)

### Formato do problema (LP/MILP) — payload que vai dentro da requisição

```json
{
  "csr_constraint_matrix": {
    "offsets": [0, 2, 4],
    "indices": [0, 1, 0, 1],
    "values": [3.0, 4.0, 2.7, 10.1]
  },
  "constraint_bounds": {
    "upper_bounds": [5.4, 4.9],
    "lower_bounds": ["ninf", "ninf"]
  },
  "objective_data": {
    "coefficients": [-0.2, 0.1],
    "scalability_factor": 1.0,
    "offset": 0.0
  },
  "variable_bounds": {
    "upper_bounds": ["inf", "inf"],
    "lower_bounds": [0.0, 0.0]
  },
  "maximize": false,
  "solver_config": {
    "tolerances": { "optimality": 0.0001 },
    "pdlp_solver_mode": 1,
    "presolve": 0
  }
}
```

Fonte: `docs.nvidia.com/cuopt/user-guide/latest/cuopt-server/examples/lp-examples.html`.
Restrições em forma CSR (sparse) — cada linha de `csr_constraint_matrix` é
uma restrição, `indices` aponta pra qual variável, `values` o coeficiente.
Pra alocação de portfólio (maximizar retorno esperado sujeito a
margem/leverage), o mapeamento é direto:
- 1 variável por candidato (fração alocada, 0 a 1 — ou binária se for
  tudo-ou-nada por trade).
- 1 restrição: soma dos `marginRequiredPercent` ponderados ≤
  `MAX_MARGIN_UTILIZATION_PERCENT` (já existe em `TradeSizing.ts`).
- `objective_data.coefficients` = `expectedReturnPercent` de cada candidato,
  `maximize: true`.
- MILP (variável binária 0/1) é o formato certo se a decisão for "abre ou
  não abre o trade inteiro" (nosso caso — não faz sentido abrir 37% de um
  trade). cuOpt suporta MILP (ver `mixed-integer-linear-programming.html`),
  não só LP contínuo.

### Autenticação (padrão comum a todo NIM hospedado)

```
Authorization: Bearer $NVIDIA_API_KEY
```
Mesmo padrão já confirmado em uso real no projeto (NEXUS/`llmClient.ts` já
chama NIM com este header). Chave já existe em `NVIDIA_API_KEY` (Supabase
secrets), rotacionada e testada em produção em 2026-08-25 (ver item 1 do
handoff).

## Confirmado com confiança média (padrão geral, não exemplo cuOpt-específico)

cuOpt hospedado via **NVCF (NVIDIA Cloud Functions)**, não um REST simples
de caminho fixo tipo `/v1/chat/completions`. Padrão NVCF documentado:

```
POST https://api.nvcf.nvidia.com/v2/nvcf/exec/functions/{functionId}/versions/{versionId}
Authorization: Bearer $NVIDIA_API_KEY
Content-Type: application/json

{ "requestBody": { ...payload LP/MILP acima... } }
```

Assíncrono: resposta inicial pode devolver um `reqId` (processamento ainda
rodando) — cliente faz poll (`GET` num endpoint de status/resultado) até
receber a solução final. O client Python oficial (`CuOptServiceSelfHostClient`
/ `CuOptServiceClient`) abstrai esse polling num método `repoll()`; sem
usar o client oficial, a chamada HTTP crua precisaria replicar esse loop.

## LACUNA REAL, não resolvida nesta sessão

**`functionId`/`versionId` exatos do cuOpt no catálogo de NVCF não estão
documentados como constante fixa em nenhuma página oficial encontrada** —
eles são descobertos dinamicamente via:

```bash
curl -H "Authorization: Bearer $NVIDIA_API_KEY" \
  https://api.nvcf.nvidia.com/v2/nvcf/functions
```

(retorna a lista de funções disponíveis pra aquela chave, cada uma com
`id`/`versionId` — cuOpt aparece nessa lista se a chave tiver acesso ao
catálogo). **Não fabricar um functionId chutado** — isso exigiria rodar o
curl acima com a chave real, que só existe no Supabase secrets (não
exposta neste ambiente de pesquisa). Próximo passo pra fechar 100%: Cleber
rodar o curl acima (ou eu rodar via uma function/script que tenha acesso
ao secret) e colar o `functionId` do cuOpt encontrado na lista.

## ATUALIZAÇÃO 2026-08-25 (mesmo dia) — 403 era bug de sintaxe do curl, não falta de escopo

Primeira tentativa do Cleber (`curl -H "Authorization: Bearer $NVIDIA_API_KEY=nvapi-..."`)
tinha bug de sintaxe (concatenava a variável já exportada com outra chave
colada, gerando header inválido) — devolveu 403 "Authorization failed".
Corrigindo a sintaxe (`Bearer nvapi-...` direto, sem `$` duplicado), a
mesma chave pessoal **listou o catálogo NVCF com sucesso**, e o cuOpt está
lá:

```
name: "ai-nvidia-cuopt"
functionId: b0ac1378-3d00-43cb-a8d9-0f0c37ef36c0
versionId:  08816faa-0ac6-4d99-9663-b3c1addc0437
status: ACTIVE
healthUri: /v2/health/ready (port 8000)
```

Isso **reverte** a suspeita anterior (registrada logo abaixo, mantida por
transparência) de que cuOpt exigiria GPU local ou conta corporativa — a
investigação no `NVIDIA/cuopt-examples` mostrando o pacote Python
`cuopt-cu12` continua correta (é o caminho self-hosted/notebook), mas
existe TAMBÉM uma via hospedada via NVCF acessível pela chave pessoal já
em uso — o caminho certo pra Fase A é este, não o pacote Python com GPU.

**Próximo passo real**: invocar a função com um payload LP/MILP real
(formato confirmado na seção anterior — `csr_constraint_matrix`,
`constraint_bounds`, `objective_data`, `variable_bounds`, `maximize`,
`solver_config`), via:

```bash
curl -s -X POST \
  "https://api.nvcf.nvidia.com/v2/nvcf/exec/functions/b0ac1378-3d00-43cb-a8d9-0f0c37ef36c0/versions/08816faa-0ac6-4d99-9663-b3c1addc0437" \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "requestBody": {
      "csr_constraint_matrix": {"offsets": [0, 2], "indices": [0, 1], "values": [3.0, 4.0]},
      "constraint_bounds": {"upper_bounds": [5.4], "lower_bounds": ["ninf"]},
      "objective_data": {"coefficients": [-0.2, 0.1], "scalability_factor": 1.0, "offset": 0.0},
      "variable_bounds": {"upper_bounds": ["inf", "inf"], "lower_bounds": [0.0, 0.0]},
      "maximize": false,
      "solver_config": {"tolerances": {"optimality": 0.0001}}
    }
  }'
```

**Testado, ainda BLOQUEADO** — 3 tentativas de invocação, todas falharam:

1. `POST api.nvcf.nvidia.com/v2/nvcf/exec/functions/{id}/versions/{id}`
   (mesmo padrão documentado pra funções NVCF próprias) → **403
   "Authorization failed"**, mesmo com a chave crua correta. A listagem
   (`GET .../v2/nvcf/functions`) mostra `"ownedByDifferentAccount": true`
   pra essa entrada — é uma função de outra conta, visível no catálogo
   público mas não invocável direto via NVCF exec com uma chave pessoal.
2. `POST ai.api.nvidia.com/v1/nvidia/nvidia-cuopt` (mesmo padrão de proxy
   de catálogo que já funciona pro NEXUS/chat) → **404**.

Não vou continuar adivinhando caminhos de URL não documentados — seria
tentativa e erro, não "confirmar contra doc oficial" (o objetivo real
deste item do handoff). **Conclusão honesta**: o schema do payload de
otimização está confirmado (seção acima), mas o endpoint de invocação
hospedado gratuito, acessível pela chave pessoal do Cleber, **não foi
localizado** apesar de 3 tentativas plausíveis. Possibilidades não
descartadas: (a) o cuOpt do catálogo exige um plano/entitlement que a
conta atual não tem, mesmo aparecendo na listagem; (b) existe um caminho
de invocação documentado só em algum lugar que a busca não alcançou; (c)
cuOpt hospedado pode não estar disponível no tier gratuito de fato, e o
caminho real seria mesmo o self-hosted com GPU (achado original desta
seção, antes de encontrar a entrada no catálogo).

**Confirmação definitiva (2026-08-25, mesma sessão) — não é lacuna de doc,
é arquitetura real do produto.** Fomos direto no código-fonte do
blueprint oficial `NVIDIA-AI-Blueprints/quantitative-portfolio-optimization`
(o mesmo blueprint citado na `hypothesis.md` original deste experimento):

- `src/settings.py`, classe `ApiSettings`: só existem 2 modos —
  `api: 'cvxpy'` (CPU, sem NVIDIA) ou `api: 'cuopt_python'`.
- `src/mean_variance_optimizer.py`: `_setup_cuopt_problem` importa
  `from cuopt.linear_programming.problem import (...)` — **import de
  pacote Python local, nunca uma chamada HTTP**.

Ou seja: mesmo no blueprint oficial da própria NVIDIA pra este exato caso
de uso (otimização de portfólio), cuOpt roda **só como biblioteca Python
local com GPU CUDA** — não existe modo de inferência hospedada gratuita
pra isso, mesmo a entrada `ai-nvidia-cuopt` existindo no catálogo NVCF
(ela é de outra conta, não invocável pela chave pessoal, e o próprio
código oficial da NVIDIA nunca a chama por REST).

**Conclusão final**: a Fase A do cuOpt real, do jeito que foi planejada
("sem custo adicional"), **não é executável** no ambiente atual (Mac sem
GPU NVIDIA). Duas saídas, nenhuma decidida:
1. Pagar por GPU cloud (decisão de orçamento nova, fora do escopo original).
2. Testar a MESMA pergunta de pesquisa (alocação conjunta vs. sequencial,
   com teste de viés de seleção contra baseline aleatório — ver
   `hypothesis.md`) usando um solver de MILP em CPU pura (ex:
   `javascript-lp-solver`/`highs-js` em Node, ou PuLP/OR-Tools em Python),
   sem depender da NVIDIA especificamente — os baselines sequencial e
   aleatório já implementados em `optimizePortfolio.ts` continuam válidos,
   só troca o que resolveria a alocação ótima.

## Achado anterior (mantido por transparência, revertido acima)

Teste real feito pelo Cleber: `curl -H "Authorization: Bearer $NVIDIA_API_KEY" https://api.nvcf.nvidia.com/v2/nvcf/functions` devolveu **403 "Authorization failed"** — a chave pessoal (a mesma que o NEXUS usa pra chat/LLM) não tem escopo pra listar/invocar funções NVCF.

Investigação subsequente no repositório oficial `NVIDIA/cuopt-examples`
(pasta `portfolio_optimization/`, exatamente o caso de uso deste
experimento) confirma por quê: **o exemplo oficial de portfolio
optimization não usa API REST hospedada** — usa o pacote Python
`cuopt-cu12`/`cuopt-cu13` (`pip install --extra-index-url=https://pypi.nvidia.com cuopt-cu12`),
que **roda o solver localmente e exige GPU NVIDIA com CUDA 12.x/13.x**. Não
é um serviço de inferência hospedado gratuito como os modelos de chat/LLM
(NEXUS) — é um solver GPU-bound.

**Isso mudaria a viabilidade real da Fase A** SE o 403 fosse de fato falta
de escopo — mas era bug de sintaxe (ver acima). A via NVCF hospedada existe
e está acessível.

## Conclusão sobre o item 4 do handoff

Schema do **payload de otimização** (o que importa pra codar
`solveCuOptAllocation` de verdade) está confirmado contra doc oficial —
suficiente pra escrever a chamada real. O único hiato é o `functionId`
dinâmico do NVCF, que não é fabricável nem adivinhável — precisa da chave
real rodando o discovery call acima. `solveCuOptAllocation` continua como
stub até esse `functionId` ser confirmado, mas agora com o formato de
payload certo documentado — reduz o próximo passo a "descobrir o
functionId + implementar o polling", não mais "descobrir o schema inteiro
do zero".
