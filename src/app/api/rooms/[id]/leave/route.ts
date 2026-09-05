import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roomId = params.id;
    await prisma.roomParticipant.updateMany({
      where: { roomId, userId: auth.userId, leftAt: null },
      data: { leftAt: new Date() },
    });

    // Check remaining participants
    const activeCount = await prisma.roomParticipant.count({
      where: { roomId, leftAt: null },
    });

    if (activeCount === 0) {
      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to leave room' }, { status: 500 });
  }
}
