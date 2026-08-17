# Sessão 2026-08-10 — Modelo Financeiro 5 Anos (reconstrução completa)

> Handoff pra continuar esta linha de trabalho numa sessão nova. Não é sobre o
> cérebro de decisão da IA (isso continua em [NEXT_SESSION.md](NEXT_SESSION.md))
> — é sobre o modelo de negócio/financeiro do lançamento. Leia este arquivo
> primeiro se for continuar a discussão de preço/comissão/projeção financeira.

## ▶ Onde paramos

A planilha [`projecao-financeira-5anos.xlsx`](projecao-financeira-5anos.xlsx)
está **reconstruída do zero, versionada no repo, 3 cenários, mês a mês, zero
erros de fórmula (4.626 fórmulas verificadas com LibreOffice)**. Ela já
incorpora um pacote de 6 ajustes pra dar lucro no Ano 1 (Realista e Otimista).
**Ainda não foi commitada** — comando pronto na seção "Próximo passo" abaixo.

## O que foi construído nesta sessão

1. **Descoberta**: `projecao-financeira-5anos.xlsx` citada em
   `PLANEJAMENTO-LANCAMENTO-NEURAL-DAY-TRADER.md` **nunca existiu** — era só um
   resumo em texto de uma sessão de planejamento de 11/07/2026, nunca uma
   planilha rastreável. Construída do zero nesta sessão.
2. **Preços reais extraídos do código da landing**
   (`src/app/components/landing/translations.ts:106-132`), não inventados:
   Node: Starter grátis, Node: Pro R$199/mês, Node: Institutional R$399/mês,
   Syndicate Core sob medida (sem preço público, não modelado como recorrente).
3. **7 abas**: Leia-me, Premissas (3 cenários lado a lado, cada número com
   fonte citada), Pessimista/Realista/Otimista (mês 0 a 60, 100% fórmula),
   Resumo Anual, Comissionamento, Sugestões de Crescimento.
4. **Modelo de comissionamento realinhado com mercado** (decisão do Cleber
   durante a sessão): comissão própria cobrada em **todos os tiers**
   (Starter+Pro+Institutional), não só no funil grátis como eu tinha desenhado
   inicialmente — corrigido a pedido explícito do Cleber.
5. **Bug de modelagem achado e corrigido antes da entrega**: crescimento
   composto mensal sem teto explodia matematicamente — o Otimista sem
   correção gerava R$217 milhões em 5 anos, >15 mil cadastros só no último
   mês. Corrigido com um teto de saturação de mercado (`teto_cadastros`),
   premissa nova, marcada como bom senso e não medição.
6. **Pacote de 6 alavancas pra lucro no Ano 1** (pedido explícito do Cleber
   depois de ver que Pessimista/Realista ficavam no vermelho por 2+ anos —
   ver §"Decisões-chave desta sessão" abaixo pro detalhe de cada uma).

## Decisões-chave desta sessão (não reabrir sem motivo novo)

- **Comissão cobrada em todos os tiers**, não só no Starter — decisão
  explícita do Cleber, reverte uma proposta minha de diferenciação por tier.
- **Pacote de 6 ajustes pra lucro no Ano 1**, todos marcados `⚠️ AJUSTADO
  2026-08-10` na aba Premissas, cada um exigindo ação real de execução (não é
  automático):
  1. CAC pela metade (R$180/220/260 → R$90/110/130) — exige migrar aquisição
     pra comunidade/indicação, não só mídia paga.
  2. Comissão própria R$30 → R$40/lote (ainda dentro do benchmark cTrader
     ECN US$4-8/lote).
  3. Rebate IB +R$10/lote em cada cenário — exige negociação real com a
     corretora antes do lançamento.
  4. Custos fixos administrativos cortados ~33% (lançamento mais enxuto).
  5. Degrau de contratação esticado (atrasa a 1ª contratação além do
     fundador).
  6. Conversão Starter→Pago do Realista 6% → 8% — exige construir gatilho de
     conversão orientado por produto (prompt no momento exato de dor).
- **Pessimista deliberadamente continua no vermelho** mesmo depois do pacote
  (prejuízo caiu de −R$236k pra −R$162k no Ano 1, mas não virou positivo).
  Isso é proposital — se o Pessimista também virasse lucrativo, ele deixaria
  de representar "as coisas dando errado" e o modelo perderia a função de
  alerta precoce. **Não tentar forçar o Pessimista a dar lucro** — é o
  cenário que deve continuar doendo.
- **Teto de mercado (`teto_cadastros`)**: 350/900/2.200 novos cadastros/mês
  (pess/real/otim) — premissa de bom senso pro TAM do nicho brasileiro,
  **não é medição**, recalibrar quando houver dado real de mercado
  endereçável.

## Números atuais (aba Resumo Anual, versão com o pacote de 6 alavancas)

| | Pessimista | Realista | Otimista |
|---|---|---|---|
| Lucro Ano 1 | −R$ 161.737 | R$ 19.379 | R$ 1.070.865 |
| Margem líquida Ano 1 | −264,7% | 4,2% | 48,6% |
| Lucro Ano 2 | −R$ 173.300 | R$ 545.811 | R$ 5.786.363 |
| Margem líquida Ano 2 | −126,8% | 38,6% | 61,6% |
| Lucro Ano 5 | −R$ 194.089 | R$ 3.939.987 | R$ 52.002.340 |
| Margem líquida Ano 5 | −61,8% | 50,5% | 69,9% |
| Caixa acumulado fim Ano 5 | −R$ 906.896 | R$ 7.961.629 | R$ 111.832.789 |
| Pagantes fim Ano 5 | ~38 | ~579 | ~4.466 |

## Perguntas do Cleber respondidas nesta sessão (resumo — detalhe completo no
histórico de mensagens, não repetido aqui pra não duplicar)

1. **"De onde pegou essa planilha?"** — Nunca existiu antes, construída do
   zero. Corrigido: eu tinha inicialmente feito extrapolação manual em cima
   de um resumo em texto (sem planilha real) — isso foi descartado.
2. **"O negócio é inviável?"** — Não. Realista e Otimista fecham a conta;
   só Pessimista (churn alto + conversão baixa + CAC alto simultâneos) não
   fecha, e isso é o esperado de um "pior caso".
3. **"Não posso ter prejuízo por 2 anos, preciso de lucro no Ano 1"** — Testei
   e achei um pacote de 6 alavancas (ver acima) que resolve pra Realista e
   Otimista. Pessimista continua no vermelho de propósito.
4. **"Não está dando ganhos exponenciais, está apertado — por quê?"** —
   Resposta matemática, não defeito: **churn cria um teto natural de
   equilíbrio** mesmo antes do teto de mercado. Pagantes de equilíbrio ≈
   convertidos/mês ÷ taxa de churn. Realista: ~72 convertidos/mês ÷ 6% churn
   ≈ 1.200 pagantes de teto natural. Otimista: ~242 ÷ 4% ≈ 6.050. A alavanca
   mais forte pra crescimento maior é **reduzir churn**, não aumentar
   cadastro (está no denominador da fórmula de equilíbrio).
5. **"Incluiu as comissões no cálculo?"** — Sim. No Realista Ano 1, comissão
   própria + rebate IB juntos são **~75% da receita** (R$465.606 total,
   sendo ~R$201k comissão + ~R$176k rebate vs ~R$85k mensalidade) — porque
   comissão/rebate incidem sobre TODO o volume operado (Starter + pagantes),
   não só sobre quem assina.
6. **"Receita de quase meio milhão, lucro de só R$19k — por quê?"** — Despesas
   do Ano 1 (R$446.226) comem 96% da receita: infra R$137.582 (30%, sobre
   TODOS os cadastros, pagos ou não), CAC R$136.083 (29%, mesma lógica),
   equipe R$90.000 (19%), impostos R$46.561 (10%), custos fixos R$36.000
   (8%). O Ano 1 é o ano de arranque — você paga CAC pra adquirir a base
   inteira de uma vez, contra receita ainda pequena.
7. **"Então o negócio só gera 4% de lucro ao ano?"** — Não, 4,2% é só a
   margem do Ano 1 (arranque). Margem sobe rápido: 38,6% no Ano 2, 46,1% no
   Ano 3, estabiliza perto de 50% no Ano 5 (Realista) e ~70% no Ano 5
   (Otimista) — é um SaaS saudável em regime, só o Ano 1 é apertado.

## Como continuar numa sessão nova

1. Abrir [`projecao-financeira-5anos.xlsx`](projecao-financeira-5anos.xlsx) —
   aba Leia-me explica convenção de cor (azul=premissa editável,
   preto=fórmula, verde=link entre abas, amarelo=premissa mais sensível).
2. Ler `PLANEJAMENTO-LANCAMENTO-NEURAL-DAY-TRADER.md` §3 pro resumo textual
   sincronizado com a planilha.
3. Aba **Comissionamento** da planilha tem a seção "Plano de lucro no Ano 1"
   com o detalhe completo das 6 alavancas e o alerta de que Pessimista fica
   no vermelho de propósito.
4. Aba **Sugestões de Crescimento** tem as alavancas de crescimento de longo
   prazo discutidas (conversão como alavanca #1, churn como maior ameaça,
   Syndicate Core como canal B2B separado, CAC via comunidade/indicação).

### Pendências reais em aberto (não resolvidas ainda)

1. **CAC de R$90-130/cadastro não é medido, é meta** — depende de migrar
   aquisição pra comunidade/indicação de fato. Se isso não acontecer, os
   números do Ano 1 revertem pro cenário sem as 6 alavancas (Realista volta
   a −R$263k no Ano 1).
2. **Conversão de 8% (Realista) exige gatilho de produto construído** —
   ainda não especificado tecnicamente, só citado como ideia
   ("prompt no momento exato de dor" — sinal que teria sido lucrativo mas
   não pôde executar automático). Precisa de spec técnica se for adiante.
3. **Rebate IB mais alto exige negociação real com a corretora** — nenhuma
   negociação foi feita, é premissa de planejamento.
4. **Billing anual (upsell de caixa)** discutido mas não modelado como
   premissa numérica — precisaria de uma linha nova na planilha.
5. **Teste de sensibilidade de churn não foi rodado** — cheguei a propor
   testar Realista com churn igual ao Otimista (4% em vez de 6%) pra ver o
   efeito no teto de equilíbrio, mas o Cleber não pediu esse teste ainda.
6. Furos já registrados no `.md` da planilha (custo de funcionário e custos
   fixos não pesquisados com RH/contador real, Syndicate Core sem pipeline
   separado).

## Próximo passo — commit pendente

O arquivo `projecao-financeira-5anos.xlsx` e as edições em
`PLANEJAMENTO-LANCAMENTO-NEURAL-DAY-TRADER.md` **ainda não foram commitados**.
Comando pronto:

```bash
git add projecao-financeira-5anos.xlsx PLANEJAMENTO-LANCAMENTO-NEURAL-DAY-TRADER.md SESSAO_2026-08-10_MODELO_FINANCEIRO.md
git commit -m "feat: ajusta modelo financeiro para lucro no Ano 1 (Realista e Otimista)

Pacote de 6 alavancas testado na planilha: CAC pela metade, comissão e
rebate mais altos (dentro de benchmark de mercado), custos fixos mais
enxutos, contratação adiada, conversão do Realista 6%->8%. Realista vira
lucrativo já no Ano 1 (R\$19k, era -R\$263k); Otimista melhora de R\$292k
para R\$1,07mi. Pessimista mantido no vermelho de propósito - representa
o cenário onde as alavancas não saem do papel.

Inclui handoff de sessão documentando o racional de cada ajuste e as
perguntas respondidas sobre por que o crescimento não é exponencial
(churn cria teto de equilíbrio natural) e composição de receita/custo
do Ano 1."
git push origin dev
```

**Regra fixa do projeto reforçada aqui**: Claude nunca roda esse commit
sozinho — o comando acima é pra você rodar.
