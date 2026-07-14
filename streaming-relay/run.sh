#!/bin/bash
# Wrapper usado pelo launchd (com.neuralday.streaming-relay.plist) — carrega
# as credenciais de .env (nunca commitado, ver .gitignore) e roda o serviço
# já compilado. Rodar `npm run build` antes se dist/ estiver desatualizado.
set -a
cd "$(dirname "$0")"
source .env
set +a
exec /opt/homebrew/bin/node dist/streaming-relay/src/index.js
