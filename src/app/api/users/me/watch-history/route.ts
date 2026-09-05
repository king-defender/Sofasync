import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const history = await prisma.watchHistory.findMany({
      where: { userId: auth.userId },
      include: {
        room: {
          select: {
            id: true,
            mediaSource: true,
            createdAt: true,
            host: { select: { displayName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch watch history' }, { status: 500 });
  }
}
