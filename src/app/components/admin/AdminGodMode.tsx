import React, { useEffect, useState } from 'react';
import { projectId } from '../../../../utils/supabase/info';
import { Shield, MapPin, Smartphone, Globe, Clock, User, X, Wifi, Monitor } from 'lucide-react';
import { motion } from 'motion/react';

interface AccessLog {
    id: string;
    timestamp: string;
    user_email: string;
    ip: string;
    city: string;
    region: string;
    country: string;
    provider: string;
    device: {
        os: string;
        browser: string;
        screen: string;
        connection: string;
        language: string;
    }
}

export function AdminGodMode({ onClose }: { onClose: () => void }) {
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                // Busca logs via Server API
                const response = await fetch(`https://${projectId}.supabase.co/functions/v1/server/telemetry/logs`);
                const { logs: data } = await response.json();
                
                if (Array.isArray(data)) {
                    const sortedLogs = (data as AccessLog[]).sort((a, b) => 
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );
                    setLogs(sortedLogs);
                }
            } catch (e) {
                console.error("Erro ao buscar logs admin:", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-6xl h-[80vh] bg-[#050505] border border-red-500/30 rounded-lg shadow-[0_0_50px_rgba(239,68,68,0.2)] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-red-900/30 bg-red-950/10">
                    <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6 text-red-500 animate-pulse" />
                        <div>
                            <h2 className="text-xl font-bold text-red-500 tracking-wider">GOD MODE // ADMIN ACCESS</h2>
                            <p className="text-[10px] text-red-400/60 uppercase">Monitoramento de Tráfego Global</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-red-500/20 rounded-full text-red-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-red-900/50 scrollbar-track-transparent">
                    
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                            <p className="text-red-500/50 font-mono text-sm animate-pulse">Descriptografando logs de acesso...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {logs.length === 0 ? (
                                <div className="text-center text-slate-500 py-20 font-mono">
                                    Nenhum dado capturado ainda. O sistema está aguardando alvos.
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <motion.div 
                                        key={log.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white/5 border border-white/5 rounded p-4 hover:border-red-500/30 transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity">
                                            <Shield className="w-16 h-16 text-red-500 rotate-12" />
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-6 relative z-10">
                                            
                                            {/* User Info */}
                                            <div className="flex-1 min-w-[200px]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <User className="w-4 h-4 text-red-400" />
                                                    <span className="text-sm font-bold text-white">{log.user_email}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                                                </div>
                                                <div className="mt-3 px-2 py-1 bg-red-500/10 rounded border border-red-500/20 w-fit text-[10px] text-red-400 font-mono">
                                                    ID: {log.user_id.slice(0, 8)}...
                                                </div>
                                            </div>

                                            {/* Geo Location */}
                                            <div className="flex-1 border-l border-white/5 pl-6">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Globe className="w-4 h-4 text-blue-400" />
                                                    <span className="text-sm font-bold text-slate-200">Localização</span>
                                                </div>
                                                <div className="space-y-1 text-xs text-slate-400 font-mono">
                                                    <div className="flex justify-between">
                                                        <span>IP:</span>
                                                        <span className="text-white">{log.ip}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Cidade:</span>
                                                        <span className="text-white">{log.city}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Região:</span>
                                                        <span className="text-white">{log.region}, {log.country}</span>
                                                    </div>
                                                    <div className="flex justify-between border-t border-white/5 mt-1 pt-1">
                                                        <span>ISP:</span>
                                                        <span className="text-emerald-400">{log.provider}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Device Info */}
                                            <div className="flex-1 border-l border-white/5 pl-6">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Monitor className="w-4 h-4 text-purple-400" />
                                                    <span className="text-sm font-bold text-slate-200">Dispositivo</span>
                                                </div>
                                                <div className="space-y-1 text-xs text-slate-400 font-mono">
                                                    <div className="flex justify-between">
                                                        <span>OS:</span>
                                                        <span className="text-white truncate max-w-[150px]">{log.device?.os}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Resolução:</span>
                                                        <span className="text-white">{log.device?.screen}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Conexão:</span>
                                                        <span className="text-white uppercase">{log.device?.connection}</span>
                                                    </div>
                                                    <div className="flex justify-between mt-1">
                                                        <span className="truncate max-w-[200px] text-[10px] italic opacity-50">{log.device?.browser}</span>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-2 bg-red-950/20 border-t border-red-900/30 text-[10px] text-red-500/50 font-mono flex justify-between">
                    <span>SECURE CONNECTION ESTABLISHED</span>
                    <span>LOGS ENCRYPTED</span>
                </div>
            </motion.div>
        </div>
    );
}
