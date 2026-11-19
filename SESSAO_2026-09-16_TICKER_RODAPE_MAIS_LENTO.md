# Sessão 2026-09-16 — Ticker do rodapé mais lento

## Pedido do Cleber

"Os ativos que estão passando lá embaixo no rodapé estão passando rápido
demais. Deixe eles muito lento." Seguido de 4 pedidos consecutivos de
"mais lento ainda" / "duas vezes mais lento".

## O que foi feito

Só CSS, sem lógica nova. Animação do ticker do rodapé (`MarketTicker.tsx`,
classe `.animate-ticker-scroll`) definida em
[src/styles/theme.css:453-460](src/styles/theme.css#L453-L460):

```css
@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.animate-ticker-scroll {
  animation: ticker-scroll 40000s linear infinite;
}
```

Progressão da duração de um ciclo completo (maior = mais devagar):

| Quando | Valor | Referência |
|---|---|---|
| Antes desta sessão | 700s | fix de 2026-09-07 (era 160s originalmente) |
| 1º pedido | 2000s | ~33min por volta |
| 2º pedido | 6000s | ~1h40 por volta |
| 3º pedido | 20000s | ~5h30 por volta |
| 4º pedido ("2x mais lento") | **40000s** | **~11h por volta — valor final desta sessão** |

Commits (já rodados pelo Cleber, `origin/dev`): `7b4760de5`
(700s→20000s), `b57dc1f7f` (20000s→40000s).

## 2 achados de processo, NENHUM bug de código — ambos já catalogados
## antes neste projeto, se repetiram aqui

**1) Primeiros 3 pedidos "mais lento" antes de qualquer commit.** O
Cleber achava "ainda rápido" a cada aumento porque estava olhando o
**site publicado**, não o `npm run dev` local — e regra fixa do projeto é
Claude nunca fazer `git commit`/`push` sozinho, então nenhuma mudança
tinha chegado lá ainda. Confirmado perguntando direto (`AskUserQuestion`).
Resolvido explicando e entregando o comando de commit pronto.

**2) Depois do commit+push, Cleber reportou "ainda passando rápido" —
mesmo em aba anônima.** Isso descartava cache na hora, então o CSS
publicado precisava estar realmente errado ou ele estava vendo outra
coisa. Verificação ao vivo direto na URL do alias `dev`
(`neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`, via
browser embutido) confirmou o CSS correto servido de verdade:
`getComputedStyle` retornou `animationDuration: "40000s"`, e medindo o
deslocamento real do elemento (`getBoundingClientRect` antes/depois de
2s) deu **0,75px em 2s (~0,37px/s)** — praticamente parado, batendo
exatamente com a conta esperada (largura total ~29.850px, translateX
-50%, /40000s). Ruled out também: só existe 1 elemento
`.animate-ticker-scroll` no DOM (sem duplicata/override), e um segundo
componente parecido no repo (`TickerFooter.tsx`, dado mockado, animação
Framer Motion própria de 60s) está morto — nunca importado em lugar
nenhum, não é ele quem renderiza.

**Causa raiz real**: pedida a URL exata do Cleber — ele estava numa
**URL de deployment com hash**
(`neural-day-trader-v2-6r6l15y5t-cleber-coutos-projects.vercel.app`), não
no alias `dev`. Mesmo padrão já documentado no `CLAUDE.md` deste projeto
("Nunca testar em URL de deployment com hash... imutáveis, ficam
congeladas no código daquele build e nunca atualizam") — provavelmente
salva/favoritada de antes. Sem bug nenhum: aquele deployment específico
é uma foto congelada de um commit anterior ao fix, por isso nenhum hard
refresh (nem aba anônima) jamais mudaria o que aparece lá. Resolvido
passando a URL certa do alias `dev`.

## Pendente

Nenhum. Fix publicado, confirmado ao vivo na URL certa (0,37px/s de
movimento real), Cleber já trocou pra `.../git-dev-.../`.
