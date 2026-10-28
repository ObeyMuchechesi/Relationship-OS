import { useEffect, useState } from 'react';
import { breakdown } from '../time';

// Live ticking countdown to a target date.
export default function Countdown({ target, label }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!target) return null;

  const { days, hours, minutes, seconds, done } = breakdown(target);
  if (done) {
    return (
      <div className="font-display text-2xl text-rose-600">
        It's here! {label ? `· ${label}` : ''}
      </div>
    );
  }

  const units = [
    { value: days, label: 'days' },
    { value: hours, label: 'hrs' },
    { value: minutes, label: 'min' },
    { value: seconds, label: 'sec' },
  ];

  return (
    <div>
      <div className="flex gap-3">
        {units.map((u) => (
          <div
            key={u.label}
            className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-center min-w-[64px]"
          >
            <div className="font-display text-xl text-rose-600 tabular-nums">
              {String(u.value).padStart(2, '0')}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-rose-400">{u.label}</div>
          </div>
        ))}
      </div>
      {label && <p className="text-xs text-stone-500 mt-2">{label}</p>}
      <span className="sr-only">{tick}</span>
    </div>
  );
}
