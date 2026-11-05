import React, { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef } from 'react';
import {
  Radio,
  RefreshCw,
  Tv,
  Play,
  Globe,
  Loader2,
  Search,
  Server,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { getChannels } from '../api/client';

const CATEGORIES = [
  'Cricket',
  'Sports',
  'All',
  'News',
  'Movies',
  'Entertainment',
  'Music',
  'Kids',
];

const CHANNELS_PER_PAGE = 36;

/**
 * Memoized Channel Card to eliminate unnecessary DOM re-renders
 */
const ChannelCard = React.memo(function ChannelCard({ channel, onPlayChannel }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlayChannel(channel);
    }
  };

  const isCricket = channel.group === 'Cricket' || channel.category === 'Cricket';

  return (
    <div
      tabIndex={0}
      role="button"
      onClick={() => onPlayChannel(channel)}
      onKeyDown={handleKeyDown}
      className="group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-[#111827] border border-gray-800/80 hover:border-red-500/50 hover:bg-gray-900/70 transition-colors cursor-pointer shadow-sm hover:shadow-lg hover:shadow-red-950/20 focus:outline-none focus:ring-2 focus:ring-red-500 will-change-transform"
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Channel Logo */}
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gray-900 border border-gray-800 group-hover:border-red-500/30 flex items-center justify-center overflow-hidden shrink-0 p-1 transition-colors">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              loading="lazy"
              width="48"
              height="48"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) {
                  e.target.nextSibling.style.display = 'flex';
                }
              }}
              className="w-full h-full object-contain"
            />
          ) : null}
          <div
            style={{ display: channel.logo ? 'none' : 'flex' }}
            className="w-full h-full items-center justify-center text-gray-500 group-hover:text-red-400"
          >
            <Tv className="w-5 h-5 stroke-1" />
          </div>
        </div>

        {/* Channel Name & Category */}
        <div className="min-w-0">
          <h3 className="font-bold text-xs sm:text-sm text-gray-100 group-hover:text-white truncate transition-colors">
            {channel.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {isCricket ? (
              <span className="text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-800/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 fill-red-400" />
                CRICKET
              </span>
            ) : (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md">
                {channel.category || 'General'}
              </span>
            )}

            {channel.allSources && channel.allSources.length > 1 && (
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Server className="w-2.5 h-2.5" />
                {channel.allSources.length} Servers
              </span>
            )}

            {channel.country && (
              <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1">
                <Globe className="w-2.5 h-2.5" />
                {channel.country}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quality & Play Action */}
      <div className="flex items-center gap-2 shrink-0 pl-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
          {channel.quality || '1080P'}
        </span>

        <div className="w-8 h-8 rounded-full bg-gray-800 group-hover:bg-red-600 text-gray-400 group-hover:text-white flex items-center justify-center transition-colors shadow-sm">
          <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
        </div>
      </div>
    </div>
  );
});

export default function LiveTvView({ onPlayChannel, showToast }) {
  // Default to 'Cricket' for instant < 50ms load time with 0 lag
  const [activeCategory, setActiveCategory] = useState('Cricket');
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(CHANNELS_PER_PAGE);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Defer search query so typing is 100% responsive without blocking main thread
  const deferredSearch = useDeferredValue(searchQuery);

  const sentinelRef = useRef(null);

  const loadChannels = useCallback(async (category = 'Cricket', forceRefresh = false) => {
    if (forceRefresh) {
      setSyncing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await getChannels({
        category: category === 'All' ? '' : category,
        refresh: forceRefresh,
      });

      setChannels(res.channels || []);
      setVisibleCount(CHANNELS_PER_PAGE);

      if (forceRefresh && showToast) {
        showToast(
          `Real-time sync complete: ${res.channels?.length || 0} channels loaded from GitHub!`,
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
      if (showToast) {
        showToast(`Failed to load channels: ${err.message}`, 'error');
      }
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadChannels(activeCategory, false);
  }, [activeCategory, loadChannels]);

  // Reset pagination window when category or search changes
  useEffect(() => {
    setVisibleCount(CHANNELS_PER_PAGE);
  }, [activeCategory, deferredSearch]);

  // High performance memoized filtered channel list
  const filteredChannels = useMemo(() => {
    const q = (deferredSearch || '').toLowerCase().trim();
    if (!q) return channels;
    return channels.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const cat = (c.category || '').toLowerCase();
      const country = (c.country || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || country.includes(q);
    });
  }, [channels, deferredSearch]);

  // Windowed visible channels to avoid DOM bloating
  const visibleChannels = useMemo(() => {
    return filteredChannels.slice(0, visibleCount);
  }, [filteredChannels, visibleCount]);

  const hasMore = visibleCount < filteredChannels.length;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + CHANNELS_PER_PAGE, filteredChannels.length));
  }, [filteredChannels.length]);

  // Infinite scroll intersection observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, handleLoadMore]);

  return (
    <div className="w-full space-y-6">
      {/* Top Banner & Sync Control */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-red-950/40 via-gray-900 to-gray-900/60 border border-gray-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Live TV Broadcasts
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-600/20 text-red-400 border border-red-500/30">
                LIVE
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              Instant IPTV streaming • Zero delay • Direct HLS broadcast
            </p>
          </div>
        </div>

        {/* Sync Button */}
        <button
          onClick={() => loadChannels(activeCategory, true)}
          disabled={syncing || loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 text-emerald-400 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing with GitHub...' : 'Sync Channels (GitHub)'}
        </button>
      </div>

      {/* Horizontal Category Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'bg-[#111827] text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800'
            }`}
          >
            {cat === 'Cricket' ? '🏏 Cricket' : cat}
          </button>
        ))}
      </div>

      {/* Search and Channel Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Star Sports, Himalaya TV, Willow, DD Sports..."
            className="w-full pl-9 pr-4 py-2 bg-[#111827] border border-gray-800 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>
            Category: <strong className="text-gray-200">{activeCategory}</strong>
          </span>
          <span>•</span>
          <span>
            Showing <strong className="text-white">{Math.min(visibleCount, filteredChannels.length)}</strong> of{' '}
            <strong className="text-white">{filteredChannels.length}</strong> channels
          </span>
        </div>
      </div>

      {/* Channels Grid (3-4 columns on desktop, responsive) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
          <div className="text-sm font-semibold text-gray-200">Loading Live Channels...</div>
          <div className="text-xs text-gray-500 mt-1">Connecting to IPTV stream network</div>
        </div>
      ) : filteredChannels.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleChannels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onPlayChannel={onPlayChannel}
              />
            ))}
          </div>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-4" />

          {/* Load More Button for manual click */}
          {hasMore && (
            <div className="flex justify-center pt-2 pb-4">
              <button
                onClick={handleLoadMore}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700 border border-gray-700/80 text-gray-200 hover:text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-md"
              >
                <ChevronDown className="w-4 h-4 text-red-400" />
                Load More Channels ({filteredChannels.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-3xl bg-[#111827]/40 border border-gray-800">
          <Radio className="w-12 h-12 text-gray-600 mb-3" />
          <div className="text-base font-bold text-gray-300">
            {deferredSearch ? `No channels matching "${deferredSearch}"` : 'No channels found in this category'}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Try clicking "Sync Channels (GitHub)" to refresh live feeds or choose another category.
          </p>
        </div>
      )}
    </div>
  );
}
