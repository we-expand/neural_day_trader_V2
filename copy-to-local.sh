#!/bin/bash
# Script para copiar arquivos corrigidos para o projeto local

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Projeto local do usuário
LOCAL_PROJECT="/Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2"

echo -e "${YELLOW}🚀 Neural Day Trader - Sincronização de Correções${NC}\n"

# Verifica se o diretório local existe
if [ ! -d "$LOCAL_PROJECT" ]; then
    echo -e "${RED}❌ Diretório local não encontrado: $LOCAL_PROJECT${NC}"
    echo "Execute este script no seu Mac ou ajuste a variável LOCAL_PROJECT"
    exit 1
fi

echo -e "${GREEN}✓${NC} Projeto local encontrado\n"

# Arquivos a serem copiados
echo "📦 Copiando arquivos corrigidos..."

# 1. package.json (com packageManager especificado)
cp package.json "$LOCAL_PROJECT/package.json"
echo -e "${GREEN}✓${NC} package.json"

# 2. vercel.json (simplificado)
cp vercel.json "$LOCAL_PROJECT/vercel.json"
echo -e "${GREEN}✓${NC} vercel.json"

# 3. .gitignore (novo)
cp .gitignore "$LOCAL_PROJECT/.gitignore"
echo -e "${GREEN}✓${NC} .gitignore"

# 4. Remover pnpm-workspace.yaml se existir
if [ -f "$LOCAL_PROJECT/pnpm-workspace.yaml" ]; then
    rm "$LOCAL_PROJECT/pnpm-workspace.yaml"
    echo -e "${GREEN}✓${NC} pnpm-workspace.yaml (removido)"
fi

echo -e "\n${GREEN}✅ Arquivos sincronizados!${NC}\n"

# Instruções finais
echo -e "${YELLOW}📝 Próximos passos:${NC}"
echo "   1. cd $LOCAL_PROJECT"
echo "   2. git status  # veja as mudanças"
echo "   3. git add ."
echo "   4. git commit -m \"fix: corrige deploy Vercel - pnpm 9.15.4\""
echo "   5. git push origin main"
echo ""
echo -e "${YELLOW}🔄 A Vercel detectará automaticamente e iniciará o deploy${NC}\n"

# Opcional: Oferecer fazer o commit automaticamente
read -p "Deseja fazer commit e push automaticamente? (s/N): " auto_commit

if [[ "$auto_commit" =~ ^[Ss]$ ]]; then
    cd "$LOCAL_PROJECT"

    git add .
    git status --short

    echo ""
    read -p "Confirma o commit? (s/N): " confirm

    if [[ "$confirm" =~ ^[Ss]$ ]]; then
        git commit -m "fix: corrige deploy Vercel - packageManager pnpm@9.15.4

- Adiciona packageManager no package.json para forçar versão estável do pnpm
- Remove pnpm-workspace.yaml desnecessário (causava ERR_INVALID_THIS)
- Simplifica vercel.json removendo installCommand redundante
- Adiciona .gitignore completo para excluir node_modules e dist"

        echo ""
        echo -e "${YELLOW}Fazendo push...${NC}"
        git push origin main

        if [ $? -eq 0 ]; then
            echo -e "\n${GREEN}✅ Deploy enviado com sucesso!${NC}"
            echo -e "${GREEN}🔗 Acompanhe em: https://vercel.com/cleber-coutos-projects/neural_day_trader${NC}"
        else
            echo -e "\n${RED}❌ Erro no push. Verifique suas credenciais Git.${NC}"
        fi
    fi
fi
