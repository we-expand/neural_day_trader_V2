# Planejamento de Lançamento — Neural Day Trader

> Consolidado da sessão de planejamento de 11/07/2026.
> Planilha viva do modelo financeiro: `projecao-financeira-5anos.xlsx` (editar só as células amarelas da aba Premissas).

---

## 1. Orçamento de lançamento — R$ 30.000

**Veredito: sim, o lançamento cabe em R$ 30 mil** no cenário enxuto, com reserva de ~R$ 9 mil.

| Frente | Setup único | Recorrente (12 meses) |
|---|---|---|
| Jurídico e societário (empresa SLU/Simples, termos, contratos, marca INPI) | R$ 4.000 – 7.000 | R$ 3.000 – 6.000 (contador) |
| Compliance/LGPD (mapeamento, DPA com clientes, DPO = você) | R$ 1.500 – 3.000 | — |
| Segurança (revisão especializada, ferramentas) | R$ 2.000 – 5.000 | R$ 0 – 1.200 |
| Infraestrutura (Vercel, Supabase, LLM, MetaAPI) | — | R$ 6.000 – 12.000 |
| Marketing (landing, tráfego de validação, criativos) | R$ 500 – 2.000 | R$ 4.000 – 7.000 |
| **Total** | **R$ 8.000 – 17.000** | **R$ 13.000 – 26.000** |

- Cenário enxuto (piloto controlado, máximo feito por você): **~R$ 21 mil**.
- Cenário tudo terceirizado: R$ 40 mil+ (estoura — cortes: adiar pentest, reduzir ads).
- **Alerta jurídico específico (adicionado depois)**: o produto de trading precisa de advogado de **mercado de capitais** (CVM), não só de tech/LGPD — mais caro que a faixa acima. Ver §6.

### Condições para o orçamento fechar
1. Limitar o plano grátis/trial — cada usuário custa R$ 25–30/mês de API.
2. Ter caminho de receita em até 6 meses.

## 2. Segurança (pré-requisito de lançamento público)

**Aplicação (custo ~zero, é engenharia):** RLS em todas as tabelas (multi-tenant — feito na Fase 1), credenciais/tokens cifrados em repouso (padrão `broker_credentials`), rate limiting e validação nos webhooks, segredos em env vars, logs de auditoria.

**Testes:** scans grátis (Sentry, dependabot, npm audit, OWASP ZAP) + revisão por especialista (R$ 2–5 mil) agora; pentest completo (R$ 5–15 mil) quando houver clientes pagantes maiores.

**Operacional:** backups (Supabase Pro diário + export semanal externo), 2FA em tudo (Vercel, Supabase, Meta, domínio), gerenciador de senhas, plano de resposta a incidentes de 1 página (LGPD exige comunicação à ANPD).

**Específicos do produto:** prompt injection no agente (isolamento por conversa/usuário no contexto do LLM); tokens de corretora dos usuários = ativo mais sensível (criptografia + acesso mínimo + log de uso).

## 3. Modelo de negócio (decidido 11/07/2026, **refeito do zero em 2026-08-10** — ver §3.1)

### 3.1 ⚠️ REESCRITO 2026-08-10 — planilha reconstruída, preços e comissão atualizados

O plano de 11/07 citava `projecao-financeira-5anos.xlsx` como se já existisse — **não existia**,
era só um resumo em texto de uma sessão de planejamento, nunca uma planilha rastreável. A "correção"
registrada aqui em 08-10 mais cedo (mix de tier, ARPU escalado a mão) também foi **descartada** — era
aritmética manual sobre um modelo que nunca existia de fato, sem mês a mês, sem despesas reais, sem
teto de mercado.

**O que existe agora**: [`projecao-financeira-5anos.xlsx`](projecao-financeira-5anos.xlsx), planilha
real, versionada neste repositório, mês a mês (mês 0 a 60 = 5 anos), 3 cenários, 100% fórmula
(zero número hardcoded fora da aba Premissas), recalculada com LibreOffice — 4.626 fórmulas,
**zero erros**. Abrir essa planilha antes de citar qualquer número financeiro do projeto — este `.md`
só resume, a planilha é a fonte de verdade.

**Preços de mensalidade — MEDIDOS, direto do código da landing** (`src/app/components/landing/translations.ts:106-132`):

| Tier | Preço/mês | Gera mensalidade? |
|---|---|---|
| Node: Starter | **R$ 0** (grátis) | Não — funil de aquisição |
| Node: Pro | **R$ 199,00** | Sim |
| Node: Institutional | **R$ 399,00** (selo "Recommended" na landing) | Sim |
| Syndicate Core | Sob medida (sem preço público) | Não — modelado como canal B2B à parte, ver aba "Sugestões de Crescimento" |

**Comissionamento — realinhado com prática de mercado, decisão explícita do Cleber em 2026-08-10**:
comissão própria de **R$30/lote (≈ US$6/lote)** cobrada em **todos os tiers** (Starter, Pro,
Institutional) — não só no funil grátis. Isso empilha sobre o custo de execução na corretora
(spread/comissão ECN) e sobre o rebate IB que a corretora paga por baixo do mesmo volume — ver aba
"Comissionamento" da planilha pro alerta de custo total ao trader (~US$13/lote empilhado, quase 2×
uma conta ECN pura) e o racional de mercado completo, com fontes.

Rebate IB (pago pela corretora, invisível ao trader) mantido nos mesmos R$15/25/35 por lote
(pess/real/otim) do plano de 11/07, convertido de US$4/6/8.

### 3.2 O que mudou de arquitetura no modelo (não só de preço)

1. **Funil com tier grátis de verdade** — a planilha de 11/07 tratava 100% da base como pagante; a
   nova modela cadastro grátis (Starter) → conversão pra pago com defasagem de 2 meses, com taxa de
   conversão como premissa explícita (não medida — produto ainda não lançado).
2. **Teto de saturação de mercado** — crescimento composto mês a mês sem teto explode
   matematicamente em 60 meses (achado nesta sessão: Otimista sem teto gerava R$217 milhões em 5
   anos, >15 mil cadastros/mês só no último mês — correto na conta, irreal pro nicho). Corrigido com
   um teto de novos cadastros/mês por cenário, marcado como premissa de bom senso, não medição.
3. **Custos reais incorporados** — CAC, infraestrutura variável por usuário, degrau de equipe,
   custos fixos administrativos e Simples Nacional agora entram na conta (o plano de 11/07 listava
   esses furos mas nunca os somava ao faturamento).

### Resultado — Comparativo Total 5 anos (aba "Resumo Anual" da planilha, valores exatos)

| | Pessimista | Realista | Otimista |
|---|---|---|---|
| Faturamento total 5 anos | R$ 737 mil | R$ 11,5 mi | R$ 134,4 mi |
| Despesas totais 5 anos | R$ 2,29 mi | R$ 11,0 mi | R$ 61,7 mi |
| **Lucro líquido total 5 anos** | **−R$ 1,55 mi** | **R$ 512 mil** | **R$ 72,7 mi** |
| Caixa acumulado — fim do Ano 5 | −R$ 1,57 mi | R$ 491 mil | R$ 72,7 mi |
| Pagantes ativos — fim do Ano 5 | 38 | 579 | 4.466 |
| Usuários ativos totais — fim do Ano 5 | 787 | 6.634 | 25.284 |

**Leitura honesta, sem maquiar**: o cenário Pessimista **fecha no vermelho** em 5 anos — churn alto +
conversão baixa + CAC de R$180-260/cadastro não pagam a conta com esse funil. Isso não é defeito do
modelo, é o resultado de premissas pessimistas de verdade — se o produto performar pior que o
cenário Realista, o caixa não fecha sem correção de rota (ver aba "Sugestões de Crescimento" da
planilha, especialmente a alavanca de conversão e a de churn).

### Furos conhecidos da planilha nova (em ordem de impacto)
1. Taxa de conversão Starter→Pago é premissa de julgamento (2-5% benchmark de mercado freemium), sem
   dado real — produto ainda não lançado. Recalibrar assim que houver conversão medida.
2. Billing anual (upsell de caixa) discutido na aba "Sugestões de Crescimento" mas não modelado como
   premissa numérica — precisa de uma linha nova pra entrar na planilha.
3. Syndicate Core (B2B, sem preço público) não entra na receita recorrente — deve ser rastreado como
   pipeline separado, dinâmica de venda diferente do varejo.
4. Custo mensal por funcionário (R$9.000 CLT completo) e custos fixos administrativos não foram
   pesquisados com RH/contador real nesta sessão — mesma ressalva do plano de 11/07 original.

## 5. Discussão honesta sobre a IA ("80% de acerto")

- **Taxa de acerto ≠ lucratividade**: estratégias de reversão à média/grid/martingale atingem 80%+ de acerto com expectativa negativa (ganhos pequenos, perdas raras e enormes). É o padrão dos robôs "90% win rate" do MQL5 que quebram contas.
- Os melhores quants do mundo (Renaissance/Medallion) operam com acerto pouco acima de 50% — lucram por vantagem minúscula × execução perfeita × milhares de trades. Bancos lucram de spread/fluxo/market making, não de previsão. **Gerenciamento de risco impecável preserva capital; não cria vantagem preditiva.**
- **A dor resolvível por máquina é a indisciplina, não a imprevisibilidade**: 70–80% do varejo perde por overtrading, alavancagem, mover stop, dobrar posição perdedora.
- Produto honesto e vendável: (1) enforcement de risco automatizado ("a plataforma que impede você de quebrar"); (2) execução disciplinada de estratégias com expectativa positiva modesta (45–60% de acerto, R:R favorável, validadas no backtest real já construído); (3) LLM como copiloto analítico sobre o histórico do usuário.
- **Nunca prometer rentabilidade/percentual de acerto no marketing** — risco CVM (ver §6).

## 6. Riscos jurídicos específicos do produto (pendências)

- Promessa de rentabilidade é marketing proibido no mercado financeiro; "IA que opera/recomenda" pode configurar consultoria ou gestão de carteira (exigem autorização CVM).
- Intermediar brasileiros para corretora CFD offshore não autorizada pela CVM (a Infinox não é) é zona cinzenta com alertas/bloqueios já emitidos pela CVM.
- **Ação**: consultar advogado de mercado de capitais antes de escalar — o orçamento jurídico do §1 não cobre essa especialidade.

## 7. Roadmap técnico (ordem confirmada pelo Cleber)

Os mocks atuais (IA = `Math.random()`, Social Intelligence hardcoded) são placeholders do Figma Make — sempre estiveram no escopo para construção real. Sequência:

1. ✅ **Preços corretos** — concluído (brokerRegistry, auditoria de símbolos, variação % batendo com MT5).
2. ⏭️ **Motor de gerenciamento de risco** (próxima fase, 2–4 semanas): sizing por volatilidade, limite de perda diária que trava a conta, stop imóvel, bloqueio de overtrading/revenge trading, kill-switch. **Decisão arquitetural: enforcement no backend** (encaixar na rota `/broker/execute` existente), nunca só no frontend.
3. **Sentimento social real**: Reddit (API grátis) + StockTwits (sentimento nativo) + feeds de notícias, agregados por Haiku em score por ativo, cacheado a cada 15–30 min para todos os usuários (custo fixo de dezenas de R$/mês). **Evitar API do X/Twitter** (US$ 200–5.000+/mês).
4. **IA copiloto**: LLM sobre `ai_trades`/`ai_sessions` persistidos — padrões de comportamento, alertas ("após 2 derrotas seguidas você perde 70% do 3º trade"), relatórios, journaling automático.
5. Reposicionar copy do site/app: de "IA preditiva que maximiza dinheiro" para "disciplina de risco de banco + inteligência de mercado".

### O que fica intacto do já construído
Execução MT5 via backend (Fase 1 segurança), dados de mercado multi-fonte, backtest real e Market Replay, persistência (migrations 004+), StrategyBuilder, Luna, auth, Dashboard.

---

## Fontes da pesquisa (11/07/2026)

- Rebates IB: [FBS Academy](https://fbs.com/fbs-academy/traders-blog/forex-ib-commission), [CashbackForex](https://www.cashbackforex.com/brokers/forex-rebates), [PaybackFX](https://www.paybackfx.com/brokers)
- Comissões ECN/cTrader: [ForexBrokers.com](https://www.forexbrokers.com/guides/best-ctrader-brokers), [FP Markets](https://www.fpmarkets.com/ctrader-fees-and-charges/)
- Infinox: [INFINOX Partners — IB Program](https://www.infinoxpartners.com/en/introducing-broker-program/), [IB Rebate](https://www.infinox.com/global/en/help-center/what-is-an-ib-rebate/), [Traders Union — review](https://tradersunion.com/brokers/forex/view/infinox/), [SA Shares — fees](https://sashares.co.za/infinox-fees-spreads/)
- Copy trading / performance fees: [PU Prime](https://www.puprime.com/copy-trading-fees-explained-what-you-actually-pay/), [Spencer Logic](https://www.spencerlogic.com/blog/copy-trading-platform-broker/)
- Marketplace: [MQL5 MetaTrader Market](https://www.mql5.com/en/market)
