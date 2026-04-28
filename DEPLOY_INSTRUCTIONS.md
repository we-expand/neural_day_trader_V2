# 🚀 Instruções de Deploy - Neural Day Trader

## Status Atual
✅ Código corrigido e commitado  
✅ Configuração Vercel otimizada  
⏳ Aguardando push para GitHub

## 🔧 Correções Aplicadas

1. **package.json**: Adicionado `packageManager: "pnpm@9.15.4"` (força versão estável)
2. **pnpm-workspace.yaml**: REMOVIDO (causava conflito ERR_INVALID_THIS)
3. **vercel.json**: Simplificado (remove installCommand redundante)
4. **.gitignore**: Criado para excluir node_modules e dist

---

## 📝 Passo a Passo - Deploy Manual

### Opção A: Usando este projeto local (/workspaces/default/code)

Se você está neste ambiente e tem acesso Git configurado:

```bash
# 1. Configure credenciais GitHub (se necessário)
git config user.email "cleber.couto@we-expand.com"
git config user.name "Cleber Couto"

# 2. Faça o push (vai pedir senha/token do GitHub)
git push -u origin master

# 3. A Vercel detectará automaticamente e fará o deploy
```

---

### Opção B: Copiar para projeto local no Mac

```bash
# 1. No seu Mac, abra o Terminal
cd /Users/clebercouto/Projects/we-expand/Neural_Day_Trader_V2

# 2. Certifique-se que está na branch correta
git checkout main  # ou master

# 3. Copie os arquivos corrigidos:
# - package.json
# - vercel.json  
# - .gitignore
# (Remova o arquivo pnpm-workspace.yaml se existir)

# 4. Commit e push
git add .
git commit -m "fix: corrige deploy Vercel - packageManager pnpm@9.15.4"
git push origin main

# 5. A Vercel detectará automaticamente
```

---

## 🔄 Opção C: Deploy Direto via Vercel Dashboard

1. Acesse https://vercel.com/cleber-coutos-projects/neural_day_trader
2. Clique em "Settings" → "Git"
3. Verifique se está conectado a `we-expand/Neural-Day-Trader`
4. Vá em "Deployments"
5. Clique em "Redeploy" (se o código já foi pushed)

---

## ✅ Verificação Pós-Deploy

Após o push, a Vercel iniciará o build automaticamente. Você verá:

```
✓ Installing dependencies with pnpm 9.15.4
✓ Building project...
✓ Deployment ready
```

Se ainda der erro `ERR_INVALID_THIS`:
- Vá em Settings → General → Node.js Version → selecione "18.x"
- Vá em Settings → General → Package Manager → confirme "pnpm"

---

## 📊 URLs do Deploy

- **Production**: https://neuraldaytrader.vercel.app
- **Preview**: https://neuraldaytrader-git-main-cleber-coutos-projects.vercel.app

---

## 🆘 Se ainda houver problemas

Execute no seu projeto local:

```bash
# Limpar cache local
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Testar build local
pnpm run build

# Se funcionar local, commitar o novo pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m "chore: update pnpm lock file"
git push
```

---

## 🔑 Arquivos Importantes Modificados

- ✅ `package.json` - linha 6: `"packageManager": "pnpm@9.15.4"`
- ❌ `pnpm-workspace.yaml` - DELETADO
- ✅ `vercel.json` - removido `installCommand`
- ✅ `.gitignore` - adicionado (novo)
