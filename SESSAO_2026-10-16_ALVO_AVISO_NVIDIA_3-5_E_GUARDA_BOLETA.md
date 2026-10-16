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
