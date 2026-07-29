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

## 3. Modelo de negócio final (decidido 11/07/2026)

**Espelhado na Infinox, cobrando um pouco abaixo dela.** 4 receitas:

| Receita | Valor (pess/real/otim) | Referência de mercado |
|---|---|---|
| Mensalidade (IA/disciplina de risco justifica) | R$ 97 / 147 / 197 | Infinox não cobra mensalidade — é o diferencial |
| Comissão da plataforma por volume | US$ 6/lote padrão (US$ 0,06 por 0,01 lote) | Infinox ECN: US$ 7–7,50/lote → ~15–20% abaixo |
| Rebate IB (a corretora paga, trader não vê) | US$ 4 / 6 / 8 por lote | INFINOX Partners paga até US$ 20/lote, diário, vitalício |
| Marketplace de indicadores/apps | US$ 0,50–2,00 líquido/usuário/mês | MQL5 retém ~25% → cobrar ~20% |

**Histórico da decisão:** a ideia original de US$ 0,30 por 0,01 lote (= US$ 30/lote padrão) foi **abandonada** — pesquisa mostrou 3–10× acima do benchmark (rebates IB: US$ 2–10/lote; comissões ECN cTrader: US$ 4–8/lote).

**Alertas registrados:**
- Custo empilhado do trader ≈ US$ 13/lote (corretora + plataforma) ≈ 2× uma ECN pura — a mensalidade+IA precisam justificar; monitorar churn de heavy users. Alternativa recomendada no lançamento: **zerar a comissão própria e viver de mensalidade + rebate** (a comissão gera só ~13% da receita e exige carteira pré-paga via Stripe, pois o MetaAPI não desconta da conta MT5; o rebate IB não tem fricção nenhuma).
- Como funciona a Infinox: STP = spread com markup (0,8–0,9 pip EUR/USD); ECN = spread cru + US$ 7–7,50/lote; + swap overnight + float dos depósitos. Programa de parceiros: rebate por lote (até US$ 20, negociável por instrumento/volume) ou CPA (até US$ 1.200/cliente).
- Risco de concentração em uma corretora — cada corretora nova = programa IB novo a negociar (o brokerRegistry já prepara o lado técnico).

## 4. Projeção financeira 5 anos (planilha `projecao-financeira-5anos.xlsx`)

3 cenários, 60 meses, premissas editáveis. Números do modelo atual:

| | Pessimista | Realista | Otimista |
|---|---|---|---|
| Novos usuários/mês (Ano 1 → 5) | 5 → 25 | 10 → 80 | 25 → 200 |
| Churn mensal | 8% | 6% | 4% |
| Usuários fim Ano 1 / Ano 5 | 40 / 276 | 87 / 1.055 | 242 / 3.358 |
| Faturamento Ano 1 | R$ 30 mil | R$ 110 mil | R$ 449 mil |
| Faturamento Ano 5 | R$ 341 mil | R$ 2,12 mi | R$ 10,07 mi |
| **Faturamento total 5 anos** | **R$ 895 mil** | **R$ 4,97 mi** | **R$ 22,7 mi** |
| Caixa final Ano 5 | R$ 525 mil | R$ 4,08 mi | R$ 20,7 mi |
| Menor caixa no período | R$ 11,5 mil | R$ 14,3 mil | R$ 12,1 mil |
| 1º mês lucrativo | 7 | 3 | 2 |

Composição da receita: mensalidade 64–78%, comissão ~13%, rebate IB 8–19%, marketplace 2–4%.
Receita média por usuário/mês (realista): R$ 147 + R$ 25 + R$ 25 + R$ 5,50 ≈ **R$ 200**.

### Furos conhecidos da planilha (correções pendentes, em ordem de impacto)
1. **Sem impostos** — Simples ~6–15,5% do faturamento (come R$ 300–700 mil do realista em 5 anos).
2. **Sem CAC** — aquisição em trading de varejo custa R$ 100–400/usuário; falta também degrau de equipe (~1 pessoa por 300–500 usuários).
3. **Churn otimista** — varejo de trading tem vida média de 3–6 meses para a maioria; pessimista honesto seria 12–15%/mês com volume decaindo por coorte.

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
