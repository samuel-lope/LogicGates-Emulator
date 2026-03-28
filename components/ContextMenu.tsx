import React, { useEffect, useRef } from 'react';
import { Copy, Trash2, Minus, Plus, Activity, MoveRight, Wifi } from 'lucide-react';
import { GateType, WireCurveType } from '../types';
import { LED_COLORS } from '../constants';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeType?: GateType;
  currentColor?: string;
  inputCount?: number;
  wireCurveType?: WireCurveType;
  onColorChange?: (color: string) => void;
  onInputCountChange?: (delta: number) => void;
  onChangeWireCurveType?: (type: WireCurveType) => void;
  onChangeNodeType?: (type: GateType) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  x, 
  y, 
  nodeType, 
  currentColor, 
  inputCount,
  wireCurveType,
  onColorChange, 
  onInputCountChange,
  onChangeWireCurveType,
  onChangeNodeType,
  onDuplicate, 
  onDelete, 
  onClose 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    // Use mousedown to detect outside clicks earlier than click
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Determine if this node type supports variable inputs
  const supportsVariableInputs = nodeType && [
    GateType.AND, 
    GateType.OR, 
    GateType.NAND, 
    GateType.NOR, 
    GateType.XOR
  ].includes(nodeType);

  return (
    <div 
      ref={menuRef}
      className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px] flex flex-col"
      style={{ top: y, left: x }}
    >
      {/* Node Type Selector */}
      {nodeType && [GateType.AND, GateType.OR, GateType.NAND, GateType.NOR, GateType.XOR, GateType.NOT].includes(nodeType) && onChangeNodeType && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">Gate Type</div>
          <select
            value={nodeType}
            onChange={(e) => { e.stopPropagation(); onChangeNodeType(e.target.value as GateType); }}
            className="w-full bg-zinc-700 text-white text-xs rounded p-1 border border-zinc-600 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value={GateType.AND}>AND</option>
            <option value={GateType.OR}>OR</option>
            <option value={GateType.NAND}>NAND</option>
            <option value={GateType.NOR}>NOR</option>
            <option value={GateType.XOR}>XOR</option>
            <option value={GateType.NOT}>NOT</option>
          </select>
        </div>
      )}

      {/* Color Selector */}
      {(nodeType === GateType.OUTPUT_LAMP || !nodeType) && onColorChange && (
        <div className="px-4 py-2 border-b border-zinc-700">
           <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">{nodeType ? 'LED Color' : 'Wire Color'}</div>
           <div className="flex gap-2 items-center">
             {Object.entries(LED_COLORS).map(([name, color]) => (
               <button
                 key={name}
                 onClick={(e) => { e.stopPropagation(); onColorChange(color); }}
                 className={`w-4 h-4 rounded-full border border-zinc-600 transition-transform hover:scale-110 cursor-pointer ${currentColor === color ? 'ring-1 ring-white' : ''}`}
                 style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}40` }}
                 title={name}
               />
             ))}
             {!nodeType && (
               <button
                 onClick={(e) => { e.stopPropagation(); onColorChange(''); }}
                 className={`text-[10px] px-1.5 py-0.5 rounded border border-zinc-600 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors ${!currentColor ? 'bg-zinc-700 text-white' : ''}`}
                 title="Default Color"
               >
                 Default
               </button>
             )}
           </div>
        </div>
      )}

      {/* Input Count Selector */}
      {supportsVariableInputs && onInputCountChange && inputCount !== undefined && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">Inputs: {inputCount}</div>
          <div className="flex items-center justify-between bg-zinc-700 rounded p-1">
            <button
              onClick={(e) => { e.stopPropagation(); onInputCountChange(-1); }}
              disabled={inputCount <= 2}
              className={`p-1 rounded hover:bg-zinc-600 text-zinc-200 transition-colors ${inputCount <= 2 ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <Minus size={14} />
            </button>
            <span className="text-xs font-mono text-white">{inputCount}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onInputCountChange(1); }}
              disabled={inputCount >= 32}
              className={`p-1 rounded hover:bg-zinc-600 text-zinc-200 transition-colors ${inputCount >= 32 ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Wire Curve Type Selector */}
      {wireCurveType && onChangeWireCurveType && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">Wire Type</div>
          <div className="flex gap-1 bg-zinc-700 rounded p-1">
            <button
              onClick={(e) => { e.stopPropagation(); onChangeWireCurveType('curved'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors ${wireCurveType === 'curved' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title="Curved"
            >
              <Activity size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onChangeWireCurveType('straight'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors ${wireCurveType === 'straight' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title="Straight"
            >
              <MoveRight size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onChangeWireCurveType('remote'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors ${wireCurveType === 'remote' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title="Remote"
            >
              <Wifi size={14} />
            </button>
          </div>
        </div>
      )}

      {nodeType && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Copy size={14} />
          Duplicate
        </button>
      )}
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-700 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
      >
        <Trash2 size={14} />
        Delete
      </button>
    </div>
  );
};