import { useEffect, useState } from 'react';
import { Users, ShieldCheck, RefreshCw, Copy, BarChart3, Activity } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Layout';

function Stat({ label, value, Icon }) {
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-2 text-stone-400 mb-1">
        <Icon className="w-4 h-4" />
        <span className="t-label">{label}</span>
      </div>
      <p className="font-display font-bold text-2xl text-stone-800 tabular-nums">{value}</p>
    </div>
  );
}

function Bars({ data, color = 'bg-rose-400' }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.length === 0 && <p className="t-meta">No activity in the last 14 days.</p>}
      {data.map((d) => (
        <div key={d._id} className="flex-1 flex flex-col items-center gap-1" title={`${d._id}: ${d.n}`}>
          <div
            className={`w-full rounded-t ${color}`}
            style={{ height: `${Math.max(6, (d.n / max) * 100)}%` }}
          />
          <span className="text-[9px] text-stone-400">{d._id.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

const fmtWhen = (v) =>
  v
    ? new Date(v).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'never';

export default function Admin() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [resetFor, setResetFor] = useState(null); // { email, tempPassword }
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    api
      .get('/admin/stats')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load stats'));
    api
      .get('/admin/users')
      .then(({ data }) => setUsers(data))
      .catch(() => {});
  };

  useEffect(load, []);

  if (user?.role !== 'admin') {
    return <p className="text-stone-500 py-10 text-center">Admins only.</p>;
  }

  const resetPassword = async (u) => {
    setBusy(u.id);
    try {
      const { data } = await api.post(`/admin/users/${u.id}/reset-password`, {});
      setResetFor(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally {
      setBusy(null);
    }
  };

  const copyTemp = async () => {
    if (!resetFor) return;
    try {
      await navigator.clipboard.writeText(resetFor.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-amber-500" />
          <h1 className="h-display">Super admin</h1>
        </div>
        <button className="btn-ghost text-xs" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Users" value={stats.totals.users} Icon={Users} />
          <Stat label="Active (7d)" value={stats.totals.active7d} Icon={Activity} />
          <Stat label="Couples" value={stats.totals.couples} Icon={Users} />
          <Stat label="Posts" value={stats.totals.posts} Icon={BarChart3} />
          <Stat label="Moods" value={stats.totals.moods} Icon={Activity} />
          <Stat label="Bucket items" value={stats.totals.bucketItems} Icon={BarChart3} />
          <Stat label="Gift ideas" value={stats.totals.gifts} Icon={BarChart3} />
          <Stat label="Scheduled" value={stats.totals.scheduled} Icon={BarChart3} />
        </div>
      )}

      {stats && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="card">
            <h2 className="h-section !text-base mb-3">Posts per day (14 days)</h2>
            <Bars data={stats.postsPerDay} />
          </div>
          <div className="card">
            <h2 className="h-section !text-base mb-3">Signups per day (14 days)</h2>
            <Bars data={stats.usersPerDay} color="bg-sky-400" />
          </div>
        </div>
      )}

      {stats && stats.moodSplit.length > 0 && (
        <div className="card">
          <h2 className="h-section !text-base mb-3">Mood split</h2>
          <div className="flex flex-wrap gap-3">
            {stats.moodSplit.map((m) => (
              <span key={m._id} className="text-sm text-stone-600">
                <span className="text-lg">{m._id}</span> × {m.n}
              </span>
            ))}
          </div>
        </div>
      )}

      {resetFor && (
        <div className="card border-amber-300 bg-amber-50">
          <h2 className="h-section !text-base mb-1">Password reset — shown once</h2>
          <p className="t-meta mb-2">
            Temporary password for <span className="font-medium">{resetFor.email}</span> — give it
            to the user, they can change it in Settings.
          </p>
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm bg-white rounded-lg px-3 py-1.5 border border-amber-200">
              {resetFor.tempPassword}
            </code>
            <button className="btn-ghost !py-1.5 text-xs" onClick={copyTemp}>
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            <button className="btn-ghost !py-1.5 text-xs" onClick={() => setResetFor(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200">
          <h2 className="h-section !text-base">Who is using the system</h2>
          <p className="t-meta">
            Passwords are stored as one-way hashes and can never be displayed — reset gives a fresh
            temporary one instead.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left t-label border-b border-stone-200">
                <th className="px-5 py-2.5">User</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Space</th>
                <th className="px-3 py-2.5">Posts</th>
                <th className="px-3 py-2.5">Joined</th>
                <th className="px-3 py-2.5">Last seen</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar user={u} className="w-7 h-7 text-xs" />
                      <span className="font-medium text-stone-800">{u.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-stone-600">{u.email}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        u.role === 'admin'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-stone-500">
                    {u.inCouple ? 'paired' : 'solo'}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{u.posts}</td>
                  <td className="px-3 py-2.5 text-stone-500">{fmtWhen(u.createdAt)}</td>
                  <td className="px-3 py-2.5 text-stone-500">{fmtWhen(u.lastSeen)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      className="btn-ghost !py-1 text-[11px]"
                      disabled={busy === u.id}
                      onClick={() => resetPassword(u)}
                    >
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
