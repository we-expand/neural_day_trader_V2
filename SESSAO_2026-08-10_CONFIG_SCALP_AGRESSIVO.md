# Sessão 2026-08-10 (tarde) — Investigação "IA sem entradas" + config Scalp agressivo

## Gatilho

IA ligada desde 09h, sem nenhuma entrada até 14h21 (5h+ rodando). BTCUSD saiu
de -30% pra -1,84% no dia e mesmo assim zero trade — Cleber pediu pra
investigar o que a IA está levando em conta pra decidir entrada.

## O que foi investigado (dado real, via Supabase MCP — projeto `wyvdsxtcmizettljxtbg`)

Sessão ativa: `41378b46-2a7d-4155-bde0-b3b099df6c1a` (RUNNING/DEMO, criada
2026-08-07, mantida viva pelo cron `ai-runner-tick`, 1x/min).

Consulta em `ai_funnel_snapshots.stage_counts` / `symbol_stage_counts` /
`samples` dos últimos ~20-30min: **BTCUSD avaliado a cada ciclo do cron,
`NO_SIGNAL` em 100% dos ciclos**, mesmo padrão nos outros 5 ativos da sessão
(GER40, EURUSD, SPX500, XAUUSD, XBNUSD). Pouco ruído de `DATA_NOT_REAL`
(fallback `generated` bloqueado corretamente, sem decidir em cima de dado
sintético) e `CANDLES_FETCH_FAILED` esporádico em XAUAUD — não é a causa
principal.

## Causa raiz (não é bug)

`activeStrategyId` da sessão = `"2"` = **"Cruzamento de Médias com Filtro de
Regime"** ([presetStrategies.ts:117-149](src/app/data/presetStrategies.ts:117)):
LONG-only, timeframe 1h, exige **EMA20 cruzar ACIMA da EMA50** (evento
discreto) + **ADX > 20** + **EMA50 inclinada pra cima**.

Cruzamento de médias é indicador atrasado por construção — uma recuperação
em V como a do BTCUSD hoje não produz necessariamente um cruzamento limpo em
1h com ADX>20 logo em seguida. O motor está funcionando exatamente como
desenhado; o comportamento observado bate com a conclusão já fechada no
`CLAUDE.md`/`AI_BRAIN_SPEC.md`: nenhum dos 5 presets tem edge líquido de
custo validado, decisão de produto foi operar pouco de propósito (EV por
trade ≈ −custo com edge ≈ 0).

## Decisão do Cleber

Trocar de preset pra observar comportamento com mais frequência de entrada e
configuração de risco mais agressiva — **experimento em DEMO, não mudança
de código**.

### Preset trocado

`activeStrategyId` de `"2"` pra **`"5"` — "Momentum de Curto Prazo (Scalp)"**
([presetStrategies.ts:232-270](src/app/data/presetStrategies.ts:232)): MACD
cruza acima de zero + RSI 50-70 + ADX>18, timeframe 1m, stop 1×ATR, alvo
1,5×ATR.

⚠️ Aviso já existente no próprio código (não escrito nesta sessão): preset
"candidato, não recomendação" — nunca medido taxa de acerto real por ativo,
nem confirmada latência de execução (conta MetaAPI compartilhada responde em
3-9s, pode consumir o alvo curto antes da ordem sair). Rodar em DEMO é
seguro pra observação; a ressalva vale pra quando/se for pra LIVE.

**Passo crítico**: "Timeframe Operacional" na UI precisa ser setado
manualmente pra `1m` — o motor usa `aiConfig.timeframe` (escolhido na UI),
não o `timeframe` interno do preset. Herdar `1H` do preset "2" anterior
rodaria o Scalp fora do desenho dele.

### Gerenciamento de risco — setado mais agressivo

Bloco "Gerenciamento de Risco" no painel Engineer, campos relevantes:
- **Risco por Trade (%)** — subido (slider 0,1%-10%)
- **Max Drawdown Aceito (%)** — subido (slider 5%-50%), adia o "Lockdown"
- **Modo de Cálculo** de posição — `% Fixo` (não `Ajustado por ATR`) tende a
  gerar posição maior em ativo volátil
- Valores exatos não capturados nesta sessão (configurado pelo Cleber
  diretamente na UI, fora do Claude Code)

Nenhum desses campos muda **se** a IA entra (isso é 100% o filtro de sinal
da estratégia) — só mudam **tamanho e persistência** da posição quando ela
entra. Mais risco não é correção de nenhum problema: mais frequência com EV
≈ −custo é mais variância dos dois lados, ganho e perda, igualmente.

## Próximo passo (retomar quando o Cleber voltar)

Observar via `ai_funnel_snapshots` da sessão `41378b46...`:
- Quantos trades o Scalp realmente executa por hora/dia
- Taxa `NO_SIGNAL` vs antes (deve cair bastante — sinal mais frequente por
  desenho)
- Se `CANDLES_FETCH_FAILED`/`DATA_NOT_REAL` pioram em 1m (janela de dado
  mais sensível a latência/gap)
- Resultado líquido dos trades reais (SL vs TP vs trailing) — primeira
  medição real do preset "5" em produção, nunca antes rodado

Se quiser repetir a consulta:
```sql
select session_id, stage_counts, symbol_stage_counts, samples, created_at
from ai_funnel_snapshots
where session_id = '41378b46-2a7d-4155-bde0-b3b099df6c1a'
order by created_at desc limit 20;
```
