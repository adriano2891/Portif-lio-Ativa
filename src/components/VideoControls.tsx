import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  Volume1, 
  VolumeX, 
  Maximize, 
  Minimize, 
  SlidersHorizontal 
} from 'lucide-react';

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

interface VideoControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  visible: boolean;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSkip: (seconds: number) => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  onTogglePlay,
  visible,
  currentTime,
  duration,
  bufferedEnd,
  volume,
  isMuted,
  playbackRate,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  isFullscreen,
  onToggleFullscreen,
  onSkip,
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const playedPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;

  // Cálculo da posição no scrubber
  const calculateScrubTime = (clientX: number): number => {
    if (!progressBarRef.current || duration <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const ratio = clampedX / rect.width;
    return ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsScrubbing(true);
    const newTime = calculateScrubTime(e.clientX);
    onSeek(newTime);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const scrubTime = calculateScrubTime(moveEvent.clientX);
      onSeek(scrubTime);
    };

    const handlePointerUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleMouseMoveProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setHoverPosition(pos);
    setHoverTime((pos / rect.width) * duration);
  };

  const handleMouseLeaveProgress = () => {
    setHoverTime(null);
  };

  // Ícone de volume dinâmico
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div
      id="custom-video-controls-root"
      className={`absolute bottom-0 inset-x-0 z-30 transition-all duration-300 ease-out select-none pointer-events-auto ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Faixa com degradê escuro e transparente para garantir leitura perfeita */}
      <div className="bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-10 pb-3 px-3 sm:px-5 flex flex-col gap-2.5">
        {/* Barra de Progresso / Scrubber */}
        <div
          ref={progressBarRef}
          id="video-progress-bar-container"
          onPointerDown={handlePointerDown}
          onMouseMove={handleMouseMoveProgress}
          onMouseLeave={handleMouseLeaveProgress}
          className="relative w-full h-3 flex items-center cursor-pointer group/progress py-1"
          role="slider"
          aria-label="Barra de progresso do vídeo"
          aria-valuemin={0}
          aria-valuemax={duration || 100}
          aria-valuenow={currentTime}
        >
          {/* Tooltip de tempo no hover */}
          {hoverTime !== null && duration > 0 && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-900/90 border border-teal-500/40 text-[11px] font-mono text-teal-300 shadow-md pointer-events-none"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Linha de fundo */}
          <div className="w-full h-1 sm:h-1.5 bg-white/20 rounded-full overflow-hidden relative group-hover/progress:h-2 transition-all">
            {/* Linha de buffer */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all duration-150"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Linha de reprodução preenchida */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-teal-500 to-teal-400 rounded-full"
              style={{ width: `${playedPercent}%` }}
            />
          </div>

          {/* Marcador / Botão deslizante do progresso */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-teal-300 border-2 border-slate-950 shadow-[0_0_10px_rgba(45,212,191,0.9)] transition-transform duration-100 ${
              isScrubbing ? 'scale-125 ring-2 ring-teal-400/50' : 'scale-90 group-hover/progress:scale-110'
            }`}
            style={{ left: `${playedPercent}%` }}
          />
        </div>

        {/* Linha de Botões de Controle Inferiores */}
        <div className="flex items-center justify-between gap-2 text-white">
          {/* Lado Esquerdo: Play/Pause, Pular 10s, Volume, Tempo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão Play / Pause */}
            <button
              type="button"
              id="btn-ctrl-play-pause"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md transition-all active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Voltar 10 segundos */}
            <button
              type="button"
              id="btn-ctrl-skip-back"
              onClick={() => onSkip(-10)}
              aria-label="Voltar 10 segundos"
              title="Voltar 10s"
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md hover:bg-white/15 text-slate-200 hover:text-white transition-all active:scale-95 relative"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[9px] font-bold absolute -bottom-0.5">10</span>
            </button>

            {/* Avançar 10 segundos */}
            <button
              type="button"
              id="btn-ctrl-skip-forward"
              onClick={() => onSkip(10)}
              aria-label="Avançar 10 segundos"
              title="Avançar 10s"
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md hover:bg-white/15 text-slate-200 hover:text-white transition-all active:scale-95 relative"
            >
              <RotateCw className="w-4 h-4" />
              <span className="text-[9px] font-bold absolute -bottom-0.5">10</span>
            </button>

            {/* Controle de Volume */}
            <div 
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                type="button"
                id="btn-ctrl-volume"
                onClick={onToggleMute}
                aria-label={isMuted ? 'Desativar mudo' : 'Silenciar'}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md hover:bg-white/15 text-slate-200 hover:text-white transition-all"
              >
                <VolumeIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              {/* Slider de Volume Deslizante */}
              <div
                className={`flex items-center overflow-hidden transition-all duration-200 ${
                  showVolumeSlider ? 'w-16 sm:w-20 opacity-100 ml-1.5' : 'w-0 opacity-0 pointer-events-none'
                }`}
              >
                <input
                  type="range"
                  id="volume-slider"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  aria-label="Volume"
                  className="w-full h-1 accent-teal-400 bg-white/30 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Tempo Atual / Duração */}
            <div className="text-[11px] sm:text-xs font-mono font-medium text-slate-300 ml-1 whitespace-nowrap">
              <span className="text-white font-semibold">{formatTime(currentTime)}</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-slate-400">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Lado Direito: Velocidade, Tela Cheia */}
          <div className="flex items-center gap-1 sm:gap-2 relative">
            {/* Seletor de Velocidade (0.75x, 1x, 1.25x, 1.5x, 2x) */}
            <div className="relative">
              <button
                type="button"
                id="btn-ctrl-speed"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                aria-label="Ajustar velocidade de reprodução"
                className="px-2 py-1 rounded-md hover:bg-white/15 text-[11px] sm:text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-0.5"
              >
                <span>{playbackRate}x</span>
              </button>

              {/* Menu suspenso de velocidade */}
              {showSpeedMenu && (
                <div
                  id="speed-options-menu"
                  className="absolute bottom-9 right-0 py-1 px-1 bg-slate-900/95 border border-teal-500/30 rounded-lg shadow-xl flex flex-col gap-0.5 min-w-[70px] backdrop-blur-md z-40"
                >
                  {speedOptions.map((rate) => (
                    <button
                      key={`speed-${rate}`}
                      type="button"
                      onClick={() => {
                        onPlaybackRateChange(rate);
                        setShowSpeedMenu(false);
                      }}
                      className={`px-2.5 py-1 text-left text-xs rounded transition-colors ${
                        playbackRate === rate
                          ? 'bg-teal-500/20 text-teal-300 font-bold'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Botão Tela Cheia */}
            <button
              type="button"
              id="btn-ctrl-fullscreen"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-md hover:bg-white/15 text-slate-200 hover:text-white transition-all active:scale-95"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              ) : (
                <Maximize className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
