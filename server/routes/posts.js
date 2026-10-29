import express from 'express';
import { Post } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { upload, useR2, putUpload } from '../utils/uploads.js';
import { deliverDueMessages } from '../utils/cron.js';

const router = express.Router();

router.use(protect);

// Where a just-uploaded file lives: R2 when configured, disk otherwise.
const storedPath = (file) => (useR2 ? putUpload(file) : Promise.resolve(`/uploads/${file.filename}`));

const timeline = (coupleId) =>
  Post.find({ couple: coupleId })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('author', 'name');

// Feed — also flushes any due scheduled messages (serverless-safe)
router.get('/', async (req, res) => {
  try {
    await deliverDueMessages({ couple: req.user.couple?._id });
    res.json(await timeline(req.user.couple._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Text post
router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'Post cannot be empty' });

    const post = await Post.create({
      couple: req.user.couple._id,
      author: req.user._id,
      text: text.trim(),
    });
    res.json(await post.populate('author', 'name'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Photo upload (multipart, field name: "image")
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    const post = await Post.create({
      couple: req.user.couple._id,
      author: req.user._id,
      text: (req.body.text || '').trim(),
      imageUrl: await storedPath(req.file),
    });
    res.json(await post.populate('author', 'name'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Voice note upload (multipart, field name: "audio")
router.post('/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No audio uploaded' });

    const post = await Post.create({
      couple: req.user.couple._id,
      author: req.user._id,
      text: (req.body.text || '').trim(),
      audioUrl: await storedPath(req.file),
    });
    res.json(await post.populate('author', 'name'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({ _id: req.params.id, couple: req.user.couple._id });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
