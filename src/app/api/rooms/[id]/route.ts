import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roomId = params.id;
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        host: { select: { id: true, displayName: true, avatarUrl: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roomId = params.id;
    const room = await prisma.room.findUnique({ where: { id: roomId } });

    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if (room.hostId !== auth.userId && auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only host or admin can close room' }, { status: 403 });
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    return NextResponse.json({ room: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to close room' }, { status: 500 });
  }
}
