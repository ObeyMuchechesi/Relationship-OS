import cron from 'node-cron';
import { ScheduledMessage, Post } from '../models/index.js';

/**
 * Deliver every scheduled message that is due.
 * Claiming with a conditional update makes this idempotent, so the cron
 * job and lazy delivery from request handlers can never double-post.
 */
export async function deliverDueMessages(filter = {}) {
  const due = await ScheduledMessage.find({
    delivered: false,
    deliverAt: { $lte: new Date() },
    ...filter,
  });

  let delivered = 0;
  for (const msg of due) {
    const claimed = await ScheduledMessage.findOneAndUpdate(
      { _id: msg._id, delivered: false },
      { $set: { delivered: true } },
      { new: true }
    );
    if (!claimed) continue; // someone else already delivered it

    await Post.create({
      couple: msg.couple,
      author: msg.author,
      text: msg.text,
      kind: 'scheduled',
    });
    delivered++;
  }
  return delivered;
}

export function startCron() {
  // Runs every minute — delivers any scheduled messages that are due
  cron.schedule('* * * * *', async () => {
    try {
      const delivered = await deliverDueMessages();
      if (delivered) console.log(`Delivered ${delivered} scheduled message(s)`);
    } catch (err) {
      console.error('Cron error:', err.message);
    }
  });
  console.log('Cron started');
}
