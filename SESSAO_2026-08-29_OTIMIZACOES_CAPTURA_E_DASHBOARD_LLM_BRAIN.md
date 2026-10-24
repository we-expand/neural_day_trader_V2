# Sessão 2026-08-29 — Otimizações de captura do LLM Active Brain + ajustes de Dashboard

## Contexto

Cleber reportou que o Cérebro LLM Ativo (teste, cesta do motor, isolado do
motor mecânico) estava "gerando rentabilidade de forma muito lenta" —
capturando pouco dinheiro por operação. Sessão focada em identificar e
corrigir o gargalo estrutural de captura, mais 3 ajustes operacionais
pedidos ao longo da conversa (mão mais forte, tempo de reação da LLM,
atualização do Dashboard).

## Achado principal: take-profit fixo anulava o próprio trailing stop

Analisando `llm-active-brain/src/neuralBridge.ts` (`enforceMt5StopsAndTargets`)
e `config.ts`: todo trade tinha stop = 1,5×ATR e alvo = 3×ATR (R:R 1:2 fixo).
O breakeven disparava em 0,5R e o trailing stop começava a proteger lucro a
partir dali — **mas o código checava STOP_LOSS/TAKE_PROFIT ANTES de checar
breakeven/trailing**, então assim que o preço batia 2R o trade fechava na
hora, mesmo em tendência forte, sem o trailing nunca ter chance de deixar o
vencedor correr além disso. Resultado: **todo trade vencedor capado em
exatamente 2R**, independente do tamanho real do movimento.

## Mudanças de código (llm-active-brain)

1. **`config.ts`** — exposição-alvo por posição $800 → **$1200** ("forte"
   $1200 → $1800), teto de segurança `mt5MaxNotionalUsd` $1500 → **$2200**
   pra acompanhar (senão o próprio teto bloquearia o "mão mais forte"
   pedido). Pedido do Cleber: "entrar com a mão um pouco mais forte, nos
   ativos em geral".
2. **`neuralBridge.ts`** — `take_profit` deixou de ser gatilho de saída
   automática. Agora só o `stop_loss` (inicial → breakeven em 0,5R →
   trailing contínuo por ATR) fecha a posição por código. `take_profit`
   continua gravado no trade só como referência/exibição. Isso remove o
   teto de 2R que anulava o trailing em tendências maiores — pedido do
   Cleber: "pode seguir com esse caminho" após a análise do achado acima.
3. **`agent.ts`** — prompt do agente atualizado pra refletir que não existe
   mais teto mecânico de lucro (senão o LLM continuaria achando que o
   take-profit fecha a posição sozinho).
4. **`config.ts` / `.env`** — `CYCLE_DELAY_SECONDS` 30 → **10**. Pedido:
   "o objetivo seria o tempo de reação da LLM em relação ao mercado".
   Justificativa: boa parte dos 30s antigos era espera ociosa (a chamada ao
   Nemotron responde em ~0,7s, ciclo inteiro termina bem antes do delay
   configurado). Risco monitorado: cota de free tier do provedor de LLM
   (já trocamos de provedor 5x por esgotamento de cota, ver `config.ts`) —
   se aparecerem 429 recorrentes no log, é sinal de subir esse valor de
   novo. Nenhum 429 observado até o fim da sessão.

Commits já aplicados pelo Cleber (confirmado no git log):
`0fe34bc0c` (exposição-alvo), `cc87a971f` (remove teto de take-profit),
`df09e2b4e` (reduz intervalo 30→10s).

## Dashboard (`LlmActiveBrainPanel.tsx`)

Pedido: "mude também a atualização do dashboard... três segundos".

1. Primeira tentativa: `PRICE_POLL_MS`/`TRADES_POLL_MS` 5s → 3s.
2. Cleber reportou (print) "atualizado há 9s" travado mesmo com o polling
   em 3s. Investigação achou **dois problemas diferentes, não um só**:
   - **Bug real corrigido**: `pollPrice` tinha um early-return (quando não
     havia posição aberta no momento) que pulava `setLastUpdate` inteiro —
     o contador ficava congelado na última vez que existiu posição aberta,
     em vez de refletir o ciclo de poll de verdade. Corrigido: `setLastUpdate`
     agora roda a cada ciclo, com ou sem posição aberta.
   - **Limitação real de latência, não bug**: `getBatchedMT5Data`
     (`RealMarketDataService.ts`, linha ~962) documenta latência NORMAL de
     **3-8 segundos** pra busca em lote contra a conta MetaAPI
     compartilhada. Disparar a busca de preço a cada 3s é mais rápido que o
     round-trip real da fonte — o rótulo nunca ia bater 3s cravado de
     qualquer forma. `PRICE_POLL_MS` revertido pra **5s** (ritmo já validado,
     mesmo do motor mecânico em `useApexLogic.ts`). `TRADES_POLL_MS`
     continua em **3s** (só select leve no Supabase, sem essa limitação).

Estado final do polling do painel: preço a cada 5s, posições/trades a cada
3s, decisão da LLM a cada 10s — três cadências independentes, cada uma no
ritmo que sua própria fonte de dado suporta.

## De carona: processo duplicado do LLM Brain, 2ª ocorrência no mesmo dia

Mesmo padrão já documentado em
[SESSAO_2026-08-29_PROCESSO_DUPLICADO_LLM_BRAIN.md](SESSAO_2026-08-29_PROCESSO_DUPLICADO_LLM_BRAIN.md)
se repetiu durante esta sessão (PIDs `83313`/`83334` + `83339`/`83360`,
ambos às 9:14 — log com saída visivelmente entrelaçada, confirmando dois
cérebros decidindo em paralelo contra a mesma conta). Corrigido matando o
par duplicado; confirmado só 1 processo vivo depois. Reforça a
recomendação já registrada: sempre confirmar `ps aux | grep "tsx src/index"`
**vazio** antes de subir um `nohup` novo.

## Pendências

Nenhuma pendência de código. Vale observar nas próximas sessões:
- Se o trailing sem teto de take-profit está de fato deixando os winners
  correrem mais sem devolver lucro demais antes de fechar (comportamento
  novo, ainda sem amostra).
- Se o ciclo de 10s dispara rate-limit (429) do provedor NVIDIA com o uso
  continuado (nada observado até agora).
