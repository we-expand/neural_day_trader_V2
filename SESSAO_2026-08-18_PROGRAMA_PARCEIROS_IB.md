# Sessão 2026-08-18 — Programa de Parceiros IB (reconstrução completa)

> Handoff da reconstrução da seção "Parceiros" do app. Não é sobre o cérebro de
> decisão (isso continua em [NEXT_SESSION.md](NEXT_SESSION.md)). Leia este
> arquivo antes de mexer em comissionamento, níveis de parceiro ou nas tabelas
> `partner_*`.

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

1. **A migration não foi aplicada** — comando na seção abaixo. Enquanto não
   for, a seção mostra o estado "não provisionado".
2. **O job de apuração mensal não existe.** É o que transforma volume operado em
   lançamento de comissão (Edge Function + `pg_cron`). Depende de uma fonte de
   volume real POR USUÁRIO — hoje o volume só existe agregado na conta de
   plataforma da MetaAPI, que é compartilhada entre todos os usuários (risco
   crônico já registrado no CLAUDE.md). **Este é o próximo passo obrigatório
   antes do programa funcionar de verdade**, e não é pequeno.
3. **A captura do `?ref=` no cadastro não foi implementada.** O link já é
   gerado e copiável, mas nada ainda lê o parâmetro no fluxo de registro para
   criar a linha em `partner_referrals`. Sem isso, ninguém entra na rede de
   ninguém.
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

## Comandos prontos

Aplicar a migration (SQL Editor do Supabase, projeto `wyvdsxtcmizettljxtbg`) —
copiar o conteúdo de `supabase/migrations/20260818_partner_ib_program.sql`.

Commit:

```bash
git add src/app/services/partners src/app/components/partners src/app/components/Partners.tsx src/app/components/Sidebar.tsx supabase/migrations/20260818_partner_ib_program.sql scripts/validate.mjs tsconfig.engine.json SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md
git commit -m "feat: reconstrói seção de Parceiros como programa IB com modelo econômico real

A seção era 100% maquete: indicados fictícios, US\$1.250 de comissão
fabricada, gráfico com dados fixos no código e níveis (Officer/Commander)
sem nenhum modelo por trás. Nenhuma tabela existia no banco.

Modelo novo: comissão = alíquota do nível x margem de contribuição do
indicado (receita - imposto - custo de servir), escada de 15/20/25/30%.
Base em margem, não receita bruta, torna impossível por construção pagar
mais do que se recebe - a plataforma retém >=70% em qualquer cenário.
Calibrado contra os 3 cenários da planilha de 5 anos: o teto de 30% fica
bem abaixo do ponto de indiferença de 48,3% em que indicar sairia mais
caro que a mídia paga que substitui.

Inclui schema append-only (correção é estorno, nunca UPDATE - mesma regra
do incidente de ai_trades), RLS, painel de rede sem dado pessoal de
terceiro, extrato auditável linha a linha e simulador declarado como
projeção. 33 asserções novas no gate de commit travam a invariante.

Nome do menu: Parceiros -> Parceiros IB.

Migration NÃO aplicada - roda no SQL Editor."
git push origin dev
```
