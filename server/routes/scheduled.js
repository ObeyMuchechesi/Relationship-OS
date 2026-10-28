import express from 'express';
import { ScheduledMessage } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { deliverDueMessages } from '../utils/cron.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    await deliverDueMessages({ couple: req.user.couple?._id });
    const messages = await ScheduledMessage.find({ couple: req.user.couple._id })
      .sort({ deliverAt: 1 })
      .populate('author', 'name');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { text, deliverAt } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'Message required' });
    if (!deliverAt) return res.status(400).json({ message: 'Delivery time required' });

    const when = new Date(deliverAt);
    if (Number.isNaN(when.getTime())) return res.status(400).json({ message: 'Invalid delivery time' });

    const message = await ScheduledMessage.create({
      couple: req.user.couple._id,
      author: req.user._id,
      text: text.trim(),
      deliverAt: when,
    });
    res.json(await message.populate('author', 'name'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const message = await ScheduledMessage.findOneAndDelete({
      _id: req.params.id,
      couple: req.user.couple._id,
    });
    if (!message) return res.status(404).json({ message: 'Message not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
