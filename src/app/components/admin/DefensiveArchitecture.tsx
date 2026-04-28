import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, AlertTriangle, CheckCircle, Activity, Zap, Lock, ShieldCheck, AlertOctagon, Radio, Wifi, WifiOff, Server, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';

interface ProtectionLayer {
  id: string;
  name: string;
  status: 'active' | 'warning' | 'error' | 'inactive';
  description: string;
  metrics: {
    blocked: number;
    allowed: number;
    uptime: number;
  };
}

const protectionLayers: ProtectionLayer[] = [
  {
    id: 'layer1',
    name: 'Firewall Perimetral',
    status: 'active',
    description: 'Proteção de borda contra ataques DDoS e SQL Injection',
    metrics: { blocked: 1847, allowed: 98234, uptime: 99.9 }
  },
  {
    id: 'layer2',
    name: 'WAF (Web Application Firewall)',
    status: 'active',
    description: 'Filtragem de requisições maliciosas e XSS',
    metrics: { blocked: 423, allowed: 94521, uptime: 99.8 }
  },
  {
    id: 'layer3',
    name: 'Rate Limiting',
    status: 'active',
    description: 'Controle de taxa de requisições por usuário/IP',
    metrics: { blocked: 2341, allowed: 89234, uptime: 100 }
  },
  {
    id: 'layer4',
    name: 'Input Validation',
    status: 'active',
    description: 'Validação de todos os inputs do usuário',
    metrics: { blocked: 156, allowed: 99876, uptime: 100 }
  },
  {
    id: 'layer5',
    name: 'Encryption Layer',
    status: 'active',
    description: 'Criptografia end-to-end de dados sensíveis',
    metrics: { blocked: 0, allowed: 100000, uptime: 100 }
  }
];

const emergencyControls = [
  { id: 'lockdown', label: 'Modo Lockdown', description: 'Bloqueia todas as operações não críticas', active: false },
  { id: 'maintenance', label: 'Modo Manutenção', description: 'Exibe página de manutenção', active: false },
  { id: 'readonly', label: 'Modo Leitura', description: 'Desabilita todas as escritas', active: false },
  { id: 'emergency', label: 'Desligamento Emergencial', description: 'Para todos os serviços', active: false }
];

interface SystemMetric {
  name: string;
  value: number;
  threshold: number;
  status: 'ok' | 'warning' | 'critical';
}

const systemMetrics: SystemMetric[] = [
  { name: 'CPU Usage', value: 34, threshold: 80, status: 'ok' },
  { name: 'Memory Usage', value: 62, threshold: 85, status: 'ok' },
  { name: 'Disk I/O', value: 45, threshold: 90, status: 'ok' },
  { name: 'Network Traffic', value: 28, threshold: 75, status: 'ok' },
  { name: 'Database Connections', value: 156, threshold: 500, status: 'ok' },
  { name: 'API Response Time', value: 42, threshold: 200, status: 'ok' }
];

export function DefensiveArchitecture() {
  const [layers, setLayers] = useState(protectionLayers);
  const [controls, setControls] = useState(emergencyControls);
  const [metrics] = useState(systemMetrics);
  const [autoHeal, setAutoHeal] = useState(true);
  const [threatLevel, setThreatLevel] = useState<'low' | 'medium' | 'high'>('low');

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setLayers(prev => prev.map(layer => ({
        ...layer,
        metrics: {
          ...layer.metrics,
          blocked: layer.metrics.blocked + Math.floor(Math.random() * 5),
          allowed: layer.metrics.allowed + Math.floor(Math.random() * 100)
        }
      })));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'warning': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'error': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'inactive': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getMetricStatus = (metric: SystemMetric) => {
    const percentage = (metric.value / metric.threshold) * 100;
    if (percentage >= 90) return 'critical';
    if (percentage >= 70) return 'warning';
    return 'ok';
  };

  const toggleControl = (id: string) => {
    setControls(prev => prev.map(ctrl => 
      ctrl.id === id ? { ...ctrl, active: !ctrl.active } : ctrl
    ));
    toast.success(`Controle ${controls.find(c => c.id === id)?.label} ${controls.find(c => c.id === id)?.active ? 'desativado' : 'ativado'}`);
  };

  const totalBlocked = layers.reduce((acc, layer) => acc + layer.metrics.blocked, 0);
  const totalAllowed = layers.reduce((acc, layer) => acc + layer.metrics.allowed, 0);
  const blockRate = ((totalBlocked / (totalBlocked + totalAllowed)) * 100).toFixed(2);

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Arquitetura Defensiva</h1>
            <p className="text-slate-400 text-sm">Sistema de Proteção Multi-Camadas</p>
          </div>
        </div>
        <Badge className={`px-4 py-2 text-sm font-bold ${
          threatLevel === 'low' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          threatLevel === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
          'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
          Nível de Ameaça: {threatLevel.toUpperCase()}
        </Badge>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-950/50 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Bloqueadas</p>
                <p className="text-2xl font-bold text-red-400">{totalBlocked.toLocaleString()}</p>
              </div>
              <AlertOctagon className="w-8 h-8 text-red-400/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-950/50 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Permitidas</p>
                <p className="text-2xl font-bold text-emerald-400">{totalAllowed.toLocaleString()}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-950/50 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Taxa de Bloqueio</p>
                <p className="text-2xl font-bold text-yellow-400">{blockRate}%</p>
              </div>
              <Activity className="w-8 h-8 text-yellow-400/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-950/50 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Auto-Heal</p>
                <p className="text-2xl font-bold text-cyan-400">{autoHeal ? 'Ativo' : 'Inativo'}</p>
              </div>
              <Zap className="w-8 h-8 text-cyan-400/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Protection Layers */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            Camadas de Proteção
          </h2>
          {layers.map((layer, index) => (
            <motion.div
              key={layer.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-neutral-950/50 border-white/10 hover:border-purple-500/30 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <Shield className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-sm text-white">{layer.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">{layer.description}</CardDescription>
                      </div>
                    </div>
                    <Badge className={`text-xs font-bold ${getStatusColor(layer.status)}`}>
                      {layer.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Bloqueadas</p>
                      <p className="text-sm font-bold text-red-400">{layer.metrics.blocked}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Permitidas</p>
                      <p className="text-sm font-bold text-emerald-400">{layer.metrics.allowed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Uptime</p>
                      <p className="text-sm font-bold text-cyan-400">{layer.metrics.uptime}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Sidebar - Emergency Controls & Metrics */}
        <div className="space-y-6">
          {/* Emergency Controls */}
          <Card className="bg-gradient-to-br from-red-900/20 to-black border-red-500/30">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Controles de Emergência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {controls.map((control) => (
                <div key={control.id} className="p-3 bg-black/40 rounded-lg border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-white">{control.label}</p>
                    <button
                      onClick={() => toggleControl(control.id)}
                      className={`w-10 h-5 rounded-full transition-all ${
                        control.active ? 'bg-red-500' : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                        control.active ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">{control.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* System Metrics */}
          <Card className="bg-neutral-950/50 border-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Métricas do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.map((metric) => (
                <div key={metric.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{metric.name}</span>
                    <span className={`font-bold ${
                      getMetricStatus(metric) === 'critical' ? 'text-red-400' :
                      getMetricStatus(metric) === 'warning' ? 'text-yellow-400' :
                      'text-emerald-400'
                    }`}>
                      {metric.name.includes('Time') ? `${metric.value}ms` : `${metric.value}${metric.name.includes('Usage') ? '%' : ''}`}
                    </span>
                  </div>
                  <Progress 
                    value={(metric.value / metric.threshold) * 100} 
                    className="h-1.5"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
