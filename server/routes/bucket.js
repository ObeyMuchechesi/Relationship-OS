import express from 'express';
import { BucketItem } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const items = await BucketItem.find({ couple: req.user.couple._id }).sort({ done: 1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, note } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'Title required' });

    const item = await BucketItem.create({
      couple: req.user.couple._id,
      createdBy: req.user._id,
      title: title.trim(),
      note: note || '',
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const item = await BucketItem.findOne({ _id: req.params.id, couple: req.user.couple._id });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (req.body.done !== undefined) item.done = !!req.body.done;
    if (req.body.title) item.title = req.body.title;
    if (req.body.note !== undefined) item.note = req.body.note;
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await BucketItem.findOneAndDelete({ _id: req.params.id, couple: req.user.couple._id });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
