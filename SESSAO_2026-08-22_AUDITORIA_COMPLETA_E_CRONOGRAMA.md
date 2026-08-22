# Auditoria técnica — Neural Day Trader (2026-08-22)

> O que falta pra tirar da manutenção: levantamento do estado real da
> plataforma — código, banco, segurança e cérebro de decisão — com
> cronograma faseado até um lançamento defensável.

**Data**: 22 ago 2026 · **Branch auditada**: `dev` · **Projeto Supabase**:
`wyvdsxtcmizettljxtbg` · **Gate de motor**: `npm run validate` — 37/37 OK

Versão visual (mesmo conteúdo, formatado): https://claude.ai/code/artifact/98436805-1236-47e8-b808-ca0a2f15a6f0

---

## Leitura direta

Não dá pra prometer uma data. Dá pra prometer um caminho.

A parte de **engenharia pura** — aplicar migration pendente, fechar
segurança, terminar B4 do programa de parceiros, arrumar loose ends de UI
— é semanas, não meses. O esforço estimado por fase está na seção 5.

O que não tem ETA técnico é o resto: (1) o cérebro de decisão não tem edge
estatístico comprovado até hoje — "testar exaustivamente" não é um
checklist que se conclui, é validação contínua que só fica mais confiável
com mais tempo real decorrido; e (2) operar dinheiro de terceiro é uma
decisão regulatória/de negócio do Cleber, não uma tarefa de código. Um
cronograma que finge saber a data disso seria exatamente o tipo de número
inflado que a convenção deste projeto proíbe.

---

## 1 — Estado real: o que já funciona de verdade

| Área | Status | Nota |
|---|---|---|
| Autenticação & segurança | ✅ Sólido | RLS ativo em todas as tabelas de negócio, token MetaAPI criptografado, bug de `mockLogin` sobrescrevendo sessão corrigido. |
| Persistência (Fase 2) | ✅ Sólido | Sessões, trades e snapshots de portfólio em DEMO persistem no Supabase com trilha de auditoria em `ai_trades`. |
| Execução real (Fase 3) | ⚠️ Funcional, pouco testado | 4 estágios opt-in (alerta → confirmação → automático → tamanho real) implementados, todos desligados por padrão. Nunca rodou com fluxo real de usuário pagante. |
| Pipeline de preço | ✅ Corrigido recentemente | Guard de desvio máximo (8%/20%) e TTL de cache adicionados em 21/08, depois de um trade corrompido virar prejuízo de $3.810. Em produção, sem amostra suficiente ainda pra calibrar os limiares. |
| Cérebro de decisão | ❌ Sem edge comprovado | Busca sistemática (5 presets, dezenas de combinações ativo×timeframe, correção estatística DSR) não achou edge técnico. Produto é disciplina de execução, EV por trade ≈ −custo. |
| Programa de Parceiros (IB) | ⚠️ B1–B3 prontos, B4 falta | Modelo de comissão vitalícia validado por 37 asserções determinísticas. Falta aplicar a migration do cron de apuração. |

---

## 2 — Achados desta auditoria

### Histórico de migration está incompleto no Supabase

`list_migrations` no projeto mostra só **5 migrations** registradas
oficialmente (`001`, `20240101000000`, `20260721132332`, `009_ai_decisions`,
`010_dev_lab_suggestions`), enquanto o repositório tem **~25 arquivos** em
`supabase/migrations/`. Consistente com o workflow do projeto (Claude nunca
aplica migration — Cleber roda o SQL direto no SQL Editor, o que não
popula a tabela de histórico do CLI). Não é um bug ativo, mas é um risco
real: hoje não existe uma forma confiável de recriar o schema de produção
do zero só a partir do histórico de migrations rastreado. Vale considerar,
antes do lançamento, alinhar o histórico (via `supabase migration repair`
ou equivalente) pra que o schema seja reproduzível.

### Advisories de segurança do Supabase — nada crítico, mas vale revisar antes de abrir ao público

| Achado | Severidade | Nota |
|---|---|---|
| `broker_credentials` com RLS ativo e **zero policy** | Info | RLS sem policy bloqueia tudo por padrão via API pública — não é vazamento, mas confirmar que só a Edge Function (service role) acessa mesmo, como o CLAUDE.md descreve. |
| `generate_referral_code()` e `log_ai_trades_update()` são `SECURITY DEFINER` executáveis por `anon`/`authenticated` | Warn | Provavelmente intencional (geração de código de indicação, trigger de auditoria), mas nunca foi revisado explicitamente como decisão de segurança. |
| Extensões `pg_net`, `pg_trgm`, `vector` instaladas no schema `public` | Warn | Boa prática é mover pra schema dedicado; risco baixo isoladamente. |
| Proteção de senha vazada (HaveIBeenPwned) desligada | Warn | Ativar antes de abrir cadastro ao público — 1 clique no painel de Auth. |
| Poucas opções de MFA habilitadas | Warn | Relevante quando a plataforma passar a mexer com dinheiro real do usuário. |

---

## 3 — O gargalo real: por que "cérebro validado" não é uma tarefa com fim

A pergunta natural é "quanto tempo de teste exaustivo do cérebro falta".
A resposta honesta, dado o que já foi medido:

- **Já foi testado sistematicamente** — 5 presets, múltiplas cestas de
  ativos, múltiplos timeframes, dezenas de sub-investigações, com correção
  estatística por múltiplos testes (DSR). Resultado: **nenhum edge técnico
  comprovado** sobre as 135 combinações testadas. Isso é consistente com
  mercado eficiente pra indicador técnico clássico, não falta de esforço.
- A decisão de produto já tomada por causa disso: o cérebro é de
  **execução e disciplina**, não de alfa. Rodar mais backtests do mesmo
  tipo não vai mudar essa conclusão — só re-confirmá-la ou, na pior
  hipótese, gerar um falso positivo por p-hacking se repetido sem
  disciplina estatística nova.
- O que ainda está genuinamente pendente de validação é **infraestrutura
  nova rodando ao vivo**: o guard de desvio de preço (dados desde 21/08) e
  o scorecard de performance por ativo (rodando desde 21/08, efeito
  desligado por enquanto). Os dois precisam de **semanas de dado real
  acumulando** antes de qualquer decisão de calibração — não é algo que se
  acelera com mais horas de trabalho de código.

> **Conclusão prática**: "testar exaustivamente o cérebro" antes de
> lançar não deveria significar buscar mais edge (já demonstrado que não
> há, com rigor estatístico). Deveria significar: (a) meta de trades/dia
> realista fixada por decisão do Cleber — hoje o teto medido é ~2-6/dia,
> não os ~10/dia assumidos originalmente sem medição — e (b) validação de
> robustez operacional (feed cair, gap de preço, MetaAPI der rate-limit,
> cliente e servidor divergirem) em vez de validação de lucratividade, que
> já foi feita.

---

## 4 — Pendências reais (lista consolidada, sem inflar)

1. **Decisão de meta de trades/dia revisada** — pendente do Cleber, teto
   real medido é 2-6/dia.
2. **Aplicar migration do gate de notícias**
   (`20260821_add_news_gate_veto_stage.sql`) e redeploy do `ai-runner
   --no-verify-jwt` — sem isso o fix de notícias/VIX não está em produção.
3. **B4 do Programa de Parceiros** — job de apuração escrito e deployado,
   falta só aplicar a migration do cron
   (`20260818_schedule_partner_commission_accrual.sql`) com secret real.
4. **Decisão de roteamento de cripto** — manter Binance direto (exceto
   BTCUSD) ou mover tudo pra MetaAPI. Nenhuma linha de código escrita
   ainda, esperando resposta.
5. **Dado fabricado no Marketplace** — rating/reviews/vendas ainda
   fictícios em vários produtos do catálogo (só o pior caso foi removido).
6. **Risco estrutural cliente/servidor duplicado em LIVE** — resolvido em
   DEMO (Safe Mode morto no client), mas em execução real ainda existem
   duas autoridades fechando posição de forma independente. Sem decisão de
   arquitetura ainda.
7. **Financeiro (CAC, conversão, rebate)** — planilha reconstruída e
   correta, mas esses três números continuam sendo meta, não medição real.
8. **Higiene de segurança do Supabase** — ativar proteção de senha
   vazada, revisar as duas funções `SECURITY DEFINER` expostas, mover
   extensões pra fora do `public`.
9. **Código morto** — pipelines de preço antigos concorrentes ainda no
   repo, não removidos (não bloqueante, mas atrapalha auditoria futura).

---

## 5 — Cronograma: fases até um lançamento defensável

Estimativas de esforço de engenharia focado, assumindo trabalho contínuo.
Não inclui tempo de decisão do Cleber nem qualquer prazo regulatório —
esses dois fatores dominam o calendário real e não têm ETA técnico.

### Fase A — Fechar dívida técnica conhecida
**~1–2 semanas de engenharia**

Aplicar as 2 migrations pendentes (gate de notícias, cron do IB), redeploy
do `ai-runner`, resolver os 5 achados de segurança do Supabase, decidir e
implementar roteamento de cripto, remover dado fabricado do Marketplace.

### Fase B — Acumular e revisar dado real do motor
**2–4 semanas correndo em paralelo, com poucas horas de código**

Deixar guard de preço e scorecard de performance por ativo rodando em
produção sem mexer, coletar amostra suficiente, então repetir o
proxy-backtest do scorecard e recalibrar os limiares do guard
(8%/20%/10min/5min hoje são estimativa de mercado, não medição própria).

### Fase C — Testes de robustez operacional (não de lucratividade)
**~1–2 semanas de engenharia**

Simular queda de feed, gap de preço, rate-limit da MetaAPI, divergência
client/servidor em LIVE. Fechar a decisão de arquitetura sobre quem tem
autoridade pra fechar posição. QA manual completo do fluxo ponta a ponta:
cadastro → depósito mínimo $50 → onboarding → primeira operação →
indicação via link de parceiro.

### Fase D — Preparação de lançamento
**Sem ETA técnico — depende do Cleber e de terceiros**

Decisão final de meta de trades/dia. Sair da manutenção (`main`) só depois
de tudo acima. Due diligence regulatória de operar execução real de
dinheiro de terceiro (fora do escopo de engenharia) — este é o item que
historicamente domina o calendário de produtos como este, e nenhuma
auditoria de código consegue estimar o tempo dele.

> **Resposta direta à pergunta "quanto tempo falta"**: a parte que dá pra
> fechar sozinho, como código — Fases A e C — é da ordem de **3 a 4
> semanas de trabalho focado**. Fase B corre em paralelo e não acelera com
> mais esforço, só com tempo de mercado passando. Fase D não tem número
> honesto pra dar hoje.

---

*Relatório gerado a partir de leitura do código-fonte, gate de validação
(`npm run validate`), advisories de segurança do Supabase e histórico de
sessões documentado no repositório (`CLAUDE.md` / `CLAUDE_HISTORY.md`).
Nenhum dado de mercado, valor financeiro ou resultado de backtest foi
fabricado ou estimado sem fonte — onde a informação não existe, está
marcado como pendente acima.*
