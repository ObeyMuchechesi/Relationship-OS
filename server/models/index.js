import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  timezone: { type: String, default: 'Africa/Harare' },
  couple: { type: Schema.Types.ObjectId, ref: 'Couple', default: null },
  avatarUrl: { type: String, default: '' },
  role: { type: String, default: 'user' }, // user | admin
  lastSeen: { type: Date, default: null },
}, { timestamps: true });

const CoupleSchema = new Schema({
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // Whoever generated the invite code (the space creator). They control the
  // space, including removing the partner. Falls back to members[0] for
  // spaces created before this field existed.
  creator: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  inviteCode: { type: String, unique: true, required: true },
  reunionDate: { type: Date, default: null },
  reunionPlace: { type: String, default: '' },
  savingsGoal: { type: Number, default: 0 },
  savingsCurrent: { type: Number, default: 0 },
  dashboardBg: { type: String, default: '' },
  startedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const PostSchema = new Schema({
  couple: { type: Schema.Types.ObjectId, ref: 'Couple', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  audioUrl: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  kind: { type: String, default: 'post' }, // post | scheduled | gift
}, { timestamps: true });

const MoodSchema = new Schema({
  couple: { type: Schema.Types.ObjectId, ref: 'Couple', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mood: { type: String, required: true },
  note: { type: String, default: '' },
}, { timestamps: true });

const BucketItemSchema = new Schema({
  couple: { type: Schema.Types.ObjectId, ref: 'Couple', required: true },
  title: { type: String, required: true },
  note: { type: String, default: '' },
  done: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const ScheduledMessageSchema = new Schema({
  couple: { type: Schema.Types.ObjectId, ref: 'Couple', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  deliverAt: { type: Date, required: true },
  delivered: { type: Boolean, default: false },
}, { timestamps: true });

const GiftIdeaSchema = new Schema({
  couple: { type: Schema.Types.ObjectId, ref: 'Couple', required: true },
  title: { type: String, required: true },
  url: { type: String, default: '' },
  price: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  status: { type: String, default: 'idea' }, // idea | planned | sent
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Short-lived messages for the watch-together room (WebRTC signaling +
// playback sync). Read-once, auto-expired so the collection stays small.
const SignalSchema = new Schema({
  couple: { type: Schema.Types.ObjectId, ref: 'Couple', required: true },
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true }, // source | control | sdp-offer | sdp-answer | ice
  payload: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
SignalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 });

// Admin activity feed: account-level events only (signups, sign-ins,
// password resets). What a couple does inside their space is never logged
// here — it stays between the two of them. Names are denormalized so the
// feed stays readable even if the account is later deleted.
const ActivitySchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  actorName: { type: String, default: '' },
  actorEmail: { type: String, default: '' },
  type: { type: String, required: true }, // register | login | password-reset
  detail: { type: String, default: '' },
}, { timestamps: true });
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 86400 });
ActivitySchema.index({ createdAt: -1 });

// Resolved full-movie playback source per TMDB title (cached: YouTube's
// search quota is 100 lookups/day, and archive.org deserves politeness).
// source: youtube | archive | none  (none = checked, no legal full copy)
const MovieSourceSchema = new Schema({
  tmdbId: { type: Number, required: true, unique: true },
  source: { type: String, required: true },
  key: { type: String, default: '' }, // YouTube video id
  url: { type: String, default: '' }, // direct archive.org file url
  title: { type: String, default: '' },
  checkedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const User = model('User', UserSchema);
export const Couple = model('Couple', CoupleSchema);
export const Post = model('Post', PostSchema);
export const Mood = model('Mood', MoodSchema);
export const BucketItem = model('BucketItem', BucketItemSchema);
export const ScheduledMessage = model('ScheduledMessage', ScheduledMessageSchema);
export const GiftIdea = model('GiftIdea', GiftIdeaSchema);
export const Signal = model('Signal', SignalSchema);
export const Activity = model('Activity', ActivitySchema);
export const MovieSource = model('MovieSource', MovieSourceSchema);
