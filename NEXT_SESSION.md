# Handoff — próxima sessão

> Reescrito em **2026-08-31 (noite)** — sessão de ampliação da cesta
> multi-ativo do Cérebro LLM Ativo (este arquivo é handoff da sessão
> CORRENTE, sempre reescrito, nunca empilhado). **Commit já feito**
> (`e825b2c2e`, working tree limpo nesta frente) — nada pendente de código
> na ampliação da cesta. Detalhe completo:
> [SESSAO_2026-08-31_CESTA_AMPLIADA_MULTI_ATIVO_LLM_BRAIN.md](SESSAO_2026-08-31_CESTA_AMPLIADA_MULTI_ATIVO_LLM_BRAIN.md).

## ▶ COMECE AQUI

**LLM Brain é o motor único da plataforma, e agora opera 9 ativos reais
(era 1 — só BTCUSD).** Cesta técnica ampliada de 9 criptos pra 16 símbolos
(cripto + forex + metal + energia + índices); a config do Cleber
(`ai_user_config.activeAssets`) intersecta com essa cesta e resulta em
`EURUSD, XAUUSD, UKOUSD, BTCUSD, XETUSD, GER40, SPX500, NAS100, UK100`.
Sessão ativa: `15d6d602-019b-41bf-85c4-cf8a4f491f28`
(`strategy_name=LLM_ACTIVE_BRAIN_MT5`, `status=RUNNING`, $100). Processo
local via `tsx`, reiniciado e confirmado único ao fim desta sessão —
`llm-active-brain/restart.sh` pra reiniciar se precisar.

### Estado técnico confirmado ao fim da sessão

- `npx tsc --noEmit` limpo em `llm-active-brain/`.
- Monitoramento ao vivo (~1h) não achou bug novo — guards de tendência,
  risco mínimo e tick obsoleto funcionando corretamente (bloqueiam E
  destravam sozinhos quando a condição muda, confirmado ao vivo com
  XAUUSD reabrindo).
- `ai_trades` da sessão atual: 0 trades até o fim do monitoramento —
  amostra pequena, vários mercados parcialmente fechados no horário,
  IA sendo cautelosa. Não é sinal de travamento, mas vale acompanhar se
  continuar em zero por muito mais tempo.

### Pendências reais (nenhuma bloqueante, ordem sugerida)

1. **Achado de risco real (não bug)**: com BTCUSD em ~$79.000, o lote
   mínimo força ~$3,95 de risco, acima do teto de 3% de uma conta de $100
   (~$3,00) — BTCUSD fica efetivamente inoperável nesse tamanho de conta
   com o risco atual configurado. Decisão do Cleber: aumentar capital
   alocado, relaxar risco por trade, ou aceitar a exclusão de fato.
2. **`COFUSD`/`COCUSD`** (Café/Cacau) devolveram HTTP 404 nesta corretora —
   não entraram na cesta ampliada. Se o Cleber quiser esses dois, precisa
   investigar o nome certo do contrato (`infinoxContractSpecs.ts` sugere
   `COFFEEUSD`/`COCOAUSD` como possíveis nomes alternativos).
3. **`SOLUSD`** continua fora por decisão de sessões anteriores (causou a
   maioria do prejuízo líquido em 2 sessões distintas) — não reintroduzir
   sem decisão explícita do Cleber.
4. **Achado cosmético**: agente ainda tenta consultar ~6 símbolos fora da
   cesta atual todo ciclo (herança de cestas antigas), toma erro em todos
   sem travar nada — desperdício pequeno, não corrigido.
5. **Degradação de qualidade do modelo LLM** (`nvidia/nemotron-3-nano-30b-a3b`)
   — item antigo, não investigado nesta sessão. `OMNIROUTE` segue como
   opção alternativa não testada em `config.ts`.
6. Itens de pesquisa histórica (Trilho 2/NIM/cuOpt, Parceiros IB B4,
   probabilidade calibrada, etc.) — nenhum tocado nesta sessão, continuam
   rastreados na seção "Pendências reais em aberto" do
   [CLAUDE.md](CLAUDE.md).

### Regra fixa que continua valendo

Claude nunca commita/faz push sozinho — só entrega comando pronto (usado
nesta sessão: Cleber/outra sessão confirmou e rodou o commit). Migrations
do Supabase nunca são aplicadas por Claude (só SQL pronto), mas
`execute_sql` de leitura via MCP (consultas, sem alterar schema/dado) é
usado livremente pra diagnóstico. Nenhum dado financeiro é corrigido com
`UPDATE` silencioso — sempre `correction_reason`/valores derivados de soma
real.
