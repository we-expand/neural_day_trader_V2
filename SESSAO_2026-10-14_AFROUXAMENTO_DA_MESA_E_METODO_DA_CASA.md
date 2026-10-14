# Sessão 2026-10-14 — Afrouxamento da mesa de operações e atualização do Método da Casa

Registro da conversa do dia (10h46 → ~17h BRT). Pedido inicial do Cleber: "a LLM está
restritiva demais; o mercado está bombando e ela não abriu nenhuma posição".

## 1. Diagnóstico (10h46)

Fonte: `llm-active-brain/llm-brain.log` e `reports/desk-2026-10-14.md`.

Entre 05h47 e 10h46 a mesa deliberou ~65 entradas: 1 abriu (JPN225 SHORT, que fechou em SL
com +$2,46 líquido), ~5 foram aprovadas e ~60 rejeitadas. Dois bloqueios:

1. **Piso de valor (US$3 líquidos por US$100) matava toda aprovação com METADE.**
   A mesa aprovava com METADE do tamanho, o ganho caía pela metade ($2,2–2,7 líquido) e o
   piso de $3 recusava. Na prática METADE virava REJEITAR (NAS100 LONG, JPN225 LONG,
   SPX500 SHORT, JPN225 LONG de novo). O cap do alvo de scalp em 0,25% (commit `a08e06032`)
   piorou isso.
2. **Vetos duros da mesa**, num mercado em queda generalizada: `TEMPO_MAIOR_CONTRA` (LONG de
   repique com 1H e 4H em BAIXA), `ESTOCASTICO_EXTREMO_CONTRA`, `MACD_5M_ESGOTANDO`,
   `ALVO_NAO_CABE`. São o "método da casa", não bug.

Dado de contexto (relatório da mesa, amostra pequena): se a mesa aprovasse tudo, 48% das
entradas chegariam no alvo primeiro (IC 29–67%); as rejeições acertaram 57% (12 stops
evitados contra 9 alvos perdidos).

## 2. Mudanças feitas

| # | Mudança | Onde | Reversível por |
|---|---|---|---|
| 1 | Piso de valor proporcional ao corte METADE (piso × `desk.sizeFactor`) | `src/tools.ts` | — |
| 2 | `ALVO_NAO_CABE` deixa de ser veto duro | `src/deskReadings.ts` | `MT5_DESK_TARGET_ROOM_VETO=true` |
| 3 | `TEMPO_MAIOR_CONTRA` deixa de ser veto duro | `src/deskReadings.ts` | `MT5_DESK_HIGHER_TF_VETO=true` |
| 4 | Teto de risco por operação 8% → 10% | `.env` + `src/config.ts` (canonical da governança) | voltar `0.08` |
| 5 | Prompt do Analista de Notícias explica a causa do movimento do dia (ou "causa desconhecida"; choque geopolítico = não operar reversão) | `src/desk.ts` | — |
| 6 | Piso de ganho líquido 3,0 → 2,5 → **3,6** por US$100 | `.env` (`MT5_MIN_NET_REWARD_PER_REFERENCE_USD`) | voltar valor |
| 7 | Ganho bruto de referência $5,50 → **$7,00** por US$100 (compensar no contrato) | `.env` (`MT5_TARGET_REWARD_USD`) | voltar valor |

Itens 6 (3,6) e 7 estão só no `.env` (local, fora do git) e dependem de `./restart.sh`.
Cálculo que justificou o 7: para passar o piso de $3,60, o ganho bruto precisa ser $3,60 + custo;
UKOUSD (custo ~$2,5) precisa de ~$6,1 e XETUSD (~$2) de ~$5,6. Com $7,00 o risco por entrada
sobe de ~$6,6 para ~$8,4 (stop 0,30% / alvo 0,25%), abaixo do teto de $10.

Achado sobre contrato/tamanho: o sizing já compensa alvo curto com mais lotes
(`lots = targetRewardUsd / (alvo% × LOT_SIZE × preço)`). Limites reais: teto de risco por
operação e "Lotes máximos por trade" do Setup (hoje 1; config do Cleber no Supabase, a
mudar pela tela do AI Trader). Mais lote não resolve XETUSD/SOLUSD no piso de R:R 0,5
(alvo 0,25% contra stop ~0,8%).

## 3. Método da casa (`llm-active-brain/METODO_DA_CASA.md`)

O arquivo é relido a cada deliberação (sem restart). Edições do dia, ditadas pelo Cleber:

- **Regra 5 (estocástico tem ESTADO).** %K > %D = modo de compra; %K < %D = modo de venda.
  Vender em modo de compra (ou comprar em modo de venda) só depois de um NOVO cruzamento a
  favor do lado. Vale em todos os tempos (5m, 15m, 1H), sem exceção, e C/D/E não substituem.
  Continua: nunca vende em sobrevenda, nunca compra em sobrecompra. (O veto em código
  `ESTOCASTICO_EXTREMO_CONTRA` ainda olha só o nível, não o cruzamento.)
- **Regra 4.** Por que o cruzamento rende pontos: depois dele o estocástico só vira ao chegar
  no extremo oposto; é regra de via geral, "sentir o mercado". (Cleber: isso vale mais para
  operações de médios/grandes pontos; no scalp de hoje é só contexto — o alvo continua curto.)
- **Nova seção "Rompimento de topo/fundo".** Sempre observar rompimento; rompeu = modo
  expansão. Em expansão o estocástico cruza várias vezes no extremo sem reverter: cruzamento
  contra a expansão é ruído, não gatilho; não se opera reversão, só a favor do dia; só o
  Fibonacci mede até onde vai (degraus), e com ele a expansão também é oportunidade.
- **Nova seção "Notícias".** Entender o porquê de forte alta/queda; choque geopolítico/macro
  pode derrubar mercados vizinhos e acionar circuit breaker (não operar reversão); se a causa
  não aparece nas manchetes, dizer "desconhecida" (nunca inventar).
- **Regra 11 reescrita.** "Entre sempre que tiver convicção, não importando o número de
  entradas diárias, mas com certeza! Entre para matar! Sem convicção não se entra."
- **Regra 12.** Reforçado: alvo CURTO justifica a entrada (condição de ter espaço até o próximo
  nível mantida). Regras 8–10 e 13 intactas.

Explicação dada ao Cleber sobre a regra 5 original ("veto contra o lado oposto"): em
sobrecompra o veto é contra COMPRAR; em sobrevenda, contra VENDER. Não obriga a operar o
outro lado.

## 4. A entrada do dia: JPN225 LONG (reversão em dia de expansão)

- 15h20 BRT, trade `826ee3d7-6e82-4b0f-b9aa-5e851e9a8f59`: JPN225 LONG, entrada 66.770,88,
  stop 66.570,57 (0,30%), alvo 66.937,81 (0,25%), 0,5 lote, risco $3,26, retorno $2,72,
  confiança 78%, aprovada pela mesa com METADE (gatilho B: estocástico 1H cruzando para
  cima). Primeira aprovação com METADE que passou o piso depois da correção.
- O Cleber mediu um Fibonacci próprio no JPN225: primeiro degrau em **66.299,04** (ainda não
  tinha batido no terceiro). Pela leitura dele, o dia era de expansão de queda e o LONG era
  uma reversão, o tipo de trade que o método evita; os cruzamentos para cima embaixo eram
  ruído.
- Ele fechou manualmente (`exit_reason=MANUAL`) a 66.602,93: **-$2,93 líquido** (o stop
  teria dado ~-$3,26). Entrada anterior às regras de expansão, Fibonacci e notícias.

## 5. Acompanhamento de 30 em 30 minutos (cron :17 e :47, só nesta sessão)

Reportado em relatórios completos; todos sem deliberação aprovada até o JPN225 LONG.

| Relatório | Fato principal |
|---|---|
| 11h49 | 1 deliberação, 5 recusas do piso (UKOUSD $2,90, SPX500 $2,93 por centavos) |
| 12h19 | NVIDIA com Connection error; vazão baixa (14 ciclos) |
| 12h49 | 4 rejeições, 7 recusas do piso |
| 13h19 | 9 rejeições, 18 recusas do piso; vazão normalizada |
| 13h49 | 13 rejeições, 26 recusas do piso |
| 14h19 | 16 rejeições, 36 recusas do piso; 81% das rejeições = LONG de repique contra 1H/4H |
| 14h49 | 18 rejeições, 47 recusas do piso, nenhuma entrada |
| 15h19 | restart às 15h15 (log zerado); 0 deliberações |
| 15h49 | primeira entrada (JPN225 LONG, METADE) aprovada às 15h20 |
| 16h19 | restart às 16h08; 1 rejeição (EURUSD SHORT, alvo bloqueado por suporte do 4H a 0,247%) |

Padrão observado: a IA reenviava o mesmo LONG de repique (JPN225/NAS100/SPX500) várias vezes,
16 chamadas de LLM por deliberação, sempre vetado por um veto já calculado por código.
Candidato (não feito): filtro antes da mesa.

## 6. Outras verificações

- Migration `20260923_market_spread_samples.sql`: aplicada (tabela com 30.707 linhas).
  Timeouts do `spreadCollector` no log são pontuais; o custo cai na tabela estática.
- `npm run validate`: passa (37 asserções, 0 falhas). A nota sobre falha de bundling no
  `CLAUDE.md` está desatualizada.
- Fora do tema: dúvida sobre o microfone do app (segurar o botão com o mouse; ditado do macOS
  como alternativa; atalho nativo do app não confirmado).

## 7. Commits da sessão

`34df7db08`, `7d6ea69a7`, `072e9510d` (código e método), `c8754560f` (regra 11).
Sem commit: `.env` (local). `SESSAO_2026-10-13_...md` já estava modificado antes da sessão.

## 8. Pendências

1. `./restart.sh` (dentro de `llm-active-brain/`) para valer piso $3,60 e ganho de referência $7,00.
2. Decisões do Cleber, sem nada feito:
   - Fibonacci e "modo expansão" calculados por código (hoje só texto; precisa do desenho dele:
     topo, fundo e degraus).
   - Veto de estocástico por cruzamento em código, e se vale só no 5m ou também 15m/1H.
   - Piso de R:R (0,5) em XETUSD/SOLUSD (alvo 0,25% × stop ~0,8%).
   - Regra 12 do método (suavizar para preferência se continuar barrando quase tudo).
   - "Lotes máximos por trade" do Setup (hoje 1).
   - Filtro antes da mesa para propostas repetidas já vetadas por código.
   - Decidir os "$3 por entrada" com ~20 entradas sob o teto de 10%.
3. Amostra do dia: 1 entrada da IA (perdida, fechada manualmente). Nada das mudanças de hoje
   tem base estatística ainda; sem promessa de lucro.

## 9. Observações de método

- Mudanças de risco (teto 10%, piso 3,6, ganho 7,0) pedidas pelo Cleber; rollback sempre pelo
  `.env`. Congelamento de 07/10 já havia sido levantado por ele.
- Regra do projeto mantida: nada commitado nem reiniciado sem pedido; commits e restart
  executados pelo Cleber.
