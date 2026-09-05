import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // FR-8.4: a session issued before a suspension must not still be able to create rooms.
    const authUser = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!authUser || authUser.isSuspended) {
      return NextResponse.json({ error: 'Account suspended.' }, { status: 403 });
    }

    const { mediaSource = 'SCREEN_SHARE', isPublic = false } = await req.json().catch(() => ({}));
    const validSources = ['SCREEN_SHARE', 'LOCAL_FILE', 'YOUTUBE'];
    const { publicLobbyEnabled } = await getAppSettings();

    // Create room
    const room = await prisma.room.create({
      data: {
        hostId: auth.userId,
        mediaSource: validSources.includes(mediaSource) ? mediaSource : 'SCREEN_SHARE',
        status: 'ACTIVE',
        isPublic: publicLobbyEnabled ? Boolean(isPublic) : false,
      },
    });

    // Add host as first participant
    await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId: auth.userId,
        cameraOn: true,
        micOn: true,
      },
    });

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Room creation error:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope');

    if (scope === 'public') {
      const { publicLobbyEnabled } = await getAppSettings();
      if (!publicLobbyEnabled) {
        return NextResponse.json({ rooms: [], lobbyDisabled: true });
      }
    }

    const where = scope === 'public' ? { status: 'ACTIVE' as const, isPublic: true } : { status: 'ACTIVE' as const };

    const rooms = await prisma.room.findMany({
      where,
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true } },
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}
