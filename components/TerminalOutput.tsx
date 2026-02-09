import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface TerminalOutputProps {
  logs: string[];
  isAnalyzing: boolean;
  onClose: () => void;
}

const TerminalOutput: React.FC<TerminalOutputProps> = ({ logs, isAnalyzing, onClose }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/90 border-t-2 border-green-500 backdrop-blur-sm max-h-[40vh] flex flex-col z-50 transition-all duration-300">
      <div className="flex items-center justify-between px-4 py-2 bg-green-900/20 border-b border-green-500/30">
        <div className="flex items-center gap-2 text-green-500">
          <Terminal size={16} />
          <span className="text-xs font-bold tracking-wider">TERMINAL_OUTPUT // SYSTEM.LOG</span>
        </div>
        <button 
          onClick={onClose}
          className="text-green-500 hover:text-white hover:bg-green-900/50 px-2 py-1 rounded text-xs uppercase"
        >
          [Close]
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto font-mono text-sm space-y-2 flex-1">
        {logs.map((log, index) => (
          <div key={index} className="break-words">
            <span className="text-green-700 mr-2">[{new Date().toLocaleTimeString()}]</span>
            <span className="text-green-400 typing-effect">{log}</span>
          </div>
        ))}
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-green-500 animate-pulse">
            <span className="w-2 h-4 bg-green-500 block"></span>
            <span>DECODING DATA STREAM...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default TerminalOutput;