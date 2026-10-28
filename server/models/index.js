import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  timezone: { type: String, default: 'Africa/Harare' },
  couple: { type: Schema.Types.ObjectId, ref: 'Couple', default: null },
}, { timestamps: true });

const CoupleSchema = new Schema({
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  inviteCode: { type: String, unique: true, required: true },
  reunionDate: { type: Date, default: null },
  reunionPlace: { type: String, default: '' },
  savingsGoal: { type: Number, default: 0 },
  savingsCurrent: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const PostSchema = new Schema({
  couple: { type: Schema.Types.ObjectId, ref: 'Couple', required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  audioUrl: { type: String, default: '' },
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

export const User = model('User', UserSchema);
export const Couple = model('Couple', CoupleSchema);
export const Post = model('Post', PostSchema);
export const Mood = model('Mood', MoodSchema);
export const BucketItem = model('BucketItem', BucketItemSchema);
export const ScheduledMessage = model('ScheduledMessage', ScheduledMessageSchema);
export const GiftIdea = model('GiftIdea', GiftIdeaSchema);
