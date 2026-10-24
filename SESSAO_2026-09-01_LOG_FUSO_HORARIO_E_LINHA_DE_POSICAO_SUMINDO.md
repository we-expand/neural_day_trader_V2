# Sessão 2026-09-01 (noite) — Log em fuso errado + linha de posição sumindo do gráfico

## Contexto / gatilho

Cleber reportou dois alarmes em sequência, ambos com tom de urgência ("vou
sofrer auditoria de investidores"):

1. Dashboard mostrava 4 posições abertas reais (UKOUSD/NAS100/SPX500/EURUSD),
   mas o log de operações (`OperationLogs.tsx`) só mostrava 2 no dia.
2. Linha de entrada/stop/alvo não aparecia no gráfico pra posições reais
   abertas (visto ao vivo em UKOUSD, NAS100, SPX500).

## Achado 1 — log "incompleto": não era bug de dado, era fuso

Consultado `ai_trades` direto no Supabase (fonte de verdade): as 4 posições
estavam lá, com preços batendo exatamente com o Dashboard. Nenhum dado
perdido, nenhuma corrupção.

Causa real: `OperationLogs.tsx` agrupava as operações por dia em **UTC**
(`toUtcDateKey`). Brasil é UTC-3, então posições abertas entre 22h e
meia-noite (horário de Brasília) caem no dia UTC seguinte — iam pra um grupo
de data diferente (colapsado, mais abaixo na lista) do resto das operações
da mesma noite, dando a falsa impressão de que sumiram.

**Fix**: `toLocalDateKey`/`formatDateKey`/`formatTime` agora usam
`America/Sao_Paulo` de forma consistente entre si (chave de agrupamento e
rótulo exibido sempre no mesmo fuso — nunca um em UTC e outro em local, que
foi exatamente o bug oposto já documentado em 21/08 no CLAUDE.md).

Arquivo: [`src/app/components/admin/OperationLogs.tsx`](src/app/components/admin/OperationLogs.tsx)
Commit: `94a69e781` (já aplicado pelo Cleber).

## Achado 2 — linha de posição sumindo: bug real, achado e corrigido

Reproduzido ao vivo (local + confirmado pelo próprio Cleber na URL de
trabalho correta, `neural-day-trader-v2-git-dev-...`): posição real aberta
(ex: SPX500 COMPRA @ 7641.11), preço ao vivo correto na boleta, candles reais
carregando — mas nenhuma linha de entrada/SL/TP desenhada no gráfico.

**Descartado no caminho**: URL de deployment com hash (`-riovg28j7-`),
imutável — não era a causa, mas o Cleber estava mesmo testando nela em algum
momento (armadilha já documentada no CLAUDE.md, reforçada aqui).

**Causa raiz real**: o commit anterior desta mesma sessão (`6a5dfd3c9`,
"fix chart: linhas de posição intermitentes + gráfico abrindo no passado")
resolveu a restauração indevida de `anchorTimestamp`/`anchorX` (âncora de
scroll) ao carregar o estado de sessão salvo — mas **não zerou também
`offsetRightDistance`**, que (conforme o próprio comentário do código, em
`applyChartTemplateConfig`) recalcula a posição de scroll internamente
(`_lastBarRightSideDiffBarCount = offset / barSpace`). Uma sessão salva de
um momento em que o usuário tinha rolado pro passado carregava um
`offsetRightDistance` que reintroduzia aquela posição antiga por uma segunda
porta — o fix anterior fechou só a primeira. Com o range de preço visível
ancorado em dias atrás, o nível real da posição (calculado com preço atual)
ficava fora da escala de preço desenhada, e por isso a linha "sumia" mesmo
a posição existindo de verdade no banco o tempo todo.

**Fix**: zerar `offsetRightDistance` também na restauração do estado de
sessão, igual ao setup favorito (linha logo abaixo) já fazia — só a sessão
tinha essa lacuna.

Arquivo: [`src/app/components/ChartView.tsx`](src/app/components/ChartView.tsx:5967)
Commit: pendente — comando dado pro Cleber rodar:
```bash
git add src/app/components/ChartView.tsx && git commit -m "fix(chart): zera offsetRightDistance ao restaurar sessão (reintroduzia scroll no passado e escondia linhas de posição)"
```

**Verificação**: confirmado ao vivo (ambiente local, servidor `npm run dev`)
que depois do fix a linha de entrada (COMPRA 7641.11) e a linha de alvo
(Alvo 7698.42 · +$7.45 · 57.31 pts) da posição real SPX500 voltaram a
aparecer, com números batendo exatamente com `ai_trades`.

## Pendência real (não investigada a fundo, achado colateral)

No mesmo teste local, o eixo de datas do gráfico chegou a mostrar "08-11"
mesmo depois do fix, num momento pontual — pode ser resquício de uma sessão
salva antes do fix (autocorrige no próximo save) ou algo residual separado.
Não confirmado se é bug novo ou artefato do teste. Vale reobservar numa
próxima sessão se o sintoma "gráfico com data errada" voltar a aparecer
mesmo depois deste commit aplicado.

## Achado colateral não corrigido (fora de escopo, baixa prioridade)

Warning de console recorrente durante o carregamento de candles:
```
ReferenceError: binanceData is not defined
    at ChartView.tsx:4424:13
```
Capturado internamente (`catch`), não quebra nada visível — mas é código
morto/debug referenciando uma variável removida. Vale limpar depois.
