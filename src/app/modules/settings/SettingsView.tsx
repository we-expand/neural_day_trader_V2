/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - SETTINGS MODULE                              ║
 * ║  Main Component                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import React, { useState } from 'react';
import {
  User,
  TrendingUp,
  Bell,
  Key,
  Palette,
  Shield,
  Settings as SettingsIcon,
  Save,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Smartphone,
  Mail,
  Globe,
  Clock,
  Zap,
  Moon,
  Sun,
  Lock,
  Fingerprint,
  Code,
  Activity,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { SettingsSection, SettingsData } from './types';

// Mock inicial de dados
const INITIAL_SETTINGS: SettingsData = {
  profile: {
    name: 'Neural Trader',
    email: 'trader@neural.com',
    phone: '+55 11 99999-9999',
    country: 'Brazil',
    timezone: 'America/Sao_Paulo',
  },
  trading: {
    defaultRiskPercent: 2,
    maxPositions: 10,
    defaultLeverage: 100,
    autoStopLoss: true,
    autoTakeProfit: true,
    trailingStop: false,
    defaultTimeframe: 'H1',
    confirmOrders: true,
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: true,
    telegramNotifications: false,
    tradeAlerts: true,
    priceAlerts: true,
    newsAlerts: false,
    systemAlerts: true,
    dailyReport: true,
    weeklyReport: true,
  },
  api: {
    metaApiToken: '••••••••••••••••',
    metaApiAccountId: '••••••••••••••••',
    telegramBotToken: '',
    telegramChatId: '',
    webhookUrl: '',
  },
  appearance: {
    theme: 'dark',
    language: 'pt',
    fontSize: 'medium',
    chartTheme: 'dark',
    compactMode: false,
    animationsEnabled: true,
  },
  security: {
    twoFactorEnabled: false,
    biometricEnabled: false,
    sessionTimeout: 30,
    ipWhitelist: [],
    apiKeyRestrictions: true,
    loginNotifications: true,
  },
  advanced: {
    debugMode: false,
    logsEnabled: true,
    performanceMonitoring: true,
    betaFeatures: false,
    dataCollection: true,
    cacheEnabled: true,
  },
};

export function SettingsView() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [settings, setSettings] = useState<SettingsData>(INITIAL_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);

  const handleSave = () => {
    toast.success('Configurações salvas com sucesso!', {
      description: 'Suas alterações foram aplicadas.',
    });
    setHasChanges(false);
    console.log('[SETTINGS] Settings saved:', settings);
  };

  const updateSettings = <K extends keyof SettingsData>(
    section: K,
    updates: Partial<SettingsData[K]>
  ) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
    setHasChanges(true);
  };

  console.log('[SETTINGS] Module loaded, active section:', activeSection);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-br from-slate-950/50 via-black to-slate-900/30">
        <div className="max-w-[1600px] mx-auto px-8 py-12">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-500/10 border border-slate-500/30 rounded-full text-sm text-slate-400 font-semibold mb-6">
                <SettingsIcon className="w-4 h-4" />
                Configurações da Plataforma
              </div>

              <h1 className="text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  Configurações
                </span>
              </h1>

              <p className="text-xl text-slate-400">
                Personalize sua experiência de trading
              </p>
            </div>

            {hasChanges && (
              <button
                onClick={handleSave}
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-bold text-lg transition-all flex items-center gap-3 shadow-lg shadow-emerald-500/20"
              >
                <Save className="w-5 h-5" />
                Salvar Alterações
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-12">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="col-span-3">
            <nav className="space-y-2 sticky top-8">
              {SECTIONS.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    activeSection === section.id
                      ? 'bg-slate-500/20 border border-slate-500/30 text-white'
                      : 'text-slate-400 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <section.icon className="w-5 h-5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold">{section.label}</div>
                    <div className="text-xs text-slate-500">{section.description}</div>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              {activeSection === 'account' && (
                <AccountSection
                  settings={settings.profile}
                  onUpdate={(updates) => updateSettings('profile', updates)}
                />
              )}

              {activeSection === 'trading' && (
                <TradingSection
                  settings={settings.trading}
                  onUpdate={(updates) => updateSettings('trading', updates)}
                />
              )}

              {activeSection === 'notifications' && (
                <NotificationsSection
                  settings={settings.notifications}
                  onUpdate={(updates) => updateSettings('notifications', updates)}
                />
              )}

              {activeSection === 'api' && (
                <APISection
                  settings={settings.api}
                  onUpdate={(updates) => updateSettings('api', updates)}
                  showKeys={showApiKeys}
                  onToggleKeys={() => setShowApiKeys(!showApiKeys)}
                />
              )}

              {activeSection === 'appearance' && (
                <AppearanceSection
                  settings={settings.appearance}
                  onUpdate={(updates) => updateSettings('appearance', updates)}
                />
              )}

              {activeSection === 'security' && (
                <SecuritySection
                  settings={settings.security}
                  onUpdate={(updates) => updateSettings('security', updates)}
                />
              )}

              {activeSection === 'advanced' && (
                <AdvancedSection
                  settings={settings.advanced}
                  onUpdate={(updates) => updateSettings('advanced', updates)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACCOUNT SECTION
// ============================================================================

function AccountSection({ settings, onUpdate }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Conta e Perfil</h2>
        <p className="text-slate-400">Gerencie suas informações pessoais</p>
      </div>

      <div className="space-y-4">
        <FormField label="Nome Completo" icon={User}>
          <input
            type="text"
            value={settings.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50"
          />
        </FormField>

        <FormField label="Email" icon={Mail}>
          <input
            type="email"
            value={settings.email}
            onChange={(e) => onUpdate({ email: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50"
          />
        </FormField>

        <FormField label="Telefone" icon={Smartphone}>
          <input
            type="tel"
            value={settings.phone || ''}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50"
          />
        </FormField>

        <FormField label="País" icon={Globe}>
          <select
            value={settings.country || ''}
            onChange={(e) => onUpdate({ country: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50"
          >
            <option value="Brazil">🇧🇷 Brasil</option>
            <option value="USA">🇺🇸 Estados Unidos</option>
            <option value="UK">🇬🇧 Reino Unido</option>
            <option value="Portugal">🇵🇹 Portugal</option>
          </select>
        </FormField>

        <FormField label="Fuso Horário" icon={Clock}>
          <select
            value={settings.timezone || ''}
            onChange={(e) => onUpdate({ timezone: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50"
          >
            <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
            <option value="America/New_York">New York (GMT-5)</option>
            <option value="Europe/London">London (GMT+0)</option>
            <option value="Europe/Lisbon">Lisbon (GMT+0)</option>
          </select>
        </FormField>
      </div>
    </div>
  );
}

// ============================================================================
// TRADING SECTION
// ============================================================================

function TradingSection({ settings, onUpdate }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Configurações de Trading</h2>
        <p className="text-slate-400">Defina seus parâmetros padrão de negociação</p>
      </div>

      <div className="space-y-6">
        <FormField label={`Risco Padrão por Trade: ${settings.defaultRiskPercent}%`} icon={TrendingUp}>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={settings.defaultRiskPercent}
            onChange={(e) => onUpdate({ defaultRiskPercent: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>0.5%</span>
            <span>Conservador</span>
            <span>Moderado</span>
            <span>Agressivo</span>
            <span>10%</span>
          </div>
        </FormField>

        <FormField label={`Máximo de Posições: ${settings.maxPositions}`} icon={Activity}>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={settings.maxPositions}
            onChange={(e) => onUpdate({ maxPositions: parseInt(e.target.value) })}
            className="w-full"
          />
        </FormField>

        <FormField label={`Alavancagem Padrão: 1:${settings.defaultLeverage}`} icon={Zap}>
          <select
            value={settings.defaultLeverage}
            onChange={(e) => onUpdate({ defaultLeverage: parseInt(e.target.value) })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50"
          >
            <option value="10">1:10</option>
            <option value="20">1:20</option>
            <option value="50">1:50</option>
            <option value="100">1:100</option>
            <option value="200">1:200</option>
            <option value="500">1:500</option>
          </select>
        </FormField>

        <FormField label="Timeframe Padrão" icon={Clock}>
          <select
            value={settings.defaultTimeframe}
            onChange={(e) => onUpdate({ defaultTimeframe: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50"
          >
            <option value="M1">M1 (1 minuto)</option>
            <option value="M5">M5 (5 minutos)</option>
            <option value="M15">M15 (15 minutos)</option>
            <option value="M30">M30 (30 minutos)</option>
            <option value="H1">H1 (1 hora)</option>
            <option value="H4">H4 (4 horas)</option>
            <option value="D1">D1 (Diário)</option>
          </select>
        </FormField>

        <div className="space-y-3">
          <ToggleField
            label="Stop Loss Automático"
            description="Aplicar stop loss automaticamente em todas as operações"
            checked={settings.autoStopLoss}
            onChange={(checked) => onUpdate({ autoStopLoss: checked })}
          />

          <ToggleField
            label="Take Profit Automático"
            description="Aplicar take profit automaticamente em todas as operações"
            checked={settings.autoTakeProfit}
            onChange={(checked) => onUpdate({ autoTakeProfit: checked })}
          />

          <ToggleField
            label="Trailing Stop"
            description="Ativar trailing stop para proteger lucros"
            checked={settings.trailingStop}
            onChange={(checked) => onUpdate({ trailingStop: checked })}
          />

          <ToggleField
            label="Confirmar Ordens"
            description="Solicitar confirmação antes de executar ordens"
            checked={settings.confirmOrders}
            onChange={(checked) => onUpdate({ confirmOrders: checked })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NOTIFICATIONS SECTION
// ============================================================================

function NotificationsSection({ settings, onUpdate }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Notificações</h2>
        <p className="text-slate-400">Escolha como deseja receber atualizações</p>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Canais de Notificação</h3>
          <div className="space-y-3">
            <ToggleField
              label="Email"
              description="Receber notificações por email"
              checked={settings.emailNotifications}
              onChange={(checked) => onUpdate({ emailNotifications: checked })}
              icon={Mail}
            />

            <ToggleField
              label="Push Notifications"
              description="Notificações push no navegador"
              checked={settings.pushNotifications}
              onChange={(checked) => onUpdate({ pushNotifications: checked })}
              icon={Bell}
            />

            <ToggleField
              label="Telegram"
              description="Receber alertas via Telegram"
              checked={settings.telegramNotifications}
              onChange={(checked) => onUpdate({ telegramNotifications: checked })}
              icon={Smartphone}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Tipos de Alerta</h3>
          <div className="space-y-3">
            <ToggleField
              label="Alertas de Trade"
              description="Notificar quando trades forem abertos/fechados"
              checked={settings.tradeAlerts}
              onChange={(checked) => onUpdate({ tradeAlerts: checked })}
            />

            <ToggleField
              label="Alertas de Preço"
              description="Notificar quando preços atingirem níveis definidos"
              checked={settings.priceAlerts}
              onChange={(checked) => onUpdate({ priceAlerts: checked })}
            />

            <ToggleField
              label="Notícias de Mercado"
              description="Receber notícias e análises importantes"
              checked={settings.newsAlerts}
              onChange={(checked) => onUpdate({ newsAlerts: checked })}
            />

            <ToggleField
              label="Alertas do Sistema"
              description="Atualizações e manutenção da plataforma"
              checked={settings.systemAlerts}
              onChange={(checked) => onUpdate({ systemAlerts: checked })}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Relatórios</h3>
          <div className="space-y-3">
            <ToggleField
              label="Relatório Diário"
              description="Resumo de performance enviado diariamente"
              checked={settings.dailyReport}
              onChange={(checked) => onUpdate({ dailyReport: checked })}
            />

            <ToggleField
              label="Relatório Semanal"
              description="Análise detalhada enviada semanalmente"
              checked={settings.weeklyReport}
              onChange={(checked) => onUpdate({ weeklyReport: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// API SECTION
// ============================================================================

function APISection({ settings, onUpdate, showKeys, onToggleKeys }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Integrações API</h2>
        <p className="text-slate-400">Configure suas chaves de API e integrações</p>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-400">
          <strong>Importante:</strong> Nunca compartilhe suas chaves de API. Mantenha-as em segurança.
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-4">MetaAPI (MetaTrader 5)</h3>
          
          <FormField label="Token de API" icon={Key}>
            <div className="relative">
              <input
                type={showKeys ? 'text' : 'password'}
                value={settings.metaApiToken}
                onChange={(e) => onUpdate({ metaApiToken: e.target.value })}
                className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50 font-mono text-sm"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              />
              <button
                onClick={onToggleKeys}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {showKeys ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </FormField>

          <FormField label="Account ID" icon={User}>
            <input
              type={showKeys ? 'text' : 'password'}
              value={settings.metaApiAccountId}
              onChange={(e) => onUpdate({ metaApiAccountId: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50 font-mono text-sm"
              placeholder="12345678-abcd-1234-abcd-123456789abc"
            />
          </FormField>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Telegram Bot (Opcional)</h3>
          
          <FormField label="Bot Token" icon={Smartphone}>
            <input
              type="text"
              value={settings.telegramBotToken || ''}
              onChange={(e) => onUpdate({ telegramBotToken: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50 font-mono text-sm"
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            />
          </FormField>

          <FormField label="Chat ID" icon={Mail}>
            <input
              type="text"
              value={settings.telegramChatId || ''}
              onChange={(e) => onUpdate({ telegramChatId: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50 font-mono text-sm"
              placeholder="123456789"
            />
          </FormField>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Webhook (Opcional)</h3>
          
          <FormField label="Webhook URL" icon={Globe}>
            <input
              type="url"
              value={settings.webhookUrl || ''}
              onChange={(e) => onUpdate({ webhookUrl: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50 text-sm"
              placeholder="https://your-webhook-url.com/api/trades"
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// APPEARANCE SECTION
// ============================================================================

function AppearanceSection({ settings, onUpdate }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Aparência</h2>
        <p className="text-slate-400">Personalize a interface da plataforma</p>
      </div>

      <div className="space-y-4">
        <FormField label="Tema" icon={Palette}>
          <div className="grid grid-cols-3 gap-3">
            <ThemeOption
              label="Escuro"
              icon={Moon}
              active={settings.theme === 'dark'}
              onClick={() => onUpdate({ theme: 'dark' })}
            />
            <ThemeOption
              label="Claro"
              icon={Sun}
              active={settings.theme === 'light'}
              onClick={() => onUpdate({ theme: 'light' })}
            />
            <ThemeOption
              label="Auto"
              icon={Activity}
              active={settings.theme === 'auto'}
              onClick={() => onUpdate({ theme: 'auto' })}
            />
          </div>
        </FormField>

        <FormField label="Idioma" icon={Globe}>
          <select
            value={settings.language}
            onChange={(e) => onUpdate({ language: e.target.value })}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-slate-500/50"
          >
            <option value="pt">🇧🇷 Português</option>
            <option value="en">🇺🇸 English</option>
            <option value="es">🇪🇸 Español</option>
          </select>
        </FormField>

        <FormField label="Tamanho da Fonte" icon={Activity}>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onUpdate({ fontSize: 'small' })}
              className={`px-4 py-3 rounded-xl border transition-all ${
                settings.fontSize === 'small'
                  ? 'bg-slate-500/20 border-slate-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              Pequeno
            </button>
            <button
              onClick={() => onUpdate({ fontSize: 'medium' })}
              className={`px-4 py-3 rounded-xl border transition-all ${
                settings.fontSize === 'medium'
                  ? 'bg-slate-500/20 border-slate-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              Médio
            </button>
            <button
              onClick={() => onUpdate({ fontSize: 'large' })}
              className={`px-4 py-3 rounded-xl border transition-all ${
                settings.fontSize === 'large'
                  ? 'bg-slate-500/20 border-slate-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              Grande
            </button>
          </div>
        </FormField>

        <FormField label="Tema dos Gráficos" icon={TrendingUp}>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onUpdate({ chartTheme: 'dark' })}
              className={`px-4 py-3 rounded-xl border transition-all ${
                settings.chartTheme === 'dark'
                  ? 'bg-slate-500/20 border-slate-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              Escuro
            </button>
            <button
              onClick={() => onUpdate({ chartTheme: 'light' })}
              className={`px-4 py-3 rounded-xl border transition-all ${
                settings.chartTheme === 'light'
                  ? 'bg-slate-500/20 border-slate-500/50 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              Claro
            </button>
          </div>
        </FormField>

        <div className="space-y-3">
          <ToggleField
            label="Modo Compacto"
            description="Reduzir espaçamento para mostrar mais informações"
            checked={settings.compactMode}
            onChange={(checked) => onUpdate({ compactMode: checked })}
          />

          <ToggleField
            label="Animações"
            description="Ativar animações e transições na interface"
            checked={settings.animationsEnabled}
            onChange={(checked) => onUpdate({ animationsEnabled: checked })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECURITY SECTION
// ============================================================================

function SecuritySection({ settings, onUpdate }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Segurança</h2>
        <p className="text-slate-400">Proteja sua conta e dados</p>
      </div>

      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-400">
          Sua conta está protegida com criptografia de ponta a ponta.
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Autenticação</h3>
          <div className="space-y-3">
            <ToggleField
              label="Autenticação de Dois Fatores (2FA)"
              description="Adicione uma camada extra de segurança com 2FA"
              checked={settings.twoFactorEnabled}
              onChange={(checked) => onUpdate({ twoFactorEnabled: checked })}
              icon={Lock}
            />

            <ToggleField
              label="Biometria"
              description="Usar impressão digital ou reconhecimento facial"
              checked={settings.biometricEnabled}
              onChange={(checked) => onUpdate({ biometricEnabled: checked })}
              icon={Fingerprint}
            />
          </div>
        </div>

        <FormField label={`Timeout de Sessão: ${settings.sessionTimeout} minutos`} icon={Clock}>
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={settings.sessionTimeout}
            onChange={(e) => onUpdate({ sessionTimeout: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>5 min</span>
            <span>30 min</span>
            <span>60 min</span>
            <span>120 min</span>
          </div>
        </FormField>

        <div>
          <h3 className="text-lg font-semibold mb-4">Controles Adicionais</h3>
          <div className="space-y-3">
            <ToggleField
              label="Restrições de Chave API"
              description="Limitar acesso de API por endereço IP"
              checked={settings.apiKeyRestrictions}
              onChange={(checked) => onUpdate({ apiKeyRestrictions: checked })}
            />

            <ToggleField
              label="Notificações de Login"
              description="Receber alerta quando houver novo login"
              checked={settings.loginNotifications}
              onChange={(checked) => onUpdate({ loginNotifications: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADVANCED SECTION
// ============================================================================

function AdvancedSection({ settings, onUpdate }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Configurações Avançadas</h2>
        <p className="text-slate-400">Opções para usuários avançados</p>
      </div>

      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="text-sm text-red-400">
          <strong>Atenção:</strong> Altere essas configurações apenas se souber o que está fazendo.
        </div>
      </div>

      <div className="space-y-3">
        <ToggleField
          label="Modo Debug"
          description="Ativar logs detalhados para debugging"
          checked={settings.debugMode}
          onChange={(checked) => onUpdate({ debugMode: checked })}
          icon={Code}
        />

        <ToggleField
          label="Logs Habilitados"
          description="Gravar logs de atividades do sistema"
          checked={settings.logsEnabled}
          onChange={(checked) => onUpdate({ logsEnabled: checked })}
          icon={Database}
        />

        <ToggleField
          label="Monitoramento de Performance"
          description="Coletar métricas de performance da plataforma"
          checked={settings.performanceMonitoring}
          onChange={(checked) => onUpdate({ performanceMonitoring: checked })}
          icon={Activity}
        />

        <ToggleField
          label="Recursos Beta"
          description="Ativar recursos experimentais em desenvolvimento"
          checked={settings.betaFeatures}
          onChange={(checked) => onUpdate({ betaFeatures: checked })}
          icon={Zap}
        />

        <ToggleField
          label="Coleta de Dados"
          description="Compartilhar dados anônimos para melhorar a plataforma"
          checked={settings.dataCollection}
          onChange={(checked) => onUpdate({ dataCollection: checked })}
          icon={Database}
        />

        <ToggleField
          label="Cache Habilitado"
          description="Usar cache local para melhorar performance"
          checked={settings.cacheEnabled}
          onChange={(checked) => onUpdate({ cacheEnabled: checked })}
          icon={Activity}
        />
      </div>

      <div className="pt-6 border-t border-white/10">
        <button className="px-6 py-3 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 rounded-xl text-red-400 font-semibold transition-all">
          Limpar Cache e Dados Locais
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// FORM COMPONENTS
// ============================================================================

function FormField({ label, icon: Icon, children }: any) {
  return (
    <div>
      <label className="block mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          {Icon && <Icon className="w-4 h-4" />}
          {label}
        </div>
      </label>
      {children}
    </div>
  );
}

function ToggleField({ label, description, checked, onChange, icon: Icon }: any) {
  return (
    <div className="flex items-start justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all">
      <div className="flex items-start gap-3 flex-1">
        {Icon && (
          <div className="w-10 h-10 bg-slate-500/10 border border-slate-500/30 rounded-lg flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-slate-400" />
          </div>
        )}
        <div>
          <div className="font-semibold mb-1">{label}</div>
          <div className="text-sm text-slate-400">{description}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-all shrink-0 ${
          checked ? 'bg-emerald-500' : 'bg-slate-700'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
            checked ? 'left-6' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function ThemeOption({ label, icon: Icon, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all ${
        active
          ? 'bg-slate-500/20 border-slate-500/50 text-white'
          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
      }`}
    >
      <Icon className="w-8 h-8 mx-auto mb-2" />
      <div className="text-sm font-semibold">{label}</div>
    </button>
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECTIONS = [
  {
    id: 'account' as SettingsSection,
    label: 'Conta',
    description: 'Perfil e informações',
    icon: User,
  },
  {
    id: 'trading' as SettingsSection,
    label: 'Trading',
    description: 'Parâmetros de negociação',
    icon: TrendingUp,
  },
  {
    id: 'notifications' as SettingsSection,
    label: 'Notificações',
    description: 'Alertas e relatórios',
    icon: Bell,
  },
  {
    id: 'api' as SettingsSection,
    label: 'API',
    description: 'Integrações e chaves',
    icon: Key,
  },
  {
    id: 'appearance' as SettingsSection,
    label: 'Aparência',
    description: 'Tema e interface',
    icon: Palette,
  },
  {
    id: 'security' as SettingsSection,
    label: 'Segurança',
    description: 'Proteção da conta',
    icon: Shield,
  },
  {
    id: 'advanced' as SettingsSection,
    label: 'Avançado',
    description: 'Opções de desenvolvedor',
    icon: SettingsIcon,
  },
];
