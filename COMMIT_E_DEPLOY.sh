#!/bin/bash
# Commit dos arquivos editados e deploy na Vercel

PROJETO="/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2"

echo "📝 Commitando arquivos editados"
echo "========================================"
echo ""

cd "$PROJETO" || exit 1

# Verificar status
echo "1️⃣ Status atual do Git:"
git status

echo ""
echo ""

# Adicionar todos os arquivos (incluindo os editados)
echo "2️⃣ Adicionando todos os arquivos..."
git add .

echo ""

# Mostrar o que será commitado
echo "3️⃣ Arquivos que serão commitados:"
git status --short

echo ""
echo ""

# Commit
echo "4️⃣ Criando commit..."
git commit -m "fix: atualiza configurações (.htaccess, .supabaseignore, .deployignore)

- Atualiza /public/.htaccess
- Atualiza /supabase/.supabaseignore
- Atualiza /supabase/functions/.deployignore
"

echo ""

# Push
echo "5️⃣ Fazendo push para GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✅ CÓDIGO ATUALIZADO NO GITHUB!"
    echo "========================================"
    echo ""
    echo "🔗 Repositório: https://github.com/we-expand/neural_day_trader_V2"
    echo ""
    echo "========================================"
    echo "🎯 AGORA: Fazer Deploy na Vercel"
    echo "========================================"
    echo ""
    echo "1. Acesse: https://vercel.com/new"
    echo ""
    echo "2. Clique em 'Import Git Repository'"
    echo ""
    echo "3. Procure e selecione: we-expand/neural_day_trader_V2"
    echo ""
    echo "4. Configure:"
    echo "   Project Name: neural-day-trader-v2"
    echo "   Framework: Vite"
    echo "   Build Command: npm run build"
    echo "   Output Directory: dist"
    echo "   Install Command: (deixe vazio)"
    echo ""
    echo "5. Clique em 'Deploy'"
    echo ""
    echo "✅ Vai funcionar agora!"
    echo ""
else
    echo ""
    echo "❌ Erro no push. Execute manualmente:"
    echo "   git push origin main"
    echo ""
fi
