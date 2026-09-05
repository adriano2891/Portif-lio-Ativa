import React, { useEffect, useState } from 'react';
import { VideoSettings } from '../types';
import { getPublicVideo, trackEvent } from '../services/api';
import { VideoPlayer } from './VideoPlayer';
import { EmptyState } from './EmptyState';

interface PublicLandingProps {
  onNavigateAdmin: () => void;
}

export const PublicLanding: React.FC<PublicLandingProps> = ({ onNavigateAdmin }) => {
  const [videoData, setVideoData] = useState<VideoSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carregar configurações públicas persistentes
    const loadData = async () => {
      setLoading(true);
      const data = await getPublicVideo();
      setVideoData(data);
      setLoading(false);

      // Atualiza dinamicamente o favicon para o ícone customizado
      const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (favicon) {
        favicon.href = 'https://i.ibb.co/R4gxhsb1/Design-sem-nome-1.png';
      }

      // Registrar visualização da página (Requisito 10)
      trackEvent('page_view');
    };

    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white relative">
      {/* Conteúdo Principal posicionado no topo absoluto */}
      <main className="flex-1 flex flex-col justify-start max-w-6xl w-full mx-auto px-2 sm:px-4 lg:px-6 pt-1 sm:pt-2 pb-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Carregando apresentação...</p>
          </div>
        ) : !videoData || !videoData.is_active || !videoData.video_preview_url ? (
          /* Estado sem vídeo configurado (Requisito 16) */
          <EmptyState onAdminClick={onNavigateAdmin} />
        ) : (
          <div className="w-full flex flex-col items-center space-y-2">
            {/* Título da Página posicionado no topo */}
            {videoData.title && (
              <div className="text-center max-w-3xl mx-auto px-2">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight break-words">
                  {videoData.title}
                </h1>
              </div>
            )}

            {/* Player de Vídeo Responsivo posicionado diretamente no topo */}
            <div className="w-full flex justify-center pt-0">
              <VideoPlayer
                previewUrl={videoData.video_preview_url}
                originalUrl={videoData.video_original_url}
                fileId={videoData.video_file_id}
                coverImage={videoData.cover_image}
                title={videoData.title}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
