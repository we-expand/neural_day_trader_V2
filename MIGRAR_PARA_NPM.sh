#!/bin/bash
# Migrar de pnpm para npm para resolver ERR_INVALID_THIS

PROJETO="/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2"

cd "$PROJETO" || exit 1

echo "🔄 Migrando de pnpm para npm"
echo "========================================"
echo ""

# 1. Remover packageManager
echo "1️⃣ Removendo packageManager do package.json..."
sed -i '' '/"packageManager":/d' package.json
echo "✅ Removido"
echo ""

# 2. Deletar arquivos pnpm
echo "2️⃣ Removendo arquivos pnpm..."
rm -f pnpm-lock.yaml
rm -rf .pnpm-store
rm -f .npmrc
echo "✅ Arquivos pnpm removidos"
echo ""

# 3. Instalar com npm
echo "3️⃣ Instalando dependências com npm..."
npm install
echo "✅ Dependências instaladas"
echo ""

# 4. Verificar vercel.json
echo "4️⃣ Atualizando vercel.json..."
if [ -f "vercel.json" ]; then
    # Remover buildCommand e installCommand se existirem
    cat > vercel.json << 'EOF'
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3.0.0",
      "maxDuration": 30
    }
  }
}
EOF
    echo "✅ vercel.json atualizado para npm"
fi

echo ""
echo "📋 Status Git:"
git status --short

echo ""
echo "========================================"
echo "📝 PRÓXIMOS PASSOS"
echo "========================================"
echo ""
echo "Execute:"
echo ""
echo "  git add ."
echo "  git commit -m 'fix: migra de pnpm para npm para resolver ERR_INVALID_THIS'"
echo "  git push origin main"
echo "  vercel --prod"
echo ""
