import React, { useState } from 'react';
import { Star, Tv, Film, Play } from 'lucide-react';
import { getOptimizedPosterUrl, getDisplayQuality, getQualityBadgeClasses, isSeriesItem } from '../utils/contentFilter';

export default function MovieCard({ item, onClick }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isSeries = isSeriesItem(item);
  const displayQuality = getDisplayQuality(item);
  const qualityBadge = getQualityBadgeClasses(displayQuality);
  const posterUrl = getOptimizedPosterUrl(item.posterUrl);

  return (
    <div
      tabIndex={0}
      role="button"
      onClick={() => {
        if (onClick) onClick(item);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onClick) onClick(item);
        }
      }}
      className="group relative flex flex-col bg-[#111827] rounded-2xl overflow-hidden border border-gray-800/80 hover:border-red-500/50 shadow-md hover:shadow-2xl hover:shadow-red-950/20 transition-all duration-300 transform hover:-translate-y-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 cursor-pointer select-none"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full bg-gray-900 overflow-hidden">
        {/* Skeleton while image loads */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 via-gray-800 to-gray-900 animate-pulse" />
        )}

        {posterUrl && !imageError ? (
          <img
            src={posterUrl}
            alt={item.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(true);
            }}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-900 text-gray-500">
            {isSeries ? <Tv className="w-12 h-12 mb-2 stroke-1" /> : <Film className="w-12 h-12 mb-2 stroke-1" />}
            <span className="text-xs text-center font-medium line-clamp-2">{item.title}</span>
          </div>
        )}

        {/* Gradient Overlay for Top Badges */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5">
          {/* Quality Tag */}
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase backdrop-blur-md ${qualityBadge.badge}`}
          >
            {displayQuality}
          </span>

          {/* Series or Movie Tag */}
          {isSeries && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-red-600/80 text-white backdrop-blur-md flex items-center gap-1 shadow-sm">
              <Tv className="w-3 h-3" /> Series
            </span>
          )}
        </div>

        {/* Hover Quick Play Overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/50 transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-6 h-6 fill-current translate-x-0.5" />
          </div>
        </div>

        {/* Bottom Poster Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#111827] via-[#111827]/80 to-transparent pointer-events-none" />
      </div>

      {/* Card Info Content */}
      <div className="p-3.5 flex flex-col flex-1 justify-between bg-[#111827]">
        <div>
          <h3
            title={item.title}
            className="font-semibold text-sm text-gray-100 line-clamp-2 leading-snug group-hover:text-red-400 transition-colors"
          >
            {item.title}
          </h3>
        </div>

        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-800/60 text-xs text-gray-400">
          <div className="flex items-center gap-1 text-amber-400 font-medium">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating || '8.0'}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-400">
            <span>{item.releaseYear || '2024'}</span>
            {item.duration && (
              <>
                <span className="text-gray-600">•</span>
                <span className="truncate max-w-[70px]">{item.duration}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
