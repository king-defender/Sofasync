# Sofa Sync — Product Requirements Document (v1.1)

**Tagline:** Watch Together. Stay Connected.

---

## 1. Overview

Sofa Sync is a real-time social watch-along platform. Instead of syncing separate video players across a streaming link, one person shares their screen (or a local file) and everyone in the room watches, chats, and video-calls together — like being on the same couch.

Built for personal use with Deepak's friend circle first, then opened up publicly so anyone can register and either invite people they know or get matched with a stranger to watch with.

**Budget constraint:** $0. Every service choice must have a usable free tier.

---

## 2. Goals

- Let 2–4 people watch the same content together with zero setup friction (no shared platform account, no "paste this link and press play at the same time").
- Give people a way to watch with someone even when they don't already know who — public matchmaking.
- Make the room feel like a real hangout: live chat + webcam, not just a synced player.

## 3. Non-Goals (for v1)

- Not sourcing/licensing/hosting movie content ourselves — content comes from the host's own screen or local file.
- Not building a recommendation engine or content library.
- Not supporting more than 4 users per room (mesh WebRTC cost scales O(n²); more needs an SFU, which breaks the $0 budget).
- Not guaranteeing frame-accurate sync — the "sync problem" is sidestepped by broadcasting one person's feed rather than syncing N independent players.

## 4. Target Users

- Friends/partners who want to watch together remotely without both having the same streaming subscription open in sync.
- People who want to watch something but have nobody around — opt into matchmaking to find a stranger with similar taste.

---

## 5. Core Features

| # | Feature | Description |
|---|---|---|
| 1 | **Screen share** | Host shares their screen (e.g. their own Netflix/YouTube tab); the feed becomes the room's shared "player." No platform links need to be exchanged. |
| 2 | **Local media selection** | User picks a video file from their device; it plays in a local `<video>` element and that element's stream is captured and broadcast the same way a screen-share would be. No file upload or hosting required. |
| 3 | **Login/signup** | Email/password with verification + password reset, plus optional social/guest login. |
| 4 | **Buddy request (known)** | Invite a specific friend/contact to a room; they get a notification and can accept to join. |
| 5 | **Unknown request (matchmaking)** | "Find a buddy" — join a queue with optional filters (genre, language, mood); when two compatible users are waiting, auto-pair them into a room. |
| 6 | **Real-time chat** | Persistent text chat inside the room for live reactions/discussion, tied to the room and stored so history survives reloads. |
| 7 | **Video call (webcam)** | Each participant's webcam feed is a second track alongside the movie feed, so people see each other while watching — true watch-along, not just a shared screen. |
| 8 | **Admin panel** | A dashboard (super-admin only) to view/manage reports, suspend users, and manage the badge catalog — the operational side of moderation and gamification. |

### Feature detail: what's inside each room

A room carries, per peer, over one WebRTC connection:
- The movie feed (screen-share track or captured local-media track)
- Webcam track
- Chat data channel

---

## 6. Key User Flows

**Flow A — Invite a friend**
1. User logs in → creates a room → chooses source (screen share or local file)
2. Sends a buddy request to a friend
3. Friend accepts → joins room → both see movie feed, webcams, and chat

**Flow B — Get matched with a stranger**
1. User logs in → taps "Find a buddy" → sets optional filters
2. Enters matchmaking queue
3. System pairs with another waiting user with compatible filters → room auto-created
4. Either party chooses the content source once matched

**Flow C — Local file watch-along**
1. Host selects a local video file instead of screen-sharing
2. File plays in host's browser; stream is captured and sent to peers
3. Peers watch the captured stream — they never need the file themselves

---

## 7. Technical Architecture

- **Frontend:** Next.js, React, TypeScript, Tailwind, shadcn
- **Backend:** Next.js (single stack, no separate NestJS service)
- **Database:** PostgreSQL via Prisma
- **Realtime signaling / chat:** Socket.IO
- **Media:** WebRTC (`RTCPeerConnection`, mesh topology, ≤4 peers)
  - Movie feed: `getDisplayMedia()` (screen share) or `HTMLMediaElement.captureStream()` (local file)
  - Webcam: `getUserMedia()`
- **Matchmaking queue:** Redis + BullMQ
- **Auth:** Auth.js or Clerk
- **Storage (avatars, etc.):** Supabase/S3 free tier
- **Deployment:** Free-tier hosting only (Vercel-type frontend + free Postgres/Redis tier)

---

## 8. Constraints & Risks

| Constraint | Impact |
|---|---|
| $0 budget | Every service must fit a free tier; mesh WebRTC (not SFU) caps rooms at 4 users |
| Mesh WebRTC bandwidth | Up to 12 media tracks total at 4 users (movie + webcam × 4) — needs early stress-testing |
| Screen-share system audio | Supported on Chrome/Edge desktop only, not Safari/mobile — need to decide minimum supported browser |
| Screen-share has no playback metadata | Can't build timestamp-linked chat reactions (e.g. "🔥 at 32:10") for the screen-share path — only possible for local-media path |

---

## 9. Open Questions

- [x] **Matchmaking filters:** genre, language, camera on/off preference, and age range — all four included.
- [x] **Minimum supported platform:** desktop + mobile. System-audio capture on screen share will be limited/unavailable on some browsers (notably Safari and most mobile browsers) — this is an accepted limitation, not a blocker.
- [x] **Room layout:** Layout A — movie feed dominant, with webcam bubbles floating over the bottom-left corner, chat as a fixed sidebar, and a notification bell (with unread indicator) top-right.
- [ ] Chat scope: plain text only, or emoji reactions / movie-moment-linked comments (local-media path only)?

---

## 10. Success Metrics (personal-use phase)

- Rooms created and completed without dropped connections
- Chat + webcam actively used during sessions (not just movie feed)
- At least one successful stranger-matchmaking pairing

---

## 11. Next Steps

1. Lock open questions in Section 9
2. FRS (functional requirements spec) per feature
3. DB schema (users, rooms, messages, matchmaking queue, buddy requests)
4. API/socket event spec
5. UX flow + room layout wireframes
6. Build order / sprint plan
