📋 DOCUMENTAÇÃO COMPLETA DO MÓDULO "DEV LAB"
🎯 VISÃO GERAL
Dev Lab é um centro de inovação e gestão de sugestões integrado ao projeto. Funciona como um backlog visual interativo onde você pode:

Adicionar ideias/sugestões de melhorias
Categorizar por tipo (Tech, Design, Feature, Bug, etc.)
Priorizar por impacto e esforço
Acompanhar status (Ativa, Implementada, Arquivada)
Visualizar métricas do projeto em tempo real
🏗️ ARQUITETURA
Stack Técnico:
React (componente funcional)
Zustand (state management com persistência localStorage)
Motion (Framer Motion) (animações)
Recharts (gráficos - PieChart, BarChart)
Lucide React (ícones)
Tailwind CSS (estilização)
Estrutura de Arquivos:
/src/app/components/DevLab.tsx          # Componente principal
/src/hooks/useDevLabStore.ts            # Zustand store
/src/types/devlab.ts                    # TypeScript types
/src/app/utils/projectStatusDetector.ts # Métricas do projeto
📊 MODELO DE DADOS
Types (/src/types/devlab.ts):
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

export interface Suggestion {
  id: string;                    // UUID único
  title: string;                 // Título curto (ex: "Dark Mode")
  description: string;           // Descrição breve
  category: Category;            // Categoria
  tags: string[];               // Tags livres (ex: ['ui', 'accessibility'])
  impact: Impact;               // Impacto no negócio
  effort: Effort;               // Esforço de implementação
  status: 'active' | 'completed' | 'trash';
  fullAnalysis?: string;        // Análise técnica detalhada (opcional)
  createdAt: string;            // ISO date string
}
🗄️ STATE MANAGEMENT (Zustand)
Store (/src/hooks/useDevLabStore.ts):
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

// Store com persistência em localStorage
const useDevLabStore = create<DevLabState>()(
  persist(
    (set) => ({
      suggestions: initialSuggestions, // Array pré-populado

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
          s.id === id ? { ...s, status: 'completed' } : s
        ),
      })),

      markAsTrash: (id) => set((state) => ({
        suggestions: state.suggestions.map(s =>
          s.id === id ? { ...s, status: 'trash' } : s
        ),
      })),

      restoreFromTrash: (id) => set((state) => ({
        suggestions: state.suggestions.map(s =>
          s.id === id ? { ...s, status: 'active' } : s
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
      name: 'devlab-storage', // localStorage key
      storage: createJSONStorage(() => localStorage),
    }
  )
);
🎨 UI/UX - ESTRUTURA VISUAL
1. HEADER (Topo Gradiente)
┌─────────────────────────────────────────────────────────────┐
│ [Icon] DEV LAB                                      [X]     │
│        Centro de Inovação                                   │
│                                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ 87%      │ │ 12       │ │ 45       │ │ 23       │       │
│ │ Progresso│ │ Ativas   │ │ Impleme. │ │ Features │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
Features:

Gradiente from-indigo-900 via-purple-900 to-pink-900
Background pattern SVG sutil
4 cards de métricas:
Progresso global do projeto (%)
Sugestões ativas
Sugestões implementadas
Total de features no projeto
Botão fechar (X) opcional
2. NAVEGAÇÃO (Tabs)
[🔵 Ativas: 12]  [✅ Implementadas: 45]  [📦 Arquivo: 3]  [+ Nova Sugestão]
Comportamento:

3 tabs principais: active, completed, trash
Tab ativa tem fundo colorido + sombra
Badge com contador
Botão "Nova Sugestão" com gradiente indigo → purple
Animações whileHover e whileTap (Motion)
3. GRID DE ANALYTICS (3 colunas)
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ POR CATEGORIA   │  │ POR IMPACTO     │  │ FILTRAR         │
│                 │  │                 │  │                 │
│ [Gráfico Pizza] │  │ [Gráfico Barra] │  │ ☑ Todas         │
│                 │  │                 │  │ ☐ TECH          │
│                 │  │                 │  │ ☐ DESIGN_UX     │
│                 │  │                 │  │ ☐ FEATURE       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
Gráfico Pizza (Categoria):

Filtra apenas sugestões ativas
Cores específicas por categoria:
TECH: #3b82f6 (azul)
DESIGN_UX: #a855f7 (roxo)
FEATURE: #eab308 (amarelo)
BUG: #ef4444 (vermelho)
Labels com percentuais
Gráfico Barra (Impacto):

3 barras: Alto, Médio, Baixo
Cor roxa #8b5cf6
Bordas arredondadas radius={[8, 8, 0, 0]}
Filtro:

Lista de categorias clicáveis
Categoria ativa: fundo indigo-100, borda indigo-300
Mostra contador de itens por categoria
4. LISTA DE SUGESTÕES (Cards)
┌─────────────────────────────────────────────────────────────┐
│ [🔵] Modo Escuro (Dark Mode)                       [✓] [🗑] │
│                                                             │
│ Essencial para uso prolongado.                             │
│                                                             │
│ [HIGH] [Médio Esforço] #ui #accessibility                  │
└─────────────────────────────────────────────────────────────┘
Estrutura de cada card:

Ícone da categoria (esquerda)
Título em negrito
Descrição
Badges:
Impact Badge: RED/YELLOW/BLUE com borda
Effort Badge: Círculo colorido + texto
Tags: Pills cinzas
Botões de ação (direita):
Ativa: ✓ (Completar) | 🗑️ (Arquivar)
Arquivada: ↻ (Restaurar) | ✖ (Deletar)
Hover: borda muda para indigo-300 + sombra aumenta
Animação de entrada: fade + slide up com delay escalonado
🎨 COMPONENTES VISUAIS DETALHADOS
CategoryIcon Component:
const CategoryIcon = ({ category }: { category: Category }) => {
  switch (category) {
    case 'TECH': return <Code2 className="w-5 h-5 text-blue-500" />;
    case 'DESIGN_UX': return <Paintbrush className="w-5 h-5 text-purple-500" />;
    case 'FEATURE': return <Zap className="w-5 h-5 text-yellow-500" />;
    case 'COMPETITION': return <TrendingUp className="w-5 h-5 text-orange-500" />;
    case 'INNOVATION': return <Sparkles className="w-5 h-5 text-pink-500" />;
    case 'BUG': return <Bug className="w-5 h-5 text-red-500" />;
    case 'OPTIMIZATION': return <Lightbulb className="w-5 h-5 text-green-500" />;
  }
};
ImpactBadge Component:
const ImpactBadge = ({ impact }: { impact: Impact }) => {
  const colors = {
    HIGH: 'bg-red-100 text-red-700 border-red-300',
    MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    LOW: 'bg-blue-100 text-blue-700 border-blue-300',
  };
  return (
    <span className={`text-xs px-3 py-1 rounded-full border-2 font-bold uppercase ${colors[impact]}`}>
      {impact}
    </span>
  );
};
EffortBadge Component:
const EffortBadge = ({ effort }: { effort: Effort }) => {
  const config = {
    HIGH: { color: 'bg-orange-500', label: 'Alto Esforço' },
    MEDIUM: { color: 'bg-yellow-500', label: 'Médio Esforço' },
    LOW: { color: 'bg-green-500', label: 'Baixo Esforço' },
  };
  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full border-2 bg-white">
      <div className={`w-2 h-2 rounded-full ${config[effort].color}`} />
      <span className="text-xs font-semibold">{config[effort].label}</span>
    </div>
  );
};
🔧 FUNCIONALIDADES PRINCIPAIS
1. Filtro por View Mode
type ViewMode = 'active' | 'completed' | 'trash';

const filteredSuggestions = suggestions.filter(s => {
  if (view === 'overview') return s.status !== 'trash';
  return s.status === view;
});
2. Filtro por Categoria
const filteredSuggestions = suggestions
  .filter(s => selectedCategory === 'ALL' || s.category === selectedCategory);
3. Estatísticas Dinâmicas
const stats = {
  active: suggestions.filter(s => s.status === 'active').length,
  completed: suggestions.filter(s => s.status === 'completed').length,
  trash: suggestions.filter(s => s.status === 'trash').length,
};
4. Ações sobre Sugestões
Marcar como implementada: markAsCompleted(id)
Arquivar: markAsTrash(id)
Restaurar: restoreFromTrash(id)
Deletar permanentemente: permanentDelete(id)
🎬 ANIMAÇÕES (Motion)
Header:
<motion.div
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
>

Cards Analytics:
<motion.div
  initial={{ opacity: 0, x: -20 }}  // Esquerda
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: 0.1 }}        // Escalonado
>
Lista de Sugestões:
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.05 }} // Delay proporcional ao índice
>

Botões:
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>

📦 DADOS INICIAIS PRÉ-POPULADOS
O store vem com 100+ sugestões iniciais divididas por categoria:

Exemplos:
TECH:

Arquitetura Multi-tenant Isolada (HIGH impact, HIGH effort)
Audit Logs Imutáveis (HIGH impact, MEDIUM effort)
Webhooks Bidirecionais (HIGH impact, MEDIUM effort)
DESIGN_UX:

Portal do Devedor Login-less (HIGH impact, MEDIUM effort)
Modo Escuro (MEDIUM impact, MEDIUM effort)
Command Palette Cmd+K (MEDIUM impact, MEDIUM effort)
FEATURE:

Gestor de Acordos de Pagamento (HIGH impact, HIGH effort)
White-label Completo (HIGH impact, MEDIUM effort)
Calculadora de Juros de Mora (HIGH impact, MEDIUM effort)
COMPETITION:

Calculadora de ROI no Site (HIGH impact, LOW effort)
Certificação ISO 27001 (HIGH impact, HIGH effort)
Integração Open Banking (HIGH impact, HIGH effort)
🎯 INTEGRAÇÃO COM MÉTRICAS DO PROJETO
Arquivo: /src/app/utils/projectStatusDetector.ts
export interface ProjectMetrics {
  overallProgress: number;      // % de conclusão
  completedFeatures: number;    // Features implementadas
  totalFeatures: number;        // Total de features
  // ... outras métricas
}

export const calculateProjectMetrics = (): ProjectMetrics => {
  // Lógica para calcular métricas reais do projeto
  const allFeatures = getAllFeatures();
  const completed = allFeatures.filter(f => f.completed).length;
  
  return {
    overallProgress: Math.round((completed / allFeatures.length) * 100),
    completedFeatures: completed,
    totalFeatures: allFeatures.length,
  };
};

export const getAllFeatures = () => {
  // Retorna array de todas as features do projeto
  return [
    { name: 'Dashboard', completed: true },
    { name: 'Debtors CRUD', completed: true },
    // ... etc
  ];
};
Exibição no Header:

const metrics = useMemo(() => calculateProjectMetrics(), []);

<div>{metrics.overallProgress}%</div>
<div>{metrics.completedFeatures} Features</div>
🎨 PALETA DE CORES
Categorias:
TECH: text-blue-500 (#3b82f6)
DESIGN_UX: text-purple-500 (#a855f7)
FEATURE: text-yellow-500 (#eab308)
COMPETITION: text-orange-500 (#f97316)
INNOVATION: text-pink-500 (#ec4899)
BUG: text-red-500 (#ef4444)
OPTIMIZATION: text-green-500 (#22c55e)
Impact:
HIGH: bg-red-100 text-red-700 border-red-300
MEDIUM: bg-yellow-100 text-yellow-700 border-yellow-300
LOW: bg-blue-100 text-blue-700 border-blue-300
Effort:
HIGH: bg-orange-500
MEDIUM: bg-yellow-500
LOW: bg-green-500
Gradientes:
Header: from-indigo-900 via-purple-900 to-pink-900
Botão Nova: from-indigo-500 to-purple-600
📱 RESPONSIVIDADE
Grid Principal:
className="grid grid-cols-3 gap-6"
// Mobile: ajustar para grid-cols-1 ou grid-cols-2
Cards:
className="rounded-2xl shadow-lg p-6"
// Padding reduz em mobile: p-4
🚀 COMO USAR EM OUTRO PROJETO
1. Instalar dependências:
npm install zustand motion recharts lucide-react
2. Criar estrutura de pastas:
/src
  /types
    devlab.ts
  /hooks
    useDevLabStore.ts
  /components
    DevLab.tsx
  /utils (opcional)
    projectStatusDetector.ts
3. Copiar código:
Copiar os 3 arquivos principais
Ajustar imports conforme estrutura do projeto
Ajustar estilização (Tailwind classes)
4. Integrar no app:
import DevLab from './components/DevLab';

function App() {
  const [showDevLab, setShowDevLab] = useState(false);

  return (
    <>
      <button onClick={() => setShowDevLab(true)}>
        Open Dev Lab
      </button>

      {showDevLab && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
          <DevLab onClose={() => setShowDevLab(false)} />
        </div>
      )}
    </>
  );
}
5. Personalizar:
Alterar categorias em /src/types/devlab.ts
Ajustar sugestões iniciais em useDevLabStore.ts
Customizar cores/ícones por categoria
Adicionar/remover campos no tipo Suggestion
🎁 EXTRAS E MELHORIAS POSSÍVEIS
1. Modal de Criação:
Formulário completo para adicionar nova sugestão
Campos: título, descrição, categoria, tags, impact, effort
Validação
2. Detalhes da Sugestão:
Modal expandido ao clicar
Mostrar fullAnalysis
Edição inline
3. Export/Import:
Exportar para JSON
Importar sugestões de arquivo
4. Busca:
Campo de search
Filtrar por título/descrição/tags
5. Ordenação:
Por impacto
Por esforço
Por data
Por matriz "Quick Wins" (HIGH impact, LOW effort)
6. Drag & Drop:
Reordenar prioridades
Mover entre status (Kanban style)
7. Integração Backend:
Sync com database
Comentários/discussões
Atribuir responsáveis
✅ CHECKLIST DE IMPLEMENTAÇÃO
 Criar types em /src/types/devlab.ts
 Criar Zustand store em /src/hooks/useDevLabStore.ts
 Popular sugestões iniciais
 Criar componente principal DevLab.tsx
 Implementar Header com métricas
 Implementar navegação por tabs
 Implementar grid de analytics (gráficos)
 Implementar filtro por categoria
 Implementar lista de sugestões (cards)
 Implementar ações (completar, arquivar, restaurar, deletar)
 Adicionar animações (Motion)
 Testar responsividade
 Adicionar modal de nova sugestão (opcional)
 Integrar com sistema de métricas do projeto (opcional)
📝 CÓDIGO RESUMIDO PARA REPLICAÇÃO
Estrutura Mínima:
// 1. Types
type Category = 'TECH' | 'DESIGN_UX' | 'FEATURE' | 'BUG';
type Impact = 'HIGH' | 'MEDIUM' | 'LOW';
type Effort = 'HIGH' | 'MEDIUM' | 'LOW';

interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: Category;
  tags: string[];
  impact: Impact;
  effort: Effort;
  status: 'active' | 'completed' | 'trash';
  createdAt: string;
}

// 2. Store (Zustand)
const useDevLabStore = create(persist(
  (set) => ({
    suggestions: [],
    addSuggestion: (s) => set(state => ({ suggestions: [...state.suggestions, {...s, id: crypto.randomUUID(), status: 'active', createdAt: new Date().toISOString()}] })),
    markAsCompleted: (id) => set(state => ({ suggestions: state.suggestions.map(s => s.id === id ? {...s, status: 'completed'} : s) })),
    markAsTrash: (id) => set(state => ({ suggestions: state.suggestions.map(s => s.id === id ? {...s, status: 'trash'} : s) })),
  }),
  { name: 'devlab-storage' }
));

// 3. Componente Principal
function DevLab({ onClose }) {
  const { suggestions, markAsCompleted, markAsTrash } = useDevLabStore();
  const [view, setView] = useState('active');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const filtered = suggestions
    .filter(s => s.status === view)
    .filter(s => selectedCategory === 'ALL' || s.category === selectedCategory);

  return (
    <div className="p-8 space-y-6">
      {/* Header com métricas */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white p-8 rounded-3xl">
        <h1 className="text-4xl font-bold">DEV LAB</h1>
        {/* Métricas cards */}
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button onClick={() => setView('active')}>Ativas</button>
        <button onClick={() => setView('completed')}>Implementadas</button>
        <button onClick={() => setView('trash')}>Arquivo</button>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {filtered.map(suggestion => (
          <div key={suggestion.id} className="bg-white rounded-2xl p-6 border-2">
            <h3>{suggestion.title}</h3>
            <p>{suggestion.description}</p>
            <button onClick={() => markAsCompleted(suggestion.id)}>✓</button>
            <button onClick={() => markAsTrash(suggestion.id)}>🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}