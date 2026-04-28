/**
 * 🎛️ AI TOOLS CONTROL PANEL
 * 
 * Painel de controle centralizado para gerenciar ferramentas de IA da plataforma
 * 
 * Funcionalidades:
 * - Ativar/Desativar Detector de Liquidez (Order Flow)
 * - Ativar/Desativar ATR Trailing Stop
 * - Visualizar status de cada ferramenta
 * - Acesso rápido às configurações
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 * @date 21 Janeiro 2026
 */

import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Switch } from '@/app/components/ui/switch';
import { toast } from 'sonner';
import {
  Droplets,
  Target,
  Settings,
  Zap,
  Activity,
  Info,
  TrendingUp,
  ShieldCheck,
  Brain,
  X,
  Check,
  Layers
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { ATRTrailingStopManager } from '@/app/components/tools/ATRTrailingStopManager';
import { PyramidingConfigPanel, DEFAULT_PYRAMIDING_CONFIG, type PyramidingConfig } from '@/app/components/trading/PyramidingConfigPanel';

interface AITool {
  id: string;
  name: string;
  description: string;
  icon: any;
  enabled: boolean;
  status: 'active' | 'idle' | 'processing';
  metrics?: {
    label: string;
    value: string | number;
  }[];
}

interface ATRConfig {
  mode: 'CHANDELIER' | 'SIMPLE_ATR' | 'PARABOLIC_SAR';
  atrPeriod: number;
  atrMultiplier: number;
  preset: 'conservador' | 'balanceado' | 'agressivo' | 'personalizado';
}

export function AIToolsControl() {
  const [tools, setTools] = useState<AITool[]>([
    // ✅ REMOVIDO: Detector de Liquidez (agora está na sidebar do ChartView)
    {
      id: 'atr-trailing-stop',
      name: 'ATR Trailing Stop',
      description: 'Proteção automática de lucros baseada em volatilidade',
      icon: Target,
      enabled: true,
      status: 'active',
      metrics: [
        { label: 'Posições Ativas', value: 3 },
        { label: 'Lucro Protegido', value: '$142' },
        { label: 'Movimentos', value: 18 }
      ]
    },
    {
      id: 'pyramiding',
      name: 'Pyramiding System',
      description: 'Adiciona posições automaticamente em tendências favoráveis',
      icon: Layers,
      enabled: true,
      status: 'active',
      metrics: [
        { label: 'Posições Empilhadas', value: 2 },
        { label: 'Lucro Adicional', value: '+$87' },
        { label: 'Win Rate', value: '73%' }
      ]
    }
  ]);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  
  // ✅ Estado para configurações do ATR
  const [atrConfig, setAtrConfig] = useState<ATRConfig>({
    mode: 'CHANDELIER',
    atrPeriod: 14,
    atrMultiplier: 2.0,
    preset: 'conservador'
  });

  // ✅ Estado para configurações do Pyramiding
  const [pyramidingConfig, setPyramidingConfig] = useState<PyramidingConfig>(DEFAULT_PYRAMIDING_CONFIG);

  // ✅ Aplicar preset
  const applyPreset = (preset: 'conservador' | 'balanceado' | 'agressivo' | 'personalizado') => {
    const configs: Record<string, ATRConfig> = {
      conservador: {
        mode: 'CHANDELIER',
        atrPeriod: 14,
        atrMultiplier: 2.0,
        preset: 'conservador'
      },
      balanceado: {
        mode: 'CHANDELIER',
        atrPeriod: 14,
        atrMultiplier: 1.5,
        preset: 'balanceado'
      },
      agressivo: {
        mode: 'SIMPLE_ATR',
        atrPeriod: 7,
        atrMultiplier: 1.0,
        preset: 'agressivo'
      },
      personalizado: {
        ...atrConfig,
        preset: 'personalizado'
      }
    };

    setAtrConfig(configs[preset]);
    toast.success(`Preset "${preset}" aplicado com sucesso!`, {
      description: `ATR ${configs[preset].atrMultiplier}x • Período ${configs[preset].atrPeriod}`,
      duration: 3000
    });
  };

  // ✅ Salvar configurações
  const saveSettings = () => {
    // TODO: Integrar com backend para persistir configurações
    localStorage.setItem('atr-config', JSON.stringify(atrConfig));
    
    toast.success('Configurações salvas!', {
      description: `ATR Trailing Stop configurado: ${atrConfig.preset}`,
      duration: 3000,
      icon: <Check className="w-4 h-4" />
    });
    
    setShowSettingsModal(false);
  };

  const toggleTool = (toolId: string) => {
    setTools(prev => prev.map(tool => 
      tool.id === toolId 
        ? { ...tool, enabled: !tool.enabled, status: !tool.enabled ? 'active' : 'idle' }
        : tool
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
      case 'processing': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'idle': return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
      default: return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'processing': return 'Processando';
      case 'idle': return 'Pausado';
      default: return 'Desconhecido';
    }
  };

  // ✅ Carregar configurações do localStorage
  useEffect(() => {
    const savedAtrConfig = localStorage.getItem('atr-config');
    if (savedAtrConfig) {
      setAtrConfig(JSON.parse(savedAtrConfig));
    }

    const savedPyramidingConfig = localStorage.getItem('pyramiding-config');
    if (savedPyramidingConfig) {
      setPyramidingConfig(JSON.parse(savedPyramidingConfig));
    }
  }, []);

  return (
    <Card className="p-4 bg-gradient-to-br from-slate-900/50 via-slate-900/50 to-purple-900/10 border-slate-800/50">
      {/* Header Compacto - Horizontal */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Brain className="w-4 h-4 text-purple-400/80" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-200">AI Trading Tools</h3>
            <p className="text-[10px] text-slate-500">Painel de Controle Centralizado</p>
          </div>
        </div>

        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
          <Activity className="w-3 h-3 mr-1 animate-pulse" />
          {tools.filter(t => t.enabled).length} de {tools.length} Ativas
        </Badge>
      </div>

      {/* Tools - Layout Horizontal Compacto */}
      {tools.map(tool => {
        const Icon = tool.icon;
        
        return (
          <div
            key={tool.id}
            className={`
              p-3 rounded-xl border-2 transition-all
              flex items-center gap-4
              ${tool.enabled 
                ? 'bg-slate-800/30 border-purple-500/30 shadow-lg shadow-purple-500/10' 
                : 'bg-slate-900/30 border-slate-700/30'
              }
            `}
          >
            {/* Ícone + Nome (Left) */}
            <div className="flex items-center gap-3 min-w-[200px]">
              <div className={`
                p-2 rounded-lg transition-all flex-shrink-0
                ${tool.enabled 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'bg-slate-700/30 text-slate-500'
                }
              `}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm leading-tight">{tool.name}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{tool.description}</p>
              </div>
            </div>

            {/* Status Badge (Center-Left) */}
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] ${getStatusColor(tool.status)}`}>
                {tool.status === 'active' && <Zap className="w-3 h-3 mr-1" />}
                {getStatusText(tool.status)}
              </Badge>
            </div>

            {/* Métricas Horizontais (Center) */}
            {tool.enabled && tool.metrics && (
              <div className="flex items-center gap-4 flex-1">
                {tool.metrics.map((metric, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">{metric.label}</span>
                    <span className="font-mono font-bold text-sm text-white">{metric.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions (Right) */}
            <div className="flex items-center gap-2 ml-auto">
              <Switch
                checked={tool.enabled}
                onCheckedChange={() => toggleTool(tool.id)}
                className="data-[state=checked]:bg-purple-500"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[10px]"
                disabled={!tool.enabled}
                onClick={() => {
                  setSelectedTool(tool);
                  setShowDetailsModal(true);
                }}
              >
                <TrendingUp className="w-3 h-3 mr-1" />
                Detalhes
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-[10px]"
                disabled={!tool.enabled}
                onClick={() => {
                  setSelectedTool(tool);
                  setShowSettingsModal(true);
                }}
              >
                <Settings className="w-3 h-3" />
              </Button>
            </div>
          </div>
        );
      })}

      {/* Info Footer Compacto - Inline */}
      <div className="mt-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <Info className="w-3 h-3 text-blue-400 flex-shrink-0" />
          <span>
            <strong>Detector de Liquidez:</strong> Disponível na sidebar do Gráfico • 
            <strong className="ml-1">ATR Trailing Stop:</strong> Protege lucros automaticamente
          </span>
        </div>
      </div>

      {/* Modal de Detalhes - FULL WIDTH para ATR Manager */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {selectedTool?.name} - Detalhes Completos
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Gerenciamento completo de trailing stops baseados em ATR
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {/* ATR Manager Completo */}
          {selectedTool?.id === 'atr-trailing-stop' && (
            <div className="mt-4">
              <ATRTrailingStopManager />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Configurações - Settings Específicos */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="sm:max-w-[600px] bg-slate-950 border-slate-800">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Settings className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <DialogTitle>
                  Configurações: {selectedTool?.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Ajuste os parâmetros da ferramenta
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {selectedTool?.id === 'atr-trailing-stop' && (
            <div className="mt-6 space-y-6">
              {/* Quick Settings */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">
                    Status da Ferramenta
                  </label>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                    <div>
                      <p className="text-sm font-medium">Ativar ATR Trailing Stop</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Protege lucros automaticamente em todas as posições
                      </p>
                    </div>
                    <Switch
                      checked={selectedTool.enabled}
                      onCheckedChange={() => toggleTool(selectedTool.id)}
                      className="data-[state=checked]:bg-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">
                    Configurações Rápidas
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className={`h-auto py-3 flex flex-col items-start gap-1 transition-all relative ${
                        atrConfig.preset === 'conservador' 
                          ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20' 
                          : 'border-slate-800 hover:border-purple-500/50 bg-slate-900/50'
                      }`}
                      onClick={() => applyPreset('conservador')}
                    >
                      {atrConfig.preset === 'conservador' && (
                        <Check className="w-4 h-4 text-purple-400 absolute top-2 right-2" />
                      )}
                      <span className="text-xs font-bold">🛡️ Conservador</span>
                      <span className="text-[10px] text-slate-400">ATR 2.0x • Período 14</span>
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-auto py-3 flex flex-col items-start gap-1 transition-all relative ${
                        atrConfig.preset === 'balanceado' 
                          ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20' 
                          : 'border-slate-800 hover:border-purple-500/50 bg-slate-900/50'
                      }`}
                      onClick={() => applyPreset('balanceado')}
                    >
                      {atrConfig.preset === 'balanceado' && (
                        <Check className="w-4 h-4 text-purple-400 absolute top-2 right-2" />
                      )}
                      <span className="text-xs font-bold">⚖️ Balanceado</span>
                      <span className="text-[10px] text-slate-400">ATR 1.5x • Período 14</span>
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-auto py-3 flex flex-col items-start gap-1 transition-all relative ${
                        atrConfig.preset === 'agressivo' 
                          ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20' 
                          : 'border-slate-800 hover:border-purple-500/50 bg-slate-900/50'
                      }`}
                      onClick={() => applyPreset('agressivo')}
                    >
                      {atrConfig.preset === 'agressivo' && (
                        <Check className="w-4 h-4 text-purple-400 absolute top-2 right-2" />
                      )}
                      <span className="text-xs font-bold">⚡ Agressivo</span>
                      <span className="text-[10px] text-slate-400">ATR 1.0x • Período 7</span>
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-auto py-3 flex flex-col items-start gap-1 transition-all relative ${
                        atrConfig.preset === 'personalizado' 
                          ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20' 
                          : 'border-slate-800 hover:border-purple-500/50 bg-slate-900/50'
                      }`}
                      onClick={() => setShowDetailsModal(true)}
                    >
                      {atrConfig.preset === 'personalizado' && (
                        <Check className="w-4 h-4 text-purple-400 absolute top-2 right-2" />
                      )}
                      <span className="text-xs font-bold">🎯 Personalizado</span>
                      <span className="text-[10px] text-slate-400">Configurar manualmente</span>
                    </Button>
                  </div>

                  {/* Config Atual */}
                  <div className="mt-3 p-3 rounded-lg bg-slate-900/70 border border-slate-700">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Configuração Atual:</span>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                          {atrConfig.mode}
                        </Badge>
                        <span className="text-white font-mono">{atrConfig.atrMultiplier}x</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-white font-mono">{atrConfig.atrPeriod} períodos</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-slate-300">
                      <p className="font-semibold mb-1">Como funciona:</p>
                      <ul className="space-y-1 text-slate-400">
                        <li>• <strong>Conservador:</strong> Stop mais distante, menor risco de saída prematura</li>
                        <li>• <strong>Balanceado:</strong> Equilíbrio entre proteção e flexibilidade</li>
                        <li>• <strong>Agressivo:</strong> Stop mais próximo, protege lucros rapidamente</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsModal(true)}
                  className="flex-1 bg-slate-900/50 border-slate-800 hover:border-blue-500/50"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Ver Detalhes Completos
                </Button>
                <Button
                  onClick={saveSettings}
                  className="flex-1 bg-purple-500 hover:bg-purple-600"
                >
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}

          {/* ✅ PYRAMIDING SYSTEM CONFIGURATION */}
          {selectedTool?.id === 'pyramiding' && (
            <div className="mt-6">
              <PyramidingConfigPanel
                config={pyramidingConfig}
                onChange={(newConfig) => {
                  setPyramidingConfig(newConfig);
                  // Salvar automaticamente no localStorage
                  localStorage.setItem('pyramiding-config', JSON.stringify(newConfig));
                  toast.success('Configuração do Pyramiding atualizada!', {
                    description: `${newConfig.maxLayers} camadas • ${newConfig.scalingStrategy}`,
                    duration: 2000
                  });
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}