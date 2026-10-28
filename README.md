# Relationship OS 💞

A shared space for long-distance couples: a dual-timezone timeline, mood check-ins,
a shared bucket list, a reunion countdown with a savings goal, gift ideas, and
messages you can schedule for later.

```
relationship-os/
├── server/     Express + Mongoose API (auth, couple spaces, timeline, cron)
└── client/     Vite + React + Tailwind single-page app
```

## Stack

- **Server:** Node.js, Express, Mongoose (MongoDB Atlas), JWT auth, node-cron, multer
- **Client:** Vite, React 18, React Router, Axios, Tailwind CSS

## Local development

1. Copy `server/.env.example` to `server/.env` and fill in your values
   (a MongoDB Atlas connection string, a long random `JWT_SECRET`).
2. Start the API:

   ```bash
   cd server && npm install && npm run dev   # http://localhost:5000
   ```

3. Start the client in a second terminal:

   ```bash
   cd client && npm install && npm run dev   # http://localhost:5173
   ```

   Vite proxies `/api` and `/uploads` to the API, so no extra config is needed.

## How it works

- **Shared spaces** — the first partner creates a space and gets a 4-character
  invite code; the second joins with it. Everything (posts, moods, bucket list,
  gifts, scheduled messages) is scoped to that couple.
- **Timezones** — every timestamp renders in its author's timezone, and the sticky
  header shows both partners' local clocks side by side.
- **Scheduled messages** — queued in the database and delivered by a
  delivery job (`server/utils/cron.js`). Locally it runs as an every-minute
  cron; serverless, due messages are flushed lazily whenever the feed or
  scheduled list is fetched. Delivery claims each message with a conditional
  update, so it can never double-post.
- **Gifts** — move a gift idea → planned → sent; "sent" posts an announcement
  to the shared timeline.

## Deployment (Vercel)

Both halves deploy as separate Vercel projects:

- **API** (`server/`): `vercel deploy` in `server/`. The entry is
  `api/index.js`, which exports the Express app (`vercel.json` routes all
  traffic to it). Set environment variables in the Vercel project:
  `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` (comma-separated allowed origins).
  Do **not** commit `.env` — Vercel reads variables from the dashboard/CLI.
- **Client** (`client/`): deploy with the Vite preset (`vercel deploy` in
  `client/`), and set `VITE_API_URL` to the deployed API origin
  (e.g. `https://your-api.vercel.app/api`). CORS on the API only allows
  origins listed in `CLIENT_URL`.

### Known serverless limitations

- Uploaded photos/voice notes are written to `/tmp`, which is ephemeral on
  Vercel — use object storage (S3/R2) if uploads must persist.
- Cron runs are not available on serverless; scheduled messages are delivered
  lazily on requests instead (see above).
