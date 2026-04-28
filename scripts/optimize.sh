#!/bin/bash

# ⚡ SCRIPT DE OTIMIZAÇÃO AUTOMÁTICA
# Aplica otimizações para reduzir tempo de build

echo "🚀 Iniciando otimização do projeto..."
echo ""

# 1. Backup do vite.config atual
echo "📦 1/5 - Fazendo backup do vite.config..."
if [ -f "vite.config.ts" ]; then
  cp vite.config.ts vite.config.backup.ts
  echo "✅ Backup criado: vite.config.backup.ts"
fi

# 2. Ativar config otimizado
echo "⚡ 2/5 - Ativando configuração otimizada..."
if [ -f "vite.config.optimization.ts" ]; then
  cp vite.config.optimization.ts vite.config.ts
  echo "✅ Config otimizado ativado!"
fi

# 3. Remover arquivos de backup desnecessários
echo "🗑️  3/5 - Removendo arquivos de backup..."
find ./src -name "*_BACKUP_*.tsx" -type f -delete
find ./src -name "*_TEMP.tsx" -type f -delete
echo "✅ Arquivos de backup removidos"

# 4. Limpar cache
echo "🧹 4/5 - Limpando cache..."
rm -rf node_modules/.vite
rm -rf dist
echo "✅ Cache limpo"

# 5. Analisar tamanho do projeto
echo "📊 5/5 - Analisando projeto..."
echo ""
echo "📁 Arquivos TypeScript:"
find ./src -name "*.tsx" -o -name "*.ts" | wc -l
echo ""
echo "📦 Tamanho do src:"
du -sh ./src
echo ""
echo "✅ Otimização concluída!"
echo ""
echo "🎯 Próximo passo: npm run build"
echo "📊 Para visualizar bundle: npx vite-bundle-visualizer"
