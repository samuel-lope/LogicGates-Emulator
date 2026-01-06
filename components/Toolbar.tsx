import React, { useRef } from 'react';
import { GateType, InteractionMode } from '../types';
import { COMPONENT_CONFIGS } from '../constants';
import { MousePointer2, Plus, Download, Upload, Grid } from 'lucide-react';

interface ToolbarProps {
  onSelectTool: (mode: InteractionMode, gateType?: GateType) => void;
  currentMode: InteractionMode;
  selectedGateType: GateType | null;
  onSave: () => void;
  onLoad: (file: File) => void;
  onOpenKarnaugh: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onSelectTool, 
  currentMode, 
  selectedGateType,
  onSave,
  onLoad,
  onOpenKarnaugh
}) => {
  const gates = Object.values(COMPONENT_CONFIGS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoad(file);
    }
    // Reset input so the same file can be loaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="absolute left-4 top-4 bottom-4 w-64 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-10">
      <div className="p-4 border-b border-zinc-700 bg-zinc-800/50">
        <h1 className="text-xl font-bold font-mono text-white tracking-tight">LogicGateSim</h1>
        <p className="text-xs text-zinc-400 mt-1">Web Edition v1.0</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Project Section */}
        <div>
          <h2 className="text-xs uppercase font-semibold text-zinc-500 mb-3 tracking-wider">Project</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onSave}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700"
              title="Download JSON"
            >
              <Download size={18} className="mb-1" />
              <span className="text-[10px] font-medium">Save</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-3 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors border border-zinc-700"
              title="Upload JSON"
            >
              <Upload size={18} className="mb-1" />
              <span className="text-[10px] font-medium">Load</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".json" 
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Tools Section */}
        <div>
          <h2 className="text-xs uppercase font-semibold text-zinc-500 mb-3 tracking-wider">Tools</h2>
          <div className="space-y-2">
            <button
              onClick={() => onSelectTool(InteractionMode.IDLE)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                currentMode === InteractionMode.IDLE
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <MousePointer2 size={18} />
              <span className="font-medium">Selection / Drag</span>
            </button>
            
            <button
              onClick={onOpenKarnaugh}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700/50 hover:border-zinc-500 transition-all duration-200"
            >
              <Grid size={18} className="text-purple-400" />
              <div className="flex flex-col items-start">
                <span className="font-medium text-sm">Truth Table</span>
                <span className="text-[10px] text-zinc-500">Auto-Generate Circuit</span>
              </div>
            </button>
          </div>
        </div>

        {/* Components Section */}
        <div>
          <h2 className="text-xs uppercase font-semibold text-zinc-500 mb-3 tracking-wider">Components</h2>
          <div className="grid grid-cols-1 gap-2">
            {gates.map((gate) => (
              <button
                key={gate.type}
                onClick={() => onSelectTool(InteractionMode.PLACING, gate.type)}
                className={`flex items-center p-2 rounded-lg border transition-all duration-200 group relative ${
                  currentMode === InteractionMode.PLACING && selectedGateType === gate.type
                    ? 'bg-zinc-800 border-green-500 text-green-400 shadow-[0_0_15px_rgba(0,255,65,0.1)]'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {/* Visual Symbol Box */}
                <div className="w-12 h-9 bg-zinc-900/50 rounded border border-zinc-700/50 flex items-center justify-center mr-3 shrink-0 overflow-hidden">
                   {gate.imageSrc ? (
                      <img src={gate.imageSrc} alt={gate.label} className="w-full h-full object-contain p-1 opacity-90" />
                   ) : (
                      <span className="text-[10px] font-mono opacity-50">{gate.label}</span>
                   )}
                </div>

                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="font-bold font-mono text-sm group-hover:text-white transition-colors">{gate.label}</span>
                  <span className="text-[10px] text-zinc-500 leading-tight mt-0.5 truncate w-full">{gate.description}</span>
                </div>
                
                <div className={`ml-2 transition-opacity ${currentMode === InteractionMode.PLACING && selectedGateType === gate.type ? 'opacity-100 text-green-500' : 'opacity-0 group-hover:opacity-50'}`}>
                    <Plus size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3 bg-zinc-950 text-[10px] text-zinc-500 text-center font-mono border-t border-zinc-800">
        Left Click: Place/Select<br/>
        Right Click: Context Menu / Pan<br/>
        Wheel: Zoom
      </div>
    </div>
  );
};

export default Toolbar;