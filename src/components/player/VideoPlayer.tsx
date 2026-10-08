import React, { useState, useEffect } from 'react';
import {
  Server,
  SkipForward,
  SkipBack,
  RotateCcw,
  AlertTriangle,
  Layers,
  Flag,
  CheckCircle,
  ExternalLink,
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
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    if (servers.length > 0) {
      const defaultSrv = servers.find((s) => s.isDefault) || servers[0];
      setActiveServer(defaultSrv);
      setIframeLoaded(false);
    }
  }, [currentEpisode, content]);

  // Track progress on episode mount
  useEffect(() => {
    updateProgress(
      content,
      currentEpisode?.id,
      currentEpisode?.episodeNumber || 1,
      0,
      1440 // 24 min standard
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

  // Safe Embed URL Sanitizer
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
      <div className="relative aspect-video w-full bg-black flex items-center justify-center">
        {!iframeLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-10 space-y-3">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-neutral-400 font-medium">
              Connecting to {activeServer.serverName}...
            </p>
          </div>
        )}

        {embedUrl ? (
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={content.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => setIframeLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
          />
        ) : (
          <div className="text-center p-6 space-y-2">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-white">No valid video source found</p>
            <p className="text-xs text-neutral-400">Please choose another server or report this title.</p>
          </div>
        )}
      </div>

      {/* Control Strip & Server Bar */}
      <div className="p-4 bg-neutral-900 border-t border-white/5 space-y-4">
        {/* Navigation & Auto-Next Row */}
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

          {/* Report Button */}
          <button
            onClick={() => onOpenReport(activeServer)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5 text-red-500" />
            <span>{t.player.reporting}</span>
          </button>
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
                    setIframeLoaded(false);
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
          {t.player.serverSwitchPrompt}
        </p>
      </div>
    </div>
  );
};
