# Sessão 2026-08-18 — Programa de Parceiros IB (reconstrução completa)

> Handoff da reconstrução da seção "Parceiros" do app. Não é sobre o cérebro de
> decisão (isso continua em [NEXT_SESSION.md](NEXT_SESSION.md)). Leia este
> arquivo antes de mexer em comissionamento, níveis de parceiro ou nas tabelas
> `partner_*`.

## ▶ COMECE AQUI (próxima sessão)

**Estado verificado direto no banco/Supabase em 2026-08-18, fim da sessão**
(não confiar em "rodei tudo" sem checar de novo se muito tempo passar):

| Item | Estado |
|---|---|
| `20260818_partner_ib_program.sql` | ✅ Aplicada por completo — tabelas, triggers (`partner_commission_block_update`, `partner_accounts_assign_code`, `partner_accounts_protect_privileged_fields`), constraints (`commission_never_exceeds_margin`, `negative_amount_only_on_reversal`) e `generate_referral_code()` todos confirmados existindo no Postgres. |
| `20260818_broker_order_executions.sql` | ✅ **Aplicada** — confirmado via `to_regclass`, RLS ligado, 1 policy (`select_own`), 2 índices (PK + `user_id, executed_at`). Primeira tentativa tinha dado "sucesso" mas a tabela não existia (suspeita: SQL Editor apontando pro projeto errado); segunda tentativa confirmada. |
| Deploy da Edge Function `server` | ✅ Confirmado — versão 69 no Supabase, importa `buildExecutionLedgerRow` de `brokerExecutionLedger.ts` (o handler novo está publicado, não só o código antigo). |
| **B4 — job de apuração mensal** | ✅ Escrito e deployado. **Decisão "comissão só sobre execução" tomada em 2026-08-18** — cron real preparado em `20260818_schedule_partner_commission_accrual.sql`, **ainda não aplicado** (falta o Cleber trocar o secret real no SQL e rodar). |
| Commit / push | ✅ Feito em duas rodadas: `adbc0eadb` (B1 + reconstrução do programa) e o commit do job B4. **Pendente**: commit desta rodada (decisão v1 + migration do cron) — ver "Comandos prontos". |

**O que ainda falta, nesta ordem de importância**:

0. ✅ **[RESOLVIDO 2026-08-18]** Decisão do Cleber: **"comissão só sobre
   execução" aceito explicitamente como v1.** `subscription_revenue`/
   `marketplace_revenue` continuam gravados como 0 — um indicado que assina
   o plano mas nunca executa ordem gera R$0 de comissão pro parceiro
   enquanto essas fontes não existirem (não é lacuna, é escopo assumido).
   Migration `20260818_schedule_partner_commission_accrual.sql` criada com
   o `cron.schedule` real (mensal, dia 1 às 04:00 UTC) — **não aplicada**,
   precisa que o Cleber troque `<PARTNER_ACCRUAL_SHARED_SECRET>` pelo valor
   real antes de rodar no SQL Editor.
1. **B2 — captura do `?ref=` no cadastro** — ainda não implementada. Sem
   isso ninguém entra na rede de ninguém, mesmo com B1+B4 prontos e o cron
   agendado.
2. **B3 — marcos do funil** (`broker_linked_at`, `first_trade_at`,
   `subscribed_at`) — ainda não são gravados em lugar nenhum.
   Ver seção "Pendências reais em aberto" para o resto (termos do programa,
   retenção de imposto, reconciliação do ledger, multi-corretora).

## ▶ O que foi feito

A seção "Parceiros" era uma **maquete inteira**: código de indicação gerado no
`localStorage`, 12 indicados fictícios com e-mails inventados, `US$1.250` de
"Comissão Total", gráfico de receita com 4 pontos fixos no código, níveis
"Officer 20% / Commander 25%" sem nenhum modelo por trás e a promessa "ganhe
até 30% recorrente" que não correspondia a nada. Zero tabelas no banco.

Foi reconstruída em quatro camadas:

1. **Modelo econômico** calibrado contra a planilha financeira de 5 anos, com
   invariante travada por asserção no gate de commit.
2. **Schema real** no Supabase, append-only, com a invariante repetida como
   `CHECK` no banco.
3. **Serviço de leitura** que nunca inventa dado — quando não há, diz que não há.
4. **UI nova** com painel de rede, extrato auditável, escada de níveis e
   simulador declarado como projeção.

## A pergunta central: quanto pagar sem quebrar

### A regra escolhida

```
comissão do parceiro = alíquota do nível × MARGEM DE CONTRIBUIÇÃO do indicado
margem = receita bruta − imposto sobre faturamento − custo de servir (infra)
```

A base é **margem**, não receita bruta. Com a alíquota máxima em 30%, a
plataforma retém **≥70% por construção** — em qualquer cenário de volume, preço
ou rebate. Não é uma promessa de calibração, é aritmética: é impossível o
programa pagar mais do que gerou.

### Por que não pagar sobre receita bruta (o achado que decidiu o desenho)

Margem de contribuição por indicado/mês, calculada com as premissas da aba
"Premissas" da planilha:

| Cenário | Perfil | Receita bruta | Imposto | Infra | **Margem** |
|---|---|---|---|---|---|
| Pessimista | Assinante | R$ 385,00 | −26,95 | −27,00 | **R$ 331,05** |
| Pessimista | Tier grátis | R$ 19,50 | −1,37 | −27,00 | **−R$ 8,87** |
| Realista | Assinante | R$ 631,50 | −63,15 | −27,00 | **R$ 541,35** |
| Realista | Tier grátis | R$ 52,50 | −5,25 | −27,00 | **R$ 20,25** |
| Otimista | Assinante | R$ 1.024,50 | −138,31 | −27,00 | **R$ 859,19** |
| Otimista | Tier grátis | R$ 102,00 | −13,77 | −27,00 | **R$ 61,23** |

**No cenário Pessimista, um usuário do tier grátis dá prejuízo de R$8,87/mês** —
a infraestrutura custa mais do que ele gera. Qualquer comissão calculada sobre
receita bruta pagaria o parceiro por trazer prejuízo. Com base em margem, esse
indicado gera R$0 automaticamente, sem precisar de regra especial.

### A escada

| Nível | Indicados ativos | Alíquota | Equivalente em R$/lote (assinante, Realista) |
|---|---|---|---|
| Node | 1–4 | 15% | R$ 16,24 |
| Signal | 5–19 | 20% | R$ 21,65 |
| Core | 20–49 | 25% | R$ 27,07 |
| Prime | 50+ | 30% | R$ 32,48 |

O "equivalente em R$/lote" é o número que o parceiro compara com o mercado. A
Infinox Partners paga até US$20/lote, com faixa típica de US$4–8/lote para IB
novo sem volume — ~R$22–44 ao câmbio implícito da planilha (R$25/35/45 para
US$4/6/8). Nossos níveis Core e Prime ficam **dentro** dessa faixa; Node e
Signal ficam abaixo dela, mas o parceiro aqui não precisa ser IB registrado nem
trazer volume mínimo, e a alíquota incide também sobre a assinatura, não só
sobre a execução.

### O programa se paga?

Ponto de indiferença medido contra o Ano 1 do cenário Realista da planilha:

```
CAC total Ano 1                R$ 136.083
Margem de contribuição Ano 1   R$ 281.463   (receita 465.606 − infra 137.582 − imposto 46.561)
Indiferença = 136.083 / 281.463 = 48,3% da margem
```

Acima de 48,3%, indicar sairia mais caro que comprar tráfego. O teto da escada
é 30% — folga real de 18 pontos. Simulação do efeito agregado:

| % da base vinda de indicação | CAC economizado | Comissão paga (média 20%) | Saldo |
|---|---|---|---|
| 10% | R$ 13.608 | −R$ 5.629 | **+R$ 7.979** |
| 20% | R$ 27.217 | −R$ 11.259 | **+R$ 15.958** |
| 30% | R$ 40.825 | −R$ 16.888 | **+R$ 23.937** |
| 50% | R$ 68.042 | −R$ 28.146 | **+R$ 39.895** |

Com 30% da base vindo por indicação, o saldo (R$23.937) é **maior que o lucro
inteiro do Ano 1 projetado na planilha** (R$19.379). Isso conecta diretamente
com a alavanca nº1 do plano de lucro do Ano 1 ("migrar aquisição para
comunidade/indicação", `SESSAO_2026-08-10_MODELO_FINANCEIRO.md`): o programa de
parceiros é o mecanismo concreto dessa alavanca, que até agora só existia como
premissa na planilha.

### Ressalvas honestas — o que esses números NÃO provam

1. **O CAC de R$110 é meta, não medição** (pendência já registrada no doc do
   modelo financeiro). Se o CAC real de mídia paga for menor, a folga diminui;
   se for maior — comum em trading —, a indicação fica ainda mais vantajosa.
2. **Lotes/mês por usuário é premissa**, não dado de execução real. O runner
   24/7 só começou a rodar em produção nesta semana; quando houver histórico,
   recalibrar `ScenarioAssumptions`.
3. **O rebate IB de R$35/lote nunca foi negociado com a Infinox.** Continua
   sendo premissa de planejamento. Se a corretora oferecer menos, a receita por
   lote cai e a comissão do parceiro cai junto — automaticamente, porque é
   percentual da margem e não valor fixo. Essa é justamente a razão de publicar
   a regra em %, não em R$/lote fixo.
4. **A tabela acima trata CAC economizado como se 1 indicação = 1 cadastro pago
   a menos.** Na prática há canibalização: parte de quem vem por indicação
   viria de qualquer jeito. Não há como medir isso antes do lançamento.

## Decisões de produto tomadas nesta sessão

- **Nome do menu: "Parceiros IB"** (era "Parceiros"). Diferencia do módulo
  `modules/partners`, que é catálogo de empresas parceiras — coisa
  completamente diferente que dividia o mesmo nome. Alternativas consideradas:
  "Indicações", "Minha Rede", "Programa IB".
- **Rede de nível único.** Sem comissão sobre indicação-de-indicação. O painel
  da Infinox tem "Expand all levels" (multinível), mas remunerar recrutamento
  em vez de consumo é exatamente o que caracteriza pirâmide no Brasil (Lei
  1.521/51 art. 2º IX). O schema tem espaço para um 2º nível se um dia houver
  decisão jurídica formal, mas `PROGRAM_RULES.networkDepth = 1`.
- **Sem dado pessoal de terceiro no painel.** O painel da Infinox mostra
  e-mail e telefone completos dos indicados ao parceiro. Aqui o indicado
  aparece por ID público (`#A31F9C`) e estágio do funil. Depósito, saque e
  saldo do indicado não aparecem — não entram no cálculo da comissão e são dado
  financeiro pessoal.
- **Maturação de 30 dias** antes de liberar saque, porque o rebate da corretora
  chega com defasagem e pode ser glosado. Sem isso, a plataforma pagaria antes
  de receber.
- **Saque mínimo de R$100.**

## O que foi entregue (arquivos)

| Arquivo | O que é |
|---|---|
| `src/app/services/partners/CommissionModel.ts` | Modelo puro: escada, apuração, projeção, invariante. Zero dependência de React/Supabase. |
| `src/app/services/partners/__validate__.ts` | 33 asserções determinísticas. Registradas em `npm run validate`. |
| `src/app/services/partners/PartnerProgramService.ts` | Leitura do Supabase com estados explícitos. |
| `src/app/components/partners/PartnersIB.tsx` | Container + `PartnerDashboardView` (apresentação pura). |
| `src/app/components/partners/ReferralNetworkPanel.tsx` | Painel da rede — o equivalente ao anexo da Infinox. |
| `src/app/components/partners/ProgramExplainer.tsx` | Escada de níveis, simulador, regras. |
| `src/app/components/Partners.tsx` | Reduzido a fachada (`export { PartnersIB as Partners }`). |
| `supabase/migrations/20260818_partner_ib_program.sql` | Schema, RLS, triggers, view. **Não aplicada.** |

### Bugs encontrados e corrigidos na própria migration durante a revisão

Registrados porque cada um teria sido silencioso em produção:

1. **`UNIQUE (referral_id, period_start, reversal_of)` não impedia apuração
   duplicada** — no Postgres, NULLs são distintos entre si, então dois
   lançamentos normais (ambos com `reversal_of` NULL) passariam. Trocado por
   índice único **parcial** com `WHERE reversal_of IS NULL`.
2. **A view `partner_dashboard_summary` inflava todos os valores em dinheiro.**
   O `LEFT JOIN` de `partner_referrals` e `partner_commission_entries` no mesmo
   `FROM` produz produto cartesiano: `SUM(amount)` sairia multiplicado pelo
   número de indicados. Os `COUNT(DISTINCT)` mascaravam o erro nas contagens,
   deixando só o dinheiro errado. Reescrita com `LEFT JOIN LATERAL` separado.
3. **Trigger de proteção com `SECURITY DEFINER` deixava o campo desprotegido.**
   Com `SECURITY DEFINER`, `current_user` vira o dono da função, então a
   comparação com `'service_role'` nunca bateria. Passou para SECURITY INVOKER.
4. **`CHECK (abs(amount) <= margin_base)` impediria estornos.** Separado em duas
   restrições: valor positivo nunca excede a base; valor negativo só é aceito em
   linha de estorno.
5. **O cliente escolhia o próprio código de indicação.** Agora o `INSERT` vai
   sem código e um trigger `BEFORE INSERT` gera — fecha a porta para alguém
   reivindicar "NEURAL"/"OFICIAL" e para colisão por corrida.

Sintaxe do arquivo inteiro validada com `pglast` (o parser real do Postgres):
45 statements, zero erro.

## Verificação feita

- `npm run validate` — passa limpo (type-check do motor + todas as suítes,
  incluindo as 33 asserções novas).
- Tela renderizada e inspecionada em harness isolado (desktop 1600px e mobile
  375px): tabela, expansão da conta linha a linha, extrato, simulador, escada,
  funil. Sem overflow horizontal no mobile. Harness apagado depois.
- Serviço testado contra o Supabase **real**: retorna `NOT_PROVISIONED`
  corretamente (as tabelas ainda não existem), então a seção hoje mostra o
  aviso + simulador + regras, e não uma tela quebrada nem número inventado.

## Pendências reais em aberto

0. **Estado de deploy — ver "COMECE AQUI" no topo deste arquivo.**
   `20260818_partner_ib_program.sql` já foi aplicada e confirmada no banco.
   `20260818_broker_order_executions.sql` e o deploy da Edge Function `server`
   ainda faltam — sem os dois, o restante do programa fica construído mas
   sem gravar volume nenhum.
1. **B4 — o job de apuração mensal não existe.** É o que lê
   `broker_order_executions` (o ledger criado nesta sessão) por período, cruza
   com `partner_referrals` pra saber de quem é cada indicado, calcula com
   `computeCommission()` e insere em `partner_commission_entries`. Antes desta
   sessão essa pendência também dependia de resolver "de onde vem o volume" —
   isso já está resolvido; falta o job em si (Edge Function + `pg_cron`, no
   padrão do `ai-runner`). **Próximo passo obrigatório antes do programa
   funcionar de verdade.**
2. **B2 — a captura do `?ref=` no cadastro não foi implementada.** O link já é
   gerado e copiável, mas nada ainda lê o parâmetro no fluxo de registro
   (`AuthOverlay.tsx` → `POST /signup` em `server/index.ts`) para criar a linha
   em `partner_referrals`. Sem isso, ninguém entra na rede de ninguém.
3. **B3 — marcos do funil não são gravados.** `broker_linked_at`,
   `first_trade_at`, `subscribed_at` em `partner_referrals` continuam NULL
   sempre — precisam ser setados nos pontos onde cada evento acontece de
   verdade (conexão de conta, primeira ordem no ledger novo, assinatura paga).
4. **Termos do programa não existem como documento.** Um programa de comissão
   recorrente precisa de termos escritos (regras de estorno, suspensão por
   fraude, prazo de pagamento). Não redigidos.
5. **Retenção de imposto sobre o pagamento ao parceiro não modelada.** Pessoa
   física recebendo comissão recorrente tem implicação fiscal (IRRF/carnê-leão)
   que o modelo atual ignora — os R$X que o parceiro vê são brutos para ele.
   Conversa para o contador, não para a planilha.
6. **Marketplace ainda tem produtos com rating/vendas fabricados** (pendência
   antiga #4 do CLAUDE.md) — não tocada nesta sessão, mas é o mesmo tipo de
   problema que a seção de Parceiros tinha.
7. **Reconciliação do ledger contra o extrato oficial da corretora não
   existe.** `broker_order_executions` confia na resposta da MetaAPI no
   momento da ordem — não há verificação posterior cruzando com o relatório
   oficial da conta antes de pagar comissão sobre esse volume.
8. **Multi-corretora (pergunta 4 do Cleber) não implementado**, caminho
   sugerido na seção acima — `broker_credentials` e `CommissionModel` ainda
   assumem uma corretora só.

## Continuação — decisões do Cleber e implementação de B1 (mesma sessão)

Quatro perguntas do Cleber, respondidas com a conta por trás:

**1) O programa gera lucro ou só se paga?** Lucro, não empate. `margem` já é
receita líquida de imposto e custo de servir — é lucro *antes* de repartir com
o parceiro. Pagando o teto de 30%, sobra ≥70% de lucro incremental por
indicado/mês: no Realista/assinante, R$378,95 de lucro depois de pagar
R$162,41 de comissão sobre uma margem de R$541,35.

**2) Ilimitado/vitalício importa?** Não degrada nada, porque a divisão é
percentual FIXO por mês — não é um total acumulado com teto que poderia
"estourar" com o tempo. Cada mês em que o indicado gera margem, a plataforma
retém ≥70% *daquele mês*, independente de quantos meses já passaram. **Decisão:
comissão vitalícia**, igual ao modelo da Infinox. Implementado como
`PROGRAM_RULES.commissionDurationMonths: null`, com `CASO 8` do
`__validate__.ts` provando por simulação (mês 1 vs mês 120) que a retenção da
plataforma não muda com o tempo.

**3) Só link enviado.** Confirmado como único canal de atribuição — sem
anúncio, QR code ou cookie de terceiro. `PROGRAM_RULES.attributionChannel:
'REFERRAL_LINK_ONLY'`, travado no `CASO 9`. Textos da UI (`ProgramExplainer.tsx`)
atualizados para dizer isso explicitamente.

**4) Multi-corretora no futuro (a Infinox é concorrente, não parceira
estratégica).** A camada de conexão já é broker-agnostic na prática —
`InfinoxAdapter` chama o MetaAPI genérico, que funciona com qualquer servidor
MT5; existe até um `MT5Adapter` genérico ao lado. O que é hardcoded hoje:
`broker_credentials.user_id` é chave primária (1 corretora por usuário, não por
corretora), o catálogo de custo (`CostModel.ts`) é calibrado só pro catálogo da
Infinox, e `CommissionModel` tem uma única taxa de comissão/rebate, não uma por
corretora. Caminho sugerido, não implementado: tabela `brokers` (id, nome,
servidor MT5, taxas), `broker_credentials` ganha `broker_id` e vira 1 linha por
usuário×corretora, e `partner_commission_entries.assumptions` (já existe, jsonb)
passa a incluir `broker_id` na apuração — histórico não quebra quando a próxima
corretora entrar. O trabalho pesado por corretora nova é sempre o mesmo:
calibrar o catálogo de custo/`pointValue`, que levou uma sessão inteira só pra
Infinox.

### B1 implementado — e um achado que mudou o escopo original

Ao investigar de onde viria o volume real para a apuração, a resposta foi mais
séria do que "falta uma coluna": **hoje não existe nenhum registro durável de
lote executado de verdade em nenhum lugar do sistema.**

- `ai_trades.quantity` não é lote — é **capital em dólar** alocado no trade
  (`finalTradeCapital`, `runTradingCycle.ts:1215`). Sempre DEMO, execução
  virtual. Se algo tivesse usado esse campo como base de comissão, o parceiro
  teria recebido ~100.000× o correto (um trade real de XAUAUD conferido no
  banco tem `quantity = 1173.70`, que é US$1.173,70 de capital, não 1.173
  lotes).
- A execução automática real (Estágio 3, `useAutoExecutionStage.ts`) chama a
  corretora de verdade com `createMarketBuyOrder`/`createMarketSellOrder` e
  grava o resultado só em `useState` (`pushHistory`) — some ao fechar a aba.
- A boleta manual real (`OrderTicket.tsx`, branch fora de DEMO) chama a
  corretora e mostra um toast. Não persiste em lugar nenhum.

**Solução**: os dois pontos acima, e qualquer execução futura, passam por UM
único handler no servidor — `POST /broker/execute` em
`supabase/functions/server/index.ts`. É lá, com `service_role`, que a linha
agora é gravada, não no cliente. Isso fecha por construção o vetor de fraude
óbvio do programa (um indicado mal-intencionado se autodeclarando volume que
nunca operou): a linha só existe se a MetaAPI confirmou a ordem de verdade.

**Arquivos**:

| Arquivo | O que é |
|---|---|
| `supabase/migrations/20260818_broker_order_executions.sql` | Tabela append-only `broker_order_executions`. RLS: usuário só lê a própria linha; sem policy de escrita para `authenticated`/`anon` — só `service_role` grava. **Não aplicada.** |
| `supabase/functions/server/brokerExecutionLedger.ts` | `buildExecutionLedgerRow()` — função pura que decide se e como montar a linha (rejeita volume ≤0 e símbolo vazio antes de gastar uma viagem de rede). |
| `supabase/functions/server/index.ts` | Handler `/broker/execute` grava no ledger com `await` (não fire-and-forget — uma Edge Function pode encerrar o isolate assim que a resposta é enviada, e uma promise pendente se perderia sem log de erro) logo após confirmar a ordem com a MetaAPI, antes de responder ao cliente. |

**Escopo do que foi rastreado**: só as duas ações que abrem volume novo de
mercado (`createMarketBuyOrder`, `createMarketSellOrder`). Deliberadamente
fora de escopo, documentado na própria migration:
- Ordens pendentes (Limit/Stop) só entram quando disparam de verdade — isso
  exigiria webhook ou polling da MetaAPI, não implementado.
- Fechamento de posição não é registrado — o ledger é só o volume de ENTRADA,
  que já é o que a comissão de execução precisa (incide sobre volume
  negociado, não sobre P&L).
- Nenhuma reconciliação contra o extrato oficial da corretora ainda existe.

**Verificação**: 12 asserções puras no helper (`deno run` local, sem depender
de infra), `deno check` limpo no arquivo novo, sintaxe da migration validada
com `pglast` (o parser real do Postgres — 6 statements, zero erro), `npm run
validate` passa com as **37 asserções** do programa de parceiros (33 + 4 novas
dos casos 8 e 9 desta rodada).

### Isso muda a pendência B4 (job de apuração mensal)

`broker_order_executions` é o insumo de volume que faltava — B4 agora tem uma
fonte real pra ler em vez de precisar inventar uma. Ainda não implementado:
o job continua sendo trabalho novo (Edge Function + `pg_cron`, no padrão do
`ai-runner`), que lê este ledger por período, cruza com `partner_referrals`
pra saber de quem é cada indicado, calcula com `computeCommission()` e insere
em `partner_commission_entries`.

## Continuação — B1/deploy fechados e B4 implementado (mesma sessão, 2026-08-18)

**Estado de deploy, confirmado direto no banco/Supabase**:

| Item | Estado |
|---|---|
| `20260818_partner_ib_program.sql` | ✅ Aplicada |
| `20260818_broker_order_executions.sql` | ✅ Aplicada (confirmado: `to_regclass` resolve, RLS ligado, 1 policy, 2 índices) |
| Deploy da Edge Function `server` (handler `/broker/execute` novo) | ✅ Confirmado — v69, importa `buildExecutionLedgerRow` |
| Commit/push do trabalho de B1 | ✅ (`adbc0eadb`) |

**B4 — job de apuração mensal — escrito e deployado, NÃO agendado.**
`supabase/functions/partner-commission-accrual/index.ts`: lê
`broker_order_executions` do período (mês anterior por padrão, ou
`?period_start=YYYY-MM-01` pra reprocessar), cruza com `partner_referrals`,
calcula com `computeCommission()` importado direto de `CommissionModel.ts`
(mesmo princípio do `ai-runner` — motor puro, sem cópia), insere em
`partner_commission_entries` (idempotente: pula `referral_id` já apurado no
período em vez de usar upsert contra o índice parcial) e atualiza
`partner_accounts.tier` pelo nível calculado. Auth via `x-runner-secret` +
`PARTNER_ACCRUAL_SHARED_SECRET` (mesmo padrão do `ai-runner`), secret já
configurado via `supabase secrets set`. Deployado com `--no-verify-jwt`,
confirmado ACTIVE no Supabase (v1). **Verificado**: `deno check` limpo,
`npm run validate` limpo (37 asserções, sem regressão).

**Decisão desta sessão — por que o `pg_cron` NÃO foi agendado (SQL de exemplo
comentado no fim do arquivo, igual ao `ai-runner`)**: `execution_revenue` já é
real (vem do ledger), mas `subscription_revenue`/`marketplace_revenue` são
gravados como `0` de propósito — não existe hoje nenhuma tabela de
pagamento/assinatura persistida no projeto. Rodar a apuração agora geraria
comissão sistematicamente subavaliada; como `partner_commission_entries` é
append-only (correção é estorno, nunca `UPDATE`), isso significaria estornar
e reprocessar depois em vez de já nascer certo. **Decisão**: aguardar uma
fonte real de receita de assinatura antes de ligar o cron, ou decisão
explícita do Cleber de que "comissão só sobre execução" é aceitável pra v1.

**Pendência B4 revisada**: código pronto, só falta (1) fonte real de
`subscription_revenue`/`marketplace_revenue` — ou decisão de aceitar sem ela
— e (2) aplicar o `cron.schedule` comentado no fim do arquivo.

## Comandos prontos

Aplicar as duas migrations (SQL Editor do Supabase, projeto
`wyvdsxtcmizettljxtbg`, nesta ordem):
1. `supabase/migrations/20260818_partner_ib_program.sql`
2. `supabase/migrations/20260818_broker_order_executions.sql`

Deploy da Edge Function `server` (o handler `/broker/execute` mudou):

```bash
supabase functions deploy server
```

Commit:

```bash
git add src/app/services/partners src/app/components/partners src/app/components/Partners.tsx src/app/components/Sidebar.tsx supabase/migrations/20260818_partner_ib_program.sql supabase/migrations/20260818_broker_order_executions.sql supabase/functions/server/index.ts supabase/functions/server/brokerExecutionLedger.ts scripts/validate.mjs tsconfig.engine.json SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md CLAUDE.md
git commit -m "feat: reconstrói seção de Parceiros como programa IB com modelo econômico real

A seção era 100% maquete: indicados fictícios, US\$1.250 de comissão
fabricada, gráfico com dados fixos no código e níveis (Officer/Commander)
sem nenhum modelo por trás. Nenhuma tabela existia no banco.

Modelo novo: comissão = alíquota do nível x margem de contribuição do
indicado (receita - imposto - custo de servir), escada de 15/20/25/30%,
vitalícia. Base em margem, não receita bruta, torna impossível por
construção pagar mais do que se recebe - a plataforma retém >=70% em
qualquer cenário, mês 1 ou mês 120. Calibrado contra os 3 cenários da
planilha de 5 anos: o teto de 30% fica bem abaixo do ponto de indiferença
de 48,3% em que indicar sairia mais caro que a mídia paga que substitui.
Atribuição só por link enviado pelo parceiro.

Inclui schema append-only (correção é estorno, nunca UPDATE - mesma regra
do incidente de ai_trades), RLS, painel de rede sem dado pessoal de
terceiro, extrato auditável linha a linha e simulador declarado como
projeção.

Ledger novo (broker_order_executions): ao investigar de onde viria o
volume real pra apurar comissão, achamos que não existia NENHUM registro
durável de lote executado de verdade em lugar nenhum do sistema - a
execução automática real (Estágio 3) e a boleta manual real chamavam a
corretora e não persistiam nada. Gravação movida pro servidor
(/broker/execute, service_role), não pro cliente, fechando o vetor óbvio
de fraude do programa (indicado se autodeclarando volume que nunca
operou).

37 asserções no gate de commit travam a invariante do programa + o helper
do ledger.

Nome do menu: Parceiros -> Parceiros IB.

Migrations NÃO aplicadas - rodam no SQL Editor. Edge Function precisa de
deploy manual (supabase functions deploy server)."
git push origin dev
```
