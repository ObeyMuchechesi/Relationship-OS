import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate({
      path: 'couple',
      populate: { path: 'members', select: 'name email timezone avatarUrl' },
    });
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Track presence for the admin dashboard (at most one write per 5 min).
    if (!user.lastSeen || Date.now() - new Date(user.lastSeen).getTime() > 5 * 60 * 1000) {
      User.updateOne({ _id: user._id }, { $set: { lastSeen: new Date() } }).catch(() => {});
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
