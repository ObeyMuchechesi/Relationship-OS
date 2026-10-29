import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Upload,
  Trash2,
  Clock,
  Palette,
  Globe,
} from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import Countdown from '../components/Countdown';
import { fmtDate, fmtTime, zoneOf } from '../time';

const MOODS = ['🥰', '😊', '😐', '😔', '😤'];

// Gradient presets — stored as `preset:<gradient>` so no external image is needed.
const PRESETS = [
  'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 45%, #fecdd3 100%)',
  'linear-gradient(135deg, #eff6ff 0%, #dbeafe 45%, #bfdbfe 100%)',
  'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 45%, #ddd6fe 100%)',
  'linear-gradient(160deg, #fff7ed 0%, #fecaca 55%, #fda4af 100%)',
  'linear-gradient(135deg, #0f172a 0%, #334155 55%, #64748b 100%)',
  'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)',
];

function dashboardStyle(bg) {
  if (!bg) return { background: PRESETS[0] };
  if (bg.startsWith('preset:')) return { background: bg.slice(7) };
  if (bg.startsWith('/uploads/')) {
    return { backgroundImage: `url(${mediaUrl(bg)})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' };
}

// Live world clocks for the couple's region plus major world regions.
function WorldClock({ user, partner }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const zones = useMemo(() => {
    const list = [];
    const add = (tz) => {
      if (tz && !list.includes(tz)) list.push(tz);
    };
    add(zoneOf(user));
    if (partner?.timezone) add(partner.timezone);
    ['UTC', 'Europe/London', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney'].forEach(add);
    return list.slice(0, 6);
  }, [user?.timezone, partner?.timezone]);

  const city = (tz) => (tz === 'UTC' ? 'UTC' : tz.split('/').pop().replace(/_/g, ' '));

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {zones.map((tz) => (
        <div
          key={tz}
          className="glass rounded-xl px-3 py-2 min-w-[92px] text-center shrink-0"
          title={tz}
        >
          <div className="font-display font-bold text-lg text-stone-800 tabular-nums">
            {new Intl.DateTimeFormat('en-GB', {
              timeZone: tz,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            }).format(now)}
          </div>
          <div className="t-label !text-[9px] mt-0.5">{city(tz)}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [couple, setCouple] = useState(null);
  const [moods, setMoods] = useState([]);
  const [posts, setPosts] = useState([]);
  const [bucket, setBucket] = useState([]);
  const [mood, setMood] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);

  const partner = couple?.partner;

  useEffect(() => {
    if (!user?.couple) return;
    api.get('/couple/me').then(({ data }) => setCouple(data)).catch(() => {});
    api.get('/mood').then(({ data }) => setMoods(data)).catch(() => {});
    api.get('/posts').then(({ data }) => setPosts(data)).catch(() => {});
    api.get('/bucket').then(({ data }) => setBucket(data)).catch(() => {});
  }, [user?.couple]);

  const checkIn = async (e) => {
    e.preventDefault();
    if (!mood) return;
    const { data } = await api.post('/mood', { mood, note });
    setMoods((prev) => [data, ...prev]);
    setMood('');
    setNote('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setBg = async (dashboardBg) => {
    setBgBusy(true);
    try {
      const { data } = await api.patch('/couple/me', { dashboardBg });
      setCouple(data);
    } finally {
      setBgBusy(false);
    }
  };

  const uploadBg = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgBusy(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const { data } = await api.post('/couple/background', body);
      setCouple(data);
    } finally {
      setBgBusy(false);
      e.target.value = '';
    }
  };

  const done = bucket.filter((b) => b.done).length;

  return (
    <div className="space-y-5">
      <div className="relative rounded-3xl overflow-hidden border border-white/60 shadow-glass">
        {/* Background layer — chosen photo or preset, slightly veiled so the
            glass cards read clearly on top of it. */}
        <div
          className="absolute inset-0 scale-105 blur-[3px]"
          style={dashboardStyle(couple?.dashboardBg)}
        />
        <div className="absolute inset-0 bg-white/35" />

        <div className="relative p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="h-display">
                Hey {user?.name?.split(' ')[0]}
              </h1>
              <p className="t-meta mt-1">
                {fmtDate(new Date(), user)} · your time is {fmtTime(new Date(), user)} (
                {zoneOf(user)})
              </p>
            </div>
            <Link
              to="/timeline"
              className="glass-strong rounded-xl px-4 py-2.5 text-sm font-medium text-stone-700 hover:text-rose-600 transition inline-flex items-center gap-2"
            >
              Open the timeline
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-5 md:col-span-2">
              <h2 className="h-section mb-3">Until we're together</h2>
              {couple?.reunionDate ? (
                <Countdown target={couple.reunionDate} label={couple.reunionPlace} />
              ) : (
                <p className="t-body text-stone-600">
                  No reunion set yet.{' '}
                  <Link to="/reunion" className="text-rose-600 font-medium">
                    Pick a date
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <h2 className="h-section mb-3">How are you feeling?</h2>
              <form onSubmit={checkIn} className="space-y-3">
                <div className="flex gap-2">
                  {MOODS.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMood(m)}
                      className={`text-xl rounded-lg px-2 py-1 border transition backdrop-blur-sm ${
                        mood === m
                          ? 'border-rose-300 bg-rose-50/80'
                          : 'border-white/70 bg-white/50 hover:bg-white/80'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <input
                  className="input !bg-white/70"
                  placeholder="Add a note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button className="btn-primary w-full" disabled={!mood}>
                  {saved ? 'Saved ✓' : 'Check in'}
                </button>
              </form>

              {moods.length > 0 && (
                <div className="mt-4 space-y-1.5 text-sm text-stone-600">
                  {moods.slice(0, 4).map((m) => (
                    <p key={m._id} className="flex justify-between gap-2">
                      <span>
                        {m.mood} {m.author?.name}
                      </span>
                      <span className="text-xs text-stone-400">
                        {fmtTime(m.createdAt, m.author)}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-5">
              <h2 className="h-section mb-2">Your space</h2>
              <p className="t-body">
                {partner ? (
                  <>
                    You and <span className="font-medium">{partner.name}</span> · {partner.timezone}
                  </>
                ) : (
                  <>
                    Waiting for your partner. Share your invite code in{' '}
                    <Link to="/settings" className="text-rose-600 font-medium">
                      Settings
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>

            <div className="glass rounded-2xl p-5">
              <h2 className="h-section mb-2">Bucket list</h2>
              <p className="h-countdown !text-rose-600">
                {done}
                <span className="text-stone-300 text-lg"> / {bucket.length}</span>
              </p>
              <p className="t-meta">adventures completed together</p>
            </div>

            <div className="glass rounded-2xl p-5">
              <h2 className="h-section mb-2">Recent moments</h2>
              <p className="h-countdown !text-rose-600">{posts.length}</p>
              <p className="t-meta">posts on your timeline</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-stone-500" />
              <h2 className="h-section !text-base">World clock — live</h2>
            </div>
            <WorldClock user={user} partner={partner} />
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-stone-500" />
              <h2 className="h-section !text-base">Dashboard background</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  disabled={bgBusy}
                  onClick={() => setBg(`preset:${preset}`)}
                  className={`w-9 h-9 rounded-full border-2 transition ${
                    couple?.dashboardBg === `preset:${preset}`
                      ? 'border-rose-500 scale-110'
                      : 'border-white/80 hover:scale-105'
                  }`}
                  style={{ background: preset }}
                  aria-label={`Background preset ${i + 1}`}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost text-xs" disabled={bgBusy} onClick={() => document.getElementById('bg-upload')?.click()}>
                <Upload className="w-3.5 h-3.5" />
                Upload a photo
              </button>
              {couple?.dashboardBg && (
                <button className="btn-ghost text-xs" disabled={bgBusy} onClick={() => setBg('')}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
              <input id="bg-upload" type="file" accept="image/*" hidden onChange={uploadBg} />
            </div>
            <p className="t-meta mt-2">
              Photos are blurred a little so the glass cards stay readable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
