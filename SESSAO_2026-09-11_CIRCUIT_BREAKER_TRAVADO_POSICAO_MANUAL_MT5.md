# Sessão 2026-09-11 (noite) — Circuit breaker travando execução real por posição aberta manualmente no MT5

## Contexto

Cleber reportou que a LLM não estava abrindo posições e pediu pra checar se
era saldo. Investigação real (log do processo + Supabase + consulta direta
à corretora), não suposição.

## Causa raiz #1 (a que realmente travava tudo): circuit breaker global

Não era saldo. O log mostrou, logo no ciclo 1 deste processo (~19:49 UTC):

```
[liveExecution] 🔴 CIRCUIT BREAKER ACIONADO -- execucao real DESLIGADA (todos os usuarios) ate restart manual.
Motivo: Corretora tem posicoes reais [1214146705] que o motor nao reconhece (sessao 649295b1-...).
```

Esse breaker (`liveExecution.ts`) é **global, em memória, e fica travado até
restart manual por desenho** — protege contra operar às cegas quando o
estado real da corretora diverge do que o banco (`ai_trades`) espera.
Confirmado no Supabase: `1214146705` não existia em nenhuma linha de
`ai_trades` — era uma posição real. A partir daí, 5 tentativas de
`close_position` falharam com "Execucao real desligada", e nenhuma abertura
nova conseguia sair do papel.

**Explicação real, confirmada pelo Cleber**: ele tinha aberto 2-3 posições
manualmente direto no terminal MetaTrader (fora da plataforma) — cenário
exatamente para o qual esse circuit breaker foi desenhado. Consultei a
corretora ao vivo (`getLivePositions`) e confirmei que as 3 posições reais
existentes no momento (NAS100 compra 0.04, BTCUSD compra 0.15, BTCUSD venda
0.1) já batiam com o banco — a posição órfã que disparou o breaker já tinha
sido fechada nesse meio-tempo. Reiniciei o motor (`./restart.sh`) pra
limpar a flag em memória; confirmado que não retriparou.

## Fix de código já existente (achado no working tree, não commitado ainda)

Ao investigar, achei que **já existia um diff pendente** (de sessão
anterior a esta, nunca commitado) em `index.ts`/`neuralBridge.ts` que
resolve esse problema de raiz: em vez de travar tudo quando a corretora tem
posição não reconhecida, a reconciliação agora **adota automaticamente**
essa posição (`openMt5Position` com `stopLoss`/`takeProfit` null — sem
inventar proteção que o dono não escolheu, já que não foi a plataforma quem
abriu) e só aciona o breaker se essa adoção em si falhar. Como o motor roda
via `tsx` direto do código-fonte (sem build), esse fix já estava ativo no
processo reiniciado nesta sessão, antes mesmo do commit. Commit entregue
nesta sessão (comando pronto, aguardando Cleber rodar) juntando esse fix +
um ajuste pendente do classificador de regime HMM (`hmmRegime.ts`, de
sessão anterior, não relacionado).

## Causa raiz #2 (separada, RESOLVIDA nesta sessão): teto de exposição correlacionada estourado

De carona, achei que mesmo destravando o breaker, entradas LONG novas em
qualquer cripto da cesta continuariam bloqueadas: o teto de exposição do
grupo correlacionado (`mt5MaxCorrelatedNotionalUsd`, `config.ts`, fixo em
`$2700` desde 2026-08-30) já estava em `$11559-12102` de exposição LONG
real — não é bug, é o gate de risco funcionando como desenhado, mas ficou
pequeno demais pra cesta 100% cripto atual (tudo correlacionado entre si).

**Decisão do Cleber** (ele queria mais volume de entrada no fim de semana,
~15 trades/12h): subiu o teto pra **$15.000** (`MT5_MAX_CORRELATED_NOTIONAL_USD`,
adicionado ao `.env` do `llm-active-brain`, motor reiniciado — não é
código, é variável de ambiente, não precisa de commit). Confirmado depois
que o gate de exposição correlacionada não apareceu mais nas tentativas de
entrada seguintes — quem passou a bloquear foi a seletividade normal
(confiança/confluência/R:R), não mais esse teto.

## Achado sério, separado de tudo acima: drawdown real de ~50% na conta

Ao verificar por que o Dashboard continuava mostrando "RISCO ALTO" mesmo
depois do commit de mais cedo (que só corrigiu a *exibição* do drawdown,
não o resultado), confirmei DIRETO na corretora (não just cache do app,
via `getLiveAccountInfo`): **saldo real $9,11**, equity real (saldo +
flutuante) subindo de $27,31 pra $28,38 minutos depois — contra
`allocatedCapitalUsd=$54,03`. Confirmado também via SQL: 4 trades reais
fechados na sessão, PnL líquido **-$35,13**. Drawdown real na hora:
~49-50% do capital alocado, bem acima do teto de 25% configurado. **Não é
bug de dashboard — é perda real**. Cleber confirmou ciente ("fui ao que
perdi, mas está recuperando") — equity real de fato subindo (via PnL
flutuante das posições abertas, principalmente BTCUSD LONG que estava no
lucro), mas ainda em drawdown alto no momento em que a sessão foi
encerrada.

## 3 tentativas de abertura testadas depois do ajuste do teto — todas bloqueadas por seletividade normal, não pelo teto

Depois do teto novo, o motor tentou 3 entradas, nenhuma passou:
1. XETUSD SHORT (confiança 78,5%) — abaixo do mínimo de 80%.
2. XETUSD SHORT de novo (81%) — recusado por mercado LATERAL sem nenhum
   fator técnico real confirmando o lado (0 fatores alinhados).
3. DOGUSD LONG (82%) — recusado por R:R desfavorável (resistência real a
   só 0,72% de distância, não cobre nem 1:1).

Confirma que o teto de $15.000 resolveu o gargalo que ele mesmo pediu pra
resolver — o que trava agora é o crivo técnico normal, comportamento
esperado em mercado lateral de fim de semana, não uma falha.

## Estado ao final da sessão

- Motor reiniciado várias vezes ao longo da sessão (PID final: 47262/47261),
  circuit breaker limpo, execução real funcionando (abrir/fechar).
- Teto de exposição correlacionada subido pra $15.000 (`.env`, sem
  commit necessário).
- Commit entregue (comando pronto, Cleber ainda precisa rodar):
  `hmmRegime.ts` + `index.ts` + `neuralBridge.ts` (fix de auto-adoção de
  posição órfã).
- **Achado real, sem ação de código**: drawdown real ~50% do capital
  alocado nesta sessão (perda de $35,13 em 4 trades reais fechados) —
  equity mostrando sinal de recuperação ao fim da sessão, mas ainda alto.
  Nenhuma mudança de mecânica de risco foi feita por causa disso além do
  teto de correlação já decidido por Cleber antes desse achado aparecer.
- **Pendente real**: `git push origin dev` do commit acima (comando
  entregue); observar se o teto de $15.000 realmente destrava o volume de
  entrada desejado (~15/12h) ao longo do fim de semana, ou se a
  seletividade (confiança 80%/confluência/R:R) segue sendo o gargalo
  dominante mesmo com mais espaço de exposição.
