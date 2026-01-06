import React, { useState, useEffect } from 'react';
import { X, Wand2, RefreshCw } from 'lucide-react';

interface KarnaughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (numVars: number, truthTable: boolean[]) => void;
}

export const KarnaughModal: React.FC<KarnaughModalProps> = ({ isOpen, onClose, onGenerate }) => {
  const [numVars, setNumVars] = useState<number>(3);
  const [truthTable, setTruthTable] = useState<boolean[]>([]);

  // Initialize truth table when numVars changes
  useEffect(() => {
    setTruthTable(new Array(Math.pow(2, numVars)).fill(false));
  }, [numVars]);

  if (!isOpen) return null;

  const handleToggle = (index: number) => {
    const newTable = [...truthTable];
    newTable[index] = !newTable[index];
    setTruthTable(newTable);
  };

  const getBinaryString = (index: number) => {
    return index.toString(2).padStart(numVars, '0');
  };

  const variableNames = ['A', 'B', 'C', 'D'].slice(0, numVars);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex justify-between items-center bg-zinc-800/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-md">
                <Wand2 size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Truth Table Generator</h2>
              <p className="text-xs text-zinc-400">Uses Quine-McCluskey method to simplify logic</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto flex gap-6 flex-col md:flex-row">
          
          {/* Settings */}
          <div className="w-full md:w-1/3 space-y-6">
            <div>
              <label className="block text-xs uppercase font-bold text-zinc-500 mb-2">Variables</label>
              <div className="flex bg-zinc-800 p-1 rounded-lg">
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setNumVars(n)}
                    className={`flex-1 py-1.5 text-sm font-mono rounded ${
                      numVars === n ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 mt-2">
                Select number of inputs. The table will update automatically.
              </p>
            </div>

            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
              <h3 className="text-sm font-bold text-zinc-300 mb-2">Instructions</h3>
              <ul className="text-xs text-zinc-400 space-y-1 list-disc pl-4">
                <li>Toggle the <b>Output (Q)</b> column bits.</li>
                <li>Red rows indicate "High" (1) outputs.</li>
                <li>Click Generate to create the optimized circuit.</li>
              </ul>
            </div>
          </div>

          {/* Table */}
          <div className="w-full md:w-2/3 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
            <div className="grid bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-mono text-xs font-bold py-2 px-4 sticky top-0" 
                 style={{ gridTemplateColumns: `repeat(${numVars}, 1fr) 2fr` }}>
              {variableNames.map(v => <div key={v} className="text-center">{v}</div>)}
              <div className="text-center text-blue-400">Output (Q)</div>
            </div>

            <div className="overflow-y-auto flex-1 max-h-[400px]">
              {truthTable.map((val, idx) => (
                <div 
                  key={idx}
                  className={`grid items-center py-1.5 px-4 font-mono text-sm border-b border-zinc-800/50 transition-colors ${
                    val ? 'bg-blue-900/10 hover:bg-blue-900/20' : 'hover:bg-zinc-800'
                  }`}
                  style={{ gridTemplateColumns: `repeat(${numVars}, 1fr) 2fr` }}
                >
                  {getBinaryString(idx).split('').map((bit, bitIdx) => (
                    <div key={bitIdx} className={`text-center ${bit === '1' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {bit}
                    </div>
                  ))}
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleToggle(idx)}
                      className={`w-12 py-0.5 rounded text-xs font-bold border transition-all ${
                        val 
                          ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
                          : 'bg-zinc-800 border-zinc-600 text-zinc-500 hover:border-zinc-500'
                      }`}
                    >
                      {val ? '1' : '0'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 bg-zinc-800/50 rounded-b-xl flex justify-end gap-3">
          <button 
            onClick={() => setTruthTable(new Array(Math.pow(2, numVars)).fill(false))}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-700 flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Reset
          </button>
          <button 
            onClick={() => onGenerate(numVars, truthTable)}
            className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all hover:scale-105"
          >
            <Wand2 size={16} />
            Generate Circuit
          </button>
        </div>
      </div>
    </div>
  );
};