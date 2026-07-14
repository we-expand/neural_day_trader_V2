FROM node:20-alpine AS build
WORKDIR /app

# Precisa do repo inteiro no contexto de build porque este serviço importa
# diretamente o catálogo real de ativos do frontend (assetDatabase.ts,
# brokerRegistry.ts) — única fonte de verdade, ver plano em
# streaming-relay/README.md sobre por que não duplicamos essas listas.
COPY streaming-relay/package.json streaming-relay/package-lock.json* ./streaming-relay/
WORKDIR /app/streaming-relay
RUN npm install

WORKDIR /app
COPY streaming-relay ./streaming-relay
COPY src/app/config/assetDatabase.ts src/app/config/assetDatabase.ts
COPY src/app/config/brokerRegistry.ts src/app/config/brokerRegistry.ts

WORKDIR /app/streaming-relay
RUN npm run build

FROM node:20-alpine
WORKDIR /app/streaming-relay
COPY --from=build /app/streaming-relay/dist ./dist
COPY --from=build /app/streaming-relay/node_modules ./node_modules
COPY streaming-relay/package.json ./

CMD ["node", "dist/streaming-relay/src/index.js"]
