import React, { useState, useMemo, useEffect } from 'react';
import { Search as SearchIcon, X, SlidersHorizontal, Star } from 'lucide-react';
import { ContentItem, ContentType } from '../types';
import { MovieCard } from '../components/common/MovieCard';
import { useLanguage } from '../i18n/LanguageContext';

interface SearchProps {
  contentList: ContentItem[];
  initialQuery?: string;
  onSelect: (content: ContentItem) => void;
  onPlay: (content: ContentItem) => void;
}

export const Search: React.FC<SearchProps> = ({
  contentList,
  initialQuery = '',
  onSelect,
  onPlay,
}) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  const genres = [
    'all',
    'Action',
    'Adventure',
    'Fantasy',
    'Romance',
    'Sci-Fi',
    'Supernatural',
    'Shounen',
    'Horror',
    'Drama',
    'Comedy',
    'Mystery',
  ];

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return contentList.filter((item) => {
      // Query filter
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.originalTitle && item.originalTitle.toLowerCase().includes(q)) ||
        item.genres.some((g) => g.toLowerCase().includes(q)) ||
        (item.cast && item.cast.some((c) => c.toLowerCase().includes(q)));

      // Type filter
      const matchesType = selectedType === 'all' || item.type === selectedType;

      // Genre filter
      const matchesGenre =
        selectedGenre === 'all' || item.genres.includes(selectedGenre);

      return matchesQuery && matchesType && matchesGenre;
    });
  }, [contentList, query, selectedType, selectedGenre]);

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* Search Input Bar */}
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          <SearchIcon className="w-6 h-6 text-neutral-400 absolute left-4 top-3.5" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.searchPlaceholder}
            className="w-full pl-13 pr-10 py-3.5 bg-neutral-900 border border-neutral-700/60 rounded-xl text-base text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-xl"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-3.5 p-1 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-2">
          {/* Content Type Filter */}
          <div className="flex items-center space-x-1.5 bg-neutral-900/80 p-1 rounded-lg border border-neutral-800 text-xs">
            {['all', 'anime', 'movie', 'series'].map((typeKey) => (
              <button
                key={typeKey}
                onClick={() => setSelectedType(typeKey)}
                className={`px-3 py-1.5 rounded-md font-semibold capitalize transition-colors cursor-pointer ${
                  selectedType === typeKey
                    ? 'bg-red-600 text-white shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {typeKey === 'all' ? t.search.all : typeKey}
              </button>
            ))}
          </div>

          {/* Genre Dropdown */}
          <div className="flex items-center space-x-2 bg-neutral-900/80 px-3 py-1.5 rounded-lg border border-neutral-800 text-xs text-neutral-300">
            <span>{t.search.filterByGenre}:</span>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              {genres.map((g) => (
                <option key={g} value={g} className="bg-neutral-900 text-white">
                  {g === 'all' ? t.search.all : g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-neutral-400">
          {results.length} {t.search.resultsFound}
        </h2>
        {(query || selectedType !== 'all' || selectedGenre !== 'all') && (
          <button
            onClick={() => {
              setQuery('');
              setSelectedType('all');
              setSelectedGenre('all');
            }}
            className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Results Grid */}
      {results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {results.map((item) => (
            <div key={item.id} className="flex justify-center">
              <MovieCard
                content={item}
                onSelect={onSelect}
                onPlay={onPlay}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center space-y-3">
          <SearchIcon className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-lg font-bold text-neutral-300">{t.search.noResults}</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {t.search.tryAgain}
          </p>
        </div>
      )}
    </div>
  );
};
