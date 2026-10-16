# Sessão 2026-09-04 (noite) — `ai_user_config` corrompido colapsou a cesta do LLM Brain pra 2 ativos + commit pendente da reversão de cesta automática

## Como retomar

Esta sessão é uma continuação curta da sessão anterior do mesmo dia
([SESSAO_2026-09-04_MONITORAMENTO_5MIN_FIX_RR_RATELIMIT_CESTA_ABAS.md](SESSAO_2026-09-04_MONITORAMENTO_5MIN_FIX_RR_RATELIMIT_CESTA_ABAS.md)).
Cleber pediu pra ler o handoff daquela sessão, depois: (1) enviar o commit
pendente, (2) investigar por que a IA não estava entrando em posição, (3)
confirmar que o Setup do usuário vale de verdade, (4) investigar a fundo.

## O que foi feito, em ordem

### 1. Leitura do handoff da sessão anterior

Confirmado o estado: fix real de R:R (`ef93ab898`) e semáforo de rate-limit
(`8cc89f4e6`) já aplicados e ao vivo; commit da reversão de cesta automática
(`agent.ts`/`assetBasket.ts`/`atr.ts`) ainda pendente.

### 2. Investigação de "IA não está fazendo entradas"

Lido o log real (`llm-active-brain/llm-brain.log`) e consultado
`ai_sessions`/`ai_user_config` no Supabase direto (não suposição). Achados,
em ordem cronológica do dia:

- **Causa 1 (correta, não é bug)**: por volta do meio-dia/tarde, a sessão
  `4165dedb-00cb-482c-a311-6b55a972c018` perdeu -$27,29 (27,29% de $100),
  estourando o teto de `dailyLossLimit` (25%) do Setup. O motor bloqueou
  corretamente TODAS as novas entradas pelo resto do dia 09/04 (até 00:00
  Brasília) — confirmado ciclo a ciclo no log, é o gate de risco
  funcionando certo, não bug.
- **Causa 2 (bug real, achado nesta sessão)**: `ai_user_config` (tabela
  Supabase, `config` jsonb) foi sobrescrito às 22:20 UTC (~19:20 Brasília)
  de hoje com valores completamente diferentes dos configurados: cesta
  reduzida a `["BTCUSD","LINKUSD","DOGEUSD","SOLUSD","BATUSD","BTCEUR",
  "IOTAUSD","ADAUSD","BNBUSD","XETUSD"]`, `timeframe:"1H"`,
  `targetPoints:"POUCOS"`, `marketMode:"TREND"`, `riskPerTrade:1`. Vários
  desses símbolos (`LINKUSD`/`DOGEUSD`/`BATUSD`/`BTCEUR`/`IOTAUSD`) **não
  existem** no mapeamento de símbolos do broker MT5 usado pelo LLM Brain
  (que usa `LNKUSD`/`DOGUSD`, e os outros 3 nem têm equivalente) —
  confirmado no log que a cesta efetiva da sessão nova
  (`6d0ada13-5fee-46a9-b014-06f3ad2a9ae1`) colapsou pra só **2 ativos**
  (`BTCUSD, XETUSD`) em vez dos 16 configurados. Sessão também apareceu com
  `status:"STOPPED"` no debug do próprio motor.
- **Mesma causa raiz já catalogada em 2026-08-31 e 2026-09-02**
  (registrada em `CLAUDE.md`/memória): qualquer aba do navegador aberta com
  o Setup antigo em memória resalva a tabela `ai_user_config` inteira no
  Supabase a qualquer interação de UI, sobrescrevendo qualquer edição feita
  por fora (SQL ou outra aba) — mesmo que a edição tenha sido momentos
  antes. Bateu de novo.

### 3. Confirmação de que o Setup do usuário vale de verdade

Confirmado nos dois lados (log do motor + linha lida do Supabase): o
motor lê `ai_user_config` de verdade a cada ciclo (cache de 60s), sem
hardcode nem valor "fantasma" — o problema nunca foi o motor ignorar o
Setup, foi o próprio dado em `ai_user_config` estar corrompido por outra
fonte (aba antiga).

### 4. Correção aplicada (dado, não código — sem commit/deploy)

Cleber confirmou que a aba da plataforma estava fechada (sem risco de
resave concorrente) e pediu a correção. `UPDATE` direto em
`ai_user_config.config` (Supabase, projeto `wyvdsxtcmizettljxtbg`),
mesclando só os campos afetados (preserva `pyramiding` e o resto do JSON
intocado):

```sql
update ai_user_config
set config = config || jsonb_build_object(
  'activeAssets', jsonb_build_array(
    'BTCUSD','XETUSD','BTCXBN','DOGUSD','DOTUSD','XRPUSD','SOLUSD','ADAUSD',
    'LNKUSD','UNIUSD','TRXUSD','ATMUSD','XLMUSD','FILUSD','BNBUSD','AVAUSD'
  ),
  'riskPerTrade', 2,
  'dailyLossLimit', 25,
  'maxAssets', 10,
  'maxPositions', 10,
  'cadence', 'AGRESSIVA',
  'timeframe', '5m',
  'targetPoints', 'MÉDIO',
  'marketMode', null,
  'allocatedCapital', 100
),
updated_at = now()
where user_id = 'aeb3ec15-f660-4775-856b-2a04b20f4592'
returning user_id, config, updated_at;
```

**Confirmado ao vivo, sem restart** (cache de config expira em 60s):
próximo ciclo do log já mostrou `activeAssets` com os 16 criptos,
`maxSimultaneousAssets`/`maxOpenPositionsTotal: 10`, `timeframe:"5m"`,
`targetPoints:"MÉDIO"`, e **`status:"RUNNING"`** (antes aparecia
`STOPPED`).

### 5. Commit pendente (código, separado da correção de dado acima)

Reenviado a pedido do Cleber — ainda não rodado até o fim desta sessão:

```bash
cd llm-active-brain && git add src/agent.ts src/assetBasket.ts src/atr.ts && git commit -m "$(cat <<'EOF'
revert(llm-brain): cesta de ativos volta a ser so do usuario, nao automatica

Tentativa de trocar a cesta automaticamente entre dia util/fim de semana
por horario foi revertida a pedido do Cleber -- selecao de ativos e
decisao do usuario via Setup (activeAssets), nao algo que o codigo deve
decidir sozinho. MT5_ASSET_BASKET volta a ser array unico fixo.

Mantida a janela de deteccao de "modo fim de semana" (isWeekendMode em
assetBasket.ts, isWeekendNow em atr.ts) ajustada pro horario pedido
(sexta 18h -> domingo 19h Brasilia, era sex 19h/dom 20h antes) -- fica
como infraestrutura pura, exposta como contexto informativo pro LLM
(regime.isWeekend), sem decidir cesta. Pronta pra um "modo fim de
semana" comportamental a ser desenhado numa sessao futura.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
Não precisa reiniciar o processo depois (já rodando com esse código desde
o restart de mais cedo no mesmo dia).

## Pendências reais em aberto

1. **Commit acima ainda não rodado** — comando pronto, entregue 2x nesta
   sessão.
2. **Risco estrutural não corrigido nesta sessão**: qualquer aba do
   navegador aberta com Setup em memória continua podendo resalvar
   `ai_user_config` inteiro e corromper a cesta de novo — mitigação
   atual é só "não deixar aba aberta com config antiga", não é fix de
   código. Já é a 3ª ocorrência catalogada do mesmo padrão (08-31, 09-02,
   09-04) — pode valer a pena investigar um fix estrutural numa sessão
   futura (ex: `ai_user_config` parar de ser resalvo inteiro a cada mudança
   de estado de UI, ou separar schema do motor mecânico do schema do LLM
   Brain em colunas/tabelas diferentes).
3. **"Modo fim de semana" comportamental** — segue não desenhado, só a
   detecção de horário existe (item já registrado na sessão anterior).
4. Amostra pós-fix de R:R e `increase_position` (pyramiding) seguem
   pendentes de mais dias rodando, sem mudança nesta sessão.

## Estado do processo ao final da sessão

- `llm-active-brain` rodando, sessão `4165dedb-00cb-482c-a311-6b55a972c018`
  com `status:"RUNNING"`, cesta de 16 criptos, config correta confirmada
  ao vivo no log.
- Aba da plataforma fechada (confirmado pelo Cleber) — sem risco imediato
  de resave concorrente.
