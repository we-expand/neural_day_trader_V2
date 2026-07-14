# Streaming Relay — MetaAPI → Supabase Realtime

Serviço Node.js sempre-ligado, hospedado no Fly.io. Mantém uma conexão de streaming (WebSocket) com a conta MetaAPI de plataforma e repassa cada tick de preço pro canal `turbo-main-channel` do Supabase Realtime (evento `price-update`), no mesmo formato que `src/app/hooks/useSupabaseRealtimeTurbo.ts` já sabe consumir.

Existe pra substituir o polling HTTP (`/mt5-prices` a cada 2s + lotes de 40 símbolos) que causava atualização lenta (até 20s+) em alguns ativos quando a fila de lotes ficava grande.

## Por que importa diretamente `assetDatabase.ts`/`brokerRegistry.ts` do frontend
Única fonte de verdade de "quais ativos existem e como se chamam na corretora" já vive lá (auditada contra a API real). Duplicar essa lista aqui reintroduziria exatamente o problema que motivou a reescrita de 2026-07-08 (múltiplos catálogos divergentes). O `Dockerfile` copia esses dois arquivos pro contexto de build.

## Deploy (rodar você mesmo, nunca eu sozinho)

```bash
cd streaming-relay
fly launch --no-deploy   # na primeira vez, cria o app no Fly.io (usa o fly.toml já commitado)
fly secrets set \
  METAAPI_TOKEN="<mesmo token já usado no Supabase>" \
  METAAPI_ACCOUNT_ID="<mesmo account id já usado no Supabase>" \
  SUPABASE_URL="https://wyvdsxtcmizettljxtbg.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service_role key do projeto Supabase>"
fly deploy
```

## Verificar que está funcionando

```bash
fly logs
```

Deve mostrar `[streaming-relay] 🚀 Streaming ativo pra N símbolos.` e nenhum erro fatal. Pra confirmar que o preço está chegando no navegador, abrir o Dashboard e checar no console se `useSupabaseRealtimeTurbo` está recebendo eventos `price-update` (uma vez que o frontend for migrado pra consumir esse canal — ver plano da sessão).
