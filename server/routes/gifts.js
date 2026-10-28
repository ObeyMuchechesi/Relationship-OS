import express from 'express';
import { GiftIdea, Post } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

const STATUSES = ['idea', 'planned', 'sent'];

router.get('/', async (req, res) => {
  try {
    const gifts = await GiftIdea.find({ couple: req.user.couple._id }).sort({ createdAt: -1 });
    res.json(gifts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, url, price, notes } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'Title required' });

    const gift = await GiftIdea.create({
      couple: req.user.couple._id,
      createdBy: req.user._id,
      title: title.trim(),
      url: url || '',
      price: Number(price) || 0,
      notes: notes || '',
    });
    res.json(gift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const gift = await GiftIdea.findOne({ _id: req.params.id, couple: req.user.couple._id });
    if (!gift) return res.status(404).json({ message: 'Gift not found' });

    const wasSent = gift.status === 'sent';
    if (req.body.title) gift.title = req.body.title;
    if (req.body.url !== undefined) gift.url = req.body.url;
    if (req.body.price !== undefined) gift.price = Number(req.body.price) || 0;
    if (req.body.notes !== undefined) gift.notes = req.body.notes;
    if (req.body.status && STATUSES.includes(req.body.status)) gift.status = req.body.status;
    await gift.save();

    // "Sent" gifts show up on the shared timeline as an announcement.
    if (gift.status === 'sent' && !wasSent) {
      await Post.create({
        couple: gift.couple,
        author: req.user._id,
        text: `🎁 Gift sent: ${gift.title}`,
        kind: 'gift',
      });
    }

    res.json(gift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const gift = await GiftIdea.findOneAndDelete({ _id: req.params.id, couple: req.user.couple._id });
    if (!gift) return res.status(404).json({ message: 'Gift not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
