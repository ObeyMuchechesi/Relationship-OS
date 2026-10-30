import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MonitorPlay,
  ScreenShare,
  Square,
  Play,
  Pause,
  Link as LinkIcon,
  ExternalLink,
  Info,
  Search,
  Film,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const POLL_MS = 1500;
const FREE_SOURCES = [
  { label: 'YouTube (free movies)', url: 'https://www.youtube.com/results?search_query=free+full+length+movies' },
  { label: 'Tubi', url: 'https://tubitv.com' },
  { label: 'Pluto TV', url: 'https://pluto.tv' },
  { label: 'Plex', url: 'https://watch.plex.tv' },
];

const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// YouTube IFrame API — loaded once, on demand.
let ytPromise = null;
const loadYT = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytPromise) {
    ytPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === 'function') prev();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      document.head.appendChild(s);
    });
  }
  return ytPromise;
};

export default function WatchTogether() {
  const { user } = useAuth();
  const [source, setSource] = useState('');
  const [activeSource, setActiveSource] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [remoteActive, setRemoteActive] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState('Waiting for your partner…');
  const [error, setError] = useState('');

  // Movie catalog (fetched through our own API — TMDB never sees your users).
  const [movies, setMovies] = useState([]);
  const [moviePage, setMoviePage] = useState(1);
  const [movieTotal, setMovieTotal] = useState(1);
  const [movieMode, setMovieMode] = useState('popular'); // popular | search
  const [query, setQuery] = useState('');
  const [movieBusy, setMovieBusy] = useState(false);
  const [movieErr, setMovieErr] = useState('');
  const [picked, setPicked] = useState(null);
  const [pickedInfo, setPickedInfo] = useState(null);

  // Trailer playback: TMDB's official YouTube clips play inside the shared
  // player and sync like any other source — whoever picked hosts, the other
  // follows.
  const [ytKey, setYtKey] = useState('');
  const [ytHost, setYtHost] = useState(false);
  const [ytGesture, setYtGesture] = useState(false);
  const [ytEmbedErr, setYtEmbedErr] = useState(false);

  const videoRef = useRef(null);
  const remoteRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const applyingRef = useRef(false);
  const isHostRef = useRef(false);
  const sendingRef = useRef(false); // true while we push an action we just applied
  const seenRef = useRef(new Set());
  const pickedIdRef = useRef(null);

  const ytWrapRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytHostRef = useRef(false);

  const send = useCallback(async (type, payload) => {
    try {
      await api.post('/room/signal', { type, payload });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the room');
    }
  }, []);

  const setYtHosting = (v) => {
    ytHostRef.current = v;
    setYtHost(v);
  };

  const destroyYt = () => {
    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.destroy();
      } catch {
        /* player already gone */
      }
      ytPlayerRef.current = null;
    }
  };

  // Broadcast trailer state — but only from the partner who picked it.
  const onYtState = (state) => {
    const p = ytPlayerRef.current;
    if (!p || typeof p.getCurrentTime !== 'function') return;
    const t = p.getCurrentTime() || 0;
    if (state === 1) {
      setYtGesture(false);
      if (ytHostRef.current) send('control', { action: 'yt-play', time: t });
    } else if ((state === 2 || state === 0) && ytHostRef.current) {
      send('control', { action: 'yt-pause', time: t });
    }
  };

  const applyControl = (payload) => {
    if (!payload) return;
    const action = payload.action || '';

    // Trailer commands drive the YouTube player instead of the <video>.
    if (action.startsWith('yt-')) {
      const p = ytPlayerRef.current;
      if (!p || typeof p.seekTo !== 'function') return;
      const t = Number(payload.time) || 0;
      const cur = p.getCurrentTime?.() || 0;
      if (action === 'yt-play') {
        if (Math.abs(cur - t) > 1.2) p.seekTo(t, true);
        p.playVideo?.();
      } else if (action === 'yt-pause') {
        p.pauseVideo?.();
        if (Math.abs(cur - t) > 0.8) p.seekTo(t, true);
      } else if (action === 'yt-sync') {
        if (Math.abs(cur - t) > 1.5) {
          p.seekTo(t, true);
          if (p.getPlayerState?.() !== 1) p.playVideo?.();
        }
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    applyingRef.current = true;
    try {
      if (payload.action === 'play') video.play().catch(() => {});
      else if (payload.action === 'pause') video.pause();
      else if (payload.action === 'seek' || payload.action === 'sync') {
        if (Number.isFinite(payload.time)) {
          if (Math.abs(video.currentTime - payload.time) > (payload.action === 'sync' ? 1.2 : 0.3)) {
            video.currentTime = payload.time;
          }
        }
      } else if (payload.action === 'shareEnd') {
        setRemoteActive(false);
        setRemoteStream(null);
      }
    } finally {
      setTimeout(() => {
        applyingRef.current = false;
      }, 250);
    }
  };

  const ensurePeer = () => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) send('ice', { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      // The <video> only mounts once remoteStream is set, so the stream is
      // stored in state and attached by an effect after the element exists.
      setRemoteStream(e.streams[0]);
      setRemoteActive(true);
      setStatus('Partner is sharing their screen');
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRemoteActive(false);
        setRemoteStream(null);
      }
    };
    return pc;
  };

  const startShare = async () => {
    setError('');
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(
        'Screen sharing is not supported on this browser (iPhone Safari cannot capture the screen). On iPhone, use the synced player or a free-source link instead.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      const pc = ensurePeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send('sdp-offer', { sdp: offer });
      setSharing(true);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopShare(false));
      setStatus('You are sharing your screen');
    } catch (err) {
      setError('Screen share was cancelled or blocked.');
    }
  };

  const stopShare = async (notify = true) => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    setSharing(false);
    setRemoteActive(false);
    setRemoteStream(null);
    if (notify) send('control', { action: 'shareEnd' });
    setStatus('Waiting for your partner…');
  };

  const loadMovies = async (mode, page = 1, q = '') => {
    setMovieBusy(true);
    setMovieErr('');
    try {
      const { data } =
        mode === 'search'
          ? await api.get('/movies/search', { params: { q, page } })
          : await api.get('/movies/popular', { params: { page } });
      setMovieMode(mode);
      setMoviePage(data.page || 1);
      setMovieTotal(data.totalPages || 1);
      setMovies((prev) => (page === 1 ? data.movies : [...prev, ...data.movies]));
    } catch (err) {
      setMovieErr(err.response?.data?.message || 'Movie catalog unavailable right now.');
    } finally {
      setMovieBusy(false);
    }
  };

  const searchMovies = (e) => {
    e.preventDefault();
    if (!query.trim()) return loadMovies('popular', 1);
    loadMovies('search', 1, query.trim());
  };

  const pickMovie = (m) => {
    // Re-picking the title that's already up must not clear its details —
    // nothing would refetch them and the trailer would vanish.
    if (String(pickedIdRef.current) !== String(m.id)) {
      setPicked(m);
      setPickedInfo(null);
    }
    setYtHosting(true); // we chose it, so our player leads
    send('movie', { id: m.id, title: m.title, year: m.year, rating: m.rating, overview: m.overview, poster: m.poster, backdrop: m.backdrop });
  };

  // Track the current pick for the signal handler below.
  useEffect(() => {
    pickedIdRef.current = picked?.id ?? null;
  }, [picked]);

  // Initial catalog page.
  useEffect(() => {
    loadMovies('popular', 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Details, where-to-watch and trailer for whichever movie is picked.
  useEffect(() => {
    if (!picked?.id) return;
    let cancelled = false;
    api
      .get(`/movies/${picked.id}`)
      .then(({ data }) => !cancelled && setPickedInfo(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [picked?.id]);

  // The top-ranked official trailer becomes what plays in the shared player.
  useEffect(() => {
    const key = pickedInfo?.videos?.[0]?.key || '';
    setYtKey(key);
    setYtGesture(false);
    setYtEmbedErr(false);
    if (key) {
      videoRef.current?.pause();
      setStatus('Watching the trailer together');
    }
  }, [pickedInfo]);

  // Create (or retarget) the YouTube player for the picked trailer.
  useEffect(() => {
    if (!ytKey) {
      destroyYt();
      return;
    }
    videoRef.current?.pause();
    let cancelled = false;
    loadYT()
      .then((YT) => {
        if (cancelled || !ytWrapRef.current) return;
        if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
          ytPlayerRef.current.loadVideoById(ytKey);
          return;
        }
        const host = document.createElement('div');
        host.style.cssText = 'position:absolute;inset:0';
        ytWrapRef.current.appendChild(host);
        const player = new YT.Player(host, {
          videoId: ytKey,
          playerVars: { enablejsapi: 1, origin: window.location.origin, rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              if (!cancelled) ytPlayerRef.current?.playVideo?.();
            },
            onStateChange: (e) => onYtState(e.data),
            onAutoplayBlocked: () => !cancelled && setYtGesture(true),
            onError: () => !cancelled && setYtEmbedErr(true),
          },
        });
        ytPlayerRef.current = player;
      })
      .catch(() => !cancelled && setYtEmbedErr(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytKey]);

  // Tear the player down when the watch room unmounts.
  useEffect(() => () => destroyYt(), []);

  // While hosting the trailer, correct the partner's drift every few seconds.
  useEffect(() => {
    if (!ytKey) return undefined;
    const id = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!ytHostRef.current || !p || typeof p.getCurrentTime !== 'function') return;
      if (p.getPlayerState?.() !== 1) return;
      send('control', { action: 'yt-sync', time: p.getCurrentTime() || 0 });
    }, 4000);
    return () => clearInterval(id);
  }, [ytKey, send]);

  // Attach the incoming WebRTC stream as soon as its <video> element renders,
  // and start playback explicitly — muted autoplay is always allowed, so the
  // partner sees the share the moment it arrives, with no click needed.
  useEffect(() => {
    const el = remoteRef.current;
    if (el && remoteStream) {
      el.srcObject = remoteStream;
      el.muted = true;
      el.play().catch(() => {});
    }
  }, [remoteStream, remoteActive]);

  // Poll partner signals. Each poll continues from the last successful one
  // (small overlap) instead of a fixed lookback, so a tab that slept in the
  // background still receives whatever the partner sent meanwhile.
  useEffect(() => {
    let stopped = false;
    let lastPoll = 0;
    const tick = async () => {
      const since = lastPoll ? lastPoll - 2000 : Date.now() - 120000;
      try {
        const { data } = await api.get('/room/signal', {
          params: { since: new Date(since).toISOString() },
        });
        if (stopped) return;
        lastPoll = Date.now();
        for (const sig of data) {
          if (seenRef.current.has(sig.id)) continue;
          seenRef.current.add(sig.id);
          if (seenRef.current.size > 500) seenRef.current = new Set([...seenRef.current].slice(-200));

          if (sig.type === 'source' && sig.payload?.url) {
            isHostRef.current = false;
            setIsHost(false);
            setActiveSource(sig.payload.url);
            setSource(sig.payload.url);
            setYtKey(''); // a loaded video takes over the player
            setStatus('Playing together');
          } else if (sig.type === 'movie' && sig.payload?.title) {
            // Partner picked a movie — show it for both of us, their player
            // leads. Same title as what's already up? Keep it playing.
            setYtHosting(false);
            if (String(pickedIdRef.current) !== String(sig.payload?.id)) {
              setPicked(sig.payload);
              setPickedInfo(null);
            }
          } else if (sig.type === 'control') {
            applyControl(sig.payload);
          } else if (sig.type === 'sdp-offer') {
            const pc = ensurePeer();
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send('sdp-answer', { sdp: answer });
          } else if (sig.type === 'sdp-answer') {
            await pcRef.current?.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
          } else if (sig.type === 'ice' && sig.payload?.candidate) {
            try {
              await pcRef.current?.addIceCandidate(new RTCIceCandidate(sig.payload.candidate));
            } catch {
              /* candidate arrived before the peer connection existed — safe to drop */
            }
          }
        }
      } catch {
        /* transient poll failure — keep going */
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    // Returning to the tab immediately catches up on anything sent while hidden.
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Local playback events → broadcast when we are the host.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const emit = (action) => {
      if (applyingRef.current) return;
      if (!isHostRef.current) return;
      send('control', { action, time: video.currentTime });
    };
    const onTime = () => {
      setPos(video.currentTime || 0);
      setDur(video.duration || 0);
      if (!applyingRef.current) emit('sync');
    };

    const onPlay = () => {
      setPlaying(true);
      emit('play');
    };
    const onPause = () => {
      setPlaying(false);
      emit('pause');
    };
    const onSeeked = () => emit('seek');

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('timeupdate', onTime);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('timeupdate', onTime);
    };
  }, [activeSource, send]);

  const loadSource = () => {
    if (!source.trim()) return;
    isHostRef.current = true;
    setIsHost(true);
    setActiveSource(source.trim());
    send('source', { url: source.trim() });
    setYtKey(''); // a loaded video takes over the player
    setStatus('Playing together (you are hosting)');
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const seek = (e) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(e.target.value);
  };

  const fmt = (s) =>
    Number.isFinite(s)
      ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
      : '0:00';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <MonitorPlay className="w-6 h-6 text-rose-500" />
        <h1 className="h-display">Watch together</h1>
      </div>
      <p className="t-body text-stone-600 -mt-2">
        One of you picks a movie, loads a video or shares a screen — the other sees it live, in
        sync, on phone or desktop.
      </p>

      <div className="card space-y-3">
        <label className="label">Video link (direct .mp4/.webm links sync best)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input flex-1"
            placeholder="https://example.com/movie.mp4"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <button className="btn-primary" onClick={loadSource} disabled={!source.trim()}>
            <Play className="w-4 h-4" />
            Load for both of us
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center pt-1">
          <span className="t-label">Free sources:</span>
          {FREE_SOURCES.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost !py-1.5 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {s.label}
            </a>
          ))}
        </div>          <p className="t-meta flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Open a service above in a shared call, or screen-share it — picking a movie plays its
            official trailer here for both of you, and the full film stays with its legal
            provider.
          </p>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="h-section !text-base flex items-center gap-2">
              <Film className="w-4 h-4 text-rose-500" />
              Movie night
            </h2>
            <span className="t-meta">Pick one — its trailer plays here for both of you</span>
          </div>

          {picked && (
            <div className="flex gap-3 rounded-xl bg-stone-50 border border-stone-200 p-3">
              {picked.poster ? (
                <img src={picked.poster} alt="" className="w-20 shrink-0 rounded-lg shadow-sm" />
              ) : (
                <div className="w-20 h-28 shrink-0 rounded-lg bg-stone-200 grid place-items-center text-stone-400">
                  <Film className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-display font-semibold text-stone-800">
                  {picked.title}{' '}
                  {picked.year && <span className="t-meta font-normal">({picked.year})</span>}
                </p>
                <p className="t-meta">
                  {picked.rating > 0 && <>★ {picked.rating} · </>}tonight's pick — both of you are
                  seeing this
                </p>
                {picked.overview && (
                  <p className="text-sm text-stone-600 mt-1 overflow-hidden line-clamp-3">
                    {picked.overview}
                  </p>
                )}
                {pickedInfo?.providers?.options?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pickedInfo.providers.options.slice(0, 8).map((o, i) => (
                      <a
                        key={`${o.name}-${i}`}
                        href={pickedInfo.providers.link || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] bg-white border border-stone-200 rounded-full px-2 py-0.5 hover:border-rose-300"
                      >
                        {o.logo && <img src={o.logo} alt="" className="w-4 h-4 rounded-sm" />}
                        {o.name}
                        <span className="text-stone-400">· {o.label}</span>
                      </a>
                    ))}
                  </div>
                )}
                {pickedInfo && pickedInfo.providers?.options?.length === 0 && (
                  <p className="t-meta mt-1">
                    No streaming listings for your region — screen-share a streaming app instead.
                  </p>
                )}
                {pickedInfo && (pickedInfo.videos || []).length === 0 && (
                  <p className="t-meta mt-1">
                    No trailer available for this title — use the watch links or screen-share.
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={searchMovies} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Search the catalog…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn-ghost" disabled={movieBusy} type="submit">
              <Search className="w-4 h-4" />
              Search
            </button>
          </form>

          {movieErr && <p className="text-sm text-rose-600">{movieErr}</p>}

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {movies.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => pickMovie(m)}
                className="group text-left"
                title={`Pick ${m.title}`}
              >
                {m.poster ? (
                  <img
                    src={m.poster}
                    alt={m.title}
                    loading="lazy"
                    className="w-full rounded-lg aspect-[2/3] object-cover group-hover:ring-2 group-hover:ring-rose-400 transition"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-lg bg-stone-100 grid place-items-center px-1 text-center text-[10px] text-stone-400">
                    {m.title}
                  </div>
                )}
                <p className="text-[10px] text-stone-600 truncate mt-1 group-hover:text-rose-600">
                  {m.title}
                </p>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="btn-ghost !py-1.5 text-xs"
              disabled={movieBusy || moviePage <= 1}
              onClick={() => loadMovies(movieMode, moviePage - 1, query.trim())}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn-ghost !py-1.5 text-xs"
              disabled={movieBusy || moviePage >= movieTotal}
              onClick={() => loadMovies(movieMode, moviePage + 1, query.trim())}
            >
              {movieBusy ? 'Loading…' : 'More movies →'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="h-section !text-base">Shared player</h2>
            <span className="t-meta">{status}</span>
          </div>

          {ytKey ? (
            <div className="relative rounded-xl bg-black aspect-video overflow-hidden">
              <div
                ref={ytWrapRef}
                className="absolute inset-0 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:!w-full [&_iframe]:!h-full"
              />
              {ytGesture && (
                <button
                  type="button"
                  className="absolute inset-0 grid place-items-center bg-black/70 text-white"
                  onClick={() => {
                    setYtGesture(false);
                    ytPlayerRef.current?.playVideo?.();
                  }}
                >
                  <span className="btn-primary">
                    <Play className="w-4 h-4" />
                    Play the trailer
                  </span>
                </button>
              )}
              {ytEmbedErr && (
                <div className="absolute inset-0 grid place-items-center text-stone-300 text-sm text-center px-4">
                  This clip can't be embedded — use the watch links or screen-share the film
                  instead.
                </div>
              )}
            </div>
          ) : activeSource ? (
            <video
              ref={videoRef}
              src={activeSource}
              playsInline
              controls={false}
              className="w-full rounded-xl bg-black aspect-video"
            />
          ) : (
            <div className="rounded-xl bg-stone-100 aspect-video grid place-items-center text-stone-400 text-sm">
              Load a video to start watching together
            </div>
          )}

          {!ytKey && (
            <div className="flex items-center gap-3">
              <button className="btn-ghost !px-3" onClick={togglePlay} disabled={!activeSource}>
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={dur || 0}
                step={0.1}
                value={pos}
                onChange={seek}
                disabled={!activeSource}
                className="flex-1 accent-rose-500"
              />
              <span className="t-meta tabular-nums w-16 text-right">
                {fmt(pos)} / {fmt(dur)}
              </span>
            </div>
          )}

          {ytKey ? (
            <p className="t-meta">
              {ytHost
                ? 'You picked this — your partner’s player follows yours.'
                : 'Your partner picked this — playback stays in sync automatically.'}
            </p>
          ) : (
            !isHost &&
            activeSource && (
              <p className="t-meta">Your partner controls playback — it follows automatically.</p>
            )
          )}
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="h-section !text-base">Screen share</h2>
            {sharing && (
              <button className="btn-ghost !py-1.5 text-xs text-rose-600" onClick={() => stopShare()}>
                <Square className="w-3.5 h-3.5" />
                Stop sharing
              </button>
            )}
          </div>

          {!sharing && (
            <button className="btn-primary w-full" onClick={startShare}>
              <ScreenShare className="w-4 h-4" />
              Share my screen
            </button>
          )}

          <div className="relative rounded-xl bg-black aspect-video overflow-hidden">
            {remoteStream ? (
              <video
                ref={remoteRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-stone-400 text-sm text-center px-4">
                {sharing
                  ? 'You are sharing — your partner sees this window.'
                  : "Nothing shared yet — you'll see your partner's screen here automatically."}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
