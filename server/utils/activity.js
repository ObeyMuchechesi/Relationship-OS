import { Activity } from '../models/index.js';

// Fire-and-forget activity logging for the admin feed — never blocks a request.
export function logActivity(type, user, detail = '') {
  try {
    if (!user) return;
    Activity.create({
      actor: user._id || user.id,
      actorName: user.name || '',
      actorEmail: user.email || '',
      type,
      detail,
    }).catch(() => {});
  } catch {
    /* activity is best-effort */
  }
}
