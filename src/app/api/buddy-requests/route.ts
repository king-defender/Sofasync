import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { receiverId, roomId } = await req.json();
    if (!receiverId) return NextResponse.json({ error: 'Receiver ID required' }, { status: 400 });

    let targetRoomId = roomId;
    if (!targetRoomId) {
      const room = await prisma.room.create({
        data: {
          hostId: auth.userId,
          mediaSource: 'SCREEN_SHARE',
          status: 'ACTIVE',
        },
      });
      targetRoomId = room.id;
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry (FR-3.4)

    const request = await prisma.buddyRequest.create({
      data: {
        senderId: auth.userId,
        receiverId,
        roomId: targetRoomId,
        expiresAt,
      },
    });

    // Create Notification (FR-3.2)
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'BUDDY_REQUEST',
        payload: {
          requestId: request.id,
          roomId: targetRoomId,
          senderName: auth.displayName,
        },
      },
    });

    return NextResponse.json({ request, roomId: targetRoomId });
  } catch (error) {
    console.error('Buddy request error:', error);
    return NextResponse.json({ error: 'Failed to send buddy request' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const requests = await prisma.buddyRequest.findMany({
      where: {
        receiverId: auth.userId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        room: true,
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch buddy requests' }, { status: 500 });
  }
}
