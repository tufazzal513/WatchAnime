import React, { useState, useMemo } from 'react';
import { ContentItem, ContentType } from '../types';
import { MovieCard } from '../components/common/MovieCard';
import { useLanguage } from '../i18n/LanguageContext';
import { Filter, SlidersHorizontal } from 'lucide-react';

interface BrowseProps {
  type: ContentType;
  contentList: ContentItem[];
  initialGenre?: string;
  onSelect: (content: ContentItem) => void;
  onPlay: (content: ContentItem) => void;
}

export const Browse: React.FC<BrowseProps> = ({
  type,
  contentList,
  initialGenre,
  onSelect,
  onPlay,
}) => {
  const { t } = useLanguage();
  const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre || 'All');
  const [sortBy, setSortBy] = useState<'rating' | 'newest' | 'title'>('rating');

  const filteredByType = useMemo(() => {
    return contentList.filter((item) => item.type === type);
  }, [contentList, type]);

  // Extract all unique genres for this type
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    filteredByType.forEach((c) => c.genres.forEach((g) => set.add(g)));
    return ['All', ...Array.from(set)];
  }, [filteredByType]);

  const displayedItems = useMemo(() => {
    let result = [...filteredByType];
    if (selectedGenre !== 'All') {
      result = result.filter((item) => item.genres.includes(selectedGenre));
    }
    if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'newest') {
      result.sort((a, b) => b.releaseYear - a.releaseYear);
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }
    return result;
  }, [filteredByType, selectedGenre, sortBy]);

  const pageTitle =
    type === 'anime' ? t.nav.anime : type === 'movie' ? t.nav.movies : t.nav.series;

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white capitalize">{pageTitle}</h1>
          <p className="text-xs text-neutral-400 mt-1">
            {displayedItems.length} titles available
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Genre Dropdown */}
          <div className="flex items-center space-x-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300">
            <Filter className="w-3.5 h-3.5 text-red-500" />
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              {availableGenres.map((g) => (
                <option key={g} value={g} className="bg-neutral-900 text-white">
                  {g === 'All' ? 'All Genres' : g}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center space-x-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            >
              <option value="rating" className="bg-neutral-900 text-white">Top Rated</option>
              <option value="newest" className="bg-neutral-900 text-white">Release Year</option>
              <option value="title" className="bg-neutral-900 text-white">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Movie Cards */}
      {displayedItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {displayedItems.map((item) => (
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
        <div className="py-20 text-center space-y-3">
          <p className="text-neutral-400 text-base">{t.search.noResults}</p>
          <button
            onClick={() => setSelectedGenre('All')}
            className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
