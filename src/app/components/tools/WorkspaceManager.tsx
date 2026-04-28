import React, { useState, useEffect } from 'react';
import { FolderOpen, Save, Trash2, Check, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { AIConfig } from '../../hooks/useApexLogic';
import { SmartScrollContainer } from '@/app/components/SmartScrollContainer';

export interface Workspace {
    id: string;
    name: string;
    config: AIConfig;
    uiPreferences: {
        showEquityChart: boolean;
        activeTab?: string;
    };
    createdAt: number;
}

export function useWorkspaces() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('apex_workspaces_v2');
        if (saved) {
            try {
                setWorkspaces(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load workspaces", e);
            }
        } else {
            // Migration from v1 profiles if exists
            const v1 = localStorage.getItem('apex_saved_profiles_v1');
            if (v1) {
                try {
                    const profiles = JSON.parse(v1);
                    const migrated: Workspace[] = profiles.map((p: any) => ({
                        id: crypto.randomUUID(),
                        name: p.name,
                        config: p.config,
                        uiPreferences: { showEquityChart: false },
                        createdAt: Date.now()
                    }));
                    setWorkspaces(migrated);
                    localStorage.setItem('apex_workspaces_v2', JSON.stringify(migrated));
                } catch(e) {}
            }
        }
    }, []);

    const saveWorkspace = (name: string, config: AIConfig, uiPreferences: any) => {
        const newWs: Workspace = {
            id: crypto.randomUUID(),
            name,
            config,
            uiPreferences,
            createdAt: Date.now()
        };
        const updated = [...workspaces, newWs];
        setWorkspaces(updated);
        localStorage.setItem('apex_workspaces_v2', JSON.stringify(updated));
        toast.success(`Workspace "${name}" salvo!`);
    };

    const deleteWorkspace = (id: string) => {
        const updated = workspaces.filter(w => w.id !== id);
        setWorkspaces(updated);
        localStorage.setItem('apex_workspaces_v2', JSON.stringify(updated));
        toast.success("Workspace removido.");
    };

    return { workspaces, saveWorkspace, deleteWorkspace };
}

interface WorkspaceSelectorProps {
    workspaces: Workspace[];
    currentConfig: AIConfig;
    onLoad: (ws: Workspace) => void;
    onSave: (name: string) => void;
    onDelete: (id: string) => void;
}

export function WorkspaceSelector({ workspaces, currentConfig, onLoad, onSave, onDelete }: WorkspaceSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newName, setNewName] = useState('');

    const handleSave = () => {
        if(newName.trim()) {
            onSave(newName);
            setNewName('');
            setIsOpen(false);
        }
    };

    const handleLoad = (ws: Workspace) => {
        onLoad(ws);
        setIsOpen(false);
    };

    return (
        <>
            {/* Overlay - close on click outside */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-[9997] backdrop-blur-sm" 
                    onClick={() => setIsOpen(false)} 
                />
            )}

            <div className="relative">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all"
                    title="Workspaces"
                >
                    <LayoutTemplate className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Workspace</span>
                </button>

                {isOpen && (
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-[9998] p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-purple-400" /> Gerenciar Workspaces
                        </h3>

                        {/* Save Current */}
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Nome do Workspace..."
                                className="flex-1 bg-black border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newName.trim()) {
                                        handleSave();
                                    }
                                }}
                            />
                            <button 
                                onClick={handleSave}
                                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded border border-emerald-500/20"
                            >
                                <Save className="w-4 h-4" />
                            </button>
                        </div>

                        {/* List */}
                        <SmartScrollContainer className="space-y-2 max-h-[300px] pr-1">
                            {workspaces.length === 0 ? (
                                <div className="text-center py-6 border border-dashed border-white/10 rounded bg-white/5">
                                    <p className="text-xs text-slate-500 mb-1">Nenhum workspace salvo.</p>
                                    <p className="text-[10px] text-slate-600">Configure a IA e clique em salvar acima.</p>
                                </div>
                            ) : (
                                workspaces.map(ws => (
                                    <div key={ws.id} className="group flex items-center justify-between p-3 rounded hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors cursor-pointer" onClick={() => { handleLoad(ws); }}>
                                        <div className="flex flex-col flex-1">
                                            <span className="text-sm font-bold text-slate-300 group-hover:text-white">{ws.name}</span>
                                            <span className="text-[9px] text-slate-600 font-mono">
                                                Criado em {new Date(ws.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDelete(ws.id); }}
                                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </SmartScrollContainer>
                    </div>
                )}
            </div>
        </>
    );
}