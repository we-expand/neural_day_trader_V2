# 🚀 Deploy via Vercel CLI - SOLUÇÃO DEFINITIVA

## ⚠️ PROBLEMA
Os commits não estão acionando deploy automático na Vercel.

## ✅ SOLUÇÃO: Usar Vercel CLI

### **Passo 1: Instalar Vercel CLI**

Execute no seu Mac:

```bash
npm install -g vercel@latest
```

---

### **Passo 2: Configurar projeto local**

```bash
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2

# 1. Adicionar packageManager no package.json
# Abra o arquivo e adicione após "type": "module",:
#   "packageManager": "pnpm@9.15.4",

# 2. Verificar se pnpm-workspace.yaml existe e deletar
rm -f pnpm-workspace.yaml

# 3. Commit
git add package.json
git rm pnpm-workspace.yaml 2>/dev/null || true
git commit -m "fix: configura packageManager pnpm@9.15.4 para Vercel"
git push origin main
```

---

### **Passo 3: Login na Vercel**

```bash
vercel login
```

Isso vai abrir o navegador para você fazer login.

---

### **Passo 4: Linkar ao projeto existente**

```bash
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2

vercel link
```

**Responda as perguntas:**
- Set up and deploy? **Y**
- Which scope? **cleber-coutos-projects** (ou seu username)
- Link to existing project? **Y**
- What's the name of your existing project? **neural_day_trader**

---

### **Passo 5: Deploy para Production**

```bash
vercel --prod
```

Isso vai:
1. ✅ Usar as configurações do `vercel.json`
2. ✅ Instalar com pnpm conforme `packageManager`
3. ✅ Fazer build
4. ✅ Fazer deploy direto para produção
5. ✅ **Reconectar o webhook automático** para futuros commits

---

### **Passo 6: Verificar**

Após o deploy via CLI, acesse:
https://vercel.com/cleber-coutos-projects/neural_day_trader/deployments

Você deve ver um deployment novo com status "Ready".

---

## 📋 Script Completo (Copy & Paste)

```bash
#!/bin/bash

echo "🚀 Deploy Neural Day Trader via Vercel CLI"
echo "=========================================="
echo ""

# Instalar Vercel CLI
echo "1️⃣ Instalando Vercel CLI..."
npm install -g vercel@latest

# Ir para o projeto
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2

# Verificar package.json
echo ""
echo "2️⃣ Verificando package.json..."
if ! grep -q '"packageManager"' package.json; then
    echo "❌ packageManager não encontrado!"
    echo ""
    echo "AÇÃO NECESSÁRIA:"
    echo "1. Abra package.json"
    echo "2. Adicione após 'type': 'module',:"
    echo "   \"packageManager\": \"pnpm@9.15.4\","
    echo "3. Salve o arquivo"
    echo ""
    read -p "Pressione ENTER após corrigir..."
fi

# Remover pnpm-workspace.yaml
if [ -f pnpm-workspace.yaml ]; then
    echo "Removendo pnpm-workspace.yaml..."
    rm pnpm-workspace.yaml
fi

# Commit e push
echo ""
echo "3️⃣ Fazendo commit e push..."
git add package.json
git rm pnpm-workspace.yaml 2>/dev/null || true
git commit -m "fix: configura packageManager pnpm@9.15.4 para Vercel" || echo "Nada para commitar"
git push origin main

# Login Vercel
echo ""
echo "4️⃣ Login na Vercel (vai abrir o navegador)..."
vercel login

# Link projeto
echo ""
echo "5️⃣ Linkando ao projeto existente..."
echo "   - Scope: cleber-coutos-projects"
echo "   - Link to existing? Y"
echo "   - Project name: neural_day_trader"
echo ""
vercel link

# Deploy
echo ""
echo "6️⃣ Fazendo deploy para produção..."
vercel --prod

echo ""
echo "✅ DEPLOY CONCLUÍDO!"
echo ""
echo "🔗 Verifique em:"
echo "   https://vercel.com/cleber-coutos-projects/neural_day_trader"
```

---

## 🎯 Depois do primeiro deploy via CLI

**O deploy automático vai funcionar!** A Vercel CLI reconfigura o webhook automaticamente.

Teste fazendo um commit:
```bash
git commit --allow-empty -m "test: deploy automático"
git push origin main
```

E veja se aparece em:
https://vercel.com/cleber-coutos-projects/neural_day_trader/deployments

---

## 🆘 Troubleshooting

### Erro: "No Space" ou "Permission Denied"
```bash
# Usar sudo para instalar globalmente
sudo npm install -g vercel@latest
```

### Erro: pnpm ERR_INVALID_THIS
Se ainda der erro no build, configure manualmente na Vercel:
1. Settings → General → Build & Development Settings
2. Package Manager: **pnpm**
3. Node.js Version: **18.x**
4. Install Command: (deixe vazio)
5. Build Command: `pnpm run build`
6. Output Directory: `dist`

### Projeto não encontrado no vercel link
Liste os projetos:
```bash
vercel projects list
```

---

## ⚡ EXECUTAR AGORA

Copie e cole no Terminal do seu Mac:

```bash
npm install -g vercel@latest && \
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2 && \
vercel login
```

Depois de fazer login, execute:

```bash
vercel link
```

E finalmente:

```bash
vercel --prod
```

Isso VAI FUNCIONAR! 🚀
