/**
 * 🎨 DRAWING TOOL DROPDOWN
 * 
 * Menu expansível que aparece ao clicar em ferramentas de desenho
 * Design profissional baseado em TradingView
 * 
 * @version 1.0.0
 * @author Neural Day Trader Platform
 * @date 24 Janeiro 2026
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DrawingToolCategory, DrawingToolItem } from './DrawingSubMenus';

interface DrawingToolDropdownProps {
  categories: DrawingToolCategory[];
  anchor: HTMLElement | null;
  onClose: () => void;
  onToolSelect: (toolId: string) => void;
  onDataWindowToggle?: (enabled: boolean) => void;
}

export function DrawingToolDropdown({ 
  categories, 
  anchor, 
  onClose, 
  onToolSelect,
  onDataWindowToggle
}: DrawingToolDropdownProps) {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const [dataWindowEnabled, setDataWindowEnabled] = useState(true); // 🆕 Estado do toggle
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position dropdown next to anchor element
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.right + 8 // 8px gap
      });
    }
  }, [anchor]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        anchor &&
        !anchor.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchor, onClose]);

  if (!anchor) return null;

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[200] bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-2xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        minWidth: '280px',
        maxWidth: '380px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}
    >
      {categories.map((category, categoryIndex) => (
        <div key={category.id}>
          {/* Category Header */}
          <div className="px-4 py-2 bg-[#1a1a1a] border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {category.name}
            </span>
          </div>

          {/* Category Tools */}
          <div className="py-1">
            {category.tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    onToolSelect(tool.id);
                    onClose();
                  }}
                  onMouseEnter={() => setHoveredTool(tool.id)}
                  onMouseLeave={() => setHoveredTool(null)}
                  className={`
                    w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-3
                    ${hoveredTool === tool.id 
                      ? 'bg-gray-700/50 text-white' 
                      : 'text-gray-300 hover:bg-gray-700/30'
                    }
                  `}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {Icon && <Icon className="w-4 h-4 text-gray-400 shrink-0" />}
                    <span>{tool.name}</span>
                  </div>
                  {tool.shortcut && (
                    <span className="text-xs text-gray-500 ml-4 shrink-0">{tool.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Separator between categories */}
          {categoryIndex < categories.length - 1 && (
            <div className="h-px bg-gray-800 my-1" />
          )}
        </div>
      ))}
    </motion.div>
  );
}

// ========== EMOJI PICKER COMPONENT ==========
interface EmojiPickerProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

export function EmojiPicker({ anchorEl, onClose, onSelectEmoji }: EmojiPickerProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'emojis' | 'stickers' | 'icons'>('emojis');

  // Position dropdown
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.right + 8
      });
    }
  }, [anchorEl]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorEl, onClose]);

  if (!anchorEl) return null;

  // Emojis populares para trading
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
    '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛',
    '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '😐',
    '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪',
    '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶',
    '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁',
    '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰',
    '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫',
    '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩',
    '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹',
    '💪', '👍', '👎', '👊', '✊', '🤛', '🤜', '🤚', '👋', '🤟',
    '✌️', '🤞', '🤘', '👌', '👈', '👉', '👆', '👇', '☝️', '✋',
    '🤙', '💰', '💵', '💴', '💶', '💷', '💸', '💳', '🏦', '📈',
    '📉', '📊', '💹', '🎯', '🔥', '⚡', '✨', '💥', '💫', '🚀',
    '🎉', '🎊', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '⭐', '🌟'
  ];

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[200] bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-2xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: '400px',
        maxHeight: '500px'
      }}
    >
      {/* Header */}
      <div className="px-4 py-2 bg-[#1a1a1a] border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          SMILES & PESSOAS
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('emojis')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'emojis'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Emojis
        </button>
        <button
          onClick={() => setActiveTab('stickers')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'stickers'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Stickers
        </button>
        <button
          onClick={() => setActiveTab('icons')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'icons'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Ícones
        </button>
      </div>

      {/* Emoji Grid */}
      {activeTab === 'emojis' && (
        <div className="p-3 grid grid-cols-8 gap-2 max-h-[400px] overflow-y-auto">
          {emojis.map((emoji, index) => (
            <button
              key={index}
              onClick={() => {
                onSelectEmoji(emoji);
                onClose();
              }}
              className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-gray-700/50 rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'stickers' && (
        <div className="p-8 text-center text-gray-500">
          <p className="text-sm">Stickers em breve</p>
        </div>
      )}

      {activeTab === 'icons' && (
        <div className="p-8 text-center text-gray-500">
          <p className="text-sm">Ícones personalizados em breve</p>
        </div>
      )}
    </motion.div>
  );
}