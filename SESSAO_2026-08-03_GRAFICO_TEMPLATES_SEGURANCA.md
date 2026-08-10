# Sessão 2026-08-03 — Gráfico, Templates, P&L, Segurança Admin

> Continuação da mesma data de `SESSAO_2026-08-03_PNL_E_CONTRACT_SPECS.md` (sessão
> anterior, já superada/fechada). Handoff completo desta sessão — muitos itens
> pequenos de UX no gráfico + um achado de segurança crítico não relacionado ao
> pedido original. `npm run validate` passou em 100% das mudanças que tocaram
> TypeScript; **nada foi verificado visualmente no navegador** (Browser pane sem
> acesso à aplicação logada durante toda a sessão — só à landing page pública).

## O que está commitado vs. pendente

Nada foi commitado por mim (regra do projeto: sempre entregar pronto + comando de
commit pro Cleber rodar). Está tudo staged/pronto localmente, várias rodadas de
`git add` + `git commit` foram sugeridas ao longo da sessão mas cabe ao Cleber
confirmar se já rodou todas. Não assumir commitado sem checar `git log`.

## 1. Gráfico "voltando pra posição inicial" sozinho

**Causa**: `chart.applyNewData(candles)` reseta o offset/viewport internamente da
klinecharts (`ChartStore.clear()` + `resetOffsetRightDistance()`) toda vez que
roda — e o polling de preço chamava isso a cada 30s (`ChartView.tsx`) / 5s
(`StandaloneChartPage.tsx`), não só na primeira carga.

**Fix**: salva `chart.getOffsetRightDistance()` antes de cada `applyNewData`
(fora da primeira carga) e restaura depois com `chart.setOffsetRightDistance()`.
Arquivos: `src/app/components/ChartView.tsx`, `src/app/components/StandaloneChartPage.tsx`.

## 2. Estocástico Lento com sobrecompra/sobrevenda errados (10/70 em vez de 20/80)

Não havia threshold hardcoded nenhum — o painel do indicador `STOCH_SLOW`
(`ChartView.tsx`) nunca tinha linhas de referência fixas, então auto-escalava pro
range real dos dados, parecendo "10 a 70" dependendo do candle. Fix: `minValue: 0`
/ `maxValue: 100` fixos no registro do indicador + duas linhas de referência
tracejadas constantes em 80/20.

## 3. Setup favorito do gráfico (indicadores, grade, S/R aplicados automaticamente)

Novo: `useFavoriteChartSetup.ts` (hook) + tabela Supabase `chart_favorite_setup`
(migration `011_chart_favorite_setup.sql`, **precisa rodar no SQL Editor**, não
apliquei). Menu de botão direito → "Salvar configuração atual como favorita".
Aplicado automaticamente no próximo carregamento do gráfico (uma vez por
montagem, via `favoriteSetupAppliedRef`).

## 4. Templates nomeados (salvar/carregar/remover múltiplos, com zoom/posição)

Novo: `useChartTemplates.ts` (hook, CRUD completo) + tabela Supabase
`chart_templates` (migration `012_chart_templates.sql`, **precisa rodar no SQL
Editor**). Menu "Templates" no botão direito do gráfico — salva nome + todos os
indicadores/parâmetros/grade/S/R/timeframe **e zoom+scroll** (`barSpace`/
`offsetRightDistance`, capturados via `chart.getBarSpace()`/
`getOffsetRightDistance()`).

**Bug corrigido na mesma feature**: o botão de toggle "Templates" não chamava
`e.stopPropagation()`, então o clique nele contava como "clique fora do menu" pro
listener global que fecha o menu de contexto — o menu inteiro sumia ao clicar em
Templates. Corrigido.

**Bug de layout corrigido**: ao carregar um Template, `barSpace`/
`offsetRightDistance` eram restaurados em pixels crus de outra sessão, sem
considerar que a largura da janela ou quantidade de candles pode ser diferente
agora — deixava o gráfico inteiro (candles + painéis de indicador, que
compartilham o mesmo eixo horizontal) espremido no meio da tela com margem em
branco enorme dos dois lados. Corrigido travando os dois valores pra sempre
preencherem a largura atual do container (`applyChartTemplateConfig`).

## 5. Múltiplas médias móveis (várias linhas/períodos por indicador)

A klinecharts recusa (`Duplicate indicators`) uma 2ª instância do mesmo
indicador (`name`) no mesmo painel — não dava pra simplesmente criar "MA" duas
vezes. Fix real: `registerMovingAverageIndicator` (MA/EMA/SMA/WMA) agora aceita
`calcParams` como LISTA de períodos (uma linha por item, via `regenerateFigures`
— mesmo mecanismo nativo que MACD/BOLL usam). Editor de MA (engrenagem no
indicador ativo) ganhou "+ Adicionar linha", com cor/estilo/espessura por linha
e remoção individual (mínimo 1 linha).

**Bug de descoberta corrigido na mesma sessão**: o botão de engrenagem
(editar/adicionar linha) só existia no menu de botão direito — o modal principal
"Indicadores" (o que a maioria usa) não tinha esse botão, só ligar/desligar.
Adicionado nos dois lugares.

## 6. Menu de botão direito sumindo no rodapé da tela

Menu sempre abria pra baixo a partir do clique, sem checar se cabia na tela — se
o clique fosse na metade de baixo, o menu "nascia" cortado. Fix: se o clique for
na metade de baixo da tela, o menu abre pra CIMA a partir do ponto clicado;
combinado com `overflow-y-auto` + `maxHeight` calculado, nunca mais fica
invisível (pior caso: rola dentro dele mesmo).

## 7. Ferramenta de Ímã (magnet) nunca tinha sido implementada

Só mostrava um toast "em desenvolvimento" e retornava — não ligava nada de
verdade (`DrawingToolbar.tsx`). Implementado de verdade usando o suporte nativo
da klinecharts (`OverlayMode.WeakMagnet`, importado de `klinecharts`), aplicado
via `mode:` na criação de todo overlay de desenho do usuário
(`chart.createOverlay` em `ChartView.tsx`). Só afeta desenhos criados DEPOIS de
ligar o ímã — não re-encaixa desenhos já existentes.

## 8. Boleta (OrderTicket) — quantidade de lotes não editável livremente

Campo era um `<span>` só de leitura, só as setinhas +/- mudavam o valor. Virou
`<input type="text">` editável (`volumeInputText` state, parse tolerante a
vírgula), mantendo as setinhas funcionando. `OrderTicket.tsx`.

## 9. Templates: botão de deletar "sumia"

Já existia desde a implementação (item 4), mas só aparecia com `opacity-0
group-hover:opacity-100` — praticamente invisível. Deixado sempre visível.

## 10. P&L de posição "duro" (atualiza aos trancos)

**Não era problema de dado** — o loop de P&L (`useApexLogic.ts`, "UNREALIZED PNL
LOOP") já roda a cada 1s de verdade (comentários no código diziam 5s, estavam
desatualizados). O problema era 100% de apresentação: o número saltava direto de
um valor pro outro, sem nenhuma interpolação. Novo hook genérico
`src/app/hooks/useAnimatedNumber.ts` (RAF + easing quadrático, mesmo padrão já
usado só pro preço do header em `ChartView.tsx`), aplicado ao P&L em
`OrderTicket.tsx` (compacto e expandido) e `MarketScoreBoard.tsx` (total e por
posição). **Não** aplicado ao overlay de P&L desenhado dentro do candle no
`ChartView.tsx` (é texto de canvas do klinecharts, mudança mais arriscada,
deixada de fora deliberadamente).

## 11. Auditoria de cálculo de P&L (BTCUSD, 0.1 lote)

Cleber reportou "ganho de $5 com 0.1 contrato parece errado". Auditoria completa
da cadeia (`useApexLogic.ts` → `assetDatabase.ts`/`infinoxContractSpecs.ts` →
`contractSpecs.ts::calculatePnLWithLeverage`/`calculateRealisticPnL`) + query
direta no Supabase (`ai_trades`) pra pegar o trade real do Cleber (BTCUSD SHORT,
entrada $63.610,90). **Conclusão: matemática correta, não é bug.** 1 lote de
BTCUSD = 1 BTC (`lotSize: 1`); 0,1 lote = 0,1 BTC de exposição real (~$6.360 em
dólares ao preço do BTC). P&L = `0,1 × Δpreço`, bate exato com o valor exibido
($4,16 pro movimento real de $41,62 no momento consultado). Confirmado de novo
com um segundo exemplo manual do Cleber (0,1 lote, $60.000→$60.100 = $10,00) —
mesma fórmula, mesmo resultado. **Nenhuma mudança de código foi feita** no motor
de P&L — só confirmação.

## 12. Boleta some após maximizar/restaurar o gráfico (tela cheia)

Fullscreen real do navegador (Fullscreen API, `chartRootRef.requestFullscreen`).
Hipótese mais provável (não confirmada com DevTools ao vivo, só leitura de
código): corrida entre a transição nativa de saída do fullscreen e o
`ResizeObserver`/`chart.resize()` da klinecharts — o container podia ser medido
com a largura antiga por alguns frames, e como o `<main>` em `App.tsx` tem
`overflow-auto`, isso virava scroll horizontal escondendo a boleta (`right-
[99px]`, ancorada no mesmo container) e a régua de preço fora da área visível,
em vez de cortar. Fix: força `chart.resize()` + `window.dispatchEvent(new
Event('resize'))` explicitamente depois de 2 `requestAnimationFrame` encadeados
no listener `fullscreenchange` (garante que roda depois do layout final
assentar), nos dois sentidos (entrar/sair) e no fallback CSS (quando o navegador
recusa fullscreen nativo). **Não verificado visualmente** — reproduzir
maximizando/restaurando de verdade antes de confiar 100%.

## 13. 🚨 Achado crítico de segurança (fora do escopo pedido, mas urgente)

Investigando o módulo Admin "Inteligência de Usuários" pra outro pedido do
Cleber (usuário de teste + tornar o módulo real), encontrei duas vulnerabilidades
reais e ativas em produção:

1. **`GET /list-users`, `GET /user-data`, `GET /user-data/:id`, `DELETE
   /user-data/:id`, `GET /user-data/export/csv`** (`supabase/functions/server/
   index.ts`) só exigiam a chave pública (anon key, embutida no bundle JS,
   visível a qualquer um) — **zero verificação de identidade ou de admin no
   backend**. Qualquer pessoa não-logada conseguia: listar email+metadata de
   todos os usuários; ler e **exportar em CSV** todos os dados de onboarding
   (nome completo, CPF/documento, telefone, endereço, renda); deletar o
   registro LGPD de qualquer usuário. O "gate de admin" existia só na UI
   (`adminConfig.ts::checkAdminPermissions`), nunca no backend.
2. **`POST /delete-user`** aceitava só um `email` no corpo, sem prova de posse
   da conta — account-takeover trivial (bastava saber o email de alguém pra
   apagar a conta dela permanentemente, mesmo já ativa).

**Fix aplicado e já deployado** (Cleber rodou `supabase functions deploy server
--project-ref wyvdsxtcmizettljxtbg` durante a sessão): adicionado `requireAdmin(c)`
(`index.ts`, novo helper) exigindo JWT de usuário real cujo email esteja em
`ADMIN_EMAILS` (lista hardcoded server-side, duplicada de `adminConfig.ts` porque
a Edge Function roda em runtime Deno isolado do bundle do client) nas 5 rotas
acima. `/delete-user` agora só aceita apagar contas com `email_confirmed_at`
nulo (nunca uma conta ativa/confirmada).

**Dívida técnica registrada, não resolvida nesta sessão**: `public.users` (tabela
que teria `is_admin BOOLEAN` pra RLS real) existe no schema desde a migration
`001_initial_schema.sql` mas **nunca é populada** — não há trigger
`on_auth_user_created`. As policies de RLS que dependem de
`public.users.is_admin` (`system_logs`, `api_metrics`) estão efetivamente
inertes hoje. O fix desta sessão (`ADMIN_EMAILS` hardcoded na Edge Function) é
suficiente e já fecha o buraco, mas não substitui ter um `is_admin` real
via banco — fica como próximo passo se quiser um controle de admin mais robusto
(múltiplos admins sem redeploy, por exemplo).

## 14. Módulo "Inteligência de Usuários" — dado fabricado removido

`UserIntelligence.tsx` estava ativo no menu Admin (não "desativado" como o
`CLAUDE.md` sugeria) misturando dado real (`/list-users`, Supabase Auth) com
dado 100% fabricado no dossiê de cada usuário: carteira Binance/Ethereum
("Ativo • $12.450,00"), depósitos/saques hardcoded, "Perfil Psicométrico" com
barras fixas, log de login com IP inventado, telefone "+55 11 *****-8829",
avatar de terceiro (pravatar.cc), "Reputação A+", "Status do Sistema: Seguro" —
tudo estático no JSX, nenhuma fonte de dado real. Reescrito pra mostrar só o que
existe de verdade: email, criado em, último login, email confirmado — com
estado vazio HONESTO explicando que IP/geolocalização/dispositivo/presença
online em tempo real não estão instrumentados hoje (existe um componente pronto,
`UserTracker.tsx`, e uma rota, `/telemetry/track`, mas nenhum dos dois está
ligado em produção — ligar isso é decisão de produto separada por causa de
LGPD, não algo pra decidir/ativar sozinho).

Chamada do client trocada de `publicAnonKey` pro JWT de sessão real
(`supabase.auth.getSession()`), consistente com o `requireAdmin` novo no
backend.

## 15. Usuário de teste Demo criado

Email `demo.teste@neuraldaytrader.com` / senha `Demo-Trader-2026!Kx9`, criado
via SQL direto (`auth.users` + `auth.identities`, `crypt()`/`pgcrypto`) — Cleber
rodou o SQL fornecido, confirmado funcionando (retornou `user_id`/`provider_id`
batendo).

## 16. Proteção SSO da Vercel desligada no projeto

O link estável do branch `dev`
(`https://neural-day-trader-v2-git-dev-cleber-coutos-projects.vercel.app`)
estava atrás da proteção de deploy nativa da Vercel (SSO), bloqueando ANTES de
chegar na tela de login do próprio app — usuário de teste externo não
conseguiria nem ver a landing page. A pedido do Cleber, desliguei via
`vercel project protection disable neural-day-trader-v2 --sso`. Confirmado:
`ssoProtection: false`, landing page abre direto sem pedir login da Vercel.
**Efeito**: qualquer pessoa com o link agora acessa a landing page e a tela de
login sem passar pela Vercel — continua exigindo login real do Supabase por
trás. Reversível a qualquer momento (`vercel project protection enable
neural-day-trader-v2 --sso`).

## Migrations pendentes de rodar (SQL Editor do Supabase, projeto `wyvdsxtcmizettljxtbg`)

- `supabase/migrations/011_chart_favorite_setup.sql`
- `supabase/migrations/012_chart_templates.sql`

(A criação do usuário demo e o fix da Edge Function já foram rodados/deployados
pelo Cleber durante a sessão — não são migrations versionadas, foram SQL/deploy
avulsos.)

## Não verificado visualmente nesta sessão

Nenhuma das mudanças de UI do gráfico (templates, ímã, MA multi-linha, menu de
contexto, boleta, animação de P&L, bug do fullscreen) foi testada ao vivo no
navegador logado — Browser pane só teve acesso à landing page pública
(app protegido por login). Só `npm run validate` + `tsc --noEmit` garantidos.
Recomendo uma passada de teste manual real antes de considerar essa lista
fechada, especialmente o item 12 (fullscreen) que é o mais especulativo
(hipótese de causa raiz, não confirmada com DevTools ao vivo).
