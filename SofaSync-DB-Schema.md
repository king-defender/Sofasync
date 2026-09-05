# Sofa Sync — Database Schema (v1.0)

Prisma schema, PostgreSQL. Derived from FRS v1.0.

```prisma
// schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ---------- Enums ----------

enum MediaSource {
  SCREEN_SHARE
  LOCAL_FILE
}

enum RoomStatus {
  ACTIVE
  CLOSED
}

enum BuddyRequestStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
}

enum QueueStatus {
  WAITING
  MATCHED
  CANCELLED
}

enum ContactStatus {
  PENDING
  ACCEPTED
  BLOCKED
}

enum ReportReason {
  HARASSMENT
  INAPPROPRIATE_CONTENT
  SPAM
  OTHER
}

enum ReportStatus {
  OPEN
  REVIEWED
  ACTIONED
  DISMISSED
}

enum NotificationType {
  BUDDY_REQUEST
  MATCH_FOUND
  ROOM_INVITE_ACCEPTED
  BADGE_EARNED
  SYSTEM
}

enum Role {
  USER
  SUPER_ADMIN
}

// ---------- Core tables ----------

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String?
  isVerified    Boolean  @default(false)
  isGuest       Boolean  @default(false)
  displayName   String
  avatarUrl     String?
  age           Int?
  role          Role     @default(USER)
  isSuspended   Boolean  @default(false)
  createdAt     DateTime @default(now())

  hostedRooms       Room[]              @relation("HostedRooms")
  roomParticipants  RoomParticipant[]
  sentRequests      BuddyRequest[]      @relation("SentRequests")
  receivedRequests  BuddyRequest[]      @relation("ReceivedRequests")
  queueEntries      MatchmakingQueue[]
  messages          Message[]
  contactsInitiated Contact[]           @relation("ContactInitiator")
  contactsReceived  Contact[]           @relation("ContactReceiver")
  reportsFiled      Report[]            @relation("ReportsFiled")
  reportsAgainst    Report[]            @relation("ReportsAgainst")
  reportsReviewed   Report[]            @relation("ReportsReviewed")
  notifications     Notification[]
  watchHistory      WatchHistory[]
  reviews           Review[]
  badges            UserBadge[]
  refreshTokens     RefreshToken[]
  verificationToken EmailVerificationToken?
  resetTokens       PasswordResetToken[]
  adminActionLogs   AdminActionLog[]

  @@index([email])
}

model Room {
  id          String      @id @default(cuid())
  hostId      String
  host        User        @relation("HostedRooms", fields: [hostId], references: [id])
  mediaSource MediaSource
  status      RoomStatus  @default(ACTIVE)
  createdAt   DateTime    @default(now())
  closedAt    DateTime?

  participants RoomParticipant[]
  messages     Message[]
  buddyRequest BuddyRequest?
  matchOrigin  MatchmakingQueue[]
  reports      Report[]
  reviews      Review[]
  watchHistory WatchHistory[]

  @@index([status])
}

model RoomParticipant {
  id         String    @id @default(cuid())
  roomId     String
  room       Room      @relation(fields: [roomId], references: [id])
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  cameraOn   Boolean   @default(true)
  micOn      Boolean   @default(true)
  joinedAt   DateTime  @default(now())
  leftAt     DateTime?

  @@unique([roomId, userId])
  @@index([roomId])
}

model BuddyRequest {
  id          String              @id @default(cuid())
  senderId    String
  sender      User                @relation("SentRequests", fields: [senderId], references: [id])
  receiverId  String
  receiver    User                @relation("ReceivedRequests", fields: [receiverId], references: [id])
  roomId      String?             @unique
  room        Room?               @relation(fields: [roomId], references: [id])
  status      BuddyRequestStatus  @default(PENDING)
  createdAt   DateTime            @default(now())
  expiresAt   DateTime

  @@index([receiverId, status])
}

model MatchmakingQueue {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  genre          String?
  language       String?
  cameraPref     Boolean?
  ageRangeMin    Int?
  ageRangeMax    Int?
  status         QueueStatus  @default(WAITING)
  matchedRoomId  String?
  matchedRoom    Room?        @relation(fields: [matchedRoomId], references: [id])
  createdAt      DateTime     @default(now())

  @@index([status, genre, language])
}

model Message {
  id             String     @id @default(cuid())
  roomId         String
  room           Room       @relation(fields: [roomId], references: [id])
  senderId       String
  sender         User       @relation(fields: [senderId], references: [id])
  content        String
  videoTimestamp Int?       // seconds into playback; local-media path only (FR-6.6)
  createdAt      DateTime   @default(now())

  reactions      Reaction[]

  @@index([roomId, createdAt])
}

model Reaction {
  id        String   @id @default(cuid())
  messageId String
  message   Message  @relation(fields: [messageId], references: [id])
  userId    String
  emoji     String
  createdAt DateTime @default(now())

  @@unique([messageId, userId, emoji])
}

// ---------- Admin panel accountability (FR-8.8) ----------

model AdminActionLog {
  id         String   @id @default(cuid())
  adminId    String
  admin      User     @relation(fields: [adminId], references: [id])
  action     String   // e.g. "report_actioned", "user_suspended", "badge_created"
  targetType String   // e.g. "Report", "User", "Badge"
  targetId   String
  details    Json?
  createdAt  DateTime @default(now())

  @@index([adminId, createdAt])
}

// ---------- Friends / contacts (backs FR-3.1 "existing contact") ----------

model Contact {
  id           String        @id @default(cuid())
  initiatorId  String
  initiator    User          @relation("ContactInitiator", fields: [initiatorId], references: [id])
  receiverId   String
  receiver     User          @relation("ContactReceiver", fields: [receiverId], references: [id])
  status       ContactStatus @default(PENDING)
  createdAt    DateTime      @default(now())

  @@unique([initiatorId, receiverId])
  @@index([receiverId, status])
}

// ---------- Safety / moderation (needed for public stranger matchmaking) ----------

model Report {
  id           String        @id @default(cuid())
  reporterId   String
  reporter     User          @relation("ReportsFiled", fields: [reporterId], references: [id])
  reportedId   String
  reported     User          @relation("ReportsAgainst", fields: [reportedId], references: [id])
  roomId       String?
  room         Room?         @relation(fields: [roomId], references: [id])
  reason       ReportReason
  details      String?
  status       ReportStatus  @default(OPEN)
  reviewedById String?
  reviewedBy   User?         @relation("ReportsReviewed", fields: [reviewedById], references: [id])
  resolutionNote String?
  reviewedAt   DateTime?
  createdAt    DateTime      @default(now())

  @@index([reportedId, status])
}

// ---------- Notifications (backs FR-3.2, FR-4.3) ----------

model Notification {
  id        String            @id @default(cuid())
  userId    String
  user      User              @relation(fields: [userId], references: [id])
  type      NotificationType
  payload   Json
  isRead    Boolean           @default(false)
  createdAt DateTime          @default(now())

  @@index([userId, isRead])
}

// ---------- Auth token management ----------

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tokenHash String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())

  @@index([userId])
}

model EmailVerificationToken {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId])
}

// ---------- Watch history, reviews, gamification (original vision, deferred until now) ----------

model WatchHistory {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id])
  watchedWith String[] // participant user IDs, denormalized for quick history display
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
}

model Review {
  id        String   @id @default(cuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id])
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  rating    Int      // 1-5, watch-buddy experience rating
  comment   String?
  createdAt DateTime @default(now())

  @@index([roomId])
}

model Badge {
  id          String      @id @default(cuid())
  name        String      @unique
  description String
  iconUrl     String?
  users       UserBadge[]
}

model UserBadge {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  badgeId   String
  badge     Badge    @relation(fields: [badgeId], references: [id])
  earnedAt  DateTime @default(now())

  @@unique([userId, badgeId])
}
```

---

## Design notes (mapped to FRS)

| Table | Covers | Notes |
|---|---|---|
| `User` | FR-1.x | `passwordHash` nullable for guest/social-only accounts. `age` optional, used for matchmaking filter (FR-4.1). |
| `Room` | FR-2.x, FR-7.x | `mediaSource` tracks which mode is active; `status` + `closedAt` support the auto-close-after-timeout rule (FR-7.2). |
| `RoomParticipant` | FR-2.6/2.7, FR-5.1/5.2 | Join table with camera/mic state per participant; `leftAt` null while active — used to enforce the 4-user cap (count rows where `leftAt IS NULL`). |
| `BuddyRequest` | FR-3.x | `expiresAt` supports the 5-min timeout (FR-3.4); `roomId` set once accepted. |
| `MatchmakingQueue` | FR-4.x | Filters stored as nullable columns for "best-effort" matching (FR-4.6) — a matching worker queries `WAITING` rows and scores compatibility rather than requiring exact match. |
| `Message` | FR-6.1–6.4 | Plain text only per FRS v1.0 scope; `FR-6.5`/`FR-6.6` (emoji, timestamp-linked comments) deferred, would need a `reactions` table and a `videoTimestamp` column respectively — not added yet. |

## Tables added in this revision (v1.1) — filling gaps from a full-system view

| Table | Why it was missing / needed |
|---|---|
| `Contact` | FR-3.1 says "select an existing contact" — v1.0 had no table actually storing friend relationships. |
| `Report` | Public stranger matchmaking (FR-4.x) needs a way to flag abuse/harassment — not in the FRS explicitly, but required for any public platform with stranger pairing. |
| `Notification` | FR-3.2 ("real-time notification") and FR-4.3 ("both users notified") referenced notifications with no backing table. |
| `RefreshToken`, `EmailVerificationToken`, `PasswordResetToken` | FR-1.2/1.4 (verification email, password reset) need tokens stored somewhere to validate against — v1.0 only had a boolean flag. |
| `WatchHistory`, `Review`, `Badge`/`UserBadge` | From the original product vision (watch history, reviews, gamification/badges) — noted early on but never made it into a schema until now. |

## Open items carried forward

- Matchmaking scoring logic (FR-4.6) lives in application code, not the schema — the Redis/BullMQ worker queries `MatchmakingQueue` and scores compatibility. Spec that algorithm explicitly in the API step.
- Report moderation workflow (who reviews `Report` rows, what "actioned" does — e.g. auto-suspend after N reports) isn't decided yet. Fine to leave manual for v1, but flag before public launch.
- Badges are unseeded — actual badge definitions ("Watched 10 movies together", "First stranger match", etc.) need a content pass, not urgent for v1 build.

---

## Tables/fields added in this revision (v1.2)

| Change | Why |
|---|---|
| `Role` enum + `User.role` | Super-admin moderation (chosen approach: you personally manage reports). |
| `User.isSuspended` | Backs FR-8.4 — admin can suspend a user; login/room-join checks this flag. |
| `Report.reviewedById`, `resolutionNote`, `reviewedAt` | Backs FR-8.3 — admin needs to record who reviewed a report and why. |
| `AdminActionLog` | Backs FR-8.8 — accountability trail for admin actions (suspensions, report decisions, badge changes). |
| `Message.videoTimestamp` | Backs FR-6.6 — movie-moment-linked comments, local-media path only. |
| `Reaction` model | Backs FR-6.5 — emoji reactions on messages, now core (not stretch). |

---

## Next Step

Sprint plan / build order — fastest path to a working v1.
