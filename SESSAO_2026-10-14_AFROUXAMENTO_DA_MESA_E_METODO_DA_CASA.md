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

---

# Parte 2 (tarde/noite): corredor de Fibonacci, testes e modo expansão em sombra

## Regras novas do Cleber (todas em `METODO_DA_CASA.md`)
- Estocástico tem estado; nova cruza no extremo LIBERA a entrada (agora também no código: `readStochastic`).
- Rompimento de topo/fundo = modo expansão: não se opera reversão; cruzamentos contra a expansão são ruído.
- Notícias: entender o porquê do movimento; sem causa conhecida o gráfico é a única medida; avisar o usuário.
- Gatilhos F (rompimento de degrau do Fibonacci com fechamento de candle, entra e protege), G (entrada após o ajuste
  com nova cruza) e D ampliado (média de 9/20 como lugar, estocástico como hora; "é combinação").
- Regra 11: "Entre sempre que tiver convicção... Entre para matar!"; regra 12: alvo curto no scalp.
- Prompt do Analista de Notícias (`desk.ts`) agora explica a causa do movimento do dia ou diz "causa desconhecida".

## Fibonacci (código)
- `src/fibCorridor.ts`: perna = máxima da perna (A) até a mínima da perna (B = menor mínimo seguido de repique
  >= 30% da perna); 0 em B; degraus 61,8% / 100% / 161,8% de extensão (espelho para alta).
- `src/fibLive.ts` + `getDeepCandles` (atr.ts): 15m (janela 96) e 1H (janela 72), 15m vale até esgotar, depois 1H.
- Conferência com o desenho do Cleber no JPN225 1H: B=67.107 (dele ~67.113), 61,8% em 65.739 (dele 65.803, ~0,1%).
- Entregue à mesa como "CORREDOR DE FIBONACCI" no placar. Veto `CONTRA_CORREDOR_FIBONACCI` implementado mas
  **desligado** (`MT5_DESK_FIB_CORRIDOR_VETO=false`) após os backtests.

## Backtests (Binance 1H, 2 anos, BTC/ETH/SOL, sem look-ahead) -- `scripts/fib-backtest*.ts`
- Teste 1: após fechar além do 61,8%, o preço toca o 100% em 48h em 87-91% (queda) contra 81-83% do acaso.
- Teste 2 (com invalidação no 0): alvo antes da invalidação 72-84% contra 74-77% do passeio aleatório; média em R
  perto de zero, antes de custos. Conclusão: o corredor é um bom MAPA, mas NÃO mostrou vantagem estatística
  relevante sobre o acaso. Limites: cripto (não índices), perna por regra (não pelo olho do Cleber), sem custos.

## Modo expansão (sombra)
- `src/expansionPlan.ts`: alvo no próximo degrau, invalidação no 0, reentradas a cada 0,15% (máx. 3), proteção no
  preço de entrada após a 1ª reentrada, redução de 50% aos 90% do caminho. Só registra
  (`ledger/expansion_shadow.jsonl`, log `[EXPANSAO-SOMBRA]`); NUNCA altera decisão nem ordem.
- `scripts/expansion-shadow-report.ts` compara, com velas de 1m, o plano de expansão contra o scalp proposto.
- Env opcionais: `MT5_EXPANSION_SPACING_PCT`, `MT5_EXPANSION_MAX_REENTRIES`, `MT5_EXPANSION_REDUCE_AT`,
  `MT5_EXPANSION_REDUCE_FRACTION`.

## Posição manual observada (JPN225 SHORT)
- 17h52 BRT, entrada 66.365,10, alvo 65.763,54 (sem stop registrado); leitura das 18h01: preço 66.365,60 (empate).
  O 61,8% do 1H calculado pelo código (65.739) fica a ~24 pts do alvo do Cleber.

## Pendências
1. `./restart.sh` (Fibonacci, regra de cruza, plano de expansão em sombra) e commit dos arquivos novos.
2. Aviso na tela ao usuário (expansão forte sem causa identificada): não feito (frontend + canal de dados).
3. Testar o corredor em índices (JPN225/NAS100); decidir se o modo expansão sai da sombra (precisa de dezenas de planos).
4. Descoberta: o motor abriu uma sessão nova às 16h34 (`bded0510...`); consultas devem usar a sessão RUNNING atual.

---

# Parte 3 (noite): modo expansão ao vivo, notícias, médias e correção do limite do método

## Modo expansão AO VIVO (código em `tools.ts`)
- Com a entrada A FAVOR de uma expansão (corredor de Fibonacci rompido, degrau pela frente a >= 0,2% do preço), o alvo
  da ordem vai em cima do PRÓXIMO DEGRAU (em vez do scalp de 0,25%); o stop continua o mesmo; o lote acompanha o alvo.
  Travas liberadas: R:R mínimo e piso de valor. Na mesa (`deskReadings.ts`) ficam liberados, a favor da expansão, os
  vetos de estocástico em extremo, MACD esgotando e extremo do dia. Flags: `MT5_EXPANSION_LIVE` (true),
  `MT5_DESK_EXPANSION_RELEASES_VETOES`, `MT5_EXPANSION_MIN_TARGET_PCT`. Veto contra o corredor
  (`MT5_DESK_FIB_CORRIDOR_VETO`) está DESLIGADO (backtest sem vantagem sobre o acaso).
- Reentrada após stop, reforço por degrau e redução perto do degrau continuam só em SOMBRA
  (`expansionPlan.ts`, `ledger/expansion_shadow.jsonl`, `scripts/expansion-shadow-report.ts` simula também
  "scalp + reentrada automática").

## Backtests da noite (cripto, 1H, 2 anos, antes de custos)
- Fibonacci 61,8% -> 100%: 72-84% de acerto contra 74-77% do acaso: sem vantagem relevante.
- Volta à média de 9 depois de esticar 2+ ATR: 86-91% em 12h (parte estrutural: a média anda até o preço).
- 1º toque na média de 9 DENTRO de expansão: continua no sentido da tendência em 69-73% (1 ATR, 12h) contra ~53%
  fora de expansão (viés de pavio/fechamento achado e corrigido antes de reportar). É o achado mais forte do dia:
  o valor está na reentrada na média (gatilho D), não no degrau como alvo. Falta testar com custos e em índices.

## Notícias
- `news.ts`: cache de 3 h -> 2 min (`MT5_NEWS_CACHE_SECONDS`), idade em minutos, log só de manchete nova.
- `newsWatch.ts`: vigia de choque em RSS gratuito (BBC, Al Jazeera, CNBC, MarketWatch, Fed, Google News), ~90 s,
  classificação por palavra-chave (GRAVE/ALTA), manchete tratada como DADO nunca instrução, `ledger/news_shocks.jsonl`,
  bloco "VIGIA DE NOTÍCIAS" no cabeçalho da mesa. Só informa; não bloqueia. Sem budget para API paga por enquanto.
- `CONTEXTO_DO_DIA.md`: o Cleber escreve as notícias que acompanha (internet/rádio); a mesa lê a cada deliberação,
  ignora se tiver mais de 2 dias (linha `DATA: AAAA-MM-DD`). Preenchido com o CPI/IA de 14/10 (relatado, não verificado).
- Prompt do Analista de Notícias explica a causa do movimento do dia ou diz "causa desconhecida".
- Pendente de resposta do Cleber: o alerta de choque deve BLOQUEAR entradas contra o choque por um tempo? Aviso na tela?

## Médias móveis (gatilho D) e estudo resumido
- `maTrigger.ts`: leitura calculada (15m e 1H): tendência (9 separada da 20 em >= 0,25 ATR), REJEIÇÃO na 9/20 (favorece
  reentrada a favor), ROMPEU a 9 (alerta, não é só repique), ROMPEU a 20 (saiu da tendência), SEM_TOQUE. Entregue ao
  placar da mesa junto do corredor de Fibonacci. `describeExpansionAverages` (fibCorridor.ts): 9 rompida e 20 fora
  da base do corredor = expansão acabando (volta ao modo tradicional).
- Seção "Estudo resumido: médias móveis e Fibonacci" no `METODO_DA_CASA.md` (pesquisa na internet: Fibonacci mede
  espaço/alvo, médias dão o lugar, estocástico a hora; estudos de retração não acharam diferença para níveis aleatórios).
- BUG achado e corrigido: o carregador do método lia só 4.000 caracteres (o arquivo já tinha 8.898), então a mesa não
  via a metade final. Agora `MT5_DESK_METHOD_MAX_CHARS` (16.000) e aviso no log quando passa de 85% do limite.
  Regra de manutenção: ao se aproximar do limite, ENXUGAR e reorganizar, não só subir o limite.

## Horários medidos (candles reais da Infinox, 9 dias úteis)
- Pausa diária de índices (SPX500, NAS100, JPN225): última vela 17h45 BRT, volta 19h00 BRT (18h-19h BRT = 00h-01h do
  servidor GMT+3); sexta fecha 17h45 e reabre domingo 19h00. UKOUSD (petróleo) volta só às 21h00. A página da Infinox
  não lista o JPN225; a fonte oficial é a "Especificação" do MT5. Medido, não oficial.

## Posição manual observada (JPN225 SHORT a 66.365,10, alvo 65.763,54, sem stop registrado)
- Leituras de 5 em 5 min das 17h56 às 18h46: preço congelado em 66.365,60 durante a pausa (-0,5 pt). O 61,8% do 1H
  calculado pelo código (65.739) fica a ~24 pts do alvo do Cleber. Sem alertas.

## Valores no `.env` (local, fora do git)
`MT5_MAX_RISK_PCT_PER_TRADE=0.10`, `MT5_MIN_NET_REWARD_PER_REFERENCE_USD=3.6`, `MT5_TARGET_REWARD_USD=7.0`,
`MT5_DESK_FIB_CORRIDOR_VETO=false`, `MT5_EXPANSION_LIVE=true`.

## Pendências
1. Commit dos arquivos pendentes e `./restart.sh` (o Cleber está reiniciando).
2. Decidir: alerta de choque bloqueia entradas? aviso na tela? reentrada/reforço/redução saem da sombra?
3. Testar o gatilho da média de 9 com custos e em índices antes de torná-lo mais agressivo.
4. O Cleber vai alimentar mais regras: manter o método curto e legível (limite de leitura 16.000 caracteres).
