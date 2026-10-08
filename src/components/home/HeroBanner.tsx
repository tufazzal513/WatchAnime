import React, { useState, useEffect } from 'react';
import { Play, Info, Plus, Check, Star, Pause, PlayCircle } from 'lucide-react';
import { ContentItem } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useWatchlist } from '../../context/WatchlistContext';

interface HeroBannerProps {
  featuredItems: ContentItem[];
  onSelect: (content: ContentItem) => void;
  onPlay: (content: ContentItem) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  featuredItems,
  onSelect,
  onPlay,
}) => {
  const { t } = useLanguage();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlayingAuto, setIsPlayingAuto] = useState(true);

  const items = featuredItems.length > 0 ? featuredItems : [];
  const activeItem = items[currentIndex];

  useEffect(() => {
    if (!isPlayingAuto || items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [isPlayingAuto, items.length]);

  if (!activeItem) return null;

  const inList = isInWatchlist(activeItem.id);

  return (
    <div className="relative w-full h-[70vh] sm:h-[80vh] md:h-[88vh] overflow-hidden select-none bg-black">
      {/* Background Backdrop Image */}
      <div className="absolute inset-0">
        <img
          key={activeItem.id}
          src={activeItem.backdropUrl || activeItem.posterUrl}
          alt={activeItem.title}
          className="w-full h-full object-cover object-center animate-in fade-in duration-700 brightness-[0.75]"
        />
        {/* Cinematic Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/30 to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/50 to-transparent w-full md:w-3/4" />
      </div>

      {/* Hero Content Information */}
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col justify-end pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-2xl">
          {/* Tag Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="bg-red-600 text-white text-xs font-black tracking-wider uppercase px-2 py-0.5 rounded shadow">
              {activeItem.type.toUpperCase()}
            </span>
            <div className="flex items-center space-x-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-amber-400 text-xs font-bold border border-white/10">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{activeItem.rating.toFixed(1)}</span>
            </div>
            <span className="text-xs font-bold text-green-400 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
              {activeItem.releaseYear}
            </span>
            <span className="text-xs text-neutral-300 border border-white/20 px-1.5 py-0.5 rounded">
              HD 1080p
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-xl mb-3">
            {activeItem.title}
          </h1>

          {/* Genres */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-neutral-300 mb-3 font-medium">
            {activeItem.genres.map((genre, idx) => (
              <span key={genre} className="flex items-center">
                <span>{genre}</span>
                {idx < activeItem.genres.length - 1 && <span className="mx-1 text-red-500 font-bold">•</span>}
              </span>
            ))}
          </div>

          {/* Description */}
          <p className="text-neutral-300 text-sm sm:text-base leading-relaxed line-clamp-3 sm:line-clamp-4 max-w-xl drop-shadow mb-6">
            {activeItem.description}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onPlay(activeItem)}
              className="flex items-center space-x-2 px-6 sm:px-8 py-3 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-sm sm:text-base shadow-xl shadow-red-600/30 transition-all hover:scale-105 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>{t.home.watchNow}</span>
            </button>

            <button
              onClick={() => onSelect(activeItem)}
              className="flex items-center space-x-2 px-5 sm:px-6 py-3 rounded bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-semibold text-sm sm:text-base transition-all cursor-pointer"
            >
              <Info className="w-5 h-5" />
              <span>{t.home.moreInfo}</span>
            </button>

            <button
              onClick={() => toggleWatchlist(activeItem)}
              className="p-3 rounded-full bg-black/60 hover:bg-white/20 border border-white/30 text-white transition-all cursor-pointer"
              title={inList ? 'Remove from My List' : 'Add to My List'}
            >
              {inList ? <Check className="w-5 h-5 text-green-400" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Slide Indicators & Auto-Play Pause Control */}
      {items.length > 1 && (
        <div className="absolute right-4 sm:right-6 bottom-6 sm:bottom-12 z-20 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <button
            onClick={() => setIsPlayingAuto(!isPlayingAuto)}
            title={isPlayingAuto ? 'Pause Auto-Rotation' : 'Resume Auto-Rotation'}
            className="text-neutral-400 hover:text-white mr-1 cursor-pointer"
          >
            {isPlayingAuto ? <Pause className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
          </button>
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentIndex ? 'w-6 bg-red-600' : 'w-2 bg-neutral-600 hover:bg-neutral-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
