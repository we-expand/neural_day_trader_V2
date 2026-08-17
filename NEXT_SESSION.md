# Handoff — próxima sessão

> Reescrito em **2026-08-17** (14ª parte — reescrita completa, não empilhada).
> **Regra: este arquivo é handoff da sessão CORRENTE. Reescreva, não empilhe.**

## ▶ COMECE AQUI — o que precisa acontecer, em ordem

1. **Commitar e subir a Onda 1** (comandos no fim deste arquivo). Nada foi
   commitado — regra fixa do projeto.
2. **Medir o funil DEPOIS do deploy.** Esta é a única prova que interessa, e
   ela ainda não existe: todas as mudanças desta sessão foram verificadas por
   type-check e por 265 asserções determinísticas, mas **nenhuma rodou contra
   mercado real ainda**. O que medir, com a IA ligada por algumas horas:
   ```sql
   select created_at, ticks, evaluations, stage_counts
   from ai_funnel_snapshots
   where session_id = '<nova sessão>'
   order by created_at desc limit 20;
   ```
   O resultado esperado, e o que invalida cada hipótese:
   - `NO_SIGNAL` deixa de ser 100% das avaliações → o gatilho de estado
     funcionou. Se continuar em 100%, **o piso de 60 está alto demais pra este
     mercado** — o detalhe do estágio agora traz "melhor score X < piso Y",
     que diz exatamente quanto baixar.
   - `COST_GATE` deixa de dominar → a correção de denominador funcionou. Se
     continuar dominando, olhar `risk_assessment->>'costClassSource'`: se vier
     `FALLBACK`, tem símbolo fora do catálogo.
   - `ENTRY_EXECUTED` aparecendo é o objetivo. **Quantas vezes por dia é
     medição, não meta** — não ajustar piso pra "atingir" um número.
3. **⚠️ A cesta de 39 NÃO se aplica sozinha a quem já usa o app.** O merge de
   config é `{...INITIAL_STATE.aiConfig, ...localStorage}`
   (`useApexLogic.ts:609`), então `activeAssets` já salvo **vence o novo
   default** — de propósito: sobrescrever a seleção que o usuário fez na tela
   seria decidir por ele. Chaves NOVAS (`signalScoreFloor`) pegam o default
   normalmente. Para a cesta ampla valer na conta do Cleber:
   **(a)** selecionar os ativos em "Universo de Ativos" na tela, e
   **(b)** desligar e religar a IA — `ai_sessions.config` só é gravado na
   CRIAÇÃO da sessão (`useAIPersistence.ts:113`), então uma sessão já
   `RUNNING` continua rodando a config velha. Foi exatamente isso que
   produziu a sessão zumbi de 10 dias.
4. **Testar o fix do botão "Desligar AI"** (`useApexLogic.ts`, `stopLogic`) —
   herdado da sessão anterior, ainda sem teste ao vivo. Desligar pela tela e
   confirmar via SQL que a sessão vira `STOPPED` (não só o estado local), e que
   ligar de novo sem reload cria sessão nova.
5. **Decidir sobre o feed de dados** — números levantados na seção própria
   abaixo, decisão do Cleber pendente.

## O que foi feito nesta sessão

**Contexto**: Cleber reportou a IA ligada em dia de mercado forte (BTC, cacau
+3%, ZEC +4%) sem nenhuma entrada, com o painel mostrando "TENDÊNCIA DE ALTA /
COMPRA 61 / ADX 34" ao mesmo tempo. Pediu redesenho do conceito: mais
liberdade pra entrar, cesta maior, e opções de API que não estourem
rate-limit.

### Diagnóstico medido (dado real, antes de mexer em qualquer linha)

Funil da sessão que estava rodando (`cf74baed`, 5m): **`NO_SIGNAL` em 100% das
avaliações** — nenhuma decisão chegava sequer aos gates de risco.
Sessão anterior (`41378b46`, 11 dias, 1m): 628 decisões — 562 `COST_GATE`
(89%), 63 `CONTEXT_CONFIDENCE` (10%), **3 executadas (0,5%)**.

Causa raiz: **o painel mede ESTADO, o motor exigia EVENTO.** Os presets só
entravam se o cruzamento (MACD/EMA/Donchian) acontecesse no candle exato, com
todos os blocos em AND. Tendência já estabelecida — justamente o cenário que o
painel mostra como bom — nunca produz cruzamento novo. Quanto melhor a
tendência, menos sinal.

### Mudanças (Onda 1, aprovada pelo Cleber inteira)

1. **Score contínuo ligado em produção.** `evaluateStrategyScoreBothSides`
   substitui o AND binário no motor ao vivo. Cruzamento decai 10 pts/candle
   numa janela de 10 (`scoreBlock`, escrito em 2026-08-16 e nunca ligado até
   hoje). Piso configurável: `aiConfig.signalScoreFloor`, default 60 — **100
   reproduz exatamente o comportamento antigo**, o que torna a mudança
   reversível por config.
2. **Fim do long-only no motor ao vivo.** Todos os 5 presets ganharam
   `shortEntryBlocks` espelhados. A decisão de escopo de 2026-07-30 (não fazer
   short porque `exitBlocks` não sabem o lado) foi revista com base numa
   verificação: `evaluateExitAt` só é chamado pelo `BacktestEngine.ts:140` — o
   motor ao vivo sai por TP/SL em ATR + trailing/breakeven, nunca por
   `exitBlocks`. **O backtest segue long-only de propósito**, pra que a
   medição histórica dele continue comparável.
3. **Ranking substitui sorteio.** `Math.random()` por tier saiu. Agora:
   refresh round-robin de 6 ativos/tick → ranking por score de TODA a cesta em
   cache → tenta executar em ordem de score (até 5 candidatos) até abrir uma
   posição. Separar "atualizar dado" de "decidir" é o que torna cesta grande
   compatível com o orçamento de chamadas.
4. **Cesta padrão: 2 → 39 ativos** (`config/defaultBasket.ts`), com critério
   objetivo declarado (liquidez de primeira linha, cobertura de classe e fuso,
   ATR que comporta o custo). Exóticos de FX ficaram fora de propósito.
   XAGUSD segue fora — foi removido por medição em 2026-08-16, e reverter isso
   exigiria remedir, não supor.
5. **TTL do buffer de candles = 1 barra do timeframe** (era 60s fixo). Em 15m
   isso eliminava 14 de cada 15 chamadas que retornavam candles fechados
   idênticos.

### Dois bugs de custo achados no processo, ambos corrigidos

Medidos em `ai_decisions.risk_assessment` (dado real de produção):

- **Classe de custo vinha de `symbolMappingService` (81 símbolos) sobre um
  catálogo de 480.** Todo símbolo de fora caía em `FOREX_MAJOR`. `XBNUSD`
  (BNB) recebia custo **0,2258% em vez de 0,0291% — 7,8x inflado**, e sozinho
  respondia por **312 dos 562 vetos de `COST_GATE`**. `COCUSD` (cacau) errava
  para o lado perigoso (custo subestimado, aprovaria o que devia reprovar).
  Corrigido em `services/risk/CostAssetClass.ts`: catálogo é fonte primária,
  fallback explicitamente sinalizado (`costClassSource`).
- **Denominador errado no gate de custo.** O gate comparava o custo contra o
  ATR de UMA barra, mas o trade tem alvo de 3,75×ATR (stop 1,5×ATR × R:R 2,5).
  Isso inflava a razão custo/movimento por 3,75x. Exemplo real: XAUUSD, custo
  0,0077% e ATR de barra 0,0422% → reprovado (18,2%); contra o alvo real →
  4,9%, viável. **Os limiares 7%/12% não foram tocados** — só o denominador,
  que agora responde à pergunta que o gate se propõe a fazer.

### Pendência de calibração encontrada, NÃO corrigida (precisa de medição)

`COST_TABLE.INDEX` usa `spreadPoints: 3.0`, calibrado com US30 (≈44.000
pontos). Aplicado ao SPX500 (≈6.100), dá custo de 0,1475% contra 0,0205% do
US30 — **7x**, só por diferença de escala do índice, não de spread real. O
spread real do SPX500 é bem menor que 3 pontos. Corrigir exige spread medido
por índice; inventar número seria fabricar dado. Fica registrado como
pendência real.

### Verificação

- `npm run validate`: **265 asserções em 16 suítes, todas verdes** (eram 227
  em 14). Duas suítes novas: `__validate__bothsides__.ts` (19) e
  `__validate__costclass__.ts` (19).
  A suíte de duas pernas trava a regressão que mais importa — alguém remover
  `shortEntryBlocks` e devolver a IA ao estado long-only sem perceber.
- `tsc --noEmit`: **578 erros antes, 578 depois, diff vazio** — zero erro novo
  (comparação feita com `git stash`).
- `deno check` do `ai-runner`: limpo — o runner server-side continua
  importando o motor.
- **Nada rodou contra mercado real ainda.** Ver item 2 do "COMECE AQUI".

## Feed de dados — números levantados (decisão do Cleber pendente)

O problema nunca foi "MetaAPI é ruim": é usar uma **API de execução, em conta
compartilhada entre todos os usuários**, como **feed de dados de mercado**.

Orçamento de chamadas com a arquitetura nova (tick de 60s):
- 6 chamadas de candles/min (refresh escalonado) + ~2 de preço/min (só dos
  candidatos que chegam à execução) ≈ **8/min, ~11.500/dia**.
- Com a cesta de 39 no desenho ANTIGO seria ~78/min (~112.000/dia). O ganho
  veio do TTL por barra + preço só do candidato, não de cortar cobertura.

Opções, com o que cada uma custa:
- **Twelve Data Grow — US$29/mês**: 55-377 chamadas/min. Cobre ~8/min com
  folga de 7x. Cobre forex, índices, commodities, cripto e ETFs num só
  endpoint, REST + WebSocket. O plano free (8/min mas **800/dia**) NÃO serve —
  o teto diário mata.
- **MetaAPI**: mantém-se só para execução (volume baixo). O que precisa mudar
  é a **conta compartilhada → conta dedicada por usuário**; o preço é por
  conta MT4/MT5 conectada.
- **Alternativas MT5 pay-as-you-go**: Indexnano (sem assinatura, paga por
  hora ativa), API2Trade, MetaTraderAPI.dev. Só valem a avaliação se a decisão
  for trocar a camada de execução também.

Ressalva: os números de plano vêm de páginas de fornecedor/comparativos, não
de contrato lido. Confirmar no site antes de contratar.

## Commits pendentes (Cleber precisa rodar)

```bash
git add -A && git commit -m "feat: cerebro de decisao passa a ler estado, opera os dois lados e ranqueia a cesta

- score continuo (evaluateStrategyScoreBothSides) substitui o AND binario no
  motor ao vivo; piso configuravel em aiConfig.signalScoreFloor (100 = antigo)
- perna short simetrica nos 5 presets (backtest segue long-only de proposito)
- ranking da cesta substitui o sorteio por tier com Math.random()
- cesta padrao de 2 para 39 ativos com criterio objetivo declarado
- TTL do buffer de candles passa a ser 1 barra do timeframe (era 60s fixo)
- fix: classe de custo vinha de 81 mapeamentos sobre catalogo de 480 (XBNUSD
  com custo 7,8x inflado respondia por 312 dos 562 vetos de COST_GATE)
- fix: gate de custo media contra ATR de 1 barra, nao contra o alvo de 3,75xATR
- gate: 227 -> 265 asercoes (duas pernas + classe de custo)"
```

## Estado herdado, sem mudança nesta sessão

- Módulo de assimetria de risco (stop/alvo por ATR + breakeven em +1R) e o fix
  do "Desligar AI" vieram da sessão anterior e **entram no mesmo commit** —
  não haviam sido commitados. Realização parcial em +2R segue descopada.
- Painel "Setup Validado" do Dashboard: copy corrigida na sessão anterior
  (mostrava entrada recomendada fabricada, desconectada do motor real).
- Perfil Experimental (`riskProfiles.ts`) sem plano de promoção a validado.
- Marketplace.tsx com rating/reviews/vendas fabricados (exceto `strat-001`).
- Roteamento de cripto (Binance direto vs MetaAPI) — decisão do Cleber ainda
  pendente, ver CLAUDE.md item 3.
