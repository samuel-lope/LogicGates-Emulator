import React, { useState } from 'react';

interface CommandLineProps {
  onExecuteCommand: (command: string) => void;
}

const CommandLine: React.FC<CommandLineProps> = ({ onExecuteCommand }) => {
  const [command, setCommand] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onExecuteCommand(command);
      setCommand('');
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center bg-[#1e1e1e]/90 border border-zinc-700 rounded-lg p-1.5 shadow-xl backdrop-blur-md z-50 transition-all focus-within:ring-1 focus-within:ring-blue-500">
      <form onSubmit={handleSubmit} className="flex w-full items-center">
        <span className="text-zinc-500 font-mono font-bold ml-2 mr-1">&gt;</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Ex: ADD OR 4 ou EDIT COLOR RED"
          className="bg-transparent text-white outline-none px-2 py-1 flex-1 font-mono text-sm min-w-[300px] placeholder:text-zinc-600"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="submit"
          disabled={!command.trim()}
          className="ml-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
        >
          Enviar
        </button>
      </form>
    </div>
  );
};

export default CommandLine;
