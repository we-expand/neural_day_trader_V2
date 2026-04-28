/**
 * 🗄️ DEV LAB - ZUSTAND STORE
 * State management com persistência em localStorage
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Suggestion, Category, Impact, Effort } from '@/types/devlab';

interface DevLabState {
  suggestions: Suggestion[];
  
  // CRUD operations
  addSuggestion: (suggestion: Omit<Suggestion, 'id' | 'createdAt' | 'status'>) => void;
  markAsCompleted: (id: string) => void;
  markAsTrash: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  permanentDelete: (id: string) => void;
  updateSuggestion: (id: string, updates: Partial<Suggestion>) => void;
}

// 📦 Sugestões iniciais pré-populadas
const initialSuggestions: Suggestion[] = [
  // TECH
  {
    id: crypto.randomUUID(),
    title: 'Websocket Real-Time para Preços',
    description: 'Implementar conexão websocket para atualização de preços em tempo real sem polling',
    category: 'TECH',
    tags: ['performance', 'real-time', 'websocket'],
    impact: 'HIGH',
    effort: 'MEDIUM',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Cache Redis para Performance',
    description: 'Adicionar camada de cache Redis para reduzir latência em consultas frequentes',
    category: 'TECH',
    tags: ['performance', 'cache', 'backend'],
    impact: 'HIGH',
    effort: 'HIGH',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Audit Logs Imutáveis',
    description: 'Sistema de logs imutáveis para compliance e rastreabilidade de todas as operações',
    category: 'TECH',
    tags: ['security', 'compliance', 'audit'],
    impact: 'HIGH',
    effort: 'MEDIUM',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Webhooks Bidirecionais',
    description: 'Sistema de webhooks para integração com sistemas externos (entrada e saída)',
    category: 'TECH',
    tags: ['integration', 'api', 'webhooks'],
    impact: 'HIGH',
    effort: 'MEDIUM',
    status: 'active',
    createdAt: new Date().toISOString(),
  },

  // DESIGN_UX
  {
    id: crypto.randomUUID(),
    title: 'Modo Escuro (Dark Mode)',
    description: 'Implementar tema dark mode para reduzir fadiga visual em uso prolongado',
    category: 'DESIGN_UX',
    tags: ['ui', 'accessibility', 'theme'],
    impact: 'MEDIUM',
    effort: 'MEDIUM',
    status: 'completed',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Command Palette (Cmd+K)',
    description: 'Paleta de comandos para navegação rápida e ações via teclado',
    category: 'DESIGN_UX',
    tags: ['ux', 'keyboard', 'navigation'],
    impact: 'MEDIUM',
    effort: 'MEDIUM',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Onboarding Interativo',
    description: 'Tour guiado para novos usuários com tooltips e highlights',
    category: 'DESIGN_UX',
    tags: ['onboarding', 'ux', 'tutorial'],
    impact: 'HIGH',
    effort: 'MEDIUM',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Gráficos Interativos 3D',
    description: 'Visualização 3D de performance e métricas com Three.js',
    category: 'DESIGN_UX',
    tags: ['charts', '3d', 'visualization'],
    impact: 'LOW',
    effort: 'HIGH',
    status: 'active',
    createdAt: new Date().toISOString(),
  },

  // FEATURE
  {
    id: crypto.randomUUID(),
    title: 'Copy Trading Automático',
    description: 'Permitir copiar trades de outros usuários automaticamente',
    category: 'FEATURE',
    tags: ['trading', 'social', 'automation'],
    impact: 'HIGH',
    effort: 'HIGH',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'White-label Completo',
    description: 'Sistema white-label para parceiros criarem suas próprias plataformas',
    category: 'FEATURE',
    tags: ['b2b', 'customization', 'branding'],
    impact: 'HIGH',
    effort: 'MEDIUM',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Calculadora de Risco Avançada',
    description: 'Calculadora automática de position sizing baseada em risco máximo',
    category: 'FEATURE',
    tags: ['risk', 'calculator', 'trading'],
    impact: 'HIGH',
    effort: 'MEDIUM',
    status: 'completed',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Alertas Push Mobile',
    description: 'Notificações push para app mobile (iOS e Android)',
    category: 'FEATURE',
    tags: ['mobile', 'notifications', 'alerts'],
    impact: 'MEDIUM',
    effort: 'HIGH',
    status: 'active',
    createdAt: new Date().toISOString(),
  },

  // COMPETITION
  {
    id: crypto.randomUUID(),
    title: 'Calculadora de ROI no Site',
    description: 'Ferramenta pública de ROI para atrair leads qualificados',
    category: 'COMPETITION',
    tags: ['marketing', 'lead-gen', 'conversion'],
    impact: 'HIGH',
    effort: 'LOW',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Certificação ISO 27001',
    description: 'Obter certificação ISO 27001 para segurança da informação',
    category: 'COMPETITION',
    tags: ['compliance', 'security', 'certification'],
    impact: 'HIGH',
    effort: 'HIGH',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Integração Open Banking',
    description: 'Conectar com APIs de Open Banking para depósitos instantâneos',
    category: 'COMPETITION',
    tags: ['fintech', 'banking', 'integration'],
    impact: 'HIGH',
    effort: 'HIGH',
    status: 'active',
    createdAt: new Date().toISOString(),
  },

  // INNOVATION
  {
    id: crypto.randomUUID(),
    title: 'IA Preditiva Multimodal',
    description: 'Análise de sentimento em notícias + dados técnicos para previsões',
    category: 'INNOVATION',
    tags: ['ai', 'nlp', 'prediction'],
    impact: 'HIGH',
    effort: 'HIGH',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Blockchain para Auditoria',
    description: 'Registrar trades em blockchain para transparência total',
    category: 'INNOVATION',
    tags: ['blockchain', 'transparency', 'audit'],
    impact: 'MEDIUM',
    effort: 'HIGH',
    status: 'active',
    createdAt: new Date().toISOString(),
  },

  // BUG
  {
    id: crypto.randomUUID(),
    title: 'Fix: Cache do Navegador',
    description: 'Corrigir problema de cache persistente após deploy',
    category: 'BUG',
    tags: ['bug', 'cache', 'deploy'],
    impact: 'HIGH',
    effort: 'LOW',
    status: 'completed',
    createdAt: new Date().toISOString(),
  },

  // OPTIMIZATION
  {
    id: crypto.randomUUID(),
    title: 'Code Splitting Avançado',
    description: 'Implementar lazy loading e code splitting para reduzir bundle',
    category: 'OPTIMIZATION',
    tags: ['performance', 'bundle', 'optimization'],
    impact: 'MEDIUM',
    effort: 'MEDIUM',
    status: 'completed',
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Compressão de Imagens Automática',
    description: 'Pipeline automático de otimização de imagens no upload',
    category: 'OPTIMIZATION',
    tags: ['performance', 'images', 'automation'],
    impact: 'MEDIUM',
    effort: 'LOW',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
];

export const useDevLabStore = create<DevLabState>()(
  persist(
    (set) => ({
      suggestions: initialSuggestions,

      addSuggestion: (suggestion) => set((state) => ({
        suggestions: [
          ...state.suggestions,
          {
            ...suggestion,
            id: crypto.randomUUID(),
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        ],
      })),

      markAsCompleted: (id) => set((state) => ({
        suggestions: state.suggestions.map(s =>
          s.id === id ? { ...s, status: 'completed' as const } : s
        ),
      })),

      markAsTrash: (id) => set((state) => ({
        suggestions: state.suggestions.map(s =>
          s.id === id ? { ...s, status: 'trash' as const } : s
        ),
      })),

      restoreFromTrash: (id) => set((state) => ({
        suggestions: state.suggestions.map(s =>
          s.id === id ? { ...s, status: 'active' as const } : s
        ),
      })),

      permanentDelete: (id) => set((state) => ({
        suggestions: state.suggestions.filter(s => s.id !== id),
      })),

      updateSuggestion: (id, updates) => set((state) => ({
        suggestions: state.suggestions.map(s =>
          s.id === id ? { ...s, ...updates } : s
        ),
      })),
    }),
    {
      name: 'devlab-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
