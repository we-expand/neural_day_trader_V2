# Sessão 2026-09-08 — Checagem de saúde do LLM Brain + catálogo dos gates de entrada

## 1. Motor rodando perfeitamente — confirmado ao vivo

Checagem pedida pelo Cleber ("Veja se a LLM está rodando perfeitamente"),
tudo verificado direto no processo/log, nada por suposição:

- **Processo único** do `llm-active-brain` rodando (PID 99380 no momento da
  checagem), sem duplicata — `ps aux | grep "tsx src/index.ts"` confirmou 1
  só. Watchdog (`watchdog.sh`) ativo supervisionando.
- **Log vivo e recente**: cotando ativos reais (JPN225, XETUSD, SOLUSD...)
  com tick fresco (`stale:false`, idade de 2-11s) — não travado.
- **Nenhum erro real** nas últimas centenas de linhas (`grep -iE
  "error|erro|fail|exception|timeout|abort|deadlock"` sem nenhum
  TypeError/ReferenceError/ECONNREFUSED/ENOTFOUND/Unhandled/fatal) — só
  recusas normais de gates de risco, que é o motor funcionando como
  projetado, não bug.
- Gates de confiança/R:R/exposição bloqueando entradas fracas
  corretamente ao vivo (ex: recusou UKOUSD SHORT com só 1 fator
  confirmando em mercado lateral; recusou entrada que estouraria o teto
  de $2.700 do grupo correlacionado GER40/SPX500/NAS100/UK100/FRA40/
  AUS200/JPN225/HKG33/CHINA50).

Nenhuma mudança de código nesta sessão — foi só diagnóstico.

## 2. Catálogo completo dos gates que bloqueiam `open_position`

A pedido do Cleber, levantada a lista de TUDO que pode impedir uma entrada
nova no `open_position` (`llm-active-brain/src/tools.ts`), na ordem real em
que o código checa (linhas ~901-1793 no momento desta sessão):

**Controle/produto (Setup do usuário):**
1. IA desligada (sessão `STOPPED` no Setup).
2. Cadência de entrada (Conservadora/Normal/Agressiva) — restringe em quais
   ciclos avalia entrada nova.
3. Teto de frequência 24h — nº máx. de entradas na janela deslizante (dia
   útil vs. fim de semana).
4. Confiança mínima — `confidence` declarado < 75%
   (`MIN_CONFIDENCE_FOR_OPEN_POSITION`).
5. Símbolo fora da cesta ativa do usuário.
6. Direção travada (LONG/SHORT fixo no Setup) — bloqueia o lado oposto.
7. Limite de perda diária (%) já atingido hoje.
8. Mercado fechado (calendário forex/CFD de fim de semana).
9. Fluxo de Operação do Setup: "A Favor" bloqueia contra-tendência,
   "Contra" bloqueia a favor.

**Disciplina de raciocínio:**
10. `get_mt5_quote` não chamado neste ciclo para o símbolo — impede decisão
    sem dado real e atual.
11. Contradição por palavra-chave no próprio `reasoning` (nega a entrada e
    abre mesmo assim).
12. Contradição semântica (validador LLM secundário,
    `reasoningValidator.ts`).

**Estrutura de posição/exposição:**
13. Posição oposta já aberta no mesmo símbolo (não permite LONG+SHORT
    simultâneos).
14. Teto por símbolo (máx. 5 posições no mesmo ativo).
15. Teto de posições abertas total (Setup).
16. Teto de ativos simultâneos distintos (Setup).
17. Teto de exposição do grupo correlacionado (ex: índices GER40/SPX500/
    NAS100/.../HKG33/CHINA50 somados) — checado 2x, antes e depois de
    calcular o tamanho real da entrada.
18. Circuito de perda consecutiva — N perdas seguidas no mesmo símbolo+lado
    dentro da janela de cooldown.

**Qualidade da cotação:**
19. Sem cotação real disponível.
20. Cotação obsoleta (`stale`, tick "morto").
21. Spread acima do teto (`SPREAD_BLOCK_PCT`).
22. Preço idêntico a posição já aberta (indício de feed travado).

**Confluência técnica (MACD/Estocástico/Volume/Candle):**
23. Mercado LATERAL com menos fatores reais alinhados que o exigido (2 em
    dia útil, 1 em fim de semana — MACD, Estocástico extremo, volume
    elevado, padrão de candle).
24. Contra-tendência sem confirmação (nem volume elevado nem Estocástico
    em extremo) quando não há `marketMode` fixado no Setup.

**Risco/retorno (stop e alvo):**
25. Stop alargado pelo spread excede o teto máximo — sem margem real
    possível.
26. Alvo capado por suporte/resistência deixa R:R abaixo do mínimo
    exigido.
27. Alvo capado por regime ESTREITO (amplitude real recente) abaixo do
    R:R mínimo.
28. Checagem final incondicional de R:R — alvo sempre precisa ser ≥ stop
    × R:R mínimo, qualquer que seja a causa.

**Sizing:**
29. Risco mínimo do lote menor que o teto de risco por trade da conta —
    exposição incompatível com o tamanho da conta.
30. Teto absoluto de notional de segurança.

### Nota sobre MACD/Estocástico/Volume/Candle especificamente

Não são um gate único e fixo — funcionam como "fatores de confluência"
exigidos dependendo do regime de mercado:

- **Mercado LATERAL** (item 23): exige pelo menos 2 fatores reais
  alinhados (1 no fim de semana) dentre MACD na direção do trade,
  Estocástico em extremo, volume elevado, padrão de candle com bias
  alinhado.
- **Tendência clara mas entrada CONTRA a tendência** (item 24): exige
  volume elevado OU Estocástico em extremo confirmando exaustão.
- Entrada **a favor** de uma tendência clara não precisa de nenhuma dessas
  confirmações extras — só entram como exigência nos cenários de maior
  risco de "tese fraca" (mercado indeciso ou aposta contra o movimento).

Nenhuma pendência de código desta sessão — só diagnóstico e documentação.
