# Sofa Sync — Build Order & Sprint Plan (v1.0)

Fastest realistic path to a working v1, built solo on Next.js full-stack. Sequenced so each sprint produces something demoable, and later sprints don't block on earlier ones being "perfect."

Assumes ~1 developer, part-time pace. Adjust sprint length to your actual availability — the sequence matters more than the calendar.

---

## Sprint 0 — Foundation (no user-facing feature yet)

Goal: empty app that runs, deployed, with a database.

- Next.js project scaffold + Tailwind + shadcn
- Prisma schema (full v1.2, all tables) + migrate to a free Postgres instance
- Deploy pipeline to a free-tier host, confirm it builds and connects to DB
- Auth.js/Clerk wired up, but only basic email/password (skip verification email for now — stub it)

**Demo at end of sprint:** you can sign up, log in, log out. Nothing else works yet.

---

## Sprint 1 — Auth, complete

- Email verification flow (real email send)
- Password reset flow
- Guest/social login
- `User.role` + `isSuspended` fields exist (unused by UI yet, but in place)

**Demo:** full auth is production-ready.

---

## Sprint 2 — Rooms + Screen Share (the core loop, single feature)

This is the highest-risk, highest-value sprint — get it working before anything else, since every other feature assumes a working room.

- Room creation (host only, `mediaSource = SCREEN_SHARE`)
- WebRTC mesh connection between 2 users (skip 3–4 user mesh complexity for now)
- `getDisplayMedia()` capture + broadcast
- Basic room UI: Layout A structure (movie feed area, empty webcam/chat placeholders)
- Join via direct room link (skip buddy requests/matchmaking — just a shareable room ID for now)

**Demo:** two people can open a room and one can screen-share to the other. This is the "does the hard part even work" milestone — do not proceed until this is solid.

---

## Sprint 3 — Local Media + Room Scaling to 4

- Local file selection + `captureStream()` path
- Toggle between Screen Share / Local File mid-session (FR-2.5)
- Scale mesh WebRTC from 2 → 4 peers
- Room cap enforcement (FR-2.6/2.7)

**Demo:** 4 people in a room, either watching a screen-share or a local file together.

---

## Sprint 4 — Webcam + Chat (fills out Layout A)

- Webcam track added to existing peer connection (FR-5.1–5.4)
- Real-time text chat (FR-6.1–6.4) — Socket.IO + `Message` persistence
- Emoji reactions (FR-6.5)
- Movie-moment comments — local-media path only (FR-6.6)
- Full Layout A UI assembled (this is when the wireframe becomes real code)

**Demo:** the full "watch-along" experience — screen/file + faces + live chat — is feature-complete for a room you join by link.

---

## Sprint 5 — Buddy Requests + Contacts

- `Contact` model UI: search users, send/accept/decline contact requests
- Buddy request → room invite flow (FR-3.1–3.4)
- Notifications: `Notification` table + `notification:new` socket event + the notification bell/dropdown UI

**Demo:** you can invite a specific friend to watch, they get notified, they join.

---

## Sprint 6 — Matchmaking

- Matchmaking queue UI (filters: genre, language, camera pref, age range)
- Redis/BullMQ worker + scoring algorithm (FR-4.6)
- Auto-room creation on match, timeout handling

**Demo:** two strangers can get paired into a room without knowing each other beforehand. This is the last "core feature" sprint — after this, v1's feature set is functionally complete.

---

## Sprint 7 — Safety & Admin Panel

Public matchmaking without moderation is a real risk — don't skip or defer this past launch.

- Report filing (FR-4.x safety, `Report` model)
- Admin panel: dashboard, report queue + review actions, user suspend/unsuspend, `AdminActionLog`
- Suspension enforcement on login/room-join

**Demo:** you (as super admin) can see and act on reports; a suspended user is actually blocked.

---

## Sprint 8 — Gamification & Polish

- `WatchHistory`, `Review` (post-session rating)
- Badge catalog seeded (6 badges from FRS Section 9) + award triggers
- Badge-earned notifications
- General UI polish pass on Layout A

**Demo:** the full v1 feature set from the PRD, end to end.

---

## What's deliberately deferred past v1

- Persisted layout preference (`preferredLayout`) — still an open PRD item, not blocking
- SFU upgrade for >4 users — explicitly out of scope while on $0 budget
- Auto-suspend rules (currently manual-only per FR-8.3/8.4)
- Badge content beyond the initial 6 — easy to expand later since it's data, not code

---

## Fastest-path notes

- **Sprint 2 is the one to de-risk first.** If WebRTC mesh screen-sharing turns out harder than expected, everything after it shifts — worth spiking this before committing to the full sprint sequence above.
- Sprints 5 and 6 (buddy requests, matchmaking) are independent of each other and could be reordered or parallelized if you bring on help.
- Sprint 7 (safety/admin) is placed before general launch on purpose — not a "nice to have for later" given public stranger-matching is a core feature, not an add-on.
