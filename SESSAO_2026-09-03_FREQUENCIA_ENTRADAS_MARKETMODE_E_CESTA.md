# Sessão 2026-09-03 — Ficha do motor, troca de cesta e frequência de entradas

## Resumo da sessão inteira

Ordem real do que aconteceu, do começo ao fim:

0. **Ficha completa do motor de decisão** — Cleber pediu pra entender tudo
   que o LLM Active Brain analisa e "quantos por cento tem de peso".
   Levantamento completo (agente dedicado lendo `agent.ts`/`tools.ts`/
   `atr.ts`/`config.ts`/`assetBasket.ts`/`reasoningValidator.ts`/
   `neuralBridge.ts`/`tradeMemory.ts`) publicado como artifact — ver seção 0
   abaixo pro link e o achado central (não existe peso numérico fixo).
1. **Troca de ativos na cesta** — mudança de **código**, `git commit`
   **ainda pendente** (comando pronto na seção 1, Cleber ainda não rodou).
2. **`marketMode` removido da config** — mudança de **dado no Supabase**
   (SQL direto), não precisa de commit nem de restart.

---

## 0. Ficha completa do motor de decisão (artifact)

Achado central, resposta direta à pergunta "quanto de peso tem cada coisa":
**o motor não usa pesos numéricos fixos** — é um agente LLM local (Ollama)
que raciocina livremente sobre os indicadores reais a cada ciclo, sem score
tipo "MACD vale 20%". O que tem valor numérico exato são os **gates
mecânicos** (código) que cercam esse raciocínio — risco/trade, R:R, stop,
breakeven, trailing, cooldown, tetos de exposição, pyramiding.

Publicado como artifact (link ainda válido na sessão que gerou, não
reproduzido aqui por completo pra não inchar o handoff — se precisar do
conteúdo exato de novo, peço reconstrução a partir de `agent.ts`/`tools.ts`/
`atr.ts`/`config.ts` seguindo a mesma estrutura):

1. Ativos operados (10 símbolos, 2 grupos correlacionados)
2. Indicadores calculados por ciclo (tendência, volume, extension, S/R,
   MACD, Estocástico lento, 10 padrões de candle, regime de mercado) — cada
   um marcado como CONTEXTO (informa o LLM) ou GATE (bloqueia código)
3. Os 14 princípios numerados do prompt de sistema (`GENESIS_PROMPT_MT5`)
4. Gates mecânicos com valor exato (risco 1,0%/trade normal, teto duro 3,0%,
   stop 2,0×ATR, TP 4,0×ATR = R:R 1:2, breakeven 0,5R, trailing 0,8×ATR,
   teto de exposição por grupo US$2.700, cooldown 5 perdas/5min, pyramiding
   máx. 2 reforços, etc. — lista completa no artifact)
5. Campos do Setup do usuário que influenciam o motor (cadência, timeframe,
   marketMode, capital alocado, direção, cesta ativa...)
6. Validador semântico — **desligado hoje** (Ollama local levou 73s pra
   responder um teste, inviável; trava por palavra-chave continua ativa)
7. Memória de trades passados injetada no prompt — texto factual, não
   ML/fine-tuning, efeito ainda não validado estatisticamente

---

## 1. Cesta de ativos trocada (código)

Pedido do Cleber: sai `DOGUSD`/`XRPUSD`, entra `UKOUSD`/`UK100`.

Arquivo: [`llm-active-brain/src/assetBasket.ts:116`](llm-active-brain/src/assetBasket.ts#L116)
(`MT5_ASSET_BASKET`), agora:

```
BTCUSD, XETUSD, BTCXBN, EURUSD, XAUUSD, UKOUSD, GER40, SPX500, NAS100, UK100
```

`UK100` já cai automaticamente no grupo correlacionado dos índices
(`GER40`/`SPX500`/`NAS100`/`UK100`); horário de fim de semana (`WEEKEND_CLOSED_SYMBOLS`)
já cobria os dois símbolos, nenhum ajuste extra necessário ali.

**Risco real, já documentado no próprio código desde 2026-09-01**: `UKOUSD`
tem histórico de ficar **estruturalmente bloqueado** nesta conta pequena — o
lote mínimo do símbolo já excede o teto de 3% de risco por trade
(`mt5MaxRiskPctPerTrade`). Reintroduzido mesmo assim por pedido explícito;
provavelmente o motor vai continuar avaliando o símbolo a cada ciclo mas
recusando toda entrada nele, até o capital alocado subir ou o teto de risco
ser relaxado. Não investigado/corrigido nesta sessão — só sinalizado.

**Pendente**: commit deste diff (comando pronto abaixo). Sem esse commit,
`dev` local está com a cesta nova mas `origin/dev` ainda tem a antiga —
qualquer redeploy/restart a partir do remoto voltaria pra `DOGUSD`/`XRPUSD`.

```bash
cd /Users/clebercouto/Projects/we-expand/Neural-Day-Trader && git add llm-active-brain/src/assetBasket.ts && git commit -m "$(cat <<'EOF'
feat(llm-brain): troca DOGUSD/XRPUSD por UKOUSD/UK100 na cesta

Pedido explícito do Cleber. UKOUSD já documentado como estruturalmente
bloqueado pelo piso de risco mínimo desta conta pequena (2026-09-01) --
reintroduzido mesmo assim, deve continuar recusando entrada até capital
ou teto de risco subir.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## 2. Frequência de entradas — `marketMode` revertido de novo (config, Supabase)

Cleber pediu pra aumentar a frequência de entradas. Investigação (SQL direto
em `ai_user_config`, projeto `wyvdsxtcmizettljxtbg`) achou a causa raiz real:
**`marketMode` estava de volta em `"TREND"`** na config dele — isso bloqueia
**100% das entradas contra-tendência** no gate mecânico de `open_position`
(`tools.ts:1262`), cortando pela metade o universo de setups possíveis.

Isso já tinha sido corrigido **na mesma data**, mais cedo (ver entrada do
topo do `CLAUDE.md`: "[RESOLVIDO 2026-09-03, noite] Motor ficava mudo...").
Voltou sozinho — consistente com o bug já catalogado no projeto: qualquer
aba aberta do app resalva o `aiConfig` inteiro no Supabase a cada mudança de
estado, sobrescrevendo edição feita via SQL sem precisar nem reabrir a tela
de Setup (`useApexLogic.ts` ~linha 872, achado original em
2026-09-02, ver `SESSAO_2026-09-02_VALIDADOR_FAIL_OPEN_RECHECK_STOP_E_DAILYLOSSLIMIT.md`).

Restante da config já estava no teto máximo de frequência, nada mais pra
apertar sem mexer em código:

- `cadence: "AGRESSIVA"` — já avalia entrada nova todo ciclo (10s), o máximo.
- `cooldownEnabled: false` — sem cooldown extra do lado do app.
- `maxTradesPerDay: 0` — sem limite.

**Ação tomada**: `UPDATE` direto removendo a chave `marketMode` da config
(`config = config - 'marketMode'`) — volta a `null`/AUTO. Mudança de dado,
não de código: não precisa de commit, deploy nem restart (cache de config
do `neuralBridge.ts` expira em 60s).

**Pendente/risco real**: se alguma aba do app do Cleber ficar aberta, ela
pode resalvar `marketMode:"TREND"` por cima de novo em segundos, sem
nenhuma ação dele — mesma mitigação de sempre (fechar/recarregar todas as
abas antes de confiar numa edição via SQL nessa tabela). O bug estrutural
em si (app resalvando a config inteira a cada mudança de estado de
qualquer aba) **não foi corrigido**, só contornado de novo.

**Não tocado nesta sessão** (avaliado, mas é trade-off de risco que fica
pra decisão explícita do Cleber se ele achar que ainda está pouco depois de
observar o efeito do fix acima):
- `maxAssets`/`maxPositions` (hoje 4/4, cesta ativa tem 10 símbolos) — teto
  de quantas posições simultâneas cabem, não de quantas são avaliadas.
- Gate de confluência em mercado LATERAL (`tools.ts:1208`, exige ≥2 de 4
  fatores reais alinhados) — afrouxar aumentaria frequência mas reduz uma
  trava de qualidade adicionada deliberadamente depois de um buraco real
  encontrado em 2026-08-29.

## Comandos de referência

```sql
-- Ver config atual do usuário
select user_id, config from ai_user_config where user_id='aeb3ec15-f660-4775-856b-2a04b20f4592';

-- Fix aplicado nesta sessão
update ai_user_config set config = config - 'marketMode'
  where user_id='aeb3ec15-f660-4775-856b-2a04b20f4592';
```
