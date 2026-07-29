import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, CheckCircle, ShieldCheck, AlertOctagon, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

interface ProtectionLayer {
  id: string;
  name: string;
  status: 'implemented' | 'planned';
  description: string;
}

// Lista descreve o que de fato existe no código hoje (ver CLAUDE.md, seção
// "Segurança"). Nenhuma contagem/uptime é exibida aqui porque não há
// telemetria real por trás — mostrar números exigiria fabricar dado.
const protectionLayers: ProtectionLayer[] = [
  {
    id: 'rls',
    name: 'Row Level Security (Supabase)',
    status: 'implemented',
    description: 'RLS habilitado em todas as tabelas (ai_sessions, ai_trades, ai_portfolio_snapshots, broker_credentials) — auth.uid() = user_id.'
  },
  {
    id: 'broker-token',
    name: 'Criptografia de credenciais de corretora',
    status: 'implemented',
    description: 'Token MetaAPI nunca fica no client — armazenado criptografado em broker_credentials, acessível só pela Edge Function.'
  },
  {
    id: 'admin-gate',
    name: 'Gate de acesso admin',
    status: 'implemented',
    description: 'Telas administrativas (esta incluída) atrás de checagem isAdmin — não visível para cliente pagante.'
  },
  {
    id: 'rate-limit',
    name: 'Rate limiting / WAF de borda',
    status: 'planned',
    description: 'Sem implementação própria hoje além do que a infraestrutura (Vercel/Supabase) oferece por padrão.'
  }
];

export function DefensiveArchitecture() {
  const [ackNote, setAckNote] = useState(false);

  return (
    <div className="space-y-6 p-6 h-full overflow-y-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Arquitetura Defensiva</h1>
            <p className="text-slate-400 text-sm">Estado real das proteções implementadas — sem métricas simuladas</p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-purple-400" />
          Camadas de Proteção
        </h2>
        {protectionLayers.map((layer, index) => (
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
                      {layer.status === 'implemented'
                        ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                        : <Clock className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div>
                      <CardTitle className="text-sm text-white">{layer.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">{layer.description}</CardDescription>
                    </div>
                  </div>
                  <Badge className={layer.status === 'implemented'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-bold'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20 text-xs font-bold'}>
                    {layer.status === 'implemented' ? 'IMPLEMENTADO' : 'PLANEJADO'}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        ))}

        <Card className="bg-neutral-950/50 border-white/10">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">
              Este painel não exibe contadores de bloqueio, uptime ou métricas de
              sistema (CPU/memória/rede) — a versão anterior mostrava esses
              números gerados aleatoriamente (Math.random), sem telemetria real
              por trás. Removidos em {new Date().toLocaleDateString('pt-BR')} para não
              apresentar dado fabricado como real.
              {ackNote ? null : (
                <button
                  className="ml-1 underline text-slate-300"
                  onClick={() => { setAckNote(true); toast.success('Registrado'); }}
                >
                  entendi
                </button>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
