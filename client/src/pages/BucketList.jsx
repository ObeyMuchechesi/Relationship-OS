import { useEffect, useState } from 'react';
import api from '../api';

export default function BucketList() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/bucket').then(({ data }) => setItems(data)).catch(() => {});
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/bucket', { title, note });
      setItems((prev) => [data, ...prev]);
      setTitle('');
      setNote('');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item) => {
    const next = { ...item, done: !item.done };
    setItems((prev) => prev.map((i) => (i._id === item._id ? next : i)));
    await api.patch(`/bucket/${item._id}`, { done: next.done }).catch(() =>
      setItems((prev) => prev.map((i) => (i._id === item._id ? item : i)))
    );
  };

  const remove = async (id) => {
    setItems((prev) => prev.filter((i) => i._id !== id));
    await api.delete(`/bucket/${id}`).catch(() => {});
  };

  const done = items.filter((i) => i.done).length;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-800">Bucket list</h1>
          <p className="text-sm text-stone-500">
            {done} of {items.length} done — keep collecting moments.
          </p>
        </div>
      </div>

      <form onSubmit={add} className="card space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Watch the sunrise over the mountains…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="input"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button className="btn-primary" disabled={busy || !title.trim()}>
          Add to the list
        </button>
      </form>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-stone-400 py-10 text-center">No adventures planned yet.</p>
        )}

        {items.map((item) => (
          <div
            key={item._id}
            className="card flex items-start gap-3 !py-4"
          >
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggle(item)}
              className="mt-1 w-5 h-5 accent-rose-500"
            />
            <div className="flex-1">
              <p
                className={`font-medium ${
                  item.done ? 'text-stone-400 line-through' : 'text-stone-800'
                }`}
              >
                {item.title}
              </p>
              {item.note && <p className="text-sm text-stone-500">{item.note}</p>}
            </div>
            <button
              onClick={() => remove(item._id)}
              className="text-xs text-stone-400 hover:text-rose-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
