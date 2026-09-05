import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contacts = await prisma.contact.findMany({
      where: {
        OR: [{ initiatorId: auth.userId }, { receiverId: auth.userId }],
        status: 'ACCEPTED',
      },
      include: {
        initiator: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        receiver: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    const formatted = contacts.map((c) => {
      const friend = c.initiatorId === auth.userId ? c.receiver : c.initiator;
      return { contactId: c.id, ...friend };
    });

    return NextResponse.json({ contacts: formatted });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { receiverId } = await req.json();
    if (!receiverId) return NextResponse.json({ error: 'Receiver ID required' }, { status: 400 });

    const contact = await prisma.contact.upsert({
      where: {
        initiatorId_receiverId: { initiatorId: auth.userId, receiverId },
      },
      update: { status: 'ACCEPTED' },
      create: {
        initiatorId: auth.userId,
        receiverId,
        status: 'ACCEPTED',
      },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add contact' }, { status: 500 });
  }
}
