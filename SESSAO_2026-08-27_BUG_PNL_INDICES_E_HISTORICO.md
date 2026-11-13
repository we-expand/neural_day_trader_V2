# Sessão 2026-08-27 — Bug de PnL 20x em índices, histórico sumindo, cronômetro saltando

## Como começou

Cleber reportou alarme sério: posição de NAS100 aberta mostrando **-$16,30**
de PnL (quase 10% da conta DEMO de $100), achando que ia estourar a premissa
de "não quebrar o usuário". Investigação em cima do dado real (Supabase +
código), não estimativa.

## O que era real vs. o que era bug de exibição

Consultado direto no banco (`ai_trades`, `ai_portfolio_snapshots`,
`ai_decisions`): a posição de NAS100 era de **0,01 lote** (mínimo
executável), stop a 105 pontos de distância = **risco real máximo de
~$1,05**. As outras duas posições abertas na mesma sessão (ETHUSD, SOLUSD)
estavam com stop em breakeven/lucro (trailing funcionando). Total real das 3
posições: **~+$2** (ganho), não -$12/-$16 como a tela mostrava.

A posição de NAS100 **fechou de verdade** pelo stop do servidor às
15:45:43 UTC, `net_pnl = -$1,14` — exatamente a ordem de grandeza do risco
real calculado, confirmando que o motor de risco (`ai-runner`) funcionou
como projetado. O número assustador na tela era causado por um bug de
exibição, não por exposição real.

## Bug 1 — PnL de índices inflado em ~20x

**Causa raiz**: `calculatePnLWithLeverage` (`src/config/contractSpecs.ts`)
usa `INFINOX_CONTRACT_SPECS` — que pra símbolos INDICES (ex: `NAS100`:
`tickSize: 0.25, tickValue: 5` → $20/ponto) carrega a especificação do
**contrato futuro E-mini da CME**, não o CFD de varejo. O motor de sizing
(`TradeSizing.ts`, `pointValue = 1.0` pra não-forex/metal/energia) e o
fechamento real no servidor (`positionManager.ts`, `grossPnl = (price-entry)
* (amount/entry)`) sempre assumiram o modelo de $1/ponto. As duas fórmulas
nunca foram reconciliadas — resultado: ~20x de inflação no PnL mostrado (e,
mais grave, no PnL **realizado** se o usuário clicasse "Fechar" manualmente
— o servidor usa a conta certa, só o caminho manual do cliente estava
quebrado).

**Fix**: `src/app/hooks/useApexLogic.ts` — nova função
`calculateEngineConsistentPnL()`, que espelha exatamente a fórmula do
servidor. Substituídas as 3 chamadas de `calculatePnLWithLeverage` que
afetam o que o usuário vê como resultado real (ticket de posição aberta,
`forceCloseAll`, `closeManualPosition`). `contractSpecs.ts`/
`infinoxContractSpecs.ts` (300+ ativos) não foram tocados — fora de escopo
desta sessão, o mesmo problema pode existir em outros símbolos INDICES
(US30, US2000, GER40, UK100 etc.), não auditado ativo por ativo.

## Bug 2 — Histórico de trades sumindo do Dashboard

Cleber relatou: a operação de NAS100 "sumiu do Dash como se nunca tivesse
existido" depois de fechar. **Causa raiz**: `reconcile()`
(`useApexLogic.ts`, efeito de sincronização via Supabase Realtime em
`ai_trades`) só atualizava `activeOrders` (posições abertas) e o balance —
nunca escrevia em `orderHistory`. A hidratação do histórico só roda **uma
vez**, no mount da página. Resultado: todo fechamento feito pelo servidor
durante uma sessão de navegador ativa saía de "aberta" e não entrava em
"fechada" — invisível até o próximo reload completo, com o registro sempre
intacto em `ai_trades`.

**Fix**: `reconcile()` agora também busca trades `CLOSED` que ainda não
estão em `orderHistory` (dedupe por `id`) e os adiciona, mesmo formato já
usado na hidratação de mount. Log simétrico ao de entrada ("🛑 SAÍDA...
fechada pelo servidor").

## Bug 3 — Cronômetro de candle saltando

Confirmado em vídeo enviado pelo Cleber: contador foi de "27:16" pra
"37:14" em menos de 2 segundos reais (~10min de salto). **Causa raiz**: o
cronômetro (`ChartView.tsx`) lia `chartDataRef.current[último].timestamp`,
um ref escrito por **duas fontes conflitantes** — o fetch real do servidor
(confiável) e um "chute" local de virada de vela (assume que passou
exatamente 1 intervalo, usado só pra não esperar até 30s pelo refresh do
servidor). Quando as duas discordavam, o cronômetro saltava de forma
descontínua.

**Fix**: nova âncora `lastRealCandleTimestampRef`, escrita **só** pelo
fetch real. Quando o período já deveria ter virado mas o candle real ainda
não confirmou, trava em `00:00` em vez de adivinhar o próximo boundary —
mesma disciplina de "nunca fabricar dado" já documentada no projeto.

## Estado

Todos os 3 fixes aplicados, `npm run validate` passou 100% (type-check +
37 asserções), nenhum erro novo de TS introduzido (570 pré-existentes fora
do gate estrito, mesma contagem antes/depois). Commit pronto entregue pro
Cleber rodar — não commitado pelo Claude (regra fixa do projeto).

## Pendente

- Auditar se o mesmo bug de contractSpecs.ts (multiplicador de futuro em
  vez de CFD) afeta outros símbolos INDICES além de NAS100 — não verificado
  símbolo a símbolo.
- O cronômetro do 1H investigado no início da sessão (antes do vídeo) segue
  sem causa 100% fechada pro caso específico relatado ("sempre, mesmo com a
  aba em foco") — o vídeo confirmou e motivou o fix estrutural acima, mas
  não houve reprodução ao vivo pós-fix (ambiente de dev está atrás de login
  da Vercel, sem acesso).
