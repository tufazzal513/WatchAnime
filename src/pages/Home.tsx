import React from 'react';
import { ContentItem } from '../types';
import { HeroBanner } from '../components/home/HeroBanner';
import { ContentRow } from '../components/home/ContentRow';
import { useLanguage } from '../i18n/LanguageContext';
import { useWatchlist } from '../context/WatchlistContext';
import { Play } from 'lucide-react';

interface HomeProps {
  contentList: ContentItem[];
  onSelect: (content: ContentItem) => void;
  onPlay: (content: ContentItem) => void;
  onSelectGenre: (genre: string) => void;
}

export const Home: React.FC<HomeProps> = ({
  contentList,
  onSelect,
  onPlay,
  onSelectGenre,
}) => {
  const { t } = useLanguage();
  const { history } = useWatchlist();

  const featured = contentList.filter((c) => c.featured);
  const trending = contentList.filter((c) => c.trending);
  const anime = contentList.filter((c) => c.type === 'anime');
  const movies = contentList.filter((c) => c.type === 'movie');
  const series = contentList.filter((c) => c.type === 'series');
  const topRated = [...contentList].sort((a, b) => b.rating - a.rating);

  // Match history with full content items
  const continueWatchingItems = history
    .map((h) => contentList.find((c) => c.id === h.contentId))
    .filter((c): c is ContentItem => c !== undefined);

  const genres = [
    'Action',
    'Adventure',
    'Fantasy',
    'Romance',
    'Sci-Fi',
    'Supernatural',
    'Shounen',
    'Comedy',
    'Drama',
    'Mystery',
  ];

  return (
    <div className="min-h-screen bg-[#141414] pb-12">
      {/* Featured Hero Banner */}
      <HeroBanner
        featuredItems={featured.length > 0 ? featured : contentList.slice(0, 3)}
        onSelect={onSelect}
        onPlay={onPlay}
      />

      <div className="relative z-20 -mt-10 sm:-mt-16 space-y-4">
        {/* Continue Watching (if user has history) */}
        {continueWatchingItems.length > 0 && (
          <ContentRow
            title={t.home.continueWatching}
            items={continueWatchingItems}
            onSelect={onSelect}
            onPlay={onPlay}
            badge="RESUME"
          />
        )}

        {/* Trending Now */}
        <ContentRow
          title={t.home.trending}
          items={trending.length > 0 ? trending : contentList.slice(0, 6)}
          onSelect={onSelect}
          onPlay={onPlay}
          badge="HOT"
        />

        {/* Popular Anime */}
        <ContentRow
          title={t.home.popularAnime}
          items={anime}
          onSelect={onSelect}
          onPlay={onPlay}
        />

        {/* Genre Explorer Pills */}
        <div className="px-4 sm:px-6 my-8">
          <h3 className="text-sm uppercase tracking-wider text-neutral-400 font-bold mb-3">
            {t.home.exploreGenre}
          </h3>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => onSelectGenre(g)}
                className="px-4 py-2 rounded-full bg-neutral-900 hover:bg-red-600 text-neutral-300 hover:text-white border border-white/5 hover:border-red-500 text-xs font-semibold whitespace-nowrap transition-all shadow cursor-pointer"
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Popular Movies */}
        <ContentRow
          title={t.home.popularMovies}
          items={movies}
          onSelect={onSelect}
          onPlay={onPlay}
        />

        {/* Popular TV Series */}
        {series.length > 0 && (
          <ContentRow
            title={t.home.popularSeries}
            items={series}
            onSelect={onSelect}
            onPlay={onPlay}
          />
        )}

        {/* Top Rated */}
        <ContentRow
          title={t.home.topRated}
          items={topRated}
          onSelect={onSelect}
          onPlay={onPlay}
          badge="TOP"
        />
      </div>
    </div>
  );
};
