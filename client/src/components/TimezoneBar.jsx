import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fmtTime, zoneOf } from '../time';

// Sticky strip showing both partners' live clocks (ticking every second),
// so the distance never hides in the UI.
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
    <div className="border-t border-stone-200 bg-stone-50/80">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3 text-[11px] sm:text-xs text-stone-500">
        <span className="flex items-center gap-1.5">
          <Globe className="w-3 h-3 shrink-0" />
          <span>
            You · <span className="font-medium text-stone-700">{zoneOf(user)}</span> —{' '}
            <span className="font-display font-semibold text-stone-800 tabular-nums">{mine}</span>
          </span>
        </span>
        <span className="sm:text-right">
          {partner ? (
            <>
              {partner.name} · <span className="font-medium text-stone-700">{partner.timezone}</span>{' '}
              —{' '}
              <span className="font-display font-semibold text-stone-800 tabular-nums">
                {fmtTime(now, partner)}
              </span>
            </>
          ) : (
            <span className="text-stone-400">Partner not joined yet</span>
          )}
        </span>
      </div>
    </div>
  );
}
