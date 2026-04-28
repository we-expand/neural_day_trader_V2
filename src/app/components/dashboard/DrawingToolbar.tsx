import React from 'react';
import { 
  MousePointer2, 
  Minus, 
  TrendingUp, 
  Circle, 
  Smile, 
  Type, 
  Eye, 
  EyeOff,
  Trash2,
  Lock,
  LockOpen,
  Upload,
  Square,
  Magnet
} from 'lucide-react';

interface DrawingToolbarProps {
  drawingTool: string | null;
  onToolClick: (tool: string) => void;
}

export function DrawingToolbar({ drawingTool, onToolClick }: DrawingToolbarProps) {
  const tools = [
    { id: 'crosshair', icon: <MousePointer2 className="w-5 h-5" />, label: 'Cursor' },
    { id: 'separator1', type: 'separator' },
    { id: 'trendline', icon: <TrendingUp className="w-5 h-5" />, label: 'Linha de Tendência' },
    { id: 'segment', icon: <Minus className="w-5 h-5" />, label: 'Segmento' },
    { id: 'horizontal', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="4" cy="12" r="1.5" fill="currentColor" />
        <circle cx="20" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ), label: 'Linha Horizontal' },
    { id: 'vertical', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="4" x2="12" y2="20" />
        <circle cx="12" cy="4" r="1.5" fill="currentColor" />
        <circle cx="12" cy="20" r="1.5" fill="currentColor" />
      </svg>
    ), label: 'Linha Vertical' },
    { id: 'polyline', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="4,18 9,10 14,14 19,6" />
        <circle cx="4" cy="18" r="1.5" fill="currentColor" />
        <circle cx="9" cy="10" r="1.5" fill="currentColor" />
        <circle cx="14" cy="14" r="1.5" fill="currentColor" />
        <circle cx="19" cy="6" r="1.5" fill="currentColor" />
      </svg>
    ), label: 'Polilinha' },
    { id: 'channel', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="18" x2="20" y2="6" />
        <line x1="4" y1="14" x2="20" y2="2" />
      </svg>
    ), label: 'Canal' },
    { id: 'brush', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L3 21h18L12 2z" />
      </svg>
    ), label: 'Pincel' },
    { id: 'separator2', type: 'separator' },
    { id: 'text', icon: <Type className="w-5 h-5" />, label: 'Texto' },
    { id: 'emoji', icon: <Smile className="w-5 h-5" />, label: 'Emoji' },
    { id: 'separator3', type: 'separator' },
    { id: 'ruler', icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="6" width="16" height="12" rx="2" />
        <line x1="8" y1="10" x2="8" y2="14" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="16" y1="10" x2="16" y2="14" />
      </svg>
    ), label: 'Régua' },
    { id: 'magnet', icon: <Magnet className="w-5 h-5" />, label: 'Magnetizar' },
    { id: 'lock', icon: <Lock className="w-5 h-5" />, label: 'Travar Desenhos' },
    { id: 'unlock', icon: <LockOpen className="w-5 h-5" />, label: 'Destravar' },
    { id: 'separator4', type: 'separator' },
    { id: 'visibility', icon: <Eye className="w-5 h-5" />, label: 'Visibilidade' },
    { id: 'trash', icon: <Trash2 className="w-5 h-5" />, label: 'Remover Todos', danger: true }
  ];

  return (
    <div className="w-14 border-r border-white/10 flex flex-col items-center py-3 gap-2 bg-[#0a0a0a] z-10 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {tools.map((tool) => {
        if (tool.type === 'separator') {
          return (
            <div 
              key={tool.id} 
              className="w-8 h-px bg-white/10 my-1" 
            />
          );
        }

        const isActive = drawingTool === tool.id;
        const isDanger = tool.danger;

        return (
          <button
            key={tool.id}
            onClick={() => onToolClick(tool.id)}
            className={`
              p-2.5 rounded-md transition-all
              ${isActive 
                ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20' 
                : isDanger
                  ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }
              ${isActive ? 'scale-110' : 'scale-100 hover:scale-105'}
            `}
            title={tool.label}
          >
            {tool.icon}
          </button>
        );
      })}
    </div>
  );
}
