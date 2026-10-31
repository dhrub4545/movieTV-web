import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  RotateCcw,
  FastForward,
  Rewind,
  Sun,
  Subtitles,
  Layers,
  ShieldCheck,
  ShieldOff,
  AlertCircle,
  Loader2,
  Check,
  ChevronRight,
  Tv,
} from 'lucide-react';
import {
  isM3u8Stream,
  isM3u8TokenExpired,
  categorizeStreams,
  isDirectStream,
  resolveDirectM3u8,
  getPlayableStreamUrl,
  getHeadersForStream,
} from '../../utils/streamExtractor';
import { resolveStream, saveM3u8 } from '../../api/client';

const ASPECT_MODES = [
  { id: 'fit', label: 'Aspect: Fit Screen', className: 'object-contain', iframeTransform: 'scale(1)' },
  { id: 'fill', label: 'Aspect: Fill Screen (Zoom)', className: 'object-cover scale-105', iframeTransform: 'scale(1.33)' },
  { id: 'stretch', label: 'Aspect: Stretch', className: '[object-fit:fill]', iframeTransform: 'scaleX(1.33)' },
  { id: '16-9', label: 'Aspect: 16:9 Match Width', className: 'aspect-video object-contain', iframeTransform: 'scale(1.15)' },
];

export default function VideoPlayerModal({
  isOpen,
  onClose,
  initialStream, // { url, title, format, playerType, mediaTitle, item, episodeContext, subtitles, allSources, watchEmbedUrl, player2Url, m3u8Url }
  showToast,
  onPlayNextEpisode,
}) {
  const [currentStream, setCurrentStream] = useState(initialStream);
  const activeStream = currentStream || initialStream;
  const [playerType, setPlayerType] = useState(initialStream?.playerType || 1); // 1 (Direct), 2 (Live), 3 (Web)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Volume & Audio Boost (0% to 200%)
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  // Brightness (10% to 150%)
  const [brightness, setBrightness] = useState(100);

  // Aspect Ratio Mode
  const [aspectIndex, setAspectIndex] = useState(0);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Controls Visibility
  const [showControls, setShowControls] = useState(true);

  // HUD State
  const [hudData, setHudData] = useState({ visible: false, type: null, value: null, icon: null });

  // Double-tap Seek Animation
  const [seekRipple, setSeekRipple] = useState({ left: false, right: false, delta: 0 });

  // Audio & Subtitle Tracks
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(-1);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(-1);
  const [showTrackModal, setShowTrackModal] = useState(false);

  // Error State & Auto-Refresh
  const [playerError, setPlayerError] = useState(null);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [isBraveShieldActive, setIsBraveShieldActive] = useState(true);
  const [isExtractingM3u8, setIsExtractingM3u8] = useState(false);
  const [extractingStatus, setExtractingStatus] = useState('');

  // Refs
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const hlsRef = useRef(null);
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const hudTimeoutRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const hasAttemptedTokenRefreshRef = useRef(false);
  const hasAttemptedLiveExtractionRef = useRef(false);

  // Touch Swipe Gesture State (VLC Parity)
  const touchStartRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    time: 0,
    startVol: 100,
    startBright: 100,
    startCurrentTime: 0,
    isDragging: false,
    dragType: null,
    targetSeek: null,
  });

  // Sync initial stream
  useEffect(() => {
    if (initialStream) {
      setCurrentStream(initialStream);
      setPlayerType(initialStream.playerType || 1);
      setPlayerError(null);
      hasAttemptedTokenRefreshRef.current = false;
      hasAttemptedLiveExtractionRef.current = false;
    }
  }, [initialStream]);

  // Format seconds to hh:mm:ss or mm:ss
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Trigger HUD Notification
  const triggerHud = (type, value, icon = null) => {
    setHudData({ visible: true, type, value, icon });
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => {
      setHudData((prev) => ({ ...prev, visible: false }));
    }, 1500);
  };

  // Initialize Web Audio API for Volume Boost (up to 200%)
  const initAudioBoost = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const source = ctx.createMediaElementSource(video);
        const gain = ctx.createGain();

        source.connect(gain);
        gain.connect(ctx.destination);

        audioContextRef.current = ctx;
        gainNodeRef.current = gain;
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn('Web Audio API boost setup notice:', e?.message);
    }
  }, []);

  // Update Volume (0% to 200%)
  const updateVolume = useCallback((newVol) => {
    const clamped = Math.max(0, Math.min(200, Math.round(newVol)));
    setVolume(clamped);

    initAudioBoost();

    const video = videoRef.current;
    if (video) {
      if (clamped <= 100) {
        video.volume = clamped / 100;
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = 1.0;
        }
      } else {
        video.volume = 1.0;
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = clamped / 100;
        }
      }
      video.muted = false;
      setIsMuted(false);
    }

    triggerHud('volume', clamped);
  }, [initAudioBoost]);

  // Update Brightness (10% to 150%)
  const updateBrightness = (newBright) => {
    const clamped = Math.max(10, Math.min(150, Math.round(newBright)));
    setBrightness(clamped);
    triggerHud('brightness', clamped);
  };

  // Cycle Aspect Ratio (Matches Kotlin AspectRatioFrameLayout)
  const cycleAspectRatio = () => {
    const nextIdx = (aspectIndex + 1) % ASPECT_MODES.length;
    setAspectIndex(nextIdx);
    triggerHud('aspect', ASPECT_MODES[nextIdx].label);
    if (showToast) {
      showToast(ASPECT_MODES[nextIdx].label, 'info');
    }
  };

  // Latest state references for stable callbacks
  const activeStreamRef = useRef(activeStream);
  activeStreamRef.current = activeStream;

  const playerTypeRef = useRef(playerType);
  playerTypeRef.current = playerType;

  // Save successful M3U8 back to backend
  const persistM3u8ToBackend = useCallback((directUrl) => {
    if (!directUrl || !directUrl.includes('.m3u8') || directUrl.includes('test-streams.mux.dev')) {
      return;
    }
    const stream = activeStreamRef.current;
    const currentPType = playerTypeRef.current;
    const item = stream?.item;
    const epCtx = stream?.episodeContext;

    saveM3u8({
      id: item?.id,
      title: item?.title || stream?.title,
      type: item?.type || 'movie',
      season: epCtx?.seasonNumber,
      episode: epCtx?.episodeNumber,
      m3u8Url: directUrl,
      player: currentPType,
    }).catch((err) => {
      console.warn('Could not save stream to backend:', err?.message);
    });
  }, []);

  // Dedicated Player Switcher with proper stream URL routing
  const switchPlayerType = useCallback(
    (targetType) => {
      setPlayerError(null);
      setIsBuffering(true);

      const stream = activeStreamRef.current;
      const all = stream?.allSources || [];
      const targetSource = all.find((s) => s.playerType === targetType);

      let targetUrl = targetSource?.url;
      let targetHeaders = targetSource?.headers || {};

      if (!targetUrl) {
        const ep = stream?.episodeContext?.episode || {};
        if (targetType === 1) {
          targetUrl = stream?.m3u8Url || ep.m3u8_url || ep.m3u8Url || (stream?.url?.includes('.m3u8') ? stream.url : null);
          targetHeaders = { Referer: 'https://hdstream4u.com/', Origin: 'https://hdstream4u.com' };
        } else if (targetType === 2) {
          targetUrl = stream?.player2Url || ep.player_2_m3u8_url || ep.player2M3u8Url || ep.watch_2 || ep.watch2;
          targetHeaders = { Referer: 'https://hubstream.art/', Origin: 'https://hubstream.art' };
        } else if (targetType === 3) {
          targetUrl = stream?.watchEmbedUrl || ep.watch_1_embed || ep.watch1Embed || ep.watch_1_raw || (stream?.url && !stream?.url.includes('.m3u8') ? stream.url : null);
          targetHeaders = { Referer: 'https://hdstream4u.com/' };
        }
      }

      if (!targetUrl) {
        const ep = stream?.episodeContext?.episode || {};
        if (targetType === 3) {
          targetUrl = ep.watch_1_embed || ep.watch1Embed || ep.watch_1_raw || stream?.item?.streamUrl || stream?.item?.watch_embed;
        } else if (targetType === 2) {
          targetUrl = ep.player_2_m3u8_url || ep.player2M3u8Url || ep.watch_2 || stream?.item?.player_2_m3u8_url || stream?.item?.player_2;
        } else if (targetType === 1) {
          targetUrl = ep.m3u8_url || ep.m3u8Url || stream?.item?.m3u8_url;
        }
      }

      if (!targetUrl) {
        if (showToast) {
          showToast(`Server ${targetType} stream is not available for this title.`, 'warning');
        }
        setIsBuffering(false);
        return;
      }

      setCurrentStream((prev) => ({
        ...(prev || stream || {}),
        url: targetUrl,
        headers: targetHeaders,
        playerType: targetType,
        format: targetSource?.format || (targetUrl.includes('.m3u8') ? 'hls' : 'embed'),
        title:
          targetSource?.title ||
          (targetType === 1
            ? '🎬 Server 1: Primary Stream (Direct HLS)'
            : targetType === 2
            ? '🍿 Server 2: Alternate Player (Live HLS)'
            : '🌐 Server 3: Web Stream (Watch Embed)'),
      }));

      setPlayerType(targetType);
      hasAttemptedTokenRefreshRef.current = false;
      hasAttemptedLiveExtractionRef.current = false;

      const serverLabels = {
        1: '🎬 Server 1 (Direct HLS)',
        2: '🍿 Server 2 (Alternate Player)',
        3: '🌐 Server 3 (Watch Embed)',
      };

      triggerHud('aspect', serverLabels[targetType]);
      if (showToast) {
        showToast(`Switched to ${serverLabels[targetType]}`, 'info');
      }
    },
    [showToast]
  );

  // Helper to extract clean, readable error descriptions (Matches Player1Activity.kt:1541)
  const extractReadableError = (errorData) => {
    if (!errorData) return 'Playback error';
    const code = errorData.response?.code;
    const details = errorData.details || '';

    if (code === 403) return 'HTTP 403 (Forbidden / Token Expired)';
    if (code === 404) return 'HTTP 404 (Stream Not Found)';
    if (code && code >= 500) return `HTTP ${code} (Server Error)`;
    if (details === 'manifestParsingError') return 'Stream Manifest Error: Input does not start with #EXTM3U';
    if (details === 'manifestLoadError' || details === 'manifestLoadTimeOut') return 'Stream Manifest Error: Connection Timeout';
    if (details === 'bufferStalledError') return 'Network Connection Error: Playback Stalled';
    if (details) return `Stream Error: ${details}`;
    return code ? `HTTP ${code}` : 'Network Connection Error';
  };

  // On-the-fly Real-Time Token Refresh & Playback Restart
  // Exact 1:1 Architectural Parity with Android Player1Activity.kt:1559 & Player2Activity.kt:1332
  const refreshAndRetryPlayback = useCallback(async () => {
    if (isRefreshingToken) return;
    setIsRefreshingToken(true);
    setPlayerError(null);
    setIsBuffering(true);
    setExtractingStatus(
      playerTypeRef.current === 2
        ? 'Refreshing live stream...'
        : 'Refreshing stream token...'
    );

    try {
      const stream = activeStreamRef.current;
      const currentPType = playerTypeRef.current;
      const item = stream?.item;
      const epCtx = stream?.episodeContext;

      let freshUrl = null;

      if (currentPType === 1) {
        // --- Player 1 Token Refresh (Matches Player1Activity.kt:1580) ---
        const ep = epCtx?.episode || {};
        const embedTarget = (
          stream?.watchEmbedUrl ||
          ep.watch_1_embed ||
          ep.watch1Embed ||
          ep.watch_1_raw ||
          item?.watch_embed ||
          item?.watchEmbedUrl ||
          item?.streamUrl ||
          (!stream?.url?.includes('.m3u8') ? stream?.url : null) ||
          ''
        ).trim();

        // 1. Direct real-time client-side re-extraction from watch_embed
        if (embedTarget) {
          console.info('[VideoPlayer] Player 1 re-extracting from embedTarget:', embedTarget);
          const extracted = await resolveDirectM3u8(embedTarget);
          if (extracted && isDirectStream(extracted) && !isM3u8TokenExpired(extracted)) {
            freshUrl = extracted;
            persistM3u8ToBackendRef.current(extracted);
          }
        }

        // 2. Call resolveStream from backend with refresh=true if client extraction needed fallback
        if (!freshUrl) {
          console.info('[VideoPlayer] Calling backend resolveStream(refresh=true) for Player 1...');
          const isSeriesTarget = Boolean(epCtx) || item?.type === 'tv' || item?.type === 'series';
          const resp = await resolveStream({
            id: item?.id,
            tmdbId: item?.tmdbId,
            title: item?.title || stream?.title,
            type: isSeriesTarget ? 'tv' : 'movie',
            season: epCtx?.seasonNumber || 1,
            episode: epCtx?.episodeNumber || 1,
            refresh: true,
          });

          const newEmbed = resp?.watchEmbedUrl?.trim();
          if (newEmbed && !newEmbed.includes('.m3u8')) {
            const clientExtracted = await resolveDirectM3u8(newEmbed);
            if (clientExtracted && isDirectStream(clientExtracted) && !isM3u8TokenExpired(clientExtracted)) {
              freshUrl = clientExtracted;
              persistM3u8ToBackendRef.current(clientExtracted);
            }
          }

          if (!freshUrl) {
            const candidate = resp?.m3u8Url?.trim();
            if (candidate && isDirectStream(candidate) && !isM3u8TokenExpired(candidate)) {
              freshUrl = candidate;
            } else {
              const server1 = resp?.sources?.find((s) => {
                const q = (s.quality || '').toLowerCase();
                return (
                  (q.includes('server 1') || q.includes('primary')) &&
                  isDirectStream(s.url) &&
                  !isM3u8TokenExpired(s.url)
                );
              });
              if (server1?.url) {
                freshUrl = server1.url;
              }
            }
          }
        }
      } else if (currentPType === 2) {
        // --- Player 2 Live Token Refresh (Matches Player2Activity.kt:1348) ---
        const ep = epCtx?.episode || {};
        const target = (
          stream?.player2Url ||
          ep.player_2_m3u8_url ||
          ep.player2M3u8Url ||
          ep.watch_2 ||
          ep.watch2 ||
          item?.player_2 ||
          item?.player_2_m3u8_url ||
          stream?.watchEmbedUrl ||
          ep.watch_1_embed ||
          ''
        ).trim();

        // 1. Direct client-side live extraction from player 2 target
        if (target) {
          console.info('[VideoPlayer] Player 2 live re-extracting from target:', target);
          const live = await resolveDirectM3u8(target);
          if (live && isDirectStream(live) && !isM3u8TokenExpired(live)) {
            freshUrl = live;
          }
        }

        // 2. Query backend resolveStream(refresh=true) for Player 2
        if (!freshUrl) {
          console.info('[VideoPlayer] Calling backend resolveStream(refresh=true) for Player 2...');
          const isSeriesTarget = Boolean(epCtx) || item?.type === 'tv' || item?.type === 'series';
          const resp = await resolveStream({
            id: item?.id,
            tmdbId: item?.tmdbId,
            title: item?.title || stream?.title,
            type: isSeriesTarget ? 'tv' : 'movie',
            season: epCtx?.seasonNumber || 1,
            episode: epCtx?.episodeNumber || 1,
            refresh: true,
          });

          const p2Candidate = resp?.player2M3u8Url?.trim();
          if (p2Candidate && isDirectStream(p2Candidate) && !isM3u8TokenExpired(p2Candidate)) {
            freshUrl = p2Candidate;
          } else {
            const p2Target = resp?.player2Url?.trim();
            if (p2Target) {
              const live = await resolveDirectM3u8(p2Target);
              if (live && isDirectStream(live) && !isM3u8TokenExpired(live)) {
                freshUrl = live;
              }
            }
          }
        }
      }

      if (freshUrl && isDirectStream(freshUrl)) {
        console.info(`[VideoPlayer] Token refreshed successfully on Player ${currentPType}:`, freshUrl);
        setCurrentStream((prev) => ({
          ...(prev || stream || {}),
          url: freshUrl,
          format: 'hls',
        }));
        setPlayerError(null);
        if (showToast) {
          showToast('Stream token renewed successfully!', 'success');
        }
      } else {
        throw new Error(`Unable to acquire fresh stream token for Player ${currentPType}`);
      }
    } catch (err) {
      console.error(`[VideoPlayer] Could not refresh token for Player ${playerTypeRef.current}:`, err);
      // Strictly show error - NO FALLBACK METHOD (Matches Player1Activity:1524 & Player2Activity:1298)
      setPlayerError(`Playback Error: ${err.message || 'Stream token expired or invalid'}`);
      setIsBuffering(false);
      if (showToast) {
        showToast(`Playback Error: ${err.message || 'Stream token expired'}`, 'error');
      }
    } finally {
      setIsRefreshingToken(false);
      setIsExtractingM3u8(false);
    }
  }, [isRefreshingToken, showToast]);

  const refreshAndRetryPlaybackRef = useRef(refreshAndRetryPlayback);
  refreshAndRetryPlaybackRef.current = refreshAndRetryPlayback;

  const persistM3u8ToBackendRef = useRef(persistM3u8ToBackend);
  persistM3u8ToBackendRef.current = persistM3u8ToBackend;

  const switchPlayerTypeRef = useRef(switchPlayerType);
  switchPlayerTypeRef.current = switchPlayerType;

  // Main Stream Startup & Playback Engine (Matches Android Player1Activity & Player2Activity)
  useEffect(() => {
    if (!isOpen) return;

    const streamUrl = (activeStream?.url || '').trim();
    if (!streamUrl) return;

    const ep = activeStream?.episodeContext?.episode || {};
    const watchEmbed = (
      activeStream?.watchEmbedUrl ||
      ep.watch_1_embed ||
      ep.watch1Embed ||
      ep.watch_1_raw ||
      activeStream?.item?.watch_embed ||
      activeStream?.item?.watchEmbedUrl ||
      activeStream?.item?.streamUrl ||
      ''
    ).trim();

    // ---------------- Player 3: Web Stream (Watch Embed) ----------------
    if (playerType === 3) {
      setIsBuffering(false);
      setIsExtractingM3u8(false);
      setPlayerError(null);
      return;
    }

    // ---------------- Player 1 & Player 2: Direct / Live HLS ----------------
    const isDirect = isDirectStream(streamUrl);
    const isExpired = isDirect && isM3u8TokenExpired(streamUrl);

    // If not a direct stream OR token is expired, extract fresh M3U8 directly (Exact Android parity)
    if (!isDirect || isExpired) {
      let targetToExtract = '';
      if (playerType === 1) {
        targetToExtract = !isDirect ? streamUrl : watchEmbed || streamUrl;
      } else {
        targetToExtract =
          activeStream?.player2Url ||
          ep.player_2_m3u8_url ||
          ep.player2M3u8Url ||
          ep.watch_2 ||
          ep.watch2 ||
          activeStream?.item?.player_2 ||
          activeStream?.item?.player_2_m3u8_url ||
          watchEmbed ||
          streamUrl;
      }

      console.info(`[VideoPlayer] Starting real-time extraction for Player ${playerType} from:`, targetToExtract);
      setIsExtractingM3u8(true);
      setIsBuffering(true);
      setPlayerError(null);
      setExtractingStatus(
        playerType === 2
          ? 'Connecting to Server 2 live stream...'
          : 'Extracting direct high-speed HLS stream...'
      );

      let isMounted = true;
      resolveDirectM3u8(targetToExtract, watchEmbed)
        .then((freshM3u8) => {
          if (!isMounted) return;
          setIsExtractingM3u8(false);
          if (freshM3u8 && isDirectStream(freshM3u8) && !isM3u8TokenExpired(freshM3u8)) {
            console.info(`[VideoPlayer] Extracted fresh direct M3U8 for Player ${playerType}:`, freshM3u8);
            setCurrentStream((prev) => ({
              ...(prev || activeStream || {}),
              url: freshM3u8,
              format: 'hls',
            }));
            if (playerType === 1) {
              persistM3u8ToBackendRef.current(freshM3u8);
            }
          } else {
            // Strictly show error - NO FALLBACK METHOD (Matches Player1Activity:1261 & Player2Activity:1072)
            setIsBuffering(false);
            setPlayerError(`Playback Error: Unable to acquire fresh stream token for Player ${playerType}`);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setIsExtractingM3u8(false);
          setIsBuffering(false);
          setPlayerError(`Playback Error: ${err.message || 'Stream extraction failed'}`);
        });

      return () => {
        isMounted = false;
      };
    }

    const video = videoRef.current;
    if (!video) return;

    const isHls = isM3u8Stream(streamUrl);

    // Direct progressive media playback (native HTML5 for MP4, MKV, action=watch, multidownload)
    // Matches Player1Activity:1470 ProgressiveMediaSource
    if (!isHls) {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
          hlsRef.current = null;
        } catch (_) {}
      }
      setIsBuffering(true);
      setPlayerError(null);
      const playableMp4 = getPlayableStreamUrl(streamUrl, watchEmbed, activeStream?.headers);
      video.src = playableMp4;
      video.onloadeddata = () => {
        setIsBuffering(false);
        setIsExtractingM3u8(false);
        setPlayerError(null);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      };
      video.onerror = () => {
        setIsBuffering(false);
        setPlayerError('Playback Error: Video element failed to load direct progressive stream');
      };
      return;
    }

    let hlsInstance = null;
    setIsBuffering(true);
    setPlayerError(null);

    const playableUrl = getPlayableStreamUrl(streamUrl, watchEmbed, activeStream?.headers);
    console.info(`[VideoPlayer] Initializing playback on Player ${playerType} with stream:`, playableUrl);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (_) {}
      }

      hlsInstance = new Hls({
        enableWorker: false,
        defaultAudioCodec: 'mp4a.40.2',
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        startLevel: -1,
        autoStartLoad: true,
        initialLiveManifestSize: 1,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 5,
        xhrSetup: (xhr) => {
          if (activeStream?.headers) {
            Object.entries(activeStream.headers).forEach(([k, v]) => {
              const lowerK = k.toLowerCase();
              if (lowerK !== 'referer' && lowerK !== 'origin' && lowerK !== 'user-agent') {
                try {
                  xhr.setRequestHeader(k, v);
                } catch (_) {}
              }
            });
          }
        },
      });

      hlsRef.current = hlsInstance;
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
        hlsInstance.loadSource(playableUrl);
      });

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        setIsExtractingM3u8(false);
        setPlayerError(null);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));

        if (playerType === 1) {
          persistM3u8ToBackendRef.current(streamUrl);
        }

        if (hlsInstance.audioTracks && hlsInstance.audioTracks.length > 0) {
          setAudioTracks(hlsInstance.audioTracks);
          setSelectedAudioTrack(hlsInstance.audioTrack);
        }

        if (hlsInstance.subtitleTracks && hlsInstance.subtitleTracks.length > 0) {
          setSubtitleTracks(hlsInstance.subtitleTracks);
          setSelectedSubtitleTrack(hlsInstance.subtitleTrack);
        }
      });

      hlsInstance.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        setAudioTracks(data.audioTracks || []);
      });

      hlsInstance.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        setSubtitleTracks(data.subtitleTracks || []);
      });

      let mediaRetryCount = 0;

      hlsInstance.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        console.warn('Fatal HLS Error:', data.type, data.details, 'Status:', data.response?.code);

        // Special handling for fragment parsing errors (multichannel audio, 5.1 Dolby Digital, or demuxer desync)
        if (data.details === 'fragParsingError') {
          console.warn('[VideoPlayer] fragParsingError encountered, attempting automatic recovery...', data);
          mediaRetryCount += 1;
          if (mediaRetryCount === 1) {
            hlsInstance.recoverMediaError();
            return;
          }
          if (mediaRetryCount === 2) {
            // Auto fallback: Check if another audio track (e.g. 2-channel stereo AAC) is available
            if (hlsInstance.audioTracks && hlsInstance.audioTracks.length > 1) {
              const stereoTrackIdx = hlsInstance.audioTracks.findIndex(
                (t) => !t.name?.includes('5.1') && !t.name?.includes('7.1')
              );
              if (stereoTrackIdx !== -1 && stereoTrackIdx !== hlsInstance.audioTrack) {
                console.info(`[VideoPlayer] Switching from 5.1 to 2.0 stereo audio track [${stereoTrackIdx}] (${hlsInstance.audioTracks[stereoTrackIdx].name})`);
                hlsInstance.audioTrack = stereoTrackIdx;
                hlsInstance.recoverMediaError();
                return;
              }
            }
            try {
              hlsInstance.swapAudioCodec();
              hlsInstance.recoverMediaError();
              return;
            } catch (_) {}
          }
          if (mediaRetryCount === 3 && !hasAttemptedTokenRefreshRef.current) {
            hasAttemptedTokenRefreshRef.current = true;
            console.info('[VideoPlayer] fragParsingError persists, attempting stream token refresh...');
            try {
              hlsInstance.destroy();
              hlsRef.current = null;
            } catch (_) {}
            refreshAndRetryPlaybackRef.current();
            return;
          }
        }

        const isRecoverable =
          data.details === 'manifestLoadError' ||
          data.details === 'manifestLoadTimeOut' ||
          data.details === 'manifestParsingError' ||
          data.details === 'bufferAppendError' ||
          data.details === 'levelLoadError' ||
          data.details === 'levelLoadTimeOut' ||
          data.details === 'fragLoadError' ||
          data.details === 'fragLoadTimeOut' ||
          data.response?.code === 401 ||
          data.response?.code === 403 ||
          data.response?.code === 404 ||
          data.response?.code === 410 ||
          data.response?.code === 502 ||
          data.response?.code === 503 ||
          data.type === Hls.ErrorTypes.NETWORK_ERROR;

        if (isRecoverable && !hasAttemptedTokenRefreshRef.current) {
          hasAttemptedTokenRefreshRef.current = true;
          console.info(`[VideoPlayer] Recoverable error on Player ${playerType} (${data.details || data.type}), attempting token refresh...`);
          try {
            hlsInstance.destroy();
            hlsRef.current = null;
          } catch (_) {}
          refreshAndRetryPlaybackRef.current();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          mediaRetryCount += 1;
          if (mediaRetryCount <= 2) {
            console.info(`Attempting HLS media recovery (attempt ${mediaRetryCount})...`);
            hlsInstance.recoverMediaError();
            return;
          }
          if (mediaRetryCount === 3) {
            console.info('Attempting HLS audio codec swap...');
            try {
              hlsInstance.swapAudioCodec();
              hlsInstance.recoverMediaError();
              return;
            } catch (_) {
              try {
                hlsInstance.destroy();
                hlsRef.current = null;
              } catch (_) {}
              setPlayerError('Playback Error: Media Decode Error');
              setIsBuffering(false);
              return;
            }
          }
        }

        // Strictly show error - NO FALLBACK METHOD (Matches Player1Activity:1524 & Player2Activity:1298)
        try {
          hlsInstance.destroy();
          hlsRef.current = null;
        } catch (_) {}
        const readable = extractReadableError(data);
        setPlayerError(`Playback Error: ${readable}`);
        setIsBuffering(false);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      const playableSafariUrl = getPlayableStreamUrl(streamUrl, watchEmbed, activeStream?.headers);
      video.src = playableSafariUrl;
      const onLoadedMetadata = () => {
        setIsBuffering(false);
        setIsExtractingM3u8(false);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      };
      const onError = () => {
        if (!hasAttemptedTokenRefreshRef.current) {
          hasAttemptedTokenRefreshRef.current = true;
          refreshAndRetryPlaybackRef.current();
        } else {
          setPlayerError('Playback Error: Native Safari playback failed');
          setIsBuffering(false);
        }
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', onError);

      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
      };
    }

    return () => {
      if (hlsInstance) {
        try {
          hlsInstance.destroy();
        } catch (_) {}
        hlsRef.current = null;
      }
    };
  }, [isOpen, activeStream?.url, playerType]);

  // Video Time Update & Events
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleWaiting = () => setIsBuffering(true);
  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
    setPlayerError(null);
  };
  const handlePause = () => setIsPlaying(false);

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (activeStream?.episodeContext && onPlayNextEpisode) {
      if (showToast) {
        showToast('Episode finished. Loading next episode...', 'info');
      }
      onPlayNextEpisode();
    }
  };

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        initAudioBoost();
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPlaying, initAudioBoost]);

  // Seek Scrubbing
  const handleSeek = (newTime) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Double-tap or Click Seek (-10s / +10s)
  const seekDelta = useCallback((seconds) => {
    if (videoRef.current) {
      const target = Math.max(0, Math.min(duration || 99999, currentTime + seconds));
      videoRef.current.currentTime = target;
      setCurrentTime(target);

      // Trigger Seek HUD
      triggerHud('seek', `${seconds > 0 ? '+' : ''}${seconds}s (${formatTime(target)})`);

      // Trigger Visual Ripple
      if (seconds < 0) {
        setSeekRipple({ left: true, right: false, delta: seconds });
      } else {
        setSeekRipple({ left: false, right: true, delta: seconds });
      }
      setTimeout(() => setSeekRipple({ left: false, right: false, delta: 0 }), 600);
    }
  }, [currentTime, duration]);

  // Double-click gesture handler on player container
  const handlePlayerAreaClick = (e) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    if (now - lastClickTimeRef.current < 300) {
      // Double click!
      if (clickX < width * 0.4) {
        seekDelta(-10);
      } else if (clickX > width * 0.6) {
        seekDelta(10);
      } else {
        togglePlay();
      }
      lastClickTimeRef.current = 0;
    } else {
      lastClickTimeRef.current = now;
      setShowControls((prev) => !prev);
    }
  };

  // Touch Swipe Gesture Handlers (Exact parity with Kotlin VLC Touch Gestures)
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    touchStartRef.current = {
      x,
      y,
      width: rect.width,
      height: rect.height,
      time: Date.now(),
      startVol: volume,
      startBright: brightness,
      startCurrentTime: currentTime,
      isDragging: false,
      dragType: null,
      targetSeek: null,
    };
  };

  const handleTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;

    if (!touchStartRef.current.isDragging) {
      if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
        touchStartRef.current.isDragging = true;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          touchStartRef.current.dragType = 'seek';
        } else if (touchStartRef.current.x > rect.width * 0.5) {
          touchStartRef.current.dragType = 'volume';
        } else {
          touchStartRef.current.dragType = 'brightness';
        }
      }
    }

    if (touchStartRef.current.isDragging) {
      if (touchStartRef.current.dragType === 'seek') {
        const seekPercent = deltaX / (rect.width || 1);
        const seekDeltaSec = Math.round(seekPercent * Math.min(180, duration || 120));
        const target = Math.max(0, Math.min(duration || 99999, touchStartRef.current.startCurrentTime + seekDeltaSec));
        triggerHud('seek', `${seekDeltaSec >= 0 ? '+' : ''}${seekDeltaSec}s (${formatTime(target)})`);
        touchStartRef.current.targetSeek = target;
      } else if (touchStartRef.current.dragType === 'volume') {
        const volDelta = Math.round((-deltaY / (rect.height || 1)) * 200);
        const newVol = Math.max(0, Math.min(200, touchStartRef.current.startVol + volDelta));
        updateVolume(newVol);
      } else if (touchStartRef.current.dragType === 'brightness') {
        const brightDelta = Math.round((-deltaY / (rect.height || 1)) * 150);
        const newBright = Math.max(10, Math.min(150, touchStartRef.current.startBright + brightDelta));
        updateBrightness(newBright);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current.isDragging) {
      if (touchStartRef.current.dragType === 'seek' && typeof touchStartRef.current.targetSeek === 'number') {
        handleSeek(touchStartRef.current.targetSeek);
      }
      touchStartRef.current.isDragging = false;
      touchStartRef.current.dragType = null;
    }
  };

  // Auto-hide controls after 2.8s of mouse stillness
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2800);
    }
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keyboard Shortcuts (Space, Left/Right, Up/Down, F, M, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          seekDelta(-10);
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          seekDelta(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          updateVolume(volume + 5);
          break;
        case 'ArrowDown':
          e.preventDefault();
          updateVolume(volume - 5);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          if (videoRef.current) {
            const nextMuted = !isMuted;
            videoRef.current.muted = nextMuted;
            setIsMuted(nextMuted);
            triggerHud('mute', nextMuted ? 'Muted' : `${volume}%`);
          }
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            onClose();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying, volume, isMuted, currentTime, duration, updateVolume, onClose, togglePlay, seekDelta]);

  // Switch Audio Track
  const handleSelectAudioTrack = (trackId) => {
    setSelectedAudioTrack(trackId);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackId;
    }
    setShowTrackModal(false);
  };

  // Switch Subtitle Track
  const handleSelectSubtitleTrack = (trackId, isExternal = false) => {
    setSelectedSubtitleTrack(trackId);
    const video = videoRef.current;
    if (video && video.textTracks) {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
      if (trackId >= 0 && isExternal && video.textTracks[trackId]) {
        video.textTracks[trackId].mode = 'showing';
      }
    }
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = isExternal ? -1 : trackId;
    }
    setShowTrackModal(false);
  };

  if (!isOpen || !activeStream) return null;

  const currentAspect = ASPECT_MODES[aspectIndex];
  const externalSubtitles = activeStream?.subtitles || [];

  const streamUrl = (activeStream?.url || '').trim();
  const isEmbedMode = playerType === 3;

  const ep = activeStream?.episodeContext?.episode || {};
  const rawEmbedUrl = (
    (playerType === 3 && activeStream?.watchEmbedUrl) ||
    (playerType === 3 && ep.watch_1_embed) ||
    (playerType === 3 && ep.watch1Embed) ||
    (playerType === 3 && ep.watch_1_raw) ||
    streamUrl ||
    ''
  ).trim();
  const embedUrl = rawEmbedUrl.replace(/^http:\/\//i, 'https://');

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden select-none"
      style={{
        filter: `brightness(${brightness}%)`,
      }}
    >
      {/* ----------------- Video Display Element ----------------- */}
      {isEmbedMode ? (
        // Player 3: Web Embed (no sandbox attribute to avoid host player blocking)
        <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={activeStream?.mediaTitle || activeStream?.title || 'MovieTV Web Stream'}
            referrerPolicy="no-referrer-when-downgrade"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            style={{
              transform: currentAspect.iframeTransform || 'scale(1)',
              transformOrigin: 'center center',
              transition: 'transform 0.25s ease',
            }}
            className="w-full h-full border-0"
          />
          {/* Brave Shield Status Badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-lg backdrop-blur-md">
            {isBraveShieldActive ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Brave Shield: Active</span>
              </>
            ) : (
              <>
                <ShieldOff className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300">Brave Shield: Off</span>
              </>
            )}
          </div>
        </div>
      ) : (
        // Player 1 & Player 2: Direct / Live HLS Video
        <div
          onClick={handlePlayerAreaClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative w-full h-full flex items-center justify-center bg-black cursor-pointer"
        >
          <video
            ref={videoRef}
            onTimeUpdate={handleTimeUpdate}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onPause={handlePause}
            onEnded={handleVideoEnded}
            playsInline
            crossOrigin="anonymous"
            className={`w-full h-full ${currentAspect.className} transition-all duration-200`}
          >
            {externalSubtitles.map((sub, sIdx) => (
              <track
                key={sIdx}
                kind="subtitles"
                src={sub.url}
                srcLang={sub.language || 'en'}
                label={sub.label || `Subtitle ${sIdx + 1}`}
              />
            ))}
          </video>

          {/* Buffering & Extracting Spinner */}
          {(isBuffering || isExtractingM3u8) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] pointer-events-none z-10">
              <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-3" />
              <div className="text-xs font-bold uppercase tracking-wider text-gray-200 bg-black/70 px-3.5 py-1.5 rounded-full border border-gray-800">
                {isExtractingM3u8 ? (extractingStatus || 'Extracting Direct Stream...') : 'Buffering Cinema Stream...'}
              </div>
            </div>
          )}

          {/* Double-tap Seek Left Animation */}
          {seekRipple.left && (
            <div className="absolute left-12 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center justify-center p-6 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white animate-ping-once">
              <Rewind className="w-10 h-10 fill-current text-white mb-1" />
              <span className="text-sm font-bold">-10s</span>
            </div>
          )}

          {/* Double-tap Seek Right Animation */}
          {seekRipple.right && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center justify-center p-6 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white animate-ping-once">
              <FastForward className="w-10 h-10 fill-current text-white mb-1" />
              <span className="text-sm font-bold">+10s</span>
            </div>
          )}
        </div>
      )}

      {/* ----------------- VLC Centered HUD Overlay ----------------- */}
      {hudData.visible && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none bg-black/85 backdrop-blur-md border border-gray-700/80 rounded-2xl px-6 py-4 flex flex-col items-center justify-center shadow-2xl min-w-[180px] animate-scale-up">
          {hudData.type === 'volume' && (
            <>
              <div className="flex items-center gap-2 mb-2 text-white">
                {volume === 0 || isMuted ? (
                  <VolumeX className="w-6 h-6 text-rose-400" />
                ) : (
                  <Volume2 className="w-6 h-6 text-blue-400" />
                )}
                <span className="text-base font-extrabold">{volume}%</span>
                {volume > 100 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white animate-pulse">
                    +200% BOOST
                  </span>
                )}
              </div>
              <div className="w-36 h-2 bg-gray-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-blue-500 transition-all duration-100"
                  style={{ width: `${Math.min(100, volume)}%` }}
                />
                {volume > 100 && (
                  <div
                    className="h-full bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-500 transition-all duration-100"
                    style={{ width: `${volume - 100}%` }}
                  />
                )}
              </div>
            </>
          )}

          {hudData.type === 'brightness' && (
            <>
              <div className="flex items-center gap-2 mb-2 text-white">
                <Sun className="w-6 h-6 text-amber-400" />
                <span className="text-base font-extrabold">{brightness}%</span>
              </div>
              <div className="w-36 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-100"
                  style={{ width: `${Math.min(100, brightness)}%` }}
                />
              </div>
            </>
          )}

          {hudData.type === 'seek' && (
            <div className="flex flex-col items-center text-white">
              <FastForward className="w-8 h-8 text-red-500 fill-current mb-1" />
              <span className="text-sm font-bold">{hudData.value}</span>
            </div>
          )}

          {hudData.type === 'aspect' && (
            <div className="flex flex-col items-center text-white">
              <Layers className="w-6 h-6 text-emerald-400 mb-1" />
              <span className="text-xs text-gray-400 uppercase font-semibold">Mode</span>
              <span className="text-sm font-bold text-white mt-0.5">{hudData.value}</span>
            </div>
          )}
        </div>
      )}

      {/* ----------------- Error Banner / Auto-Fallback ----------------- */}
      {playerError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
          <div className="bg-[#111827] border border-rose-500/50 p-6 rounded-3xl max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Playback Interrupted</h3>
              <p className="text-xs text-gray-400 mt-1">{playerError}</p>
            </div>
            <div className="flex items-center gap-2 justify-center pt-2 flex-wrap">
              <button
                onClick={() => {
                  hasAttemptedTokenRefreshRef.current = false;
                  refreshAndRetryPlayback();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/30"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry Server {playerType}
              </button>
              {playerType !== 1 && (
                <button
                  onClick={() => switchPlayerType(1)}
                  className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold"
                >
                  Switch Server 1
                </button>
              )}
              {playerType !== 2 && (
                <button
                  onClick={() => switchPlayerType(2)}
                  className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold"
                >
                  Switch Server 2
                </button>
              )}
              {playerType !== 3 && (
                <button
                  onClick={() => switchPlayerType(3)}
                  className="px-3.5 py-2 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold"
                >
                  Switch Server 3 (Embed)
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- Cinema Controls Overlay ----------------- */}
      <div
        className={`absolute inset-0 z-20 flex flex-col justify-between pointer-events-none transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Control Bar */}
        <div className="pointer-events-auto p-4 md:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-black/60 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 backdrop-blur-md transition-colors"
              title="Close player (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-white truncate drop-shadow">
                {activeStream?.mediaTitle || activeStream?.title || 'Unknown Media'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                <span className="text-red-400 font-semibold">{activeStream?.quality || '1080p'}</span>
                <span>•</span>
                <span>Server {playerType}</span>
                {activeStream?.episodeContext && (
                  <>
                    <span>•</span>
                    <span className="text-gray-300 font-medium">
                      S{activeStream.episodeContext?.seasonNumber}:E{activeStream.episodeContext?.episodeNumber}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Top Quick Actions (P1 / P2 / P3 Server Switcher) */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center bg-gray-900/90 p-1 rounded-xl border border-gray-800 backdrop-blur-md shadow-lg">
              <button
                onClick={() => switchPlayerType(1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  playerType === 1
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
                title="Server 1: Direct HLS Stream"
              >
                🎬 Server 1
              </button>
              <button
                onClick={() => switchPlayerType(2)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  playerType === 2
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
                title="Server 2: Live HLS Stream"
              >
                🍿 Server 2
              </button>
              <button
                onClick={() => switchPlayerType(3)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  playerType === 3
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
                title="Server 3: Sandboxed Web Embed"
              >
                🌐 Server 3
              </button>
            </div>

            {/* Brave Shield Toggle (Kotlin Player 3 btnAdBlock Parity) */}
            {isEmbedMode && (
              <button
                onClick={() => {
                  setIsBraveShieldActive((prev) => !prev);
                  if (showToast) {
                    showToast(
                      isBraveShieldActive
                        ? 'Brave Shield Disabled (Popups allowed for tricky streams)'
                        : 'Brave Shield Enabled (Popups & trackers blocked)',
                      'info'
                    );
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md transition-all ${
                  isBraveShieldActive
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80 shadow-md shadow-emerald-500/10'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-300 hover:bg-rose-900/80 shadow-md shadow-rose-500/10'
                }`}
                title={
                  isBraveShieldActive
                    ? 'Brave Shield Active (Click to disable if playback is blocked)'
                    : 'Brave Shield Off (Click to block popups & ads)'
                }
              >
                {isBraveShieldActive ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Shield: ON</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>Shield: OFF</span>
                  </>
                )}
              </button>
            )}

            {/* Aspect Ratio Button */}
            <button
              onClick={cycleAspectRatio}
              className="p-2.5 rounded-xl bg-black/60 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 backdrop-blur-md transition-colors"
              title={`Cycle aspect ratio (${currentAspect.label})`}
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Subtitles & Audio Dialog */}
            {(audioTracks.length > 1 || subtitleTracks.length > 0 || externalSubtitles.length > 0) && (
              <button
                onClick={() => setShowTrackModal(true)}
                className="p-2.5 rounded-xl bg-black/60 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 backdrop-blur-md transition-colors"
                title="Audio language & Subtitle tracks"
              >
                <Subtitles className="w-4 h-4" />
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-black/60 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 backdrop-blur-md transition-colors"
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="pointer-events-auto p-4 md:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent space-y-3">
          {/* Progress Timeline Slider */}
          {!isEmbedMode && duration > 0 && (
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-700/80 rounded-lg appearance-none cursor-pointer accent-red-600 hover:h-2.5 transition-all"
              />
              <div className="flex justify-between text-[11px] font-mono text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Bottom Actions Row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Play/Pause & Seeks */}
            <div className="flex items-center gap-3">
              {!isEmbedMode && (
                <>
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40 hover:scale-105 active:scale-95 transition-all"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current translate-x-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => seekDelta(-10)}
                    className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Rewind 10 seconds (Left Arrow)"
                  >
                    <Rewind className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => seekDelta(10)}
                    className="p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                    title="Forward 10 seconds (Right Arrow)"
                  >
                    <FastForward className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Next Episode Button if in Series context */}
              {activeStream?.episodeContext && onPlayNextEpisode && (
                <button
                  onClick={onPlayNextEpisode}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-red-600 text-xs font-semibold text-gray-200 hover:text-white transition-all shadow"
                  title="Play Next Episode"
                >
                  <span>Next Ep</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Volume Slider with Boost Indicator */}
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => {
                    const nextMuted = !isMuted;
                    if (videoRef.current) videoRef.current.muted = nextMuted;
                    setIsMuted(nextMuted);
                  }}
                  className="text-gray-300 hover:text-white"
                >
                  {volume === 0 || isMuted ? (
                    <VolumeX className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="200"
                  value={volume}
                  onChange={(e) => updateVolume(parseInt(e.target.value, 10))}
                  className="w-20 md:w-28 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />

                <span
                  className={`text-xs font-mono font-bold ${
                    volume > 100 ? 'text-red-400' : 'text-gray-300'
                  }`}
                >
                  {volume}%
                </span>
              </div>
            </div>

            {/* Brightness Slider */}
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <input
                type="range"
                min="10"
                max="150"
                value={brightness}
                onChange={(e) => updateBrightness(parseInt(e.target.value, 10))}
                className="w-16 md:w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                title="Brightness (10% to 150%)"
              />
              <span className="text-xs font-mono text-gray-400 hidden sm:inline">{brightness}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- Subtitles & Audio Selection Modal ----------------- */}
      {showTrackModal && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowTrackModal(false)}
        >
          <div
            className="bg-[#111827] border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-red-500" />
                Audio & Subtitles
              </h3>
              <button
                onClick={() => setShowTrackModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Audio Tracks */}
            {audioTracks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase text-gray-400 tracking-wider">
                  Audio Language
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {audioTracks.map((track, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectAudioTrack(idx)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-all ${
                        selectedAudioTrack === idx
                          ? 'bg-red-600/20 text-red-400 border border-red-500/40'
                          : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span>{track.name || `Audio Track ${idx + 1}`}</span>
                      {selectedAudioTrack === idx && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subtitle Tracks (Embedded HLS + External VTT) */}
            <div className="space-y-2 pt-2 border-t border-gray-800">
              <div className="text-xs font-bold uppercase text-gray-400 tracking-wider">
                Subtitles
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto">
                <button
                  onClick={() => handleSelectSubtitleTrack(-1)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-all ${
                    selectedSubtitleTrack === -1
                      ? 'bg-red-600/20 text-red-400 border border-red-500/40'
                      : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>Off (Subtitles Disabled)</span>
                  {selectedSubtitleTrack === -1 && <Check className="w-3.5 h-3.5" />}
                </button>

                {/* External Subtitles */}
                {externalSubtitles.map((sub, idx) => (
                  <button
                    key={`ext-${idx}`}
                    onClick={() => handleSelectSubtitleTrack(idx, true)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-all ${
                      selectedSubtitleTrack === idx
                        ? 'bg-red-600/20 text-red-400 border border-red-500/40'
                        : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span>{sub.label || `External Subtitle ${idx + 1}`}</span>
                    {selectedSubtitleTrack === idx && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}

                {/* Embedded HLS Subtitles */}
                {subtitleTracks.map((track, idx) => (
                  <button
                    key={`hls-${idx}`}
                    onClick={() => handleSelectSubtitleTrack(idx, false)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-all ${
                      selectedSubtitleTrack === idx
                        ? 'bg-red-600/20 text-red-400 border border-red-500/40'
                        : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span>{track.name || track.lang || `Subtitle ${idx + 1}`}</span>
                    {selectedSubtitleTrack === idx && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
