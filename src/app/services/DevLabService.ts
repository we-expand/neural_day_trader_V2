/**
 * DEV LAB - Serviço de persistência (Supabase)
 * Sugestões de desenvolvimento (manuais e vindas de pesquisa de concorrentes) +
 * histórico de execuções de pesquisa.
 */

import { supabase } from '@/lib/supabaseClient';

export type Category =
  | 'TECH'
  | 'DESIGN_UX'
  | 'FEATURE'
  | 'COMPETITION'
  | 'INNOVATION'
  | 'BUG'
  | 'OPTIMIZATION'
  | 'GROWTH_MARKETING'
  | 'MONETIZATION'
  | 'AI_BRAIN';

export type Impact = 'HIGH' | 'MEDIUM' | 'LOW';
export type Effort = 'HIGH' | 'MEDIUM' | 'LOW';
export type SuggestionStatus = 'active' | 'completed' | 'trash';
export type SourceType = 'MANUAL' | 'AI_RESEARCH';

export interface Suggestion {
  id: string;
  user_id: string;
  title: string;
  description: string;
  full_analysis?: string | null;
  category: Category;
  impact: Impact;
  effort: Effort;
  status: SuggestionStatus;
  tags: string[];
  source_type: SourceType;
  competitor_name?: string | null;
  competitor_url?: string | null;
  evidence?: string | null;
  research_run_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchRun {
  id: string;
  user_id: string;
  started_at: string;
  completed_at?: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  competitors_researched: string[];
  suggestions_created: number;
  summary?: string | null;
  error?: string | null;
  created_at: string;
}

export const CATEGORY_CONFIG: Record<Category, { label: string; color: string }> = {
  TECH: { label: 'Tecnologia', color: 'text-blue-400' },
  DESIGN_UX: { label: 'Design & UX', color: 'text-purple-400' },
  FEATURE: { label: 'Feature', color: 'text-yellow-400' },
  COMPETITION: { label: 'Competitividade', color: 'text-orange-400' },
  INNOVATION: { label: 'Inovação', color: 'text-pink-400' },
  BUG: { label: 'Bug Fix', color: 'text-red-400' },
  OPTIMIZATION: { label: 'Otimização', color: 'text-green-400' },
  GROWTH_MARKETING: { label: 'Growth & Marketing', color: 'text-cyan-400' },
  MONETIZATION: { label: 'Monetização / Pricing', color: 'text-amber-400' },
  AI_BRAIN: { label: 'Cérebro de IA / P&D Quant', color: 'text-indigo-400' },
};

export const IMPACT_CONFIG: Record<Impact, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  HIGH: { label: 'Alto Impacto', bgColor: 'bg-red-500/10', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  MEDIUM: { label: 'Médio Impacto', bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
  LOW: { label: 'Baixo Impacto', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
};

export const EFFORT_CONFIG: Record<Effort, { label: string; color: string }> = {
  HIGH: { label: 'Alto Esforço', color: 'bg-orange-500' },
  MEDIUM: { label: 'Médio Esforço', color: 'bg-yellow-500' },
  LOW: { label: 'Baixo Esforço', color: 'bg-green-500' },
};

const LOG_PREFIX = '[DevLab]';

class DevLabService {
  async getUserSuggestions(userId: string): Promise<Suggestion[]> {
    try {
      const { data, error } = await supabase
        .from('dev_lab_suggestions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Suggestion[];
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro ao buscar sugestões:`, error);
      return [];
    }
  }

  async addSuggestion(userId: string, suggestion: Omit<Suggestion, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>): Promise<Suggestion | null> {
    try {
      const { data, error } = await supabase
        .from('dev_lab_suggestions')
        .insert([{ ...suggestion, user_id: userId, status: 'active' }])
        .select()
        .single();
      if (error) throw error;
      return data as Suggestion;
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro ao criar sugestão:`, error);
      return null;
    }
  }

  async updateStatus(id: string, status: SuggestionStatus): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('dev_lab_suggestions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro ao atualizar status:`, error);
      return false;
    }
  }

  async permanentDelete(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('dev_lab_suggestions').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro ao apagar sugestão:`, error);
      return false;
    }
  }

  async getResearchRuns(userId: string, limit = 20): Promise<ResearchRun[]> {
    try {
      const { data, error } = await supabase
        .from('dev_lab_research_runs')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as ResearchRun[];
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro ao buscar execuções de pesquisa:`, error);
      return [];
    }
  }
}

export const devLabService = new DevLabService();
