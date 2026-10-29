import { useEffect, useRef, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { listTimezones } from '../time';
import { Avatar } from '../components/Layout';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [couple, setCouple] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Harare');
  const [saved, setSaved] = useState(false);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const avatarRef = useRef(null);

  const zones = listTimezones();

  useEffect(() => {
    api.get('/couple/me').then(({ data }) => setCouple(data)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const { data } = await api.patch('/auth/me', { name, timezone });
    setUser((prev) => ({ ...prev, ...data }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const changeAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('avatar', file);
      const { data } = await api.post('/auth/avatar', body);
      setUser(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    if (pwd.newPassword !== pwd.confirm) {
      setPwdMsg({ error: true, text: 'New passwords do not match' });
      return;
    }
    try {
      await api.patch('/auth/password', {
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword,
      });
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
      setPwdMsg({ error: false, text: 'Password updated ✓' });
    } catch (err) {
      setPwdMsg({ error: true, text: err.response?.data?.message || 'Could not update password' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="h-section mb-4">Your profile</h2>

        <div className="flex items-center gap-4 mb-5">
          <Avatar user={{ ...user, avatarUrl: user?.avatarUrl }} className="w-16 h-16 text-xl" />
          <div>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busy}
              onClick={() => avatarRef.current?.click()}
            >
              <Camera className="w-3.5 h-3.5" />
              {user?.avatarUrl ? 'Change picture' : 'Add a picture'}
            </button>
            <p className="t-meta mt-1.5">JPG or PNG, square works best.</p>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={changeAvatar} />
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label">Timezone (all world regions)</label>
            <select
              className="input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {zones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost text-xs mt-2"
              onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
            >
              <Check className="w-3.5 h-3.5" />
              Use my current location
            </button>
          </div>

          <button className="btn-primary">{saved ? 'Saved ✓' : 'Save changes'}</button>
        </form>
      </div>

      <div className="card">
        <h2 className="h-section mb-4">Change password</h2>
        <form onSubmit={changePassword} className="space-y-3 max-w-sm">
          <div>
            <label className="label">Current password</label>
            <input
              className="input"
              type="password"
              required
              value={pwd.currentPassword}
              onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={pwd.newPassword}
              onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
            />
          </div>
          {pwdMsg && (
            <p className={`text-sm ${pwdMsg.error ? 'text-rose-600' : 'text-emerald-600'}`}>
              {pwdMsg.text}
            </p>
          )}
          <button className="btn-primary">Update password</button>
        </form>
      </div>

      {couple && (
        <div className="card">
          <h2 className="h-section mb-3">Your shared space</h2>

          <div className="space-y-2 text-sm">
            <p className="flex justify-between">
              <span className="text-stone-500">Invite code</span>
              <span className="font-display font-bold tracking-[0.25em] text-rose-600">
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
            <p className="t-meta mt-4">
              Share the code above with your partner so they can join your space.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
