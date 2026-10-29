import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { listTimezones } from '../time';

export default function Register() {
  const { saveSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Harare',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', form);
      saveSession(data);
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-rose-50/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Heart className="w-10 h-10 text-rose-500 mx-auto mb-2" fill="currentColor" strokeWidth={1.5} />
          <h1 className="font-display text-2xl font-bold text-stone-800">Create your account</h1>
          <p className="text-sm text-stone-500 mt-1">One of you signs up, then share the code.</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">Your name</label>
            <input className="input" required value={form.name} onChange={update('name')} />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={update('email')}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={update('password')}
            />
          </div>
          <div>
            <label className="label">Your timezone</label>
            <select className="input" value={form.timezone} onChange={update('timezone')}>
              {listTimezones().map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>

          <p className="text-xs text-stone-500 text-center">
            Already registered?{' '}
            <Link to="/login" className="text-rose-600 font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
