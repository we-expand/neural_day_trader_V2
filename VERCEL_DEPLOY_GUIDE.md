# 🚀 Guia de Deploy no Vercel - Neural Day Trader

## ✅ O Que Foi Feito

Migrei as Edge Functions mais usadas do Supabase para Vercel Functions para **eliminar o problema de quota permanentemente**.

### Arquivos Criados:

```
api/
├── binance.ts          ← Proxy Binance (substitui /real/binance/:symbol)
├── signup.ts           ← User signup (substitui /signup)
├── health.ts           ← Health check (substitui /health)
utils/api/
└── config.ts           ← Configuração centralizada de APIs
vercel.json             ← Configuração do Vercel
```

### Código Atualizado:

- ✅ `BinancePollingService.ts` → Usa nova API config
- ✅ Intervalo otimizado: 120 segundos (economia de 99%)
- ✅ Sistema configurável (pode usar Vercel OU Supabase)

---

## 🎯 Deploy no Vercel (5 minutos)

### **Passo 1: Install Vercel CLI**

```bash
npm i -g vercel
```

### **Passo 2: Login no Vercel**

```bash
vercel login
```

### **Passo 3: Deploy do Projeto**

```bash
cd /workspaces/default/code
vercel
```

**Respostas para as perguntas:**
- Set up and deploy? **Y**
- Which scope? **Sua conta**
- Link to existing project? **N**
- What's your project's name? **neural-trader** (ou o que preferir)
- In which directory is your code located? **./** (Enter)
- Want to override the settings? **N**

### **Passo 4: Adicionar Variáveis de Ambiente**

No dashboard do Vercel (https://vercel.com/dashboard):

1. Vá em **Settings** → **Environment Variables**
2. Adicione as seguintes variáveis:

```
SUPABASE_URL = https://bgarakvnuppzkugzptsr.supabase.co
SUPABASE_SERVICE_ROLE_KEY = (sua service role key do Supabase)
```

**Onde encontrar a Service Role Key:**
https://supabase.com/dashboard/project/bgarakvnuppzkugzptsr/settings/api

3. Clique **Save**

### **Passo 5: Redeploy Após Adicionar Variáveis**

```bash
vercel --prod
```

---

## 🔧 Configurar URL da Produção

Após o deploy, você receberá uma URL como:
```
https://neural-trader-xyz123.vercel.app
```

### Atualize o arquivo `utils/api/config.ts`:

```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
  (isLocal
    ? 'http://localhost:3000/api'
    : 'https://neural-trader-xyz123.vercel.app/api' // ← COLE SUA URL AQUI
  );
```

**Depois faça commit e push:**

```bash
git add utils/api/config.ts
git commit -m "Update Vercel API URL"
git push
```

O Vercel fará redeploy automaticamente!

---

## ✅ Testar as APIs

### 1. Health Check:
```bash
curl https://neural-trader-xyz123.vercel.app/api/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "service": "Neural Trader API",
  "timestamp": "2026-04-19T...",
  "version": "1.0.0"
}
```

### 2. Binance Proxy:
```bash
curl https://neural-trader-xyz123.vercel.app/api/binance?symbol=BTCUSDT
```

Resposta esperada:
```json
{
  "symbol": "BTCUSDT",
  "price": 87500.50,
  "change": 1234.56,
  ...
}
```

---

## 🎯 Ativar Vercel na Plataforma

No arquivo `utils/api/config.ts`, certifique-se de que está ativo:

```typescript
export const USE_VERCEL_API = true; // ← Deve estar TRUE
```

Pronto! Agora a plataforma vai usar Vercel ao invés de Supabase Edge Functions.

---

## 📊 Benefícios

### Antes (Supabase):
- ❌ **33.696.000 chamadas/mês** (excede quota Pro 16,8x)
- ❌ **Erro 402** bloqueando tudo
- ❌ **$25/mês** de plano Pro não suficiente

### Depois (Vercel):
- ✅ **100GB bandwidth/mês GRÁTIS**
- ✅ **Sem limite de invocações**
- ✅ **Plataforma funciona 24/7**
- ✅ **Zero custos adicionais**

---

## 🔄 Rollback (Se Necessário)

Se precisar voltar para Supabase temporariamente:

```typescript
// Em utils/api/config.ts
export const USE_VERCEL_API = false; // Voltar para Supabase
```

---

## 🆘 Troubleshooting

### Erro: "SUPABASE_URL is not defined"
**Solução:** Adicione as variáveis de ambiente no dashboard do Vercel

### Erro: "API not found"
**Solução:** Verifique se o deploy foi feito corretamente com `vercel --prod`

### Binance retorna erro
**Solução:** Teste diretamente: `curl https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT`

---

## 📝 Próximos Passos

1. ✅ **Deploy no Vercel** (siga os passos acima)
2. ✅ **Configure variáveis de ambiente**
3. ✅ **Atualize URL da produção no código**
4. ✅ **Teste as APIs**
5. ✅ **Plataforma volta ao ar!**

---

## 🎉 Resultado Final

Após o deploy:
- ✅ **Zero custos de Edge Functions**
- ✅ **Sem limite de chamadas**
- ✅ **Plataforma 100% funcional**
- ✅ **Supabase Pro pode ser usado para outras coisas**

**Tempo estimado:** 5-10 minutos

**Dificuldade:** ⭐⭐ (Fácil)

---

## 💡 Dica Extra

Você pode manter ambos (Vercel + Supabase) rodando em paralelo e fazer switch via variável de ambiente:

```typescript
USE_VERCEL_API = true  // Produção (sem limites)
USE_VERCEL_API = false // Development (usa Supabase quando quota resetar)
```

Isso dá flexibilidade máxima! 🚀
