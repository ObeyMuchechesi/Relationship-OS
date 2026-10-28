import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Countdown from '../components/Countdown';
import { fmtDate, fmtTime, zoneOf } from '../time';

const MOODS = ['🥰', '😊', '😐', '😔', '😤'];

export default function Dashboard() {
  const { user } = useAuth();
  const [couple, setCouple] = useState(null);
  const [moods, setMoods] = useState([]);
  const [posts, setPosts] = useState([]);
  const [bucket, setBucket] = useState([]);
  const [mood, setMood] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

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

  const together = bucket.filter((b) => b.done).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-800">
            Hey {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-stone-500">
            {fmtDate(new Date(), user)} · your time is {fmtTime(new Date(), user)} ({zoneOf(user)})
          </p>
        </div>
        <Link to="/timeline" className="btn-ghost">
          Open the timeline →
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="card md:col-span-2">
          <h2 className="font-display text-lg text-stone-800 mb-3">Until we're together</h2>
          {couple?.reunionDate ? (
            <Countdown target={couple.reunionDate} label={couple.reunionPlace} />
          ) : (
            <div className="text-sm text-stone-500">
              No reunion set yet.{' '}
              <Link to="/reunion" className="text-rose-600 font-medium">
                Pick a date
              </Link>
              .
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-lg text-stone-800 mb-3">How are you feeling?</h2>
          <form onSubmit={checkIn} className="space-y-3">
            <div className="flex gap-2">
              {MOODS.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMood(m)}
                  className={`text-xl rounded-lg px-2 py-1 border transition ${
                    mood === m
                      ? 'border-rose-300 bg-rose-50'
                      : 'border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              className="input"
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
                  <span className="text-xs text-stone-400">{fmtTime(m.createdAt, m.author)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="card">
          <h2 className="font-display text-lg text-stone-800 mb-2">Your space</h2>
          <p className="text-sm text-stone-600">
            {partner ? (
              <>
                You and <span className="font-medium">{partner.name}</span> ·{' '}
                {partner.timezone}
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

        <div className="card">
          <h2 className="font-display text-lg text-stone-800 mb-2">Bucket list</h2>
          <p className="font-display text-2xl text-rose-600">
            {together}
            <span className="text-stone-300 text-lg"> / {bucket.length}</span>
          </p>
          <p className="text-xs text-stone-400">adventures completed together</p>
        </div>

        <div className="card">
          <h2 className="font-display text-lg text-stone-800 mb-2">Recent moments</h2>
          <p className="font-display text-2xl text-rose-600">{posts.length}</p>
          <p className="text-xs text-stone-400">posts on your timeline</p>
        </div>
      </div>
    </div>
  );
}
