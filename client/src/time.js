// Time helpers: everything is rendered in each partner's own timezone.

export function zoneOf(user) {
  return user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function fmtTime(date, user) {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zoneOf(user),
  });
}

export function fmtDate(date, user) {
  return new Date(date).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: zoneOf(user),
  });
}

export function fmtDateTime(date, user) {
  return `${fmtDate(date, user)} · ${fmtTime(date, user)}`;
}

// "in 3d 4h 12m" style countdown to a target date
export function breakdown(target) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    done: diff === 0,
  };
}

// The local wall-clock "now" in a given timezone (as a select-friendly value)
export function localInputValue(date = new Date(), user) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zoneOf(user),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export const listTimezones = () =>
  Intl.supportedValuesOf?.('timeZone') || [
    'Africa/Harare',
    'Africa/Johannesburg',
    'Europe/London',
    'America/New_York',
  ];
