# Sessão 25–26/10/2026 — A "regra das ondas" do Cleber, conselho, método na LLM, relatório das operações manuais e NEXUS

Resumo da conversa inteira, na ordem em que aconteceu. Horários em Brasília salvo indicação.
Todos os testes de backtest usam velas fechadas, custo descontado e 1 ano de dados (BTC e ETH, Binance).

## 1. O pedido

O Cleber vem operando BTC à mão desde 23/10 (~10h). Disse que o estocástico (5,3,3) é "uma continuação,
em cada tempo gráfico, de uma onda grande", que basta passear do 5m ao 4H para saber o lado do mercado,
e que está ganhando "de forma exponencial". Pediu: levantar as operações dele, **chamar o conselho** e
**extrair tudo que foi bom para a LLM**. Depois pediu que o método fosse traduzido para a LLM (não nas palavras dele).

## 2. Operações manuais — primeiro levantamento (do dia 23 até 25/10 de manhã)

Banco `ai_trades`, `is_test_data = false`, consolidado por entrada, líquido de custo.
- 21/10: 25 entradas, 1 ganho, −147,24 (3 compras sem stop seguradas 12h: −111,65). 22/10: 4 entradas, 0 ganhos, −11,05.
- Desde 23/10 (até a manhã de 25/10): 18 fechadas, 5 ganhos, +17,97. Sem o maior ganho (+19,62): −1,65.
- Estocástico 5,3,3 medido no instante de cada entrada em 5m/15m/1H/4H: **o número de tempos a favor não separa ganhos de perdas.**

## 3. Backtests (BTC e ETH, 1 ano)

| Regra testada | Resultado |
|---|---|
| 4 tempos gráficos alinhados (e variantes: puxada do 5m, 15m vira com 1H+4H, saída por inversão do 15m, stop 1×ATR/alvo 2×) | Bruto zero, igual ao aleatório (BTC 974 entradas, acerto 41%, líquido −0,083%/trade) |
| Regra corrigida pelo Cleber: **1H e 4H dão o lado, 5m dá a entrada** | Bruto zero; vela de 1H seguinte vai para o lado do estocástico do 1H em 47–50% |
| Onda lenta (1H/4H) como viés das 4h seguintes | 46–50% do lado certo; média ≈ 0 |
| 15m com estocástico no fundo + MACD vendedor ("o MACD prevalece") | Caiu na 1h seguinte em 47% (BTC) e 44% (ETH): o MACD vendedor não fez a queda continuar mais |
| Stop fixo 0,625% / alvo 2,04% (a operação do Cleber) | Alvo antes do stop em 24%; empate 23,5% |
| **Stop logo acima do último topo do 1H (abaixo do fundo na compra), alvo 3,3× o risco** | Bruto +0,04 a +0,14 R (o stop fixo dava ~0); líquido −0,01 a −0,09 R no BTC e −0,02 a −0,20 R no ETH. Amostras sobrepostas → sem prova |
| Depois do rompimento do topo (stop atingido) | Preço seguiu a direção do rompimento em 44–52%: virar a mão no rompimento não tem apoio |
| Largura do stop com alvo fixo 3,3× | Stop de 0,2%: custo come 0,35 R; 0,7%: melhor equilíbrio (acerto 23,4%, empate 23,3%); 2%: acerto 8% |

Conclusão: o estocástico e o MACD **descrevem** a onda, mas não **preveem** a próxima hora (~50%). O único ponto com sinal
positivo (antes do custo) foi o **stop colocado num topo/fundo real**, não numa distância fixa.

## 4. Conselho (5 conselheiros + 3 revisores cruzados; síntese feita pelo assistente)

Consenso:
- O que vale extrair é a **gestão e a abstenção**, não a regra de entrada: stop sempre, perda pequena, deixar o ganho correr
  (sem alvo curto), não virar a mão em minutos, pausa após 2 perdas.
- 4 dos 5 ganhos vieram de vendas numa queda de 82k→80k; sem o maior ganho o saldo era −1,65. "Exponencial" com n=18 não se sustenta.
- Rodadas de 10 entradas servem para abortar, não para provar vantagem. Comparar contra controle aleatório com a mesma saída.
Divergência: dois conselheiros queriam "exaustão no topo" como gatilho de entrada; os revisores apontaram que se apoia em 1–2 casos.
Pontos cegos que a revisão achou: viés de seleção em "segurar horas"; custo; lote dobrado discricionário; a LLM já tem breakeven/trailing/cooldown
e perdeu em todas as semanas desde 01/09; ninguém contestou a crença de "exponencial".

## 5. Leituras ao vivo do Cleber

Registradas em `llm-active-brain/LEITURAS_AO_VIVO_DO_CLEBER.md` (leitura, números medidos no mesmo minuto, previsão e resultado).
- **L1 (15:42): cancelada** por ele ("cometi um erro"). Não conta.
- **L2 (25/10 15:46–16:20): venda de BTC.** Entrada 80.665, **lote 0,02**, stop 81.169 (+504 pts, acima do topo do martelo invertido), alvo 79.020 (−1.645 pts),
  risco ≈ US$10, ganho potencial ≈ US$33 (R:R 3,3). Confiança declarada: **80%**. Decidiu manter a venda mesmo com o 15m cruzando para cima,
  porque o 1H e o 4H seguiam em queda (regra: sinal contrário no tempo menor não tira da operação enquanto o tempo maior segue a favor).
  **Resultado:** ele fechou na mão a 79.676 em 26/10 01:02, **+US$19,33** líquido.
- Princípios que ele declarou: "risco baixo e alvo grande"; "entrar pra matar" (convicção, não lote grande); stop dinâmico/"inteligente" no ponto que invalida a ideia;
  se o stop é tomado por rompimento de topo, a tendência provavelmente muda (não confirmado nos dados).

## 6. Erro meu corrigido na sessão

O arquivo de velas `ohlcv_data` (gravado por `neuralBridge.ts` ~1643, upsert com `ignoreDuplicates`) guarda cada vela **ainda em formação** e nunca a atualiza:
máximas/mínimas/fechamentos errados. A primeira tabela da L2 e `scripts/mtf-snapshot.mjs` usavam esses dados. Refeito com velas da Binance:
desde 23/10, entradas com 1H e 4H a favor = 6, 1 ganho, −1,62; as outras 14: 4 ganhos, +12,57 (conclusão mantida). O motor ao vivo **não** lê dessa tabela.
**Pendente:** corrigir a gravação do `ohlcv_data` (atualizar a vela até fechar).

## 7. Método operacional escrito para a LLM (aprovado pelo Cleber)

- Novo arquivo **`llm-active-brain/METODO_OPERACIONAL.md`**, lido em todo ciclo (relido quando o arquivo muda; editar o texto não exige restart).
- Ligado no prompt em `llm-active-brain/src/agent.ts` (função `getOperatingMethodBlock`, anexa ao system prompt). `tsc --noEmit` limpo.
- Conteúdo: objetivo (perder pouco/ganhar muito, poucas entradas); leitura em camadas (1H/4H onda lenta e lado; 15m/30m aviso; 5m/15m entrada); quando não entrar
  (1H×4H em conflito, virada de mão <30 min, 2 perdas → pausa de 1h, sem espaço de 3× o risco); stop no ponto que invalida; alvo ≥3× o stop; plano escrito
  antes da entrada; depois do stop não reentrar no lado oposto sem plano completo; o que foi medido (para dar o peso certo; confiança >60% só com motivo concreto).
- **Limite:** o código ainda calcula stop (ATR), alvo e lote (`MT5_MAX_RISK_PCT_PER_TRADE=0.10`, 10% do saldo). A LLM decide lado, momento e plano, **não** o preço do stop.
  **Próximo passo de código:** stop no topo/fundo do 1H e risco fixo em dólares com lote calculado pelo stop (alterar `open_position` em `tools.ts`).
- O motor foi **reiniciado duas vezes** (a pedido do Cleber): a primeira só com a edição do alvo do PMI; a segunda, com o método carregado (PID 99420, instância única).

## 8. Risco e tamanho (conversa com o Cleber)

- Risco real da venda de 0,02 BTC: ≈ US$10 (10% do saldo informado de US$100), uns 4× a perda média recente (US$2,52).
- Com 24% de acerto, a pior sequência esperada em 100 operações é ~17 stops: com 10% por entrada o saldo cai a US$17; com 2% a US$71.
- Largura do stop não decide a perda em dinheiro; o **lote** decide. O Cleber disse que quer ganhos exponenciais e que US$1–2 "não salvam a vida de ninguém";
  foi explicado que o caminho é risco fixo por entrada + escalar só quando o resultado líquido provar (protocolo dele de rodadas de 10).
- **Pendente do Cleber:** dizer o saldo e a % de risco por entrada (sugestão: 2%).

## 9. Relatório das operações manuais (23/10 10:45 → 26/10 05:00)

Arquivo: `RELATORIO_OPERACOES_MANUAIS_2026-10-23_A_26.md` (tabela das 27 operações). Resumo:
- 26 fechadas, 7 ganhos / 19 perdas (**acerto 27%**), bruto +196,86, custo −34,37, **líquido +162,49**. Ganho médio +30,15, perda média −2,56.
- **Uma compra de 0,4 BTC (26/10 01:02–04:28, sem stop) fez +141,08 = 87% do resultado.** Sem ela: +21,41. Sem as 3 maiores: −17,54.
- **As 15 operações com menos de 30 min perderam todas (−33,24); as 7 vencedoras duraram de 1h30 a 17h30.**
- Tamanho variou 40× (0,01 a 0,4 BTC). 0,4 BTC = US$31.876 de exposição, ~319× o saldo de US$100; 247 pontos contra = US$99.
- Venda 14 ops/5 ganhos/+43,33; compra 12 ops/2 ganhos/+119,16 (sem a #22: −21,92). Com stop real: 11 ops/5 ganhos/+42,38. Sem stop: 15 ops/2 ganhos/+120,12.
- Em aberto no momento do relatório: venda de 0,05 BTC a 80.038, **sem stop e sem alvo**. Limites: n=26, regime único, não conferido com extrato da corretora.
- Esclarecido: os 27% usam só as operações manuais (a venda de ETH da LLM, −9,93, não entra).

## 10. Índice Brasil, mini dólar e mini índice

- Conta Infinox (MetaAPI, 360 símbolos): **`BVSPX`** (Bovespa Cash CFD em reais, contrato 1, lote mín. 0,01, horário ~09:01–17:54 BRT) e **`USDBRL`** existem e estão liberados.
- **WIN e WDO (mini índice e mini dólar da B3, futuros) não existem nesta corretora.** Exigiriam outra corretora brasileira com MT5 (integração à parte).
- `BVSPX` já está no catálogo do app (boleta/gráfico manual). Para a LLM operar falta: spec real em `infinoxContractSpecs.ts` (hoje "INDICES_US genérico", lucro errado) e conversão BRL→USD
  pelo `USDBRL` (~US$0,20 por ponto por lote, câmbio ~5,02). Cleber ainda precisa decidir "liberar para a LLM" ou "só manual".

## 11. NEXUS (assistente de voz) parou

- Causa: a NVIDIA **aposentou o `nemotron-3-nano-30b-a3b` em 01/09** (HTTP 410), que era o modelo padrão do NEXUS (`supabase/functions/nexus-brain/lib/llmClient.ts`).
- Testes ao vivo: `nemotron-3.5-lightning-30b-a3b` com raciocínio desligado = 0,9 s e tool-calling OK; `minimax-m3.1-flash` OK mais lento; `glm-5.3-flash` e `deepseek-v4.1-flash` estouraram tempo.
- **Alterado:** padrão do NEXUS → `nvidia/nemotron-3.5-lightning-30b-a3b` (só no código, não está no ar).
- **Falta o Cleber rodar:**
  `supabase secrets set NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b` e `supabase functions deploy nexus-brain --no-verify-jwt`.
- Não consegui ler os logs da função (a rota de logs do MCP não aceitou as tabelas).

## 12. Modelo do motor (`nemotron-3.5-super-vl-120b-a12b`)

Teste repetido (6 chamadas, prompt do tamanho do real, ferramenta obrigatória): super-vl **2/6** (dois 500, dois timeouts de 60 s); lightning **6/6** (mediana 6,4 s);
minimax-flash 6/6 (11,3 s); kimi-k2.6 e llama-nemotron-ultra-253b: 404. O motor já tem `LLM_FALLBACK_MODELS=lightning,gpt-oss-20b` (troca sozinha após erro ou 45 s);
em 24 min de log: 8 erros de conexão, 1 limite de uso, 0 tentativas esgotadas, 7 ciclos. **Decisão: não trocar o principal agora.** Reavaliar se os ciclos atrasarem.

## 13. Arquivos alterados/criados (nada commitado)

- `llm-active-brain/METODO_OPERACIONAL.md` (novo) · `llm-active-brain/src/agent.ts` (leitura do método + import) · `llm-active-brain/LEITURAS_AO_VIVO_DO_CLEBER.md` (novo)
- `supabase/functions/nexus-brain/lib/llmClient.ts` (modelo padrão) · `RELATORIO_OPERACOES_MANUAIS_2026-10-23_A_26.md` (novo) · este arquivo
- Memória: `project_regra_das_ondas_estocastico_multitf.md` (+ linha no `MEMORY.md`). Antes desta sessão já havia alterações não commitadas em `agent.ts`/`tools.ts` (alvo do PMI).

## 14. Pendências

1. Cleber: rodar o secret e o deploy do NEXUS; commitar (comandos abaixo).
2. Cleber: saldo e % de risco por entrada → escrever risco fixo em dólares no código; stop no topo/fundo do 1H na `open_position`.
3. Cleber: decidir se o Ibovespa (`BVSPX`) vai para a LLM (e se quer ver como operar WIN/WDO por outra corretora).
4. Corrigir a gravação de `ohlcv_data` (vela em formação nunca atualizada) e `scripts/mtf-snapshot.mjs`.
5. Colocar stop na venda aberta de 0,05 BTC; conferir os 80% de confiança contra o resultado das operações.
6. Teste justo do stop no topo do 1H: entradas sem sobreposição, fora da amostra, mais ativos.
7. Cleber é quem confirma o resultado das previsões da L2 (preencher o campo "Resultado").
8. O motor mostra o preço do BTC repetido várias vezes (80.083,97) — confirmar se é feed travado ou mercado parado.

## 15. Comandos para o Cleber (nada foi commitado por mim)

```bash
git add llm-active-brain/METODO_OPERACIONAL.md llm-active-brain/LEITURAS_AO_VIVO_DO_CLEBER.md llm-active-brain/src/agent.ts supabase/functions/nexus-brain/lib/llmClient.ts RELATORIO_OPERACOES_MANUAIS_2026-10-23_A_26.md SESSAO_2026-10-26_ONDAS_DO_CLEBER_CONSELHO_METODO_NA_LLM_RELATORIO_E_NEXUS.md CLAUDE.md
git commit -m "feat(llm-brain): metodo operacional do Cleber no prompt; fix(nexus): modelo padrao Lightning (Nano aposentado); relatorio das operacoes manuais"
```

Atenção: `agent.ts` também carrega a edição de ontem do alvo do PMI (Fibonacci da estrutura de 1H), ainda não commitada.
