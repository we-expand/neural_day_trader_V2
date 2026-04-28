#!/bin/bash

# 🔧 SCRIPT DE DIAGNÓSTICO E CORREÇÃO
# Neural Day Trader Platform - Cache Error Fix

echo "🔧 Neural Day Trader - Diagnóstico e Correção de Cache"
echo "======================================================"
echo ""

# Função para imprimir com cor
print_info() {
    echo "ℹ️  $1"
}

print_success() {
    echo "✅ $1"
}

print_error() {
    echo "❌ $1"
}

print_warning() {
    echo "⚠️  $1"
}

# 1. Verificar se há processos Node rodando
echo "1️⃣  Verificando processos Node.js..."
if pgrep -f "vite" > /dev/null; then
    print_warning "Servidor Vite está rodando. Parando..."
    pkill -f "vite"
    sleep 2
    print_success "Servidor parado"
else
    print_success "Nenhum processo Vite rodando"
fi
echo ""

# 2. Limpar cache do Vite
echo "2️⃣  Limpando cache do Vite..."
if [ -d "node_modules/.vite" ]; then
    rm -rf node_modules/.vite
    print_success "Cache do Vite removido"
else
    print_info "Pasta node_modules/.vite não encontrada"
fi
echo ""

# 3. Limpar build anterior
echo "3️⃣  Limpando build anterior..."
if [ -d "dist" ]; then
    rm -rf dist
    print_success "Pasta dist removida"
else
    print_info "Pasta dist não encontrada"
fi
echo ""

# 4. Verificar arquivos críticos
echo "4️⃣  Verificando arquivos críticos..."
if grep -q "useBacktestStore" src/**/*.tsx 2>/dev/null; then
    print_error "ERRO: useBacktestStore encontrado no código!"
    echo "    Localização:"
    grep -n "useBacktestStore" src/**/*.tsx
else
    print_success "Código limpo - useBacktestStore não encontrado"
fi
echo ""

# 5. Verificar Providers
echo "5️⃣  Verificando Providers no App.tsx..."
if grep -q "AuthProvider\|MarketProvider\|ApexTradingProvider\|AssistantProvider\|DebugProvider" src/app/App.tsx; then
    print_success "Todos os Providers estão presentes"
else
    print_error "Alguns Providers podem estar faltando"
fi
echo ""

# 6. Build fresh
echo "6️⃣  Iniciando build limpo..."
print_info "Isso pode levar alguns minutos..."
npm run build 2>&1 | tee /tmp/build.log

if [ $? -eq 0 ]; then
    print_success "Build concluído com sucesso!"
else
    print_error "Build falhou. Verifique /tmp/build.log"
    echo ""
    echo "Últimas 20 linhas do log:"
    tail -n 20 /tmp/build.log
    exit 1
fi
echo ""

# 7. Instruções finais
echo "======================================================"
echo "✅ DIAGNÓSTICO CONCLUÍDO"
echo "======================================================"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo ""
echo "1️⃣  Limpar cache do navegador:"
echo "    - Chrome/Edge: Ctrl + Shift + Delete"
echo "    - Selecionar 'Cached images and files'"
echo "    - OU usar Hard Reload: Ctrl + Shift + R"
echo ""
echo "2️⃣  Iniciar o servidor:"
echo "    npm run dev"
echo ""
echo "3️⃣  Testar os módulos:"
echo "    - AI Trader"
echo "    - Configurações → Sistema"
echo "    - Configurações → AI Trader Voice"
echo ""
echo "======================================================"
echo ""

# Perguntar se quer iniciar o servidor
read -p "Deseja iniciar o servidor agora? (s/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_success "Iniciando servidor..."
    npm run dev
fi
