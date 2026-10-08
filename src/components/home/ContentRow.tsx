import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentItem } from '../../types';
import { MovieCard } from '../common/MovieCard';

interface ContentRowProps {
  title: string;
  items: ContentItem[];
  onSelect: (content: ContentItem) => void;
  onPlay: (content: ContentItem) => void;
  badge?: string;
}

export const ContentRow: React.FC<ContentRowProps> = ({
  title,
  items,
  onSelect,
  onPlay,
  badge,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.75;
      rowRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="relative mb-8 sm:mb-10 px-4 sm:px-6 group">
      {/* Row Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
          <span>{title}</span>
          {badge && (
            <span className="text-[11px] font-semibold bg-red-600/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </h2>
      </div>

      {/* Slider Container */}
      <div className="relative">
        {/* Left Arrow Button */}
        <button
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          className="absolute left-0 top-0 bottom-0 z-30 w-10 sm:w-12 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-r-md cursor-pointer disabled:opacity-0"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        {/* Content Posters Rail */}
        <div
          ref={rowRef}
          className="flex items-center space-x-3 sm:space-x-4 overflow-x-auto scrollbar-none scroll-smooth pb-4 pt-1 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <MovieCard
              key={item.id}
              content={item}
              onSelect={onSelect}
              onPlay={onPlay}
            />
          ))}
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          className="absolute right-0 top-0 bottom-0 z-30 w-10 sm:w-12 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-md cursor-pointer"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};
