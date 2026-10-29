import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, Clock, Video, Trash2, Send, Clock4 } from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import { fmtDateTime } from '../time';
import { Avatar } from '../components/Layout';

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
  const videoRef = useRef(null);

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
    const body = new FormData();
    body.append(kind, file);
    setBusy(true);
    try {
      const { data } = await api.post(`/posts/${kind}`, body);
      setPosts((prev) => [data, ...prev]);
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed — the file may be too large (4 MB max).');
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
      <h1 className="h-display">Timeline</h1>

      <form onSubmit={postText} className="card space-y-3">
        <textarea
          className="input min-h-[80px] resize-y"
          placeholder={`What's on your mind, ${user?.name?.split(' ')[0]}?`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={busy || !text.trim()}>
            <Send className="w-4 h-4" />
            Post
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Camera className="w-4 h-4" />
            Photo
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => videoRef.current?.click()}
            disabled={busy}
          >
            <Video className="w-4 h-4" />
            Video
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => audioRef.current?.click()}
            disabled={busy}
          >
            <Mic className="w-4 h-4" />
            Voice note
          </button>
          <button type="button" className="btn-ghost" onClick={() => setScheduling((s) => !s)}>
            <Clock className="w-4 h-4" />
            Schedule
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload('image')} />
          <input ref={videoRef} type="file" accept="video/*" hidden onChange={upload('video')} />
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
            <p className="t-meta">Delivery shown in your timezone ({user?.timezone}).</p>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </form>

      <div className="space-y-4">
        {posts.length === 0 && (
          <p className="text-stone-400 py-10 text-center">Nothing here yet — say something nice.</p>
        )}

        {posts.map((post) => (
          <div key={post._id} className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <Avatar user={post.author} />
                <div>
                  <p className="text-sm font-medium text-stone-800">{post.author?.name}</p>
                  <p className="t-meta">{fmtDateTime(post.createdAt, post.author)}</p>
                </div>
              </div>
              {String(post.author?._id) === String(user?.id) && (
                <button
                  onClick={() => remove(post._id)}
                  className="text-stone-400 hover:text-rose-600 p-1.5"
                  aria-label="Delete post"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {post.text && <p className="text-stone-700 whitespace-pre-wrap">{post.text}</p>}
            {post.imageUrl && (
              <img
                src={mediaUrl(post.imageUrl)}
                alt=""
                className="mt-2 rounded-xl max-h-96 w-full object-cover"
              />
            )}
            {post.videoUrl && (
              <video
                controls
                playsInline
                src={mediaUrl(post.videoUrl)}
                className="mt-2 rounded-xl max-h-96 w-full bg-black"
              />
            )}
            {post.audioUrl && (
              <audio controls src={mediaUrl(post.audioUrl)} className="mt-2 w-full" />
            )}

            {post.kind === 'scheduled' && (
              <span className="inline-flex items-center gap-1 mt-2 text-[10px] uppercase tracking-widest text-rose-400">
                <Clock4 className="w-3 h-3" />
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
