import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requestId = params.id;
    const { status } = await req.json(); // 'ACCEPTED' | 'DECLINED'

    const request = await prisma.buddyRequest.findUnique({
      where: { id: requestId },
      include: { room: true },
    });

    if (!request || request.receiverId !== auth.userId) {
      return NextResponse.json({ error: 'Invite not found or unauthorized' }, { status: 404 });
    }

    const updated = await prisma.buddyRequest.update({
      where: { id: requestId },
      data: { status: status === 'ACCEPTED' ? 'ACCEPTED' : 'DECLINED' },
    });

    if (status === 'ACCEPTED' && request.roomId) {
      // Auto join participant to room
      await prisma.roomParticipant.upsert({
        where: { roomId_userId: { roomId: request.roomId, userId: auth.userId } },
        update: { leftAt: null, cameraOn: true, micOn: true },
        create: {
          roomId: request.roomId,
          userId: auth.userId,
          cameraOn: true,
          micOn: true,
        },
      });

      // Send notification to sender
      await prisma.notification.create({
        data: {
          userId: request.senderId,
          type: 'ROOM_INVITE_ACCEPTED',
          payload: {
            roomId: request.roomId,
            acceptorName: auth.displayName,
          },
        },
      });
    }

    return NextResponse.json({ request: updated, roomId: request.roomId });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update buddy request' }, { status: 500 });
  }
}
