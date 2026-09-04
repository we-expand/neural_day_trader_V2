# Sessão 2026-09-02 (tarde) — Motor não abria posição: gate de R:R pós-SR-cap,
# regime de mercado como contexto pro LLM, e Estocástico extremo como
# confirmação de reversão

## Contexto / motivação

Cleber reportou que o Cérebro LLM Ativo (`llm-active-brain`) parou de abrir
posições por volta das 15h de hoje, e que isso não acontecia de manhã.
Investigação ao vivo (log + Supabase), não suposição.

## Achado 1: causa raiz do "motor parou de operar"

Correlação temporal confirmada via `ai_trades` (Supabase): última entrada
real bem-sucedida foi BTCUSD LONG às **11:32 BRT**. O commit `634e88f18`
("alvo agora capado por suporte/resistência real") foi escrito às
11:15:52 BRT e entrou em produção no restart do processo às 11:38:26 BRT —
minutos depois da última entrada. Esse commit introduziu um gate em
`open_position` (`tools.ts`, `mt5MinRrAfterSrCap`): quando o suporte/
resistência real está mais perto que o alvo por ATR pediria, a entrada é
**recusada** se o espaço reduzido não cobrir R:R mínimo de 1:1 acima do
stop. Mercado no período estava LATERAL/NEUTRO na cesta inteira — condição
que esse gate mais bloqueia (preço espremido entre suporte/resistência).

Log do período exato (11h38-14h17) foi perdido: `restart.sh` usa `>`
(sobrescreve), diferente do `watchdog.sh` que usa `>>` (append) — alguém
rodou `restart.sh` manualmente às ~14h17, apagando a evidência direta de
"tentou abrir, foi recusado por R:R". A correlação temporal + o
comportamento observado depois (ciclos consultando toda a cesta sem
nenhuma tentativa de `open_position`, mercado lateral) é forte mas não é
prova direta de causa-efeito 100% confirmada.

**Ação (paliativo, aplicado)**: `MT5_MIN_RR_AFTER_SR_CAP` baixado de 1.0
(default) para 0.6 em `.env`, restart aplicado. Sem validação estatística
de que isso melhora o líquido — só destrava entrada em espaço mais
apertado, sem desligar a proteção.

## Achado 2 / decisão de produto: regime de mercado como contexto, não trava

Cleber levantou um ponto mais estrutural: o motor tratava implicitamente
"baixo volume"/"baixa volatilidade" como sinônimo de "não operar" — mas
baixo volume pode ser tendência real e limpa, com pouca resistência (caso
real citado: BTCUSD caiu forte um dia inteiro com volume baixo, sem
whipsaw, e o motor ficou de fora). Pediu explicitamente que a IA "seja
inteligente o suficiente pra observar os padrões e se adaptar sozinha,
como um humano faria" — não uma nova trava mecânica fixa por horário.

**Decisão de escopo tomada em plan mode, aprovada pelo Cleber**: dar
contexto de regime ao LLM (sessão + volume real + volatilidade real),
deixando o julgamento de operar ou não com o próprio LLM. O gate mecânico
de R:R (item acima) **continua existindo** como piso de segurança
financeira — não foi removido, só complementado com mais contexto ANTES
dele.

**Implementado, commitado, rodando ao vivo**:
- `atr.ts`: nova função `getMarketRegime(symbol, timeframe)` — combina
  sessão (rótulo por horário UTC: ASIA/LONDRES/NY/ROLLOVER, só contexto,
  sem expectativa fixa), volume real (reaproveita `getVolumeConfirmation`)
  e volatilidade real (ATR atual vs a própria janela recente do símbolo).
  `null` quando não há candle suficiente, nunca fabrica regime.
- `tools.ts`: `get_mt5_quote` devolve `regime` em todos os caminhos
  (sucesso, fallback de erro, mercado fechado).
- `agent.ts`: novo princípio **1g** no `GENESIS_PROMPT_MT5` — ensina o LLM
  a distinguir mercado "fácil de operar" (tendência limpa, mesmo com
  volume/volatilidade baixos) de "difícil" (LATERAL + volatilidade alta =
  ruído/whipsaw). Julgamento do LLM, sem bloqueio mecânico novo.
- `neuralBridge.ts`: `openMt5Position` grava `session_at_entry`/
  `volume_label_at_entry`/`volatility_label_at_entry` — pra permitir
  validar estatisticamente no futuro (amostra de dias) se dar esse
  contexto mudou o comportamento/resultado.
- **Migration pronta, NÃO aplicada**:
  `supabase/migrations/20260902_add_regime_at_entry_to_ai_trades.sql` (3
  colunas novas em `ai_trades`).

**Verificado ao vivo**: `tsc --noEmit` limpo, processo reiniciado (única
instância confirmada), log mostrando `regime` real chegando (ex:
`{"session":"NY","volumeLabel":"BAIXO","volatilityLabel":"NORMAL"}`).

## Achado 3: Estocástico extremo era ignorado como sinal de reversão

Observação do Cleber ao vivo, olhando o log: BTCUSD/XETUSD/GER40 com
Estocástico em 91-96 (SOBRECOMPRADO extremo), tendência de ALTA, mas
volume normal (não elevado). O gate de contrarian trade em `open_position`
só aceitava **volume elevado** como confirmação pra entrar contra a
tendência — ignorava o Estocástico por completo, mesmo em extremo real.
Cleber: "só porque está sobrecomprado não significa que ele não pode
vender — se está sobrecomprado, ele tem que começar a pensar em vender."

**Implementado, staged (não commitado ainda quando a sessão foi
encerrada)**: `open_position` agora aceita Estocástico em extremo real
(SOBRECOMPRADO pra SHORT, SOBREVENDIDO pra LONG) como confirmação
alternativa ao volume elevado — ainda exige ALGUMA confirmação real (não
remove a trava; contrarian no vácuo sem nenhum dos dois sinais continua
bloqueado, mesma proteção que evitou o prejuízo documentado de
2026-08-29). Prompt (princípio 1e) reforçado. `tsc --noEmit` limpo,
processo reiniciado.

## Estado dos commits ao final da sessão

1. Commit do achado 2 (regime de mercado) — **já commitado pelo Cleber**
   durante a sessão (mensagem de commit fornecida, ver histórico do git).
2. Commit do achado 3 (Estocástico como confirmação de reversão) —
   **arquivos staged** (`git add` já rodado nesta sessão em
   `llm-active-brain/src/agent.ts` e `llm-active-brain/src/tools.ts`),
   comando de commit entregue ao Cleber, **não commitado ainda** (regra
   fixa do projeto: Claude nunca commita sozinho).
3. Migration SQL do achado 2 — pronta, **não aplicada**.
4. `MT5_MIN_RR_AFTER_SR_CAP=0.6` no `.env` — aplicado localmente, não é
   commitável (`.env` fora do git), decisão temporária/paliativa.

## Pendências reais pra próxima sessão

- Rodar o commit pendente do achado 3 (comando já entregue ao Cleber).
- Rodar a migration SQL do achado 2 no Supabase SQL Editor.
- **Observar amostra nova** (dias, não horas) pra avaliar se: (a) o
  contexto de regime realmente mudou a taxa de entrada em mercado calmo
  com tendência limpa; (b) o Estocástico como gatilho de reversão gerou
  entradas de reversão de qualidade ou piorou o resultado; (c) o
  `MT5_MIN_RR_AFTER_SR_CAP=0.6` (paliativo) deveria ser mantido, ajustado,
  ou substituído por algo mais estruturado ligado ao regime.
- Nenhuma das 3 mudanças desta sessão tem validação estatística de melhora
  no líquido — são correções de mecânica/contexto de decisão, precisam de
  amostra real rodando antes de julgar efeito, mesma disciplina de sempre
  do projeto.
- Achado sem fix (não investigado a fundo): o modelo insiste em consultar
  DOGUSD/XRPUSD/BTCXBN todo ciclo, mesmo fora da cesta configurada — sem
  impacto real (só retorna erro esperado), mas desperdiça iterações;
  provável resquício de prompt/hábito de sessões anteriores com cesta
  cripto maior.
