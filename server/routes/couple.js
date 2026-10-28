import express from 'express';
import crypto from 'crypto';
import { Couple } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const publicCouple = (couple, userId) => {
  const partner =
    couple.members && couple.members.length > 1
      ? couple.members.find((m) => String(m._id) !== String(userId)) || null
      : null;
  return {
    id: couple._id,
    inviteCode: couple.inviteCode,
    members: couple.members.map((m) => ({
      id: m._id,
      name: m.name,
      email: m.email,
      timezone: m.timezone,
    })),
    partner,
    reunionDate: couple.reunionDate,
    reunionPlace: couple.reunionPlace,
    savingsGoal: couple.savingsGoal,
    savingsCurrent: couple.savingsCurrent,
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

    const couple = await Couple.create({ members: [req.user._id], inviteCode });
    req.user.couple = couple._id;
    await req.user.save();

    const populated = await Couple.findById(couple._id).populate('members', 'name email timezone');
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
    await couple.save();

    const populated = await Couple.findById(couple._id).populate('members', 'name email timezone');
    res.json(publicCouple(populated, req.user._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
