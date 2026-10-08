import React from 'react';
import { ContentItem } from '../types';
import { useWatchlist } from '../context/WatchlistContext';
import { useLanguage } from '../i18n/LanguageContext';
import { History as HistoryIcon, Play, Trash2, ArrowRight } from 'lucide-react';

interface HistoryProps {
  contentList: ContentItem[];
  onSelect: (content: ContentItem) => void;
  onPlay: (content: ContentItem) => void;
  onExplore: () => void;
}

export const History: React.FC<HistoryProps> = ({
  contentList,
  onSelect,
  onPlay,
  onExplore,
}) => {
  const { t } = useLanguage();
  const { history, clearHistoryItem } = useWatchlist();

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">{t.nav.history}</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Resume watching your recently streamed anime and movies
            </p>
          </div>
        </div>
      </div>

      {history.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {history.map((item) => {
            const full = contentList.find((c) => c.id === item.contentId);
            return (
              <div
                key={item.contentId}
                className="group relative rounded-xl overflow-hidden bg-neutral-900 border border-white/5 shadow-lg flex flex-col justify-between"
              >
                <div
                  onClick={() => full && onPlay(full)}
                  className="relative aspect-video w-full bg-black cursor-pointer overflow-hidden"
                >
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Progress bar simulation */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-neutral-800">
                    <div className="h-full bg-red-600 w-3/4 rounded-r" />
                  </div>
                </div>

                <div className="p-3.5 flex items-center justify-between gap-2">
                  <div className="overflow-hidden">
                    <h4
                      onClick={() => full && onSelect(full)}
                      className="text-xs font-bold text-white truncate hover:text-red-400 cursor-pointer"
                    >
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {item.episodeNumber ? `Episode ${item.episodeNumber}` : 'Full Feature'}
                    </p>
                  </div>

                  <button
                    onClick={() => clearHistoryItem(item.contentId)}
                    title="Remove from history"
                    className="p-1.5 rounded-full text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-24 text-center space-y-4">
          <HistoryIcon className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-xl font-bold text-white">No watch history yet</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            When you start streaming an anime or movie, your progress will appear here automatically.
          </p>
          <button
            onClick={onExplore}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 font-bold text-sm text-white shadow-lg shadow-red-600/30 transition-all cursor-pointer"
          >
            <span>Start Streaming</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
