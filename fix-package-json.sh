#!/bin/bash
# Script para adicionar packageManager no package.json

cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2 || exit 1

echo "🔧 Corrigindo package.json..."
echo ""

# Verificar se já existe
if grep -q '"packageManager"' package.json; then
    echo "✅ packageManager já existe:"
    grep '"packageManager"' package.json
    exit 0
fi

echo "❌ packageManager não encontrado. Adicionando..."

# Backup
cp package.json package.json.backup
echo "✅ Backup criado: package.json.backup"

# Adicionar packageManager após "type": "module",
# Para Mac, usando sed com sintaxe BSD
sed -i '' '/"type": "module",/a\
  "packageManager": "pnpm@9.15.4",
' package.json

# Verificar se funcionou
if grep -q '"packageManager"' package.json; then
    echo "✅ packageManager adicionado com sucesso!"
    echo ""
    echo "📋 Arquivo package.json (primeiras 10 linhas):"
    head -n 10 package.json
    echo ""
    echo "✅ Pronto para fazer commit!"
else
    echo "❌ Erro ao adicionar. Vou tentar método alternativo..."

    # Restaurar backup
    mv package.json.backup package.json

    # Método alternativo usando perl
    perl -i -pe 's/("type": "module",)/$1\n  "packageManager": "pnpm\@9.15.4",/' package.json

    if grep -q '"packageManager"' package.json; then
        echo "✅ Adicionado com método alternativo!"
    else
        echo "❌ Falhou. Vou mostrar como editar manualmente..."
        echo ""
        echo "Execute:"
        echo "  nano package.json"
        echo ""
        echo "Procure a linha:"
        echo '  "type": "module",'
        echo ""
        echo "Adicione logo ABAIXO dela:"
        echo '  "packageManager": "pnpm@9.15.4",'
        echo ""
        echo "Salve com: Ctrl+O, Enter, Ctrl+X"
    fi
fi
