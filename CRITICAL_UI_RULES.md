# ⚠️ REGRAS CRÍTICAS DE UI - NEURAL DAY TRADER PLATFORM

## 🚫 BOTÕES PROIBIDOS NO DASHBOARD

**NUNCA adicione esses botões novamente ao MarketScoreBoard.tsx ou qualquer componente do Dashboard:**

❌ **FALLBACK** - Confunde usuários sobre origem dos dados
❌ **DADOS** - Redundante com informações já exibidas
❌ **AJUSTAR** - Não deve permitir alterações manuais no Dashboard
❌ **OFFLINE** - Status de mercado já é exibido adequadamente
❌ **CONECTAR** - Conexão MT5 é gerenciada no AI Trader

## ✅ COMPONENTES APROVADOS

### Header.tsx
- ✅ Badge LIVE/DEMO (único, ao lado do título)
- ✅ BrokerConnectionStatus (mostra Infinox automaticamente)
- ✅ Avatar do usuário (DiceBear com opção de personalização)
- ✅ Botão de notificações
- ✅ Botão de logout

### BrokerConnectionStatus.tsx
- ✅ Detecta automaticamente conexão MT5
- ✅ Mostra logo da Infinox quando conectado
- ✅ Mostra "Nenhum broker conectado" quando desconectado

## 🎨 PADRÃO DE AVATAR

```typescript
// useUserProfile.ts
const getAvatarUrl = () => {
  if (profile?.avatarUrl) return profile.avatarUrl;
  if (user?.user_metadata?.avatar_url) return user.user_metadata.avatar_url;
  const seed = user?.email || user?.id || 'default';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=1f2937&radius=50`;
};
```

## 🚀 PERFORMANCE

### ChartView.tsx
- ✅ LiquidityDetector carregado com React.lazy()
- ✅ Suspense com fallback de loading
- ✅ Carregamento instantâneo do gráfico

```typescript
const LiquidityDetector = lazy(() => 
  import('@/app/components/LiquidityDetector').then(m => ({ default: m.LiquidityDetector }))
);

<Suspense fallback={<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />}>
  <LiquidityDetector zones={liquidityZones} currentPrice={currentPrice} />
</Suspense>
```

## 📋 CHECKLIST ANTES DE COMMIT

- [ ] Nenhum botão FALLBACK/DADOS/AJUSTAR/OFFLINE no Dashboard
- [ ] Apenas um badge LIVE/DEMO no Header
- [ ] BrokerConnectionStatus mostra Infinox automaticamente
- [ ] Avatar do usuário usa DiceBear
- [ ] LiquidityDetector usa lazy loading
- [ ] Formato de nome: "Nome Completo" + "email@exemplo.com"

## 🔒 ARQUIVOS PROTEGIDOS

Não adicionar botões de debug/desenvolvimento nestes arquivos:
- `/src/app/components/dashboard/MarketScoreBoard.tsx`
- `/src/app/components/layout/Header.tsx`
- `/src/app/components/Dashboard.tsx`

## 📞 SUPORTE

Se precisar adicionar funcionalidades de debug:
1. Crie um componente separado em `/src/app/components/debug/`
2. Use flag de ambiente `DEBUG_MODE`
3. Nunca exponha no Dashboard principal
4. Sempre remova antes de produção

---

**Data de criação:** 26 de Fevereiro de 2026
**Última atualização:** 26 de Fevereiro de 2026
**Versão:** 1.0.0
