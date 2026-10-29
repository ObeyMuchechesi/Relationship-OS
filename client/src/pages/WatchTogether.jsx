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

  const videoRef = useRef(null);
  const remoteRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const applyingRef = useRef(false);
  const isHostRef = useRef(false);
  const sendingRef = useRef(false); // true while we push an action we just applied
  const seenRef = useRef(new Set());

  const send = useCallback(async (type, payload) => {
    try {
      await api.post('/room/signal', { type, payload });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the room');
    }
  }, []);

  const applyControl = (payload) => {
    const video = videoRef.current;
    if (!video || !payload) return;
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
      // The <video> only mounts once remoteActive is true, so the stream is
      // stored in state and attached by an effect after the element exists.
      setRemoteStream(e.streams[0]);
      setRemoteActive(true);
      setStatus('Partner is sharing their screen');
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRemoteActive(false);
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

  // Attach the incoming WebRTC stream once its <video> element is rendered.
  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream, remoteActive]);

  // Poll partner signals.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const { data } = await api.get('/room/signal', {
          params: { since: new Date(Date.now() - 4000).toISOString() },
        });
        if (stopped) return;
        for (const sig of data) {
          if (seenRef.current.has(sig.id)) continue;
          seenRef.current.add(sig.id);
          if (seenRef.current.size > 500) seenRef.current = new Set([...seenRef.current].slice(-200));

          if (sig.type === 'source' && sig.payload?.url) {
            isHostRef.current = false;
            setIsHost(false);
            setActiveSource(sig.payload.url);
            setSource(sig.payload.url);
            setStatus('Playing together');
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
    return () => {
      stopped = true;
      clearInterval(id);
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
        One of you loads a video or shares a screen — the other sees it live, in sync, on phone or
        desktop.
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
        </div>
        <p className="t-meta flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Open a service above in a shared call, or screen-share it — we don't host or embed
          third-party streams ourselves.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="h-section !text-base">Shared player</h2>
            <span className="t-meta">{status}</span>
          </div>

          {activeSource ? (
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

          {!isHost && activeSource && (
            <p className="t-meta">Your partner controls playback — it follows automatically.</p>
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
            {remoteActive ? (
              <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-contain" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-stone-400 text-sm text-center px-4">
                {sharing
                  ? 'You are sharing — your partner sees this window.'
                  : "Nothing shared yet — you'll see your partner's screen here."}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
