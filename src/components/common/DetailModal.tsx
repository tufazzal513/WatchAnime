import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Plus,
  Check,
  Star,
  Share2,
  AlertCircle,
  Film,
  Tv,
} from 'lucide-react';
import { ContentItem, Episode } from '../../types';
import { getEpisodes } from '../../services/contentService';
import { useLanguage } from '../../i18n/LanguageContext';
import { useWatchlist } from '../../context/WatchlistContext';

interface DetailModalProps {
  content: ContentItem | null;
  onClose: () => void;
  onPlay: (content: ContentItem, episode?: Episode) => void;
  onOpenReport: (content: ContentItem) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  content,
  onClose,
  onPlay,
  onOpenReport,
}) => {
  const { t } = useLanguage();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    if (content && (content.type === 'anime' || content.type === 'series')) {
      setLoadingEpisodes(true);
      getEpisodes(content.id)
        .then((eps) => setEpisodes(eps))
        .finally(() => setLoadingEpisodes(false));
    } else {
      setEpisodes([]);
    }
  }, [content]);

  if (!content) return null;

  const inList = isInWatchlist(content.id);

  const handleShare = async () => {
    const url = `${window.location.origin}?content=${content.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: content.title,
          text: `Watch ${content.title} on WatchAnime!`,
          url,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    navigator.clipboard.writeText(url);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-[#181818] rounded-xl shadow-2xl overflow-hidden border border-white/10 my-auto text-white max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/70 hover:bg-black text-white transition-colors cursor-pointer border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1">
          {/* Header Backdrop */}
          <div className="relative aspect-video sm:aspect-[21/9] w-full bg-black">
            <img
              src={content.backdropUrl || content.posterUrl}
              alt={content.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-transparent" />

            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-4xl font-black drop-shadow-md">{content.title}</h2>
                {content.originalTitle && content.originalTitle !== content.title && (
                  <p className="text-sm text-neutral-400 mt-0.5">{content.originalTitle}</p>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onPlay(content, episodes[0])}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded bg-red-600 hover:bg-red-700 font-bold text-white shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>{t.details.play}</span>
                </button>

                <button
                  onClick={() => toggleWatchlist(content)}
                  className="p-2.5 rounded-full bg-black/60 border border-white/30 hover:border-white transition-colors cursor-pointer"
                  title={inList ? t.details.inList : t.details.addToList}
                >
                  {inList ? <Check className="w-5 h-5 text-green-400" /> : <Plus className="w-5 h-5" />}
                </button>

                <button
                  onClick={handleShare}
                  className="p-2.5 rounded-full bg-black/60 border border-white/30 hover:border-white transition-colors cursor-pointer"
                  title={t.details.share}
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {copiedShare && (
            <div className="bg-green-600 text-white text-xs py-1 text-center font-semibold">
              Link copied to clipboard!
            </div>
          )}

          {/* Details Body */}
          <div className="p-6 space-y-6">
            {/* Meta Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-green-400 font-bold">{content.releaseYear}</span>
                  <span className="border border-white/20 px-2 py-0.5 rounded text-xs">HD 1080p</span>
                  {content.runtime && <span className="text-neutral-400">{content.runtime}</span>}
                  <div className="flex items-center space-x-1 text-amber-400 font-bold">
                    <Star className="w-4 h-4 fill-amber-400" />
                    <span>{content.rating.toFixed(1)}</span>
                  </div>
                  <span className="uppercase text-xs font-semibold px-2 py-0.5 bg-neutral-800 rounded">
                    {content.type}
                  </span>
                </div>

                <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                  {content.description}
                </p>

                {/* Report broken link button */}
                <button
                  onClick={() => onOpenReport(content)}
                  className="flex items-center space-x-1.5 text-xs text-neutral-400 hover:text-red-400 transition-colors pt-2 cursor-pointer"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>{t.details.reportBroken}</span>
                </button>
              </div>

              {/* Side Specs */}
              <div className="space-y-3 text-xs bg-neutral-900/60 p-4 rounded-lg border border-white/5">
                <div>
                  <span className="text-neutral-400 block mb-1">{t.details.genres}:</span>
                  <div className="flex flex-wrap gap-1">
                    {content.genres.map((g) => (
                      <span key={g} className="bg-neutral-800 text-neutral-200 px-2 py-0.5 rounded">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                {content.cast && content.cast.length > 0 && (
                  <div>
                    <span className="text-neutral-400 block mb-1">{t.details.cast}:</span>
                    <p className="text-neutral-200">{content.cast.join(', ')}</p>
                  </div>
                )}

                {content.director && (
                  <div>
                    <span className="text-neutral-400 block mb-1">{t.details.director}:</span>
                    <p className="text-neutral-200">{content.director}</p>
                  </div>
                )}

                {content.audioLanguage && (
                  <div>
                    <span className="text-neutral-400 block mb-1">{t.details.audio}:</span>
                    <p className="text-neutral-200">{content.audioLanguage}</p>
                  </div>
                )}

                {content.subtitles && content.subtitles.length > 0 && (
                  <div>
                    <span className="text-neutral-400 block mb-1">{t.details.subtitles}:</span>
                    <p className="text-neutral-200">{content.subtitles.join(', ')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Episodes List (Anime & TV Series) */}
            {(content.type === 'anime' || content.type === 'series') && (
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold flex items-center space-x-2">
                    <Tv className="w-5 h-5 text-red-500" />
                    <span>{t.details.episodes}</span>
                  </h3>
                  <span className="text-xs text-neutral-400">
                    {episodes.length} episodes available
                  </span>
                </div>

                {loadingEpisodes ? (
                  <p className="text-sm text-neutral-400 py-4">{t.common.loading}</p>
                ) : episodes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {episodes.map((ep) => (
                      <div
                        key={ep.id}
                        onClick={() => onPlay(content, ep)}
                        className="group flex flex-col bg-neutral-900 rounded-lg overflow-hidden border border-white/5 hover:border-red-500/50 transition-all cursor-pointer"
                      >
                        <div className="relative aspect-video w-full bg-neutral-800">
                          <img
                            src={ep.thumbnail || content.backdropUrl || content.posterUrl}
                            alt={ep.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-8 h-8 fill-white text-white drop-shadow" />
                          </div>
                          {ep.duration && (
                            <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1.5 py-0.5 rounded text-neutral-300">
                              {ep.duration}
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-red-400">EP {ep.episodeNumber}</span>
                          </div>
                          <h4 className="text-xs font-semibold text-white line-clamp-1 group-hover:text-red-400 transition-colors">
                            {ep.title}
                          </h4>
                          {ep.description && (
                            <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1">
                              {ep.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 py-4">{t.details.noEpisodesYet}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
