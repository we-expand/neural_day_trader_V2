/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - SETTINGS MODULE                              ║
 * ║  Types & Interfaces                                               ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

export type SettingsSection = 
  | 'account' 
  | 'trading' 
  | 'notifications' 
  | 'api' 
  | 'appearance' 
  | 'security' 
  | 'advanced';

export interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  timezone?: string;
  avatar?: string;
}

export interface TradingSettings {
  defaultRiskPercent: number;
  maxPositions: number;
  defaultLeverage: number;
  autoStopLoss: boolean;
  autoTakeProfit: boolean;
  trailingStop: boolean;
  defaultTimeframe: string;
  confirmOrders: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  telegramNotifications: boolean;
  tradeAlerts: boolean;
  priceAlerts: boolean;
  newsAlerts: boolean;
  systemAlerts: boolean;
  dailyReport: boolean;
  weeklyReport: boolean;
}

export interface APISettings {
  metaApiToken: string;
  metaApiAccountId: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  webhookUrl?: string;
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'auto';
  language: 'en' | 'pt' | 'es';
  fontSize: 'small' | 'medium' | 'large';
  chartTheme: 'dark' | 'light';
  compactMode: boolean;
  animationsEnabled: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  sessionTimeout: number;
  ipWhitelist: string[];
  apiKeyRestrictions: boolean;
  loginNotifications: boolean;
}

export interface AdvancedSettings {
  debugMode: boolean;
  logsEnabled: boolean;
  performanceMonitoring: boolean;
  betaFeatures: boolean;
  dataCollection: boolean;
  cacheEnabled: boolean;
}

export interface SettingsData {
  profile: UserProfile;
  trading: TradingSettings;
  notifications: NotificationSettings;
  api: APISettings;
  appearance: AppearanceSettings;
  security: SecuritySettings;
  advanced: AdvancedSettings;
}
