# 🔗 Conectar Projeto na Vercel - Passo a Passo

## ⚠️ PROBLEMA IDENTIFICADO
O projeto `neural_day_trader` na Vercel **NÃO está conectado ao GitHub**.

Por isso os commits não acionam deploy automático!

---

## ✅ SOLUÇÃO - Conectar Repositório

### **Passo 1: Acessar o Projeto na Vercel**

Acesse: https://vercel.com/cleber-coutos-projects/neural_day_trader

### **Passo 2: Ir para Settings → Git**

URL direta: https://vercel.com/cleber-coutos-projects/neural_day_trader/settings/git

### **Passo 3: Conectar o Repositório**

Se você vir a mensagem **"No Git Repository connected"**:

1. Clique em **"Connect Git Repository"**
2. Selecione **GitHub**
3. Procure e selecione: **`we-expand/Neural-Day-Trader`**
4. Autorize o acesso se necessário

### **Passo 4: Configurar Production Branch**

Após conectar, você verá uma opção **"Production Branch"**:

- Se seu repositório usa `main`: selecione **main**
- Se seu repositório usa `master`: selecione **master**

Para descobrir qual você está usando:
```bash
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2
git branch --show-current
```

### **Passo 5: Salvar e Fazer Deploy Inicial**

1. Clique em **"Save"**
2. A Vercel perguntará: **"Deploy the latest commit?"**
3. Clique em **"Deploy"**

---

## 🔄 ALTERNATIVA: Criar Novo Projeto na Vercel

Se não conseguir conectar o repositório no projeto existente:

### **Opção A: Importar Novo Projeto**

1. Acesse: https://vercel.com/new
2. Clique em **"Import Git Repository"**
3. Selecione **`we-expand/Neural-Day-Trader`**
4. Configure:
   - **Project Name**: `neural-day-trader` (ou outro nome)
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `dist`
   - **Install Command**: deixe em branco (auto-detecta pnpm)
5. Clique em **"Deploy"**

### **Opção B: Deploy via Vercel CLI**

```bash
# 1. Instalar Vercel CLI globalmente
npm install -g vercel

# 2. Navegar até o projeto
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2

# 3. Login na Vercel
vercel login

# 4. Deploy (primeira vez)
vercel --prod

# 5. Seguir as instruções no terminal:
# - Set up and deploy? Yes
# - Which scope? cleber-coutos-projects
# - Link to existing project? Yes (se existir) ou No (para criar novo)
# - Project name: neural-day-trader
# - Directory: . (raiz)
```

Após o primeiro deploy via CLI, a Vercel automaticamente conecta ao Git!

---

## 📋 Checklist Pós-Conexão

Após conectar, verifique:

✅ **1. Settings → Git** deve mostrar:
```
Connected Repository: we-expand/Neural-Day-Trader
Production Branch: main (ou master)
```

✅ **2. Fazer um teste:**
```bash
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2

# Criar arquivo de teste
echo "# Deploy Test" > DEPLOY_TEST.md

git add DEPLOY_TEST.md
git commit -m "test: trigger Vercel deploy"
git push origin main  # ou master
```

✅ **3. Ver deployment em tempo real:**
- Acesse: https://vercel.com/cleber-coutos-projects/neural_day_trader/deployments
- Em até 1 minuto deve aparecer um novo deployment
- Status: Building → Ready

---

## 🆘 Troubleshooting

### Problema: "Repository not found"
**Solução:** Certifique-se que você tem acesso ao repositório `we-expand/Neural-Day-Trader` no GitHub

### Problema: "No permission to deploy"
**Solução:** Vá em GitHub → Settings → Applications → Vercel e autorize acesso ao repositório

### Problema: Build falha com erro de pnpm
**Solução:** Isso é esperado! O erro `ERR_INVALID_THIS` ainda pode aparecer no primeiro deploy. Após conectar e o primeiro deploy falhar, volte aqui e eu ajusto a configuração do build.

---

## 🎯 Próximos Passos

**Depois de conectar o repositório:**

1. Me confirme que conseguiu conectar
2. Envie o link ou screenshot da página Settings → Git
3. Faça um commit de teste (comando acima)
4. Me diga se o deployment apareceu automaticamente

Aí eu garanto que o build vai funcionar! 🚀
