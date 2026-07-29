# Roadmap para Prontidão de Investimento — Neural Day Trader

**Criado**: 2026-07-29. **Objetivo**: sair do estado atual (4 usuários, R$0 de
receita, módulo de risco não implementado, produto ainda não valida a tese que
o próprio time decidiu vender) até um estado em que conversar com investidor
seja defensável numa due diligence de verdade.

**Princípio geral**: cada fase tem critério de saída explícito, decidido
*antes* de começar (mesma disciplina do `research/CRITERIA.md` do motor de
IA). Não avança de fase por otimismo — avança porque o critério foi cumprido,
documentado, com o dado real por trás.

**Estimativa total**: 10-16 semanas de trabalho focado, jurídico como maior
fator de variância (pode redesenhar o modelo de receita inteiro dependendo da
resposta).

---

## Fase 0 — Fechar o que ficou pela metade (1-2 semanas)

**Por que primeiro**: a sessão de hoje corrigiu a vitrine estática (`main`),
mas a auditoria de dado fabricado que a sessão de 2026-07-28 fez foi só na
tela "IA Preditiva". O app real (branch `dev`, o que volta ao ar quando
terminarmos) ainda tem os mesmos números fabricados dentro do componente
React de origem:

- `src/app/components/landing/LandingPage.tsx` — "24.000+ nós ativos",
  "$1.2B volume diário", "99.99% uptime" hardcoded.
- `src/app/components/landing/translations.ts` — promessas de capacidade
  inexistente ("Zero Latency Co-location", "criptografia resistente a
  quantum", "Cluster Neural Dedicado", execução em milissegundos).

Corrigir isso na página estática (`main`) não resolveu a origem — só escondeu
o sintoma enquanto o site está fora do ar. Precisa ser corrigido no
componente de verdade antes de qualquer relançamento.

**Entregáveis**:
1. Reescrever `LandingPage.tsx`/`translations.ts`/`Pricing.tsx` — remover
   todo número e capacidade fabricados, usar só o que existe e é
   verificável (as mesmas 18 fontes RSS reais, order book real de cripto,
   metodologia de validação quant honesta — que é o diferencial real).
2. Varredura completa do repo (não só uma tela) por `Math.random`,
   percentuais fixos suspeitos, e claims de latência/segurança/capacidade
   não verificáveis — mesmo padrão de auditoria já aplicado em
   `LiquidityPrediction.tsx`, agora em escopo de repo inteiro.
3. Reposicionamento de copy definitivo: de "IA que prevê o mercado" para
   "disciplina de execução e gestão de risco de nível institucional" — a
   mensagem que o próprio Cleber decidiu em 2026-07-27, mas que ainda não
   chegou no texto voltado pro usuário final.

**Critério de saída**: zero número ou capacidade não verificável em
qualquer superfície voltada pro usuário (landing, pricing, dashboard,
narração por voz). Confirmado por grep + revisão manual, não por amostragem.

---

## Fase 1 — Módulo de risco com enforcement real (3-4 semanas)

**Por que**: é o produto. Hoje é ficção — `RiskManager.ts` (67 linhas,
`validateTrade`/Kelly fracionário) não é chamado por nenhum lugar do código;
`NeuralRiskGuardian.ts` é um stub de 4 linhas usado só pelo tipo. O
enforcement decidido como arquitetura (`PLANEJAMENTO-LANCAMENTO`, §7.2 —
"no backend, na rota `/broker/execute`") não existe.

**Entregáveis** (ordem de prioridade da pesquisa já feita em
`RISK_MODULE_SPEC.md`):
1. Daily loss limit + max drawdown trailing (ancorado no fechamento diário,
   modelo Topstep) — bloqueio real de nova ordem no backend, não só aviso
   na UI.
2. Position sizing por % de risco + ATR (fixed fractional/volatility-adjusted).
3. Cooldown automático após N perdas consecutivas.
4. Limite rígido de trades/dia.
5. Kill-switch manual e automático.
6. Sizing informativo por Kelly fracionário (¼-½) — nunca como enforcement
   automático, só sugestão sobre o histórico do próprio usuário.
7. Remover `RiskManager.ts`/`NeuralRiskGuardian.ts` (stubs) depois que o
   módulo real substituir as duas pontas que hoje usam só o tipo.

**Critério de saída**: cada regra testada manualmente forçando o cenário
real (não só teste unitário) — provar que uma ordem que violaria o limite é
de fato rejeitada pelo backend, não só sinalizada no frontend.
`npm run validate` verde antes de qualquer commit que toque o motor.

---

## Fase 2 — Ponte decisão→execução, estágios 1 e 2 (2-3 semanas)

**Por que**: desenhada em 2026-07-27 (`AI_BRAIN_SPEC.md` §9.1), zero linha
escrita ainda. Sem isso, "disciplina de execução automatizada" continua
sendo promessa, não produto.

**Entregáveis**:
1. Estágio 1 (alerta) + estágio 2 (confirmação manual) — módulo de código
   isolado, não reaproveita `useApexLogic.ts` (decisão já tomada).
2. Disclaimer permanente de "sem edge comprovado" visível nesses estágios
   — obrigatório, não cosmético.
3. Zero chamada à MetaAPI compartilhada até estágio 3 (que fica fora de
   escopo por ora — decisão de avançar além do estágio 2 fica para depois
   da validação da Fase 4, nunca antes).

**Critério de saída**: usuário consegue ver um alerta, confirmar manualmente,
e o sistema registra a decisão — sem nenhuma chamada de execução real
disparada automaticamente.

---

## Fase 3 — Trilha jurídica (inicia já, roda em paralelo às Fases 1-2)

**Por que agora e em paralelo**: é a maior variável de risco do projeto e
tem o maior lead time (agenda de advogado, não depende de código). Pode
redesenhar o modelo de receita inteiro — melhor descobrir isso enquanto o
motor de risco ainda está em construção do que depois.

**Entregáveis**:
1. Contratar advogado de **mercado de capitais** (não é o mesmo perfil de
   tech/LGPD do orçamento de lançamento) — R$5-15 mil, conforme já mapeado
   em `PLANEJAMENTO-LANCAMENTO`, §6.
2. Duas perguntas objetivas, por escrito:
   - O produto como desenhado (alerta + confirmação manual + execução
     futura) configura consultoria de valores mobiliários ou gestão de
     carteira sob a Resolução CVM 19/21?
   - Qual a exposição de intermediar usuários brasileiros para uma
     corretora CFD offshore (Infinox) não autorizada pela CVM — existe
     estrutura que mitigue isso?
3. Revisão de Termos de Uso / Política de Privacidade / DPA à luz da
   resposta acima.

**Critério de saída**: parecer por escrito, com resposta objetiva às duas
perguntas — mesmo que a resposta implique redesenhar comissão/rebate ou
travar em fase demo por mais tempo. Este parecer é pré-requisito para abrir
o produto a qualquer usuário pagante real (Fase 5), não apenas para
investidor.

---

## Fase 4 — Validação com usuários reais em demo (2-3 semanas, após Fases 1-2)

**Por que**: "validação do produto" hoje significa 4 usuários, quase certamente
o próprio Cleber. Validação de verdade é usuário externo, sem você por perto,
com dinheiro fictício (demo) mas comportamento real.

**Entregáveis**:
1. Recrutar 10 usuários reais e externos (não equipe, não amigos
   avisados do objetivo do teste).
2. Métricas definidas **antes** de começar (mesma disciplina do
   `CRITERIA.md`):
   - Retenção na semana 2 ≥ 50%.
   - Pelo menos 1 caso documentado de enforcement de risco impedindo de
     verdade uma perda maior (prova de que o produto funciona, não só
     existe).
   - ≥ 5 de 10 dizem que pagariam pelo que usaram, em entrevista curta.
3. Cadência semanal de acompanhamento, log de fricção e bug real.

**Critério de saída**: os 3 números acima, com o dado real — inclusive se
o resultado for ruim. Se não bater o piso, a decisão é ajustar o produto,
não maquiar o número (mesma cultura do projeto até aqui).

---

## Fase 5 — Primeiros usuários pagantes (2-4 semanas, cauda sobreposta à Fase 4)

**Por que**: receita recorrente pequena e real pesa mais numa mesa de
investimento do que qualquer projeção em planilha.

**Entregáveis**:
1. Cobrança mínima viável (Stripe ou Pix manual) — não precisa da
   infraestrutura completa de comissão/rebate ainda.
2. 5-10 usuários pagando qualquer valor (mesmo abaixo do preço-alvo de
   R$97-197, se necessário para o primeiro grupo).
3. Retenção acompanhada por 60-90 dias corridos.

**Critério de saída**: X pagantes reais, retenção Y% em 60-90 dias — número
real, documentado, não projeção.

---

## Fase 6 — Higiene financeira e jurídica antes do pitch (1-2 semanas, paralelo às Fases 4-5)

**Por que**: a planilha `projecao-financeira-5anos.xlsx` já tem 3 furos
conhecidos e documentados (`PLANEJAMENTO-LANCAMENTO`, §4) — corrigir antes
que um investidor os encontre primeiro.

**Entregáveis**:
1. Adicionar impostos (Simples, 6-15,5% do faturamento).
2. Adicionar CAC realista (R$100-400/usuário no varejo de trading).
3. Corrigir curva de churn para cenário pessimista honesto (12-15%/mês por
   coorte, não a curva otimista atual).
4. Consolidar um dashboard de métricas reais (usuários, retenção, MRR,
   estatística de enforcement de risco em ação) — o que vai substituir
   slide de projeção por dado real onde houver dado real.

**Critério de saída**: planilha corrigida + dashboard de métricas reais
prontos, revisados linha a linha.

---

## Fase 7 — Materiais e mapeamento de investidor (1-2 semanas, só depois das Fases 3-6 fechadas)

**Só começa depois que os gates acima passaram.** Monde a máquina de
captação quando houver o que colocar dentro dela, não antes.

**Entregáveis**:
1. Deck e one-pager com números reais only — nenhuma projeção sem
   rótulo explícito de "projeção", nenhum claim que a Fase 0 acabou de
   remover do produto.
2. Data room organizado (parecer jurídico, métricas de validação,
   modelo financeiro corrigido, demonstração do produto).
3. Mapeamento de investidores pre-seed com apetite real para
   fintech/trading regulado — filtrar por quem já investe em categoria
   parecida (a maioria de fundos brasileiros evita por causa do
   regulatório CVM, então a lista é mais curta e mais específica do que
   "todo fundo pre-seed").

**Critério de saída**: primeira reunião agendada com investidor cujo
histórico de tese realmente cobre esse tipo de produto.

---

## Resumo — dependências e paralelismo

```
Semana:   1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16
Fase 0:  [==]
Fase 1:       [==============]
Fase 2:                      [=========]
Fase 3:  [=========================================]  (paralelo, lead time externo)
Fase 4:                                [==========]
Fase 5:                                     [===============]
Fase 6:                                [====]
Fase 7:                                                [========]
```

Fase 3 (jurídico) é a única que corre paralela desde o dia 1 — inicia
imediatamente porque tem o maior lead time e pode redesenhar tudo. As
demais são majoritariamente sequenciais: não faz sentido validar com
usuário real (Fase 4) antes do enforcement de risco existir (Fase 1) —
seria validar promessa, não produto.

## O que NÃO entra neste roadmap (decisão já tomada, não reabrir sem motivo novo)

- Trilho 2 (busca de edge de sinal com dado estruturalmente diferente —
  order book, calendário, cross-asset) — pausado desde 2026-07-27, sem
  novo trabalho até haver dado pago aceito conscientemente ou fonte grátis
  nova. Não é pré-requisito para captação — o produto vendável é
  disciplina de execução, não previsão.
- Estágio 3 da ponte decisão→execução (execução automática real) — fica
  para depois da Fase 4, nunca antes de validação com usuário real.
- Segunda corretora / diversificação de parceiro MetaAPI — só se a conta
  compartilhada atual não aguentar o volume da Fase 4 (10 usuários
  simultâneos, provavelmente aguenta).
