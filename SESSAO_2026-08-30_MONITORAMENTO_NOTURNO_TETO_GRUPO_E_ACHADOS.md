# Sessão 2026-08-30 (noite) — Monitoramento contínuo do Cérebro LLM Ativo, 5 em 5 min

## Contexto
Continuação do monitoramento ao vivo da sessão `aa279c75-1acd-49aa-9fef-a76e8ddf0b2e`
(llm-active-brain, isolado do motor mecânico principal). ~66 checagens de 5 em 5
minutos, das ~19h às ~01h UTC (30/31-08). Monitoramento **desarmado a pedido do
Cleber** ao final — sem loop ativo agora.

## Resultado da sessão no momento do desarme
**32 trades fechados, 6 vitórias (18,75% de acerto), -$56,46 líquido.** Sem
posição aberta. Amostra pequena, sem validade estatística — retrato do
momento, não conclusão sobre o desenho do cérebro.

## Achado real corrigido nesta sessão (commitar quando o Cleber quiser)

**Bug: teto de exposição do grupo correlacionado furável por uma única entrada
grande.** A checagem em `src/tools.ts` (antes do fix) somava só a exposição
JÁ aberta contra o teto (`config.mt5MaxCorrelatedNotionalUsd = $2.700`), nunca
incluindo a entrada que estava sendo aberta naquele momento. Confirmado ao
vivo: com XETUSD SHORT já aberta (~$1.212, dentro do teto), um SOLUSD SHORT
"forte" ($1.800) passou direto porque o código só validava os $1.212
existentes — resultado: exposição SHORT combinada real em $3.012, 12% acima
do limite, e só as tentativas SEGUINTES de abrir mais foram bloqueadas
(depois do estrago feito).

**Fix aplicado no código** (ainda não commitado, ver pendência abaixo):
segunda checagem inserida logo após o cálculo de `amountUsd` (exposição real
da nova entrada), somando-a à exposição já aberta antes de decidir — fecha o
buraco sem remover a checagem antecipada original (que ainda evita gastar a
chamada de cotação quando o grupo já está no teto de partida). Localização:
`src/tools.ts`, bloco logo após "teto absoluto de segurança", antes do
cálculo de stop/take-profit. `npx tsc --noEmit` limpo.

## Pendências reais em aberto

1. **Restart do processo nunca aplicado nesta sessão.** Dois fixes prontos
   esperando: (a) o fix do teto de grupo acima; (b) retry contra erro de
   conexão transitório no stop/alvo mecânico (achado em sessão anterior,
   mesmo dia). Comando pronto:
   ```bash
   cd llm-active-brain
   kill $(ps aux | grep "tsx.*src/index.ts" | grep -v grep | awk '{print $2}' | head -1)
   npm run start > llm-brain.log 2>&1 &
   ```
   Confirmar depois que sobrou só 1 processo (`ps aux | grep tsx.*src/index.ts`).
2. **Nenhum commit feito** (regra do projeto — Claude nunca commita sozinho).
   Rodar `git status`/`git diff -- llm-active-brain/src/tools.ts` pra ver o
   diff e commitar quando o Cleber quiser.

## Achados de qualidade do modelo catalogados (sem fix de código possível — já documentados em sessões anteriores, reforçados aqui)

- **Validador semântico (`reasoningValidator.ts`) segue caindo em fail-open
  com frequência**, mesmo depois do aumento de `max_tokens` (150→600) de
  sessão anterior. Causa raiz confirmada de novo: o modelo (Nemotron,
  reasoning model) gasta tokens em texto livre antes do JSON e estoura o
  budget. Em pelo menos 2 ocorrências nesta sessão isso deixou passar
  contradição real (ex: abrir SHORT citando "stochastic cruzou pra cima" —
  sinal tipicamente de alta, não de baixa). **Ação recomendada, não
  aplicada**: configurar `MT5_REASONING_VALIDATOR_MODEL` pra um modelo
  sem chain-of-thought — decisão de infraestrutura do Cleber, não decisão de
  código.
- **Padrão "decisão narrada mas não executada"**: o modelo repetidamente
  escreve no `reasoning` do `stop()` que vai fechar/abrir uma posição, mas
  não chama `close_position`/`open_position` de fato. Ocorreu dezenas de
  vezes na sessão. **Sem impacto financeiro** — só `open_position`/
  `close_position` movem dinheiro de verdade, `stop()` é inerte. Não é bug
  de código, é característica do modelo (parece se "convencer" no texto sem
  concluir a ação).
- **Tamanho "forte" usado em apostas de convicção mais fraca, não mais
  forte** (2 ocorrências: SOLUSD SHORT -$10,84 fechado por stop mecânico;
  BTCUSD LONG "forte" contra a tendência prevalente, fechou como vitória
  pequena depois). Padrão comportamental a observar em sessões futuras — não
  é bug corrigível com segurança, é julgamento do modelo.
- **Corrupção de texto/tags XML vazando pro campo `reason`** de uma chamada
  `stop()` (1 ocorrência, sem efeito prático — `stop()` não executa nada).
  Mesma categoria já catalogada em sessões anteriores ("degradação do
  modelo, sem fix de código possível").
- **Aviso de "feed travado" em DOGUSD investigado e desqualificado como bug
  real**: confirmado que é ruído de arredondamento (DOGUSD só tem 4 casas
  decimais, ativo de baixo valor) — o preço muda entre ciclos e
  `tickAgeSeconds` sempre ficou baixo. Não repetir esse achado em sessões
  futuras a menos que apareça em outro símbolo com preço/decimais normais.

## Achados positivos confirmados ao vivo (defesas funcionando como desenhado)

- Trava de ≥50% do caminho até stop/alvo bloqueou um fechamento prematuro de
  DOGUSD explicitamente (mensagem completa: "48% do caminho até o stop, -24%
  até o alvo... confirmado ao vivo 2x hoje").
- Trava de cotação fresca (`"Voce ainda nao chamou get_mt5_quote..."`)
  bloqueou tentativas de abrir/fechar posição com dado potencialmente velho,
  múltiplas vezes.
- Teto de 1 posição por símbolo bloqueou tentativas de duplicar exposição no
  mesmo ativo, inclusive um caso onde o próprio reasoning contradizia a
  `list_open_positions` chamada segundos antes no mesmo ciclo.
- Validador semântico bloqueou pelo menos 2 tentativas reais de
  abrir/fechar posição com reasoning genuinamente contraditório (não é
  sempre fail-open — quando funciona, funciona certo).
- Trailing stop / breakeven moveu corretamente em pelo menos 3 posições
  observadas (BTCUSD LONG, DOGUSD SHORT), protegendo lucro conforme o preço
  avançava a favor.

## Próximo passo recomendado

1. Aplicar o restart (comando acima) pra colocar os 2 fixes em produção.
2. Depois de alguma amostra nova rodando com os fixes, decidir sobre
   `MT5_REASONING_VALIDATOR_MODEL` — precisa de um modelo real disponível no
   provedor atual sem chain-of-thought, ainda não levantado.
3. Amostra atual (18,75% de acerto, -$56,46) não é suficiente pra julgar o
   redesenho de risco desta sessão — precisa de mais dias, não horas.
