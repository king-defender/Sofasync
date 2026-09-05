import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roomId = params.id;
    const { mediaSource } = await req.json();

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.hostId !== auth.userId) {
      return NextResponse.json({ error: 'Only host can change media source' }, { status: 403 });
    }

    const validSources = ['SCREEN_SHARE', 'LOCAL_FILE', 'YOUTUBE'];
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: { mediaSource: validSources.includes(mediaSource) ? mediaSource : 'SCREEN_SHARE' },
    });

    return NextResponse.json({ room: updatedRoom });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update media source' }, { status: 500 });
  }
}
