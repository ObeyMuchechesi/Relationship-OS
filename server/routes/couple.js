import express from 'express';
import crypto from 'crypto';
import {
  Couple,
  Post,
  Mood,
  BucketItem,
  ScheduledMessage,
  GiftIdea,
  Signal,
} from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { upload, storedPath, deleteUpload } from '../utils/uploads.js';

const router = express.Router();

const publicCouple = (couple, userId) => {
  const partner =
    couple.members && couple.members.length > 1
      ? couple.members.find((m) => String(m._id) !== String(userId)) || null
      : null;
  // Who controls the space: whoever generated the invite code. Older spaces
  // predate the field, so fall back to the first member.
  const creatorId = couple.creator
    ? String(couple.creator._id || couple.creator)
    : String(couple.members?.[0]?._id || '');
  return {
    id: couple._id,
    inviteCode: couple.inviteCode,
    canManage: creatorId !== '' && creatorId === String(userId),
    members: couple.members.map((m) => ({
      id: m._id,
      name: m.name,
      email: m.email,
      timezone: m.timezone,
      avatarUrl: m.avatarUrl || '',
    })),
    partner,
    reunionDate: couple.reunionDate,
    reunionPlace: couple.reunionPlace,
    savingsGoal: couple.savingsGoal,
    savingsCurrent: couple.savingsCurrent,
    dashboardBg: couple.dashboardBg || '',
    startedAt: couple.startedAt,
  };
};

function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Current couple (Settings screen and others)
router.get('/me', protect, async (req, res) => {
  if (!req.user.couple) return res.status(404).json({ message: 'No couple space yet' });
  res.json(publicCouple(req.user.couple, req.user._id));
});

// Create a new shared space
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.couple) return res.status(400).json({ message: 'Already in a shared space' });

    let inviteCode = generateCode();
    while (await Couple.findOne({ inviteCode })) inviteCode = generateCode();

    const couple = await Couple.create({
      members: [req.user._id],
      creator: req.user._id,
      inviteCode,
    });
    req.user.couple = couple._id;
    await req.user.save();

    const populated = await Couple.findById(couple._id).populate('members', 'name email timezone avatarUrl');
    res.json(publicCouple(populated, req.user._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Join an existing space by invite code
router.post('/join', protect, async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ message: 'Invite code required' });

    const couple = await Couple.findOne({ inviteCode: String(inviteCode).trim().toUpperCase() });
    if (!couple) return res.status(404).json({ message: 'Invalid invite code' });
    if (req.user.couple) return res.status(400).json({ message: 'Already in a shared space' });
    if (couple.members.length >= 2) return res.status(400).json({ message: 'This space already has two members' });

    couple.members.push(req.user._id);
    await couple.save();
    req.user.couple = couple._id;
    await req.user.save();

    const populated = await Couple.findById(couple._id).populate('members', 'name email timezone');
    res.json(publicCouple(populated, req.user._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Remove the partner from the space. Only the invite sender may do this, and
// everything the removed person contributed to this space goes with them
// (their account itself is kept — it simply has no space any more).
router.delete('/member', protect, async (req, res) => {
  try {
    if (!req.user.couple) return res.status(404).json({ message: 'No couple space yet' });

    const couple = await Couple.findById(req.user.couple._id).populate(
      'members',
      'name email timezone avatarUrl'
    );
    if (!couple) return res.status(404).json({ message: 'No couple space yet' });

    const creatorId = couple.creator
      ? String(couple.creator)
      : String(couple.members[0]?._id || '');
    if (creatorId !== String(req.user._id)) {
      return res
        .status(403)
        .json({ message: 'Only the person who created the invite can remove a partner' });
    }

    const target = couple.members.find((m) => String(m._id) !== String(req.user._id));
    if (!target) return res.status(400).json({ message: 'No partner to remove' });

    // Collect their uploaded media first so the files can go too.
    const posts = await Post.find({ couple: couple._id, author: target._id });

    // Everything they added to this space.
    await Promise.all([
      Post.deleteMany({ couple: couple._id, author: target._id }),
      Mood.deleteMany({ couple: couple._id, author: target._id }),
      ScheduledMessage.deleteMany({ couple: couple._id, author: target._id }),
      BucketItem.deleteMany({ couple: couple._id, createdBy: target._id }),
      GiftIdea.deleteMany({ couple: couple._id, createdBy: target._id }),
      Signal.deleteMany({ couple: couple._id, from: target._id }),
    ]);

    // Best-effort cleanup of the stored photo/video/voice files.
    for (const p of posts) {
      for (const key of [p.imageUrl, p.videoUrl, p.audioUrl]) {
        if (key) deleteUpload(key).catch(() => {});
      }
    }

    couple.members = [req.user._id];
    await couple.save();

    target.couple = null;
    await target.save();

    const populated = await Couple.findById(couple._id).populate(
      'members',
      'name email timezone avatarUrl'
    );
    res.json(publicCouple(populated, req.user._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update reunion + savings details
router.patch('/me', protect, async (req, res) => {
  try {
    if (!req.user.couple) return res.status(404).json({ message: 'No couple space yet' });

    const couple = req.user.couple;
    const { reunionDate, reunionPlace, savingsGoal, savingsCurrent } = req.body;

    if (reunionDate !== undefined) couple.reunionDate = reunionDate ? new Date(reunionDate) : null;
    if (reunionPlace !== undefined) couple.reunionPlace = reunionPlace;
    if (savingsGoal !== undefined) couple.savingsGoal = Number(savingsGoal) || 0;
    if (savingsCurrent !== undefined) couple.savingsCurrent = Number(savingsCurrent) || 0;
    if (req.body.dashboardBg !== undefined) {
      const bg = String(req.body.dashboardBg);
      // Only allow our own upload paths, preset gradients, or http(s) URLs.
      if (
        !bg ||
        bg.startsWith('/uploads/') ||
        /^preset:(linear|radial)-gradient/.test(bg) ||
        /^https?:\/\//.test(bg)
      ) {
        couple.dashboardBg = bg;
      }
    }
    await couple.save();

    const populated = await Couple.findById(couple._id).populate('members', 'name email timezone');
    res.json(publicCouple(populated, req.user._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Upload a custom dashboard background (multipart field: "image")
router.post('/background', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    if (!req.user.couple) return res.status(404).json({ message: 'No couple space yet' });

    const couple = req.user.couple;
    couple.dashboardBg = await storedPath(req.file);
    await couple.save();

    const populated = await Couple.findById(couple._id).populate('members', 'name email timezone avatarUrl');
    res.json(publicCouple(populated, req.user._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
