import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        age: true,
        role: true,
        isGuest: true,
        isSuspended: true,
        createdAt: true,
        badges: {
          include: {
            badge: true,
          },
        },
      },
    });

    if (!user || user.isSuspended) {
      return NextResponse.json({ error: 'User unavailable or suspended' }, { status: 403 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
