# Sessão 2026-11-03 (tarde) — Operação LIVE: boleta, stop no MT5, reconciliação e Fibonacci

Cleber passou a operar em modo LIVE (conta real Infinox, login `87026945`, MetaAPI `bb99f865…`) e reportou 5 problemas
seguidos. Todos tinham causa real no código; 5 de 5 corrigidos e commitados por ele. **Só o item 5 (Fibonacci) e o
fechamento automático foram vistos/testados de forma parcial — ver "Não verificado" no fim.**

## Commits (todos já em `dev`)

| Commit | Assunto |
|---|---|
| `8018695b5` | boleta: ordem manual em LIVE caía no DEMO |
| `ad0038ffa` | mover stop/alvo de posição real altera no MT5 |
| `63a32d107` | posição importada do MT5 com tamanho errado (0.00 lote, P&L piscando) |
| `9ab2e492b` | reconciliação LIVE do motor roda sempre (fechou no MT5 → fecha na plataforma) |
| `2b7080ede` | Extensão de Fibonacci: alvos com a mesma largura horizontal da base |

## 1. "Abri em LIVE pela plataforma e não abriu no MetaTrader"

- **Causa:** `OrderTicket.tsx` decidia DEMO/LIVE por `executionMode` do contexto — campo LEGADO que nada mais seta pra
  `'LIVE'` (o próprio `TradingContext.tsx` já avisava). Com a corretora conectada e o Header mostrando LIVE, toda ordem
  caía no ramo DEMO (`openManualPosition`, texto "Ordem manual do usuário" sem "(LIVE)") e só gravava em `ai_trades`.
- **Prova:** 3 ordens BTCUSD (13:50, 14:51, 14:52 UTC) com `broker_position_id = null` na sessão DEMO.
- **Fix:** o modo vem de `isLiveConnected` (`broker_credentials`, mesma fonte do Header e do motor). Novo
  `isLiveStatusKnown` no contexto: até a 1ª resposta a boleta fica travada ("Verificando conexão com a corretora…"), em vez
  de mandar pro DEMO uma ordem que o usuário acha que é real.
- **Limpeza do banco:** as 3 posições falsas foram anuladas (`status=CANCELLED`, resultado 0, `is_test_data=true`,
  `correction_reason` e `original_values` preenchidos; `ai_trades_audit_log` registrou as 3). Não foi `UPDATE` silencioso.

## 2. "Ao mover o stop não consigo alterar — tem que mudar no MT5"

- **Causa:** `setOpenPositionStop`/`setOpenPositionTarget` (`useApexLogic.ts`) recusavam posição real ("o stop é definido
  na corretora") e a boleta escondia os campos. Posição importada direto do MT5 (`id mt5-…`, sem `brokerPositionId`) caía
  no caminho DEMO, gravava em `ai_trades` com id inválido e a linha voltava.
- **Fix:** as duas mandam `POSITION_MODIFY` (`BrokerClient.modifyPosition`, rota do servidor que já existia). O MT5 grava
  stop e alvo JUNTOS: o outro nível vai com o valor REAL lido da corretora na hora, nunca o da tela (posição importada sem
  stop/alvo mostra ±2% de padrão — mandar isso criaria nível que o usuário nunca pôs). Falhou na corretora → a linha volta
  e aparece erro. O toast de sucesso só sai depois da resposta do MT5. `syncPositionsFromMT5` agora também acompanha stop/
  alvo reais da corretora (mexeu no terminal → a linha segue em ≤5 s), exceto durante edição em andamento (janela de 30 s).
- Boleta voltou a mostrar os campos de stop/alvo para posição real.

## 3. Vídeo do Cleber: "0.00 lote(s)" e P&L pulando (−0,01 ↔ −9,69)

- **Causa:** `syncPositionsFromMT5` importava com `amount = volume * 100`. No app inteiro `amount` é NOCIONAL em US$
  (`volume × lotSize × preço`). 0,10 lote virava "US$10" → lote exibido 0,0001 e P&L local em centavos, sobrescrito a
  cada 5 s pelo valor real da corretora.
- **Fix:** `amount = volume × lotSize × openPrice` (e o volume real passa a acompanhar a corretora).
- Os "DEMO" e "Sem stop" do vídeo eram do código antigo (vídeo 11:57, commits 11:58/12:02 BRT).

## 4. "Fechei no MetaTrader e não fechou na plataforma"

- **Causa:** `liveReconcileTick` (`llm-active-brain/src/index.ts`, a cada 15 s) só era iniciado dentro de
  `if (config.mt5LiveExecutionEnabled)`. Esse kill-switch está `false` DE PROPÓSITO (libera ordens reais do próprio motor).
  Log do motor não tinha nenhuma linha `[live-reconcile]`.
- **Fix:** a reconciliação roda sempre (só lê e fecha no banco o que sumiu da corretora, nunca abre ordem). Com o
  kill-switch desligado ela NÃO adota posição aberta direto no MT5 (isso segue pela importação da tela). Posição sem
  stop/alvo gravado fechada externamente → `exit_reason='MANUAL'` (antes seria `SL`, sujaria estatística). `neuralBridge`:
  `exitReason` aceita `"MANUAL"` (a constraint do banco já aceitava).
- **Restart do motor feito com autorização do Cleber (~15:16 UTC).** Confirmado ao vivo: `[live-reconcile] 🔴 Posicao real
  1235721565 (BTCUSD) sumiu da corretora -- fechada no banco` e a linha `d20bcd2e…` ficou `CLOSED`/`MANUAL`
  (entrada 77428,76, saída 77449,17, net −US$0,02).
- **Limite conhecido:** o preço de saída gravado é o último tick visto pelo motor, não o do fechamento exato no MT5; o
  P&L do banco pode diferir centavos/poucos dólares do MT5 (MetaAPI não expõe histórico de deals nesta integração).

## 5. Extensão de Fibonacci: linhas dos alvos "pequenininhas"

- Primeiro entendi "largura" como espessura e troquei os alvos para sólidos — **errado, revertido**. O Cleber falava da
  largura HORIZONTAL: os alvos (61,8/100/161,8/261,8%) partiam do ponto C e iam só +100 px.
- **Fix** (`ChartView.tsx`, `FibonacciExtensionOverlay`): cada alvo cobre do ponto mais à esquerda ao mais à direita de
  A/B/C (mínimo 100 px), rótulo no início da linha. Espessura e tracejado como estavam.

## Não verificado (honesto)

- **Stop/alvo no MT5:** não foi testado numa posição real depois do deploy. Teste: mover o stop um pouco e conferir no
  terminal. Chamadas à corretora levam 9–17 s nesta conta; o aviso pode demorar.
- **Boleta em LIVE:** ordem pequena em LIVE pelo alias `dev` ainda não conferida no MT5 (o vídeo era do código antigo).
- **Fibonacci:** nada visto na tela (dev local exige login). Se a largura ainda parecer diferente, pedir print.
- **Motor × stop manual:** o motor também ajusta stop (breakeven/trailing) em posições LIVE dele; não conferido se ele pode
  sobrescrever um stop movido à mão numa posição assim.
- P&L local da posição importada não desconta spread/comissão; o da corretora sim — pode sobrar diferença de centavos.

## Estado e regras que valem daqui pra frente

- `MT5_LIVE_EXECUTION_ENABLED=false` no `llm-active-brain/.env`: o motor NÃO abre ordem real própria. Só as ordens
  manuais do Cleber (boleta) vão pro MT5. Não ligar sem decisão dele.
- Posição BTCUSD de 0,1 lote do vídeo estava SEM stop e SEM alvo; definir stop antes de operar.
- `tsc --noEmit` raiz: 572 erros, todos pré-existentes (nenhum novo); `npm run validate`: 37/37.
- Não mexido de propósito: Fibonacci "Retração" (desenho nativo da klinecharts, todos os níveis já com a mesma
  espessura) e o leque/arcos/círculos.
