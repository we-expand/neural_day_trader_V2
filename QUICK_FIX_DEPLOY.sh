#!/bin/bash
# Quick fix para acionar deploy na Vercel

cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2 || exit 1

echo "🔍 Verificando configuração atual..."
echo ""

# 1. Verificar branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📌 Branch atual: $CURRENT_BRANCH"

# 2. Verificar se há mudanças não commitadas
if [[ -n $(git status --porcelain) ]]; then
    echo "⚠️  Há mudanças não commitadas"
    git status --short
    echo ""
    read -p "Fazer commit agora? (s/N): " do_commit

    if [[ "$do_commit" =~ ^[Ss]$ ]]; then
        git add .
        git commit -m "fix: corrige configuração Vercel para pnpm 9.15.4"
    fi
fi

# 3. Verificar se precisa push
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "⚠️  Branch local está à frente do remote"
    echo "📤 Fazendo push..."
    git push origin "$CURRENT_BRANCH"
else
    echo "✅ Branch já está sincronizada"
    echo ""
    echo "🔄 Fazendo commit vazio para forçar rebuild na Vercel..."
    git commit --allow-empty -m "chore: trigger Vercel redeploy"
    git push origin "$CURRENT_BRANCH"
fi

echo ""
echo "✅ Push concluído!"
echo ""
echo "🌐 Agora faça:"
echo "   1. Acesse: https://vercel.com/cleber-coutos-projects/neural_day_trader"
echo "   2. Clique em 'Deployments'"
echo "   3. Aguarde o novo deployment aparecer (pode levar 30-60 segundos)"
echo ""
echo "   Se NÃO aparecer deployment em 1 minuto:"
echo "   - Vá em Settings → Git"
echo "   - Verifique se Production Branch = $CURRENT_BRANCH"
echo "   - Se estiver diferente, mude para $CURRENT_BRANCH e salve"
