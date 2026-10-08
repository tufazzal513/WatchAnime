import React, { useState, useEffect } from 'react';
import {
  Server,
  SkipForward,
  SkipBack,
  RotateCcw,
  AlertTriangle,
  Flag,
  ExternalLink,
  Film,
  Tv,
  RefreshCw,
} from 'lucide-react';
import { ContentItem, Episode, VideoServer } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useWatchlist } from '../../context/WatchlistContext';

interface VideoPlayerProps {
  content: ContentItem;
  episodes: Episode[];
  currentEpisode: Episode | null;
  onSelectEpisode: (episode: Episode) => void;
  onOpenReport: (server: VideoServer | null) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  content,
  episodes,
  currentEpisode,
  onSelectEpisode,
  onOpenReport,
}) => {
  const { t } = useLanguage();
  const { updateProgress } = useWatchlist();

  // Get available servers
  const servers: VideoServer[] = currentEpisode?.videoServers?.length
    ? currentEpisode.videoServers
    : content.videoServers?.length
    ? content.videoServers
    : [
        {
          id: 'def-1',
          serverName: 'Server 1 (HD)',
          embedUrl: 'https://www.youtube-nocookie.com/embed/s0wTdCQoc2k',
          quality: '1080p',
          subDub: 'Sub',
          isDefault: true,
        },
      ];

  const [activeServer, setActiveServer] = useState<VideoServer>(servers[0]);
  const [autoNext, setAutoNext] = useState(true);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [playerMode, setPlayerMode] = useState<'auto' | 'iframe' | 'video'>('auto');

  // Detect whether a URL is a direct video stream vs web embed
  const checkIsDirectStream = (url: string): boolean => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('/stream') ||
      lower.includes('.mp4') ||
      lower.includes('.m3u8') ||
      lower.includes('.mkv') ||
      lower.includes('.webm') ||
      lower.includes('telegram-drive') ||
      lower.includes('drive.google.com/uc?') ||
      lower.includes('download')
    );
  };

  const isDirect = checkIsDirectStream(activeServer?.embedUrl || '');
  const activeMode: 'iframe' | 'video' =
    playerMode === 'auto' ? (isDirect ? 'video' : 'iframe') : playerMode;

  useEffect(() => {
    if (servers.length > 0) {
      const defaultSrv = servers.find((s) => s.isDefault) || servers[0];
      setActiveServer(defaultSrv);
      setMediaLoaded(false);
      setHasError(false);
    }
  }, [currentEpisode, content]);

  // Track progress on episode mount
  useEffect(() => {
    updateProgress(
      content,
      currentEpisode?.id,
      currentEpisode?.episodeNumber || 1,
      0,
      1440
    );
  }, [content, currentEpisode]);

  const currentIndex = currentEpisode
    ? episodes.findIndex((e) => e.id === currentEpisode.id)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < episodes.length - 1;

  const handlePrev = () => {
    if (hasPrev) onSelectEpisode(episodes[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) onSelectEpisode(episodes[currentIndex + 1]);
  };

  // Clean Embed URL
  const sanitizeEmbedUrl = (rawUrl: string): string => {
    if (!rawUrl) return '';
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return '';
      }
      return rawUrl;
    } catch {
      return '';
    }
  };

  const embedUrl = sanitizeEmbedUrl(activeServer?.embedUrl || '');

  return (
    <div className="w-full bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
      {/* 16:9 Player Viewport */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        {!mediaLoaded && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-10 space-y-3">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-neutral-400 font-medium">
              Connecting to {activeServer.serverName}...
            </p>
          </div>
        )}

        {embedUrl ? (
          activeMode === 'video' ? (
            /* HTML5 Native Video Player for Direct Streams (Telegram Drive, MP4, etc.) */
            <video
              key={`video-${embedUrl}`}
              src={embedUrl}
              controls
              playsInline
              autoPlay
              preload="metadata"
              className="w-full h-full object-contain bg-black"
              onLoadedData={() => setMediaLoaded(true)}
              onCanPlay={() => setMediaLoaded(true)}
              onError={() => {
                setHasError(true);
                setMediaLoaded(true);
              }}
            />
          ) : (
            /* Iframe Embed Player without restrictive sandbox and with no-referrer */
            <iframe
              key={`iframe-${embedUrl}`}
              src={embedUrl}
              title={content.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setMediaLoaded(true)}
              onError={() => {
                setHasError(true);
                setMediaLoaded(true);
              }}
            />
          )
        ) : (
          <div className="text-center p-6 space-y-2">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-white">No valid video source found</p>
            <p className="text-xs text-neutral-400">Please choose another server or report this title.</p>
          </div>
        )}

        {/* Fallback Warning Overlay if stream encounters issue */}
        {hasError && (
          <div className="absolute inset-0 bg-neutral-950/90 z-20 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-red-500" />
            <h4 className="text-base font-bold text-white">Connection Refused or Stream Blocked</h4>
            <p className="text-xs text-neutral-300 max-w-md">
              The external host ({activeServer.serverName}) may be blocking embedded playback or requires opening directly.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setPlayerMode(activeMode === 'video' ? 'iframe' : 'video');
                  setHasError(false);
                  setMediaLoaded(false);
                }}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white border border-white/10 flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Switch to {activeMode === 'video' ? 'Iframe Mode' : 'HTML5 Direct Player'}</span>
              </button>
              {embedUrl && (
                <a
                  href={embedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-red-600/30"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Play Directly in New Tab</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control Strip & Server Bar */}
      <div className="p-4 bg-neutral-900 border-t border-white/5 space-y-4">
        {/* Navigation & Mode Switcher Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            {episodes.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.player.prevEpisode}</span>
                </button>

                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-xs font-semibold text-white transition-colors cursor-pointer shadow-md shadow-red-600/30"
                >
                  <span className="hidden sm:inline">{t.player.nextEpisode}</span>
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              onClick={() => setAutoNext(!autoNext)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                autoNext
                  ? 'border-green-500/40 bg-green-950/40 text-green-300'
                  : 'border-white/10 bg-neutral-800 text-neutral-400'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t.player.autoNext}: {autoNext ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Player Mode Switcher Toggle */}
            <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-white/10 text-xs">
              <button
                onClick={() => {
                  setPlayerMode('video');
                  setHasError(false);
                  setMediaLoaded(false);
                }}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeMode === 'video'
                    ? 'bg-red-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Use HTML5 Video tag for direct MP4/stream links (Telegram Drive, Google Drive, direct video)"
              >
                <Film className="w-3 h-3" />
                <span>HTML5 Stream</span>
              </button>
              <button
                onClick={() => {
                  setPlayerMode('iframe');
                  setHasError(false);
                  setMediaLoaded(false);
                }}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeMode === 'iframe'
                    ? 'bg-red-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Use Iframe for web embed pages (YouTube, Streamtape, Vidstream)"
              >
                <Tv className="w-3 h-3" />
                <span>Iframe Embed</span>
              </button>
            </div>

            {/* Open Direct Link if needed */}
            {embedUrl && (
              <a
                href={embedUrl}
                target="_blank"
                rel="noreferrer"
                title="Open stream URL directly"
                className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Report Button */}
            <button
              onClick={() => onOpenReport(activeServer)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5 text-red-500" />
              <span>{t.player.reporting}</span>
            </button>
          </div>
        </div>

        {/* Server Selectors */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-800">
          <div className="flex items-center space-x-2 text-xs text-neutral-300 font-semibold">
            <Server className="w-4 h-4 text-red-500" />
            <span>{t.player.servers}:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {servers.map((srv) => {
              const isSelected = activeServer.id === srv.id;
              return (
                <button
                  key={srv.id}
                  onClick={() => {
                    setActiveServer(srv);
                    setMediaLoaded(false);
                    setHasError(false);
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  }`}
                >
                  <span>{srv.serverName}</span>
                  {srv.subDub && (
                    <span className="text-[10px] opacity-75 uppercase">({srv.subDub})</span>
                  )}
                  {srv.quality && (
                    <span className="text-[9px] bg-black/40 px-1 py-0.2 rounded">
                      {srv.quality}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Note / Disclaimer */}
        <p className="text-[11px] text-neutral-500 italic">
          Tip: For Telegram-Drive, Google Drive or raw MP4 links, use the <strong>HTML5 Stream</strong> mode. For embed sites, use <strong>Iframe Embed</strong> mode.
        </p>
      </div>
    </div>
  );
};
