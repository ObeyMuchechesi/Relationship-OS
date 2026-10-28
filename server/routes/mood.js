import express from 'express';
import { Mood } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const moods = await Mood.find({ couple: req.user.couple._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('author', 'name');
    res.json(moods);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { mood, note } = req.body;
    if (!mood) return res.status(400).json({ message: 'Mood required' });

    const created = await Mood.create({
      couple: req.user.couple._id,
      author: req.user._id,
      mood,
      note: note || '',
    });
    res.json(await created.populate('author', 'name'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
