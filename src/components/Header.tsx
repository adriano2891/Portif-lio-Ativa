import React from 'react';
import { PlayCircle, Shield } from 'lucide-react';

interface HeaderProps {
  pageName?: string;
  logoUrl?: string;
  title?: string;
  isAdmin?: boolean;
  onNavigateAdmin?: () => void;
  onNavigatePublic?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pageName = 'Apresentação Oficial',
  logoUrl,
  title,
  isAdmin = false,
  onNavigateAdmin,
  onNavigatePublic,
}) => {
  return (
    <header className="w-full border-b border-white/5 bg-[#090a0f]/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-13 sm:h-14 flex items-center justify-between">
        {/* Logo & Nome do Projeto */}
        <div 
          onClick={onNavigatePublic}
          className="flex items-center gap-3 cursor-pointer group"
          id="header-brand"
        >
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={pageName} 
              className="h-8 w-auto max-w-[120px] object-contain rounded"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <PlayCircle className="w-5 h-5 fill-white/20 text-white" />
            </div>
          )}

          <div className="flex flex-col">
            <span className="font-semibold text-slate-100 text-sm tracking-tight group-hover:text-indigo-400 transition-colors">
              {pageName}
            </span>
            {title && (
              <span className="text-xs text-slate-400 hidden sm:inline-block max-w-[280px] truncate">
                {title}
              </span>
            )}
          </div>
        </div>

        {/* Link discreto para o Admin ou para a Landing Page */}
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <button
              onClick={onNavigatePublic}
              id="btn-nav-public"
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all flex items-center gap-1.5"
              title="Voltar para a Landing Page pública"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Ver Página Pública</span>
            </button>
          ) : (
            <button
              onClick={onNavigateAdmin}
              id="btn-nav-admin"
              className="text-slate-500 hover:text-slate-300 text-xs px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 opacity-70 hover:opacity-100"
              title="Acesso Administrativo"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Admin</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
