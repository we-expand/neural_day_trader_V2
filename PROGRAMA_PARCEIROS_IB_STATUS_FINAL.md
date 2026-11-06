# Programa de Parceiros IB — Status Final (2026-08-18)

> Sessão de conclusão: B1/B2/B3/B4 implementados e deployados. Programa pronto pro lançamento.

## ✅ Estado Atual

| Frente | Commits | Status |
|---|---|---|
| **B1** — Ledger de execução + migrations | `adbc0eadb` | ✅ Completo |
| **B2** — Captura `?ref=` → partner_referrals | `db55812a6` | ✅ Completo |
| **B3** — Marcos de funil gravados | `748923b99` | ✅ Completo |
| **B4** — Job apuração mensal agendado | `fac23178b` | ✅ Completo |
| **Documentação** | `6221e61f7` | ✅ Completo |

---

## O que Funciona Agora

✅ **Geração de link de parceiro**
- Código gerado automaticamente no cadastro (vitalício, imutável)
- Copiável no painel "Parceiros IB"

✅ **Atribuição de indicados**
- Link com `?ref=CODE` cria indicado na rede automaticamente
- Validação que o código existe
- Fallback gracioso se falhar (usuário criado mesmo assim)

✅ **Marcos de funil**
- `broker_linked_at` — gravado quando conecta corretora (POST /broker/credentials)
- `first_trade_at` — gravado na primeira ordem executada (POST /broker/execute)

✅ **Apuração de comissão**
- Job roda **dia 1 de cada mês, às 04:00 UTC**
- Lê volume real de `broker_order_executions`
- Calcula: alíquota × margem de contribuição
- Insere em `partner_commission_entries` (append-only, correção via estorno)
- Atualiza tier do parceiro

✅ **Modelo econômico**
- 37 asserções travadas no `npm run validate`
- Retenção ≥70% garantida por construção
- Impossível pagar mais do que se recebe
- Cenários: Node (15%), Signal (20%), Core (25%), Prime (30%)

✅ **Auditoria**
- Extrato linha a linha em `partner_commission_entries`
- Ledger de execução em `broker_order_executions` (imutável, gravado só no servidor)
- Sem dado pessoal de terceiro exposto no painel

---

## Onde Monitorar/Alterar

### Ver agendamento do job B4

**SQL Editor do Supabase:**

```sql
SELECT * FROM cron.job WHERE jobname = 'partner-commission-accrual-monthly';
```

Resultado esperado: `schedule: 4` (ID do job)

### Alterar horário ou frequência

```sql
-- Deletar o atual
SELECT cron.unschedule('partner-commission-accrual-monthly');

-- Criar com novo agendamento (exemplo: 02:00 UTC)
SELECT cron.schedule(
  'partner-commission-accrual-monthly',
  '0 2 1 * *',  -- mude aqui
  $$
  SELECT net.http_post(
    url := 'https://wyvdsxtcmizettljxtbg.supabase.co/functions/v1/partner-commission-accrual',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-runner-secret', 'PARTNER_ACCRUAL_SHARED_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Deletar o job (se precisar)

```sql
SELECT cron.unschedule('partner-commission-accrual-monthly');
```

---

## Único Item Não-Implementado

⏸️ **`subscribed_at`** em `partner_referrals`

**Motivo:** Requer sistema de pagamento/assinatura (não existe no projeto ainda).

**Quando implementar:** Quando houver tabela de pagamento/assinatura persistida, adicionar lógica no endpoint que processa o pagamento pra gravar `subscribed_at`.

**Impacto:** Comissão hoje é só sobre execução (volume em `broker_order_executions`). Indicado que assina mas não executa = R$0 de comissão pro parceiro. Esse é o escopo v1 aceito explicitamente (Cleber, 2026-08-18).

---

## Decisões de Produto Tomadas (v1)

1. **"Comissão só sobre execução"** — subscription_revenue/marketplace_revenue como 0 enquanto não existir fonte real
2. **Rede de nível único** — sem remuneração por indicação-de-indicação
3. **Sem dado pessoal de terceiro** — indicados aparecem por ID público + estágio do funil (depósito/saque/saldo não aparecem)
4. **Atribuição só por link** — sem anúncio, QR code ou cookie de terceiro
5. **Comissão vitalícia** — ilimitada no tempo, retenção da plataforma nunca muda com o tempo

---

## Arquivo de Referência

Para histórico completo, ver:
- [SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md](SESSAO_2026-08-18_PROGRAMA_PARCEIROS_IB.md) — Investigação, decisões de design, bugs encontrados/corrigidos
- [src/app/services/partners/CommissionModel.ts](src/app/services/partners/CommissionModel.ts) — Modelo puro (escada, apuração, invariantes)
- [supabase/functions/partner-commission-accrual/index.ts](supabase/functions/partner-commission-accrual/index.ts) — Job de apuração

---

## Próximas Sessões (Backlog)

1. Termos do programa (redação jurídica: regras de estorno, suspensão, prazo de pagamento)
2. Retenção de imposto (IRRF/carnê-leão pra pessoa física recebendo comissão)
3. Reconciliação contra extrato oficial da corretora
4. Multi-corretora (caminho já mapeado, não implementado)
5. Sistema de pagamento/assinatura (desbloqueador de `subscribed_at`)

---

**Data:** 2026-08-18  
**Status:** ✅ PRONTO PRO LANÇAMENTO
