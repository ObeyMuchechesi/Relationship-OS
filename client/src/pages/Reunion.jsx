import { useEffect, useState } from 'react';
import api from '../api';
import Countdown from '../components/Countdown';
import { fmtDate, localInputValue } from '../time';

export default function Reunion() {
  const [couple, setCouple] = useState(null);
  const [form, setForm] = useState({
    reunionDate: '',
    reunionPlace: '',
    savingsGoal: 0,
    savingsCurrent: 0,
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/couple/me').then(({ data }) => {
      setCouple(data);
      setForm({
        reunionDate: data.reunionDate ? localInputValue(new Date(data.reunionDate)) : '',
        reunionPlace: data.reunionPlace || '',
        savingsGoal: data.savingsGoal || 0,
        savingsCurrent: data.savingsCurrent || 0,
      });
    }).catch(() => {});
  }, []);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.patch('/couple/me', {
        reunionDate: form.reunionDate ? new Date(form.reunionDate).toISOString() : null,
        reunionPlace: form.reunionPlace,
        savingsGoal: Number(form.savingsGoal) || 0,
        savingsCurrent: Number(form.savingsCurrent) || 0,
      });
      setCouple(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  const goal = Number(form.savingsGoal) || 0;
  const current = Number(form.savingsCurrent) || 0;
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;

  return (
    <div className="space-y-5">
      <h1 className="h-display">The reunion</h1>

      <div className="card">
        <h2 className="h-section mb-3">Countdown</h2>
        {couple?.reunionDate ? (
          <Countdown
            target={couple.reunionDate}
            label={`${fmtDate(couple.reunionDate)}${
              couple.reunionPlace ? ` · ${couple.reunionPlace}` : ''
            }`}
          />
        ) : (
          <p className="text-sm text-stone-500">Set a date below and the clock starts ticking.</p>
        )}
      </div>

      <form onSubmit={save} className="card space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Reunion date &amp; time (your timezone)</label>
            <input
              className="input"
              type="datetime-local"
              value={form.reunionDate}
              onChange={update('reunionDate')}
            />
          </div>
          <div>
            <label className="label">Place</label>
            <input
              className="input"
              placeholder="Harare · airport arrivals"
              value={form.reunionPlace}
              onChange={update('reunionPlace')}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Savings goal</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.savingsGoal}
              onChange={update('savingsGoal')}
            />
          </div>
          <div>
            <label className="label">Saved so far</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.savingsCurrent}
              onChange={update('savingsCurrent')}
            />
          </div>
        </div>

        {goal > 0 && (
          <div>
            <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-stone-500 mt-1.5">
              {pct}% there — {current} of {goal} saved
            </p>
          </div>
        )}

        <button className="btn-primary" disabled={busy}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </form>
    </div>
  );
}
