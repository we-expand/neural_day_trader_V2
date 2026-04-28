import React, { useState } from 'react';
import { Beaker, Brain, Zap, TrendingUp, Activity, Lock, Unlock, Play, Pause, Settings, BarChart3, AlertCircle, CheckCircle, Cpu } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { toast } from 'sonner';

interface AIModel {
  id: string;
  name: string;
  description: string;
  status: 'training' | 'ready' | 'testing' | 'deployed';
  accuracy: number;
  version: string;
  lastTrained: string;
  trades: number;
  winRate: number;
  icon: any;
}

const models: AIModel[] = [
  {
    id: 'neural-scalper',
    name: 'Neural Scalper v3.2',
    description: 'Modelo especializado em operações rápidas (scalping) em forex e cripto',
    status: 'deployed',
    accuracy: 94.2,
    version: '3.2.1',
    lastTrained: '2h atrás',
    trades: 1842,
    winRate: 87.3,
    icon: Zap
  },
  {
    id: 'trend-follower',
    name: 'Trend Follower AI',
    description: 'Identificação automática de tendências de médio/longo prazo',
    status: 'ready',
    accuracy: 89.7,
    version: '2.1.0',
    lastTrained: '1 dia atrás',
    trades: 623,
    winRate: 82.1,
    icon: TrendingUp
  },
  {
    id: 'reversal-detector',
    name: 'Reversal Detector Pro',
    description: 'Detecta reversões de mercado usando padrões de volume e price action',
    status: 'training',
    accuracy: 76.4,
    version: '1.8.3-beta',
    lastTrained: 'Treinando...',
    trades: 0,
    winRate: 0,
    icon: Activity
  },
  {
    id: 'sentiment-analyzer',
    name: 'Sentiment Analyzer',
    description: 'Análise de sentimento do mercado baseada em redes sociais e notícias',
    status: 'testing',
    accuracy: 81.2,
    version: '1.5.0',
    lastTrained: '6h atrás',
    trades: 234,
    winRate: 74.8,
    icon: Brain
  }
];

const experiments = [
  {
    id: 'exp-001',
    name: 'Multi-Timeframe Fusion',
    description: 'Combinação de sinais de 3 timeframes diferentes',
    progress: 67,
    status: 'running',
    eta: '2h 15min'
  },
  {
    id: 'exp-002',
    name: 'Order Flow Integration',
    description: 'Integração de dados de ordem de compra/venda institucional',
    progress: 34,
    status: 'running',
    eta: '5h 42min'
  },
  {
    id: 'exp-003',
    name: 'Volatility Prediction',
    description: 'Previsão de volatilidade usando LSTM networks',
    progress: 92,
    status: 'finalizing',
    eta: '28min'
  }
];

export function NeuralLab() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ready': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'training': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'testing': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'deployed': return 'Em Produção';
      case 'ready': return 'Pronto';
      case 'training': return 'Treinando';
      case 'testing': return 'Testando';
      default: return status;
    }
  };

  const handleDeploy = (modelId: string) => {
    toast.success('Modelo implantado com sucesso!', {
      description: `O modelo ${models.find(m => m.id === modelId)?.name} está agora ativo.`,
      duration: 3000
    });
  };

  const handleTest = (modelId: string) => {
    toast.info('Iniciando testes...', {
      description: `Executando backtesting no modelo ${models.find(m => m.id === modelId)?.name}`,
      duration: 3000
    });
  };

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex-none bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <Beaker className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white uppercase flex items-center gap-3">
              Laboratório Neural
              <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold">
                EXPERIMENTAL
              </Badge>
            </h1>
            <p className="text-slate-400 mt-1 tracking-wide font-light">
              Desenvolvimento e Teste de Modelos de IA Proprietários
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
          {/* Main Content - Models */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-400" />
                Modelos de IA
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {models.map((model, index) => (
                  <motion.div
                    key={model.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className={`h-full bg-neutral-950/50 border backdrop-blur-sm hover:bg-white/5 transition-all cursor-pointer ${
                      selectedModel === model.id ? 'border-purple-500/50 shadow-lg shadow-purple-500/20' : 'border-white/10'
                    }`}
                    onClick={() => setSelectedModel(model.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <model.icon className="w-5 h-5 text-purple-400" />
                          </div>
                          <Badge className={`text-[10px] font-bold uppercase ${getStatusColor(model.status)}`}>
                            {getStatusLabel(model.status)}
                          </Badge>
                        </div>
                        <CardTitle className="text-base text-white">
                          {model.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-400 line-clamp-2">
                          {model.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-black/40 rounded-lg p-2 border border-white/5">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Precisão</p>
                            <p className="text-lg font-bold text-emerald-400">{model.accuracy}%</p>
                          </div>
                          <div className="bg-black/40 rounded-lg p-2 border border-white/5">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Win Rate</p>
                            <p className="text-lg font-bold text-cyan-400">{model.winRate}%</p>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="space-y-1 pt-2 border-t border-white/5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Versão:</span>
                            <span className="text-white font-mono">{model.version}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Trades:</span>
                            <span className="text-white font-bold">{model.trades.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Última Atualização:</span>
                            <span className="text-white">{model.lastTrained}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          {model.status === 'deployed' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
                              onClick={(e) => { e.stopPropagation(); toast.info('Modelo pausado'); }}
                            >
                              <Pause className="w-3 h-3 mr-1" />
                              Pausar
                            </Button>
                          ) : model.status === 'ready' ? (
                            <Button
                              size="sm"
                              className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500"
                              onClick={(e) => { e.stopPropagation(); handleDeploy(model.id); }}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Implantar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                              disabled
                            >
                              {model.status === 'training' ? 'Treinando...' : 'Testando...'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="px-3 text-xs"
                            onClick={(e) => { e.stopPropagation(); handleTest(model.id); }}
                          >
                            <BarChart3 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Experiments */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-yellow-400" />
                Experimentos em Andamento
              </h2>
              <div className="space-y-3">
                {experiments.map((exp, index) => (
                  <motion.div
                    key={exp.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="bg-neutral-950/50 border-white/10 backdrop-blur-sm hover:bg-white/5 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-sm font-bold text-white mb-1">{exp.name}</h3>
                            <p className="text-xs text-slate-400">{exp.description}</p>
                          </div>
                          <Badge className={`text-[10px] font-bold uppercase ml-2 ${
                            exp.status === 'finalizing' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {exp.status === 'finalizing' ? 'Finalizando' : 'Em Execução'}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Progresso</span>
                            <span className="text-white font-bold">{exp.progress}%</span>
                          </div>
                          <Progress value={exp.progress} className="h-2" />
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">ETA:</span>
                            <span className="text-white font-mono">{exp.eta}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - Info */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-purple-900/20 to-black border-purple-500/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  Status do Laboratório
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">GPU Cluster</span>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                    ONLINE
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Modelos Ativos</span>
                  <span className="text-sm font-bold text-white">1/4</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Experimentos</span>
                  <span className="text-sm font-bold text-white">3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Utilização GPU</span>
                  <span className="text-sm font-bold text-yellow-400">67%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-900/20 to-black border-cyan-500/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-cyan-400" />
                  Próximas Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                    AutoML para otimização automática
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                    Ensemble de modelos
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                    Transfer Learning
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                    Reinforcement Learning
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-900/20 to-black border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                  Avisos Importantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Modelos em fase experimental não devem ser usados com capital real. 
                  Sempre realize backtesting completo antes de implantação.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
