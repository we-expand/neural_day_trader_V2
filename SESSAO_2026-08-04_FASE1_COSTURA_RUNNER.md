# Sessão 2026-08-04 (noite, 2ª janela) — Fase 1 diagnosticada e fatia 1 do runner

Continuação direta de `SESSAO_2026-08-04_FASE0_TELEMETRIA_FUNIL.md`. Duas
frentes: descobrir por que o funil estava vazio, e começar a mover o motor de
decisão pro servidor.

---

## 1. Por que o funil estava vazio — causa encontrada, não suposta

A Fase 1 (ler `ai_funnel_snapshots`) não pôde ser executada: **0 linhas, 0
sessões**, mesmo com a IA ligada. A causa não é bug de código nem erro de
operação — é timing de deploy.

| Evento | Horário (BRT) |
|---|---|
| Sessão `2cff1634` iniciada | 13:20 |
| Fase 0 deployada (preview Vercel Ready, commit `3caca8dfb`) | 18:56 |
| Trade real executado (SPX500 LONG, `ai_trades`) | 19:24 |
| Leitura do funil | ~19:30 |

O trade das 19:24 foi gravado **sob a sessão `2cff1634`**, iniciada às 13:20 —
antes do deploy. Ou seja: o loop está vivo e operando, mas a aba do navegador
está aberta desde antes da telemetria existir. **Um SPA não troca de bundle sem
reload**, então o JavaScript em execução é o anterior à Fase 0.

Isso explica os três sintomas juntos: sem heartbeat (código velho não tem), sem
linha de funil (código velho não grava), mas com trade (código velho negocia).

**Correção**: hard reload (`Cmd+Shift+R`), parar a sessão e iniciar outra. O
funil grava a primeira janela em ~60s.

### Achado colateral que contradiz a premissa do redesenho

**A IA não está em "zero entradas".** Entrou em SPX500 às 19:24. O silêncio de
4h40 de 04/08 foi específico daquela janela, não um estado permanente. Ao ler o
funil, considerar a hipótese de problema **intermitente** (fome de dado da conta
MetaAPI compartilhada), não de travamento estrutural permanente.

## 2. O que foi verificado antes de culpar o código

Tudo abaixo foi confirmado por consulta/execução real, não por relato:

- **Deploy no ar**: preview Vercel Ready às 18:56 BRT; `dev` == `origin/dev` em
  `3caca8dfb`.
- **Migration 014 aplicada**: a tabela `ai_funnel_snapshots` existe e responde.
- **Caminho de escrita provado sob RLS**: executado o `INSERT` exato que o
  cliente faz — mesmo payload, sob `set local role authenticated` com o
  `auth.uid()` real do Cleber (`aeb3ec15…`) — mais o `UPDATE` de heartbeat em
  `ai_sessions`. Ambos passaram; `ROLLBACK` devolveu a tabela a 0 linhas
  (reconferido). Schema, FK e política batem. **A telemetria não tem defeito de
  gravação** — a dúvida que estava aberta desde a Fase 0 ("não testado ao vivo")
  está fechada no que diz respeito ao banco.

## 3. Correção ao handoff anterior — o "circuit breaker" partia de premissa falsa

O `NEXT_SESSION.md` anterior afirmava que "um GBPUSD sem tick pausa entradas de
forma global" e recomendava um circuit breaker por ativo. **Isso não se
sustenta no código:**

- O caminho `DATA_NOT_REAL` (`useApexLogic.ts:1516`) está dentro do laço por
  ativo e só pula aquele ativo.
- `isPaused` só é escrito pelos handlers de start/stop/pause do usuário
  (`useApexLogic.ts:2636/2712/2716/2721/2737`), nunca por dado obsoleto.
- O banner "Dados de mercado indisponíveis" é um toast com throttle de 60s.

**O defeito real é outro**: o ativo sem dado **continua consumindo um dos 3
slots de avaliação por tick** (`ASSETS_PER_TICK = 3`). Com 12 ativos
configurados e boa parte dependendo da conta MetaAPI saturada, a maior parte do
orçamento de amostragem pode estar sendo gasta em ativos que não têm como
produzir sinal. É exatamente o que `symbol_stage_counts` mede — mais um motivo
pra ler o funil antes de mexer.

## 4. Armadilha que o runner do servidor precisa tratar

`/mt5-candles` devolve **candles SIMULADOS com HTTP 200** quando o token MetaAPI
é inválido (`supabase/functions/server/index.ts:4438`). No browser o
`isRealData` barra isso. Um runner que consuma a rota ingenuamente decidiria
trade sobre dado fabricado — violação direta da convenção nº1 do projeto.
**Rejeição explícita de `source: 'SIMULATED'` é requisito do runner**, não
detalhe de implementação.

## 5. Fatia 1 do runner — costura verificada

### Mapa de portabilidade (medido, não estimado)

Fecho transitivo a partir de `StrategyEvaluator` + `MarketScoreEngine`: **10
módulos**. Nenhum toca `window`/`document`/`localStorage` (as ocorrências de
`window` são nome de variável local — janela de candles).

| Camada | Estado |
|---|---|
| `StrategyEvaluator`, `TechnicalIndicators`, `types/strategy` | puros, zero I/O |
| `assetDatabase`, `brokerRegistry` | config pura |
| `BacktestDataService`, `MarketScoreEngine` | fazem I/O, mas só HTTP (portável) |
| Corpo do tick (`useApexLogic`, 1107 linhas) | preso ao React: 14 refs + 4 `setState` |

**Ponto único preso ao browser em todo o fecho**: `BacktestDataService.ts:244`,
`await supabase.auth.getSession()` — usado só pra obter o JWT que autentica a
chamada de candles. Nada mais.

### Decisão de desenho: um motor, dois drivers

O motor NÃO é copiado pro Deno. É importado. Duplicar a lógica garantiria
divergência entre o que se testa na tela e o que opera sozinho — que é o defeito
que este redesenho existe pra corrigir.

**Revisão em relação ao plano inicial**: o runner virou função **separada**
(`supabase/functions/ai-runner/`) em vez de rota dentro do `server`. Motivo: o
`BacktestDataService` já busca candles por HTTPS na própria rota
`server/mt5-candles-history`, então função separada não duplica manuseio de
token nenhum — e evita mexer na config de uma função de 6.352 linhas em
produção.

### O que foi implementado

**8 correções de extensão** (nenhuma linha de lógica tocada) — Deno exige
extensão explícita em import relativo:

```
brokerRegistry.ts        './assetDatabase'              -> '.ts'
BacktestDataService.ts   '../../../utils/supabase/info' -> '.tsx'
MarketScoreEngine.ts     4 imports relativos            -> '.ts'
StrategyEvaluator.ts     2 imports relativos            -> '.ts'
```

Seguro dos dois lados: `allowImportingTsExtensions` já está ligado no
`tsconfig.json` e o build é `vite build` puro, sem `tsc`.

Os dois aliases `@/` do `BacktestDataService` ficaram **intactos de propósito** —
é o que permite o import map desviar `@/lib/supabaseClient` pra um shim de
servidor sem editar o caminho crítico.

**Arquivos novos** em `supabase/functions/ai-runner/`:

- `deno.json` — import map resolvendo `@/` e desviando o client de browser.
- `shims/supabaseClient.ts` — cobre o ponto único preso ao browser, com
  service-role. Superfície mínima via `Proxy`: qualquer acesso não implementado
  (`.from`, `.rpc`, …) lança com mensagem explícita, em vez de virar `undefined`
  três camadas adiante. Nunca inventa token: sem `SUPABASE_SERVICE_ROLE_KEY` no
  ambiente, devolve sessão nula e deixa a rota responder o erro real.
- `seam_smoke_test.ts` — critério de aceite da fatia. Importa o motor real e
  executa indicadores + `StrategyEvaluator` sobre candles sintéticos
  determinísticos. Roda **sem `--allow-net`** de propósito: se algum módulo do
  fecho tentasse I/O na carga, falharia ali e não em produção. Estratégia tipada
  de verdade (sem `as any`), então o teste também é checagem de compilação do
  contrato.

### Verificação

| Gate | Resultado |
|---|---|
| `npx tsc -p tsconfig.engine.json` (estrito) | 0 erros |
| `npm run validate` | 12 passaram, 0 falharam |
| `npm run build` (Vite) | ✓ built |
| `deno test --allow-env seam_smoke_test.ts` | **4 passed, 0 failed** |

**O smoke test pegou um defeito real, antes de qualquer deploy**: o `Proxy` do
shim estava tipado como `Record<string, unknown>`, o que fazia `supabase.auth`
virar `unknown` e quebrar o type-check *dentro do `BacktestDataService`* — longe
da causa. Corrigido com interface concreta, mantendo a guarda de runtime. Foi o
que justificou instalar o Deno em vez de entregar o import map no escuro.

### Notas de ambiente

- **Deno 2.9.4 instalado** via Homebrew nesta sessão (autorizado pelo Cleber).
  Necessário pra rodar o smoke test; sem ele a costura ficaria não verificada.
- `dist/` foi regenerado pelo `npm run build` e **restaurado** (`git checkout --
  dist/`) — é versionado neste repo e entraria como ruído no commit.

## 6. Commit (não executado — convenção do projeto)

```bash
git add src/app/config/brokerRegistry.ts \
        src/app/services/BacktestDataService.ts \
        src/app/services/MarketScoreEngine.ts \
        src/app/services/strategy/StrategyEvaluator.ts \
        supabase/functions/ai-runner/
git commit -m "feat(cerebro): Fase 0 fatia 1 — costura verificada que torna o motor importavel no servidor (Deno)"
git push
```

Ficam de fora, de propósito, as mudanças de OUTRA sessão que já estavam na
árvore: `AIToolsControl.tsx`, `ATRTrailingStopManager.tsx`,
`PyramidingConfigPanel.tsx` e `SESSAO_2026-08-04_ATR_PYRAMIDING_E_AUDITORIA_CONFIG.md`.
