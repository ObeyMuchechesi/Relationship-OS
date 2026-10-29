import express from 'express';
import { Signal } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

const ALLOWED = ['source', 'control', 'sdp-offer', 'sdp-answer', 'ice'];

const coupleId = (req, res) => {
  const id = req.user.couple?._id;
  if (!id) {
    res.status(400).json({ message: 'No couple space' });
    return null;
  }
  return id;
};

// Send a signal to the partner (playback control, SDP, ICE candidate, source).
router.post('/signal', async (req, res) => {
  try {
    const couple = coupleId(req, res);
    if (!couple) return;

    const { type, payload } = req.body || {};
    if (!ALLOWED.includes(type)) return res.status(400).json({ message: 'Bad signal type' });

    await Signal.create({ couple, from: req.user._id, type, payload: payload || {} });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Poll partner signals since a timestamp. Read-once: the recipient claims
// the messages by deleting them, so nothing is delivered twice.
router.get('/signal', async (req, res) => {
  try {
    const couple = coupleId(req, res);
    if (!couple) return;

    const since = req.query.since ? new Date(String(req.query.since)) : new Date(Date.now() - 60000);
    if (Number.isNaN(since.getTime())) return res.json([]);

    const docs = await Signal.find({
      couple,
      from: { $ne: req.user._id },
      createdAt: { $gt: since },
    })
      .sort({ createdAt: 1 })
      .limit(50);

    if (docs.length) {
      await Signal.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
    }

    res.json(
      docs.map((d) => ({
        id: d._id,
        type: d.type,
        payload: d.payload,
        from: String(d.from),
        at: d.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
