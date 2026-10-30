import React, { useEffect, useRef } from 'react';
import { Film, Loader2, Sparkles } from 'lucide-react';
import MovieCard from './MovieCard';

export default function MovieGrid({
  items = [],
  isLoading = false,
  isLoadingMore = false,
  hasMore = true,
  onLoadMore,
  onItemClick,
  sectionTitle = 'Latest Releases',
  badgeText = 'Streaming Now',
  emptyMessage = 'No titles found matching your search.',
}) {
  const bottomRef = useRef(null);

  // Setup infinite scroll observer
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    const target = bottomRef.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [onLoadMore, hasMore, isLoading, isLoadingMore]);

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>{sectionTitle}</span>
          </h2>
          {badgeText && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600/15 text-red-400 border border-red-500/30 flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              {badgeText}
            </span>
          )}
        </div>

        {items.length > 0 && (
          <div className="text-xs text-gray-400 font-medium">
            Showing <span className="text-gray-200 font-semibold">{items.length}</span> titles
          </div>
        )}
      </div>

      {/* Grid of Cards */}
      {isLoading && items.length === 0 ? (
        // Initial Loading Skeletons
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-5">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#111827] rounded-2xl overflow-hidden border border-gray-800 animate-pulse flex flex-col"
            >
              <div className="aspect-[2/3] bg-gray-800/60" />
              <div className="p-3.5 space-y-2.5">
                <div className="h-4 bg-gray-800 rounded w-4/5" />
                <div className="h-3 bg-gray-800/60 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-5">
          {items.map((item, index) => (
            <MovieCard key={`${item.id}-${index}`} item={item} onClick={onItemClick} />
          ))}
        </div>
      ) : (
        // Empty State
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-3xl bg-[#111827]/40 border border-gray-800/80 my-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/80 text-gray-400 flex items-center justify-center mb-4">
            <Film className="w-8 h-8 stroke-1" />
          </div>
          <h3 className="text-lg font-bold text-gray-200 mb-1">No Content Found</h3>
          <p className="text-sm text-gray-400 max-w-md">{emptyMessage}</p>
        </div>
      )}

      {/* Bottom Sentinel for Infinite Scrolling */}
      <div ref={bottomRef} className="h-10 w-full" />

      {/* Infinite Scroll Spinner */}
      {isLoadingMore && (
        <div className="flex items-center justify-center gap-3 py-8 text-sm text-gray-400">
          <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
          <span>Loading more releases...</span>
        </div>
      )}

      {/* End of results indicator */}
      {!hasMore && items.length > 0 && (
        <div className="text-center py-8 text-xs text-gray-500">
          You've reached the end of the catalog
        </div>
      )}
    </div>
  );
}
