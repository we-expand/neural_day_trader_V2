#!/bin/bash
# Deploy do projeto correto: Neural_Day_Trader_V2

PROJETO="/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2"

echo "🚀 Deploy Neural Day Trader V2"
echo "========================================"
echo "📁 Pasta: $PROJETO"
echo ""

# Verificar se a pasta existe
if [ ! -d "$PROJETO" ]; then
    echo "❌ ERRO: Pasta não encontrada!"
    echo "   Verifique se o caminho está correto:"
    echo "   $PROJETO"
    exit 1
fi

cd "$PROJETO" || exit 1

# Confirmar pasta
echo "✅ Pasta encontrada!"
echo "📍 Localização atual: $(pwd)"
echo ""

# Verificar se é um repositório Git
if [ ! -d ".git" ]; then
    echo "❌ ERRO: Não é um repositório Git!"
    echo "   Execute: git init"
    exit 1
fi

echo "✅ Repositório Git confirmado"
echo ""

# Verificar package.json
if [ ! -f "package.json" ]; then
    echo "❌ ERRO: package.json não encontrado!"
    exit 1
fi

echo "✅ package.json encontrado"
echo ""

# Verificar se packageManager já existe
echo "🔍 Verificando packageManager..."
if grep -q '"packageManager"' package.json; then
    echo "✅ packageManager já existe:"
    grep '"packageManager"' package.json
else
    echo "❌ packageManager NÃO encontrado. Adicionando..."

    # Backup
    cp package.json package.json.backup
    echo "   Backup criado: package.json.backup"

    # Adicionar packageManager
    sed -i '' '/"type": "module",/a\
  "packageManager": "pnpm@9.15.4",
' package.json

    # Verificar
    if grep -q '"packageManager"' package.json; then
        echo "   ✅ packageManager adicionado com sucesso!"
    else
        echo "   ❌ Falha ao adicionar. Tentando método alternativo..."
        mv package.json.backup package.json
        perl -i -pe 's/("type": "module",)/$1\n  "packageManager": "pnpm@9.15.4",/' package.json

        if grep -q '"packageManager"' package.json; then
            echo "   ✅ Adicionado com método alternativo!"
        else
            echo "   ❌ FALHOU. Edite manualmente:"
            echo "   nano package.json"
            echo "   Adicione após 'type': 'module',:"
            echo "   \"packageManager\": \"pnpm@9.15.4\","
            exit 1
        fi
    fi
fi

echo ""

# Remover pnpm-workspace.yaml se existir
if [ -f "pnpm-workspace.yaml" ]; then
    echo "🗑️  Removendo pnpm-workspace.yaml..."
    rm pnpm-workspace.yaml
    echo "   ✅ Removido"
fi

echo ""

# Mostrar status git
echo "📊 Status Git:"
git status --short

echo ""

# Perguntar se deve commitar
read -p "Fazer commit das mudanças? (s/N): " do_commit

if [[ "$do_commit" =~ ^[Ss]$ ]]; then
    git add package.json
    git rm pnpm-workspace.yaml 2>/dev/null || true
    git commit -m "fix: adiciona packageManager pnpm@9.15.4 para Vercel"

    echo ""
    echo "📤 Fazendo push..."
    git push origin main || git push origin master

    echo ""
    echo "✅ Commit e push concluídos!"
fi

echo ""
echo "========================================"
echo "🚀 PRÓXIMO PASSO: Deploy via Vercel CLI"
echo "========================================"
echo ""
echo "Execute:"
echo "  vercel --prod"
echo ""
echo "Isso vai fazer o deploy do projeto atual para produção."
echo ""
