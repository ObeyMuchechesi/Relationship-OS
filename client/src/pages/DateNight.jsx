import { useState } from 'react';
import {
  UtensilsCrossed,
  Film,
  Footprints,
  BookOpen,
  PenLine,
  Gamepad2,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const IDEAS = [
  { Icon: UtensilsCrossed, title: 'Cook the same recipe apart', note: 'Video call while you both plate up.' },
  { Icon: Film, title: 'Movie night, one screen', note: 'Sync a play button, share the popcorn.' },
  { Icon: Footprints, title: 'Evening walk call', note: 'Headphones in, same route, different cities.' },
  { Icon: BookOpen, title: 'Read to each other', note: 'One chapter a night, alternating readers.' },
  { Icon: PenLine, title: 'Write letters, open on the same day', note: 'Snail mail hits different.' },
  { Icon: Gamepad2, title: 'Online game rematch', note: 'Best of five, loser plans the next date.' },
];

export default function DateNight() {
  const { user } = useAuth();
  const [picked, setPicked] = useState(null);

  const schedule = async () => {
    if (!picked) return;
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(19, 0, 0, 0);
    await api
      .post('/scheduled', {
        text: `Date night tonight: ${picked.title} ${picked.emoji} — see you at 7.`,
        deliverAt: when.toISOString(),
      })
      .catch(() => {});
    setPicked(null);
    alert('Scheduled for tomorrow 19:00 — it will show up on your timeline.');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-display">Date night</h1>
        <p className="t-body text-stone-500">
          Low-effort ideas that work across any distance or timezone.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {IDEAS.map((idea) => (
          <button
            key={idea.title}
            onClick={() => setPicked(idea)}
            className={`card text-left transition hover:-translate-y-0.5 ${
              picked?.title === idea.title ? 'ring-2 ring-rose-300 border-rose-200' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 grid place-items-center mb-2">
              <idea.Icon className="w-5 h-5" strokeWidth={1.8} />
            </div>
            <p className="font-medium text-stone-800">{idea.title}</p>
            <p className="text-sm text-stone-500 mt-1">{idea.note}</p>
          </button>
        ))}
      </div>

      {picked && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600">
            Tonight's pick: <span className="font-medium">{picked.title}</span>
          </p>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setPicked(null)}>
              Change my mind
            </button>
            <button className="btn-primary" onClick={schedule}>
              Schedule the reminder
            </button>
          </div>
        </div>
      )}

      <p className="t-meta">
        Signed in as {user?.name} — reminders post to your shared timeline automatically.
      </p>
    </div>
  );
}
