# Neural Day Trader — Reposicionamento Estratégico + Pesquisa de Risk Management

**Data**: 2026-07-18
**Status**: Decisões travadas nesta sessão, implementação começa em sessão futura.

---

## 1. Contexto — por que este documento existe

Cleber trouxe o objetivo original do projeto: criar uma plataforma capaz de gerar "rentabilidade financeira exponencial" aos usuários, inspirada em traders lendários (Soros, Simons, Tudor Jones, Druckenmiller) e fundos quant de elite (Renaissance/Medallion, Citadel, Two Sigma, D.E. Shaw, Millennium, Jane Street).

### Avaliação honesta feita nesta sessão

**A meta como formulada ("IA que gera rentabilidade exponencial para todos os usuários") não é atingível — nem pelos fundos citados como inspiração:**

- O Medallion da Renaissance **devolve capital externo e não aceita mais dinheiro de fora** — o edge deles morre com escala/distribuição. Isso não é modéstia, é física de mercado: edge quantitativo real não sobrevive a ser distribuído para milhares de usuários.
- Soros/Druckenmiller/Tudor Jones são macro discricionário baseado em décadas de experiência e redes de informação — não é algoritmizável, nem eles conseguiram sistematizar a si mesmos.
- O produto real vai operar **CFDs contra um market maker** (Infinox) — spread + alavancagem + contraparte é a própria corretora. É jogo de soma aproximadamente zero para o usuário, e nenhuma UI muda essa aritmética.
- Prometer rentabilidade com "IA" para terceiros esbarra em território de gestão de carteira não registrada — regulatoriamente perigoso além de estatisticamente falso.

### O reposicionamento acordado

**Não é "IA que vence o mercado". É "a plataforma que impede o trader de se destruir" — gerenciamento de risco impecável como produto central, não acessório.**

A dor real do trader de varejo não é falta de sinal — é autodestruição por ausência de gestão de risco (oversizing, revenge trading, sem stop, sem limite diário). Isso é 100% atacável com o que o projeto já tem: pipeline de dados reais, Score/Backtest/Replay validados com metodologia honesta (walk-forward, sem look-ahead, MarketScoreValidator).

**O que já existe e tem valor real:**
- `MarketScoreValidator.ts` — validação walk-forward sem look-ahead, decisão de reverter fixes quando o validador prova que pioram. Metodologia de quant de verdade.
- Cultura de "nunca inventa número" / proveniência de dado (`isRealData`, `provenance: 'stale'|'real'|'unavailable'`) — diferencial real num mercado cheio de mock disfarçado de real.
- Pipeline de dados reais consolidado (meses de trabalho).

**O que falta e é honesto reconhecer:**
- 81% de acerto em 32 sinais é amostra pequena, nunca medida líquida de custo (spread/slippage/comissão).
- Nada é machine learning ainda — são indicadores técnicos bem validados.
- Viés de venda do SPX500 (sessão 2026-07-17) segue sem explicação.

---

## 2. Estrutura proposta: separar Produto de Pesquisa Quant

Hoje uma única sessão mistura "conserta bug de UI" com "tenta melhorar o Score", sem processo formal. Proposta (ainda não implementada):

```
Neural-Day-Trader/
  src/app/...                    ← produto (como hoje)
  research/
    experiments/
      YYYY-MM-DD-nome-do-experimento/
        hypothesis.md            ← o que se testa, por quê, critério de sucesso ANTES de rodar
        results.json             ← saída bruta do validator
        verdict.md                ← aprovado/rejeitado + justificativa
    promoted/                    ← rastreabilidade do que passou e foi pra produto
    CRITERIA.md                  ← critério de parada institucionalizado
```

**`CRITERIA.md`** deve fixar: amostra mínima (hoje 32 é pouco — considerar piso de 100+), métrica líquida de custo (não bruta), intervalo de confiança/teste estatístico, degradação máxima aceitável fora da amostra antes de reverter, prazo de validade do resultado (edge decai).

**Regra de processo**: mudança em `MarketScoreEngine.ts` (pesos/fatores) só nasce em `research/`, só vira código de produto se aprovada pelo `CRITERIA.md`. Nunca mais "parece melhor no dashboard, vamos commitar".

---

## 3. Pesquisa de Gerenciamento de Risco (resumo executivo)

Pesquisa completa feita via agente com WebSearch/WebFetch. Cobriu: Kelly Criterion e variantes, VaR/CVaR, Maximum Drawdown/Sharpe/Sortino/Calmar, regras reais de prop firms (FTMO, Topstep), correlação entre ativos, regulação ESMA de alavancagem CFD, psicologia do risco, filosofia pública de risco de fundos quant (Renaissance, Citadel, Millennium), circuit breakers e trailing stops, risk budget de portfólio.

### Achado central da pesquisa

**O fator #1 de sobrevivência de conta não é edge da estratégia — é enforcement mecânico de limites de risco.** Dados de prop firms mostram que a maioria dos reprovados viola limite de perda, não erra na estratégia; aprovados arriscam consistentemente 0,5-1%/trade contra 2-3% dos reprovados.

**Dado mais duro**: corretoras de CFD são obrigadas na UE a divulgar % de contas perdedoras — varia entre **68% e 89%**. Confirma que o problema é estrutural (alavancagem alta + ausência de enforcement), não falta de sinal.

**Princípio dos fundos quant de elite (público, não proprietário)**: mesmo Renaissance e Citadel/Millennium separam estritamente quem gera o sinal de quem impõe o limite de risco — o enforcement nunca é discricionário no momento do trade. Este é o princípio central a replicar.

### Priorização técnica (da pesquisa)

**Máxima prioridade — maior evidência empírica de impacto:**
- Daily loss limit + max drawdown com **bloqueio automático real** de novas ordens (modelo FTMO/Topstep — trailing drawdown ancorado no fechamento diário, não no pico intradiário)

**Alta prioridade:**
- Position sizing por % de risco + ATR (fixed fractional + volatility-adjusted)
- Cooldown automático após N perdas consecutivas (literatura mostra ~90%+ de redução em revenge trading)
- Limite rígido de trades/dia
- Alerta/redução de tamanho de posição quando correlação entre posições abertas > ~0,7 (evita "diversificação disfarçada")

**Média prioridade (dashboard informativo):**
- Sharpe/Sortino/Calmar/VaR/CVaR — exibidos com aviso de tamanho de amostra
- Heat map de exposição por classe de ativo

**Baixa / nunca como enforcement automático:**
- Kelly Criterion fracionário (1/4 a 1/2 Kelly) — só como sugestão informativa sobre o histórico do próprio usuário. Full Kelly é perigoso mesmo para profissionais (Edward Thorp usou fracionário, não full).

### Inatingível / fora de escopo para produto retail
- Optimal f puro (drawdowns históricos de 40-90%, inaceitável)
- Monte Carlo VaR completo (complexidade desproporcional ao caso de uso)
- Risk budget multi-pod (pressupõe múltiplos gestores/estratégias independentes — sem análogo em app de usuário único)

### Regras de referência real (prop firms)
- **FTMO**: daily loss 5% (2 fases) ou 3% (1 fase); max drawdown total 10% (estático em 2 fases, trailing em 1 fase)
- **Topstep**: Maximum Loss Limit trailing, ancorado no fechamento diário do saldo (não no pico intradiário — desenho deliberado para não punir lucro intradiário não realizado)

### Regulação de alavancagem (ESMA, referência de proteção ao varejo)
Forex majors 30:1 · forex não-majors/ouro/índices principais 20:1 · commodities (exceto ouro)/índices menores 10:1 · ações individuais 5:1 · cripto 2:1

### Fórmulas-chave
- **Kelly**: f* = (bp − q) / b — usar fracionário (1/4–1/2), nunca full
- **ATR position sizing**: tamanho = risco_$_por_trade / (ATR × multiplicador × valor_do_ponto)
- **Trailing stop**: Stop = Máxima_desde_entrada − (ATR × multiplicador); 1-1,5× ATR intraday, 2-3× swing
- **CVaR/Expected Shortfall**: média das perdas além do VaR — métrica coerente (subaditiva), preferível ao VaR puro pós-Basel III

### Fontes principais
FTMO Academy · Topstep Help Center · documentação ESMA sobre alavancagem CFD · Kelly (1956) / Edward Thorp · QuantInsti (CVaR/Expected Shortfall) · *The Man Who Solved the Market* (Gregory Zuckerman, sobre Renaissance) · material público sobre estrutura de risco em Citadel/Millennium (pod-shop model) · literatura de finanças comportamentais sobre revenge trading.

**Nota metodológica**: números específicos de % de contas perdedoras e parâmetros de drawdown de pod-shops variam por fonte/período — servem para orientar arquitetura técnica, não para uso como claim regulatório/legal sem reverificação na fonte primária.

---

## 4. Perguntas respondidas nesta sessão

### Quanto tempo até um beta demo testável?

**Estimativa: 3 a 5 semanas de trabalho focado**, dado que o pipeline de dados reais, Score/Backtest/Replay e persistência (Fase 2) já existem:
1. Semana 1-2: módulo de risco com enforcement real (daily loss limit + max drawdown bloqueando ordem de verdade, position sizing, cooldown)
2. Semana 2-3: `CostModel` (spread/comissão/slippage) integrado ao validator
3. ~~Semana 3-4: extinguir `NexusQuantumAdvisor` (painel mock ainda visível)~~ — **resolvido em 2026-07-19**: `NexusQuantumAdvisor`/`MarketTendencyPanel` usam `MarketScoreEngine` real hoje, não mock.
4. Semana 4-5: estabilização de robustez sob carga concorrente (rate-limit de conta MetaAPI compartilhada é problema recorrente documentado)

Estimativa de esforço, não promessa — pode esticar.

### Precisa de dinheiro para viabilizar o beta demo?

**Não, quase nada além do que já é pago hoje.** Demo = sem dinheiro real de usuário, sem execução real de ordem → não precisa de Stripe/carteira pré-paga/comissão (isso é Fase 4, só entra se o demo validar abrir operação real). Custos já cobertos: Supabase Pro, Vercel, conta MetaAPI paga do Cleber (serve como feed de dados pra todos os usuários demo nesta fase). Único risco de custo: saturação da conta MetaAPI compartilhada com 50-100 usuários simultâneos — resolver primeiro por arquitetura (cache, WebSocket em vez de polling) antes de considerar 2ª conta (~US$8,64/mês, não é rodada de investimento).

### É viável testar com US$50 reais?

Serve para validar **infraestrutura de execução** (Fase 3: `/broker/execute`, deploy/undeploy MetaAPI), não para validar **edge da estratégia**. Com US$50: position sizing quebra (lote mínimo da corretora força risco de 10-20%+ por trade), amostra estatística insuficiente, um único trade domina o resultado. Validação de edge continua sendo demo + validator estatístico (gratuito, sem limite de capital). Capital real só faz sentido depois do motor passar pelo `CRITERIA.md` em demo, e mesmo assim melhor com US$500-1000 (mínimo para position sizing fazer sentido) do que US$50.

---

## 5. Próximos passos (a decidir em sessão futura)

1. Criar `research/CRITERIA.md`, `research/CostModel.ts`, pasta `experiments/` — formalizar separação produto/pesquisa
2. Desenhar spec técnica do módulo de risco (schema de regras, hooks de enforcement em `useApexLogic.ts`, fórmulas TypeScript) a partir das prioridades da seção 3
3. Confirmar se a estimativa de 3-5 semanas é realista revisando o estado atual do pipeline de preço/estabilidade
4. ~~Decidir se extinção do `NexusQuantumAdvisor.tsx`/`MarketTendencyEngine.ts` entra nesta janela de trabalho ou fica para depois do beta~~ — resolvido em 2026-07-19, ambos usam `MarketScoreEngine` real.
