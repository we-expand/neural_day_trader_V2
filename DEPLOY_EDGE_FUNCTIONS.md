# 🚀 Deploy das Edge Functions no Supabase

## Problema Identificado

O erro `402` acontece porque a Edge Function `server` não está deployada no Supabase.

## Solução: Deploy da Edge Function

### 1️⃣ Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2️⃣ Login no Supabase

```bash
supabase login
```

### 3️⃣ Link ao Projeto

```bash
supabase link --project-ref bgarakvnuppzkugzptsr
```

### 4️⃣ Deploy da Função

```bash
supabase functions deploy server
```

### 5️⃣ Configurar Variáveis de Ambiente

No painel do Supabase (`https://supabase.com/dashboard/project/bgarakvnuppzkugzptsr/settings/functions`):

Adicione as seguintes variáveis:
- `SUPABASE_URL` = `https://bgarakvnuppzkugzptsr.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (encontre em Settings > API > service_role key)

## ✅ Verificar Deploy

Após o deploy, teste o endpoint:

```bash
curl https://bgarakvnuppzkugzptsr.supabase.co/functions/v1/make-server-1dbacac6/health
```

## 🎯 Alternativa: Modo Demo (Sem Deploy)

A plataforma já está configurada para funcionar em **modo demonstração** quando a Edge Function não está disponível. Os usuários podem fazer login mesmo sem a função deployada.

## 📝 Notas

- O erro 402 indica que a função não foi encontrada (404) ou não tem permissões
- O sistema ativa automaticamente o fallback demo quando detecta erro 402
- Para produção, recomenda-se fazer o deploy completo da Edge Function
