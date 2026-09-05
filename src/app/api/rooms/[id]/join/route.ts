import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FR-8.4: a session issued before a suspension must not still be able to join rooms.
    const authUser = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!authUser || authUser.isSuspended) {
      return NextResponse.json({ error: 'Account suspended.' }, { status: 403 });
    }

    const roomId = params.id;
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room || room.status === 'CLOSED') {
      return NextResponse.json({ error: 'Room is no longer active' }, { status: 404 });
    }

    // Check active participants count (FR-2.6/2.7: cap at 4 users)
    const activeParticipants = await prisma.roomParticipant.count({
      where: { roomId, leftAt: null },
    });

    const existingParticipant = await prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: auth.userId } },
    });

    if (!existingParticipant && activeParticipants >= 4) {
      return NextResponse.json(
        { error: 'Room is full (maximum 4 participants supported)' },
        { status: 403 }
      );
    }

    // Join or update participant state
    await prisma.roomParticipant.upsert({
      where: { roomId_userId: { roomId, userId: auth.userId } },
      update: { leftAt: null, cameraOn: true, micOn: true },
      create: {
        roomId,
        userId: auth.userId,
        cameraOn: true,
        micOn: true,
      },
    });

    // Check First watch badge
    const sessionCount = await prisma.roomParticipant.count({
      where: { userId: auth.userId },
    });

    if (sessionCount === 1) {
      const firstWatchBadge = await prisma.badge.findUnique({ where: { name: 'First watch' } });
      if (firstWatchBadge) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: auth.userId, badgeId: firstWatchBadge.id } },
          create: { userId: auth.userId, badgeId: firstWatchBadge.id },
          update: {},
        });
      }
    }

    return NextResponse.json({ success: true, roomId });
  } catch (error) {
    console.error('Join room error:', error);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
