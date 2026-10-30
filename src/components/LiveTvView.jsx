import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  RefreshCw,
  Tv,
  Play,
  Globe,
  Loader2,
} from 'lucide-react';
import { getChannels } from '../api/client';

const CATEGORIES = [
  'All',
  'Sports',
  'News',
  'Movies',
  'Entertainment',
  'Music',
  'Kids',
];

export default function LiveTvView({ onPlayChannel, showToast }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadChannels = useCallback(async (category = 'All', forceRefresh = false) => {
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
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'bg-[#111827] text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Channel Count Subtitle */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          Category: <strong className="text-gray-200">{activeCategory}</strong>
        </span>
        <span>
          Total Channels: <strong className="text-white">{channels.length}</strong>
        </span>
      </div>

      {/* Channels Grid (3 columns on desktop, responsive) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
          <div className="text-sm font-semibold text-gray-200">Loading Live Channels...</div>
          <div className="text-xs text-gray-500 mt-1">Connecting to IPTV stream network</div>
        </div>
      ) : channels.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {channels.map((channel) => (
            <div
              key={channel.id}
              tabIndex={0}
              role="button"
              onClick={() => onPlayChannel(channel)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPlayChannel(channel);
                }
              }}
              className="group relative flex items-center justify-between p-4 rounded-2xl bg-[#111827] border border-gray-800/80 hover:border-red-500/50 hover:bg-gray-900/60 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-red-950/20 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Channel Logo */}
                <div className="w-12 h-12 rounded-xl bg-gray-900 border border-gray-800 group-hover:border-red-500/30 flex items-center justify-center overflow-hidden shrink-0 p-1.5 transition-colors">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                      className="w-full h-full object-contain"
                    />
                  ) : null}
                  <div
                    style={{ display: channel.logo ? 'none' : 'flex' }}
                    className="w-full h-full items-center justify-center text-gray-500 group-hover:text-red-400"
                  >
                    <Tv className="w-6 h-6 stroke-1" />
                  </div>
                </div>

                {/* Channel Name & Category */}
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-gray-100 group-hover:text-white truncate transition-colors">
                    {channel.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md">
                      {channel.category || 'General'}
                    </span>
                    {channel.country && (
                      <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
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
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-3xl bg-[#111827]/40 border border-gray-800">
          <Radio className="w-12 h-12 text-gray-600 mb-3" />
          <div className="text-base font-bold text-gray-300">No channels found in this category</div>
          <p className="text-xs text-gray-500 mt-1">
            Try clicking "Sync Channels (GitHub)" to refresh live feeds.
          </p>
        </div>
      )}
    </div>
  );
}
