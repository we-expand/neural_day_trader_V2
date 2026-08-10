# Sessão 2026-08-04 — Diagnóstico: AI Trader sem nenhuma entrada em ~40min

## Contexto

Cleber deixou a AI Trader ligada sozinha por ~40min, mercado americano
aberto, boa volatilidade, ~50 ativos selecionados no "Universo de Ativos".
Zero entradas realizadas. Pergunta: bug ou comportamento esperado?

## Investigação

1. **Hipótese inicial descartada como explicação principal**: o projeto
   concluiu (seções 11-14 do `AI_BRAIN_SPEC.md`) que não há edge de sinal
   técnico comprovado, e a decisão de produto é "o cérebro mais eficiente é
   o que opera menos" — mas isso sozinho não explicava o padrão observado.

2. **Evidência real via Supabase (`ai_decisions`, projeto
   `wyvdsxtcmizettljxtbg`)**: nas últimas 3h só 9 decisões registradas,
   todas do MESMO ativo (ETHUSD), todas com a MESMA confiança exata (42%
   < 45%, veto `CONTEXT_CONFIDENCE`). Suspeito: só 1 de ~50 ativos gerando
   sinal, e confiança travada sugeria dado não atualizando.

3. **Reprodução ao vivo** (dev local, `npm run dev`, login real, AI Trader
   ligada de verdade, console monitorado): confirmado no console —
   `[MT5] ⚠️ <símbolo> sem tick válido da corretora neste ciclo` pra
   praticamente TODOS os ativos testados (BTCUSD, ETHUSD, EURUSD, XBNUSD,
   XRPUSD, SOLUSD, ADAUSD, BNBUSD, GBPUSD, USDJPY, AUDUSD, US30, SPX500,
   NAS100, XAUUSD, XAGUSD, AUS200...). Fallbacks também degradados: Binance
   WS retornando `$0.00`, REST retornando preço `generated` (fabricado),
   Yahoo HTTP 500 pra alguns símbolos, Edge Function de calendário
   econômico com erro non-2xx/CORS. O motor corretamente recusou operar:
   `[TRADING] ⚠️ <símbolo>: sem dado de mercado real neste ciclo, pulando
   análise de entrada.` A própria UI mostrou o toast: "Dados de mercado
   indisponíveis no momento — novas entradas ficam pausadas até o dado
   voltar."

4. **Causa raiz confirmada no código**: `supabase/functions/server/index.ts`
   linhas 344-355 já documentava, desde 2026-07-12, o MESMO padrão —
   um chunk grande de símbolos (ex: forex, dezenas de pares) dispara
   ticker+candle por símbolo pra MesmA conta MetaAPI **compartilhada entre
   todos os usuários da plataforma**, e sob volume alto vários símbolos
   tomam HTTP 429 (rate-limit). O backend cai pro último preço conhecido
   (desatualizado) ou fallback "generated". Logs reais da Edge Function
   `/mt5-prices` (via `get_logs`) confirmam: sempre HTTP 200 (não crasha),
   mas com latência de 2 a 12s — sinal de espera por uma API upstream
   saturada.

## Conclusão

Zero entradas em 40min **não foi falta de oportunidade de mercado** — foi
fome de dado real causada por rate-limit na conta MetaAPI compartilhada,
provavelmente agravada pelo volume de ~50 ativos monitorados
simultaneamente no mesmo ciclo. O motor se comportou corretamente ao
recusar operar sem dado real (disciplina "nunca fabricar dado" do
projeto) — o problema está na camada de dados, não no cérebro de decisão.

Não é bug novo: é o mesmo padrão de saturação de rate-limit já visto e
parcialmente mitigado em sessões de 2026-07-08 a 07-23 (cache L1/L2,
chunking de 40, concorrência limitada a 8, dedupe de chamadas
concorrentes) — só volta a aparecer com volume de ativos maior.

## Decisão

Não foi feito ajuste de código (concorrência/chunking) nesta sessão —
seria alteração sem medição num sistema já calibrado por vários incidentes
reais anteriores, e testar exigiria martelar a conta MetaAPI compartilhada
em produção (contra a regra do projeto de sempre espaçar chamadas).
Mitigação escolhida por Cleber: reduzir manualmente o "Universo de Ativos"
de ~50 para 12, sem mudança de código. Sistema reiniciado com 12 ativos
selecionados — resultado ainda não verificado (pendência aberta pra
próxima sessão: checar `ai_decisions` e o console de novo pra confirmar se
o dado real passou a fluir e se alguma entrada foi finalmente executada).

## Pendência para próxima sessão

- Verificar se, com 12 ativos, o rate-limit da MetaAPI parou de aparecer
  (checar `ai_decisions` no Supabase e/ou console do navegador).
- Se persistir mesmo com 12 ativos, o gargalo é a carga agregada de TODOS
  os usuários da plataforma na conta compartilhada, não a seleção
  individual do Cleber — nesse caso o próximo passo seria instrumentar
  contagem de 429 por minuto antes de mexer em concorrência/chunking.
