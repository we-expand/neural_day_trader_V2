# Sessão 2026-09-03 — Cesta trocada + frequência de entradas (marketMode)

## Resumo rápido

Duas mudanças nesta sessão, de natureza diferente:

1. **Troca de ativos na cesta** — mudança de **código**, `git commit` pendente.
2. **`marketMode` removido da config** — mudança de **dado no Supabase**
   (SQL direto), não precisa de commit nem de restart.

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
