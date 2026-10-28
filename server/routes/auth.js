import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  timezone: user.timezone,
  couple: user.couple || null,
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, timezone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, timezone: timezone || 'Africa/Harare' });

    res.json({ token: sign(user._id), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).populate('couple');
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    res.json({ token: sign(user._id), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Current user (used on app boot to restore the session)
router.get('/me', protect, async (req, res) => {
  res.json(publicUser(req.user));
});

// Update profile
router.patch('/me', protect, async (req, res) => {
  try {
    const { name, timezone } = req.body;
    if (name) req.user.name = name;
    if (timezone) req.user.timezone = timezone;
    await req.user.save();
    res.json(publicUser(req.user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
