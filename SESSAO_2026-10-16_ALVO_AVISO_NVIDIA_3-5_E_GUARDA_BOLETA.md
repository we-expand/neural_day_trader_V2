# Sessão 2026-10-16 — "A LLM não abre nenhuma posição" → 3 causas, 3 ações

Contexto de abertura: Cleber alarmado às ~13h44 (BRT) — a IA não tinha aberto
**nenhuma** posição no dia ("tem que abrir no mínimo 11 por dia"). Esta sessão
investigou ao vivo e entregou 3 mudanças. Nenhum `./restart.sh` nem `git commit`
foi rodado por Claude (regra fixa do projeto) — comandos entregues ao Cleber.

---

## Diagnóstico inicial (por que zero entradas)

Motor rodando normal (1 instância). Em ~22 ciclos desde o meio-dia, o "zero
entradas" tinha **duas causas simultâneas**, nenhuma era bug de motor:

1. **Agente de alvo AO VIVO (ligado ontem, 16/10) recusando por projeto.** A
   única proposta aprovada pela Mesa no dia (UKOUSD LONG, convicção 65) foi
   morta pelo agente de alvo: resistência do 4H colada (0,021%) → alvo que cabe
   = 0,019% contra stop 0,185% → **R:R 0,10:1** → recusada. É exatamente o que o
   replay previu ("espere MENOS entradas"). Só bloqueou **1** entrada no dia.
2. **NVIDIA engasgando (causa dominante do dia).** 29 falhas em 22 ciclos: 12
   erros de conexão, 8× 429, 9× 502/503/504. 21 das 29 eram puramente do lado da
   NVIDIA. A maioria das candidatas morria no provedor antes de chegar na Mesa.

Agravante estrutural: a **Mesa gasta ~36 chamadas de LLM por entrada** (14
analistas + réplicas + Master). O limitador `MT5_DESK_MAX_CALLS_PER_MIN` está em
30 (default), mas a conta NVIDIA aguentava bem menos → saturava e batia 429.

---

## Ação 1 — Agente de alvo vira AVISO (não bloqueia)

Pedido do Cleber: "ele não tem que bloquear nada". Em
[`tools.ts:3233`](llm-active-brain/src/tools.ts): quando o alvo que cabe não paga
o piso de valor/R:R, antes era `return error` (bloqueava). Agora registra o aviso
(`[ALVO-AGENTE] AVISO (nao bloqueia)` + `deskSnapshot.targetAgentWarning`) e deixa
a entrada seguir com o alvo que cabe e o stop que acompanha. Rollback para
bloqueio: `MT5_TARGET_AGENT_ENFORCE=true`.
- `tsc --noEmit` limpo (EXIT=0).
- **Commit `bf0216882` — já commitado e pushado (`origin/dev`) pelo Cleber.**

## Ação 2 — Troca do modelo NVIDIA (resolveu o engasgo)

Investigação ao vivo da NVIDIA: teste direto na API deu 429 instantâneo em 2 de
3 chamadas (modelo saudável quando responde, ~0,8s — é teto de taxa por modelo,
não servidor caído). Listados os modelos da chave: existe a família **3.5** mais
nova. Testes ao vivo:
- `nemotron-3.5-super-vl-120b-a12b` (NOVO, topo): **3/3 OK, zero 429**, ~0,7s.
- `nemotron-3.5-lightning-30b-a3b`: 3/3 OK mas lento (6–25s, é reasoning).
- `nemotron-3-super-120b-a12b` (ATUAL): 2/3 OK, 1× 429.

**Tool-calling validado** no 3.5-super-vl (3/3: `finish_reason: tool_calls`,
função e args corretos). Trocado `LLM_MODEL` em
[`llm-active-brain/.env`](llm-active-brain/.env) (linha antiga comentada pra
rollback). Como `MT5_DESK_MODEL` está vazio, a troca cobre cérebro + Mesa +
validador de uma vez. `.env` não versiona (gitignored) — vale a partir do restart,
que o Cleber rodou (~14:09 local).
- **Confirmado ao vivo após restart:** ~1h51 de motor, **0 erros de 429/
  INDISPONÍVEL**, Mesas completas rodando (16-17 chamadas cada) sem engasgo.

## Ação 3 — Alertas do guarda da boleta manual deixam de interromper

Cleber mostrou print: a boleta manual (compra de BTCUSD sem stop, 1H sobrecomprado
%K 84) disparou o guarda-costas (de 15/10). Expliquei que eram 2 **ALERTAS** (não
bloqueio) — a ordem sai com 2ª confirmação. Ele pediu pra **retirar o guarda**.
Confirmado o alcance (AskUserQuestion): **só os alertas**, mantendo a trava de
perda diária.

Em [`OrderTicket.tsx:544`](src/app/components/trading/OrderTicket.tsx): os alertas
não mostram mais o pop-up de 2ª confirmação — a ordem sai direto. Mantidos:
- O **BLOQUEIO** de limite de perda diária (único severity BLOQUEIO).
- O **registro** em `manual_order_guard_log` (auditoria/análise preservada).
- O painel de aviso continua no código (não acionado) pra rollback.
- `tsc --noEmit` sem erro novo em `OrderTicket.tsx` (total 572 = ruído pré-existente).
- **Commit pendente** (comando entregue): frontend, Vercel deploya no push, sem
  restart do motor. Cleber confirma o deploy sozinho.

---

## Achado de método (não é bug), decisão do Cleber: NÃO mexer nos vetos

Depois da NVIDIA resolvida, o motor seguiu **0 aberturas em ~2h** — mas agora por
**seletividade legítima**, não por infra. Todas as candidatas rejeitadas por veto
duro (estocástico extremo). Listei os **6 vetos duros** de
[`computeHardVetoes`](llm-active-brain/src/deskReadings.ts) pro Cleber:

| Veto | Estado | Observação |
|---|---|---|
| `ESTOCASTICO_EXTREMO_CONTRA` | **ON** (sem flag) | **único que disparou hoje**; aplica em 5m+15m+1H |
| `MACD_5M_ESGOTANDO` | **ON** (sem flag) | não entrar no fim do impulso |
| `EXTREMO_DO_DIA_CONTRA` | **ON** (sem flag) | não vender na mínima / comprar na máxima |
| `TEMPO_MAIOR_CONTRA` | OFF (`MT5_DESK_HIGHER_TF_VETO`) | desligado em 14/10 |
| `CONTRA_CORREDOR_FIBONACCI` | OFF (`MT5_DESK_FIB_CORRIDOR_VETO=false`) | — |
| `ALVO_NAO_CABE` | OFF (`MT5_DESK_TARGET_ROOM_VETO`) | virou o agente de alvo em tools.ts |

Recomendei (opção A) estreitar o estocástico pra só o 5m. **Cleber decidiu NÃO
mexer** — "deixa do jeito que está". Afrouxar iria contra a regra operacional
dele próprio ("na dúvida fica fora, nunca comprar esticado"), sem validação de que
entra lucro. Registro o número "11/dia": o próprio projeto já mediu teto realista
de ~2-6/dia com líquido positivo (ver pendência 0 do CLAUDE.md).

---

## Pendências pro Cleber

1. **Rodar o commit da Ação 3** (guarda da boleta → alertas não interrompem) +
   `git push origin dev`; confirmar o deploy pela URL do `dev`.
2. **Confirmar a 1ª entrada aberta de verdade** sob o modelo novo — o teste foi de
   Mesas completas sem 429, mas nenhuma posição abriu ainda (seletividade).
3. **Próximo passo de verdade (não feito):** enxugar a Mesa pra ela não gastar 36
   chamadas por entrada — é o gargalo de raiz; qualquer provedor sofre com esse
   apetite. Decisão de desenho do Cleber.
4. Se a NVIDIA voltar a dar 429 no modelo novo: testar outro modelo da chave
   (`curl .../v1/models`) antes de cair pro Ollama local. Ver memória
   `project_nvidia_modelo_3-5_super_vl`.

## Rollbacks
- Agente de alvo volta a bloquear: `MT5_TARGET_AGENT_ENFORCE=true`.
- Modelo: descomentar `nemotron-3-super-120b-a12b` no `.env`, comentar o 3.5.
- Guarda da boleta: o painel de aviso segue no código, reverter o diff de
  `OrderTicket.tsx:544` religa a 2ª confirmação.

---

# Parte 2 (noite, ~19h-23h BRT): modo fim de semana, "a LLM não abre posição" e a regra "1H decide o lado"

## Diagnóstico (log desde o restart das 14h09, 116 ciclos)
- A LLM não estava quebrada: 116 `stop` contra 9 tentativas de `open_position`, 0 aprovações da Mesa. Gatilhos de estocástico 5m
  chegavam em zona neutra, com 1H contra e MACD virando → "sem confluência". É o método do Cleber (na dúvida fica fora).
- Desperdício real: no fim de semana a cesta ainda tinha índices/petróleo/EURUSD fechados (tick parado 1-2h); a Mesa chegou a ser
  convocada para SPX500/UK100 com tick obsoleto (~36 chamadas de LLM, analista de 47s). Cleber refez a cesta: **só cripto**.
- BATUSD estava no Setup mas fora de `assetBasket.ts` (ignorado em silêncio, só aviso no log). Cleber removeu do Setup.
- R:R de 0,37:1 barrava o BTC (alvo 0,222% x stop 0,597%): o agente de alvo encurtava o alvo e o stop do fim de semana
  (0,95x ATR) não acompanhava.

## Mudanças (todas em `llm-active-brain/`)
1. **Stop do fim de semana acompanha o alvo** (`src/tools.ts`, bloco `[ALVO-AGENTE]`): antes só no dia útil e só com
   `targetPoints=POUCOS`. Rollback: `MT5_WEEKEND_STOP_FOLLOWS_TARGET=false`. Commit `99c2e1ef1` (já em `origin/dev`).
2. **Vigia ignora ativo com tick parado >60s** (`src/watcher.ts`; antes só o corte de 120s do broker).
   Rollback: `MT5_WATCHER_MAX_TICK_AGE_S=0`. Mesmo commit `99c2e1ef1`.
3. **Ganho-alvo por entrada 7 → 10 US$** (`.env`, `MT5_TARGET_REWARD_USD=10.0`, não vai pro git). Motivo: a 1ª entrada
   (BTCUSD SHORT) saiu com 0,01 lote (mínimo), risco US$1,63, retorno projetado US$2,42; 7 x METADE da Mesa = 3,5 → 0,0145 lote
   → arredonda pra 0,01. Com 10 o BTC vai a ~0,02 lote (~US$4-5). Cleber: "não tenha medo de botar contrato". Tetos de risco
   (10%/trade, 25%/dia) seguem valendo. Rollback: voltar a 7.0.
4. **A 1H decide o lado; 5m/15m só consulta de entrada** (`src/atr.ts` `computeMarketDirection` + `getHigherTimeframeChain`,
   `src/tools.ts` nos 2 call sites, `src/agent.ts` princípio 0 do prompt). Pedido do Cleber: a LLM se confundia entre 1H e 5m.
   - 1ª versão usava o rótulo de preço da 1H (24 velas) e dava BAIXA enquanto o MACD 1H e o 4H estavam em COMPRA. Cleber
     apontou o erro; corrigido: **lado = MACD da 1H** (ALTA só compra, BAIXA só vende, neutro = INDEFINIDO). **4H fica de
     fora** por decisão do Cleber ("use somente o de uma hora"). O gate `VEREDITO_DIRECAO` em `tools.ts` bloqueia lado contra a
     1H, salvo `setupType=REVERSAO` com confirmação real. O 5m aparece no `agreement` como "a favor / contra a 1H, só consulta".
   - Rollbacks: `MT5_DIRECTION_BY_1H=false` (volta 5m+1H), `MT5_DIRECTION_CHAIN_MACD=false` (usa o rótulo de preço da 1H).
   - Visto ao vivo no log: `Lado pela 1H: 1H BAIXA [MACD 1H BAIXA, MACD 4H neutro] ... 5m ALTA (contra a 1H, so consulta)`.
   - **Commit pendente do Cleber**: `atr.ts`, `tools.ts`, `agent.ts` (comandos entregues). Motor reiniciado com a regra no ar.
   - Aviso registrado ao Cleber: a 1H como previsão de lado deu 47-50% em 2 anos (memória `project_leitura_de_lado_1h_descricao_vs_previsao`);
     é regra de método dele, não edge comprovado.

## Observações
- 1ª entrada do fim de semana: **BTCUSD SHORT** 22:29Z, aprovada pela Mesa com METADE (convicção 55), alvo 0,400→0,296%, stop
  0,200% (piso de fim de semana, não derivado do alvo). Abriu ANTES da regra da 1H e contra o MACD de 1H/4H em compra; o
  fechamento discricionário da IA está suspenso, então só sai por stop/alvo. Cleber duvida que ganhe.
- Cleber pediu pra ordem manual de teste (perda) ser desconsiderada nas leituras.
- Mesa: SPX500 LONG rejeitado pelo Master (1H/4H em baixa); UK100/GER40/EURUSD LONG com veto duro de estocástico.
- NVIDIA: erros de conexão ocasionais, 3.5-super-vl segue sem 429 sustentado.

## Pendente
1. Cleber rodar o commit de `atr.ts`/`tools.ts`/`agent.ts` (+ `git push origin dev`).
2. Medir a frequência de entradas no fim de semana (teto medido ~2-6/dia; zero em dia lateral é coerente com o método).
3. Conferir a 1ª entrada sob a regra da 1H e o lote maior (0,02) com ganho-alvo 10.
4. Commit do `OrderTicket.tsx` (boleta) ainda pendente da Parte 1.
5. Decisão aberta: o que fazer se a LLM seguir sem entradas — afrouxar o gatilho (só 5m / zona neutra) é decisão do Cleber, que já
   decidiu manter os vetos hoje.
