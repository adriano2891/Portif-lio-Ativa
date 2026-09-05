import React, { useState, useRef, useEffect } from 'react';
import { Play, AlertCircle, RefreshCw, Film, MonitorPlay, Maximize, Smartphone, Tv } from 'lucide-react';
import { trackEvent } from '../services/api';
import { parseGoogleDriveVideoUrl } from '../utils/googleDrive';
import { normalizeImageUrl } from '../utils/imageUrl';

interface VideoPlayerProps {
  previewUrl: string;
  originalUrl?: string;
  coverImage?: string;
  title?: string;
  fileId?: string;
  onPlayRecorded?: () => void;
  autoPlayOnMount?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  previewUrl,
  originalUrl,
  coverImage,
  title,
  fileId: propFileId,
  onPlayRecorded,
  autoPlayOnMount = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlayOnMount);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [playerMode, setPlayerMode] = useState<'stream' | 'iframe'>('stream');
  const [iframeKey, setIframeKey] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<'16-9' | '9-16' | '1-1' | 'auto'>('auto');
  const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('contain');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Detectar a resolução intrínseca do vídeo quando o arquivo carregar metadados
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const { videoWidth, videoHeight } = videoRef.current;
      if (videoWidth && videoHeight) {
        const ratio = videoWidth / videoHeight;
        if (ratio < 0.75) {
          // Formato vertical (ex.: 9:16 ou gravação de celular / stories / reels / whatsapp)
          setAspectRatio('9-16');
        } else if (ratio >= 0.75 && ratio <= 1.2) {
          // Formato quadrado
          setAspectRatio('1-1');
        } else {
          // Formato paisagem / widescreen
          setAspectRatio('16-9');
        }
      }
    }
  };

  // Extrair ID do arquivo se não tiver sido passado explicitamente
  const resolvedFileId = React.useMemo(() => {
    if (propFileId) return propFileId;
    if (originalUrl) {
      const parsed = parseGoogleDriveVideoUrl(originalUrl);
      if (parsed.fileId) return parsed.fileId;
    }
    if (previewUrl) {
      const parsed = parseGoogleDriveVideoUrl(previewUrl);
      if (parsed.fileId) return parsed.fileId;
    }
    return null;
  }, [propFileId, originalUrl, previewUrl]);

  // Se não houver resolvedFileId, recai para o iframe
  const canUseStream = Boolean(resolvedFileId);
  const activeMode = canUseStream && !streamError ? playerMode : 'iframe';
  const directStreamUrl = resolvedFileId ? `/api/public/video-stream/${resolvedFileId}` : '';

  const handleStartPlay = () => {
    setIsPlaying(true);
    setStreamError(false);

    // Registrar métrica de reprodução no banco persistente
    trackEvent('video_play');
    if (onPlayRecorded) {
      onPlayRecorded();
    }

    // Iniciar vídeo nativo após renderizar
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch((err) => {
          console.warn('Autoplay bloqueado pelo navegador, aguardando interação:', err);
        });
      }
    }, 100);
  };

  const handleReload = () => {
    setStreamError(false);
    setIframeKey((prev) => prev + 1);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  const handleVideoError = () => {
    console.warn('Erro ao carregar stream direto do vídeo. Alternando para player Google Drive...');
    setStreamError(true);
    setPlayerMode('iframe');
  };

  return (
    <div className="w-full flex flex-col items-center" id="video-player-section">
      {/* Player Container responsivo para todos os dispositivos (Mobile, Tablet, Desktop, Widescreen) */}
      <div 
        id="video-player-container"
        className={`w-full relative rounded-xl sm:rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 ring-1 ring-white/5 flex items-center justify-center group transition-all duration-300 ${
          aspectRatio === '9-16'
            ? 'max-w-md aspect-[9/16] max-h-[82vh]'
            : aspectRatio === '1-1'
            ? 'max-w-2xl aspect-square max-h-[75vh]'
            : 'max-w-5xl aspect-video max-h-[85vh]'
        }`}
      >
        {/* Glow de fundo sutil */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-sky-500/10 to-purple-500/20 rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition duration-1000 -z-10" />

        {!isPlaying ? (
          /* Thumbnail / Poster Interativo com botão de Play */
          <div 
            onClick={handleStartPlay}
            id="video-poster-overlay"
            className="absolute inset-0 w-full h-full cursor-pointer flex flex-col items-center justify-center select-none bg-cover bg-center transition-transform duration-500"
            style={{
              backgroundImage: normalizeImageUrl(coverImage)
                ? `linear-gradient(to top, rgba(9,10,15,0.85) 0%, rgba(9,10,15,0.4) 50%, rgba(9,10,15,0.85) 100%), url("${normalizeImageUrl(coverImage)}")`
                : 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #090a0f 100%)',
            }}
          >
            {/* Botão de Play Centralizado com Pulso */}
            <div className="relative group/btn flex items-center justify-center">
              <div className="absolute -inset-3 bg-indigo-500/30 rounded-full blur-md group-hover/btn:bg-indigo-500/50 transition-all duration-300 animate-pulse" />
              <button
                id="btn-play-hero"
                aria-label="Iniciar reprodução do vídeo"
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-600/90 text-white flex items-center justify-center pl-1 shadow-2xl border border-indigo-400/40 transform transition-transform duration-300 group-hover/btn:scale-110 active:scale-95 hover:bg-indigo-500"
              >
                <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-white" />
              </button>
            </div>
          </div>
        ) : (
          /* REPRODUTOR ATIVO */
          <div className="w-full h-full relative bg-black flex items-center justify-center">
            {activeMode === 'stream' && directStreamUrl ? (
              /* Reprodutor Nativo HTML5 (Toca imediatamente, sem tela de download do Drive) */
              <video
                ref={videoRef}
                key={`video-stream-${resolvedFileId}-${iframeKey}`}
                id="native-html5-player"
                src={directStreamUrl}
                controls
                autoPlay
                playsInline
                preload="auto"
                poster={normalizeImageUrl(coverImage) || undefined}
                onLoadedMetadata={handleLoadedMetadata}
                onError={handleVideoError}
                className={`w-full h-full bg-black ${
                  videoFit === 'cover' ? 'object-cover' : 'object-contain'
                }`}
              >
                <source src={directStreamUrl} type="video/mp4" />
                Seu navegador não suporta reprodução direta de vídeo.
              </video>
            ) : (
              /* Iframe do Google Drive (Modo alternativo) */
              <iframe
                key={`iframe-drive-${iframeKey}`}
                id="google-drive-iframe"
                src={previewUrl}
                title={title || 'Vídeo do Google Drive'}
                className="w-full h-full border-0 absolute inset-0"
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
              />
            )}
          </div>
        )}
      </div>

      {/* Barra de utilidades / Controles discretos (apenas durante reprodução ativa se necessário) */}
      {isPlaying && (
        <div className="w-full max-w-5xl mt-2 px-2 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={handleReload}
              id="btn-reload-video"
              className="hover:text-slate-200 transition-colors flex items-center gap-1.5 bg-slate-900/60 border border-white/5 px-2.5 py-1 rounded-md"
              title="Recarregar player"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recarregar player</span>
            </button>

            {/* Alternador de Modo de Reprodução (Caso deseje testar iframe ou stream) */}
            {canUseStream && (
              <div className="flex items-center gap-1 bg-slate-900/80 border border-white/10 rounded-md p-0.5">
                <button
                  type="button"
                  id="btn-mode-stream"
                  onClick={() => {
                    setStreamError(false);
                    setPlayerMode('stream');
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                    activeMode === 'stream'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Reprodução Direta (Recomendado: sem erro de processamento do Google Drive)"
                >
                  <Film className="w-3 h-3" />
                  <span>Vídeo Direto</span>
                </button>
                <button
                  type="button"
                  id="btn-mode-iframe"
                  onClick={() => setPlayerMode('iframe')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                    activeMode === 'iframe'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Player Padrão do Google Drive"
                >
                  <MonitorPlay className="w-3 h-3" />
                  <span>Google Drive</span>
                </button>
              </div>
            )}

            {/* Ajuste de Enquadramento (Preencher vs Ajustar) quando em modo direto */}
            {activeMode === 'stream' && (
              <div className="flex items-center gap-1 bg-slate-900/80 border border-white/10 rounded-md p-0.5">
                <button
                  type="button"
                  id="btn-fit-contain"
                  onClick={() => setVideoFit('contain')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    videoFit === 'contain'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Ajustar vídeo inteiro na tela (sem cortes)"
                >
                  Ajustar
                </button>
                <button
                  type="button"
                  id="btn-fit-cover"
                  onClick={() => setVideoFit('cover')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    videoFit === 'cover'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Preencher o quadro do reprodutor"
                >
                  Preencher
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerta caso stream tenha caído e alternado */}
      {streamError && (
        <div className="w-full max-w-5xl mt-2 p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
          <span>O streaming direto não pôde ser carregado. Exibindo via player do Google Drive.</span>
          <button
            onClick={() => {
              setStreamError(false);
              setPlayerMode('stream');
            }}
            className="underline hover:text-white ml-2"
          >
            Tentar direto novamente
          </button>
        </div>
      )}

      {/* Aviso amigável sobre permissão do Google Drive (Requisito 4) */}
      {showPermissionHelp && (
        <div 
          id="permission-alert-box"
          className="w-full max-w-5xl mt-3 p-4 rounded-xl bg-slate-900/90 border border-indigo-500/20 text-slate-300 text-xs sm:text-sm backdrop-blur-md shadow-xl transition-all"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="font-semibold text-slate-100">
                Não foi possível carregar este vídeo. Verifique se o arquivo do Google Drive está configurado como &quot;Qualquer pessoa com o link&quot;.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Para que vídeos do Google Drive possam ser reproduzidos publicamente na página:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                <li>Abra o arquivo no seu <strong>Google Drive</strong>.</li>
                <li>Clique no botão <strong>Compartilhar</strong> no canto superior direito.</li>
                <li>Em <em>Acesso geral</em>, altere de <em>&quot;Restrito&quot;</em> para <strong>&quot;Qualquer pessoa com o link&quot;</strong>.</li>
                <li>Clique em <strong>Concluído</strong> e recarregue a página.</li>
              </ol>
            </div>
            <button
              onClick={() => setShowPermissionHelp(false)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

