import express from 'express';
import bcrypt from 'bcryptjs';
import {
  User,
  Couple,
  Post,
  Mood,
  BucketItem,
  ScheduledMessage,
  GiftIdea,
  Activity,
} from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.use(protect);

// Super-admins only.
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
}
router.use(requireAdmin);

// Overview analytics for the admin dashboard.
router.get('/stats', async (req, res) => {
  try {
    const now = Date.now();
    const day = (n) => new Date(now - n * 86400000);

    const [
      users,
      couples,
      posts,
      moods,
      bucketItems,
      gifts,
      scheduled,
      active7d,
      postsPerDay,
      usersPerDay,
      moodSplit,
    ] = await Promise.all([
      User.countDocuments(),
      Couple.countDocuments(),
      Post.countDocuments(),
      Mood.countDocuments(),
      BucketItem.countDocuments(),
      GiftIdea.countDocuments(),
      ScheduledMessage.countDocuments(),
      User.countDocuments({ lastSeen: { $gte: day(7) } }),
      Post.aggregate([
        { $match: { createdAt: { $gte: day(14) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: day(14) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Mood.aggregate([
        { $group: { _id: '$mood', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
      ]),
    ]);

    res.json({
      totals: { users, couples, posts, moods, bucketItems, gifts, scheduled, active7d },
      postsPerDay,
      usersPerDay,
      moodSplit,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Recent activity feed: logins, signups, posts, space events, password resets.
router.get('/activity', async (req, res) => {
  try {
    const items = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(60)
      .populate('actor', 'name email role');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Who is using the system. Passwords are one-way bcrypt hashes — they are
// never returned; a forgotten password is handled with a reset instead.
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(500).lean();
    const perUserPosts = await Post.aggregate([
      { $group: { _id: '$author', n: { $sum: 1 } } },
    ]);
    const counts = Object.fromEntries(perUserPosts.map((p) => [String(p._id), p.n]));

    res.json(
      users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role || 'user',
        avatarUrl: u.avatarUrl || '',
        timezone: u.timezone,
        createdAt: u.createdAt,
        lastSeen: u.lastSeen,
        inCouple: Boolean(u.couple),
        posts: counts[String(u._id)] || 0,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reset a forgotten password. Returns a fresh temporary password once —
// the original can never be shown because it is stored hashed.
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const temp = req.body.newPassword || `ros-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
    if (temp.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    user.password = await bcrypt.hash(temp, 10);
    await user.save();
    logActivity('password-reset', req.user, `reset the password for ${user.email}`);

    res.json({ email: user.email, tempPassword: temp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
