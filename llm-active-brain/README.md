# LLM Active Brain — cérebro alternativo em teste (Binance)

> Ver [CLAUDE.md](../CLAUDE.md) — item "Redesenho do cérebro de decisão" —
> pra contexto do projeto como um todo. Este README cobre só esta pasta.

## O que é

Agente LLM de tool-calling completo (sem gate mecânico de risco/frequência do
motor principal), operando cripto real via Binance (testnet por padrão),
rodado **isolado do motor mecânico de produção** pra avaliar se essa
arquitetura serve como "cérebro" do Neural Day Trader.

Origem: portado do repositório de experimento
`~/Projects/we-expand/autonomous_money` (agente original, validado ali contra
Binance testnet — ver `CONTEXT.md` daquele repo pro histórico completo de como
ele foi construído). O código agora vive **aqui**, no repositório do Neural
Day Trader, porque é este projeto que a tecnologia serve — o `autonomous_money`
foi só a origem/experimento inicial.

## Isolamento

- Roda em terminal, standalone (`npm start` dentro desta pasta) — não é
  Edge Function, não tem cron, não toca o motor mecânico (`ai-runner`).
- Cada ordem executada na Binance é espelhada (`src/neuralBridge.ts`) como
  trade virtual DEMO no mesmo Supabase do produto (`ai_trades`/`ai_sessions`),
  numa sessão própria (`strategy_name = 'LLM_ACTIVE_BRAIN_AUTONOMOUS_MONEY'`),
  marcada `is_test_data = true` — nunca se mistura com trade real de produção
  no Dashboard.
- Gestão de risco: teto por ordem (`MAX_ORDER_USD`) e orçamento total em modo
  LIVE (`MAX_LIVE_BUDGET_USD`, travado em código a US$5) — mas **sem** teto
  artificial de número de entradas por ciclo (decisão do Cleber, 2026-08-28:
  "acredito que com várias entradas ele performa melhor").

## Como rodar

```bash
cd llm-active-brain
npm install
cp .env.example .env   # preencher: LLM (NVIDIA/Groq), Binance testnet, carteira testnet,
                        # e NEURAL_SUPABASE_* (ver .env.example)
npm start               # 1+ ciclos (CONTINUOUS_MODE=true no .env pra loop)
```

Rodar a noite toda em background, sem o Mac dormir:

```bash
mkdir -p logs
nohup caffeinate -i npm start > logs/overnight_$(date +%Y%m%d_%H%M).log 2>&1 & disown
```

Acompanhar: `tail -f logs/overnight_*.log` (raciocínio bruto) ou pela
plataforma (Dashboard, sessão `LLM_ACTIVE_BRAIN_AUTONOMOUS_MONEY`).

Parar: `pkill -f "caffeinate -i npm start"`.

## Pendências

- Sem dado avaliado ainda (rodada inicial de teste, 2026-08-28 à noite).
- Validação só PRA FRENTE (mesma disciplina do resto do projeto — ver
  `AI_BRAIN_SPEC.md` seção 8): nenhuma conclusão de edge antes de acumular
  amostra mínima de decisões/trades reais.
