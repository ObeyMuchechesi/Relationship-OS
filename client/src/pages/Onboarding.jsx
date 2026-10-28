import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/couple');
      setUser({ ...user, couple: data.id });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const join = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/couple/join', { inviteCode: code });
      setUser({ ...user, couple: data.id });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-rose-50/40 px-4">
      <div className="w-full max-w-md text-center">
        <div className="text-4xl mb-2">🏡</div>
        <h1 className="font-display text-2xl font-semibold text-stone-800">Your shared space</h1>
        <p className="text-sm text-stone-500 mt-1 mb-6">
          Hi {user?.name}. Create a space for the two of you, or join your partner's with their
          invite code.
        </p>

        <div className="card space-y-4 text-left">
          <button onClick={create} className="btn-primary w-full" disabled={busy}>
            {busy ? 'Working…' : 'Create a new space'}
          </button>

          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span className="flex-1 border-t border-stone-200" />
            or join with a code
            <span className="flex-1 border-t border-stone-200" />
          </div>

          <form onSubmit={join} className="space-y-3">
            <input
              className="input text-center font-display tracking-[0.3em] uppercase"
              placeholder="INVITE CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn-ghost w-full" disabled={busy || code.length < 4}>
              Join space
            </button>
          </form>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
