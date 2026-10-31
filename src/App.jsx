import React, { useState, useEffect, useCallback, useRef } from 'react';
import Hls from 'hls.js';
import Navbar from './components/Navbar';
import MovieGrid from './components/MovieGrid';
import LiveTvView from './components/LiveTvView';
import StreamChooserModal from './components/StreamChooserModal';
import SeriesDetailsModal from './components/SeriesDetailsModal';
import ServerConfigModal from './components/ServerConfigModal';
import VideoPlayerModal from './components/VideoPlayer/VideoPlayerModal';
import ToastContainer from './components/ToastContainer';
import {
  getMovies,
  getSeries,
  tabCaches,
  clearTabCache,
  isTabCacheValid,
  persistTabCache,
} from './api/client';
import { filterMediaList, isSeriesItem } from './utils/contentFilter';

export default function App() {
  // Navigation State: 'indian', 'global', 'series', 'live'
  const [activeTab, setActiveTab] = useState('indian');

  // Media Feed State (hydrated synchronously from session cache for instant 0ms first paint)
  const [mediaList, setMediaList] = useState(() => {
    return tabCaches['indian']?.items?.length > 0 ? [...tabCaches['indian'].items] : [];
  });
  const [currentPage, setCurrentPage] = useState(() => {
    return tabCaches['indian']?.currentPage || 1;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(() => {
    return tabCaches['indian']?.hasMorePages ?? true;
  });

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Modals & Player State
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [streamChooserOpen, setStreamChooserOpen] = useState(false);
  const [selectedMovieForChooser, setSelectedMovieForChooser] = useState(null);
  const [episodeContextForChooser, setEpisodeContextForChooser] = useState(null);

  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [selectedSeriesForModal, setSelectedSeriesForModal] = useState(null);

  const [playerOpen, setPlayerOpen] = useState(false);
  const [activePlayerStream, setActivePlayerStream] = useState(null);

  // Toasts
  const [toasts, setToasts] = useState([]);

  // HLS Engine Support
  const [isHlsSupported] = useState(() => Hls.isSupported());

  // Timestamp of last load for resume auto-refresh
  const lastLoadedTimeRef = useRef(0);
  const activeTabRef = useRef(activeTab);
  const activeSearchRef = useRef(activeSearch);

  useEffect(() => {
    activeTabRef.current = activeTab;
    activeSearchRef.current = activeSearch;
  }, [activeTab, activeSearch]);

  // Toast Dispatcher Helper
  const showToast = useCallback((message, type = 'info', title = null) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Section Title Generator
  const getSectionTitle = () => {
    if (activeSearch) {
      return `Search for '${activeSearch}'`;
    }
    switch (activeTab) {
      case 'indian':
        return 'Indian Cinema';
      case 'global':
        return 'Global Cinema';
      case 'series':
        return 'Series & Shows';
      default:
        return 'Latest Releases';
    }
  };

  // Section Badge Generator
  const getSectionBadge = () => {
    if (activeSearch) return 'Search Results';
    switch (activeTab) {
      case 'indian':
        return 'Bollywood & Regional';
      case 'global':
        return 'Hollywood & International';
      case 'series':
        return 'Complete Seasons';
      default:
        return 'Latest Releases';
    }
  };

  // Core Content Loader (supports reset or pagination append)
  const loadContent = useCallback(
    async (mode, pageToLoad = 1, reset = false, query = '') => {
      if (mode === 'live') return;

      if (reset) {
        // SWR (Stale-While-Revalidate): only show loading skeletons if we don't already have cached items
        if (!query && tabCaches[mode]?.items?.length > 0) {
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }
      } else {
        setIsLoadingMore(true);
      }

      try {
        let rawItems = [];
        const limit = 40;

        if (mode === 'indian') {
          rawItems = await getMovies({
            category: 'indian',
            page: pageToLoad,
            limit,
            search: query || undefined,
          });
        } else if (mode === 'global') {
          rawItems = await getMovies({
            category: 'global',
            page: pageToLoad,
            limit,
            search: query || undefined,
          });
        } else if (mode === 'series') {
          rawItems = await getSeries({
            page: pageToLoad,
            limit,
            search: query || undefined,
          });
        }

        // Apply strict adult filter (preserving toxic)
        const filtered = filterMediaList(rawItems);

        if (filtered.length === 0) {
          setHasMorePages(false);
          if (reset && (!tabCaches[mode]?.items || tabCaches[mode].items.length === 0)) {
            setMediaList([]);
          }
        } else {
          setHasMorePages(filtered.length >= limit);

          if (reset) {
            setMediaList(filtered);
            setCurrentPage(2);

            // Save to in-memory & session tab cache if not searching
            if (!query && tabCaches[mode]) {
              tabCaches[mode].items = [...filtered];
              tabCaches[mode].currentPage = 2;
              tabCaches[mode].hasMorePages = filtered.length >= limit;
              tabCaches[mode].lastLoadedTime = Date.now();
              persistTabCache();
            }
          } else {
            setMediaList((prev) => {
              const combined = [...prev, ...filtered];
              // Update in-memory & session tab cache
              if (!query && tabCaches[mode]) {
                tabCaches[mode].items = combined;
                tabCaches[mode].currentPage = pageToLoad + 1;
                tabCaches[mode].hasMorePages = filtered.length >= limit;
                tabCaches[mode].lastLoadedTime = Date.now();
                persistTabCache();
              }
              return combined;
            });
            setCurrentPage(pageToLoad + 1);
          }

          lastLoadedTimeRef.current = Date.now();
        }
      } catch (err) {
        console.error('Failed loading media feed:', err);
        showToast(`Failed loading feed: ${err.message}`, 'error');
        // Keep current items visible on error if we already had content
        if (reset && (!tabCaches[mode]?.items || tabCaches[mode].items.length === 0)) {
          setMediaList([]);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [showToast]
  );

  // Tab Switch Handler with Instant 0ms Visual Switching and SWR Background Revalidation
  const switchTab = useCallback(
    (newTab) => {
      setActiveTab(newTab);
      setActiveSearch('');
      setSearchQuery('');

      if (newTab === 'live') {
        return;
      }

      // Check if we have cached items for instant 0ms visual rendering
      const cache = tabCaches[newTab];
      if (cache && cache.items && cache.items.length > 0) {
        setMediaList([...cache.items]);
        setCurrentPage(cache.currentPage);
        setHasMorePages(cache.hasMorePages);
        setIsLoading(false);
        window.scrollTo({ top: 0, behavior: 'instant' });

        // SWR (Stale-While-Revalidate): Always fetch fresh release order in background
        loadContent(newTab, 1, true, '');
      } else {
        loadContent(newTab, 1, true, '');
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    },
    [loadContent]
  );

  // Initial feed load
  useEffect(() => {
    loadContent('indian', 1, true, '');
  }, [loadContent]);

  // Infinite Scroll Trigger (load next page)
  const handleLoadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMorePages || activeTab === 'live') return;
    loadContent(activeTab, currentPage, false, activeSearch);
  }, [isLoading, isLoadingMore, hasMorePages, activeTab, currentPage, activeSearch, loadContent]);

  // Search Handler
  const handleSearch = useCallback(
    (query) => {
      const q = query.trim();
      setActiveSearch(q);

      if (q) {
        loadContent(activeTab === 'live' ? 'indian' : activeTab, 1, true, q);
        if (activeTab === 'live') {
          setActiveTab('indian');
        }
      } else {
        // Empty query -> restore tab cache or reload
        switchTab(activeTab);
      }
    },
    [activeTab, loadContent, switchTab]
  );

  // Refresh Button Handler (clears cache and fetches fresh releases)
  const handleRefresh = useCallback(() => {
    if (activeTab === 'live') {
      showToast('Click "Sync Channels" inside Live TV to update IPTV streams', 'info');
      return;
    }
    clearTabCache(activeTab);
    loadContent(activeTab, 1, true, activeSearch);
    showToast('Refreshed latest releases', 'success');
  }, [activeTab, activeSearch, loadContent, showToast]);

  // 1. 5-minute Auto-refresh background loop (when at top of page and not searching)
  useEffect(() => {
    const interval = setInterval(() => {
      if (
        window.scrollY === 0 &&
        !activeSearchRef.current &&
        activeTabRef.current !== 'live'
      ) {
        clearTabCache(activeTabRef.current);
        loadContent(activeTabRef.current, 1, true, '');
        console.log('[Auto-Refresh] Refreshed feed in background');
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [loadContent]);

  // 2. 3-minute resume check when user returns/focuses the window
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastLoadedTimeRef.current;
        if (
          elapsed > 3 * 60 * 1000 &&
          !activeSearchRef.current &&
          activeTabRef.current !== 'live'
        ) {
          clearTabCache(activeTabRef.current);
          loadContent(activeTabRef.current, 1, true, '');
          console.log('[Resume-Check] Refreshed feed after returning to tab');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadContent]);

  // Media Card Click Handler
  const handleItemClick = (item) => {
    if (isSeriesItem(item)) {
      setSelectedSeriesForModal(item);
      setSeriesModalOpen(true);
    } else {
      setSelectedMovieForChooser(item);
      setEpisodeContextForChooser(null);
      setStreamChooserOpen(true);
    }
  };

  // Launch Player from Stream Chooser
  const handleSelectStream = (chosenSource) => {
    setStreamChooserOpen(false);
    setSeriesModalOpen(false);
    setActivePlayerStream(chosenSource);
    setPlayerOpen(true);
  };

  // Launch Episode from Series Details Modal
  const handlePlaySeriesEpisode = ({ seasonNumber, episodeNumber, episodeTitle, episode, series }) => {
    setSelectedMovieForChooser(series);
    setEpisodeContextForChooser({
      seasonNumber,
      episodeNumber,
      episodeTitle,
      episode,
      series,
    });
    setSeriesModalOpen(false);
    setStreamChooserOpen(true);
  };

  // Play Next Episode for Series
  const handlePlayNextEpisode = useCallback(() => {
    if (!activePlayerStream?.episodeContext) return;
    const { seasonNumber, episodeNumber, series } = activePlayerStream.episodeContext;
    if (!series || !series.seasons) return;

    const currentSeason = series.seasons.find((s, idx) => idx + 1 === seasonNumber);
    const episodes = currentSeason?.episodes || [];

    if (episodeNumber < episodes.length) {
      const nextEp = episodes[episodeNumber];
      const nextEpNum = episodeNumber + 1;
      setSelectedMovieForChooser(series);
      setEpisodeContextForChooser({
        seasonNumber,
        episodeNumber: nextEpNum,
        episodeTitle: nextEp?.episode || `Episode ${nextEpNum}`,
        episode: nextEp,
        series,
      });
      setStreamChooserOpen(true);
    } else if (seasonNumber < series.seasons.length) {
      const nextSeason = series.seasons[seasonNumber];
      const nextEp = nextSeason?.episodes?.[0];
      setSelectedMovieForChooser(series);
      setEpisodeContextForChooser({
        seasonNumber: seasonNumber + 1,
        episodeNumber: 1,
        episodeTitle: nextEp?.episode || 'Episode 1',
        episode: nextEp,
        series,
      });
      setStreamChooserOpen(true);
    } else {
      showToast('You have reached the end of this series.', 'info');
    }
  }, [activePlayerStream, showToast]);

  // Play Live Channel Directly in Player
  const handlePlayChannel = (channel) => {
    setActivePlayerStream({
      url: channel.streamUrl,
      title: channel.name,
      mediaTitle: `Live TV: ${channel.name}`,
      playerType: 1, // HLS live player
      headers: channel.headers || {},
      quality: channel.quality || '1080p',
      allSources: [
        {
          id: 'live-primary',
          quality: 'Live Stream',
          url: channel.streamUrl,
          playerType: 1,
          title: channel.name,
          headers: channel.headers || {},
        },
      ],
    });
    setPlayerOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={switchTab}
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        onOpenSettings={() => setServerModalOpen(true)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isHlsSupported={isHlsSupported}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {activeTab === 'live' ? (
          <LiveTvView onPlayChannel={handlePlayChannel} showToast={showToast} />
        ) : (
          <MovieGrid
            items={mediaList}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMorePages}
            onLoadMore={handleLoadMore}
            onItemClick={handleItemClick}
            sectionTitle={getSectionTitle()}
            badgeText={getSectionBadge()}
            emptyMessage={
              activeSearch
                ? `No results found for "${activeSearch}". Try searching another title.`
                : 'No releases available in this category right now.'
            }
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/80 py-8 bg-[#0b0f19] text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-400">MovieTV</span>
            <span>&bull;</span>
            <span>High-Definition Cinema & Live Broadcast Engine</span>
          </div>
          <div className="flex items-center gap-4 text-gray-400">
            <span>Adaptive HLS Playback</span>
            <span>&bull;</span>
            <span>200% Audio Boost</span>
            <span>&bull;</span>
            <span>Brave Shield Embed</span>
          </div>
        </div>
      </footer>

      {/* ----------------- Modals ----------------- */}

      {/* Stream Chooser Dialog */}
      <StreamChooserModal
        isOpen={streamChooserOpen}
        onClose={() => {
          setStreamChooserOpen(false);
          if (episodeContextForChooser) {
            setSeriesModalOpen(true);
          }
        }}
        item={selectedMovieForChooser}
        episodeContext={episodeContextForChooser}
        onSelectStream={handleSelectStream}
      />

      {/* Series Details Dialog */}
      <SeriesDetailsModal
        isOpen={seriesModalOpen}
        onClose={() => setSeriesModalOpen(false)}
        seriesItem={selectedSeriesForModal}
        onPlayEpisode={handlePlaySeriesEpisode}
        onPlayDefault={(series) => {
          setSelectedMovieForChooser(series);
          setEpisodeContextForChooser(null);
          setSeriesModalOpen(false);
          setStreamChooserOpen(true);
        }}
      />

      {/* Server Config Dialog */}
      <ServerConfigModal
        isOpen={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        onSaveUrl={(newUrl) => {
          showToast(`Server URL updated to ${newUrl}`, 'success');
          clearTabCache(activeTab);
          loadContent(activeTab, 1, true, activeSearch);
        }}
      />

      {/* Cinema Video Player Modal */}
      {playerOpen && activePlayerStream && (
        <VideoPlayerModal
          isOpen={playerOpen}
          onClose={() => {
            setPlayerOpen(false);
            setActivePlayerStream(null);
            setEpisodeContextForChooser(null);
          }}
          initialStream={activePlayerStream}
          showToast={showToast}
          onPlayNextEpisode={handlePlayNextEpisode}
        />
      )}

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
