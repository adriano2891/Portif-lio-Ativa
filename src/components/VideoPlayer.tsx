import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, AlertCircle, RefreshCw, Film, MonitorPlay } from 'lucide-react';
import { trackEvent, API_BASE } from '../services/api';
import { parseGoogleDriveVideoUrl } from '../utils/googleDrive';
import { normalizeImageUrl } from '../utils/imageUrl';
import { VideoControls } from './VideoControls';

interface VideoPlayerProps {
  previewUrl: string;
  originalUrl?: string;
  coverImage?: string;
  title?: string;
  fileId?: string;
  onPlayRecorded?: () => void;
  autoPlayOnMount?: boolean;
  showModeControls?: boolean;
  aspectRatioProp?: 'auto' | '9:16' | '16:9' | '1:1';
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  previewUrl,
  originalUrl,
  coverImage,
  title,
  fileId: propFileId,
  onPlayRecorded,
  autoPlayOnMount = false,
  showModeControls = false,
  aspectRatioProp = 'auto',
}) => {
  const isStaticOrNetlify = typeof window !== 'undefined' && (
    window.location.hostname.includes('netlify.app') ||
    window.location.hostname.includes('github.io') ||
    (!API_BASE && window.location.port !== '3000')
  );

  // Estado de início da reprodução
  const [hasStarted, setHasStarted] = useState(autoPlayOnMount);
  const [isVideoPaused, setIsVideoPaused] = useState(true);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [playerMode, setPlayerMode] = useState<'stream' | 'iframe'>('stream');
  const [iframeKey, setIframeKey] = useState(0);

  // Proporção de tela e enquadramento
  const [detectedRatio, setDetectedRatio] = useState<'9-16' | '16-9' | '1-1'>('9-16');
  const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('contain');

  // Controles do reprodutor customizado
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Referências
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const verticalFrameRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar resolução da imagem de capa para identificar vídeo 9:16 antecipadamente
  useEffect(() => {
    if (coverImage) {
      const normalized = normalizeImageUrl(coverImage);
      if (normalized) {
        const img = new Image();
        img.src = normalized;
        img.onload = () => {
          if (img.naturalWidth && img.naturalHeight) {
            const ratio = img.naturalWidth / img.naturalHeight;
            if (ratio < 0.75) {
              setDetectedRatio('9-16');
            } else if (ratio >= 0.75 && ratio <= 1.2) {
              setDetectedRatio('1-1');
            } else {
              setDetectedRatio('16-9');
            }
          }
        };
      }
    }
  }, [coverImage]);

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

  // Proporção efetiva
  const effectiveRatio = React.useMemo(() => {
    if (aspectRatioProp === '9:16') return '9-16';
    if (aspectRatioProp === '16:9') return '16-9';
    if (aspectRatioProp === '1:1') return '1-1';
    return detectedRatio;
  }, [aspectRatioProp, detectedRatio]);

  const isVertical = effectiveRatio === '9-16';

  // URL de streaming/arquivo direto de vídeo para o player HTML5
  const activeVideoSrc = React.useMemo(() => {
    if (originalUrl && (originalUrl.endsWith('.mp4') || originalUrl.endsWith('.webm') || originalUrl.endsWith('.mov') || originalUrl.includes('/video.mp4'))) {
      return originalUrl;
    }
    // No Netlify, modo estático ou com o vídeo padrão da landing page, usa o arquivo /video.mp4 local de alta performance
    if (!resolvedFileId || resolvedFileId === '1imCug0lfQ1_R-VbGCLXMspYUzVH-5PuF' || isStaticOrNetlify) {
      return '/video.mp4';
    }
    // Se houver backend próprio configurado
    if (API_BASE) {
      return `${API_BASE}/api/public/video-stream/${resolvedFileId}`;
    }
    return '/video.mp4';
  }, [originalUrl, resolvedFileId, isStaticOrNetlify]);

  // Temporizador de Ocultação Automática dos Controles (3 segundos sem interação)
  const resetAutoHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    // Ocultar após 3 segundos somente se o vídeo estiver em reprodução ativa
    if (videoRef.current && !videoRef.current.paused) {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, []);

  // Monitorar estado de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Iniciar Reprodução (Chamada síncrona dentro do gesto do usuário)
  const handleStartPlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setHasStarted(true);
    setStreamError(false);
    setIsVideoPaused(false);

    trackEvent('video_play');
    if (onPlayRecorded) {
      onPlayRecorded();
    }

    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsVideoPaused(false);
            resetAutoHideTimer();
          })
          .catch((err) => {
            console.warn('Reprodução com som bloqueada na inicialização, tentando com mudo:', err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play()
                .then(() => {
                  setIsVideoPaused(false);
                  resetAutoHideTimer();
                })
                .catch((err2) => {
                  console.warn('Falha no HTML5, alternando para reprodutor do Drive:', err2);
                  setPlayerMode('iframe');
                });
            }
          });
      }
    }
  };

  // Alternar Play/Pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsVideoPaused(false);
            resetAutoHideTimer();
          })
          .catch((err) => {
            console.warn('Erro ao alternar reprodução:', err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play()
                .then(() => {
                  setIsVideoPaused(false);
                  resetAutoHideTimer();
                })
                .catch(() => {
                  setPlayerMode('iframe');
                });
            }
          });
      }
    } else {
      videoRef.current.pause();
      setIsVideoPaused(true);
      // Quando pausado, os controles devem permanecer visíveis
      setControlsVisible(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
  }, [resetAutoHideTimer]);

  // Clique na área do vídeo (Mobile e Desktop)
  const handleVideoAreaClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    // Se os controles estavam ocultos, apenas exibe os controles e reinicia o temporizador de 3s
    if (!controlsVisible) {
      resetAutoHideTimer();
      return;
    }
    // Se os controles já estavam visíveis, alternar reprodução/pausa
    togglePlay();
  };

  // Avançar / retroceder no tempo
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      resetAutoHideTimer();
    }
  };

  // Pular segundos (+10s ou -10s)
  const handleSkip = (seconds: number) => {
    if (videoRef.current) {
      const targetTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration || 0));
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      resetAutoHideTimer();
    }
  };

  // Ajuste de Volume
  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
      resetAutoHideTimer();
    }
  };

  // Alternar Mudo
  const handleToggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      resetAutoHideTimer();
    }
  };

  // Alterar Velocidade
  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      resetAutoHideTimer();
    }
  };

  // Alternar Tela Cheia
  const handleToggleFullscreen = () => {
    const targetElement = isVertical 
      ? (verticalFrameRef.current || containerRef.current)
      : containerRef.current;

    if (!targetElement) return;

    if (!document.fullscreenElement) {
      if (targetElement.requestFullscreen) {
        targetElement.requestFullscreen().catch(console.warn);
      } else if ((targetElement as any).webkitRequestFullscreen) {
        (targetElement as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(console.warn);
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    resetAutoHideTimer();
  };

  // Metadados carregados
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      const { videoWidth, videoHeight } = videoRef.current;
      if (videoWidth && videoHeight) {
        const ratio = videoWidth / videoHeight;
        if (ratio < 0.75) {
          setDetectedRatio('9-16');
        } else if (ratio >= 0.75 && ratio <= 1.2) {
          setDetectedRatio('1-1');
        } else {
          setDetectedRatio('16-9');
        }
      }
    }
  };

  // Atualização contínua de tempo e buffer
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.buffered.length > 0) {
        setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
      }
    }
  };

  // Tratamento de Erro do Vídeo (Fallback automático garantido)
  const handleVideoError = () => {
    console.warn('Erro ao reproduzir via HTML5. Ativando reprodutor seguro do Google Drive...');
    setPlayerMode('iframe');
  };

  // Recarregar
  const handleReload = () => {
    setStreamError(false);
    setIframeKey((prev) => prev + 1);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  // Atalhos de Teclado (Space = Play/Pause, M = Mute, F = Fullscreen, Setas = Seek)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }
      if (e.code === 'Space' || e.code === 'KeyK') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSkip(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSkip(5);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleToggleMute, handleToggleFullscreen]);

  return (
    <div className="w-full flex flex-col items-center" id="video-player-section">
      {/* VÍDEO VERTICAL 9:16 (Moldura Ativa para Telas Grandes / Smart TVs e Mobile Full) */}
      {isVertical ? (
        <div
          ref={containerRef}
          id="video-player-container"
          className="w-full relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-teal-500/20 ring-1 ring-white/5 flex items-center justify-center group transition-all duration-300 max-w-sm sm:max-w-md md:max-w-5xl xl:max-w-6xl aspect-[9/16] md:aspect-video md:max-h-[82vh] lg:max-h-[86vh] bg-[#020d17]"
          onPointerMove={resetAutoHideTimer}
          onTouchStart={resetAutoHideTimer}
        >
          {/* Fundo em degradê corporativo oficial do Grupo Ativa nas laterais em telas widescreen */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#020d17] via-[#052433] to-[#020d17]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,rgba(0,168,150,0.22),rgba(5,130,202,0.12),transparent)] pointer-events-none" />
          <div className="hidden md:block absolute w-[360px] lg:w-[420px] h-[90%] bg-teal-400/20 blur-3xl rounded-full pointer-events-none z-0" />

          {/* Asa Lateral Esquerda (Smart TVs e Desktops) */}
          <div className="hidden md:flex flex-1 flex-col items-center justify-between h-full py-8 px-4 lg:px-8 select-none pointer-events-none z-0">
            <div className="flex items-center gap-2 text-[10px] lg:text-xs tracking-[0.25em] uppercase font-semibold text-teal-300/70">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400/90 shadow-[0_0_8px_rgba(45,212,191,0.8)] animate-pulse" />
              <span>Telepresença</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400/40" />
              <div className="w-px h-28 lg:h-36 bg-gradient-to-b from-transparent via-teal-400/30 to-transparent" />
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400/40" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[10px] lg:text-xs tracking-[0.3em] uppercase font-bold text-teal-200/50">
                Grupo Ativa
              </span>
              <span className="text-[9px] tracking-[0.15em] text-teal-400/40 font-medium">
                Tecnologia & Segurança
              </span>
            </div>
          </div>

          {/* Quadro Central 9:16 (Mantém proporção estrita original, sem esticar ou cortar) */}
          <div
            ref={verticalFrameRef}
            id="vertical-video-frame"
            className="h-full w-auto aspect-[9/16] max-w-full relative flex items-center justify-center rounded-xl md:rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_30px_rgba(0,168,150,0.25)] ring-1 ring-teal-400/30 border border-teal-500/30 z-10 bg-black shrink-0"
            onPointerMove={resetAutoHideTimer}
            onTouchStart={resetAutoHideTimer}
          >
            {/* REPRODUTOR: Vídeo com Controles Estritamente no Rodapé */}
            <div 
              className="w-full h-full relative bg-black flex items-center justify-center"
              onClick={handleVideoAreaClick}
            >
              {playerMode === 'stream' ? (
                <>
                  <video
                    ref={videoRef}
                    key={`video-stream-${resolvedFileId}-${iframeKey}`}
                    id="native-html5-player"
                    src={activeVideoSrc}
                    playsInline
                    preload="auto"
                    poster={normalizeImageUrl(coverImage) || undefined}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => {
                      setIsVideoPaused(false);
                      resetAutoHideTimer();
                    }}
                    onPause={() => {
                      setIsVideoPaused(true);
                      setControlsVisible(true);
                      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                    }}
                    onEnded={() => {
                      setIsVideoPaused(true);
                      setControlsVisible(true);
                    }}
                    onError={handleVideoError}
                    className="w-full h-full bg-black object-contain cursor-pointer"
                  >
                    <source src={activeVideoSrc} type="video/mp4" />
                    <source src="/video.mp4" type="video/mp4" />
                    Seu navegador não suporta reprodução direta de vídeo.
                  </video>

                  {/* Controles Customizados: Somente na Parte Inferior com Degradê e Ocultação Automática */}
                  <VideoControls
                    isPlaying={!isVideoPaused}
                    onTogglePlay={togglePlay}
                    visible={hasStarted && controlsVisible}
                    currentTime={currentTime}
                    duration={duration}
                    bufferedEnd={bufferedEnd}
                    volume={volume}
                    isMuted={isMuted}
                    playbackRate={playbackRate}
                    onSeek={handleSeek}
                    onVolumeChange={handleVolumeChange}
                    onToggleMute={handleToggleMute}
                    onPlaybackRateChange={handlePlaybackRateChange}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={handleToggleFullscreen}
                    onSkip={handleSkip}
                  />
                </>
              ) : (
                /* Modo Iframe alternativo (se acionado automaticamente por fallback de segurança) */
                <>
                  <iframe
                    key={`iframe-drive-${iframeKey}`}
                    id="google-drive-iframe"
                    src={`${previewUrl}?autoplay=1`}
                    title={title || 'Vídeo do Google Drive'}
                    className="w-full h-full border-0 absolute inset-0"
                    allow="autoplay; fullscreen; encrypted-media"
                    allowFullScreen
                  />
                  <div
                    id="block-drive-popout"
                    className="absolute top-0 right-0 w-20 h-16 bg-black z-20 pointer-events-auto cursor-default select-none rounded-tr-xl md:rounded-tr-2xl"
                    aria-hidden="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  />
                </>
              )}

              {/* Capa / Poster Interativo (antes de iniciar o vídeo) */}
              {!hasStarted && (
                <div
                  onClick={handleStartPlay}
                  id="video-poster-overlay"
                  className="absolute inset-0 z-30 w-full h-full cursor-pointer flex flex-col items-center justify-center select-none bg-cover bg-center transition-opacity duration-300"
                  style={{
                    backgroundImage: normalizeImageUrl(coverImage)
                      ? `linear-gradient(to top, rgba(2,13,23,0.75) 0%, rgba(2,13,23,0.25) 50%, rgba(2,13,23,0.75) 100%), url("${normalizeImageUrl(coverImage)}")`
                      : 'linear-gradient(135deg, #020d17 0%, #052433 50%, #020d17 100%)',
                  }}
                >
                  <div className="relative group/btn flex items-center justify-center">
                    <div className="absolute -inset-3 bg-teal-500/30 rounded-full blur-md group-hover/btn:bg-teal-500/50 transition-all duration-300 animate-pulse" />
                    <button
                      id="btn-play-hero"
                      aria-label="Iniciar reprodução do vídeo"
                      className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-teal-600/95 text-white flex items-center justify-center pl-1 shadow-2xl border border-teal-300/40 transform transition-transform duration-300 group-hover/btn:scale-110 active:scale-95 hover:bg-teal-500"
                    >
                      <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-white" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Asa Lateral Direita (Smart TVs e Desktops) */}
          <div className="hidden md:flex flex-1 flex-col items-center justify-between h-full py-8 px-4 lg:px-8 select-none pointer-events-none z-0">
            <div className="flex items-center gap-2 text-[10px] lg:text-xs tracking-[0.25em] uppercase font-semibold text-teal-300/70">
              <span>Transmissão HD</span>
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400/90 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400/40" />
              <div className="w-px h-28 lg:h-36 bg-gradient-to-b from-transparent via-teal-400/30 to-transparent" />
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400/40" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[10px] lg:text-xs tracking-[0.3em] uppercase font-bold text-teal-200/50">
                Atendimento Remoto
              </span>
              <span className="text-[9px] tracking-[0.15em] text-teal-400/40 font-medium">
                Conexão ao Vivo
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* VÍDEO HORIZONTAL TRADICIONAL (16:9 OU 1:1) */
        <div 
          ref={containerRef}
          id="video-player-container"
          className={`w-full relative rounded-xl sm:rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 ring-1 ring-white/5 flex items-center justify-center group transition-all duration-300 ${
            effectiveRatio === '1-1'
              ? 'max-w-2xl aspect-square max-h-[75vh]'
              : 'max-w-5xl aspect-video max-h-[85vh]'
          }`}
          onPointerMove={resetAutoHideTimer}
          onTouchStart={resetAutoHideTimer}
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/20 via-sky-500/10 to-indigo-500/20 rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition duration-1000 -z-10" />

            {/* REPRODUTOR ATIVO: Controles Somente no Rodapé */}
            <div 
              className="w-full h-full relative bg-black flex items-center justify-center"
              onClick={handleVideoAreaClick}
            >
              {playerMode === 'stream' ? (
                <>
                  <video
                    ref={videoRef}
                    key={`video-stream-${resolvedFileId}-${iframeKey}`}
                    id="native-html5-player"
                    src={activeVideoSrc}
                    playsInline
                    preload="auto"
                    poster={normalizeImageUrl(coverImage) || undefined}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => {
                      setIsVideoPaused(false);
                      resetAutoHideTimer();
                    }}
                    onPause={() => {
                      setIsVideoPaused(true);
                      setControlsVisible(true);
                      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                    }}
                    onEnded={() => {
                      setIsVideoPaused(true);
                      setControlsVisible(true);
                    }}
                    onError={handleVideoError}
                    className={`w-full h-full bg-black cursor-pointer ${
                      videoFit === 'cover' ? 'object-cover' : 'object-contain'
                    }`}
                  >
                    <source src={activeVideoSrc} type="video/mp4" />
                    <source src="/video.mp4" type="video/mp4" />
                    Seu navegador não suporta reprodução direta de vídeo.
                  </video>

                  {/* Controles Customizados: Somente na Parte Inferior com Degradê e Ocultação Automática */}
                  <VideoControls
                    isPlaying={!isVideoPaused}
                    onTogglePlay={togglePlay}
                    visible={hasStarted && controlsVisible}
                    currentTime={currentTime}
                    duration={duration}
                    bufferedEnd={bufferedEnd}
                    volume={volume}
                    isMuted={isMuted}
                    playbackRate={playbackRate}
                    onSeek={handleSeek}
                    onVolumeChange={handleVolumeChange}
                    onToggleMute={handleToggleMute}
                    onPlaybackRateChange={handlePlaybackRateChange}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={handleToggleFullscreen}
                    onSkip={handleSkip}
                  />
                </>
              ) : (
                <>
                  <iframe
                    key={`iframe-drive-${iframeKey}`}
                    id="google-drive-iframe"
                    src={`${previewUrl}?autoplay=1`}
                    title={title || 'Vídeo do Google Drive'}
                    className="w-full h-full border-0 absolute inset-0"
                    allow="autoplay; fullscreen; encrypted-media"
                    allowFullScreen
                  />
                  <div
                    id="block-drive-popout"
                    className="absolute top-0 right-0 w-20 h-16 bg-black z-20 pointer-events-auto cursor-default select-none rounded-tr-xl sm:rounded-tr-2xl"
                    aria-hidden="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  />
                </>
              )}

              {/* Poster Interativo com botão de Play */}
              {!hasStarted && (
                <div 
                  onClick={handleStartPlay}
                  id="video-poster-overlay"
                  className="absolute inset-0 z-30 w-full h-full cursor-pointer flex flex-col items-center justify-center select-none bg-cover bg-center transition-opacity duration-300"
                  style={{
                    backgroundImage: normalizeImageUrl(coverImage)
                      ? `linear-gradient(to top, rgba(9,10,15,0.85) 0%, rgba(9,10,15,0.4) 50%, rgba(9,10,15,0.85) 100%), url("${normalizeImageUrl(coverImage)}")`
                      : 'linear-gradient(135deg, #0f172a 0%, #062534 50%, #090a0f 100%)',
                  }}
                >
                  <div className="relative group/btn flex items-center justify-center">
                    <div className="absolute -inset-3 bg-teal-500/30 rounded-full blur-md group-hover/btn:bg-teal-500/50 transition-all duration-300 animate-pulse" />
                    <button
                      id="btn-play-hero"
                      aria-label="Iniciar reprodução do vídeo"
                      className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-teal-600/90 text-white flex items-center justify-center pl-1 shadow-2xl border border-teal-400/40 transform transition-transform duration-300 group-hover/btn:scale-110 active:scale-95 hover:bg-teal-500"
                    >
                      <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-white" />
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>
      )}

      {/* Barra de utilidades / Controles administrativos (apenas quando solicitado) */}
      {showModeControls && (
        <>
          <div className="w-full max-w-5xl mt-2 px-2 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1 bg-slate-900/80 border border-white/10 rounded-md p-0.5 shadow-sm">
                <button
                  type="button"
                  id="btn-mode-stream"
                  onClick={() => {
                    setStreamError(false);
                    setPlayerMode('stream');
                    if (!hasStarted) {
                      handleStartPlay();
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                    playerMode === 'stream'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Player profissional HTML5 com controles inferiores"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Player Profissional</span>
                </button>
                <button
                  type="button"
                  id="btn-mode-iframe"
                  onClick={() => {
                    setPlayerMode('iframe');
                    if (!hasStarted) {
                      handleStartPlay();
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                    playerMode === 'iframe'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Iframe Google Drive"
                >
                  <MonitorPlay className="w-3.5 h-3.5" />
                  <span>Iframe Drive</span>
                </button>
              </div>

              {hasStarted && (
                <button
                  onClick={handleReload}
                  id="btn-reload-video"
                  className="hover:text-slate-200 transition-colors flex items-center gap-1.5 bg-slate-900/60 border border-white/5 px-2.5 py-1 rounded-md text-slate-400"
                  title="Recarregar player"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Recarregar player</span>
                </button>
              )}

              {hasStarted && playerMode === 'stream' && (
                <div className="flex items-center gap-1 bg-slate-900/80 border border-white/10 rounded-md p-0.5">
                  <button
                    type="button"
                    id="btn-fit-contain"
                    onClick={() => setVideoFit('contain')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      videoFit === 'contain'
                        ? 'bg-teal-600 text-white shadow-sm'
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
                        ? 'bg-teal-600 text-white shadow-sm'
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

          {streamError && (
            <div className="w-full max-w-5xl mt-2 p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
              <span>Houve um problema de conexão com a fonte do vídeo.</span>
              <button
                onClick={() => {
                  setStreamError(false);
                  setPlayerMode('stream');
                  handleReload();
                }}
                className="underline hover:text-white ml-2"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </>
      )}

      {/* Alerta amigável sobre permissão do Google Drive */}
      {showPermissionHelp && (
        <div 
          id="permission-alert-box"
          className="w-full max-w-5xl mt-3 p-4 rounded-xl bg-slate-900/90 border border-teal-500/20 text-slate-300 text-xs sm:text-sm backdrop-blur-md shadow-xl transition-all"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
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
