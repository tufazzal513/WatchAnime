import React from 'react';
import { ContentItem } from '../types';
import { useWatchlist } from '../context/WatchlistContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Bookmark, Play, Trash2, ArrowRight } from 'lucide-react';

interface MyListProps {
  contentList: ContentItem[];
  onSelect: (content: ContentItem) => void;
  onPlay: (content: ContentItem) => void;
  onExplore: () => void;
}

export const MyList: React.FC<MyListProps> = ({
  contentList,
  onSelect,
  onPlay,
  onExplore,
}) => {
  const { t } = useLanguage();
  const { watchlist, toggleWatchlist } = useWatchlist();

  // Match items with contentList for full object
  const fullItems = watchlist.map((w) => {
    const full = contentList.find((c) => c.id === w.contentId);
    return (
      full || {
        id: w.contentId,
        title: w.title,
        slug: w.contentId,
        type: w.type,
        description: '',
        posterUrl: w.posterUrl,
        backdropUrl: w.posterUrl,
        releaseYear: 2024,
        genres: [],
        rating: w.rating || 8.0,
        status: 'published' as const,
      }
    );
  });

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
            <Bookmark className="w-5 h-5 fill-red-500" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">{t.nav.myList}</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              {watchlist.length} titles saved to your watchlist
            </p>
          </div>
        </div>
      </div>

      {fullItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {fullItems.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-lg overflow-hidden bg-neutral-900 border border-white/5 transition-all hover:scale-105 hover:z-20 shadow-md"
            >
              <div
                onClick={() => onSelect(item)}
                className="relative aspect-[2/3] w-full cursor-pointer bg-neutral-950"
              >
                <img
                  src={item.posterUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                <div className="absolute top-2 left-2">
                  <span className="bg-red-600 text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                    {item.type}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-neutral-900 flex items-center justify-between gap-2">
                <div className="overflow-hidden">
                  <h4
                    onClick={() => onSelect(item)}
                    className="text-xs font-bold text-white truncate hover:text-red-400 cursor-pointer"
                  >
                    {item.title}
                  </h4>
                  <span className="text-[10px] text-neutral-400">★ {item.rating.toFixed(1)}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => onPlay(item)}
                    title="Watch"
                    className="p-1.5 rounded-full bg-white text-black hover:bg-neutral-200 cursor-pointer shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                  </button>
                  <button
                    onClick={() => toggleWatchlist(item)}
                    title="Remove from list"
                    className="p-1.5 rounded-full bg-neutral-800 text-neutral-400 hover:text-red-400 hover:bg-neutral-700 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center space-y-4">
          <Bookmark className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-xl font-bold text-white">Your list is currently empty</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Explore thousands of anime, movies and series and click the + button to build your personal watchlist.
          </p>
          <button
            onClick={onExplore}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 font-bold text-sm text-white shadow-lg shadow-red-600/30 transition-all cursor-pointer"
          >
            <span>Explore Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
