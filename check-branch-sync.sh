#!/bin/bash
# Verificar sincronização entre branch local e Vercel

echo "🔍 DIAGNÓSTICO - Branch e Deploy"
echo "=================================="
echo ""

cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2 || exit 1

# 1. Branch atual
CURRENT_BRANCH=$(git branch --show-current)
echo "📌 Branch local atual: $CURRENT_BRANCH"
echo ""

# 2. Últimos commits
echo "📝 Últimos 3 commits locais:"
git log --oneline -3
echo ""

# 3. Status do git
echo "📊 Status Git:"
git status
echo ""

# 4. Verificar se há commits não enviados
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "⚠️  PROBLEMA: Branch não está rastreando um remote!"
    echo ""
    echo "SOLUÇÃO:"
    echo "  git push -u origin $CURRENT_BRANCH"
    exit 1
fi

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ Branch está sincronizada com o remote"
else
    echo "⚠️  PROBLEMA: Há commits locais não enviados ao GitHub"
    echo ""
    echo "SOLUÇÃO:"
    echo "  git push origin $CURRENT_BRANCH"
    exit 1
fi

echo ""
echo "=================================="
echo "📋 CHECKLIST:"
echo "=================================="
echo ""
echo "1️⃣ Verifique na Vercel se a Production Branch = $CURRENT_BRANCH"
echo "   URL: https://vercel.com/cleber-coutos-projects/neural_day_trader/settings/git"
echo ""
echo "2️⃣ Veja se há deployments nos últimos minutos:"
echo "   URL: https://vercel.com/cleber-coutos-projects/neural_day_trader/deployments"
echo ""
echo "3️⃣ Se a Production Branch na Vercel for DIFERENTE de '$CURRENT_BRANCH':"
echo "   - Clique em 'Edit' ao lado de Production Branch"
echo "   - Selecione: $CURRENT_BRANCH"
echo "   - Salve"
echo ""
echo "4️⃣ Após ajustar, force um novo deploy:"
echo "   git commit --allow-empty -m 'chore: trigger Vercel deploy'"
echo "   git push origin $CURRENT_BRANCH"
echo ""
