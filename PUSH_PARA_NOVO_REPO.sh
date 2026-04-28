#!/bin/bash
# Push do código para o novo repositório GitHub

PROJETO="/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2"
NOVO_REPO="https://github.com/we-expand/neural_day_trader_V2.git"

echo "🚀 Subindo código para GitHub"
echo "========================================"
echo "📁 Pasta: $PROJETO"
echo "🔗 Novo repo: $NOVO_REPO"
echo ""

cd "$PROJETO" || exit 1

# Verificar se existe .git
if [ ! -d ".git" ]; then
    echo "1️⃣ Inicializando repositório Git..."
    git init
    echo "✅ Git inicializado"
else
    echo "✅ Repositório Git já existe"
fi

echo ""

# Configurar usuário (se necessário)
if ! git config user.email > /dev/null 2>&1; then
    echo "2️⃣ Configurando usuário Git..."
    git config user.email "cleber.couto@we-expand.com"
    git config user.name "Cleber Couto"
    echo "✅ Usuário configurado"
fi

echo ""

# Remover remote antigo se existir
echo "3️⃣ Configurando remote..."
git remote remove origin 2>/dev/null || true
git remote add origin "$NOVO_REPO"
echo "✅ Remote configurado: $NOVO_REPO"

echo ""

# Adicionar todos os arquivos
echo "4️⃣ Adicionando arquivos..."
git add .
echo "✅ Arquivos adicionados"

echo ""

# Mostrar status
echo "📊 Arquivos a serem commitados:"
git status --short | head -20
TOTAL=$(git status --short | wc -l)
echo "... ($TOTAL arquivos no total)"

echo ""

# Commit
echo "5️⃣ Criando commit..."
git commit -m "feat: Neural Day Trader V2 - versão inicial

- Plataforma de trading quantitativo com React 18 + TypeScript
- Integração MetaAPI para MT5
- IA preditiva e análise de liquidez
- Dashboard completo com gráficos
- Sistema de backtesting
- Configurado para deploy na Vercel com npm

Pronto para produção.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

echo "✅ Commit criado"

echo ""

# Push
echo "6️⃣ Fazendo push para GitHub..."
echo "   Isso pode levar alguns minutos dependendo do tamanho..."
echo ""

git push -u origin main || git push -u origin master

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✅ SUCESSO!"
    echo "========================================"
    echo ""
    echo "📦 Código enviado para:"
    echo "   $NOVO_REPO"
    echo ""
    echo "🔗 Veja em:"
    echo "   https://github.com/we-expand/neural_day_trader_V2"
    echo ""
    echo "========================================"
    echo "🎯 PRÓXIMO PASSO: Deploy na Vercel"
    echo "========================================"
    echo ""
    echo "1. Acesse: https://vercel.com/new"
    echo ""
    echo "2. Clique em 'Import Git Repository'"
    echo ""
    echo "3. Selecione: we-expand/neural_day_trader_V2"
    echo ""
    echo "4. Configure:"
    echo "   - Project Name: neural-day-trader-v2"
    echo "   - Framework: Vite"
    echo "   - Build Command: npm run build"
    echo "   - Output Directory: dist"
    echo ""
    echo "5. Clique em 'Deploy'"
    echo ""
    echo "✅ Em 2-3 minutos estará online!"
    echo ""
else
    echo ""
    echo "❌ ERRO no push!"
    echo ""
    echo "Possíveis causas:"
    echo "1. Repositório não está vazio no GitHub"
    echo "2. Não tem permissão para push"
    echo "3. Precisa autenticar com token"
    echo ""
    echo "Solução:"
    echo "Se o repo não está vazio, use:"
    echo "  git push -u origin main --force"
    echo ""
fi
