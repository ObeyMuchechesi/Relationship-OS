import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fmtTime, zoneOf } from '../time';

// Sticky strip showing both partners' local clocks, so the distance never
// hides in the UI.
export default function TimezoneBar() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const partner = user?.couple?.partner;
  const mine = fmtTime(now, user);

  return (
    <div className="border-t border-stone-200 bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center justify-between text-xs text-stone-500">
        <span>
          You · <span className="font-medium text-stone-700">{zoneOf(user)}</span> —{' '}
          <span className="font-display text-stone-800">{mine}</span>
        </span>
        <span>
          {partner ? (
            <>
              {partner.name} · <span className="font-medium text-stone-700">{partner.timezone}</span>{' '}
              — <span className="font-display text-stone-800">{fmtTime(now, partner)}</span>
            </>
          ) : (
            <span className="text-stone-400">Partner not joined yet</span>
          )}
        </span>
      </div>
    </div>
  );
}
