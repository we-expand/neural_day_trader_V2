# 🚀 Criar Novo Projeto na Vercel - Guia Completo

## Por que criar um projeto novo?

O projeto `neural_day_trader` existente tem:
- ❌ Cache de build antigo com pnpm
- ❌ Configurações mal aplicadas
- ❌ Webhooks possivelmente quebrados

**Novo projeto = ambiente limpo = deploy funcionando em 2 minutos!**

---

## 📋 PASSO A PASSO

### **Passo 1: Preparar repositório local**

```bash
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2

# Garantir que está usando npm (não pnpm)
rm -f pnpm-lock.yaml pnpm-workspace.yaml .npmrc

# Remover packageManager do package.json
sed -i '' '/"packageManager":/d' package.json

# Instalar com npm
npm install

# Commit
git add .
git commit -m "feat: prepara projeto para deploy na Vercel"
git push origin main
```

---

### **Passo 2: Criar Novo Projeto na Vercel**

#### **Opção A: Via Dashboard (Interface)** ⭐ RECOMENDADO

1. Acesse: https://vercel.com/new

2. Clique em **"Import Git Repository"**

3. Se não aparecer o repositório:
   - Clique em "Adjust GitHub App Permissions"
   - Adicione acesso ao repositório `we-expand/Neural-Day-Trader`

4. Selecione: **`we-expand/Neural-Day-Trader`**

5. Configure o projeto:
   ```
   Project Name: neural-day-trader-v2
   Framework Preset: Vite
   Root Directory: ./
   Build Command: npm run build
   Output Directory: dist
   Install Command: (deixe vazio - auto-detecta)
   ```

6. **Environment Variables** (se necessário):
   - Clique em "Add Environment Variable"
   - Adicione variáveis do .env se houver

7. Clique em **"Deploy"**

8. ✅ **Aguarde 2-3 minutos** → Deploy vai funcionar!

---

#### **Opção B: Via Vercel CLI** ⚡ MAIS RÁPIDO

```bash
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2

# Login (se ainda não fez)
vercel login

# Criar novo projeto
vercel

# Responda:
# - Set up and deploy? Y
# - Which scope? cleber-coutos-projects
# - Link to existing project? N (NÃO!)
# - What's your project's name? neural-day-trader-v2
# - In which directory? ./ (Enter)
# - Want to override settings? N

# Deploy para produção
vercel --prod
```

✅ **Pronto!** Em 2 minutos vai estar no ar.

---

### **Passo 3: Configurar Domínio (Opcional)**

Se quiser usar o mesmo domínio do projeto antigo:

1. Acesse o **projeto ANTIGO**: https://vercel.com/cleber-coutos-projects/neural_day_trader/settings/domains

2. **Remova** todos os domínios customizados

3. Acesse o **projeto NOVO**: https://vercel.com/cleber-coutos-projects/neural-day-trader-v2/settings/domains

4. **Adicione** os domínios:
   - `neuraldaytrader.vercel.app`
   - Ou seu domínio customizado se tiver

---

### **Passo 4: Deletar Projeto Antigo (Opcional)**

Após confirmar que o novo funciona:

1. Acesse: https://vercel.com/cleber-coutos-projects/neural_day_trader/settings

2. Role até o final → **"Delete Project"**

3. Digite o nome do projeto para confirmar

4. Delete

---

## 🎯 URLs do Novo Projeto

Após o deploy, você terá:

- **Production:** https://neural-day-trader-v2.vercel.app
- **Dashboard:** https://vercel.com/cleber-coutos-projects/neural-day-trader-v2

---

## ✅ Checklist Pós-Deploy

Após criar o projeto novo:

- ✅ Build completa com sucesso
- ✅ Site abre no navegador
- ✅ Deploy automático funciona (teste com commit)
- ✅ Sem erros de pnpm

---

## 🆘 Se ainda der erro

**Se mesmo no projeto NOVO der erro de pnpm:**

Vá em Settings → General:

1. **Framework Preset:** Vite
2. **Build Command:** `npm run build`
3. **Output Directory:** `dist`
4. **Install Command:** `npm install` (força npm)
5. **Node.js Version:** 18.x

Salve e clique em "Redeploy".

---

## 📊 Comparação: Projeto Antigo vs Novo

| Item | Projeto Antigo | Projeto Novo |
|------|----------------|--------------|
| Cache build | ❌ Corrompido | ✅ Limpo |
| Package manager | ❌ pnpm (bug) | ✅ npm |
| Webhooks | ❌ Quebrados | ✅ Funcionando |
| Configuração | ❌ Conflitos | ✅ Fresh |
| Tempo para funcionar | ❌ Horas tentando | ✅ 2 minutos |

---

## 🚀 EXECUTAR AGORA

**Recomendo a Opção B (CLI) - mais rápida:**

```bash
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2

# Limpar pnpm
rm -f pnpm-lock.yaml pnpm-workspace.yaml .npmrc
sed -i '' '/"packageManager":/d' package.json

# Instalar com npm
npm install

# Commit
git add .
git commit -m "feat: prepara para Vercel com npm"
git push origin main

# Criar projeto novo na Vercel
vercel

# Quando perguntar "Link to existing project?", responda: N

# Deploy para produção
vercel --prod
```

✅ **Isso VAI FUNCIONAR!**
