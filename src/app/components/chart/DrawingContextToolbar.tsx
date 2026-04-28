/**
 * 🎨 DRAWING CONTEXT TOOLBAR
 * 
 * Toolbar contextual que aparece ao selecionar um desenho/anotação
 * Estilo profissional TradingView
 * 
 * Funcionalidades:
 * - Mover desenho
 * - Editar texto
 * - Configurar fonte e estilo
 * - Alterar espessura de linha
 * - Configurações avançadas
 * - Bloquear/Desbloquear
 * - Apagar
 * - Menu de opções (três pontos)
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 * @date 24 Janeiro 2026
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Move, 
  Pencil, 
  Type,
  Minus,
  Settings,
  Lock,
  Unlock,
  Trash2,
  MoreVertical,
  ChevronDown,
  Eye,
  EyeOff,
  Copy,
  Layers,
  Clock,
  CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';

interface DrawingContextToolbarProps {
  visible: boolean;
  position?: { x: number; y: number };
  selectedDrawing?: {
    id: string;
    type: string;
    isLocked?: boolean;
    isHidden?: boolean;
    style?: {
      color?: string;
      lineWidth?: number;
      fontSize?: number;
      fontWeight?: 'normal' | 'bold';
      fontStyle?: 'normal' | 'italic';
    };
  };
  onMove?: () => void;
  onEdit?: () => void;
  onStyleChange?: (style: any) => void;
  onLockToggle?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCopy?: () => void;
  onHideToggle?: () => void;
  onClose?: () => void;
}

export function DrawingContextToolbar({
  visible,
  position = { x: 0, y: 0 },
  selectedDrawing,
  onMove,
  onEdit,
  onStyleChange,
  onLockToggle,
  onDelete,
  onDuplicate,
  onCopy,
  onHideToggle,
  onClose
}: DrawingContextToolbarProps) {
  const [showLineStyleMenu, setShowLineStyleMenu] = useState(false);
  const [showThicknessMenu, setShowThicknessMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  const toolbarRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [thickness, setThickness] = useState(2);
  const [fontSize, setFontSize] = useState(14);
  const [textColor, setTextColor] = useState('#ffffff');

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoreMenu]);

  if (!visible) return null;

  const handleThicknessChange = (value: number) => {
    setThickness(value);
    if (onStyleChange) {
      onStyleChange({ lineWidth: value });
    }
    setShowThicknessMenu(false);
    toast.success(`Espessura: ${value}px`);
  };

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    if (onStyleChange) {
      onStyleChange({ fontSize: value });
    }
    setShowFontSizeMenu(false);
    toast.success(`Fonte: ${value}px`);
  };

  const handleLineStyleChange = (style: 'solid' | 'dashed' | 'dotted') => {
    setLineStyle(style);
    if (onStyleChange) {
      onStyleChange({ lineStyle: style });
    }
    setShowLineStyleMenu(false);
    toast.success(`Estilo: ${style === 'solid' ? 'Sólida' : style === 'dashed' ? 'Tracejada' : 'Pontilhada'}`);
  };

  const thicknessOptions = [1, 2, 3, 4, 5, 6, 8, 10];
  const fontSizeOptions = [10, 12, 14, 16, 18, 20, 24, 28, 32];

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[100] bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-2xl flex items-center gap-0.5 px-1 py-1"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Mover */}
      <button
        onClick={onMove}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        title="Mover (M)"
      >
        <Move className="w-4 h-4" />
      </button>

      {/* Editar */}
      <button
        onClick={onEdit}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        title="Editar"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {/* Separador */}
      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Texto (se aplicável) */}
      {selectedDrawing?.type?.includes('text') || selectedDrawing?.type?.includes('note') ? (
        <>
          <button
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Ferramenta de Texto"
          >
            <Type className="w-4 h-4" />
          </button>

          {/* Font Size */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFontSizeMenu(!showFontSizeMenu);
                setShowThicknessMenu(false);
                setShowLineStyleMenu(false);
              }}
              className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors flex items-center gap-1 min-w-[50px]"
              title="Tamanho da Fonte"
            >
              {fontSize}px
              <ChevronDown className="w-3 h-3" />
            </button>

            {showFontSizeMenu && (
              <div className="absolute top-full mt-1 left-0 bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-xl py-1 min-w-[60px] z-[110]">
                {fontSizeOptions.map(size => (
                  <button
                    key={size}
                    onClick={() => handleFontSizeChange(size)}
                    className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${
                      fontSize === size
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Estilo de Linha */}
          <div className="relative">
            <button
              onClick={() => {
                setShowLineStyleMenu(!showLineStyleMenu);
                setShowThicknessMenu(false);
                setShowFontSizeMenu(false);
              }}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Estilo de Linha"
            >
              <Minus className="w-4 h-4" />
            </button>

            {showLineStyleMenu && (
              <div className="absolute top-full mt-1 left-0 bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-xl py-1 min-w-[120px] z-[110]">
                <button
                  onClick={() => handleLineStyleChange('solid')}
                  className={`w-full px-3 py-2 text-xs text-left transition-colors flex items-center gap-2 ${
                    lineStyle === 'solid'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <div className="w-12 h-0.5 bg-current" />
                  Sólida
                </button>
                <button
                  onClick={() => handleLineStyleChange('dashed')}
                  className={`w-full px-3 py-2 text-xs text-left transition-colors flex items-center gap-2 ${
                    lineStyle === 'dashed'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <div className="w-12 h-0.5 border-t-2 border-dashed border-current" />
                  Tracejada
                </button>
                <button
                  onClick={() => handleLineStyleChange('dotted')}
                  className={`w-full px-3 py-2 text-xs text-left transition-colors flex items-center gap-2 ${
                    lineStyle === 'dotted'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <div className="w-12 h-0.5 border-t-2 border-dotted border-current" />
                  Pontilhada
                </button>
              </div>
            )}
          </div>

          {/* Espessura */}
          <div className="relative">
            <button
              onClick={() => {
                setShowThicknessMenu(!showThicknessMenu);
                setShowLineStyleMenu(false);
                setShowFontSizeMenu(false);
              }}
              className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors flex items-center gap-1 min-w-[50px]"
              title="Espessura"
            >
              {thickness}px
              <ChevronDown className="w-3 h-3" />
            </button>

            {showThicknessMenu && (
              <div className="absolute top-full mt-1 left-0 bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-xl py-1 min-w-[60px] z-[110]">
                {thicknessOptions.map(size => (
                  <button
                    key={size}
                    onClick={() => handleThicknessChange(size)}
                    className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${
                      thickness === size
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Estilo de Linha adicional (duplicado para consistência) */}
      <button
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        title="Estilo"
      >
        <Minus className="w-4 h-4" />
      </button>

      {/* Separador */}
      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Configurações */}
      <button
        onClick={() => setShowSettingsModal(!showSettingsModal)}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        title="Configurações"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Notificações/Alertas */}
      <button
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        title="Criar Alerta"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>

      {/* Bloquear/Desbloquear */}
      <button
        onClick={onLockToggle}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        title={selectedDrawing?.isLocked ? 'Desbloquear' : 'Bloquear'}
      >
        {selectedDrawing?.isLocked ? (
          <Lock className="w-4 h-4" />
        ) : (
          <Unlock className="w-4 h-4" />
        )}
      </button>

      {/* Apagar */}
      <button
        onClick={onDelete}
        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
        title="Apagar (Delete)"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Separador */}
      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Três Pontinhos - Menu Mais Opções */}
      <div className="relative" ref={moreMenuRef}>
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Mais Opções"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {showMoreMenu && (
          <div className="absolute top-full mt-1 right-0 bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-xl py-1 min-w-[220px] z-[110]">
            {/* Ordem Visual */}
            <button
              className="w-full px-4 py-2.5 text-sm text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4" />
                Ordem Visual
              </div>
              <ChevronDown className="w-3 h-3 -rotate-90" />
            </button>

            {/* Visibilidade nos Intervalos */}
            <button
              className="w-full px-4 py-2.5 text-sm text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4" />
                Visibilidade nos intervalos
              </div>
              <ChevronDown className="w-3 h-3 -rotate-90" />
            </button>

            {/* Separador */}
            <div className="h-px bg-gray-700 my-1" />

            {/* Duplicar */}
            <button
              onClick={() => {
                if (onDuplicate) onDuplicate();
                setShowMoreMenu(false);
                toast.success('Desenho duplicado');
              }}
              className="w-full px-4 py-2.5 text-sm text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Copy className="w-4 h-4" />
                Duplicar
              </div>
              <span className="text-xs text-gray-500">⌘ + Drag</span>
            </button>

            {/* Copiar */}
            <button
              onClick={() => {
                if (onCopy) onCopy();
                setShowMoreMenu(false);
                toast.success('Desenho copiado');
              }}
              className="w-full px-4 py-2.5 text-sm text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <CheckSquare className="w-4 h-4" />
                Copiar
              </div>
              <span className="text-xs text-gray-500">⌘ + C</span>
            </button>

            {/* Separador */}
            <div className="h-px bg-gray-700 my-1" />

            {/* Ocultar */}
            <button
              onClick={() => {
                if (onHideToggle) onHideToggle();
                setShowMoreMenu(false);
                toast.success(selectedDrawing?.isHidden ? 'Desenho visível' : 'Desenho oculto');
              }}
              className="w-full px-4 py-2.5 text-sm text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-3"
            >
              {selectedDrawing?.isHidden ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              {selectedDrawing?.isHidden ? 'Mostrar' : 'Ocultar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
