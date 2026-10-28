import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const TIMEZONES = [
  'Africa/Harare',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function Settings() {
  const { user, setUser } = useAuth();
  const [couple, setCouple] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Harare');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/couple/me').then(({ data }) => setCouple(data));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const { data } = await api.patch('/auth/me', { name, timezone });
    setUser((prev) => ({ ...prev, ...data }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="font-display text-lg text-stone-800 mb-4">Your profile</h2>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label">Timezone</label>
            <select
              className="input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <button className="btn-primary">{saved ? 'Saved ✓' : 'Save changes'}</button>
        </form>
      </div>

      {couple && (
        <div className="card">
          <h2 className="font-display text-lg text-stone-800 mb-3">Your shared space</h2>

          <div className="space-y-2 text-sm">
            <p className="flex justify-between">
              <span className="text-stone-500">Invite code</span>
              <span className="font-display tracking-[0.25em] text-rose-600">
                {couple.inviteCode}
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-stone-500">Partner</span>
              <span className="font-medium text-stone-800">
                {couple.partner ? couple.partner.name : 'Not joined yet'}
              </span>
            </p>
            {couple.partner && (
              <p className="flex justify-between">
                <span className="text-stone-500">Partner timezone</span>
                <span className="text-stone-700">{couple.partner.timezone}</span>
              </p>
            )}
          </div>

          {!couple.partner && (
            <p className="text-xs text-stone-400 mt-4">
              Share the code above with your partner so they can join your space.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
