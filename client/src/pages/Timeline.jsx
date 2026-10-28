import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { fmtDateTime } from '../time';

export default function Timeline() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [schedText, setSchedText] = useState('');
  const [schedAt, setSchedAt] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const audioRef = useRef(null);

  const load = () =>
    api.get('/posts').then(({ data }) => setPosts(data)).catch(() => setPosts([]));

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const postText = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/posts', { text });
      setPosts((prev) => [data, ...prev]);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  const upload = (kind) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const field = kind === 'image' ? 'image' : 'audio';
    const body = new FormData();
    body.append(field, file);
    setBusy(true);
    try {
      const { data } = await api.post(`/posts/${kind}`, body);
      setPosts((prev) => [data, ...prev]);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const schedule = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/scheduled', {
        text: schedText,
        deliverAt: new Date(schedAt).toISOString(),
      });
      setSchedText('');
      setSchedAt('');
      setScheduling(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not schedule');
    }
  };

  const remove = async (id) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
    await api.delete(`/posts/${id}`).catch(() => load());
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold text-stone-800">Timeline</h1>

      <form onSubmit={postText} className="card space-y-3">
        <textarea
          className="input min-h-[80px] resize-y"
          placeholder={`What's on your mind, ${user?.name?.split(' ')[0]}?`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={busy || !text.trim()}>
            Post
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            📷 Photo
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => audioRef.current?.click()}
            disabled={busy}
          >
            🎤 Voice note
          </button>
          <button type="button" className="btn-ghost" onClick={() => setScheduling((s) => !s)}>
            💌 Schedule
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload('image')} />
          <input ref={audioRef} type="file" accept="audio/*" hidden onChange={upload('audio')} />
        </div>

        {scheduling && (
          <div className="border-t border-stone-200 pt-3 space-y-2">
            <input
              className="input"
              placeholder="A message to your future selves…"
              value={schedText}
              onChange={(e) => setSchedText(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input !w-auto flex-1 min-w-[200px]"
                type="datetime-local"
                value={schedAt}
                onChange={(e) => setSchedAt(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={!schedText.trim() || !schedAt}
                onClick={schedule}
                type="submit"
              >
                Schedule it
              </button>
            </div>
            <p className="text-xs text-stone-400">
              Deliver time shown in your timezone ({user?.timezone}).
            </p>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </form>

      <div className="space-y-4">
        {posts.length === 0 && (
          <p className="text-stone-400 py-10 text-center">
            Nothing here yet — say something nice.
          </p>
        )}

        {posts.map((post) => (
          <div key={post._id} className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-rose-100 grid place-items-center text-sm">
                  {post.author?.name?.[0] || '?'}
                </span>
                <div>
                  <p className="text-sm font-medium text-stone-800">{post.author?.name}</p>
                  <p className="text-xs text-stone-400">{fmtDateTime(post.createdAt, post.author)}</p>
                </div>
              </div>
              {String(post.author?._id) === String(user?.id) && (
                <button
                  onClick={() => remove(post._id)}
                  className="text-xs text-stone-400 hover:text-rose-600"
                >
                  Delete
                </button>
              )}
            </div>

            {post.text && <p className="text-stone-700 whitespace-pre-wrap">{post.text}</p>}
            {post.imageUrl && (
              <img src={post.imageUrl} alt="" className="mt-2 rounded-xl max-h-96 object-cover" />
            )}
            {post.audioUrl && (
              <audio controls src={post.audioUrl} className="mt-2 w-full" />
            )}

            {post.kind === 'scheduled' && (
              <span className="inline-block mt-2 text-[10px] uppercase tracking-widest text-rose-400">
                scheduled message
              </span>
            )}
            {post.kind === 'gift' && (
              <span className="inline-block mt-2 text-[10px] uppercase tracking-widest text-amber-500">
                gift update
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
