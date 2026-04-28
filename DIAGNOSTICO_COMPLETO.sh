#!/bin/bash
# Diagnóstico completo do problema de deploy

echo "🔍 DIAGNÓSTICO COMPLETO - Deploy Vercel"
echo "========================================"
echo ""

cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2 || exit 1

# 1. Verificar branch
echo "1️⃣ BRANCH ATUAL:"
BRANCH=$(git branch --show-current)
echo "   → $BRANCH"
echo ""

# 2. Verificar último commit LOCAL
echo "2️⃣ ÚLTIMO COMMIT LOCAL:"
git log --oneline -1
echo ""

# 3. Verificar se está sincronizado com remote
echo "3️⃣ SINCRONIZAÇÃO COM GITHUB:"
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "   ✅ Local e GitHub estão sincronizados"
else
    echo "   ❌ PROBLEMA: Local e GitHub DIFERENTES!"
    echo "   Local:  $LOCAL"
    echo "   Remote: $REMOTE"
    echo ""
    echo "   SOLUÇÃO: git push origin $BRANCH"
fi
echo ""

# 4. Verificar package.json
echo "4️⃣ PACKAGE.JSON:"
if grep -q '"packageManager"' package.json; then
    echo "   ✅ packageManager encontrado:"
    grep -A0 '"packageManager"' package.json | head -1
else
    echo "   ❌ packageManager NÃO ENCONTRADO!"
    echo "   PRECISA ADICIONAR: \"packageManager\": \"pnpm@9.15.4\","
fi
echo ""

# 5. Verificar pnpm-workspace.yaml
echo "5️⃣ PNPM-WORKSPACE.YAML:"
if [ -f pnpm-workspace.yaml ]; then
    echo "   ❌ EXISTE (precisa deletar!)"
    echo "   SOLUÇÃO: rm pnpm-workspace.yaml"
else
    echo "   ✅ Não existe (correto!)"
fi
echo ""

# 6. Ver último commit no GitHub
echo "6️⃣ ÚLTIMO COMMIT NO GITHUB (remote):"
git log origin/$BRANCH --oneline -1
echo ""

# 7. Verificar se há webhooks sendo bloqueados
echo "7️⃣ URL DO REPOSITÓRIO NO GITHUB:"
REPO_URL=$(git remote get-url origin)
echo "   → $REPO_URL"
echo ""
echo "   Acesse: ${REPO_URL%.git}/settings/hooks"
echo "   Verifique se há um webhook da Vercel com ✅ verde"
echo ""

# Resumo
echo "========================================"
echo "📋 RESUMO DO DIAGNÓSTICO"
echo "========================================"
echo ""
echo "Branch: $BRANCH"
echo "Sincronizado com GitHub: $([ "$LOCAL" = "$REMOTE" ] && echo "✅ SIM" || echo "❌ NÃO")"
echo "packageManager no package.json: $(grep -q '"packageManager"' package.json && echo "✅ SIM" || echo "❌ NÃO")"
echo "pnpm-workspace.yaml existe: $([ -f pnpm-workspace.yaml ] && echo "❌ SIM (ruim)" || echo "✅ NÃO (bom)")"
echo ""
echo "========================================"
echo "🎯 PRÓXIMOS PASSOS"
echo "========================================"
echo ""

# Determinar ações necessárias
NEEDS_PUSH=false
NEEDS_FIX=false

if [ "$LOCAL" != "$REMOTE" ]; then
    NEEDS_PUSH=true
fi

if ! grep -q '"packageManager"' package.json || [ -f pnpm-workspace.yaml ]; then
    NEEDS_FIX=true
fi

if [ "$NEEDS_FIX" = true ]; then
    echo "❗ PRECISA CORRIGIR package.json:"
    echo ""
    echo "   # Edite package.json e adicione após 'type': 'module':"
    echo "   \"packageManager\": \"pnpm@9.15.4\","
    echo ""
    if [ -f pnpm-workspace.yaml ]; then
        echo "   # Delete pnpm-workspace.yaml:"
        echo "   rm pnpm-workspace.yaml"
        echo ""
    fi
    echo "   # Depois:"
    echo "   git add package.json"
    if [ -f pnpm-workspace.yaml ]; then
        echo "   git rm pnpm-workspace.yaml"
    fi
    echo "   git commit -m 'fix: configura pnpm@9.15.4 para Vercel'"
    echo "   git push origin $BRANCH"
elif [ "$NEEDS_PUSH" = true ]; then
    echo "❗ PRECISA FAZER PUSH:"
    echo ""
    echo "   git push origin $BRANCH"
else
    echo "✅ Tudo certo no lado do código!"
    echo ""
    echo "🔍 O problema pode estar na Vercel:"
    echo ""
    echo "   1. Acesse: https://vercel.com/cleber-coutos-projects/neural_day_trader/settings/git"
    echo "   2. Role até 'Git Repository' e verifique:"
    echo "      - Repository: we-expand/Neural-Day-Trader ✅"
    echo "      - Clique em 'Edit' e veja se a branch está correta"
    echo ""
    echo "   3. TESTE MANUAL - Force um redeploy:"
    echo "      https://vercel.com/cleber-coutos-projects/neural_day_trader/deployments"
    echo "      - Clique no último deployment"
    echo "      - Clique em 'Redeploy'"
    echo "      - DESMARQUE 'Use existing Build Cache'"
    echo "      - Clique 'Redeploy'"
fi
echo ""
