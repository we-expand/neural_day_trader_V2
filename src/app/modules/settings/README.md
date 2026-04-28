# ⚙️ **SETTINGS MODULE**

Módulo independente de Configurações da Neural Day Trader Platform.

---

## 📋 **ESTRUTURA**

```
/src/app/modules/settings/
├── index.tsx           # Exports públicos
├── SettingsView.tsx    # Componente principal
├── types.ts            # TypeScript interfaces
└── README.md           # Documentação
```

---

## 🎯 **FUNCIONALIDADES**

### ✅ **7 SEÇÕES COMPLETAS:**

#### 1️⃣ **CONTA E PERFIL**
- Nome completo
- Email
- Telefone
- País
- Fuso horário
- Avatar (futuro)

#### 2️⃣ **TRADING**
- Risco padrão por trade (0.5% - 10%)
- Máximo de posições (1-20)
- Alavancagem padrão (1:10 até 1:500)
- Timeframe padrão (M1, M5, M15, M30, H1, H4, D1)
- Stop Loss automático
- Take Profit automático
- Trailing Stop
- Confirmar ordens antes de executar

#### 3️⃣ **NOTIFICAÇÕES**
**Canais:**
- Email
- Push Notifications
- Telegram

**Tipos de Alerta:**
- Alertas de Trade
- Alertas de Preço
- Notícias de Mercado
- Alertas do Sistema

**Relatórios:**
- Relatório Diário
- Relatório Semanal

#### 4️⃣ **API**
- MetaAPI Token
- MetaAPI Account ID
- Telegram Bot Token
- Telegram Chat ID
- Webhook URL
- Mostrar/Ocultar chaves com botão 👁️

#### 5️⃣ **APARÊNCIA**
- Tema: Escuro, Claro, Auto
- Idioma: PT, EN, ES
- Tamanho da Fonte: Pequeno, Médio, Grande
- Tema dos Gráficos: Escuro, Claro
- Modo Compacto
- Animações

#### 6️⃣ **SEGURANÇA**
- Autenticação de Dois Fatores (2FA)
- Biometria
- Timeout de Sessão (5-120 min)
- Restrições de Chave API
- Notificações de Login
- Whitelist de IPs (futuro)

#### 7️⃣ **AVANÇADO**
- Modo Debug
- Logs Habilitados
- Monitoramento de Performance
- Recursos Beta
- Coleta de Dados
- Cache Habilitado
- Limpar Cache

---

## 🎨 **DESIGN**

### **Layout:**
- Sidebar com 7 seções
- Conteúdo principal à direita
- Botão "Salvar Alterações" no header (aparece quando há mudanças)

### **Componentes:**
- **FormField:** Input com label e ícone
- **ToggleField:** Switch ON/OFF com descrição
- **ThemeOption:** Cards de seleção de tema
- **Sliders:** Range inputs para valores numéricos

### **Cores:**
- Gradiente principal: Slate
- Success: Emerald
- Warning: Yellow
- Error: Red
- Info: Blue

---

## 🔧 **COMO USAR**

### Importar:
```tsx
import { SettingsView } from '@/app/modules/settings';
```

### Usar no App:
```tsx
<SettingsView />
```

---

## 💾 **PERSISTÊNCIA**

Atualmente usando `useState` local. Para persistir:

```tsx
// Salvar no localStorage
localStorage.setItem('neural_settings', JSON.stringify(settings));

// Carregar do localStorage
const saved = localStorage.getItem('neural_settings');
if (saved) setSettings(JSON.parse(saved));

// OU integrar com Supabase:
const { data, error } = await supabase
  .from('user_settings')
  .upsert({ user_id: user.id, settings });
```

---

## 📝 **LOGS**

Todos logs prefixados com `[SETTINGS]`:
```
[SETTINGS] Module loaded, active section: account
[SETTINGS] Settings saved: {...}
```

---

## 🚀 **INTEGRAÇÃO**

Totalmente integrado em:
- ✅ `/src/app/App.tsx`
- ✅ `/src/app/components/Sidebar.tsx`

Rota: `'settings'`

---

## 🐛 **DEBUG**

Para debugar, adicione console.log em:
- `SettingsView.tsx` (mudanças de seção)
- `handleSave()` (salvar configurações)

---

## 🔮 **FUTURAS MELHORIAS**

- [ ] Upload de avatar
- [ ] Whitelist de IPs
- [ ] Exportar/Importar configurações
- [ ] Temas customizados
- [ ] Atalhos de teclado
- [ ] Histórico de alterações

---

**Status:** ✅ **100% Funcional**
