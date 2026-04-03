import React, { useState, useEffect, useRef } from 'react';
import { cliEngine } from '../services/cliEngine';
import { CircuitNode } from '../types';
import { useTranslation } from '../locales';

interface CommandLineProps {
  onExecuteCommand: (command: string) => void;
  nodes: CircuitNode[];
  onHoverSuggestion?: (id: string | null) => void;
}

const CommandLine: React.FC<CommandLineProps> = ({ onExecuteCommand, nodes, onHoverSuggestion }) => {
  const { t } = useTranslation();
  const [command, setCommand] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!command.trim() && !command.endsWith(' ')) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }

    const filtered = cliEngine.getSuggestions(command, { nodes });
    setSuggestions(filtered);
    setSelectedIndex(-1);
  }, [command]);

  useEffect(() => {
    if (onHoverSuggestion) {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        const suggestion = suggestions[selectedIndex];
        if (suggestion && suggestion.length >= 4) {
          const hoveredNode = nodes.find(n => n.id.toLowerCase().startsWith(suggestion.toLowerCase()));
          onHoverSuggestion(hoveredNode ? hoveredNode.id : null);
        } else {
          onHoverSuggestion(null);
        }
      } else {
        onHoverSuggestion(null);
      }
    }
    
    return () => {
       if (onHoverSuggestion) onHoverSuggestion(null);
    };
  }, [selectedIndex, suggestions, nodes, onHoverSuggestion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onExecuteCommand(command);
      setCommand('');
      setSuggestions([]);
    }
  };

  const applySuggestion = (suggestion: string) => {
    const parts = command.split(' ');
    parts[parts.length - 1] = suggestion;
    const newCommand = parts.join(' ') + ' ';
    setCommand(newCommand);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          applySuggestion(suggestions[selectedIndex]);
        } else if (suggestions.length === 1) {
          applySuggestion(suggestions[0]);
        } else if (suggestions.length > 0 && selectedIndex === -1) {
          applySuggestion(suggestions[0]);
        }
      }
    } else if (e.key === 'Tab' && !command) {
       e.preventDefault();
       setSuggestions(cliEngine.getSuggestions(' '));
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
      {/* Suggestions Dropdown */}
      {suggestions.length > 0 && (
        <div className="mb-2 w-[500px] bg-[#1e1e1e]/95 border border-zinc-700/80 rounded-lg shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          <ul className="py-1 max-h-48 overflow-y-auto custom-scrollbar">
            {suggestions.map((sug, idx) => (
              <li 
                key={sug}
                className={`px-3 py-1.5 text-xs font-mono cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-blue-600/40 text-blue-200 border-l-2 border-blue-400' : 'text-zinc-300 hover:bg-zinc-800 border-l-2 border-transparent'}`}
                onClick={() => applySuggestion(sug)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                {sug}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Input */}
      <div className="flex items-center bg-[#1e1e1e]/90 border border-zinc-700 rounded-lg p-1.5 shadow-xl backdrop-blur-md transition-all focus-within:ring-1 focus-within:ring-blue-500 w-[500px]">
        <form onSubmit={handleSubmit} className="flex w-full items-center">
          <span className="text-zinc-500 font-mono font-bold ml-2 mr-1">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('commandLine.placeholder')}
            className="bg-transparent text-white outline-none px-2 py-1 flex-1 font-mono text-sm placeholder:text-zinc-600"
            autoComplete="off"
            spellCheck="false"
          />
          <button
            type="submit"
            disabled={!command.trim()}
            className="ml-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
          >
            {t('commandLine.submit')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CommandLine;
