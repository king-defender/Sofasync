# Sofa Sync — API & Socket Event Spec (v1.0)

Built on DB Schema v1.1. REST for CRUD/state changes, Socket.IO for realtime events, WebRTC for media/signaling.

---

## 1. REST API

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account (email, password, displayName). Sends verification email. |
| POST | `/api/auth/verify-email` | Consume `EmailVerificationToken`, mark user verified. |
| POST | `/api/auth/login` | Email+password login. Returns access token + sets `RefreshToken`. |
| POST | `/api/auth/logout` | Revoke current `RefreshToken`. |
| POST | `/api/auth/refresh` | Exchange valid refresh token for new access token. |
| POST | `/api/auth/forgot-password` | Create `PasswordResetToken`, email reset link. |
| POST | `/api/auth/reset-password` | Consume token, set new password. |
| GET | `/api/auth/oauth/:provider` | Social login redirect (guest login is a client-side flag, no server route needed). |

### Users & Contacts

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/me` | Current user profile. |
| PATCH | `/api/users/me` | Update profile (displayName, avatar, age). |
| GET | `/api/users/search?q=` | Search users to add as contact. |
| POST | `/api/contacts` | Send contact request (`receiverId`). |
| PATCH | `/api/contacts/:id` | Accept / decline / block a contact request. |
| GET | `/api/contacts` | List accepted contacts. |

### Rooms

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/rooms` | Create room (`mediaSource`). Caller becomes host. |
| GET | `/api/rooms/:id` | Room details + active participants. |
| PATCH | `/api/rooms/:id/media-source` | Host switches Screen Share ↔ Local File (FR-2.5). |
| POST | `/api/rooms/:id/join` | Join as participant (enforces 4-user cap, FR-2.6/2.7). |
| POST | `/api/rooms/:id/leave` | Leave room (sets `leftAt`). |
| DELETE | `/api/rooms/:id` | Close room. |

### Buddy Requests (known contact)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/buddy-requests` | Send invite (`receiverId`, optional `roomId` or auto-create). |
| PATCH | `/api/buddy-requests/:id` | Accept / decline. Accept joins the room. |
| GET | `/api/buddy-requests?status=pending` | List pending invites for current user. |

### Matchmaking

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/matchmaking/queue` | Join queue with filters (genre, language, cameraPref, ageRange). |
| DELETE | `/api/matchmaking/queue` | Leave queue (FR-4.4). |
| GET | `/api/matchmaking/status` | Poll current queue status (fallback if socket disconnects). |

### Reports & Reviews

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/reports` | File a report (`reportedId`, `roomId`, `reason`, `details`). |
| POST | `/api/rooms/:id/review` | Post-session rating for the room/buddy (1–5 + comment). |
| GET | `/api/users/:id/reviews` | View a user's received reviews (public profile). |

### Admin Panel (SUPER_ADMIN role only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/dashboard` | Live counts: active rooms, users in matchmaking queue, open reports (FR-8.6). |
| GET | `/api/admin/reports` | List all reports, filterable by status/reason (FR-8.2). |
| PATCH | `/api/admin/reports/:id` | Update status, add `resolutionNote`; sets `reviewedById`/`reviewedAt` (FR-8.3). Writes an `AdminActionLog` entry. |
| GET | `/api/admin/users/:id` | Full profile view: report history (filed + received), reviews, watch history (FR-8.5). |
| PATCH | `/api/admin/users/:id/suspend` | Suspend a user (`isSuspended = true`). Writes an `AdminActionLog` entry (FR-8.4). |
| PATCH | `/api/admin/users/:id/unsuspend` | Reverse a suspension. |
| GET | `/api/admin/badges` | List all badge definitions. |
| POST | `/api/admin/badges` | Create a badge (name, description, trigger type) (FR-8.7). |
| PATCH | `/api/admin/badges/:id` | Edit or deactivate a badge. |
| GET | `/api/admin/action-log` | View the admin action audit trail (FR-8.8). |

### Notifications

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/notifications` | List current user's notifications. |
| PATCH | `/api/notifications/:id/read` | Mark as read. |

### Watch History & Badges

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/me/watch-history` | Past sessions. |
| GET | `/api/users/me/badges` | Earned badges. |

---

## 2. Socket.IO Events

Namespace: `/rooms/:roomId` — client joins on room entry (after REST `join` succeeds).

### Chat (FR-6.x)

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `message:send` | client → server | `{ content, videoTimestamp? }` | Server persists to `Message`. `videoTimestamp` only accepted/shown on local-media rooms (FR-6.6). |
| `message:receive` | server → clients | `{ id, senderId, content, videoTimestamp?, createdAt }` | Broadcast to all room members. |
| `chat:history` | server → client | `Message[]` (with `reactions`) | Sent once on room join (FR-6.3). |
| `message:react` | client → server | `{ messageId, emoji }` | Adds/toggles a `Reaction` row (FR-6.5). |
| `message:reaction-updated` | server → clients | `{ messageId, emoji, userId, added }` | Broadcast so all clients update reaction counts live. |

### Presence & Participant State

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `participant:joined` | server → clients | `{ userId, displayName }` | On successful join. |
| `participant:left` | server → clients | `{ userId }` | On leave/disconnect. |
| `participant:media-state` | client → server → clients | `{ cameraOn, micOn }` | Updates `RoomParticipant`, relays to peers (FR-5.1/5.2). |
| `room:media-source-changed` | server → clients | `{ mediaSource }` | Host switched source (FR-2.5); clients re-negotiate WebRTC track. |
| `room:closed` | server → clients | `{ reason }` | Room auto-closed (FR-7.2) or manually ended. |

### WebRTC Signaling (mesh, ≤4 peers)

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `webrtc:offer` | client → server → target client | `{ targetUserId, sdp }` | Relayed peer-to-peer via server. |
| `webrtc:answer` | client → server → target client | `{ targetUserId, sdp }` | |
| `webrtc:ice-candidate` | client → server → target client | `{ targetUserId, candidate }` | |
| `webrtc:track-added` | client → server → clients | `{ userId, trackKind }` | Informational, helps UI show "sharing screen" badges. |

### Matchmaking

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `matchmaking:joined-queue` | server → client | `{ queueId }` | Ack on REST queue join. |
| `matchmaking:matched` | server → client | `{ roomId, buddyId }` | Both matched users get this simultaneously (FR-4.3). |
| `matchmaking:timeout` | server → client | `{ }` | No match found within timeout (FR-4.5). |

### Notifications (global namespace, not room-scoped)

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `notification:new` | server → client | `{ type, payload }` | Buddy request received, match found, badge earned, etc. |

---

## 3. Matchmaking Scoring Logic (FR-4.6 detail)

Worker (BullMQ) runs on queue changes:

1. Pull all `WAITING` entries.
2. For each pair, compute a compatibility score:
   - `genre` exact match: +3, no preference (null) on either side: +1, mismatch: +0
   - `language` exact match: +3, null: +1, mismatch: +0
   - `cameraPref` match: +2, null: +1, mismatch: +0
   - `ageRangeMin/Max` overlap: +2, no range set: +1, no overlap: +0
3. Pair the two highest-scoring `WAITING` users above a minimum threshold (e.g. 4/10).
4. If no pair clears the threshold before the per-user timeout (FR-4.5), emit `matchmaking:timeout` and offer filter relaxation.

---

## 4. Auth & Security Notes

- Access tokens short-lived (15 min); `RefreshToken` rotated on use, revoked on logout.
- All WebRTC signaling relayed through the authenticated socket connection — never expose peer IPs directly without consent (mesh WebRTC does expose IPs to peers by nature; note this in privacy copy).
- Rate-limit `POST /api/reports` and `message:send` to prevent abuse/spam.
- `POST /api/auth/login` and room-join endpoints (`POST /api/rooms/:id/join`, matchmaking queue join) check `User.isSuspended` and reject with a clear "account suspended" error if true (FR-8.4).

---

## Next Step

Sprint plan / build order — fastest path to a working v1.
