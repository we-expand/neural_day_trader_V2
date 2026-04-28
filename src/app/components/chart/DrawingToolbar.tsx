/**
 * 📐 DRAWING TOOLBAR
 * 
 * Barra vertical de ferramentas de desenho para gráficos
 * Baseada em plataformas profissionais de trading (TradingView style)
 * 
 * Ferramentas:
 * 1. Cruz (Crosshair)
 * 2. Ferramenta de Tendência (Trendline)
 * 3. Fibonacci/GANN
 * 4. Previsão e Medição
 * 5. Formas Geométricas
 * 6. Anotação (Texto)
 * 7. Ícones
 * 8. Medir
 * 9. Zoom
 * 10. Modo Magnético
 * 11. Travar Desenhos
 * 12. Ocultar Desenhos
 * 13. Remover Objetos
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 * @date 24 Janeiro 2026
 */

import { useState } from 'react';
import { 
  Crosshair,
  TrendingUp,
  AlignHorizontalJustifyCenter,
  Activity,
  Square,
  Type,
  Smile,
  Ruler,
  ZoomIn,
  Magnet,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Circle,
  Triangle,
  Minus
} from 'lucide-react';
import { toast } from 'sonner';
import { DrawingToolDropdown, EmojiPicker } from './DrawingToolDropdown';
import { 
  LINES_TOOLS,
  FIBONACCI_TOOLS,
  GANN_TOOLS,
  SHAPES_TOOLS,
  TEXT_TOOLS,
  ICON_TOOLS,
  PATTERNS_TOOLS,
  ELLIOTT_TOOLS,
  CYCLES_TOOLS,
  CROSSHAIR_SUBMENU,
  CHANNELS_TOOLS,
  PITCHFORK_TOOLS
} from './DrawingSubMenus';
import { FibonacciLogoIcon, CrossIcon, TrendlineIcon } from './FibonacciIcons';

type DrawingTool = 
  | 'crosshair'
  | 'trendline'
  | 'fibonacci'
  | 'forecast'
  | 'shapes'
  | 'text'
  | 'icons'
  | 'measure'
  | 'zoom'
  | 'magnet'
  | 'lock'
  | 'hide'
  | 'delete';

interface DrawingToolbarProps {
  onToolSelect?: (tool: DrawingTool) => void;
  onSubToolSelect?: (toolId: string) => void;
  onCrosshairModeChange?: (mode: 'crosshair' | 'point' | 'arrow' | 'presentation' | 'eraser') => void;
  onDataWindowToggle?: (enabled: boolean) => void;
  onDeleteAll?: () => void; // 🆕 Callback para apagar todos os desenhos
  className?: string;
}

export function DrawingToolbar({ onToolSelect, onSubToolSelect, onCrosshairModeChange, onDataWindowToggle, onDeleteAll, className = '' }: DrawingToolbarProps) {
  const [activeTool, setActiveTool] = useState<DrawingTool | null>(null);
  const [isMagneticMode, setIsMagneticMode] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DrawingTool | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<HTMLElement | null>(null);

  const handleToolClick = (tool: DrawingTool, event: React.MouseEvent<HTMLButtonElement>) => {
    // Tools com submenus
    const toolsWithSubmenus: DrawingTool[] = ['crosshair', 'trendline', 'fibonacci', 'forecast', 'shapes', 'text', 'icons'];
    
    if (toolsWithSubmenus.includes(tool)) {
      if (openDropdown === tool) {
        setOpenDropdown(null);
        setDropdownAnchor(null);
      } else {
        setOpenDropdown(tool);
        setDropdownAnchor(event.currentTarget);
      }
      return;
    }

    // Toggle tools especiais
    if (tool === 'magnet') {
      setIsMagneticMode(!isMagneticMode);
      toast.success(`Modo Magnético ${!isMagneticMode ? 'Ativado' : 'Desativado'}`, {
        description: !isMagneticMode ? 'Desenhos se encaixam automaticamente' : '',
        duration: 2000
      });
      return;
    }

    if (tool === 'lock') {
      setIsLocked(!isLocked);
      toast.success(`Desenhos ${!isLocked ? 'Travados' : 'Destravados'}`, {
        description: !isLocked ? 'Não é possível mover ou editar' : 'Agora você pode editar',
        duration: 2000
      });
      return;
    }

    if (tool === 'hide') {
      setIsHidden(!isHidden);
      toast.success(`Desenhos ${!isHidden ? 'Ocultos' : 'Visíveis'}`, {
        duration: 2000
      });
      return;
    }

    if (tool === 'delete') {
      if (onDeleteAll) {
        onDeleteAll();
      }
      toast.error('Todos os desenhos foram removidos', {
        description: 'Esta ação não pode ser desfeita',
        duration: 3000
      });
      setActiveTool(null);
      return;
    }

    // Ativar ferramenta normal
    setActiveTool(tool === activeTool ? null : tool);
    if (onToolSelect) {
      onToolSelect(tool);
    }

    // Toast informativo
    const toolNames: Record<DrawingTool, string> = {
      crosshair: 'Cruz',
      trendline: 'Linha de Tendência',
      fibonacci: 'Fibonacci/GANN',
      forecast: 'Previsão e Medição',
      shapes: 'Formas Geométricas',
      text: 'Anotação de Texto',
      icons: 'Ícones',
      measure: 'Medir Distância',
      zoom: 'Zoom',
      magnet: 'Modo Magnético',
      lock: 'Travar Desenhos',
      hide: 'Ocultar Desenhos',
      delete: 'Remover Objetos'
    };

    if (tool !== activeTool) {
      toast.info(`Ferramenta ativada: ${toolNames[tool]}`, {
        duration: 2000
      });
    }
  };

  const handleSubToolSelect = (toolId: string) => {
    console.log('[DrawingToolbar] 🎨 Sub-tool selected:', toolId);
    console.log('[DrawingToolbar] 🎯 onCrosshairModeChange exists?', !!onCrosshairModeChange);
    console.log('[DrawingToolbar] 🔍 Full callback:', onCrosshairModeChange);
    
    // Handle crosshair mode changes
    if (toolId.startsWith('crosshair')) {
      // Extrai o modo: 'crosshair' ou 'crosshair-point', 'crosshair-arrow', etc
      let mode: 'crosshair' | 'point' | 'arrow' | 'presentation' | 'eraser';
      if (toolId === 'crosshair') {
        mode = 'crosshair';
      } else {
        mode = toolId.replace('crosshair-', '') as 'point' | 'arrow' | 'presentation' | 'eraser';
      }
      
      console.log('[DrawingToolbar] ✅ Calling onCrosshairModeChange with mode:', mode);
      
      // Remover toast duplicado - o ChartView já mostra o toast
      if (mode === 'arrow') {
        setActiveTool(null); // Desativa ferramenta atual
      }
      
      if (onCrosshairModeChange) {
        console.log('[DrawingToolbar] ✅ Chamando callback onCrosshairModeChange');
        onCrosshairModeChange(mode);
      } else {
        console.error('[DrawingToolbar] ❌ onCrosshairModeChange is not defined!');
      }
    } else {
      // Pass to parent to handle drawing tool activation
      if (onSubToolSelect) {
        onSubToolSelect(toolId);
      }
      
      toast.success(`Ferramenta selecionada: ${toolId}`, {
        duration: 2000
      });
    }
    
    setOpenDropdown(null);
    setDropdownAnchor(null);
  };

  // Get categories for current dropdown
  const getDropdownCategories = (tool: DrawingTool) => {
    switch (tool) {
      case 'crosshair':
        return CROSSHAIR_SUBMENU;
      case 'trendline':
        return [...LINES_TOOLS, ...CHANNELS_TOOLS, ...PITCHFORK_TOOLS];
      case 'fibonacci':
        return [...FIBONACCI_TOOLS, ...GANN_TOOLS];
      case 'forecast':
        return [...PATTERNS_TOOLS, ...ELLIOTT_TOOLS, ...CYCLES_TOOLS];
      case 'shapes':
        return SHAPES_TOOLS;
      case 'text':
        return TEXT_TOOLS;
      case 'icons':
        return ICON_TOOLS;
      default:
        return [];
    }
  };

  const tools = [
    {
      id: 'crosshair' as DrawingTool,
      icon: CrossIcon,
      label: 'Cruz',
      dividerAfter: false,
      isCustomIcon: true
    },
    {
      id: 'trendline' as DrawingTool,
      icon: TrendlineIcon,
      label: 'Linha de Tendência',
      dividerAfter: false
    },
    {
      id: 'fibonacci' as DrawingTool,
      icon: FibonacciLogoIcon,
      label: 'Fibonacci/GANN',
      dividerAfter: false,
      isCustomIcon: true
    },
    {
      id: 'forecast' as DrawingTool,
      icon: Activity,
      label: 'Previsão e Medição',
      dividerAfter: false
    },
    {
      id: 'shapes' as DrawingTool,
      icon: Square,
      label: 'Formas Geométricas',
      dividerAfter: false
    },
    {
      id: 'text' as DrawingTool,
      icon: Type,
      label: 'Anotação',
      dividerAfter: false
    },
    {
      id: 'icons' as DrawingTool,
      icon: Smile,
      label: 'Ícones',
      dividerAfter: true // Separador depois
    },
    {
      id: 'measure' as DrawingTool,
      icon: Ruler,
      label: 'Medir',
      dividerAfter: false
    },
    {
      id: 'zoom' as DrawingTool,
      icon: ZoomIn,
      label: 'Zoom',
      dividerAfter: true // Separador depois
    },
    {
      id: 'magnet' as DrawingTool,
      icon: Magnet,
      label: 'Modo Magnético',
      dividerAfter: false,
      isToggle: true,
      isActive: isMagneticMode
    },
    {
      id: 'lock' as DrawingTool,
      icon: Lock,
      label: 'Travar Desenhos',
      dividerAfter: false,
      isToggle: true,
      isActive: isLocked
    },
    {
      id: 'hide' as DrawingTool,
      icon: isHidden ? EyeOff : Eye,
      label: 'Ocultar Desenhos',
      dividerAfter: false,
      isToggle: true,
      isActive: isHidden
    },
    {
      id: 'delete' as DrawingTool,
      icon: Trash2,
      label: 'Remover Objetos',
      dividerAfter: false,
      isDestructive: true
    }
  ];

  return (
    <div className={`absolute left-0 top-0 bottom-0 z-50 flex flex-col items-center bg-[#131313] border-r border-gray-800 py-2 gap-0.5 ${className}`}>
      {tools.map((tool, index) => {
        const Icon = tool.icon;
        const isActive = tool.isToggle ? tool.isActive : activeTool === tool.id;
        
        return (
          <div key={tool.id} className="flex flex-col items-center w-full">
            <button
              onClick={(event) => handleToolClick(tool.id, event)}
              className={`
                group relative w-11 h-11 flex items-center justify-center
                transition-all duration-200 rounded-md
                ${isActive 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'
                }
                ${tool.isDestructive ? 'hover:bg-red-500/10 hover:text-red-400' : ''}
              `}
              title={tool.label}
            >
              <Icon className="w-5 h-5" />
              
              {/* Tooltip */}
              <div className="
                absolute left-full ml-2 px-3 py-1.5 
                bg-gray-800 border border-gray-700 rounded-md
                text-xs font-medium text-white whitespace-nowrap
                opacity-0 group-hover:opacity-100
                pointer-events-none transition-opacity duration-200
                z-50
              ">
                {tool.label}
              </div>

              {/* Indicador de ativo */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r-full" />
              )}
            </button>

            {/* Divider horizontal */}
            {tool.dividerAfter && (
              <div className="h-px w-8 bg-gray-800 my-1" />
            )}
          </div>
        );
      })}

      {/* Dropdowns */}
      {openDropdown && (
        <DrawingToolDropdown
          anchor={dropdownAnchor}
          onClose={() => setOpenDropdown(null)}
          onToolSelect={handleSubToolSelect}
          categories={getDropdownCategories(openDropdown)}
          onDataWindowToggle={onDataWindowToggle}
        />
      )}
    </div>
  );
}