import React from 'react';
import { Play, Plus, Check, Star } from 'lucide-react';
import { ContentItem } from '../../types';
import { useWatchlist } from '../../context/WatchlistContext';

interface MovieCardProps {
  content: ContentItem;
  onSelect: (content: ContentItem) => void;
  onPlay: (content: ContentItem) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ content, onSelect, onPlay }) => {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const inList = isInWatchlist(content.id);

  return (
    <div className="group relative flex-shrink-0 cursor-pointer select-none transition-transform duration-300 ease-out hover:scale-[1.04] hover:z-20">
      {/* Poster Image Container */}
      <div
        onClick={() => onSelect(content)}
        className="relative aspect-[2/3] w-36 sm:w-44 md:w-52 rounded-md overflow-hidden bg-neutral-900 shadow-md border border-white/5"
      >
        <img
          src={content.posterUrl}
          alt={content.title}
          loading="lazy"
          className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80';
          }}
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          <span className="bg-red-600 text-white text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow">
            {content.type === 'anime' ? 'ANIME' : content.type === 'movie' ? 'MOVIE' : 'SERIES'}
          </span>
        </div>

        <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm text-amber-400 text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-0.5 shadow">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span>{content.rating.toFixed(1)}</span>
        </div>

        {/* Hover Quick Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <div className="flex items-center space-x-2 mb-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(content);
              }}
              title="Play Now"
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-colors shadow-lg cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black ml-0.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleWatchlist(content);
              }}
              title={inList ? 'Remove from Watchlist' : 'Add to Watchlist'}
              className="w-8 h-8 rounded-full bg-black/60 border border-white/40 text-white flex items-center justify-center hover:border-white transition-colors cursor-pointer"
            >
              {inList ? <Check className="w-4 h-4 text-green-400" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>

          <h3 className="text-white text-xs sm:text-sm font-bold line-clamp-1">
            {content.title}
          </h3>

          <div className="flex items-center space-x-2 text-[10px] text-neutral-300 mt-1">
            <span className="text-green-400 font-semibold">{content.releaseYear}</span>
            <span className="border border-white/30 px-1 rounded text-[9px]">HD</span>
            {content.totalEpisodes && <span>{content.totalEpisodes} Eps</span>}
          </div>

          <div className="text-[10px] text-neutral-400 mt-1 line-clamp-1">
            {content.genres.slice(0, 2).join(' • ')}
          </div>
        </div>
      </div>

      {/* Non-hover Mobile Title */}
      <div className="mt-1.5 px-0.5 md:hidden">
        <h4 className="text-xs font-semibold text-neutral-200 truncate">{content.title}</h4>
        <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-0.5">
          <span>{content.releaseYear}</span>
          <span className="text-amber-400 font-medium">★ {content.rating.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};
