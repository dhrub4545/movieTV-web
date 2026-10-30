import React, { useState, useEffect } from 'react';
import {
  Tv,
  Play,
  Star,
  X,
  Loader2,
  Layers,
  Info,
} from 'lucide-react';
import { getSeriesDetails, seriesDetailsCache } from '../api/client';
import {
  getOptimizedPosterUrl,
  getDisplayQuality,
  getQualityBadgeClasses,
} from '../utils/contentFilter';

export default function SeriesDetailsModal({
  isOpen,
  onClose,
  seriesItem,
  onPlayEpisode, // ({ seasonNumber, episodeNumber, episodeTitle, episode })
  onPlayDefault, // hero play button
}) {
  const [loading, setLoading] = useState(false);
  const [seasons, setSeasons] = useState([]);
  const [activeSeasonIndex, setActiveSeasonIndex] = useState(0);

  useEffect(() => {
    if (!isOpen || !seriesItem) return;

    let isMounted = true;
    setActiveSeasonIndex(0);

    // If item already contains seasons array
    if (Array.isArray(seriesItem.seasons) && seriesItem.seasons.length > 0) {
      setSeasons(seriesItem.seasons);
      setLoading(false);
      return;
    }

    // Check in-memory series details cache
    if (seriesDetailsCache.has(seriesItem.id)) {
      const cached = seriesDetailsCache.get(seriesItem.id);
      setSeasons(cached.seasons || []);
      setLoading(false);
      return;
    }

    // Fetch from backend
    const loadDetails = async () => {
      setLoading(true);
      try {
        const data = await getSeriesDetails(seriesItem.id);
        if (!isMounted) return;

        const parsedSeasons =
          data?.seasons || data?.item?.seasons || seriesItem.seasons || [];
        setSeasons(parsedSeasons);
      } catch (err) {
        if (!isMounted) return;
        console.warn('Could not fetch series details:', err?.message);
        setSeasons(seriesItem.seasons || []);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [isOpen, seriesItem]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !seriesItem) return null;

  const poster = getOptimizedPosterUrl(seriesItem.posterUrl);
  const backdrop = seriesItem.backdropUrl || seriesItem.posterUrl;
  const quality = getDisplayQuality(seriesItem);
  const qualityClasses = getQualityBadgeClasses(quality);

  const currentSeason = seasons[activeSeasonIndex] || null;
  const episodes = currentSeason?.episodes || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div
        className="relative bg-[#111827] border border-gray-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Backdrop Banner Header */}
        <div className="relative h-64 sm:h-72 md:h-80 w-full shrink-0 overflow-hidden bg-gray-900">
          {backdrop && (
            <img
              src={backdrop}
              alt={seriesItem.title}
              className="w-full h-full object-cover object-center filter brightness-60"
            />
          )}

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-[#111827]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111827] via-transparent to-[#111827]/40" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black text-gray-300 hover:text-white backdrop-blur-md border border-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Info Overlay */}
          <div className="absolute bottom-6 inset-x-6 flex gap-5 items-end">
            {/* Poster Thumbnail */}
            <div className="hidden sm:block w-28 md:w-36 aspect-[2/3] shrink-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700/60 bg-gray-800">
              {poster ? (
                <img src={poster} alt={seriesItem.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <Tv className="w-10 h-10 stroke-1" />
                </div>
              )}
            </div>

            {/* Title & Metadata */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase backdrop-blur-md ${qualityClasses.badge}`}
                >
                  {quality}
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-red-600/80 text-white backdrop-blur-md flex items-center gap-1 shadow-sm">
                  <Tv className="w-3.5 h-3.5" /> Web Series
                </span>
                <span className="text-xs text-amber-400 font-semibold flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {typeof seriesItem.rating === 'number'
                    ? seriesItem.rating.toFixed(1)
                    : seriesItem.rating || '8.2'}
                </span>
                <span className="text-xs text-gray-300 font-medium">
                  {seriesItem.releaseYear || '2024'}
                </span>
                {seriesItem.category && (
                  <span className="text-xs text-gray-400">
                    • {seriesItem.category}
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                {seriesItem.title}
              </h1>

              {/* Main Play Action Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => {
                    const firstEp = seasons[0]?.episodes?.[0];
                    if (firstEp) {
                      onPlayEpisode({
                        seasonNumber: 1,
                        episodeNumber: 1,
                        episodeTitle: firstEp.episode || 'Episode 1',
                        episode: firstEp,
                        series: seriesItem,
                      });
                    } else if (onPlayDefault) {
                      onPlayDefault(seriesItem);
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-red-600/40 transition-all hover:scale-105 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Play S1:E1
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview text */}
          {seriesItem.overview && (
            <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-red-400" /> Synopsis
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">{seriesItem.overview}</p>
            </div>
          )}

          {/* Seasons & Episodes Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-500" />
                Seasons & Episodes
              </h3>
              {seasons.length > 0 && (
                <span className="text-xs text-gray-400">
                  {seasons.length} {seasons.length === 1 ? 'Season' : 'Seasons'} Available
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-red-500 animate-spin mb-2" />
                <span className="text-xs text-gray-400">Loading episodes...</span>
              </div>
            ) : seasons.length > 0 ? (
              <div className="space-y-4">
                {/* Horizontal Seasons Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {seasons.map((season, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSeasonIndex(idx)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        activeSeasonIndex === idx
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                          : 'bg-gray-800/80 text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      {season.season_name || `Season ${idx + 1}`}
                      <span className="ml-1.5 opacity-70">
                        ({season.episodes?.length || season.total_episodes || 0})
                      </span>
                    </button>
                  ))}
                </div>

                {/* Episodes List Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {episodes.length > 0 ? (
                    episodes.map((ep, epIdx) => (
                      <div
                        key={epIdx}
                        onClick={() =>
                          onPlayEpisode({
                            seasonNumber: activeSeasonIndex + 1,
                            episodeNumber: epIdx + 1,
                            episodeTitle: ep.episode || `Episode ${epIdx + 1}`,
                            episode: ep,
                            series: seriesItem,
                          })
                        }
                        className="group flex items-center justify-between p-3.5 rounded-xl bg-gray-900/60 hover:bg-red-600/10 border border-gray-800 hover:border-red-500/40 transition-all cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-800 group-hover:bg-red-600 group-hover:text-white flex items-center justify-center text-xs font-bold text-gray-300 transition-colors">
                            {epIdx + 1}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                              {ep.episode || `Episode ${epIdx + 1}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              Season {activeSeasonIndex + 1} • Episode {epIdx + 1}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 rounded-lg bg-gray-800 group-hover:bg-red-600 text-gray-300 group-hover:text-white transition-colors"
                            title="Play Episode"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-8 text-center text-sm text-gray-400">
                      No episodes listed for this season.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-gray-400">
                Episode list not available. You can still use the Play button above to stream.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
