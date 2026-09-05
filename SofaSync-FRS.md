# Sofa Sync — Functional Requirements Specification (v1.0)

Derived from PRD v1.1. Each requirement is tagged with an ID (FR-#), used later in API spec and test cases.

**Update (v1.1):** Chat scope now includes emoji reactions and movie-moment-linked comments in v1 — no longer deferred. Movie-moment comments only work on the local-media path (screen-share has no exposed playback timestamp, per PRD Section 8).

---

## 1. Authentication (FR-1.x)

| ID | Requirement |
|---|---|
| FR-1.1 | User can sign up with email + password. |
| FR-1.2 | System sends a verification email; account is unverified until confirmed. |
| FR-1.3 | User can log in with verified email + password. |
| FR-1.4 | User can request a password reset via email link. |
| FR-1.5 | User can optionally sign up/log in via social provider or as a guest. |
| FR-1.6 | Session persists via secure token (JWT or session cookie), refreshed on activity. |

## 2. Room Creation & Media Source (FR-2.x)

| ID | Requirement |
|---|---|
| FR-2.1 | Logged-in user can create a room and becomes its host. |
| FR-2.2 | Host chooses media source at room creation or after: **Screen Share** or **Local File**. |
| FR-2.3 | Screen Share: host grants `getDisplayMedia()` permission; captured track is published to all peers in the room. |
| FR-2.4 | Local File: host selects a video file via file picker; file plays in a local `<video>` element; `captureStream()` output is published to all peers. |
| FR-2.5 | Host can switch media source mid-session without ending the room. |
| FR-2.6 | Room supports a maximum of 4 concurrent participants (mesh WebRTC limit). |
| FR-2.7 | System rejects a 5th join attempt with a clear "room full" message. |

## 3. Buddy Request — Known Contact (FR-3.x)

| ID | Requirement |
|---|---|
| FR-3.1 | User can search/select an existing contact and send a room invite. |
| FR-3.2 | Invited user receives a real-time notification (in-app; email optional fallback). |
| FR-3.3 | Invited user can Accept (joins room) or Decline (invite closes). |
| FR-3.4 | Pending invites expire after a configurable timeout (default 5 min). |

## 4. Matchmaking — Unknown Buddy (FR-4.x)

| ID | Requirement |
|---|---|
| FR-4.1 | User can enter a matchmaking queue with optional filters: genre, language, camera on/off preference, age range. |
| FR-4.2 | Matching worker pairs two queued users whose filters are compatible. |
| FR-4.3 | On match, a room is auto-created and both users are notified/redirected into it. |
| FR-4.4 | User can leave the queue before being matched. |
| FR-4.5 | If no match found within a timeout (default 3 min), user is notified and offered to retry with relaxed filters. |
| FR-4.6 | Filters use best-effort matching (exact + adjacent, e.g. similar genre) rather than requiring exact equality on all fields — avoids empty queues from over-filtering. |

## 5. Video Call — Webcam (FR-5.x)

| ID | Requirement |
|---|---|
| FR-5.1 | Each participant can enable/disable their webcam independently at any time. |
| FR-5.2 | Each participant can enable/disable their microphone independently at any time. |
| FR-5.3 | Webcam track is published as a second track on the same peer connection as the movie feed. |
| FR-5.4 | UI shows a placeholder (avatar/initials) for any participant with camera off. |

## 6. Real-Time Chat (FR-6.x)

| ID | Requirement |
|---|---|
| FR-6.1 | Any room participant can send a plain-text message visible to all participants in real time. |
| FR-6.2 | Messages are persisted to the database, tied to `room_id` + `sender_id` + timestamp. |
| FR-6.3 | On reconnect/reload, chat history for the active room reloads from storage. |
| FR-6.4 | Chat is scoped per-room — no cross-room visibility. |
| FR-6.5 | Any participant can react to a message with an emoji (from a fixed set). Reactions are visible to all participants in real time. |
| FR-6.6 | On the local-media path only, a participant can attach the current playback timestamp to a comment (e.g. "🔥 at 32:10"), clickable to jump to that point on replay/history view. Not available on the screen-share path. |

## 7. Room Lifecycle (FR-7.x)

| ID | Requirement |
|---|---|
| FR-7.1 | Room persists as long as at least one participant remains connected. |
| FR-7.2 | Room auto-closes N minutes (default 10) after the last participant disconnects. |
| FR-7.3 | Any participant can leave the room without ending it for others. |
| FR-7.4 | Host leaving does not force-close the room — remaining peers stay connected (matters for local-media path where host was the media source: playback stops, room stays open for chat/video). |

## 8. Admin Panel (FR-8.x)

| ID | Requirement |
|---|---|
| FR-8.1 | A user with `SUPER_ADMIN` role can access `/admin`; all other roles are redirected/denied. |
| FR-8.2 | Admin can view all reports (filterable by status/reason), regardless of who filed them. |
| FR-8.3 | Admin can update a report's status (Reviewed / Actioned / Dismissed) and add a resolution note. |
| FR-8.4 | Admin can suspend or unsuspend a user's account. A suspended user cannot log in (FR-1.3 blocked) or join/create rooms. |
| FR-8.5 | Admin can search/view any user's profile, including their report history (filed and received) and review history. |
| FR-8.6 | Admin can view a live dashboard: active rooms, users in matchmaking queue, total reports open. |
| FR-8.7 | Admin can create, edit, and deactivate badge definitions (name, description, trigger type). |
| FR-8.8 | Admin actions (status changes, suspensions) are logged with admin ID and timestamp for accountability. |

## 9. Badges (FR-9.x)

| ID | Requirement |
|---|---|
| FR-9.1 | System awards a badge to a user automatically when a defined trigger condition is met (see badge catalog below). |
| FR-9.2 | User sees a notification (via `notification:new`, type `BADGE_EARNED`) when a badge is earned. |
| FR-9.3 | User can view all earned badges on their profile. |

### Initial badge catalog (v1)

| Badge | Trigger |
|---|---|
| First watch | Completed first room session |
| Movie marathon | 10 completed sessions |
| Social butterfly | 5 different watch buddies (unique `watchedWith` users) |
| Breaking the ice | First successful stranger match |
| Chatterbox | 100 chat messages sent |
| Regular | 3 sessions with the same buddy in one week |

---

## Cross-Feature Constraints (from PRD Section 8)

- Max 4 participants per room (mesh WebRTC cost).
- Screen-share system audio unsupported/limited on Safari and most mobile browsers — degrade gracefully (video-only, or prompt "enable audio manually" where supported), don't fail the whole share.
- Local-media path is the only one where playback-timestamp-linked features (FR-6.6) are possible.

---

## Next Step

DB schema — tables implied by this FRS: `users`, `rooms`, `room_participants`, `buddy_requests`, `matchmaking_queue`, `messages`.
