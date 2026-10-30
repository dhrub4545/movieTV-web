import React, { useState, useEffect } from 'react';
import { Film, Play, X, Loader2, Sparkles, Shield, Radio } from 'lucide-react';
import { resolveStream } from '../api/client';
import { categorizeStreams } from '../utils/streamExtractor';
import { getOptimizedPosterUrl, getDisplayQuality, getQualityBadgeClasses } from '../utils/contentFilter';

export default function StreamChooserModal({
  isOpen,
  onClose,
  item,
  episodeContext = null, // { seasonNumber: 1, episodeNumber: 1, episodeTitle: "Episode 1" }
  onSelectStream,
}) {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);
  const [resolvedTitle, setResolvedTitle] = useState('');
  const [subtitles, setSubtitles] = useState([]);
  const [serverMeta, setServerMeta] = useState({ m3u8Url: '', player2Url: '', watchEmbedUrl: '' });

  useEffect(() => {
    if (!isOpen || !item) return;

    let isMounted = true;
    setLoading(true);
    setSources([]);

    const fetchStreams = async () => {
      try {
        const isSeries =
          item.type === 'tv' ||
          item.type === 'series' ||
          Boolean(episodeContext);

        const response = await resolveStream({
          id: item.id,
          tmdbId: item.tmdbId,
          title: item.title,
          type: isSeries ? 'tv' : 'movie',
          season: episodeContext?.seasonNumber || 1,
          episode: episodeContext?.episodeNumber || 1,
          refresh: false,
        });

        if (!isMounted) return;

        const categorized = categorizeStreams(response, item);
        setSources(categorized.sources);
        setSubtitles(categorized.subtitles);
        setServerMeta({
          m3u8Url: categorized.m3u8Url,
          player2Url: categorized.player2Url,
          watchEmbedUrl: categorized.watchEmbedUrl,
        });
        setResolvedTitle(
          episodeContext
            ? `${item.title} - S${episodeContext.seasonNumber}:E${episodeContext.episodeNumber}`
            : categorized.title || item.title
        );
      } catch (err) {
        if (!isMounted) return;
        console.warn('Stream resolution fallback invoked:', err?.message);
        // Fallback using item direct fields
        const categorized = categorizeStreams(null, item);
        setSources(categorized.sources);
        setServerMeta({
          m3u8Url: categorized.m3u8Url,
          player2Url: categorized.player2Url,
          watchEmbedUrl: categorized.watchEmbedUrl,
        });
        setResolvedTitle(
          episodeContext
            ? `${item.title} - S${episodeContext.seasonNumber}:E${episodeContext.episodeNumber}`
            : item.title
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStreams();

    return () => {
      isMounted = false;
    };
  }, [isOpen, item, episodeContext]);

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

  if (!isOpen || !item) return null;

  const poster = getOptimizedPosterUrl(item.posterUrl);
  const quality = getDisplayQuality(item);
  const badgeClasses = getQualityBadgeClasses(quality);

  const getSourceIcon = (playerType) => {
    switch (playerType) {
      case 1:
        return <Play className="w-5 h-5 text-red-500 fill-current" />;
      case 2:
        return <Radio className="w-5 h-5 text-amber-400" />;
      case 3:
        return <Shield className="w-5 h-5 text-blue-400" />;
      default:
        return <Play className="w-5 h-5 text-white" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative bg-[#111827] border border-gray-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="relative p-5 border-b border-gray-800/80 bg-gray-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Select Stream Server</h2>
              <p className="text-xs text-gray-400">Choose preferred player & delivery CDN</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Preview Header */}
        <div className="p-5 flex gap-4 bg-gray-900/20 border-b border-gray-800/60">
          <div className="w-20 h-28 shrink-0 bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700/50">
            {poster ? (
              <img src={poster} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <Film className="w-8 h-8 stroke-1" />
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-between py-1">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeClasses.badge}`}>
                  {quality}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {item.releaseYear || '2024'}
                </span>
                <span className="text-xs text-gray-600">•</span>
                <span className="text-xs text-gray-400">
                  {item.category || (item.type === 'tv' ? 'Series' : 'Movie')}
                </span>
              </div>

              <h3 className="font-bold text-white text-base line-clamp-1">
                {resolvedTitle || item.title}
              </h3>
              {episodeContext && (
                <p className="text-xs text-red-400 font-medium mt-0.5">
                  Season {episodeContext.seasonNumber} • Episode {episodeContext.episodeNumber} ({episodeContext.episodeTitle || 'Episode'})
                </p>
              )}
            </div>

            <p className="text-xs text-gray-400 line-clamp-2 mt-1">
              {item.overview || 'Stream high-definition cinema with low-latency adaptive playback.'}
            </p>
          </div>
        </div>

        {/* Stream Servers List */}
        <div className="p-5 space-y-3 max-h-[380px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-3" />
              <div className="text-sm font-semibold text-gray-200">Resolving Stream Servers...</div>
              <div className="text-xs text-gray-500 mt-1">Extracting high-speed HLS links</div>
            </div>
          ) : sources.length > 0 ? (
            sources.map((source, index) => (
              <button
                key={source.id || index}
                onClick={() => {
                  onSelectStream({
                    ...source,
                    mediaTitle: resolvedTitle || item.title,
                    item,
                    episodeContext,
                    subtitles,
                    allSources: sources,
                    watchEmbedUrl: serverMeta.watchEmbedUrl || item?.streams?.watch_embed || item?.watch_embed || sources.find((s) => s.playerType === 3)?.url || null,
                    player2Url: serverMeta.player2Url || item?.streams?.player_2 || item?.player_2 || sources.find((s) => s.playerType === 2)?.url || null,
                    m3u8Url: serverMeta.m3u8Url || item?.streams?.m3u8_url || item?.m3u8_url || sources.find((s) => s.playerType === 1)?.url || null,
                  });
                  onClose();
                }}
                className="w-full group flex items-center justify-between p-4 rounded-2xl bg-gray-900/60 hover:bg-red-600/10 border border-gray-800 hover:border-red-500/50 transition-all text-left shadow-sm hover:shadow-md hover:shadow-red-950/20 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-gray-800 group-hover:bg-red-600/20 group-hover:text-red-400 flex items-center justify-center border border-gray-700/60 transition-colors">
                    {getSourceIcon(source.playerType)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-gray-100 group-hover:text-white transition-colors flex items-center gap-2">
                      <span>{source.title}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{source.description}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-2 shrink-0">
                  <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-gray-300 group-hover:bg-red-600 group-hover:text-white transition-colors">
                    {source.format?.toUpperCase() || 'HLS'}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-sm text-gray-400">
              No stream sources available right now.
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="px-6 py-3 bg-gray-900/40 border-t border-gray-800/80 text-center text-xs text-gray-500">
          Tip: Server 1 is recommended for ultra-fast playback & audio boost up to 200%.
        </div>
      </div>
    </div>
  );
}
