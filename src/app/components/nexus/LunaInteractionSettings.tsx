import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  X, 
  Volume2, 
  Bell, 
  Clock, 
  Target, 
  Zap,
  TrendingUp,
  Shield,
  MessageCircle,
  Sliders,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';

// ⚙️ CONFIGURAÇÕES DA LUNA (localStorage)
export interface LunaSettings {
  // ALERTAS PROATIVOS
  proactiveAlerts: {
    enabled: boolean;
    breakouts: boolean;
    riskWarnings: boolean;
    opportunities: boolean;
  };
  
  // FREQUÊNCIA
  frequency: {
    btc: number;        // ms (10000 = 10s)
    multiAsset: number; // ms (15000 = 15s)
    custom: boolean;
  };
  
  // VOZ AUTOMÁTICA
  voice: {
    autoSpeak: boolean;
    gender: 'male' | 'female';
  };
  
  // CANAIS DE ALERTA
  channels: {
    visual: boolean;
    sound: boolean;
    voice: boolean;
  };
  
  // PROATIVIDADE
  proactivity: 'low' | 'medium' | 'high' | 'ultra';
  
  // HORÁRIOS
  schedule: {
    enabled: boolean;
    start: string; // "09:00"
    end: string;   // "18:00"
  };
  
  // ATIVOS
  watchlist: string[];
}

const DEFAULT_SETTINGS: LunaSettings = {
  proactiveAlerts: {
    enabled: true,
    breakouts: true,
    riskWarnings: true,
    opportunities: true,
  },
  frequency: {
    btc: 10000,
    multiAsset: 15000,
    custom: false,
  },
  voice: {
    autoSpeak: true,
    gender: 'female',
  },
  channels: {
    visual: true,
    sound: true,
    voice: true,
  },
  proactivity: 'high',
  schedule: {
    enabled: false,
    start: '09:00',
    end: '18:00',
  },
  watchlist: ['BTC/USD', 'ETH/USD', 'EUR/USD', 'GOLD'],
};

interface LunaInteractionSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: LunaSettings) => void;
}

export function LunaInteractionSettings({ isOpen, onClose, onSave }: LunaInteractionSettingsProps) {
  const [settings, setSettings] = useState<LunaSettings>(DEFAULT_SETTINGS);
  const [expandedSection, setExpandedSection] = useState<string | null>('proactive');
  const [hasChanges, setHasChanges] = useState(false);

  // Carregar do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('luna_interaction_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar configurações da Luna:', e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('luna_interaction_settings', JSON.stringify(settings));
    onSave?.(settings);
    setHasChanges(false);
    
    // Feedback visual
    const btn = document.getElementById('save-btn');
    if (btn) {
      btn.classList.add('scale-95');
      setTimeout(() => btn.classList.remove('scale-95'), 200);
    }
  };

  const updateSettings = (updater: (prev: LunaSettings) => LunaSettings) => {
    setSettings(updater);
    setHasChanges(true);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const proactivityLevels = [
    { value: 'low', label: 'Baixa', desc: 'Alertas apenas críticos', color: 'blue' },
    { value: 'medium', label: 'Média', desc: 'Alertas importantes', color: 'cyan' },
    { value: 'high', label: 'Alta', desc: 'Todos os alertas relevantes', color: 'purple' },
    { value: 'ultra', label: 'Ultra', desc: 'Máxima atenção aos detalhes', color: 'pink' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-[600px] bg-gradient-to-br from-[#0a0a0a] via-[#141414] to-[#0a0a0a] border-l-2 border-cyan-500/30 shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* HEADER */}
            <div className="relative px-6 py-5 bg-gradient-to-r from-cyan-600/10 via-purple-600/10 to-pink-600/10 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30"
                  >
                    <Settings className="w-6 h-6 text-cyan-400" />
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      Configurações da Luna
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Personalize como a Luna interage com você</p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Indicador de mudanças */}
              {hasChanges && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"
                />
              )}
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* SEÇÃO 1: ALERTAS PROATIVOS */}
              <SettingsSection
                icon={Bell}
                title="Alertas Proativos"
                description="Controle quando e como a Luna te avisa"
                isExpanded={expandedSection === 'proactive'}
                onToggle={() => toggleSection('proactive')}
                color="purple"
              >
                <div className="space-y-4">
                  {/* Master Switch */}
                  <PremiumToggle
                    label="Ativar Alertas Proativos"
                    description="Luna vai te avisar sobre oportunidades e riscos automaticamente"
                    checked={settings.proactiveAlerts.enabled}
                    onChange={(checked) => updateSettings(prev => ({
                      ...prev,
                      proactiveAlerts: { ...prev.proactiveAlerts, enabled: checked }
                    }))}
                  />

                  {/* Sub-opções (só aparecem se master estiver ON) */}
                  {settings.proactiveAlerts.enabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="pl-4 border-l-2 border-purple-500/30 space-y-3"
                    >
                      <PremiumToggle
                        label="Breakouts"
                        description="Alertas quando detectar rompimento de níveis"
                        checked={settings.proactiveAlerts.breakouts}
                        onChange={(checked) => updateSettings(prev => ({
                          ...prev,
                          proactiveAlerts: { ...prev.proactiveAlerts, breakouts: checked }
                        }))}
                        size="sm"
                      />

                      <PremiumToggle
                        label="Avisos de Risco"
                        description="Alerta quando suas posições estiverem em risco"
                        checked={settings.proactiveAlerts.riskWarnings}
                        onChange={(checked) => updateSettings(prev => ({
                          ...prev,
                          proactiveAlerts: { ...prev.proactiveAlerts, riskWarnings: checked }
                        }))}
                        size="sm"
                      />

                      <PremiumToggle
                        label="Oportunidades"
                        description="Sugestões de trades com alta probabilidade"
                        checked={settings.proactiveAlerts.opportunities}
                        onChange={(checked) => updateSettings(prev => ({
                          ...prev,
                          proactiveAlerts: { ...prev.proactiveAlerts, opportunities: checked }
                        }))}
                        size="sm"
                      />
                    </motion.div>
                  )}
                </div>
              </SettingsSection>

              {/* SEÇÃO 2: FREQUÊNCIA */}
              <SettingsSection
                icon={Zap}
                title="Frequência de Checagem"
                description="Quão rápido a Luna monitora o mercado"
                isExpanded={expandedSection === 'frequency'}
                onToggle={() => toggleSection('frequency')}
                color="cyan"
              >
                <div className="space-y-4">
                  {/* BTC Frequency Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-white">Bitcoin (BTC)</label>
                      <span className="text-xs text-cyan-400 font-mono">{settings.frequency.btc / 1000}s</span>
                    </div>
                    <PremiumSlider
                      value={settings.frequency.btc}
                      onChange={(value) => updateSettings(prev => ({
                        ...prev,
                        frequency: { ...prev.frequency, btc: value, custom: true }
                      }))}
                      min={5000}
                      max={60000}
                      step={5000}
                      color="cyan"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Mais rápido = mais alertas, mas maior uso de recursos
                    </p>
                  </div>

                  {/* Multi-Asset Frequency Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-white">Outros Ativos</label>
                      <span className="text-xs text-purple-400 font-mono">{settings.frequency.multiAsset / 1000}s</span>
                    </div>
                    <PremiumSlider
                      value={settings.frequency.multiAsset}
                      onChange={(value) => updateSettings(prev => ({
                        ...prev,
                        frequency: { ...prev.frequency, multiAsset: value, custom: true }
                      }))}
                      min={10000}
                      max={120000}
                      step={5000}
                      color="purple"
                    />
                  </div>

                  {/* Presets rápidos */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSettings(prev => ({
                        ...prev,
                        frequency: { btc: 5000, multiAsset: 10000, custom: false }
                      }))}
                      className="flex-1 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-all"
                    >
                      ⚡ Ultra Rápida
                    </button>
                    <button
                      onClick={() => updateSettings(prev => ({
                        ...prev,
                        frequency: { btc: 10000, multiAsset: 15000, custom: false }
                      }))}
                      className="flex-1 px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold transition-all"
                    >
                      ⚡ Rápida (Padrão)
                    </button>
                    <button
                      onClick={() => updateSettings(prev => ({
                        ...prev,
                        frequency: { btc: 30000, multiAsset: 60000, custom: false }
                      }))}
                      className="flex-1 px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold transition-all"
                    >
                      🐢 Econômica
                    </button>
                  </div>
                </div>
              </SettingsSection>

              {/* SEÇÃO 3: VOZ */}
              <SettingsSection
                icon={Volume2}
                title="Configurações de Voz"
                description="Como a Luna vai falar com você"
                isExpanded={expandedSection === 'voice'}
                onToggle={() => toggleSection('voice')}
                color="pink"
              >
                <div className="space-y-4">
                  <PremiumToggle
                    label="Respostas em Voz Automáticas"
                    description="Luna responde com voz sempre que você enviar mensagem"
                    checked={settings.voice.autoSpeak}
                    onChange={(checked) => updateSettings(prev => ({
                      ...prev,
                      voice: { ...prev.voice, autoSpeak: checked }
                    }))}
                  />

                  {/* Voice Gender */}
                  <div>
                    <label className="text-sm font-semibold text-white mb-3 block">Voz da Luna</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => updateSettings(prev => ({
                          ...prev,
                          voice: { ...prev.voice, gender: 'female' }
                        }))}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          settings.voice.gender === 'female'
                            ? 'bg-pink-500/20 border-pink-500 shadow-lg shadow-pink-500/20'
                            : 'bg-white/5 border-white/10 hover:border-pink-500/50'
                        }`}
                      >
                        <div className="text-3xl mb-2">♀️</div>
                        <div className="text-sm font-bold text-white">Feminina</div>
                        <div className="text-xs text-slate-400 mt-1">Jovem e energética</div>
                      </button>

                      <button
                        onClick={() => updateSettings(prev => ({
                          ...prev,
                          voice: { ...prev.voice, gender: 'male' }
                        }))}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          settings.voice.gender === 'male'
                            ? 'bg-blue-500/20 border-blue-500 shadow-lg shadow-blue-500/20'
                            : 'bg-white/5 border-white/10 hover:border-blue-500/50'
                        }`}
                      >
                        <div className="text-3xl mb-2">♂️</div>
                        <div className="text-sm font-bold text-white">Masculina</div>
                        <div className="text-xs text-slate-400 mt-1">Firme e confiante</div>
                      </button>
                    </div>
                  </div>
                </div>
              </SettingsSection>

              {/* SEÇÃO 4: CANAIS */}
              <SettingsSection
                icon={MessageCircle}
                title="Canais de Alerta"
                description="Onde você quer receber os avisos"
                isExpanded={expandedSection === 'channels'}
                onToggle={() => toggleSection('channels')}
                color="green"
              >
                <div className="space-y-3">
                  <PremiumToggle
                    label="Visual (Notificações na tela)"
                    checked={settings.channels.visual}
                    onChange={(checked) => updateSettings(prev => ({
                      ...prev,
                      channels: { ...prev.channels, visual: checked }
                    }))}
                  />

                  <PremiumToggle
                    label="Sonoro (Sons de alerta)"
                    checked={settings.channels.sound}
                    onChange={(checked) => updateSettings(prev => ({
                      ...prev,
                      channels: { ...prev.channels, sound: checked }
                    }))}
                  />

                  <PremiumToggle
                    label="Voz (Luna fala com você)"
                    checked={settings.channels.voice}
                    onChange={(checked) => updateSettings(prev => ({
                      ...prev,
                      channels: { ...prev.channels, voice: checked }
                    }))}
                  />
                </div>
              </SettingsSection>

              {/* SEÇÃO 5: NÍVEL DE PROATIVIDADE */}
              <SettingsSection
                icon={TrendingUp}
                title="Nível de Proatividade"
                description="Quão ativa a Luna será nas sugestões"
                isExpanded={expandedSection === 'proactivity'}
                onToggle={() => toggleSection('proactivity')}
                color="orange"
              >
                <div className="grid grid-cols-2 gap-3">
                  {proactivityLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => updateSettings(prev => ({
                        ...prev,
                        proactivity: level.value as any
                      }))}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        settings.proactivity === level.value
                          ? `bg-${level.color}-500/20 border-${level.color}-500 shadow-lg shadow-${level.color}-500/20`
                          : 'bg-white/5 border-white/10 hover:border-' + level.color + '-500/50'
                      }`}
                    >
                      <div className="text-sm font-bold text-white mb-1">{level.label}</div>
                      <div className="text-xs text-slate-400">{level.desc}</div>
                    </button>
                  ))}
                </div>
              </SettingsSection>

              {/* SEÇÃO 6: HORÁRIOS */}
              <SettingsSection
                icon={Clock}
                title="Horário de Funcionamento"
                description="Quando a Luna pode te alertar"
                isExpanded={expandedSection === 'schedule'}
                onToggle={() => toggleSection('schedule')}
                color="indigo"
              >
                <div className="space-y-4">
                  <PremiumToggle
                    label="Limitar por Horário"
                    description="Luna só vai te alertar dentro do horário definido"
                    checked={settings.schedule.enabled}
                    onChange={(checked) => updateSettings(prev => ({
                      ...prev,
                      schedule: { ...prev.schedule, enabled: checked }
                    }))}
                  />

                  {settings.schedule.enabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <label className="text-xs font-semibold text-slate-300 mb-2 block">Início</label>
                        <input
                          type="time"
                          value={settings.schedule.start}
                          onChange={(e) => updateSettings(prev => ({
                            ...prev,
                            schedule: { ...prev.schedule, start: e.target.value }
                          }))}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300 mb-2 block">Fim</label>
                        <input
                          type="time"
                          value={settings.schedule.end}
                          onChange={(e) => updateSettings(prev => ({
                            ...prev,
                            schedule: { ...prev.schedule, end: e.target.value }
                          }))}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </SettingsSection>
            </div>

            {/* FOOTER - AÇÕES */}
            <div className="px-6 py-4 bg-gradient-to-t from-black/50 to-transparent border-t border-white/10">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSettings(DEFAULT_SETTINGS);
                    setHasChanges(true);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold transition-all"
                >
                  Restaurar Padrão
                </button>

                <button
                  id="save-btn"
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    hasChanges
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white shadow-lg shadow-cyan-500/20'
                      : 'bg-white/5 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Salvar Configurações
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ========================================
// COMPONENTES AUXILIARES PREMIUM
// ========================================

interface SettingsSectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  isExpanded: boolean;
  onToggle: () => void;
  color: string;
  children: React.ReactNode;
}

function SettingsSection({ icon: Icon, title, description, isExpanded, onToggle, color, children }: SettingsSectionProps) {
  const colorClasses = {
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/30',
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/30',
    pink: 'from-pink-500/10 to-pink-500/5 border-pink-500/30',
    green: 'from-green-500/10 to-green-500/5 border-green-500/30',
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/30',
    indigo: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/30',
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses] || colorClasses.purple} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-white" />
          <div className="text-left">
            <div className="text-sm font-bold text-white">{title}</div>
            <div className="text-xs text-slate-400">{description}</div>
          </div>
        </div>

        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PremiumToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
}

function PremiumToggle({ label, description, checked, onChange, size = 'md' }: PremiumToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className={`font-semibold text-white ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{label}</div>
        {description && (
          <div className="text-xs text-slate-400 mt-0.5">{description}</div>
        )}
      </div>

      <button
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 rounded-full transition-all ${
          size === 'sm' ? 'w-10 h-6' : 'w-12 h-7'
        } ${
          checked
            ? 'bg-gradient-to-r from-cyan-500 to-purple-500 shadow-lg shadow-cyan-500/30'
            : 'bg-white/10'
        }`}
      >
        <motion.div
          animate={{
            x: checked ? (size === 'sm' ? 16 : 20) : 2,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`absolute top-1 rounded-full bg-white shadow-lg ${
            size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
          }`}
        />
      </button>
    </div>
  );
}

interface PremiumSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  color: string;
}

function PremiumSlider({ value, onChange, min, max, step, color }: PremiumSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  const colorClasses = {
    cyan: 'from-cyan-500 to-cyan-600',
    purple: 'from-purple-500 to-purple-600',
    pink: 'from-pink-500 to-pink-600',
  };

  return (
    <div className="relative">
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, rgb(6, 182, 212) 0%, rgb(168, 85, 247) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`
        }}
      />
    </div>
  );
}

// Hook para usar as configurações da Luna
export function useLunaSettings() {
  const [settings, setSettings] = useState<LunaSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem('luna_interaction_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao carregar configurações da Luna:', e);
      }
    }

    // Listener para mudanças
    const handleStorageChange = () => {
      const saved = localStorage.getItem('luna_interaction_settings');
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch (e) {
          console.error('Erro ao carregar configurações da Luna:', e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return settings;
}
