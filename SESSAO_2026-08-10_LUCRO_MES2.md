# Sessão 2026-08-10 (continuação) — Consultoria: lucro a partir do mês 2

> Continuação de [SESSAO_2026-08-10_MODELO_FINANCEIRO.md](SESSAO_2026-08-10_MODELO_FINANCEIRO.md)
> (que ficou focada em lucro no **Ano 1** agregado). Esta sessão foi provocada
> pelo pedido do Cleber: "lucrativo a partir do segundo mês de operação e
> ganhos exponenciais a partir do segundo mês" — investiga se dá, com quê, e
> com que nível de certeza. **Cleber ainda vai pensar — nada decidido, nada
> aplicado na planilha oficial ainda.**

## ▶ Onde paramos

Simulação em Python (fora da planilha oficial, mas replicando fielmente as
fórmulas da aba Realista — validada contra os valores reais da planilha antes
de alterar premissas) mostrou que **dá pra chegar a lucro no mês 2 do cenário
Realista**, mas exige um pacote de 7 alavancas, sendo a 7ª (mais crítica e
mais incerta) uma **feature de produto que ainda não existe**: um gatilho de
conversão Starter→Pago disparado no momento exato de uma oportunidade
perdida, em vez da conversão passiva por tempo que o modelo assume hoje.

**Nada disso foi aplicado na planilha oficial `projecao-financeira-5anos.xlsx`
ainda** — é mudança estrutural de fórmula (CAC em rampa, taxa de ativação,
defasagem de conversão, correção de bug de contratação), não só ajuste de
célula azul. Cleber vai pensar antes de decidir se entra no roadmap.

## Bug real encontrado (não é opinião, é fórmula)

`Realista!D28` (e equivalente nas outras abas de cenário): custo de equipe é
`=ROUNDUP(pagantes/600,0)*9000`. `ROUNDUP` de qualquer fração entre 0 e 1 dá
**1** — ou seja, no instante em que existe **1 único pagante fracionário**
(mês 3 na Realista, 6,4 pagantes), o modelo já lança R$9.000/mês de custo de
equipe inteiro, como se tivesse contratado alguém pra atender 600 clientes que
ainda não existem. Isso sozinho infla a despesa do mês 3 sem motivo
operacional real. **Ainda não corrigido na planilha oficial.**

## Diagnóstico — por que hoje só lucra a partir do mês 7 (Realista)

1. O bug acima (custo de equipe fantasma a partir do mês 3).
2. CAC pago sobre 100% dos cadastros novos desde o mês 1 (R$8.800 só no mês
   1), enquanto a receita de pagante só aparece 2 meses depois (defasagem de
   conversão) — descasamento de caixa clássico de lançamento.
3. Custos fixos administrativos em cheio (R$3.000/mês) desde o mês 1, antes
   de qualquer receita recorrente existir.

## O pacote de 7 alavancas testado (simulação, não aplicado)

| # | Alavanca | De | Para | Execução exigida |
|---|---|---|---|---|
| 1 | Corrigir bug de contratação | `ROUNDUP`, dispara com 1 pagante | `FLOOR`, limiar 150 pagantes | Correção de fórmula — trivial |
| 2 | CAC em rampa, não CAC plano | R$110/cadastro fixo desde mês 1 | R$35 (meses 1-3, comunidade/indicação) → R$70 (meses 4-6) → R$110 (mês 7+) | Migrar canal de aquisição de fato pros 3 primeiros meses |
| 3 | Custos fixos enxutos nos 6 primeiros meses | R$3.000/mês | R$1.500/mês (meses 1-6) | Contador simplificado, adiar gasto discricionário |
| 4 | Taxa de ativação one-time no upgrade | R$0 | R$97 único, no momento do upgrade Pro/Institutional | Construir cobrança única no fluxo de upgrade |
| 5 | Comissão própria | R$40/lote | R$45/lote | Decisão de preço — ainda dentro/perto do benchmark cTrader ECN |
| 6 | Rebate IB | R$35/lote | R$40/lote | Negociação real com a corretora, não automática |
| 7 | **Defasagem de conversão Starter→Pago** | 2 meses (passiva) | 1 mês (ativa, por gatilho) | **Feature de produto nova, não existe no código hoje** — ver detalhe abaixo |

## Resultado simulado — Realista, mês a mês (com as 7 alavancas)

| Mês | Receita | Despesa | Lucro do mês | Caixa acumulado |
|---|---|---|---|---|
| 1 | R$4.760 | R$6.936 | -R$2.176 | -R$23.176 |
| **2** | R$13.765 | R$9.960 | **+R$3.804** | -R$19.372 |
| 3 | R$21.835 | R$12.769 | +R$9.066 | -R$10.306 |
| 4 | R$29.620 | R$18.643 | +R$10.977 | +R$671 (investimento de lançamento recuperado) |
| 5 | R$37.171 | R$21.357 | +R$15.814 | +R$16.485 |
| 6 | R$44.533 | R$23.991 | +R$20.542 | +R$37.027 |
| 12 | R$86.867 | R$45.740 | +R$41.127 | +R$219.219 |

**Sem a alavanca 7** (mantendo defasagem de 2 meses, só as outras 6): mês 2
fica em **-R$337** — muito perto, mas não cumpre "lucrativo a partir do mês
2". A alavanca 7 é o que fecha a lacuna.

**Checado nos outros 2 cenários, honestamente:**
- **Otimista** com o mesmo pacote: já lucrativo desde o **mês 1** (+R$934),
  mês 12 em +R$252k/mês, caixa acumulado +R$1,4mi.
- **Pessimista** com o mesmo pacote: **continua no vermelho o ano inteiro**
  (mês 12 ainda em -R$4.367/mês). Não forcei esse número — é consistente com
  a decisão já tomada na sessão anterior de manter o Pessimista como cenário
  de alerta que não deve fechar.

## Sobre preço — não mexido, e por quê

R$199 (Pro) / R$399 (Institutional) comparado ao mercado brasileiro de
ferramentas de trading/copy: está na faixa correta (nacional cobra R$150-450/
mês; copy trading via corretora cobra por performance, 20-30% do lucro — pior
opção aqui porque cria incentivo de operar mais sem edge, e o projeto já
mediu edge ≈ 0 pra sinal técnico clássico, CLAUDE.md). A alavanca real não é
preço de mensalidade, é comissão/rebate por lote (já ~75% da receita) e taxa
de conversão.

## Produtos/funções extras sugeridos (não modelados numericamente)

1. Taxa de ativação R$97 (já no pacote acima) — exige onboarding assistido
   real, não só um número.
2. Billing anual com desconto ("pague 10, leve 12") — puxa caixa pra frente,
   reduz churn por impulso. Ainda não modelado como premissa numérica
   (pendência já registrada na sessão anterior).
3. Programa de indicação (cashback 1 mês pra quem indica um convertido) — é
   o que sustenta o CAC de R$35 dos 3 primeiros meses da tabela acima; sem
   ele, esse número não é crível.
4. Syndicate Core como canal B2B separado — já identificado na sessão
   anterior como fonte de crescimento não-linear real (CAC quase zero, ticket
   alto). Recomendo abrir esse pipeline em paralelo, fora da planilha de
   varejo.

## Detalhe da Alavanca 7 — o gatilho de conversão (a parte que Cleber pediu pra explicar)

**Confirmado no código**: não existe nada disso construído hoje. Busquei por
lógica de upgrade/trigger de conversão no repo — "Starter" só aparece em
texto de landing/billing (`translations.ts`, `BillingSettings.tsx`,
`CompetitiveAnalysis.tsx`), nenhuma lógica de produto real. É 100% a
construir.

**O que é**: hoje a conversão é passiva — 8% dos cadastros viram pagantes, 2
meses depois, sem nenhum estímulo do produto, prazo arbitrário. A Alavanca 7
troca isso por um gatilho ativo disparado no momento exato da dor: rodar em
paralelo, invisível pro usuário Starter, uma **simulação sombra** ("o que a
execução automática/Pro teria feito com esse sinal?"). Quando um sinal que o
Starter só recebe como alerta (execução manual) teria fechado em lucro se
fosse automático, dispara um prompt no instante desse fechamento: *"Esse
sinal teria rendido R$X se você estivesse no Pro. Ative agora."* — prova
concreta de perda, não notificação genérica agendada.

**Por que compressa 2 meses → 1 mês**: hipótese de modelagem, não medição —
gatilho contextual no momento certo historicamente reduz tempo de decisão
porque tira a fricção de "lembrar de considerar". Só uma base real de
usuários confirma isso de fato.

**Escopo técnico pra construir** (nenhum trivial):
1. Simulação sombra por usuário Starter — acoplar no motor de decisão
   existente (`research/AI_BRAIN_SPEC.md`), rodar contrafactual real/Pro por
   sinal. É o item mais caro — sustenta os outros.
2. Detecção do evento de disparo (momento do fechamento hipotético em lucro).
3. UI do prompt (modal/notificação in-app + CTA de upgrade de um clique).
4. Instrumentação de atribuição — medir taxa real por tipo de gatilho, não
   assumir os 8%/1 mês.
5. Dois gatilhos de apoio, mais simples e já citados na aba "Sugestões de
   Crescimento" da planilha: erro de execução manual (timing perdido) e
   engajamento por N dias — fallback pra quem não tem sinal sombra ainda.

**Se não for construída a tempo do lançamento**: modelo cai de "lucrativo no
mês 2" pra "lucrativo no mês 3" (resultado só com as outras 6 alavancas) —
ainda uma melhora grande frente ao mês 7 atual da planilha oficial, não é
tudo ou nada.

## Pendências reais em aberto

1. **Decisão do Cleber**: entrar ou não com a Alavanca 7 no roadmap de
   pré-lançamento (ele disse "vou pensar ainda" nesta sessão — nada decidido).
2. **Nenhuma das 7 alavancas foi aplicada na planilha oficial
   `projecao-financeira-5anos.xlsx`** — é mudança estrutural de fórmula nas 3
   abas de cenário (CAC em rampa por mês, correção do bug de contratação,
   taxa de ativação, defasagem de conversão parametrizável), não ajuste de
   célula azul. Fazer isso é o próximo passo natural se a linha seguir.
2. CAC de R$35/mês nos 3 primeiros meses depende do programa de indicação
   (item 3 acima) existir de fato — sem ele, esse número não é crível.
3. Rebate R$40/lote depende de negociação real com a corretora — não
   modelada como automática.
4. O script Python de simulação usado nesta sessão está em
   `/private/tmp/claude-501/.../scratchpad/sim.py` (fora do repo, sessão
   temporária) — se a linha seguir, os números devem ser reconstruídos
   direto na planilha oficial com fórmula auditável, não reaproveitados de
   um script solto.

## Como continuar numa sessão nova

1. Ler este arquivo primeiro se for continuar a discussão de lucro no mês 2.
2. Se o Cleber decidir seguir com a Alavanca 7: próximo passo é desenhar o
   escopo técnico dela dentro do `AI_BRAIN_SPEC.md` (onde entra a simulação
   sombra) e as tabelas/eventos novos necessários no Supabase — ainda não
   feito, só descrito em alto nível acima.
3. Se decidir não seguir com a Alavanca 7 (ou adiar): aplicar só as
   alavancas 1-6 na planilha oficial já entrega lucro a partir do mês 3 (vs.
   mês 7 hoje) — resultado ainda relevante, sem depender de feature nova.
4. Em qualquer caso, as alavancas 1-6 exigem reescrever fórmulas
   estruturais nas 3 abas de cenário da planilha oficial — ainda não feito,
   pendente de confirmação do Cleber sobre qual pacote seguir antes de mexer
   na planilha.
