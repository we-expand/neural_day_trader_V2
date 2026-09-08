# Sessão 2026-09-07 — Bug de contexto do LLM Brain, investigação de escala multi-usuário e reconstrução do modelo financeiro

> Handoff completo da sessão, no padrão do projeto. Resumo de 1-2 linhas já
> está no `CLAUDE.md` (seção "COMECE AQUI"); este arquivo é o detalhe
> completo, consultar só se precisar.

## 1. Por que a IA saiu da operação de BTCUSD

Investigado via SQL direto (`ai_trades`, Supabase): a própria IA fechou a
posição por decisão discricionária (`exit_reason=AI_SIGNAL`), não por stop
nem alvo. O `ai_reasoning` de saída chegou a dizer literalmente **"NAO
fechar - há confluência válida para continuar curto... A tese técnica
persiste"** e mesmo assim o `close_position` foi executado — contradição
real entre o texto e a ação. Isso bate com o achado já registrado no
`CLAUDE.md` (item 1 do "COMECE AQUI"): fechamentos discricionários da
própria IA são o 2º maior ralo de dinheiro da sessão. O fix (barra de
invalidação técnica subida de ≥2 pra ≥3 fatores reais) já estava aplicado
no motor rodando, não commitado ainda.

## 2. Por que a IA não estava abrindo posições — investigação profunda

Achado real via `ai_brain_activity_log`: dois motivos coexistindo.

1. **Gate de confluência em mercado lateral funcionando como projetado** —
   a maioria das tentativas de `open_position` era rejeitada por só ter 1
   fator técnico alinhado num regime lateral (exige ≥2). Comportamento
   correto, não bug.
2. **Causa raiz real e mais grave: estouro do contexto do modelo local.**
   `llm-brain.log` mostrou `finish_reason=length` com `prompt_tokens`
   colando exatamente no teto de `num_ctx=24576` (ex:
   `prompt_tokens=24433 completion_tokens=143` → soma 24576). O ciclo
   perdia a decisão inteira porque não sobrava espaço de resposta, não
   porque o modelo "pensava demais" (diagnóstico anterior, incompleto).
   Medido: `GENESIS_PROMPT_MT5` sozinho tem ~11.000 tokens; a cesta de 11
   ativos + raciocínio do modelo dentro do mesmo ciclo enchia o resto.
   **Achado mais grave**: o servidor `llama-server` (Ollama) rodava com
   `--context-shift --keep 4` — o default do Ollama, nunca configurado
   explicitamente neste projeto. Isso significa que, quando o contexto
   aperta, o servidor descarta tokens do MEIO da conversa preservando só
   os 4 primeiros — ou seja, as próprias regras de risco do
   `GENESIS_PROMPT_MT5` (que começam logo depois desses 4 tokens) eram as
   primeiras candidatas a serem descartadas silenciosamente no meio do
   ciclo. Isso bate com o padrão observado ao vivo no log: o modelo se
   contradizendo sozinho, reconstruindo raciocínio básico do zero no meio
   do texto (ex: ciclo #15, um parágrafo inteiro reconstruindo se
   "extended pra baixo" favorece LONG ou SHORT).

### Fix aplicado e verificado ao vivo

- `Modelfile.qwen35-trading`: adicionado `PARAMETER num_keep 12000` —
  protege o system prompt inteiro contra descarte por `context-shift`.
- `ollama create qwen35-trading -f Modelfile.qwen35-trading` rodado.
- Processo reiniciado (watchdog religou sozinho, PID 71666, 20:44).
- **Confirmado por 2 ciclos completos pós-restart, zero ocorrências novas
  de `finish_reason=length`** — ciclos completando com `open_position` de
  verdade (XAUUSD LONG, BTCUSD LONG) e raciocínio coerente, sem a confusão
  circular de antes.
- Achado secundário, não corrigido: 2 ocorrências de `finish_reason=stop`
  com prompt bem abaixo do teto (18.310/18.476 tokens) onde o modelo
  simplesmente não chamou nenhuma ferramenta, apesar de
  `tool_choice: "required"` no request — sinal de que o `llama-server`
  local não reforça esse parâmetro com a mesma força que um provedor
  cloud. Risco residual, sem solução simples identificada.

## 3. Quantos usuários simultâneos a estrutura atual aguenta

Investigação de código real (`llm-active-brain/src/index.ts`,
`config.ts`, `ps aux` do processo Ollama):

- `Ollama` roda com `-np 1` (1 conversa processada por vez).
- `index.ts:235` usa `for (const session of sessions)` — loop **serial**,
  não paralelo, mesmo sendo "multi-tenant aware" no código.
- 1 ciclo completo (cesta de 11 ativos) já leva ~8-15 minutos medidos.

**Resposta, sem perder performance: 1 usuário.** Qualquer usuário
adicional dobra o tempo de ciclo de todo mundo, porque só existe 1 slot de
inferência. (Nota: a suposição inicial de que a conta MetaAPI também era
um gargalo compartilhado foi corrigida pelo Cleber — a conta é dedicada,
não compartilhada; isso não muda a resposta porque o gargalo de LLM
sozinho já trava em 1.)

## 4. O que mudaria pra 30 e pra 100 usuários — e quanto custaria

**O que precisa mudar** (3 mudanças, não é upgrade de hardware isolado):
1. Trocar `Ollama` (`-np 1`) por um servidor de inferência com batching de
   verdade (`vLLM`/`TGI`), compatível com a mesma API OpenAI já usada.
2. Paralelizar o loop principal (`index.ts`) — hoje serializa sessões
   mesmo que o servidor de baixo já aguente concorrência.
3. (Opcional, recomendado) Reduzir o tamanho do prompt por ciclo — o
   `GENESIS_PROMPT_MT5` de ~11k tokens e o JSON verboso do
   `get_mt5_quote` inflam custo/risco proporcionalmente.

**Throughput real medido/pesquisado**: uma A100 80GB com `vLLM` entrega
~2.500 tokens/seg pra modelo 4-8B. 30 usuários usam só ~15% dessa
capacidade; 100 usuários ~50% — ambos cabem numa GPU só, com folga.

**Custo (pesquisado ao vivo, não da memória)**:
- GPU A100 80GB (RunPod/Lambda/CoreWeave): **~US$1.400-1.500/mês**
  (~R$7.170-7.680 câmbio 2026-09-07, R$5,12/US$1).
- API paga por token (Groq Llama-3.1-8B $0,05/1M in, $0,08/1M out;
  Nemotron 3 Nano similar) pra 100 usuários 24/7, sem otimização: **~US$
  1.200/mês (~R$6.000)**; com prompt caching, pode cair pra
  ~R$1.500-3.000/mês.
- **Conclusão prática**: GPU dedicada com `vLLM` é mais barata e mais
  escalável que API paga numa carga constante alta como essa — cerca de
  1/3 a metade do custo, sem risco de cota/aposentadoria de modelo
  (já aconteceu 2x este ano com NVIDIA/Groq).

Fontes usadas nessa pesquisa (buscadas ao vivo em 2026-09-07):
- Groq Pricing 2026 (cloudzero.com, costbench.com)
- NVIDIA Nemotron pricing via DeepInfra/terceiros (deepinfra.com,
  pricepertoken.com)
- H100/A100 rental pricing (intuitionlabs.ai, synpixcloud.com)
- vLLM continuous batching throughput (runpod.io, spheron.network)
- Cotação USD/BRL 2026-09-07 (~R$5,12/US$1, investing.com)

## 5. Conta de negócio: 30 usuários fecha?

Usados os números reais já existentes no código do projeto:
- Preços da Landing (`translations.ts`): Starter grátis, Pro R$199/mês,
  Institutional R$399/mês — **fixados em 2026-07-28/29**.
- Modelo de comissão (`CommissionModel.ts`): comissão própria R$40/lote +
  rebate IB R$35/lote, imposto 10% — **criado em 2026-08-18**, ou seja,
  **3 semanas depois** do preço da Landing. O preço da assinatura nunca
  foi pensado sabendo que a comissão de execução existiria — achado
  confirmado via `git log`, não suposição.

Pra 30 usuários pagantes (Pro, ~5 lotes/mês cada, premissa já usada no
`ProgramExplainer.tsx`): receita bruta ~R$17.220/mês. Descontando imposto
e infra REAL (GPU dividida por 30, não os R$27/usuário antigos da
planilha): margem de contribuição entre **R$8.000 e R$13.500/mês**,
dependendo da GPU escolhida — mas isso é margem de contribuição, não
lucro líquido (não descontava custo fixo administrativo nem comissão de
parceiro). Descontando o custo fixo administrativo real da planilha
(R$3.000/mês, cenário Realista, sem folha de pagamento): **lucro líquido
~R$5.000 a R$10.500/mês**, positivo nos dois cenários de GPU.

## 6. Reconstrução do modelo financeiro (`projecao-financeira-5anos.xlsx`)

Backups preservados a cada rodada de edição:
`projecao-financeira-5anos.xlsx.bak-2026-09-07`,
`.bak-2026-09-07b`, `.bak-2026-09-07c`.

### 6.1 Custo de infraestrutura por usuário — de taxa fixa pra modelo em degrau

A premissa original (linha 28 da aba "Premissas") era **R$27/usuário
fixo, igual nos 3 cenários** — calibrada pro motor mecânico antigo
(custo de API por token, sem economia de escala). Isso está
estruturalmente errado pro motor LLM atual: custo é de **GPU dedicada**,
fixo por infraestrutura, não por usuário — mais usuários dividindo a
mesma GPU baixa o custo por cabeça.

**Novas premissas** (linhas 35-36 de "Premissas"):
- Linha 35: Custo mensal por GPU dedicada = **R$7.400** (A100, pesquisado
  ao vivo).
- Linha 36: Capacidade de usuários pagantes por GPU = **150** (folga
  conservadora sobre o throughput medido).

**Fórmula da linha 27 (infra) nas 3 abas de cenário**, reescrita de
`usuários × R$27` pra:
```
=CEILING(usuários_ativos_do_mês / capacidade_por_GPU, 1) × custo_por_GPU
```
Recalculado com LibreOffice headless, **zero erros** em 60 meses × 3
cenários. Exemplo real (Realista): mês 1 = R$7.400 (1 GPU, 80 usuários);
mês 60 = R$333.000 (45 GPUs, 6.705 usuários) — a linha 28 antiga (R$27
fixo) virou só referência histórica, marcada como SUPERADA na nota da
célula.

### 6.2 Degustação do Starter — pedido do Cleber

Ideia: Starter (grátis) passa a rodar o motor autônomo de verdade (não só
alerta manual) até completar **30 operações** (Cleber considerou 10-30,
decidiu 30) — "dar o gostinho", ~**2 dias** de operação, depois corta.

**Novas premissas** (linhas 37-38): operações grátis = 30; duração média
= 2 dias.

**Mudança estrutural**: antes, o custo de GPU contava TODO usuário Starter
ativo (base acumulada) como carga plena o tempo todo — superestimava
muito a carga real. Agora, uma nova linha por aba ("Carga de GPU
equivalente", linha 15) soma pagantes ativos (carga plena) + só os NOVOS
cadastros Starter do mês × fração do mês em degustação (2/30 ≈ 6,7%). O
volume de lotes negociados pelo Starter (linha 20) também passou a vir dos
novos cadastros do mês (evento único), não da base acumulada (uso
contínuo). Efeito real: derrubou MUITO o custo de infra projetado pra
mês 12 (ex: Otimista caiu de R$103.600/14 GPUs pra R$14.800/2 GPUs) —
efeito colateral bom da mudança de produto.

### 6.3 Cenário "Bootstrap" (4º cenário, novo) — o que faria pra não ficar no vermelho

Pedido do Cleber: "o que eu teria que fazer pra ter 0 no primeiro mês e
não ter nada negativo nos subsequentes?"

**Obstáculo estrutural encontrado**: o modelo já tem defasagem de 2 meses
entre cadastro e conversão pra pago (`E7 = C6 × conversão`) — no mês 1
NUNCA existe pagante, não importa a premissa. Zerar o mês 1 só é possível
cortando despesa até bater a receita pequena da degustação do Starter, não
subindo receita.

**Nova coluna de cenário "Bootstrap"** na aba Premissas (coluna F) +
**nova aba "Bootstrap"** (cópia da estrutura da Realista, referências
trocadas pra coluna F):
- **CAC = R$0** — crescimento só por orgânico/indicação, sem mídia paga
  (maior corte isolado: CAC era ~45% da despesa do mês 1 no Realista).
- **Infra híbrida**: nova premissa (linha 39) de custo variável via API
  paga (~R$292/usuário-mês equivalente, calculado a partir da pesquisa de
  preço Groq/Nemotron desta sessão) — fórmula usa `MIN(custo GPU em
  degrau, custo variável × carga)`, trocando automaticamente pra GPU só
  quando a escala passar de ~25 usuários equivalentes (ponto de
  cruzamento real: R$7.400 ÷ R$292 ≈ 25,3).
- **Sem contratação** — achado no meio do caminho: a fórmula de custo de
  equipe usa `ROUNDUP`, que arredona QUALQUER pagante > 0 pra 1
  funcionário inteiro (R$9.000), não importa o divisor. Corrigido
  zerando o custo por funcionário (linha 30, coluna F) pra refletir de
  fato a operação solo do Cleber nesse estágio.
- Crescimento mais lento (novos cadastros mês 1 = 20, crescimento mensal
  3%) — reflete aquisição só por indicação, mais lenta que mídia paga.

**Resultado recalculado, zero erros**:

| Mês | Receita | Despesas | Lucro | Caixa acumulado |
|---|---|---|---|---|
| 1 | R$1.050 | R$3.494 | -R$2.444 | -R$23.444 |
| 4 | R$3.138 | R$4.660 | -R$1.522 | -R$29.362 |
| 7 | R$6.029 | R$6.276 | -R$247 | -R$31.358 |
| **8** | R$6.952 | R$6.791 | **+R$160** | -R$31.197 |
| 12 | R$10.494 | R$8.769 | +R$1.726 | -R$26.616 |

Não chega em exatamente zero no mês 1 nem "nada negativo depois" — mas
prejuízo pequeno e decrescente todo mês, sem saltos, virando positivo no
**mês 8**. O resíduo do mês 1 (-R$2.444) vem quase todo do custo fixo
administrativo (R$3.000/mês) sendo maior que a receita de degustação
ainda muito pequena (R$1.050, só 20 cadastros). Caixa acumulado (com o
investimento inicial de -R$21.000) não recupera dentro de 12 meses, mas a
trajetória vira e melhora seguido a partir do mês 8.

## 7. Quanto captar de investidor pra iniciar com segurança

Metodologia: cobrir o pior momento de caixa real de cada cenário (já
recalculado na planilha), não só o custo de lançamento (R$21.000), com
margem de segurança de ~35% pra imprevisto/atraso.

- **Cenário Realista (crescimento com mídia paga, CAC ativo)**: pior
  momento de caixa é **-R$132.305** (mês 9, antes de virar positivo no
  mês 10). Captar **R$170.000-190.000**.
- **Cenário Bootstrap (sem CAC, só orgânico/indicação)**: pior momento de
  caixa é **-R$31.358** (~mês 7, antes de virar positivo no mês 8).
  Captar **R$40.000-45.000**.
- **Cenário Pessimista (conversão 3%): NÃO recupera nem em 5 anos.**
  Rodados os 60 meses completos (aba "Resumo Anual"): caixa acumulado
  termina o Ano 5 em **-R$1.011.954**, piorando ano a ano sem reversão.
  Captar capital pra cobrir esse cenário não resolveria nada — é sinal de
  que a estrutura (preço/custo/conversão) precisaria mudar, não uma
  questão de dinheiro. Dado real, reportado sem suavizar.

**Recomendação dada ao Cleber**: como a conversão real (a variável que
mais separa os cenários) ainda não foi medida — produto não lançado —
a rota mais segura é começar pelo Bootstrap com capital pequeno
(~R$45.000), medir a conversão real nos primeiros meses, e só então decidir
se vale captar mais pra escalar com mídia paga. Reduz o risco de captar
R$180 mil e descobrir depois que a conversão real está mais perto do
Pessimista.

## Pendências reais em aberto

1. **Preço da assinatura (R$199/R$399) nunca foi revisado** sabendo que a
   comissão de execução existiria — decisão de precificação do Cleber,
   não uma correção técnica que eu deva fazer sozinho.
2. **Implementação real no motor** da degustação do Starter (contar
   operações e cortar no limite de 30) — pendente, é código
   (`llm-active-brain/src/tools.ts` + gate de permissão), não só planilha.
3. **Achado do `tool_choice: "required"` não reforçado** pelo servidor
   Ollama local (seção 2) — sem solução identificada ainda, risco residual
   baixo.
4. **Migração Ollama → vLLM/TGI + paralelização do loop** — necessária pra
   qualquer número acima de 1 usuário simultâneo sem perder performance,
   nada disso foi implementado ainda, só dimensionado/precificado.
5. Zerar de vez o mês 1 do cenário Bootstrap exigiria cortar ainda mais o
   custo fixo administrativo ou aumentar a monetização da degustação —
   não explorado a fundo, fica pra decisão futura do Cleber.
