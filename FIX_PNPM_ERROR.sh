#!/bin/bash
# Fix para erro ERR_INVALID_THIS do pnpm na Vercel

PROJETO="/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2"

cd "$PROJETO" || exit 1

echo "🔧 Corrigindo erro ERR_INVALID_THIS do pnpm"
echo "=========================================="
echo ""

# Solução 1: Downgrade para pnpm 8.15.0 (versão mais estável)
echo "1️⃣ Mudando para pnpm 8.15.0 (versão estável)..."

# Atualizar package.json
sed -i '' 's/"packageManager": "pnpm@9.15.4"/"packageManager": "pnpm@8.15.0"/' package.json

echo "✅ packageManager atualizado para pnpm@8.15.0"
echo ""

# Solução 2: Criar .npmrc com configurações para CI
echo "2️⃣ Criando .npmrc com configurações para Vercel..."

cat > .npmrc << 'EOF'
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=true
node-linker=hoisted
EOF

echo "✅ .npmrc criado"
echo ""

# Verificar mudanças
echo "📋 Arquivos modificados:"
git status --short

echo ""
echo "=========================================="
echo "📝 PRÓXIMOS PASSOS"
echo "=========================================="
echo ""
echo "1. Commit e push:"
echo "   git add package.json .npmrc"
echo "   git commit -m 'fix: usa pnpm 8.15.0 e configura .npmrc para Vercel'"
echo "   git push origin main"
echo ""
echo "2. Deploy:"
echo "   vercel --prod"
echo ""
