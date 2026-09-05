import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userBadges = await prisma.userBadge.findMany({
      where: { userId: auth.userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });

    return NextResponse.json({ badges: userBadges });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
  }
}
