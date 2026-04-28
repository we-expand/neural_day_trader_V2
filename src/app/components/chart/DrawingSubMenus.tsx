/**
 * 🎨 DRAWING TOOL SUBMENUS
 * 
 * Menus expansíveis para ferramentas de desenho
 * Baseado em TradingView UI/UX profissional
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 * @date 24 Janeiro 2026
 */

import React from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Circle,
  Triangle,
  Square,
  Pentagon,
  Sparkles,
  Hash,
  Layers,
  Radio,
  Zap,
  ChevronUp,
  Box,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowLeftRight,
  Move,
  Type,
  MessageSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flag,
  MapPin,
  Star,
  Heart,
  Smile,
  ThumbsUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  TrendingUpDown,
  BarChart3,
  CandlestickChart,
  MoreHorizontal,
  Divide,
  GitBranch,
  Pencil,
  ArrowUpCircle,
  ArrowDownCircle,
  Maximize2,
  Table,
  Image as ImageIcon,
  Twitter,
  Lightbulb,
  MousePointer,
  Play,
  Eraser
} from 'lucide-react';

// ✅ Importar ícones customizados de Fibonacci e Gann
import {
  FibRetracementIcon,
  FibExtensionIcon,
  FibChannelIcon,
  FibTimezoneIcon,
  FibSpeedFanIcon,
  FibTimeIcon,
  FibCirclesIcon,
  FibSpiralIcon,
  FibSpeedArcsIcon,
  FibWedgeIcon,
  FibFanIcon,
  GannBoxIcon,
  GannSquareFixedIcon,
  GannSquareIcon,
  GannFanIcon,
  CrossIcon,
  FibonacciLogoIcon,
  TrendlineIcon,
  RayIcon,
  InfoLineIcon,
  ExtendedLineIcon,
  TrendAngleIcon,
  HorizontalLineIcon,
  HorizontalRayIcon,
  VerticalLineIcon,
  CrossLineIcon,
  ParallelChannelIcon,
  RegressionTrendIcon,
  FlatTopBottomIcon,
  PitchforkIcon
} from './FibonacciIcons';

export interface DrawingToolItem {
  id: string;
  name: string;
  icon?: any;
  shortcut?: string;
}

export interface DrawingToolCategory {
  id: string;
  name: string;
  tools: DrawingToolItem[];
}

// ========== LINHAS ==========
export const LINES_TOOLS: DrawingToolCategory[] = [
  {
    id: 'lines',
    name: 'LINHAS',
    tools: [
      { id: 'trendline', name: 'Linha de Tendência', icon: TrendlineIcon, shortcut: '⌃ T' },
      { id: 'ray', name: 'Raio', icon: RayIcon },
      { id: 'info-line', name: 'Linha com Informações', icon: InfoLineIcon },
      { id: 'extended-line', name: 'Linha Estendida', icon: ExtendedLineIcon },
      { id: 'trend-angle', name: 'Ângulo de Tendência', icon: TrendAngleIcon },
      { id: 'horizontal-line', name: 'Linha Horizontal', icon: HorizontalLineIcon, shortcut: '⌃ H' },
      { id: 'horizontal-ray', name: 'Raio Horizontal', icon: HorizontalRayIcon, shortcut: '⌃ J' },
      { id: 'vertical-line', name: 'Linha Vertical', icon: VerticalLineIcon, shortcut: '⌃ V' },
      { id: 'cross-line', name: 'Linha Cruzada', icon: CrossLineIcon, shortcut: '⌃ C' }
    ]
  }
];

// ========== CANAIS ==========
export const CHANNELS_TOOLS: DrawingToolCategory[] = [
  {
    id: 'channels',
    name: 'CANAIS',
    tools: [
      { id: 'parallel-channel', name: 'Canal Paralelo', icon: ParallelChannelIcon },
      { id: 'regression-trend', name: 'Tendência de Regressão', icon: RegressionTrendIcon },
      { id: 'flat-top-bottom', name: 'Topo/Fundo Plano', icon: FlatTopBottomIcon },
      { id: 'non-parallel-channel', name: 'Canal Não-Paralelo', icon: Layers }
    ]
  }
];

// ========== GARFO ==========
export const PITCHFORK_TOOLS: DrawingToolCategory[] = [
  {
    id: 'pitchfork',
    name: 'GARFO',
    tools: [
      { id: 'pitchfork', name: 'Garfo', icon: PitchforkIcon },
      { id: 'schiff-pitchfork', name: 'Garfo de Schiff', icon: GitBranch },
      { id: 'modified-schiff', name: 'Garfo de Schiff Modificado', icon: GitBranch },
      { id: 'inside-pitchfork', name: 'Garfo Interno', icon: GitBranch }
    ]
  }
];

// ========== FIBONACCI ==========
export const FIBONACCI_TOOLS: DrawingToolCategory[] = [
  {
    id: 'fibonacci',
    name: 'FIBONACCI',
    tools: [
      { id: 'fib-logo', name: 'Fibonacci - Todas as Ferramentas', icon: FibonacciLogoIcon, shortcut: '⌃ ⇧ F' },
      { id: 'fib-retracement', name: 'Retração de Fibonacci', icon: FibRetracementIcon, shortcut: '⌃ F' },
      { id: 'fib-extension', name: 'Extensão de Fibonacci Baseado em Tendências', icon: FibExtensionIcon },
      { id: 'fib-channel', name: 'Canal de Fibonacci', icon: FibChannelIcon },
      { id: 'fib-timezone', name: 'Zona Temporal em Fibonacci', icon: FibTimezoneIcon },
      { id: 'fib-speed-fan', name: 'Leque de Resistência e Velocidade em Fibonacci', icon: FibSpeedFanIcon },
      { id: 'fib-time', name: 'Tempo de Fibonacci Baseado em Tendências', icon: FibTimeIcon },
      { id: 'fib-circles', name: 'Círculos de Fibonacci', icon: FibCirclesIcon },
      { id: 'fib-spiral', name: 'Espiral de Fibonacci', icon: FibSpiralIcon },
      { id: 'fib-speed-arcs', name: 'Arcos de Resistência e Velocidade em Fibonacci', icon: FibSpeedArcsIcon },
      { id: 'fib-wedge', name: 'Cunha de Fibonacci', icon: FibWedgeIcon },
      { id: 'fib-fan', name: 'Leque de Linhas', icon: FibFanIcon }
    ]
  }
];

// ========== GANN ==========
export const GANN_TOOLS: DrawingToolCategory[] = [
  {
    id: 'gann',
    name: 'GANN',
    tools: [
      { id: 'gann-box', name: 'Caixa de Gann', icon: GannBoxIcon },
      { id: 'gann-square-fixed', name: 'Quadrado de Gann Fixo', icon: GannSquareFixedIcon },
      { id: 'gann-square', name: 'Quadrado de Gann', icon: GannSquareIcon },
      { id: 'gann-fan', name: 'Leque de Gann', icon: GannFanIcon }
    ]
  }
];

// ========== PADRÕES ==========
export const PATTERNS_TOOLS: DrawingToolCategory[] = [
  {
    id: 'patterns',
    name: 'PADRÕES',
    tools: [
      { id: 'xabcd', name: 'Padrão XABCD', icon: Activity },
      { id: 'cypher', name: 'Padrão Cypher', icon: Zap },
      { id: 'head-shoulders', name: 'Cabeça e Ombros', icon: ChevronUp },
      { id: 'abcd', name: 'Padrão ABCD', icon: Activity },
      { id: 'triangle-pattern', name: 'Padrão Triangular', icon: Triangle },
      { id: 'three-drives', name: 'Padrão dos Três Avanços', icon: TrendingUp }
    ]
  }
];

// ========== ONDAS DE ELLIOTT ==========
export const ELLIOTT_TOOLS: DrawingToolCategory[] = [
  {
    id: 'elliott',
    name: 'ONDAS DE ELLIOTT',
    tools: [
      { id: 'elliott-impulse', name: 'Onda de Elliot Impulso (12345)', icon: Activity },
      { id: 'elliott-correction', name: 'Onda de Elliot Correção (ABC)', icon: TrendingDown },
      { id: 'elliott-triangle', name: 'Onda de Elliot Triangular (ABCDE)', icon: Triangle },
      { id: 'elliott-double', name: 'Onda de Elliot Combo Dupla (WXY)', icon: Activity },
      { id: 'elliott-triple', name: 'Onda de Elliot Combo Tripla (WXYXZ)', icon: Activity }
    ]
  }
];

// ========== CICLOS ==========
export const CYCLES_TOOLS: DrawingToolCategory[] = [
  {
    id: 'cycles',
    name: 'CICLOS',
    tools: [
      { id: 'cyclic-lines', name: 'Linhas Cíclicas', icon: Radio },
      { id: 'time-cycles', name: 'Ciclos Temporais', icon: Activity },
      { id: 'sine-wave', name: 'Senóide', icon: Activity }
    ]
  }
];

// ========== PINCÉIS ==========
export const BRUSH_TOOLS: DrawingToolCategory[] = [
  {
    id: 'brush',
    name: 'PINCÉIS',
    tools: [
      { id: 'brush', name: 'Pincel', icon: Pencil },
      { id: 'highlighter', name: 'Destaque', icon: Sparkles }
    ]
  }
];

// ========== MEDIÇÃO & NAVEGAÇÃO ==========
export const MEASUREMENT_TOOLS: DrawingToolCategory[] = [
  {
    id: 'measurement',
    name: 'MEDIÇÃO',
    tools: [
      { id: 'cross', name: 'Cruz (Crosshair)', icon: CrossIcon, shortcut: '⌃ X' },
      { id: 'measure', name: 'Ferramenta de Medição', icon: Activity },
      { id: 'zoom-area', name: 'Zoom em Área', icon: Maximize2 }
    ]
  }
];

// 🆕 ========== CRUZ (CROSSHAIR) - SUBMENU ==========
export const CROSSHAIR_SUBMENU: DrawingToolCategory[] = [
  {
    id: 'crosshair-modes',
    name: 'Cruz',
    tools: [
      { id: 'crosshair', name: 'Cruz', icon: Activity, shortcut: 'Alt + C' },
      { id: 'crosshair-point', name: 'Ponto', icon: Circle, shortcut: 'Alt + D' },
      { id: 'crosshair-arrow', name: 'Seta', icon: MousePointer, shortcut: 'Alt + X' },
      { id: 'crosshair-presentation', name: 'Apresentação', icon: Pencil, shortcut: 'Alt + B' },
      { id: 'crosshair-eraser', name: 'Borracha', icon: Eraser, shortcut: 'Alt + E' }
    ]
  }
];

// ========== SETAS ==========
export const ARROWS_TOOLS: DrawingToolCategory[] = [
  {
    id: 'arrows',
    name: 'SETAS',
    tools: [
      { id: 'arrow-up', name: 'Seta para Cima', icon: ArrowUp },
      { id: 'arrow-down', name: 'Seta para Baixo', icon: ArrowDown },
      { id: 'arrow-up-down', name: 'Seta para Cima e Baixo', icon: ArrowUpDown },
      { id: 'arrow-left-right', name: 'Seta para Esquerda e Direita', icon: ArrowLeftRight },
      { id: 'arrow-up-circle', name: 'Seta para Cima em Círculo', icon: ArrowUpCircle },
      { id: 'arrow-down-circle', name: 'Seta para Baixo em Círculo', icon: ArrowDownCircle }
    ]
  }
];

// ========== FORMAS ==========
export const SHAPES_TOOLS: DrawingToolCategory[] = [
  {
    id: 'shapes',
    name: 'FORMAS',
    tools: [
      { id: 'rectangle', name: 'Retângulo', icon: Square, shortcut: '⌃ ⇧ R' },
      { id: 'rotated-rectangle', name: 'Retângulo Giratório', icon: Maximize2 },
      { id: 'path', name: 'Trilha', icon: Move },
      { id: 'circle', name: 'Círculo', icon: Circle },
      { id: 'ellipse', name: 'Elipse', icon: Circle },
      { id: 'polyline', name: 'Linha Segmentada', icon: Activity },
      { id: 'triangle', name: 'Triângulo', icon: Triangle },
      { id: 'arc', name: 'Arco', icon: Radio },
      { id: 'curve', name: 'Curva', icon: Activity },
      { id: 'double-curve', name: 'Curva Dupla', icon: Activity }
    ]
  }
];

// ========== TEXTO & NOTAS ==========
export const TEXT_TOOLS: DrawingToolCategory[] = [
  {
    id: 'text',
    name: 'TEXTO & NOTAS',
    tools: [
      { id: 'text', name: 'Texto', icon: Type },
      { id: 'anchored-text', name: 'Texto Ancorado', icon: Type },
      { id: 'note', name: 'Nota', icon: MessageSquare },
      { id: 'price-note', name: 'Nota de Preço', icon: Hash },
      { id: 'pin', name: 'Pin', icon: MapPin },
      { id: 'table', name: 'Tabela', icon: Table },
      { id: 'callout', name: 'Indicação', icon: MessageSquare },
      { id: 'comment', name: 'Comentário', icon: MessageSquare },
      { id: 'price-label', name: 'Legenda de Preços', icon: Hash },
      { id: 'signpost', name: 'Sinalização', icon: Flag },
      { id: 'flag', name: 'Bandeira', icon: Flag }
    ]
  }
];

// ========== CONTEÚDO ==========
export const CONTENT_TOOLS: DrawingToolCategory[] = [
  {
    id: 'content',
    name: 'CONTEÚDO',
    tools: [
      { id: 'image', name: 'Imagem', icon: ImageIcon },
      { id: 'tweet', name: 'Tweet', icon: Twitter },
      { id: 'idea', name: 'Ideia', icon: Lightbulb }
    ]
  }
];

// ========== ÍCONES ==========
export const ICON_TOOLS: DrawingToolCategory[] = [
  {
    id: 'icons',
    name: 'ÍCONES',
    tools: [
      { id: 'emojis', name: 'Emojis', icon: Smile },
      { id: 'stickers', name: 'Stickers', icon: Star },
      { id: 'custom-icons', name: 'Ícones Personalizados', icon: Sparkles }
    ]
  }
];

// ========== MAPA COMPLETO DE FERRAMENTAS ==========
export const TOOL_CATEGORIES_MAP: Record<string, DrawingToolCategory[]> = {
  trendline: LINES_TOOLS,
  fibonacci: FIBONACCI_TOOLS,
  shapes: SHAPES_TOOLS,
  text: TEXT_TOOLS,
  icons: ICON_TOOLS,
  forecast: [...PATTERNS_TOOLS, ...ELLIOTT_TOOLS, ...CYCLES_TOOLS],
  // Adicionar mais mapeamentos conforme necessário
};

// ========== HELPER PARA ENCONTRAR FERRAMENTA ==========
export function findToolById(toolId: string): DrawingToolItem | null {
  const allCategories = [
    ...LINES_TOOLS,
    ...CHANNELS_TOOLS,
    ...PITCHFORK_TOOLS,
    ...FIBONACCI_TOOLS,
    ...GANN_TOOLS,
    ...PATTERNS_TOOLS,
    ...ELLIOTT_TOOLS,
    ...CYCLES_TOOLS,
    ...BRUSH_TOOLS,
    ...MEASUREMENT_TOOLS,
    ...ARROWS_TOOLS,
    ...SHAPES_TOOLS,
    ...TEXT_TOOLS,
    ...CONTENT_TOOLS,
    ...ICON_TOOLS
  ];

  for (const category of allCategories) {
    const tool = category.tools.find(t => t.id === toolId);
    if (tool) return tool;
  }

  return null;
}