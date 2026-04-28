#!/bin/bash

# 🔥 SCRIPT DE LIMPEZA PROFUNDA DE CACHE
# Remove todo cache do Vite, npm e builds anteriores

echo "🧹 Iniciando limpeza profunda de cache..."
echo ""

# 1. Parar processos Node existentes (opcional)
echo "🛑 Verificando processos Node..."
# pkill -f "vite" 2>/dev/null || true

# 2. Remover cache do Vite
echo "🗑️  Removendo cache do Vite..."
rm -rf node_modules/.vite
rm -rf .vite
echo "✅ Cache do Vite removido"
echo ""

# 3. Remover builds anteriores
echo "🗑️  Removendo builds anteriores..."
rm -rf dist
rm -rf build
rm -rf .next
echo "✅ Builds removidos"
echo ""

# 4. Remover cache do TypeScript
echo "🗑️  Removendo cache do TypeScript..."
rm -rf .tsbuildinfo
rm -rf tsconfig.tsbuildinfo
echo "✅ Cache do TypeScript removido"
echo ""

# 5. Limpar cache do npm
echo "🗑️  Limpando cache do npm..."
npm cache clean --force
echo "✅ Cache do npm limpo"
echo ""

# 6. Opcional: Reinstalar node_modules (descomente se necessário)
# echo "📦 Reinstalando dependências..."
# rm -rf node_modules
# npm install
# echo "✅ Dependências reinstaladas"
# echo ""

echo "✅ LIMPEZA CONCLUÍDA!"
echo ""
echo "📝 Próximos passos:"
echo "   1. Limpe o cache do navegador (Cmd+Shift+Delete ou Ctrl+Shift+Delete)"
echo "   2. Execute: npm run dev"
echo "   3. Acesse localhost:5173 em uma nova aba"
echo ""
