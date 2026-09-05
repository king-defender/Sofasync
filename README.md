# Sofa Sync

**Watch Together. Stay Connected.**

A real-time social watch-along platform. One person shares their screen (or a local video file) and everyone in the room watches, chats, and video-calls together — no shared streaming account, no "press play at the same time."

Built for personal use first (invite-only), then opened up for public matchmaking with strangers who share similar tastes.

## Tech stack

- **Frontend/Backend:** Next.js 14 (App Router) + TypeScript, single stack — no separate API service
- **Realtime:** Socket.IO (chat, presence, WebRTC signaling, matchmaking events), served from a custom [server.js](server.js) rather than Next's default server
- **Media:** WebRTC mesh (`RTCPeerConnection`, capped at 4 peers) — `getDisplayMedia()` for screen share, `HTMLMediaElement.captureStream()` for local files, `getUserMedia()` for webcam
- **Database:** PostgreSQL via Prisma (see [prisma/schema.prisma](prisma/schema.prisma))
- **Matchmaking queue:** Postgres (durable state) + Redis via `ioredis` (live socket routing) — see [server.js](server.js)
- **Auth:** Custom JWT sessions (`jsonwebtoken` + `bcryptjs`), plus real OAuth (Google/GitHub/Discord) via [src/lib/oauth.ts](src/lib/oauth.ts)
- **Email:** `nodemailer` via [src/lib/mailer.ts](src/lib/mailer.ts) — verification links and password resets

## Project docs

| Doc | Covers |
|---|---|
| [CineMate-PRD.md](CineMate-PRD.md) | Product goals, non-goals, constraints |
| [SofaSync-FRS.md](SofaSync-FRS.md) | Functional requirements (FR-#) per feature |
| [SofaSync-DB-Schema.md](SofaSync-DB-Schema.md) | Data model notes |
| [SofaSync-API-Socket-Spec.md](SofaSync-API-Socket-Spec.md) | REST + Socket.IO event contracts |
| [SofaSync-Sprint-Plan.md](SofaSync-Sprint-Plan.md) | Build order |

## Local development

You need a Postgres database and a Redis instance. Either works:

**Option A — Docker** (if you have it):
```bash
docker-compose up -d
```
This starts Postgres on `5432` and Redis on `6380` (see [docker-compose.yml](docker-compose.yml)), matching the default `.env` values below.

**Option B — free-tier cloud** (if you don't have Docker): create a free [Neon](https://neon.tech) Postgres project and a free [Upstash](https://upstash.com) Redis database, and use their connection strings instead — no local containers needed. This is also what the production deploy uses.

Then:

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL / REDIS_URL / secrets - see below
npx prisma db push     # creates tables from prisma/schema.prisma
npm run prisma:seed    # seeds 3 test accounts + the badge catalog
npm run dev            # starts the Next.js + Socket.IO server on :3000
```

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. Use the **direct** (non-pooled) one if using Neon — this app keeps one long-lived Prisma client, not serverless functions |
| `REDIS_URL` | Yes | `redis://` (local/Docker) or `rediss://` (Upstash, TLS) |
| `JWT_SECRET` / `NEXTAUTH_SECRET` | Yes | Any long random string |
| `NEXTAUTH_URL` | Yes | Your app's own base URL — used to build email links and OAuth redirect URIs |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Leave blank to disable Google sign-in (shows "not configured" instead of failing silently). Redirect URI to register: `<NEXTAUTH_URL>/api/auth/oauth/google` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | No | Same, redirect URI: `<NEXTAUTH_URL>/api/auth/oauth/github` |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | No | Same, redirect URI: `<NEXTAUTH_URL>/api/auth/oauth/discord` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | No | Leave blank to fall back to logging the verification/reset link to the server console instead of emailing it (clearly labeled `[DEV MODE - no SMTP configured]`) |

### Seeded test accounts

After `npm run prisma:seed`:

| Email | Password | Role |
|---|---|---|
| `admin@sofasync.com` | `admin123` | `SUPER_ADMIN` |
| `deepak@sofasync.com` | `user123` | `USER` |
| `sarah@sofasync.com` | `user123` | `USER` |
| `alex@sofasync.com` | `user123` | `USER` |

## Deployment

This app needs a host that keeps `server.js` running as one persistent Node process — its Socket.IO server won't work on a purely serverless platform (e.g. Vercel's default model).

[render.yaml](render.yaml) is a Render Blueprint: push this repo, then on [Render](https://render.com) choose **New → Blueprint** and point it at the repo. It'll build with `npm install && npx prisma generate && npm run build` and start with `npm start`, prompting you to fill in `DATABASE_URL`, `REDIS_URL`, and the optional OAuth/SMTP vars above.

Render's free tier spins the service down after ~15 minutes idle and cold-starts on the next request (10–30s) — fine for QA, worth knowing about.

## Known limitations (by design)

- Max 4 participants per room (mesh WebRTC cost scales O(n²); more would need an SFU)
- Screen-share system audio is unsupported/limited on Safari and most mobile browsers — this degrades gracefully, it's not a bug
- Movie-moment chat comments (e.g. "🔥 at 32:10") only work on the local-file path — screen share has no exposed playback timestamp to attach one to
