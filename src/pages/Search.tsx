import React, { useState, useMemo, useEffect } from 'react';
import { Search as SearchIcon, X, History as HistoryIcon, Trash2, Calendar, Film } from 'lucide-react';
import { ContentItem } from '../types';
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
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load Search History from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('watchanime_search_history');
      if (saved) setSearchHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const saveToHistory = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    try {
      const updated = [trimmed, ...searchHistory.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      setSearchHistory(updated);
      localStorage.setItem('watchanime_search_history', JSON.stringify(updated));
    } catch {}
  };

  const clearHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem('watchanime_search_history');
    } catch {}
  };

  const removeHistoryItem = (itemToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = searchHistory.filter((item) => item !== itemToRemove);
    setSearchHistory(updated);
    try {
      localStorage.setItem('watchanime_search_history', JSON.stringify(updated));
    } catch {}
  };

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

  const years = ['all', '2024', '2023', '2022', '2021', '2020', '2019', '2015', '2010'];

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

      // Year filter
      const matchesYear =
        selectedYear === 'all' || item.releaseYear.toString() === selectedYear;

      return matchesQuery && matchesType && matchesGenre && matchesYear;
    });
  }, [contentList, query, selectedType, selectedGenre, selectedYear]);

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* Search Input Bar */}
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="relative">
          <SearchIcon className="w-6 h-6 text-neutral-400 absolute left-4 top-3.5" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveToHistory(query);
            }}
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

        {/* Search History Tags (MoveX Feature) */}
        {searchHistory.length > 0 && !query && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-neutral-500 flex items-center space-x-1 mr-1">
              <HistoryIcon className="w-3.5 h-3.5 text-neutral-400" />
              <span>Recent:</span>
            </span>
            {searchHistory.map((term) => (
              <span
                key={term}
                onClick={() => {
                  setQuery(term);
                  saveToHistory(term);
                }}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-red-500/50 text-neutral-300 hover:text-white transition-all cursor-pointer shadow-sm"
              >
                <span>{term}</span>
                <button
                  onClick={(e) => removeHistoryItem(term, e)}
                  className="hover:text-red-400 transition-colors cursor-pointer"
                  title="Remove from history"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearHistory}
              className="text-[11px] text-neutral-500 hover:text-red-400 underline ml-2 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

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

          <div className="flex flex-wrap items-center gap-2">
            {/* Year Dropdown */}
            <div className="flex items-center space-x-1.5 bg-neutral-900/80 px-2.5 py-1.5 rounded-lg border border-neutral-800 text-xs text-neutral-300">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y} className="bg-neutral-900 text-white">
                    {y === 'all' ? 'All Years' : y}
                  </option>
                ))}
              </select>
            </div>

            {/* Genre Dropdown */}
            <div className="flex items-center space-x-1.5 bg-neutral-900/80 px-2.5 py-1.5 rounded-lg border border-neutral-800 text-xs text-neutral-300">
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
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-neutral-400">
          {results.length} {t.search.resultsFound}
        </h2>
        {(query || selectedType !== 'all' || selectedGenre !== 'all' || selectedYear !== 'all') && (
          <button
            onClick={() => {
              setQuery('');
              setSelectedType('all');
              setSelectedGenre('all');
              setSelectedYear('all');
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
