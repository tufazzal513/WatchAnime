import React, { useState, useEffect } from 'react';
import { ContentItem, Episode, VideoServer } from '../types';
import { VideoPlayer } from '../components/player/VideoPlayer';
import { getEpisodes } from '../services/contentService';
import { useLanguage } from '../i18n/LanguageContext';
import { ContentRow } from '../components/home/ContentRow';
import { ArrowLeft, Star, Tv, Info, Bookmark, Plus, Check } from 'lucide-react';
import { useWatchlist } from '../context/WatchlistContext';

interface WatchPageProps {
  content: ContentItem;
  initialEpisode?: Episode;
  allContent: ContentItem[];
  onBack: () => void;
  onSelectContent: (content: ContentItem) => void;
  onOpenReport: (server: VideoServer | null) => void;
}

export const WatchPage: React.FC<WatchPageProps> = ({
  content,
  initialEpisode,
  allContent,
  onBack,
  onSelectContent,
  onOpenReport,
}) => {
  const { t } = useLanguage();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(initialEpisode || null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    if (content.type === 'anime' || content.type === 'series') {
      setLoadingEpisodes(true);
      getEpisodes(content.id)
        .then((eps) => {
          setEpisodes(eps);
          if (!currentEpisode && eps.length > 0) {
            setCurrentEpisode(eps[0]);
          }
        })
        .finally(() => setLoadingEpisodes(false));
    }
  }, [content]);

  // Scroll to player upon opening
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [content, currentEpisode]);

  const inList = isInWatchlist(content.id);
  const similarTitles = allContent
    .filter((c) => c.id !== content.id && c.genres.some((g) => content.genres.includes(g)))
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-[#141414] pt-20 pb-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      {/* Back Button & Title Header */}
      <div className="flex items-center space-x-3 text-neutral-400 text-sm">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="text-neutral-600">/</span>
        <span className="text-white font-semibold truncate">{content.title}</span>
        {currentEpisode && (
          <>
            <span className="text-neutral-600">/</span>
            <span className="text-red-400 font-bold truncate">EP {currentEpisode.episodeNumber}</span>
          </>
        )}
      </div>

      {/* Main Video Player */}
      <VideoPlayer
        content={content}
        episodes={episodes}
        currentEpisode={currentEpisode}
        onSelectEpisode={(ep) => setCurrentEpisode(ep)}
        onOpenReport={onOpenReport}
      />

      {/* Title & Metadata Strip */}
      <div className="bg-neutral-900/60 border border-white/5 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="bg-red-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">
                {content.type.toUpperCase()}
              </span>
              <div className="flex items-center space-x-1 text-amber-400 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{content.rating.toFixed(1)}</span>
              </div>
              <span className="text-xs text-green-400 font-semibold">{content.releaseYear}</span>
              {currentEpisode && (
                <span className="text-xs text-neutral-300 font-bold bg-neutral-800 px-2 py-0.5 rounded">
                  Season {currentEpisode.seasonNumber} • Episode {currentEpisode.episodeNumber}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-3xl font-black text-white">
              {currentEpisode ? `${content.title} - ${currentEpisode.title}` : content.title}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => toggleWatchlist(content)}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors cursor-pointer border border-white/10"
            >
              {inList ? <Check className="w-4 h-4 text-green-400" /> : <Plus className="w-4 h-4" />}
              <span>{inList ? t.details.inList : t.details.addToList}</span>
            </button>
          </div>
        </div>

        <p className="text-sm text-neutral-300 leading-relaxed max-w-4xl">
          {currentEpisode?.description || content.description}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs text-neutral-400">
          <span className="font-semibold text-neutral-300">Genres:</span>
          {content.genres.map((g) => (
            <span key={g} className="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded">
              {g}
            </span>
          ))}
        </div>
      </div>

      {/* Episode Selector Rails (For Anime & TV Series) */}
      {(content.type === 'anime' || content.type === 'series') && episodes.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2">
              <Tv className="w-5 h-5 text-red-500" />
              <span>Select Episode</span>
            </h2>
            <span className="text-xs text-neutral-400">{episodes.length} Episodes</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {episodes.map((ep) => {
              const isSelected = currentEpisode?.id === ep.id;
              return (
                <button
                  key={ep.id}
                  onClick={() => setCurrentEpisode(ep)}
                  className={`text-left rounded-lg overflow-hidden border transition-all cursor-pointer p-2 ${
                    isSelected
                      ? 'bg-red-950/40 border-red-500 text-white ring-1 ring-red-500'
                      : 'bg-neutral-900 border-white/5 hover:border-neutral-700 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className={isSelected ? 'text-red-400' : 'text-neutral-400'}>
                      EP {ep.episodeNumber}
                    </span>
                    {ep.duration && (
                      <span className="text-[10px] text-neutral-500">{ep.duration}</span>
                    )}
                  </div>
                  <h4 className="text-xs font-medium truncate">{ep.title}</h4>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Similar Titles Row */}
      {similarTitles.length > 0 && (
        <div className="pt-8">
          <ContentRow
            title={t.details.similarTitles}
            items={similarTitles}
            onSelect={onSelectContent}
            onPlay={(c) => {
              onSelectContent(c);
            }}
          />
        </div>
      )}
    </div>
  );
};
