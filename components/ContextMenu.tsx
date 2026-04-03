import React, { useEffect, useRef } from 'react';
import { Copy, Trash2, Minus, Plus, Activity, MoveRight, Wifi, MoreHorizontal, Table } from 'lucide-react';
import { GateType, WireCurveType, WireStyle } from '../types';
import { LED_COLORS, GATE_COLORS } from '../constants';
import { useTranslation } from '../locales';

interface ContextMenuProps {
  x: number;
  y: number;
  nodeType?: GateType;
  currentColor?: string;
  inputCount?: number;
  outputCount?: number;
  wireCurveType?: WireCurveType;
  wireStyle?: WireStyle;
  shape?: 'circle' | 'square';
  onColorChange?: (color: string) => void;
  onInputCountChange?: (delta: number) => void;
  onOutputCountChange?: (delta: number) => void;
  onChangeWireCurveType?: (type: WireCurveType) => void;
  onChangeWireStyle?: (style: WireStyle) => void;
  onChangeNodeType?: (type: GateType) => void;
  onChangeShape?: (shape: 'circle' | 'square') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  onShowTruthTable?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  nodeType,
  currentColor,
  inputCount,
  outputCount,
  wireCurveType,
  wireStyle,
  shape,
  onColorChange,
  onInputCountChange,
  onOutputCountChange,
  onChangeWireCurveType,
  onChangeWireStyle,
  onChangeNodeType,
  onChangeShape,
  onDuplicate,
  onDelete,
  onClose,
  onShowTruthTable
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const supportsVariableInputs = nodeType && [
    GateType.AND,
    GateType.OR,
    GateType.NAND,
    GateType.NOR,
    GateType.XOR
  ].includes(nodeType);

  const isLogicGate = nodeType && [
    GateType.AND,
    GateType.OR,
    GateType.NAND,
    GateType.NOR,
    GateType.XOR,
    GateType.NOT,
    GateType.DERIVATION
  ].includes(nodeType);

  const colorSectionLabel = () => {
    if (isLogicGate) return t('contextMenu.colorGate');
    if (nodeType === GateType.DERIVATION) return t('contextMenu.colorDerivation');
    if (nodeType) return t('contextMenu.colorLed');
    return t('contextMenu.colorWire');
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px] flex flex-col"
      style={{ top: y, left: x }}
    >
      {/* Node Type Selector */}
      {isLogicGate && onChangeNodeType && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">{t('contextMenu.gateType')}</div>
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
            <option value={GateType.DERIVATION}>{t('contextMenu.derivationType')}</option>
          </select>
        </div>
      )}

      {/* Shape Selector */}
      {nodeType === GateType.DERIVATION && onChangeShape && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">{t('contextMenu.shape')}</div>
          <div className="flex gap-1 bg-zinc-700 rounded p-1">
            <button
              onClick={(e) => { e.stopPropagation(); onChangeShape('circle'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors cursor-pointer ${shape === 'circle' || !shape ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title={t('contextMenu.shapeCircle')}
            >
              <div className="w-3 h-3 rounded-full border-2 border-current" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onChangeShape('square'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors cursor-pointer ${shape === 'square' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title={t('contextMenu.shapeSquare')}
            >
              <div className="w-3 h-3 border-2 border-current" />
            </button>
          </div>
        </div>
      )}

      {/* Color Selector */}
      {(nodeType === GateType.OUTPUT_LAMP || nodeType === GateType.DERIVATION || !nodeType || isLogicGate) && onColorChange && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">
            {colorSectionLabel()}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {Object.entries(isLogicGate || nodeType === GateType.DERIVATION ? GATE_COLORS : LED_COLORS).map(([name, color]) => (
              <button
                key={name}
                onClick={(e) => { e.stopPropagation(); onColorChange(color); }}
                className={`w-4 h-4 rounded-full border border-zinc-600 transition-transform hover:scale-110 cursor-pointer ${currentColor === color ? 'ring-1 ring-white' : ''}`}
                style={{ backgroundColor: color, boxShadow: isLogicGate || nodeType === GateType.DERIVATION ? 'none' : `0 0 5px ${color}40` }}
                title={name}
              />
            ))}
            {(!nodeType || isLogicGate || nodeType === GateType.DERIVATION) && (
              <button
                onClick={(e) => { e.stopPropagation(); onColorChange(''); }}
                className={`text-[10px] px-1.5 py-0.5 rounded border border-zinc-600 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer ${!currentColor ? 'bg-zinc-700 text-white' : ''}`}
                title={t('contextMenu.colorDefault')}
              >
                {t('contextMenu.colorDefault')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input Count Selector */}
      {supportsVariableInputs && onInputCountChange && inputCount !== undefined && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">{t('contextMenu.inputs')}: {inputCount}</div>
          <div className="flex items-center justify-between bg-zinc-700 rounded p-1">
            <button
              onClick={(e) => { e.stopPropagation(); onInputCountChange(-1); }}
              disabled={inputCount <= 2}
              className={`p-1 rounded hover:bg-zinc-600 text-zinc-200 transition-colors cursor-pointer ${inputCount <= 2 ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <Minus size={14} />
            </button>
            <span className="text-xs font-mono text-white">{inputCount}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onInputCountChange(1); }}
              disabled={inputCount >= 32}
              className={`p-1 rounded hover:bg-zinc-600 text-zinc-200 transition-colors cursor-pointer ${inputCount >= 32 ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Wire Curve Type Selector */}
      {wireCurveType && onChangeWireCurveType && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">{t('contextMenu.wireType')}</div>
          <div className="flex gap-1 bg-zinc-700 rounded p-1">
            <button
              onClick={(e) => { e.stopPropagation(); onChangeWireCurveType('curved'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors cursor-pointer ${wireCurveType === 'curved' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title={t('contextMenu.wireCurvedTitle')}
            >
              <Activity size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onChangeWireCurveType('straight'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors cursor-pointer ${wireCurveType === 'straight' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title={t('contextMenu.wireStraightTitle')}
            >
              <MoveRight size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onChangeWireCurveType('remote'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors cursor-pointer ${wireCurveType === 'remote' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title={t('contextMenu.wireRemoteTitle')}
            >
              <Wifi size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Wire Style Selector */}
      {!nodeType && wireCurveType && wireStyle && onChangeWireStyle && wireCurveType !== 'remote' && (
        <div className="px-4 py-2 border-b border-zinc-700">
          <div className="text-[10px] text-zinc-500 mb-2 uppercase font-semibold">{t('contextMenu.wireStyle')}</div>
          <div className="flex gap-1 bg-zinc-700 rounded p-1">
            <button
              onClick={(e) => { e.stopPropagation(); onChangeWireStyle('solid'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors cursor-pointer ${wireStyle === 'solid' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title={t('contextMenu.wireSolid')}
            >
              <Minus size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onChangeWireStyle('dots'); }}
              className={`flex-1 flex justify-center p-1.5 rounded transition-colors cursor-pointer ${wireStyle === 'dots' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'}`}
              title={t('contextMenu.wireDots')}
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>
      )}

      {nodeType && supportsVariableInputs && onShowTruthTable && (
        <button
          onClick={(e) => { e.stopPropagation(); onShowTruthTable(); onClose(); }}
          className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2 transition-colors cursor-pointer border-b border-zinc-700"
        >
          <Table size={14} />
          {t('contextMenu.truthTable')}
        </button>
      )}

      {nodeType && (
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Copy size={14} />
          {t('contextMenu.duplicate')}
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-700 hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
      >
        <Trash2 size={14} />
        {t('contextMenu.delete')}
      </button>
    </div>
  );
};