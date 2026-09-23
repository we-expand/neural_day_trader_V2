# Sessão 2026-09-22 (noite) — Análise das travas de entrada do LLM Brain + motor travado esperando Ollama

## Contexto
Cleber pediu análise de todas as travas de `open_position` (achando a IA "restritiva demais
pra entrar em operações") e, em seguida, reportou 1h40 de mercado aberto sem nenhuma
operação. As duas coisas acabaram sendo investigações separadas na mesma sessão.

## Parte 1 — Mapa completo das travas de entrada (`open_position`, `llm-active-brain/src/tools.ts`)

Lido o código real (não suposição) do fluxo inteiro de `open_position`. Lista completa, na
ordem em que rodam:

1. Confiança mínima — 70% dia útil / 60% fim de semana, +2 a +5 se VIX ELEVADO/ALTO
2. Elegibilidade do setup especial FOMC_BTC_PLAY (não afeta o resto)
3. Símbolo dentro da cesta permitida
4. Direção travada pelo usuário no Setup (LONG/SHORT/AUTO)
5. Limite de perda diária (%) já atingido hoje
6. Calendário de mercado (CFD fechado)
7. Cooldown "precisa ter chamado get_mt5_quote no mesmo ciclo antes de abrir"
8. Indicadores stale bloqueiam (feed obsoleto/rate-limit neste ciclo)
9. Contradição textual no reasoning (negação explícita de abrir, checagem por palavra-chave)
10. Validador semântico (LLM) — **desligado quando LLM_PROVIDER=ollama**, que é o provedor
    ativo hoje (ver `project_llm_brain_contract_sizing_fixed.md` na memória)
11. Teto de 5 posições no mesmo símbolo / posição oposta simultânea bloqueada
12. Teto total de posições / teto de ativos simultâneos (config do usuário)
13. Teto de exposição do grupo correlacionado ($2.700)
14. Cooldown de perda consecutiva (5 perdas seguidas / 5min no mesmo símbolo+lado)
15. Cotação obsoleta (idade do tick) + teto de spread (5%)
16. **Gate MACD 5m "virada"** — bloqueia sempre contra o lado, SEM exceção nem pra
    setupType="REVERSAO"
17. ROMPIMENTO exige candle já fechado confirmando o rompimento
18. REVERSAO exige padrão de candle alinhado E que não seja no mesmo candle do padrão
    (espera 1 candle a mais de confirmação)
19. Momentum imediato (últimas 3 velas) contra o lado — bloqueia, exceto se REVERSAO
20. **Consenso de direção (5m+15m+1H+HMM)** contra o lado ou DIVERGENTE — bloqueia, exceto
    se REVERSAO
21. Estocástico lento (5m e 1H) contra o lado — só quando setupType=REVERSAO (afrouxado em
    2026-09-21 depois de achado do conselho: 93% desses bloqueios batiam com tendência viva,
    não exaustão real)
22. **Estocástico bruto extremo (95/5) contra o lado — SEMPRE, sem exceção de REVERSAO**
23. Padrão de candle citado mal-lido no reasoning (trava textual determinística)
24. HMM regime gate — desligado por padrão (`HMM_REGIME_GATE_ACTIVE`), não é o problema
25. Mercado LATERAL exige ≥2 fatores de confluência reais (1 no fim de semana)
26. **Contra-tendência exige ≥2 fatores de confirmação** — reusa os MESMOS 4 indicadores
    (volume/estocástico/MACD/candle) já vetados individualmente acima
27. Fluxo de Operação do Setup (TREND/COUNTER), se o usuário configurou
28. Preço idêntico ao centavo a uma posição já aberta (proteção contra feed travado)
29. Stop mínimo vs spread (alarga ou bloqueia se nem o teto de stop cobre a margem)
30. **R:R mínimo pós-cap por S/R = 1.5:1**
31. Teto de 60 entradas/24h (folgado, não é gargalo hoje)
32. Janela de notícia de alto impacto (20min antes / 60min depois de evento real)

### Achado principal
Direção/momentum é checado por **6 mecanismos independentes e sobrepostos** (MACD 5m,
momentum de 3 velas, consenso 5m+15m+1H+HMM, estocástico lento, estocástico bruto,
padrão de candle mal-lido), e pelo menos 3 deles (MACD 5m, estocástico bruto 95/5, leitura
de padrão de candle) **não têm exceção nem para entrada declarada como REVERSAO** — uma
tese de reversão bem fundamentada pode ser vetada por um único indicador rápido bater
contra, sem chance de argumento. Os gates de "≥2 fatores de confluência" (itens 25/26)
reciclam os MESMOS 4 indicadores já vetados individualmente em cima — dobra a exigência
sobre o mesmo dado, não diversifica a confirmação.

Isso bate com o que o próprio llm-council já mediu em 2026-09-21 (documentado na memória
`project_congelamento_mecanica_2026-09-22.md`): 93% dos bloqueios do gate de zona do
Estocástico ocorriam com `crossing=null` (tendência viva, não exaustão real), travando o
MESMO lado que o gate de consenso de direção acabava de liberar.

### ⚠️ Status: NENHUMA mudança de código foi aplicada
Existe congelamento de mecânica ativo desde 2026-09-22 (ver CLAUDE.md / memória
`project_congelamento_mecanica_2026-09-22.md`): sem mudar gate de entrada até 5 dias
úteis/40 trades fechados sob a config atual, meta de referência 76% de acerto. Esta análise
fica registrada como candidata a revisão quando o prazo do congelamento vencer — pontos
mais suspeitos, em ordem de prioridade pra revisitar:
- Item 22 (Estocástico bruto 95/5 sem exceção de REVERSAO) — inconsistente com o item 21,
  que já ganhou exceção.
- Item 16 (MACD 5m sem exceção nenhuma).
- Item 18 (REVERSAO espera candle seguinte, atraso de 1 candle inteiro).
- Itens 25+26 reciclando os mesmos indicadores dos gates individuais.
- Item 10 (validador semântico desligado com Ollama, a única rede de segurança "com
  julgamento contextual" está inativa hoje).

## Parte 2 — Motor travado esperando resposta do Ollama (achado real, corrigido ao vivo)

Cleber reportou 1h40 de mercado aberto sem nenhuma operação. Investigação ao vivo (não
suposição):
- Processo do `llm-active-brain` só tinha 4min26s de vida nesta instância (tinha sido
  reiniciado recentemente, por watchdog ou manualmente) e já estava preso no ciclo 1, sem
  avançar.
- Conexão TCP **aberta e parada** de `node` pra `localhost:11434` (Ollama) — esperando
  resposta do modelo que nunca vinha.
- O `llama-server` real (processo que roda o modelo, porta 55616) estava de pé há **1h36min
  com 0.1% de CPU** — não estava gerando nada, estado travado/deadlock, não lentidão normal
  de inferência.

**Causa raiz real**: o servidor `llama-server` (single-slot, `-np 1`) tinha ficado travado
num estado morto — qualquer reinício só do motor Node caía na mesma conexão morta e travava
de novo, porque o problema estava no processo do modelo, não no cliente.

### Correção aplicada (autorizada pelo Cleber, "Pode reiniciar. Pode reiniciar.")
1. `kill 57076` (SIGTERM no `llama-server` velho) — não respondeu, processo realmente
   travado/deadlock.
2. `kill -9 57076` (SIGKILL) — `ollama serve` (processo pai, sempre vivo) respawnou um
   `llama-server` novo sozinho (PID 76360, porta nova 49155, carregando modelo com 96.5%
   CPU) — comportamento esperado, `ollama serve` já gerencia isso.
3. `kill` no motor Node antigo (72605/72604) — já tinha morrido sozinho no meio do processo.
4. `bash restart.sh` dentro de `llm-active-brain/` — subiu processo novo (PID final 76808,
   lock em `llm-brain.pid`), **confirmado ao vivo rodando de verdade**: CPU real (8.9%,
   não mais 0.1%) alguns segundos depois do restart, ciclo 1 em andamento normal.

### Pendente real
- Confirmar que o ciclo 1 termina e o motor volta a avaliar entradas normalmente (não
  travar de novo no mesmo padrão) — não observado até o fim desta sessão, só os primeiros
  segundos pós-restart.
- Causa raiz de POR QUE o `llama-server` trava/deadlocka não foi investigada nesta sessão —
  só o sintoma foi corrigido (restart). Se repetir, vale investigar se é memória/contexto
  (`-c 32768 --keep 12000`) ou alguma requisição específica que trava o slot único
  (`-np 1`).
- `watchdog.sh` está rodando sozinho (fora do controle desta sessão, ver memória do
  CLAUDE.md) — se ele detectar o motor Node "vivo mas travado" (não é o mesmo que
  "processo morto"), pode não reagir a esse tipo de trava. Vale considerar, numa sessão
  futura, um healthcheck que meça CPU/progresso de ciclo do `llama-server`, não só se o
  processo existe.
