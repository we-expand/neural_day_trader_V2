# Handoff — sessão de 2026-07-30 (noite)

> Para retomar em sessão nova. Leia isto + [`verdict.md`](./verdict.md).
> Não é necessário reler a conversa original.

## O que foi pedido

Backtest de cruzamento SMA 40/100 em M1 no BTCUSD, entrada após pullback,
stop 60 / alvo 80 pontos, 0,01 contrato — e depois, sucessivamente: otimizar,
testar M5/M15 com pullback de segundo toque, subir a taxa de acerto acima de
80%, e avaliar stop dinâmico.

## O que foi feito

**6.000+ configurações testadas**, 4 ativos, até 5,6 anos de dado M1,
walk-forward com embargo, Deflated Sharpe corrigido pelo N acumulado da busca.
Ferramentas do projeto (`CostModel.ts`, `DataSplit.ts`, `DeflatedSharpe.ts`)
portadas para Python com fórmulas e constantes idênticas.

## Os 5 achados que importam

### 1. `CostModel.ts` superestima custo de cripto em ~18x  ⚠️ AÇÃO PENDENTE

`COST_TABLE.CRYPTO` = 0,26% round-trip. O real, medido: **0,0145%**
(Pepperstone, BTCUSD spread médio 15,82 USD sobre 108.829,77, sem comissão em
cripto, 1 lote = 1 BTC, janela 01–30/04/2026). O `0,08% commissionPercent`
parece calibrado com taxa de **exchange spot** (típico Binance/Coinbase), não
de **CFD**, onde não há comissão separada.

**Impacto**: a seção 11.13 do `AI_BRAIN_SPEC.md` (cesta cripto, Donchian DSR
52%) e o experimento `2026-07-30-custom-sma-pullback` rodaram com esse custo.
Suas conclusões precisam ser remedidas.
**Status**: task de correção foi iniciada em sessão separada (`task_d4fc7a53`).
Verificar se concluiu.

**Sobre a Infinox**: não publica custo de cripto em nenhuma fonte verificável.
Trading Conditions e Product Information têm tabelas completas de Forex, Ações,
Futuros e Índices e **nenhuma linha de cripto**; a página de instrumentos lista
só BTCXAU/BTCXBN/BTCXET (cruzados), sem BTCUSD. Única cifra de terceiros
(AskTraders, jul/2022) é autocontraditória ("0.69 on BTCUSD" e "$69 bid-offer"
na mesma página). Pepperstone foi usada como âncora medida — mesma prática que
o `CostModel.ts` já adota para INDEX.

### 2. O edge existe, é robusto, e é menor que o custo

Com **202.075 trades** de holdout: acerto 44,66% contra 42,86% neutro,
**z=+16,38**. Não é ruído. Mas vale **+2,35 pontos/trade**, e o menor custo de
mercado é **5,1 pontos**. Razão edge/custo = **0,29** (precisa ser >1).

O edge **decai com o tamanho do stop** e vira negativo a partir de 446 pts —
é microestrutura de 1–5 minutos, não propriedade de tendência. Por isso
aumentar stop/alvo para diluir o custo não funciona.

**Cuidado com janelas curtas**: 6 meses mediram +6,11pp de edge; 5,6 anos
medem +1,80pp. A janela jan–jul/2026 inflou **3,4x**. Mesmo padrão da seção
11.11 do spec.

### 3. Taxa de acerto alta é aritmética, não edge  ⭐ conceito central

A taxa neutra é `L/(R+L)` — consequência do R:R, não do sinal. Medido em 1.455
configurações: o acerto vai de 33% a 80% **só mudando o R:R**, com o neutro
colado. Nas faixas de acerto alto a estratégia acerta **menos que o acaso**
(−3,31pp em R:R 1:0,20).

A meta de 80% **foi atingida** (170 configurações, melhor caso 87,91%) e é
vazia: edge médio dessas 170 = **−0,03pp**. O campeão de 87,91% tem p bruto
0,017 (significativo isolado) mas **p=1,000 após Bonferroni** pelos 1.455
testes. DSR máximo: 1,8%.

**Nunca avaliar estratégia por taxa de acerto.** Usar expectativa por trade em
pontos vs custo em pontos — imune ao truque do R:R.

### 4. Stop dinâmico não cria expectativa (Teorema da Parada Opcional)

Testado trailing para breakeven em 4 gatilhos: **todos reduziram a
expectativa** (+68,54 → +17 a +53 pts/trade). Decomposição exata do caso 30%:
salva 7,93pp × 1.395 pts (+110,64) mas sacrifica 50,50pp × 279 pts (−140,90) =
**−30,26 pts/trade**, confere na casa decimal com o medido.

Sacrifica **6,4x mais trades do que salva** — o preço oscila, e um vencedor
frequentemente recua até a entrada antes de chegar ao alvo.

**Fundamento (Doob)**: sem drift previsível, qualquer regra de parada que
dependa só do caminho percorrido tem a mesma expectativa. Vale para trailing,
breakeven, parcial, ATR, saída por tempo, pirâmide. Elas redistribuem a
distribuição (acerto, variância) mantendo a média — e adicionam custo.
Só cria valor uma saída que use **informação nova**.

### 5. O teste cross-asset encerra a linha de busca  ⭐ achado estrutural

**Pergunta**: a razão edge/custo é propriedade do ativo (BTC caro demais) ou do
sinal (lei da estratégia)? Critério de corte fixado antes: razão >1,0 em ≥2
ativos, DSR≥95%, n≥100.

| Ativo | n | acerto | neutro | z | edge/custo |
|---|---:|---:|---:|---:|---:|
| BTCUSD | 4.996 | 45,72% | 42,86% | +4,08 | +0,726 |
| EURUSD | 791 | 38,69% | 42,86% | −2,37 | **−1,509** |
| US30 | 1.016 | 42,03% | 42,86% | −0,53 | −0,426 |
| US500 | 1.045 | 41,53% | 42,86% | −0,87 | −0,464 |

**0 de 4 passam. Em EURUSD/US30/US500 o edge BRUTO é negativo** — o sinal opera
contra, não apenas "abaixo do custo". O padrão "cruza → pullback → resume"
**reverte** nesses mercados. O comportamento positivo em BTC parece específico
à estrutura daquele mercado (24/7, sem gap de fim de semana, fluxo
varejo/algo), não uma propriedade geral de médias móveis com pullback.

**Bug de dado encontrado e corrigido**: o feed diário do Dukascopy preenche
minutos sem negociação com candles achatados (O=H=L=C), não com buraco —
~35–40% dos candles de EURUSD/US30/US500, sequências de até 4.427 min. Sem
remover, gera cruzamento espúrio (a SMA rápida achata antes da lenta). Corrigido
em `remover_mercado_fechado()` (`scripts/cross_asset.py`). **Resultado não mudou
materialmente** com a correção — o achado não é artefato.

## Conclusão

**Linha "cruzamento de SMA + pullback" formalmente encerrada**, com base
estrutural, não por esgotamento de tentativa. Consistente com as seções
11.5→11.15 do `AI_BRAIN_SPEC.md` e com a decisão de 2026-07-26 (Trilho 2
pausado, foco no pilar (a) execução/gestão de risco).

## Onde continuar

O que **não** vale mais a pena: otimizar parâmetros desta família de sinal
(médias, stop, alvo, timeframe, número de toques, regra de saída). As duas
alavancas — baixar custo e aumentar edge — estão ambas fechadas, e agora
sabemos por quê.

O que **é** construível e tem valor, sem depender de edge de sinal (pilar (a)):

1. **Ligar o gate de viabilidade ao produto.** `breakEvenWinRate` em
   `CostModel.ts` já existe e não é chamado por nenhum caminho de produto.
   Recusar entradas de expectativa negativa por construção elimina a maior
   fonte de perda do varejo.
2. **Kelly fracionário com teto** (spec já define ≤0,25 do Kelly pleno) —
   protege contra o cenário onde errar 4pp em `p` inverte o sinal da aposta.
3. **Disciplina de execução mensurável**: limite de perda diária, cooldown,
   corte de sessão.

Se for retomar busca de edge, só faz sentido com **dado estruturalmente
diferente** (order book, fluxo) — o Trilho 2 da seção 13, formalmente pausado
em 2026-07-27 por falta de fonte grátis viável.

## Reprodução

`scripts/` tem os 15 arquivos Python (motores em numba, walk-forward, DSR).
`results/` tem os 5 CSVs com todas as configurações testadas.
Datasets M1 não versionados (1,4 GB) — `scripts/baixar_dukascopy.py` e
`scripts/load_data.py` reconstroem tudo a partir das fontes públicas.
