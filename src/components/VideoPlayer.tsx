import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Settings2,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { HERO_POSTER_URL } from '../data/temanggungSchedule';
import type { StreamQuality, StreamTelemetry } from '../types/broadcast';

export interface VideoPlayerHandle {
  enterFullscreen: () => Promise<void>;
  togglePlay: () => Promise<void>;
}

interface VideoPlayerProps {
  channelId: string;
  channelName: string;
  srtUrl: string;
  preferredQuality: StreamQuality;
  dataSaver: boolean;
  autoPlay: boolean;
  onQualityChange: (quality: StreamQuality) => void;
  onTelemetryChange?: (telemetry: StreamTelemetry) => void;
}

interface QualityOption {
  value: StreamQuality;
  label: string;
  hint: string;
}

const QUALITY_OPTIONS: QualityOption[] = [
  { value: 'auto', label: 'Otomatis', hint: 'Adaptif sesuai koneksi TV' },
  { value: '1080p', label: '1080p Asli', hint: 'Penuh Full HD di layar TV' },
  { value: '720p', label: '720p HD', hint: 'Jernih & ringan' },
  { value: '480p', label: '480p Lancar', hint: 'Anti buffering saat sinyal lemah' },
];

export const VideoPlayer = React.forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (
    {
      channelId,
      channelName,
      srtUrl,
      preferredQuality,
      dataSaver,
      autoPlay,
      onQualityChange,
      onTelemetryChange,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const hideTimerRef = useRef<number | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [needsUnmuteTap, setNeedsUnmuteTap] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [reconnectNonce, setReconnectNonce] = useState(0);
    const [posterError, setPosterError] = useState(false);

    const [telemetry, setTelemetry] = useState<StreamTelemetry>({
      state: 'connecting',
      activeQualityLabel: dataSaver ? '480p' : preferredQuality === 'auto' ? 'Auto' : preferredQuality,
      bitrateKbps: null,
      bufferSec: 0,
      errorMessage: null,
    });

    const effectiveQuality: StreamQuality = dataSaver ? '480p' : preferredQuality;

    const streamSrc = useMemo(() => {
      const encodedSrt = encodeURIComponent(srtUrl);
      return `/api/stream/${encodeURIComponent(channelId)}/master.m3u8?srt=${encodedSrt}`;
    }, [channelId, srtUrl]);

    const updateTelemetry = useCallback(
      (patch: Partial<StreamTelemetry>) => {
        setTelemetry((prev) => {
          const next = { ...prev, ...patch };
          onTelemetryChange?.(next);
          return next;
        });
      },
      [onTelemetryChange]
    );

    const scheduleHideControls = useCallback(() => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = window.setTimeout(() => {
        if (!showQualityMenu) {
          setShowControls(false);
        }
      }, 4000);
    }, [showQualityMenu]);

    const revealControls = useCallback(() => {
      setShowControls(true);
      scheduleHideControls();
    }, [scheduleHideControls]);

    const applyQualityToHls = useCallback((hls: Hls | null, quality: StreamQuality) => {
      if (!hls || !hls.levels || hls.levels.length === 0) return;
      if (quality === 'auto') {
        hls.currentLevel = -1;
        return;
      }
      const targetHeight = quality === '1080p' ? 1080 : quality === '720p' ? 720 : 480;
      const matchIndex = hls.levels.findIndex((lvl) => lvl.height === targetHeight);
      if (matchIndex !== -1) {
        hls.currentLevel = matchIndex;
      } else {
        const sorted = [...hls.levels]
          .map((lvl, idx) => ({ idx, bitrate: lvl.bitrate || 0, height: lvl.height || 0 }))
          .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
        if (quality === '1080p' && sorted[0]) hls.currentLevel = sorted[0].idx;
        else if (quality === '720p' && sorted[1]) hls.currentLevel = sorted[1].idx;
        else if (sorted[sorted.length - 1]) hls.currentLevel = sorted[sorted.length - 1].idx;
      }
    }, []);

    useEffect(() => {
      applyQualityToHls(hlsRef.current, effectiveQuality);
    }, [applyQualityToHls, effectiveQuality]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      let destroyed = false;
      updateTelemetry({
        state: 'connecting',
        errorMessage: null,
        bitrateKbps: null,
      });

      const attemptPlay = async () => {
        if (!autoPlay || destroyed) return;
        try {
          video.muted = false;
          setIsMuted(false);
          setNeedsUnmuteTap(false);
          await video.play();
        } catch {
          if (destroyed) return;
          try {
            video.muted = true;
            setIsMuted(true);
            setNeedsUnmuteTap(true);
            await video.play();
          } catch {
            setIsPlaying(false);
          }
        }
      };

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          liveDurationInfinity: true,
          maxBufferLength: 14,
          maxMaxBufferLength: 28,
          backBufferLength: 8,
          manifestLoadingTimeOut: 18000,
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 1200,
          levelLoadingTimeOut: 12000,
          levelLoadingMaxRetry: 6,
          fragLoadingTimeOut: 12000,
          fragLoadingMaxRetry: 6,
          startLevel: effectiveQuality === '480p' ? 2 : -1,
        });

        hlsRef.current = hls;
        hls.loadSource(streamSrc);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (destroyed) return;
          applyQualityToHls(hls, effectiveQuality);
          void attemptPlay();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          if (destroyed) return;
          const level = hls.levels[data.level];
          if (level) {
            const label = level.height ? `${level.height}p` : effectiveQuality;
            const kbps = level.bitrate ? Math.round(level.bitrate / 1000) : null;
            updateTelemetry({
              activeQualityLabel: label,
              bitrateKbps: kbps,
            });
          }
        });

        hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
          if (destroyed) return;
          const stats = data.frag.stats;
          const level = hls.levels[hls.currentLevel >= 0 ? hls.currentLevel : hls.loadLevel];
          let kbps = level?.bitrate ? Math.round(level.bitrate / 1000) : null;
          if (!kbps && stats && stats.loaded && stats.loading.end > stats.loading.start) {
            const sec = (stats.loading.end - stats.loading.start) / 1000;
            if (sec > 0.01 && data.frag.duration > 0) {
              kbps = Math.round((stats.loaded * 8) / (data.frag.duration * 1000));
            }
          }
          let bufferSec = 0;
          if (video.buffered.length > 0) {
            bufferSec = Math.max(0, video.buffered.end(video.buffered.length - 1) - video.currentTime);
          }
          updateTelemetry({
            state: 'live',
            bitrateKbps: kbps,
            bufferSec: Number(bufferSec.toFixed(1)),
            errorMessage: null,
          });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (destroyed) return;
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              updateTelemetry({
                state: 'buffering',
                errorMessage: 'Menghubungkan ulang ke siaran SRT...',
              });
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              updateTelemetry({
                state: 'error',
                errorMessage: 'Koneksi ke sumber SRT terganggu.',
              });
            }
          }
        });

        return () => {
          destroyed = true;
          hls.destroy();
          hlsRef.current = null;
        };
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamSrc;
        const onCanPlay = () => {
          if (!destroyed) {
            updateTelemetry({ state: 'live', errorMessage: null });
            void attemptPlay();
          }
        };
        video.addEventListener('canplay', onCanPlay);
        return () => {
          destroyed = true;
          video.removeEventListener('canplay', onCanPlay);
          video.removeAttribute('src');
          video.load();
        };
      }

      updateTelemetry({
        state: 'error',
        errorMessage: 'Browser TV ini tidak mendukung pemutaran HLS.',
      });
      return () => {
        destroyed = true;
      };
    }, [applyQualityToHls, autoPlay, effectiveQuality, reconnectNonce, streamSrc, updateTelemetry]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const onPlay = () => {
        setIsPlaying(true);
        updateTelemetry({ state: 'live', errorMessage: null });
      };
      const onPause = () => setIsPlaying(false);
      const onWaiting = () => updateTelemetry({ state: 'buffering' });
      const onPlaying = () => {
        setIsPlaying(true);
        updateTelemetry({ state: 'live', errorMessage: null });
      };

      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('playing', onPlaying);

      return () => {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
      };
    }, [updateTelemetry]);

    useEffect(() => {
      const handleFsChange = () => {
        setIsFullscreen(Boolean(document.fullscreenElement));
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const togglePlay = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;
      revealControls();
      if (video.paused) {
        try {
          await video.play();
        } catch {
          video.muted = true;
          setIsMuted(true);
          await video.play();
        }
      } else {
        video.pause();
      }
    }, [revealControls]);

    const toggleMute = () => {
      const video = videoRef.current;
      if (!video) return;
      revealControls();
      const nextMuted = !video.muted;
      video.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        setNeedsUnmuteTap(false);
      }
    };

    const handleUnmutePrompt = () => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = false;
      setIsMuted(false);
      setNeedsUnmuteTap(false);
      revealControls();
    };

    const jumpToLiveEdge = () => {
      const video = videoRef.current;
      const hls = hlsRef.current;
      if (!video) return;
      revealControls();
      if (hls && typeof hls.liveSyncPosition === 'number' && hls.liveSyncPosition > 0) {
        video.currentTime = hls.liveSyncPosition;
      } else if (video.buffered.length > 0) {
        video.currentTime = Math.max(0, video.buffered.end(video.buffered.length - 1) - 1);
      }
      if (video.paused) {
        void video.play();
      }
    };

    const toggleFullscreen = useCallback(async () => {
      const container = containerRef.current;
      if (!container) return;
      revealControls();
      try {
        if (!document.fullscreenElement) {
          await container.requestFullscreen();
          const orientation = screen.orientation as { lock?: (mode: string) => Promise<void> } | undefined;
          await orientation?.lock?.('landscape').catch(() => {});
        } else {
          await document.exitFullscreen();
        }
      } catch {
        // Ignore restricted fullscreen in embedded preview
      }
    }, [revealControls]);

    useImperativeHandle(
      ref,
      () => ({
        enterFullscreen: async () => {
          const container = containerRef.current;
          if (!container) return;
          if (!document.fullscreenElement) {
            await toggleFullscreen();
          }
        },
        togglePlay,
      }),
      [toggleFullscreen, togglePlay]
    );

    const handleHardReconnect = async () => {
      revealControls();
      updateTelemetry({ state: 'connecting', errorMessage: null });
      try {
        await fetch('/api/stream/restart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId, srtUrl }),
        });
      } catch {
        // Proceed to reload HLS source
      }
      setReconnectNonce((n) => n + 1);
    };

    return (
      <div
        ref={containerRef}
        onClick={revealControls}
        onMouseMove={revealControls}
        className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-sm select-none"
      >
        {!posterError && (telemetry.state === 'connecting' || !isPlaying) && (
          <img
            src={HERO_POSTER_URL}
            alt={`Layar siaran ${channelName}`}
            referrerPolicy="no-referrer"
            onError={() => setPosterError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none"
          />
        )}

        <video
          ref={videoRef}
          playsInline
          preload="auto"
          className="relative z-10 w-full h-full object-contain bg-transparent"
        />

        <div
          className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-200 ${
            showControls || telemetry.state !== 'live' ? 'opacity-100' : 'opacity-0'
          } bg-gradient-to-t from-black/80 via-black/10 to-black/55`}
        />

        {/* Top Bar inside Video Frame */}
        <div
          className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3.5 transition-opacity duration-200 ${
            showControls || telemetry.state !== 'live' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {telemetry.state === 'live' && isPlaying ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#D82425] text-xs font-bold text-white tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>LIVE</span>
              </span>
            ) : telemetry.state === 'connecting' || telemetry.state === 'buffering' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D82425]" />
                <span>{telemetry.state === 'connecting' ? 'Menghubungkan siaran...' : 'Menyesuaikan buffer...'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                <Radio className="w-3.5 h-3.5 text-[#D82425]" />
                <span>Siap Putar</span>
              </span>
            )}
            <span className="text-sm font-medium text-white/90 truncate">{channelName}</span>
          </div>

          <div className="text-xs text-white/90 font-mono tabular-nums shrink-0">
            {telemetry.activeQualityLabel}
          </div>
        </div>

        {/* Center Error / Connecting / Play CTA */}
        {telemetry.state === 'error' ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/70 backdrop-blur-sm"
          >
            <p className="text-base font-semibold text-white max-w-md">
              {telemetry.errorMessage || 'Siaran sedang memuat ulang koneksi SRT.'}
            </p>
            <button
              type="button"
              onClick={() => void handleHardReconnect()}
              className="tv-focusable mt-4 min-h-[48px] px-6 py-3 rounded-xl bg-[#D82425] hover:bg-[#B91C1C] text-white text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Hubungkan Ulang Siaran</span>
            </button>
          </div>
        ) : telemetry.state === 'connecting' && !isPlaying ? (
          <div className="absolute inset-0 z-25 flex flex-col items-center justify-center p-4 text-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
              <RefreshCw className="w-6 h-6 text-[#D82425] animate-spin" />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">
              Menyiapkan siaran Temanggung TV...
            </p>
          </div>
        ) : !isPlaying ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void togglePlay();
            }}
            aria-label="Putar Siaran"
            className="tv-focusable absolute inset-0 z-30 flex items-center justify-center"
          >
            <span className="w-20 h-20 rounded-full bg-[#D82425] hover:bg-[#B91C1C] text-white flex items-center justify-center shadow-2xl transition-transform active:scale-95">
              <Play className="w-9 h-9 fill-current ml-1" />
            </span>
          </button>
        ) : null}

        {needsUnmuteTap && isPlaying && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleUnmutePrompt();
            }}
            className="tv-focusable absolute top-14 left-4 z-40 min-h-[48px] px-4 py-2.5 rounded-xl bg-[#D82425] hover:bg-[#B91C1C] text-white text-sm font-semibold flex items-center gap-2 shadow-lg transition-colors"
          >
            <VolumeX className="w-4 h-4" />
            <span>Tekan untuk Nyalakan Suara</span>
          </button>
        )}

        {/* Bottom TV-Friendly Controls */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2.5 transition-opacity duration-200 ${
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void togglePlay()}
              aria-label={isPlaying ? 'Jeda siaran' : 'Putar siaran'}
              className="tv-focusable min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan suara'}
              className="tv-focusable min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-amber-300" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={jumpToLiveEdge}
              className="tv-focusable min-h-[48px] px-3.5 rounded-xl flex items-center gap-2 text-sm font-semibold text-white hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
            >
              <Wifi className="w-4 h-4 text-[#D82425]" />
              <span>Siaran Terkini</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <button
              type="button"
              onClick={() => {
                setShowQualityMenu((v) => !v);
                setShowControls(true);
              }}
              aria-label="Pilih kualitas streaming"
              className="tv-focusable min-h-[48px] px-3.5 rounded-xl flex items-center gap-1.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors whitespace-nowrap shrink-0"
            >
              <Settings2 className="w-4 h-4" />
              <span>{effectiveQuality === 'auto' ? 'Auto' : effectiveQuality}</span>
            </button>

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
              className="tv-focusable min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            {showQualityMenu && (
              <div className="absolute bottom-14 right-0 w-64 rounded-2xl bg-white border border-slate-200 p-2 shadow-2xl z-40">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500">
                  Kualitas Video
                </div>
                <div className="space-y-1">
                  {QUALITY_OPTIONS.map((opt) => {
                    const selected = effectiveQuality === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onQualityChange(opt.value);
                          setShowQualityMenu(false);
                        }}
                        className={`tv-focusable w-full min-h-[48px] px-3 py-2 rounded-xl text-left transition-colors ${
                          selected
                            ? 'bg-[#D82425] text-white'
                            : 'text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className={`text-xs ${selected ? 'text-white/85' : 'text-slate-500'}`}>
                          {opt.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
