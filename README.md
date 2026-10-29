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

Production:

- App: https://relationship-os-one-pi.vercel.app
- API: https://relationship-os-api.vercel.app

Both Vercel projects are connected to this repository with Root Directory
set to `server` and `client` respectively, so pushing to `main` builds and
deploys both automatically.

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

### Uploads (Backblaze B2 / S3-compatible storage)

Set these five environment variables on the API project and uploads persist
in an S3-compatible bucket (Cloudflare R2 or Backblaze B2), served privately
through `GET /uploads/:key`:

- `S3_ENDPOINT` — e.g. `https://<account_id>.r2.cloudflarestorage.com` (Cloudflare R2) or `https://s3.us-west-004.backblazeb2.com` (Backblaze B2)
- `S3_REGION` — `auto` for R2; for B2 the region matching the endpoint, e.g. `us-west-004`
- `S3_ACCESS_KEY_ID` — the B2 application key ID
- `S3_SECRET_ACCESS_KEY` — the B2 application key
- `S3_BUCKET` — bucket name

Without them the app falls back to local disk storage (ephemeral `/tmp` on
Vercel). `S3_FORCE_PATH_STYLE=false` switches to virtual-hosted addressing
for endpoints that need it. Note Vercel's request-body cap (~4.5 MB) still
limits upload size.

### Known serverless limitations

- Cron runs are not available on serverless; scheduled messages are delivered
  lazily on requests instead (see above).
- Without object storage configured, uploads are ephemeral (see Uploads above).
