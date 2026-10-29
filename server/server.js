import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import coupleRoutes from './routes/couple.js';
import postRoutes from './routes/posts.js';
import moodRoutes from './routes/mood.js';
import bucketRoutes from './routes/bucket.js';
import scheduledRoutes from './routes/scheduled.js';
import giftRoutes from './routes/gifts.js';
import adminRoutes from './routes/admin.js';
import roomRoutes from './routes/room.js';
import { uploadsDir, useStorage, getUpload, validUploadKey } from './utils/uploads.js';
import { startCron } from './utils/cron.js';

export const app = express();

const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: '2mb' }));

// Cached connection so serverless (Vercel) invocations reuse it across warm starts.
let connectionPromise = null;
export function connectDB() {
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO_URI, { autoIndex: true })
      .then(() => mongoose.connection)
      .catch((err) => {
        connectionPromise = null; // allow retry on next request
        throw err;
      });
  }
  return connectionPromise;
}

// Every /api request waits for the DB before hitting a route.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB unavailable:', err.message);
    res.status(500).json({ message: 'Database unavailable' });
  }
});

// Uploaded files: served from disk locally, or proxied out of object storage
// when the bucket is configured (keys are opaque, so the bucket stays private).
if (useStorage) {
  app.get('/uploads/:key', async (req, res) => {
    try {
      const { key } = req.params;
      if (!validUploadKey(key)) return res.status(404).json({ message: 'Not found' });
      const object = await getUpload(key);
      if (object.ContentType) res.set('Content-Type', object.ContentType);
      if (object.ContentLength) res.set('Content-Length', String(object.ContentLength));
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      object.Body.pipe(res);
    } catch {
      res.status(404).json({ message: 'Not found' });
    }
  });
} else {
  app.use('/uploads', express.static(uploadsDir));
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/couple', coupleRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/bucket', bucketRoutes);
app.use('/api/scheduled', scheduledRoutes);
app.use('/api/gifts', giftRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/room', roomRoutes);

// Local development: listen + run the every-minute delivery cron.
// On Vercel the platform invokes the exported app instead (see api/index.js),
// and scheduled messages are delivered lazily when the feed is fetched.
if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      console.log('MongoDB connected');
      startCron();
      // PORT=0 (or any non-positive value) in the environment would otherwise
      // bind an ephemeral port, so coerce it to a real number.
      const port = Number(process.env.PORT) || 5000;
      app.listen(port, () => console.log(`Relationship OS API on http://localhost:${port}`));
    })
    .catch((err) => {
      console.error('MongoDB connection failed:', err.message);
      process.exit(1);
    });
}

export default app;
