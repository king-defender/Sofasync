const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const PORT = process.env.PORT || 3000;

// Live routing only: which socket a waiting user is currently connected on.
// The queue itself lives in Postgres (MatchmakingQueue rows) so it survives a
// server restart - this hash just tells a freshly-restarted process where to
// deliver a match once one is found.
const MATCHMAKING_SOCKETS_KEY = 'matchmaking:sockets';

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Socket.IO Connection Handler
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room
    socket.on('room:join', async ({ roomId, userId, displayName }) => {
      socket.join(roomId);
      socket.data = { roomId, userId, displayName };

      console.log(`User ${displayName} (${userId}) joined room ${roomId}`);

      // Broadcast to existing room members
      socket.to(roomId).emit('participant:joined', { userId, displayName });

      // Fetch past room chat history & reactions
      try {
        const messages = await prisma.message.findMany({
          where: { roomId },
          include: {
            sender: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            reactions: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        socket.emit('chat:history', messages);
      } catch (err) {
        console.error('Error fetching chat history:', err);
      }

      // Fetch playlist/queue state + host-lock setting for synced YouTube mode
      try {
        const [room, playlist] = await Promise.all([
          prisma.room.findUnique({ where: { id: roomId }, select: { hostControlsOnly: true, hostId: true } }),
          prisma.playlistItem.findMany({
            where: { roomId },
            include: { addedBy: { select: { id: true, displayName: true } } },
            orderBy: { order: 'asc' },
          }),
        ]);

        socket.emit('playlist:history', playlist);
        if (room) socket.emit('room:settings-update', { hostControlsOnly: room.hostControlsOnly });

        const nowPlaying = playlist.find((p) => p.status === 'PLAYING');
        if (nowPlaying) {
          socket.emit('youtube:load', { youtubeId: nowPlaying.youtubeId, title: nowPlaying.title });
        }
      } catch (err) {
        console.error('Error fetching playlist state:', err);
      }
    });

    // Only the host may act when the room is locked to host-only controls
    async function canControlPlayback(roomId, senderId) {
      const room = await prisma.room.findUnique({ where: { id: roomId }, select: { hostId: true, hostControlsOnly: true } });
      if (!room) return false;
      return !room.hostControlsOnly || room.hostId === senderId;
    }

    // Add a link to the room's queue (FR-2.x extension: synced YouTube/URL source)
    socket.on('playlist:add', async ({ roomId, senderId, youtubeId, title }) => {
      try {
        if (!youtubeId) return;
        const count = await prisma.playlistItem.count({ where: { roomId } });
        await prisma.playlistItem.create({
          data: { roomId, addedById: senderId, youtubeId, title: title || null, order: count },
        });

        const playlist = await prisma.playlistItem.findMany({
          where: { roomId },
          include: { addedBy: { select: { id: true, displayName: true } } },
          orderBy: { order: 'asc' },
        });
        io.to(roomId).emit('playlist:updated', playlist);
      } catch (err) {
        console.error('playlist:add error:', err);
      }
    });

    // Remove a queued item - the person who added it, or the host, may do this
    socket.on('playlist:remove', async ({ roomId, senderId, itemId }) => {
      try {
        const item = await prisma.playlistItem.findUnique({ where: { id: itemId } });
        if (!item || item.roomId !== roomId) return;

        const room = await prisma.room.findUnique({ where: { id: roomId }, select: { hostId: true } });
        if (item.addedById !== senderId && room?.hostId !== senderId) return;

        await prisma.playlistItem.delete({ where: { id: itemId } });
        const playlist = await prisma.playlistItem.findMany({
          where: { roomId },
          include: { addedBy: { select: { id: true, displayName: true } } },
          orderBy: { order: 'asc' },
        });
        io.to(roomId).emit('playlist:updated', playlist);
      } catch (err) {
        console.error('playlist:remove error:', err);
      }
    });

    // Load a specific queued item as "now playing" (host-gated when locked)
    socket.on('playlist:play', async ({ roomId, senderId, itemId }) => {
      try {
        if (!(await canControlPlayback(roomId, senderId))) return;

        const item = await prisma.playlistItem.findUnique({ where: { id: itemId } });
        if (!item || item.roomId !== roomId) return;

        await prisma.playlistItem.updateMany({
          where: { roomId, status: 'PLAYING' },
          data: { status: 'PLAYED' },
        });
        await prisma.playlistItem.update({ where: { id: itemId }, data: { status: 'PLAYING' } });

        io.to(roomId).emit('youtube:load', { youtubeId: item.youtubeId, title: item.title });

        const playlist = await prisma.playlistItem.findMany({
          where: { roomId },
          include: { addedBy: { select: { id: true, displayName: true } } },
          orderBy: { order: 'asc' },
        });
        io.to(roomId).emit('playlist:updated', playlist);
      } catch (err) {
        console.error('playlist:play error:', err);
      }
    });

    // Load a brand new link and play it immediately (skips the queue - for
    // "start watching this now" rather than "add for later")
    socket.on('youtube:load-and-play', async ({ roomId, senderId, youtubeId, title }) => {
      try {
        if (!youtubeId || !(await canControlPlayback(roomId, senderId))) return;

        await prisma.playlistItem.updateMany({
          where: { roomId, status: 'PLAYING' },
          data: { status: 'PLAYED' },
        });
        const count = await prisma.playlistItem.count({ where: { roomId } });
        const item = await prisma.playlistItem.create({
          data: { roomId, addedById: senderId, youtubeId, title: title || null, order: count, status: 'PLAYING' },
        });

        io.to(roomId).emit('youtube:load', { youtubeId: item.youtubeId, title: item.title });

        const playlist = await prisma.playlistItem.findMany({
          where: { roomId },
          include: { addedBy: { select: { id: true, displayName: true } } },
          orderBy: { order: 'asc' },
        });
        io.to(roomId).emit('playlist:updated', playlist);
      } catch (err) {
        console.error('youtube:load-and-play error:', err);
      }
    });

    // Play/pause/seek sync for the currently loaded YouTube video (host-gated when locked)
    socket.on('youtube:control', async ({ roomId, senderId, action, time }) => {
      try {
        if (!(await canControlPlayback(roomId, senderId))) return;
        socket.to(roomId).emit('youtube:control', { action, time });
      } catch (err) {
        console.error('youtube:control error:', err);
      }
    });

    // Host toggles whether only they can drive playback, or anyone can
    socket.on('room:settings-update', async ({ roomId, senderId, hostControlsOnly }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId }, select: { hostId: true } });
        if (!room || room.hostId !== senderId) return;

        await prisma.room.update({ where: { id: roomId }, data: { hostControlsOnly: Boolean(hostControlsOnly) } });
        io.to(roomId).emit('room:settings-update', { hostControlsOnly: Boolean(hostControlsOnly) });
      } catch (err) {
        console.error('room:settings-update error:', err);
      }
    });

    // Send Message (FR-6.1 - FR-6.4, FR-6.6)
    socket.on('message:send', async ({ roomId, senderId, content, videoTimestamp }) => {
      try {
        const message = await prisma.message.create({
          data: {
            roomId,
            senderId,
            content,
            videoTimestamp: videoTimestamp !== undefined ? videoTimestamp : null,
          },
          include: {
            sender: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            reactions: true,
          },
        });

        // Evaluate Chatterbox badge (100 messages)
        const msgCount = await prisma.message.count({ where: { senderId } });
        if (msgCount >= 100) {
          const badge = await prisma.badge.findUnique({ where: { name: 'Chatterbox' } });
          if (badge) {
            await prisma.userBadge.upsert({
              where: { userId_badgeId: { userId: senderId, badgeId: badge.id } },
              create: { userId: senderId, badgeId: badge.id },
              update: {},
            });
            io.emit('notification:new', {
              userId: senderId,
              type: 'BADGE_EARNED',
              payload: { badgeName: 'Chatterbox' },
            });
          }
        }

        io.to(roomId).emit('message:receive', message);
      } catch (err) {
        console.error('Error handling message:send:', err);
      }
    });

    // Emoji Reaction (FR-6.5)
    socket.on('message:react', async ({ messageId, emoji, userId }) => {
      try {
        const existing = await prisma.reaction.findUnique({
          where: {
            messageId_userId_emoji: { messageId, userId, emoji },
          },
        });

        let added = false;
        if (existing) {
          await prisma.reaction.delete({ where: { id: existing.id } });
          added = false;
        } else {
          await prisma.reaction.create({
            data: { messageId, userId, emoji },
          });
          added = true;
        }

        const room = socket.data?.roomId;
        if (room) {
          io.to(room).emit('message:reaction-updated', { messageId, emoji, userId, added });
        }
      } catch (err) {
        console.error('Error handling message:react:', err);
      }
    });

    // Media State Toggle (FR-5.1/5.2)
    socket.on('participant:media-state', async ({ roomId, userId, cameraOn, micOn }) => {
      try {
        await prisma.roomParticipant.updateMany({
          where: { roomId, userId, leftAt: null },
          data: { cameraOn, micOn },
        });

        socket.to(roomId).emit('participant:media-state', { userId, cameraOn, micOn });
      } catch (err) {
        console.error('Error updating media state:', err);
      }
    });

    // Host switches media source (FR-2.5)
    socket.on('room:media-source-changed', async ({ roomId, mediaSource }) => {
      try {
        await prisma.room.update({
          where: { id: roomId },
          data: { mediaSource },
        });

        io.to(roomId).emit('room:media-source-changed', { mediaSource });
      } catch (err) {
        console.error('Error updating media source:', err);
      }
    });

    // Movie stream start / stop events
    socket.on('room:movie-stream-started', ({ roomId, streamType }) => {
      socket.to(roomId).emit('room:movie-stream-started', { streamType, hostId: socket.data?.userId });
    });

    socket.on('room:movie-stream-stopped', ({ roomId }) => {
      io.to(roomId).emit('room:movie-stream-stopped');
    });

    // WebRTC Signaling (mesh topology)
    socket.on('webrtc:offer', ({ targetUserId, sdp, senderUserId, isMovieTrack }) => {
      socket.to(socket.data?.roomId).emit('webrtc:offer', { targetUserId, sdp, senderUserId, isMovieTrack });
    });

    socket.on('webrtc:answer', ({ targetUserId, sdp, senderUserId }) => {
      socket.to(socket.data?.roomId).emit('webrtc:answer', { targetUserId, sdp, senderUserId });
    });

    socket.on('webrtc:ice-candidate', ({ targetUserId, candidate, senderUserId }) => {
      socket.to(socket.data?.roomId).emit('webrtc:ice-candidate', { targetUserId, candidate, senderUserId });
    });

    // Plain passthrough - carries whatever fields the sender includes (e.g.
    // trackId/trackKind so peers can tell the movie feed from a webcam track;
    // see RoomClient.tsx's movieTrackIds).
    socket.on('webrtc:track-added', (payload) => {
      socket.to(socket.data?.roomId).emit('webrtc:track-added', payload);
    });

    // Matchmaking Join Queue (FR-4.1 - FR-4.6)
    socket.on('matchmaking:join', async ({ userId, filters }) => {
      try {
        const settings = await prisma.appSetting.upsert({
          where: { id: 'singleton' },
          update: {},
          create: { id: 'singleton' },
        });
        if (!settings.matchmakingEnabled) {
          socket.emit('matchmaking:disabled');
          return;
        }

        const entry = await prisma.matchmakingQueue.create({
          data: {
            userId,
            genre: filters?.genre || null,
            language: filters?.language || null,
            cameraPref: filters?.cameraPref !== undefined ? filters.cameraPref : null,
            ageRangeMin: filters?.ageRangeMin ? parseInt(filters.ageRangeMin) : null,
            ageRangeMax: filters?.ageRangeMax ? parseInt(filters.ageRangeMax) : null,
            status: 'WAITING',
          },
        });

        socket.data.queueId = entry.id;
        socket.emit('matchmaking:joined-queue', { queueId: entry.id });

        await redis.hset(MATCHMAKING_SOCKETS_KEY, userId, socket.id);
        await runMatchmakingWorker(io);
      } catch (err) {
        console.error('Matchmaking join error:', err);
      }
    });

    // Leave Matchmaking Queue (FR-4.4)
    socket.on('matchmaking:leave', async ({ queueId, userId }) => {
      try {
        if (queueId) {
          await prisma.matchmakingQueue.update({
            where: { id: queueId },
            data: { status: 'CANCELLED' },
          });
        }
        await redis.hdel(MATCHMAKING_SOCKETS_KEY, userId);
        socket.emit('matchmaking:left');
      } catch (err) {
        console.error('Matchmaking leave error:', err);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const { roomId, userId, queueId } = socket.data || {};
      if (roomId && userId) {
        console.log(`User ${userId} disconnected from room ${roomId}`);
        socket.to(roomId).emit('participant:left', { userId });

        try {
          await prisma.roomParticipant.updateMany({
            where: { roomId, userId, leftAt: null },
            data: { leftAt: new Date() },
          });

          const activeCount = await prisma.roomParticipant.count({
            where: { roomId, leftAt: null },
          });

          if (activeCount === 0) {
            await prisma.room.update({
              where: { id: roomId },
              data: { status: 'CLOSED', closedAt: new Date() },
            });
            io.to(roomId).emit('room:closed', { reason: 'All participants left' });
          }
        } catch (err) {
          console.error('Error processing disconnect:', err);
        }
      }

      if (userId) {
        try {
          await redis.hdel(MATCHMAKING_SOCKETS_KEY, userId);
          if (queueId) {
            await prisma.matchmakingQueue.updateMany({
              where: { id: queueId, status: 'WAITING' },
              data: { status: 'CANCELLED' },
            });
          }
        } catch (err) {
          console.error('Error cleaning up matchmaking state on disconnect:', err);
        }
      }
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`> SofaSync Server ready on http://localhost:${PORT}`);
  });
});

// Automated Matchmaking Worker (FR-4.6 scoring logic).
// Reads waiting entries from Postgres (not an in-memory array) so the queue
// survives a server restart - anyone still WAITING in the DB is matchable
// against the next person who joins, even if the process was restarted since
// they queued.
async function runMatchmakingWorker(io) {
  const waiting = await prisma.matchmakingQueue.findMany({
    where: { status: 'WAITING' },
    orderBy: { createdAt: 'asc' },
  });

  if (waiting.length < 2) return;

  for (let i = 0; i < waiting.length; i++) {
    for (let j = i + 1; j < waiting.length; j++) {
      const u1 = waiting[i];
      const u2 = waiting[j];
      if (u1.userId === u2.userId) continue;

      let score = 0;
      if (u1.genre === u2.genre && u1.genre) score += 3;
      else if (!u1.genre || !u2.genre) score += 1;

      if (u1.language === u2.language && u1.language) score += 3;
      else if (!u1.language || !u2.language) score += 1;

      if (u1.cameraPref === u2.cameraPref && u1.cameraPref !== null) score += 2;
      else score += 1;

      if (score >= 4) {
        try {
          // Claim both rows atomically-ish: only proceed if they're still WAITING,
          // so two concurrent workers can't double-match the same person.
          const claimed = await prisma.matchmakingQueue.updateMany({
            where: { id: { in: [u1.id, u2.id] }, status: 'WAITING' },
            data: { status: 'MATCHED' },
          });
          if (claimed.count !== 2) continue;

          const room = await prisma.room.create({
            data: {
              hostId: u1.userId,
              mediaSource: 'SCREEN_SHARE',
              status: 'ACTIVE',
            },
          });

          await prisma.roomParticipant.createMany({
            data: [
              { roomId: room.id, userId: u1.userId },
              { roomId: room.id, userId: u2.userId },
            ],
          });

          await prisma.matchmakingQueue.updateMany({
            where: { id: { in: [u1.id, u2.id] } },
            data: { matchedRoomId: room.id },
          });

          const iceBadge = await prisma.badge.findUnique({ where: { name: 'Breaking the ice' } });
          if (iceBadge) {
            await prisma.userBadge.createMany({
              data: [
                { userId: u1.userId, badgeId: iceBadge.id },
                { userId: u2.userId, badgeId: iceBadge.id },
              ],
              skipDuplicates: true,
            });
          }

          const [socket1, socket2] = await redis.hmget(MATCHMAKING_SOCKETS_KEY, u1.userId, u2.userId);
          if (socket1) io.to(socket1).emit('matchmaking:matched', { roomId: room.id, buddyId: u2.userId });
          if (socket2) io.to(socket2).emit('matchmaking:matched', { roomId: room.id, buddyId: u1.userId });
          await redis.hdel(MATCHMAKING_SOCKETS_KEY, u1.userId, u2.userId);

          return;
        } catch (err) {
          console.error('Match creation error:', err);
        }
      }
    }
  }
}
