import React from 'react';
import { Film, ShieldAlert } from 'lucide-react';

interface EmptyStateProps {
  onAdminClick?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onAdminClick }) => {
  return (
    <div 
      id="empty-state-card"
      className="w-full max-w-3xl mx-auto my-12 p-8 sm:p-12 rounded-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-slate-800/80 text-center backdrop-blur-sm shadow-2xl relative overflow-hidden"
    >
      {/* Luz ambiente sutil */}
      <div className="absolute inset-0 bg-indigo-500/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
          <Film className="w-8 h-8 stroke-[1.5]" />
        </div>

        <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-200">
          Conteúdo em breve.
        </h3>

        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          O vídeo desta página está sendo preparado e estará disponível para reprodução em instantes.
        </p>

        {onAdminClick && (
          <div className="pt-4">
            <button
              onClick={onAdminClick}
              id="empty-state-admin-btn"
              className="inline-flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-4 py-2 rounded-lg transition-all"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Você é o administrador? Configurar vídeo agora</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
