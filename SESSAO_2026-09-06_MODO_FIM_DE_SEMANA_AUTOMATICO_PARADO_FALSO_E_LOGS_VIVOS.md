# Sessão 2026-09-06 — Modo fim de semana automático, "Sistema Parado" falso, e Logs do Sistema mais vivos

## Contexto

Cleber pediu confirmação de que a virada sexta 18h→domingo 19h Brasília
(`isWeekendMode`, `assetBasket.ts`) é automática pra sempre, sem precisar
lembrar/reconfigurar. Depois pediu acompanhamento de 5 em 5 minutos do LLM
Brain (abre posição? está saudável?). No meio do acompanhamento, reportou
ver "Sistema APEX Parado" no painel e perguntou se a IA não consegue
monitorar posições abertas e analisar ativos ao mesmo tempo. Por fim, pediu
pra deixar o painel "Logs do Sistema" mais vivo (ficava com "aguardando"
a maior parte do tempo).

## 1. Confirmado: virada de fim de semana é automática, código não muda

`isWeekendMode()` (`llm-active-brain/src/assetBasket.ts:263`) calcula a
janela (sexta 18h → domingo 19h Brasília) toda vez que é chamada, com base
no relógio real — não é flag manual, não precisa reconfigurar, se repete
todo fim de semana pra sempre. Confirmado **ao vivo, na própria sessão**:
o log mostrou a cesta e os thresholds (Estocástico, teto de
entradas/24h — 24 no fim de semana vs 16 normal) mudando sozinhos entre o
ciclo 15 (`isWeekend:true`) e o ciclo 17 (`isWeekend:false`), exatamente no
cruzar das 19h de hoje (domingo). Nenhuma ação de código necessária — pedido
do Cleber foi só deixar como está e revisitar o desenho comportamental
completo (ainda não existe, só os ajustes pontuais de parâmetro) no próximo
fim de semana.

## 2. "Sistema APEX Parado" no painel — falso alarme, não um bug de trading

Cleber viu no painel (screenshot): 3 linhas com o MESMO timestamp exato
(19:15:17) — "🚀 Sistema APEX Iniciado", "🛑 Sistema APEX Parado — 2
posição(ões)... nenhuma posição nova será aberta", "🛑 SAÍDA LONG: SOLUSD...
(fechada pelo servidor)" — e perguntou se a IA não consegue monitorar +
analisar ao mesmo tempo.

**Confirmado que o motor NÃO estava parado de verdade**:
- Supabase (`ai_sessions`, sessão `6d0ada13-...`): `status = RUNNING`,
  `updated_at` = 22:11 UTC (antes do suposto "Parado" às 22:15 UTC / 19:15
  BRT).
- `llm-brain.log`, no mesmo instante: motor ativamente consultando
  XAUUSD/SOLUSD pra possível entrada nova — nada travado.
- As 3 linhas do painel com timestamp idêntico são assinatura clássica de
  **replay de histórico no mount/reload da página** (`useApexLogic.ts`
  re-hidrata log ao montar), não 3 ações reais no mesmo segundo.

**Resposta à pergunta real do Cleber**: sim, o motor já faz as duas coisas
sempre, todo ciclo — consulta a cesta inteira pra entrada nova E gerencia
stop/breakeven/trailing das posições abertas (esse último também via
watchdog independente de 5s, desacoplado do raciocínio do LLM). Mesmo se
alguém clicasse "Parar IA" de propósito (`stopLogic()` em
`useApexLogic.ts:2492`), a regra desde 2026-08-21 é: nunca fecha posição à
força, só impede ABERTURA de posição nova — o monitoramento das existentes
nunca para. Nenhum código foi mudado aqui porque não havia bug de trading —
só um artefato cosmético de exibição no reload, registrado como achado, não
corrigido (fora do escopo desta sessão, baixa prioridade).

## 3. Logs do Sistema "morto" na maior parte do tempo — causa real e fix aplicado

Cleber reclamou que o painel "Logs do Sistema — Atividade da IA" fica com
"aguardando..." a maior parte do tempo, e que o usuário gosta de ver o que
está acontecendo.

**Causa raiz real** (não suposição — medida direto no Supabase): a
infraestrutura de `ai_brain_activity_log` (implementada mais cedo hoje,
ver entrada "RESOLVIDO 2026-09-06" no topo do CLAUDE.md) já grava TUDO —
841 linhas de `tool_call` na sessão corrente, atualizado a cada poucos
segundos quando o modelo está ativo. O problema é que existem **gaps reais
de 1 a 3 minutos** entre um lote de tool-calls e o próximo, porque nesse
intervalo o modelo local (Ollama, Qwen3.5 via llama-server) está
"pensando" — e até agora NADA era gravado durante essa janela, só depois
que o modelo decidia uma tool-call. Confirmado no próprio log: gaps de
56s, 1m28s, 2m48s entre linhas consecutivas.

**Fix aplicado** (não é fabricação de progresso — é uma declaração real de
que a inferência começou):
- `llm-active-brain/src/agent.ts` (~linha 815, dentro do loop de
  iterações do `runAgent`): heartbeat `logBrainActivity` novo, gravado
  ANTES de cada chamada ao modelo (`createChatCompletionWithRetry`), com
  a mensagem "Analisando cesta e posições abertas (iteração N)...".
- `llm-active-brain/src/neuralBridge.ts`: `BrainActivityType` ganhou o
  valor `"thinking"` (tabela `ai_brain_activity_log.type` é `text` livre,
  sem CHECK constraint — não precisou de migration).
- `src/app/hooks/useApexLogic.ts` (~linha 1663): `typeLabel` mapeia
  `thinking` pro ícone ⏳ no painel.

`tsc --noEmit` limpo no `llm-active-brain/` (zero erros). No frontend,
634 erros — mesma contagem já catalogada como ruído pré-existente, nenhum
novo introduzido.

**Confirmado ao vivo**: processo reiniciado (`./restart.sh`), heartbeat já
gravando no Supabase minutos depois do restart — linha
`"Analisando cesta e posições abertas (iteração 1)..."` com `type=thinking`
confirmada via SQL direto, timestamp poucos segundos depois do
`cycle_start`.

**Pendência conhecida, fora do escopo**: `ai_brain_activity_log` ainda não
tem limpeza automática (já catalogado na migration original,
`20260906_add_ai_brain_activity_log.sql`) — este fix aumenta um pouco o
volume de linhas por ciclo (mais um heartbeat por iteração), mesma ordem de
grandeza do que já existia. Considerar job de retenção numa sessão futura
se o crescimento virar problema real.

## 4. Achado colateral, monitorado mas não crítico: DOGUSD "mesmo preço repetido"

Durante o acompanhamento de 5 em 5 min, o log mostrou repetidamente
`[mt5Broker] DOGUSD devolveu o MESMO preco Nx seguidas -- possivel feed
travado (tick obsoleto, nao SIMULATED)`, chegando a 6x seguidas em alguns
momentos. Ainda rotulado pelo próprio código como "possível", não
confirmado — não bloqueou nenhuma decisão real observada nas rodadas
checadas. Não investigado a fundo (acompanhamento foi encerrado a pedido
do Cleber antes de virar prioridade). Se voltar a aparecer com frequência
alta, vale investigar se é feed realmente travado ou só baixa
volatilidade real do ativo nesse período.

## Estado ao fim da sessão

- Motor rodando (1 processo, sem zumbi), sessão `RUNNING`, 2 posições
  abertas sendo monitoradas normalmente no momento em que o acompanhamento
  foi encerrado (a pedido do Cleber: "pode parar de monitorar
  definitivamente").
- Fix do heartbeat já aplicado E RODANDO em produção local (não é código
  pendente de restart — o restart já foi feito nesta sessão).
- **Pendente**: commit dos 3 arquivos alterados
  (`llm-active-brain/src/agent.ts`, `llm-active-brain/src/neuralBridge.ts`,
  `src/app/hooks/useApexLogic.ts`) — comando abaixo, pronto pro Cleber
  rodar.

```bash
git add llm-active-brain/src/agent.ts llm-active-brain/src/neuralBridge.ts src/app/hooks/useApexLogic.ts
git commit -m "$(cat <<'EOF'
feat: heartbeat de "pensando" no painel Logs do Sistema durante inferência local

O painel ficava com gaps reais de 1-3min sem nenhuma linha nova enquanto o
modelo local (Ollama) processava uma iteração, dando impressão de sistema
parado. Novo tipo de atividade "thinking", gravado antes de cada chamada
ao modelo, preenche esse intervalo com uma declaração real (não fabricada)
de que a inferência começou.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
