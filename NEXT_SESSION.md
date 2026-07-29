# Handoff — próxima sessão (escrito em 2026-07-29)

> Arquivo temporário de retomada rápida. Não é memória permanente do projeto —
> isso é o `CLAUDE.md` (carrega automático) e o `AI_BRAIN_SPEC.md` (fonte de
> verdade do motor de decisão). Este arquivo existe só pra abrir uma janela
> nova e retomar sem reconstruir o raciocínio do zero. Pode apagar depois de
> ler/absorver. Substitui o handoff anterior (sessão de revisão da IA
> Preditiva, 2026-07-28), que já foi commitado e absorvido.

## Onde a conversa chegou

Sessão inteira dividida em duas fases: **(1) avaliação de prontidão para
investimento** e **(2) auditoria + correção de dado fabricado** encontrado
como consequência direta dessa avaliação. Ver detalhe por tópico abaixo.

---

## FASE 1 — Avaliação "vale a pena buscar investidor agora?"

**Pergunta do Cleber**: já dá pra ir atrás de investidor pro Neural Day
Trader?

**Veredito dado**: não ainda. Investiguei o repo inteiro, a pesquisa quant
(`AI_BRAIN_SPEC.md`), o banco de produção (Supabase) e o site no ar antes de
responder. Achados que embasaram o "não":

- **Tração real**: 4 usuários cadastrados no Supabase de produção, 3 ativos
  em 30 dias, último cadastro 19 dias atrás. Não há validação externa de
  verdade.
- **O produto declarado (pilar de disciplina de risco) não existe em
  código**: `RiskManager.ts` (67 linhas, `validateTrade`/Kelly) nunca é
  chamado por ninguém; `NeuralRiskGuardian.ts` é um stub de 4 linhas.
  Enforcement real no backend (`/broker/execute`) não existe.
- **A pesquisa quant é honesta e é um ativo real**: 15 sub-investigações
  (seções 11.5→11.15 do `AI_BRAIN_SPEC.md`) não encontraram edge comprovado
  em indicador técnico clássico — resultado negativo bem documentado, não
  falta de tentativa. Metodologia (Deflated Sharpe Ratio, walk-forward,
  `CRITERIA.md`) é um diferencial raro no mercado.
- **O site em produção contradizia tudo isso**: números fabricados
  ("24.000+ nós ativos", "$1.2B volume diário", "99,99% uptime",
  alavancagem 1:1000 em destaque) com apenas 4 usuários reais e R$0 de
  receita — risco jurídico (publicidade enganosa) e reputacional imediato
  numa eventual due diligence.

**Roadmap de 8 fases até "investível"** foi desenhado e salvo em
[`/Users/clebercouto/Projects/we-expand/ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md`](../ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md)
(fora deste repo, na raiz do `we-expand`, junto do `PLANEJAMENTO-LANCAMENTO`
existente). Resumo das fases (critério de saída explícito em cada uma,
decidido antes de começar — mesma disciplina do `CRITERIA.md`):

0. Fechar o que ficou pela metade (copy fabricada) — **em andamento, ver
   Fase 2 abaixo**.
1. Módulo de risco com enforcement real (daily loss limit, position sizing
   ATR, cooldown, kill-switch) — **não iniciado**.
2. Ponte decisão→execução, estágios 1-2 (alerta + confirmação manual) —
   **não iniciado**.
3. Trilha jurídica (advogado de mercado de capitais) — **inicia em paralelo,
   ainda não contratado**.
4. 10 usuários reais em demo, métricas fechadas antes de começar — **não
   iniciado, depende da Fase 1**.
5. Primeiros pagantes — **não iniciado**.
6. Corrigir planilha financeira (3 furos já documentados) + dashboard de
   métricas reais — **não iniciado**.
7. Deck, data room, mapeamento de investidor — **só começa depois dos gates
   acima**.

**Total estimado**: 10-16 semanas, jurídico é o maior fator de variância.

---

## FASE 2 — Correção de dado fabricado (Fase 0 do roadmap, em andamento)

### 2.1 Produção (`main`) — CONCLUÍDO e no ar

- Site de produção (`neuraldaytrader.com`) estava com stats fabricados. A
  pedido do Cleber, tirado do ar (substituído por página de manutenção
  honesta) enquanto o app real segue sendo corrigido na branch `dev`.
- `index.html` (raiz, é o que a Vercel realmente serve — **não** o
  `public/holding.html`, que foi criado e depois apagado por causa de uma
  pegadinha de precedência: a Vercel serve arquivo estático antes de aplicar
  `rewrites` do `vercel.json`) agora é uma página neutra: "Neural Day Trader
  está sendo construído", logo real (`neural-logo.svg`, extraído do
  componente `NeuralLogo.tsx`), favicon corrigido (hexágono cyan da marca,
  não mais o "N" roxo antigo), contato `info@neuraldaytrader.com`.
- Branch `dev` criada a partir do estado anterior (app completo) — é onde
  todo trabalho real acontece agora. Preview deploy automático da Vercel
  para essa branch **não disparou** (provavelmente Preview Deployments
  desabilitado nas configs do projeto — não investigado a fundo). Acesso
  real: `git checkout dev && npm run dev` (localhost:5173).
- Todos os commits desta fase já foram feitos pelo Cleber (nunca eu sozinho,
  regra do projeto) e estão em `main`.

### 2.2 Landing page (branch `dev`) — CONCLUÍDO, commitado

`src/app/components/landing/LandingPage.tsx` e `translations.ts` (pt/en/es)
reescritos. Removido: stats fabricados (24.000+ nós, $1.2B volume, 1:1000
alavancagem, 99,99% uptime), "criptografia resistente a quantum", "execução
em milissegundos", "zero latency co-location", specs de pricing fantasiosas
(VPS Londres, dark pool, HFT, algoritmos genéticos, FIX protocol). Trocado
por diferenciais reais: 18 fontes RSS, 10+ anos de backtest, AES-256+RLS,
metodologia de validação estatística sem promessa de rentabilidade. Card
novo "Disciplina de Execução" descreve o módulo de risco da Fase 1 do
roadmap — **só pode ir ao ar depois que esse módulo existir de verdade**,
hoje é aspiracional.

**Achado à parte, não resolvido**: preços dos planos na landing (R$199/399)
não batem com o modelo de receita já decidido em `PLANEJAMENTO-LANCAMENTO`
(R$97/147/197). Decisão de negócio, não mexi sem confirmação.

Commit: `fix: remove claims fabricadas da landing page (...)`, já no `dev`.

### 2.3 Varredura de repo inteiro — CONCLUÍDO (5 itens críticos), commitado

Depois da landing, pedido para varrer o resto do app atrás do mesmo padrão
(agente Explore fez o levantamento). 5 achados críticos, todos sem gate de
admin, todos corrigidos nesta sessão:

1. **`AITraderVoice.tsx` + `advancedTradeAnalysis.ts`** — a voz narrava RSI,
   MACD, sentimento, correlação com S&P500, fluxo institucional e "atividade
   suspeita de baleias", tudo `Math.random()`; preço também era random walk
   sintético. Reescrito: RSI/MACD/ATR/Bollinger calculados de verdade sobre
   candle real da Binance (`backtestDataService.fetchHistoricalData`), preço
   real polado a cada 5s. Campos sem fonte real (institucional, sentimento,
   correlação, "manipulação") foram **removidos**, não fabricados — mesma
   filosofia da auditoria de `LiquidityPrediction.tsx` da sessão anterior.
2. **`LiveLogTerminal.tsx`** — latência de broker, margin level, CPU/Memory/
   PID/Uptime fabricados a cada 2s. Agora só loga transições reais
   (`useTradingContext`: conexão MT5, status rodando/parado, ordens
   abertas/fechadas). Rodapé mostra uptime real da sessão.
3. **`ReportExporter.tsx`** — gerava PDF/Excel **para download** com 50-100
   trades fictícios, ID de relatório fixo, "SECURE HASH" aleatório e badge
   "COMPLIANCE" (usuário podia entregar isso a um contador achando real).
   Agora exporta `ai_trades` reais do Supabase (mesmo padrão de
   `PerformanceView.tsx`); sem trade real, avisa e não gera nada.
   **Descoberta**: este componente hoje **não está montado em nenhuma rota
   ativa** (`ModularDashboard.tsx`, que o usa, não é importado por
   `App.tsx`) — risco latente, não visível a usuário agora, mas a correção
   vale pra quando for religado.
4. **`DataSourceHealthDashboard.tsx`** — 5 provedores (MetaAPI, Trading
   Economics, S&P Global, Alpha Vantage, CoinGecko) com latência/status/
   requisições simulados via `setTimeout(Math.random())`, nenhuma chamada de
   rede real. Reescrito pra monitorar só as 2 fontes reais do caminho
   crítico — MetaAPI (via `getMT5Validator().getConnectionStatus()`) e
   Binance (round-trip real medido via `fetchDirectBinance`). **Bug
   encontrado e corrigido durante o teste**: `getMT5Validator()` lança
   exceção quando nunca foi inicializado (sem token), travando o resto do
   health-check — agora tratado com try/catch, mapeado honestamente como
   "offline".
5. **`useMarketScanner.ts`** — gerava score/insight por ativo fabricados a
   cada 30s ("Fluxo Institucional agressivo detectado em X"); o próprio
   `MarketScoreBoard.tsx` já documentava (2026-07-08) um bug real causado
   por esse gerador (race condition sobrescrevendo preço real por zero).
   Simplificado pra só detecção real de mercado aberto/fechado por
   calendário (grátis, sem chamada de rede) — decisão deliberada de **não**
   fazer scan real multi-ativo aqui porque bateria na conta MetaAPI
   compartilhada (risco crônico já documentado no projeto).

Verificação: `npm run validate` (28/28), `tsc --noEmit` sem erro novo, e
**teste ao vivo no browser** (login mock via `sessionStorage.apex_mock_user`,
não credencial real) — narração de voz confirmada com RSI/MACD/ATR reais,
terminal só com eventos reais, painel de saúde confirmado com MT5
offline/Binance 290ms reais.

Commit: `fix: remove dado fabricado de 5 componentes (...)`, já no `dev`
(o Cleber já rodou os comandos — `git log` confirma, nada pendente de
commit neste momento).

### 2.4 Achados adicionais (fora do escopo aprovado até agora)

Registrados durante a varredura/teste, ainda **não corrigidos**:

- Tela de login (`AuthOverlay.tsx`) mostra "LATENCY: 12MS" e "ENCRYPTED
  CONNECTION (TLS 1.3)" fixos (não medidos). Também existe um fluxo de
  "Escaneamento Biométrico" e um "log de segurança" (`securityLog`
  traduzido em 3 idiomas) que são **código morto** — as chaves de tradução
  existem mas não são renderizadas em lugar nenhum (confirmado por grep).
- `public/proposta-comercial.html`, publicado em produção
  (`neuraldaytrader.com/proposta-comercial.html`), é uma proposta comercial
  de **outro produto** (arbitragem de commodities agropecuárias) reusando a
  marca Neural Day Trader como prova social ("plataforma 75% pronta", "IA
  já testada e funcional"). Já li o arquivo inteiro (344 linhas) nesta
  sessão.
- `LatencyBenchmark.tsx` — ferramenta de QA/dev exposta permanentemente na
  tela de usuário final `Performance.tsx` (não engana ninguém, só está no
  lugar errado).
- `RISK_MANAGEMENT_STRATEGY.md` (documento, não código) ainda descreve
  `NexusQuantumAdvisor`/`MarketTendencyPanel` como "painel mock ainda
  visível" — **já foram corrigidos em 2026-07-19** (usam `MarketScoreEngine`
  real hoje). A documentação está desatualizada, não o código.
- `PerformanceView.tsx` — "Retornos Mensais" (gráfico de barras Jan-Dez) e
  "Distribuição por Ativo" (pizza Forex/Ações/Índices/Cripto) mostravam
  números com a conta em $0/nenhum trade real — **suspeito de ser
  fabricado, não investigado a fundo ainda**.

---

## Próximo trabalho pedido pelo Cleber (início desta janela, NÃO EXECUTADO ainda)

Pedido explícito, na ordem que ele mandou — nenhum destes 4 itens foi
começado, a sessão foi interrompida pra salvar este handoff antes:

1. **Reconstruir `public/proposta-comercial.html` para o Neural Day
   Trader** (não para o produto de arbitragem agropecuária) — e **não
   tirar do ar**, só trocar o conteúdo. Já li o arquivo completo (344
   linhas, estrutura: header, sobre o desenvolvedor, solução, 3 opções de
   preço R$42k/55k/95k, comparativo, análise de valor, contato). Precisa
   virar uma proposta comercial real do Neural Day Trader — provavelmente
   reaproveitando os diferenciais reais já estabelecidos na landing
   (research quant honesta, segurança AES-256+RLS, 18 fontes RSS, dado
   real sem simulação) e o modelo de preço já decidido em
   `PLANEJAMENTO-LANCAMENTO` (R$97/147/197 + comissão + rebate IB).
2. **Corrigir `RISK_MANAGEMENT_STRATEGY.md`** — atualizar a menção a
   `NexusQuantumAdvisor`/`MarketTendencyPanel` como mock, já que isso foi
   corrigido em 2026-07-19 e o documento nunca foi atualizado.
3. **Tornar `useMarketScanner.ts` real pra uso da IA** — o Cleber quer o
   scanner multi-ativo de verdade (não só calendário aberto/fechado). Ponto
   de atenção que eu tinha levantado antes de parar: rodar
   `MarketScoreEngine.compute()` pra vários ativos a cada 30s pode sobrecarregar
   a conta MetaAPI compartilhada (risco crônico já documentado no
   `CLAUDE.md`) — precisa de desenho cuidadoso (ex: só ativos cripto via
   Binance, que não tem esse limite; ou aumentar o intervalo; ou usar
   cache/dado já buscado por outro componente em vez de nova chamada).
4. **Avaliar se dá pra desenvolver login biométrico + log de segurança de
   verdade** (`AuthOverlay.tsx`) — hoje é 100% decorativo/código morto.
   WebAuthn (`navigator.credentials`) é tecnicamente viável no browser para
   reautenticação no mesmo dispositivo, mas precisa investigar se o fluxo
   de auth atual (mock local + Supabase em produção) suporta isso de forma
   real antes de prometer. Ainda não avaliado a fundo.
5. **Investigar e corrigir `PerformanceView.tsx`** — "Retornos Mensais" e
   "Distribuição por Ativo" parecem fabricados (dados aparecem mesmo com
   conta zerada). Cleber pediu pra "deixar perfeito" — investigar a fundo
   (que arquivo/serviço gera esses números) antes de decidir se remove,
   substitui por real, ou marca como indisponível.

## Regras fixas do projeto (não esquecer ao retomar)

- Claude nunca faz `git commit`/`git push` sozinho — sempre entregar
  comando pronto pro Cleber rodar (push sempre junto do commit).
- `npm run validate` obrigatório antes de qualquer commit que toque o motor.
- Nunca fabricar dado — sempre erro/estado "indisponível" ou remoção
  completa quando não há fonte real. Esta foi a diretriz central da sessão
  inteira.
- Comunicação sempre em português, rigor de especialista sênior — nunca
  inflar resultado, sempre reportar achado negativo por completo.
- Trabalho de produto acontece na branch `dev` — `main` é só a página de
  manutenção até a Fase 1 do roadmap (módulo de risco real) estar pronta.

## Estado do git

Branch atual: `dev`. Nada pendente de commit neste momento (`git status`
limpo de mudança rastreada; só arquivos não rastreados de sempre — zip,
screenshots antigas em `src/imports/`, `dist/`, `RISK_MANAGEMENT_STRATEGY.md`
ainda não versionado). Últimos commits, mais recente primeiro:

```
17301f743 fix: remove dado fabricado de 5 componentes (voz, terminal, relatorio, saude de dados, scanner)
8939c02bc fix: remove claims fabricadas da landing page (stats, criptografia quantica, alavancagem, latencia)
24da24a26 docs: atualiza handoff da sessao de revisao da IA Preditiva
```

## Arquivos-chave pra retomar

- [`/Users/clebercouto/Projects/we-expand/ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md`](../ROADMAP-INVESTIDORES-NEURAL-DAY-TRADER.md) — roadmap completo das 8 fases até investível.
- [`public/proposta-comercial.html`](public/proposta-comercial.html) — próxima tarefa (item 1).
- [`RISK_MANAGEMENT_STRATEGY.md`](RISK_MANAGEMENT_STRATEGY.md) — próxima tarefa (item 2).
- [`src/app/hooks/useMarketScanner.ts`](src/app/hooks/useMarketScanner.ts) — próxima tarefa (item 3), consumido por [`src/app/components/dashboard/MarketScoreBoard.tsx`](src/app/components/dashboard/MarketScoreBoard.tsx).
- [`src/app/components/auth/AuthOverlay.tsx`](src/app/components/auth/AuthOverlay.tsx) + [`src/app/components/landing/translations.ts`](src/app/components/landing/translations.ts) (chaves `login.biometric`/`login.securityLog`) — próxima tarefa (item 4).
- [`src/app/modules/performance/PerformanceView.tsx`](src/app/modules/performance/PerformanceView.tsx) — próxima tarefa (item 5).
