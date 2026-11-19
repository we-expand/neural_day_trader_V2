# Skill externa "day-trader-skill" (Jake Schincariol) — teste e veredito

Data: 2026-11-09. Repo: github.com/Jakeschincariol/day-trader-skill (v2.0.0, MIT).

## O que é
11 skills de Claude Code + scripts Python (só biblioteca padrão). Ações dos EUA,
pregão NYSE, dados grátis do Yahoo/SEC/House Clerk. Núcleo operacional: setup
"ORB" (rompimento da faixa de abertura de 15 min), stop no meio da faixa, alvo 1R,
sair às 15:55; "Time Machine" = bootstrap de 10.000 sessões com velas de 5m dos
últimos 60 dias + a mesma regra reaplicada nas 59 sessões passadas.

Segurança: lido o código, só acessa endpoints públicos; não envia ordem sozinho
(depende de MCP da Alpaca + "sim" do usuário). 315/315 testes offline passam.

## Teste feito (script: `orb_test.py`, saída: `results.txt`)
Regra ORB da própria skill (`history_replay` do `timemachine.py`, sem mudança),
nas 59 sessões completas mais recentes do Yahoo (até 2026-11-07), em
SPY/QQQ/IWM/DIA (equivalentes a SPX500/NAS100/US2000/US30), TSLA, BTC-USD e
ETH-USD (cripto na janela 9:30–16:00 de NY). Variações: compra/venda, faixa de
15/30 min, stop no meio/na ponta da faixa, alvo 1R/2R = 112 combinações.
Custo ida+volta descontado em R (índices 0,01–0,02%, TSLA 0,03%, BTC 0,07%,
ETH 0,10%, alinhado ao `COST_SOURCE_OF_TRUTH.md`).

## Resultado
- 112 combinações; 9 com R líquido > 0, **nenhuma com significância** (maior t = +0,81).
- 7 combinações com |t| > 2 — **todas negativas**.
- Média de R líquido de todas: **−0,157R por entrada**.
- Cripto: bruto levemente positivo em várias, mas o custo (0,07–0,10%) apaga tudo.
- Bate com o próprio README da skill: o exemplo deles (TSLA) dá "close to a coin flip".

Limites: 59 sessões por ativo (n de 22 a 47 entradas por combinação), janela
única (ago–nov/2026), sem walk-forward. Suficiente pra dizer "não há sinal
forte"; não pra afirmar que nunca existe.

## Veredito
**Não instalar na LLM do motor.** Não traz vantagem nova (ORB sem edge, igual
às buscas de julho/ago), é feita pra ações dos EUA/NYSE (o motor opera CFDs e
cripto 24/7 no MT5) e é formato de skill do Claude Code — o `llm-active-brain`
roda modelos NVIDIA via prompt/ferramentas, então "instalar" seria reescrever.
O "Time Machine" é um bootstrap que embaralha velas: por construção não acha
vantagem, só mostra a taxa-base de stop×alvo — o `harness.ts` (com cofre e
canária) já faz a validação de verdade melhor.

Aproveitável, se quiser: a linha de veredito "empate exige acertar 1/(1+R)"
(50% em 1R, 33% em 2R) é uma boa regra pra mostrar na boleta manual.
