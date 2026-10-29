import { useEffect, useState } from 'react';
import { Lightbulb, Gift, CheckCircle2, Trash2 } from 'lucide-react';
import api from '../api';

const STATUSES = ['idea', 'planned', 'sent'];
const LABELS = {
  idea: { text: 'Idea', Icon: Lightbulb, cls: 'border-stone-200 bg-stone-50 text-stone-600' },
  planned: { text: 'Planned', Icon: Gift, cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  sent: { text: 'Sent', Icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};

export default function Gifts() {
  const [gifts, setGifts] = useState([]);
  const [form, setForm] = useState({ title: '', url: '', price: '', notes: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/gifts').then(({ data }) => setGifts(data)).catch(() => {});
  }, []);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/gifts', form);
      setGifts((prev) => [data, ...prev]);
      setForm({ title: '', url: '', price: '', notes: '' });
    } finally {
      setBusy(false);
    }
  };

  const cycle = async (gift) => {
    const next = STATUSES[(STATUSES.indexOf(gift.status) + 1) % STATUSES.length];
    const updated = { ...gift, status: next };
    setGifts((prev) => prev.map((g) => (g._id === gift._id ? updated : g)));
    await api.patch(`/gifts/${gift._id}`, { status: next }).catch(() => {});
  };

  const remove = async (id) => {
    setGifts((prev) => prev.filter((g) => g._id !== id));
    await api.delete(`/gifts/${id}`).catch(() => {});
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-display">Gift ideas</h1>
        <p className="t-body text-stone-500">
          Click a gift to move it: idea → planned → sent (sent gifts post to your timeline).
        </p>
      </div>

      <form onSubmit={add} className="card space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Gift title"
            value={form.title}
            onChange={update('title')}
          />
          <input
            className="input"
            placeholder="Link (optional)"
            value={form.url}
            onChange={update('url')}
          />
          <input
            className="input"
            type="number"
            min="0"
            placeholder="Price (optional)"
            value={form.price}
            onChange={update('price')}
          />
          <input
            className="input"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={update('notes')}
          />
        </div>
        <button className="btn-primary" disabled={busy || !form.title.trim()}>
          Save idea
        </button>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {gifts.length === 0 && (
          <p className="text-stone-400 py-10 sm:col-span-2 lg:col-span-3 text-center">
            No gift ideas yet.
          </p>
        )}

        {gifts.map((gift) => (
          <div key={gift._id} className="card">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-stone-800">{gift.title}</p>
              <button
                onClick={() => remove(gift._id)}
                className="text-stone-400 hover:text-rose-600 p-1"
                aria-label="Delete gift"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {gift.notes && <p className="text-sm text-stone-500 mt-1">{gift.notes}</p>}
            {gift.price > 0 && (
              <p className="text-sm text-stone-600 mt-1 font-display">{gift.price}</p>
            )}
            {gift.url && (
              <a
                href={gift.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-rose-600 break-all mt-1 inline-block"
              >
                {gift.url}
              </a>
            )}

            <button
              onClick={() => cycle(gift)}
              className={`mt-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
                LABELS[gift.status]?.cls || LABELS.idea.cls
              }`}
            >
              {(() => {
                const { Icon } = LABELS[gift.status] || LABELS.idea;
                return <Icon className="w-3.5 h-3.5" />;
              })()}
              {(LABELS[gift.status] || LABELS.idea).text}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
