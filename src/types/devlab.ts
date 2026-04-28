/**
 * 📋 DEV LAB - TYPE DEFINITIONS
 * Sistema de gestão de sugestões e inovação
 */

export type Category = 
  | 'TECH'           // Tecnologia/Backend
  | 'DESIGN_UX'      // Design e UX
  | 'FEATURE'        // Nova funcionalidade
  | 'COMPETITION'    // Vantagem competitiva
  | 'INNOVATION'     // Inovação
  | 'BUG'            // Correção de bug
  | 'OPTIMIZATION';  // Otimização

export type Impact = 'HIGH' | 'MEDIUM' | 'LOW';
export type Effort = 'HIGH' | 'MEDIUM' | 'LOW';
export type SuggestionStatus = 'active' | 'completed' | 'trash';

export interface Suggestion {
  id: string;                    // UUID único
  title: string;                 // Título curto
  description: string;           // Descrição breve
  category: Category;            // Categoria
  tags: string[];               // Tags livres
  impact: Impact;               // Impacto no negócio
  effort: Effort;               // Esforço de implementação
  status: SuggestionStatus;     // Status atual
  fullAnalysis?: string;        // Análise técnica detalhada (opcional)
  createdAt: string;            // ISO date string
}

export const CATEGORY_CONFIG: Record<Category, { label: string; color: string }> = {
  TECH: { label: 'Tecnologia', color: 'text-blue-500' },
  DESIGN_UX: { label: 'Design & UX', color: 'text-purple-500' },
  FEATURE: { label: 'Feature', color: 'text-yellow-500' },
  COMPETITION: { label: 'Competitividade', color: 'text-orange-500' },
  INNOVATION: { label: 'Inovação', color: 'text-pink-500' },
  BUG: { label: 'Bug Fix', color: 'text-red-500' },
  OPTIMIZATION: { label: 'Otimização', color: 'text-green-500' },
};

export const IMPACT_CONFIG: Record<Impact, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  HIGH: { 
    label: 'Alto Impacto', 
    bgColor: 'bg-red-100', 
    textColor: 'text-red-700', 
    borderColor: 'border-red-300' 
  },
  MEDIUM: { 
    label: 'Médio Impacto', 
    bgColor: 'bg-yellow-100', 
    textColor: 'text-yellow-700', 
    borderColor: 'border-yellow-300' 
  },
  LOW: { 
    label: 'Baixo Impacto', 
    bgColor: 'bg-blue-100', 
    textColor: 'text-blue-700', 
    borderColor: 'border-blue-300' 
  },
};

export const EFFORT_CONFIG: Record<Effort, { label: string; color: string }> = {
  HIGH: { label: 'Alto Esforço', color: 'bg-orange-500' },
  MEDIUM: { label: 'Médio Esforço', color: 'bg-yellow-500' },
  LOW: { label: 'Baixo Esforço', color: 'bg-green-500' },
};
