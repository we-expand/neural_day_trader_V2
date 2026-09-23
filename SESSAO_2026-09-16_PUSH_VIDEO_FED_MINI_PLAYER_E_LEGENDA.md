# Sessão 2026-09-16 — Push do vídeo do Fed no Dashboard (mini player) + legenda traduzida ao vivo

> Handoff completo desta sessão, ao vivo, durante a própria "Super Quarta"
> (coletiva de imprensa do FOMC, 2026-09-16, 15h30 Brasília / 18h30 UTC).
> Todo o trabalho abaixo foi feito, testado e corrigido **enquanto o
> discurso acontecia de verdade**, com achados reais confirmados contra a
> API oficial do Fed e do StreamText.

## Contexto / pedido original

Cleber já tinha uma feature de sessão anterior (documentada no topo do
`CLAUDE.md`) que abria automaticamente uma janela em tela cheia com o
vídeo do Fed 30min antes da coletiva, com legenda traduzida. O pedido
desta sessão evoluiu em várias rodadas até chegar no formato final:

1. Não é pra ter **nenhum botão manual** — o vídeo tem que aparecer
   sozinho.
2. O vídeo fica **dockado dentro do próprio "push"** (card no canto do
   Dashboard), não abre direto em tela cheia — "se eu quiser maximizar,
   eu maximizo, se não posso ficar só ouvindo".
3. O vídeo precisa **realmente tocar** ali (com áudio), não só ser um
   link/botão que abre outra tela.
4. O discurso tem que aparecer **na íntegra** (desde o início, não só a
   partir do momento em que a janela abre) e **legendado em português**.

## Achados reais e bugs corrigidos, em ordem cronológica

### 1. Botão "Assistir ao vivo" não aparecia
Causa: o nome real do evento no calendário econômico é **"CONFERÊNCIA DE
IMPRENSA"**, mas o filtro de palavra-chave só cobria `fed|fomc|powell|juros`.
Corrigido a regex. Commit `04c4aafe3` → fix `65fd039c5`.

### 2. Legenda nunca traduzia nada
A Edge Function `fomc-captions` **nunca tinha sido deployada** no Supabase
— existia só no código, commitada, mas Edge Function não sobe com
`git push` (precisa de deploy separado). Deployada manualmente
(`supabase functions deploy fomc-captions`, `verify_jwt: false`).

### 3. Parser da legenda usava formato errado
A 1ª versão do parser (escrita numa sessão anterior, nunca testada contra
transmissão real) chutava um formato genérico de CART (`Data`/`Position`).
O formato REAL do `text-data.ashx` do StreamText, confirmado ao vivo
durante o próprio discurso de hoje:
```json
{"lastPosition": 656, "i": [{"format":"basic","d":"<fragmento URL-encoded>"}]}
```
Corrigido o parser pra decodificar `i[].d` (URL-encoded) e aplicar
backspace real (`\b`, 0x08 — o estenógrafo humano corrige erro de
digitação ao vivo assim). Cursor de paginação é `lastPosition`, não um
campo genérico. Commit `efa35ebed`.

### 4. "Na íntegra" — cursor inicial -1 vira 0
A pedido do Cleber, a 1ª chamada da sessão (`cursor=-1`) passou a buscar
a transcrição completa desde o início do discurso, não só o que for dito
dali pra frente.

### 5. Legenda virou uma parede de texto cobrindo o vídeo inteiro
Efeito colateral do fix acima: como a 1ª chamada trazia o discurso inteiro
de uma vez, o frontend empurrava tudo como **uma linha só** — virava um
bloco de texto gigante. Corrigido quebrando por frase (regex de
pontuação), cada frase vira sua própria linha na janela de últimas 6.
Commit `517b4454c`.

### 6. Reabrir a janela reiniciava do zero, piorando o problema acima
Fechar e reabrir resetava o cursor pra `-1` de novo — com vários minutos
de discurso já passados, isso virava um bloco cada vez maior, a tradução
via LLM (max_tokens baixo) falhava, e caía no texto bruto em inglês sem
quebrar em frases, cobrindo o vídeo de novo. Corrigido com 3 camadas de
proteção:
- Cursor persiste em `sessionStorage` por dia (só a 1ª abertura do dia
  busca tudo desde o início).
- Qualquer frase/texto original que passe de 280 caracteres é truncado
  antes de exibir (rede de segurança).
- Caixa de legenda ganhou altura máxima (35vh) com scroll interno —
  nunca mais cobre o vídeo, não importa o tamanho do texto.

Também subido `max_tokens` da tradução de 400→2000 (o 1º backfill grande
cortava a tradução no meio). Commits `31161634c` + ajuste no
`fomc-captions/index.ts`.

### 7. Redesenho pro "push" — mini player dockado
A pedido repetido do Cleber, trocado o comportamento de "abre direto em
tela cheia" pra um **mini player dockado** no canto do Dashboard (vídeo +
última linha de legenda + botão de maximizar), com a tela cheia só
aparecendo quando o usuário clica em maximizar. Extraído
`useFomcLiveCaptions.ts` (hook compartilhado) da lógica que já existia em
`NeuralEventCenter.tsx`, reaproveitado pelo novo `FedMiniPlayer.tsx` — os
dois nunca ficam montados ao mesmo tempo (estado `'closed'|'mini'|'full'`
em `App.tsx`), então nunca toca 2 áudios juntos nem dobra custo de
tradução. Commit `cc88198a5`.

### 8. Remoção de todo botão manual
Correção direta do Cleber: "não é para existir o botão... na mecânica não
existe botão". Removido "Fed ao vivo" do Header e "Assistir ao vivo" do
card de aviso — a única forma de o vídeo aparecer é o mini player abrindo
sozinho pelo timer de 30min antes do evento. Commit `4fde981ce`.

**Trade-off registrado**: sem nenhum botão manual, se o usuário fechar o
mini player sem querer, não existe mais nenhuma forma de reabri-lo pra
esse mesmo evento no mesmo dia (antes o botão do Header servia de
"resgate"). Decisão consciente do Cleber, documentada aqui pra não ser
esquecida.

### 9. Vídeo só "linkava" pra maximizar, não tocava
Achado do Cleber: clicar no vídeo do mini player abria a tela cheia em vez
de reproduzir ali mesmo. Causa dupla: (1) iframe com `pointer-events-none`,
cliques nunca chegavam ao player de verdade; (2) a área inteira do vídeo
era um `<button>` só de maximizar, escondendo o próprio player por trás.
Corrigido: iframe recebe clique normal (play/pause/volume funcionam ali
mesmo), maximizar virou um ícone pequeno só no canto do vídeo. Também
adicionado `autoplay=true` na URL do embed do Brightcove (mini e tela
cheia) — sem isso o player ficava parado na miniatura esperando clique
manual. Commit `453346a22`.

**Confirmado ao vivo, funcionando**: o vídeo carregou de verdade com
`autoplay=true` (parou de ficar preso na miniatura estática) — confirmado
quando o player mostrou "This event has now ended" (mensagem real do
próprio Fed, carregada dinamicamente), não mais só o poster estático.

## Pendência real, NÃO resolvida

Ao testar o botão "Minimizar" da tela cheia (deveria voltar pro mini
player, não fechar tudo), o clique fechou a janela inteira em vez de
minimizar. Pode ser:
- Imprecisão de coordenada do teste (ícones Minimizar/Fechar muito
  próximos no header, `gap-1`), ou
- Bug real na lógica/z-index dos dois botões.

Como a coletiva **já tinha acabado** no momento desse teste (player
mostrando "This event has now ended"), não deu tempo de isolar a causa
com certeza. **Próxima sessão: testar o fluxo completo mini→tela
cheia→minimizar de novo, sem pressa, fora de um evento ao vivo**, e
corrigir se for bug real (ex: aumentar o espaçamento entre os ícones, ou
checar se algum handler está duplicado).

## Achado de processo, à parte

Durante esta sessão, apareceu um commit que eu (Claude) não fiz:
[`e4eb221f7`](https://github.com/we-expand/neural_day_trader_V2/commit/e4eb221f7)
`feat(fomc): jogada especial BTCUSD pós-Fed (1500pts, 10% patrimônio,
DEMO)` — mesmo risco já catalogado no projeto (sessão paralela rodando na
mesma pasta). Perguntado ao Cleber se era ele mesmo rodando outra sessão;
resposta não confirmada até o fim desta sessão.

## Commits desta sessão (todos já em `origin/dev`)

| Commit | Descrição |
|---|---|
| `343102ef2` | (sessão anterior) aviso de evento de alto impacto vira pop-up flutuante |
| `04c4aafe3` | Botão "Assistir ao vivo" no push (depois removido) |
| `65fd039c5` | Fix: nome real do evento é "Conferência de Imprensa" |
| `efa35ebed` | Parser real do StreamText (formato `lastPosition`/`i[].d`) |
| `517b4454c` | Legenda quebrada em frases (parava de virar parede de texto) |
| `31161634c` | Cursor persiste em sessionStorage + altura máxima da caixa de legenda |
| `cc88198a5` | Mini player dockado no push (extração do hook `useFomcLiveCaptions`) |
| `4fde981ce` | Remove todo botão manual — vídeo só aparece sozinho |
| `453346a22` | Vídeo interativo de verdade + `autoplay=true` |

## Arquivos novos/tocados

- `src/app/hooks/useFomcLiveCaptions.ts` (novo — hook compartilhado)
- `src/app/components/dashboard/FedMiniPlayer.tsx` (novo — mini player dockado)
- `src/app/components/dashboard/NeuralEventCenter.tsx` (tela cheia, refatorado pra usar o hook + botão minimizar)
- `src/app/components/dashboard/HighImpactEventBanner.tsx` (voltou a ser só texto, sem botão)
- `src/app/components/layout/Header.tsx` (botão "Fed ao vivo" removido)
- `src/app/App.tsx` (estado `fedVideoMode: 'closed'|'mini'|'full'`)
- `supabase/functions/fomc-captions/index.ts` (parser real, deployado v2)

## `npx tsc --noEmit`

633 erros antes e depois de cada mudança desta sessão (mesmo ruído
pré-existente do projeto) — nenhum erro novo introduzido em nenhum dos
commits acima.
